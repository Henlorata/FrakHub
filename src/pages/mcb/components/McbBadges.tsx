import type {ReactNode} from "react";
import {User} from "lucide-react";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {getOptimizedAvatarUrl} from "@/lib/cloudinary";
import {CASE_STATUS, CATEGORY, PRIORITY, SUSPECT_STATUS, WARRANT_STATUS, involvementLook, suspectStatusLook} from "@/lib/mcb";
import {cn} from "@/lib/utils";
import type {CaseCategory, CasePriority, CaseStatus, SuspectStatus, WarrantStatus} from "@/types/supabase";

const chipBase = "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1";

export function Chip({className, children, title}: {className?: string; children: ReactNode; title?: string}) {
  return <span title={title} className={cn(chipBase, className)}>{children}</span>;
}

export function CaseStatusChip({status, className}: {status: CaseStatus; className?: string}) {
  const look = CASE_STATUS[status] ?? CASE_STATUS.open;
  return <Chip className={cn(look.chip, className)}><look.icon className="size-3"/>{look.label}</Chip>;
}

export function PriorityChip({priority, className, compact}: {priority: CasePriority; className?: string; compact?: boolean}) {
  const look = PRIORITY[priority] ?? PRIORITY.medium;
  return (
    <Chip className={cn(look.chip, priority === "critical" && "shadow-[0_0_14px_-2px_rgb(239_68_68/0.55)]", className)}
          title={`Prioritás: ${look.label}`}>
      <span className={cn("size-1.5 rounded-full", look.dot, priority === "critical" && "animate-pulse")}/>
      {compact ? look.label.slice(0, 4) + "." : look.label}
    </Chip>
  );
}

export function CategoryChip({category, className}: {category: CaseCategory | null | undefined; className?: string}) {
  if (!category) return null;
  const look = CATEGORY[category];
  if (!look) return null;
  return <Chip className={cn("bg-white/[0.04] text-slate-300 ring-white/10", className)}><look.icon className="size-3"/>{look.label}</Chip>;
}

export function InvolvementChip({value, className}: {value: string | null | undefined; className?: string}) {
  const look = involvementLook(value);
  return <Chip className={cn(look.chip, className)}>{look.label}</Chip>;
}

export function WarrantStatusChip({status, className}: {status: WarrantStatus; className?: string}) {
  const look = WARRANT_STATUS[status] ?? WARRANT_STATUS.pending;
  return (
    <Chip className={cn(look.chip, className)}>
      <span className={cn("size-1.5 rounded-full", look.dot, status === "pending" && "animate-pulse")}/>
      {look.label}
    </Chip>
  );
}

export function SuspectStatusChip({status, className}: {status: SuspectStatus | string | null | undefined; className?: string}) {
  const look = suspectStatusLook(status);
  return <Chip className={cn(look.chip, className)}><look.icon className="size-3"/>{look.label}</Chip>;
}

/** Mugshot (or initials) of a person in the register; the status colours the frame. */
export function Mugshot({url, name, status, size = 40, className, rounded = "rounded-xl"}: {
  url: string | null | undefined;
  name: string;
  status?: SuspectStatus | string | null;
  size?: number;
  className?: string;
  rounded?: string;
}) {
  const ring = status === "wanted" ? "ring-red-500/70" : status === "jailed" ? "ring-orange-400/60"
    : status === "deceased" ? "ring-slate-500/60" : "ring-white/15";
  return (
    <Avatar className={cn("shrink-0 ring-2", rounded, ring, className)} style={{width: size, height: size}}>
      <AvatarImage src={getOptimizedAvatarUrl(url, size * 2) || undefined} alt="" className={cn("object-cover", status === "deceased" && "grayscale")}/>
      <AvatarFallback className={cn("bg-gradient-to-b from-slate-800 to-slate-900 font-semibold text-slate-400", rounded)}>
        {name.trim() ? name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() : <User className="size-1/2"/>}
      </AvatarFallback>
    </Avatar>
  );
}

/** Member avatar with initials. */
export function MemberAvatar({url, name, size = 28, className}: {url: string | null | undefined; name: string | null | undefined;
  size?: number; className?: string}) {
  return (
    <Avatar className={cn("shrink-0 ring-1 ring-white/15", className)} style={{width: size, height: size}}>
      <AvatarImage src={getOptimizedAvatarUrl(url, size * 2) || undefined} alt=""/>
      <AvatarFallback className="bg-slate-800 text-[10px] font-semibold text-slate-300">
        {(name ?? "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

export const SUSPECT_STATUS_KEYS = Object.keys(SUSPECT_STATUS) as SuspectStatus[];
