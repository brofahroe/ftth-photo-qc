import { createClient, WebDAVClient } from 'webdav';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db/schema.js';

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

// Background queue worker
let isProcessingQueue = false;

export async function processNextcloudQueue(): Promise<void> {
  if (isProcessingQueue) return;
  if (!client) {
    initNextcloudClient();
    if (!client) return;
  }

  isProcessingQueue = true;
  try {
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

        let clusterName = 'GENERAL';
        let clusterId = 'NOCLUSTER';
        try {
          if (photo.header_json) {
            const h = JSON.parse(photo.header_json);
            if (h.clusterId) clusterId = h.clusterId.replace(/[^a-zA-Z0-9_-]/g, '_');
            if (h.clusterName) clusterName = h.clusterName.replace(/[^a-zA-Z0-9 _-]/g, '_');
          }
        } catch {
          // fallback
        }

        const docTitle = (photo.doc_title || 'DOC').replace(/[^a-zA-Z0-9 _-]/g, '_');
        const uploadDir = path.resolve(process.cwd(), 'uploads');

        // Prefer rendered file, fallback to raw
        const localFileName = photo.rendered_file_name || photo.raw_file_name;
        if (!localFileName) {
          db.prepare(`UPDATE photos SET nextcloud_status = 'failed', nextcloud_error = 'No local file recorded' WHERE id = ?`).run(photo.id);
          continue;
        }

        const localFilePath = path.join(uploadDir, localFileName);
        if (!fs.existsSync(localFilePath)) {
          db.prepare(`UPDATE photos SET nextcloud_status = 'failed', nextcloud_error = 'Local file missing' WHERE id = ?`).run(photo.id);
          continue;
        }

        // Folder structure: /[BASE_DIR]/[ClusterId]_[ClusterName]/[DocTitle]/photos/[FileName]
        const remoteFolderPath = `${baseRemoteDir}/${clusterId}_${clusterName}/${docTitle}/photos`;
        const remoteFilePath = `${remoteFolderPath}/${localFileName}`;

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

        let clusterName = 'GENERAL';
        let clusterId = 'NOCLUSTER';
        try {
          if (pdf.header_json) {
            const h = JSON.parse(pdf.header_json);
            if (h.clusterId) clusterId = h.clusterId.replace(/[^a-zA-Z0-9_-]/g, '_');
            if (h.clusterName) clusterName = h.clusterName.replace(/[^a-zA-Z0-9 _-]/g, '_');
          }
        } catch {}

        const docTitle = (pdf.doc_title || 'DOC').replace(/[^a-zA-Z0-9 _-]/g, '_');
        const remoteFolderPath = `${baseRemoteDir}/${clusterId}_${clusterName}/${docTitle}`;
        const remoteFilePath = `${remoteFolderPath}/${pdf.file_name}`;

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
  } finally {
    isProcessingQueue = false;
  }
}

// Start queue interval (runs every 10 seconds)
export function startNextcloudQueueWorker() {
  initNextcloudClient();
  setInterval(() => {
    processNextcloudQueue().catch((err) => {
      console.error('[Nextcloud Worker Error]', err);
    });
  }, 10_000);
}
