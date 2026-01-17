import * as React from "react";
import {useAuth} from "@/context/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {Label} from "@/components/ui/label";
import {Loader2, UploadCloud, FileType, X, Image as ImageIcon, CheckCircle2} from "lucide-react";
import {toast} from "sonner";
import {cn} from "@/lib/utils";

interface UploadEvidenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  onUploadComplete: () => void;
  initialFile?: File | null;
}

export function UploadEvidenceDialog({
                                       open,
                                       onOpenChange,
                                       caseId,
                                       onUploadComplete,
                                       initialFile
                                     }: UploadEvidenceDialogProps) {
  const {supabase, user} = useAuth();

  const [file, setFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState("");
  const [isUploading, setIsUploading] = React.useState(false);
  const [isDragOver, setIsDragOver] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open && initialFile) {
      handleFileSelect(initialFile);
    }
  }, [open, initialFile]);

  React.useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setFile(null);
        setPreviewUrl(null);
        setTitle("");
        setIsDragOver(false);
        setIsUploading(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleFileSelect = (selectedFile: File) => {
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error("A fájl túl nagy! Maximum 10MB engedélyezett.");
      return;
    }

    setFile(selectedFile);

    if (selectedFile.type.startsWith("image/")) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!file || !caseId || !user) {
      toast.error("Kérlek válassz fájlt!");
      return;
    }

    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      toast.error("Rendszerhiba: Hiányzó Cloudinary konfiguráció.");
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", uploadPreset);

      const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
      const response = await fetch(uploadUrl, {method: "POST", body: formData});

      if (!response.ok) {
        throw new Error("Cloudinary feltöltési hiba");
      }

      const data = await response.json();
      const secureUrl = data.secure_url;

      const {error: dbError} = await supabase
        .from('case_evidence')
        .insert({
          case_id: caseId,
          uploaded_by: user.id,
          file_name: title.trim() || file.name,
          file_path: secureUrl,
          file_type: file.type.startsWith('image/') ? 'image' : 'document'
        });

      if (dbError) throw new Error("Adatbázis hiba: " + dbError.message);

      toast.success("Bizonyíték sikeresen rögzítve!");
      onOpenChange(false);
      onUploadComplete();

    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Hiba történt a mentés során.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#0b1120] border-2 border-slate-800 text-white sm:max-w-[500px] p-0 gap-0 overflow-hidden shadow-2xl rounded-xl transition-all duration-300 [&>button:not(.my-custom-close)]:hidden">

        <button
          onClick={() => onOpenChange(false)}
          className="my-custom-close absolute right-4 top-4 p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors z-50"
        >
          <X className="w-4 h-4 pointer-events-none"/>
        </button>

        <div
          className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-sky-500 to-transparent opacity-50"></div>
        <div className="absolute inset-0 pointer-events-none bg-[url('/grid.svg')] opacity-10"></div>

        <div className="p-6 pb-2 relative z-10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl font-bold tracking-tight text-white">
              <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20">
                <UploadCloud className="w-5 h-5 text-sky-400"/>
              </div>
              Bizonyíték Csatolása
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs pt-1">
              Digitális bizonyítékok feltöltése a Cloudinary felhőbe. <br/>
              Támogatott formátumok: JPG, PNG, PDF, DOCX.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-5 relative z-10">
          <div className="relative group">
            {!file ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "border-2 border-dashed rounded-xl h-48 flex flex-col items-center justify-center cursor-pointer transition-all duration-500 ease-out relative overflow-hidden",
                  isDragOver
                    ? "border-sky-500 bg-sky-500/10 scale-[1.02] shadow-[0_0_30px_rgba(14,165,233,0.15)]"
                    : "border-slate-700 bg-slate-900/40 hover:border-slate-500 hover:bg-slate-900/60"
                )}
              >
                <div
                  className={cn("absolute inset-0 bg-sky-500/5 transition-opacity duration-500", isDragOver ? "opacity-100" : "opacity-0")}></div>
                <div
                  className={cn("p-4 rounded-full bg-slate-800 mb-4 transition-all duration-500 shadow-xl z-10", isDragOver ? "bg-sky-500 text-white scale-110 rotate-12" : "text-slate-400")}>
                  <UploadCloud className="w-8 h-8"/>
                </div>
                <div className="text-center z-10">
                  <p
                    className={cn("text-sm font-bold transition-colors", isDragOver ? "text-sky-300" : "text-slate-200")}>
                    Kattints a feltöltéshez
                  </p>
                  <p className="text-xs text-slate-500 mt-1">vagy húzd ide a fájlt</p>
                </div>
                <input type="file" ref={fileInputRef} className="hidden" onChange={onInputChange}
                       accept="image/*,.pdf,.doc,.docx,.txt"/>
              </div>
            ) : (
              <div
                className="relative border border-slate-700 bg-slate-900/80 rounded-xl overflow-hidden group animate-in zoom-in-95 duration-300">
                <button
                  onClick={clearFile}
                  className="absolute top-3 right-3 p-1.5 bg-black/60 hover:bg-red-500 text-white rounded-full transition-all z-20 backdrop-blur-sm opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0"
                >
                  <X className="w-4 h-4"/>
                </button>
                <div className="h-40 w-full flex items-center justify-center bg-black/40 relative overflow-hidden">
                  {previewUrl ? (
                    <>
                      <img src={previewUrl} alt="Preview" className="h-full w-full object-contain relative z-10"/>
                      <img src={previewUrl} alt="Blur"
                           className="absolute inset-0 w-full h-full object-cover blur-xl opacity-30 z-0"/>
                    </>
                  ) : (
                    <div className="flex flex-col items-center text-slate-500">
                      <div className="p-4 bg-slate-800/50 rounded-full mb-2">
                        <FileType className="w-10 h-10 opacity-70"/>
                      </div>
                      <span className="text-xs uppercase font-bold tracking-widest opacity-70">Dokumentum</span>
                    </div>
                  )}
                </div>
                <div
                  className="px-4 py-3 bg-slate-950/50 border-t border-slate-800 flex items-center gap-3 backdrop-blur-md">
                  <div className="p-2 bg-sky-500/10 border border-sky-500/20 rounded-lg text-sky-400">
                    {file.type.startsWith('image/') ? <ImageIcon className="w-4 h-4"/> :
                      <FileType className="w-4 h-4"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{file.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono uppercase">
                      {Math.round(file.size / 1024)} KB • {file.type.split('/')[1] || 'FILE'}
                    </p>
                  </div>
                  <div className="text-green-500"><CheckCircle2 className="w-5 h-5"/></div>
                </div>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="title" className="text-[10px] uppercase font-bold text-slate-500 tracking-wider ml-1">
              Megnevezés / Cím (Opcionális)
            </Label>
            <div className="relative group">
              <input
                id="title"
                type="text"
                className="flex w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500 focus:bg-slate-900 focus:ring-1 focus:ring-sky-500 transition-all"
                placeholder={file ? file.name : "Add meg a bizonyíték nevét..."}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isUploading}
              />
            </div>
          </div>
        </div>

        <div className="p-6 pt-2 bg-slate-950/50 flex justify-end gap-3 border-t border-slate-800/50">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isUploading}
                  className="text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            Mégse
          </Button>
          <Button onClick={handleUpload} disabled={!file || isUploading}
                  className={cn("relative overflow-hidden bg-sky-600 hover:bg-sky-500 text-white font-bold min-w-[140px] shadow-lg shadow-sky-900/20 transition-all duration-300", isUploading && "pl-10")}>
            {isUploading && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2"><Loader2
                className="w-4 h-4 animate-spin text-white/80"/></div>
            )}
            <span className={cn("transition-all", isUploading && "opacity-90")}>
              {isUploading ? "Feltöltés..." : "Feltöltés"}
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}