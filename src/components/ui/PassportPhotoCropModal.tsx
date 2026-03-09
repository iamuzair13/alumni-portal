"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";

type Props = {
  isOpen: boolean;
  file: File | null;
  onClose: () => void;
  onCropped: (file: File) => void;
  title?: string;
};

type LoadedImage = {
  url: string;
  width: number;
  height: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

async function loadImageDimensions(url: string): Promise<{ width: number; height: number }> {
  const img = new window.Image();
  img.decoding = "async";
  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load image"));
  });
  img.src = url;
  await loaded;
  return {
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
  };
}

function canvasToFile(canvas: HTMLCanvasElement, original: File, fileBaseName: string) {
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to create image"));
          return;
        }
        const name = `${fileBaseName}.jpg`;
        resolve(new File([blob], name, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92
    );
  });
}

export default function PassportPhotoCropModal({ isOpen, file, onClose, onCropped, title = "Edit Photo" }: Props) {
  const [loaded, setLoaded] = useState<LoadedImage | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  const aspect = 35 / 45;

  const frame = useMemo(() => {
    const w = containerSize.w;
    const h = containerSize.h;
    if (!w || !h) return { x: 0, y: 0, w: 0, h: 0 };

    const padding = 24;
    const maxW = Math.max(1, w - padding * 2);
    const maxH = Math.max(1, h - padding * 2);

    let fw = maxW;
    let fh = fw / aspect;
    if (fh > maxH) {
      fh = maxH;
      fw = fh * aspect;
    }

    const x = (w - fw) / 2;
    const y = (h - fh) / 2;
    return { x, y, w: fw, h: fh };
  }, [containerSize, aspect]);

  useEffect(() => {
    if (!isOpen) return;
    if (!file) return;

    const url = URL.createObjectURL(file);
    let canceled = false;

    (async () => {
      try {
        const dims = await loadImageDimensions(url);
        if (canceled) return;
        setLoaded({ url, width: dims.width, height: dims.height });
        setZoom(1);
        setOffset({ x: 0, y: 0 });
      } catch {
        if (canceled) return;
        URL.revokeObjectURL(url);
        setLoaded(null);
      }
    })();

    return () => {
      canceled = true;
      URL.revokeObjectURL(url);
    };
  }, [isOpen, file]);

  useEffect(() => {
    if (!isOpen) return;

    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setContainerSize({ w: rect.width, h: rect.height });
    });
    ro.observe(el);

    const rect = el.getBoundingClientRect();
    setContainerSize({ w: rect.width, h: rect.height });

    return () => ro.disconnect();
  }, [isOpen]);

  const imageFitScale = useMemo(() => {
    if (!loaded) return 1;
    if (!frame.w || !frame.h) return 1;

    const coverScale = Math.max(frame.w / loaded.width, frame.h / loaded.height);
    return coverScale;
  }, [loaded, frame.w, frame.h]);

  const effectiveScale = imageFitScale * zoom;

  const imageDrawSize = useMemo(() => {
    if (!loaded) return { w: 0, h: 0 };
    return {
      w: loaded.width * effectiveScale,
      h: loaded.height * effectiveScale,
    };
  }, [loaded, effectiveScale]);

  const imageTopLeft = useMemo(() => {
    const cx = frame.x + frame.w / 2;
    const cy = frame.y + frame.h / 2;
    return {
      x: cx - imageDrawSize.w / 2 + offset.x,
      y: cy - imageDrawSize.h / 2 + offset.y,
    };
  }, [frame.x, frame.y, frame.w, frame.h, imageDrawSize.w, imageDrawSize.h, offset.x, offset.y]);

  const nudgeIntoBounds = useCallback(
    (nextOffset: { x: number; y: number }) => {
      if (!loaded) return nextOffset;

      const cx = frame.x + frame.w / 2;
      const cy = frame.y + frame.h / 2;

      const imgW = loaded.width * effectiveScale;
      const imgH = loaded.height * effectiveScale;

      const left = cx - imgW / 2 + nextOffset.x;
      const top = cy - imgH / 2 + nextOffset.y;
      const right = left + imgW;
      const bottom = top + imgH;

      let dx = nextOffset.x;
      let dy = nextOffset.y;

      if (left > frame.x) dx -= left - frame.x;
      if (top > frame.y) dy -= top - frame.y;
      if (right < frame.x + frame.w) dx += frame.x + frame.w - right;
      if (bottom < frame.y + frame.h) dy += frame.y + frame.h - bottom;

      return { x: dx, y: dy };
    },
    [loaded, frame.x, frame.y, frame.w, frame.h, effectiveScale]
  );

  useEffect(() => {
    if (!isOpen) return;
    setOffset((prev) => nudgeIntoBounds(prev));
  }, [isOpen, zoom, nudgeIntoBounds]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!loaded) return;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }, [loaded, offset.x, offset.y]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    if (!dragStart.current) return;

    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const next = { x: dragStart.current.ox + dx, y: dragStart.current.oy + dy };
    setOffset(nudgeIntoBounds(next));
  }, [dragging, nudgeIntoBounds]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    dragStart.current = null;
    setDragging(false);
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }, [dragging]);

  const handleConfirm = useCallback(async () => {
    if (!loaded || !file) return;

    const outW = 700;
    const outH = Math.round(outW / aspect);

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cropLeft = frame.x;
    const cropTop = frame.y;

    const imgLeft = imageTopLeft.x;
    const imgTop = imageTopLeft.y;

    const sx = (cropLeft - imgLeft) / effectiveScale;
    const sy = (cropTop - imgTop) / effectiveScale;
    const sw = frame.w / effectiveScale;
    const sh = frame.h / effectiveScale;

    const safeSx = clamp(sx, 0, loaded.width);
    const safeSy = clamp(sy, 0, loaded.height);
    const safeSw = clamp(sw, 1, loaded.width - safeSx);
    const safeSh = clamp(sh, 1, loaded.height - safeSy);

    const img = new window.Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = loaded.url;
    });

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, outW, outH);
    ctx.drawImage(img, safeSx, safeSy, safeSw, safeSh, 0, 0, outW, outH);

    const base = (file.name || "passport").replace(/\.[^/.]+$/, "");
    const outFile = await canvasToFile(canvas, file, `${base}-passport`);
    onCropped(outFile);
  }, [loaded, file, frame.x, frame.y, frame.w, frame.h, imageTopLeft.x, imageTopLeft.y, effectiveScale, aspect, onCropped]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-3xl mx-auto" showCloseButton={true}>
      <div className="p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 rounded"
          >
            Cancel
          </button>
        </div>

        <div
          ref={containerRef}
          className="relative w-full h-[420px] bg-black/90 rounded-md overflow-hidden select-none touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {!file && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-xs font-medium text-white/80">Loading image...</div>
            </div>
          )}
          {!!file && !loaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-xs font-medium text-white/80">Preparing editor...</div>
            </div>
          )}
          {loaded && (
            <img
              src={loaded.url}
              alt="Crop"
              className="absolute top-0 left-0 will-change-transform"
              style={{
                width: imageDrawSize.w,
                height: imageDrawSize.h,
                transform: `translate3d(${imageTopLeft.x}px, ${imageTopLeft.y}px, 0)`
              }}
              draggable={false}
            />
          )}

          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                `linear-gradient(rgba(0,0,0,0.65), rgba(0,0,0,0.65))`,
              mask:
                `radial-gradient(circle at 0 0, transparent 0, transparent 0)`,
            }}
          />

          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                `linear-gradient(rgba(0,0,0,0.65), rgba(0,0,0,0.65))`,
              WebkitMask:
                `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${frame.x}px ${frame.y}px, ${frame.x + frame.w}px ${frame.y}px, ${frame.x + frame.w}px ${frame.y + frame.h}px, ${frame.x}px ${frame.y + frame.h}px, ${frame.x}px ${frame.y}px)`,
              mask:
                `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${frame.x}px ${frame.y}px, ${frame.x + frame.w}px ${frame.y}px, ${frame.x + frame.w}px ${frame.y + frame.h}px, ${frame.x}px ${frame.y + frame.h}px, ${frame.x}px ${frame.y}px)`,
            }}
          />

          <div
            className="absolute border-2 border-white/90 rounded-sm pointer-events-none"
            style={{ left: frame.x, top: frame.y, width: frame.w, height: frame.h }}
          />

          <div
            className="absolute left-3 bottom-3 text-[11px] text-white/80 bg-black/30 px-2 py-1 rounded"
          >
            Drag to position. Use zoom to fit.
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Zoom</label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full"
              aria-label="Zoom"
            />
          </div>

          <div className="sm:col-span-1 flex justify-end">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!loaded}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded"
            >
              Use Photo
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
