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
import {Loader2, Upload, X, FileText, HardDriveUpload} from "lucide-react";
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setFileName(selectedFile.name.split('.')[0]);
      if (selectedFile.type.startsWith('image/')) {
        setPreviewUrl(URL.createObjectURL(selectedFile));
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
    if (!file || !fileName) return toast.error("Hiányzó adatok!");
    setLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${caseId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const {error: uploadError} = await supabase.storage.from('case_evidence').upload(filePath, file);
      if (uploadError) throw uploadError;

      const {error: dbError} = await supabase.from('case_evidence').insert({
        case_id: caseId,
        file_path: filePath,
        file_name: fileName,
        file_type: file.type.startsWith('image/') ? 'image' : 'document',
        uploaded_by: user?.id
      });
      if (dbError) throw dbError;

      toast.success("Feltöltés sikeres.");
      onUploadComplete();
      handleClose();
    } catch (error: any) {
      toast.error("Hiba.", {description: error.message});
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="bg-[#0a0f1c] border border-orange-500/20 text-white sm:max-w-md p-0 overflow-hidden shadow-[0_0_40px_rgba(249,115,22,0.1)]">

        {/* Tech Header */}
        <div className="bg-orange-900/10 border-b border-orange-500/20 px-6 py-4 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
            <HardDriveUpload className="w-5 h-5 text-orange-500"/>
          </div>
          <div>
            <DialogTitle className="text-lg font-black tracking-tight text-white uppercase font-mono">BIZONYÍTÉK
              FELTÖLTÉS</DialogTitle>
            <p className="text-[10px] text-orange-500/70 font-mono tracking-widest uppercase">Evidence Ingestion
              Protocol</p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {!file ? (
            <div
              className="group relative border-2 border-dashed border-slate-800 hover:border-orange-500/50 bg-slate-950/50 rounded-xl p-8 flex flex-col items-center justify-center transition-all cursor-pointer">
              <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleFileChange}
                     accept="image/*,application/pdf,text/plain,audio/*"/>
              <div
                className="w-16 h-16 rounded-full bg-slate-900 group-hover:bg-orange-900/20 flex items-center justify-center mb-4 transition-colors">
                <Upload className="w-8 h-8 text-slate-500 group-hover:text-orange-500 transition-colors"/>
              </div>
              <p className="text-sm font-bold text-slate-300 uppercase tracking-wide">Fájl Kiválasztása</p>
              <p className="text-[10px] text-slate-500 mt-1 font-mono">DRAG & DROP VAGY KATTINTS</p>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in zoom-in duration-300">
              <div
                className="relative rounded-lg overflow-hidden border border-slate-700 bg-black/40 flex items-center justify-center h-48 group">
                {/* Rács effekt a háttérben */}
                <div className="absolute inset-0 opacity-[0.05]" style={{
                  backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)',
                  backgroundSize: '10px 10px'
                }}></div>

                <Button size="icon" variant="secondary"
                        className="absolute top-2 right-2 h-6 w-6 rounded-full opacity-70 hover:opacity-100 z-20 hover:bg-red-500 hover:text-white"
                        onClick={() => setFile(null)}>
                  <X className="w-3 h-3"/>
                </Button>

                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="h-full object-contain relative z-10"/>
                ) : (
                  <div className="flex flex-col items-center text-slate-400">
                    <FileText className="w-12 h-12 mb-2"/>
                    <span
                      className="text-xs uppercase tracking-wider font-bold">{file.name.split('.').pop()} FILE</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-slate-500">Megnevezés</Label>
                <Input value={fileName} onChange={e => setFileName(e.target.value)}
                       className="bg-slate-950 border-slate-800 font-mono text-sm" placeholder="PL. HELYSZÍNI FOTÓ A1"/>
                <p
                  className="text-[10px] text-slate-500 text-right font-mono uppercase">SIZE: {(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 bg-slate-950/50 border-t border-slate-800/50">
          <Button variant="ghost" onClick={handleClose} size="sm">Mégse</Button>
          <Button onClick={handleUpload} disabled={!file || loading} size="sm"
                  className="bg-orange-600 hover:bg-orange-500 text-white font-bold tracking-wider">
            {loading && <Loader2 className="w-3 h-3 mr-2 animate-spin"/>} RÖGZÍTÉS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}