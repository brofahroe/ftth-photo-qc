import React, { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Archive,
  Building2,
  Camera,
  Copy,
  Download,
  FileDown,
  FilePlus2,
  FileText,
  FolderInput,
  HelpCircle,
  Search,
  Smartphone,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { DEFAULT_MORA_LOGO, DEFAULT_ZTE_LOGO } from '../assets/defaultLogos';
import {
  createDocument,
  db,
  deleteDocumentCascade,
  exportDocumentToZip,
  importDocumentFromZip,
} from '../db/database';
import { DOCUMENT_TYPES, generateId } from '../presets/documentPresets';
import { DocumentType, QcDocument } from '../types';
import { ExportPdfModal } from './ExportPdfModal';
import { HelpGuideModal } from './HelpGuideModal';
import { NewDocumentModal } from './NewDocumentModal';
import { VendorSettingsModal } from './VendorSettingsModal';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface DashboardProps {
  onOpenDocument: (docId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onOpenDocument }) => {
  const docs = useLiveQuery(
    () => db.documents.orderBy('updatedAt').reverse().toArray(),
    [],
    [] as QcDocument[]
  );

  const [filterType, setFilterType] = useState<'ALL' | DocumentType>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const [showGlobalVendorModal, setShowGlobalVendorModal] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [exportTargetDoc, setExportTargetDoc] = useState<QcDocument | null>(null);
  const [importingZip, setImportingZip] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  const zipInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallPwa = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const res = await installPrompt.userChoice;
    if (res.outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const handleImportZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingZip(true);
    try {
      const imported = await importDocumentFromZip(file);
      onOpenDocument(imported.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal mengimpor file proyek.');
    } finally {
      setImportingZip(false);
      e.target.value = '';
    }
  };

  const handleDuplicateOutline = async (src: QcDocument) => {
    const copy = await createDocument({
      title: `${src.title} (Salinan)`,
      docType: src.docType,
      header: { ...src.header },
      initialPages: src.pages.map((p) => ({
        ...p,
        id: generateId(),
        slots: p.slots.map((s) => ({ ...s, photoId: null })),
      })),
    });
    onOpenDocument(copy.id);
  };

  const handleExportZip = async (docId: string) => {
    const { blob, filename } = await exportDocumentToZip(docId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const handleDeleteDoc = async (doc: QcDocument) => {
    if (
      !confirm(
        `Hapus dokumen "${doc.title}" beserta seluruh foto di dalamnya dari perangkat ini?`
      )
    ) {
      return;
    }
    await deleteDocumentCascade(doc.id);
  };

  const filteredDocs = docs.filter((d) => {
    if (filterType !== 'ALL' && d.docType !== filterType) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.title.toLowerCase().includes(q) ||
      d.header.clusterName.toLowerCase().includes(q) ||
      d.header.clusterId.toLowerCase().includes(q) ||
      d.header.region.toLowerCase().includes(q) ||
      d.header.oltName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Top Hero Banner */}
      <header className="bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 rounded-2xl bg-blue-600/90 border border-blue-400/30 flex items-center justify-center shadow-lg">
                <Camera className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">
                    FTTH Photo QC
                  </h1>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      isOnline
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                        : 'bg-amber-500/20 text-amber-200 border border-amber-400/30'
                    }`}
                  >
                    {isOnline ? (
                      <>
                        <Wifi className="w-3 h-3" /> Online
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-3 h-3" /> Mode Offline Aktif
                      </>
                    )}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                  Dokumentasi Foto CW, EL (OPM), & Implementasi • Watermark Timestamp & GPS Otomatis
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {installPrompt && (
                <button
                  type="button"
                  onClick={handleInstallPwa}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 transition shadow-sm"
                >
                  <Smartphone className="w-4 h-4" />
                  Install di HP
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 border border-white/15 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20 transition"
                title="Panduan Penggunaan Aplikasi"
              >
                <HelpCircle className="w-4 h-4 text-blue-300" />
                Panduan
              </button>

              <button
                type="button"
                onClick={() => setShowGlobalVendorModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 border border-white/15 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20 transition"
              >
                <Building2 className="w-4 h-4" />
                Logo & Proyek
              </button>

              <button
                type="button"
                disabled={importingZip}
                onClick={() => zipInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 border border-white/15 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20 transition"
              >
                <FolderInput className="w-4 h-4" />
                {importingZip ? 'Mengimpor...' : 'Impor .ZIP'}
              </button>

              <button
                type="button"
                onClick={() => setShowNewModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-blue-500 active:scale-95 transition"
              >
                <FilePlus2 className="w-4 h-4" />
                Buat Dokumen Baru
              </button>

              <input
                ref={zipInputRef}
                type="file"
                accept=".zip,application/zip"
                onChange={handleImportZip}
                className="hidden"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 flex-1 space-y-5">
        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'ALL' as const, label: `Semua (${docs.length})` },
              {
                id: 'CW' as const,
                label: `FOTO CW (${docs.filter((d) => d.docType === 'CW').length})`,
              },
              {
                id: 'EL' as const,
                label: `FOTO EL (${docs.filter((d) => d.docType === 'EL').length})`,
              },
              {
                id: 'IMPLE' as const,
                label: `IMPLEMENTASI (${docs.filter((d) => d.docType === 'IMPLE').length})`,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterType(tab.id)}
                className={`rounded-xl px-3.5 py-2 text-xs font-bold shrink-0 transition ${
                  filterType === tab.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama dokumen / Cluster ID..."
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Document Cards */}
        {filteredDocs.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-10 text-center space-y-4">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText className="w-7 h-7" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h2 className="text-base font-bold text-slate-900">
                {docs.length === 0
                  ? 'Belum Ada Dokumen Dokumentasi'
                  : 'Tidak Ada Dokumen yang Cocok'}
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Buat dokumen baru untuk mulai memotret langsung dari kamera HP (dengan watermark
                waktu & GPS) atau meng-upload foto-foto FDT/FAT untuk dicetak ke PDF.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowNewModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
              >
                <FilePlus2 className="w-4 h-4" />
                Buat Dokumen Pertama
              </button>
              <button
                type="button"
                onClick={() => zipInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Download className="w-4 h-4" />
                Impor Backup (.ZIP)
              </button>
              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100"
              >
                <HelpCircle className="w-4 h-4" />
                Baca Panduan Pemakaian
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocs.map((doc) => {
              const meta = DOCUMENT_TYPES[doc.docType];
              const totalSlots = doc.pages.reduce((s, p) => s + p.slots.length, 0);
              const filledSlots = doc.pages.reduce(
                (s, p) => s + p.slots.filter((sl) => Boolean(sl.photoId)).length,
                0
              );
              const pct = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;

              return (
                <div
                  key={doc.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:shadow-md transition flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${meta.badgeColor}`}
                      >
                        {meta.shortLabel}
                      </span>
                      <div className="flex items-center gap-1.5 border border-slate-100 rounded-md px-1.5 py-0.5">
                        <img
                          src={doc.header.customLeftLogoDataUrl || DEFAULT_ZTE_LOGO}
                          alt="Vendor 1"
                          className="h-3.5 object-contain"
                        />
                        {!doc.header.hideRightLogo && (
                          <img
                            src={doc.header.customRightLogoDataUrl || DEFAULT_MORA_LOGO}
                            alt="Vendor 2"
                            className="h-3.5 object-contain"
                          />
                        )}
                      </div>
                    </div>

                    <div
                      onClick={() => onOpenDocument(doc.id)}
                      className="cursor-pointer group"
                    >
                      <h3 className="font-bold text-base text-slate-900 group-hover:text-blue-600 transition truncate">
                        {doc.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {doc.header.clusterName || 'Cluster belum diisi'}{' '}
                        {doc.header.clusterId ? `(${doc.header.clusterId})` : ''}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Region: {doc.header.region || '—'} • OLT: {doc.header.oltName || '—'}
                      </p>
                    </div>

                    {/* Completion Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">
                          {doc.pages.length} Halaman • {filledSlots}/{totalSlots} Foto
                        </span>
                        <span className="font-bold text-slate-900">{pct}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            pct === 100 ? 'bg-emerald-500' : 'bg-blue-600'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Buttons */}
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => onOpenDocument(doc.id)}
                      className="flex-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 transition"
                    >
                      Buka & Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => setExportTargetDoc(doc)}
                      title="Export ke PDF"
                      className="rounded-xl bg-emerald-50 border border-emerald-200 p-2 text-emerald-700 hover:bg-emerald-100"
                    >
                      <FileDown className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExportZip(doc.id)}
                      title="Simpan paket proyek (.zip)"
                      className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"
                    >
                      <Archive className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDuplicateOutline(doc)}
                      title="Salin kerangka dokumen ini (tanpa foto)"
                      className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"
                    >
                      <Copy className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteDoc(doc)}
                      title="Hapus Dokumen"
                      className="rounded-xl border border-red-200 p-2 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <footer className="py-4 text-center text-xs text-slate-400 border-t border-slate-200/70 bg-white">
        Data tersimpan 100% lokal di perangkat Anda (Offline-First IndexedDB) • Siap dipakai di HP &
        Laptop
      </footer>

      {showNewModal && (
        <NewDocumentModal
          existingDocs={docs}
          onClose={() => setShowNewModal(false)}
          onCreated={(created) => {
            setShowNewModal(false);
            onOpenDocument(created.id);
          }}
        />
      )}

      {showGlobalVendorModal && (
        <VendorSettingsModal onClose={() => setShowGlobalVendorModal(false)} />
      )}

      {showHelpModal && (
        <HelpGuideModal onClose={() => setShowHelpModal(false)} />
      )}

      {exportTargetDoc && (
        <ExportPdfModal
          doc={exportTargetDoc}
          onUpdateTitle={() => {}}
          onClose={() => setExportTargetDoc(null)}
        />
      )}
    </div>
  );
};
