import {useState} from "react";
import {toast} from "sonner";
import {Landmark, Loader2, Save, TrendingDown, TrendingUp} from "lucide-react";
import {Button} from "@/components/ui/button";
import {formatDateTime} from "@/lib/datetime";
import {financeApi, formatMoney} from "@/lib/finance";
import {cn, errorMessage} from "@/lib/utils";
import type {PayrollMonth} from "@/types/finance";
import {MoneyField} from "../components/MoneyField";

/**
 * The faction account's balance (read in the game before the payout) against the month's pay
 * with tax: shows whether the money is enough and what stays.
 */
export function TreasuryPanel({payroll, cost, onSaved}: {payroll: PayrollMonth; cost: number; onSaved: (next: PayrollMonth) => void}) {
  const [draft, setDraft] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const value = draft ?? payroll.balance ?? 0;
  const changed = draft !== null && draft !== (payroll.balance ?? 0);
  const balance = payroll.balance ?? null;
  const remaining = balance === null ? null : balance - cost;

  const save = async () => {
    setSaving(true);
    try {
      onSaved(await financeApi.setBalance(payroll.month, draft));
      setDraft(null);
      toast.success("Kassza egyenlege mentve.");
    } catch (error) {
      toast.error(errorMessage(error, "A mentés nem sikerült."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section data-tour="treasury" className="panel animate-rise grid grid-cols-1 gap-4 p-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/25"><Landmark className="size-5"/></div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-medium text-slate-300">Frakciókassza egyenlege <span className="text-slate-500">(a játékból, kifizetés előtt)</span></p>
          <div className="flex gap-2">
            <MoneyField label="Frakciókassza egyenlege" value={value} onChange={setDraft} className="max-w-56 flex-1"/>
            {changed && (
              <Button size="sm" className="h-9" disabled={saving} onClick={() => void save()}>
                {saving ? <Loader2 className="animate-spin"/> : <Save/>} Mentés
              </Button>
            )}
          </div>
          <p className="text-[11px] text-slate-500">
            {payroll.balance_at ? `Beírta: ${payroll.balance_by_name ?? "–"} · ${formatDateTime(payroll.balance_at)}` : "Még nincs megadva erre a hónapra."}
          </p>
        </div>
      </div>
      <div className="rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/5">
        <p className="text-[11px] text-slate-500">A hónap kifizetése adóval</p>
        <p className="font-mono text-lg font-semibold text-slate-100 tabular-nums">{formatMoney(cost)}</p>
      </div>
      <div className={cn("rounded-xl px-4 py-3 ring-1",
        remaining === null ? "bg-white/[0.03] ring-white/5" : remaining >= 0 ? "bg-emerald-500/[0.07] ring-emerald-500/25" : "bg-red-500/[0.08] ring-red-500/30")}>
        <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
          {remaining !== null && (remaining >= 0 ? <TrendingUp className="size-3.5 text-emerald-300"/> : <TrendingDown className="size-3.5 text-red-300"/>)}
          {remaining === null ? "Kifizetés után marad" : remaining >= 0 ? "Kifizetés után marad" : "Hiányzik a kifizetéshez"}
        </p>
        <p className={cn("font-mono text-lg font-semibold tabular-nums", remaining === null ? "text-slate-500" : remaining >= 0 ? "text-emerald-300" : "text-red-300")}>
          {remaining === null ? "–" : formatMoney(Math.abs(remaining))}
        </p>
      </div>
    </section>
  );
}
