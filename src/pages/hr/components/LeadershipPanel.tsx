import {useMemo, type CSSProperties} from "react";
import {Crown, Flag, Star} from "lucide-react";
import {MemberAvatar} from "@/pages/finance/components/MemberAvatar";
import {QUALIFICATIONS} from "@shared/ranks";
import {cn} from "@/lib/utils";
import type {HrMember} from "../useHrData";

/** Divisions with a bureau commander slot (TSB only when someone leads it). */
const DIVISION_GROUPS = ["SEB", "MCB"];

/**
 * Who leads what, for everyone: the bureau manager, the bureau commanders of the divisions and
 * the leaders of the units. A click opens the leader's sheet.
 */
export function LeadershipPanel({members, onOpen}: {members: HrMember[]; onOpen: (member: HrMember) => void}) {
  const slots = useMemo(() => [
    {key: "manager", label: "Bureau Manager", hint: "Irodavezető", icon: Crown, tone: "text-violet-300 bg-violet-500/10 ring-violet-500/30",
      leaders: members.filter((member) => member.is_bureau_manager)},
    ...[...DIVISION_GROUPS, ...(members.some((member) => member.is_bureau_commander && member.division === "TSB") ? ["TSB"] : [])].map((division) => ({
      key: `division-${division}`, label: division, hint: "Divízió parancsnoka", icon: Star, tone: "text-sky-300 bg-sky-500/10 ring-sky-500/30",
      leaders: members.filter((member) => member.is_bureau_commander && member.division === division),
    })),
    ...QUALIFICATIONS.map((unit) => ({
      key: `unit-${unit}`, label: unit, hint: "Alegység vezetője", icon: Flag, tone: "text-amber-300 bg-amber-500/10 ring-amber-500/30",
      leaders: members.filter((member) => (member.commanded_divisions ?? []).includes(unit)),
    })),
  ], [members]);

  return (
    <section data-tour="hr-leaders" className="panel animate-rise p-4" aria-label="Vezetőség">
      <header className="mb-3 flex flex-wrap items-baseline gap-x-2">
        <h2 className="text-sm font-semibold text-white">Vezetőség</h2>
        <p className="text-xs text-slate-500">Kihez fordulj: az iroda, a divíziók és az alegységek vezetői.</p>
      </header>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {slots.map((slot, index) => (
          <li key={slot.key} style={{"--i": Math.min(index, 8)} as CSSProperties}
              className={cn("animate-rise flex min-w-0 items-start gap-2.5 rounded-xl bg-white/[0.02] p-2.5 ring-1 ring-white/5",
                !slot.leaders.length && "opacity-60")}>
            <span className={cn("inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold ring-1", slot.tone)}>
              <slot.icon className="size-3.5"/>{slot.label}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] tracking-wide text-slate-500 uppercase">{slot.hint}</p>
              {slot.leaders.length === 0 ? (
                <p className="text-xs text-slate-500">Nincs kinevezve</p>
              ) : slot.leaders.map((leader) => (
                <button key={leader.id} type="button" onClick={() => onOpen(leader)}
                        className="mt-0.5 flex w-full min-w-0 items-center gap-2 rounded-md text-left transition-colors hover:text-primary">
                  <MemberAvatar name={leader.full_name} avatarUrl={leader.avatar_url} size={24}/>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-100">{leader.full_name}</span>
                    <span className="block truncate text-[11px] text-slate-500">{leader.faction_rank}</span>
                  </span>
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
