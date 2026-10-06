import {useState} from "react";
import {parseMoney} from "@/lib/finance";
import {cn} from "@/lib/utils";

const money = new Intl.NumberFormat("hu-HU");

/** An amount typed with or without spaces ("15 000 000"); shown grouped when not focused. */
export function MoneyField({value, onChange, disabled, className, label, suffix = "$", allowNegative = false}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
  label: string;
  suffix?: string;
  /** Deductions: a leading minus is kept. */
  allowNegative?: boolean;
}) {
  // The typed text while focused, the grouped amount otherwise.
  const [text, setText] = useState<string | null>(null);

  return (
    <div className={cn("relative", className)}>
      <input
        aria-label={label}
        inputMode="numeric"
        disabled={disabled}
        value={text ?? money.format(value)}
        onFocus={(event) => {
          setText(money.format(value));
          event.target.select();
        }}
        onBlur={() => setText(null)}
        onChange={(event) => {
          const next = event.target.value.replace(allowNegative ? /[^\d\s-]/g : /[^\d\s]/g, "");
          setText(next);
          const amount = parseMoney(next) ?? 0;
          onChange(Math.max(Math.min(amount, 10_000_000_000), allowNegative ? -10_000_000_000 : 0));
        }}
        className="h-9 w-full rounded-md bg-white/[0.03] pr-7 pl-2.5 text-right font-mono text-sm tabular-nums text-slate-100 ring-1 ring-white/10 outline-none transition-colors focus:bg-white/[0.06] focus:ring-2 focus:ring-emerald-400/60 disabled:opacity-70"
      />
      <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-slate-500">{suffix}</span>
    </div>
  );
}
