import {useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode} from "react";
import {useLocation} from "react-router";
import {
  ArrowDownRight, ArrowUpRight, BarChart3, ChartNoAxesColumn, FileText, FolderOpen, Gavel, Handshake, Radar, Scale, Table2, Ticket, Timer,
} from "lucide-react";
import {PageHeader} from "@/components/layout/PageHeader";
import {EmptyState} from "@/components/layout/EmptyState";
import {formatCurrency} from "@/lib/penalcode-processor";
import {change, compactNumber, penalEntry, statsApi, type DepartmentStats, type StatTotals} from "@/lib/stats";
import {cn} from "@/lib/utils";
import {useAuth} from "@/context/AuthContext";
import {isExecutive} from "@shared/ranks";
import {ErrorLogCard} from "./ErrorLogCard";
import {SystemHealthCard} from "./SystemHealthCard";

const PERIODS = [[30, "30 nap"], [90, "90 nap"], [365, "1 év"]] as const;
type Period = (typeof PERIODS)[number][0];

const DAYS = ["Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat", "Vasárnap"];
const SHORT_DAYS = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];

const bucketLabel = (start: string, unit: "week" | "month", long = false) => {
  const date = new Date(`${start}T12:00:00`);
  return unit === "month"
    ? new Intl.DateTimeFormat("hu-HU", {month: long ? "long" : "short", year: long ? "numeric" : undefined}).format(date)
    : `${new Intl.DateTimeFormat("hu-HU", {month: "short", day: "numeric"}).format(date)}${long ? " heti" : ""}`;
};

/**
 * The department in numbers: tickets and arrests from the calculator's log, fines and jail time,
 * reports, BOLO alerts, cases and warrants, against the period before. Charts follow one hue per
 * measure (two measures of a different scale get two charts, never two axes); every chart has a
 * table view.
 */
export function StatsPage() {
  const {profile} = useAuth();
  const leadership = isExecutive(profile) || !!profile?.is_bureau_manager;
  const [days, setDays] = useState<Period>(30);
  const [stats, setStats] = useState<DepartmentStats | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const {hash} = useLocation();
  const scrolled = useRef(false);

  // Arriving from a dashboard task (/stats#rendszer, #hibak): the section, once the charts above it are drawn.
  useEffect(() => {
    if (loading || !hash || scrolled.current) return;
    scrolled.current = true;
    document.getElementById(hash.slice(1))?.scrollIntoView({block: "start"});
  }, [loading, hash]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    statsApi.load(days)
      .then((result) => {
        if (!active) return;
        setStats(result);
        setFailed(false);
      })
      .catch(() => active && setFailed(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [days]);

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 pb-10">
      <PageHeader icon={BarChart3} tone="cyan" eyebrow="Intézkedések és ügyek" title="Statisztika"
                  description="A kalkulátorból kiadott bírságok és letartóztatások, a rögzített jelentések, BOLO-k és akták, az előző időszakhoz mérve."/>

      <div className="flex flex-wrap items-center gap-3" role="toolbar" aria-label="Időszak">
        <div className="inline-flex rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/10" role="tablist" aria-label="Időszak">
          {PERIODS.map(([value, label]) => (
            <button key={value} type="button" role="tab" aria-selected={days === value} onClick={() => setDays(value)}
                    className={cn("h-8 rounded-md px-3 text-xs font-medium transition-colors",
                      days === value ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200")}>
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500">Az előző ugyanilyen hosszú időszakhoz képest.</span>
      </div>

      {failed && !stats ? (
        <div className="panel"><EmptyState icon={BarChart3} title="A statisztika nem tölthető be"/></div>
      ) : !stats ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({length: 8}, (_, index) => <div key={index} className="skeleton h-24 rounded-2xl"/>)}</div>
      ) : (
        // While another period loads, the previous one stays (dimmed): no layout jump.
        <div className={cn("space-y-6 transition-opacity", loading && "opacity-60")}>
          <Tiles current={stats.current} previous={stats.previous}/>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard title="Bírságok" subtitle={stats.unit === "week" ? "hetente" : "havonta"}
                       table={<SeriesTable stats={stats} pick="tickets" label="Bírság"/>}>
              <ColumnChart color="#f59e0b" format={(value) => String(value)}
                           data={stats.series.map((row) => ({key: row.start, label: bucketLabel(row.start, stats.unit), title: bucketLabel(row.start, stats.unit, true),
                             value: row.tickets}))}/>
            </ChartCard>
            <ChartCard title="Letartóztatások" subtitle={stats.unit === "week" ? "hetente" : "havonta"}
                       table={<SeriesTable stats={stats} pick="arrests" label="Letartóztatás"/>}>
              <ColumnChart color="#a78bfa" format={(value) => String(value)}
                           data={stats.series.map((row) => ({key: row.start, label: bucketLabel(row.start, stats.unit), title: bucketLabel(row.start, stats.unit, true),
                             value: row.arrests}))}/>
            </ChartCard>
            <ChartCard title="Kiszabott bírságok összege" subtitle={stats.unit === "week" ? "hetente" : "havonta"}
                       table={<SeriesTable stats={stats} pick="fines" label="Összeg" format={formatCurrency}/>}>
              <ColumnChart color="#34d399" format={(value) => `$${compactNumber(value)}`}
                           data={stats.series.map((row) => ({key: row.start, label: bucketLabel(row.start, stats.unit), title: bucketLabel(row.start, stats.unit, true),
                             value: row.fines}))}/>
            </ChartCard>
            <ChartCard title="Rögzített jelentések" subtitle={stats.unit === "week" ? "hetente" : "havonta"}
                       table={<SeriesTable stats={stats} pick="reports" label="Jelentés"/>}>
              <ColumnChart color="#38bdf8" format={(value) => String(value)}
                           data={stats.series.map((row) => ({key: row.start, label: bucketLabel(row.start, stats.unit), title: bucketLabel(row.start, stats.unit, true),
                             value: row.reports}))}/>
            </ChartCard>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <ChartCard title="Leggyakoribb tételek" subtitle="a kalkulátorból kiadott intézkedések indokai"
                       table={<OffenseTable offenses={stats.offenses}/>}>
              <OffenseBars offenses={stats.offenses}/>
            </ChartCard>
            <ChartCard title="Mikor intézkedünk?" subtitle="bírságok és letartóztatások a hét napjai és az órák szerint (magyar idő)"
                       table={<HeatTable cells={stats.heatmap}/>}>
              <Heatmap cells={stats.heatmap}/>
            </ChartCard>
          </div>
        </div>
      )}
      {leadership && <SystemHealthCard/>}
      {leadership && <ErrorLogCard/>}
    </div>
  );
}

// --- Tiles ------------------------------------------------------------------------------------

function Tiles({current, previous}: {current: StatTotals; previous: StatTotals}) {
  const tiles: {label: string; icon: typeof Ticket; value: string; delta: number | null; hint?: string}[] = [
    {label: "Bírság", icon: Ticket, value: current.tickets.toLocaleString("hu-HU"), delta: change(current.tickets, previous.tickets)},
    {label: "Letartóztatás", icon: Handshake, value: current.arrests.toLocaleString("hu-HU"), delta: change(current.arrests, previous.arrests)},
    {label: "Kiszabott bírság", icon: Scale, value: `$${compactNumber(current.fines)}`, delta: change(current.fines, previous.fines)},
    {label: "Kiszabott fegyház", icon: Timer, value: `${Math.round(current.jail_minutes / 60).toLocaleString("hu-HU")} óra`,
      delta: change(current.jail_minutes, previous.jail_minutes)},
    {label: "Rögzített jelentés", icon: FileText, value: current.reports.toLocaleString("hu-HU"), delta: change(current.reports, previous.reports)},
    {label: "Kiadott BOLO", icon: Radar, value: current.bolos.toLocaleString("hu-HU"), delta: change(current.bolos, previous.bolos),
      hint: `${current.bolos_resolved} megtalálva`},
    {label: "Megnyitott akta", icon: FolderOpen, value: current.cases_opened.toLocaleString("hu-HU"), delta: change(current.cases_opened, previous.cases_opened),
      hint: `${current.cases_closed} lezárva`},
    {label: "Kiadott parancs", icon: Gavel, value: current.warrants.toLocaleString("hu-HU"), delta: change(current.warrants, previous.warrants)},
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((tile, index) => (
        <div key={tile.label} className="panel animate-rise flex min-w-0 flex-col gap-1 p-4" style={{"--i": index} as CSSProperties}>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <tile.icon className="size-4 text-slate-500"/>{tile.label}
          </div>
          <div className="text-2xl font-semibold text-white">{tile.value}</div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            {tile.delta === null ? <span className="text-slate-600">nincs előző adat</span> : (
              <span className={cn("inline-flex items-center gap-0.5 font-medium", tile.delta >= 0 ? "text-slate-200" : "text-slate-400")}>
                {tile.delta >= 0 ? <ArrowUpRight className="size-3.5"/> : <ArrowDownRight className="size-3.5"/>}
                {tile.delta > 0 ? "+" : ""}{tile.delta}%
              </span>
            )}
            {tile.hint && <span className="text-slate-500">{tile.hint}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Chart card with its table view ------------------------------------------------------

function ChartCard({title, subtitle, table, children}: {title: string; subtitle: string; table: ReactNode; children: ReactNode}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className="panel min-w-0 p-5" aria-label={title}>
      <header className="mb-4 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <button type="button" onClick={() => setAsTable((value) => !value)} title={asTable ? "Diagram" : "Táblázat"} aria-label={asTable ? "Diagram" : "Táblázat"}
                className="grid size-8 place-items-center rounded-lg text-slate-400 ring-1 ring-white/10 transition-colors hover:bg-white/5 hover:text-white">
          {asTable ? <ChartNoAxesColumn className="size-4"/> : <Table2 className="size-4"/>}
        </button>
      </header>
      {asTable ? <div className="max-h-[320px] overflow-auto rounded-lg ring-1 ring-white/10">{table}</div> : children}
    </section>
  );
}

/** A clean axis maximum: 1, 2, 5 × 10^n at or above the largest value. */
function niceMax(value: number) {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  return ([1, 2, 5, 10].find((step) => step * power >= value) ?? 10) * power;
}

// --- Columns (one measure) -------------------------------------------------------------------

function ColumnChart({data, color, format}: {data: {key: string; label: string; title: string; value: number}[]; color: string; format: (value: number) => string}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...data.map((item) => item.value)));
  const peak = data.reduce((best, item, index) => (item.value > (data[best]?.value ?? -1) ? index : best), 0);
  const ticks = [max, max / 2, 0];
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));
  if (data.every((item) => item.value === 0)) return <p className="py-12 text-center text-xs text-slate-500">Ebben az időszakban nincs adat.</p>;
  return (
    <div className="relative">
      <div className="relative ml-12 h-48">
        {ticks.map((tick) => (
          <div key={tick} className="pointer-events-none absolute inset-x-0 border-t border-white/[0.07]" style={{bottom: `${(tick / max) * 100}%`}}>
            <span className="absolute -top-2 -left-12 w-10 text-right text-[10px] whitespace-nowrap text-slate-500 tabular-nums">{format(tick)}</span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {data.map((item, index) => {
            const height = (item.value / max) * 100;
            return (
              <div key={item.key} className="relative flex h-full min-w-0 flex-1 items-end justify-center" tabIndex={0}
                   aria-label={`${item.title}: ${format(item.value)}`}
                   onPointerEnter={() => setHover(index)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(index)} onBlur={() => setHover(null)}>
                <div className={cn("w-full max-w-[24px] rounded-t-[4px] transition-[height,filter] duration-500", hover === index && "brightness-125")}
                     style={{height: `${Math.max(height, item.value > 0 ? 1.5 : 0)}%`, background: color}}/>
                {index === peak && item.value > 0 && hover === null && (
                  <span className="pointer-events-none absolute text-[10px] font-medium text-slate-200 tabular-nums" style={{bottom: `calc(${height}% + 4px)`}}>
                    {format(item.value)}
                  </span>
                )}
                {hover === index && (
                  <div className="pointer-events-none absolute z-10 rounded-md bg-[#0b1220] px-2 py-1 text-[11px] whitespace-nowrap shadow-xl ring-1 ring-white/15"
                       style={{bottom: `calc(${height}% + 8px)`}}>
                    <span className="font-semibold text-white">{format(item.value)}</span>
                    <span className="ml-1.5 text-slate-400">{item.title}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-1.5 ml-12 flex gap-[2px]">
        {data.map((item, index) => (
          <span key={item.key} className="min-w-0 flex-1 truncate text-center text-[10px] text-slate-500">{index % labelEvery === 0 ? item.label : ""}</span>
        ))}
      </div>
    </div>
  );
}

function SeriesTable({stats, pick, label, format = (value: number) => value.toLocaleString("hu-HU")}: {
  stats: DepartmentStats; pick: "tickets" | "arrests" | "fines" | "reports"; label: string; format?: (value: number) => string;
}) {
  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-[#0b1324]"><tr className="text-left text-slate-500">
        <th className="px-3 py-2 font-medium">{stats.unit === "week" ? "Hét" : "Hónap"}</th><th className="px-3 py-2 text-right font-medium">{label}</th>
      </tr></thead>
      <tbody className="divide-y divide-white/5">
        {stats.series.map((row) => (
          <tr key={row.start}><td className="px-3 py-1.5 text-slate-300">{bucketLabel(row.start, stats.unit, true)}</td>
            <td className="px-3 py-1.5 text-right text-white tabular-nums">{format(row[pick])}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

// --- Offences ---------------------------------------------------------------------------------

function OffenseBars({offenses}: {offenses: DepartmentStats["offenses"]}) {
  const shown = offenses.slice(0, 10);
  const max = Math.max(1, ...shown.map((item) => item.count));
  if (!shown.length) return <p className="py-12 text-center text-xs text-slate-500">Ebben az időszakban nincs intézkedés.</p>;
  return (
    <ol className="space-y-2">
      {shown.map((item, index) => {
        const entry = penalEntry(item.code);
        return (
          <li key={item.code} className="animate-rise grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3" style={{"--i": index} as CSSProperties}
              title={entry ? `${entry.name} · ${entry.category}` : item.code}>
            <span className="truncate rounded-md bg-white/[0.04] px-1.5 py-0.5 text-center font-mono text-[11px] text-slate-200 ring-1 ring-white/10">{item.code}</span>
            <div className="min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-xs text-slate-200">{entry?.name ?? "Ismeretlen tétel"}</span>
                <span className="shrink-0 text-xs font-medium text-white tabular-nums">{item.count}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-white/[0.04]">
                <div className="h-full rounded-full bg-amber-400 transition-[width] duration-700" style={{width: `${(item.count / max) * 100}%`}}/>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function OffenseTable({offenses}: {offenses: DepartmentStats["offenses"]}) {
  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-[#0b1324]"><tr className="text-left text-slate-500">
        <th className="px-3 py-2 font-medium">Rövidítés</th><th className="px-3 py-2 font-medium">Tétel</th><th className="px-3 py-2 text-right font-medium">Darab</th>
      </tr></thead>
      <tbody className="divide-y divide-white/5">
        {offenses.map((item) => (
          <tr key={item.code}><td className="px-3 py-1.5 font-mono text-slate-200">{item.code}</td>
            <td className="px-3 py-1.5 text-slate-300">{penalEntry(item.code)?.name ?? "–"}</td>
            <td className="px-3 py-1.5 text-right text-white tabular-nums">{item.count}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

// --- When (weekday × hour) ---------------------------------------------------------------

// One hue, dark to bright on the dark surface (five steps, plus "none").
const HEAT_STEPS = ["rgb(245 158 11 / 0.14)", "rgb(245 158 11 / 0.32)", "rgb(245 158 11 / 0.52)", "rgb(245 158 11 / 0.74)", "rgb(251 191 36 / 0.95)"];

function Heatmap({cells}: {cells: DepartmentStats["heatmap"]}) {
  const [hover, setHover] = useState<{dow: number; hour: number; count: number} | null>(null);
  const grid = useMemo(() => {
    const map = new Map(cells.map((cell) => [`${cell.dow}:${cell.hour}`, cell.count]));
    return {get: (dow: number, hour: number) => map.get(`${dow}:${hour}`) ?? 0, max: Math.max(1, ...cells.map((cell) => cell.count))};
  }, [cells]);
  if (!cells.length) return <p className="py-12 text-center text-xs text-slate-500">Ebben az időszakban nincs intézkedés.</p>;
  const step = (count: number) => (count === 0 ? null : HEAT_STEPS[Math.min(HEAT_STEPS.length - 1, Math.floor((count / grid.max) * HEAT_STEPS.length - 1e-9))]);
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <div className="grid min-w-[520px] gap-[2px]" style={{gridTemplateColumns: "32px repeat(24, minmax(0, 1fr))"}}>
          <span/>
          {Array.from({length: 24}, (_, hour) => (
            <span key={hour} className="text-center text-[9px] text-slate-600 tabular-nums">{hour % 3 === 0 ? hour : ""}</span>
          ))}
          {SHORT_DAYS.map((day, row) => (
            <div key={day} className="contents">
              <span className="self-center text-[10px] text-slate-500">{day}</span>
              {Array.from({length: 24}, (_, hour) => {
                const count = grid.get(row + 1, hour);
                const fill = step(count);
                return (
                  <span key={hour} tabIndex={0} aria-label={`${DAYS[row]} ${hour}:00–${hour + 1}:00: ${count} intézkedés`}
                        onPointerEnter={() => setHover({dow: row + 1, hour, count})} onPointerLeave={() => setHover(null)}
                        onFocus={() => setHover({dow: row + 1, hour, count})} onBlur={() => setHover(null)}
                        className={cn("aspect-square rounded-[3px] transition-transform", hover?.dow === row + 1 && hover.hour === hour && "scale-110 ring-1 ring-white/50")}
                        style={{background: fill ?? "rgb(255 255 255 / 0.03)"}}/>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
        <span className="min-h-4 flex-1 text-slate-300">
          {hover ? <><b className="text-white">{hover.count}</b> intézkedés · {DAYS[hover.dow - 1]} {hover.hour}:00–{hover.hour + 1}:00</> : "Vidd az egeret egy cellára."}
        </span>
        <span className="inline-flex items-center gap-1">kevés
          {HEAT_STEPS.map((color) => <span key={color} className="size-3 rounded-[3px]" style={{background: color}}/>)}
          sok
        </span>
      </div>
    </div>
  );
}

function HeatTable({cells}: {cells: DepartmentStats["heatmap"]}) {
  const sorted = [...cells].sort((a, b) => b.count - a.count);
  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-[#0b1324]"><tr className="text-left text-slate-500">
        <th className="px-3 py-2 font-medium">Nap</th><th className="px-3 py-2 font-medium">Óra</th><th className="px-3 py-2 text-right font-medium">Intézkedés</th>
      </tr></thead>
      <tbody className="divide-y divide-white/5">
        {sorted.map((cell) => (
          <tr key={`${cell.dow}:${cell.hour}`}><td className="px-3 py-1.5 text-slate-300">{DAYS[cell.dow - 1]}</td>
            <td className="px-3 py-1.5 text-slate-300 tabular-nums">{cell.hour}:00–{cell.hour + 1}:00</td>
            <td className="px-3 py-1.5 text-right text-white tabular-nums">{cell.count}</td></tr>
        ))}
      </tbody>
    </table>
  );
}
