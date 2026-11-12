import { Router, Request, Response } from 'express';
import { db } from '../db/schema.js';

export const documentsRouter = Router();

// GET all documents
documentsRouter.get('/', (req: Request, res: Response) => {
  try {
    const docs = db.prepare(`
      SELECT d.*,
        (SELECT COUNT(*) FROM photos p WHERE p.document_id = d.id) as photo_count
      FROM documents d
      ORDER BY d.updated_at DESC
    `).all() as any[];

    const formatted = docs.map((doc) => ({
      id: doc.id,
      title: doc.title,
      docType: doc.doc_type,
      header: JSON.parse(doc.header_json || '{}'),
      pages: JSON.parse(doc.pages_json || '[]'),
      defaultWatermarkOnUpload: Boolean(doc.default_watermark_on_upload),
      createdAt: doc.created_at,
      updatedAt: doc.updated_at,
      photoCount: doc.photo_count || 0,
    }));

    res.json(formatted);
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

// POST create new document
documentsRouter.post('/', (req: Request, res: Response) => {
  try {
    const { id, title, docType, header, pages, defaultWatermarkOnUpload, createdAt, updatedAt } = req.body;
    const now = Date.now();

    const docId = id || `doc_${now}_${Math.random().toString(36).substring(2, 7)}`;
    const docTitle = title || 'Dokumen Baru';
    const type = docType || 'CW';
    const headerJson = JSON.stringify(header || {});
    const pagesJson = JSON.stringify(pages || []);
    const watermarkDefault = defaultWatermarkOnUpload ? 1 : 0;
    const created = createdAt || now;
    const updated = updatedAt || now;

    db.prepare(`
      INSERT INTO documents (id, title, doc_type, header_json, pages_json, default_watermark_on_upload, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(docId, docTitle, type, headerJson, pagesJson, watermarkDefault, created, updated);

    res.status(201).json({
      id: docId,
      title: docTitle,
      docType: type,
      header: header || {},
      pages: pages || [],
      defaultWatermarkOnUpload: Boolean(watermarkDefault),
      createdAt: created,
      updatedAt: updated,
    });
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

    const existing = db.prepare('SELECT id FROM documents WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const { title, header, pages, defaultWatermarkOnUpload, updatedAt } = req.body;
    const now = updatedAt || Date.now();

    const updates: string[] = ['updated_at = ?'];
    const values: any[] = [now];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }
    if (header !== undefined) {
      updates.push('header_json = ?');
      values.push(JSON.stringify(header));
    }
    if (pages !== undefined) {
      updates.push('pages_json = ?');
      values.push(JSON.stringify(pages));
    }
    if (defaultWatermarkOnUpload !== undefined) {
      updates.push('default_watermark_on_upload = ?');
      values.push(defaultWatermarkOnUpload ? 1 : 0);
    }

    values.push(id);
    db.prepare(`UPDATE documents SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    res.json({ success: true, id, updatedAt: now });
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

    db.prepare('DELETE FROM documents WHERE id = ?').run(id);
    res.json({ success: true, id });
  } catch (error: any) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: error.message });
  }
});
