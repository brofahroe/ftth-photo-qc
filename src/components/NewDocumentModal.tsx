import React, { useState } from 'react';
import { Copy, FilePlus2, Layers, Sparkles, X } from 'lucide-react';
import {
  createDocumentPage,
  DEFAULT_HEADER,
  DOCUMENT_TYPES,
} from '../presets/documentPresets';
import { createDocument } from '../db/database';
import { DocumentPage, DocumentType, QcDocument } from '../types';

interface NewDocumentModalProps {
  existingDocs: QcDocument[];
  onClose: () => void;
  onCreated: (doc: QcDocument) => void;
}

export const NewDocumentModal: React.FC<NewDocumentModalProps> = ({
  existingDocs,
  onClose,
  onCreated,
}) => {
  const [docType, setDocType] = useState<DocumentType>('CW');
  const [title, setTitle] = useState<string>(DOCUMENT_TYPES.CW.defaultFileName);
  const [projectName, setProjectName] = useState<string>(DEFAULT_HEADER.projectName);
  const [region, setRegion] = useState<string>('');
  const [oltName, setOltName] = useState<string>('');
  const [clusterName, setClusterName] = useState<string>('');
  const [clusterId, setClusterId] = useState<string>('');
  const [firstDeviceCode, setFirstDeviceCode] = useState<string>('BLA-CPU-D05');
  const [submitting, setSubmitting] = useState(false);

  const handleSelectType = (next: DocumentType) => {
    setDocType(next);
    const defaultTitles = Object.values(DOCUMENT_TYPES).map((d) => d.defaultFileName);
    if (!title.trim() || defaultTitles.includes(title.trim())) {
      setTitle(DOCUMENT_TYPES[next].defaultFileName);
    }
    if (next === 'CW') setFirstDeviceCode('BLA-CPU-D05');
    if (next === 'EL') setFirstDeviceCode('BLA-CPU-D41');
  };

  const handleCopyHeaderFrom = (docId: string) => {
    const source = existingDocs.find((d) => d.id === docId);
    if (!source) return;
    setProjectName(source.header.projectName || DEFAULT_HEADER.projectName);
    setRegion(source.header.region || '');
    setOltName(source.header.oltName || '');
    setClusterName(source.header.clusterName || '');
    setClusterId(source.header.clusterId || '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const initialPages: DocumentPage[] = [];
      if (docType === 'CW') {
        initialPages.push(
          createDocumentPage({
            preset: 'CW_FDT',
            deviceCode: firstDeviceCode || 'BLA-CPU-D05',
          }),
          createDocumentPage({
            preset: 'CW_FAT',
            deviceCode: 'S01-A01',
          })
        );
      } else if (docType === 'EL') {
        const fdt = firstDeviceCode || 'BLA-CPU-D41';
        initialPages.push(
          createDocumentPage({
            preset: 'EL_INPUT_SPLITTER',
            deviceCode: fdt,
            wavelength: '1310nm',
          }),
          createDocumentPage({
            preset: 'EL_INPUT_SPLITTER',
            deviceCode: fdt,
            wavelength: '1550nm',
          })
        );
      } else {
        initialPages.push(createDocumentPage({ preset: 'IMPLE_STANDARD' }));
      }

      const created = await createDocument({
        title: title.trim() || DOCUMENT_TYPES[docType].defaultFileName,
        docType,
        header: {
          projectName: projectName.trim() || DEFAULT_HEADER.projectName,
          region: region.trim(),
          oltName: oltName.trim(),
          clusterName: clusterName.trim(),
          clusterId: clusterId.trim(),
        },
        initialPages,
      });
      onCreated(created);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 my-auto overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-blue-600 p-2 text-white">
              <FilePlus2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Buat Dokumen Baru</h2>
              <p className="text-xs text-slate-500">Pilih preset laporan sesuai kebutuhan QC</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Document Type Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
              1. Pilih Jenis Dokumen
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              {(['CW', 'EL', 'IMPLE'] as DocumentType[]).map((type) => {
                const meta = DOCUMENT_TYPES[type];
                const active = docType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleSelectType(type)}
                    className={`text-left rounded-xl border p-3.5 transition-all ${
                      active
                        ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-slate-900">{meta.label}</span>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${meta.badgeColor}`}
                      >
                        {meta.shortLabel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{meta.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Copy header from existing document */}
          {existingDocs.length > 0 && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                <Copy className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Salin data Cluster dari dokumen sebelumnya:</span>
              </div>
              <select
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) handleCopyHeaderFrom(e.target.value);
                }}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800"
              >
                <option value="">-- Pilih Dokumen --</option>
                {existingDocs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title} ({d.header.clusterId || d.header.clusterName || d.docType})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Document Title & Cluster Metadata */}
          <div className="space-y-3 pt-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
              2. Nama File & Informasi Header Cluster
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Dokumen / File PDF
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: FOTO CW - CLRMO7-99-021"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Region</label>
                <input
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="Contoh: BLORA"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase placeholder:normal-case focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">OLT Name</label>
                <input
                  type="text"
                  value={oltName}
                  onChange={(e) => setOltName(e.target.value)}
                  placeholder="Contoh: BALUN"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase placeholder:normal-case focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Cluster Name
                </label>
                <input
                  type="text"
                  value={clusterName}
                  onChange={(e) => setClusterName(e.target.value)}
                  placeholder="Contoh: KELURAHAN KAPUAN BLORA"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase placeholder:normal-case focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Cluster ID</label>
                <input
                  type="text"
                  value={clusterId}
                  onChange={(e) => setClusterId(e.target.value)}
                  placeholder="Contoh: CLRMO7-99-021"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase placeholder:normal-case focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Proyek (Header Kiri)
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="EMR FTTH PROJECT"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              {docType !== 'IMPLE' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Kode FDT Halaman Awal
                  </label>
                  <input
                    type="text"
                    value={firstDeviceCode}
                    onChange={(e) => setFirstDeviceCode(e.target.value)}
                    placeholder="Contoh: BLA-CPU-D05"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-blue-50/70 border border-blue-100 px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-blue-900">
            <Layers className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span>
              Halaman pembuka akan dibuatkan otomatis dan Anda bebas menambah, menghapus, atau
              mengubah halaman kapan saja di dalam editor.
            </span>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {submitting ? 'Membuat...' : 'Buat & Buka Editor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
