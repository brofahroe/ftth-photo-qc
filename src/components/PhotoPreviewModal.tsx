import React, { useEffect, useState } from 'react';
import { MapPin, RotateCw, Trash2, X } from 'lucide-react';
import { PhotoRecord } from '../types';

interface PhotoPreviewModalProps {
  record: PhotoRecord;
  slotDescription: string;
  onRotate: () => Promise<void>;
  onEditWatermark: () => void;
  onRemove: () => void;
  onClose: () => void;
}

export const PhotoPreviewModal: React.FC<PhotoPreviewModalProps> = ({
  record,
  slotDescription,
  onRotate,
  onEditWatermark,
  onRemove,
  onClose,
}) => {
  const [url, setUrl] = useState<string>('');
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(record.renderedBlob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [record.renderedBlob, record.updatedAt]);

  const handleRotate = async () => {
    setRotating(true);
    try {
      await onRotate();
    } finally {
      setRotating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 text-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div>
          <h3 className="text-sm font-bold">{slotDescription}</h3>
          <p className="text-xs text-slate-400">
            {record.width} × {record.height}px •{' '}
            {record.watermarkEnabled ? 'Watermark Aktif' : 'Tanpa Watermark Tambahan'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-white/10 p-2 hover:bg-white/20"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-3 overflow-auto">
        {url && (
          <img
            src={url}
            alt={slotDescription}
            className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2.5 px-4 py-3.5 border-t border-white/10 bg-slate-900">
        <button
          type="button"
          disabled={rotating}
          onClick={handleRotate}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold hover:bg-white/20 disabled:opacity-50"
        >
          <RotateCw className={`w-4 h-4 ${rotating ? 'animate-spin' : ''}`} />
          Putar 90°
        </button>

        <button
          type="button"
          onClick={onEditWatermark}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold hover:bg-blue-500"
        >
          <MapPin className="w-4 h-4" />
          Atur Watermark / Lokasi
        </button>

        <button
          type="button"
          onClick={() => {
            onRemove();
            onClose();
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-red-600/80 px-4 py-2 text-xs font-semibold hover:bg-red-600"
        >
          <Trash2 className="w-4 h-4" />
          Hapus Foto
        </button>
      </div>
    </div>
  );
};
