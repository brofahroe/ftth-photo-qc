import { QcDocument, SyncBaseline } from '../types';

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stableValue(item)])
    );
  }
  return value;
}

export function getDocumentContentSignature(document: QcDocument): string {
  const { id, title, docType, header, pages, defaultWatermarkOnUpload } = document;
  return JSON.stringify(
    stableValue({ id, title, docType, header, pages, defaultWatermarkOnUpload })
  );
}

export type SyncDecision = 'same' | 'push-local' | 'pull-server' | 'conflict';

export function shouldUploadLocalPhoto(localUpdatedAt: number, serverUpdatedAt?: number): boolean {
  return serverUpdatedAt === undefined || localUpdatedAt > serverUpdatedAt;
}

export function decideDocumentSync(
  localDocument: QcDocument,
  serverDocument: QcDocument,
  baseline?: SyncBaseline
): SyncDecision {
  const localSignature = getDocumentContentSignature(localDocument);
  const serverSignature = getDocumentContentSignature(serverDocument);

  if (localSignature === serverSignature) return 'same';
  if (!baseline) return 'conflict';

  const localChanged = localSignature !== baseline.contentSignature;
  const serverChanged = serverSignature !== baseline.contentSignature;

  if (localChanged && serverChanged) return 'conflict';
  if (localChanged) return 'push-local';
  if (serverChanged) return 'pull-server';
  return 'same';
}
