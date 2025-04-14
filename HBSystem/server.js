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

    // Проверка токена
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, SECRET_KEY);
    const userId = decoded.userId;

    // Получение данных из запроса
    const { hotelId, roomNumber, checkInDate, checkOutDate } = req.body;

    // 1. Валидация входных данных
    const errorMessages = [];
    if (!hotelId) errorMessages.push("Не выбран отель");
    if (!roomNumber) errorMessages.push("Не выбран номер");
    if (!checkInDate) errorMessages.push("Не указана дата заезда");
    if (!checkOutDate) errorMessages.push("Не указана дата выезда");
    
    if (errorMessages.length > 0) {
      return res.status(400).json({ message: errorMessages.join(", ") });
    }

    // 2. Проверка формата дат (ИСПРАВЛЕН СИНТАКСИС)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(checkInDate)) { // Добавлена закрывающая скобка
      return res.status(400).json({ message: "Неверный формат даты заезда" });
    }
    if (!dateRegex.test(checkOutDate)) {
      return res.status(400).json({ message: "Неверный формат даты выезда" });
    }

    // 3. Проверка временных ограничений
    const today = new Date();
    const maxAllowedDate = new Date(today);
    maxAllowedDate.setMonth(today.getMonth() + 1, 15); // +1.5 месяца

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const bookingDuration = (checkOut - checkIn) / (1000 * 3600 * 24);

    if (checkIn < today) {
      return res.status(400).json({ message: "Дата заезда не может быть в прошлом" });
    }
    if (checkOut > maxAllowedDate) {
      return res.status(400).json({ message: "Максимальный срок бронирования - 1.5 месяца" });
    }
    if (bookingDuration > 14) {
      return res.status(400).json({ message: "Максимальная продолжительность - 14 дней" });
    }

    // 4. Проверка активных бронирований
    const activeBookings = await db.query(
      `SELECT * FROM "Bookings" 
       WHERE user_id = $1 
       AND checkoutdate > CURRENT_DATE`,
      [userId]
    );

    if (activeBookings.rows.length > 0) {
      return res.status(403).json({ 
        message: "У вас уже есть активное бронирование",
        activeUntil: activeBookings.rows[0].checkoutdate
      });
    }

    // 5. Проверка доступности номера
    const roomAvailability = await db.query(
      `SELECT r.room_id, r.price
       FROM "Rooms" r
       WHERE r.hotel_id = $1
       AND r.room_number = $2
       AND NOT EXISTS (
         SELECT 1 FROM "Bookings" b
         WHERE b.room_id = r.room_id
         AND (
           (b.checkindate <= $3 AND b.checkoutdate >= $3) OR
           (b.checkindate <= $4 AND b.checkoutdate >= $4) OR
           (b.checkindate >= $3 AND b.checkoutdate <= $4)
         )
       )`,
      [hotelId, roomNumber, checkInDate, checkOutDate]
    );

    if (roomAvailability.rows.length === 0) {
      return res.status(409).json({ 
        message: "Номер занят на выбранные даты",
        hint: "Попробуйте другие даты или номер"
      });
    }

    // 6. Создание бронирования
    const totalPrice = roomAvailability.rows[0].price * bookingDuration;
    
    const bookingResult = await db.query(
      `INSERT INTO "Bookings" (
        user_id,
        room_id,
        checkindate,
        checkoutdate,
        totalprice
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING booking_id, checkindate, checkoutdate`,
      [
        userId,
        roomAvailability.rows[0].room_id,
        checkInDate,
        checkOutDate,
        totalPrice
      ]
    );

    // 7. Ответ с деталями бронирования
    res.status(201).json({
      message: "Бронирование успешно создано",
      details: {
        id: bookingResult.rows[0].booking_id,
        checkIn: bookingResult.rows[0].checkindate,
        checkOut: bookingResult.rows[0].checkoutdate,
        total: totalPrice,
        roomNumber: roomNumber
      }
    });

  } catch (error) {
    console.error("Ошибка бронирования:", error);
    
    // Специфичные ошибки PostgreSQL
    if (error.code === '23505') {
      return res.status(409).json({
        message: "Конфликт бронирований",
        hint: "Номер уже занят на эти даты"
      });
    }

    res.status(500).json({
      message: "Ошибка сервера",
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.post("/check-rooms", async (req, res) => {
  try {
    const { hotelId, checkIn } = req.body;

    const availableRooms = await db.query(
      `SELECT r.room_number, r.status, r.price
       FROM "Rooms" r
       WHERE r.hotel_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM "Bookings" b
           WHERE b.room_id = r.room_id
             AND b.checkoutdate >= $2
         )`,
      [hotelId, checkIn]
    );

    res.json(availableRooms.rows);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
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
