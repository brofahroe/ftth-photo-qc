import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { dataDir, ensureStorageDir } from '../storage.js';

if (!fs.existsSync(dataDir)) {
  ensureStorageDir(dataDir);
}

const dbPath = path.join(dataDir, 'photoqc.db');
export const db = new DatabaseSync(dbPath);

// Enable WAL mode for high concurrent write performance
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      doc_type TEXT NOT NULL,
      header_json TEXT NOT NULL,
      pages_json TEXT NOT NULL,
      default_watermark_on_upload INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      page_id TEXT,
      slot_index INTEGER,
      captured_by TEXT,
      raw_file_name TEXT,
      rendered_file_name TEXT,
      rotation INTEGER DEFAULT 0,
      watermark_enabled INTEGER DEFAULT 0,
      watermark_json TEXT,
      width INTEGER DEFAULT 0,
      height INTEGER DEFAULT 0,
      nextcloud_path TEXT,
      nextcloud_status TEXT DEFAULT 'pending',
      nextcloud_error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pdf_exports (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      local_path TEXT NOT NULL,
      nextcloud_path TEXT,
      nextcloud_status TEXT DEFAULT 'pending',
      nextcloud_error TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS site_references (
      id TEXT PRIMARY KEY,
      cluster_id TEXT NOT NULL,
      cluster_name TEXT NOT NULL,
      region TEXT,
      kecamatan TEXT,
      cluster_initial TEXT,
      fdt_no TEXT,
      hp_drm TEXT,
      fdt_id TEXT,
      olt_name TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_photos_doc ON photos(document_id);
    CREATE INDEX IF NOT EXISTS idx_photos_nextcloud ON photos(nextcloud_status);
  `);
}
