import {useEffect, useState, type CSSProperties} from "react";
import {BarChart3, Clock, Lock, LockOpen, Receipt, Wallet} from "lucide-react";
import {EmptyState} from "@/components/layout/EmptyState";
import {StatCard} from "@/components/layout/StatCard";
import {financeApi, formatMoney, formatMoneyShort} from "@/lib/finance";
import {monthLabel} from "@/lib/registry";
import {cn} from "@/lib/utils";
import type {FinanceOverview} from "@/types/finance";
import {TreasuryForecast} from "./TreasuryForecast";

/** The last six months of the faction account: the forecast, payroll and reimbursements per Hungarian month. */
export function OverviewTab({onOpenPending, onOpenPayroll}: {onOpenPending: () => void; onOpenPayroll?: () => void}) {
  const [data, setData] = useState<FinanceOverview | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    financeApi.overview(6).then(setData).catch(() => setFailed(true));
  }, []);

  if (failed) return <div className="panel"><EmptyState icon={BarChart3} title="Az áttekintés betöltése nem sikerült."/></div>;
  if (!data) return <div className="space-y-4"><div className="skeleton h-24"/><div className="skeleton h-80"/></div>;

  const months = data.months;
  const outgoing = (month: FinanceOverview["months"][number]) => (month.payroll_total ?? 0) + month.reimbursed;
  const peak = Math.max(1, ...months.map(outgoing));
  const closed = months.filter((month) => month.payroll_status === "closed");
  const average = closed.length ? Math.round(closed.reduce((sum, month) => sum + (month.payroll_total ?? 0), 0) / closed.length) : 0;
  const reimbursed = months.reduce((sum, month) => sum + month.reimbursed, 0);

  return (
    <div className="space-y-5">
      <TreasuryForecast overview={data} onOpenPayroll={onOpenPayroll}/>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard index={0} icon={Clock} tone="orange" label="Elbírálásra váró költségtérítés" value={formatMoney(data.pending.amount)}
                  hint={`${data.pending.count} kérelem`} onClick={onOpenPending}/>
        <StatCard index={1} icon={Wallet} tone="emerald" label="Átlagos havi fizetés" value={formatMoney(average)}
                  hint={`${closed.length} lezárt hónap alapján`}/>
        <StatCard index={2} icon={Receipt} tone="blue" label="Költségtérítés (6 hónap)" value={formatMoney(reimbursed)}/>
      </div>

      <section className="panel animate-rise p-5">
        <header className="mb-5 flex flex-wrap items-center gap-3">
          <h3 className="flex items-center gap-2 font-semibold text-white"><BarChart3 className="size-4 text-emerald-400"/> Havi kiadások</h3>
          <div className="ml-auto flex items-center gap-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-emerald-400"/> Havi fizetés</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-sky-400"/> Költségtérítés</span>
          </div>
        </header>
        <div className="grid h-56 grid-cols-6 items-end gap-3">
          {[...months].reverse().map((month, index) => {
            const payroll = month.payroll_total ?? 0;
            return (
              <div key={month.month} className="flex h-full flex-col items-center justify-end gap-2" style={{"--i": index} as CSSProperties}>
                <span className="font-mono text-[11px] text-slate-300 tabular-nums">{outgoing(month) ? formatMoneyShort(outgoing(month)) : "–"}</span>
                <div className="flex w-full max-w-16 flex-1 flex-col justify-end overflow-hidden rounded-t-lg bg-white/[0.03] ring-1 ring-white/5">
                  <div className="animate-rise bg-sky-400/80" style={{height: `${(month.reimbursed / peak) * 100}%`}}/>
                  <div className="animate-rise bg-gradient-to-t from-emerald-600 to-emerald-400" style={{height: `${(payroll / peak) * 100}%`}}/>
                </div>
                <span className="text-[11px] text-slate-500">{monthLabel(month.month, "short")}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-2.5">Hónap</th>
              <th className="px-3 py-2.5">Havi fizetés</th>
              <th className="px-3 py-2.5 text-right">Összeg</th>
              <th className="px-3 py-2.5 text-right">Adóval</th>
              <th className="px-3 py-2.5 text-right">Kivét</th>
              <th className="px-4 py-2.5 text-right">Költségtérítés</th>
            </tr>
          </thead>
          <tbody>
            {months.map((month) => (
              <tr key={month.month} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-2.5 font-medium text-white">{monthLabel(month.month)}</td>
                <td className="px-3 py-2.5">
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ring-1",
                    month.payroll_status === "closed" ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"
                      : month.payroll_status === "open" ? "bg-amber-500/10 text-amber-300 ring-amber-500/30" : "text-slate-500 ring-white/10")}>
                    {month.payroll_status === "closed" ? <><Lock className="size-3"/> Lezárva</> : month.payroll_status === "open" ? <><LockOpen className="size-3"/> Nyitott</> : "Nincs elkezdve"}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-200">{month.payroll_total !== null ? formatMoney(month.payroll_total) : "–"}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-400">
                  {month.payroll_total !== null ? formatMoney(Math.round(month.payroll_total * (1 + (month.payroll_tax_percent ?? 0) / 100))) : "–"}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-400">{month.payroll_withdrawn !== null ? formatMoney(month.payroll_withdrawn) : "–"}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-200">
                  {month.reimbursed ? formatMoney(month.reimbursed) : "–"}
                  {month.reimbursements > 0 && <span className="ml-1 text-[11px] text-slate-500">({month.reimbursements})</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
