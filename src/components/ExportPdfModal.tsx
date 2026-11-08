import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, FileDown, Loader2, Share2, X } from 'lucide-react';
import { generateDocumentPdf, PdfExportProgress } from '../services/pdfGenerator';
import { PDF_QUALITY_CONFIG } from '../services/watermark';
import { PdfQualityPreset, QcDocument } from '../types';

interface ExportPdfModalProps {
  doc: QcDocument;
  onUpdateTitle: (newTitle: string) => void;
  onClose: () => void;
}

export const ExportPdfModal: React.FC<ExportPdfModalProps> = ({
  doc,
  onUpdateTitle,
  onClose,
}) => {
  const [quality, setQuality] = useState<PdfQualityPreset>(
    doc.docType === 'EL' ? 'standard' : 'standard'
  );
  const [fileName, setFileName] = useState<string>(doc.title || `FOTO ${doc.docType}`);
  const [exporting, setExporting] = useState<boolean>(false);
  const [progress, setProgress] = useState<PdfExportProgress | null>(null);
  const [generatedPdf, setGeneratedPdf] = useState<{ blob: Blob; filename: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const totalSlots = doc.pages.reduce((sum, p) => sum + p.slots.length, 0);
  const filledSlots = doc.pages.reduce(
    (sum, p) => sum + p.slots.filter((s) => Boolean(s.photoId)).length,
    0
  );
  const emptySlots = totalSlots - filledSlots;

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

  const handleGenerate = async () => {
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
      setGeneratedPdf(res);
      triggerDownload(res.blob, res.filename);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-emerald-600 p-2 text-white">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Export Dokumen PDF</h2>
              <p className="text-xs text-slate-500">
                {doc.pages.length} halaman • {filledSlots}/{totalSlots} kotak foto terisi
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={exporting}
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {emptySlots > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 flex items-start gap-2 text-xs text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Terdapat <strong>{emptySlots} kotak foto kosong</strong>. Anda tetap bisa export PDF
                sekarang (pada FOTO EL, kotak kosong otomatis diberi nomor urut sesuai sample).
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Nama File Output (.pdf)
            </label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => {
                setFileName(e.target.value);
                setGeneratedPdf(null);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
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
                    <div className="font-bold text-sm text-slate-900">{cfg.label}</div>
                    <div className="text-xs text-slate-600 mt-0.5">{cfg.description}</div>
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
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-emerald-950 truncate">
                    {generatedPdf.filename} berhasil diunduh!
                  </div>
                  <div className="text-[11px] text-emerald-700">
                    Ukuran file: {(generatedPdf.blob.size / (1024 * 1024)).toFixed(2)} MB (
                    {Math.round(generatedPdf.blob.size / 1024)} KB)
                  </div>
                </div>
              </div>
              {canWebShare && (
                <button
                  type="button"
                  onClick={handleShareFile}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 shrink-0"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Bagikan
                </button>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-700">
              {errorMsg}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={exporting}
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Tutup
            </button>
            <button
              type="button"
              disabled={exporting}
              onClick={handleGenerate}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {exporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menyusun PDF...
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  {generatedPdf ? 'Download Ulang PDF' : 'Generate & Download PDF'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
