import { db, deleteDocumentCascade } from '../db/database';
import { QcDocument, SyncOutboxItem } from '../types';
import {
  deleteDocumentOnServer,
  deletePhotoOnServer,
  fetchServerDeletedDocIds,
  fetchServerDocuments,
  pushDocumentToServer,
  uploadPhotoToServer,
} from './apiSync';
import { getSocket } from './socketService';

let isFlushing = false;
let rerunRequested = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let engineStarted = false;

type SyncListener = (state: { flushing: boolean }) => void;
const listeners = new Set<SyncListener>();

function notifyListeners(flushing: boolean) {
  for (const fn of listeners) {
    fn({ flushing });
  }
}

export function subscribeSyncFlushing(fn: SyncListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function scheduleRetry(attempts: number) {
  if (retryTimer) clearTimeout(retryTimer);
  const delay = Math.min(30_000, 3_000 * Math.pow(2, Math.min(attempts, 3)));
  retryTimer = setTimeout(() => {
    retryTimer = null;
    flushSyncOutbox().catch(console.warn);
  }, delay);
}

export async function enqueueDocUpsert(documentId: string): Promise<void> {
  await db.syncOutbox.delete(`doc_delete:${documentId}`);
  const item: SyncOutboxItem = {
    id: `doc_upsert:${documentId}`,
    kind: 'doc_upsert',
    documentId,
    attempts: 0,
    updatedAt: Date.now(),
  };
  await db.syncOutbox.put(item);
  void flushSyncOutbox();
}

export async function enqueueDocDelete(documentId: string): Promise<void> {
  const existingForDoc = await db.syncOutbox.where('documentId').equals(documentId).toArray();
  for (const it of existingForDoc) {
    await db.syncOutbox.delete(it.id);
  }
  const item: SyncOutboxItem = {
    id: `doc_delete:${documentId}`,
    kind: 'doc_delete',
    documentId,
    attempts: 0,
    updatedAt: Date.now(),
  };
  await db.syncOutbox.put(item);
  void flushSyncOutbox();
}

export async function enqueuePhotoUpsert(
  photoId: string,
  documentId: string,
  pageId?: string,
  slotIndex?: number
): Promise<void> {
  await db.syncOutbox.delete(`photo_delete:${photoId}`);
  const item: SyncOutboxItem = {
    id: `photo_upsert:${photoId}`,
    kind: 'photo_upsert',
    documentId,
    photoId,
    pageId,
    slotIndex,
    attempts: 0,
    updatedAt: Date.now(),
  };
  await db.syncOutbox.put(item);
  void flushSyncOutbox();
}

export async function enqueuePhotoDelete(photoId: string, documentId: string): Promise<void> {
  await db.syncOutbox.delete(`photo_upsert:${photoId}`);
  const item: SyncOutboxItem = {
    id: `photo_delete:${photoId}`,
    kind: 'photo_delete',
    documentId,
    photoId,
    attempts: 0,
    updatedAt: Date.now(),
  };
  await db.syncOutbox.put(item);
  void flushSyncOutbox();
}

const KIND_ORDER: Record<SyncOutboxItem['kind'], number> = {
  doc_upsert: 0,
  photo_upsert: 1,
  photo_delete: 2,
  doc_delete: 3,
};

export async function flushSyncOutbox(): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  if (isFlushing) {
    rerunRequested = true;
    return;
  }

  isFlushing = true;
  notifyListeners(true);
  let maxFailedAttempts = 0;
  let hadFailure = false;

  try {
    const items = await db.syncOutbox.toArray();
    if (items.length === 0) return;

    items.sort((a, b) => {
      const orderDiff = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
      return orderDiff !== 0 ? orderDiff : a.updatedAt - b.updatedAt;
    });

    for (const item of items) {
      let ok = false;

      if (item.kind === 'doc_upsert') {
        const doc = await db.documents.get(item.documentId);
        if (!doc) {
          await db.syncOutbox.delete(item.id);
          continue;
        }
        ok = await pushDocumentToServer(doc);
      } else if (item.kind === 'photo_upsert') {
        if (!item.photoId) {
          await db.syncOutbox.delete(item.id);
          continue;
        }
        const record = await db.photos.get(item.photoId);
        if (!record) {
          await db.syncOutbox.delete(item.id);
          continue;
        }
        // Resolve latest pageId/slotIndex from current document if missing
        let pageId = item.pageId;
        let slotIndex = item.slotIndex;
        if (pageId === undefined || slotIndex === undefined) {
          const doc = await db.documents.get(item.documentId);
          if (doc) {
            for (const p of doc.pages) {
              const found = p.slots.find((s) => s.photoId === record.id);
              if (found) {
                pageId = p.id;
                slotIndex = found.slotIndex;
                break;
              }
            }
          }
        }
        ok = await uploadPhotoToServer({ record, pageId, slotIndex });
      } else if (item.kind === 'photo_delete') {
        if (!item.photoId) {
          await db.syncOutbox.delete(item.id);
          continue;
        }
        ok = await deletePhotoOnServer(item.photoId);
      } else if (item.kind === 'doc_delete') {
        ok = await deleteDocumentOnServer(item.documentId);
      }

      if (ok) {
        await db.syncOutbox.delete(item.id);
      } else {
        hadFailure = true;
        const nextAttempts = (item.attempts || 0) + 1;
        maxFailedAttempts = Math.max(maxFailedAttempts, nextAttempts);
        await db.syncOutbox.put({
          ...item,
          attempts: nextAttempts,
          lastError: 'Server tidak terjangkau atau sedang bangun',
        });
      }
    }
  } finally {
    isFlushing = false;
    notifyListeners(false);
    if (rerunRequested) {
      rerunRequested = false;
      void flushSyncOutbox();
    } else if (hadFailure) {
      scheduleRetry(maxFailedAttempts);
    }
  }
}

function findSlotLocation(doc: QcDocument, photoId: string): { pageId?: string; slotIndex?: number } {
  for (const p of doc.pages) {
    const s = p.slots.find((sl) => sl.photoId === photoId);
    if (s) return { pageId: p.id, slotIndex: s.slotIndex };
  }
  return {};
}

export async function syncAllWithServer(): Promise<boolean> {
  await flushSyncOutbox();

  const serverDocs = await fetchServerDocuments();
  if (serverDocs === null) {
    return false;
  }

  const deletedIds = new Set(await fetchServerDeletedDocIds());
  const serverMap = new Map<string, QcDocument>();
  for (const sDoc of serverDocs) {
    serverMap.set(sDoc.id, sDoc);
  }

  // 1. Delete local docs that were deleted on another device
  const localDocs = await db.documents.toArray();
  for (const lDoc of localDocs) {
    if (deletedIds.has(lDoc.id)) {
      const pendingUpsert = await db.syncOutbox.get(`doc_upsert:${lDoc.id}`);
      if (!pendingUpsert) {
        await deleteDocumentCascade(lDoc.id);
      }
    }
  }

  // 2. Pull newer docs from server
  for (const sDoc of serverDocs) {
    const pendingDelete = await db.syncOutbox.get(`doc_delete:${sDoc.id}`);
    if (pendingDelete) continue;

    const pendingUpsert = await db.syncOutbox.get(`doc_upsert:${sDoc.id}`);
    const localDoc = await db.documents.get(sDoc.id);
    if (!pendingUpsert && (!localDoc || sDoc.updatedAt > localDoc.updatedAt)) {
      await db.documents.put(sDoc);
    }
  }

  // 3. Push local-only or locally-newer docs (e.g. created offline or before sync upgrade)
  const refreshedLocalDocs = await db.documents.toArray();
  let queuedNewPush = false;

  for (const lDoc of refreshedLocalDocs) {
    if (deletedIds.has(lDoc.id)) continue;
    const sDoc = serverMap.get(lDoc.id);

    if (!sDoc || lDoc.updatedAt > sDoc.updatedAt) {
      await db.syncOutbox.put({
        id: `doc_upsert:${lDoc.id}`,
        kind: 'doc_upsert',
        documentId: lDoc.id,
        attempts: 0,
        updatedAt: Date.now(),
      });
      queuedNewPush = true;

      if (!sDoc) {
        const localPhotos = await db.photos.where('documentId').equals(lDoc.id).toArray();
        for (const photo of localPhotos) {
          const loc = findSlotLocation(lDoc, photo.id);
          await db.syncOutbox.put({
            id: `photo_upsert:${photo.id}`,
            kind: 'photo_upsert',
            documentId: lDoc.id,
            photoId: photo.id,
            pageId: loc.pageId,
            slotIndex: loc.slotIndex,
            attempts: 0,
            updatedAt: Date.now(),
          });
        }
      }
    }
  }

  if (queuedNewPush) {
    await flushSyncOutbox();
  }

  return true;
}

export function startLiveSyncEngine(): void {
  if (engineStarted) return;
  engineStarted = true;

  const s = getSocket();

  s.on('connect', () => {
    void syncAllWithServer();
  });

  const handleWorkspaceDoc = async ({ document: remoteDoc }: { document?: QcDocument }) => {
    if (!remoteDoc?.id) return;
    const pendingDelete = await db.syncOutbox.get(`doc_delete:${remoteDoc.id}`);
    if (pendingDelete) return;
    const pendingUpsert = await db.syncOutbox.get(`doc_upsert:${remoteDoc.id}`);
    if (pendingUpsert) return;

    const local = await db.documents.get(remoteDoc.id);
    if (!local || remoteDoc.updatedAt >= local.updatedAt) {
      await db.documents.put(remoteDoc);
    }
  };

  const handleWorkspaceDocDeleted = async ({ id }: { id?: string }) => {
    if (!id) return;
    const existingForDoc = await db.syncOutbox.where('documentId').equals(id).toArray();
    for (const it of existingForDoc) {
      await db.syncOutbox.delete(it.id);
    }
    await deleteDocumentCascade(id);
  };

  s.on('document_created', handleWorkspaceDoc);
  s.on('document_changed', handleWorkspaceDoc);
  s.on('document_deleted', handleWorkspaceDocDeleted);

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      void syncAllWithServer();
    });
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void syncAllWithServer();
      }
    });
  }

  setInterval(() => {
    db.syncOutbox.count().then((count) => {
      if (count > 0) {
        void flushSyncOutbox();
      }
    }).catch(() => {});
  }, 15_000);

  // Initial bidirectional sync at app startup
  void syncAllWithServer();
}
