import {useCallback, useEffect, useMemo, useState, type CSSProperties} from "react";
import {Link, Navigate} from "react-router";
import {
  AlertTriangle, ArrowRightLeft, BarChart3, Clock, FolderOpen, Gavel, History, LineChart, Lock, Siren, Timer, UserX, Users,
} from "lucide-react";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {PageHeader} from "@/components/layout/PageHeader";
import {StatCard} from "@/components/layout/StatCard";
import {EmptyState} from "@/components/layout/EmptyState";
import {useAuth} from "@/context/AuthContext";
import {formatAgo, formatDateTime} from "@/lib/datetime";
import {CATEGORY, canViewMcbOverview, isMcbLead, mcbApi, type McbOverview, type McbOverviewMember, type McbSettings} from "@/lib/mcb";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {cn, errorMessage, getRankPriority} from "@/lib/utils";
import {describeCaseEvent} from "./components/CaseTimeline";
import {MemberAvatar, PriorityChip} from "./components/McbBadges";
import {TransferCaseDialog} from "./components/AddCollaboratorDialog";

// Chart colours: categorical slots 1 and 3 of the dark palette, validated on the panel surface.
const SERIES = {opened: "#3987e5", closed: "#199e70"};
const MONTHS = ["jan.", "febr.", "márc.", "ápr.", "máj.", "jún.", "júl.", "aug.", "szept.", "okt.", "nov.", "dec."];
const INVESTIGATOR_ORDER: Record<string, number> = {"Investigator III.": 0, "Investigator II.": 1, "Investigator I.": 2};

/** "2026. okt." (tooltip, table) and the axis label without the year ("okt."). */
const monthLabel = (key: string) => {
  const [year, month] = key.split("-").map(Number);
  return `${year}. ${MONTHS[month - 1]}`;
};
const axisLabel = (key: string) => MONTHS[Number(key.split("-")[1]) - 1];

/** MCB leadership: workload of the investigators, bureau figures, unattended cases, latest events. */
export function AdminPage() {
  const {profile} = useAuth();
  const allowed = canViewMcbOverview(profile);
  const [data, setData] = useState<McbOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transfer, setTransfer] = useState<{caseId: string; ownerId: string | null} | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await mcbApi.overview());
      setError(null);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }, []);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  const members = useMemo(() => [...(data?.members ?? [])].sort((a, b) =>
    Number(b.is_bureau_commander) - Number(a.is_bureau_commander)
    || (INVESTIGATOR_ORDER[a.division_rank ?? ""] ?? 9) - (INVESTIGATOR_ORDER[b.division_rank ?? ""] ?? 9)
    || getRankPriority(a.faction_rank) - getRankPriority(b.faction_rank)), [data?.members]);

  if (profile && !allowed) return <Navigate to="/mcb" replace/>;
  if (error) {
    return <div className="panel"><EmptyState icon={AlertTriangle} title="Az áttekintés nem tölthető be" description={error}
                                               action={<Button variant="outline" size="sm" onClick={() => void load()}>Újra</Button>}/></div>;
  }
  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">{Array.from({length: 6}, (_, index) => <div key={index} className="skeleton h-20 rounded-2xl"/>)}</div>
        <div className="skeleton h-72 rounded-2xl"/>
      </div>
    );
  }

  const {totals} = data;
  const maxLoad = Math.max(1, ...members.map((member) => member.open_owned + member.collaborations));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={LineChart} tone="blue" eyebrow="MCB vezetői áttekintés" title="Az iroda vezetése"
                  description="Leterheltség, ügyforgalom, gazdátlan akták és a legutóbbi események – egy lekérdezésből."
                  actions={<Button variant="outline" onClick={() => void load()}><History className="size-4"/> Frissítés</Button>}/>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" data-tour="mcb-overview">
        <StatCard index={0} label="Nyitott akták" value={totals.open} icon={FolderOpen} tone="blue"/>
        <StatCard index={1} label="Kritikus nyitott" value={totals.critical} icon={Siren} tone="red"/>
        <StatCard index={2} label="Lezárva (30 nap)" value={totals.closed_30d} icon={Lock} tone="emerald" hint={`${totals.opened_30d} új akta`}/>
        <StatCard index={3} label="Átfutási idő" value={totals.avg_close_days === null ? "–" : `${totals.avg_close_days} nap`} icon={Timer}
                  tone="violet" hint="átlag, fél év"/>
        <StatCard index={4} label="Függő parancs" value={totals.warrants_pending} icon={Gavel} tone="orange"
                  hint={`${totals.warrants_active} érvényes`}/>
        <StatCard index={5} label="Körözött személy" value={totals.wanted} icon={UserX} tone="gold" hint={`${totals.suspects} nyilvántartott`}/>
      </div>

      <WarrantValidityCard editable={isMcbLead(profile)}/>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="panel animate-rise p-5" style={{"--i": 2} as CSSProperties}>
          <header className="mb-4 flex flex-wrap items-center gap-3">
            <BarChart3 className="size-4 text-sky-300"/>
            <h2 className="text-sm font-semibold text-white">Ügyforgalom havonta</h2>
            <div className="ml-auto flex items-center gap-4 text-xs text-slate-300">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{background: SERIES.opened}}/>Megnyitott</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{background: SERIES.closed}}/>Lezárt</span>
            </div>
          </header>
          <MonthlyChart monthly={data.monthly}/>
        </section>

        <section className="panel animate-rise p-5" style={{"--i": 3} as CSSProperties}>
          <header className="mb-4 flex items-center gap-2">
            <FolderOpen className="size-4 text-sky-300"/>
            <h2 className="text-sm font-semibold text-white">Nyitott akták ügytípus szerint</h2>
          </header>
          <CategoryBars categories={data.categories}/>
        </section>
      </div>

      <section className="panel animate-rise overflow-hidden p-0" style={{"--i": 4} as CSSProperties}>
        <header className="flex items-center gap-2 border-b border-white/5 px-5 py-3">
          <Users className="size-4 text-sky-300"/>
          <h2 className="text-sm font-semibold text-white">Nyomozók és leterheltség</h2>
          <span className="text-xs text-slate-500">· MCB állomány és mindenki, akinek nyitott aktája van</span>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-[11px] tracking-wider text-slate-500 uppercase">
                <th className="px-5 py-2.5 font-medium">Nyomozó</th>
                <th className="px-3 py-2.5 font-medium">Beosztás</th>
                <th className="px-3 py-2.5 font-medium">Leterheltség</th>
                <th className="px-3 py-2.5 text-right font-medium">Saját nyitott</th>
                <th className="px-3 py-2.5 text-right font-medium">Közreműködés</th>
                <th className="px-3 py-2.5 text-right font-medium">Lezárt (90 nap)</th>
                <th className="px-3 py-2.5 text-right font-medium">Bizonyíték (30 nap)</th>
                <th className="px-5 py-2.5 text-right font-medium">Utolsó aktivitás</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {members.map((member) => <MemberRow key={member.id} member={member} maxLoad={maxLoad}/>)}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="panel animate-rise overflow-hidden p-0" style={{"--i": 5} as CSSProperties}>
          <header className="flex items-center gap-2 border-b border-white/5 px-5 py-3">
            <AlertTriangle className="size-4 text-amber-300"/>
            <h2 className="text-sm font-semibold text-white">Figyelmet igénylő akták</h2>
            <span className="rounded-full bg-amber-500/15 px-2 text-xs text-amber-200">{data.unattended.length}</span>
          </header>
          {data.unattended.length === 0 ? (
            <EmptyState compact icon={FolderOpen} title="Minden nyitott aktának aktív gazdája van"/>
          ) : (
            <ul className="max-h-[420px] divide-y divide-white/5 overflow-y-auto">
              {data.unattended.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <Link to={`/mcb/case/${item.id}`} className="block truncate text-sm font-medium text-white hover:text-sky-200">
                      <span className="mr-1.5 font-mono text-xs text-sky-300/80">{item.case_number}</span>{item.title}
                    </Link>
                    <p className="truncate text-[11px] text-slate-500">
                      {item.reason === "no_owner" ? "Nincs tulajdonosa"
                        : item.reason === "left" ? `${item.owner_name} már nem az MCB tagja (${item.owner_division ?? "–"})`
                          : item.reason === "pending" ? `${item.owner_name} fiókja jóváhagyásra vár`
                            : `30 napja nem frissült · ${item.owner_name}`} · {formatAgo(item.updated_at)}
                    </p>
                  </div>
                  <PriorityChip priority={item.priority}/>
                  {data.viewer.is_lead && (
                    <Button size="sm" variant="outline" className="h-8" onClick={() => setTransfer({caseId: item.id, ownerId: item.owner_id})}>
                      <ArrowRightLeft className="size-3.5"/> Átadás
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel animate-rise overflow-hidden p-0" style={{"--i": 6} as CSSProperties}>
          <header className="flex items-center gap-2 border-b border-white/5 px-5 py-3">
            <Clock className="size-4 text-sky-300"/>
            <h2 className="text-sm font-semibold text-white">Legutóbbi események</h2>
          </header>
          {data.recent.length === 0 ? <EmptyState compact icon={History} title="Még nincs esemény"/> : (
            <ul className="max-h-[420px] divide-y divide-white/5 overflow-y-auto">
              {data.recent.map((event) => {
                const look = describeCaseEvent({kind: event.kind, details: event.details, actor_id: null});
                return (
                  <li key={event.id} className="flex gap-3 px-5 py-2.5">
                    <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-full", look.tone)}><look.icon className="size-3.5"/></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-slate-300 wrap-anywhere">
                        <span className="font-semibold text-white">{event.actor_name ?? "Rendszer"}</span> {look.text}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        <Link to={`/mcb/case/${event.case_id}`} className="font-mono text-sky-300/80 hover:underline">{event.case_number}</Link>
                        {" "}{event.title} · <span title={formatDateTime(event.created_at)}>{formatAgo(event.created_at)}</span>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {transfer && (
        <TransferCaseDialog open onOpenChange={(open) => !open && setTransfer(null)} caseId={transfer.caseId} ownerId={transfer.ownerId}
                            onTransferred={() => {
                              setTransfer(null);
                              toast.success("Akta átadva.");
                              void load();
                            }}/>
      )}
    </div>
  );
}

function MemberRow({member, maxLoad}: {member: McbOverviewMember; maxLoad: number}) {
  const load = member.open_owned + member.collaborations;
  return (
    <tr className="hover:bg-white/[0.02]">
      <td className="px-5 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <MemberAvatar url={member.avatar_url} name={member.full_name} size={30}/>
          <div className="min-w-0">
            <p className="truncate font-medium text-white">{member.full_name}</p>
            <p className="text-[11px] text-slate-500">#{member.badge_number} · {member.faction_rank}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5 text-xs text-slate-300">
        {member.is_bureau_commander ? <span className="text-amber-300">Bureau Commander</span> : member.division === "MCB" ? member.division_rank ?? "MCB"
          : <span className="text-slate-500">{member.division} (nem MCB)</span>}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2" title={`${member.open_owned} saját, ${member.collaborations} közreműködés`}>
          <div className="flex h-2 w-32 overflow-hidden rounded-full bg-white/5">
            <span className="h-full rounded-l-full" style={{width: `${(member.open_owned / maxLoad) * 100}%`, background: SERIES.opened}}/>
            <span className="ml-0.5 h-full" style={{width: `${(member.collaborations / maxLoad) * 100}%`, background: SERIES.closed, opacity: 0.85}}/>
          </div>
          {member.critical_owned > 0 && <span className="text-[11px] text-red-300">{member.critical_owned} sürgős</span>}
          {load === 0 && <span className="text-[11px] text-slate-500">szabad</span>}
        </div>
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums text-slate-200">{member.open_owned}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{member.collaborations}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{member.closed_90d}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{member.evidence_30d}</td>
      <td className="px-5 py-2.5 text-right text-xs text-slate-400" title={member.last_activity ? formatDateTime(member.last_activity) : undefined}>
        {member.last_activity ? formatAgo(member.last_activity) : "–"}
      </td>
    </tr>
  );
}

/** Opened vs closed cases per month: paired columns on one axis, tooltip on hover, table for screen readers. */
function MonthlyChart({monthly}: {monthly: McbOverview["monthly"]}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...monthly.flatMap((item) => [item.opened, item.closed]));
  const top = Math.max(2, Math.ceil(max / 2) * 2);
  const ticks = [top, top / 2, 0];

  return (
    <div className="relative">
      <div className="flex h-56 gap-3">
        <div className="relative w-6 pb-6 text-right text-[10px] text-slate-500 tabular-nums">
          <div className="relative h-full">
            {ticks.map((tick) => (
              <span key={tick} className="absolute right-0 translate-y-1/2" style={{bottom: `${(tick / top) * 100}%`}}>{tick}</span>
            ))}
          </div>
        </div>
        <div className="relative flex-1 pb-6">
          <div className="relative h-full">
            {ticks.map((tick) => (
              <span key={tick} className="pointer-events-none absolute inset-x-0 h-px bg-white/[0.07]" style={{bottom: `${(tick / top) * 100}%`}}/>
            ))}
            <div className="absolute inset-0 flex items-end gap-2">
              {monthly.map((item, index) => (
                <div key={item.month} className="relative flex h-full flex-1 flex-col items-center justify-end"
                     onMouseEnter={() => setHover(index)} onMouseLeave={() => setHover(null)}>
                  <div className={cn("flex h-full w-full items-end justify-center gap-0.5 rounded-md transition-colors", hover === index && "bg-white/[0.04]")}>
                    {(["opened", "closed"] as const).map((key) => (
                      <span key={key} className="w-full max-w-6 rounded-t-[4px] transition-[height] duration-700"
                            style={{height: `${(item[key] / top) * 100}%`, background: SERIES[key], minHeight: item[key] > 0 ? 3 : 0}}/>
                    ))}
                  </div>
                  <span className="absolute -bottom-1 translate-y-full text-[10px] whitespace-nowrap text-slate-400">{axisLabel(item.month)}</span>
                  {hover === index && (
                    <div className="absolute bottom-full z-10 mb-2 w-max rounded-lg bg-[#0b1220] px-3 py-2 text-xs shadow-xl ring-1 ring-white/15">
                      <p className="mb-1 font-semibold text-white">{monthLabel(item.month)}</p>
                      <p className="flex items-center gap-1.5 text-slate-300"><span className="size-2 rounded-sm" style={{background: SERIES.opened}}/>Megnyitott: {item.opened}</p>
                      <p className="flex items-center gap-1.5 text-slate-300"><span className="size-2 rounded-sm" style={{background: SERIES.closed}}/>Lezárt: {item.closed}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <table className="sr-only">
        <caption>Megnyitott és lezárt akták havonta</caption>
        <thead><tr><th>Hónap</th><th>Megnyitott</th><th>Lezárt</th></tr></thead>
        <tbody>{monthly.map((item) => <tr key={item.month}><td>{monthLabel(item.month)}</td><td>{item.opened}</td><td>{item.closed}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function CategoryBars({categories}: {categories: McbOverview["categories"]}) {
  const rows = categories.filter((item) => item.open > 0).sort((a, b) => b.open - a.open);
  const max = Math.max(1, ...rows.map((item) => item.open));
  if (rows.length === 0) return <EmptyState compact icon={FolderOpen} title="Nincs nyitott akta"/>;
  return (
    <ul className="space-y-2.5">
      {rows.map((item) => {
        const look = item.category === "none" ? null : CATEGORY[item.category];
        const Icon = look?.icon ?? FolderOpen;
        return (
          <li key={item.category} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_2rem] items-center gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-1.5 text-slate-300"><Icon className="size-3.5 shrink-0 text-slate-500"/>
              <span className="truncate">{look?.label ?? "Nincs megadva"}</span></span>
            <span className="h-3 overflow-hidden rounded-r-[4px] bg-white/[0.04]">
              <span className="block h-full rounded-r-[4px] transition-[width] duration-700" style={{width: `${(item.open / max) * 100}%`, background: SERIES.opened}}/>
            </span>
            <span className="text-right text-slate-200 tabular-nums">{item.open}</span>
          </li>
        );
      })}
    </ul>
  );
}


/**
 * How long an approved warrant is valid (0: until revoked) and how early the requester and the
 * owner are reminded. A warrant past its time lapses in the daily job; editors may ask for a
 * renewal before that.
 */
function WarrantValidityCard({editable}: {editable: boolean}) {
  const [settings, setSettings] = useState<McbSettings | null>(null);
  const [draft, setDraft] = useState({arrest_days: "", search_days: "", reminder_days: ""});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    mcbApi.settings().then((value) => {
      if (!value) return;
      setSettings(value);
      setDraft({arrest_days: String(value.arrest_days), search_days: String(value.search_days), reminder_days: String(value.reminder_days)});
    }).catch(() => undefined);
  }, []);

  if (!settings) return null;
  const dirty = draft.arrest_days !== String(settings.arrest_days) || draft.search_days !== String(settings.search_days)
    || draft.reminder_days !== String(settings.reminder_days);
  const save = async () => {
    setSaving(true);
    try {
      const saved = await mcbApi.saveSettings({arrest_days: Number(draft.arrest_days || 0), search_days: Number(draft.search_days || 0),
        reminder_days: Number(draft.reminder_days || 0)});
      setSettings(saved);
      setDraft({arrest_days: String(saved.arrest_days), search_days: String(saved.search_days), reminder_days: String(saved.reminder_days)});
      toast.success("A parancsok érvényessége mentve.", {description: "Az új idő a következő jóváhagyásoktól és megújításoktól számít."});
    } catch (reason) {
      toast.error(errorMessage(reason, "A mentés nem sikerült."));
    } finally {
      setSaving(false);
    }
  };
  const field = (key: keyof typeof draft, label: string, hint: string, max: number) => (
    <div className="space-y-1">
      <Label htmlFor={`validity-${key}`} className="text-xs">{label}</Label>
      <Input id={`validity-${key}`} inputMode="numeric" disabled={!editable} value={draft[key]}
             onChange={(event) => setDraft((prev) => ({...prev, [key]: String(Math.min(max, Number(event.target.value.replace(/\D/g, "") || 0)))}))}/>
      <p className="text-[11px] text-slate-500">{hint}</p>
    </div>
  );
  return (
    <section className="panel animate-rise p-5" data-tour="mcb-validity">
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <Gavel className="size-4 text-amber-300"/>
        <h2 className="text-sm font-semibold text-white">Parancsok érvényessége</h2>
        <span className="text-xs text-slate-500">· a lejárt parancs magától megszűnik, előtte megújítás kérhető</span>
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {field("arrest_days", "Elfogatóparancs (nap)", "0: visszavonásig érvényes", 90)}
        {field("search_days", "Házkutatási parancs (nap)", "0: visszavonásig érvényes", 90)}
        {field("reminder_days", "Emlékeztető a lejárat előtt (nap)", "A kérelmező és az akta tulajdonosa kapja", 14)}
      </div>
      {editable && dirty && (
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDraft({arrest_days: String(settings.arrest_days), search_days: String(settings.search_days),
            reminder_days: String(settings.reminder_days)})}>Elvetés</Button>
          <Button disabled={saving} onClick={() => void save()}>Mentés</Button>
        </div>
      )}
    </section>
  );
}
