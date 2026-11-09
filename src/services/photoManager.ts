import { db } from '../db/database';
import { generateId } from '../presets/documentPresets';
import { DocumentHeader, PhotoRecord, RotationAngle, WatermarkData } from '../types';
import { buildUploadWatermarkData } from './exif';
import { buildLiveWatermarkData } from './geolocation';
import { normalizeRawImage, renderWatermarkedPhoto } from './watermark';

export function buildFallbackRegionLines(header: DocumentHeader): string[] {
  const lines: string[] = [];
  if (header.clusterName?.trim()) lines.push(header.clusterName.trim());
  if (header.region?.trim()) lines.push(header.region.trim());
  return lines;
}

export async function createPhotoFromCamera(params: {
  documentId: string;
  captureBlob: Blob;
  watermarkEnabled: boolean;
  watermarkData?: WatermarkData;
  fallbackHeader: DocumentHeader;
}): Promise<PhotoRecord> {
  const normalized = await normalizeRawImage(params.captureBlob, 2048, 0.88);
  const watermark =
    params.watermarkData ||
    (await buildLiveWatermarkData(buildFallbackRegionLines(params.fallbackHeader)));

  const rendered = await renderWatermarkedPhoto({
    rawBlob: normalized.blob,
    rotation: 0,
    watermarkEnabled: params.watermarkEnabled,
    watermark,
    maxLongEdge: 1400,
    jpegQuality: 0.82,
  });

  const now = Date.now();
  const record: PhotoRecord = {
    id: generateId(),
    documentId: params.documentId,
    rawBlob: normalized.blob,
    renderedBlob: rendered.blob,
    rotation: 0,
    watermarkEnabled: params.watermarkEnabled,
    watermark,
    width: rendered.width,
    height: rendered.height,
    createdAt: now,
    updatedAt: now,
  };

  await db.photos.add(record);
  return record;
}

export async function createPhotoFromUpload(params: {
  documentId: string;
  file: File;
  watermarkEnabled: boolean;
  fallbackHeader: DocumentHeader;
  overrideWatermark?: WatermarkData | null;
}): Promise<PhotoRecord> {
  const normalized = await normalizeRawImage(params.file, 2048, 0.88);
  const watermark =
    params.overrideWatermark ||
    (await buildUploadWatermarkData(
      params.file,
      buildFallbackRegionLines(params.fallbackHeader)
    ));

  const rendered = await renderWatermarkedPhoto({
    rawBlob: normalized.blob,
    rotation: 0,
    watermarkEnabled: params.watermarkEnabled,
    watermark,
    maxLongEdge: 1400,
    jpegQuality: 0.82,
  });

  const now = Date.now();
  const record: PhotoRecord = {
    id: generateId(),
    documentId: params.documentId,
    rawBlob: normalized.blob,
    renderedBlob: rendered.blob,
    rotation: 0,
    watermarkEnabled: params.watermarkEnabled,
    watermark,
    width: rendered.width,
    height: rendered.height,
    createdAt: now,
    updatedAt: now,
  };

  await db.photos.add(record);
  return record;
}

export async function rotatePhotoRecord(photoId: string): Promise<PhotoRecord | null> {
  const existing = await db.photos.get(photoId);
  if (!existing) return null;

  const nextRotation = (((existing.rotation + 90) % 360) as RotationAngle);
  const rendered = await renderWatermarkedPhoto({
    rawBlob: existing.rawBlob,
    rotation: nextRotation,
    watermarkEnabled: existing.watermarkEnabled,
    watermark: existing.watermark,
    maxLongEdge: 1400,
    jpegQuality: 0.82,
  });

  const updated: PhotoRecord = {
    ...existing,
    rotation: nextRotation,
    renderedBlob: rendered.blob,
    width: rendered.width,
    height: rendered.height,
    updatedAt: Date.now(),
  };

  await db.photos.put(updated);
  return updated;
}

export async function updatePhotoWatermark(
  photoId: string,
  watermarkEnabled: boolean,
  watermark: WatermarkData
): Promise<PhotoRecord | null> {
  const existing = await db.photos.get(photoId);
  if (!existing) return null;

  const rendered = await renderWatermarkedPhoto({
    rawBlob: existing.rawBlob,
    rotation: existing.rotation,
    watermarkEnabled,
    watermark,
    maxLongEdge: 1400,
    jpegQuality: 0.82,
  });

  const updated: PhotoRecord = {
    ...existing,
    watermarkEnabled,
    watermark,
    renderedBlob: rendered.blob,
    width: rendered.width,
    height: rendered.height,
    updatedAt: Date.now(),
  };

  await db.photos.put(updated);
  return updated;
}
