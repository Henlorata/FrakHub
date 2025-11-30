import * as React from "react";
import {useAuth} from "@/context/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {toast} from "sonner";
import {Loader2, DollarSign, X, Receipt, UploadCloud} from "lucide-react";

interface NewBudgetRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function NewBudgetRequestDialog({open, onOpenChange, onSuccess}: NewBudgetRequestDialogProps) {
  const {supabase, user} = useAuth();
  const [isLoading, setIsLoading] = React.useState(false);
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files || [])]);
  };
  const removeFile = (index: number) => setFiles(prev => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!amount || !reason || files.length === 0) {
      toast.error("Minden mező és bizonyíték kötelező!");
      return;
    }

    setIsLoading(true);
    try {
      const uploadPromises = files.map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const {error} = await supabase.storage.from('finance_proofs').upload(fileName, file);
        if (error) throw error;
        return fileName;
      });
      const paths = await Promise.all(uploadPromises);

      const {error} = await (supabase.from('budget_requests') as any).insert({
        user_id: user.id, amount: parseInt(amount), reason: reason, proof_image_path: paths, status: 'pending'
      });
      if (error) throw error;

      toast.success("Kérelem rögzítve.");
      setAmount("");
      setReason("");
      setFiles([]);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error("Hiba történt");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#0b1221] border border-green-500/30 text-white sm:max-w-[450px] p-0 overflow-hidden shadow-[0_0_40px_rgba(34,197,94,0.1)]">

        {/* Header */}
        <div className="bg-green-500/10 border-b border-green-500/20 p-5 flex items-center gap-3">
          <div
            className="p-2.5 border border-green-500/50 rounded bg-green-500/10 text-green-500 shadow-[0_0_10px_rgba(34,197,94,0.2)]">
            <Receipt className="w-6 h-6"/>
          </div>
          <div>
            <DialogTitle
              className="text-lg font-black uppercase tracking-tighter font-mono text-white">KÖLTSÉGTÉRÍTÉS</DialogTitle>
            <p className="text-[10px] text-green-500/70 font-mono tracking-widest uppercase font-bold">EXPENSE CLAIM
              FORM #FC-2024</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Igényelt Összeg ($)</Label>
            <div className="relative group">
              <DollarSign
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500 group-focus-within:text-green-400 transition-colors"/>
              <Input type="number" placeholder="0.00"
                     className="pl-10 bg-slate-950 border-slate-700 font-mono text-xl text-white h-12 focus-visible:ring-green-500/50 placeholder:text-slate-700"
                     value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus/>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Kiadás Részletei</Label>
            <Textarea placeholder="RÖVID LEÍRÁS A KIADÁSRÓL..."
                      className="bg-slate-950 border-slate-700 min-h-[100px] font-mono text-xs focus-visible:ring-green-500/50 resize-none placeholder:text-slate-700 break-all"
                      value={reason} onChange={(e) => setReason(e.target.value)}/>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Bizonyítékok
              Csatolása</Label>
            <div
              className="border-2 border-dashed border-slate-700 rounded-lg p-5 bg-slate-950/30 hover:border-green-500/50 hover:bg-slate-950/80 transition-all text-center cursor-pointer relative group">
              <input type="file" accept="image/*" multiple className="absolute inset-0 opacity-0 cursor-pointer z-10"
                     onChange={handleFileChange}/>
              <div className="flex flex-col items-center gap-2">
                <div className="p-2 rounded-full bg-slate-900 group-hover:bg-green-900/20 transition-colors">
                  <UploadCloud className="w-6 h-6 text-slate-500 group-hover:text-green-500"/>
                </div>
                <p className="text-xs text-slate-400 group-hover:text-white transition-colors font-medium">Kattints vagy
                  húzd ide a fájlokat</p>
              </div>
            </div>

            {files.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {files.map((f, i) => (
                  <div key={i}
                       className="flex items-center gap-2 bg-slate-900 pl-3 pr-1 py-1 rounded border border-slate-700 text-[10px] font-mono text-slate-300">
                    <span className="truncate max-w-[120px]">{f.name}</span>
                    <button type="button" onClick={() => removeFile(i)}
                            className="p-1 hover:bg-red-900/50 rounded text-red-400 hover:text-red-300"><X
                      className="w-3 h-3"/></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 border-t border-slate-800">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}
                    className="hover:bg-slate-800 text-slate-400">MÉGSE</Button>
            <Button type="submit"
                    className="bg-green-600 hover:bg-green-500 text-black font-bold uppercase tracking-wider px-6"
                    disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : "LEADÁS"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}