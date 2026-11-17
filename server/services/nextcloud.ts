import { createClient, WebDAVClient } from 'webdav';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db/schema.js';
import { uploadsDir } from '../storage.js';

let client: WebDAVClient | null = null;
let isConfigured = false;
let baseRemoteDir = '/PhotoQC';

export function getNextcloudConfig() {
  const url = process.env.NEXTCLOUD_URL?.trim();
  const username = (process.env.NEXTCLOUD_USERNAME || process.env.NEXTCLOUD_USER)?.trim();
  const password = process.env.NEXTCLOUD_PASSWORD?.trim();
  const rawBaseDir = process.env.NEXTCLOUD_BASE_DIR || process.env.NEXTCLOUD_DIR || '/PhotoQC';
  const baseDir = (rawBaseDir.trim() || '/PhotoQC').replace(/\/+$/, '');

  return { url, username, password, baseDir };
}

export function initNextcloudClient(): boolean {
  const { url, username, password, baseDir } = getNextcloudConfig();
  baseRemoteDir = baseDir.startsWith('/') ? baseDir : `/${baseDir}`;

  if (!url || !username || !password) {
    console.log('[Nextcloud] Credentials not configured yet in .env');
    isConfigured = false;
    client = null;
    return false;
  }

  try {
    // Standard Nextcloud WebDAV URL format:
    // https://domain.com/remote.php/dav/files/USERNAME/
    let davUrl = url.replace(/\/+$/, '');
    if (!davUrl.includes('/remote.php/dav/files/')) {
      davUrl = `${davUrl}/remote.php/dav/files/${encodeURIComponent(username)}`;
    }

    client = createClient(davUrl, {
      username,
      password,
    });
    isConfigured = true;
    console.log(`[Nextcloud] WebDAV client initialized for ${username} at ${url}`);
    return true;
  } catch (err) {
    console.error('[Nextcloud] Failed to initialize client:', err);
    isConfigured = false;
    client = null;
    return false;
  }
}

export async function testNextcloudConnection(): Promise<{ success: boolean; message: string; directoryContents?: any[] }> {
  if (!isConfigured || !client) {
    const initialized = initNextcloudClient();
    if (!initialized || !client) {
      return { success: false, message: 'Nextcloud credentials not configured in .env' };
    }
  }

  try {
    // Check if root or base directory exists
    const exists = await client.exists(baseRemoteDir);
    if (!exists) {
      await ensureRemoteDir(baseRemoteDir);
    }
    const contents = await client.getDirectoryContents(baseRemoteDir);
    return {
      success: true,
      message: `Terhubung ke Nextcloud. Folder kerja: ${baseRemoteDir}`,
      directoryContents: Array.isArray(contents) ? contents.slice(0, 20) : [],
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Gagal terhubung ke Nextcloud: ${error?.message || error}`,
    };
  }
}

export async function ensureRemoteDir(remoteDirPath: string): Promise<void> {
  if (!client) throw new Error('Nextcloud client not initialized');

  const normalized = remoteDirPath.startsWith('/') ? remoteDirPath : `/${remoteDirPath}`;
  const segments = normalized.split('/').filter(Boolean);
  let currentPath = '';

  for (const seg of segments) {
    currentPath += `/${seg}`;
    const exists = await client.exists(currentPath);
    if (!exists) {
      try {
        await client.createDirectory(currentPath);
      } catch (err: any) {
        // Ignore 405 (Method Not Allowed) if directory already exists
        if (err?.status !== 405) {
          throw err;
        }
      }
    }
  }
}

export async function uploadLocalFileToNextcloud(
  localFilePath: string,
  remoteFilePath: string
): Promise<string> {
  if (!client) {
    throw new Error('Nextcloud client not initialized');
  }

  if (!fs.existsSync(localFilePath)) {
    throw new Error(`File lokal tidak ditemukan: ${localFilePath}`);
  }

  const remoteDir = path.posix.dirname(remoteFilePath);
  await ensureRemoteDir(remoteDir);

  const fileBuffer = fs.readFileSync(localFilePath);
  await client.putFileContents(remoteFilePath, fileBuffer, {
    overwrite: true,
  });

  return remoteFilePath;
}

export function buildNextcloudPaths(headerJsonOrObj: string | Record<string, any> | null | undefined, docTitleRaw?: string | null) {
  let clusterName = 'GENERAL';
  let clusterId = 'NOCLUSTER';
  try {
    const h =
      typeof headerJsonOrObj === 'string'
        ? JSON.parse(headerJsonOrObj || '{}')
        : headerJsonOrObj || {};
    if (h.clusterId) clusterId = String(h.clusterId).replace(/[^a-zA-Z0-9_-]/g, '_');
    if (h.clusterName) clusterName = String(h.clusterName).replace(/[^a-zA-Z0-9 _-]/g, '_');
  } catch {
    // fallback
  }

  const docTitle = (docTitleRaw || 'DOC').replace(/[^a-zA-Z0-9 _-]/g, '_');
  const clusterDir = `${baseRemoteDir}/${clusterId}_${clusterName}`;
  const docDir = `${clusterDir}/${docTitle}`;
  const photosDir = `${docDir}/photos`;

  return { clusterDir, docDir, photosDir };
}

export function queueNextcloudDeletion(remotePath: string, clusterDir?: string | null): void {
  if (!remotePath) return;
  const id = `del_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  db.prepare(`
    INSERT INTO nextcloud_deletions (id, remote_path, cluster_dir, attempts, created_at)
    VALUES (?, ?, ?, 0, ?)
  `).run(id, remotePath, clusterDir || null, Date.now());
}

async function deleteRemotePathSafe(remotePath: string): Promise<void> {
  if (!client || !remotePath) return;
  try {
    const exists = await client.exists(remotePath);
    if (!exists) return;
    await client.deleteFile(remotePath);
  } catch (err: any) {
    if (err?.status === 404) return;
    throw err;
  }
}

async function cleanupEmptyClusterDir(clusterDir: string): Promise<void> {
  if (!client || !clusterDir) return;
  try {
    const exists = await client.exists(clusterDir);
    if (!exists) return;
    const contents = await client.getDirectoryContents(clusterDir);
    if (Array.isArray(contents) && contents.length === 0) {
      await client.deleteFile(clusterDir);
      console.log(`[Nextcloud Sync] Folder cluster kosong dihapus: ${clusterDir}`);
    }
  } catch (err: any) {
    if (err?.status !== 404) {
      console.warn(`[Nextcloud Sync] Gagal cek folder cluster kosong ${clusterDir}:`, err?.message || err);
    }
  }
}

// Background queue worker
let isProcessingQueue = false;
let rerunRequested = false;

export function triggerNextcloudSync(): void {
  setTimeout(() => {
    processNextcloudQueue().catch((err) => console.error('[Nextcloud Queue Error]', err));
  }, 150);
}

async function processPendingDocumentFolders(): Promise<void> {
  if (!client) return;
  const pendingDocs = db.prepare(`
    SELECT id, title, header_json, nextcloud_folder_path
    FROM documents
    WHERE nextcloud_folder_status IN ('pending', 'failed')
    ORDER BY updated_at DESC
    LIMIT 10
  `).all() as any[];

  for (const doc of pendingDocs) {
    try {
      const { clusterDir, docDir, photosDir } = buildNextcloudPaths(doc.header_json, doc.title);

      // If renamed/moved and old folder exists while new doesn't, move it cleanly
      if (doc.nextcloud_folder_path && doc.nextcloud_folder_path !== docDir) {
        try {
          const oldExists = await client.exists(doc.nextcloud_folder_path);
          const newExists = await client.exists(docDir);
          if (oldExists && !newExists) {
            await ensureRemoteDir(clusterDir);
            await client.moveFile(doc.nextcloud_folder_path, docDir);
          }
        } catch (moveErr: any) {
          console.warn(`[Nextcloud Sync] Gagal memindahkan folder ${doc.nextcloud_folder_path} -> ${docDir}:`, moveErr?.message || moveErr);
        }
      }

      await ensureRemoteDir(photosDir);

      db.prepare(`
        UPDATE documents
        SET nextcloud_folder_path = ?, nextcloud_folder_status = 'synced', nextcloud_folder_error = NULL
        WHERE id = ?
      `).run(docDir, doc.id);

      console.log(`[Nextcloud Sync] Folder dokumen siap: ${photosDir}`);
    } catch (err: any) {
      console.error(`[Nextcloud Sync] Gagal membuat folder dokumen ${doc.id}:`, err?.message || err);
      db.prepare(`
        UPDATE documents
        SET nextcloud_folder_status = 'failed', nextcloud_folder_error = ?
        WHERE id = ?
      `).run(String(err?.message || err), doc.id);
    }
  }
}

async function processPendingDeletions(): Promise<void> {
  if (!client) return;
  const pendingDeletions = db.prepare(`
    SELECT id, remote_path, cluster_dir, attempts
    FROM nextcloud_deletions
    WHERE attempts < 10
    ORDER BY created_at ASC
    LIMIT 10
  `).all() as any[];

  for (const item of pendingDeletions) {
    try {
      await deleteRemotePathSafe(item.remote_path);
      if (item.cluster_dir) {
        await cleanupEmptyClusterDir(item.cluster_dir);
      }
      db.prepare(`DELETE FROM nextcloud_deletions WHERE id = ?`).run(item.id);
      console.log(`[Nextcloud Sync] Terhapus di Nextcloud: ${item.remote_path}`);
    } catch (err: any) {
      db.prepare(`
        UPDATE nextcloud_deletions
        SET attempts = attempts + 1, last_error = ?
        WHERE id = ?
      `).run(String(err?.message || err), item.id);
    }
  }
}

export async function processNextcloudQueue(): Promise<void> {
  if (isProcessingQueue) {
    rerunRequested = true;
    return;
  }
  if (!client) {
    initNextcloudClient();
    if (!client) return;
  }

  isProcessingQueue = true;
  try {
    await processPendingDocumentFolders();

    // Find up to 10 pending photo uploads
    const pendingPhotos = db.prepare(`
      SELECT p.*, d.title as doc_title, d.header_json
      FROM photos p
      LEFT JOIN documents d ON p.document_id = d.id
      WHERE p.nextcloud_status IN ('pending', 'failed')
      ORDER BY p.created_at ASC
      LIMIT 10
    `).all() as any[];

    for (const photo of pendingPhotos) {
      try {
        // Mark as uploading
        db.prepare(`UPDATE photos SET nextcloud_status = 'uploading' WHERE id = ?`).run(photo.id);

        const { photosDir } = buildNextcloudPaths(photo.header_json, photo.doc_title);
        // Prefer rendered file, fallback to raw
        const localFileName = photo.rendered_file_name || photo.raw_file_name;
        if (!localFileName) {
          db.prepare(`UPDATE photos SET nextcloud_status = 'failed', nextcloud_error = 'No local file recorded' WHERE id = ?`).run(photo.id);
          continue;
        }

        const localFilePath = path.join(uploadsDir, localFileName);
        if (!fs.existsSync(localFilePath)) {
          db.prepare(`UPDATE photos SET nextcloud_status = 'failed', nextcloud_error = 'Local file missing' WHERE id = ?`).run(photo.id);
          continue;
        }

        const remoteFilePath = `${photosDir}/${localFileName}`;
        await uploadLocalFileToNextcloud(localFilePath, remoteFilePath);

        db.prepare(`
          UPDATE photos
          SET nextcloud_path = ?, nextcloud_status = 'synced', nextcloud_error = NULL, updated_at = ?
          WHERE id = ?
        `).run(remoteFilePath, Date.now(), photo.id);

        console.log(`[Nextcloud Sync] Berhasil sync foto ${photo.id} -> ${remoteFilePath}`);
      } catch (err: any) {
        console.error(`[Nextcloud Sync] Gagal sync foto ${photo.id}:`, err?.message || err);
        db.prepare(`
          UPDATE photos
          SET nextcloud_status = 'failed', nextcloud_error = ?, updated_at = ?
          WHERE id = ?
        `).run(String(err?.message || err), Date.now(), photo.id);
      }
    }

    // Also check pending PDF reports
    const pendingPdfs = db.prepare(`
      SELECT pdf.*, d.title as doc_title, d.header_json
      FROM pdf_exports pdf
      LEFT JOIN documents d ON pdf.document_id = d.id
      WHERE pdf.nextcloud_status IN ('pending', 'failed')
      LIMIT 5
    `).all() as any[];

    for (const pdf of pendingPdfs) {
      try {
        db.prepare(`UPDATE pdf_exports SET nextcloud_status = 'uploading' WHERE id = ?`).run(pdf.id);

        const { docDir } = buildNextcloudPaths(pdf.header_json, pdf.doc_title);
        const remoteFilePath = `${docDir}/${pdf.file_name}`;

        await uploadLocalFileToNextcloud(pdf.local_path, remoteFilePath);

        db.prepare(`
          UPDATE pdf_exports
          SET nextcloud_path = ?, nextcloud_status = 'synced', nextcloud_error = NULL
          WHERE id = ?
        `).run(remoteFilePath, pdf.id);

        console.log(`[Nextcloud Sync] Berhasil sync PDF ${pdf.file_name} -> ${remoteFilePath}`);
      } catch (err: any) {
        db.prepare(`
          UPDATE pdf_exports
          SET nextcloud_status = 'failed', nextcloud_error = ?
          WHERE id = ?
        `).run(String(err?.message || err), pdf.id);
      }
    }

    await processPendingDeletions();
  } finally {
    isProcessingQueue = false;
    if (rerunRequested) {
      rerunRequested = false;
      triggerNextcloudSync();
    }
  }
}

// Start queue interval (runs every 10 seconds)
export function startNextcloudQueueWorker() {
  initNextcloudClient();
  // Reset any uploads interrupted by a previous server restart/crash
  try {
    db.prepare(`UPDATE photos SET nextcloud_status = 'pending' WHERE nextcloud_status = 'uploading'`).run();
    db.prepare(`UPDATE pdf_exports SET nextcloud_status = 'pending' WHERE nextcloud_status = 'uploading'`).run();
  } catch {}
  processNextcloudQueue().catch((err) => {
    console.error('[Nextcloud Startup Worker Error]', err);
  });
  setInterval(() => {
    processNextcloudQueue().catch((err) => {
      console.error('[Nextcloud Worker Error]', err);
    });
  }, 10_000);
}
