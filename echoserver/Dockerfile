# Используем официальный образ Node.js
FROM node:14

# Создаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем остальную часть приложения
COPY . .

# Запуск приложения
CMD ["node", "index.js"]
