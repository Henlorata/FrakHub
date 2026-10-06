import {useEffect, useMemo, useState, type FormEvent} from "react";
import {toast} from "sonner";
import {ImagePlus, Loader2, Receipt, Send, X} from "lucide-react";
import {Dialog, DialogContent, DialogDescription, DialogTitle} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {useAuth} from "@/context/AuthContext";
import {compressImage} from "@/lib/image-compression";
import {formatMoney, parseMoney} from "@/lib/finance";
import {errorMessage} from "@/lib/utils";

// Proof screenshots: 1920px WebP keeps them readable and ~10x smaller in Storage.
const PROOF_COMPRESSION = {maxDimension: 1920, quality: 0.85};
const MAX_FILES = 6;

interface NewBudgetRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

/** A member's reimbursement claim: amount, what it was for and screenshots as proof. */
export function NewBudgetRequestDialog({open, onOpenChange, onSuccess}: NewBudgetRequestDialogProps) {
  const {supabase, user} = useAuth();
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);

  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const addFiles = (list: FileList | null) => {
    const images = Array.from(list ?? []).filter((file) => file.type.startsWith("image/"));
    setFiles((current) => [...current, ...images].slice(0, MAX_FILES));
  };

  const value = parseMoney(amount);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (!value || value <= 0) return toast.error("Adj meg egy pozitív összeget.");
    if (!reason.trim()) return toast.error("Írd le, mire ment a pénz.");
    if (files.length === 0) return toast.error("Csatolj legalább egy bizonylatot.");

    setSaving(true);
    let paths: string[] = [];
    try {
      paths = await Promise.all(files.map(async (original) => {
        const file = await compressImage(original, PROOF_COMPRESSION);
        const extension = file.name.split(".").pop();
        const name = `${user.id}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${extension}`;
        const {error} = await supabase.storage.from("finance_proofs").upload(name, file, {contentType: file.type});
        if (error) throw error;
        return name;
      }));
      const {error} = await supabase.from("budget_requests").insert({
        user_id: user.id, amount: value, reason: reason.trim(), proof_image_path: paths, status: "pending",
      });
      if (error) throw error;
      toast.success("Kérelem beküldve. A Command Staff bírálja el.");
      setAmount("");
      setReason("");
      setFiles([]);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      // Do not leave orphaned proof images in the bucket.
      if (paths.length) void supabase.storage.from("finance_proofs").remove(paths);
      toast.error(errorMessage(error, "A beküldés nem sikerült."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <div className="border-b border-white/5 p-5">
          <DialogTitle className="flex items-center gap-2"><Receipt className="size-4 text-emerald-400"/> Költségtérítési kérelem</DialogTitle>
          <DialogDescription className="mt-1">Szolgálati kiadás visszaigénylése. A bizonylatok a döntés után 40 nappal törlődnek.</DialogDescription>
        </div>

        <form onSubmit={(event) => void submit(event)} className="space-y-5 p-5">
          <div className="space-y-1.5">
            <Label htmlFor="budget-amount">Összeg</Label>
            <div className="relative">
              <Input id="budget-amount" inputMode="numeric" autoFocus placeholder="pl. 25 000" value={amount}
                     onChange={(event) => setAmount(event.target.value.replace(/[^\d\s]/g, ""))}
                     className="h-12 pr-10 font-mono text-xl tabular-nums"/>
              <span className="absolute top-1/2 right-4 -translate-y-1/2 font-mono text-lg text-emerald-400">$</span>
            </div>
            {value ? <p className="text-xs text-slate-400">{formatMoney(value)}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="budget-reason">Mire ment?</Label>
            <Textarea id="budget-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500}
                      placeholder="pl. Javítás a szolgálati járművön (SFSD-012), üzemanyag…" className="min-h-24"/>
          </div>

          <div className="space-y-2">
            <Label>Bizonylatok <span className="font-normal text-slate-500">({files.length}/{MAX_FILES})</span></Label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {previews.map((url, index) => (
                <div key={url} className="group relative aspect-video overflow-hidden rounded-lg ring-1 ring-white/10">
                  <img src={url} alt={files[index]?.name ?? ""} className="size-full object-cover"/>
                  <button type="button" onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                          aria-label="Bizonylat eltávolítása"
                          className="absolute top-1 right-1 grid size-6 place-items-center rounded-md bg-black/70 text-slate-200 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100">
                    <X className="size-3.5"/>
                  </button>
                </div>
              ))}
              {files.length < MAX_FILES && (
                <label className="lift relative grid aspect-video cursor-pointer place-items-center rounded-lg border border-dashed border-white/15 bg-white/[0.02] text-slate-400 transition-colors hover:border-emerald-400/50 hover:text-emerald-300">
                  <input type="file" accept="image/*" multiple className="absolute inset-0 cursor-pointer opacity-0"
                         onChange={(event) => {
                           addFiles(event.target.files);
                           event.target.value = "";
                         }}/>
                  <span className="flex flex-col items-center gap-1 text-[11px]"><ImagePlus className="size-5"/> Kép</span>
                </label>
              )}
            </div>
            <p className="text-[11px] text-slate-500">Képernyőképek a számláról vagy a tranzakcióról. Feltöltés előtt tömörítjük őket.</p>
          </div>

          <div className="flex justify-end gap-2 border-t border-white/5 pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Mégse</Button>
            <Button type="submit" disabled={saving} className="bg-emerald-500 text-black hover:bg-emerald-400">
              {saving ? <Loader2 className="animate-spin"/> : <Send/>} Beküldés
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
