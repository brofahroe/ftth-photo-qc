import React, { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  FileDown,
  FileText,
  Loader2,
  Share2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { DEFAULT_MORA_LOGO, DEFAULT_ZTE_LOGO } from '../assets/defaultLogos';
import { db } from '../db/database';
import { getPageDisplayName } from '../presets/documentPresets';
import { generateDocumentPdf, PdfExportProgress } from '../services/pdfGenerator';
import { PDF_QUALITY_CONFIG } from '../services/watermark';
import { PdfQualityPreset, PhotoRecord, QcDocument } from '../types';

interface ExportPdfModalProps {
  doc: QcDocument;
  initialPageIdx?: number;
  onUpdateTitle: (newTitle: string) => void;
  onClose: () => void;
}

export const ExportPdfModal: React.FC<ExportPdfModalProps> = ({
  doc,
  initialPageIdx = 0,
  onUpdateTitle,
  onClose,
}) => {
  const photos = useLiveQuery(
    () => db.photos.where('documentId').equals(doc.id).toArray(),
    [doc.id],
    [] as PhotoRecord[]
  );

  // Create object URLs for rendered photo blobs for instant visual preview
  const photoUrlMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of photos) {
      map.set(p.id, URL.createObjectURL(p.renderedBlob));
    }
    return map;
  }, [photos]);

  useEffect(() => {
    return () => {
      photoUrlMap.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photoUrlMap]);

  const [quality, setQuality] = useState<PdfQualityPreset>('standard');
  const [fileName, setFileName] = useState<string>(doc.title || `FOTO ${doc.docType}`);
  const [previewPageIdx, setPreviewPageIdx] = useState<number>(initialPageIdx);
  const [previewZoom, setPreviewZoom] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'SHEET' | 'PDF_EMBED'>('SHEET');

  const [exporting, setExporting] = useState<boolean>(false);
  const [progress, setProgress] = useState<PdfExportProgress | null>(null);
  const [generatedPdf, setGeneratedPdf] = useState<{
    blob: Blob;
    filename: string;
    url: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    return () => {
      if (generatedPdf?.url) {
        URL.revokeObjectURL(generatedPdf.url);
      }
    };
  }, [generatedPdf]);

  const totalSlots = doc.pages.reduce((sum, p) => sum + p.slots.length, 0);
  const filledSlots = doc.pages.reduce(
    (sum, p) => sum + p.slots.filter((s) => Boolean(s.photoId)).length,
    0
  );
  const emptySlots = totalSlots - filledSlots;

  const safePageIdx = Math.min(previewPageIdx, Math.max(0, doc.pages.length - 1));
  const currentPage = doc.pages[safePageIdx];

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const buildPdfInMemory = async (autoDownload: boolean) => {
    setExporting(true);
    setErrorMsg('');
    try {
      if (fileName.trim() && fileName.trim() !== doc.title) {
        onUpdateTitle(fileName.trim());
      }
      const targetDoc: QcDocument = {
        ...doc,
        title: fileName.trim() || doc.title,
      };
      const res = await generateDocumentPdf(targetDoc, quality, (p) => setProgress(p));
      if (generatedPdf?.url) {
        URL.revokeObjectURL(generatedPdf.url);
      }
      const pdfUrl = URL.createObjectURL(res.blob);
      setGeneratedPdf({ blob: res.blob, filename: res.filename, url: pdfUrl });

      if (autoDownload) {
        triggerDownload(res.blob, res.filename);
      } else {
        setViewMode('PDF_EMBED');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal membuat file PDF.');
    } finally {
      setExporting(false);
    }
  };

  const handleShareFile = async () => {
    if (!generatedPdf) return;
    try {
      const file = new File([generatedPdf.blob], generatedPdf.filename, {
        type: 'application/pdf',
      });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: generatedPdf.filename,
          files: [file],
        });
      } else {
        triggerDownload(generatedPdf.blob, generatedPdf.filename);
      }
    } catch {
      // User cancelled share sheet
    }
  };

  const canWebShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-6xl max-h-[94vh] rounded-3xl bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden my-auto">
        {/* Top Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-600 p-2 text-white shadow-xs">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold tracking-tight">
                Preview & Export Dokumen PDF
              </h2>
              <p className="text-xs text-slate-300">
                Periksa tampilan tabel header & foto tiap halaman sebelum di-convert ke PDF (A4 Portrait • {doc.pages.length}{' '}
                halaman • {filledSlots}/{totalSlots} foto terisi)
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={exporting}
            onClick={onClose}
            className="rounded-xl bg-white/10 p-2 text-slate-200 hover:bg-white/20 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Split Body: Left = Visual Preview, Right = Settings & Convert Actions */}
        <div className="flex-1 overflow-y-auto lg:overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          {/* Left Column: Interactive Page Preview */}
          <div className="lg:col-span-8 bg-slate-100 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col lg:h-full overflow-hidden">
            {/* Preview Toolbar */}
            <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
              {/* Mode Switcher */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setViewMode('SHEET')}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    viewMode === 'SHEET'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Pratinjau Kertas
                </button>
                <button
                  type="button"
                  disabled={exporting}
                  onClick={() => {
                    if (generatedPdf) {
                      setViewMode('PDF_EMBED');
                    } else {
                      buildPdfInMemory(false);
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    viewMode === 'PDF_EMBED'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  {generatedPdf ? 'Lihat File PDF Hasil Convert' : 'Render Preview PDF Asli'}
                </button>
              </div>

              {/* Page Navigation & Zoom (for Sheet Mode) */}
              {viewMode === 'SHEET' && doc.pages.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                    <button
                      type="button"
                      disabled={safePageIdx === 0}
                      onClick={() => setPreviewPageIdx((i) => Math.max(0, i - 1))}
                      className="rounded-lg p-1 text-slate-700 hover:bg-white disabled:opacity-35"
                      title="Halaman Sebelumnya"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <select
                      value={safePageIdx}
                      onChange={(e) => setPreviewPageIdx(Number(e.target.value))}
                      className="bg-transparent text-xs font-bold text-slate-800 px-1.5 py-0.5 focus:outline-none"
                    >
                      {doc.pages.map((p, idx) => (
                        <option key={p.id} value={idx}>
                          Hal {idx + 1}/{doc.pages.length}: {getPageDisplayName(p, idx)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={safePageIdx >= doc.pages.length - 1}
                      onClick={() =>
                        setPreviewPageIdx((i) => Math.min(doc.pages.length - 1, i + 1))
                      }
                      className="rounded-lg p-1 text-slate-700 hover:bg-white disabled:opacity-35"
                      title="Halaman Berikutnya"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="hidden sm:flex items-center gap-1 border border-slate-200 rounded-xl px-1.5 py-1 bg-white">
                    <button
                      type="button"
                      onClick={() => setPreviewZoom((z) => Math.max(0.75, +(z - 0.15).toFixed(2)))}
                      className="p-1 text-slate-600 hover:text-slate-900"
                      title="Perkecil"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[11px] font-bold text-slate-700 w-10 text-center">
                      {Math.round(previewZoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewZoom((z) => Math.min(1.6, +(z + 0.15).toFixed(2)))}
                      className="p-1 text-slate-600 hover:text-slate-900"
                      title="Perbesar"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {viewMode === 'PDF_EMBED' && generatedPdf && (
                <a
                  href={generatedPdf.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Buka PDF di Tab Baru
                </a>
              )}
            </div>

            {/* Preview Canvas Container */}
            <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-start justify-center min-h-[380px] max-h-[65vh] lg:max-h-[78vh]">
              {viewMode === 'PDF_EMBED' && generatedPdf ? (
                <iframe
                  src={generatedPdf.url}
                  title="PDF Preview"
                  className="w-full h-[55vh] lg:h-[72vh] rounded-xl border border-slate-300 bg-white shadow-inner"
                />
              ) : currentPage ? (
                <div
                  style={{
                    transform: `scale(${previewZoom})`,
                    transformOrigin: 'top center',
                  }}
                  className="bg-white shadow-xl border border-slate-300 p-5 sm:p-7 transition-transform w-[560px] min-h-[792px]"
                >
                  {/* Simulated PDF Header Table */}
                  <div className="border-2 border-black text-black mb-3">
                    <div className="grid grid-cols-12">
                      {/* Column 1: Logos + Project Name */}
                      <div className="col-span-4 border-r border-black flex flex-col justify-between">
                        <div
                          className={`flex items-center justify-between gap-2 px-2.5 py-2 ${
                            currentPage.preset === 'CW_FDT' ||
                            currentPage.preset === 'CW_FAT' ||
                            currentPage.preset === 'IMPLE_STANDARD'
                              ? 'border-b border-black'
                              : ''
                          }`}
                        >
                          <img
                            src={doc.header.customLeftLogoDataUrl || DEFAULT_ZTE_LOGO}
                            alt="Logo Kiri"
                            className="h-5 max-w-[45%] object-contain"
                          />
                          {!doc.header.hideRightLogo && (
                            <img
                              src={doc.header.customRightLogoDataUrl || DEFAULT_MORA_LOGO}
                              alt="Logo Kanan"
                              className="h-5 max-w-[50%] object-contain"
                            />
                          )}
                        </div>
                        <div className="px-2 py-1 text-center font-extrabold text-[10px] tracking-tight truncate">
                          {doc.header.projectName || 'EMR FTTH PROJECT'}
                        </div>
                      </div>

                      {/* Column 2: Middle Header ("PHOTO" + Device / Merged) */}
                      <div className="col-span-2 border-r border-black flex flex-col justify-center text-center font-extrabold text-[10px] leading-tight">
                        {currentPage.mergeMiddleHeader ? (
                          <div className="p-1.5 whitespace-pre-line">
                            {currentPage.headerTopText}
                          </div>
                        ) : (
                          <>
                            <div className="border-b border-black py-1.5 px-1 whitespace-pre-line">
                              {currentPage.headerTopText || 'PHOTO'}
                            </div>
                            <div className="py-1.5 px-1 whitespace-pre-line">
                              {currentPage.headerBottomText}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Column 3 & 4: Region, OLT Name, Cluster Name, Cluster ID */}
                      <div className="col-span-6 text-[9.5px] font-bold divide-y divide-black">
                        {[
                          ['Region', doc.header.region],
                          ['OLT Name', doc.header.oltName],
                          ['Cluster Name', doc.header.clusterName],
                          ['Cluster ID', doc.header.clusterId],
                        ].map(([label, val]) => (
                          <div key={label} className="grid grid-cols-12">
                            <div className="col-span-4 border-r border-black px-1.5 py-0.5 truncate">
                              {label}
                            </div>
                            <div className="col-span-8 px-1.5 py-0.5 truncate">
                              : {val || ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Simulated 2-Column Photo Slots Grid */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                    {currentPage.slots.map((slot, sIdx) => {
                      const photoUrl = slot.photoId
                        ? photoUrlMap.get(slot.photoId)
                        : undefined;
                      const heightClass =
                        currentPage.rows === 2
                          ? 'h-44'
                          : currentPage.rows === 3
                            ? 'h-40'
                            : currentPage.rows === 4
                              ? 'h-28'
                              : 'h-24';

                      return (
                        <div key={slot.slotIndex} className="flex flex-col">
                          {/* Photo Box */}
                          <div
                            className={`border border-black bg-white flex items-center justify-center overflow-hidden p-0.5 ${heightClass}`}
                          >
                            {photoUrl ? (
                              <img
                                src={photoUrl}
                                alt={slot.description}
                                className="max-h-full max-w-full object-contain"
                              />
                            ) : currentPage.showEmptySlotNumber ? (
                              <span className="text-xs font-bold text-slate-800">
                                {sIdx + 1}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-300 italic">
                                (Kosong #{sIdx + 1})
                              </span>
                            )}
                          </div>

                          {/* Description Bar */}
                          <div
                            className={`border-x border-b border-black px-1.5 py-0.5 text-[9.5px] font-bold text-black truncate ${
                              currentPage.descriptionStyle === 'gray-left'
                                ? 'bg-[#d9d9d9] text-left'
                                : currentPage.descriptionStyle === 'white-center'
                                  ? 'bg-white text-center'
                                  : 'bg-white text-left'
                            }`}
                          >
                            {currentPage.descriptionPrefix}
                            {slot.description}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Right Column: Export Settings & Convert Action */}
          <div className="lg:col-span-4 p-5 space-y-4 flex flex-col justify-between bg-white">
            <div className="space-y-4">
              {emptySlots > 0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 flex items-start gap-2 text-xs text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Terdapat <strong>{emptySlots} kotak foto kosong</strong>. Anda tetap bisa
                    convert ke PDF sekarang (pada FOTO EL, kotak kosong otomatis diberi nomor urut).
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama File Output (.pdf)
                </label>
                <input
                  type="text"
                  value={fileName}
                  onChange={(e) => {
                    setFileName(e.target.value);
                    setGeneratedPdf(null);
                  }}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                  Pilih Kualitas & Ukuran PDF
                </label>
                <div className="space-y-2">
                  {(['light', 'standard', 'high'] as PdfQualityPreset[]).map((presetKey) => {
                    const cfg = PDF_QUALITY_CONFIG[presetKey];
                    const active = quality === presetKey;
                    return (
                      <button
                        key={presetKey}
                        type="button"
                        onClick={() => {
                          setQuality(presetKey);
                          setGeneratedPdf(null);
                        }}
                        className={`w-full text-left rounded-xl border p-3 transition-all ${
                          active
                            ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-600/20'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="font-bold text-xs sm:text-sm text-slate-900">
                          {cfg.label}
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5">{cfg.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {exporting && progress && (
                <div className="space-y-1.5 rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                    <span className="truncate">{progress.message}</span>
                    <span>{Math.round((progress.currentStep / progress.totalSteps) * 100)}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 transition-all duration-200"
                      style={{
                        width: `${Math.min(100, Math.round((progress.currentStep / progress.totalSteps) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {generatedPdf && !exporting && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-emerald-950 truncate">
                          {generatedPdf.filename} siap!
                        </div>
                        <div className="text-[11px] text-emerald-700">
                          Ukuran: {(generatedPdf.blob.size / (1024 * 1024)).toFixed(2)} MB (
                          {Math.round(generatedPdf.blob.size / 1024)} KB)
                        </div>
                      </div>
                    </div>
                    {canWebShare && (
                      <button
                        type="button"
                        onClick={handleShareFile}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 shrink-0"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        Bagikan
                      </button>
                    )}
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-700">
                  {errorMsg}
                </div>
              )}
            </div>

            {/* Bottom Action Buttons */}
            <div className="space-y-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                disabled={exporting}
                onClick={() => buildPdfInMemory(false)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-600 bg-emerald-50 px-4 py-2.5 text-xs sm:text-sm font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 transition"
              >
                <Eye className="w-4 h-4" />
                Preview Hasil Convert PDF
              </button>

              <button
                type="button"
                disabled={exporting}
                onClick={() => {
                  if (generatedPdf) {
                    triggerDownload(generatedPdf.blob, generatedPdf.filename);
                  } else {
                    buildPdfInMemory(true);
                  }
                }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition"
              >
                {exporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyusun PDF...
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4" />
                    {generatedPdf ? 'Download File PDF Sekarang' : 'Convert & Download PDF'}
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={exporting}
                onClick={onClose}
                className="w-full rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Kembali ke Editor
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
