import {useMemo, type CSSProperties} from "react";
import {Landmark, TrendingDown, TrendingUp, Wallet} from "lucide-react";
import {Button} from "@/components/ui/button";
import {EmptyState} from "@/components/layout/EmptyState";
import {formatDate} from "@/lib/datetime";
import {formatMoney, formatMoneyShort} from "@/lib/finance";
import {monthLabel} from "@/lib/registry";
import {forecastTreasury} from "@/lib/treasury";
import {cn} from "@/lib/utils";
import type {FinanceOverview} from "@/types/finance";

/**
 * The faction account ahead: the latest balance read in the game, what is still to pay from it,
 * and where it heads at the pace of the last months.
 */
export function TreasuryForecast({overview, onOpenPayroll}: {overview: FinanceOverview; onOpenPayroll?: () => void}) {
  const forecast = useMemo(() => forecastTreasury(overview), [overview]);
  const {latest, monthCost, monthCostKind, pending, remaining, monthlyChange, span, monthlyIncome, projection, runway, history} = forecast;

  if (!latest || remaining === null) {
    return (
      <section data-tour="treasury-forecast" className="panel animate-rise p-5">
        <EmptyState compact icon={Landmark} title="Még nincs beírt kasszaegyenleg."
                    description="A Havi fizetés lapon az Executive Staff beírja a frakciókassza egyenlegét (a játékból, kifizetés előtt): ebből készül az előrejelzés."
                    action={onOpenPayroll && <Button variant="outline" size="sm" onClick={onOpenPayroll}><Wallet/> Havi fizetés</Button>}/>
      </section>
    );
  }

  const bars = [...history.map((item) => ({...item, projected: false})), ...projection.map((item) => ({...item, projected: true}))];
  const peak = Math.max(1, ...bars.map((item) => Math.abs(item.balance)));
  const short = remaining < 0;

  return (
    <section data-tour="treasury-forecast" className="panel animate-rise space-y-5 p-5">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="flex items-center gap-2 font-semibold text-white"><Landmark className="size-4 text-amber-300"/> Kassza-előrejelzés</h3>
        <p className="text-xs text-slate-500">A Havi fizetés lapon beírt egyenlegekből (a játékból, kifizetés előtt).</p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Figure label="Kassza egyenlege" value={formatMoney(latest.balance)}
                hint={`${monthLabel(latest.month)}${latest.at ? ` · beírva ${formatDate(latest.at)}` : ""}`}/>
        <Figure label={monthCostKind === "paid" ? "A hónap fizetése (kifizetve)" : "A hónap várható fizetése"}
                value={monthCost === null ? "–" : `− ${formatMoney(monthCost)}`}
                hint={monthCost === null ? "Még nincs lezárt hónap, amiből becsülni lehetne." : monthCostKind === "paid" ? "Adóval, a kivét szerint." : "Adóval; a mostani lap és a lezárt hónapok alapján."}/>
        <Figure label="Elbírálásra váró költségtérítés" value={`− ${formatMoney(pending)}`} hint={`${overview.pending.count} kérelem`}/>
        <Figure label={short ? "Hiányzik a fedezethez" : "Utána marad"} value={formatMoney(Math.abs(remaining))} tone={short ? "bad" : "good"}
                hint={short ? "A kassza nem fedezi a várható kiadásokat." : "Ha minden kifizetés és kérelem teljesül."}/>
      </div>

      {bars.length > 1 && (
        <div>
          <div className="grid h-40 items-end gap-2" style={{gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))`}} aria-label="Az egyenleg alakulása">
            {bars.map((item, index) => (
              <div key={item.month} className="flex h-full flex-col items-center justify-end gap-1.5" style={{"--i": index} as CSSProperties}>
                <span className={cn("font-mono text-[10px] tabular-nums", item.projected ? "text-slate-500" : "text-slate-300")}>
                  {formatMoneyShort(item.balance)}
                </span>
                <div className="flex w-full max-w-14 flex-1 flex-col justify-end">
                  <div title={`${monthLabel(item.month)}: ${formatMoney(item.balance)}${item.projected ? " (előrejelzés)" : ""}`}
                       className={cn("animate-rise w-full rounded-t-md",
                         item.projected ? "border border-dashed border-b-0 bg-white/[0.03]" : "",
                         item.balance < 0 ? (item.projected ? "border-red-400/60" : "bg-red-500/70")
                           : item.projected ? "border-amber-300/50" : "bg-gradient-to-t from-amber-600 to-amber-300")}
                       style={{height: `${Math.max(3, (Math.abs(item.balance) / peak) * 100)}%`}}/>
                </div>
                <span className={cn("text-[11px]", item.projected ? "text-slate-600 italic" : "text-slate-500")}>{monthLabel(item.month, "short")}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 flex items-center gap-4 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-amber-400"/> Beírt egyenleg</span>
            {projection.length > 0 && <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm border border-dashed border-amber-300/60"/> Előrejelzés</span>}
          </p>
        </div>
      )}

      <p className="flex items-start gap-2 rounded-xl bg-white/[0.03] px-4 py-3 text-sm text-slate-300 ring-1 ring-white/5">
        {monthlyChange === null ? (
          <span>Az ütem becsléséhez legalább két hónap egyenlege kell; havonta írjátok be a kifizetés előtt.</span>
        ) : (
          <>
            {monthlyChange >= 0 ? <TrendingUp className="mt-0.5 size-4 shrink-0 text-emerald-300"/> : <TrendingDown className="mt-0.5 size-4 shrink-0 text-red-300"/>}
            <span>
              Az elmúlt {span} hónapban a kassza havonta átlagosan{" "}
              <strong className={monthlyChange >= 0 ? "text-emerald-300" : "text-red-300"}>{formatMoneyShort(Math.abs(monthlyChange))} $</strong>-ral{" "}
              {monthlyChange >= 0 ? "gyarapodott" : "fogyott"}
              {monthlyIncome !== null && <> (becsült bevétel: havi ~{formatMoneyShort(monthlyIncome)} $)</>}.
              {projection.length > 0 && <> Így {monthLabel(projection[projection.length - 1].month)} elején kb. <strong className="text-white">{formatMoneyShort(projection[projection.length - 1].balance)} $</strong> lehet.</>}
              {runway !== null && <> Ezzel az ütemmel {runway < 1 ? "egy hónapig sem" : `kb. ${Math.floor(runway)} hónapig`} elég.</>}
            </span>
          </>
        )}
      </p>
    </section>
  );
}

function Figure({label, value, hint, tone}: {label: string; value: string; hint?: string; tone?: "good" | "bad"}) {
  return (
    <div className={cn("min-w-0 rounded-xl px-4 py-3 ring-1",
      tone === "good" ? "bg-emerald-500/[0.07] ring-emerald-500/25" : tone === "bad" ? "bg-red-500/[0.08] ring-red-500/30" : "bg-white/[0.03] ring-white/5")}>
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className={cn("font-mono text-lg font-semibold tabular-nums wrap-anywhere",
        tone === "good" ? "text-emerald-300" : tone === "bad" ? "text-red-300" : "text-slate-100")}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}
