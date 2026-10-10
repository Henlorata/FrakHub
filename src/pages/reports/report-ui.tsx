import {Gavel, Lock, LockOpen, Timer} from "lucide-react";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {formatDate} from "@/lib/datetime";
import {formatFine, formatJailTime} from "@/lib/report-templates";
import {periodLabel} from "@/lib/reports";
import {cn} from "@/lib/utils";

/** The payroll month's state: open until its payment, then locked. */
export function PeriodBanner({period, current, locked, lockedAt, startedAt}: {
  period: string;
  current: string;
  locked: boolean | null;
  lockedAt: string | null;
  startedAt: string | null;
}) {
  const isCurrent = period === current;
  return (
    <div className={cn("flex items-start gap-3 rounded-xl px-4 py-3 text-sm ring-1",
      locked ? "bg-white/[0.03] text-slate-300 ring-white/10" : "bg-sky-500/[0.06] text-sky-100 ring-sky-500/25")}>
      {locked ? <Lock className="mt-0.5 size-4 shrink-0 text-slate-400"/> : <LockOpen className="mt-0.5 size-4 shrink-0 text-sky-300"/>}
      <p className="min-w-0">
        <span className="font-semibold text-white">{periodLabel(period)}</span>{" "}
        {locked
          ? <>· lezárva a fizetéskor{lockedAt ? ` (${formatDate(lockedAt)})` : ""}: a jelentései már nem változnak.</>
          : isCurrent
            ? <>· nyitott{startedAt ? `, a ${formatDate(startedAt).replace(/\.$/, "")}-i fizetés óta` : ""}: a most mentett jelentések ide számítanak, a következő fizetésig.</>
            : <>· nyitott: a fizetéséig változhat.</>}
      </p>
    </div>
  );
}

/** The month picker: the months that have reports (newest first), optionally every month. */
export function PeriodSelect({value, periods, onChange, allowAll}: {
  value: string | null;
  periods: string[];
  onChange: (period: string | null) => void;
  allowAll?: boolean;
}) {
  return (
    <Select value={value ?? "all"} onValueChange={(next) => onChange(next === "all" ? null : next)}>
      <SelectTrigger className="w-full sm:w-56" aria-label="Elszámolási hónap"><SelectValue/></SelectTrigger>
      <SelectContent>
        {allowAll && <SelectItem value="all">Minden hónap</SelectItem>}
        {periods.map((period) => <SelectItem key={period} value={period}><span className="truncate">{periodLabel(period)}</span></SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/** The fine and the jail time of a report, as the forum shows them. */
export function PenaltyChips({fine, jailTime, className}: {fine: string | null; jailTime: string | null; className?: string}) {
  const fineText = fine && fine !== "-" ? formatFine(fine) : null;
  const jailText = jailTime && jailTime !== "-" ? formatJailTime(jailTime) : null;
  if (!fineText && !jailText) return null;
  return (
    <span className={cn("flex flex-wrap gap-1.5", className)}>
      {fineText && (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-300 ring-1 ring-emerald-500/25">
          <Gavel className="size-3"/> {fineText}
        </span>
      )}
      {jailText && (
        <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-0.5 font-mono text-[11px] text-red-300 ring-1 ring-red-500/25">
          <Timer className="size-3"/> {jailText}
        </span>
      )}
    </span>
  );
}
