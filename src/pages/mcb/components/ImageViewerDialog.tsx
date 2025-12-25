import * as React from "react";
import {Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {ZoomIn, ZoomOut, RotateCcw, X} from "lucide-react";
import {cn} from "@/lib/utils";

interface ImageViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string | null;
  fileName: string;
}

export function ImageViewerDialog({open, onOpenChange, imageUrl, fileName}: ImageViewerDialogProps) {
  const [scale, setScale] = React.useState(1);
  const [position, setPosition] = React.useState({x: 0, y: 0});
  const [isDragging, setIsDragging] = React.useState(false);
  const [startPos, setStartPos] = React.useState({x: 0, y: 0});

  React.useEffect(() => {
    if (open) {
      setScale(1);
      setPosition({x: 0, y: 0});
    }
  }, [open]);

  const handleZoomIn = () => setScale(s => Math.min(s + 0.5, 5));
  const handleZoomOut = () => setScale(s => Math.max(s - 0.5, 1));
  const handleReset = () => {
    setScale(1);
    setPosition({x: 0, y: 0});
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    if (e.deltaY < 0) handleZoomIn();
    else handleZoomOut();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setStartPos({x: e.clientX - position.x, y: e.clientY - position.y});
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault();
      setPosition({
        x: e.clientX - startPos.x,
        y: e.clientY - startPos.y
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  if (!imageUrl) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-none w-auto h-auto p-0 bg-transparent border-none shadow-none outline-none flex flex-col items-center justify-center"
        onWheel={handleWheel}
        aria-describedby="image-viewer-desc"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Képnézegető</DialogTitle>
          <DialogDescription id="image-viewer-desc">{fileName}</DialogDescription>
        </DialogHeader>

        {/* Toolbar */}
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 bg-slate-900/90 backdrop-blur-md p-2 rounded-full border border-slate-700 shadow-2xl">
          <span className="text-xs font-medium text-slate-300 px-2 max-w-[200px] truncate">{fileName}</span>
          <div className="w-px h-4 bg-slate-700 mx-1"/>
          <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white/10 text-white rounded-full"
                  onClick={handleZoomOut} disabled={scale <= 1}><ZoomOut className="w-4 h-4"/></Button>
          <span className="text-xs font-mono w-10 text-center text-yellow-500">{Math.round(scale * 100)}%</span>
          <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white/10 text-white rounded-full"
                  onClick={handleZoomIn}><ZoomIn className="w-4 h-4"/></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white/10 text-white rounded-full"
                  onClick={handleReset} title="Visszaállítás"><RotateCcw className="w-4 h-4"/></Button>
          <div className="w-px h-4 bg-slate-700 mx-1"/>
          <Button size="icon" variant="ghost"
                  className="h-8 w-8 hover:bg-red-500/20 hover:text-red-400 text-white rounded-full"
                  onClick={() => onOpenChange(false)}><X className="w-5 h-5"/></Button>
        </div>

        {/* Kép Konténer */}
        <div
          className={cn(
            "relative overflow-hidden rounded-lg shadow-2xl",
            scale > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-default"
          )}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img
            src={imageUrl}
            alt={fileName}
            className="max-w-[95vw] max-h-[90vh] object-contain transition-transform duration-75 ease-linear will-change-transform select-none"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`
            }}
            draggable={false}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}