import { db, deleteDocumentCascade } from '../db/database';
import { QcDocument, SyncBaseline, SyncConflict, SyncOutboxItem } from '../types';
import {
  deleteDocumentOnServer,
  deletePhotoOnServer,
  fetchServerDocumentSnapshot,
  fetchServerDeletedDocIds,
  fetchServerDocuments,
  pushDocumentToServer,
  uploadPhotoToServer,
} from './apiSync';
import { getSocket } from './socketService';
import {
  decideDocumentSync,
  getDocumentContentSignature,
  shouldUploadLocalPhoto,
} from './syncConflict';

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

async function saveSyncBaseline(document: QcDocument): Promise<void> {
  const baseline: SyncBaseline = {
    documentId: document.id,
    serverUpdatedAt: document.updatedAt,
    contentSignature: getDocumentContentSignature(document),
  };
  await db.syncBaselines.put(baseline);
}

async function recordSyncConflict(
  localDocument: QcDocument,
  serverDocument: QcDocument
): Promise<void> {
  const conflict: SyncConflict = {
    documentId: localDocument.id,
    localDocument,
    serverDocument,
    detectedAt: Date.now(),
  };
  await db.syncConflicts.put(conflict);
  await db.syncOutbox.delete(`doc_upsert:${localDocument.id}`);
}

export async function resolveSyncConflict(
  documentId: string,
  resolution: 'local' | 'server'
): Promise<void> {
  const conflict = await db.syncConflicts.get(documentId);
  if (!conflict || conflict.resolvedAt) return;

  const latestLocalDocument = await db.documents.get(documentId);
  const updatedConflict = {
    ...conflict,
    localDocument: latestLocalDocument || conflict.localDocument,
  };
  const chosenDocument =
    resolution === 'local' ? updatedConflict.localDocument : conflict.serverDocument;
  await db.transaction(
    'rw',
    db.documents,
    db.syncOutbox,
    db.syncBaselines,
    db.syncConflicts,
    async () => {
      await db.documents.put(chosenDocument);
      await db.syncOutbox.delete(`doc_upsert:${documentId}`);
      await db.syncBaselines.put({
        documentId,
        serverUpdatedAt: conflict.serverDocument.updatedAt,
        contentSignature: getDocumentContentSignature(conflict.serverDocument),
      });
      await db.syncConflicts.put({
        ...updatedConflict,
        resolvedAt: Date.now(),
        resolution,
      });
    }
  );

  if (resolution === 'local') {
    await enqueueDocUpsert(documentId);
  }
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
  void flushSyncOutbox().catch(console.warn);
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
  void flushSyncOutbox().catch(console.warn);
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
  void flushSyncOutbox().catch(console.warn);
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
  void flushSyncOutbox().catch(console.warn);
}

const KIND_ORDER: Record<SyncOutboxItem['kind'], number> = {
  doc_upsert: 0,
  photo_upsert: 1,
  photo_delete: 2,
  doc_delete: 3,
};

export async function flushSyncOutbox(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  if (isFlushing) {
    rerunRequested = true;
    return false;
  }

  isFlushing = true;
  notifyListeners(true);
  let maxFailedAttempts = 0;
  let hadFailure = false;
  let successful = true;

  try {
    const items = await db.syncOutbox.toArray();
    if (items.length === 0) return true;

    items.sort((a, b) => {
      const orderDiff = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
      return orderDiff !== 0 ? orderDiff : a.updatedAt - b.updatedAt;
    });

    for (const item of items) {
      if (item.kind !== 'doc_delete') {
        const conflict = await db.syncConflicts.get(item.documentId);
        if (conflict && !conflict.resolvedAt) {
          successful = false;
          continue;
        }
      }

      let ok = false;
      let failureReason = 'Server tidak terjangkau atau sedang bermasalah';

      if (item.kind === 'doc_upsert') {
        const doc = await db.documents.get(item.documentId);
        if (!doc) {
          await db.syncOutbox.delete(item.id);
          continue;
        }
        const result = await pushDocumentToServer(doc);
        if (result.conflict) {
          if (
            getDocumentContentSignature(doc) ===
            getDocumentContentSignature(result.conflict)
          ) {
            await saveSyncBaseline(result.conflict);
            await db.syncOutbox.delete(item.id);
          } else {
            await recordSyncConflict(doc, result.conflict);
          }
          continue;
        }
        ok = result.ok;
        failureReason = result.error || failureReason;
        if (ok && result.document) {
          await saveSyncBaseline(result.document);
        }
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
        const result = await uploadPhotoToServer({ record, pageId, slotIndex });
        ok = result.ok;
        failureReason = result.error || failureReason;
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
        successful = false;
        const nextAttempts = (item.attempts || 0) + 1;
        maxFailedAttempts = Math.max(maxFailedAttempts, nextAttempts);
        await db.syncOutbox.put({
          ...item,
          attempts: nextAttempts,
          lastError: failureReason,
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
  return successful && (await db.syncOutbox.count()) === 0;
}

function findSlotLocation(doc: QcDocument, photoId: string): { pageId?: string; slotIndex?: number } {
  for (const p of doc.pages) {
    const s = p.slots.find((sl) => sl.photoId === photoId);
    if (s) return { pageId: p.id, slotIndex: s.slotIndex };
  }
  return {};
}

export async function reconcileServerDocument(remoteDocument: QcDocument): Promise<void> {
  const pendingDelete = await db.syncOutbox.get(`doc_delete:${remoteDocument.id}`);
  if (pendingDelete) return;
  const pendingUpsert = await db.syncOutbox.get(`doc_upsert:${remoteDocument.id}`);
  if (pendingUpsert) return;

  const conflict = await db.syncConflicts.get(remoteDocument.id);
  if (conflict && !conflict.resolvedAt) return;

  const localDocument = await db.documents.get(remoteDocument.id);
  if (!localDocument) {
    await db.documents.put(remoteDocument);
    await saveSyncBaseline(remoteDocument);
    return;
  }

  const baseline = await db.syncBaselines.get(remoteDocument.id);
  const decision = decideDocumentSync(localDocument, remoteDocument, baseline);
  if (decision === 'conflict') {
    await recordSyncConflict(localDocument, remoteDocument);
  } else if (decision === 'pull-server') {
    await db.documents.put(remoteDocument);
    await saveSyncBaseline(remoteDocument);
  } else if (decision === 'push-local') {
    await enqueueDocUpsert(remoteDocument.id);
  } else {
    await saveSyncBaseline(remoteDocument);
  }
}

async function enqueueDocumentPhotos(document: QcDocument): Promise<void> {
  const localPhotos = await db.photos.where('documentId').equals(document.id).toArray();
  for (const photo of localPhotos) {
    const loc = findSlotLocation(document, photo.id);
    await db.syncOutbox.put({
      id: `photo_upsert:${photo.id}`,
      kind: 'photo_upsert',
      documentId: document.id,
      photoId: photo.id,
      pageId: loc.pageId,
      slotIndex: loc.slotIndex,
      attempts: 0,
      updatedAt: Date.now(),
    });
  }
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
      const conflict = await db.syncConflicts.get(lDoc.id);
      if (!pendingUpsert && (!conflict || conflict.resolvedAt)) {
        await deleteDocumentCascade(lDoc.id);
      }
    }
  }

  // 2. Reconcile document versions against the last common server version.
  for (const sDoc of serverDocs) {
    const pendingDelete = await db.syncOutbox.get(`doc_delete:${sDoc.id}`);
    if (pendingDelete) continue;

    const localDoc = await db.documents.get(sDoc.id);
    const conflict = await db.syncConflicts.get(sDoc.id);
    if (conflict && !conflict.resolvedAt) continue;

    if (!localDoc) {
      await db.documents.put(sDoc);
      await saveSyncBaseline(sDoc);
      continue;
    }

    const baseline = await db.syncBaselines.get(sDoc.id);
    const decision = decideDocumentSync(localDoc, sDoc, baseline);
    if (decision === 'conflict') {
      await recordSyncConflict(localDoc, sDoc);
    } else if (decision === 'pull-server') {
      await db.documents.put(sDoc);
      await saveSyncBaseline(sDoc);
    } else if (decision === 'push-local') {
      await db.syncOutbox.put({
        id: `doc_upsert:${localDoc.id}`,
        kind: 'doc_upsert',
        documentId: localDoc.id,
        attempts: 0,
        updatedAt: Date.now(),
      });
    } else {
      await saveSyncBaseline(sDoc);
    }
  }

  // 3. Queue local-only documents and reconcile photos missing from server records.
  const refreshedLocalDocs = await db.documents.toArray();
  let detailFetchFailed = false;

  for (const lDoc of refreshedLocalDocs) {
    if (deletedIds.has(lDoc.id)) continue;
    const sDoc = serverMap.get(lDoc.id);
    const conflict = await db.syncConflicts.get(lDoc.id);
    if (conflict && !conflict.resolvedAt) continue;

    if (!sDoc) {
      await db.syncOutbox.put({
        id: `doc_upsert:${lDoc.id}`,
        kind: 'doc_upsert',
        documentId: lDoc.id,
        attempts: 0,
        updatedAt: Date.now(),
      });
      await enqueueDocumentPhotos(lDoc);
      continue;
    }

    const snapshot = await fetchServerDocumentSnapshot(lDoc.id);
    if (!snapshot) {
      detailFetchFailed = true;
      continue;
    }
    const serverPhotos = snapshot.photos || {};
    const localPhotos = await db.photos.where('documentId').equals(lDoc.id).toArray();
    for (const photo of localPhotos) {
      const serverPhoto = serverPhotos[photo.id];
      if (shouldUploadLocalPhoto(photo.updatedAt, serverPhoto?.updatedAt)) {
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

  const queueFlushed = await flushSyncOutbox();
  const pendingCount = await db.syncOutbox.count();
  const unresolvedCount = await db.syncConflicts.filter((c) => !c.resolvedAt).count();
  return (
    queueFlushed &&
    pendingCount === 0 &&
    unresolvedCount === 0 &&
    !detailFetchFailed
  );
}

export function startLiveSyncEngine(): void {
  if (engineStarted) return;
  engineStarted = true;

  const s = getSocket();

  s.on('connect', () => {
    void syncAllWithServer().catch((err) => console.error('[Sync] Connect sync failed:', err));
  });

  const handleWorkspaceDoc = async ({ document: remoteDoc }: { document?: QcDocument }) => {
    if (!remoteDoc?.id) return;
    await reconcileServerDocument(remoteDoc).catch((err) =>
      console.error('[Sync] Realtime document reconciliation failed:', err)
    );
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
      void syncAllWithServer().catch((err) => console.error('[Sync] Online sync failed:', err));
    });
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void syncAllWithServer().catch((err) => console.error('[Sync] Resume sync failed:', err));
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
  void syncAllWithServer().catch((err) => console.error('[Sync] Initial sync failed:', err));
}
