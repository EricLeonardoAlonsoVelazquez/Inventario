FROM node:18-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm install

COPY backend/ ./

# Crear la estructura de directorios que espera el backend
RUN mkdir -p /app/frontend

USER node

EXPOSE 3000

CMD ["node", "server.js"]