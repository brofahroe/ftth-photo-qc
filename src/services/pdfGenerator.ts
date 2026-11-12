import { jsPDF } from 'jspdf';
import { DEFAULT_MORA_LOGO, DEFAULT_ZTE_LOGO } from '../assets/defaultLogos';
import { db } from '../db/database';
import {
  DocumentHeader,
  DocumentPage,
  DocumentType,
  PdfQualityPreset,
  PhotoRecord,
  QcDocument,
} from '../types';
import {
  loadImageFromBlob,
  PDF_QUALITY_CONFIG,
  renderWatermarkedPhoto,
} from './watermark';

export interface PdfExportProgress {
  currentStep: number;
  totalSteps: number;
  message: string;
}

interface LogoDimensions {
  dataUrl: string;
  format: 'PNG' | 'JPEG';
  aspect: number; // width / height
}

async function resolveLogoMeta(dataUrl: string): Promise<LogoDimensions | null> {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const img = await loadImageFromBlob(blob);
    const w = img.naturalWidth || img.width || 100;
    const h = img.naturalHeight || img.height || 34;
    const format = dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')
      ? 'JPEG'
      : 'PNG';
    return {
      dataUrl,
      format,
      aspect: w / Math.max(1, h),
    };
  } catch {
    return null;
  }
}

interface LayoutMetrics {
  orientation: 'portrait' | 'landscape';
  pageW: number;
  pageH: number;
  left: number;
  totalW: number;
  headerTop: number;
  headerH: number;
  col1W: number;
  col2W: number;
  col3W: number;
  col4W: number;
  splitLogoCell: boolean;
  headerFontSize: number;
  middleFontSize: number;
  gridTop: number;
  leftColW: number;
  rightColW: number;
  colGap: number;
  photoH: number;
  descH: number;
  rowGap: number;
  descFontSize: number;
  lineWidth: number;
}

const A4_PORTRAIT_W = 595.28;
const A4_PORTRAIT_H = 841.89;

function assertA4PortraitPages(pdf: jsPDF): void {
  for (let pageNumber = 1; pageNumber <= pdf.getNumberOfPages(); pageNumber++) {
    pdf.setPage(pageNumber);
    const width = pdf.internal.pageSize.getWidth();
    const height = pdf.internal.pageSize.getHeight();
    if (
      Math.abs(width - A4_PORTRAIT_W) > 0.01 ||
      Math.abs(height - A4_PORTRAIT_H) > 0.01
    ) {
      throw new Error(
        `Ukuran halaman PDF ke-${pageNumber} bukan A4 portrait (${width.toFixed(2)} \u00d7 ${height.toFixed(2)} pt).`
      );
    }
  }
}

function getLayoutMetrics(page: DocumentPage): LayoutMetrics {
  switch (page.preset) {
    case 'EL_INPUT_SPLITTER':
      return {
        orientation: 'portrait',
        pageW: A4_PORTRAIT_W,
        pageH: A4_PORTRAIT_H,
        left: 67.64,
        totalW: 460.0,
        headerTop: 55.0,
        headerH: 52.0,
        col1W: 130.0,
        col2W: 90.0,
        col3W: 68.0,
        col4W: 172.0,
        splitLogoCell: false,
        headerFontSize: 7.5,
        middleFontSize: 7.2,
        gridTop: 120.0,
        leftColW: 214.0,
        rightColW: 214.0,
        colGap: 32.0,
        photoH: 200.0,
        descH: 14.0,
        rowGap: 16.0,
        descFontSize: 8.0,
        lineWidth: 0.9,
      };

    case 'EL_OUTPUT_SPLITTER':
    case 'EL_OPM_FAT':
      return {
        orientation: 'portrait',
        pageW: A4_PORTRAIT_W,
        pageH: A4_PORTRAIT_H,
        left: 77.64,
        totalW: 440.0,
        headerTop: 48.0,
        headerH: 46.0,
        col1W: 124.0,
        col2W: 84.0,
        col3W: 64.0,
        col4W: 168.0,
        splitLogoCell: false,
        headerFontSize: 7.0,
        middleFontSize: 6.8,
        gridTop: 104.0,
        leftColW: 206.0,
        rightColW: 206.0,
        colGap: 28.0,
        photoH: 148.0,
        descH: 12.0,
        rowGap: 10.0,
        descFontSize: 7.2,
        lineWidth: 0.8,
      };

    case 'IMPLE_STANDARD':
      return {
        orientation: 'portrait',
        pageW: A4_PORTRAIT_W,
        pageH: A4_PORTRAIT_H,
        left: 118.09,
        totalW: 359.1,
        headerTop: 55.0,
        headerH: 32.8,
        col1W: 120.0,
        col2W: 60.0,
        col3W: 58.2,
        col4W: 120.9,
        splitLogoCell: true,
        headerFontSize: 6.2,
        middleFontSize: 6.2,
        gridTop: 95.0,
        leftColW: 164.5,
        rightColW: 164.5,
        colGap: 30.1,
        photoH: 110.5,
        descH: 10.8,
        rowGap: 8.0,
        descFontSize: 6.5,
        lineWidth: 0.85,
      };

    case 'CW_FDT':
    case 'CW_FAT':
    case 'CW_SF_POLE':
    default:
      return {
        orientation: 'portrait',
        pageW: A4_PORTRAIT_W,
        pageH: A4_PORTRAIT_H,
        left: 90.94,
        totalW: 413.4,
        headerTop: 55.0,
        headerH: 36.8,
        col1W: 145.7,
        col2W: 64.5,
        col3W: 63.2,
        col4W: 140.0,
        splitLogoCell: true,
        headerFontSize: 7.0,
        middleFontSize: 7.2,
        gridTop: 99.5,
        leftColW: 199.5,
        rightColW: 199.5,
        colGap: 14.4,
        photoH: 187.2,
        descH: 12.5,
        rowGap: 12.5,
        descFontSize: 7.5,
        lineWidth: 0.95,
      };
  }
}

function drawCenteredMultilineText(
  pdf: jsPDF,
  lines: string[],
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  fontSize: number
) {
  const cleanLines = lines.map((l) => l.trim()).filter(Boolean);
  if (cleanLines.length === 0) return;

  let effectiveFont = fontSize;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(effectiveFont);

  // Shrink slightly if any line exceeds box width
  const maxAllowedW = boxW - 4;
  for (const line of cleanLines) {
    const w = pdf.getTextWidth(line);
    if (w > maxAllowedW && w > 0) {
      effectiveFont = Math.max(4.5, effectiveFont * (maxAllowedW / w));
    }
  }
  pdf.setFontSize(effectiveFont);

  const lineH = effectiveFont * 1.18;
  const totalTextH = cleanLines.length * lineH;
  const startBaselineY = boxY + (boxH - totalTextH) / 2 + effectiveFont * 0.84;

  cleanLines.forEach((line, idx) => {
    pdf.text(line, boxX + boxW / 2, startBaselineY + idx * lineH, { align: 'center' });
  });
}

function drawFittedSingleLine(
  pdf: jsPDF,
  text: string,
  x: number,
  boxY: number,
  maxW: number,
  boxH: number,
  fontSize: number,
  align: 'left' | 'center' = 'left'
) {
  if (!text) return;
  pdf.setFont('helvetica', 'bold');
  let fs = fontSize;
  pdf.setFontSize(fs);
  const w = pdf.getTextWidth(text);
  if (w > maxW && w > 0) {
    fs = Math.max(4.5, fs * (maxW / w));
    pdf.setFontSize(fs);
  }
  const baselineY = boxY + boxH / 2 + fs * 0.34;
  if (align === 'center') {
    pdf.text(text, x + maxW / 2, baselineY, { align: 'center' });
  } else {
    pdf.text(text, x, baselineY);
  }
}

function drawPageHeader(
  pdf: jsPDF,
  docType: DocumentType,
  header: DocumentHeader,
  page: DocumentPage,
  m: LayoutMetrics,
  leftLogo: LogoDimensions | null,
  rightLogo: LogoDimensions | null
) {
  pdf.setDrawColor(0, 0, 0);
  pdf.setTextColor(0, 0, 0);
  pdf.setLineWidth(m.lineWidth);

  const x1 = m.left;
  const x2 = x1 + m.col1W;
  const x3 = x2 + m.col2W;
  const x4 = x3 + m.col3W;
  const yTop = m.headerTop;
  const h = m.headerH;

  // Outer header rectangle
  pdf.rect(x1, yTop, m.totalW, h);

  // Vertical column dividers
  pdf.line(x2, yTop, x2, yTop + h);
  pdf.line(x3, yTop, x3, yTop + h);
  pdf.line(x4, yTop, x4, yTop + h);

  // Column 1: Logos + Project Name
  const logoAreaH = m.splitLogoCell ? h * 0.54 : h * 0.65;
  const projAreaY = yTop + logoAreaH;
  const projAreaH = h - logoAreaH;

  if (m.splitLogoCell) {
    pdf.line(x1, projAreaY, x2, projAreaY);
  }

  // Draw Left & Right Logos inside Column 1 top area
  const padX = m.col1W * 0.045;
  const maxLogoH = logoAreaH * 0.76;

  if (leftLogo && (!rightLogo || header.hideRightLogo)) {
    // Single centered logo
    let drawH = maxLogoH;
    let drawW = drawH * leftLogo.aspect;
    if (drawW > m.col1W - padX * 2) {
      drawW = m.col1W - padX * 2;
      drawH = drawW / leftLogo.aspect;
    }
    const lx = x1 + (m.col1W - drawW) / 2;
    const ly = yTop + (logoAreaH - drawH) / 2;
    pdf.addImage(leftLogo.dataUrl, leftLogo.format, lx, ly, drawW, drawH);
  } else {
    if (leftLogo) {
      const availW = m.col1W * 0.36;
      let drawH = maxLogoH;
      let drawW = drawH * leftLogo.aspect;
      if (drawW > availW) {
        drawW = availW;
        drawH = drawW / leftLogo.aspect;
      }
      const lx = x1 + padX;
      const ly = yTop + (logoAreaH - drawH) / 2;
      pdf.addImage(leftLogo.dataUrl, leftLogo.format, lx, ly, drawW, drawH);
    }
    if (rightLogo && !header.hideRightLogo) {
      const availW = m.col1W * 0.52;
      let drawH = maxLogoH * 0.92;
      let drawW = drawH * rightLogo.aspect;
      if (drawW > availW) {
        drawW = availW;
        drawH = drawW / rightLogo.aspect;
      }
      const rx = x2 - padX - drawW;
      const ry = yTop + (logoAreaH - drawH) / 2;
      pdf.addImage(rightLogo.dataUrl, rightLogo.format, rx, ry, drawW, drawH);
    }
  }

  // Project Name in bottom of Column 1
  drawFittedSingleLine(
    pdf,
    header.projectName || 'EMR FTTH PROJECT',
    x1 + 3,
    projAreaY,
    m.col1W - 6,
    projAreaH,
    m.headerFontSize,
    'center'
  );

  // Column 2: Middle Header ("PHOTO" + Device / Merged "PHOTO IMPLEMENTASI")
  if (page.mergeMiddleHeader) {
    const lines = page.headerTopText.split('\n');
    drawCenteredMultilineText(pdf, lines, x2, yTop, m.col2W, h, m.middleFontSize);
  } else {
    const topCellH = m.splitLogoCell ? h * 0.54 : h * 0.49;
    const botCellY = yTop + topCellH;
    const botCellH = h - topCellH;
    pdf.line(x2, botCellY, x3, botCellY);

    drawCenteredMultilineText(
      pdf,
      (page.headerTopText || 'PHOTO').split('\n'),
      x2,
      yTop,
      m.col2W,
      topCellH,
      m.middleFontSize
    );
    drawCenteredMultilineText(
      pdf,
      page.headerBottomText.split('\n'),
      x2,
      botCellY,
      m.col2W,
      botCellH,
      m.middleFontSize
    );
  }

  // Columns 3 & 4: Metadata rows, including a custom title when provided
  const metaRows: Array<[string, string]> = [
    ['Region', header.region],
    ['OLT Name', header.oltName],
    [docType === 'CW_SF' ? 'Subfeeder Name' : 'Cluster Name', header.clusterName],
    [docType === 'CW_SF' ? 'Subfeeder ID' : 'Cluster ID', header.clusterId],
  ];
  const customTitle = header.headerTitle?.trim();
  if (customTitle) {
    metaRows.unshift(['Header Title', customTitle]);
  }
  const rowH = h / metaRows.length;

  metaRows.forEach(([label, val], idx) => {
    const ry = yTop + idx * rowH;
    if (idx > 0) {
      pdf.setLineWidth(m.lineWidth * 0.75);
      pdf.line(x3, ry, x1 + m.totalW, ry);
    }
    drawFittedSingleLine(pdf, label, x3 + 2.2, ry, m.col3W - 4, rowH, m.headerFontSize, 'left');
    drawFittedSingleLine(
      pdf,
      `: ${val || ''}`,
      x4 + 2.2,
      ry,
      m.col4W - 4,
      rowH,
      m.headerFontSize,
      'left'
    );
  });

  pdf.setLineWidth(m.lineWidth);
}

export async function generateDocumentPdf(
  doc: QcDocument,
  quality: PdfQualityPreset,
  onProgress?: (progress: PdfExportProgress) => void
): Promise<{ blob: Blob; filename: string }> {
  if (doc.pages.length === 0) {
    throw new Error('Dokumen belum memiliki halaman untuk diekspor.');
  }

  const qualityCfg = PDF_QUALITY_CONFIG[quality];

  // Load all photos for this document
  const photoRecords = await db.photos.where('documentId').equals(doc.id).toArray();
  const photoMap = new Map<string, PhotoRecord>();
  for (const p of photoRecords) {
    photoMap.set(p.id, p);
  }

  // Resolve header logos
  const leftLogoSrc = doc.header.customLeftLogoDataUrl || DEFAULT_ZTE_LOGO;
  const rightLogoSrc = doc.header.customRightLogoDataUrl || DEFAULT_MORA_LOGO;
  const [leftLogo, rightLogo] = await Promise.all([
    resolveLogoMeta(leftLogoSrc),
    doc.header.hideRightLogo ? Promise.resolve(null) : resolveLogoMeta(rightLogoSrc),
  ]);

  // Count total slots with photos for accurate progress bar
  const totalPhotosToRender = doc.pages.reduce(
    (acc, p) => acc + p.slots.filter((s) => s.photoId && photoMap.has(s.photoId)).length,
    0
  );
  const totalSteps = Math.max(1, totalPhotosToRender + doc.pages.length);
  let currentStep = 0;

  // Cache rendered PDF photo dataUrls in case a photo is referenced more than once
  const renderedCache = new Map<
    string,
    { dataUrl: string; width: number; height: number }
  >();

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true,
  });

  for (let pageIdx = 0; pageIdx < doc.pages.length; pageIdx++) {
    const page = doc.pages[pageIdx];
    const baseMetrics = getLayoutMetrics(page);
    const customTitle = doc.header.headerTitle?.trim();
    const additionalRowHeight = customTitle ? baseMetrics.headerH / 4 : 0;
    const m = {
      ...baseMetrics,
      headerH: baseMetrics.headerH + additionalRowHeight,
      gridTop: baseMetrics.gridTop + additionalRowHeight,
    };

    if (pageIdx > 0) {
      pdf.addPage('a4', 'portrait');
    }

    onProgress?.({
      currentStep,
      totalSteps,
      message: `Menyusun halaman ${pageIdx + 1} dari ${doc.pages.length}...`,
    });

    // 1. Draw exact Header Block
    drawPageHeader(pdf, doc.docType, doc.header, page, m, leftLogo, rightLogo);

    // 2. Draw Photo Slots Grid
    for (let r = 0; r < page.rows; r++) {
      for (let c = 0; c < page.columns; c++) {
        const slotIdx = r * page.columns + c;
        const slot = page.slots[slotIdx];
        if (!slot) continue;

        const colX = c === 0 ? m.left : m.left + m.leftColW + m.colGap;
        const colW = c === 0 ? m.leftColW : m.rightColW;
        const cellY = m.gridTop + r * (m.photoH + m.descH + m.rowGap);
        const descY = cellY + m.photoH;

        // Photo content or empty slot number
        const record = slot.photoId ? photoMap.get(slot.photoId) : undefined;
        if (record) {
          let rendered = renderedCache.get(record.id);
          if (!rendered) {
            const res = await renderWatermarkedPhoto({
              rawBlob: record.rawBlob,
              rotation: record.rotation,
              watermarkEnabled: record.watermarkEnabled,
              watermark: record.watermark,
              maxLongEdge: qualityCfg.maxLongEdge,
              jpegQuality: qualityCfg.jpegQuality,
            });
            rendered = { dataUrl: res.dataUrl, width: res.width, height: res.height };
            renderedCache.set(record.id, rendered);
          }

          // Fit image cleanly inside cell without cropping corner watermark
          const innerPad = 1.4;
          const availW = colW - innerPad * 2;
          const availH = m.photoH - innerPad * 2;
          const scale = Math.min(availW / rendered.width, availH / rendered.height);
          const drawW = rendered.width * scale;
          const drawH = rendered.height * scale;
          const drawX = colX + (colW - drawW) / 2;
          const drawY = cellY + (m.photoH - drawH) / 2;

          pdf.addImage(rendered.dataUrl, 'JPEG', drawX, drawY, drawW, drawH, undefined, 'FAST');

          currentStep++;
          onProgress?.({
            currentStep,
            totalSteps,
            message: `Memproses foto halaman ${pageIdx + 1} (${slot.description})...`,
          });
        } else if (page.showEmptySlotNumber) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(m.descFontSize + 1);
          pdf.setTextColor(30, 30, 30);
          pdf.text(String(slotIdx + 1), colX + colW / 2, cellY + m.photoH / 2 + 3, {
            align: 'center',
          });
          pdf.setTextColor(0, 0, 0);
        }

        // Photo Box Border
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(m.lineWidth);
        pdf.rect(colX, cellY, colW, m.photoH);

        // Description Bar Fill & Border
        if (page.descriptionStyle === 'gray-left') {
          pdf.setFillColor(217, 217, 217);
          pdf.rect(colX, descY, colW, m.descH, 'FD');
        } else {
          pdf.rect(colX, descY, colW, m.descH);
        }

        // Description Text
        const fullDesc = `${page.descriptionPrefix}${slot.description}`;
        pdf.setTextColor(0, 0, 0);
        if (page.descriptionStyle === 'white-center') {
          drawFittedSingleLine(
            pdf,
            fullDesc,
            colX + 3,
            descY,
            colW - 6,
            m.descH,
            m.descFontSize,
            'center'
          );
        } else {
          drawFittedSingleLine(
            pdf,
            fullDesc,
            colX + 2.8,
            descY,
            colW - 5.6,
            m.descH,
            m.descFontSize,
            'left'
          );
        }
      }
    }

    currentStep++;
    onProgress?.({
      currentStep,
      totalSteps,
      message: `Halaman ${pageIdx + 1} selesai.`,
    });
  }

  assertA4PortraitPages(pdf);
  const blob = pdf.output('blob');
  const cleanName = doc.title.replace(/[\\/:*?"<>|]+/g, '-').trim() || `FOTO ${doc.docType}`;
  const filename = cleanName.toLowerCase().endsWith('.pdf') ? cleanName : `${cleanName}.pdf`;
  return { blob, filename };
}
