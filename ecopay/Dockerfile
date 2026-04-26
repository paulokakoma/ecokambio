FROM node:20-alpine

WORKDIR /usr/src/app

COPY backend/package*.json ./
RUN npm install --omit=dev

COPY backend/ ./backend/
COPY public/ ./public/

EXPOSE 3001

CMD ["node", "backend/app.js"]