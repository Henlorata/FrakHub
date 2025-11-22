import * as React from "react";
import {useAuth} from "@/context/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Loader2, Upload, X, Image as ImageIcon, FileText} from "lucide-react";
import {toast} from "sonner";

interface UploadEvidenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  onUploadComplete: () => void;
}

export function UploadEvidenceDialog({open, onOpenChange, caseId, onUploadComplete}: UploadEvidenceDialogProps) {
  const {supabase, user} = useAuth();
  const [loading, setLoading] = React.useState(false);

  const [file, setFile] = React.useState<File | null>(null);
  const [fileName, setFileName] = React.useState("");
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  // Fájl kiválasztásakor
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setFileName(selectedFile.name.split('.')[0]); // Kiterjesztés nélkül

      // Előnézet generálása ha kép
      if (selectedFile.type.startsWith('image/')) {
        const url = URL.createObjectURL(selectedFile);
        setPreviewUrl(url);
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const handleClose = () => {
    setFile(null);
    setFileName("");
    setPreviewUrl(null);
    onOpenChange(false);
  }

  const handleUpload = async () => {
    if (!file) return toast.error("Válassz egy fájlt!");
    if (!fileName) return toast.error("Adj meg egy nevet a bizonyítéknak!");

    setLoading(true);
    try {
      // 1. Fájl feltöltése Storage-ba
      const fileExt = file.name.split('.').pop();
      const filePath = `${caseId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const {error: uploadError} = await supabase.storage
        .from('case_evidence')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Rekord létrehozása az adatbázisban
      const {error: dbError} = await supabase.from('case_evidence').insert({
        case_id: caseId,
        file_path: filePath,
        file_name: fileName, // A felhasználó által megadott "szép" név
        file_type: file.type.startsWith('image/') ? 'image' : 'document',
        uploaded_by: user?.id
      });

      if (dbError) throw dbError;

      toast.success("Bizonyíték sikeresen feltöltve!");
      onUploadComplete();
      handleClose();

    } catch (error: any) {
      console.error(error);
      toast.error("Hiba a feltöltés során.", {description: error.message});
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bizonyíték Csatolása</DialogTitle>
          <DialogDescription>Tölts fel képet, dokumentumot vagy hangfájlt.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* DRAG & DROP HELYETT EGYSZERŰ INPUT */}
          {!file ? (
            <div
              className="border-2 border-dashed border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center text-slate-500 hover:border-yellow-500/50 hover:bg-slate-950/50 transition-all cursor-pointer relative">
              <input
                type="file"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={handleFileChange}
                accept="image/*,application/pdf,text/plain,audio/*"
              />
              <Upload className="w-10 h-10 mb-2 opacity-50"/>
              <p className="text-sm font-medium">Kattints vagy húzd ide a fájlt</p>
              <p className="text-xs opacity-70">Kép, PDF, Hang (Max 50MB)</p>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in zoom-in duration-300">
              {/* PREVIEW */}
              <div
                className="relative rounded-lg overflow-hidden border border-slate-700 bg-black/40 flex items-center justify-center h-48">
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute top-2 right-2 h-6 w-6 rounded-full opacity-70 hover:opacity-100"
                  onClick={() => setFile(null)}
                >
                  <X className="w-3 h-3"/>
                </Button>

                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="h-full object-contain"/>
                ) : (
                  <div className="flex flex-col items-center text-slate-400">
                    <FileText className="w-12 h-12 mb-2"/>
                    <span className="text-xs uppercase tracking-wider font-bold">Dokumentum</span>
                  </div>
                )}
              </div>

              {/* NÉV MEGADÁSA */}
              <div className="space-y-2">
                <Label>Bizonyíték Neve (Megnevezés)</Label>
                <Input
                  value={fileName}
                  onChange={e => setFileName(e.target.value)}
                  className="bg-slate-950 border-slate-800"
                  placeholder="pl. Helyszíni fotó #1"
                />
                <p
                  className="text-[10px] text-slate-500 text-right">{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>Mégse</Button>
          <Button onClick={handleUpload} disabled={!file || loading}
                  className="bg-yellow-600 hover:bg-yellow-700 text-black">
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>} Feltöltés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}