const express = require('express');
const Redis = require('ioredis');
const { Pool } = require('pg');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const redisClient = new Redis({
    host: process.env.REDIS_HOST || 'redis',
    port: process.env.REDIS_PORT || 6379
});
const subscriber = new Redis({
    host: process.env.REDIS_HOST || 'redis',
    port: process.env.REDIS_PORT || 6379
});

const pool = new Pool({
    user: process.env.PGUSER || 'your_db_user',
    host: process.env.PGHOST || 'postgres',
    database: process.env.PGDATABASE || 'your_db_name',
    password: process.env.PGPASSWORD || 'your_db_password',
    port: process.env.PGPORT || 5432,
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/', (req, res) => {
    console.log('Received request:', req.body);
    res.json({ status: 'success', received: req.body });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Функция для сохранения таймера в PostgreSQL
async function saveTimerToDB(userId, key, ttl) {
    const query = `
        INSERT INTO timers (user_id, key, ttl, created_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id, key) DO UPDATE
        SET ttl = $3, created_at = NOW()
    `;
    await pool.query(query, [userId, key, ttl]);
}

// Функция для загрузки таймеров из PostgreSQL
async function loadTimersFromDB() {
    const query = `
        SELECT user_id, key, ttl
        FROM timers
    `;
    const res = await pool.query(query);
    res.rows.forEach(row => {
        const userKey = `${row.user_id}:${row.key}`;
        redisClient.set(userKey, 'timer', 'EX', row.ttl);
    });
}

// Загрузка таймеров при запуске приложения
loadTimersFromDB().then(() => {
    console.log('Timers loaded from database');
}).catch(err => {
    console.error('Error loading timers from database:', err);
});

app.post('/set-timer', async (req, res) => {
    const { userId, key, ttl } = req.body;
    const userKey = `${userId}:${key}`;

    try {
        // Устанавливаем таймер на ключ в Redis
        await redisClient.set(userKey, 'timer', 'EX', ttl);
        // Сохраняем таймер в PostgreSQL
        await saveTimerToDB(userId, userKey, ttl);
        console.log(`Таймер установлен: ${userKey} на ${ttl} секунд`);
        res.json({ status: 'success', key: userKey, ttl });
    } catch (error) {
        console.error('Ошибка при установке таймера:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.post('/delete-timer', async (req, res) => {
    const { key } = req.body;
    const userKey = `${key}`;

    try {
        // Удаляем ключ из Redis
        const result = await redisClient.del(userKey);
        if (result === 1) {
            // Удаляем таймер из PostgreSQL
            await pool.query('DELETE FROM timers WHERE key = $1', [userKey]);
            console.log(`Таймер удален: ${userKey}`);
            res.json({ status: 'success', key: userKey });
        } else {
            res.status(404).json({ status: 'error', message: 'Таймер не найден' });
        }
    } catch (error) {
        console.error('Ошибка при удалении таймера:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Подписываемся на события истечения времени ключа
subscriber.psubscribe('__keyevent@0__:expired', (err, count) => {
    if (err) {
        console.error('Ошибка подписки на события истечения ключа:', err);
    } else {
        console.log(`Подписан на ${count} канал(ы) событий истечения ключа.`);
    }
});

subscriber.on('pmessage', async (pattern, channel, message) => {
    console.log(`Таймер истек для ключа: ${message}`);
    await pool.query('DELETE FROM timers WHERE key = $1', [message]);
    io.emit('timerExpired', { key: message });
});

// Новый эндпоинт для получения всех актуальных таймеров и их оставшегося времени
app.get('/timers', async (req, res) => {
    try {
        // Получаем все ключи с установленными таймерами
        const keys = await redisClient.keys('*');
        const timers = [];

        // Для каждого ключа получаем оставшееся время до истечения
        for (const key of keys) {
            const ttl = await redisClient.ttl(key);
            if (ttl > 0) {
                timers.push({ key, ttl });
            }
        }

        res.json({ status: 'success', timers });
    } catch (error) {
        console.error('Ошибка при получении таймеров:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Новый эндпоинт для удаления всех таймеров пользователя
app.delete('/user-timers', async (req, res) => {
    const { userId } = req.body;

    try {
        // Получаем все ключи, соответствующие пользователю
        const keys = await redisClient.keys(`${userId}:*`);

        if (keys.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Таймеры не найдены' });
        }

        // Удаляем все найденные ключи
        await redisClient.del(keys);
        await pool.query('DELETE FROM timers WHERE user_id = $1', [userId]);

        console.log(`Удалены все таймеры для пользователя: ${userId}`);

        res.json({ status: 'success', userId, deletedKeys: keys });
    } catch (error) {
        console.error('Ошибка при удалении таймеров пользователя:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Echo server running on port ${PORT}`);
});
