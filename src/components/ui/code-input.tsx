import {useState} from "react";
import {cn} from "@/lib/utils";

const LENGTH = 6;

/**
 * A six-digit one-time code. One real input (paste, the phone's code autofill and number pad keep
 * working) drawn as six boxes; `onComplete` fires when the sixth digit arrives.
 */
export function CodeInput({value, onChange, onComplete, disabled, invalid, autoFocus, id, label}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  id?: string;
  label: string;
}) {
  const [focused, setFocused] = useState(false);
  const active = Math.min(value.length, LENGTH - 1);

  return (
    <div className="relative">
      <input id={id} value={value} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={LENGTH}
             autoFocus={autoFocus} disabled={disabled} aria-label={label} aria-invalid={invalid || undefined}
             onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
             onChange={(event) => {
               const next = event.target.value.replace(/\D/g, "").slice(0, LENGTH);
               onChange(next);
               if (next.length === LENGTH && next !== value) onComplete?.(next);
             }}
             className="absolute inset-0 z-10 size-full cursor-text text-transparent caret-transparent opacity-0 disabled:cursor-not-allowed"/>
      <div aria-hidden className="grid grid-cols-6 gap-2">
        {Array.from({length: LENGTH}, (_, index) => {
          const digit = value[index];
          const current = focused && !disabled && index === active;
          return (
            <div key={index}
                 className={cn("grid h-14 place-items-center rounded-xl bg-white/[0.04] font-mono text-2xl font-semibold text-white ring-1 ring-white/10 transition",
                   digit && "bg-white/[0.07] ring-white/20",
                   current && "bg-white/[0.08] ring-2 ring-amber-400/70",
                   invalid && !current && "ring-red-500/50",
                   disabled && "opacity-60",
                   index === 3 && "ml-2")}>
              {digit ?? (current ? <span className="h-6 w-px animate-pulse bg-amber-300"/> : null)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
