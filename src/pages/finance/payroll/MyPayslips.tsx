import {useEffect, useState, type CSSProperties} from "react";
import {Check, ChevronDown, Clock, Target, Wallet} from "lucide-react";
import {EmptyState} from "@/components/layout/EmptyState";
import {financeApi, formatMoney} from "@/lib/finance";
import {formatDate} from "@/lib/datetime";
import {formatDuty, monthLabel} from "@/lib/registry";
import {cn} from "@/lib/utils";
import type {DutyTier, Payslip} from "@/types/finance";
import {PAY_PARTS, placeLabel} from "./payroll-ui";

/** A member's own pay of the closed months, with how each amount was made up. */
export function MyPayslips() {
  const [slips, setSlips] = useState<Payslip[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    financeApi.payslips().then((list) => {
      setSlips(list);
      setOpen(list[0]?.month ?? null);
    }).catch(() => setSlips([]));
  }, []);

  if (slips === null) return <div className="space-y-3">{Array.from({length: 3}, (_, index) => <div key={index} className="skeleton h-20"/>)}</div>;
  if (slips.length === 0) {
    return (
      <div className="panel">
        <EmptyState icon={Wallet} title="Még nincs lezárt havi fizetésed."
                    description="A havi gyűlés után a vezetőség lezárja a hónapot; ekkor értesítést kapsz és itt látod a részleteket."/>
      </div>
    );
  }

  const year = slips.filter((slip) => slip.month.slice(0, 4) === slips[0].month.slice(0, 4)).reduce((sum, slip) => sum + slip.row.total, 0);

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">Összesen ({slips[0].month.slice(0, 4)}): <span className="font-mono font-semibold text-emerald-300">{formatMoney(year)}</span></p>
      {slips.length >= 2 && <PayslipHistory slips={slips}/>}
      {slips.map((slip, index) => {
        const expanded = open === slip.month;
        const row = slip.row;
        return (
          <div key={slip.month} style={{"--i": index} as CSSProperties} className="panel animate-rise overflow-hidden">
            <button type="button" onClick={() => setOpen(expanded ? null : slip.month)} aria-expanded={expanded}
                    className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-white/[0.02]">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/25">
                <Wallet className="size-5"/>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white">{monthLabel(slip.month)}</p>
                <p className="truncate text-xs text-slate-500">{row.rank} · {row.unit ?? "–"}{row.qualification ? ` · ${row.qualification}` : ""} · {formatDuty(row.duty_minutes)}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-lg font-semibold tabular-nums text-emerald-300">{formatMoney(row.total)}</p>
                <p className={cn("inline-flex items-center gap-1 text-[11px]", slip.paid ? "text-emerald-300" : "text-amber-300")}>
                  {slip.paid ? <><Check className="size-3"/> Kifizetve {slip.paid_at ? formatDate(slip.paid_at) : ""}</> : <><Clock className="size-3"/> Kifizetésre vár</>}
                </p>
              </div>
              <ChevronDown className={cn("size-4 shrink-0 text-slate-500 transition-transform", expanded && "rotate-180")}/>
            </button>
            {expanded && <TierHint slip={slip}/>}
            {expanded && (
              <dl className="animate-fade grid grid-cols-1 gap-1 border-t border-white/5 p-4 sm:grid-cols-2">
                {PAY_PARTS.map((part) => (
                  <div key={part.key} className={cn("flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5", row.pay[part.key] ? "bg-white/[0.02]" : "opacity-50")}>
                    <dt className="text-sm text-slate-300">
                      {part.label}
                      {part.key === "reports" && <span className="ml-1 text-xs text-slate-500">({row.reports} db)</span>}
                      {part.key === "top_duty" && row.top_duty > 0 && <span className="ml-1 text-xs text-amber-300">{placeLabel(row.top_duty)} hely</span>}
                      {part.key === "top_report" && row.top_report > 0 && <span className="ml-1 text-xs text-amber-300">{placeLabel(row.top_report)} hely</span>}
                      {part.key === "bonus" && row.bonus_note && <span className="ml-1 text-xs text-slate-500">({row.bonus_note})</span>}
                    </dt>
                    <dd className="font-mono text-sm tabular-nums text-white">{formatMoney(row.pay[part.key])}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** "4 more hours would have reached the 40-hour tier: +1 000 000 $" for a closed month. */
function TierHint({slip}: {slip: Payslip}) {
  const tiers: DutyTier[] = [...(slip.duty_tiers ?? [])].sort((a, b) => a.hours - b.hours);
  if (tiers.length === 0) return null;
  const minutes = slip.row.duty_minutes ?? 0;
  const minimum = slip.min_duty_hours ?? 0;
  const hours = minutes / 60;
  const reached = tiers.filter((tier) => hours >= tier.hours).at(-1) ?? null;
  const next = tiers.find((tier) => hours < tier.hours) ?? null;
  const short = (target: number) => String(Math.round((target - hours) * 10) / 10).replace(".", ",");
  if (hours < minimum) {
    return (
      <p className="flex items-center gap-1.5 border-t border-white/5 px-4 py-2.5 text-xs text-amber-200/90">
        <Target className="size-3.5 shrink-0"/> A minimumhoz ({minimum} óra) még {short(minimum)} óra hiányzott: alatta nem jár rang- és duty-fizetés.
      </p>
    );
  }
  if (!next) return <p className="flex items-center gap-1.5 border-t border-white/5 px-4 py-2.5 text-xs text-emerald-200/90"><Target className="size-3.5 shrink-0"/> A legmagasabb duty sávot érted el.</p>;
  return (
    <p className="flex items-center gap-1.5 border-t border-white/5 px-4 py-2.5 text-xs text-sky-200/90">
      <Target className="size-3.5 shrink-0"/> Még {short(next.hours)} óra kellett volna a(z) {next.hours} órás sávhoz: +{formatMoney(next.pay - (reached?.pay ?? 0))}
    </p>
  );
}

/** Single series bar colour (categorical slot 1, validated on the dark surface). */
const SERIES = "#3987e5";

/**
 * The closed months' pay as bars (oldest left): the highest and the latest month are labelled,
 * the rest on hover; the dashed line is the average.
 */
function PayslipHistory({slips}: {slips: Payslip[]}) {
  const months = [...slips].slice(0, 12).reverse();
  const max = Math.max(1, ...months.map((slip) => slip.row.total));
  const average = months.reduce((sum, slip) => sum + slip.row.total, 0) / months.length;
  const top = months.reduce((best, slip) => (slip.row.total > best.row.total ? slip : best), months[0]);
  const latest = months[months.length - 1];
  return (
    <section className="panel animate-rise p-4" aria-label="A havi fizetéseim alakulása">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-xs">
        <p className="font-medium text-slate-200">Havi fizetésem</p>
        <p className="text-slate-500">Átlag: <span className="font-mono text-slate-300">{formatMoney(Math.round(average))}</span></p>
      </div>
      <div className="relative h-40">
        <div aria-hidden className="absolute inset-x-0 border-t border-dashed border-white/20" style={{bottom: `${(average / max) * 100}%`}}/>
        <ol className="relative flex h-full items-end justify-around gap-2 border-b border-white/15">
          {months.map((slip) => {
            const labelled = slip === top || slip === latest;
            return (
              <li key={slip.month} className="group relative flex h-full w-full max-w-10 flex-col items-center justify-end">
                {labelled && <span className="mb-1 font-mono text-[10px] whitespace-nowrap text-slate-300 tabular-nums">{formatMoney(slip.row.total)}</span>}
                <span className="w-full max-w-6 origin-bottom rounded-t animate-[bar-grow_0.8s_cubic-bezier(0.2,0.7,0.2,1)_both]"
                      style={{height: `${Math.max(1.5, (slip.row.total / max) * 100)}%`, background: SERIES}}/>
                <span role="tooltip" className="pointer-events-none absolute bottom-full z-20 mb-1 hidden rounded-lg bg-[#0b1324] px-2.5 py-1.5 text-[11px] whitespace-nowrap text-slate-200 shadow-xl ring-1 ring-white/15 group-hover:block">
                  <span className="block font-semibold">{monthLabel(slip.month)}</span>
                  <span className="block font-mono">{formatMoney(slip.row.total)}</span>
                  <span className="block text-slate-400">{formatDuty(slip.row.duty_minutes)}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <ol className="mt-1.5 flex justify-around gap-2">
        {months.map((slip) => <li key={slip.month} className="w-full max-w-10 text-center text-[10px] capitalize text-slate-500">{monthLabel(slip.month, "short")}</li>)}
      </ol>
    </section>
  );
}
