import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';

import { initDatabase } from './db/schema.js';
import { startNextcloudQueueWorker } from './services/nextcloud.js';
import { setupSocketHandlers } from './socket.js';
import { documentsRouter } from './routes/documents.js';
import { photosRouter } from './routes/photos.js';
import { nextcloudRouter } from './routes/nextcloud.js';
import { sitesRouter } from './routes/sites.js';

// Initialize SQLite Schema
initDatabase();

// Start Nextcloud Background Queue Worker
startNextcloudQueueWorker();

const app = express();
const server = http.createServer(app);

const PORT = parseInt(process.env.PORT || '3001', 10);

// Socket.io configuration (CORS allows all origins with credentials for mobile access)
const io = new SocketIOServer(server, {
  cors: {
    origin: (origin, callback) => callback(null, true),
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

setupSocketHandlers(io);

// Pass io instance to express app so routes can broadcast
app.set('io', io);

// Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API Routes
app.use('/api/documents', documentsRouter);
app.use('/api/photos', photosRouter);
app.use('/api/nextcloud', nextcloudRouter);
app.use('/api/sites', sitesRouter);

// Serve frontend dist if available (production mode)
const distPath = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  console.log(`[Server] Menyajikan UI frontend dari: ${distPath}`);
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🚀 FTTH Photo QC Server berjalan di: http://0.0.0.0:${PORT}`);
  console.log(`📡 WebSocket Realtime aktif`);
  console.log(`☁️  Nextcloud Sync Worker aktif`);
  console.log(`=======================================================`);
});
