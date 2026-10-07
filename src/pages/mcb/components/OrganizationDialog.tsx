import {useState} from "react";
import {toast} from "sonner";
import {ImagePlus, Loader2, Network, Save, X} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {getOptimizedImageUrl, uploadToCloudinary} from "@/lib/cloudinary";
import {
  emptyOrganization, ORG_COLORS, ORG_KINDS, ORG_STATUS, ORG_THREAT, organizationsApi,
  type OrganizationDraft, type OrgKind, type OrgStatus, type OrgThreat,
} from "@/lib/organizations";
import {cn, errorMessage} from "@/lib/utils";
import {OrgEmblem} from "./OrgEmblem";

interface OrganizationDialogProps {
  open: boolean;
  /** An organisation being edited, or a new one. */
  editing: {id: string; draft: OrganizationDraft} | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (id: string) => void;
}

/** A new organisation, or its details: name, kind, threat, status, colour, logo, territory, description. */
export function OrganizationDialog({open, editing, onOpenChange, onSaved}: OrganizationDialogProps) {
  const [draft, setDraft] = useState<OrganizationDraft>(() => editing?.draft ?? emptyOrganization());
  const [lastKey, setLastKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Opening resets the form (adjusting state while rendering).
  const key = open ? editing?.id ?? "new" : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (key) setDraft(editing?.draft ?? emptyOrganization());
  }
  const patch = (change: Partial<OrganizationDraft>) => setDraft((current) => ({...current, ...change}));

  const upload = async (file: File | null | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      patch({logo_url: await uploadToCloudinary(file, "organization")});
    } catch (error) {
      toast.error("A logó feltöltése nem sikerült.", {description: errorMessage(error)});
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (draft.name.trim().length < 2) return toast.error("Adj nevet a szervezetnek.");
    setSaving(true);
    try {
      if (editing) {
        await organizationsApi.update(editing.id, draft);
        toast.success("Szervezet mentve.");
        onSaved(editing.id);
      } else {
        const id = await organizationsApi.create(draft);
        toast.success("Szervezet felvéve.");
        onSaved(id);
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error, "A mentés nem sikerült.").includes("duplicate")
        ? "Ilyen nevű szervezet már van." : errorMessage(error, "A mentés nem sikerült."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-violet-500/10 text-violet-300 ring-1 ring-violet-500/30"><Network className="size-5"/></span>
            <div>
              <DialogTitle>{editing ? "Szervezet szerkesztése" : "Új bűnszervezet"}</DialogTitle>
              <DialogDescription>Banda, bűnbanda, kartell: a tagjait a nyilvántartásból veheted fel.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4">
          <div className="flex items-center gap-4 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5" aria-label="Előnézet">
            <OrgEmblem name={draft.name || "?"} color={draft.color} logoUrl={draft.logo_url} kind={draft.kind} size={56}/>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-white">{draft.name.trim() || "Szervezet neve"}</p>
              <p className="text-xs text-slate-400">{ORG_KINDS[draft.kind].label} · {ORG_THREAT[draft.threat].label} veszély</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
            <div className="space-y-1.5">
              <Label htmlFor="org-name">Név</Label>
              <Input id="org-name" value={draft.name} maxLength={80} autoFocus placeholder="pl. Grove Street Families" onChange={(event) => patch({name: event.target.value})}/>
            </div>
            <div className="space-y-1.5">
              <Label>Típus</Label>
              <select value={draft.kind} onChange={(event) => patch({kind: event.target.value as OrgKind})}
                      className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm text-slate-100">
                {(Object.keys(ORG_KINDS) as OrgKind[]).map((kind) => <option key={kind} value={kind} className="bg-[#0b1220]">{ORG_KINDS[kind].label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Veszélyesség</Label>
              <div className="grid grid-cols-4 gap-1">
                {(Object.keys(ORG_THREAT) as OrgThreat[]).map((threat) => (
                  <button key={threat} type="button" aria-pressed={draft.threat === threat} onClick={() => patch({threat})}
                          className={cn("h-8 rounded-lg text-[11px] font-medium ring-1 transition",
                            draft.threat === threat ? ORG_THREAT[threat].chip : "text-slate-400 ring-white/10 hover:text-white")}>
                    {ORG_THREAT[threat].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Állapot</Label>
              <div className="grid grid-cols-3 gap-1">
                {(Object.keys(ORG_STATUS) as OrgStatus[]).map((status) => (
                  <button key={status} type="button" aria-pressed={draft.status === status} onClick={() => patch({status})}
                          className={cn("h-8 rounded-lg text-[11px] font-medium ring-1 transition",
                            draft.status === status ? ORG_STATUS[status].chip : "text-slate-400 ring-white/10 hover:text-white")}>
                    {ORG_STATUS[status].label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Szín</Label>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Szín">
              {ORG_COLORS.map((color) => (
                <button key={color} type="button" role="radio" aria-checked={draft.color === color} aria-label={color} onClick={() => patch({color})}
                        className={cn("size-7 rounded-full ring-2 ring-offset-2 ring-offset-[#0b1220] transition",
                          draft.color === color ? "ring-white/80" : "ring-transparent hover:ring-white/30")} style={{background: color}}/>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Logó / jelkép (nem kötelező)</Label>
            <div className="flex items-center gap-3">
              {draft.logo_url ? (
                <div className="relative">
                  <img src={getOptimizedImageUrl(draft.logo_url, 160)} alt="" className="size-16 rounded-xl object-contain ring-1 ring-white/10"/>
                  <button type="button" aria-label="Logó eltávolítása" onClick={() => patch({logo_url: null})}
                          className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-black/80 text-slate-200 ring-1 ring-white/20 hover:text-white">
                    <X className="size-3.5"/>
                  </button>
                </div>
              ) : (
                <label className="flex size-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/15 text-[10px] text-slate-400 hover:border-white/30 hover:text-slate-200">
                  {uploading ? <Loader2 className="size-5 animate-spin"/> : <ImagePlus className="size-5"/>}
                  <input type="file" accept="image/*" className="hidden" onChange={(event) => void upload(event.target.files?.[0])}/>
                </label>
              )}
              <p className="text-[11px] text-slate-500">Graffiti, tetoválás vagy a szervezet jelképe; a felismerést segíti.</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="org-territory">Terület</Label>
            <Input id="org-territory" value={draft.territory} maxLength={300} placeholder="pl. Ganton, Grove Street; Doherty raktárak"
                   onChange={(event) => patch({territory: event.target.value})}/>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-description">Leírás</Label>
            <Textarea id="org-description" value={draft.description} maxLength={3000} rows={4}
                      placeholder="Felépítés, tevékenység (drog, fegyver, rablás), ismertetőjelek, szövetségesek és riválisok…"
                      onChange={(event) => patch({description: event.target.value})}/>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Mégse</Button>
          <Button onClick={() => void save()} disabled={saving || uploading} className="bg-violet-600 text-white hover:bg-violet-500">
            {saving ? <Loader2 className="animate-spin"/> : <Save/>} Mentés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
