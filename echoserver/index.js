const express = require('express');
const Redis = require('ioredis');
const path = require('path');
const app = express();
const client = new Redis({
    host: 'redis', // Имя сервиса Redis из Docker Compose
    port: 6379
});
const subscriber = new Redis({
    host: 'redis',
    port: 6379
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

app.post('/set-timer', (req, res) => {
    const { userId, key, ttl } = req.body;
    const userKey = `${userId}:${key}`;

    // Устанавливаем таймер на ключ
    client.set(userKey, 'timer', 'EX', ttl)
        .then(() => {
            console.log(`Таймер установлен: ${userKey} на ${ttl} секунд`);
            res.json({ status: 'success', key: userKey, ttl });
        })
        .catch(error => {
            console.error('Ошибка при установке таймера:', error);
            res.status(500).json({ status: 'error', message: error.message });
        });
});

app.post('/delete-timer', (req, res) => {
    const { key } = req.body;

    // Удаляем ключ
    client.del(key)
        .then(result => {
            if (result === 1) {
                console.log(`Таймер удален: ${key}`);
                res.json({ status: 'success', key });
            } else {
                res.status(404).json({ status: 'error', message: 'Таймер не найден' });
            }
        })
        .catch(error => {
            console.error('Ошибка при удалении таймера:', error);
            res.status(500).json({ status: 'error', message: error.message });
        });
});

// Подписываемся на события истечения времени ключа
subscriber.psubscribe('__keyevent@0__:expired', (err, count) => {
    if (err) {
        console.error('Ошибка подписки на события истечения ключа:', err);
    } else {
        console.log(`Подписан на ${count} канал(ы) событий истечения ключа.`);
    }
});

subscriber.on('pmessage', (pattern, channel, message) => {
    console.log(`Таймер истек для ключа: ${message}`);
});

// Новый эндпоинт для получения всех актуальных таймеров и их оставшегося времени
app.get('/timers', async (req, res) => {
    try {
        // Получаем все ключи с установленными таймерами
        const keys = await client.keys('*');
        const timers = [];

        // Для каждого ключа получаем оставшееся время до истечения
        for (const key of keys) {
            const ttl = await client.ttl(key);
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
        const keys = await client.keys(`${userId}:*`);

        if (keys.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Таймеры не найдены' });
        }

        // Удаляем все найденные ключи
        await client.del(keys);
        console.log(`Удалены все таймеры для пользователя: ${userId}`);

        res.json({ status: 'success', userId, deletedKeys: keys });
    } catch (error) {
        console.error('Ошибка при удалении таймеров пользователя:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Echo server running on port ${PORT}`);
});
