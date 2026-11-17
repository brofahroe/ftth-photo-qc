import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { SyncConflict } from '../types';

interface SyncConflictModalProps {
  conflicts: SyncConflict[];
  resolvingId: string | null;
  onResolve: (documentId: string, resolution: 'local' | 'server') => void;
  onClose: () => void;
}

function formatUpdatedAt(timestamp: number): string {
  return new Date(timestamp).toLocaleString('id-ID');
}

export const SyncConflictModal: React.FC<SyncConflictModalProps> = ({
  conflicts,
  resolvingId,
  onResolve,
  onClose,
}) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
    <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-200 bg-amber-50 px-5 py-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <h2 className="font-bold text-slate-900">Konflik Sinkronisasi</h2>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-white">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
        <p className="text-sm text-slate-600">
          Dokumen ini berubah di PC dan server sejak sinkronisasi terakhir. Kedua salinan dipertahankan;
          pilih versi yang akan digunakan untuk melanjutkan sinkronisasi.
        </p>
        {conflicts.length === 0 ? (
          <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
            Semua konflik sudah ditangani.
          </div>
        ) : (
          conflicts.map((conflict) => {
            const busy = resolvingId === conflict.documentId;
            return (
              <section key={conflict.documentId} className="rounded-xl border border-amber-200 p-4">
                <h3 className="font-bold text-slate-900">{conflict.localDocument.title}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {conflict.localDocument.header.clusterId || 'Tanpa Cluster ID'}
                </p>
                <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="font-bold text-slate-700">Versi PC</p>
                    <p className="mt-1 text-slate-500">
                      Diperbarui: {formatUpdatedAt(conflict.localDocument.updatedAt)}
                    </p>
                    <p className="text-slate-500">{conflict.localDocument.pages.length} halaman</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="font-bold text-slate-700">Versi Server</p>
                    <p className="mt-1 text-slate-500">
                      Diperbarui: {formatUpdatedAt(conflict.serverDocument.updatedAt)}
                    </p>
                    <p className="text-slate-500">{conflict.serverDocument.pages.length} halaman</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onResolve(conflict.documentId, 'server')}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {busy ? 'Menyimpan...' : 'Gunakan versi server'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onResolve(conflict.documentId, 'local')}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {busy ? 'Menyimpan...' : 'Gunakan versi PC'}
                  </button>
                </div>
              </section>
            );
          })
        )}
      </div>

      <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-900"
        >
          Tutup
        </button>
      </div>
    </div>
  </div>
);
