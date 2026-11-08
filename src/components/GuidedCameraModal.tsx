import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ChevronRight,
  Compass,
  FlipHorizontal2,
  ImagePlus,
  Loader2,
  X,
} from 'lucide-react';
import {
  formatWatermarkCoords,
  formatWatermarkTimestamp,
  reverseGeocodeAddress,
} from '../services/geolocation';
import { buildFallbackRegionLines } from '../services/photoManager';
import { DocumentHeader, DocumentPage, WatermarkData } from '../types';

interface GuidedCameraModalProps {
  page: DocumentPage;
  header: DocumentHeader;
  initialSlotIndex?: number;
  onCaptureSlot: (
    slotIndex: number,
    captureBlob: Blob,
    watermark: WatermarkData
  ) => Promise<void>;
  onClose: () => void;
}

export const GuidedCameraModal: React.FC<GuidedCameraModalProps> = ({
  page,
  header,
  initialSlotIndex = 0,
  onCaptureSlot,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);

  const [activeSlotIdx, setActiveSlotIdx] = useState<number>(initialSlotIndex);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string>('');
  const [capturing, setCapturing] = useState<boolean>(false);
  const [flashEffect, setFlashEffect] = useState<boolean>(false);

  // Live GPS + Clock state
  const [clockText, setClockText] = useState<string>(() => formatWatermarkTimestamp(new Date()));
  const [gpsCoords, setGpsCoords] = useState<{
    lat: number;
    lon: number;
    accuracy: number;
  } | null>(null);
  const [addressLines, setAddressLines] = useState<string[]>(() =>
    buildFallbackRegionLines(header)
  );
  const [gpsStatus, setGpsStatus] = useState<'searching' | 'ready' | 'denied'>('searching');
  const lastGeocodedRef = useRef<{ lat: number; lon: number } | null>(null);

  // Keep live minute clock ticking
  useEffect(() => {
    const timer = setInterval(() => {
      setClockText(formatWatermarkTimestamp(new Date()));
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Watch GPS continuously for sharp accuracy at the pole
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatus('denied');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setGpsCoords({ lat, lon, accuracy: pos.coords.accuracy });
        setGpsStatus('ready');

        const prev = lastGeocodedRef.current;
        const movedEnough =
          !prev ||
          Math.abs(prev.lat - lat) > 0.00035 ||
          Math.abs(prev.lon - lon) > 0.00035;

        if (movedEnough) {
          lastGeocodedRef.current = { lat, lon };
          const lines = await reverseGeocodeAddress(lat, lon);
          if (lines.length > 0) {
            setAddressLines(lines);
          }
        }
      },
      () => {
        setGpsStatus((prev) => (prev === 'ready' ? 'ready' : 'denied'));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 8000,
        timeout: 15000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Start WebRTC camera stream
  const startCamera = useCallback(async () => {
    setCameraError('');
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        'Akses kamera langsung butuh koneksi HTTPS atau localhost. Anda tetap bisa memotret memakai tombol "Buka Kamera Sistem HP" di bawah.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 2560 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setCameraError(
        'Izin kamera ditolak atau tidak tersedia. Gunakan tombol "Buka Kamera Sistem HP" di bawah.'
      );
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [startCamera]);

  const buildCurrentWatermark = (): WatermarkData => {
    const now = new Date();
    return {
      timestampText: formatWatermarkTimestamp(now),
      isoTimestamp: now.toISOString(),
      latitude: gpsCoords?.lat,
      longitude: gpsCoords?.lon,
      coordText: gpsCoords ? formatWatermarkCoords(gpsCoords.lat, gpsCoords.lon) : '',
      addressLines,
    };
  };

  const advanceToNextSlot = (justFilledIdx: number) => {
    // Look for next empty slot after justFilledIdx
    for (let offset = 1; offset < page.slots.length; offset++) {
      const candidate = (justFilledIdx + offset) % page.slots.length;
      if (candidate !== justFilledIdx && !page.slots[candidate]?.photoId) {
        setActiveSlotIdx(candidate);
        return;
      }
    }
    // Otherwise advance sequentially if not at last slot
    if (justFilledIdx + 1 < page.slots.length) {
      setActiveSlotIdx(justFilledIdx + 1);
    }
  };

  const handleShutter = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || capturing) return;

    setCapturing(true);
    setFlashEffect(true);
    setTimeout(() => setFlashEffect(false), 160);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas tidak tersedia');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Gagal mengambil frame foto'))),
          'image/jpeg',
          0.92
        );
      });

      const currentIdx = activeSlotIdx;
      await onCaptureSlot(currentIdx, blob, buildCurrentWatermark());
      advanceToNextSlot(currentIdx);
    } finally {
      setCapturing(false);
    }
  };

  const handleNativeCameraFallback = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCapturing(true);
    try {
      const currentIdx = activeSlotIdx;
      await onCaptureSlot(currentIdx, file, buildCurrentWatermark());
      advanceToNextSlot(currentIdx);
    } finally {
      setCapturing(false);
      e.target.value = '';
    }
  };

  const activeSlot = page.slots[activeSlotIdx] || page.slots[0];
  const filledCount = page.slots.filter((s) => Boolean(s.photoId)).length;
  const pageTitle = page.mergeMiddleHeader
    ? page.headerTopText.replace(/\s+/g, ' ')
    : page.headerBottomText.replace(/\s+/g, ' ');

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white select-none">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-950/90 border-b border-white/10 z-10">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-blue-400 uppercase truncate">
              {pageTitle}
            </span>
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold">
              Terisi {filledCount}/{page.slots.length}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] mt-0.5">
            <Compass
              className={`w-3.5 h-3.5 shrink-0 ${
                gpsStatus === 'ready'
                  ? 'text-emerald-400'
                  : gpsStatus === 'searching'
                    ? 'text-amber-400 animate-pulse'
                    : 'text-red-400'
              }`}
            />
            {gpsStatus === 'ready' && gpsCoords ? (
              <span className="text-emerald-300 truncate">
                GPS ±{Math.round(gpsCoords.accuracy)}m •{' '}
                {formatWatermarkCoords(gpsCoords.lat, gpsCoords.lon)}
              </span>
            ) : gpsStatus === 'searching' ? (
              <span className="text-amber-300">Mencari sinyal GPS...</span>
            ) : (
              <span className="text-red-300">GPS belum aktif / izin ditolak</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))
            }
            className="rounded-full bg-white/10 p-2 hover:bg-white/20"
            title="Balik Kamera"
          >
            <FlipHorizontal2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25 flex items-center gap-1"
          >
            Selesai <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Active Slot Prompt Banner */}
      <div className="bg-blue-600/95 px-4 py-2 flex items-center justify-between shadow-md z-10">
        <div className="flex items-center gap-2 min-w-0">
          <span className="rounded-md bg-white text-blue-700 font-extrabold text-xs px-2 py-0.5 shrink-0">
            Kotak {activeSlotIdx + 1}/{page.slots.length}
          </span>
          <span className="font-bold text-sm truncate">{activeSlot?.description}</span>
        </div>
        {activeSlot?.photoId && (
          <span className="text-[11px] bg-emerald-500/30 border border-emerald-300/40 px-2 py-0.5 rounded-full font-medium shrink-0">
            Sudah ada (Jepret = Ganti)
          </span>
        )}
      </div>

      {/* Camera Viewfinder */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
        {!cameraError ? (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="max-w-sm text-center px-6 space-y-4">
            <p className="text-xs text-slate-300 leading-relaxed">{cameraError}</p>
            <button
              type="button"
              onClick={() => nativeCameraInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg"
            >
              <Camera className="w-5 h-5" />
              Buka Kamera Sistem HP
            </button>
          </div>
        )}

        {/* Shutter Flash Overlay */}
        {flashEffect && <div className="absolute inset-0 bg-white/80 pointer-events-none" />}

        {/* Live Watermark Overlay Preview (Bottom-Right) */}
        <div className="pointer-events-none absolute bottom-3 right-3 text-right text-[11px] leading-snug font-medium text-white drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.95)] bg-black/25 backdrop-blur-[1px] rounded-lg px-2.5 py-1.5 max-w-[80%]">
          <div>{clockText}</div>
          {gpsCoords && <div>{formatWatermarkCoords(gpsCoords.lat, gpsCoords.lon)}</div>}
          {addressLines.map((line, i) => (
            <div key={i} className="truncate">
              {line}
            </div>
          ))}
        </div>
      </div>

      {/* Slot Selector Strip */}
      <div className="bg-slate-950 border-t border-white/10 px-3 py-2 flex items-center gap-1.5 overflow-x-auto">
        {page.slots.map((slot, idx) => {
          const isCurrent = idx === activeSlotIdx;
          const isFilled = Boolean(slot.photoId);
          return (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveSlotIdx(idx)}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium shrink-0 border transition-all ${
                isCurrent
                  ? 'bg-blue-600 border-blue-400 text-white shadow-sm'
                  : isFilled
                    ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-200'
                    : 'bg-slate-900 border-white/10 text-slate-300'
              }`}
            >
              {isFilled && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
              <span>
                {idx + 1}. {slot.description}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bottom Shutter Controls */}
      <div className="bg-slate-950 px-6 py-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => nativeCameraInputRef.current?.click()}
          className="flex flex-col items-center gap-1 text-[11px] text-slate-300 hover:text-white"
        >
          <div className="rounded-full bg-white/10 p-2.5">
            <ImagePlus className="w-5 h-5" />
          </div>
          <span>Kamera HP / Galeri</span>
        </button>

        <button
          type="button"
          disabled={capturing || Boolean(cameraError)}
          onClick={handleShutter}
          className="relative h-18 w-18 rounded-full border-4 border-white flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40"
        >
          <div className="h-14 w-14 rounded-full bg-white flex items-center justify-center text-slate-900">
            {capturing ? <Loader2 className="w-6 h-6 animate-spin" /> : null}
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveSlotIdx((i) => (i + 1 < page.slots.length ? i + 1 : 0))
          }
          className="flex flex-col items-center gap-1 text-[11px] text-slate-300 hover:text-white"
        >
          <div className="rounded-full bg-white/10 p-2.5">
            <ChevronRight className="w-5 h-5" />
          </div>
          <span>Lewati Slot</span>
        </button>

        <input
          ref={nativeCameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleNativeCameraFallback}
          className="hidden"
        />
      </div>
    </div>
  );
};
