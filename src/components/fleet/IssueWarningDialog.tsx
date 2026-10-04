import {useMemo, useState, type CSSProperties} from "react";
import {toast} from "sonner";
import {AlertTriangle, Car, Loader2, Plus, ShieldAlert, Trash2, UserPlus} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {LicensePlate} from "@/components/fleet/LicensePlate";
import {PersonAvatar} from "@/components/fleet/Holders";
import {PersonPicker, VehiclePicker} from "@/components/fleet/Pickers";
import {StrikeDots} from "@/components/hr/StrikeDots";
import {useAuth} from "@/context/AuthContext";
import type {DirectoryProfile} from "@/lib/profile-directory";
import {cn, errorMessage, outranks} from "@/lib/utils";
import type {FleetCategory, FleetVehicle} from "@/types/supabase";

export interface WarningTarget {
  userId: string;
  vehicleId: string | null;
}

const NO_VEHICLE = "none";

/**
 * Vehicle warnings ("hibapont") for several people at once, for the same reason. A grave
 * case may be worth two or three points; every three active points of a member become a
 * personal warning (database trigger).
 */
export function IssueWarningDialog({open, onOpenChange, vehicles, categories, people, activePoints, initialTargets, onIssued}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicles: FleetVehicle[];
  categories: FleetCategory[];
  people: DirectoryProfile[];
  /** Active points per member (before this decision). */
  activePoints: Map<string, number>;
  initialTargets?: WarningTarget[];
  onIssued: () => void;
}) {
  const {supabase, profile} = useAuth();
  const [targets, setTargets] = useState<WarningTarget[]>(initialTargets ?? []);
  const [reason, setReason] = useState("");
  const [points, setPoints] = useState(1);
  const [adding, setAdding] = useState<"vehicle" | "person" | null>(initialTargets?.length ? null : "vehicle");
  const [saving, setSaving] = useState(false);
  const byId = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  const vehicleById = useMemo(() => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])), [vehicles]);

  const blocker = (person: DirectoryProfile) => {
    if (!profile) return "Nincs jogosultság.";
    if (person.id === profile.id) return "Saját magadnak nem adhatsz.";
    return outranks(profile, person) ? null : "Nem vagy felette a rangsorban.";
  };

  const addVehicle = (vehicle: FleetVehicle) => {
    const holders = vehicle.holders.map((holder) => holder.user_id).filter((id) => {
      const person = byId.get(id);
      return person && !blocker(person);
    });
    if (!holders.length) {
      toast.info("Ennek a járműnek nincs olyan kulcsosa, akinek hibapontot adhatsz. Add hozzá a személyt külön.");
      setAdding("person");
      return;
    }
    setTargets((prev) => [...prev, ...holders.filter((id) => !prev.some((target) => target.userId === id && target.vehicleId === vehicle.id))
      .map((userId) => ({userId, vehicleId: vehicle.id}))]);
    setAdding(null);
  };

  const addPerson = (person: DirectoryProfile) => {
    setTargets((prev) => prev.some((target) => target.userId === person.id) ? prev : [...prev, {
      userId: person.id,
      vehicleId: vehicles.find((vehicle) => vehicle.holders.some((holder) => holder.user_id === person.id))?.id ?? null,
    }]);
    setAdding(null);
  };

  const countFor = (userId: string) => targets.filter((target) => target.userId === userId).length;

  const issue = async () => {
    if (reason.trim().length < 3) return toast.error("Add meg az indokot.");
    if (!targets.length) return toast.error("Válaszd ki, kik kapják a hibapontot.");
    setSaving(true);
    const batch = crypto.randomUUID();
    const rows = targets.flatMap((target) => Array.from({length: points}, () => ({
      user_id: target.userId, vehicle_id: target.vehicleId, plate: target.vehicleId ? vehicleById.get(target.vehicleId)?.plate ?? null : null,
      reason: reason.trim(), batch_id: batch,
    })));
    const {error} = await supabase.from("vehicle_warnings").insert(rows);
    setSaving(false);
    if (error) return toast.error(errorMessage(error, "A hibapont rögzítése nem sikerült."));
    const warned = new Set(targets.filter((target) => (activePoints.get(target.userId) ?? 0) + points * countFor(target.userId) >= 3)
      .map((target) => target.userId)).size;
    toast.success(`Hibapont rögzítve ${new Set(targets.map((target) => target.userId)).size} főnek.`, {
      description: warned ? `${warned} fő automatikusan figyelmeztetést kapott.` : undefined,
    });
    onIssued();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldAlert className="size-5 text-amber-400"/> Jármű-hibapont</DialogTitle>
          <DialogDescription>Egy döntés több személyre és járműre is vonatkozhat, ugyanazzal az indokkal.</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>Indok</Label>
          <Textarea value={reason} rows={2} maxLength={300} placeholder="Pl. szabálytalan parkolás, sérülten leadott jármű"
                    onChange={(event) => setReason(event.target.value)}/>
        </div>

        <div className="space-y-1.5">
          <Label>Pontérték</Label>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((value) => (
              <button key={value} type="button" onClick={() => setPoints(value)}
                      className={cn("flex flex-col items-center gap-1 rounded-xl px-3 py-2.5 text-xs font-medium ring-1 transition-all",
                        points === value
                          ? value === 1 ? "bg-amber-500/15 text-amber-200 ring-amber-400/50" : "bg-red-500/15 text-red-200 ring-red-400/50 shadow-[0_0_18px_-6px_rgb(239_68_68/0.8)]"
                          : "text-slate-400 ring-white/10 hover:text-slate-200")}>
                <StrikeDots count={value}/>
                {value === 1 ? "Általános" : value === 2 ? "Súlyos eset" : "Rendkívül súlyos"}
              </button>
            ))}
          </div>
          {points > 1 && (
            <p className="animate-fade flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-200 ring-1 ring-red-500/25">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0"/> Ritka eset: minden érintett egyszerre {points} hibapontot kap.
            </p>
          )}
        </div>

        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Érintettek ({new Set(targets.map((target) => target.userId)).size} fő)</Label>
            <div className="flex gap-2">
              <Button size="sm" variant={adding === "vehicle" ? "secondary" : "outline"} onClick={() => setAdding(adding === "vehicle" ? null : "vehicle")}>
                <Car/> Járműből
              </Button>
              <Button size="sm" variant={adding === "person" ? "secondary" : "outline"} onClick={() => setAdding(adding === "person" ? null : "person")}>
                <UserPlus/> Személy
              </Button>
            </div>
          </div>

          {adding === "vehicle" && (
            <div className="animate-fade rounded-xl bg-white/[0.02] p-3 ring-1 ring-white/10">
              <p className="mb-2 text-xs text-slate-400">A jármű kulcsosai kerülnek a listára; utána bárkit kivehetsz.</p>
              <VehiclePicker vehicles={vehicles} categories={categories} people={byId} selected={[]} freeOnlyDefault={false}
                             onToggle={addVehicle} autoFocus/>
            </div>
          )}
          {adding === "person" && (
            <div className="animate-fade rounded-xl bg-white/[0.02] p-3 ring-1 ring-white/10">
              <PersonPicker people={people} selected={targets.map((target) => target.userId)} blocker={blocker} onToggle={addPerson} autoFocus/>
            </div>
          )}

          {targets.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 py-5 text-center text-xs text-slate-500">
              Még senki sincs kiválasztva.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {targets.map((target, index) => {
                const person = byId.get(target.userId);
                const before = activePoints.get(target.userId) ?? 0;
                const after = before + points * countFor(target.userId);
                const ownVehicles = vehicles.filter((vehicle) => vehicle.holders.some((holder) => holder.user_id === target.userId));
                return (
                  <li key={`${target.userId}-${index}`} className="animate-rise flex flex-wrap items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-white/5"
                      style={{"--i": Math.min(index, 8)} as CSSProperties}>
                    <PersonAvatar person={person} size="md"/>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-slate-100">{person?.full_name ?? "Ismeretlen"}</span>
                      <span className="flex items-center gap-2 text-[11px] text-slate-500">
                        <StrikeDots count={Math.min(before, 3)}/>
                        <span>→ {Math.min(after, 3)}/3</span>
                        {after >= 3 && <span className="rounded bg-red-500/15 px-1 text-red-300 ring-1 ring-red-500/30">figyelmeztetés lesz</span>}
                      </span>
                    </span>
                    <Select value={target.vehicleId ?? NO_VEHICLE}
                            onValueChange={(value) => setTargets((prev) => prev.map((item, i) => (i === index ? {...item, vehicleId: value === NO_VEHICLE ? null : value} : item)))}>
                      <SelectTrigger className="h-8 w-44"><SelectValue/></SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value={NO_VEHICLE}>Jármű nélkül</SelectItem>
                        {[...new Map([...ownVehicles, ...(target.vehicleId && vehicleById.get(target.vehicleId) ? [vehicleById.get(target.vehicleId)!] : [])]
                          .map((vehicle) => [vehicle.id, vehicle])).values()].map((vehicle) => (
                          <SelectItem key={vehicle.id} value={vehicle.id}>{vehicle.plate} · {vehicle.model}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {target.vehicleId && vehicleById.get(target.vehicleId) && (
                      <LicensePlate plate={vehicleById.get(target.vehicleId)!.plate} size="sm" className="hidden sm:inline-flex"/>
                    )}
                    <Button size="icon-sm" variant="ghost" title="Eltávolítás" className="text-slate-500 hover:text-red-300"
                            onClick={() => setTargets((prev) => prev.filter((_, i) => i !== index))}>
                      <Trash2 className="size-4"/>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button className="bg-amber-500 text-black hover:bg-amber-400" onClick={() => void issue()} disabled={saving || !targets.length}>
            {saving ? <Loader2 className="animate-spin"/> : <Plus/>} Rögzítés
            {targets.length > 0 && ` (${new Set(targets.map((target) => target.userId)).size} fő × ${points} pont)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
