import { Router, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db/schema.js';
import {
  buildNextcloudPaths,
  queueNextcloudDeletion,
  triggerNextcloudSync,
} from '../services/nextcloud.js';
import { uploadsDir } from '../storage.js';

export const documentsRouter = Router();

function formatDocumentRow(doc: any) {
  return {
    id: doc.id,
    title: doc.title,
    docType: doc.doc_type,
    header: JSON.parse(doc.header_json || '{}'),
    pages: JSON.parse(doc.pages_json || '[]'),
    defaultWatermarkOnUpload: Boolean(doc.default_watermark_on_upload),
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
    photoCount: doc.photo_count || 0,
  };
}

// GET deleted document tombstones
documentsRouter.get('/deleted-ids', (req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT id FROM deleted_documents').all() as Array<{ id: string }>;
    res.json({ deletedIds: rows.map((r) => r.id) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET all documents
documentsRouter.get('/', (req: Request, res: Response) => {
  try {
    const docs = db.prepare(`
      SELECT d.*,
        (SELECT COUNT(*) FROM photos p WHERE p.document_id = d.id) as photo_count
      FROM documents d
      ORDER BY d.updated_at DESC
    `).all() as any[];

    res.json(docs.map(formatDocumentRow));
  } catch (error: any) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET single document by ID
documentsRouter.get('/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as any;
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Get all photos belonging to this document
    const photos = db.prepare(`
      SELECT id, document_id, page_id, slot_index, captured_by, rotation,
             watermark_enabled, watermark_json, width, height, nextcloud_status,
             nextcloud_path, created_at, updated_at
      FROM photos
      WHERE document_id = ?
    `).all(id) as any[];

    const photosMap: Record<string, any> = {};
    for (const p of photos) {
      photosMap[p.id] = {
        id: p.id,
        documentId: p.document_id,
        pageId: p.page_id,
        slotIndex: p.slot_index,
        capturedBy: p.captured_by,
        rotation: p.rotation,
        watermarkEnabled: Boolean(p.watermark_enabled),
        watermark: JSON.parse(p.watermark_json || '{}'),
        width: p.width,
        height: p.height,
        nextcloudStatus: p.nextcloud_status,
        nextcloudPath: p.nextcloud_path,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        renderedUrl: `/api/photos/${p.id}/rendered`,
        rawUrl: `/api/photos/${p.id}/raw`,
      };
    }

    res.json({
      id: doc.id,
      title: doc.title,
      docType: doc.doc_type,
      header: JSON.parse(doc.header_json || '{}'),
      pages: JSON.parse(doc.pages_json || '[]'),
      defaultWatermarkOnUpload: Boolean(doc.default_watermark_on_upload),
      createdAt: doc.created_at,
      updatedAt: doc.updated_at,
      photos: photosMap,
    });
  } catch (error: any) {
    console.error('Error fetching document details:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST create or upsert document
documentsRouter.post('/', (req: Request, res: Response) => {
  try {
    const { id, title, docType, header, pages, defaultWatermarkOnUpload, createdAt, updatedAt, updatedBy } = req.body;
    const now = Date.now();

    const docId = id || `doc_${now}_${Math.random().toString(36).substring(2, 7)}`;
    const docTitle = title || 'Dokumen Baru';
    const type = docType || 'CW';
    const headerJson = JSON.stringify(header || {});
    const pagesJson = JSON.stringify(pages || []);
    const watermarkDefault = defaultWatermarkOnUpload ? 1 : 0;
    const created = createdAt || now;
    const requestedUpdated = updatedAt || now;

    const existing = db.prepare('SELECT id, updated_at FROM documents WHERE id = ?').get(docId) as any;
    const hasExpectedVersion = Object.prototype.hasOwnProperty.call(req.body, 'expectedUpdatedAt');
    if (
      existing &&
      hasExpectedVersion &&
      req.body.expectedUpdatedAt !== existing.updated_at
    ) {
      const current = db.prepare(`
        SELECT d.*, (SELECT COUNT(*) FROM photos p WHERE p.document_id = d.id) as photo_count
        FROM documents d WHERE d.id = ?
      `).get(docId) as any;
      return res.status(409).json({
        error: 'Dokumen berubah di server sejak sinkronisasi terakhir.',
        document: formatDocumentRow(current),
      });
    }

    const updated =
      existing && hasExpectedVersion
        ? Math.max(Date.now(), existing.updated_at + 1, requestedUpdated)
        : requestedUpdated;

    db.prepare(`
      INSERT INTO documents (
        id, title, doc_type, header_json, pages_json,
        default_watermark_on_upload, nextcloud_folder_status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = CASE WHEN excluded.updated_at >= documents.updated_at THEN excluded.title ELSE documents.title END,
        doc_type = CASE WHEN excluded.updated_at >= documents.updated_at THEN excluded.doc_type ELSE documents.doc_type END,
        header_json = CASE WHEN excluded.updated_at >= documents.updated_at THEN excluded.header_json ELSE documents.header_json END,
        pages_json = CASE WHEN excluded.updated_at >= documents.updated_at THEN excluded.pages_json ELSE documents.pages_json END,
        default_watermark_on_upload = CASE WHEN excluded.updated_at >= documents.updated_at THEN excluded.default_watermark_on_upload ELSE documents.default_watermark_on_upload END,
        nextcloud_folder_status = CASE
          WHEN excluded.updated_at >= documents.updated_at AND (
            excluded.title != documents.title OR excluded.header_json != documents.header_json
          ) THEN 'pending'
          ELSE COALESCE(documents.nextcloud_folder_status, 'pending')
        END,
        updated_at = MAX(documents.updated_at, excluded.updated_at)
    `).run(docId, docTitle, type, headerJson, pagesJson, watermarkDefault, created, updated);

    db.prepare('DELETE FROM deleted_documents WHERE id = ?').run(docId);

    const saved = db.prepare(`
      SELECT d.*, (SELECT COUNT(*) FROM photos p WHERE p.document_id = d.id) as photo_count
      FROM documents d WHERE d.id = ?
    `).get(docId) as any;

    const formatted = formatDocumentRow(saved);

    // Immediately trigger Nextcloud folder creation in background
    triggerNextcloudSync();

    const io = req.app.get('io');
    if (io) {
      io.to('workspace').emit(existing ? 'document_changed' : 'document_created', {
        document: formatted,
        userName: updatedBy || 'System',
      });
    }

    res.status(existing ? 200 : 201).json(formatted);
  } catch (error: any) {
    console.error('Error creating document:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT update document
documentsRouter.put('/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    const existing = db.prepare('SELECT id, updated_at FROM documents WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const { title, header, pages, defaultWatermarkOnUpload, updatedAt, updatedBy } = req.body;
    const now = updatedAt || Date.now();

    const updates: string[] = ['updated_at = ?'];
    const values: any[] = [Math.max(now, existing.updated_at || 0)];

    let folderNeedsSync = false;
    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
      folderNeedsSync = true;
    }
    if (header !== undefined) {
      updates.push('header_json = ?');
      values.push(JSON.stringify(header));
      folderNeedsSync = true;
    }
    if (pages !== undefined) {
      updates.push('pages_json = ?');
      values.push(JSON.stringify(pages));
    }
    if (defaultWatermarkOnUpload !== undefined) {
      updates.push('default_watermark_on_upload = ?');
      values.push(defaultWatermarkOnUpload ? 1 : 0);
    }
    if (folderNeedsSync) {
      updates.push(`nextcloud_folder_status = 'pending'`);
    }

    values.push(id);
    db.prepare(`UPDATE documents SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const saved = db.prepare(`
      SELECT d.*, (SELECT COUNT(*) FROM photos p WHERE p.document_id = d.id) as photo_count
      FROM documents d WHERE d.id = ?
    `).get(id) as any;
    const formatted = formatDocumentRow(saved);

    if (folderNeedsSync) {
      triggerNextcloudSync();
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`doc:${id}`).emit('document_updated', {
        document: formatted,
        userName: updatedBy || 'System',
      });
      io.to('workspace').emit('document_changed', {
        document: formatted,
        userName: updatedBy || 'System',
      });
    }

    res.json({ success: true, id, updatedAt: formatted.updatedAt, document: formatted });
  } catch (error: any) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE document
documentsRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    const doc = db.prepare('SELECT title, header_json, nextcloud_folder_path FROM documents WHERE id = ?').get(id) as any;
    const photos = db.prepare('SELECT rendered_file_name, raw_file_name FROM photos WHERE document_id = ?').all(id) as any[];

    if (doc) {
      const { clusterDir, docDir } = buildNextcloudPaths(doc.header_json, doc.title);
      queueNextcloudDeletion(doc.nextcloud_folder_path || docDir, clusterDir);
      triggerNextcloudSync();
    }

    for (const p of photos) {
      if (p.rendered_file_name) {
        const f1 = path.join(uploadsDir, p.rendered_file_name);
        if (fs.existsSync(f1)) fs.unlinkSync(f1);
      }
      if (p.raw_file_name && p.raw_file_name !== p.rendered_file_name) {
        const f2 = path.join(uploadsDir, p.raw_file_name);
        if (fs.existsSync(f2)) fs.unlinkSync(f2);
      }
    }

    db.prepare('DELETE FROM documents WHERE id = ?').run(id);
    db.prepare('INSERT OR REPLACE INTO deleted_documents (id, deleted_at) VALUES (?, ?)').run(id, Date.now());

    const io = req.app.get('io');
    if (io) {
      io.to('workspace').emit('document_deleted', { id });
      io.to(`doc:${id}`).emit('document_deleted', { id });
    }

    res.json({ success: true, id });
  } catch (error: any) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: error.message });
  }
});
