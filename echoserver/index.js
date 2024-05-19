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
    const { key, ttl } = req.body;

    // Устанавливаем таймер на ключ
    client.set(key, 'timer', 'EX', ttl)
        .then(() => {
            console.log(`Таймер установлен: ${key} на ${ttl} секунд`);
            res.json({ status: 'success', key, ttl });
        })
        .catch(error => {
            console.error('Ошибка при установке таймера:', error);
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Echo server running on port ${PORT}`);
});
