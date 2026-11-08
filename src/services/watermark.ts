import { PdfQualityPreset, RotationAngle, WatermarkData } from '../types';

export function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Gagal merender gambar dari canvas.'));
      },
      'image/jpeg',
      quality
    );
  });
}

/**
 * Normalizes a raw camera or gallery image so IndexedDB stays nimble while retaining sharp text/OPM digits.
 */
export async function normalizeRawImage(
  source: Blob,
  maxLongEdge = 2048,
  quality = 0.88
): Promise<{ blob: Blob; width: number; height: number }> {
  const img = await loadImageFromBlob(source);
  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;

  const scale = Math.min(1, maxLongEdge / Math.max(origW, origH));
  const width = Math.max(1, Math.round(origW * scale));
  const height = Math.max(1, Math.round(origH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context tidak tersedia.');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, quality);
  return { blob, width, height };
}

function wrapLineToMaxWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (!text) return [];
  if (ctx.measureText(text).width <= maxWidth) return [text];

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Renders rotated image + bottom-right watermark matching Sample/FOTO CW.pdf
 */
export async function renderWatermarkedPhoto(params: {
  rawBlob: Blob;
  rotation: RotationAngle;
  watermarkEnabled: boolean;
  watermark: WatermarkData;
  maxLongEdge?: number;
  jpegQuality?: number;
}): Promise<{ blob: Blob; width: number; height: number; dataUrl: string }> {
  const {
    rawBlob,
    rotation,
    watermarkEnabled,
    watermark,
    maxLongEdge = 1600,
    jpegQuality = 0.82,
  } = params;

  const img = await loadImageFromBlob(rawBlob);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;

  const swapped = rotation === 90 || rotation === 270;
  const rotW = swapped ? srcH : srcW;
  const rotH = swapped ? srcW : srcH;

  const scale = Math.min(1, maxLongEdge / Math.max(rotW, rotH));
  const outW = Math.max(1, Math.round(rotW * scale));
  const outH = Math.max(1, Math.round(rotH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context tidak tersedia.');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Apply rotation around canvas center
  ctx.save();
  ctx.translate(outW / 2, outH / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  const drawW = swapped ? outH : outW;
  const drawH = swapped ? outW : outH;
  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  // Draw bottom-right watermark matching FOTO CW.pdf
  if (watermarkEnabled) {
    const rawLines: string[] = [];
    if (watermark.timestampText?.trim()) rawLines.push(watermark.timestampText.trim());
    if (watermark.coordText?.trim()) rawLines.push(watermark.coordText.trim());
    if (Array.isArray(watermark.addressLines)) {
      for (const l of watermark.addressLines) {
        if (l && l.trim()) rawLines.push(l.trim());
      }
    }

    if (rawLines.length > 0) {
      const baseDim = Math.min(outW, outH);
      const fontSize = Math.max(14, Math.round(baseDim * 0.033));
      const lineHeight = Math.round(fontSize * 1.26);
      const padX = Math.round(baseDim * 0.026);
      const padY = Math.round(baseDim * 0.024);
      const maxTextWidth = outW * 0.82;

      ctx.save();
      ctx.font = `500 ${fontSize}px Arial, Helvetica, sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';

      const wrappedLines: string[] = [];
      for (const line of rawLines) {
        wrappedLines.push(...wrapLineToMaxWidth(ctx, line, maxTextWidth));
      }

      // Subtle bottom-right gradient vignette behind text for readability on bright skies/poles
      const blockHeight = wrappedLines.length * lineHeight + padY * 1.5;
      const grad = ctx.createLinearGradient(0, outH - blockHeight - fontSize, 0, outH);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.32)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, Math.max(0, outH - blockHeight - fontSize), outW, blockHeight + fontSize);

      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.lineWidth = Math.max(2, fontSize * 0.14);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.72)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
      ctx.shadowBlur = Math.max(2, fontSize * 0.16);
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = '#FFFFFF';

      const startY = outH - padY - (wrappedLines.length - 1) * lineHeight;
      wrappedLines.forEach((line, idx) => {
        const y = startY + idx * lineHeight;
        ctx.strokeText(line, outW - padX, y);
        ctx.fillText(line, outW - padX, y);
      });
      ctx.restore();
    }
  }

  const dataUrl = canvas.toDataURL('image/jpeg', jpegQuality);
  const blob = await canvasToBlob(canvas, jpegQuality);
  return { blob, width: outW, height: outH, dataUrl };
}

export const PDF_QUALITY_CONFIG: Record<
  PdfQualityPreset,
  { label: string; description: string; maxLongEdge: number; jpegQuality: number }
> = {
  light: {
    label: 'Ringan (Hemat Ukuran)',
    description: 'Ukuran file PDF sangat kecil (~150–400 KB untuk puluhan foto), cocok untuk FOTO CW & Implementasi.',
    maxLongEdge: 820,
    jpegQuality: 0.62,
  },
  standard: {
    label: 'Standar Jernih (Direkomendasikan)',
    description: 'Angka layar OPM & label tetap tajam saat di-zoom namun ukuran file PDF tetap ramping.',
    maxLongEdge: 1380,
    jpegQuality: 0.78,
  },
  high: {
    label: 'Kualitas Tinggi (Arsip Detail)',
    description: 'Resolusi tinggi maksimal untuk dokumentasi utama tanpa batas ukuran.',
    maxLongEdge: 2000,
    jpegQuality: 0.9,
  },
};
