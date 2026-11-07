import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw, RotateCw, Check, X } from 'lucide-react';

interface ImageCropModalProps {
  imageSrc: string | null;
  isOpen: boolean;
  onClose: () => void;
  onApply: (croppedDataUrl: string) => void;
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  imageSrc,
  isOpen,
  onClose,
  onApply,
}) => {
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cropRect, setCropRect] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  const paintPreview = (
    rect: { x: number; y: number; w: number; h: number } | null = cropRect
  ) => {
    const base = baseCanvasRef.current;
    const cv = previewCanvasRef.current;
    if (!base || !cv) return;
    const scale = Math.min(1, 560 / base.width, 400 / base.height);
    cv.width = Math.max(1, Math.round(base.width * scale));
    cv.height = Math.max(1, Math.round(base.height * scale));
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(base, 0, 0, cv.width, cv.height);
    if (rect && rect.w > 2 && rect.h > 2) {
      ctx.fillStyle = 'rgba(2, 132, 199, 0.18)';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 2;
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }
  };

  useEffect(() => {
    if (!isOpen || !imageSrc) return;
    const img = new Image();
    img.onload = () => {
      const base = document.createElement('canvas');
      base.width = img.width;
      base.height = img.height;
      const ctx = base.getContext('2d');
      ctx?.drawImage(img, 0, 0);
      baseCanvasRef.current = base;
      setCropRect(null);
      setDragStart(null);
      paintPreview(null);
    };
    img.src = imageSrc;
  }, [isOpen, imageSrc]);

  if (!isOpen || !imageSrc) return null;

  const rotate = (deg: number) => {
    const base = baseCanvasRef.current;
    if (!base) return;
    const rotated = document.createElement('canvas');
    rotated.width = base.height;
    rotated.height = base.width;
    const ctx = rotated.getContext('2d');
    if (ctx) {
      ctx.translate(rotated.width / 2, rotated.height / 2);
      ctx.rotate((deg * Math.PI) / 180);
      ctx.drawImage(base, -base.width / 2, -base.height / 2);
    }
    baseCanvasRef.current = rotated;
    setCropRect(null);
    paintPreview(null);
  };

  const getPointerCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cv = previewCanvasRef.current;
    if (!cv) return { x: 0, y: 0 };
    const r = cv.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(cv.width, ((e.clientX - r.left) * cv.width) / r.width)),
      y: Math.max(0, Math.min(cv.height, ((e.clientY - r.top) * cv.height) / r.height)),
    };
  };

  const handleApply = () => {
    const base = baseCanvasRef.current;
    const preview = previewCanvasRef.current;
    if (!base || !preview) return;
    let x = 0;
    let y = 0;
    let w = base.width;
    let h = base.height;
    if (cropRect && cropRect.w >= 8 && cropRect.h >= 8) {
      x = Math.round((cropRect.x * base.width) / preview.width);
      y = Math.round((cropRect.y * base.height) / preview.height);
      w = Math.max(1, Math.round((cropRect.w * base.width) / preview.width));
      h = Math.max(1, Math.round((cropRect.h * base.height) / preview.height));
    }
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    out.getContext('2d')?.drawImage(base, x, y, w, h, 0, 0, w, h);
    onApply(out.toDataURL('image/jpeg', 0.9));
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-label="裁切與旋轉題目圖片"
    >
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              裁切／轉正題目照片
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              在圖片上拖曳可框選單一題目範圍；不框選則保留整張圖片。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="關閉"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="my-4 flex justify-center bg-slate-100 dark:bg-slate-950 rounded-xl p-3 overflow-hidden">
          <canvas
            ref={previewCanvasRef}
            onPointerDown={(e) => {
              e.preventDefault();
              const pt = getPointerCoords(e);
              setDragStart(pt);
              setCropRect(null);
              e.currentTarget.setPointerCapture(e.pointerId);
              paintPreview(null);
            }}
            onPointerMove={(e) => {
              if (!dragStart) return;
              const pt = getPointerCoords(e);
              const next = {
                x: Math.min(pt.x, dragStart.x),
                y: Math.min(pt.y, dragStart.y),
                w: Math.abs(pt.x - dragStart.x),
                h: Math.abs(pt.y - dragStart.y),
              };
              setCropRect(next);
              paintPreview(next);
            }}
            onPointerUp={(e) => {
              setDragStart(null);
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
              }
            }}
            className="max-w-full max-h-[52vh] rounded-lg border border-slate-300 dark:border-slate-700 bg-white cursor-crosshair touch-none"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => rotate(-90)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              向左轉 90°
            </button>
            <button
              type="button"
              onClick={() => rotate(90)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <RotateCw className="w-3.5 h-3.5" />
              向右轉 90°
            </button>
            {cropRect && (
              <button
                type="button"
                onClick={() => {
                  setCropRect(null);
                  paintPreview(null);
                }}
                className="px-3 py-2 text-xs font-semibold rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                重設框選
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-sky-600 text-white hover:bg-sky-700 transition-colors whitespace-nowrap"
            >
              <Check className="w-3.5 h-3.5" />
              套用圖片
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
