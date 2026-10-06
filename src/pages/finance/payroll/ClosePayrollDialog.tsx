import {useState} from "react";
import {Bell, Loader2, Lock} from "lucide-react";
import {Dialog, DialogContent, DialogDescription, DialogTitle} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {formatMoney} from "@/lib/finance";
import {monthLabel} from "@/lib/registry";
import type {PayrollMonth} from "@/types/finance";
import {MoneyField} from "../components/MoneyField";

interface ClosePayrollDialogProps {
  payroll: PayrollMonth;
  paidCount: number;
  payableCount: number;
  onClose: () => void;
  onConfirm: (withdrawn: number | null, note: string) => Promise<void>;
}

/**
 * Closing a month after the meeting: the amounts are stored as they are now (later changes of
 * the pay table do not touch them) and every paid member is notified of their amount.
 */
export function ClosePayrollDialog({payroll, paidCount, payableCount, onClose, onConfirm}: ClosePayrollDialogProps) {
  const [withdrawn, setWithdrawn] = useState(payroll.paid_total || payroll.total);
  const [note, setNote] = useState(payroll.note ?? "");
  const [saving, setSaving] = useState(false);
  const difference = payroll.total - withdrawn;

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <div>
          <DialogTitle className="flex items-center gap-2"><Lock className="size-4 text-emerald-400"/> {monthLabel(payroll.month)} lezárása</DialogTitle>
          <DialogDescription className="mt-1">A hónap összegei rögzülnek: a fizetési tábla későbbi módosítása nem változtat rajtuk.</DialogDescription>
        </div>

        <dl className="grid grid-cols-2 gap-2 text-sm">
          <Figure label="Összesen" value={formatMoney(payroll.total)} strong/>
          <Figure label={`Adóval (${payroll.settings.tax_percent}%)`} value={formatMoney(payroll.total + payroll.tax)}/>
          <Figure label="Kifizetve jelölve" value={`${paidCount} / ${payableCount} fő`}/>
          <Figure label="Kifizetett összeg" value={formatMoney(payroll.paid_total)}/>
        </dl>

        <div className="space-y-1.5">
          <Label>Összes kivétel a frakciószámláról</Label>
          <MoneyField label="Összes kivétel a frakciószámláról" value={withdrawn} onChange={setWithdrawn}/>
          <p className={difference === 0 ? "text-xs text-emerald-300" : "text-xs text-amber-300"}>
            Különbözet: {formatMoney(difference)} {difference > 0 ? "(ennyi maradt)" : difference < 0 ? "(többet vettek ki)" : ""}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payroll-note">Megjegyzés</Label>
          <Textarea id="payroll-note" value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)}
                    placeholder="pl. A havi gyűlés után kifizetve; egy tag fizetése a következő hónapra csúszik."/>
        </div>
        <p className="flex items-start gap-2 rounded-lg bg-white/[0.03] p-2.5 text-xs text-slate-300 ring-1 ring-white/10">
          <Bell className="mt-0.5 size-3.5 shrink-0 text-emerald-400"/> Minden fizetést kapó tag értesítést kap az összegről.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Mégse</Button>
          <Button disabled={saving} className="bg-emerald-500 text-black hover:bg-emerald-400" onClick={async () => {
            setSaving(true);
            try {
              await onConfirm(withdrawn, note);
            } finally {
              setSaving(false);
            }
          }}>{saving ? <Loader2 className="animate-spin"/> : <Lock/>} Lezárás</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Figure({label, value, strong}: {label: string; value: string; strong?: boolean}) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-3 py-2 ring-1 ring-white/5">
      <dt className="text-[11px] text-slate-500">{label}</dt>
      <dd className={strong ? "font-mono font-semibold text-emerald-300 tabular-nums" : "font-mono text-slate-200 tabular-nums"}>{value}</dd>
    </div>
  );
}
