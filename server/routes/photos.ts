import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { db } from '../db/schema.js';
import { processNextcloudQueue } from '../services/nextcloud.js';

export const photosRouter = Router();

const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    cb(null, `photo_${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB limit per image
});

// POST upload photo with multipart files
photosRouter.post(
  '/upload',
  upload.fields([
    { name: 'renderedImage', maxCount: 1 },
    { name: 'rawImage', maxCount: 1 },
  ]),
  (req: Request, res: Response) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const renderedFile = files?.renderedImage?.[0];
      const rawFile = files?.rawImage?.[0] || renderedFile;

      if (!renderedFile) {
        return res.status(400).json({ error: 'Rendered image file is required' });
      }

      const {
        id,
        documentId,
        pageId,
        slotIndex,
        capturedBy,
        rotation,
        watermarkEnabled,
        watermark,
        width,
        height,
        createdAt,
      } = req.body;

      if (!documentId) {
        return res.status(400).json({ error: 'documentId is required' });
      }

      const photoId = id || `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = Date.now();
      const parsedSlotIndex = slotIndex !== undefined ? parseInt(slotIndex, 10) : null;
      const parsedRotation = rotation !== undefined ? parseInt(rotation, 10) : 0;
      const parsedWatermarkEnabled = watermarkEnabled === 'true' || watermarkEnabled === true || watermarkEnabled === 1 ? 1 : 0;
      const watermarkJson = typeof watermark === 'string' ? watermark : JSON.stringify(watermark || {});
      const parsedWidth = width ? parseInt(width, 10) : 0;
      const parsedHeight = height ? parseInt(height, 10) : 0;
      const parsedCreatedAt = createdAt ? parseInt(createdAt, 10) : now;

      // Upsert into SQLite
      db.prepare(`
        INSERT INTO photos (
          id, document_id, page_id, slot_index, captured_by,
          raw_file_name, rendered_file_name, rotation,
          watermark_enabled, watermark_json, width, height,
          nextcloud_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          page_id = excluded.page_id,
          slot_index = excluded.slot_index,
          captured_by = excluded.captured_by,
          raw_file_name = excluded.raw_file_name,
          rendered_file_name = excluded.rendered_file_name,
          rotation = excluded.rotation,
          watermark_enabled = excluded.watermark_enabled,
          watermark_json = excluded.watermark_json,
          width = excluded.width,
          height = excluded.height,
          nextcloud_status = 'pending',
          updated_at = excluded.updated_at
      `).run(
        photoId,
        documentId,
        pageId || null,
        parsedSlotIndex,
        capturedBy || 'Teknisi Lapangan',
        rawFile ? path.basename(rawFile.filename) : path.basename(renderedFile.filename),
        path.basename(renderedFile.filename),
        parsedRotation,
        parsedWatermarkEnabled,
        watermarkJson,
        parsedWidth,
        parsedHeight,
        parsedCreatedAt,
        now
      );

      // Keep documents.pages_json up to date in SQLite
      if (documentId && pageId && parsedSlotIndex !== null) {
        const docRow = db.prepare('SELECT pages_json FROM documents WHERE id = ?').get(documentId) as any;
        if (docRow && docRow.pages_json) {
          try {
            const pages = JSON.parse(docRow.pages_json);
            const updatedPages = pages.map((p: any) => {
              if (p.id === pageId) {
                return {
                  ...p,
                  slots: p.slots.map((s: any) =>
                    s.slotIndex === parsedSlotIndex ? { ...s, photoId } : s
                  ),
                };
              }
              return p;
            });
            db.prepare('UPDATE documents SET pages_json = ?, updated_at = ? WHERE id = ?').run(
              JSON.stringify(updatedPages),
              now,
              documentId
            );
          } catch (e) {
            console.warn('[Server] Error updating doc pages on photo upload:', e);
          }
        }
      }

      // Broadcast realtime slot update to all connected clients in this document room
      const io = req.app.get('io');
      if (io) {
        io.to(`doc:${documentId}`).emit('slot_updated', {
          pageId,
          slotIndex: parsedSlotIndex,
          photoRecord: {
            id: photoId,
            documentId,
            rotation: parsedRotation,
            watermarkEnabled: Boolean(parsedWatermarkEnabled),
            watermark: JSON.parse(watermarkJson),
            width: parsedWidth,
            height: parsedHeight,
          },
          userName: capturedBy || 'Teknisi Lapangan',
        });
        io.to(`doc:${documentId}`).emit('slot_unlocked', {
          pageId,
          slotIndex: parsedSlotIndex,
        });
      }

      // Trigger background sync to Nextcloud
      setTimeout(() => {
        processNextcloudQueue().catch((err) => console.error('[Nextcloud Queue Error]', err));
      }, 500);

      res.status(201).json({
        id: photoId,
        documentId,
        pageId,
        slotIndex: parsedSlotIndex,
        capturedBy: capturedBy || 'Teknisi Lapangan',
        rotation: parsedRotation,
        watermarkEnabled: Boolean(parsedWatermarkEnabled),
        watermark: JSON.parse(watermarkJson),
        width: parsedWidth,
        height: parsedHeight,
        nextcloudStatus: 'pending',
        createdAt: parsedCreatedAt,
        updatedAt: now,
        renderedUrl: `/api/photos/${photoId}/rendered`,
        rawUrl: `/api/photos/${photoId}/raw`,
      });
    } catch (error: any) {
      console.error('Error saving photo:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// GET rendered photo binary
photosRouter.get('/:id/rendered', (req: Request, res: Response) => {
  try {
    const photo = db.prepare('SELECT rendered_file_name, raw_file_name FROM photos WHERE id = ?').get(req.params.id) as any;
    if (!photo) {
      return res.status(404).send('Photo not found');
    }

    const fileName = photo.rendered_file_name || photo.raw_file_name;
    const filePath = path.join(uploadsDir, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Photo file not found on disk');
    }

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    fs.createReadStream(filePath).pipe(res);
  } catch (error: any) {
    res.status(500).send(error.message);
  }
});

// GET raw photo binary
photosRouter.get('/:id/raw', (req: Request, res: Response) => {
  try {
    const photo = db.prepare('SELECT raw_file_name, rendered_file_name FROM photos WHERE id = ?').get(req.params.id) as any;
    if (!photo) {
      return res.status(404).send('Photo not found');
    }

    const fileName = photo.raw_file_name || photo.rendered_file_name;
    const filePath = path.join(uploadsDir, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Photo file not found on disk');
    }

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    fs.createReadStream(filePath).pipe(res);
  } catch (error: any) {
    res.status(500).send(error.message);
  }
});

// DELETE photo
photosRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(id) as any;
    if (photo) {
      if (photo.rendered_file_name) {
        const p1 = path.join(uploadsDir, photo.rendered_file_name);
        if (fs.existsSync(p1)) fs.unlinkSync(p1);
      }
      if (photo.raw_file_name && photo.raw_file_name !== photo.rendered_file_name) {
        const p2 = path.join(uploadsDir, photo.raw_file_name);
        if (fs.existsSync(p2)) fs.unlinkSync(p2);
      }

      // Update documents pages_json to clear slot photoId
      if (photo.document_id) {
        const docRow = db.prepare('SELECT pages_json FROM documents WHERE id = ?').get(photo.document_id) as any;
        if (docRow && docRow.pages_json) {
          try {
            const pages = JSON.parse(docRow.pages_json);
            const updated = pages.map((p: any) => ({
              ...p,
              slots: p.slots.map((s: any) => (s.photoId === id ? { ...s, photoId: null } : s)),
            }));
            db.prepare('UPDATE documents SET pages_json = ?, updated_at = ? WHERE id = ?').run(
              JSON.stringify(updated),
              Date.now(),
              photo.document_id
            );
          } catch {}
        }

        const io = req.app.get('io');
        if (io) {
          io.to(`doc:${photo.document_id}`).emit('slot_updated', {
            pageId: photo.page_id,
            slotIndex: photo.slot_index,
            photoRecord: null,
            userName: 'System',
          });
        }
      }
    }
    db.prepare('DELETE FROM photos WHERE id = ?').run(id);
    res.json({ success: true, id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
