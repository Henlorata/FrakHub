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
import {Loader2, DollarSign, X} from "lucide-react";

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
    if (e.target.files) {
      // Hozzáadjuk a meglévőkhöz
      setFiles(prev => [...prev, ...Array.from(e.target.files || [])]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!amount || !reason || files.length === 0) {
      toast.error("Minden mező és legalább egy bizonyíték kötelező!");
      return;
    }

    setIsLoading(true);

    try {
      const uploadedPaths: string[] = [];

      // 1. Képek feltöltése párhuzamosan
      const uploadPromises = files.map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${fileName}`;

        const {error: uploadError} = await supabase.storage
          .from('finance_proofs')
          .upload(filePath, file);

        if (uploadError) throw new Error("Feltöltési hiba: " + file.name);
        return filePath;
      });

      const paths = await Promise.all(uploadPromises);
      uploadedPaths.push(...paths);

      // 2. Adatbázis bejegyzés
      // JAVÍTÁS: A kulcs neve 'proof_image_path', nem 'proof_images'
      const insertData: any = {
        user_id: user.id,
        amount: parseInt(amount),
        reason: reason,
        proof_image_path: uploadedPaths, // Típus: string[] (a DB tömbként kezeli)
        status: 'pending'
      };

      const {error: dbError} = await (supabase.from('budget_requests') as any)
        .insert(insertData);

      if (dbError) throw dbError;

      toast.success("Költségvetési kérelem leadva!");

      // Reset
      setAmount("");
      setReason("");
      setFiles([]);
      onSuccess();
      onOpenChange(false);

    } catch (error) {
      toast.error("Hiba történt", {description: (error as Error).message});
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-500"/>
            Új Költségtérítés
          </DialogTitle>
          <DialogDescription>
            Bírságok, kiadások visszatérítése. Több bizonyíték is csatolható.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Összeg ($)</Label>
            <Input
              type="number"
              placeholder="Pl. 5000"
              className="bg-slate-950 border-slate-700"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Indoklás</Label>
            <Textarea
              placeholder="Pl. Szolgálati gépjármű tankolás, vagy téves bírság visszatérítése."
              className="bg-slate-950 border-slate-700 min-h-[80px] break-all"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Bizonyítékok (Kép/Számla)</Label>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  multiple // TÖBB FÁJL
                  className="bg-slate-950 border-slate-700 cursor-pointer"
                  onChange={handleFileChange}
                />
              </div>
              {/* Fájl lista */}
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {files.map((f, idx) => (
                    <div key={idx}
                         className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded text-xs text-slate-300">
                      <span className="truncate max-w-[100px]">{f.name}</span>
                      <button type="button" onClick={() => removeFile(idx)} className="text-red-400 hover:text-red-300">
                        <X className="w-3 h-3"/></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Mégse</Button>
            <Button type="submit" className="bg-green-700 hover:bg-green-800 text-white" disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : "Igénylés Leadása"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}