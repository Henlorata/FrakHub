import {useEffect, useMemo, useState, type CSSProperties, type ReactNode} from "react";
import {Link} from "react-router";
import {toast} from "sonner";
import {
  ArrowDown, ArrowUp, Car, ClipboardList, Crosshair, FileText, Flag, Loader2, MapPin, Pencil, Plus, Radio, Save, Star, Target,
  Trash2, UserPlus, Users, X,
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {useConfirm} from "@/components/ConfirmDialog";
import {PersonPicker} from "@/components/fleet/Pickers";
import {useAuth} from "@/context/AuthContext";
import {MemberAvatar} from "@/pages/finance/components/MemberAvatar";
import {formatDateTime, formatTime, fromHungarian, todayKey} from "@/lib/datetime";
import {
  EVENT_KINDS, eventsApi, OPERATION_OUTCOMES, OPERATION_ROLE_PRESETS, operationSummary, type FactionEvent, type OperationDraft,
  type OperationOutcome, type OperationPlan, type OperationReportDraft, type OperationSummary,
} from "@/lib/events";
import {useFleet} from "@/lib/fleet-store";
import {mcbApi, type CaseListItem} from "@/lib/mcb";
import {useProfileDirectory} from "@/lib/profile-directory";
import {canViewCaseList, cn, errorMessage} from "@/lib/utils";

type Mode = "view" | "edit" | "report";

const emptyDraft = (): OperationDraft => ({
  objective: "", situation: "", execution: "", radio_channel: "", rally_point: "", rally_at: null, case_id: null, roles: [],
});

const toDraft = (plan: OperationPlan): OperationDraft => ({
  objective: plan.objective ?? "", situation: plan.situation ?? "", execution: plan.execution ?? "",
  radio_channel: plan.radio_channel ?? "", rally_point: plan.rally_point ?? "", rally_at: plan.rally_at, case_id: plan.case?.id ?? null,
  roles: plan.roles.map((role) => ({
    id: role.id, name: role.name, task: role.task ?? "", callsign: role.callsign ?? "",
    members: role.members.map((member) => ({user_id: member.user_id, vehicle_id: member.vehicle?.id ?? null, callsign: member.callsign ?? "", note: member.note ?? ""})),
  })),
});

/**
 * An event's operation plan: the objective, the situation and the plan, the rally point and the
 * radio channel, the teams with their members, vehicles and call signs, and after the event the
 * after-action report. The organisers write it; the event's audience reads it.
 */
export function OperationPlanDialog({event, onClose, onChanged}: {
  event: FactionEvent;
  onClose: () => void;
  onChanged: (summary: OperationSummary | null) => void;
}) {
  const {profile} = useAuth();
  const confirm = useConfirm();
  const [plan, setPlan] = useState<OperationPlan | null | undefined>(undefined);
  const [mode, setMode] = useState<Mode>("view");
  const look = EVENT_KINDS[event.kind] ?? EVENT_KINDS.other;
  const [openedAt] = useState(() => Date.now());
  const started = Date.parse(event.starts_at) <= openedAt;

  useEffect(() => {
    let active = true;
    eventsApi.operation(event.id).then((data) => {
      if (!active) return;
      setPlan(data);
      if (!data && event.can_manage) setMode("edit");
    }, (error) => {
      if (!active) return;
      toast.error(errorMessage(error, "A műveleti terv nem tölthető be."));
      setPlan(null);
    });
    return () => {
      active = false;
    };
  }, [event.id, event.can_manage]);

  const saved = (next: OperationPlan | null, message: string) => {
    setPlan(next);
    setMode("view");
    onChanged(profile ? operationSummary(next, profile.id) : null);
    toast.success(message);
  };

  const removePlan = async () => {
    const ok = await confirm({title: "Törlöd a műveleti tervet?", description: "A szerepek, a beosztások és az értékelés is törlődnek.",
      confirmLabel: "Törlés", destructive: true, kind: "delete"});
    if (!ok) return;
    try {
      await eventsApi.deleteOperation(event.id);
      saved(null, "A műveleti terv törölve.");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "A törlés nem sikerült."));
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94dvh] grid-cols-[minmax(0,1fr)] overflow-y-auto sm:max-w-4xl print:max-h-none print:overflow-visible">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span className={cn("grid size-11 shrink-0 place-items-center rounded-2xl ring-1", look.tile)}><ClipboardList className="size-5"/></span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="wrap-anywhere">Műveleti terv: {event.title}</DialogTitle>
              <DialogDescription>
                {look.label} · {formatDateTime(event.starts_at)}{event.location ? ` · ${event.location}` : ""}
              </DialogDescription>
            </div>
          </div>
          {plan && (
            <div className="mt-3 flex flex-wrap gap-1 print:hidden" role="tablist" aria-label="Nézet">
              {([["view", "Terv"], ...(event.can_manage ? [["edit", "Szerkesztés"]] : []),
                ...(event.can_manage && started ? [["report", "Értékelés"]] : [])] as [Mode, string][]).map(([value, label]) => (
                <button key={value} type="button" role="tab" aria-selected={mode === value} onClick={() => setMode(value)}
                        className={cn("h-8 rounded-lg px-3 text-sm font-medium transition", mode === value ? "bg-white/10 text-white" : "text-slate-400 hover:text-white")}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </DialogHeader>

        {plan === undefined ? (
          <div className="flex justify-center py-16"><Loader2 className="size-7 animate-spin text-slate-500"/></div>
        ) : mode === "edit" && event.can_manage ? (
          <PlanEditor event={event} plan={plan} onCancel={() => (plan ? setMode("view") : onClose())}
                      onSaved={(next) => saved(next, plan ? "A műveleti terv elmentve." : "A műveleti terv elkészült.")}
                      onDelete={plan ? () => void removePlan() : undefined}/>
        ) : mode === "report" && plan && event.can_manage ? (
          <ReportEditor event={event} plan={plan} onCancel={() => setMode("view")} onSaved={(next) => saved(next, "Az értékelés elmentve.")}/>
        ) : plan ? (
          <PlanView plan={plan} myId={profile?.id ?? ""}/>
        ) : (
          <p className="py-10 text-center text-sm text-slate-400">Ehhez az eseményhez nem készült műveleti terv.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// --- Reading --------------------------------------------------------------------------------------

function Section({icon: Icon, title, children}: {icon: typeof Target; title: string; children: ReactNode}) {
  return (
    <section className="min-w-0 space-y-1.5">
      <h3 className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase"><Icon className="size-3.5"/> {title}</h3>
      {children}
    </section>
  );
}

const Paragraph = ({text}: {text: string | null}) => text
  ? <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-200 wrap-anywhere">{text}</p>
  : <p className="text-sm text-slate-600">–</p>;

function PlanView({plan, myId}: {plan: OperationPlan; myId: string}) {
  const mine = plan.roles.flatMap((role) => role.members.filter((member) => member.user_id === myId).map((member) => ({role, member})))[0];
  const total = plan.roles.reduce((sum, role) => sum + role.members.length, 0);
  const outcome = plan.report ? OPERATION_OUTCOMES[plan.report.outcome] : null;

  return (
    <div className="space-y-5">
      {mine && (
        <div className="animate-rise rounded-2xl bg-amber-500/[0.08] p-4 ring-1 ring-amber-400/30">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-amber-300 uppercase">A te szereped</p>
          <p className="mt-1 text-lg font-semibold text-white wrap-anywhere">{mine.role.name}</p>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-amber-50/90">
            {(mine.member.callsign || mine.role.callsign) && <span className="inline-flex items-center gap-1.5"><Radio className="size-3.5"/> {mine.member.callsign || mine.role.callsign}</span>}
            {mine.member.vehicle && <span className="inline-flex items-center gap-1.5"><Car className="size-3.5"/> {mine.member.vehicle.plate} · {mine.member.vehicle.model}</span>}
          </p>
          {mine.role.task && <p className="mt-2 text-sm whitespace-pre-wrap text-slate-200 wrap-anywhere">{mine.role.task}</p>}
          {mine.member.note && <p className="mt-1 text-xs text-amber-100/80 wrap-anywhere">Megjegyzés: {mine.member.note}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Fact icon={MapPin} label="Gyülekező" value={plan.rally_point
          ? `${plan.rally_point}${plan.rally_at ? ` · ${formatTime(plan.rally_at)}` : ""}` : plan.rally_at ? formatDateTime(plan.rally_at) : null}/>
        <Fact icon={Radio} label="Rádiócsatorna" value={plan.radio_channel}/>
        <Fact icon={Users} label="Beosztva" value={`${total} fő, ${plan.roles.length} csapat`}/>
      </div>
      {plan.case && (
        <p className="flex min-w-0 items-center gap-2 text-sm text-slate-300">
          <FileText className="size-4 shrink-0 text-sky-300"/> Akta:
          {plan.case.can_open
            ? <Link to={`/mcb/case/${plan.case.id}`} className="min-w-0 truncate font-medium text-sky-300 hover:underline">{plan.case.case_number} · {plan.case.title}</Link>
            : <span className="min-w-0 truncate">{plan.case.case_number} · {plan.case.title}</span>}
        </p>
      )}

      {plan.objective && <Section icon={Target} title="Cél"><Paragraph text={plan.objective}/></Section>}
      {plan.situation && <Section icon={Flag} title="Helyzet"><Paragraph text={plan.situation}/></Section>}
      {plan.execution && <Section icon={Crosshair} title="Végrehajtás"><Paragraph text={plan.execution}/></Section>}

      <Section icon={Users} title="Csapatok">
        {plan.roles.length === 0 ? <p className="text-sm text-slate-600">Még nincs beosztás.</p> : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {plan.roles.map((role, index) => (
              <article key={role.id} className="animate-rise min-w-0 rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/10" style={{"--i": index} as CSSProperties}>
                <header className="flex min-w-0 items-start gap-2">
                  <p className="min-w-0 flex-1 font-semibold text-white wrap-anywhere">{role.name}</p>
                  {role.callsign && <span className="shrink-0 rounded-md bg-sky-500/10 px-1.5 py-0.5 font-mono text-[11px] text-sky-200 ring-1 ring-sky-500/25">{role.callsign}</span>}
                </header>
                {role.task && <p className="mt-1 text-xs whitespace-pre-wrap text-slate-400 wrap-anywhere">{role.task}</p>}
                <ul className="mt-2 space-y-1.5">
                  {role.members.length === 0 && <li className="text-xs text-slate-600">Nincs beosztott tag.</li>}
                  {role.members.map((member) => (
                    <li key={member.user_id} className={cn("flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1",
                      member.user_id === myId && "bg-amber-500/10 ring-1 ring-amber-400/30")}>
                      <MemberAvatar name={member.full_name} avatarUrl={member.avatar_url} size={28}/>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-slate-100">{member.full_name}</span>
                        <span className="block truncate text-[11px] text-slate-500">
                          {[member.faction_rank, member.callsign, member.vehicle ? `${member.vehicle.plate} (${member.vehicle.model})` : null, member.note]
                            .filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </Section>

      {plan.report && outcome && (
        <Section icon={Star} title="Értékelés">
          <div className="space-y-3 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
            <p className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1", outcome.tone)}>{outcome.label}</span>
              {plan.report.by_name ?? "Ismeretlen"} · {formatDateTime(plan.report.at)}
            </p>
            <Paragraph text={plan.report.summary}/>
            {plan.report.went_well && <div><p className="text-xs font-semibold text-emerald-300">Ami jól ment</p><Paragraph text={plan.report.went_well}/></div>}
            {plan.report.improve && <div><p className="text-xs font-semibold text-amber-300">Amin javítani kell</p><Paragraph text={plan.report.improve}/></div>}
          </div>
        </Section>
      )}

      <p className="border-t border-white/5 pt-3 text-[11px] text-slate-500">
        Utoljára módosította: {plan.updated_by_name ?? "ismeretlen"} · {formatDateTime(plan.updated_at)}
      </p>
    </div>
  );
}

function Fact({icon: Icon, label, value}: {icon: typeof MapPin; label: string; value: string | null}) {
  return (
    <div className="min-w-0 rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-white/10">
      <p className="flex items-center gap-1.5 text-[11px] text-slate-500"><Icon className="size-3.5"/> {label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-100 wrap-anywhere">{value || "–"}</p>
    </div>
  );
}

// --- Writing ---------------------------------------------------------------------------------------

function PlanEditor({event, plan, onCancel, onSaved, onDelete}: {
  event: FactionEvent;
  plan: OperationPlan | null;
  onCancel: () => void;
  onSaved: (plan: OperationPlan) => void;
  onDelete?: () => void;
}) {
  const {profile} = useAuth();
  const {profiles} = useProfileDirectory();
  const {vehicles} = useFleet();
  const [draft, setDraft] = useState<OperationDraft>(() => (plan ? toDraft(plan) : emptyDraft()));
  const [picking, setPicking] = useState<number | null>(null);
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [saving, setSaving] = useState(false);
  const eventDay = todayKey(event.starts_at);
  const [rallyDay, setRallyDay] = useState(draft.rally_at ? todayKey(draft.rally_at) : eventDay);
  const [rallyTime, setRallyTime] = useState(draft.rally_at ? formatTime(draft.rally_at) : "");
  const seesCases = canViewCaseList(profile);

  useEffect(() => {
    if (!seesCases) return;
    mcbApi.list().then((list) => setCases(list.filter((item) => item.can_open || item.id === draft.case_id)), () => undefined);
  }, [seesCases, draft.case_id]);

  const people = useMemo(() => new Map(profiles.map((person) => [person.id, person])), [profiles]);
  const assigned = useMemo(() => new Map(draft.roles.flatMap((role, index) => role.members.map((member) => [member.user_id, index] as const))),
    [draft.roles]);

  const setRole = (index: number, patch: Partial<OperationDraft["roles"][number]>) =>
    setDraft((current) => ({...current, roles: current.roles.map((role, at) => (at === index ? {...role, ...patch} : role))}));
  const addRole = (name = "") => setDraft((current) => ({...current, roles: [...current.roles, {name, task: "", callsign: "", members: []}]}));
  const moveRole = (index: number, step: number) => setDraft((current) => {
    const roles = [...current.roles];
    const target = index + step;
    if (target < 0 || target >= roles.length) return current;
    [roles[index], roles[target]] = [roles[target], roles[index]];
    return {...current, roles};
  });

  const toggleMember = (index: number, userId: string) => setDraft((current) => ({
    ...current,
    roles: current.roles.map((role, at) => {
      const has = role.members.some((member) => member.user_id === userId);
      if (at === index) {
        return {...role, members: has ? role.members.filter((member) => member.user_id !== userId)
          : [...role.members, {user_id: userId, vehicle_id: null, callsign: "", note: ""}]};
      }
      // A member has one role: picking them here takes them out of another team.
      return has ? {...role, members: role.members.filter((member) => member.user_id !== userId)} : role;
    }),
  }));

  const setMember = (index: number, userId: string, patch: Partial<OperationDraft["roles"][number]["members"][number]>) =>
    setRole(index, {members: draft.roles[index].members.map((member) => (member.user_id === userId ? {...member, ...patch} : member))});

  const save = async () => {
    if (draft.roles.some((role) => !role.name.trim())) return toast.error("Minden csapatnak adj nevet.");
    setSaving(true);
    try {
      const next = await eventsApi.saveOperation(event.id, {
        ...draft, rally_at: rallyTime ? fromHungarian(rallyDay, rallyTime) : null,
      });
      onSaved(next);
    } catch (error) {
      toast.error(errorMessage(error, "A terv mentése nem sikerült."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="op-objective">Cél</Label>
          <Textarea id="op-objective" rows={2} maxLength={2000} value={draft.objective} placeholder="Pl. a raktár átvizsgálása, a gyanúsítottak elfogása"
                    onChange={(changeEvent) => setDraft({...draft, objective: changeEvent.target.value})}/>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="op-situation">Helyzet</Label>
          <Textarea id="op-situation" rows={4} maxLength={4000} value={draft.situation} placeholder="Mit tudunk: helyszín, létszám, fegyverzet, kockázat"
                    onChange={(changeEvent) => setDraft({...draft, situation: changeEvent.target.value})}/>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="op-execution">Végrehajtás</Label>
          <Textarea id="op-execution" rows={4} maxLength={6000} value={draft.execution} placeholder="A lépések sorrendje, jelzések, vészhelyzet"
                    onChange={(changeEvent) => setDraft({...draft, execution: changeEvent.target.value})}/>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="op-rally">Gyülekező</Label>
          <Input id="op-rally" maxLength={160} value={draft.rally_point} placeholder="Pl. Kikötő, 3-as kapu"
                 onChange={(changeEvent) => setDraft({...draft, rally_point: changeEvent.target.value})}/>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_7rem_6rem] gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="op-rally-day">Gyülekezés napja</Label>
            <Input id="op-rally-day" type="date" value={rallyDay} onChange={(changeEvent) => setRallyDay(changeEvent.target.value)}/>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="op-rally-time">Ideje</Label>
            <Input id="op-rally-time" type="time" value={rallyTime} onChange={(changeEvent) => setRallyTime(changeEvent.target.value)}/>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="op-radio">Rádió</Label>
            <Input id="op-radio" maxLength={40} value={draft.radio_channel} placeholder="Pl. 3"
                   onChange={(changeEvent) => setDraft({...draft, radio_channel: changeEvent.target.value})}/>
          </div>
        </div>
        {seesCases && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="op-case">Kapcsolódó akta</Label>
            <select id="op-case" value={draft.case_id ?? ""} onChange={(changeEvent) => setDraft({...draft, case_id: changeEvent.target.value || null})}
                    className="h-10 w-full rounded-lg border bg-white/[0.03] px-3 text-sm text-slate-200">
              <option value="">Nincs</option>
              {cases.map((item) => <option key={item.id} value={item.id}>{item.case_number} · {item.title}</option>)}
            </select>
          </div>
        )}
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="mr-auto text-sm font-semibold text-white">Csapatok ({draft.roles.length})</h3>
          {OPERATION_ROLE_PRESETS.filter((name) => !draft.roles.some((role) => role.name === name)).slice(0, 5).map((name) => (
            <button key={name} type="button" onClick={() => addRole(name)}
                    className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs text-slate-300 ring-1 ring-white/10 transition hover:bg-white/5">
              <Plus className="size-3"/> {name}
            </button>
          ))}
          <Button size="sm" variant="outline" onClick={() => addRole()}><Plus className="size-4"/> Új csapat</Button>
        </div>

        {draft.roles.length === 0 && (
          <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-slate-500">
            Adj hozzá csapatokat (pl. Behatoló csapat, Külső biztosítás), és oszd be a tagokat.
          </p>
        )}

        {draft.roles.map((role, index) => (
          <article key={role.id ?? `new-${index}`} className="min-w-0 space-y-3 rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/10">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto]">
              <Input aria-label="A csapat neve" maxLength={60} value={role.name} placeholder="A csapat neve"
                     onChange={(changeEvent) => setRole(index, {name: changeEvent.target.value})}/>
              <Input aria-label="Hívójel" maxLength={30} value={role.callsign} placeholder="Hívójel" className="font-mono"
                     onChange={(changeEvent) => setRole(index, {callsign: changeEvent.target.value})}/>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" aria-label="Feljebb" disabled={index === 0} onClick={() => moveRole(index, -1)}><ArrowUp className="size-4"/></Button>
                <Button size="icon" variant="ghost" aria-label="Lejjebb" disabled={index === draft.roles.length - 1} onClick={() => moveRole(index, 1)}>
                  <ArrowDown className="size-4"/>
                </Button>
                <Button size="icon" variant="ghost" aria-label="A csapat törlése" className="text-red-300 hover:bg-red-500/10"
                        onClick={() => setDraft({...draft, roles: draft.roles.filter((_, at) => at !== index)})}><Trash2 className="size-4"/></Button>
              </div>
            </div>
            <Textarea aria-label="Feladat" rows={2} maxLength={600} value={role.task} placeholder="A csapat feladata"
                      onChange={(changeEvent) => setRole(index, {task: changeEvent.target.value})}/>

            <ul className="space-y-2">
              {role.members.map((member) => {
                const person = people.get(member.user_id);
                return (
                  <li key={member.user_id} className="grid grid-cols-1 items-center gap-2 rounded-xl bg-black/20 p-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_7rem_minmax(0,1fr)_auto]">
                    <span className="flex min-w-0 items-center gap-2">
                      <MemberAvatar name={person?.full_name ?? "?"} avatarUrl={person?.avatar_url ?? null} size={28}/>
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-slate-100">{person?.full_name ?? "Ismeretlen"}</span>
                        <span className="block truncate text-[11px] text-slate-500">{person?.faction_rank}</span>
                      </span>
                    </span>
                    <select aria-label="Jármű" value={member.vehicle_id ?? ""} onChange={(changeEvent) => setMember(index, member.user_id, {vehicle_id: changeEvent.target.value || null})}
                            className="h-9 min-w-0 rounded-lg border bg-white/[0.03] px-2 text-xs text-slate-200">
                      <option value="">Jármű nélkül</option>
                      {(vehicles ?? []).map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate} · {vehicle.model}</option>)}
                    </select>
                    <Input aria-label="Hívójel" maxLength={30} value={member.callsign} placeholder="Hívójel" className="h-9 font-mono text-xs"
                           onChange={(changeEvent) => setMember(index, member.user_id, {callsign: changeEvent.target.value})}/>
                    <Input aria-label="Megjegyzés" maxLength={200} value={member.note} placeholder="Megjegyzés" className="h-9 text-xs"
                           onChange={(changeEvent) => setMember(index, member.user_id, {note: changeEvent.target.value})}/>
                    <Button size="icon" variant="ghost" aria-label="Eltávolítás" onClick={() => toggleMember(index, member.user_id)}><X className="size-4"/></Button>
                  </li>
                );
              })}
            </ul>

            {picking === index ? (
              <div className="space-y-2 rounded-xl bg-black/20 p-2">
                <PersonPicker people={profiles} selected={role.members.map((member) => member.user_id)} autoFocus
                              onToggle={(person) => toggleMember(index, person.id)}
                              detail={(person) => {
                                const other = assigned.get(person.id);
                                return other !== undefined && other !== index ? `Most: ${draft.roles[other].name || "névtelen csapat"}` : null;
                              }}/>
                <Button size="sm" variant="ghost" onClick={() => setPicking(null)}>Kész</Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setPicking(index)}><UserPlus className="size-4"/> Tagok beosztása</Button>
            )}
          </article>
        ))}
      </section>

      <DialogFooter className="gap-2 sm:justify-between">
        {onDelete ? <Button variant="ghost" className="text-red-300 hover:bg-red-500/10" onClick={onDelete}><Trash2 className="size-4"/> Terv törlése</Button> : <span/>}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>Mégse</Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin"/> : <Save className="size-4"/>} Mentés
          </Button>
        </div>
      </DialogFooter>
    </div>
  );
}

function ReportEditor({event, plan, onCancel, onSaved}: {
  event: FactionEvent;
  plan: OperationPlan;
  onCancel: () => void;
  onSaved: (plan: OperationPlan) => void;
}) {
  const [draft, setDraft] = useState<OperationReportDraft>({
    outcome: plan.report?.outcome ?? "success", summary: plan.report?.summary ?? "",
    went_well: plan.report?.went_well ?? "", improve: plan.report?.improve ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      onSaved(await eventsApi.saveReport(event.id, draft));
    } catch (error) {
      toast.error(errorMessage(error, "Az értékelés mentése nem sikerült."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Kimenetel</Label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(OPERATION_OUTCOMES) as OperationOutcome[]).map((value) => (
            <button key={value} type="button" aria-pressed={draft.outcome === value} onClick={() => setDraft({...draft, outcome: value})}
                    className={cn("h-8 rounded-full px-3 text-sm ring-1 transition",
                      draft.outcome === value ? OPERATION_OUTCOMES[value].tone : "text-slate-400 ring-white/10 hover:text-white")}>
              {OPERATION_OUTCOMES[value].label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="report-summary">Összefoglaló</Label>
        <Textarea id="report-summary" rows={4} maxLength={4000} value={draft.summary} placeholder="Mi történt, kiket fogtak el, mit foglaltak le"
                  onChange={(changeEvent) => setDraft({...draft, summary: changeEvent.target.value})}/>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="report-well">Ami jól ment</Label>
          <Textarea id="report-well" rows={3} maxLength={3000} value={draft.went_well}
                    onChange={(changeEvent) => setDraft({...draft, went_well: changeEvent.target.value})}/>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="report-improve">Amin javítani kell</Label>
          <Textarea id="report-improve" rows={3} maxLength={3000} value={draft.improve}
                    onChange={(changeEvent) => setDraft({...draft, improve: changeEvent.target.value})}/>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Mégse</Button>
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin"/> : <Pencil className="size-4"/>} Értékelés mentése
        </Button>
      </DialogFooter>
    </div>
  );
}
