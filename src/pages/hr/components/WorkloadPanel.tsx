import {useEffect, useMemo, useState, type CSSProperties} from "react";
import {ChartNoAxesColumn, Filter, Table2, Users} from "lucide-react";
import {EmptyState} from "@/components/layout/EmptyState";
import {MemberAvatar} from "@/components/MemberAvatar";
import {progressionApi, type FunnelMonth, type Workload, type WorkloadMember} from "@/lib/progression";
import {formatDuty, monthLabel} from "@/lib/registry";
import {cn} from "@/lib/utils";

/** Chart colours (validated for the dark surface #0a1120: categorical slot 1, chrome inks). */
const SERIES = "#3987e5";
type Metric = "reports" | "duty" | "events";
const METRICS: Record<Metric, {label: string; share: string; unit: string; format: (value: number) => string}> = {
  reports: {label: "Jelentések", share: "a jelentések", unit: "db", format: (value) => String(value)},
  duty: {label: "Duty idő", share: "a duty idő", unit: "óra", format: (value) => formatDuty(value, true)},
  events: {label: "Események", share: "az eseményrészvételek", unit: "alkalom", format: (value) => String(value)},
};

function Segmented<T extends string | number>({value, options, onChange, label}: {
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="inline-flex rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/10" role="tablist" aria-label={label}>
      {options.map(([id, text]) => (
        <button key={String(id)} type="button" role="tab" aria-selected={value === id} onClick={() => onChange(id)}
                className={cn("h-7 rounded-md px-2.5 text-xs font-medium transition-colors", value === id ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200")}>
          {text}
        </button>
      ))}
    </div>
  );
}

/** Staff only: who carries the faction (reports, recorded duty time, attended events) and the recruitment funnel. */
export function WorkloadPanel() {
  const [workload, setWorkload] = useState<Workload | null>(null);
  const [funnel, setFunnel] = useState<FunnelMonth[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([progressionApi.workload(), progressionApi.funnel(12)])
      .then(([load, months]) => {
        if (!active) return;
        setWorkload(load);
        setFunnel(months);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, []);

  if (failed) return null;
  if (!workload || !funnel) return <div className="grid gap-6 lg:grid-cols-2"><div className="skeleton h-96"/><div className="skeleton h-96"/></div>;
  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <WorkloadChart workload={workload}/>
      <FunnelChart months={funnel}/>
    </div>
  );
}

function WorkloadChart({workload}: {workload: Workload}) {
  const [metric, setMetric] = useState<Metric>("reports");
  const [span, setSpan] = useState<1 | 3 | 6>(3);
  const [showAll, setShowAll] = useState(false);
  const [table, setTable] = useState(false);
  // The months are newest first; "1" is the current month.
  const months = workload.months.slice(0, span);

  const rows = useMemo(() => workload.members
    .map((member) => ({member, perMonth: months.map((month) => member[metric][month] ?? 0)}))
    .map((row) => ({...row, total: row.perMonth.reduce((sum, value) => sum + value, 0)}))
    .sort((a, b) => b.total - a.total || a.member.full_name.localeCompare(b.member.full_name, "hu")), [workload, months, metric]);

  const active = rows.filter((row) => row.total > 0);
  const total = active.reduce((sum, row) => sum + row.total, 0);
  // The share of the most active fifth: one sentence that answers "who carries it".
  const topCount = Math.max(1, Math.ceil(rows.length * 0.2));
  const topShare = total ? Math.round((rows.slice(0, topCount).reduce((sum, row) => sum + row.total, 0) / total) * 100) : 0;
  const shown = showAll ? active : active.slice(0, 12);
  const max = Math.max(1, ...shown.map((row) => row.total));
  const format = METRICS[metric].format;

  return (
    <section className="panel min-w-0 p-5" aria-labelledby="workload-title">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 id="workload-title" className="text-sm font-semibold text-white">Ki viszi a hátán?</h3>
          <p className="text-xs text-slate-500">{METRICS[metric].label} tagonként · {span === 1 ? "ez a hónap" : `az utolsó ${span} hónap`}</p>
        </div>
        <button type="button" onClick={() => setTable((value) => !value)} title={table ? "Diagram" : "Táblázat"}
                className="grid size-8 place-items-center rounded-lg text-slate-400 ring-1 ring-white/10 transition-colors hover:bg-white/5 hover:text-white">
          {table ? <ChartNoAxesColumn className="size-4"/> : <Table2 className="size-4"/>}
        </button>
      </header>
      <div className="mt-3 flex flex-wrap gap-2">
        <Segmented label="Mutató" value={metric} onChange={setMetric}
                   options={[["reports", "Jelentések"], ["duty", "Duty idő"], ["events", "Események"]] as const}/>
        <Segmented label="Időszak" value={span} onChange={setSpan} options={[[1, "Hónap"], [3, "3 hónap"], [6, "6 hónap"]] as const}/>
      </div>

      {active.length === 0 ? (
        <EmptyState icon={Users} title="Ebben az időszakban nincs adat." compact/>
      ) : (
        <>
          <p className="mt-4 text-sm text-slate-300">
            A legaktívabb <b className="text-white">{topCount}</b> tag adja {METRICS[metric].share} <b className="text-white">{topShare}%</b>-át
            <span className="text-slate-500"> · összesen {format(total)}{metric === "duty" ? "" : ` ${METRICS[metric].unit}`}</span>
          </p>
          {table ? (
            <div className="mt-4 max-h-[420px] overflow-auto rounded-lg ring-1 ring-white/10">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[#0b1324]">
                  <tr className="text-left text-slate-500">
                    <th className="px-3 py-2 font-medium">Tag</th>
                    {months.map((month) => <th key={month} className="px-2 py-2 text-right font-medium capitalize">{monthLabel(month, "short")}</th>)}
                    <th className="px-3 py-2 text-right font-medium">Összesen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {active.map((row) => (
                    <tr key={row.member.user_id}>
                      <td className="max-w-[180px] truncate px-3 py-1.5 text-slate-200">{row.member.full_name}</td>
                      {row.perMonth.map((value, index) => <td key={months[index]} className="px-2 py-1.5 text-right text-slate-400 tabular-nums">{value ? format(value) : "–"}</td>)}
                      <td className="px-3 py-1.5 text-right font-medium text-white tabular-nums">{format(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ol className="mt-4 space-y-1.5">
              {shown.map((row, index) => (
                <WorkloadBar key={row.member.user_id} member={row.member} value={row.total} max={max} index={index}
                             label={format(row.total)} breakdown={months.map((month, i) => [month, format(row.perMonth[i])] as const)}/>
              ))}
            </ol>
          )}
          {!table && active.length > 12 && (
            <button type="button" onClick={() => setShowAll((value) => !value)}
                    className="mt-3 text-xs font-medium text-slate-400 hover:text-white">{showAll ? "Csak az első 12" : `Mind a ${active.length} tag`}</button>
          )}
          {rows.length > active.length && (
            <p className="mt-2 text-[11px] text-slate-500">{rows.length - active.length} tagnál ebben az időszakban nincs rögzítve semmi.</p>
          )}
        </>
      )}
    </section>
  );
}

function WorkloadBar({member, value, max, index, label, breakdown}: {
  member: WorkloadMember;
  value: number;
  max: number;
  index: number;
  label: string;
  breakdown: readonly (readonly [string, string])[];
}) {
  return (
    <li className="group relative grid grid-cols-[minmax(0,150px)_minmax(0,1fr)_56px] items-center gap-3 rounded-md py-0.5 hover:bg-white/[0.03]">
      <span className="flex min-w-0 items-center gap-2">
        <MemberAvatar name={member.full_name} avatarUrl={member.avatar_url} size={22}/>
        <span className="truncate text-xs text-slate-300">{member.full_name}</span>
      </span>
      {/* Thin bar, rounded only at the data end, anchored to the baseline. */}
      <span className="relative h-5 border-l border-white/15">
        <span className="absolute inset-y-0.5 left-0 origin-left rounded-r animate-[bar-grow-x_0.7s_cubic-bezier(0.2,0.7,0.2,1)_both]"
              style={{width: `${Math.max(1.5, (value / max) * 100)}%`, background: SERIES, animationDelay: `${Math.min(index, 12) * 40}ms`} as CSSProperties}/>
      </span>
      <span className="text-right text-xs font-medium text-slate-100 tabular-nums">{label}</span>
      {/* Hover: the months behind the total. */}
      <span role="tooltip" className="pointer-events-none absolute top-full left-[150px] z-20 mt-1 hidden min-w-44 rounded-lg bg-[#0b1324] p-2.5 text-[11px] shadow-xl ring-1 ring-white/15 group-hover:block">
        <span className="mb-1 block font-semibold text-white">{member.full_name}</span>
        {breakdown.map(([month, text]) => (
          <span key={month} className="flex justify-between gap-4 text-slate-400"><span>{monthLabel(month)}</span><span className="text-slate-100 tabular-nums">{text}</span></span>
        ))}
      </span>
    </li>
  );
}

const STAGES: {key: keyof Omit<FunnelMonth, "month">; label: string; hint: string}[] = [
  {key: "exam_takers", label: "Felvételi vizsga", hint: "Leadott felvételi lapok"},
  {key: "exam_passed", label: "Sikeres vizsga", hint: "Átment a felvételin"},
  {key: "joined", label: "Csatlakozott", hint: "Az állományba került"},
  {key: "deputy", label: "Felavatták", hint: "Már nem Trainee"},
  {key: "stayed_30", label: "30 nap után is itt", hint: "Csak a legalább egy hónapos belépők"},
  {key: "stayed_90", label: "90 nap után is itt", hint: "Csak a legalább három hónapos belépők"},
];

function FunnelChart({months}: {months: FunnelMonth[]}) {
  const [span, setSpan] = useState<3 | 6 | 12>(6);
  const [table, setTable] = useState(false);
  const window = months.slice(0, span);
  // A retention stage only counts the months old enough for it (and compares with their joiners).
  const sums = STAGES.map((stage) => {
    const counted = window.filter((month) => month[stage.key] !== null);
    return {
      ...stage,
      value: counted.reduce((sum, month) => sum + (month[stage.key] ?? 0), 0),
      base: stage.key === "stayed_30" || stage.key === "stayed_90" ? counted.reduce((sum, month) => sum + month.joined, 0) : null,
      months: counted.length,
    };
  });
  const max = Math.max(1, ...sums.map((stage) => stage.value));

  return (
    <section className="panel min-w-0 p-5" aria-labelledby="funnel-title">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 id="funnel-title" className="flex items-center gap-2 text-sm font-semibold text-white"><Filter className="size-4 text-slate-400"/> Toborzási tölcsér</h3>
          <p className="text-xs text-slate-500">Felvételitől a megmaradásig · az utolsó {span} hónap</p>
        </div>
        <button type="button" onClick={() => setTable((value) => !value)} title={table ? "Diagram" : "Táblázat"}
                className="grid size-8 place-items-center rounded-lg text-slate-400 ring-1 ring-white/10 transition-colors hover:bg-white/5 hover:text-white">
          {table ? <ChartNoAxesColumn className="size-4"/> : <Table2 className="size-4"/>}
        </button>
      </header>
      <div className="mt-3"><Segmented label="Időszak" value={span} onChange={setSpan} options={[[3, "3 hónap"], [6, "6 hónap"], [12, "12 hónap"]] as const}/></div>

      {table ? (
        <div className="mt-4 overflow-auto rounded-lg ring-1 ring-white/10">
          <table className="w-full text-xs">
            <thead className="bg-[#0b1324]">
              <tr className="text-left text-slate-500">
                <th className="px-3 py-2 font-medium">Hónap</th>
                {STAGES.map((stage) => <th key={stage.key} className="px-2 py-2 text-right font-medium">{stage.label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {window.map((month) => (
                <tr key={month.month}>
                  <td className="px-3 py-1.5 text-slate-200">{monthLabel(month.month)}</td>
                  {STAGES.map((stage) => (
                    <td key={stage.key} className="px-2 py-1.5 text-right text-slate-300 tabular-nums">{month[stage.key] ?? "–"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ol className="mt-5 space-y-3">
          {sums.map((stage, index) => {
            const previous = index > 0 ? sums[index - 1] : null;
            // Conversion against the stage before (retention: against the joiners of the same months).
            const base = stage.base ?? previous?.value ?? null;
            const rate = base ? Math.round((stage.value / base) * 100) : null;
            return (
              <li key={stage.key} className="group relative">
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="text-slate-300">{stage.label}</span>
                  <span className="text-slate-500">
                    {rate !== null && index > 0 && <span className="mr-2 text-slate-400">{rate}%</span>}
                    <b className="font-semibold text-white tabular-nums">{stage.value}</b>
                  </span>
                </div>
                <div className="mt-1 h-5 border-l border-white/15">
                  <div className="h-full origin-left rounded-r animate-[bar-grow-x_0.7s_cubic-bezier(0.2,0.7,0.2,1)_both]"
                       style={{width: `${Math.max(1, (stage.value / max) * 100)}%`, background: SERIES, animationDelay: `${index * 60}ms`}}/>
                </div>
                <span role="tooltip" className="pointer-events-none absolute top-full left-0 z-20 mt-1 hidden rounded-lg bg-[#0b1324] p-2.5 text-[11px] text-slate-300 shadow-xl ring-1 ring-white/15 group-hover:block">
                  {stage.hint}{stage.base !== null ? ` · ${stage.months} hónap belépői (${stage.base} fő)` : ""}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
        A százalék az előző lépéshez mér; a megmaradás a hónap belépőihez. A friss hónapok a 30/90 napos sorban még nem számítanak.
      </p>
    </section>
  );
}
