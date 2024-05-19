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
        console.error('Не удалось подписаться: %s', err.message);
    } else {
        console.log(`Успешно подписались! Этот клиент сейчас подписан на ${count} каналов.`);
    }
});

// Обработка уведомлений
subscriber.on('pmessage', (pattern, channel, message) => {
    console.log(`Получено сообщение: ${message} из канала: ${channel}`);

    // Отправка запроса на определённый эндпоинт
    axios.post('http://echoserver:3000', { key: message })
        .then(response => {
            console.log('Успешно отправлен запрос:', response.data);
        })
        .catch(error => {
            console.error('Ошибка при отправке запроса:', error);
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
    client.setTimer('my-timer-key', 10)  // Устанавливаем таймер на 10 секун
        .then(() => {
            console.log('Таймер установлен на 10 секунд');
        })
        .catch(error => {
            console.error('Ошибка при установке таймера:', error);
        });
}, 6000); // Ждем 5 секунд перед установкой таймера
