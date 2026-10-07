import {useState, type ReactNode} from "react";
import {toast} from "sonner";
import {useConfirm} from "@/components/ConfirmDialog";
import {Loader2, Save, Trash2} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Switch} from "@/components/ui/switch";
import {Textarea} from "@/components/ui/textarea";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {useAuth} from "@/context/AuthContext";
import {FLEET_STATIONS, FLEET_UNITS, UNIT_LABELS} from "@/lib/fleet";
import {removeFleetVehicle, upsertFleetVehicle, VEHICLE_COLUMNS} from "@/lib/fleet-store";
import {cn, errorMessage} from "@/lib/utils";
import {FACTION_RANKS, type FleetCategory, type FleetUnit, type FleetVehicle} from "@/types/supabase";

const INHERIT = "inherit";
const UNLIMITED = "unlimited";
type UnitMode = "inherit" | "anyone" | "custom";

/** Supervisory staff and above add and edit vehicles of the stock (keys are handed out separately). */
export function VehicleEditorDialog({vehicle, categories, defaultCategory, onOpenChange, onSaved}: {
  vehicle: FleetVehicle | "new" | null;
  categories: FleetCategory[];
  defaultCategory?: string | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: (vehicle: FleetVehicle | null) => void;
}) {
  const {supabase} = useAuth();
  const confirm = useConfirm();
  const existing = vehicle && vehicle !== "new" ? vehicle : null;
  const [plate, setPlate] = useState(existing?.plate ?? "");
  const [model, setModel] = useState(existing?.model ?? "");
  const [categoryId, setCategoryId] = useState(existing?.category_id ?? defaultCategory ?? categories[0]?.id ?? "other");
  const [gameId, setGameId] = useState(existing?.game_id ? String(existing.game_id) : "");
  const [station, setStation] = useState(existing?.station ?? "Downtown");
  const [callsign, setCallsign] = useState(existing?.callsign ?? "");
  const [capacity, setCapacity] = useState(existing ? (existing.capacity === null ? UNLIMITED : String(existing.capacity)) : "2");
  const [sharedLabel, setSharedLabel] = useState(existing?.shared_label ?? "");
  const [unitMode, setUnitMode] = useState<UnitMode>(existing?.allowed_units == null ? "inherit" : existing.allowed_units.length ? "custom" : "anyone");
  const [units, setUnits] = useState<FleetUnit[]>(existing?.allowed_units ?? []);
  const [minRank, setMinRank] = useState(existing?.min_rank ?? INHERIT);
  const [unmarked, setUnmarked] = useState(existing?.is_unmarked ?? false);
  const [registrationRequired, setRegistrationRequired] = useState(existing?.registration_required ?? true);
  const [expires, setExpires] = useState(existing?.registration_expires_on ?? "");
  const [licenseName, setLicenseName] = useState(existing?.license_name ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const category = categories.find((item) => item.id === categoryId) ?? null;

  const save = async () => {
    if (plate.trim().length < 2 || plate.trim().length > 16) return toast.error("A rendszám 2–16 karakter lehet.");
    if (!model.trim()) return toast.error("Add meg a jármű típusát.");
    if (gameId && !/^\d{1,8}$/.test(gameId.trim())) return toast.error("Az azonosító csak szám lehet.");
    if (unitMode === "custom" && !units.length) return toast.error("Válassz legalább egy egységet, vagy állítsd „Kategória szerint”-re.");
    setSaving(true);
    const payload = {
      plate: plate.trim().toUpperCase(), model: model.trim(), category_id: categoryId, game_id: gameId ? Number(gameId) : null,
      station: station || null, callsign: callsign.trim().toUpperCase() || null,
      capacity: capacity === UNLIMITED ? null : Number(capacity), shared_label: sharedLabel.trim() || null,
      allowed_units: unitMode === "inherit" ? null : unitMode === "anyone" ? [] : units,
      min_rank: minRank === INHERIT ? null : minRank, is_unmarked: unmarked, registration_required: registrationRequired,
      registration_expires_on: expires || null, license_name: licenseName.trim() || null, notes: notes.trim() || null,
    };
    const {data, error} = existing
      ? await supabase.from("fleet_vehicles").update(payload).eq("id", existing.id).select(VEHICLE_COLUMNS).single()
      : await supabase.from("fleet_vehicles").insert(payload).select(VEHICLE_COLUMNS).single();
    setSaving(false);
    if (error) {
      return toast.error(error.code === "23505" ? "Ez a rendszám már szerepel a nyilvántartásban." : errorMessage(error, "A mentés nem sikerült."));
    }
    const saved = data as unknown as FleetVehicle;
    upsertFleetVehicle(saved);
    onSaved?.(saved);
    toast.success(existing ? "Jármű frissítve." : "Jármű felvéve a nyilvántartásba.");
    onOpenChange(false);
  };

  const retire = async () => {
    if (!existing || !(await confirm({title: "Jármű kivezetése", description: `${existing.plate} kikerül a flottából, a kulcsosok elveszítik a kulcsukat.`, confirmLabel: "Kivezetés", destructive: true}))) return;
    const {error} = await supabase.from("fleet_vehicles").update({is_active: false}).eq("id", existing.id);
    if (error) return toast.error(errorMessage(error, "A művelet nem sikerült."));
    // Keys of a retired vehicle are worthless: take them back (notifies the holders).
    await supabase.from("fleet_assignments").delete().eq("vehicle_id", existing.id);
    removeFleetVehicle(existing.id);
    onSaved?.(null);
    toast.success("Jármű kivezetve.");
    onOpenChange(false);
  };

  return (
    <Dialog open={!!vehicle} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{existing ? "Jármű szerkesztése" : "Új jármű"}</DialogTitle>
          <DialogDescription>Nyilvántartási adatok, kulcsok száma és használati szabályok.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Rendszám">
            <Input value={plate} maxLength={16} className="font-mono uppercase tracking-widest" onChange={(event) => setPlate(event.target.value)}/>
          </Field>
          <Field label="Típus">
            <Input value={model} maxLength={60} placeholder="Pl. Ford Explorer" onChange={(event) => setModel(event.target.value)}/>
          </Field>
          <Field label="Kategória">
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-full"><SelectValue/></SelectTrigger>
              <SelectContent className="max-h-72">
                {categories.map((item) => <SelectItem key={item.id} value={item.id}><span className="truncate">{item.name}</span></SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Játékbeli azonosító (ID)">
            <Input value={gameId} inputMode="numeric" maxLength={8} className="font-mono" onChange={(event) => setGameId(event.target.value.replace(/\D/g, ""))}/>
          </Field>
          <Field label="Kirendeltség">
            <Select value={station} onValueChange={setStation}>
              <SelectTrigger className="w-full"><SelectValue/></SelectTrigger>
              <SelectContent>{FLEET_STATIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Hívójel (ha eltér a rendszámtól)">
            <Input value={callsign} maxLength={16} placeholder="Pl. AIR-001" className="font-mono uppercase" onChange={(event) => setCallsign(event.target.value)}/>
          </Field>
          <Field label="Személyes kulcsok">
            <Select value={capacity} onValueChange={setCapacity}>
              <SelectTrigger className="w-full"><SelectValue/></SelectTrigger>
              <SelectContent>
                {["0", "1", "2", "3", "4", "5", "6", "8", "10"].map((value) => (
                  <SelectItem key={value} value={value}>{value === "0" ? "Nincs (közös jármű)" : `${value} kulcs`}</SelectItem>
                ))}
                <SelectItem value={UNLIMITED}>Korlátlan</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Közös jármű (kinek a járműve)">
            <Input value={sharedLabel} maxLength={60} placeholder="Pl. Medical Unit, SEB Staff" onChange={(event) => setSharedLabel(event.target.value)}/>
          </Field>
          <div className="space-y-2 sm:col-span-2">
            <Label>Kik kaphatnak kulcsot</Label>
            <div className="inline-flex flex-wrap rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/10">
              {([["inherit", `Kategória szerint${category?.unit ? ` (${UNIT_LABELS[category.unit]})` : " (bárki)"}`], ["anyone", "Bárki"], ["custom", "Egyedi"]] as const)
                .map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setUnitMode(value)}
                          className={cn("h-8 rounded-md px-3 text-xs font-medium transition-colors", unitMode === value ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200")}>
                    {label}
                  </button>
                ))}
            </div>
            {unitMode === "custom" && (
              <div className="animate-fade flex flex-wrap gap-1.5">
                {FLEET_UNITS.map((unit) => {
                  const active = units.includes(unit);
                  return (
                    <button key={unit} type="button" onClick={() => setUnits((prev) => (active ? prev.filter((item) => item !== unit) : [...prev, unit]))}
                            className={cn("rounded-md px-2 py-1 text-xs ring-1 transition-colors", active ? "bg-primary/15 text-primary ring-primary/40" : "text-slate-400 ring-white/10 hover:text-slate-200")}>
                      {UNIT_LABELS[unit]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <Field label="Minimális rang">
            <Select value={minRank} onValueChange={setMinRank}>
              <SelectTrigger className="w-full"><SelectValue/></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={INHERIT}>Kategória szerint{category?.min_rank ? ` (${category.min_rank})` : " (nincs)"}</SelectItem>
                {FACTION_RANKS.map((rank) => <SelectItem key={rank} value={rank}>{rank}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Forgalmi érvényes">
            <Input type="date" value={expires} disabled={!registrationRequired} onChange={(event) => setExpires(event.target.value)}/>
          </Field>
          <label className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2 text-sm text-slate-200 ring-1 ring-white/5">
            Jelöletlen (civil) jármű <Switch checked={unmarked} onCheckedChange={setUnmarked}/>
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2 text-sm text-slate-200 ring-1 ring-white/5">
            Forgalmi engedély kell <Switch checked={registrationRequired} onCheckedChange={setRegistrationRequired}/>
          </label>
          <Field label="Név a forgalmin (ha eltér a típustól)" className="sm:col-span-2">
            <Input value={licenseName} maxLength={80} placeholder="Az automatikus forgalmi-felismerés ezzel is összeveti"
                   onChange={(event) => setLicenseName(event.target.value)}/>
          </Field>
          <Field label="Megjegyzés" className="sm:col-span-2">
            <Textarea value={notes} rows={2} maxLength={500} onChange={(event) => setNotes(event.target.value)}/>
          </Field>
        </div>
        <DialogFooter className="sm:justify-between">
          {existing ? <Button variant="ghost" className="text-red-300" onClick={() => void retire()}><Trash2/> Kivezetés</Button> : <span/>}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Mégse</Button>
            <Button onClick={() => void save()} disabled={saving}>{saving ? <Loader2 className="animate-spin"/> : <Save/>} Mentés</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({label, className, children}: {label: string; className?: string; children: ReactNode}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
