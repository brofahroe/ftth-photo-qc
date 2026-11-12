import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { db } from '../db/schema.js';
import {
  testNextcloudConnection,
  processNextcloudQueue,
  getNextcloudConfig,
} from '../services/nextcloud.js';

export const nextcloudRouter = Router();

const pdfDir = path.resolve(process.cwd(), 'uploads', 'pdfs');
if (!fs.existsSync(pdfDir)) {
  fs.mkdirSync(pdfDir, { recursive: true });
}

const pdfUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, pdfDir),
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      cb(null, `${path.parse(file.originalname).name}_${uniqueSuffix}.pdf`);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for full report PDFs
});

// GET status and queue stats
nextcloudRouter.get('/status', (req: Request, res: Response) => {
  try {
    const config = getNextcloudConfig();
    const isConfigured = Boolean(config.url && config.username && config.password);

    const pendingCount = (db.prepare(`SELECT COUNT(*) as count FROM photos WHERE nextcloud_status IN ('pending', 'uploading')`).get() as any)?.count || 0;
    const syncedCount = (db.prepare(`SELECT COUNT(*) as count FROM photos WHERE nextcloud_status = 'synced'`).get() as any)?.count || 0;
    const failedCount = (db.prepare(`SELECT COUNT(*) as count FROM photos WHERE nextcloud_status = 'failed'`).get() as any)?.count || 0;

    res.json({
      configured: isConfigured,
      serverUrl: config.url || null,
      username: config.username || null,
      baseDir: config.baseDir,
      queue: {
        pending: pendingCount,
        synced: syncedCount,
        failed: failedCount,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST test connection
nextcloudRouter.post('/test', async (req: Request, res: Response) => {
  try {
    const result = await testNextcloudConnection();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST manually trigger sync queue
nextcloudRouter.post('/sync-now', async (req: Request, res: Response) => {
  try {
    processNextcloudQueue().catch((err) => console.error('[Manual Sync Error]', err));
    res.json({ success: true, message: 'Sinkronisasi Nextcloud dimulai di latar belakang.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST upload generated PDF report
nextcloudRouter.post('/upload-pdf', pdfUpload.single('pdfFile'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'File PDF tidak ditemukan' });
    }

    const { documentId } = req.body;
    if (!documentId) {
      return res.status(400).json({ error: 'documentId diperlukan' });
    }

    const pdfId = `pdf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    db.prepare(`
      INSERT INTO pdf_exports (id, document_id, file_name, local_path, nextcloud_status, created_at)
      VALUES (?, ?, ?, ?, 'pending', ?)
    `).run(pdfId, documentId, file.filename, file.path, Date.now());

    // Trigger queue
    setTimeout(() => {
      processNextcloudQueue().catch((err) => console.error('[PDF Sync Error]', err));
    }, 200);

    res.json({
      success: true,
      id: pdfId,
      fileName: file.filename,
      message: 'PDF berhasil diunggah ke server dan sedang disinkronkan ke Nextcloud.',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
