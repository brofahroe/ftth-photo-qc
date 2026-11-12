import { db } from '../db/database';
import { PhotoRecord, QcDocument } from '../types';
import { getStoredUserName } from './userService';

const getApiBase = () => {
  return window.location.port === '5173'
    ? `http://${window.location.hostname}:3001`
    : '';
};

export async function fetchServerDocuments(): Promise<QcDocument[]> {
  try {
    const res = await fetch(`${getApiBase()}/api/documents`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const docs = await res.json();
    return docs;
  } catch (err) {
    console.warn('[Sync] Failed to fetch server documents:', err);
    return [];
  }
}

export async function syncDocumentsFromServer(): Promise<void> {
  try {
    const serverDocs = await fetchServerDocuments();
    if (!serverDocs || serverDocs.length === 0) return;

    for (const sDoc of serverDocs) {
      const localDoc = await db.documents.get(sDoc.id);
      if (!localDoc || sDoc.updatedAt > localDoc.updatedAt) {
        await db.documents.put(sDoc);
      }
    }
  } catch (err) {
    console.warn('[Sync] Error syncing documents from server:', err);
  }
}

export async function pushDocumentToServer(doc: QcDocument): Promise<void> {
  try {
    await fetch(`${getApiBase()}/api/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doc),
    });
  } catch (err) {
    console.warn('[Sync] Failed to push document to server:', err);
  }
}

export async function updateDocumentOnServer(docId: string, patch: Partial<QcDocument>): Promise<void> {
  try {
    await fetch(`${getApiBase()}/api/documents/${docId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
  } catch (err) {
    console.warn('[Sync] Failed to update document on server:', err);
  }
}

export async function deleteDocumentOnServer(docId: string): Promise<void> {
  try {
    await fetch(`${getApiBase()}/api/documents/${docId}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('[Sync] Failed to delete document on server:', err);
  }
}

export async function uploadPhotoToServer(params: {
  record: PhotoRecord;
  pageId?: string;
  slotIndex?: number;
}): Promise<boolean> {
  try {
    const userName = getStoredUserName() || 'Teknisi Lapangan';
    const formData = new FormData();
    formData.append('id', params.record.id);
    formData.append('documentId', params.record.documentId);
    if (params.pageId) formData.append('pageId', params.pageId);
    if (params.slotIndex !== undefined) formData.append('slotIndex', String(params.slotIndex));
    formData.append('capturedBy', userName);
    formData.append('rotation', String(params.record.rotation));
    formData.append('watermarkEnabled', String(params.record.watermarkEnabled));
    formData.append('watermark', JSON.stringify(params.record.watermark));
    formData.append('width', String(params.record.width));
    formData.append('height', String(params.record.height));
    formData.append('createdAt', String(params.record.createdAt));

    formData.append('renderedImage', params.record.renderedBlob, `rendered_${params.record.id}.jpg`);
    formData.append('rawImage', params.record.rawBlob, `raw_${params.record.id}.jpg`);

    const res = await fetch(`${getApiBase()}/api/photos/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      console.warn(`[Sync] Upload photo failed with status ${res.status}`);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('[Sync] Error uploading photo to server:', err);
    return false;
  }
}

export async function fetchPhotoFromServerAndCache(
  photoId: string,
  documentId: string,
  meta?: any
): Promise<PhotoRecord | null> {
  try {
    const existing = await db.photos.get(photoId);
    if (existing && existing.documentId === documentId) return existing;

    const base = getApiBase();
    const renderedRes = await fetch(`${base}/api/photos/${photoId}/rendered`);
    if (!renderedRes.ok) return null;
    const renderedBlob = await renderedRes.blob();

    let rawBlob = renderedBlob;
    try {
      const rawRes = await fetch(`${base}/api/photos/${photoId}/raw`);
      if (rawRes.ok) {
        rawBlob = await rawRes.blob();
      }
    } catch {}

    const record: PhotoRecord = {
      id: photoId,
      documentId: documentId,
      rawBlob,
      renderedBlob,
      rotation: meta?.rotation ?? 0,
      watermarkEnabled: Boolean(meta?.watermarkEnabled),
      watermark: meta?.watermark || {
        timestampText: '',
        coordText: '',
        addressLines: [],
      },
      width: meta?.width || 1400,
      height: meta?.height || 1050,
      createdAt: meta?.createdAt || Date.now(),
      updatedAt: meta?.updatedAt || Date.now(),
    };

    await db.photos.put(record);
    return record;
  } catch (err) {
    console.error('[Sync] Error caching photo from server:', err);
    return null;
  }
}

export async function syncDocumentAndPhotosFromServer(documentId: string): Promise<void> {
  try {
    const base = getApiBase();
    const res = await fetch(`${base}/api/documents/${documentId}`);
    if (!res.ok) return;
    const docData = await res.json();

    // 1. Update local document
    const localDoc = await db.documents.get(documentId);
    if (!localDoc || docData.updatedAt >= localDoc.updatedAt) {
      await db.documents.put({
        id: docData.id,
        title: docData.title,
        docType: docData.docType,
        header: docData.header,
        pages: docData.pages,
        defaultWatermarkOnUpload: docData.defaultWatermarkOnUpload,
        createdAt: docData.createdAt,
        updatedAt: docData.updatedAt,
      });
    }

    // 2. Fetch all missing photos for this document from server
    if (docData.photos) {
      const photos = Object.values(docData.photos) as any[];
      for (const p of photos) {
        const localPhoto = await db.photos.get(p.id);
        if (!localPhoto) {
          await fetchPhotoFromServerAndCache(p.id, documentId, p);
        }
      }
    }
  } catch (err) {
    console.warn('[Sync] Failed to sync document and photos from server:', err);
  }
}

export async function uploadPdfReportToNextcloud(documentId: string, pdfBlob: Blob, fileName: string): Promise<{ success: boolean; message: string }> {
  try {
    const formData = new FormData();
    formData.append('documentId', documentId);
    formData.append('pdfFile', pdfBlob, fileName);

    const res = await fetch(`${getApiBase()}/api/nextcloud/upload-pdf`, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, message: err.message || 'Gagal mengunggah PDF ke Nextcloud' };
  }
}

export async function getNextcloudStatus(): Promise<{
  configured: boolean;
  serverUrl: string | null;
  username: string | null;
  baseDir: string;
  queue: { pending: number; synced: number; failed: number };
}> {
  try {
    const res = await fetch(`${getApiBase()}/api/nextcloud/status`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return {
      configured: false,
      serverUrl: null,
      username: null,
      baseDir: '/PhotoQC',
      queue: { pending: 0, synced: 0, failed: 0 },
    };
  }
}
