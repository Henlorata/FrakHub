import {useMemo, useState, type CSSProperties} from "react";
import {ChevronDown, Crown, Flag, Network, Search, Shield, Star, X} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {MemberAvatar} from "@/pages/finance/components/MemberAvatar";
import {LeadershipBadges} from "@/components/hr/LeadershipBadges";
import {INVESTIGATOR_RANKS, OPERATOR_RANKS, QUALIFICATIONS} from "@shared/ranks";
import {cn, getDepartmentLabel, getRankPriority, getStaffCategory, type StaffCategory} from "@/lib/utils";
import {CATEGORY_META} from "../hr-utils";
import type {HrMember} from "../useHrData";

const DIVISION_ORDER = ["TSB", "SEB", "MCB"] as const;
const UNIT_NAMES: Record<string, string> = {
  SAHP: "Highway Patrol", AB: "Aero Bureau", MU: "Medical Unit", GW: "Game Warden", FAB: "Financial Administration Bureau",
  SIB: "Sheriff's Information Bureau", TB: "Training Bureau",
};
const CATEGORY_ORDER: StaffCategory[] = ["executive", "command", "supervisory", "field"];
const STACK = 8;

const fold = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const byRank = (a: HrMember, b: HrMember) => getRankPriority(a.faction_rank) - getRankPriority(b.faction_rank)
  || a.full_name.localeCompare(b.full_name, "hu");

interface Group {
  label: string;
  members: HrMember[];
}

interface Node {
  id: string;
  title: string;
  subtitle: string;
  icon: typeof Star;
  tone: string;
  /** Who leads it (empty: nobody appointed); null: the node has no leader slot. */
  leaders: HrMember[] | null;
  leaderLabel: string;
  groups: Group[];
}

/** SEB and MCB by their bureau ranks, the others by staff level. */
function divisionGroups(division: string, members: HrMember[]): Group[] {
  const ranks = division === "SEB" ? OPERATOR_RANKS : division === "MCB" ? INVESTIGATOR_RANKS : null;
  if (ranks) {
    return [...ranks.map((rank) => ({label: rank, members: members.filter((member) => member.division_rank === rank)})),
      {label: "Besorolás nélkül", members: members.filter((member) => !member.division_rank || !(ranks as readonly string[]).includes(member.division_rank))}]
      .filter((group) => group.members.length > 0);
  }
  return CATEGORY_ORDER.map((category) => ({label: CATEGORY_META[category].label,
    members: members.filter((member) => getStaffCategory(member.faction_rank) === category)})).filter((group) => group.members.length > 0);
}

/**
 * The department as a tree: the bureau manager on top, the executive and command staff, the
 * divisions with their commanders and members, and the units with their leaders. Built from the
 * roster already loaded (no extra request); a click opens the member's sheet.
 */
export function OrgChart({members, onOpen}: {members: HrMember[]; onOpen: (member: HrMember) => void}) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const term = fold(search.trim());
  const matches = (member: HrMember) => !term || fold(member.full_name).includes(term) || member.badge_number.includes(term);

  const {managers, leadership, divisions, units} = useMemo(() => {
    const sorted = [...members].sort(byRank);
    const divisionNodes: Node[] = DIVISION_ORDER.map((division) => {
      const own = sorted.filter((member) => member.division === division);
      const commanders = own.filter((member) => member.is_bureau_commander);
      return {
        id: `division-${division}`, title: division, subtitle: getDepartmentLabel(division), icon: division === "TSB" ? Shield : Star,
        tone: division === "SEB" ? "text-red-300 bg-red-500/10 ring-red-500/30" : division === "MCB" ? "text-sky-300 bg-sky-500/10 ring-sky-500/30"
          : "text-slate-200 bg-slate-500/10 ring-slate-400/30",
        // TSB has a commander slot only when someone leads it.
        leaders: division === "TSB" && !commanders.length ? null : commanders, leaderLabel: "Divízió parancsnoka",
        groups: divisionGroups(division, own.filter((member) => !member.is_bureau_commander)),
      };
    });
    const unitNodes: Node[] = QUALIFICATIONS.map((unit) => {
      const leaders = sorted.filter((member) => (member.commanded_divisions ?? []).includes(unit));
      const others = sorted.filter((member) => (member.qualifications ?? []).includes(unit) && !leaders.includes(member));
      return {
        id: `unit-${unit}`, title: unit, subtitle: UNIT_NAMES[unit] ?? unit, icon: Flag, tone: "text-amber-300 bg-amber-500/10 ring-amber-500/30",
        leaders, leaderLabel: "Alegység vezetője", groups: others.length ? [{label: "Tagok", members: others}] : [],
      };
    });
    return {
      managers: sorted.filter((member) => member.is_bureau_manager),
      leadership: sorted.filter((member) => !member.is_bureau_manager && ["executive", "command"].includes(getStaffCategory(member.faction_rank))),
      divisions: divisionNodes,
      units: unitNodes,
    };
  }, [members]);

  const toggle = (id: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allIds = [...divisions, ...units].map((node) => node.id);
  const allOpen = allIds.every((id) => expanded.has(id));
  const found = term ? members.filter(matches).length : null;

  return (
    <section data-tour="hr-org-chart" className="panel animate-rise space-y-6 p-4 sm:p-6" aria-label="Szervezeti ábra">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Network className="size-4 text-primary"/> Szervezeti ábra</h2>
          <p className="text-xs text-slate-500">Az iroda vezetése, a divíziók parancsnokai és tagjai, az alegységek vezetői. Kattints egy névre az adatlapért.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Név vagy jelvényszám…" className="h-9 pr-8 pl-9"/>
            {search && (
              <button type="button" aria-label="Keresés törlése" onClick={() => setSearch("")}
                      className="absolute top-1/2 right-2 -translate-y-1/2 text-slate-500 hover:text-slate-200"><X className="size-4"/></button>
            )}
          </div>
          <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => setExpanded(allOpen ? new Set() : new Set(allIds))}>
            {allOpen ? "Mind összecsukása" : "Mind kibontása"}
          </Button>
        </div>
      </header>
      {found !== null && <p className="-mt-3 text-xs text-slate-400">{found ? `${found} találat` : "Nincs ilyen tag."}</p>}

      <div className="flex flex-col items-center">
        {/* The bureau manager */}
        <div className="flex flex-wrap justify-center gap-3">
          {(managers.length ? managers : [null]).map((manager, index) => (
            <div key={manager?.id ?? "none"} style={{"--i": index} as CSSProperties} className="animate-rise">
              {/* The fade-in animation owns the opacity, so the search dims an inner box. */}
              <div className={cn("min-w-[240px] rounded-2xl bg-violet-500/[0.08] p-3 ring-1 ring-violet-400/30 shadow-[0_0_40px_-18px_rgb(167_139_250/0.8)] transition-opacity",
                manager && term && !matches(manager) && "opacity-40")}>
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-violet-200 uppercase"><Crown className="size-3.5"/> Bureau Manager</p>
                {manager ? <Person member={manager} onOpen={onOpen} size="lg"/> : <p className="text-xs text-slate-500">Nincs kinevezve</p>}
              </div>
            </div>
          ))}
        </div>

        {leadership.length > 0 && (
          <>
            <Connector/>
            <div className="animate-rise w-full max-w-4xl rounded-2xl bg-white/[0.02] p-3 ring-1 ring-white/10" style={{"--i": 1} as CSSProperties}>
              <p className="mb-2 text-center text-[10px] font-semibold tracking-wide text-slate-400 uppercase">Vezérkar és parancsnokság</p>
              <div className="flex flex-wrap justify-center gap-2">
                {leadership.map((member) => (
                  <Person key={member.id} member={member} onOpen={onOpen} dimmed={!!term && !matches(member)} framed/>
                ))}
              </div>
            </div>
          </>
        )}

        <Connector/>
        {/* Divisions, joined by a line on wide screens */}
        <div className="relative grid w-full grid-cols-1 gap-4 lg:grid-cols-3">
          <span aria-hidden className="pointer-events-none absolute top-0 right-[16.67%] left-[16.67%] hidden h-px bg-white/15 lg:block"/>
          {divisions.map((node, index) => (
            <div key={node.id} className="flex min-w-0 flex-col items-center">
              <span aria-hidden className="hidden h-5 w-px bg-white/15 lg:block"/>
              <TreeNode node={node} index={index + 2} open={expanded.has(node.id) || (!!term && nodeMatches(node, matches))}
                        onToggle={() => toggle(node.id)} onOpen={onOpen} matches={matches} searching={!!term}/>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 border-t border-white/5 pt-5">
        <p className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">Alegységek (képesítés szerint)</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {units.map((node, index) => (
            <TreeNode key={node.id} node={node} index={index + 5} open={expanded.has(node.id) || (!!term && nodeMatches(node, matches))}
                      onToggle={() => toggle(node.id)} onOpen={onOpen} matches={matches} searching={!!term} compact/>
          ))}
        </div>
      </div>
    </section>
  );
}

const nodeMatches = (node: Node, matches: (member: HrMember) => boolean) =>
  (node.leaders ?? []).some(matches) || node.groups.some((group) => group.members.some(matches));

function Connector() {
  return <span aria-hidden className="h-6 w-px bg-gradient-to-b from-white/25 to-white/10"/>;
}

function TreeNode({node, index, open, onToggle, onOpen, matches, searching, compact}: {
  node: Node;
  index: number;
  open: boolean;
  onToggle: () => void;
  onOpen: (member: HrMember) => void;
  matches: (member: HrMember) => boolean;
  searching: boolean;
  compact?: boolean;
}) {
  const everyone = node.groups.flatMap((group) => group.members);
  const total = everyone.length + (node.leaders?.length ?? 0);
  const hit = !searching || nodeMatches(node, matches);
  return (
    // The fade-in animation owns the opacity, so the search dims the inner box.
    <div style={{"--i": Math.min(index, 10)} as CSSProperties} className="animate-rise w-full min-w-0">
      <article className={cn("w-full min-w-0 rounded-2xl bg-white/[0.02] ring-1 ring-white/10 transition-opacity", !hit && "opacity-40")}>
        <button type="button" onClick={onToggle} aria-expanded={open}
                className="flex w-full min-w-0 items-center gap-2.5 rounded-t-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03]">
          <span className={cn("inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold ring-1", node.tone)}>
            <node.icon className="size-3.5"/>{node.title}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs text-slate-400">{node.subtitle}</span>
          <span className="shrink-0 text-[11px] text-slate-500 tabular-nums">{total} fő</span>
          <ChevronDown className={cn("size-4 shrink-0 text-slate-500 transition-transform", open && "rotate-180")}/>
        </button>

        <div className="space-y-2.5 px-3 pb-3">
          {node.leaders !== null && (
            <div>
              <p className="text-[10px] tracking-wide text-slate-500 uppercase">{node.leaderLabel}</p>
              {node.leaders.length === 0 ? <p className="text-xs text-slate-500">Nincs kinevezve</p> : (
                <div className="mt-1 space-y-1">
                  {node.leaders.map((leader) => <Person key={leader.id} member={leader} onOpen={onOpen} dimmed={searching && !matches(leader)}/>)}
                </div>
              )}
            </div>
          )}

          {!open ? (
            everyone.length > 0 && (
              <button type="button" onClick={onToggle} className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200">
                <span className="flex -space-x-1.5">
                  {everyone.slice(0, STACK).map((member) => (
                    <MemberAvatar key={member.id} name={member.full_name} avatarUrl={member.avatar_url} size={24} className="ring-2 ring-[#0b1222]"/>
                  ))}
                </span>
                {everyone.length} tag megtekintése
              </button>
            )
          ) : node.groups.length === 0 ? (
            <p className="text-xs text-slate-500">Nincs további tagja.</p>
          ) : node.groups.map((group) => {
            const shown = group.members.filter((member) => !searching || matches(member));
            if (!shown.length) return null;
            return (
              <div key={group.label} className="space-y-1">
                <p className="text-[10px] tracking-wide text-slate-500 uppercase">{group.label} <span className="tabular-nums">({group.members.length})</span></p>
                <div className={cn("grid gap-1", compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2")}>
                  {shown.map((member) => <Person key={member.id} member={member} onOpen={onOpen}/>)}
                </div>
              </div>
            );
          })}
        </div>
      </article>
    </div>
  );
}

function Person({member, onOpen, size = "md", dimmed, framed}: {
  member: HrMember;
  onOpen: (member: HrMember) => void;
  size?: "md" | "lg";
  dimmed?: boolean;
  framed?: boolean;
}) {
  return (
    <button type="button" onClick={() => onOpen(member)} title={`${member.badge_number} · ${member.full_name}`}
            className={cn("flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-white/[0.06]",
              framed && "bg-white/[0.03] pr-3 ring-1 ring-white/5", dimmed && "opacity-40")}>
      <MemberAvatar name={member.full_name} avatarUrl={member.avatar_url} size={size === "lg" ? 40 : 28}/>
      <span className="min-w-0">
        <span className={cn("block truncate font-medium text-slate-100", size === "lg" ? "text-sm" : "text-xs")}>{member.full_name}</span>
        <span className="block truncate text-[11px] text-slate-500">{member.faction_rank}{member.onLeaveNow ? " · szabadságon" : ""}</span>
        {size === "lg" && <LeadershipBadges member={member} className="mt-1"/>}
      </span>
    </button>
  );
}
