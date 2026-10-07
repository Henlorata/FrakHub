import {lazy, Suspense, useCallback, useEffect, useRef, useState, type ClipboardEvent, type DragEvent} from "react";
import {Brush, CheckCircle2, FileText, ImagePlus, Loader2, UploadCloud, X, XCircle} from "lucide-react";
import {toast} from "sonner";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {useAuth} from "@/context/AuthContext";
import {uploadToCloudinary} from "@/lib/cloudinary";
import {cn, errorMessage} from "@/lib/utils";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 20;
const ACCEPT = "image/*,.pdf,.doc,.docx,.txt";

interface UploadItem {
  key: string;
  file: File;
  preview: string | null;
  name: string;
  status: "ready" | "uploading" | "done" | "error";
  error?: string;
}

const baseName = (file: File) => file.name.replace(/\.[^.]+$/, "") || "Bizonyíték";

// The drawing tool loads only when it is opened.
const ImageAnnotator = lazy(() => import("@/components/annotate/ImageAnnotator").then((module) => ({default: module.ImageAnnotator})));

interface UploadEvidenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  /** Files dropped or pasted on the case page. */
  initialFiles: File[];
  onUploaded: (count: number) => void;
}

/** Uploads several files to Cloudinary (images compressed first), then records them in one insert. */
export function UploadEvidenceDialog({open, onOpenChange, caseId, initialFiles, onUploaded}: UploadEvidenceDialogProps) {
  const {supabase, user} = useAuth();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [annotating, setAnnotating] = useState<UploadItem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: File[]) => {
    const accepted: UploadItem[] = [];
    for (const file of files) {
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name}: legfeljebb 10 MB lehet.`);
        continue;
      }
      accepted.push({
        key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`, file, name: baseName(file), status: "ready",
        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      });
    }
    setItems((list) => {
      const next = [...list, ...accepted];
      if (next.length > MAX_FILES) toast.error(`Egyszerre legfeljebb ${MAX_FILES} fájl tölthető fel.`);
      return next.slice(0, MAX_FILES);
    });
  }, []);

  useEffect(() => {
    if (open && initialFiles.length > 0) addFiles(initialFiles);
  }, [open, initialFiles, addFiles]);

  // Previews pin the files in memory: released when the dialog closes.
  useEffect(() => {
    if (open) return;
    setItems((list) => {
      list.forEach((item) => item.preview && URL.revokeObjectURL(item.preview));
      return [];
    });
  }, [open]);

  const update = (key: string, patch: Partial<UploadItem>) =>
    setItems((list) => list.map((item) => (item.key === key ? {...item, ...patch} : item)));

  /** The drawn picture replaces the chosen file (the original is never uploaded). */
  const annotated = (key: string, file: File) => {
    setItems((list) => list.map((item) => {
      if (item.key !== key) return item;
      if (item.preview) URL.revokeObjectURL(item.preview);
      return {...item, file, preview: URL.createObjectURL(file)};
    }));
    setAnnotating(null);
  };

  const upload = async () => {
    if (!user) return;
    const queue = items.filter((item) => item.status === "ready" || item.status === "error");
    if (queue.length === 0) return;
    setBusy(true);
    const rows: {case_id: string; uploaded_by: string; file_name: string; file_path: string; file_type: string}[] = [];
    // Two uploads at a time: fast enough, and gentle on a slow connection.
    const pending = [...queue];
    const worker = async () => {
      for (let item = pending.shift(); item; item = pending.shift()) {
        update(item.key, {status: "uploading", error: undefined});
        try {
          const url = await uploadToCloudinary(item.file, "evidence");
          rows.push({case_id: caseId, uploaded_by: user.id, file_name: item.name.trim() || item.file.name, file_path: url,
            file_type: item.file.type.startsWith("image/") ? "image" : "document"});
          update(item.key, {status: "done"});
        } catch (error) {
          update(item.key, {status: "error", error: errorMessage(error)});
        }
      }
    };
    await Promise.all([worker(), worker()]);

    if (rows.length > 0) {
      const {error} = await supabase.from("case_evidence").insert(rows);
      if (error) {
        toast.error("A bizonyítékok rögzítése nem sikerült.", {description: errorMessage(error)});
        setBusy(false);
        return;
      }
      toast.success(rows.length === 1 ? "Bizonyíték csatolva." : `${rows.length} bizonyíték csatolva.`);
      onUploaded(rows.length);
    }
    setBusy(false);
    if (rows.length === queue.length) onOpenChange(false);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    addFiles([...event.dataTransfer.files]);
  };
  const onPaste = (event: ClipboardEvent) => {
    const files = [...event.clipboardData.files];
    if (files.length > 0) {
      event.preventDefault();
      addFiles(files);
    }
  };

  const ready = items.filter((item) => item.status !== "done").length;

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl" onPaste={onPaste}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30">
              <UploadCloud className="size-5"/>
            </span>
            <div>
              <DialogTitle>Bizonyítékok csatolása</DialogTitle>
              <DialogDescription>Képek (tömörítve), PDF és Word fájlok, egyenként legfeljebb 10 MB. Beillesztés: Ctrl+V.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <button type="button" onClick={() => inputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)} onDrop={onDrop}
                className={cn("flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition",
                  dragOver ? "border-amber-400 bg-amber-500/10" : "border-white/15 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]")}>
          <ImagePlus className={cn("size-8 transition", dragOver ? "scale-110 text-amber-300" : "text-slate-500")}/>
          <span className="text-sm font-medium text-slate-200">Kattints, húzd ide vagy illeszd be a fájlokat</span>
          <span className="text-xs text-slate-500">Egyszerre legfeljebb {MAX_FILES} fájl</span>
        </button>
        <input ref={inputRef} type="file" multiple accept={ACCEPT} className="hidden"
               onChange={(event) => {
                 addFiles([...(event.target.files ?? [])]);
                 event.target.value = "";
               }}/>

        {items.length > 0 && (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <li key={item.key} className="flex min-w-0 items-center gap-3 rounded-xl bg-white/[0.03] p-2 ring-1 ring-white/10">
                <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-black/40">
                  {item.preview ? <img src={item.preview} alt="" className="size-full object-cover"/> : <FileText className="size-6 text-slate-500"/>}
                </div>
                <div className="min-w-0 flex-1">
                  <input value={item.name} disabled={item.status === "uploading" || item.status === "done"} maxLength={120}
                         onChange={(event) => update(item.key, {name: event.target.value})} aria-label="Megnevezés"
                         className="w-full rounded-md bg-transparent px-1 py-0.5 text-sm text-white ring-1 ring-transparent outline-none focus:ring-white/20"/>
                  <p className="truncate px-1 text-[11px] text-slate-500">
                    {item.status === "error" ? <span className="text-red-300">{item.error}</span> : `${Math.max(1, Math.round(item.file.size / 1024))} KB`}
                  </p>
                </div>
                {item.preview && (item.status === "ready" || item.status === "error") && (
                  <button type="button" aria-label="Jelölés a képen" title="Nyíl, keret, felirat, kitakarás a képen" disabled={busy}
                          onClick={() => setAnnotating(item)}
                          className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-amber-300">
                    <Brush className="size-4"/>
                  </button>
                )}
                {item.status === "uploading" ? <Loader2 className="size-4 shrink-0 animate-spin text-sky-300"/>
                  : item.status === "done" ? <CheckCircle2 className="size-4 shrink-0 text-emerald-400"/>
                    : item.status === "error" ? <XCircle className="size-4 shrink-0 text-red-400"/>
                      : (
                        <button type="button" aria-label="Eltávolítás" disabled={busy}
                                onClick={() => setItems((list) => list.filter((entry) => entry.key !== item.key))}
                                className="rounded-md p-1 text-slate-500 hover:bg-white/10 hover:text-white">
                          <X className="size-4"/>
                        </button>
                      )}
              </li>
            ))}
          </ul>
        )}

        {annotating?.preview && (
          <Suspense fallback={null}>
            <ImageAnnotator src={annotating.preview} name={annotating.file.name} onCancel={() => setAnnotating(null)}
                            onSave={(file) => annotated(annotating.key, file)}/>
          </Suspense>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Mégse</Button>
          <Button onClick={() => void upload()} disabled={busy || ready === 0} className="bg-amber-500 text-black hover:bg-amber-400">
            {busy ? <Loader2 className="size-4 animate-spin"/> : <UploadCloud className="size-4"/>}
            {ready > 1 ? `${ready} fájl feltöltése` : "Feltöltés"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
