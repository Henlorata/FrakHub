import type {ReactNode} from "react";
import type {LucideIcon} from "lucide-react";
import {cn} from "@/lib/utils";
import {TONE_CLASSES, type Tone} from "./PageHeader";

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  hint?: ReactNode;
  onClick?: () => void;
  className?: string;
}

/** A single figure with a label (dashboards, page summaries). Clickable when `onClick` is set. */
export function StatCard({label, value, icon: Icon, tone = "slate", hint, onClick, className}: StatCardProps) {
  const toneClasses = TONE_CLASSES[tone];
  const Component = onClick ? "button" : "div";
  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "panel flex items-center gap-4 p-4 text-left transition-colors",
        onClick && "cursor-pointer hover:border-white/20 hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
    >
      <div className={cn("grid size-11 shrink-0 place-items-center rounded-xl ring-1", toneClasses.tile)}>
        <Icon className="size-5"/>
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-semibold tabular-nums leading-tight text-white">{value}</div>
        <div className="truncate text-xs font-medium text-muted-foreground">{label}</div>
        {hint && <div className="mt-0.5 truncate text-[11px] text-slate-500">{hint}</div>}
      </div>
    </Component>
  );
}
