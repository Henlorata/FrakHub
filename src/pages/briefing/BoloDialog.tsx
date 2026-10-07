import {useState, type ClipboardEvent} from "react";
import {toast} from "sonner";
import {ImagePlus, Loader2, Radar, Save, X} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {getOptimizedImageUrl, uploadToCloudinary} from "@/lib/cloudinary";
import {fromHungarian, todayKey} from "@/lib/datetime";
import {
  BOLO_DANGER, BOLO_DURATIONS, BOLO_KINDS, BOLO_REASONS, boloProblem, emptyBoloDraft, patrolApi,
  type BoloDanger, type BoloDraft, type BoloKind, type BoloReason,
} from "@/lib/patrol";
import {cn, errorMessage} from "@/lib/utils";
import {PlateBadge} from "./BoloCard";

interface BoloDialogProps {
  open: boolean;
  /** Editing an existing alert (id + draft), or a new one. */
  editing: {id: string; draft: BoloDraft} | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (id: string) => void;
}

/** A new BOLO, or the description of an existing one (vehicle or person, picture, last sighting). */
export function BoloDialog({open, editing, onOpenChange, onSaved}: BoloDialogProps) {
  const [draft, setDraft] = useState<BoloDraft>(() => editing?.draft ?? emptyBoloDraft());
  const [lastKey, setLastKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [seenTime, setSeenTime] = useState("");
  // Opening resets the form to the alert being edited (or an empty one): adjusting while rendering.
  const key = open ? editing?.id ?? "new" : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (key) {
      setDraft(editing?.draft ?? emptyBoloDraft());
      setSeenTime("");
    }
  }
  const patch = (change: Partial<BoloDraft>) => setDraft((current) => ({...current, ...change}));

  const upload = async (file: File | null | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      patch({image_url: await uploadToCloudinary(file, "bolo")});
    } catch (error) {
      toast.error("A kép feltöltése nem sikerült.", {description: errorMessage(error)});
    } finally {
      setUploading(false);
    }
  };

  const onPaste = (event: ClipboardEvent) => {
    const file = [...event.clipboardData.files].find((item) => item.type.startsWith("image/"));
    if (file) {
      event.preventDefault();
      void upload(file);
    }
  };

  const save = async () => {
    const problem = boloProblem(draft);
    if (problem) return toast.error(problem);
    setSaving(true);
    try {
      const final = {...draft, last_seen_at: seenTime ? fromHungarian(todayKey(), seenTime) : draft.last_seen_at};
      if (editing) {
        await patrolApi.update(editing.id, final);
        toast.success("BOLO frissítve.");
        onSaved(editing.id);
      } else {
        const id = await patrolApi.create(final);
        toast.success("BOLO kiadva.", {description: draft.danger === "high" ? "Mindenki értesítést kapott." : "Az eligazításon mindenki látja."});
        onSaved(id);
      }
      onOpenChange(false);
    } catch (error) {
      toast.error("A mentés nem sikerült.", {description: errorMessage(error)});
    } finally {
      setSaving(false);
    }
  };

  const kindChoice = (kind: BoloKind) => {
    const fresh = emptyBoloDraft(kind);
    patch({kind, reason: fresh.reason, hours: fresh.hours});
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl" onPaste={onPaste}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-red-500/10 text-red-300 ring-1 ring-red-500/30"><Radar className="size-5"/></span>
            <div>
              <DialogTitle>{editing ? "BOLO szerkesztése" : "Új BOLO"}</DialogTitle>
              <DialogDescription>Jármű vagy személy, akit a járőröknek figyelniük kell. Képet be is illeszthetsz (Ctrl+V).</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4">
          {!editing && (
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-white/[0.03] p-1 ring-1 ring-white/10" role="radiogroup" aria-label="Típus">
              {(Object.keys(BOLO_KINDS) as BoloKind[]).map((kind) => {
                const Icon = BOLO_KINDS[kind].icon;
                return (
                  <button key={kind} type="button" role="radio" aria-checked={draft.kind === kind} onClick={() => kindChoice(kind)}
                          className={cn("flex h-9 items-center justify-center gap-2 rounded-md text-sm font-medium transition",
                            draft.kind === kind ? "bg-white/10 text-white" : "text-slate-400 hover:text-white")}>
                    <Icon className="size-4"/>{BOLO_KINDS[kind].label}
                  </button>
                );
              })}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="bolo-title">Rövid cím</Label>
            <Input id="bolo-title" value={draft.title} maxLength={120} autoFocus
                   placeholder={draft.kind === "vehicle" ? "pl. Lopott fekete Sultan a kikötőből" : "pl. Fegyveres rabló, vörös kapucnis pulóver"}
                   onChange={(event) => patch({title: event.target.value})}/>
          </div>

          {draft.kind === "vehicle" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="bolo-plate">Rendszám</Label>
                <Input id="bolo-plate" value={draft.plate} maxLength={16} className="font-mono uppercase" placeholder="ABC-123"
                       onChange={(event) => patch({plate: event.target.value.toUpperCase()})}/>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bolo-model">Típus</Label>
                <Input id="bolo-model" value={draft.vehicle_model} maxLength={60} placeholder="Sultan" onChange={(event) => patch({vehicle_model: event.target.value})}/>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bolo-color">Szín</Label>
                <Input id="bolo-color" value={draft.vehicle_color} maxLength={40} placeholder="fekete" onChange={(event) => patch({vehicle_color: event.target.value})}/>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="bolo-person">Név (ha ismert)</Label>
              <Input id="bolo-person" value={draft.person_name} maxLength={80} placeholder="Keresztnév Vezetéknév"
                     onChange={(event) => patch({person_name: event.target.value})}/>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Ok</Label>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(BOLO_REASONS) as BoloReason[]).map((reason) => {
                  const look = BOLO_REASONS[reason];
                  return (
                    <button key={reason} type="button" aria-pressed={draft.reason === reason} onClick={() => patch({reason})}
                            className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs ring-1 transition",
                              draft.reason === reason ? "bg-white/10 text-white ring-white/30" : "text-slate-400 ring-white/10 hover:text-white")}>
                      <look.icon className="size-3.5"/>{look.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Veszélyesség</Label>
              <div className="grid grid-cols-3 gap-1">
                {(["low", "medium", "high"] as BoloDanger[]).map((danger) => (
                  <button key={danger} type="button" aria-pressed={draft.danger === danger} onClick={() => patch({danger})}
                          className={cn("h-8 rounded-lg text-xs font-medium ring-1 transition",
                            draft.danger === danger ? BOLO_DANGER[danger].chip : "text-slate-400 ring-white/10 hover:text-white")}>
                    {BOLO_DANGER[danger].label}
                  </button>
                ))}
              </div>
              {draft.danger === "high" && !editing && <p className="text-[11px] text-red-300/80">Kiadáskor minden tag értesítést kap.</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bolo-description">Leírás</Label>
            <Textarea id="bolo-description" value={draft.description} maxLength={1500} rows={3}
                      placeholder={draft.kind === "vehicle" ? "Ismertetőjegyek, sérülések, utasok, merre tartott…" : "Személyleírás, ruházat, fegyver, kísérők…"}
                      onChange={(event) => patch({description: event.target.value})}/>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
            <div className="space-y-1.5">
              <Label htmlFor="bolo-location">Utoljára látták</Label>
              <Input id="bolo-location" value={draft.last_seen_location} maxLength={120} placeholder="pl. Doherty, a vasútállomásnál"
                     onChange={(event) => patch({last_seen_location: event.target.value})}/>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bolo-time">Ma, időpont</Label>
              <Input id="bolo-time" type="time" value={seenTime} onChange={(event) => setSeenTime(event.target.value)}/>
            </div>
          </div>

          {!editing && (
            <div className="space-y-1.5">
              <Label>Érvényes</Label>
              <div className="flex flex-wrap gap-1.5">
                {BOLO_DURATIONS.map((option) => (
                  <button key={option.hours} type="button" aria-pressed={draft.hours === option.hours} onClick={() => patch({hours: option.hours})}
                          className={cn("h-8 rounded-lg px-3 text-xs ring-1 transition",
                            draft.hours === option.hours ? "bg-amber-500/15 text-amber-200 ring-amber-500/40" : "text-slate-400 ring-white/10 hover:text-white")}>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Kép (nem kötelező)</Label>
            <div className="flex items-center gap-3">
              {draft.image_url ? (
                <div className="relative">
                  <img src={getOptimizedImageUrl(draft.image_url, 240)} alt="" className="h-20 w-28 rounded-lg object-cover ring-1 ring-white/10"/>
                  <button type="button" aria-label="Kép eltávolítása" onClick={() => patch({image_url: null})}
                          className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-black/80 text-slate-200 ring-1 ring-white/20 hover:text-white">
                    <X className="size-3.5"/>
                  </button>
                </div>
              ) : (
                <label className="flex h-20 w-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/15 text-[11px] text-slate-400 hover:border-white/30 hover:text-slate-200">
                  {uploading ? <Loader2 className="size-5 animate-spin"/> : <ImagePlus className="size-5"/>}
                  {uploading ? "Feltöltés…" : "Kép választása"}
                  <input type="file" accept="image/*" className="hidden" onChange={(event) => void upload(event.target.files?.[0])}/>
                </label>
              )}
              {draft.kind === "vehicle" && draft.plate && <PlateBadge plate={draft.plate} size="lg"/>}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Mégse</Button>
          <Button onClick={() => void save()} disabled={saving || uploading} className="bg-red-600 text-white hover:bg-red-500">
            {saving ? <Loader2 className="animate-spin"/> : <Save/>} {editing ? "Mentés" : "BOLO kiadása"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
