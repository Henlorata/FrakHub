import type {ReactNode} from "react";
import type {LucideIcon} from "lucide-react";
import {cn} from "@/lib/utils";

export type Tone = "gold" | "blue" | "emerald" | "orange" | "violet" | "red" | "cyan" | "slate";

export const TONE_CLASSES: Record<Tone, {tile: string; text: string; soft: string; ring: string}> = {
  gold: {tile: "bg-yellow-500/10 text-yellow-400 ring-yellow-500/25", text: "text-yellow-400", soft: "bg-yellow-500/10", ring: "ring-yellow-500/30"},
  blue: {tile: "bg-sky-500/10 text-sky-400 ring-sky-500/25", text: "text-sky-400", soft: "bg-sky-500/10", ring: "ring-sky-500/30"},
  emerald: {tile: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/25", text: "text-emerald-400", soft: "bg-emerald-500/10", ring: "ring-emerald-500/30"},
  orange: {tile: "bg-orange-500/10 text-orange-400 ring-orange-500/25", text: "text-orange-400", soft: "bg-orange-500/10", ring: "ring-orange-500/30"},
  violet: {tile: "bg-violet-500/10 text-violet-400 ring-violet-500/25", text: "text-violet-400", soft: "bg-violet-500/10", ring: "ring-violet-500/30"},
  red: {tile: "bg-red-500/10 text-red-400 ring-red-500/25", text: "text-red-400", soft: "bg-red-500/10", ring: "ring-red-500/30"},
  cyan: {tile: "bg-cyan-500/10 text-cyan-400 ring-cyan-500/25", text: "text-cyan-400", soft: "bg-cyan-500/10", ring: "ring-cyan-500/30"},
  slate: {tile: "bg-slate-500/10 text-slate-300 ring-slate-500/25", text: "text-slate-300", soft: "bg-slate-500/10", ring: "ring-slate-500/30"},
};

interface PageHeaderProps {
  icon?: LucideIcon;
  /** Small label above the title (section or English subtitle). */
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  tone?: Tone;
  className?: string;
}

/** Consistent page title block: icon tile, eyebrow, title, description and actions. */
export function PageHeader({icon: Icon, eyebrow, title, description, actions, tone = "gold", className}: PageHeaderProps) {
  const toneClasses = TONE_CLASSES[tone];
  return (
    <header className={cn("flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div className="flex min-w-0 items-start gap-4">
        {Icon && (
          <div className={cn("grid size-12 shrink-0 place-items-center rounded-2xl ring-1", toneClasses.tile)}>
            <Icon className="size-6"/>
          </div>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className={cn("text-[11px] font-semibold uppercase tracking-[0.2em]", toneClasses.text)}>{eyebrow}</p>
          )}
          <h1 className="truncate text-2xl font-semibold tracking-tight text-white md:text-[28px]">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
