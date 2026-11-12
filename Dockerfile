# Production Dockerfile for FTTH Photo QC Server
FROM node:24-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code and config
COPY . .

# Build frontend PWA into dist/
RUN npm run build

# Expose backend port
EXPOSE 3001

ENV PORT=3001
ENV NODE_ENV=production
ENV PHOTOQC_STORAGE_DIR=/app/storage

VOLUME ["/app/storage"]

# Start Node server
CMD ["npm", "run", "start"]
