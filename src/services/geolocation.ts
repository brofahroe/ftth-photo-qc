import { db } from '../db/database';
import { WatermarkData } from '../types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Formats Date into exact sample format: "30-Dec-2025 15:44"
 */
export function formatWatermarkTimestamp(date: Date = new Date()): string {
  const d = Number.isNaN(date.getTime()) ? new Date() : date;
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}-${month}-${year} ${hours}:${minutes}`;
}

/**
 * Converts a Date or formatted watermark timestamp into `<input type="datetime-local">` value
 */
export function toDatetimeLocalInput(isoOrText?: string): string {
  let d = new Date();
  if (isoOrText) {
    const parsedIso = new Date(isoOrText);
    if (!Number.isNaN(parsedIso.getTime())) {
      d = parsedIso;
    } else {
      // Parse "30-Dec-2025 15:44"
      const m = isoOrText.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})\s+(\d{1,2}):(\d{2})/);
      if (m) {
        const monthIdx = MONTHS.findIndex((x) => x.toLowerCase() === m[2].toLowerCase());
        if (monthIdx >= 0) {
          d = new Date(Number(m[3]), monthIdx, Number(m[1]), Number(m[4]), Number(m[5]));
        }
      }
    }
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Formats numeric lat/lon into exact sample format: "8.0942S 112.6465E"
 */
export function formatWatermarkCoords(lat: number, lon: number): string {
  const latDir = lat < 0 ? 'S' : 'N';
  const lonDir = lon < 0 ? 'W' : 'E';
  return `${Math.abs(lat).toFixed(4)}${latDir} ${Math.abs(lon).toFixed(4)}${lonDir}`;
}

/**
 * Parses either "-8.0942, 112.6465" or "8.0942S 112.6465E"
 */
export function parseCoordinateString(raw: string): { lat: number; lon: number } | null {
  const clean = raw.trim();
  if (!clean) return null;

  // Pattern 1: 8.0942S 112.6465E
  const dirMatch = clean.match(
    /^(\d+(?:\.\d+)?)\s*([NSns])[\s,;]+(\d+(?:\.\d+)?)\s*([EWew])$/
  );
  if (dirMatch) {
    let lat = parseFloat(dirMatch[1]);
    if (dirMatch[2].toUpperCase() === 'S') lat = -lat;
    let lon = parseFloat(dirMatch[3]);
    if (dirMatch[4].toUpperCase() === 'W') lon = -lon;
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      return { lat, lon };
    }
  }

  // Pattern 2: -8.0942, 112.6465
  const decMatch = clean.match(/^(-?\d+(?:\.\d+)?)[\s,;]+(-?\d+(?:\.\d+)?)$/);
  if (decMatch) {
    const lat = parseFloat(decMatch[1]);
    const lon = parseFloat(decMatch[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      return { lat, lon };
    }
  }

  return null;
}

function makeGridKey(lat: number, lon: number): string {
  // ~110 meter grid cache key
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function reverseGeocodeAddress(lat: number, lon: number): Promise<string[]> {
  const gridKey = makeGridKey(lat, lon);

  // 1. Check exact local spatial cache (~110m)
  try {
    const cached = await db.geoCache.get(gridKey);
    if (cached && cached.addressLines.length > 0) {
      return cached.addressLines;
    }
  } catch {
    // Ignore IndexedDB errors
  }

  // 2. Fetch from OpenStreetMap Nominatim if online
  if (typeof navigator === 'undefined' || navigator.onLine) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6500);
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
        lat
      )}&lon=${encodeURIComponent(lon)}&zoom=18&addressdetails=1&accept-language=id`;

      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const addr = data?.address || {};
        const lines: string[] = [];

        // Line 1: Street & House Number
        const road =
          addr.road || addr.pedestrian || addr.residential || addr.footway || addr.path || '';
        const houseNo = addr.house_number ? `No. ${addr.house_number}` : '';
        const streetLine = [houseNo, road].filter(Boolean).join(' ').trim();
        if (streetLine) lines.push(streetLine);

        // Line 2: Kelurahan / Desa / Suburb
        const village =
          addr.village ||
          addr.suburb ||
          addr.neighbourhood ||
          addr.hamlet ||
          addr.quarter ||
          '';
        if (village && !lines.includes(village)) {
          lines.push(village);
        }

        // Line 3: Kecamatan
        const rawDistrict = addr.municipality || addr.city_district || addr.district || '';
        if (rawDistrict) {
          const kec = /^kecamatan\b/i.test(rawDistrict)
            ? rawDistrict
            : `Kecamatan ${rawDistrict}`;
          if (!lines.includes(kec)) lines.push(kec);
        }

        // Line 4: Kabupaten / Kota
        const rawRegency = addr.city || addr.regency || addr.county || addr.town || '';
        if (rawRegency) {
          const kab = /^(kabupaten|kota)\b/i.test(rawRegency)
            ? rawRegency
            : addr.city
              ? `Kota ${rawRegency}`
              : `Kabupaten ${rawRegency}`;
          if (!lines.includes(kab)) lines.push(kab);
        }

        // Line 5: Provinsi
        if (addr.state && !lines.includes(addr.state)) {
          lines.push(addr.state);
        }

        if (lines.length === 0 && typeof data?.display_name === 'string') {
          const fallbackParts = data.display_name
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)
            .slice(0, 4);
          lines.push(...fallbackParts);
        }

        if (lines.length > 0) {
          await db.geoCache.put({
            gridKey,
            latitude: lat,
            longitude: lon,
            addressLines: lines,
            updatedAt: Date.now(),
          });
          return lines;
        }
      }
    } catch {
      // Offline or timeout — proceed to nearest cached fallback
    }
  }

  // 3. Offline fallback: look for closest cached pole within 2.5 km (keep kelurahan/kecamatan/kabupaten/provinsi)
  try {
    const allCached = await db.geoCache.toArray();
    let best: { dist: number; lines: string[] } | null = null;
    for (const entry of allCached) {
      const dist = haversineMeters(lat, lon, entry.latitude, entry.longitude);
      if (dist <= 2500 && (!best || dist < best.dist)) {
        best = { dist, lines: entry.addressLines };
      }
    }
    if (best) {
      // If >150m away, drop specific house/street number on first line if >3 lines
      return best.dist > 150 && best.lines.length > 3 ? best.lines.slice(1) : best.lines;
    }
  } catch {
    // Ignore
  }

  return [];
}

export interface GpsPositionResult {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export function getCurrentGpsPosition(timeoutMs = 10000): Promise<GpsPositionResult> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Browser ini tidak mendukung Geolocation GPS.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        reject(err);
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 15000,
      }
    );
  });
}

export async function buildLiveWatermarkData(
  fallbackRegionLines: string[] = []
): Promise<WatermarkData> {
  const now = new Date();
  const timestampText = formatWatermarkTimestamp(now);

  try {
    const pos = await getCurrentGpsPosition(8000);
    const coordText = formatWatermarkCoords(pos.latitude, pos.longitude);
    const geocoded = await reverseGeocodeAddress(pos.latitude, pos.longitude);
    return {
      timestampText,
      isoTimestamp: now.toISOString(),
      latitude: pos.latitude,
      longitude: pos.longitude,
      coordText,
      addressLines: geocoded.length > 0 ? geocoded : fallbackRegionLines,
    };
  } catch {
    return {
      timestampText,
      isoTimestamp: now.toISOString(),
      coordText: '',
      addressLines: fallbackRegionLines,
    };
  }
}
