import { db } from '../db/database';
import { PhotoRecord, QcDocument } from '../types';
import { getStoredUserName } from './userService';
import { getApiBaseUrl } from './serverUrl';

async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = 45_000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchServerDocuments(): Promise<QcDocument[] | null> {
  try {
    const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/documents`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[Sync] Failed to fetch server documents:', err);
    return null;
  }
}

export async function fetchServerDeletedDocIds(): Promise<string[]> {
  try {
    const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/documents/deleted-ids`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.deletedIds) ? data.deletedIds : [];
  } catch {
    return [];
  }
}

export async function pushDocumentToServer(doc: QcDocument): Promise<boolean> {
  try {
    const userName = getStoredUserName() || 'Teknisi Lapangan';
    const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...doc, updatedBy: userName }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[Sync] Failed to push document to server:', err);
    return false;
  }
}

export async function updateDocumentOnServer(
  docId: string,
  patch: Partial<QcDocument>,
  fullDocFallback?: QcDocument
): Promise<boolean> {
  try {
    const userName = getStoredUserName() || 'Teknisi Lapangan';
    const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/documents/${docId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...patch, updatedBy: userName }),
    });
    if (res.status === 404 && fullDocFallback) {
      return await pushDocumentToServer(fullDocFallback);
    }
    return res.ok;
  } catch (err) {
    console.warn('[Sync] Failed to update document on server:', err);
    return false;
  }
}

export async function deleteDocumentOnServer(docId: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/documents/${docId}`, {
      method: 'DELETE',
    });
    return res.ok || res.status === 404;
  } catch (err) {
    console.warn('[Sync] Failed to delete document on server:', err);
    return false;
  }
}

export async function deletePhotoOnServer(photoId: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/photos/${photoId}`, {
      method: 'DELETE',
    });
    return res.ok || res.status === 404;
  } catch (err) {
    console.warn('[Sync] Failed to delete photo on server:', err);
    return false;
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

    const res = await fetchWithTimeout(
      `${getApiBaseUrl()}/api/photos/upload`,
      {
        method: 'POST',
        body: formData,
      },
      60_000
    );

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
    const remoteUpdatedAt = typeof meta?.updatedAt === 'number' ? meta.updatedAt : 0;
    if (
      existing &&
      existing.documentId === documentId &&
      (!remoteUpdatedAt || existing.updatedAt >= remoteUpdatedAt)
    ) {
      return existing;
    }

    const base = getApiBaseUrl();
    const bust = remoteUpdatedAt || Date.now();
    const renderedRes = await fetchWithTimeout(
      `${base}/api/photos/${photoId}/rendered?v=${bust}`,
      { cache: 'no-store' }
    );
    if (!renderedRes.ok) return null;
    const renderedBlob = await renderedRes.blob();

    let rawBlob = renderedBlob;
    try {
      const rawRes = await fetchWithTimeout(
        `${base}/api/photos/${photoId}/raw?v=${bust}`,
        { cache: 'no-store' }
      );
      if (rawRes.ok) {
        rawBlob = await rawRes.blob();
      }
    } catch {}

    const record: PhotoRecord = {
      id: photoId,
      documentId,
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
      updatedAt: remoteUpdatedAt || Date.now(),
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
    const base = getApiBaseUrl();
    const res = await fetchWithTimeout(`${base}/api/documents/${documentId}`, {
      cache: 'no-store',
    });
    if (!res.ok) return;
    const docData = await res.json();

    // 1. Update local document if server is newer or equal
    const localDoc = await db.documents.get(documentId);
    const pendingOutbox = await db.syncOutbox.get(`doc_upsert:${documentId}`);
    if (!pendingOutbox && (!localDoc || docData.updatedAt >= localDoc.updatedAt)) {
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

    // 2. Fetch missing or updated photos for this document from server
    if (docData.photos) {
      const photos = Object.values(docData.photos) as any[];
      for (const p of photos) {
        const pendingPhoto = await db.syncOutbox.get(`photo_upsert:${p.id}`);
        if (pendingPhoto) continue;
        await fetchPhotoFromServerAndCache(p.id, documentId, p);
      }
    }
  } catch (err) {
    console.warn('[Sync] Failed to sync document and photos from server:', err);
  }
}

export async function uploadPdfReportToNextcloud(
  documentId: string,
  pdfBlob: Blob,
  fileName: string
): Promise<{ success: boolean; message: string }> {
  try {
    const formData = new FormData();
    formData.append('documentId', documentId);
    formData.append('pdfFile', pdfBlob, fileName);

    const res = await fetchWithTimeout(
      `${getApiBaseUrl()}/api/nextcloud/upload-pdf`,
      {
        method: 'POST',
        body: formData,
      },
      90_000
    );

    return await res.json();
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
    const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/nextcloud/status`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('[Nextcloud] Failed to fetch status from Photo QC server:', err);
    throw err;
  }
}
