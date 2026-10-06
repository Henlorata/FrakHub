import type {ReactNode} from "react";
import type {LucideIcon} from "lucide-react";
import {cn} from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({icon: Icon, title, description, action, className, compact}: EmptyStateProps) {
  return (
    <div className={cn("animate-fade flex flex-col items-center justify-center text-center", compact ? "gap-2 py-8" : "gap-3 py-16", className)}>
      <div className="animate-float-y grid size-12 place-items-center rounded-2xl bg-gradient-to-b from-white/[0.07] to-white/[0.02] text-slate-400 ring-1 ring-white/10">
        <Icon className="size-6"/>
      </div>
      <div>
        <p className="text-sm font-medium text-slate-300">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
