import React, { useEffect, useState } from 'react';
import { Cloud, CheckCircle2, AlertCircle, RefreshCw, X, FolderCheck, HardDrive } from 'lucide-react';
import { getNextcloudStatus } from '../services/apiSync';
import { getApiBaseUrl } from '../services/serverUrl';

interface NextcloudModalProps {
  onClose: () => void;
}

export const NextcloudModal: React.FC<NextcloudModalProps> = ({ onClose }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [testing, setTesting] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [status, setStatus] = useState<{
    configured: boolean;
    serverUrl: string | null;
    username: string | null;
    baseDir: string;
    queue: { pending: number; synced: number; failed: number };
  } | null>(null);

  const loadStatus = async () => {
    setLoading(true);
    setStatusError(null);
    try {
      const data = await getNextcloudStatus();
      setStatus(data);
    } catch (err) {
      setStatus(null);
      setStatusError(err instanceof Error ? err.message : 'Tidak dapat menghubungi server aplikasi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/nextcloud/test`, { method: 'POST' });
      const data = await res.json();
      setTestResult(data);
      await loadStatus();
    } catch (err: any) {
      setTestResult({ success: false, message: err?.message || 'Gagal menghubungi server' });
    } finally {
      setTesting(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      await fetch(`${getApiBaseUrl()}/api/nextcloud/sync-now`, { method: 'POST' });
      await loadStatus();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <Cloud className="w-5 h-5 text-sky-400" />
            <h3 className="text-base font-bold">Integrasi Penyimpanan Nextcloud</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {loading ? (
            <div className="py-8 text-center text-sm text-slate-500">Memeriksa status Nextcloud...</div>
          ) : statusError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
              <h4 className="text-sm font-bold">Server Photo QC tidak dapat dijangkau</h4>
              <p className="mt-1 text-xs">
                Status Nextcloud belum bisa diperiksa ({statusError}). Pastikan backend berjalan dan
                VITE_API_URL di Vercel mengarah ke URL backend, lalu deploy ulang frontend.
              </p>
            </div>
          ) : (
            <>
              {/* Status Banner */}
              <div
                className={`rounded-xl p-4 border flex items-start gap-3 ${
                  status?.configured
                    ? 'bg-sky-50 border-sky-200 text-sky-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                {status?.configured ? (
                  <CheckCircle2 className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="text-sm font-bold">
                    {status?.configured ? 'Koneksi Nextcloud Dikonfigurasi' : 'Nextcloud Belum Dikonfigurasi di Server'}
                  </h4>
                  <p className="text-xs text-slate-600 mt-1">
                    {status?.configured
                      ? `Semua foto yang diambil teknisi di lapangan akan otomatis dikirim dan disimpan rapi ke folder: ${status.baseDir}`
                      : 'Untuk menghubungkan server ke Nextcloud, atur NEXTCLOUD_URL, NEXTCLOUD_USERNAME, dan NEXTCLOUD_PASSWORD pada file .env di server.'}
                  </p>
                </div>
              </div>

              {/* Server Info */}
              {status?.configured && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nextcloud URL:</span>
                    <span className="font-semibold text-slate-800">{status.serverUrl}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Akun Pengguna:</span>
                    <span className="font-semibold text-slate-800">{status.username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Folder Induk:</span>
                    <span className="font-semibold text-slate-800">{status.baseDir}</span>
                  </div>
                </div>
              )}

              {/* Queue Statistics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200 p-3 text-center">
                  <div className="text-2xl font-black text-amber-600">{status?.queue.pending ?? 0}</div>
                  <div className="text-[11px] font-medium text-slate-500 mt-1">Antrean Upload</div>
                </div>
                <div className="rounded-xl border border-slate-200 p-3 text-center">
                  <div className="text-2xl font-black text-emerald-600">{status?.queue.synced ?? 0}</div>
                  <div className="text-[11px] font-medium text-slate-500 mt-1">Tersinkron Cloud</div>
                </div>
                <div className="rounded-xl border border-slate-200 p-3 text-center">
                  <div className="text-2xl font-black text-rose-600">{status?.queue.failed ?? 0}</div>
                  <div className="text-[11px] font-medium text-slate-500 mt-1">Gagal / Retry</div>
                </div>
              </div>

              {testResult && (
                <div
                  className={`rounded-xl p-3 text-xs font-medium border ${
                    testResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {testResult.message}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing || !status?.configured}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
                >
                  <FolderCheck className="w-4 h-4 text-sky-600" />
                  {testing ? 'Menguji...' : 'Tes Koneksi WebDAV'}
                </button>

                <button
                  type="button"
                  onClick={handleSyncNow}
                  disabled={syncing || !status?.configured}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-sky-700 transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Memproses...' : 'Sinkronkan Sekarang'}
                </button>
              </div>

              {/* Instructions */}
              <div className="border-t border-slate-200 pt-3 text-[11px] text-slate-500 space-y-1">
                <p className="font-semibold text-slate-700">Format Folder di Nextcloud:</p>
                <code className="block rounded-lg bg-slate-100 p-2 text-slate-800 text-[10px] break-all">
                  {status?.baseDir || '/PhotoQC'}/[ClusterId]_[ClusterName]/[DocTitle]/photos/[NamaFoto].jpg
                </code>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-900 transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
