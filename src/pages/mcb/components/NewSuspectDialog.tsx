import {useEffect, useRef, useState} from "react";
import {Camera, Loader2, ScanFace, UserRound} from "lucide-react";
import {toast} from "sonner";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {useAuth} from "@/context/AuthContext";
import {uploadToCloudinary} from "@/lib/cloudinary";
import {SUSPECT_STATUS, SUSPECT_STATUSES} from "@/lib/mcb";
import {cn, errorMessage} from "@/lib/utils";
import type {Suspect, SuspectStatus} from "@/types/supabase";

export const GENDERS: {value: string; label: string}[] = [
  {value: "male", label: "Férfi"},
  {value: "female", label: "Nő"},
  {value: "unknown", label: "Nem ismert"},
];

/** Photo picker of a person: shows the chosen file at once, uploads when the form is saved. */
export function MugshotPicker({file, url, onFile, size = 128}: {file: File | null; url: string | null | undefined;
  onFile: (file: File | null) => void; size?: number}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  const shown = preview ?? url ?? null;

  return (
    <button type="button" onClick={() => input.current?.click()} style={{width: size, height: size * 1.25}}
            className="group relative shrink-0 overflow-hidden rounded-2xl bg-gradient-to-b from-slate-800 to-slate-950 ring-1 ring-white/15">
      {shown ? <img src={shown} alt="" className="size-full object-cover"/> : (
        <span className="grid size-full place-items-center text-slate-600"><UserRound className="size-1/2"/></span>
      )}
      <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-black/70 py-1.5 text-[11px] font-medium text-slate-200 opacity-90 transition group-hover:opacity-100">
        <Camera className="size-3.5"/>{shown ? "Csere" : "Fénykép"}
      </span>
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(transparent_calc(100%-1px),rgb(255_255_255/0.07)_1px)] bg-[size:100%_14px]"/>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(event) => {
        const next = event.target.files?.[0] ?? null;
        if (next && next.size > 10 * 1024 * 1024) toast.error("A kép legfeljebb 10 MB lehet.");
        else onFile(next);
        event.target.value = "";
      }}/>
    </button>
  );
}

interface NewSuspectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (suspect: Suspect) => void;
}

const EMPTY = {full_name: "", alias: "", gender: "male", status: "free" as SuspectStatus, gang_affiliation: "", description: ""};

export function NewSuspectDialog({open, onOpenChange, onCreated}: NewSuspectDialogProps) {
  const {supabase, user} = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY);
    setPhoto(null);
  }, [open]);

  const submit = async () => {
    const name = form.full_name.trim();
    if (!name) return toast.error("A név megadása kötelező.");
    setBusy(true);
    try {
      const mugshot = photo ? await uploadToCloudinary(photo, "mugshot") : null;
      const {data, error} = await supabase.from("suspects").insert({
        full_name: name, alias: form.alias.trim() || null, gender: form.gender, status: form.status,
        gang_affiliation: form.gang_affiliation.trim() || null, description: form.description.trim() || null,
        mugshot_url: mugshot, created_by: user?.id,
      }).select("*").single();
      if (error) throw error;
      toast.success("Adatlap létrehozva.");
      onOpenChange(false);
      onCreated(data as Suspect);
    } catch (error) {
      toast.error("Az adatlap létrehozása nem sikerült.", {description: errorMessage(error)});
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-red-500/10 text-red-300 ring-1 ring-red-500/30"><ScanFace className="size-5"/></span>
            <div>
              <DialogTitle>Új személy a nyilvántartásban</DialogTitle>
              <DialogDescription>Gyanúsítottak, tanúk, sértettek közös adatbázisa; aktákhoz később csatolható.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-5 sm:flex-row">
          <MugshotPicker file={photo} url={null} onFile={setPhoto}/>
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="suspect-name">Teljes név</Label>
              <Input id="suspect-name" value={form.full_name} autoFocus maxLength={120} onChange={(event) => setForm({...form, full_name: event.target.value})}/>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="suspect-alias">Álnév / becenév</Label>
              <Input id="suspect-alias" value={form.alias} maxLength={80} onChange={(event) => setForm({...form, alias: event.target.value})}/>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="suspect-gang">Szervezet / banda</Label>
              <Input id="suspect-gang" value={form.gang_affiliation} maxLength={80} onChange={(event) => setForm({...form, gang_affiliation: event.target.value})}/>
            </div>
            <div className="space-y-1.5">
              <Label>Nem</Label>
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-white/[0.03] p-1 ring-1 ring-white/10">
                {GENDERS.map((item) => (
                  <button key={item.value} type="button" onClick={() => setForm({...form, gender: item.value})}
                          className={cn("h-8 rounded-md text-xs transition", form.gender === item.value ? "bg-white/10 text-white" : "text-slate-400 hover:text-white")}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Státusz</Label>
              <select value={form.status} onChange={(event) => setForm({...form, status: event.target.value as SuspectStatus})}
                      className="h-10 w-full rounded-lg border bg-white/[0.03] px-3 text-sm text-slate-200">
                {SUSPECT_STATUSES.map((value) => <option key={value} value={value}>{SUSPECT_STATUS[value].label}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="suspect-description">Személyleírás, ismertetőjelek</Label>
          <Textarea id="suspect-description" value={form.description} rows={4} maxLength={4000}
                    onChange={(event) => setForm({...form, description: event.target.value})}
                    placeholder="Testalkat, tetoválások, sebhelyek, ruházat, szokások, ismert tartózkodási helyek…"/>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Mégse</Button>
          <Button onClick={() => void submit()} disabled={busy || !form.full_name.trim()} className="bg-red-600 text-white hover:bg-red-500">
            {busy && <Loader2 className="size-4 animate-spin"/>} Adatlap mentése
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
