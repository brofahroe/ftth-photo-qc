import assert from 'node:assert/strict';
import test from 'node:test';
import { QcDocument, SyncBaseline } from '../types';
import {
  decideDocumentSync,
  getDocumentContentSignature,
  shouldUploadLocalPhoto,
} from './syncConflict';

const baseDocument: QcDocument = {
  id: 'doc-1',
  title: 'Dokumen',
  docType: 'CW',
  header: {
    projectName: 'Project',
    region: 'BLORA',
    oltName: 'BALUN',
    clusterName: 'Cluster',
    clusterId: 'cluster-1',
  },
  pages: [],
  defaultWatermarkOnUpload: false,
  createdAt: 1,
  updatedAt: 10,
};

function withTitle(title: string, updatedAt: number): QcDocument {
  return { ...baseDocument, title, updatedAt };
}

const baseline: SyncBaseline = {
  documentId: baseDocument.id,
  serverUpdatedAt: baseDocument.updatedAt,
  contentSignature: getDocumentContentSignature(baseDocument),
};

test('does not report a conflict when local and server content match', () => {
  assert.equal(decideDocumentSync(baseDocument, { ...baseDocument }), 'same');
});

test('reports divergent edits when no previous common version is known', () => {
  assert.equal(decideDocumentSync(withTitle('PC', 20), withTitle('Server', 21)), 'conflict');
});

test('pushes local-only edits relative to the common version', () => {
  assert.equal(decideDocumentSync(withTitle('PC', 20), baseDocument, baseline), 'push-local');
});

test('pulls server-only edits relative to the common version', () => {
  assert.equal(decideDocumentSync(baseDocument, withTitle('Server', 20), baseline), 'pull-server');
});

test('reports conflict when both sides changed from the common version', () => {
  assert.equal(
    decideDocumentSync(withTitle('PC', 20), withTitle('Server', 21), baseline),
    'conflict'
  );
});

test('queues a local photo when the server has no copy or an older copy', () => {
  assert.equal(shouldUploadLocalPhoto(20), true);
  assert.equal(shouldUploadLocalPhoto(20, 19), true);
  assert.equal(shouldUploadLocalPhoto(20, 20), false);
  assert.equal(shouldUploadLocalPhoto(20, 21), false);
});
