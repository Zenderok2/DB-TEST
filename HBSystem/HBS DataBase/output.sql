-- Удаление существующих таблиц
DROP TABLE IF EXISTS 
    public."Bookings_discounts",
    public."Bookings_services",
    public."History",
    public."Bookings",
    public."Discounts",
    public."Services",
    public."Rooms",
    public."Hotels",
    public."Users" CASCADE;

-- Отели
CREATE TABLE public."Hotels" (
    hotel_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    location VARCHAR(200) NOT NULL,
    rating NUMERIC(3,2) NOT NULL CHECK (rating BETWEEN 0 AND 5)
);

-- Номера
CREATE TABLE public."Rooms" (
    room_id SERIAL PRIMARY KEY,
    hotel_id INTEGER NOT NULL REFERENCES public."Hotels"(hotel_id) ON DELETE CASCADE,
    room_number INTEGER NOT NULL CHECK (room_number BETWEEN 1 AND 20),
    status VARCHAR(15) NOT NULL CHECK (status IN ('Люкс', 'Эконом')),
    price_per_night NUMERIC(10,2) NOT NULL CHECK (price_per_night > 0),
    fridge BOOLEAN NOT NULL,
    airconditioner BOOLEAN NOT NULL,
    balcony BOOLEAN NOT NULL,
    UNIQUE(hotel_id, room_number)
);

-- Пользователи
CREATE TABLE public."Users" (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    fullname VARCHAR(100) NOT NULL,
    dateofbirth DATE NOT NULL CHECK (dateofbirth <= CURRENT_DATE - INTERVAL '18 years'),
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20) NOT NULL
);

-- Бронирования
CREATE TABLE public."Bookings" (
    booking_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public."Users"(user_id) ON DELETE CASCADE,
    room_id INTEGER NOT NULL REFERENCES public."Rooms"(room_id) ON DELETE CASCADE,
    checkindate DATE NOT NULL CHECK (checkindate >= CURRENT_DATE),
    checkoutdate DATE NOT NULL CHECK (checkoutdate > checkindate),
    date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_price NUMERIC(10,2) NOT NULL,
    paystatus VARCHAR(15) NOT NULL DEFAULT 'pending' CHECK (paystatus IN ('pending', 'paid', 'canceled')),
    CONSTRAINT max_duration CHECK (checkoutdate - checkindate <= 14),
    CONSTRAINT max_future_booking CHECK (checkindate <= CURRENT_DATE + INTERVAL '1 month 15 days')
);

-- Индексы (без CURRENT_DATE в WHERE)
CREATE INDEX idx_user_checkout 
    ON public."Bookings" (user_id, checkoutdate);

CREATE INDEX idx_room_availability 
    ON public."Bookings" (room_id, checkindate, checkoutdate);

-- Вставка тестовых отелей
INSERT INTO public."Hotels" (name, location, rating) VALUES 
('Москва', 'Центр Москвы', 4.5),
('Санкт-Петербург', 'Исторический центр', 4.7),
('Краснодар', 'Центр города', 4.3);

-- Генерация 20 номеров для каждого отеля
DO $$
DECLARE 
    hotel RECORD;
BEGIN
    FOR hotel IN SELECT hotel_id, name FROM public."Hotels" LOOP
        INSERT INTO public."Rooms" (hotel_id, room_number, status, price_per_night, fridge, airconditioner, balcony)
        SELECT 
            hotel.hotel_id,
            num,
            CASE WHEN num <= 10 THEN 'Люкс' ELSE 'Эконом' END,
            CASE 
                WHEN hotel.name = 'Москва' AND num <= 10 THEN 10000
                WHEN hotel.name = 'Москва' THEN 5000
                WHEN hotel.name = 'Санкт-Петербург' AND num <= 10 THEN 12000
                WHEN hotel.name = 'Санкт-Петербург' THEN 6000
                WHEN hotel.name = 'Краснодар' AND num <= 10 THEN 8000
                ELSE 4000
            END,
            num <= 10,
            TRUE,
            num <= 10
        FROM generate_series(1, 20) AS num;
    END LOOP;
END $$;
