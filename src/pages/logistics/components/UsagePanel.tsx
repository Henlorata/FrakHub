import {useMemo, type CSSProperties} from "react";
import {Link} from "react-router";
import {CircleOff, Gauge, KeyRound, PackageSearch, ShoppingCart, Users} from "lucide-react";
import {StatCard} from "@/components/layout/StatCard";
import {EmptyState} from "@/components/layout/EmptyState";
import {LicensePlate} from "@/components/fleet/LicensePlate";
import {FLEET_TONES} from "@/lib/fleet";
import {fleetUsage, type DemandStatus} from "@/lib/fleet-usage";
import {cn} from "@/lib/utils";
import type {FleetCategory, FleetVehicle, VehicleRequest} from "@/types/supabase";

const DAYS = 90;
const LIST_LIMIT = 12;

const percent = (value: number | null) => (value === null ? "–" : `${Math.round(value * 100)}%`);

/** Low use (blue), balanced (green), nearly full (amber). */
const usageLook = (value: number | null, sharedOnly = false) =>
  value === null ? {bar: "bg-slate-500", text: "text-slate-400", label: sharedOnly ? "közös járművek" : "korlátlan kulcs"}
    : value < 0.4 ? {bar: "bg-sky-400", text: "text-sky-300", label: "kevéssé használt"}
      : value <= 0.85 ? {bar: "bg-emerald-400", text: "text-emerald-300", label: "kiegyensúlyozott"}
        : {bar: "bg-amber-400", text: "text-amber-300", label: "telítődik"};

const DEMAND_LOOK: Record<DemandStatus, {label: string; advice: string; chip: string}> = {
  missing: {label: "Nincs a járműparkban", advice: "Érdemes beszerezni.", chip: "bg-red-500/10 text-red-200 ring-red-500/30"},
  full: {label: "Minden kulcs kiadva", advice: "Bővítés vagy kulcsok átcsoportosítása.", chip: "bg-amber-500/10 text-amber-200 ring-amber-500/30"},
  available: {label: "Van szabad kulcs", advice: "Kiosztható a meglévőkből.", chip: "bg-emerald-500/10 text-emerald-200 ring-emerald-500/30"},
};

/**
 * How the stock is used: keys against the limits per category, vehicles nobody holds, full ones,
 * and the models members ask for (last 90 days) compared with what is in stock. Computed from the
 * data the page has already loaded (no extra request).
 */
export function UsagePanel({vehicles, categories, requests, onShowCategory}: {
  vehicles: FleetVehicle[];
  categories: FleetCategory[];
  requests: VehicleRequest[] | null;
  onShowCategory: (categoryId: string | null) => void;
}) {
  const usage = useMemo(() => fleetUsage(vehicles, categories, requests ?? [], {days: DAYS}), [vehicles, categories, requests]);
  const categoryName = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);
  const {totals} = usage;
  const pending = usage.demand.reduce((sum, item) => sum + item.pending, 0);

  if (!vehicles.length) return <div className="panel"><EmptyState icon={Gauge} title="Még nincs jármű a nyilvántartásban." compact/></div>;

  return (
    <div className="space-y-5" data-tour="fleet-usage">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} icon={Gauge} tone="orange" label="Kulcsok kihasználtsága" value={percent(totals.utilisation)}
                  hint={totals.capacity ? `${totals.limitedKeys} / ${totals.capacity} korlátozott kulcs kiadva` : "Nincs kulcskorlát"}/>
        <StatCard index={1} icon={KeyRound} tone="emerald" label="Kiadott kulcsok" value={totals.keys}
                  hint={totals.temporary ? `ebből ${totals.temporary} ideiglenes` : "nincs ideiglenes"}/>
        <StatCard index={2} icon={CircleOff} tone="blue" label="Kulcs nélküli járművek" value={totals.unused}
                  hint={totals.shared ? `${totals.shared} közös jármű nélkül` : "senkinél sincs kulcsa"}/>
        <StatCard index={3} icon={ShoppingCart} tone="gold" label={`Igénylések (${DAYS} nap)`} value={requests === null ? "…" : usage.requestCount}
                  hint={`${pending} függőben`}/>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
        <section className="panel animate-rise p-4" style={{"--i": 1} as CSSProperties}>
          <header className="mb-3">
            <h3 className="text-sm font-semibold text-white">Kategóriák</h3>
            <p className="text-xs text-slate-500">A korlátozott kulcsok kiadott része; a közös járművek külön. Kattints a kategória járműveiért.</p>
          </header>
          <ul className="space-y-1">
            {usage.categories.map((group) => {
              const look = usageLook(group.utilisation, group.shared === group.vehicles);
              const tone = FLEET_TONES[group.category?.tone ?? "slate"];
              const unlimitedKeys = group.keys - group.limitedKeys;
              return (
                <li key={group.category?.id ?? "none"}>
                  <button type="button" onClick={() => onShowCategory(group.category?.id ?? null)}
                          className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2 text-left ring-1 ring-white/5 transition-colors hover:bg-white/[0.04] hover:ring-white/10 sm:grid-cols-[minmax(0,1fr)_minmax(90px,150px)_3rem]">
                    <span className="min-w-0">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={cn("size-2 shrink-0 rounded-full", tone.dot)}/>
                        <span className="truncate text-sm font-medium text-slate-100">{group.category?.name ?? "Kategória nélkül"}</span>
                      </span>
                      <span className="mt-0.5 flex flex-wrap gap-x-3 pl-4 text-[11px] text-slate-400">
                        <span>{group.vehicles} jármű</span>
                        {group.capacity > 0 ? <span>{group.limitedKeys}/{group.capacity} kulcs kiadva</span> : null}
                        {unlimitedKeys > 0 && <span>{group.capacity > 0 ? "+" : ""}{unlimitedKeys} kulcs korlát nélkül</span>}
                        {group.unused > 0 && <span className="text-sky-300">{group.unused} kulcs nélkül</span>}
                        {group.full > 0 && <span className="text-amber-300">{group.full} telített</span>}
                        {group.shared > 0 && <span className="inline-flex items-center gap-1"><Users className="size-3"/>{group.shared} közös</span>}
                      </span>
                    </span>
                    <span className="hidden h-1.5 overflow-hidden rounded-full bg-white/[0.06] sm:block" title={look.label}>
                      <span className={cn("block h-full rounded-full transition-[width] duration-700", look.bar)}
                            style={{width: `${Math.round((group.utilisation ?? 0) * 100)}%`}}/>
                    </span>
                    <span className={cn("text-right text-xs font-semibold tabular-nums", look.text)} title={look.label}>{percent(group.utilisation)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-sky-400"/> 40% alatt: kevéssé használt</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-400"/> kiegyensúlyozott</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-400"/> 85% fölött: telítődik</span>
          </p>
        </section>

        <div className="flex min-w-0 flex-col gap-5">
          <section className="panel animate-rise p-4" style={{"--i": 2} as CSSProperties}>
            <header className="mb-3">
              <h3 className="text-sm font-semibold text-white">Keresett típusok</h3>
              <p className="text-xs text-slate-500">Az elmúlt {DAYS} nap igénylései típusonként, a járműparkkal összevetve.</p>
            </header>
            {requests === null ? (
              <div className="space-y-2">{[0, 1, 2].map((index) => <div key={index} className="skeleton h-14 rounded-xl"/>)}</div>
            ) : usage.demand.length === 0 ? (
              <EmptyState icon={PackageSearch} title={`Nem volt igénylés az elmúlt ${DAYS} napban.`} compact/>
            ) : (
              <ul className="space-y-1.5">
                {usage.demand.map((item) => {
                  const look = DEMAND_LOOK[item.status];
                  return (
                    <li key={item.model} className="rounded-xl px-3 py-2.5 ring-1 ring-white/5">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-100" title={item.model}>{item.model}</span>
                        <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1", look.chip)}>{look.label}</span>
                      </div>
                      <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-slate-400">
                        <span className="font-semibold text-slate-200">{item.requests} igénylés</span>
                        {item.pending > 0 && <span className="text-amber-300">{item.pending} függőben</span>}
                        {item.approved > 0 && <span className="text-emerald-300">{item.approved} elfogadva</span>}
                        {item.rejected > 0 && <span className="text-red-300">{item.rejected} elutasítva</span>}
                        <span>· {item.stock ? `${item.stock} jármű, ${item.freeKeys === null ? "korlátlan kulcs" : `${item.freeKeys} szabad kulcs`}` : "nincs ilyen jármű"}</span>
                      </p>
                      {item.status !== "available" && <p className="mt-0.5 text-[11px] text-slate-500">{look.advice}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <VehicleList title="Kulcs nélküli járművek" hint="Senkinél sincs a kulcsa: kiosztható, áthelyezhető vagy kivezethető."
                       vehicles={usage.idle} categoryName={categoryName} empty="Minden járműnek van kulcsosa." index={3}/>
          <VehicleList title="Telített járművek" hint="Minden kulcsuk kiadva; új igénylőnek csak bővítéssel jut."
                       vehicles={usage.saturated} categoryName={categoryName} empty="Egyik jármű kulcsai sem fogytak el." index={4} showKeys/>
        </div>
      </div>
    </div>
  );
}

function VehicleList({title, hint, vehicles, categoryName, empty, index, showKeys}: {
  title: string;
  hint: string;
  vehicles: FleetVehicle[];
  categoryName: Map<string, string>;
  empty: string;
  index: number;
  showKeys?: boolean;
}) {
  return (
    <section className="panel animate-rise p-4" style={{"--i": index} as CSSProperties}>
      <header className="mb-3 flex items-baseline gap-2">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <span className="text-xs text-slate-500 tabular-nums">{vehicles.length}</span>
      </header>
      <p className="mb-3 -mt-2 text-xs text-slate-500">{hint}</p>
      {vehicles.length === 0 ? (
        <p className="rounded-xl bg-white/[0.02] px-3 py-3 text-xs text-slate-500 ring-1 ring-white/5">{empty}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {vehicles.slice(0, LIST_LIMIT).map((vehicle) => (
            <li key={vehicle.id}>
              <Link to={`/logistics/fleet/${vehicle.id}`}
                    className="flex min-w-0 items-center gap-2.5 rounded-xl px-2.5 py-2 ring-1 ring-white/5 transition-colors hover:bg-white/[0.04] hover:ring-white/10">
                <LicensePlate plate={vehicle.plate} size="sm"/>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-slate-100">{vehicle.model}</span>
                  <span className="block truncate text-[11px] text-slate-500">
                    {[vehicle.category_id ? categoryName.get(vehicle.category_id) : null, vehicle.station].filter(Boolean).join(" · ") || "–"}
                  </span>
                </span>
                {showKeys && <span className="text-[11px] text-amber-300 tabular-nums">{vehicle.holders.length}/{vehicle.capacity}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {vehicles.length > LIST_LIMIT && <p className="mt-2 text-[11px] text-slate-500">és még {vehicles.length - LIST_LIMIT} jármű</p>}
    </section>
  );
}
