import type {CSSProperties} from "react";
import {Clock} from "lucide-react";
import {formatDuty, monthLabel, recentMonths} from "@/lib/registry";
import {cn} from "@/lib/utils";
import type {DutyTimeEntry} from "@/types/supabase";

interface DutyChartProps {
  entries: DutyTimeEntry[];
  months?: number;
  className?: string;
}

/** Monthly duty time as animated bars (last `months` months, the current one highlighted). */
export function DutyChart({entries, months = 6, className}: DutyChartProps) {
  const range = recentMonths(months);
  const byMonth = new Map(entries.map((entry) => [entry.month.slice(0, 10), entry.minutes]));
  const values = range.map((month) => byMonth.get(month) ?? null);
  const recorded = values.filter((value): value is number => value !== null);
  const max = Math.max(60, ...recorded);
  const total = recorded.reduce((sum, value) => sum + value, 0);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-xs text-slate-400">
        <span className="flex items-center gap-1.5"><Clock className="size-3.5 text-primary"/> Összesen:
          <span className="font-semibold text-white tabular-nums">{formatDuty(total)}</span></span>
        <span>Havi átlag: <span className="font-semibold text-white tabular-nums">
          {recorded.length ? formatDuty(Math.round(total / recorded.length)) : "–"}</span></span>
      </div>
      <div className="flex h-40 items-end gap-2 sm:gap-3">
        {range.map((month, index) => {
          const value = values[index];
          const current = index === range.length - 1;
          const height = value === null ? 0 : Math.max(4, Math.round((value / max) * 100));
          return (
            <div key={month} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
              <span className={cn("text-[11px] font-medium tabular-nums opacity-0 transition-opacity group-hover:opacity-100",
                value === null ? "text-slate-600" : "text-slate-200", current && value !== null && "opacity-100")}>
                {value === null ? "–" : formatDuty(value, true)}
              </span>
              <div className="relative flex w-full flex-1 items-end overflow-hidden rounded-lg bg-white/[0.03] ring-1 ring-white/5">
                <div
                  title={`${monthLabel(month)}: ${value === null ? "nincs adat" : formatDuty(value)}`}
                  style={{height: `${height}%`, "--i": index} as CSSProperties}
                  className={cn("animate-[bar-grow_0.8s_cubic-bezier(0.2,0.7,0.2,1)_both] w-full origin-bottom rounded-lg bg-gradient-to-t [animation-delay:calc(var(--i)*70ms)]",
                    current ? "from-amber-600 via-yellow-400 to-yellow-200 shadow-[0_0_18px_rgb(234_179_8/0.45)]"
                      : "from-sky-700/80 via-sky-500/80 to-sky-300/80")}
                />
              </div>
              <span className={cn("text-[11px] capitalize", current ? "font-semibold text-primary" : "text-slate-500")}>
                {monthLabel(month, "short")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
