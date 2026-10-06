import {useRef, useState, type ClipboardEvent, type DragEvent, type ReactNode} from "react";
import {ClipboardPaste, FileImage, ImageUp} from "lucide-react";
import {cn} from "@/lib/utils";

const MAX_FILE = 15 * 1024 * 1024;

/** Why a picked file cannot be read (Hungarian), or null when it is a usable image. */
export function imageFileProblem(file: File): string | null {
  if (!file.type.startsWith("image/")) return "Képfájlt válassz (PNG, JPG vagy WEBP).";
  if (file.size > MAX_FILE) return "A kép legfeljebb 15 MB lehet.";
  return null;
}

/** The image of a paste event (a screenshot from the clipboard), if any. */
export function pastedImage(event: ClipboardEvent): File | null {
  const item = [...event.clipboardData.items].find((entry) => entry.type.startsWith("image/"));
  const pasted = item?.getAsFile();
  return pasted ? new File([pasted], pasted.name || "kepernyokep.png", {type: pasted.type}) : null;
}

/** Click, drop or paste (the paste is handled by the dialog) a screenshot; with `multiple` several at once. */
export function ImageDropZone({title, hint, onFile, multiple = false}: {title: string; hint: ReactNode; onFile: (file: File) => void; multiple?: boolean}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const files = [...(event.dataTransfer.files ?? [])];
    (multiple ? files : files.slice(0, 1)).forEach(onFile);
  };

  return (
    <>
      <button type="button" onClick={() => inputRef.current?.click()}
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)} onDrop={onDrop}
              className={cn("group relative flex w-full flex-col items-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all",
                dragging ? "scale-[1.01] border-primary bg-primary/10 shadow-[0_0_40px_-10px_rgb(234_179_8/0.6)]"
                  : "border-white/15 bg-white/[0.02] hover:border-primary/50 hover:bg-white/[0.04]")}>
        <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgb(234_179_8/0.12),transparent_60%)] opacity-0 transition-opacity group-hover:opacity-100"/>
        <span className="relative grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/25 motion-safe:animate-[float-y_4s_ease-in-out_infinite]">
          <ImageUp className="size-7"/>
        </span>
        <span className="relative">
          <span className="block text-sm font-semibold text-white">{title}</span>
          <span className="mt-1 block text-xs text-slate-400">{hint}</span>
        </span>
        <span className="relative flex flex-wrap justify-center gap-2 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 ring-1 ring-white/10"><FileImage className="size-3"/> PNG, JPG, WEBP</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 ring-1 ring-white/10"><ClipboardPaste className="size-3"/> Beillesztés</span>
        </span>
      </button>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" multiple={multiple}
             onChange={(event) => {
               const files = [...(event.target.files ?? [])];
               event.target.value = "";
               (multiple ? files : files.slice(0, 1)).forEach(onFile);
             }}/>
    </>
  );
}
