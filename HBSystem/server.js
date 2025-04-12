import express from "express";
import pg from "pg";
import cors from "cors";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;
const SECRET_KEY = "1234";

const db = new pg.Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

app.use(cors());
app.use(express.json());

app.post("/register", async (req, res) =>
{
    try
    {
        const { username, password, fullname, dob, email, phone } = req.body;
        if (!username || !password || !fullname || !dob || !email || !phone)
            return res.status(400).json({ message: "Заполните все поля" });

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await db.query(
            `INSERT INTO "Users" (username, password, fullname, dataofbirth, email, phone)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING user_id`,
            [username, hashedPassword, fullname, dob, email, phone]
        );

        const token = jwt.sign({ userId: result.rows[0].user_id }, SECRET_KEY, { expiresIn: "24h" });

        res.json({ message: "Регистрация успешна", token });
    }
    catch (error)
    {
        res.status(500).json({ message: "Ошибка сервера", error: error.message });
    }
});

app.post("/login", async (req, res) =>
{
    try
    {
        const { username, password } = req.body;
        if (!username || !password)
            return res.status(400).json({ message: "Заполните все поля" });

        const user = await db.query(
            `SELECT * FROM "Users" WHERE username = $1 OR email = $1`,
            [username]
        );

        if (user.rows.length === 0)
            return res.status(401).json({ message: "Неверные учетные данные" });

        const validPassword = await bcrypt.compare(password, user.rows[0].password);
        if (!validPassword)
            return res.status(401).json({ message: "Неверные учетные данные" });

        const token = jwt.sign({ userId: user.rows[0].user_id }, SECRET_KEY, { expiresIn: "1h" });

        res.json({
            token,
            user: {
                username: user.rows[0].username,
                email: user.rows[0].email
            }
        });
    }
    catch (error)
    {
        res.status(500).json({ message: "Ошибка сервера", error: error.message });
    }
});

app.post("/bookHotel", async (req, res) =>
{
  try
  {
    const authH = req.headers.authorization
    if (!authH)
      return res.status(401).json({ msg: "Нет токена" })
      
    const tk = authH.split(" ")[1]
    const dec = jwt.verify(tk, SECRET_KEY)
    const uid = dec.userId
    let { hotel, room, date } = req.body
    if (!hotel || !room || !date)
      return res.status(400).json({ msg: "Заполните все поля" })
      
    // Очистим значение типа комнаты
    room = room.trim()
      
    const r = await db.query(
      `SELECT room_id, price FROM "Rooms" WHERE hotel_id = $1 AND LOWER(status) = LOWER($2)`,
      [
        hotel,
        room
      ]
    )
    if (r.rows.length === 0)
      return res.status(400).json({ msg: "Комната не найдена" })
      
    const rm = r.rows[0]
    const checkIn = date
    const dt = new Date(date)
    dt.setDate(dt.getDate() + 1)
    const checkOut = dt.toISOString().split("T")[0]
    
    const bk = await db.query(
      `SELECT * FROM "Bookings" WHERE room_id = $1 AND $2 < checkoutdate AND $3 > checkindate`,
      [
        rm.room_id,
        checkIn,
        checkOut
      ]
    )
    if (bk.rows.length > 0)
      return res.status(400).json({ msg: "Комната забронирована" })
      
    const bidRes = await db.query(
      `SELECT COALESCE(MAX(booking_id), 0) + 1 AS bid FROM "Bookings"`
    )
    const bid = bidRes.rows[0].bid
    
    await db.query(
      `INSERT INTO "Bookings" (booking_id, user_id, room_id, checkindate, checkoutdate, datecreated, totalprice, paystatus)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6, 'pending')`,
      [
        bid,
        uid,
        rm.room_id,
        checkIn,
        checkOut,
        rm.price
      ]
    )
    
    res.json({ msg: "Бронирование успешно" })
  }
  catch (e)
  {
    res.status(500).json({ msg: "Ошибка сервера", error: e.message })
  }
})



app.get("/profile", async (req, res) =>
{
    try
    {
        const authHeader = req.headers.authorization;
        if (!authHeader)
            return res.status(401).json({ message: "Нет токена" });

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, SECRET_KEY);

        const user = await db.query(
            `SELECT fullname, dataofbirth, email, phone FROM "Users" WHERE user_id = $1`,
            [decoded.userId]
        );

        if (user.rows.length === 0)
            return res.status(404).json({ message: "Пользователь не найден" });

        res.json(user.rows[0]);
    }
    catch (error)
    {
        res.status(401).json({ message: "Ошибка авторизации", error: error.message });
    }
});

app.listen(port, '0.0.0.0', () => 
  console.log(`Сервер запущен на http://176.108.251.188:${port}`)
);
