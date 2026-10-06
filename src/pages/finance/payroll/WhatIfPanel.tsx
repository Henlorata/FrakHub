import {useMemo, useState} from "react";
import {ArrowRight, Calculator, Landmark, Loader2, TrendingDown, TrendingUp} from "lucide-react";
import {Button} from "@/components/ui/button";
import {MemberAvatar} from "@/components/MemberAvatar";
import {defaultPayrollMonth, financeApi, formatMoney} from "@/lib/finance";
import {computePayroll} from "@/lib/payroll";
import {formatDate, monthKey} from "@/lib/datetime";
import {monthLabel} from "@/lib/registry";
import {cn} from "@/lib/utils";
import type {FinanceOverview, PayrollMonth, PayrollSettings} from "@/types/finance";

interface Loaded {
  payroll: PayrollMonth;
  balance: {amount: number; at: string | null} | null;
}

const withTax = (total: number, tax: number) => Math.round(total * (1 + tax / 100));

/**
 * "What if": the month's payroll with the saved table and with the edited one, against the last
 * recorded balance of the faction account. Loaded only when asked for (two calls).
 */
export function WhatIfPanel({saved, draft}: {saved: PayrollSettings; draft: PayrollSettings}) {
  const [data, setData] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const current = await financeApi.payroll(monthKey());
      const closed = current.months.filter((entry) => entry.status === "closed").map((entry) => entry.month);
      const month = defaultPayrollMonth(closed);
      const [payroll, overview] = await Promise.all([
        month === current.month ? Promise.resolve(current) : financeApi.payroll(month),
        financeApi.overview(6).catch(() => null as FinanceOverview | null),
      ]);
      const latest = overview?.months.find((entry) => entry.balance !== null) ?? null;
      setData({payroll, balance: latest ? {amount: latest.balance!, at: latest.balance_at ?? null} : null});
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const result = useMemo(() => {
    if (!data) return null;
    // A closed month keeps its amounts; the comparison uses its rows with both tables.
    const before = computePayroll(data.payroll.rows, {}, saved);
    const after = computePayroll(data.payroll.rows, {}, draft);
    const baseTotal = before.reduce((sum, row) => sum + row.total, 0);
    const nextTotal = after.reduce((sum, row) => sum + row.total, 0);
    const changes = after.map((row, index) => ({row, before: before[index].total, after: row.total, delta: row.total - before[index].total}))
      .filter((entry) => entry.delta !== 0).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    return {
      baseTotal, nextTotal, baseCost: withTax(baseTotal, saved.tax_percent), nextCost: withTax(nextTotal, draft.tax_percent),
      changes, paid: after.filter((row) => row.total > 0).length,
    };
  }, [data, saved, draft]);

  return (
    <section className="panel animate-rise overflow-hidden p-0 ring-1 ring-sky-500/20" data-tour="payroll-whatif">
      <header className="flex flex-wrap items-center gap-3 px-5 py-4">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-300 ring-1 ring-sky-500/25"><Calculator className="size-4"/></div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-white">Mit jelentene a módosítás?</h3>
          <p className="text-xs text-slate-500">A hónap bérlapja a mostani és a módosított táblával, a kassza utolsó rögzített egyenlegéhez mérve.</p>
        </div>
        <Button variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
          {loading ? <Loader2 className="animate-spin"/> : <Calculator/>} {data ? "Újraszámolás" : "Kiszámolás"}
        </Button>
      </header>
      {failed && <p className="border-t border-white/5 px-5 py-3 text-sm text-red-300">A bérlap nem tölthető be.</p>}
      {data && result && (
        <div className="space-y-4 border-t border-white/5 p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Figure label={`${monthLabel(data.payroll.month)} – adóval`} before={result.baseCost} after={result.nextCost}/>
            <Figure label="Fizetett tagok" before={null} after={result.paid} plain/>
            {data.balance ? (
              <div className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-slate-400 uppercase"><Landmark className="size-3.5"/> Kassza</p>
                <p className="mt-1 font-mono text-lg font-semibold text-white tabular-nums">{formatMoney(data.balance.amount)}</p>
                <p className="text-[11px] text-slate-500">
                  {data.balance.at ? `${formatDate(data.balance.at)} · ` : ""}
                  {result.nextCost > 0 ? `${Math.floor(data.balance.amount / result.nextCost)} hónapra elég (most: ${result.baseCost > 0 ? Math.floor(data.balance.amount / result.baseCost) : "–"})` : ""}
                </p>
              </div>
            ) : (
              <div className="rounded-xl bg-white/[0.03] p-3 text-xs text-slate-500 ring-1 ring-white/10">Még nincs rögzített egyenleg a kasszáról.</div>
            )}
          </div>
          {result.changes.length === 0 ? (
            <p className="text-sm text-slate-400">A módosítás ebben a hónapban senki fizetését nem változtatja meg.</p>
          ) : (
            <div>
              <p className="mb-2 text-xs text-slate-400">{result.changes.length} tag fizetése változna; a legnagyobb változások:</p>
              <ul className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
                {result.changes.slice(0, 8).map((entry) => (
                  <li key={entry.row.user_id} className="flex min-w-0 items-center gap-2 rounded-lg bg-white/[0.02] px-2.5 py-1.5 text-xs ring-1 ring-white/5">
                    <MemberAvatar name={entry.row.name} avatarUrl={entry.row.avatar_url ?? null} size={22}/>
                    <span className="min-w-0 flex-1 truncate text-slate-200">{entry.row.name}</span>
                    <span className="font-mono text-slate-500 tabular-nums">{formatMoney(entry.before)}</span>
                    <ArrowRight className="size-3 text-slate-600"/>
                    <span className="font-mono text-white tabular-nums">{formatMoney(entry.after)}</span>
                    <span className={cn("font-mono tabular-nums", entry.delta > 0 ? "text-amber-300" : "text-sky-300")}>
                      {entry.delta > 0 ? "+" : "−"}{formatMoney(Math.abs(entry.delta))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.payroll.status === "closed" && (
            <p className="text-[11px] text-slate-500">Ez a hónap már le van zárva: a valódi kifizetés nem változik, a számítás a következő hónapokra mutat irányt.</p>
          )}
        </div>
      )}
    </section>
  );
}

function Figure({label, before, after, plain}: {label: string; before: number | null; after: number; plain?: boolean}) {
  const delta = before === null ? 0 : after - before;
  return (
    <div className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10">
      <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold text-white tabular-nums">{plain ? after : formatMoney(after)}</p>
      {before !== null && (
        <p className={cn("flex items-center gap-1 text-[11px]", delta > 0 ? "text-amber-300" : delta < 0 ? "text-sky-300" : "text-slate-500")}>
          {delta > 0 ? <TrendingUp className="size-3"/> : delta < 0 ? <TrendingDown className="size-3"/> : null}
          {delta === 0 ? "nincs változás" : `${delta > 0 ? "+" : "−"}${formatMoney(Math.abs(delta))} (most ${formatMoney(before)})`}
        </p>
      )}
    </div>
  );
}
