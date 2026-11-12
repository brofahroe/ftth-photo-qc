import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

const storageRoot = path.resolve(process.env.PHOTOQC_STORAGE_DIR?.trim() || process.cwd());

export const dataDir = path.join(storageRoot, 'data');
export const uploadsDir = path.join(storageRoot, 'uploads');
export const pdfUploadsDir = path.join(uploadsDir, 'pdfs');

export function ensureStorageDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}
