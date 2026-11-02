import { ImagePlus, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useI18n } from "../i18n";
import type { IconPreview } from "../types/icon";
import Modal from "./ui/Modal";

const PREVIEW = 256;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

interface IconPickerDialogProps {
  open: boolean;
  onClose: () => void;
  /** 确认后返回图标 data URL */
  onConfirm: (dataUrl: string) => void;
}

/** 自定义项目图标：选择图片 → 缩放/拖拽裁剪为正方形（尺寸直接来自后端，不依赖 img onLoad） */
export default function IconPickerDialog({ open, onClose, onConfirm }: IconPickerDialogProps) {
  const t = useI18n((s) => s.t);
  const [src, setSrc] = useState<string | null>(null);
  const [preview, setPreview] = useState<IconPreview | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(
    null,
  );

  useEffect(() => {
    if (!open) return;
    setSrc(null);
    setPreview(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setBusy(false);
    setError(null);
  }, [open]);

  const pw = preview?.previewWidth ?? 0;
  const ph = preview?.previewHeight ?? 0;
  const base = pw > 0 ? PREVIEW / Math.min(pw, ph) : 1;
  const dispW = pw * base * zoom;
  const dispH = ph * base * zoom;

  const clampPan = (x: number, y: number) => ({
    x: Math.max(-(dispW - PREVIEW) / 2, Math.min((dispW - PREVIEW) / 2, x)),
    y: Math.max(-(dispH - PREVIEW) / 2, Math.min((dispH - PREVIEW) / 2, y)),
  });

  const onZoomChange = (z: number) => {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
    setZoom(clamped);
    setPan((p) => {
      const dw = pw * base * clamped;
      const dh = ph * base * clamped;
      return {
        x: Math.max(-(dw - PREVIEW) / 2, Math.min((dw - PREVIEW) / 2, p.x)),
        y: Math.max(-(dh - PREVIEW) / 2, Math.min((dh - PREVIEW) / 2, p.y)),
      };
    });
  };

  const pick = async () => {
    setError(null);
    try {
      const path = await api.icons.pick();
      if (!path) return;
      setBusy(true);
      const pv = await api.icons.preview(path);
      setSrc(path);
      setPreview(pv);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!src || !preview) return;
    setBusy(true);
    setError(null);
    try {
      const scale = base * zoom;
      const sx = Math.max(0, Math.min(pw - 1, (dispW / 2 - PREVIEW / 2 + pan.x) / scale));
      const sy = Math.max(0, Math.min(ph - 1, (dispH / 2 - PREVIEW / 2 + pan.y) / scale));
      const sw = Math.max(1, Math.min(PREVIEW / scale, pw - sx));
      const sh = Math.max(1, Math.min(PREVIEW / scale, ph - sy));
      // 预览坐标 → 原图坐标
      const kx = preview.width / pw;
      const ky = preview.height / ph;
      const dataUrl = await api.icons.crop(src, {
        sx: sx * kx,
        sy: sy * ky,
        sw: sw * kx,
        sh: sh * ky,
      });
      onConfirm(dataUrl);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("iconPicker.title")} className="max-w-md">
      <div className="flex flex-col items-center gap-4">
        <div
          className="relative size-64 touch-none overflow-hidden rounded-lg border bg-muted"
          onPointerDown={(e) => {
            dragRef.current = {
              startX: e.clientX,
              startY: e.clientY,
              baseX: pan.x,
              baseY: pan.y,
            };
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!dragRef.current) return;
            const dx = e.clientX - dragRef.current.startX;
            const dy = e.clientY - dragRef.current.startY;
            setPan(clampPan(dragRef.current.baseX + dx, dragRef.current.baseY + dy));
          }}
          onPointerUp={() => {
            dragRef.current = null;
          }}
        >
          {preview && (
            <img
              src={preview.dataUrl}
              alt=""
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
              style={{
                width: `${dispW}px`,
                height: `${dispH}px`,
                transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))`,
              }}
            />
          )}
          {!preview && !busy && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <ImagePlus className="size-8" />
              <p className="px-6 text-center text-xs">{t("iconPicker.hint")}</p>
            </div>
          )}
          {busy && (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t("common.processing")}
            </div>
          )}
        </div>

        {preview && (
          <div className="flex w-full items-center gap-3 px-2">
            <span className="shrink-0 text-xs text-muted-foreground">{t("iconPicker.zoom")}</span>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.05}
              value={zoom}
              onChange={(e) => onZoomChange(Number(e.target.value))}
              className="flex-1"
            />
            <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              title={t("iconPicker.reset")}
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className="rounded p-1 text-muted-foreground hover:bg-accent"
            >
              <RotateCcw className="size-3.5" />
            </button>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex w-full justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={() => void pick()}
            disabled={busy}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          >
            {src ? t("iconPicker.reselect") : t("iconPicker.pick")}
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={!src || !preview || busy}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {t("common.ok")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
