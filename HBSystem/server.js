import express from "express";
import pg from "pg";
import cors from "cors";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || "secure_secret_key";

const db = new pg.Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

console.log('CORS_ORIGIN from env:', process.env.CORS_ORIGIN)

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());

app.post("/register", async (req, res) => {
  try {
    const { username, password, fullname, dob: dateofbirth, email, phone } = req.body;
    
    if (!username || !password || !fullname || !dateofbirth || !email || !phone) {
      return res.status(400).json({ message: "Все поля обязательны для заполнения" });
    }

    const userExists = await db.query(
      `SELECT * FROM "Users" WHERE username = $1 OR email = $2`,
      [username, email]
    );

    if (userExists.rows.length > 0) {
      return res.status(409).json({ message: "Пользователь с таким логином или почтой уже существует" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await db.query(
      `INSERT INTO "Users" 
        (username, password, fullname, dateofbirth, email, phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING user_id, username, email`,
      [username, hashedPassword, fullname, dateofbirth, email, phone]
    );

    const token = jwt.sign(
      { userId: newUser.rows[0].user_id },
      SECRET_KEY,
      { expiresIn: "24h" }
    );

    res.status(201).json({
      message: "Регистрация успешна",
      token,
      user: newUser.rows[0]
    });

  } catch (error) {
    console.error("Ошибка регистрации:", error);
    res.status(500).json({ 
      message: "Ошибка сервера",
      error: error.message 
    });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Все поля обязательны для заполнения" });
    }

    const user = await db.query(
      `SELECT * FROM "Users" 
       WHERE username = $1 OR email = $1`,
      [username]
    );

    if (user.rows.length === 0) {
      return res.status(401).json({ message: "Неверные учетные данные" });
    }

    const validPassword = await bcrypt.compare(password, user.rows[0].password);
    if (!validPassword) {
      return res.status(401).json({ message: "Неверные учетные данные" });
    }

    const token = jwt.sign(
      { userId: user.rows[0].user_id },
      SECRET_KEY,
      { expiresIn: "1h" }
    );

    res.json({
      message: "Авторизация успешна",
      token,
      user: {
        userId: user.rows[0].user_id,
        username: user.rows[0].username,
        email: user.rows[0].email
      }
    });

  } catch (error) {
    console.error("Ошибка авторизации:", error);
    res.status(500).json({ 
      message: "Ошибка сервера",
      error: error.message 
    });
  }
});

app.post("/bookHotel", async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader)
      return res.status(401).json({ message: "Требуется авторизация" })

    const token = authHeader.split(" ")[1]
    const decoded = jwt.verify(token, SECRET_KEY)
    const userId = decoded.userId

    const { hotelId, roomType, checkInDate, checkOutDate } = req.body

    const errors = []
    if (!hotelId) errors.push("Не выбран отель")
    if (!roomType) errors.push("Не выбран тип номера")
    if (!checkInDate) errors.push("Не указана дата заезда")
    if (!checkOutDate) errors.push("Не указана дата выезда")
    if (errors.length > 0)
      return res.status(400).json({ message: errors.join(", ") })

    const checkIn = new Date(checkInDate)
    const checkOut = new Date(checkOutDate)
    checkIn.setHours(0, 0, 0, 0)
    checkOut.setHours(0, 0, 0, 0)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime()))
      return res.status(400).json({ message: "Неверный формат дат" })

    const nights = Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24))
    if (nights <= 0)
      return res.status(400).json({ message: "Дата выезда должна быть позже даты заезда" })

    if (checkIn < today)
      return res.status(400).json({ message: "Дата заезда не может быть в прошлом" })

    if (nights > 14)
      return res.status(400).json({ message: "Максимальная продолжительность - 14 ночей" })

    const active = await db.query(
      `SELECT 1 FROM "Bookings" WHERE user_id = $1 AND checkoutdate > CURRENT_DATE`,
      [userId]
    )
    if (active.rows.length > 0)
      return res.status(403).json({ message: "У вас уже есть активное бронирование" })

    const room = await db.query(
      `SELECT r.room_id, r.price_per_night, r.room_number
       FROM "Rooms" r
       WHERE r.hotel_id = $1
         AND r.status = $2
         AND NOT EXISTS (
           SELECT 1 FROM "Bookings" b
           WHERE b.room_id = r.room_id
             AND (
               (b.checkindate <= $3 AND b.checkoutdate > $3) OR
               (b.checkindate < $4 AND b.checkoutdate >= $4) OR
               (b.checkindate >= $3 AND b.checkoutdate <= $4)
             )
         )
       LIMIT 1`,
      [hotelId, roomType, checkInDate, checkOutDate]
    )

    if (room.rows.length === 0)
      return res.status(409).json({ message: "Нет свободных номеров на эти даты" })

    const totalPrice = room.rows[0].price_per_night * nights

    const result = await db.query(
      `INSERT INTO "Bookings" (user_id, room_id, checkindate, checkoutdate, total_price)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING booking_id, checkindate, checkoutdate`,
      [userId, room.rows[0].room_id, checkInDate, checkOutDate, totalPrice]
    )

    res.status(201).json({
      message: "Бронирование успешно создано",
      details: {
        id: result.rows[0].booking_id,
        checkIn: result.rows[0].checkindate,
        checkOut: result.rows[0].checkoutdate,
        total: totalPrice,
        roomNumber: room.rows[0].room_number
      }
    })
  } catch (error) {
    console.error("Ошибка бронирования:", error)
    res.status(500).json({
      message: "Ошибка сервера",
      error: error.message
    })
  }
});


app.post("/check-rooms", async (req, res) => {
  try {
    const { hotelId, checkIn } = req.body;

    const availableRooms = await db.query(
      `SELECT r.status, MIN(r.price_per_night) AS price, COUNT(*) AS count
       FROM "Rooms" r
       WHERE r.hotel_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM "Bookings" b
           WHERE b.room_id = r.room_id
             AND b.checkoutdate >= $2
         )
       GROUP BY r.status`,
      [hotelId, checkIn]
    );    

    res.json(availableRooms.rows);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/profile", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "Требуется авторизация" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, SECRET_KEY);

    const user = await db.query(
      `SELECT 
          user_id, 
          username, 
          fullname, 
          dateofbirth, 
          email, 
          phone 
       FROM "Users" 
       WHERE user_id = $1`,
      [decoded.userId]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    res.json(user.rows[0]);

  } catch (error) {
    console.error("Ошибка получения профиля:", error);
    res.status(500).json({ 
      message: "Ошибка сервера",
      error: error.message 
    });
  }
});


app.get("/myBooking", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(401).json({ message: "Требуется авторизация" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, SECRET_KEY);

    const booking = await db.query(
      `SELECT b.booking_id, b.checkindate, b.checkoutdate, b.total_price,
              r.room_number, r.status AS room_type,
              h.name AS hotel_name
       FROM "Bookings" b
       JOIN "Rooms" r ON b.room_id = r.room_id
       JOIN "Hotels" h ON r.hotel_id = h.hotel_id
       WHERE b.user_id = $1 AND b.checkoutdate >= CURRENT_DATE
       ORDER BY b.checkindate ASC
       LIMIT 1`,
      [decoded.userId]
    );

    if (booking.rows.length === 0)
      return res.json(null);

    res.json(booking.rows[0]);
  } catch (err) {
    console.error("Ошибка получения бронирования:", err);
    res.status(500).json({ message: "Ошибка сервера", error: err.message });
  }
});

app.delete("/cancelBooking/:id", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(401).json({ message: "Требуется авторизация" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, SECRET_KEY);
    const bookingId = req.params.id;

    const booking = await db.query(
      `SELECT * FROM "Bookings" WHERE booking_id = $1 AND user_id = $2`,
      [bookingId, decoded.userId]
    );

    if (booking.rows.length === 0)
      return res.status(404).json({ message: "Бронирование не найдено" });

    await db.query(
      `DELETE FROM "Bookings" WHERE booking_id = $1`,
      [bookingId]
    );

    res.json({ message: "Бронирование отменено" });
  } catch (err) {
    console.error("Ошибка отмены брони:", err);
    res.status(500).json({ message: "Ошибка сервера", error: err.message });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Сервер запущен на http://${process.env.DB_HOST}:${port}`);
});
