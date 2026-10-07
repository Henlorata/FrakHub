import {useMemo, useState, type CSSProperties} from "react";
import {toast} from "sonner";
import {ArrowDown, ArrowUp, FolderTree, Loader2, Pencil, Plus, Save, Trash2, X} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {useConfirm} from "@/components/ConfirmDialog";
import {useAuth} from "@/context/AuthContext";
import {FACTION_RANKS} from "@shared/ranks";
import {FLEET_TONES, FLEET_UNITS, UNIT_LABELS} from "@/lib/fleet";
import {loadFleet, upsertFleetCategory} from "@/lib/fleet-store";
import {cn, errorMessage} from "@/lib/utils";
import type {FleetCategory, FleetTone, FleetUnit, FleetVehicle} from "@/types/supabase";

const NONE = "none";
const TONES = Object.keys(FLEET_TONES) as FleetTone[];
const COLUMNS = "id, name, description, unit, min_rank, tone, sort_order";

interface Draft {
  name: string;
  description: string;
  unit: FleetUnit | null;
  min_rank: string | null;
  tone: FleetTone;
}

const draftOf = (category: FleetCategory | null): Draft => ({
  name: category?.name ?? "", description: category?.description ?? "", unit: category?.unit ?? null,
  min_rank: category?.min_rank ?? null, tone: category?.tone ?? "orange",
});

/** An id from the name ("Marked Ford Explorer" -> "marked-ford-explorer"), unique among the categories. */
function categoryId(name: string, taken: Set<string>): string {
  const base = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 28) || "kategoria";
  let id = base.length >= 2 ? base : `${base}-k`;
  for (let index = 2; taken.has(id); index += 1) id = `${base.slice(0, 28)}-${index}`;
  return id;
}

/**
 * The vehicle categories of the fleet: rename, add, reorder, delete. Deleting asks what happens
 * to the category's vehicles: they move to another category, or they are deleted with it.
 */
export function CategoriesDialog({open, onOpenChange, categories, vehicles}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: FleetCategory[];
  vehicles: FleetVehicle[];
}) {
  const {supabase} = useAuth();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(draftOf(null));
  const [deleting, setDeleting] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState<string>(NONE);
  const [deleteVehicles, setDeleteVehicles] = useState(false);
  const [busy, setBusy] = useState(false);
  const sorted = useMemo(() => [...categories].sort((a, b) => a.sort_order - b.sort_order), [categories]);
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    vehicles.forEach((vehicle) => {
      if (vehicle.category_id) map.set(vehicle.category_id, (map.get(vehicle.category_id) ?? 0) + 1);
    });
    return map;
  }, [vehicles]);

  const startEdit = (category: FleetCategory | null) => {
    setDeleting(null);
    setEditing(category?.id ?? "new");
    setDraft(draftOf(category));
  };

  const save = async () => {
    const name = draft.name.trim();
    if (name.length < 2) return toast.error("A név legalább 2 karakter.");
    const fields = {name, description: draft.description.trim() || null, unit: draft.unit, min_rank: draft.min_rank, tone: draft.tone};
    setBusy(true);
    try {
      if (editing === "new") {
        const id = categoryId(name, new Set(categories.map((category) => category.id)));
        const sortOrder = Math.max(0, ...categories.map((category) => category.sort_order)) + 10;
        const {data, error} = await supabase.from("fleet_categories").insert({id, ...fields, sort_order: sortOrder}).select(COLUMNS).single();
        if (error) throw error;
        upsertFleetCategory(data as FleetCategory);
        toast.success(`„${name}” kategória létrehozva.`);
      } else if (editing) {
        const {data, error} = await supabase.from("fleet_categories").update(fields).eq("id", editing).select(COLUMNS).single();
        if (error) throw error;
        upsertFleetCategory(data as FleetCategory);
        toast.success("Kategória mentve.");
      }
      setEditing(null);
    } catch (error) {
      toast.error(errorMessage(error, "A mentés nem sikerült."));
    } finally {
      setBusy(false);
    }
  };

  const move = async (index: number, step: -1 | 1) => {
    const order = [...sorted];
    const [item] = order.splice(index, 1);
    order.splice(index + step, 0, item);
    // Only the rows whose place changed are written.
    const changed = order.map((category, position) => ({category, sort_order: (position + 1) * 10}))
      .filter(({category, sort_order}) => category.sort_order !== sort_order);
    setBusy(true);
    try {
      for (const {category, sort_order} of changed) {
        const {error} = await supabase.from("fleet_categories").update({sort_order}).eq("id", category.id);
        if (error) throw error;
        upsertFleetCategory({...category, sort_order});
      }
    } catch (error) {
      toast.error(errorMessage(error, "A sorrend mentése nem sikerült."));
    } finally {
      setBusy(false);
    }
  };

  const startDelete = (category: FleetCategory) => {
    setEditing(null);
    setDeleting(category.id);
    setMoveTo(sorted.find((item) => item.id !== category.id)?.id ?? NONE);
    setDeleteVehicles(false);
  };

  const remove = async (category: FleetCategory) => {
    const count = counts.get(category.id) ?? 0;
    const target = deleteVehicles || moveTo === NONE ? null : moveTo;
    if (count > 0 && !target && !deleteVehicles) return toast.error("Válaszd ki, hová kerüljenek a járművek.");
    if (!(await confirm({
      title: "Kategória törlése", confirmLabel: "Törlés", destructive: true, kind: "delete",
      description: count === 0 ? `„${category.name}” törlődik.`
        : target ? `„${category.name}” törlődik, a ${count} járműve ide kerül: ${categories.find((item) => item.id === target)?.name}.`
          : `„${category.name}” és a ${count} járműve véglegesen törlődik, a kulcsaikkal együtt. Ez nem vonható vissza.`,
    }))) return;
    setBusy(true);
    try {
      const {data, error} = await supabase.rpc("fleet_delete_category", {_category_id: category.id, _move_to: target});
      if (error) throw error;
      const result = data as {moved: number; deleted: number};
      await loadFleet(true);
      toast.success("Kategória törölve.", {
        description: result.moved ? `${result.moved} jármű áthelyezve.` : result.deleted ? `${result.deleted} jármű törölve.` : undefined,
      });
      setDeleting(null);
    } catch (error) {
      toast.error(errorMessage(error, "A törlés nem sikerült."));
    } finally {
      setBusy(false);
    }
  };

  const form = (
    <div className="animate-fade min-w-0 space-y-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-primary/30">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="category-name">Név</Label>
          <Input id="category-name" value={draft.name} maxLength={80} autoFocus placeholder="Pl. Marked Ford Explorer"
                 onChange={(event) => setDraft({...draft, name: event.target.value})}/>
        </div>
        <div className="space-y-1.5">
          <Label>Csak ennek az egységnek</Label>
          <Select value={draft.unit ?? NONE} onValueChange={(value) => setDraft({...draft, unit: value === NONE ? null : value as FleetUnit})}>
            <SelectTrigger className="w-full"><SelectValue/></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={NONE}>Bárki (nincs megkötés)</SelectItem>
              {FLEET_UNITS.map((unit) => <SelectItem key={unit} value={unit}>{UNIT_LABELS[unit]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Legalább ez a rang</Label>
          <Select value={draft.min_rank ?? NONE} onValueChange={(value) => setDraft({...draft, min_rank: value === NONE ? null : value})}>
            <SelectTrigger className="w-full"><SelectValue/></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={NONE}>Nincs megkötés</SelectItem>
              {FACTION_RANKS.map((rank) => <SelectItem key={rank} value={rank}>{rank}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="category-description">Leírás (nem kötelező)</Label>
          <Textarea id="category-description" value={draft.description} rows={2} maxLength={400}
                    onChange={(event) => setDraft({...draft, description: event.target.value})}/>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Szín</Label>
          <div className="flex flex-wrap gap-1.5">
            {TONES.map((tone) => (
              <button key={tone} type="button" onClick={() => setDraft({...draft, tone})} aria-label={tone} aria-pressed={draft.tone === tone}
                      className={cn("size-7 rounded-full ring-2 transition-transform", FLEET_TONES[tone].dot,
                        draft.tone === tone ? "scale-110 ring-white" : "ring-transparent hover:scale-105")}/>
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setEditing(null)} disabled={busy}><X/> Mégse</Button>
        <Button size="sm" onClick={() => void save()} disabled={busy}>{busy ? <Loader2 className="animate-spin"/> : <Save/>} Mentés</Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FolderTree className="size-5 text-primary"/> Járműkategóriák</DialogTitle>
          <DialogDescription>A flotta csoportjai: név, sorrend, szín, és hogy kik vihetik a járműveit.</DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-2">
          {editing === "new" ? form : (
            <Button variant="outline" size="sm" onClick={() => startEdit(null)} disabled={busy}><Plus/> Új kategória</Button>
          )}
          <ul className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1">
            {sorted.map((category, index) => {
              const count = counts.get(category.id) ?? 0;
              const tone = FLEET_TONES[category.tone] ?? FLEET_TONES.slate;
              return (
                <li key={category.id} style={{"--i": Math.min(index, 10)} as CSSProperties} className="animate-rise min-w-0 space-y-2">
                  {editing === category.id ? form : (
                    <div className="flex min-w-0 items-center gap-2 rounded-xl bg-white/[0.02] px-3 py-2 ring-1 ring-white/5">
                      <span className={cn("size-2.5 shrink-0 rounded-full", tone.dot)}/>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-100">{category.name}</span>
                        <span className="block truncate text-[11px] text-slate-500">
                          {count} jármű{category.unit ? ` · csak ${UNIT_LABELS[category.unit]}` : ""}{category.min_rank ? ` · ${category.min_rank}-tól` : ""}
                        </span>
                      </span>
                      <Button size="icon-sm" variant="ghost" aria-label="Feljebb" disabled={busy || index === 0} onClick={() => void move(index, -1)}><ArrowUp/></Button>
                      <Button size="icon-sm" variant="ghost" aria-label="Lejjebb" disabled={busy || index === sorted.length - 1}
                              onClick={() => void move(index, 1)}><ArrowDown/></Button>
                      <Button size="icon-sm" variant="ghost" aria-label={`${category.name} szerkesztése`} disabled={busy} onClick={() => startEdit(category)}><Pencil/></Button>
                      <Button size="icon-sm" variant="ghost" aria-label={`${category.name} törlése`} disabled={busy}
                              className="text-slate-400 hover:text-red-300" onClick={() => startDelete(category)}><Trash2/></Button>
                    </div>
                  )}
                  {deleting === category.id && (
                    <div className="animate-fade space-y-2.5 rounded-xl bg-red-500/[0.06] p-3 ring-1 ring-red-500/25">
                      {count === 0 ? (
                        <p className="text-sm text-slate-300">A kategóriában nincs jármű.</p>
                      ) : (
                        <>
                          <p className="text-sm text-slate-200">A kategóriában <span className="font-semibold text-white">{count} jármű</span> van. Mi legyen velük?</p>
                          <label className="flex flex-wrap items-center gap-2 text-sm text-slate-200">
                            <input type="radio" name={`delete-${category.id}`} checked={!deleteVehicles} onChange={() => setDeleteVehicles(false)}
                                   className="accent-[var(--color-primary)]"/>
                            Áthelyezés ide:
                            <Select value={moveTo} onValueChange={setMoveTo} disabled={deleteVehicles}>
                              <SelectTrigger className="h-8 w-60"><SelectValue placeholder="Válassz kategóriát"/></SelectTrigger>
                              <SelectContent className="max-h-72">
                                {sorted.filter((item) => item.id !== category.id).map((item) => (
                                  <SelectItem key={item.id} value={item.id}><span className="truncate">{item.name}</span></SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </label>
                          <label className="flex items-center gap-2 text-sm text-red-200">
                            <input type="radio" name={`delete-${category.id}`} checked={deleteVehicles} onChange={() => setDeleteVehicles(true)}
                                   className="accent-red-500"/>
                            A járművek törlése is (végleges, a kulcsokkal együtt)
                          </label>
                        </>
                      )}
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setDeleting(null)} disabled={busy}>Mégse</Button>
                        <Button size="sm" className="bg-red-600 text-white hover:bg-red-500" onClick={() => void remove(category)} disabled={busy}>
                          {busy ? <Loader2 className="animate-spin"/> : <Trash2/>} Kategória törlése
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
