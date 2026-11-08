import React, { useEffect, useState } from 'react';
import { Check, Compass, Loader2, MapPin, Search, Sparkles, X } from 'lucide-react';
import {
  formatWatermarkCoords,
  formatWatermarkTimestamp,
  getCurrentGpsPosition,
  parseCoordinateString,
  reverseGeocodeAddress,
  toDatetimeLocalInput,
} from '../services/geolocation';
import { renderWatermarkedPhoto } from '../services/watermark';
import { PhotoRecord, WatermarkData } from '../types';

interface WatermarkEditorModalProps {
  record: PhotoRecord;
  slotDescription: string;
  pagePhotosCount: number;
  onSaveSingle: (watermarkEnabled: boolean, watermark: WatermarkData) => Promise<void>;
  onSaveAllInPage: (
    watermarkEnabled: boolean,
    watermark: WatermarkData,
    syncTimestamp: boolean
  ) => Promise<void>;
  onClose: () => void;
}

export const WatermarkEditorModal: React.FC<WatermarkEditorModalProps> = ({
  record,
  slotDescription,
  pagePhotosCount,
  onSaveSingle,
  onSaveAllInPage,
  onClose,
}) => {
  const [enabled, setEnabled] = useState<boolean>(record.watermarkEnabled);
  const [datetimeLocal, setDatetimeLocal] = useState<string>(() =>
    toDatetimeLocalInput(record.watermark.isoTimestamp || record.watermark.timestampText)
  );
  const [timestampText, setTimestampText] = useState<string>(
    record.watermark.timestampText || formatWatermarkTimestamp(new Date())
  );
  const [coordInput, setCoordInput] = useState<string>(record.watermark.coordText || '');
  const [latitude, setLatitude] = useState<number | undefined>(record.watermark.latitude);
  const [longitude, setLongitude] = useState<number | undefined>(record.watermark.longitude);
  const [addressText, setAddressText] = useState<string>(
    (record.watermark.addressLines || []).join('\n')
  );
  const [syncTimestampOnAll, setSyncTimestampOnAll] = useState<boolean>(false);

  const [previewDataUrl, setPreviewDataUrl] = useState<string>('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>('');

  const buildCurrentWatermarkObject = (): WatermarkData => {
    const parsed = parseCoordinateString(coordInput);
    const effectiveLat = parsed ? parsed.lat : latitude;
    const effectiveLon = parsed ? parsed.lon : longitude;
    const formattedCoord = parsed
      ? formatWatermarkCoords(parsed.lat, parsed.lon)
      : coordInput.trim();

    return {
      timestampText: timestampText.trim(),
      isoTimestamp: datetimeLocal ? new Date(datetimeLocal).toISOString() : undefined,
      latitude: effectiveLat,
      longitude: effectiveLon,
      coordText: formattedCoord,
      addressLines: addressText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    };
  };

  // Live render preview whenever fields change (debounced)
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const wm = buildCurrentWatermarkObject();
        const res = await renderWatermarkedPhoto({
          rawBlob: record.rawBlob,
          rotation: record.rotation,
          watermarkEnabled: enabled,
          watermark: wm,
          maxLongEdge: 900,
          jpegQuality: 0.78,
        });
        if (!cancelled) {
          setPreviewDataUrl(res.dataUrl);
        }
      } catch {
        // Ignore preview error
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, timestampText, coordInput, addressText, record.rawBlob, record.rotation]);

  const handleDatetimePickerChange = (val: string) => {
    setDatetimeLocal(val);
    if (val) {
      const d = new Date(val);
      if (!Number.isNaN(d.getTime())) {
        setTimestampText(formatWatermarkTimestamp(d));
      }
    }
  };

  const handleFetchLiveGps = async () => {
    setGpsLoading(true);
    setStatusMsg('');
    try {
      const pos = await getCurrentGpsPosition(10000);
      setLatitude(pos.latitude);
      setLongitude(pos.longitude);
      const formatted = formatWatermarkCoords(pos.latitude, pos.longitude);
      setCoordInput(formatted);
      const lines = await reverseGeocodeAddress(pos.latitude, pos.longitude);
      if (lines.length > 0) {
        setAddressText(lines.join('\n'));
      }
      setStatusMsg(`GPS didapat (±${Math.round(pos.accuracy)}m)`);
    } catch {
      setStatusMsg('Gagal mengambil GPS perangkat. Pastikan izin lokasi aktif.');
    } finally {
      setGpsLoading(false);
    }
  };

  const handleLookupAddress = async () => {
    const parsed = parseCoordinateString(coordInput);
    if (!parsed) {
      setStatusMsg('Format koordinat tidak dikenali. Contoh: -8.0942, 112.6465 atau 8.0942S 112.6465E');
      return;
    }
    setGeocodeLoading(true);
    setStatusMsg('');
    try {
      setLatitude(parsed.lat);
      setLongitude(parsed.lon);
      setCoordInput(formatWatermarkCoords(parsed.lat, parsed.lon));
      const lines = await reverseGeocodeAddress(parsed.lat, parsed.lon);
      if (lines.length > 0) {
        setAddressText(lines.join('\n'));
        setStatusMsg('Alamat berhasil ditemukan dari titik koordinat.');
      } else {
        setStatusMsg('Alamat detail belum ditemukan (cek koneksi internet), silakan ketik manual.');
      }
    } finally {
      setGeocodeLoading(false);
    }
  };

  const handleSaveOne = async () => {
    setSaving(true);
    try {
      await onSaveSingle(enabled, buildCurrentWatermarkObject());
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await onSaveAllInPage(enabled, buildCurrentWatermarkObject(), syncTimestampOnAll);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-3 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 my-auto overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 bg-slate-50">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Pengaturan Watermark — {slotDescription}
              </h2>
              <p className="text-xs text-slate-500">
                Non-destruktif: mematikan atau mengedit watermark tidak merusak foto asli
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

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 sm:p-5 max-h-[84vh] overflow-y-auto">
          {/* Left Preview */}
          <div className="md:col-span-5 flex flex-col items-center justify-center rounded-xl bg-slate-900 p-3 min-h-60">
            {previewDataUrl ? (
              <img
                src={previewDataUrl}
                alt="Preview Watermark"
                className="max-h-80 w-auto object-contain rounded-lg shadow-md"
              />
            ) : (
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Memuat preview...
              </div>
            )}
            <span className="mt-2 text-[11px] text-slate-400">
              Preview posisi kanan bawah seperti FOTO CW.pdf
            </span>
          </div>

          {/* Right Form */}
          <div className="md:col-span-7 space-y-3.5">
            <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 cursor-pointer">
              <div>
                <div className="text-sm font-bold text-slate-900">Pasang Watermark Aplikasi</div>
                <div className="text-xs text-slate-500">
                  Matikan jika foto kiriman sudah memiliki watermark bawaan kamera
                </div>
              </div>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
            </label>

            <div className={enabled ? 'space-y-3.5' : 'space-y-3.5 opacity-50 pointer-events-none'}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Pilih Kalender & Jam
                  </label>
                  <input
                    type="datetime-local"
                    value={datetimeLocal}
                    onChange={(e) => handleDatetimePickerChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Teks Timestamp di Foto
                  </label>
                  <input
                    type="text"
                    value={timestampText}
                    onChange={(e) => setTimestampText(e.target.value)}
                    placeholder="30-Dec-2025 15:44"
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-mono focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-700">
                    Koordinat GPS (bisa paste dari Google Maps: -6.9688, 111.4182)
                  </label>
                  <button
                    type="button"
                    onClick={handleFetchLiveGps}
                    disabled={gpsLoading}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    {gpsLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Compass className="w-3.5 h-3.5" />
                    )}
                    Ambil GPS Sekarang
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={coordInput}
                    onChange={(e) => setCoordInput(e.target.value)}
                    placeholder="Contoh: 8.0942S 112.6465E atau -8.0942, 112.6465"
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-mono focus:border-blue-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleLookupAddress}
                    disabled={geocodeLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50 shrink-0"
                  >
                    {geocodeLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )}
                    Cari Alamat
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Baris Alamat (1 baris per tingkat: Jalan, Kelurahan/Desa, Kecamatan, Kab/Kota, Provinsi)
                </label>
                <textarea
                  rows={5}
                  value={addressText}
                  onChange={(e) => setAddressText(e.target.value)}
                  placeholder={
                    'No. 20 Jalan Raya Krebet Timur\nKrebet\nKecamatan Bululawang\nKabupaten Malang\nJawa Timur'
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs leading-relaxed focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            {statusMsg && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800">
                {statusMsg}
              </div>
            )}

            {pagePhotosCount > 1 && (
              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={syncTimestampOnAll}
                  onChange={(e) => setSyncTimestampOnAll(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span>
                  Ikut samakan jam/tanggal saat klik &ldquo;Terapkan ke Semua Foto Halaman Ini&rdquo;
                </span>
              </label>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100">
              {pagePhotosCount > 1 && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveAll}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Terapkan ke {pagePhotosCount} Foto Halaman Ini
                </button>
              )}
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveOne}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Simpan Foto Ini
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
