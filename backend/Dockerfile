FROM node:20 AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --production=false

COPY . .
RUN npm run build

# --- Production image ---
FROM node:20-slim AS production
WORKDIR /app

COPY --from=builder /app/package*.json ./
RUN npm install --production --ignore-scripts --prefer-offline
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/server.js"]