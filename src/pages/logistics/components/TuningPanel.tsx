import {useEffect, useState, type CSSProperties} from "react";
import {toast} from "sonner";
import {useConfirm} from "@/components/ConfirmDialog";
import {Gauge, Loader2, Pencil, Plus, Save, Trash2, Wrench} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {EmptyState} from "@/components/layout/EmptyState";
import {useAuth} from "@/context/AuthContext";
import {TUNING_PARAMS} from "@/lib/fleet";
import {loadTuningPresets, replaceTuningPresets} from "@/lib/fleet-store";
import {cn, errorMessage} from "@/lib/utils";
import type {FleetTuningPreset} from "@/types/supabase";

/** The official tuning of a model, in the sheet's two columns. */
export function TuningCard({preset, index = 0, onEdit, compact}: {preset: FleetTuningPreset; index?: number; onEdit?: () => void; compact?: boolean}) {
  const half = Math.ceil(TUNING_PARAMS.length / 2);
  const columns = [TUNING_PARAMS.slice(0, half), TUNING_PARAMS.slice(half)];
  return (
    <article style={{"--i": Math.min(index, 8)} as CSSProperties} className={cn("animate-rise overflow-hidden", !compact && "panel lift")}>
      <header className={cn("flex items-center gap-3", compact ? "mb-3" : "border-b px-4 py-3")}>
        <span className="grid size-8 place-items-center rounded-lg bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/25"><Gauge className="size-4"/></span>
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{preset.model}</h3>
        {onEdit && <Button size="icon-sm" variant="ghost" title="Szerkesztés" onClick={onEdit}><Pencil className="size-4"/></Button>}
      </header>
      <div className={cn("grid grid-cols-1 gap-x-6 sm:grid-cols-2", !compact && "px-4 py-3")}>
        {columns.map((column, columnIndex) => (
          <dl key={columnIndex} className="divide-y divide-white/5">
            {column.map(([key, label]) => {
              const value = preset.settings[key] ?? "0";
              const changed = value !== "0" && value !== "";
              return (
                <div key={key} className="flex items-center justify-between gap-3 py-1.5 text-xs">
                  <dt className="text-slate-400">{label}</dt>
                  <dd className={cn("font-mono tabular-nums", changed ? "font-semibold text-cyan-200" : "text-slate-500")}>{value}</dd>
                </div>
              );
            })}
          </dl>
        ))}
      </div>
      {preset.note && <p className={cn("text-xs text-amber-200/90", compact ? "mt-2" : "border-t px-4 py-2")}>{preset.note}</p>}
    </article>
  );
}

/** "Car Database #3 [Tuning]": official tuning per model, edited by staff. */
export function TuningPanel({canManage}: {canManage: boolean}) {
  const [presets, setPresets] = useState<FleetTuningPreset[] | null>(null);
  const [editing, setEditing] = useState<FleetTuningPreset | "new" | null>(null);

  useEffect(() => {
    loadTuningPresets().then(setPresets).catch(() => {
      toast.error("A tuning beállítások betöltése nem sikerült.");
      setPresets([]);
    });
  }, []);

  const saved = (preset: FleetTuningPreset | null, removedId?: string) => {
    setPresets((prev) => {
      const next = [...(prev ?? []).filter((item) => item.id !== (preset?.id ?? removedId)), ...(preset ? [preset] : [])]
        .sort((a, b) => a.sort_order - b.sort_order || a.model.localeCompare(b.model));
      replaceTuningPresets(next);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">A frakció járműveinek hivatalos tuning beállításai. A kiemelt értékek eltérnek az alapértelmezettől.</p>
        {canManage && <Button size="sm" onClick={() => setEditing("new")}><Plus/> Új típus</Button>}
      </div>
      {presets === null ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-64"/>)}</div>
      ) : presets.length === 0 ? (
        <div className="panel"><EmptyState icon={Wrench} title="Még nincs tuning beállítás." compact/></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {presets.map((preset, index) => (
            <TuningCard key={preset.id} preset={preset} index={index} onEdit={canManage ? () => setEditing(preset) : undefined}/>
          ))}
        </div>
      )}
      <TuningEditor key={editing === "new" ? "new" : editing?.id ?? "closed"} preset={editing} onOpenChange={(open) => !open && setEditing(null)}
                    onSaved={saved}/>
    </div>
  );
}

function TuningEditor({preset, onOpenChange, onSaved}: {
  preset: FleetTuningPreset | "new" | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (preset: FleetTuningPreset | null, removedId?: string) => void;
}) {
  const {supabase} = useAuth();
  const confirm = useConfirm();
  const existing = preset && preset !== "new" ? preset : null;
  const [model, setModel] = useState(existing?.model ?? "");
  const [settings, setSettings] = useState<Record<string, string>>(existing?.settings ?? {});
  const [note, setNote] = useState(existing?.note ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (model.trim().length < 2) return toast.error("Add meg a típust (pl. Ford Explorer).");
    setSaving(true);
    const payload = {
      model: model.trim(), note: note.trim() || null,
      settings: Object.fromEntries(TUNING_PARAMS.map(([key]) => [key, (settings[key] ?? "").trim() || "0"])),
    };
    const query = existing
      ? supabase.from("fleet_tuning_presets").update(payload).eq("id", existing.id)
      : supabase.from("fleet_tuning_presets").insert({...payload, sort_order: 100});
    const {data, error} = await query.select("id, model, settings, note, sort_order, updated_at").single();
    setSaving(false);
    if (error) return toast.error(error.code === "23505" ? "Ehhez a típushoz már van beállítás." : errorMessage(error));
    onSaved(data as FleetTuningPreset);
    toast.success("Tuning mentve.");
    onOpenChange(false);
  };

  const remove = async () => {
    if (!existing || !(await confirm({title: "Tuning törlése", description: `${existing.model} tuning beállítása törlődik.`, confirmLabel: "Törlés", destructive: true, kind: "delete"}))) return;
    const {error} = await supabase.from("fleet_tuning_presets").delete().eq("id", existing.id);
    if (error) return toast.error(errorMessage(error));
    onSaved(null, existing.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={!!preset} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{existing ? "Tuning szerkesztése" : "Új tuning beállítás"}</DialogTitle>
          <DialogDescription>Minden jármű megkapja, amelynek típusa tartalmazza ezt a nevet.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Típus</Label>
            <Input value={model} maxLength={60} onChange={(event) => setModel(event.target.value)} placeholder="Pl. Ford Explorer"/>
          </div>
          {TUNING_PARAMS.map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <Label className="text-xs text-slate-400">{label}</Label>
              <Input value={settings[key] ?? ""} maxLength={12} placeholder="0" className="h-8 w-24 text-right font-mono"
                     onChange={(event) => setSettings((prev) => ({...prev, [key]: event.target.value}))}/>
            </div>
          ))}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Megjegyzés</Label>
            <Input value={note} maxLength={300} onChange={(event) => setNote(event.target.value)} placeholder="Pl. 55-ös fordulási szög"/>
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          {existing ? <Button variant="ghost" className="text-red-300" onClick={() => void remove()}><Trash2/> Törlés</Button> : <span/>}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Mégse</Button>
            <Button onClick={() => void save()} disabled={saving}>{saving ? <Loader2 className="animate-spin"/> : <Save/>} Mentés</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
