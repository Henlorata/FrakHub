import {useCallback, useEffect, useMemo, useState, type CSSProperties} from "react";
import {Link, useSearchParams} from "react-router";
import {toast} from "sonner";
import {
  AlertTriangle, Car, ChevronDown, FileSearch, Gauge, KeyRound, MapPin, Plus, Search, ShieldAlert, Ship,
} from "lucide-react";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import {Switch} from "@/components/ui/switch";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {EmptyState} from "@/components/layout/EmptyState";
import {LicensePlate} from "@/components/fleet/LicensePlate";
import {RegistrationBadge} from "@/components/fleet/RegistrationBadge";
import {FeatureBadges} from "@/components/fleet/VehicleFeatures";
import {HolderNames, KeyMeter} from "@/components/fleet/Holders";
import {AssignVehiclesDialog} from "@/components/fleet/AssignDialogs";
import {IssueWarningDialog} from "@/components/fleet/IssueWarningDialog";
import {useAuth} from "@/context/AuthContext";
import {useLocalStorage} from "@/hooks/use-local-storage";
import {canAssignAnyVehicle, FLEET_STATIONS, FLEET_TONES, freeKeys, UNIT_LABELS} from "@/lib/fleet";
import {useFleet} from "@/lib/fleet-store";
import {useProfileDirectory, type DirectoryProfile} from "@/lib/profile-directory";
import {registrationStatus, type RegistrationState} from "@/lib/registry";
import {cn, isStaff} from "@/lib/utils";
import type {FleetCategory, FleetVehicle, VehicleWarning} from "@/types/supabase";
import {RegistrationReviews} from "./RegistrationReviews";
import {WarningsList} from "./WarningsList";
import {TuningPanel} from "./TuningPanel";
import {VehicleEditorDialog} from "./VehicleEditorDialog";

type StatusFilter = "all" | "attention" | RegistrationState;
type View = "vehicles" | "reviews" | "warnings" | "tuning";
const ALL = "all";

const GLOW: Record<RegistrationState, string> = {
  ok: "bg-emerald-500/15",
  soon: "bg-amber-500/25",
  expired: "bg-red-500/30",
  missing: "bg-slate-500/15",
};

const vehicleState = (vehicle: FleetVehicle): RegistrationState | null =>
  vehicle.registration_required ? registrationStatus(vehicle.registration_expires_on).state : null;

/**
 * The fleet ("Car Database" sheets): every vehicle of the stock grouped like the sheet,
 * who holds its keys, its registration and special features; reviews of renewals, vehicle
 * warnings and the official tuning in sub-views.
 */
export function FleetPanel() {
  const {profile, supabase} = useAuth();
  const {vehicles, categories, error} = useFleet();
  const {profiles} = useProfileDirectory();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = (["reviews", "warnings", "tuning"].includes(searchParams.get("view") ?? "") ? searchParams.get("view") : "vehicles") as View;
  const staff = isStaff(profile);
  const people = useMemo(() => new Map(profiles.map((person) => [person.id, person])), [profiles]);
  const viewer = profile ? people.get(profile.id) ?? null : null;
  const canAssign = canAssignAnyVehicle(profile, categories);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [category, setCategory] = useState(ALL);
  const [station, setStation] = useState(ALL);
  const [mine, setMine] = useState(false);
  const [freeOnly, setFreeOnly] = useState(false);
  const [collapsed, setCollapsed] = useLocalStorage<string[]>("frakhub:fleet-collapsed", []);
  const [editing, setEditing] = useState<"new" | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [warnings, setWarnings] = useState<VehicleWarning[] | null>(null);
  const [reviewCount, setReviewCount] = useState(0);

  const setView = (next: View) => {
    const params = new URLSearchParams(searchParams);
    if (next === "vehicles") params.delete("view"); else params.set("view", next);
    setSearchParams(params, {replace: true});
  };

  // Staff: open reviews (a count only) for the tab badge.
  useEffect(() => {
    if (!staff) return;
    void supabase.from("fleet_registration_requests").select("id", {count: "exact", head: true}).eq("status", "pending")
      .then(({count}) => setReviewCount(count ?? 0));
  }, [staff, supabase]);

  const loadWarnings = useCallback(async () => {
    const {data, error: loadError} = await supabase.from("vehicle_warnings").select("*").order("created_at", {ascending: false}).limit(400);
    if (loadError) toast.error("A hibapontok betöltése nem sikerült.");
    setWarnings((data ?? []) as VehicleWarning[]);
  }, [supabase]);

  // Warnings are loaded only when needed (their list, or the points shown while issuing one).
  useEffect(() => {
    if ((view === "warnings" || issuing) && warnings === null) void loadWarnings();
  }, [view, issuing, warnings, loadWarnings]);

  const activePoints = useMemo(() => {
    const counts = new Map<string, number>();
    (warnings ?? []).filter((item) => !item.revoked_at && !item.converted_record_id)
      .forEach((item) => counts.set(item.user_id, (counts.get(item.user_id) ?? 0) + 1));
    return counts;
  }, [warnings]);

  const categoryById = useMemo(() => new Map(categories.map((item) => [item.id, item])), [categories]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (vehicles ?? []).filter((vehicle) => {
      const state = vehicleState(vehicle);
      if (category !== ALL && vehicle.category_id !== category) return false;
      if (station !== ALL && vehicle.station !== station) return false;
      if (mine && !vehicle.holders.some((holder) => holder.user_id === profile?.id)) return false;
      if (freeOnly && freeKeys(vehicle) === 0) return false;
      if (status === "attention" && (state === null || state === "ok")) return false;
      if (status !== "all" && status !== "attention" && state !== status) return false;
      if (!term) return true;
      return [vehicle.plate, vehicle.model, vehicle.callsign, vehicle.game_id, vehicle.station, vehicle.shared_label,
        ...vehicle.holders.map((holder) => people.get(holder.user_id)?.full_name)]
        .some((value) => value !== null && value !== undefined && String(value).toLowerCase().includes(term));
    });
  }, [vehicles, search, status, category, station, mine, freeOnly, people, profile?.id]);

  const counts = useMemo(() => {
    const result = {all: vehicles?.length ?? 0, attention: 0, expired: 0, soon: 0, missing: 0, ok: 0};
    (vehicles ?? []).forEach((vehicle) => {
      const state = vehicleState(vehicle);
      if (!state) return;
      result[state] += 1;
      if (state !== "ok") result.attention += 1;
    });
    return result;
  }, [vehicles]);

  const groups = useMemo(() => [...categories, null].map((item) => ({
    category: item,
    vehicles: filtered.filter((vehicle) => (item ? vehicle.category_id === item.id : !vehicle.category_id || !categoryById.has(vehicle.category_id))),
  })).filter((group) => group.vehicles.length > 0), [categories, categoryById, filtered]);

  const tabs: [View, string, typeof Car, number | null][] = [
    ["vehicles", "Járművek", Car, vehicles?.length ?? null],
    ...(staff ? [["reviews", "Forgalmi ellenőrzés", FileSearch, reviewCount] as [View, string, typeof Car, number]] : []),
    ["warnings", "Hibapontok", AlertTriangle, null],
    ["tuning", "Tuning", Gauge, null],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2" data-tour="fleet-views">
        {tabs.map(([id, label, Icon, count]) => (
          <button key={id} type="button" onClick={() => setView(id)}
                  className={cn("inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-medium ring-1 transition-all",
                    view === id ? "bg-orange-500/15 text-orange-100 ring-orange-400/40 shadow-[0_0_20px_-8px_rgb(251_146_60/0.8)]"
                      : "text-slate-400 ring-white/10 hover:text-slate-200 hover:ring-white/20")}>
            <Icon className="size-4"/>{label}
            {count !== null && count > 0 && (
              <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums",
                id === "reviews" ? "bg-amber-500/25 text-amber-200 motion-safe:animate-pulse" : "bg-white/10 text-slate-300")}>{count}</span>
            )}
          </button>
        ))}
        <div className="ml-auto flex flex-wrap gap-2" data-tour="fleet-manage">
          {staff && <Button size="sm" variant="outline" className="text-amber-200" onClick={() => setIssuing(true)}><ShieldAlert/> Hibapont</Button>}
          {canAssign && <Button size="sm" variant="outline" onClick={() => setAssigning(true)}><KeyRound/> Kiosztás</Button>}
          {staff && <Button size="sm" onClick={() => setEditing("new")}><Plus/> Új jármű</Button>}
        </div>
      </div>

      {view === "reviews" && staff ? (
        <div key="reviews" className="animate-fade">
          <RegistrationReviews vehicles={vehicles ?? []} people={people} onCountChange={setReviewCount}/>
        </div>
      ) : view === "warnings" ? (
        <div key="warnings" className="animate-fade">
          <WarningsList warnings={warnings} people={people} canManage={staff} onChanged={() => void loadWarnings()}
                        onIssue={() => setIssuing(true)}/>
        </div>
      ) : view === "tuning" ? (
        <div key="tuning" className="animate-fade"><TuningPanel canManage={staff}/></div>
      ) : (
        <div key="vehicles" data-tour="fleet-list" className="animate-fade space-y-5">
          <div className="panel flex flex-col gap-3 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative lg:w-80">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rendszám, típus, ID vagy kulcsos…" className="pl-9"/>
              </div>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="lg:w-64"><SelectValue/></SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value={ALL}>Minden kategória</SelectItem>
                  {categories.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={station} onValueChange={setStation}>
                <SelectTrigger className="lg:w-44"><MapPin className="size-3.5 text-slate-500"/><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Minden kirendeltség</SelectItem>
                  {FLEET_STATIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-4 lg:ml-auto">
                <label className="flex items-center gap-2 text-xs text-slate-400"><Switch checked={mine} onCheckedChange={setMine}/> Csak az enyéim</label>
                <label className="flex items-center gap-2 text-xs text-slate-400"><Switch checked={freeOnly} onCheckedChange={setFreeOnly}/> Szabad kulccsal</label>
              </div>
            </div>
            <div className="inline-flex flex-wrap self-start rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/10">
              {([["all", "Mind"], ["attention", "Teendő"], ["expired", "Lejárt"], ["soon", "Hamarosan"], ["missing", "Nincs dátum"], ["ok", "Érvényes"]] as const)
                .map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setStatus(value)}
                          className={cn("h-8 rounded-md px-3 text-xs font-medium transition-colors",
                            status === value ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200")}>
                    {label} <span className="ml-0.5 text-slate-500 tabular-nums">{counts[value]}</span>
                  </button>
                ))}
            </div>
          </div>

          {vehicles === null ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-40"/>)}</div>
          ) : error && vehicles.length === 0 ? (
            <div className="panel"><EmptyState icon={Car} title="A járműpark betöltése nem sikerült." compact/></div>
          ) : groups.length === 0 ? (
            <div className="panel"><EmptyState icon={Car} title={vehicles.length ? "Nincs a szűrésnek megfelelő jármű." : "Még nincs jármű a nyilvántartásban."} compact/></div>
          ) : (
            groups.map(({category: group, vehicles: list}, groupIndex) => (
              <CategorySection key={group?.id ?? "none"} category={group} vehicles={list} people={people} index={groupIndex}
                               collapsed={collapsed.includes(group?.id ?? "none")}
                               onToggle={() => setCollapsed((prev) => {
                                 const id = group?.id ?? "none";
                                 return prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
                               })}/>
            ))
          )}
        </div>
      )}

      <VehicleEditorDialog key={editing ?? "closed"} vehicle={editing} categories={categories}
                           defaultCategory={category !== ALL ? category : null} onOpenChange={(open) => !open && setEditing(null)}/>
      {assigning && (
        <AssignVehiclesDialog open vehicles={vehicles ?? []} categories={categories} people={profiles} viewer={viewer}
                              onOpenChange={setAssigning}/>
      )}
      {issuing && (
        <IssueWarningDialog open vehicles={vehicles ?? []} categories={categories} people={profiles} activePoints={activePoints}
                            onOpenChange={setIssuing} onIssued={() => void loadWarnings()}/>
      )}
    </div>
  );
}

function CategorySection({category, vehicles, people, index, collapsed, onToggle}: {
  category: FleetCategory | null;
  vehicles: FleetVehicle[];
  people: Map<string, DirectoryProfile>;
  index: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const tone = FLEET_TONES[category?.tone ?? "slate"];
  const free = vehicles.reduce((sum, vehicle) => {
    const keys = freeKeys(vehicle);
    return keys === null ? sum : sum + keys;
  }, 0);
  return (
    <section style={{"--i": Math.min(index, 8)} as CSSProperties} className="animate-rise space-y-3">
      <button type="button" onClick={onToggle} aria-expanded={!collapsed}
              className={cn("group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r to-transparent px-4 py-3 text-left ring-1 ring-white/10 transition-all hover:ring-white/20",
                tone.band)}>
        <span className={cn("pointer-events-none absolute -top-10 -left-6 size-28 rounded-full blur-2xl", tone.glow)}/>
        <span className={cn("relative size-2.5 shrink-0 rounded-full shadow-[0_0_10px_currentColor]", tone.dot, tone.text)}/>
        <span className="relative min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-white">{category?.name ?? "Kategória nélkül"}</span>
          {category?.description && <span className="block truncate text-xs text-slate-400">{category.description}</span>}
        </span>
        <span className="relative hidden flex-wrap items-center gap-1.5 sm:flex">
          {category?.unit && <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1", tone.chip)}>Csak {UNIT_LABELS[category.unit]}</span>}
          {category?.min_rank && <span className="rounded-md bg-yellow-500/10 px-1.5 py-0.5 text-[11px] font-medium text-yellow-200 ring-1 ring-yellow-500/30">Min. {category.min_rank}</span>}
        </span>
        <span className="relative text-xs text-slate-300 tabular-nums">{vehicles.length} jármű{free > 0 ? ` · ${free} szabad kulcs` : ""}</span>
        <ChevronDown className={cn("relative size-4 text-slate-400 transition-transform duration-300", collapsed && "-rotate-90")}/>
      </button>
      {!collapsed && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {vehicles.map((vehicle, vehicleIndex) => (
            <VehicleCard key={vehicle.id} vehicle={vehicle} category={category} people={people} index={vehicleIndex}/>
          ))}
        </div>
      )}
    </section>
  );
}

function VehicleCard({vehicle, category, people, index}: {
  vehicle: FleetVehicle;
  category: FleetCategory | null;
  people: Map<string, DirectoryProfile>;
  index: number;
}) {
  const state = vehicleState(vehicle);
  return (
    <Link to={`/logistics/fleet/${vehicle.id}`} style={{"--i": Math.min(index, 12)} as CSSProperties}
          className="panel lift animate-rise group relative flex min-w-0 flex-col gap-3 overflow-hidden p-4">
      <span className={cn("pointer-events-none absolute -top-12 -right-12 size-32 rounded-full blur-3xl transition-opacity duration-500 group-hover:opacity-80",
        state ? GLOW[state] : "bg-teal-500/15")}/>
      <div className="relative flex items-start justify-between gap-2">
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <LicensePlate plate={vehicle.plate}/>
          {vehicle.callsign && <span className="rounded bg-sky-500/10 px-1.5 py-0.5 font-mono text-[10.5px] text-sky-200 ring-1 ring-sky-500/30">{vehicle.callsign}</span>}
        </span>
        {vehicle.registration_required ? <RegistrationBadge expiresOn={vehicle.registration_expires_on}/> : (
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/10 px-2 py-0.5 text-[11px] text-teal-200 ring-1 ring-teal-500/30">
            <Ship className="size-3"/> Nem kell
          </span>
        )}
      </div>
      <div className="relative min-w-0">
        <h3 className="truncate text-sm font-semibold text-white group-hover:text-gold">{vehicle.model}</h3>
        <p className="truncate text-[11px] text-slate-500">{[vehicle.game_id ? `#${vehicle.game_id}` : null, vehicle.station].filter(Boolean).join(" · ")}</p>
      </div>
      <div className="relative mt-auto flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-2.5 py-1.5 ring-1 ring-white/5">
        <HolderNames vehicle={vehicle} people={people} max={2} className="min-w-0"/>
        <KeyMeter vehicle={vehicle} className="shrink-0"/>
      </div>
      <FeatureBadges vehicle={vehicle} category={category} limit={3} className="relative"/>
    </Link>
  );
}
