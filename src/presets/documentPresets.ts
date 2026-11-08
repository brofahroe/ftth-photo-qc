import { DocumentHeader, DocumentPage, DocumentType, PagePresetType } from '../types';

export const DEFAULT_HEADER: DocumentHeader = {
  projectName: 'EMR FTTH PROJECT',
  region: '',
  oltName: '',
  clusterName: '',
  clusterId: '',
  customLeftLogoDataUrl: null,
  customRightLogoDataUrl: null,
  hideRightLogo: false,
};

export interface DocumentTypeMeta {
  type: DocumentType;
  label: string;
  shortLabel: string;
  defaultFileName: string;
  description: string;
  badgeColor: string;
}

export const DOCUMENT_TYPES: Record<DocumentType, DocumentTypeMeta> = {
  CW: {
    type: 'CW',
    label: 'FOTO CW (Civil Work — FDT & FAT)',
    shortLabel: 'FOTO CW',
    defaultFileName: 'FOTO CW',
    description: '6 foto per halaman (Grid 2x3) untuk dokumentasi fisik FDT dan FAT beserta tiang & label.',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  EL: {
    type: 'EL',
    label: 'FOTO EL (Electrical / OPM Redaman)',
    shortLabel: 'FOTO EL',
    defaultFileName: 'FOTO EL',
    description: '4 foto Input Splitter & 8 foto Output Splitter / OPM FAT (1310nm & 1550nm).',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  IMPLE: {
    type: 'IMPLE',
    label: 'FOTO IMPLEMENTASI (Tahapan Pekerjaan)',
    shortLabel: 'FOTO IMPLEMENTASI',
    defaultFileName: 'Foto Imple',
    description: '10 foto per halaman (Grid 2x5): Digging, Instal Pole, Pulling Cable, Accessories, Concrete.',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
};

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface CreatePageOptions {
  preset: PagePresetType;
  /** e.g. "BLA-CPU-D05" for FDT or "S01-A01" for FAT */
  deviceCode?: string;
  /** e.g. 1 for Output Splitter 1 */
  splitterNumber?: number;
  /** e.g. "1310nm" or "1550nm" */
  wavelength?: string;
  /** Custom starting number for splitter/port if needed (default 1) */
  startNumber?: number;
}

export function createDocumentPage(opts: CreatePageOptions): DocumentPage {
  const id = generateId();
  const startNum = opts.startNumber && opts.startNumber > 0 ? opts.startNumber : 1;

  switch (opts.preset) {
    case 'CW_FDT': {
      const code = (opts.deviceCode || 'BLA-CPU-D05').trim();
      const formattedCode = code.startsWith('(') ? code : `(${code})`;
      const labels = [
        'FDT Tertutup',
        'FDT Terbuka',
        'View Full Pole FDT',
        'View Pondasi Pole',
        'View ID/Label Kabel',
        'View ID/Label Pole',
      ];
      return {
        id,
        preset: 'CW_FDT',
        headerTopText: 'PHOTO',
        headerBottomText: `FDT\n${formattedCode}`,
        mergeMiddleHeader: false,
        columns: 2,
        rows: 3,
        descriptionStyle: 'white-center',
        descriptionPrefix: 'Description: ',
        showEmptySlotNumber: false,
        slots: labels.map((description, slotIndex) => ({
          slotIndex,
          description,
          photoId: null,
        })),
      };
    }

    case 'CW_FAT': {
      const code = (opts.deviceCode || 'S01-A01').trim();
      const headerBottom = code.toUpperCase().startsWith('FAT') ? code : `FAT ${code}`;
      const labels = [
        'FAT Tertutup',
        'FAT Terbuka',
        'View Full Pole FAT',
        'View Pondasi Pole',
        'View ID/Label Kabel',
        'View ID/Label Pole',
      ];
      return {
        id,
        preset: 'CW_FAT',
        headerTopText: 'PHOTO',
        headerBottomText: headerBottom,
        mergeMiddleHeader: false,
        columns: 2,
        rows: 3,
        descriptionStyle: 'white-center',
        descriptionPrefix: 'Description: ',
        showEmptySlotNumber: false,
        slots: labels.map((description, slotIndex) => ({
          slotIndex,
          description,
          photoId: null,
        })),
      };
    }

    case 'EL_INPUT_SPLITTER': {
      const wl = (opts.wavelength || '1310nm').trim();
      const fdtCode = (opts.deviceCode || 'BLA-CPU-D41').trim();
      const fdtLine = fdtCode.toUpperCase().startsWith('FDT')
        ? fdtCode
        : `FDT (${fdtCode.replace(/^\(|\)$/g, '')})`;
      return {
        id,
        preset: 'EL_INPUT_SPLITTER',
        headerTopText: 'PHOTO',
        headerBottomText: `INPUT SPLITTER -\n${wl}\n${fdtLine}`,
        mergeMiddleHeader: false,
        columns: 2,
        rows: 2,
        descriptionStyle: 'gray-left',
        descriptionPrefix: 'Description : ',
        showEmptySlotNumber: true,
        slots: Array.from({ length: 4 }, (_, i) => ({
          slotIndex: i,
          description: `Splitter ${startNum + i}`,
          photoId: null,
        })),
      };
    }

    case 'EL_OUTPUT_SPLITTER': {
      const splitterNo = opts.splitterNumber ?? 1;
      const wl = (opts.wavelength || '1310nm').trim();
      const wlFormatted = wl.startsWith('(') ? wl : `(${wl})`;
      const fdtCode = (opts.deviceCode || 'BLA-CPU-D41').trim();
      const fdtLine = fdtCode.toUpperCase().startsWith('FDT')
        ? fdtCode
        : `FDT (${fdtCode.replace(/^\(|\)$/g, '')})`;
      return {
        id,
        preset: 'EL_OUTPUT_SPLITTER',
        headerTopText: 'PHOTO',
        headerBottomText: `OUTPUT SPLITTER ${splitterNo}\n${wlFormatted}\n${fdtLine}`,
        mergeMiddleHeader: false,
        columns: 2,
        rows: 4,
        descriptionStyle: 'gray-left',
        descriptionPrefix: 'Description : ',
        showEmptySlotNumber: true,
        slots: Array.from({ length: 8 }, (_, i) => ({
          slotIndex: i,
          description: `Port ${startNum + i}`,
          photoId: null,
        })),
      };
    }

    case 'EL_OPM_FAT': {
      const fatCode = (opts.deviceCode || 'A01 S01').trim();
      const fatHeader = fatCode.toUpperCase().startsWith('OPM FAT')
        ? fatCode
        : fatCode.toUpperCase().startsWith('FAT')
          ? `OPM ${fatCode}`
          : `OPM FAT ${fatCode}`;
      const wl = (opts.wavelength || '1310nm').trim();
      return {
        id,
        preset: 'EL_OPM_FAT',
        headerTopText: 'PHOTO',
        headerBottomText: `${fatHeader}\n${wl}`,
        mergeMiddleHeader: false,
        columns: 2,
        rows: 4,
        descriptionStyle: 'gray-left',
        descriptionPrefix: 'Description : ',
        showEmptySlotNumber: true,
        slots: Array.from({ length: 8 }, (_, i) => ({
          slotIndex: i,
          description: `Port ${startNum + i}`,
          photoId: null,
        })),
      };
    }

    case 'IMPLE_STANDARD':
    default: {
      const labels = [
        'DIGGING POLE',
        'DIGGING POLE',
        'INSTAL POLE',
        'INSTAL POLE',
        'PULLING CABLE',
        'PULLING CABLE',
        'INSTAL ACCESSORIES',
        'INSTAL ACCESSORIES',
        'CONCRETE POLE',
        'CONCRETE POLE',
      ];
      return {
        id,
        preset: 'IMPLE_STANDARD',
        headerTopText: 'PHOTO\nIMPLEMENTASI',
        headerBottomText: '',
        mergeMiddleHeader: true,
        columns: 2,
        rows: 5,
        descriptionStyle: 'white-left',
        descriptionPrefix: 'Description: ',
        showEmptySlotNumber: false,
        slots: labels.map((description, slotIndex) => ({
          slotIndex,
          description,
          photoId: null,
        })),
      };
    }
  }
}

export function getPageDisplayName(page: DocumentPage, index: number): string {
  if (page.mergeMiddleHeader) {
    const clean = page.headerTopText.replace(/\s+/g, ' ').trim();
    return `Hal ${index + 1} — ${clean}`;
  }
  const clean = page.headerBottomText.replace(/\n+/g, ' • ').trim();
  return `Hal ${index + 1} — ${clean || page.headerTopText}`;
}
