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

app.use(cors({
  origin: process.env.CORS_ORIGIN,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// Регистрация пользователя
app.post("/register", async (req, res) => {
  try {
    const { username, password, fullname, dob: dateofbirth, email, phone } = req.body;
    
    if (!username || !password || !fullname || !dateofbirth || !email || !phone) {
      return res.status(400).json({ message: "Все поля обязательны для заполнения" });
    }

    // Проверка существующего пользователя
    const userExists = await db.query(
      `SELECT * FROM "Users" WHERE username = $1 OR email = $2`,
      [username, email]
    );

    if (userExists.rows.length > 0) {
      return res.status(409).json({ message: "Пользователь с таким логином или почтой уже существует" });
    }

    // Хеширование пароля
    const hashedPassword = await bcrypt.hash(password, 10);

    // Создание пользователя
    const newUser = await db.query(
      `INSERT INTO "Users" 
        (username, password, fullname, dateofbirth, email, phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING user_id, username, email`,
      [username, hashedPassword, fullname, dateofbirth, email, phone]
    );

    // Генерация токена
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

// Авторизация пользователя
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Все поля обязательны для заполнения" });
    }

    // Поиск пользователя
    const user = await db.query(
      `SELECT * FROM "Users" 
       WHERE username = $1 OR email = $1`,
      [username]
    );

    if (user.rows.length === 0) {
      return res.status(401).json({ message: "Неверные учетные данные" });
    }

    // Проверка пароля
    const validPassword = await bcrypt.compare(password, user.rows[0].password);
    if (!validPassword) {
      return res.status(401).json({ message: "Неверные учетные данные" });
    }

    // Генерация токена
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

// Бронирование отеля
app.post("/bookHotel", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "Требуется авторизация" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, SECRET_KEY);
    const userId = decoded.userId;

    const { hotelId, roomType, checkInDate } = req.body;

    if (!hotelId || !roomType || !checkInDate) {
      return res.status(400).json({ message: "Все поля обязательны для заполнения" });
    }

    // Поиск доступной комнаты
    const room = await db.query(
      `SELECT room_id, price FROM "Rooms" 
       WHERE hotel_id = $1 
         AND LOWER(status) = LOWER($2)
         AND room_count > 0`,
      [hotelId, roomType]
    );

    if (room.rows.length === 0) {
      return res.status(404).json({ message: "Нет доступных комнат выбранного типа" });
    }

    // Расчет даты выезда
    const checkOutDate = new Date(checkInDate);
    checkOutDate.setDate(checkOutDate.getDate() + 1);

    // Создание бронирования
    const newBooking = await db.query(
      `INSERT INTO "Bookings" 
        (user_id, room_id, checkindate, checkoutdate, totalprice, paystatus)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING booking_id`,
      [
        userId,
        room.rows[0].room_id,
        checkInDate,
        checkOutDate.toISOString().split('T')[0],
        room.rows[0].price
      ]
    );

    // Обновление количества комнат
    await db.query(
      `UPDATE "Rooms" 
       SET room_count = room_count - 1 
       WHERE room_id = $1`,
      [room.rows[0].room_id]
    );

    res.status(201).json({
      message: "Бронирование успешно создано",
      bookingId: newBooking.rows[0].booking_id
    });

  } catch (error) {
    console.error("Ошибка бронирования:", error);
    res.status(500).json({ 
      message: "Ошибка сервера",
      error: error.message 
    });
  }
});

// Получение профиля пользователя
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

// Запуск сервера
app.listen(port, '0.0.0.0', () => {
  console.log(`Сервер запущен на http://${process.env.DB_HOST}:${port}`);
});
