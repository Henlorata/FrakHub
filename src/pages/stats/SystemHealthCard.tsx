import {useEffect, useState} from "react";
import {AlertTriangle, Database} from "lucide-react";
import {formatDateTime} from "@/lib/datetime";
import {supabase} from "@/lib/supabaseClient";
import {dbUsedPercent, type DbHealth} from "@/lib/system";
import {cn} from "@/lib/utils";

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString("hu-HU", {maximumFractionDigits: bytes < 10 * 1024 * 1024 ? 1 : 0})} MB`;

/**
 * The database's size against the free plan (measured by the daily housekeeping) and its largest
 * tables, for the Executive Staff and the Bureau Manager. One small call.
 */
export function SystemHealthCard() {
  const [health, setHealth] = useState<DbHealth | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    supabase.rpc("get_db_health").then(({data, error}) => {
      if (active) setHealth(error ? null : (data as DbHealth | null));
    });
    return () => {
      active = false;
    };
  }, []);

  const percent = dbUsedPercent(health);
  const warning = (percent ?? 0) >= 70;
  return (
    <section id="rendszer" className="panel scroll-mt-24 p-5">
      <header className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-white/[0.04] text-slate-300 ring-1 ring-white/10"><Database className="size-5"/></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-white">Rendszer: adatbázis-tárhely</h2>
          <p className="text-xs text-slate-500">A napi karbantartás méri; az ingyenes csomag 500 MB-ot enged.</p>
        </div>
      </header>
      {health === undefined ? (
        <div className="skeleton mt-4 h-16 rounded-xl"/>
      ) : !health ? (
        <p className="mt-4 text-sm text-slate-500">A napi karbantartás még nem mérte meg.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <p className="text-3xl font-semibold tabular-nums text-white">{mb(health.bytes)} <span className="text-base font-normal text-slate-500">/ {mb(health.limit_bytes)}</span></p>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/[0.06]" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? 0}
                 aria-label="Foglalt tárhely">
              <div className={cn("h-full rounded-full transition-[width] duration-700", warning ? "bg-orange-400" : "bg-sky-400")} style={{width: `${Math.min(percent ?? 0, 100)}%`}}/>
            </div>
            <p className={cn("mt-2 flex items-center gap-1.5 text-xs", warning ? "text-orange-200" : "text-slate-400")}>
              {warning && <AlertTriangle className="size-3.5"/>}
              {percent}% foglalt{warning ? " · figyelem: közel a korláthoz" : ""} · mérve: {formatDateTime(health.measured_at)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Legnagyobb táblák</p>
            <ul className="mt-2 space-y-1 text-sm">
              {health.largest.map((table) => (
                <li key={table.table} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate font-mono text-xs text-slate-300">{table.table}</span>
                  <span className="shrink-0 tabular-nums text-slate-400">{mb(table.bytes)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
