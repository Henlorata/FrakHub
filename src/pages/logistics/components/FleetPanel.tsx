import {useCallback, useEffect, useMemo, useState, type CSSProperties} from "react";
import {toast} from "sonner";
import {
  AlertTriangle, Car, Loader2, Pencil, Plus, RefreshCw, Save, Search, ShieldAlert, Trash2, Undo2, UserRound,
} from "lucide-react";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Button} from "@/components/ui/button";
import {Textarea} from "@/components/ui/textarea";
import {Switch} from "@/components/ui/switch";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {EmptyState} from "@/components/layout/EmptyState";
import {LicensePlate} from "@/components/fleet/LicensePlate";
import {RegistrationBadge} from "@/components/fleet/RegistrationBadge";
import {RenewRegistrationDialog} from "@/components/fleet/RenewRegistrationDialog";
import {StrikeDots} from "@/components/hr/StrikeDots";
import {useAuth} from "@/context/AuthContext";
import {getOptimizedAvatarUrl} from "@/lib/cloudinary";
import {useProfileDirectory, type DirectoryProfile} from "@/lib/profile-directory";
import {registrationStatus, type RegistrationState} from "@/lib/registry";
import {cn, errorMessage} from "@/lib/utils";
import {formatDate} from "@/pages/hr/hr-utils";
import type {FleetVehicle, VehicleWarning} from "@/types/supabase";

const VEHICLE_COLUMNS = "id, plate, model, owner_id, registration_expires_on, notes, is_active, created_at, updated_at";
type StatusFilter = "all" | "attention" | RegistrationState;

const GLOW: Record<RegistrationState, string> = {
  ok: "bg-emerald-500/20",
  soon: "bg-amber-500/25",
  expired: "bg-red-500/30",
  missing: "bg-slate-500/20",
};

/**
 * The fleet ("Car Database" sheets): who has which vehicle, whether its registration is
 * valid, and vehicle warnings. Three active warnings of an owner become one personal
 * warning automatically (database trigger).
 */
export function FleetPanel({canManage}: {canManage: boolean}) {
  const {supabase, profile} = useAuth();
  const {profiles} = useProfileDirectory();
  const [vehicles, setVehicles] = useState<FleetVehicle[] | null>(null);
  const [warnings, setWarnings] = useState<VehicleWarning[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [mine, setMine] = useState(!canManage);
  const [editing, setEditing] = useState<FleetVehicle | "new" | null>(null);
  const [renewing, setRenewing] = useState<FleetVehicle | null>(null);
  const [warning, setWarning] = useState<FleetVehicle | null>(null);

  const load = useCallback(async () => {
    const [vehicleResult, warningResult] = await Promise.all([
      supabase.from("fleet_vehicles").select(VEHICLE_COLUMNS).eq("is_active", true).order("plate"),
      supabase.from("vehicle_warnings").select("*").order("created_at", {ascending: false}).limit(200),
    ]);
    if (vehicleResult.error) toast.error("A járműpark betöltése nem sikerült.");
    setVehicles((vehicleResult.data ?? []) as FleetVehicle[]);
    setWarnings((warningResult.data ?? []) as VehicleWarning[]);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const people = useMemo(() => new Map(profiles.map((person) => [person.id, person])), [profiles]);
  const activeWarnings = useMemo(() => {
    const counts = new Map<string, number>();
    warnings.filter((item) => !item.revoked_at && !item.converted_record_id && item.user_id)
      .forEach((item) => counts.set(item.user_id!, (counts.get(item.user_id!) ?? 0) + 1));
    return counts;
  }, [warnings]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (vehicles ?? []).filter((vehicle) => {
      const state = registrationStatus(vehicle.registration_expires_on).state;
      if (mine && vehicle.owner_id !== profile?.id) return false;
      if (status === "attention" && state === "ok") return false;
      if (status !== "all" && status !== "attention" && state !== status) return false;
      if (!term) return true;
      const owner = vehicle.owner_id ? people.get(vehicle.owner_id) : null;
      return vehicle.plate.toLowerCase().includes(term) || vehicle.model.toLowerCase().includes(term)
        || !!owner?.full_name.toLowerCase().includes(term) || !!owner?.badge_number.includes(term);
    });
  }, [vehicles, search, status, mine, people, profile?.id]);

  const counts = useMemo(() => {
    const result = {all: vehicles?.length ?? 0, attention: 0, expired: 0, soon: 0, missing: 0, ok: 0};
    (vehicles ?? []).forEach((vehicle) => {
      const state = registrationStatus(vehicle.registration_expires_on).state;
      result[state] += 1;
      if (state !== "ok") result.attention += 1;
    });
    return result;
  }, [vehicles]);

  const upsertVehicle = (vehicle: FleetVehicle) => setVehicles((prev) =>
    [...(prev ?? []).filter((item) => item.id !== vehicle.id), vehicle].filter((item) => item.is_active)
      .sort((a, b) => a.plate.localeCompare(b.plate)));

  const revoke = async (item: VehicleWarning, restore = false) => {
    const {data, error} = await supabase.from("vehicle_warnings").update({revoked_at: restore ? null : new Date().toISOString()})
      .eq("id", item.id).select("*").single();
    if (error) return toast.error(errorMessage(error, "A művelet nem sikerült."));
    setWarnings((prev) => prev.map((row) => (row.id === item.id ? data as VehicleWarning : row)));
    toast.success(restore ? "Hibapont visszaállítva." : "Hibapont visszavonva.");
  };

  const visibleWarnings = warnings.filter((item) => canManage || item.user_id === profile?.id).slice(0, 30);

  return (
    <div className="space-y-6">
      <div className="panel flex flex-col gap-3 p-4 xl:flex-row xl:items-center">
        <div className="relative xl:w-72">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rendszám, típus vagy tulajdonos…" className="pl-9"/>
        </div>
        <div className="inline-flex flex-wrap rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/10">
          {([["all", "Mind"], ["attention", "Teendő"], ["expired", "Lejárt"], ["soon", "Hamarosan"], ["missing", "Nincs dátum"], ["ok", "Érvényes"]] as const)
            .map(([value, label]) => (
              <button key={value} type="button" onClick={() => setStatus(value)}
                      className={cn("h-8 rounded-md px-3 text-xs font-medium transition-colors",
                        status === value ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200")}>
                {label} <span className="ml-0.5 text-slate-500 tabular-nums">{counts[value]}</span>
              </button>
            ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <Switch checked={mine} onCheckedChange={setMine}/> Csak az enyéim
        </label>
        {canManage && <Button className="xl:ml-auto" onClick={() => setEditing("new")}><Plus/> Új jármű</Button>}
      </div>

      {vehicles === null ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-48"/>)}</div>
      ) : filtered.length === 0 ? (
        <div className="panel"><EmptyState icon={Car} title={vehicles.length ? "Nincs a szűrésnek megfelelő jármű." : "Még nincs jármű a nyilvántartásban."}
                                           description="A jóváhagyott járműigénylések automatikusan bekerülnek." compact/></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((vehicle, index) => {
            const owner = vehicle.owner_id ? people.get(vehicle.owner_id) ?? null : null;
            const state = registrationStatus(vehicle.registration_expires_on).state;
            const ownerWarnings = vehicle.owner_id ? activeWarnings.get(vehicle.owner_id) ?? 0 : 0;
            const isOwner = vehicle.owner_id === profile?.id;
            return (
              <article key={vehicle.id} style={{"--i": Math.min(index, 12)} as CSSProperties}
                       className="panel lift animate-rise group relative flex flex-col gap-4 overflow-hidden p-5">
                <div className={cn("pointer-events-none absolute -top-12 -right-12 size-36 rounded-full blur-3xl", GLOW[state])}/>
                <div className="relative flex items-start justify-between gap-3">
                  <LicensePlate plate={vehicle.plate} size="lg"/>
                  <RegistrationBadge expiresOn={vehicle.registration_expires_on}/>
                </div>
                <div className="relative min-w-0">
                  <h3 className="flex items-center gap-2 truncate text-base font-semibold text-white"><Car className="size-4 text-orange-400"/>{vehicle.model}</h3>
                  {vehicle.notes && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 wrap-anywhere">{vehicle.notes}</p>}
                </div>
                <div className="relative flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-white/5">
                  <OwnerChip owner={owner}/>
                  {owner && (canManage || isOwner) && <StrikeDots count={ownerWarnings}/>}
                </div>
                <div className="relative mt-auto flex flex-wrap gap-2">
                  {(canManage || isOwner) && (
                    <Button size="sm" variant={state === "ok" ? "outline" : "default"} onClick={() => setRenewing(vehicle)}>
                      <RefreshCw/> Forgalmi megújítva
                    </Button>
                  )}
                  {canManage && owner && (
                    <Button size="sm" variant="outline" className="text-amber-300" onClick={() => setWarning(vehicle)}>
                      <ShieldAlert/> Hibapont
                    </Button>
                  )}
                  {canManage && (
                    <Button size="icon-sm" variant="ghost" className="ml-auto" title="Szerkesztés" onClick={() => setEditing(vehicle)}>
                      <Pencil className="size-4"/>
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {visibleWarnings.length > 0 && (
        <section className="panel overflow-hidden">
          <header className="flex items-center gap-3 border-b px-5 py-4">
            <div className="grid size-9 place-items-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/25"><AlertTriangle className="size-4 text-amber-400"/></div>
            <div>
              <h2 className="text-sm font-semibold text-white">Jármű-hibapontok</h2>
              <p className="text-xs text-slate-500">Három aktív hibapont után a tulajdonos automatikusan figyelmeztetést kap.</p>
            </div>
          </header>
          <ul className="divide-y divide-white/5">
            {visibleWarnings.map((item) => {
              const owner = item.user_id ? people.get(item.user_id) ?? null : null;
              const issuer = item.issued_by ? people.get(item.issued_by) ?? null : null;
              const inactive = !!item.revoked_at || !!item.converted_record_id;
              return (
                <li key={item.id} className={cn("flex flex-wrap items-center gap-3 px-5 py-3", inactive && "opacity-55")}>
                  <LicensePlate plate={item.plate} size="sm"/>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-200 wrap-anywhere">{item.reason}</p>
                    <p className="text-xs text-slate-500">
                      {owner?.full_name ?? "Ismeretlen"} · {formatDate(item.created_at)}{issuer && ` · kiadta: ${issuer.full_name}`}
                    </p>
                  </div>
                  {item.converted_record_id ? (
                    <span className="rounded-md bg-red-500/10 px-2 py-0.5 text-[11px] text-red-300 ring-1 ring-red-500/30">Figyelmeztetés lett</span>
                  ) : item.revoked_at ? (
                    canManage
                      ? <Button size="sm" variant="ghost" onClick={() => void revoke(item, true)}><Undo2/> Visszaállítás</Button>
                      : <span className="text-[11px] text-slate-500">Visszavonva</span>
                  ) : canManage ? (
                    <Button size="sm" variant="ghost" className="text-slate-400 hover:text-red-300" onClick={() => void revoke(item)}>
                      <Trash2/> Visszavonás
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <RenewRegistrationDialog key={`renew-${renewing?.id ?? "none"}`} vehicle={renewing} onOpenChange={(open) => !open && setRenewing(null)}
                               onRenewed={upsertVehicle}/>
      <VehicleDialog key={`edit-${editing === "new" ? "new" : editing?.id ?? "closed"}`} vehicle={editing} people={profiles}
                     onOpenChange={(open) => !open && setEditing(null)} onSaved={upsertVehicle}
                     onRemoved={(id) => setVehicles((prev) => (prev ?? []).filter((item) => item.id !== id))}/>
      <WarningDialog key={`warn-${warning?.id ?? "none"}`} vehicle={warning} owner={warning?.owner_id ? people.get(warning.owner_id) ?? null : null}
                     activeCount={warning?.owner_id ? activeWarnings.get(warning.owner_id) ?? 0 : 0}
                     onOpenChange={(open) => !open && setWarning(null)} onIssued={() => void load()}/>
    </div>
  );
}

function OwnerChip({owner}: {owner: DirectoryProfile | null}) {
  if (!owner) return <span className="flex items-center gap-2 text-xs text-slate-500"><UserRound className="size-4"/> Nincs hozzárendelve</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar className="size-7 ring-1 ring-white/10">
        <AvatarImage src={getOptimizedAvatarUrl(owner.avatar_url, 56) || undefined} alt=""/>
        <AvatarFallback className="bg-slate-800 text-[10px] font-semibold text-slate-300">{owner.full_name.charAt(0)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0">
        <span className="block truncate text-sm text-slate-100">{owner.full_name}</span>
        <span className="block truncate text-[11px] text-slate-500">{owner.faction_rank} · #{owner.badge_number}</span>
      </span>
    </span>
  );
}

function VehicleDialog({vehicle, people, onOpenChange, onSaved, onRemoved}: {
  vehicle: FleetVehicle | "new" | null;
  people: DirectoryProfile[];
  onOpenChange: (open: boolean) => void;
  onSaved: (vehicle: FleetVehicle) => void;
  onRemoved: (id: string) => void;
}) {
  const {supabase} = useAuth();
  const existing = vehicle && vehicle !== "new" ? vehicle : null;
  const [plate, setPlate] = useState(existing?.plate ?? "");
  const [model, setModel] = useState(existing?.model ?? "");
  const [ownerId, setOwnerId] = useState(existing?.owner_id ?? "none");
  const [expires, setExpires] = useState(existing?.registration_expires_on ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const members = people.filter((person) => person.system_role !== "pending");

  const save = async () => {
    if (plate.trim().length < 2 || plate.trim().length > 16) return toast.error("A rendszám 2–16 karakter lehet.");
    if (!model.trim()) return toast.error("Add meg a jármű típusát.");
    setSaving(true);
    const payload = {
      plate: plate.trim().toUpperCase(), model: model.trim(), owner_id: ownerId === "none" ? null : ownerId,
      registration_expires_on: expires || null, notes: notes.trim() || null,
    };
    const {data, error} = existing
      ? await supabase.from("fleet_vehicles").update(payload).eq("id", existing.id).select(VEHICLE_COLUMNS).single()
      : await supabase.from("fleet_vehicles").insert(payload).select(VEHICLE_COLUMNS).single();
    setSaving(false);
    if (error) {
      return toast.error(error.code === "23505" ? "Ez a rendszám már szerepel a nyilvántartásban." : errorMessage(error, "A mentés nem sikerült."));
    }
    toast.success(existing ? "Jármű frissítve." : "Jármű felvéve.");
    onSaved(data as FleetVehicle);
    onOpenChange(false);
  };

  const retire = async () => {
    if (!existing || !window.confirm(`${existing.plate} kivezetése a flottából?`)) return;
    const {error} = await supabase.from("fleet_vehicles").update({is_active: false}).eq("id", existing.id);
    if (error) return toast.error(errorMessage(error, "A művelet nem sikerült."));
    toast.success("Jármű kivezetve.");
    onRemoved(existing.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={!!vehicle} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Jármű szerkesztése" : "Új jármű"}</DialogTitle>
          <DialogDescription>Kiosztás és forgalmi engedély.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Rendszám</Label>
            <Input value={plate} maxLength={16} className="font-mono uppercase tracking-widest" onChange={(event) => setPlate(event.target.value)}/>
          </div>
          <div className="space-y-1.5">
            <Label>Típus</Label>
            <Input value={model} maxLength={60} placeholder="Pl. Buffalo STX" onChange={(event) => setModel(event.target.value)}/>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Tulajdonos (kinek van kiosztva)</Label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger className="w-full"><SelectValue/></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="none">Nincs hozzárendelve</SelectItem>
                {members.map((person) => <SelectItem key={person.id} value={person.id}>{person.full_name} · #{person.badge_number}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Forgalmi érvényes</Label>
            <Input type="date" value={expires} onChange={(event) => setExpires(event.target.value)}/>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Megjegyzés</Label>
            <Textarea value={notes} rows={2} maxLength={500} onChange={(event) => setNotes(event.target.value)}/>
          </div>
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

function WarningDialog({vehicle, owner, activeCount, onOpenChange, onIssued}: {
  vehicle: FleetVehicle | null; owner: DirectoryProfile | null; activeCount: number;
  onOpenChange: (open: boolean) => void; onIssued: () => void;
}) {
  const {supabase} = useAuth();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const becomesWarning = activeCount + 1 >= 3;

  const issue = async () => {
    if (!vehicle) return;
    if (reason.trim().length < 3) return toast.error("Add meg az indokot.");
    setSaving(true);
    const {error} = await supabase.from("vehicle_warnings").insert({vehicle_id: vehicle.id, plate: vehicle.plate, reason: reason.trim()});
    setSaving(false);
    if (error) return toast.error(errorMessage(error, "A hibapont rögzítése nem sikerült."));
    toast.success(becomesWarning ? "Hibapont rögzítve – a tulajdonos automatikusan figyelmeztetést kapott." : "Hibapont rögzítve.");
    onIssued();
    onOpenChange(false);
  };

  return (
    <Dialog open={!!vehicle} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldAlert className="size-5 text-amber-400"/> Jármű-hibapont</DialogTitle>
          <DialogDescription>{vehicle?.plate} – {vehicle?.model} · {owner?.full_name ?? "Nincs tulajdonos"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/5">
            <span className="text-sm text-slate-300">Jelenlegi hibapontok</span>
            <StrikeDots count={activeCount}/>
          </div>
          {becomesWarning && (
            <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-red-500/30">
              Ez a harmadik hibapont: a tulajdonos automatikusan személyes figyelmeztetést kap.
            </p>
          )}
          <div className="space-y-1.5">
            <Label>Indok</Label>
            <Textarea value={reason} rows={3} maxLength={300} placeholder="Pl. szabálytalan parkolás, sérülten leadott jármű"
                      onChange={(event) => setReason(event.target.value)}/>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button className="bg-amber-500 text-black hover:bg-amber-400" onClick={() => void issue()} disabled={saving}>
            {saving ? <Loader2 className="animate-spin"/> : <ShieldAlert/>} Rögzítés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
