import React, { useState } from 'react';
import { PlusCircle, X } from 'lucide-react';
import { createDocumentPage } from '../presets/documentPresets';
import { DocumentPage, DocumentType, PagePresetType } from '../types';

interface AddPageModalProps {
  docType: DocumentType;
  existingPagesCount: number;
  defaultFdtCode?: string;
  onAddPages: (pages: DocumentPage[]) => void;
  onClose: () => void;
}

export const AddPageModal: React.FC<AddPageModalProps> = ({
  docType,
  existingPagesCount,
  defaultFdtCode = 'BLA-CPU-D05',
  onAddPages,
  onClose,
}) => {
  const defaultPreset: PagePresetType =
    docType === 'CW'
      ? 'CW_FAT'
      : docType === 'EL'
        ? 'EL_OPM_FAT'
        : 'IMPLE_STANDARD';

  const [preset, setPreset] = useState<PagePresetType>(defaultPreset);
  const [deviceCodesInput, setDeviceCodesInput] = useState<string>(
    docType === 'CW'
      ? `S01-A0${Math.max(1, existingPagesCount)}`
      : docType === 'EL'
        ? 'A01 S01'
        : ''
  );
  const [fdtCode, setFdtCode] = useState<string>(defaultFdtCode || 'BLA-CPU-D41');
  const [splitterNo, setSplitterNo] = useState<number>(1);
  const [startNumber, setStartNumber] = useState<number>(1);
  const [wavelengthMode, setWavelengthMode] = useState<'BOTH' | '1310nm' | '1550nm' | 'CUSTOM'>(
    'BOTH'
  );
  const [customWavelength, setCustomWavelength] = useState<string>('1490nm');
  const [implePageCount, setImplePageCount] = useState<number>(1);

  const handlePresetChange = (next: PagePresetType) => {
    setPreset(next);
    if (next === 'CW_FDT') setDeviceCodesInput(defaultFdtCode || 'BLA-CPU-D05');
    if (next === 'CW_FAT') setDeviceCodesInput(`S01-A0${Math.max(1, existingPagesCount)}`);
    if (next === 'EL_INPUT_SPLITTER' || next === 'EL_OUTPUT_SPLITTER') {
      setDeviceCodesInput(defaultFdtCode || 'BLA-CPU-D41');
    }
    if (next === 'EL_OPM_FAT') {
      setDeviceCodesInput('A01 S01');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newPages: DocumentPage[] = [];

    if (docType === 'IMPLE') {
      const count = Math.min(30, Math.max(1, implePageCount));
      for (let i = 0; i < count; i++) {
        newPages.push(createDocumentPage({ preset: 'IMPLE_STANDARD' }));
      }
      onAddPages(newPages);
      onClose();
      return;
    }

    if (docType === 'CW') {
      const codes = deviceCodesInput
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const effectiveCodes = codes.length > 0 ? codes : [preset === 'CW_FDT' ? 'BLA-CPU-D05' : 'S01-A01'];
      for (const code of effectiveCodes) {
        newPages.push(
          createDocumentPage({
            preset,
            deviceCode: code,
          })
        );
      }
      onAddPages(newPages);
      onClose();
      return;
    }

    // docType === 'EL'
    const wavelengths =
      wavelengthMode === 'BOTH'
        ? ['1310nm', '1550nm']
        : wavelengthMode === 'CUSTOM'
          ? [customWavelength.trim() || '1310nm']
          : [wavelengthMode];

    if (preset === 'EL_OPM_FAT') {
      const fatCodes = deviceCodesInput
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const effectiveFats = fatCodes.length > 0 ? fatCodes : ['A01 S01'];
      for (const code of effectiveFats) {
        for (const wl of wavelengths) {
          newPages.push(
            createDocumentPage({
              preset: 'EL_OPM_FAT',
              deviceCode: code,
              wavelength: wl,
              startNumber,
            })
          );
        }
      }
    } else if (preset === 'EL_OUTPUT_SPLITTER') {
      for (const wl of wavelengths) {
        newPages.push(
          createDocumentPage({
            preset: 'EL_OUTPUT_SPLITTER',
            deviceCode: fdtCode,
            splitterNumber: splitterNo,
            wavelength: wl,
            startNumber,
          })
        );
      }
    } else {
      for (const wl of wavelengths) {
        newPages.push(
          createDocumentPage({
            preset: 'EL_INPUT_SPLITTER',
            deviceCode: fdtCode,
            wavelength: wl,
            startNumber,
          })
        );
      }
    }

    onAddPages(newPages);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-slate-50">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">Tambah Halaman Baru</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {docType === 'CW' && (
            <>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                  Tipe Halaman FOTO CW
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handlePresetChange('CW_FAT')}
                    className={`rounded-xl border p-3 text-left ${
                      preset === 'CW_FAT'
                        ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold text-sm text-slate-900">FAT (6 Kotak)</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">FAT Tertutup, Terbuka, Pole...</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetChange('CW_FDT')}
                    className={`rounded-xl border p-3 text-left ${
                      preset === 'CW_FDT'
                        ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold text-sm text-slate-900">FDT (6 Kotak)</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">FDT Tertutup, Terbuka, Pole...</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {preset === 'CW_FAT'
                    ? 'Kode FAT (bisa ketik 1 kode, atau banyak kode dipisah koma/baris baru)'
                    : 'Kode FDT'}
                </label>
                <textarea
                  rows={preset === 'CW_FAT' ? 3 : 2}
                  required
                  value={deviceCodesInput}
                  onChange={(e) => setDeviceCodesInput(e.target.value)}
                  placeholder={
                    preset === 'CW_FAT'
                      ? 'Contoh: S01-A01\natau sekaligus: S01-A01, S01-A02, S01-A03'
                      : 'Contoh: BLA-CPU-D05'
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>
            </>
          )}

          {docType === 'EL' && (
            <>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                  Tipe Halaman FOTO EL
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    {
                      id: 'EL_INPUT_SPLITTER' as PagePresetType,
                      title: 'Input Splitter FDT (4 Kotak)',
                      sub: 'Splitter 1 s/d Splitter 4',
                    },
                    {
                      id: 'EL_OUTPUT_SPLITTER' as PagePresetType,
                      title: 'Output Splitter FDT (8 Kotak)',
                      sub: 'Port 1 s/d Port 8 per Splitter',
                    },
                    {
                      id: 'EL_OPM_FAT' as PagePresetType,
                      title: 'OPM FAT (8 Kotak)',
                      sub: 'Port 1 s/d Port 8 per FAT',
                    },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handlePresetChange(item.id)}
                      className={`rounded-xl border p-3 text-left ${
                        preset === item.id
                          ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-bold text-sm text-slate-900">{item.title}</div>
                      <div className="text-xs text-slate-500">{item.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {preset === 'EL_OPM_FAT' ? (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Kode FAT (bisa 1 kode atau beberapa dipisah koma/baris baru)
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={deviceCodesInput}
                    onChange={(e) => setDeviceCodesInput(e.target.value)}
                    placeholder="Contoh: A01 S01 (atau A01 S01, A02 S01)"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className={preset === 'EL_OUTPUT_SPLITTER' ? '' : 'col-span-2'}>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Kode FDT</label>
                    <input
                      type="text"
                      required
                      value={fdtCode}
                      onChange={(e) => setFdtCode(e.target.value)}
                      placeholder="BLA-CPU-D41"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  {preset === 'EL_OUTPUT_SPLITTER' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Splitter Ke-
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={32}
                        value={splitterNo}
                        onChange={(e) => setSplitterNo(Number(e.target.value) || 1)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Panjang Gelombang (λ)
                  </label>
                  <select
                    value={wavelengthMode}
                    onChange={(e) =>
                      setWavelengthMode(e.target.value as typeof wavelengthMode)
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  >
                    <option value="BOTH">Buat Pasangan 1310nm & 1550nm Sekaligus (2 Hal)</option>
                    <option value="1310nm">Hanya 1310nm (1 Hal)</option>
                    <option value="1550nm">Hanya 1550nm (1 Hal)</option>
                    <option value="CUSTOM">Kustom (misal 1490nm)</option>
                  </select>
                </div>
                {wavelengthMode === 'CUSTOM' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Teks Gelombang
                    </label>
                    <input
                      type="text"
                      value={customWavelength}
                      onChange={(e) => setCustomWavelength(e.target.value)}
                      placeholder="1490nm"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Mulai Nomor Urut
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={64}
                    value={startNumber}
                    onChange={(e) => setStartNumber(Number(e.target.value) || 1)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </>
          )}

          {docType === 'IMPLE' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Jumlah Halaman Implementasi (10 Kotak per Halaman)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={implePageCount}
                onChange={(e) => setImplePageCount(Number(e.target.value) || 1)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
              <p className="text-xs text-slate-500 mt-1.5">
                Berisi masing-masing 2 kotak untuk Digging Pole, Instal Pole, Pulling Cable, Instal
                Accessories, dan Concrete Pole.
              </p>
            </div>
          )}

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
              Tambahkan Halaman
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
