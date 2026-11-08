import exifr from 'exifr';
import {
  formatWatermarkCoords,
  formatWatermarkTimestamp,
  reverseGeocodeAddress,
} from './geolocation';
import { WatermarkData } from '../types';

export interface ExtractedExifInfo {
  date: Date | null;
  latitude: number | null;
  longitude: number | null;
}

export async function extractPhotoExif(file: Blob): Promise<ExtractedExifInfo> {
  try {
    const parsed = await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps: true,
    });
    if (!parsed) {
      return { date: null, latitude: null, longitude: null };
    }

    const rawDate = parsed.DateTimeOriginal || parsed.CreateDate || parsed.ModifyDate;
    const date = rawDate instanceof Date && !Number.isNaN(rawDate.getTime()) ? rawDate : null;

    const latitude =
      typeof parsed.latitude === 'number' && !Number.isNaN(parsed.latitude)
        ? parsed.latitude
        : null;
    const longitude =
      typeof parsed.longitude === 'number' && !Number.isNaN(parsed.longitude)
        ? parsed.longitude
        : null;

    return { date, latitude, longitude };
  } catch {
    return { date: null, latitude: null, longitude: null };
  }
}

export async function buildUploadWatermarkData(
  file: File | Blob,
  fallbackAddressLines: string[] = []
): Promise<WatermarkData> {
  const exif = await extractPhotoExif(file);
  const fileLastMod =
    file instanceof File && file.lastModified ? new Date(file.lastModified) : new Date();
  const effectiveDate = exif.date || fileLastMod;

  if (exif.latitude !== null && exif.longitude !== null) {
    const coordText = formatWatermarkCoords(exif.latitude, exif.longitude);
    const geocoded = await reverseGeocodeAddress(exif.latitude, exif.longitude);
    return {
      timestampText: formatWatermarkTimestamp(effectiveDate),
      isoTimestamp: effectiveDate.toISOString(),
      latitude: exif.latitude,
      longitude: exif.longitude,
      coordText,
      addressLines: geocoded.length > 0 ? geocoded : fallbackAddressLines,
    };
  }

  return {
    timestampText: formatWatermarkTimestamp(effectiveDate),
    isoTimestamp: effectiveDate.toISOString(),
    coordText: '',
    addressLines: fallbackAddressLines,
  };
}
