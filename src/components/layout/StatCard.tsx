import type {CSSProperties, ReactNode} from "react";
import type {LucideIcon} from "lucide-react";
import {cn} from "@/lib/utils";
import {useCountUp} from "@/lib/use-count-up";
import {TONE_CLASSES, type Tone} from "./PageHeader";

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  hint?: ReactNode;
  onClick?: () => void;
  className?: string;
  /** Position in a row of cards: staggers the entrance animation. */
  index?: number;
}

function AnimatedNumber({value}: {value: number}) {
  return <>{useCountUp(value)}</>;
}

/** A single figure with a label (dashboards, page summaries). Clickable when `onClick` is set. */
export function StatCard({label, value, icon: Icon, tone = "slate", hint, onClick, className, index = 0}: StatCardProps) {
  const toneClasses = TONE_CLASSES[tone];
  const Component = onClick ? "button" : "div";
  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      style={{"--i": index} as CSSProperties}
      className={cn(
        "panel group relative flex items-center gap-4 overflow-hidden p-4 text-left animate-rise",
        onClick && "lift cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
    >
      <div className={cn("pointer-events-none absolute -top-10 -right-10 size-28 rounded-full opacity-60 blur-2xl transition-opacity duration-500 group-hover:opacity-100", toneClasses.soft)}/>
      <div className={cn("relative grid size-11 shrink-0 place-items-center rounded-xl ring-1 transition-transform duration-300 group-hover:scale-105", toneClasses.tile)}>
        <Icon className="size-5"/>
      </div>
      <div className="relative min-w-0">
        {/* A long text value ("120 ó 33 p") gets a size smaller instead of breaking in a narrow card. */}
        <div className={cn("font-semibold tabular-nums leading-tight text-white", typeof value === "string" && value.length > 8 ? "text-xl" : "text-2xl")}>
          {typeof value === "number" ? <AnimatedNumber value={value}/> : value}
        </div>
        <div className="truncate text-xs font-medium text-muted-foreground">{label}</div>
        {hint && <div className="mt-0.5 truncate text-[11px] text-slate-500">{hint}</div>}
      </div>
    </Component>
  );
}
