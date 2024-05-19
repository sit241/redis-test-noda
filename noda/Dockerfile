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

# Установка nodemon глобально
RUN npm install -g nodemon

# Запуск приложения с nodemon
CMD ["nodemon", "index.js"]
