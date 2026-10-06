import {Crown, Flag, Star, type LucideIcon} from "lucide-react";
import {cn} from "@/lib/utils";

interface LeaderSubject {
  division?: string | null;
  is_bureau_manager?: boolean | null;
  is_bureau_commander?: boolean | null;
  commanded_divisions?: readonly string[] | null;
}

export interface LeadershipRole {
  key: string;
  label: string;
  /** What the role means (tooltip). */
  title: string;
  icon: LucideIcon;
  tone: string;
}

/** The member's leadership roles: bureau manager, bureau commander (of their division), unit leader(s). */
export function leadershipRoles(member: LeaderSubject): LeadershipRole[] {
  const roles: LeadershipRole[] = [];
  if (member.is_bureau_manager) {
    roles.push({key: "manager", label: "Bureau Manager", title: "Irodavezető: az állomány legfőbb vezetője, teljes jogkörrel.", icon: Crown,
      tone: "bg-violet-500/15 text-violet-200 ring-violet-400/40"});
  }
  if (member.is_bureau_commander && member.division) {
    roles.push({key: "commander", label: `${member.division} parancsnok`, title: `Bureau Commander: a(z) ${member.division} divízió parancsnoka.`,
      icon: Star, tone: "bg-sky-500/15 text-sky-200 ring-sky-400/40"});
  }
  for (const unit of member.commanded_divisions ?? []) {
    roles.push({key: `unit-${unit}`, label: `${unit} vezető`, title: `A(z) ${unit} alegység vezetője.`, icon: Flag,
      tone: "bg-amber-500/15 text-amber-200 ring-amber-400/40"});
  }
  return roles;
}

/** The roles as labelled chips (the roster, the member's sheet, profiles). */
export function LeadershipBadges({member, size = "sm", className}: {member: LeaderSubject; size?: "sm" | "md"; className?: string}) {
  const roles = leadershipRoles(member);
  if (!roles.length) return null;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {roles.map((role) => (
        <span key={role.key} title={role.title}
              className={cn("inline-flex items-center gap-1 rounded-md font-semibold whitespace-nowrap ring-1", role.tone,
                size === "sm" ? "h-5 px-1.5 text-[10px]" : "h-6 px-2 text-xs")}>
          <role.icon className={size === "sm" ? "size-3" : "size-3.5"}/>{role.label}
        </span>
      ))}
    </span>
  );
}
