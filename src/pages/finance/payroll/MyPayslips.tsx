import {useEffect, useState, type CSSProperties} from "react";
import {Check, ChevronDown, Clock, Wallet} from "lucide-react";
import {EmptyState} from "@/components/layout/EmptyState";
import {financeApi, formatMoney} from "@/lib/finance";
import {formatDate} from "@/lib/datetime";
import {formatDuty, monthLabel} from "@/lib/registry";
import {cn} from "@/lib/utils";
import type {Payslip} from "@/types/finance";
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
