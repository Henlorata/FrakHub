import {ChevronDown, ChevronUp, Loader2} from "lucide-react";
import {canAssignRank, cn, getAdjacentRank} from "@/lib/utils";
import {rankPillClass} from "../hr-utils";
import type {Profile} from "@/types/supabase";

export function RankPill({rank, className}: {rank: string; className?: string}) {
  return (
    <span className={cn("inline-flex h-6 items-center rounded-md px-2 text-xs font-medium whitespace-nowrap ring-1", rankPillClass(rank), className)}>
      {rank}
    </span>
  );
}

interface RankStepperProps {
  member: Profile;
  viewer: Profile;
  busy?: boolean;
  onChange: (newRank: string) => void;
}

/**
 * The rank with one-click promotion (▲) and demotion (▼). The buttons only appear
 * when the viewer may assign the neighbouring rank (shared/ranks.ts canAssignRank).
 */
export function RankStepper({member, viewer, busy, onChange}: RankStepperProps) {
  const up = getAdjacentRank(member.faction_rank, "up");
  const down = getAdjacentRank(member.faction_rank, "down");
  // Never a one-click change of one's own rank (bureau managers use the rank picker).
  const self = viewer.id === member.id;
  const canUp = !self && !!up && canAssignRank(viewer, member, up);
  const canDown = !self && !!down && canAssignRank(viewer, member, down);

  if (!canUp && !canDown) return <RankPill rank={member.faction_rank}/>;

  const stepButton = (direction: "up" | "down", target: string | null, allowed: boolean) => (
    <button
      type="button"
      disabled={!allowed || busy}
      title={allowed && target ? `${direction === "up" ? "Előléptetés" : "Lefokozás"}: ${target}` : undefined}
      aria-label={direction === "up" ? "Előléptetés" : "Lefokozás"}
      onClick={(event) => {
        event.stopPropagation();
        if (allowed && target) onChange(target);
      }}
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-25",
        direction === "up"
          ? "text-emerald-400 hover:bg-emerald-500/15 enabled:hover:text-emerald-300"
          : "text-red-400 hover:bg-red-500/15 enabled:hover:text-red-300",
      )}
    >
      {direction === "up" ? <ChevronUp className="size-4"/> : <ChevronDown className="size-4"/>}
    </button>
  );

  return (
    <div className="inline-flex items-center gap-0.5" onClick={(event) => event.stopPropagation()}>
      {stepButton("down", down, canDown)}
      <span className="relative">
        <RankPill rank={member.faction_rank} className={cn(busy && "opacity-60")}/>
        {busy && <Loader2 className="absolute top-1/2 left-1/2 size-3.5 -translate-1/2 animate-spin text-white"/>}
      </span>
      {stepButton("up", up, canUp)}
    </div>
  );
}
