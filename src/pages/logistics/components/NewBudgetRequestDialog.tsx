import * as React from "react";
import { useAuth } from "@/context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, DollarSign, Upload } from "lucide-react";

interface NewBudgetRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function NewBudgetRequestDialog({ open, onOpenChange, onSuccess }: NewBudgetRequestDialogProps) {
  const { supabase, user } = useAuth();
  const [isLoading, setIsLoading] = React.useState(false);

  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!amount || !reason || !file) {
      toast.error("Minden mező és a bizonyíték kép kötelező!");
      return;
    }

    setIsLoading(true);

    try {
      // 1. Kép feltöltése
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`; // Root-ba tesszük a bucketben

      const { error: uploadError } = await supabase.storage
        .from('finance_proofs')
        .upload(filePath, file);

      if (uploadError) throw new Error("Képfeltöltés sikertelen: " + uploadError.message);

      // 2. Adatbázis bejegyzés
      const insertData: any = {
        user_id: user.id,
        amount: parseInt(amount),
        reason: reason,
        proof_image_path: filePath,
        status: 'pending'
      };

      const { error: dbError } = await (supabase.from('budget_requests') as any)
        .insert(insertData);

      if (dbError) throw dbError;

      toast.success("Költségvetési kérelem leadva!");

      // Reset
      setAmount("");
      setReason("");
      setFile(null);
      onSuccess();
      onOpenChange(false);

    } catch (error) {
      toast.error("Hiba történt", { description: (error as Error).message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-500" />
            Új Költségtérítés
          </DialogTitle>
          <DialogDescription>
            Bírságok, kiadások visszatérítése. Bizonyíték kötelező.
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
              className="bg-slate-950 border-slate-700 min-h-[80px]"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Bizonyíték (Kép/Számla)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/*"
                className="bg-slate-950 border-slate-700 cursor-pointer"
                onChange={handleFileChange}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Mégse</Button>
            <Button type="submit" className="bg-green-700 hover:bg-green-800 text-white" disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Igénylés Leadása"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}