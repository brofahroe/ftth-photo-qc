import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Database,
  Download,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  addSiteReferenceItem,
  db,
  deleteSiteReferenceItem,
  ensureSiteReferencesSeeded,
  importSiteReferencesFromCsvText,
  resetSiteReferencesToDefault,
  updateSiteReferenceItem,
} from '../db/database';
import {
  buildSiteReferenceLookups,
  DEFAULT_SITE_REFERENCES,
  exportSiteListToCsv,
} from '../presets/siteReferences';
import { SiteReferenceItem } from '../types';

interface SiteReferenceModalProps {
  onClose: () => void;
  onSelectSite?: (site: SiteReferenceItem) => void;
}

type SortField =
  | 'fdtId'
  | 'clusterId'
  | 'clusterName'
  | 'region'
  | 'kecamatan'
  | 'oltName'
  | 'hpDrm';

type SortDirection = 'asc' | 'desc';

const SORTABLE_COLUMNS: Array<{
  field: SortField;
  label: string;
  align?: 'left' | 'right';
}> = [
  { field: 'fdtId', label: 'Coding FDT (FDT ID)' },
  { field: 'clusterId', label: 'Cluster ID' },
  { field: 'clusterName', label: 'Cluster Name' },
  { field: 'region', label: 'Region' },
  { field: 'kecamatan', label: 'Kecamatan' },
  { field: 'oltName', label: 'OLT Name' },
  { field: 'hpDrm', label: 'HP DRM', align: 'right' },
];

export const SiteReferenceModal: React.FC<SiteReferenceModalProps> = ({
  onClose,
  onSelectSite,
}) => {
  useEffect(() => {
    ensureSiteReferencesSeeded();
  }, []);

  const dbSites = useLiveQuery(
    () => db.siteReferences.toArray(),
    [],
    DEFAULT_SITE_REFERENCES
  );

  const sites = dbSites.length > 0 ? dbSites : DEFAULT_SITE_REFERENCES;
  const lookups = buildSiteReferenceLookups(sites);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [editingSite, setEditingSite] = useState<SiteReferenceItem | null>(null);

  // Add row state
  const [newClusterId, setNewClusterId] = useState<string>('');
  const [newClusterName, setNewClusterName] = useState<string>('');
  const [newRegion, setNewRegion] = useState<string>('BLORA');
  const [newKecamatan, setNewKecamatan] = useState<string>('Cepu');
  const [newInitial, setNewInitial] = useState<string>('CPU');
  const [newFdtNo, setNewFdtNo] = useState<string>('');
  const [newHpDrm, setNewHpDrm] = useState<string>('');
  const [newFdtId, setNewFdtId] = useState<string>('');
  const [newOltName, setNewOltName] = useState<string>('BALUN');

  const csvInputRef = useRef<HTMLInputElement | null>(null);

  const clearForm = () => {
    setNewClusterId('');
    setNewClusterName('');
    setNewFdtNo('');
    setNewHpDrm('');
    setNewFdtId('');
    setNewRegion('BLORA');
    setNewKecamatan('Cepu');
    setNewInitial('CPU');
    setNewOltName('BALUN');
  };

  const handleEditRow = (site: SiteReferenceItem) => {
    setEditingSite(site);
    setNewClusterId(site.clusterId);
    setNewClusterName(site.clusterName);
    setNewRegion(site.region);
    setNewKecamatan(site.kecamatan);
    setNewInitial(site.clusterInitial);
    setNewFdtNo(site.fdtNo);
    setNewHpDrm(site.hpDrm);
    setNewFdtId(site.fdtId);
    setNewOltName(site.oltName);
    setShowAddForm(true);
  };

  const handleToggleSort = (field: SortField) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortField(null);
      setSortDir('asc');
    }
  };

  const filteredSites = useMemo(() => {
    const filtered = sites.filter((s) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        s.clusterId.toLowerCase().includes(q) ||
        s.clusterName.toLowerCase().includes(q) ||
        s.fdtId.toLowerCase().includes(q) ||
        s.region.toLowerCase().includes(q) ||
        s.kecamatan.toLowerCase().includes(q) ||
        s.oltName.toLowerCase().includes(q)
      );
    });

    if (!sortField) return filtered;

    return [...filtered].sort((a, b) => {
      const rawA = (a[sortField] || '').trim();
      const rawB = (b[sortField] || '').trim();

      // Always push empty values to the bottom
      if (!rawA && !rawB) return 0;
      if (!rawA) return 1;
      if (!rawB) return -1;

      const cmp = rawA.localeCompare(rawB, 'id', {
        numeric: true,
        sensitivity: 'base',
      });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [sites, searchQuery, sortField, sortDir]);

  const handleAddRow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClusterId.trim() && !newClusterName.trim() && !newFdtId.trim()) {
      return;
    }
    const siteData = {
      clusterId: newClusterId.trim().toUpperCase(),
      clusterName: newClusterName.trim().toUpperCase(),
      region: newRegion.trim().toUpperCase(),
      kecamatan: newKecamatan.trim(),
      clusterInitial: newInitial.trim().toUpperCase(),
      fdtNo: newFdtNo.trim().toUpperCase(),
      hpDrm: newHpDrm.trim(),
      fdtId: newFdtId.trim().toUpperCase(),
      oltName: newOltName.trim().toUpperCase(),
    };
    if (editingSite) {
      await updateSiteReferenceItem({ ...siteData, id: editingSite.id });
      setEditingSite(null);
    } else {
      await addSiteReferenceItem(siteData);
    }
    clearForm();
    setShowAddForm(false);
  };

  const handleImportCsvFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const count = await importSiteReferencesFromCsvText(text, 'REPLACE');
      alert(`Berhasil memuat ${count} baris data site dari file CSV.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal membaca file CSV.');
    } finally {
      e.target.value = '';
    }
  };

  const handleDownloadCsv = () => {
    const csv = exportSiteListToCsv(sites);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Sitelist.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const handleResetDefault = async () => {
    if (
      !confirm(
        'Kembalikan tabel referensi site ke data bawaan Sitelist.csv (58 baris)?'
      )
    ) {
      return;
    }
    await resetSiteReferencesToDefault();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
      <div className="w-full max-w-5xl max-h-[90vh] rounded-3xl bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950 text-white px-5 py-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-blue-600/90 border border-blue-400/30 flex items-center justify-center shadow-md shrink-0">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
                Tabel Referensi Data Site (Sitelist)
              </h2>
              <p className="text-xs text-slate-300">
                {sites.length} Baris FDT/Site • {lookups.clusters.length} Cluster Unik •{' '}
                {lookups.fdtList.length} Kode FDT Aktif
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white/10 p-2 text-slate-200 hover:bg-white/20 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari Cluster ID, Kelurahan, atau Kode FDT (BLA-CPU)..."
              className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (showAddForm && !editingSite) {
                  setShowAddForm(false);
                  return;
                }
                setEditingSite(null);
                clearForm();
                setShowAddForm(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
            >
              <Plus className="w-4 h-4" />
              Tambah Baris Site
            </button>

            <button
              type="button"
              onClick={() => csvInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              <Upload className="w-4 h-4 text-blue-600" />
              Impor CSV
            </button>

            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              Unduh CSV
            </button>

            <button
              type="button"
              onClick={handleResetDefault}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              title="Kembalikan ke Sitelist.csv bawaan"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Default
            </button>

            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleImportCsvFile}
              className="hidden"
            />
          </div>
        </div>

        {/* Add or edit site form */}
        {showAddForm && (
          <form
            onSubmit={handleAddRow}
            className="border-b border-blue-200 bg-blue-50/50 px-5 py-3.5 space-y-3 shrink-0"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-950 uppercase tracking-wider">
                {editingSite
                  ? 'Edit Data Site / FDT'
                  : 'Tambah Data Site / FDT Baru ke Tabel Referensi'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingSite(null);
                  clearForm();
                }}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Tutup Form
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                  Cluster ID *
                </label>
                <input
                  type="text"
                  required
                  value={newClusterId}
                  onChange={(e) => setNewClusterId(e.target.value)}
                  placeholder="CLRM07-99-021"
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs uppercase"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                  Cluster Name *
                </label>
                <input
                  type="text"
                  required
                  value={newClusterName}
                  onChange={(e) => setNewClusterName(e.target.value)}
                  placeholder="KELURAHAN KAPUAN BLORA"
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs uppercase"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                  Coding FDT (FDT ID)
                </label>
                <input
                  type="text"
                  value={newFdtId}
                  onChange={(e) => setNewFdtId(e.target.value)}
                  placeholder="BLA-CPU-D05"
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs uppercase"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                  OLT Name
                </label>
                <input
                  type="text"
                  value={newOltName}
                  onChange={(e) => setNewOltName(e.target.value)}
                  placeholder="BALUN"
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs uppercase"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                  Region
                </label>
                <input
                  type="text"
                  value={newRegion}
                  onChange={(e) => setNewRegion(e.target.value)}
                  placeholder="BLORA"
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs uppercase"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                  Kecamatan
                </label>
                <input
                  type="text"
                  value={newKecamatan}
                  onChange={(e) => setNewKecamatan(e.target.value)}
                  placeholder="Cepu"
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                  No. FDT / Inisial
                </label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={newInitial}
                    onChange={(e) => setNewInitial(e.target.value)}
                    placeholder="CPU"
                    className="w-1/2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs uppercase"
                  />
                  <input
                    type="text"
                    value={newFdtNo}
                    onChange={(e) => setNewFdtNo(e.target.value)}
                    placeholder="D05"
                    className="w-1/2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs uppercase"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                  HP DRM
                </label>
                <input
                  type="text"
                  value={newHpDrm}
                  onChange={(e) => setNewHpDrm(e.target.value)}
                  placeholder="336"
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                >
                  {editingSite ? 'Simpan Perubahan' : 'Simpan Site'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Table Body */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 border-b border-slate-200">
              <tr>
                {SORTABLE_COLUMNS.map((col) => {
                  const isActive = sortField === col.field;
                  const ariaSort = isActive
                    ? sortDir === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none';

                  return (
                    <th
                      key={col.field}
                      aria-sort={ariaSort}
                      className={`py-2 px-3 font-bold ${
                        col.align === 'right' ? 'text-right' : 'text-left'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleSort(col.field)}
                        title={`Urutkan berdasarkan ${col.label}`}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 -mx-1.5 transition select-none ${
                          isActive
                            ? 'bg-blue-100/80 text-blue-800 font-extrabold'
                            : 'hover:bg-slate-200/70 text-slate-700'
                        }`}
                      >
                        <span>{col.label}</span>
                        {isActive ? (
                          sortDir === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                      </button>
                    </th>
                  );
                })}
                <th className="py-2.5 px-3 font-bold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSites.map((site) => (
                <tr
                  key={site.id}
                  className="hover:bg-blue-50/50 transition"
                >
                  <td className="py-2 px-3 font-bold text-blue-700 whitespace-nowrap">
                    {site.fdtId || (
                      <span className="text-slate-400 font-normal italic">
                        — Belum ada FDT —
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 font-semibold text-slate-800 whitespace-nowrap">
                    {site.clusterId}
                  </td>
                  <td className="py-2 px-3 font-medium text-slate-900">
                    {site.clusterName}
                  </td>
                  <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                    {site.region}
                  </td>
                  <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                    {site.kecamatan}
                  </td>
                  <td className="py-2 px-3 text-slate-700 font-medium whitespace-nowrap">
                    {site.oltName || '—'}
                  </td>
                  <td className="py-2 px-3 text-slate-600 text-right whitespace-nowrap">
                    {site.hpDrm || '—'}
                  </td>
                  <td className="py-2 px-3 text-center whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleEditRow(site)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                        title="Edit baris ini"
                        aria-label={`Edit ${site.clusterName}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {onSelectSite && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectSite(site);
                            onClose();
                          }}
                          className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-blue-700"
                        >
                          Pilih Site Ini
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteSiteReferenceItem(site.id)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Hapus baris ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSites.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Tidak ada data site yang cocok dengan pencarian "{searchQuery}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 flex items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-slate-500">
            Sumber referensi: <code>Sample/Sitelist.csv</code> • Perubahan disimpan di database
            lokal perangkat
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
