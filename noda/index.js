const Redis = require('ioredis');
const axios = require('axios');

// Подключение для подписки
const subscriber = new Redis({
    host: 'redis', // Имя сервиса Redis из Docker Compose
    port: 6379
});

// Подключение для выполнения команд
const client = new Redis({
    host: 'redis', // Имя сервиса Redis из Docker Compose
    port: 6379
});

// Подписываемся на уведомления о истечении срока действия ключей
subscriber.psubscribe('__keyevent@0__:expired', (err, count) => {
    if (err) {
        console.error('Failed to subscribe: %s', err.message);
    } else {
        console.log(`Subscribed successfully! This client is currently subscribed to ${count} channels.`);
    }
});

// Обработка уведомлений
subscriber.on('pmessage', (pattern, channel, message) => {
    console.log(`Received message: ${message} from channel: ${channel}`);

    // Отправка запроса на определённый эндпоинт
    axios.post('http://echoserver:3000', { key: message })
        .then(response => {
            console.log('Successfully sent request:', response.data);
        })
        .catch(error => {
            console.error('Error sending request:', error);
        });
});

// Установка таймера через Lua-скрипт
client.defineCommand('setTimer', {
    numberOfKeys: 1,
    lua: `
        local key = KEYS[1]
        local ttl = ARGV[1]
        redis.call("SET", key, "timer", "EX", ttl)
    `
});

// Пример использования setTimer
setTimeout(() => {
    client.setTimer('my-timer-key', 10);  // Устанавливаем таймер на 10 секунд
}, 5000); // Ждем 5 секунд перед установкой таймера
