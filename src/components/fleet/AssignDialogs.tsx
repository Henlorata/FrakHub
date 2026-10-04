import {useMemo, useState} from "react";
import {toast} from "sonner";
import {ArrowLeft, Clock3, KeyRound, Loader2, UserMinus} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Switch} from "@/components/ui/switch";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {LicensePlate} from "@/components/fleet/LicensePlate";
import {FeatureBadges} from "@/components/fleet/VehicleFeatures";
import {KeyMeter, PersonAvatar} from "@/components/fleet/Holders";
import {PersonPicker, VehiclePicker} from "@/components/fleet/Pickers";
import {useAuth} from "@/context/AuthContext";
import {canAssignVehicle, freeKeys, holdBlocker} from "@/lib/fleet";
import {setFleetHolders} from "@/lib/fleet-store";
import type {DirectoryProfile} from "@/lib/profile-directory";
import {cn, errorMessage} from "@/lib/utils";
import {formatDate} from "@/pages/hr/hr-utils";
import type {FleetCategory, FleetHolder, FleetVehicle} from "@/types/supabase";

const HOLDER_COLUMNS = "vehicle_id, user_id, is_temporary, note, assigned_at";

const assignError = (error: unknown) => {
  const code = (error as {code?: string} | null)?.code;
  if (code === "23505") return "Valaki már kulcsos ennél a járműnél.";
  if (code === "42501") return "Nincs jogosultságod, vagy a kiválasztott tag nem kaphatja meg ezt a járművet.";
  return errorMessage(error, "A kiosztás nem sikerült.");
};

/** Vehicles a member holds a key of, e.g. "SFSD-013, SEB-009". */
export const heldPlates = (vehicles: FleetVehicle[], userId: string) =>
  vehicles.filter((vehicle) => vehicle.holders.some((holder) => holder.user_id === userId)).map((vehicle) => vehicle.plate);

/** Hands out and takes back the keys of one vehicle. */
export function AssignKeyDialog({vehicle, category, vehicles, people, open, onOpenChange}: {
  vehicle: FleetVehicle;
  category: FleetCategory | null;
  vehicles: FleetVehicle[];
  people: DirectoryProfile[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const {supabase} = useAuth();
  const [picked, setPicked] = useState<string[]>([]);
  const [temporary, setTemporary] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const byId = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  const free = freeKeys(vehicle);
  const room = free === null ? Infinity : free;

  const toggle = (person: DirectoryProfile) => setPicked((prev) => {
    if (prev.includes(person.id)) return prev.filter((id) => id !== person.id);
    if (prev.length >= room) {
      toast.error(room === 0 ? "Nincs szabad kulcs." : `Legfeljebb ${room} kulcs adható ki.`);
      return prev;
    }
    return [...prev, person.id];
  });

  const assign = async () => {
    if (!picked.length) return;
    setSaving(true);
    const {data, error} = await supabase.from("fleet_assignments")
      .insert(picked.map((userId) => ({vehicle_id: vehicle.id, user_id: userId, is_temporary: temporary, note: note.trim() || null})))
      .select(HOLDER_COLUMNS);
    setSaving(false);
    if (error) return toast.error(assignError(error));
    setFleetHolders(vehicle.id, [...vehicle.holders, ...((data ?? []) as FleetHolder[])]);
    toast.success(picked.length > 1 ? `${picked.length} kulcs kiadva.` : "Kulcs kiadva.");
    setPicked([]);
    setNote("");
    setTemporary(false);
  };

  const revoke = async (userId: string) => {
    if (confirmRevoke !== userId) return setConfirmRevoke(userId);
    setConfirmRevoke(null);
    const {data, error} = await supabase.from("fleet_assignments").delete().eq("vehicle_id", vehicle.id).eq("user_id", userId)
      .select("user_id");
    if (error || !data?.length) return toast.error(error ? errorMessage(error) : "Nincs jogosultságod a kulcs visszavételéhez.");
    setFleetHolders(vehicle.id, vehicle.holders.filter((holder) => holder.user_id !== userId));
    toast.success("Kulcs visszavéve.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="size-5 text-amber-300"/> Kulcsok kezelése</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <LicensePlate plate={vehicle.plate} size="sm"/> {vehicle.model}{category ? ` · ${category.name}` : ""}
          </DialogDescription>
        </DialogHeader>

        <FeatureBadges vehicle={vehicle} category={category}/>

        <section className="space-y-2 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Jelenlegi kulcsosok</h3>
            <KeyMeter vehicle={vehicle}/>
          </div>
          {vehicle.holders.length === 0 ? (
            <p className="text-sm text-slate-500">{vehicle.shared_label ? `Közös jármű: ${vehicle.shared_label}.` : "Senkinél nincs kulcs."}</p>
          ) : (
            <ul className="space-y-1.5">
              {vehicle.holders.map((holder) => {
                const person = byId.get(holder.user_id);
                const blocked = person ? holdBlocker(person, vehicle, category) : null;
                return (
                  <li key={holder.user_id} className="animate-fade flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/[0.03]">
                    <PersonAvatar person={person} size="md"/>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 truncate text-sm text-slate-100">
                        {person?.full_name ?? "Ismeretlen"}
                        {holder.is_temporary && <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1 text-[10px] text-amber-300 ring-1 ring-amber-500/30"><Clock3 className="size-3"/>ideiglenes</span>}
                      </span>
                      <span className="block truncate text-[11px] text-slate-500">
                        {person?.faction_rank} · kiadva {formatDate(holder.assigned_at)}{holder.note ? ` · ${holder.note}` : ""}
                      </span>
                      {blocked && <span className="block text-[11px] text-amber-300/90">Nem felel meg a szabálynak: {blocked}</span>}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => void revoke(holder.user_id)}
                            className={cn("text-slate-400 hover:text-red-300", confirmRevoke === holder.user_id && "bg-red-500/15 text-red-200")}>
                      <UserMinus/> {confirmRevoke === holder.user_id ? "Biztosan?" : "Visszavétel"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {room > 0 ? (
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Kulcs kiadása {free !== null && <span className="font-normal normal-case text-slate-500">({free} szabad)</span>}
            </h3>
            <PersonPicker people={people} selected={picked} onToggle={toggle}
                          blocker={(person) => vehicle.holders.some((holder) => holder.user_id === person.id)
                            ? "Már kulcsos." : holdBlocker(person, vehicle, category)}
                          detail={(person) => {
                            const plates = heldPlates(vehicles, person.id);
                            return plates.length ? `Kulcsai: ${plates.slice(0, 4).join(", ")}${plates.length > 4 ? ` +${plates.length - 4}` : ""}` : null;
                          }}/>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
              <label className="flex h-9 items-center gap-2 text-sm text-slate-300">
                <Switch checked={temporary} onCheckedChange={setTemporary}/> Ideiglenes
              </label>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Megjegyzés (opcionális)</Label>
                <Input value={note} maxLength={200} onChange={(event) => setNote(event.target.value)} placeholder="Pl. a 2. kulcs SEB tartalék"/>
              </div>
            </div>
          </section>
        ) : (
          <p className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-200 ring-1 ring-amber-500/30">
            {vehicle.capacity === 0 ? "Ehhez a járműhöz nem adható ki személyes kulcs." : "Minden kulcs ki van adva. Előbb vegyél vissza egyet."}
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Bezárás</Button>
          {room > 0 && (
            <Button onClick={() => void assign()} disabled={saving || !picked.length}>
              {saving ? <Loader2 className="animate-spin"/> : <KeyRound/>} Kulcs kiadása{picked.length > 1 ? ` (${picked.length})` : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Gives a member keys of one or more vehicles; every vehicle shows who uses it already.
 * Without `person` the member is chosen first.
 */
export function AssignVehiclesDialog({person: initialPerson, vehicles, categories, people, viewer, open, onOpenChange}: {
  person?: DirectoryProfile | null;
  vehicles: FleetVehicle[];
  categories: FleetCategory[];
  people: DirectoryProfile[];
  viewer: DirectoryProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const {supabase} = useAuth();
  const [person, setPerson] = useState<DirectoryProfile | null>(initialPerson ?? null);
  const [picked, setPicked] = useState<string[]>([]);
  const [temporary, setTemporary] = useState(false);
  const [saving, setSaving] = useState(false);
  const byId = useMemo(() => new Map(people.map((item) => [item.id, item])), [people]);
  // Bureau leaders see the vehicles of their bureau only.
  const manageable = useMemo(() => {
    const categoryById = new Map(categories.map((category) => [category.id, category]));
    return vehicles.filter((vehicle) => canAssignVehicle(viewer, vehicle.category_id ? categoryById.get(vehicle.category_id) : null));
  }, [vehicles, categories, viewer]);

  const blocker = (vehicle: FleetVehicle, category: FleetCategory | null) => {
    if (!person) return null;
    if (vehicle.holders.some((holder) => holder.user_id === person.id)) return "Már kulcsos.";
    if (freeKeys(vehicle) === 0) return vehicle.capacity === 0 ? "Közös jármű, nincs személyes kulcs." : "Nincs szabad kulcs.";
    return holdBlocker(person, vehicle, category);
  };

  const assign = async () => {
    if (!person || !picked.length) return;
    setSaving(true);
    const {data, error} = await supabase.from("fleet_assignments")
      .insert(picked.map((vehicleId) => ({vehicle_id: vehicleId, user_id: person.id, is_temporary: temporary})))
      .select(HOLDER_COLUMNS);
    setSaving(false);
    if (error) return toast.error(assignError(error));
    ((data ?? []) as (FleetHolder & {vehicle_id: string})[]).forEach((row) => {
      const vehicle = vehicles.find((item) => item.id === row.vehicle_id);
      if (vehicle) setFleetHolders(vehicle.id, [...vehicle.holders, row]);
    });
    toast.success(`${person.full_name}: ${picked.length} jármű kiosztva.`);
    setPicked([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="size-5 text-amber-300"/> Jármű kiosztása</DialogTitle>
          <DialogDescription>
            {person ? <>Kinek: <span className="text-slate-200">{person.full_name}</span> · {person.faction_rank} · {person.division}</>
              : "Válaszd ki, ki kapja a kulcsot."}
          </DialogDescription>
        </DialogHeader>

        {!person ? (
          <PersonPicker people={people} selected={[]} autoFocus onToggle={(item) => setPerson(item)}
                        detail={(item) => {
                          const plates = heldPlates(vehicles, item.id);
                          return plates.length ? `Kulcsai: ${plates.join(", ")}` : "Nincs járműve.";
                        }}/>
        ) : (
          <div key={person.id} className="animate-fade space-y-3">
            {!initialPerson && (
              <Button size="sm" variant="ghost" className="text-slate-400" onClick={() => { setPerson(null); setPicked([]); }}>
                <ArrowLeft/> Másik tag
              </Button>
            )}
            <VehiclePicker vehicles={manageable} categories={categories} people={byId} selected={picked} blocker={blocker} autoFocus
                           onToggle={(vehicle) => setPicked((prev) => prev.includes(vehicle.id)
                             ? prev.filter((id) => id !== vehicle.id) : [...prev, vehicle.id])}/>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <Switch checked={temporary} onCheckedChange={setTemporary}/> Ideiglenes kiosztás
            </label>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button onClick={() => void assign()} disabled={saving || !person || !picked.length}>
            {saving ? <Loader2 className="animate-spin"/> : <KeyRound/>} Kiosztás{picked.length ? ` (${picked.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
