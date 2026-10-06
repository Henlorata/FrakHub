import {useCallback, useEffect, useRef, useState, type PointerEvent, type WheelEvent} from "react";
import {ChevronLeft, ChevronRight, ExternalLink, FileText, Minus, Plus, RotateCcw, X} from "lucide-react";
import {Dialog, DialogContent, DialogDescription, DialogTitle} from "@/components/ui/dialog";
import {withTransformation} from "@/lib/cloudinary";
import {formatDateTime} from "@/lib/datetime";
import {isRemoteFile} from "@/lib/mcb";
import {cn} from "@/lib/utils";
import type {CaseEvidence} from "@/types/supabase";
import {useEvidenceImageUrl} from "./EvidenceBlock";

interface EvidenceViewerProps {
  items: CaseEvidence[];
  numbers: Map<string, number>;
  /** The evidence to show; null closes the viewer. */
  activeId: string | null;
  onActiveChange: (id: string | null) => void;
}

/** Full-screen gallery of a case's evidence: zoom, pan, arrows, thumbnails. */
export function EvidenceViewer({items, numbers, activeId, onActiveChange}: EvidenceViewerProps) {
  const index = items.findIndex((item) => item.id === activeId);
  const current = index >= 0 ? items[index] : null;
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({x: 0, y: 0});
  const drag = useRef<{x: number; y: number} | null>(null);
  const isImage = current?.file_type === "image";
  const {url, loading} = useEvidenceImageUrl(current?.file_path, isImage, 2200);

  const reset = useCallback(() => {
    setScale(1);
    setOffset({x: 0, y: 0});
  }, []);

  useEffect(reset, [activeId, reset]);

  const go = useCallback((step: number) => {
    if (items.length === 0 || index < 0) return;
    onActiveChange(items[(index + step + items.length) % items.length].id);
  }, [index, items, onActiveChange]);

  useEffect(() => {
    if (!current) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") go(1);
      else if (event.key === "ArrowLeft") go(-1);
      else if (event.key === "+" || event.key === "=") setScale((value) => Math.min(6, value + 0.5));
      else if (event.key === "-") setScale((value) => Math.max(1, value - 0.5));
      else if (event.key === "0") reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, go, reset]);

  const onWheel = (event: WheelEvent) => {
    setScale((value) => Math.min(6, Math.max(1, value + (event.deltaY < 0 ? 0.35 : -0.35))));
  };
  const onPointerDown = (event: PointerEvent) => {
    if (scale <= 1) return;
    drag.current = {x: event.clientX - offset.x, y: event.clientY - offset.y};
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (drag.current) setOffset({x: event.clientX - drag.current.x, y: event.clientY - drag.current.y});
  };

  return (
    <Dialog open={!!current} onOpenChange={(open) => !open && onActiveChange(null)}>
      <DialogContent showCloseButton={false}
                     className="flex h-[100dvh] max-h-none w-screen max-w-none flex-col gap-0 rounded-none border-0 bg-black/90 p-0 backdrop-blur-xl sm:max-w-none">
        <DialogTitle className="sr-only">Bizonyíték megtekintése</DialogTitle>
        <DialogDescription className="sr-only">{current?.file_name}</DialogDescription>
        {current && (
          <>
            <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3">
              <span className="rounded-md bg-amber-500/15 px-2 py-0.5 font-mono text-xs font-bold text-amber-300">#{numbers.get(current.id)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{current.file_name}</p>
                <p className="truncate text-[11px] text-slate-400">
                  {current.uploader_name ? `${current.uploader_name} · ` : ""}{formatDateTime(current.created_at)} · {index + 1}/{items.length}
                </p>
              </div>
              {isImage && (
                <div className="hidden items-center gap-1 rounded-lg bg-white/5 p-1 sm:flex">
                  <button type="button" aria-label="Kicsinyítés" onClick={() => setScale((value) => Math.max(1, value - 0.5))}
                          className="grid size-8 place-items-center rounded-md text-slate-300 hover:bg-white/10"><Minus className="size-4"/></button>
                  <span className="w-12 text-center font-mono text-xs text-amber-300">{Math.round(scale * 100)}%</span>
                  <button type="button" aria-label="Nagyítás" onClick={() => setScale((value) => Math.min(6, value + 0.5))}
                          className="grid size-8 place-items-center rounded-md text-slate-300 hover:bg-white/10"><Plus className="size-4"/></button>
                  <button type="button" aria-label="Visszaállítás" onClick={reset}
                          className="grid size-8 place-items-center rounded-md text-slate-300 hover:bg-white/10"><RotateCcw className="size-4"/></button>
                </div>
              )}
              {isRemoteFile(current.file_path) && (
                <a href={current.file_path} target="_blank" rel="noopener noreferrer" title="Eredeti fájl új lapon"
                   className="grid size-9 place-items-center rounded-lg text-slate-300 hover:bg-white/10"><ExternalLink className="size-4"/></a>
              )}
              <button type="button" aria-label="Bezárás" onClick={() => onActiveChange(null)}
                      className="grid size-9 place-items-center rounded-lg text-slate-300 hover:bg-white/10"><X className="size-5"/></button>
            </header>

            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden select-none" onWheel={isImage ? onWheel : undefined}>
              {items.length > 1 && (
                <>
                  <button type="button" aria-label="Előző" onClick={() => go(-1)}
                          className="absolute top-1/2 left-3 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white ring-1 ring-white/15 hover:bg-black/80">
                    <ChevronLeft className="size-5"/>
                  </button>
                  <button type="button" aria-label="Következő" onClick={() => go(1)}
                          className="absolute top-1/2 right-3 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white ring-1 ring-white/15 hover:bg-black/80">
                    <ChevronRight className="size-5"/>
                  </button>
                </>
              )}
              {isImage ? (
                loading || !url ? <p className="text-sm text-slate-400">Betöltés…</p> : (
                  <img src={url} alt={current.file_name} draggable={false}
                       onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => (drag.current = null)}
                       onDoubleClick={() => (scale > 1 ? reset() : setScale(2.5))}
                       className={cn("max-h-full max-w-full object-contain transition-transform duration-75 will-change-transform",
                         scale > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in")}
                       style={{transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`}}/>
                )
              ) : (
                <div className="flex flex-col items-center gap-3 text-center">
                  <FileText className="size-16 text-slate-500"/>
                  <p className="text-sm text-slate-300">Ez a bizonyíték dokumentum, a böngésző új lapon nyitja meg.</p>
                  {isRemoteFile(current.file_path) && (
                    <a href={current.file_path} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-black hover:bg-amber-400">
                      <ExternalLink className="size-4"/> Megnyitás
                    </a>
                  )}
                </div>
              )}
            </div>

            {items.length > 1 && (
              <div className="flex shrink-0 gap-2 overflow-x-auto border-t border-white/10 px-4 py-3">
                {items.map((item) => (
                  <button key={item.id} type="button" onClick={() => onActiveChange(item.id)} title={item.file_name}
                          className={cn("relative size-16 shrink-0 overflow-hidden rounded-lg ring-2 transition",
                            item.id === current.id ? "ring-amber-400" : "opacity-60 ring-transparent hover:opacity-100")}>
                    {item.file_type === "image" && isRemoteFile(item.file_path) ? (
                      <img src={withTransformation(item.file_path, "c_fill,w_128,h_128,q_auto,f_auto")} alt="" className="size-full object-cover"/>
                    ) : <span className="grid size-full place-items-center bg-white/5"><FileText className="size-5 text-slate-400"/></span>}
                    <span className="absolute right-0 bottom-0 rounded-tl bg-black/70 px-1 font-mono text-[9px] text-amber-300">#{numbers.get(item.id)}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

