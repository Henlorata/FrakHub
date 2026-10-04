import {useMemo, useState, type ReactNode} from "react";
import {AlertTriangle, ArrowDownUp, Award, CalendarOff, Crown, Search, Star, Users, X} from "lucide-react";
import {Input} from "@/components/ui/input";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {Switch} from "@/components/ui/switch";
import {EmptyState} from "@/components/layout/EmptyState";
import {getOptimizedAvatarUrl} from "@/lib/cloudinary";
import {cn, getRankPriority, getStaffCategory, type StaffCategory} from "@/lib/utils";
import {QUALIFICATIONS, type Profile} from "@/types/supabase";
import {CATEGORY_META, daysSince, DIVISION_META, formatDate, formatSpan} from "../hr-utils";
import {RankStepper} from "./RankControls";
import type {HrMember} from "../useHrData";

type SortKey = "rank" | "name" | "badge" | "rank_time" | "service" | "last_seen";
type StatusFilter = "all" | "leave" | "warning" | "inactive";

const INACTIVE_DAYS = 14;
const CATEGORY_ORDER: StaffCategory[] = ["executive", "command", "supervisory", "field"];

interface RosterTableProps {
  members: HrMember[];
  viewer: Profile;
  staff: boolean;
  busyId: string | null;
  onRankChange: (member: HrMember, newRank: string) => void;
  onOpen: (member: HrMember) => void;
}

export function RosterTable({members, viewer, staff, busyId, onRankChange, onOpen}: RosterTableProps) {
  const [search, setSearch] = useState("");
  const [division, setDivision] = useState("all");
  const [category, setCategory] = useState<"all" | StaffCategory>("all");
  const [qualification, setQualification] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("rank");
  const [grouped, setGrouped] = useState(true);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = members.filter((member) => {
      if (term && !member.full_name.toLowerCase().includes(term) && !member.badge_number.includes(term)
          && !member.faction_rank.toLowerCase().includes(term)) return false;
      if (division !== "all" && member.division !== division) return false;
      if (category !== "all" && getStaffCategory(member.faction_rank) !== category) return false;
      if (qualification !== "all" && !(member.qualifications ?? []).includes(qualification as never)) return false;
      if (status === "leave" && !member.leave) return false;
      if (status === "warning" && member.warnings === 0) return false;
      if (status === "inactive" && (daysSince(member.lastSeen) ?? 999) < INACTIVE_DAYS) return false;
      return true;
    });
    const byRank = (a: HrMember, b: HrMember) => getRankPriority(a.faction_rank) - getRankPriority(b.faction_rank)
      || a.badge_number.localeCompare(b.badge_number, "hu", {numeric: true});
    const sorters: Record<SortKey, (a: HrMember, b: HrMember) => number> = {
      rank: byRank,
      name: (a, b) => a.full_name.localeCompare(b.full_name, "hu"),
      badge: (a, b) => a.badge_number.localeCompare(b.badge_number, "hu", {numeric: true}),
      rank_time: (a, b) => (daysSince(b.last_promotion_date ?? b.created_at) ?? 0) - (daysSince(a.last_promotion_date ?? a.created_at) ?? 0),
      service: (a, b) => (daysSince(b.created_at) ?? 0) - (daysSince(a.created_at) ?? 0),
      last_seen: (a, b) => (b.lastSeen ?? "").localeCompare(a.lastSeen ?? ""),
    };
    return [...list].sort(sorters[sort]);
  }, [members, search, division, category, qualification, status, sort]);

  const sections = useMemo(() => {
    if (!grouped || sort !== "rank") return [{key: "all", label: null as string | null, members: filtered}];
    return CATEGORY_ORDER
      .map((key) => ({key, label: CATEGORY_META[key].label, members: filtered.filter((m) => getStaffCategory(m.faction_rank) === key)}))
      .filter((section) => section.members.length > 0);
  }, [filtered, grouped, sort]);

  const hasFilters = search || division !== "all" || category !== "all" || qualification !== "all" || status !== "all";
  const columnCount = staff ? 8 : 7;

  return (
    <div className="panel overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b p-4 xl:flex-row xl:items-center">
        <div className="relative xl:w-72">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Név, jelvényszám vagy rang…"
                 className="pl-9"/>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/10">
            {["all", "TSB", "SEB", "MCB"].map((value) => (
              <button key={value} type="button" onClick={() => setDivision(value)}
                      className={cn("h-8 rounded-md px-3 text-xs font-medium transition-colors",
                        division === value ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200")}>
                {value === "all" ? "Mind" : value}
              </button>
            ))}
          </div>
          <Select value={category} onValueChange={(value) => setCategory(value as typeof category)}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Minden szint</SelectItem>
              {CATEGORY_ORDER.map((key) => <SelectItem key={key} value={key}>{CATEGORY_META[key].label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={qualification} onValueChange={setQualification}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Minden képesítés</SelectItem>
              {QUALIFICATIONS.map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Minden állapot</SelectItem>
              <SelectItem value="leave">Szabadságon</SelectItem>
              {staff && <SelectItem value="warning">Figyelmeztetett</SelectItem>}
              {staff && <SelectItem value="inactive">Inaktív ({INACTIVE_DAYS}+ nap)</SelectItem>}
            </SelectContent>
          </Select>
          {hasFilters && (
            <button type="button" onClick={() => {
              setSearch("");
              setDivision("all");
              setCategory("all");
              setQualification("all");
              setStatus("all");
            }} className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs text-slate-400 hover:text-white">
              <X className="size-3.5"/> Szűrők törlése
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 xl:ml-auto">
          <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
            <SelectTrigger className="h-9 w-[190px]"><ArrowDownUp className="size-3.5"/><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="rank">Rendfokozat szerint</SelectItem>
              <SelectItem value="name">Név szerint</SelectItem>
              <SelectItem value="badge">Jelvényszám szerint</SelectItem>
              <SelectItem value="rank_time">Rangon töltött idő</SelectItem>
              <SelectItem value="service">Szolgálati idő</SelectItem>
              {staff && <SelectItem value="last_seen">Utolsó aktivitás</SelectItem>}
            </SelectContent>
          </Select>
          {sort === "rank" && (
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <Switch checked={grouped} onCheckedChange={setGrouped}/> Csoportosítás
            </label>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="Nincs a szűrésnek megfelelő tag." compact/>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-2.5 pr-3 pl-4">Tag</th>
                <th className="px-3 py-2.5">Rendfokozat</th>
                <th className="px-3 py-2.5">Osztály</th>
                <th className="px-3 py-2.5">Képesítések</th>
                <th className="px-3 py-2.5">Rangon</th>
                <th className="px-3 py-2.5">Szolgálat</th>
                {staff && <th className="px-3 py-2.5">Utoljára aktív</th>}
                <th className="py-2.5 pr-4 pl-3 text-right">Állapot</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((section) => (
                <SectionRows key={section.key} label={section.label} count={section.members.length} columnCount={columnCount}>
                  {section.members.map((member) => (
                    <MemberRow key={member.id} member={member} viewer={viewer} staff={staff} busy={busyId === member.id}
                               onRankChange={onRankChange} onOpen={onOpen}/>
                  ))}
                </SectionRows>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="border-t px-4 py-2.5 text-xs text-slate-500">
        {filtered.length} / {members.length} tag
      </div>
    </div>
  );
}

function SectionRows({label, count, columnCount, children}: {label: string | null; count: number; columnCount: number; children: ReactNode}) {
  return (
    <>
      {label && (
        <tr className="bg-white/[0.02]">
          <td colSpan={columnCount} className="border-b py-2 pl-4 text-xs font-semibold text-slate-300">
            {label} <span className="ml-1 font-normal text-slate-500">· {count} fő</span>
          </td>
        </tr>
      )}
      {children}
    </>
  );
}

function MemberRow({member, viewer, staff, busy, onRankChange, onOpen}: {
  member: HrMember; viewer: Profile; staff: boolean; busy: boolean;
  onRankChange: (member: HrMember, rank: string) => void; onOpen: (member: HrMember) => void;
}) {
  const rankDays = daysSince(member.last_promotion_date ?? member.created_at);
  const serviceDays = daysSince(member.created_at);
  const seenDays = daysSince(member.lastSeen);
  const division = DIVISION_META[member.division] ?? DIVISION_META.TSB;

  return (
    <tr onClick={() => onOpen(member)}
        className="group cursor-pointer border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.03]">
      <td className="py-2.5 pr-3 pl-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-9 ring-1 ring-white/10">
            <AvatarImage src={getOptimizedAvatarUrl(member.avatar_url, 72) || undefined} alt=""/>
            <AvatarFallback className="bg-slate-800 text-xs font-semibold text-slate-300">{member.full_name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-medium text-white group-hover:text-primary">{member.full_name}</span>
              {member.is_bureau_manager && <Crown className="size-3.5 shrink-0 text-violet-400" aria-label="Bureau Manager"/>}
              {member.is_bureau_commander && <Star className="size-3.5 shrink-0 text-sky-400" aria-label="Bureau Commander"/>}
              {member.awards.length > 0 && (
                <span title={member.awards.map((award) => award.name).join(", ")}
                      className="inline-flex items-center gap-0.5 text-[11px] text-amber-400">
                  <Award className="size-3.5"/>{member.awards.length > 1 && member.awards.length}
                </span>
              )}
            </div>
            <span className="font-mono text-xs text-slate-500">#{member.badge_number}</span>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <RankStepper member={member} viewer={viewer} busy={busy} onChange={(rank) => onRankChange(member, rank)}/>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className={cn("inline-flex h-6 items-center rounded-md px-2 text-xs font-semibold ring-1", division.pill)}>{division.label}</span>
          {member.division_rank && <span className="text-xs text-slate-400">{member.division_rank}</span>}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap gap-1">
          {(member.qualifications ?? []).length === 0 ? <span className="text-xs text-slate-600">–</span> :
            (member.qualifications ?? []).map((q) => (
              <span key={q} className={cn("rounded px-1.5 py-0.5 font-mono text-[11px] ring-1",
                (member.commanded_divisions ?? []).includes(q)
                  ? "bg-amber-500/10 text-amber-300 ring-amber-500/30" : "bg-white/[0.04] text-slate-300 ring-white/10")}
                    title={(member.commanded_divisions ?? []).includes(q) ? `${q} vezető` : q}>
                {q}
              </span>
            ))}
        </div>
      </td>
      <td className="px-3 py-2.5 text-xs text-slate-300 tabular-nums" title={`Utolsó előléptetés: ${formatDate(member.last_promotion_date)}`}>
        {formatSpan(rankDays)}
      </td>
      <td className="px-3 py-2.5 text-xs text-slate-400 tabular-nums" title={`Csatlakozott: ${formatDate(member.created_at)}`}>
        {formatSpan(serviceDays)}
      </td>
      {staff && (
        <td className={cn("px-3 py-2.5 text-xs tabular-nums", (seenDays ?? 999) >= INACTIVE_DAYS ? "text-red-300" : "text-slate-400")}>
          {member.lastSeen ? (seenDays === 0 ? "ma" : `${formatSpan(seenDays)} ezelőtt`) : "–"}
        </td>
      )}
      <td className="py-2.5 pr-4 pl-3">
        <div className="flex justify-end gap-1.5">
          {member.leave && (
            <span title={`Szabadság: ${formatDate(member.leave.starts_on)} – ${formatDate(member.leave.ends_on)}`}
                  className={cn("inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-medium ring-1",
                    member.onLeaveNow ? "bg-sky-500/10 text-sky-300 ring-sky-500/30" : "bg-white/[0.03] text-slate-400 ring-white/10")}>
              <CalendarOff className="size-3"/>{member.onLeaveNow ? "Szabadságon" : "Szabadság"}
            </span>
          )}
          {member.warnings > 0 && (
            <span title={`${member.warnings} aktív figyelmeztetés`}
                  className="inline-flex h-6 items-center gap-1 rounded-md bg-red-500/10 px-2 text-[11px] font-medium text-red-300 ring-1 ring-red-500/30">
              <AlertTriangle className="size-3"/>{member.warnings}
            </span>
          )}
          {!member.leave && member.warnings === 0 && <span className="text-xs text-emerald-400/80">Aktív</span>}
        </div>
      </td>
    </tr>
  );
}
