import {useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode} from "react";
import {Link, useParams} from "react-router";
import {toast} from "sonner";
import {
  AlertTriangle, ArrowLeft, CalendarClock, Car, Clock3, FileText, Gauge, Hash, History, KeyRound, MapPin, Pencil, Radio, ShieldAlert,
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {EmptyState} from "@/components/layout/EmptyState";
import {LicensePlate} from "@/components/fleet/LicensePlate";
import {RegistrationBadge} from "@/components/fleet/RegistrationBadge";
import {vehicleFeatures} from "@/components/fleet/VehicleFeatures";
import {KeyMeter, PersonAvatar} from "@/components/fleet/Holders";
import {AssignKeyDialog} from "@/components/fleet/AssignDialogs";
import {IssueWarningDialog} from "@/components/fleet/IssueWarningDialog";
import {RegistrationDialog} from "@/components/fleet/RegistrationDialog";
import {useAuth} from "@/context/AuthContext";
import {canAssignVehicle, canSubmitRegistration, FLEET_TONES, holdBlocker, tuningFor} from "@/lib/fleet";
import {fetchFleetVehicle, loadTuningPresets, useFleet} from "@/lib/fleet-store";
import {useProfileDirectory} from "@/lib/profile-directory";
import {registrationStatus} from "@/lib/registry";
import {cn, isStaff} from "@/lib/utils";
import {formatDate} from "@/pages/hr/hr-utils";
import type {FleetTuningPreset, FleetVehicle, RegistrationRequest, VehicleWarning} from "@/types/supabase";
import {TuningCard} from "./components/TuningPanel";
import {groupWarnings} from "./components/WarningsList";
import {VehicleEditorDialog} from "./components/VehicleEditorDialog";

const SOURCE_LABELS: Record<RegistrationRequest["source"], string> = {
  auto: "Automatikus felismerés", manual: "Kézi módosítás", not_detected: "Ellenőrzés (nem olvasható)", mismatch: "Ellenőrzés (eltérés)",
  disputed: "Ellenőrzés (vitatott)",
};
const STATUS_LABELS: Record<RegistrationRequest["status"], {label: string; tone: string}> = {
  pending: {label: "Ellenőrzésre vár", tone: "text-amber-300"},
  approved: {label: "Elfogadva", tone: "text-emerald-300"},
  rejected: {label: "Elutasítva", tone: "text-red-300"},
  cancelled: {label: "Visszavonva", tone: "text-slate-400"},
};
const dotted = (iso: string | null) => (iso ? `${iso.replaceAll("-", ".")}.` : "–");

/** One vehicle: who holds it, its registration and history, special features, warnings and tuning. */
export function VehiclePage() {
  const {vehicleId = ""} = useParams();
  const {supabase, profile} = useAuth();
  const {vehicles, categories} = useFleet();
  const {profiles} = useProfileDirectory();
  const people = useMemo(() => new Map(profiles.map((person) => [person.id, person])), [profiles]);
  const [fetched, setFetched] = useState<FleetVehicle | null | undefined>(undefined);
  const [history, setHistory] = useState<RegistrationRequest[] | null>(null);
  const [warnings, setWarnings] = useState<VehicleWarning[] | null>(null);
  const [tuning, setTuning] = useState<FleetTuningPreset | null>(null);
  const [dialog, setDialog] = useState<"keys" | "registration" | "warning" | "edit" | null>(null);
  const staff = isStaff(profile);

  const fromStore = vehicles?.find((vehicle) => vehicle.id === vehicleId) ?? null;
  const vehicle = fromStore ?? fetched ?? null;
  const category = vehicle ? categories.find((item) => item.id === vehicle.category_id) ?? null : null;

  // Retired vehicles are not in the stock list: load the vehicle itself.
  useEffect(() => {
    if (vehicles === null || fromStore || fetched !== undefined) return;
    fetchFleetVehicle(vehicleId).then(setFetched).catch(() => setFetched(null));
  }, [vehicles, fromStore, fetched, vehicleId]);

  const loadHistory = useCallback(async () => {
    const [historyResult, warningResult] = await Promise.all([
      supabase.from("fleet_registration_requests").select("*").eq("vehicle_id", vehicleId).order("created_at", {ascending: false}).limit(12),
      supabase.from("vehicle_warnings").select("*").eq("vehicle_id", vehicleId).order("created_at", {ascending: false}).limit(60),
    ]);
    setHistory((historyResult.data ?? []) as RegistrationRequest[]);
    setWarnings((warningResult.data ?? []) as VehicleWarning[]);
  }, [supabase, vehicleId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!vehicle) return;
    loadTuningPresets().then((presets) => setTuning(tuningFor(vehicle.model, presets))).catch(() => undefined);
  }, [vehicle?.model]); // eslint-disable-line react-hooks/exhaustive-deps

  if (vehicles === null || (!vehicle && fetched === undefined)) {
    return <div className="space-y-4"><div className="skeleton h-48"/><div className="grid gap-4 lg:grid-cols-2"><div className="skeleton h-64"/><div className="skeleton h-64"/></div></div>;
  }
  if (!vehicle) {
    return (
      <div className="panel mx-auto w-full max-w-xl">
        <EmptyState icon={Car} title="A jármű nem található." action={<Button asChild variant="outline"><Link to="/logistics?tab=fleet"><ArrowLeft/> Járműpark</Link></Button>}/>
      </div>
    );
  }

  const tone = FLEET_TONES[category?.tone ?? "slate"];
  const features = vehicleFeatures(vehicle, category);
  const canAssign = canAssignVehicle(profile, category);
  const canRenew = staff || canSubmitRegistration(profile, vehicle, category);
  const status = vehicle.registration_required ? registrationStatus(vehicle.registration_expires_on) : null;
  const batches = groupWarnings(warnings ?? []);
  const activePoints = new Map<string, number>();
  (warnings ?? []).filter((item) => !item.revoked_at && !item.converted_record_id)
    .forEach((item) => activePoints.set(item.user_id, (activePoints.get(item.user_id) ?? 0) + 1));

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6">
      <Link to="/logistics?tab=fleet" className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-white">
        <ArrowLeft className="size-4"/> Járműpark
      </Link>

      <section className="panel glow-border animate-rise relative overflow-hidden">
        <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-80", tone.band)}/>
        <div className="tex-grid pointer-events-none absolute inset-0 opacity-[0.03] [mask-image:linear-gradient(to_left,#000,transparent_70%)]"/>
        <div className="relative flex flex-col gap-6 p-6 md:flex-row md:items-center md:p-8">
          <div className="min-w-0 flex-1 space-y-3">
            <p className={cn("text-[11px] font-semibold uppercase tracking-[0.25em] wrap-anywhere", tone.text)}>{category?.name ?? "Jármű"}</p>
            <h1 className="text-3xl font-semibold tracking-tight text-white wrap-anywhere md:text-4xl">{vehicle.model}</h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
              {vehicle.callsign && <Fact icon={Radio}>{vehicle.callsign}</Fact>}
              {vehicle.game_id && <Fact icon={Hash}>{vehicle.game_id}</Fact>}
              {vehicle.station && <Fact icon={MapPin}>{vehicle.station}</Fact>}
              {!vehicle.is_active && <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-red-200 ring-1 ring-red-500/30">Kivezetve</span>}
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 md:items-end">
            <LicensePlate plate={vehicle.plate} size="lg" className="animate-pop"/>
            {status ? <RegistrationBadge expiresOn={vehicle.registration_expires_on}/> : <span className="text-xs text-teal-200">Nem kell forgalmi</span>}
            <div className="flex flex-wrap gap-2">
              {canRenew && vehicle.registration_required && vehicle.is_active && (
                <Button size="sm" onClick={() => setDialog("registration")}><CalendarClock/> Forgalmi frissítése</Button>
              )}
              {staff && <Button size="sm" variant="outline" onClick={() => setDialog("edit")}><Pencil/> Szerkesztés</Button>}
            </div>
          </div>
        </div>
      </section>

      {features.length > 0 && (
        <section aria-label="Különlegességek" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {features.map((feature, index) => (
            <div key={feature.key} style={{"--i": index + 1} as CSSProperties}
                 className={cn("animate-rise flex items-start gap-3 rounded-2xl p-4 ring-1 backdrop-blur", feature.tone)}>
              <feature.icon className="mt-0.5 size-5 shrink-0"/>
              <div className="min-w-0">
                <p className="text-sm font-semibold wrap-anywhere">{feature.label}</p>
                <p className="text-xs opacity-80 wrap-anywhere">{feature.description}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <Panel icon={KeyRound} title="Kulcsosok" hint={vehicle.shared_label ? `Közös jármű: ${vehicle.shared_label}` : "Akiknél kulcs van ehhez a járműhöz."}
                 action={<div className="flex items-center gap-3"><KeyMeter vehicle={vehicle}/>
                   {canAssign && vehicle.is_active && <Button size="sm" variant="outline" onClick={() => setDialog("keys")}><KeyRound/> Kulcsok kezelése</Button>}</div>}>
            {vehicle.holders.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-slate-500 wrap-anywhere">{vehicle.shared_label ? `Nincs személyes kulcsos; a(z) ${vehicle.shared_label} használja.` : "Senkinél nincs kulcs: a jármű szabad."}</p>
            ) : (
              <ul className="grid grid-cols-1 gap-2 px-5 pb-5 sm:grid-cols-2">
                {vehicle.holders.map((holder, index) => {
                  const person = people.get(holder.user_id);
                  const blocked = person ? holdBlocker(person, vehicle, category) : null;
                  return (
                    <li key={holder.user_id} style={{"--i": index} as CSSProperties}
                        className="animate-rise flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/5">
                      <PersonAvatar person={person} size="md"/>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-sm font-medium text-white">
                          {person?.full_name ?? "Ismeretlen"}
                          {holder.is_temporary && <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1 text-[10px] text-amber-300 ring-1 ring-amber-500/30"><Clock3 className="size-3"/>ideiglenes</span>}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">{person?.faction_rank} · #{person?.badge_number} · {formatDate(holder.assigned_at)} óta</p>
                        {holder.note && <p className="truncate text-[11px] text-slate-400">{holder.note}</p>}
                        {blocked && <p className="text-[11px] text-amber-300/90">Nem felel meg a szabálynak: {blocked}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel icon={History} title="Forgalmi előzmények" hint="Megújítások, kézi módosítások és ellenőrzések.">
            {history === null ? (
              <div className="space-y-2 px-5 pb-5">{[0, 1].map((i) => <div key={i} className="skeleton h-10"/>)}</div>
            ) : history.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-slate-500">Még nincs bejegyzés.</p>
            ) : (
              <ol className="relative mx-5 mb-5 space-y-3 border-l border-white/10 pl-5">
                {history.map((entry, index) => {
                  const who = entry.decided_by ? people.get(entry.decided_by) : entry.submitted_by ? people.get(entry.submitted_by) : null;
                  const meta = STATUS_LABELS[entry.status];
                  return (
                    <li key={entry.id} style={{"--i": index} as CSSProperties} className="animate-fade relative">
                      <span className={cn("absolute top-1.5 -left-[25px] size-2.5 rounded-full ring-4 ring-[#0a1120]",
                        entry.status === "approved" ? "bg-emerald-400" : entry.status === "pending" ? "bg-amber-400" : entry.status === "rejected" ? "bg-red-400" : "bg-slate-500")}/>
                      <p className="text-sm text-slate-200">
                        {entry.status === "approved" && entry.decided_expires_on ? `Érvényes ${entry.decided_expires_on.replaceAll("-", ".")}-ig` : SOURCE_LABELS[entry.source]}
                        <span className={cn("ml-2 text-xs", meta.tone)}>{meta.label}</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        {SOURCE_LABELS[entry.source]} · {formatDate(entry.decided_at ?? entry.created_at)}{who ? ` · ${who.full_name}` : ""}
                        {entry.previous_expires_on ? ` · korábban ${dotted(entry.previous_expires_on)}` : ""}
                      </p>
                      {entry.decision_note && <p className="mt-0.5 text-xs text-slate-400 wrap-anywhere">„{entry.decision_note}”</p>}
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>

          {(staff || batches.length > 0) && (
            <Panel icon={AlertTriangle} title="Hibapontok" hint="Ehhez a járműhöz kiadott hibapontok."
                   action={staff && vehicle.is_active ? <Button size="sm" variant="outline" className="text-amber-200" onClick={() => setDialog("warning")}><ShieldAlert/> Hibapont</Button> : undefined}>
              {batches.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-slate-500">Nincs hibapont.</p>
              ) : (
                <ul className="divide-y divide-white/5 border-t">
                  {batches.map((batch) => (
                    <li key={batch.id} className="flex flex-wrap items-center gap-2 px-5 py-2.5">
                      <p className="min-w-0 flex-1 text-sm text-slate-200 wrap-anywhere">{batch.reason}</p>
                      {batch.people.map((person) => (
                        <span key={person.userId} className={cn("rounded-md bg-white/[0.04] px-2 py-0.5 text-[11px] text-slate-300 ring-1 ring-white/10",
                          !person.active.length && "line-through opacity-60")}>
                          {people.get(person.userId)?.full_name ?? "?"} · {person.active.length + person.revoked.length + person.converted} p
                        </span>
                      ))}
                      <span className="text-xs text-slate-500">{formatDate(batch.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          <Panel icon={FileText} title="Adatok">
            <dl className="grid grid-cols-2 gap-2 px-5 pb-5">
              <Detail label="Rendszám" value={vehicle.plate} mono/>
              <Detail label="Hívójel" value={vehicle.callsign ?? "–"} mono/>
              <Detail label="Játékbeli ID" value={vehicle.game_id ? String(vehicle.game_id) : "–"} mono/>
              <Detail label="Kirendeltség" value={vehicle.station ?? "–"}/>
              <Detail label="Forgalmi" value={vehicle.registration_required ? dotted(vehicle.registration_expires_on) : "Nem kell"}/>
              <Detail label="Kulcsok" value={vehicle.capacity === null ? "Korlátlan" : String(vehicle.capacity)}/>
              {vehicle.license_name && <Detail label="Név a forgalmin" value={vehicle.license_name} wide/>}
            </dl>
            {vehicle.notes && <p className="mx-5 mb-5 rounded-xl bg-white/[0.03] px-3 py-2 text-sm text-slate-300 ring-1 ring-white/5 wrap-anywhere">{vehicle.notes}</p>}
          </Panel>

          <Panel icon={Gauge} title="Hivatalos tuning" hint={tuning ? undefined : "Ehhez a típushoz nincs megadva tuning beállítás."}>
            {tuning && <div className="px-5 pb-5"><TuningCard preset={tuning} compact/></div>}
          </Panel>
        </div>
      </div>

      {dialog === "keys" && (
        <AssignKeyDialog open vehicle={vehicle} category={category} vehicles={vehicles} people={profiles} onOpenChange={(open) => !open && setDialog(null)}/>
      )}
      {dialog === "registration" && (
        <RegistrationDialog open vehicle={vehicle} onOpenChange={(open) => !open && setDialog(null)}
                            onChanged={(updated) => {
                              if (!fromStore) setFetched(updated);
                              void loadHistory();
                            }}/>
      )}
      {dialog === "warning" && (
        <IssueWarningDialog open vehicles={vehicles} categories={categories} people={profiles} activePoints={activePoints}
                            initialTargets={vehicle.holders.map((holder) => ({userId: holder.user_id, vehicleId: vehicle.id}))}
                            onOpenChange={(open) => !open && setDialog(null)} onIssued={() => {
                              toast.message("A hibapontok a tagok profilján is megjelennek.");
                              void loadHistory();
                            }}/>
      )}
      <VehicleEditorDialog key={dialog === "edit" ? vehicle.id : "closed"} vehicle={dialog === "edit" ? vehicle : null} categories={categories}
                           onOpenChange={(open) => !open && setDialog(null)} onSaved={(saved) => saved && !fromStore && setFetched(saved)}/>
    </div>
  );
}

function Fact({icon: Icon, children}: {icon: typeof Car; children: ReactNode}) {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 font-mono ring-1 ring-white/10"><Icon className="size-3.5 text-slate-400"/>{children}</span>;
}

function Panel({icon: Icon, title, hint, action, children}: {
  icon: typeof Car; title: string; hint?: string; action?: ReactNode; children?: ReactNode;
}) {
  return (
    <section className="panel animate-rise overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 px-5 py-4">
        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 ring-1 ring-primary/20"><Icon className="size-4 text-primary"/></div>
        <div className="min-w-[12rem] flex-1">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {hint && <p className="text-xs text-slate-500 wrap-anywhere">{hint}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function Detail({label, value, mono, wide}: {label: string; value: string; mono?: boolean; wide?: boolean}) {
  return (
    <div className={cn("rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5", wide && "col-span-2")}>
      <dt className="text-[11px] text-slate-500">{label}</dt>
      <dd className={cn("mt-0.5 truncate text-sm font-medium text-slate-100", mono && "font-mono")}>{value}</dd>
    </div>
  );
}
