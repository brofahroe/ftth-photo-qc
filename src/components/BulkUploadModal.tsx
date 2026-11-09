import React, { useRef, useState } from 'react';
import { FolderUp, Loader2, Sparkles, UploadCloud, X } from 'lucide-react';
import { createDocumentPage } from '../presets/documentPresets';
import { createPhotoFromUpload } from '../services/photoManager';
import {
  DocumentHeader,
  DocumentPage,
  DocumentType,
  PagePresetType,
} from '../types';

interface BulkUploadModalProps {
  documentId: string;
  docType: DocumentType;
  header: DocumentHeader;
  pages: DocumentPage[];
  activePageIndex: number;
  defaultWatermarkEnabled: boolean;
  onComplete: (updatedPages: DocumentPage[], lastTouchedPageIdx: number) => Promise<void>;
  onClose: () => void;
}

export const BulkUploadModal: React.FC<BulkUploadModalProps> = ({
  documentId,
  docType,
  header,
  pages,
  activePageIndex,
  defaultWatermarkEnabled,
  onComplete,
  onClose,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [watermarkEnabled, setWatermarkEnabled] = useState<boolean>(defaultWatermarkEnabled);
  const [fillCurrentFirst, setFillCurrentFirst] = useState<boolean>(true);
  const [newPagePreset, setNewPagePreset] = useState<PagePresetType>(
    docType === 'CW'
      ? 'CW_FAT'
      : docType === 'CW_SF'
        ? 'CW_SF_POLE'
      : docType === 'EL'
        ? 'EL_OPM_FAT'
        : 'IMPLE_STANDARD'
  );
  const [codePrefix, setCodePrefix] = useState<string>(
    docType === 'CW'
      ? 'S01-A'
      : docType === 'CW_SF'
        ? 'Pole SF ext '
        : docType === 'EL'
          ? 'A01 S'
          : ''
  );
  const [startSequence, setStartSequence] = useState<number>(docType === 'CW_SF' ? 2 : 1);
  const [processing, setProcessing] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>('');

  const handleSelectFiles = (selected: FileList | null) => {
    if (!selected) return;
    const imageFiles = Array.from(selected)
      .filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(f.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    setFiles((prev) => [...prev, ...imageFiles]);
  };

  const handleNewPagePresetChange = (preset: PagePresetType) => {
    setNewPagePreset(preset);
    if (docType === 'CW_SF') {
      setCodePrefix(preset === 'CW_FDT' ? 'BLA-CPU-D' : 'Pole SF ext ');
    }
  };

  const handleRunBulkUpload = async () => {
    if (files.length === 0) return;
    setProcessing(true);

    try {
      const clonedPages: DocumentPage[] = pages.map((p) => ({
        ...p,
        slots: p.slots.map((s) => ({ ...s })),
      }));

      let fileCursor = 0;
      let seqCounter = startSequence;
      let lastPageIdx = activePageIndex;

      // Step 1: Fill empty slots on existing pages starting from activePageIndex if enabled
      if (fillCurrentFirst && clonedPages.length > 0) {
        for (let pIdx = activePageIndex; pIdx < clonedPages.length && fileCursor < files.length; pIdx++) {
          const targetPage = clonedPages[pIdx];
          for (let sIdx = 0; sIdx < targetPage.slots.length && fileCursor < files.length; sIdx++) {
            if (!targetPage.slots[sIdx].photoId) {
              const file = files[fileCursor];
              setProgressText(
                `Memproses foto ${fileCursor + 1} / ${files.length} (${file.name})...`
              );
              const record = await createPhotoFromUpload({
                documentId,
                file,
                watermarkEnabled,
                fallbackHeader: header,
              });
              targetPage.slots[sIdx].photoId = record.id;
              lastPageIdx = pIdx;
              fileCursor++;
            }
          }
        }
      }

      // Step 2: Automatically create new pages for remaining photos!
      while (fileCursor < files.length) {
        const paddedNo = String(seqCounter).padStart(2, '0');
        const generatedCode =
          docType === 'CW_SF' && newPagePreset === 'CW_SF_POLE'
            ? `${codePrefix}${seqCounter}`
            : `${codePrefix}${paddedNo}`;
        seqCounter++;

        const newPage = createDocumentPage({
          preset: newPagePreset,
          deviceCode: generatedCode,
          splitterNumber: seqCounter - 1,
          wavelength: '1310nm',
        });

        for (let sIdx = 0; sIdx < newPage.slots.length && fileCursor < files.length; sIdx++) {
          const file = files[fileCursor];
          setProgressText(
            `Memproses foto ${fileCursor + 1} / ${files.length} ke halaman baru (${generatedCode})...`
          );
          const record = await createPhotoFromUpload({
            documentId,
            file,
            watermarkEnabled,
            fallbackHeader: header,
          });
          newPage.slots[sIdx].photoId = record.id;
          fileCursor++;
        }

        clonedPages.push(newPage);
        lastPageIdx = clonedPages.length - 1;
      }

      await onComplete(clonedPages, lastPageIdx);
      onClose();
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-indigo-600 p-2 text-white">
              <FolderUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Upload Massal & Auto-Buat Halaman
              </h2>
              <p className="text-xs text-slate-500">
                Pilih puluhan foto sekaligus, otomatis dibagi per halaman
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={processing}
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleSelectFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/50 p-6 text-center hover:bg-indigo-50 transition-colors"
          >
            <UploadCloud className="w-9 h-9 text-indigo-600 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-800">
              Klik atau Tarik (Drag & Drop) Banyak Foto ke Sini
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Foto akan diurutkan rapi berdasarkan nama file
            </p>
            {files.length > 0 && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-3.5 py-1 text-xs font-semibold text-white">
                {files.length} foto dipilih
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                handleSelectFiles(e.target.files);
                e.target.value = '';
              }}
              className="hidden"
            />
          </div>

          {files.length > 0 && (
            <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
              <span className="truncate">
                {files[0].name} {files.length > 1 ? `... (+${files.length - 1} foto lainnya)` : ''}
              </span>
              <button
                type="button"
                onClick={() => setFiles([])}
                className="text-red-600 font-semibold hover:underline shrink-0 ml-2"
              >
                Kosongkan
              </button>
            </div>
          )}

          {/* Watermark Switch */}
          <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3 cursor-pointer">
            <div>
              <div className="text-xs font-bold text-slate-900">
                Pasang Watermark Otomatis (Baca EXIF Waktu & GPS)
              </div>
              <div className="text-[11px] text-slate-500">
                Matikan jika foto yang di-upload sudah memiliki watermark dari kamera teknisi
              </div>
            </div>
            <input
              type="checkbox"
              checked={watermarkEnabled}
              onChange={(e) => setWatermarkEnabled(e.target.checked)}
              className="h-5 w-5 rounded border-slate-300 text-indigo-600"
            />
          </label>

          <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={fillCurrentFirst}
              onChange={(e) => setFillCurrentFirst(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            <span>Isi kotak kosong pada halaman saat ini terlebih dahulu sebelum buat halaman baru</span>
          </label>

          {docType !== 'IMPLE' && (
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 border border-slate-200 p-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Template untuk Halaman Baru Otomatis
                </label>
                <select
                  value={newPagePreset}
                  onChange={(e) =>
                    handleNewPagePresetChange(e.target.value as PagePresetType)
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  {docType === 'CW' ? (
                    <>
                      <option value="CW_FAT">FAT — 6 Kotak per Halaman</option>
                      <option value="CW_FDT">FDT — 6 Kotak per Halaman</option>
                    </>
                  ) : docType === 'CW_SF' ? (
                    <>
                      <option value="CW_SF_POLE">Pole SF — 4 Kotak per Halaman</option>
                      <option value="CW_FDT">FDT — 6 Kotak per Halaman</option>
                    </>
                  ) : (
                    <>
                      <option value="EL_OPM_FAT">OPM FAT — 8 Kotak per Halaman</option>
                      <option value="EL_OUTPUT_SPLITTER">Output Splitter — 8 Kotak per Halaman</option>
                      <option value="EL_INPUT_SPLITTER">Input Splitter — 4 Kotak per Halaman</option>
                    </>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Awalan Kode Otomatis
                </label>
                <input
                  type="text"
                  value={codePrefix}
                  onChange={(e) => setCodePrefix(e.target.value)}
                  placeholder="S01-A"
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Mulai Nomor Urut
                </label>
                <input
                  type="number"
                  min={1}
                  value={startSequence}
                  onChange={(e) => setStartSequence(Number(e.target.value) || 1)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>
          )}

          {processing && (
            <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-3 flex items-center gap-2.5 text-xs text-indigo-900 font-medium">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />
              <span className="truncate">{progressText}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={processing}
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={processing || files.length === 0}
              onClick={handleRunBulkUpload}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {processing ? 'Memproses...' : `Proses ${files.length} Foto`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
