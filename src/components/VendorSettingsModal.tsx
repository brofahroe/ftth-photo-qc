import React, { useEffect, useState } from 'react';
import { Building2, RotateCcw, Upload, X } from 'lucide-react';
import { DEFAULT_MORA_LOGO, DEFAULT_ZTE_LOGO } from '../assets/defaultLogos';
import { getGlobalSettings, saveGlobalSettings } from '../db/database';
import { DocumentHeader } from '../types';

interface VendorSettingsModalProps {
  /** If passed, edits specific document header logos; otherwise edits global defaults */
  documentHeader?: DocumentHeader;
  onSaveDocumentHeader?: (patch: Partial<DocumentHeader>) => void;
  onClose: () => void;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const VendorSettingsModal: React.FC<VendorSettingsModalProps> = ({
  documentHeader,
  onSaveDocumentHeader,
  onClose,
}) => {
  const [projectName, setProjectName] = useState(
    documentHeader?.projectName || 'EMR FTTH PROJECT'
  );
  const [leftLogo, setLeftLogo] = useState<string | null>(
    documentHeader?.customLeftLogoDataUrl ?? null
  );
  const [rightLogo, setRightLogo] = useState<string | null>(
    documentHeader?.customRightLogoDataUrl ?? null
  );
  const [hideRightLogo, setHideRightLogo] = useState<boolean>(
    documentHeader?.hideRightLogo ?? false
  );
  const [loading, setLoading] = useState(!documentHeader);

  useEffect(() => {
    if (!documentHeader) {
      getGlobalSettings().then((s) => {
        setProjectName(s.defaultProjectName || 'EMR FTTH PROJECT');
        setLeftLogo(s.defaultLeftLogoDataUrl ?? null);
        setRightLogo(s.defaultRightLogoDataUrl ?? null);
        setHideRightLogo(s.hideRightLogo ?? false);
        setLoading(false);
      });
    }
  }, [documentHeader]);

  const handleUploadLogo = async (side: 'left' | 'right', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    if (side === 'left') setLeftLogo(dataUrl);
    else setRightLogo(dataUrl);
    e.target.value = '';
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (documentHeader && onSaveDocumentHeader) {
      onSaveDocumentHeader({
        projectName: projectName.trim() || 'EMR FTTH PROJECT',
        customLeftLogoDataUrl: leftLogo,
        customRightLogoDataUrl: rightLogo,
        hideRightLogo,
      });
    } else {
      await saveGlobalSettings({
        defaultProjectName: projectName.trim() || 'EMR FTTH PROJECT',
        defaultLeftLogoDataUrl: leftLogo,
        defaultRightLogoDataUrl: rightLogo,
        hideRightLogo,
      });
    }
    onClose();
  };

  if (loading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-slate-800 p-2 text-white">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {documentHeader ? 'Logo & Nama Proyek Dokumen Ini' : 'Pengaturan Default Logo & Proyek'}
              </h2>
              <p className="text-xs text-slate-500">
                Default menggunakan logo resmi ZTE & MoraRepublic sesuai sample
              </p>
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

        <form onSubmit={handleSave} className="p-5 space-y-4">
          {/* Live Header Box Preview */}
          <div>
            <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Preview Kotak Kiri Header PDF
            </span>
            <div className="border-2 border-slate-900 bg-white w-64 mx-auto">
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-900 h-14 gap-2">
                <img
                  src={leftLogo || DEFAULT_ZTE_LOGO}
                  alt="Left Logo"
                  className={`max-h-8 object-contain ${hideRightLogo ? 'mx-auto max-w-full' : 'max-w-[42%]'}`}
                />
                {!hideRightLogo && (
                  <img
                    src={rightLogo || DEFAULT_MORA_LOGO}
                    alt="Right Logo"
                    className="max-h-8 max-w-[54%] object-contain"
                  />
                )}
              </div>
              <div className="py-1.5 px-2 text-center font-bold text-xs text-slate-900 truncate">
                {projectName || 'EMR FTTH PROJECT'}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Teks Nama Proyek
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="EMR FTTH PROJECT"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Logo Kiri (Default: ZTE)</span>
                {leftLogo && (
                  <button
                    type="button"
                    onClick={() => setLeftLogo(null)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                )}
              </div>
              <label className="flex items-center justify-center gap-1.5 cursor-pointer rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100">
                <Upload className="w-3.5 h-3.5" />
                Ganti Logo Kiri
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleUploadLogo('left', e)}
                  className="hidden"
                />
              </label>
            </div>

            <div className="rounded-xl border border-slate-200 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  Logo Kanan (MoraRepublic)
                </span>
                {rightLogo && (
                  <button
                    type="button"
                    onClick={() => setRightLogo(null)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                )}
              </div>
              <label
                className={`flex items-center justify-center gap-1.5 cursor-pointer rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 ${
                  hideRightLogo ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                Ganti Logo Kanan
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleUploadLogo('right', e)}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideRightLogo}
              onChange={(e) => setHideRightLogo(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
            />
            <span>Hanya gunakan 1 logo di tengah (sembunyikan logo kanan)</span>
          </label>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Batal
            </button>
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Simpan Pengaturan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
