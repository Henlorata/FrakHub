import {useMemo} from "react";
import {Award, CalendarClock, TrendingUp, UserPlus, Users} from "lucide-react";
import {StatCard} from "@/components/layout/StatCard";
import {FACTION_RANKS, QUALIFICATIONS} from "@/types/supabase";
import {cn, getStaffCategory} from "@/lib/utils";
import {CATEGORY_META, daysSince, DIVISION_META, formatSpan} from "../hr-utils";
import type {HrMember} from "../useHrData";

function Bars({rows, total, tone}: {rows: {label: string; value: number}[]; total: number; tone: string}) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
          <span className="truncate text-xs text-slate-300">{row.label}</span>
          <span className="text-xs text-slate-400 tabular-nums">{row.value}</span>
          <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-white/5">
            <div className={cn("h-full rounded-full", tone)} style={{width: `${total ? (row.value / total) * 100 : 0}%`}}/>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Headcount by rank, division and qualification, plus recent movement. */
export function StatsPanel({members}: {members: HrMember[]}) {
  const stats = useMemo(() => {
    const total = members.length;
    const byRank = FACTION_RANKS.map((rank) => ({label: rank, value: members.filter((m) => m.faction_rank === rank).length}))
      .filter((row) => row.value > 0);
    const byDivision = Object.keys(DIVISION_META).map((division) => ({
      label: division, value: members.filter((m) => m.division === division).length,
    }));
    const byQualification = QUALIFICATIONS.map((q) => ({
      label: q, value: members.filter((m) => (m.qualifications ?? []).includes(q)).length,
    })).sort((a, b) => b.value - a.value);
    const byCategory = (Object.keys(CATEGORY_META) as (keyof typeof CATEGORY_META)[]).map((key) => ({
      label: CATEGORY_META[key].label, value: members.filter((m) => getStaffCategory(m.faction_rank) === key).length,
    }));
    const joined30 = members.filter((m) => (daysSince(m.created_at) ?? 999) <= 30).length;
    const promoted30 = members.filter((m) => m.last_promotion_date && (daysSince(m.last_promotion_date) ?? 999) <= 30
      && (daysSince(m.created_at) ?? 0) > 30).length;
    const service = members.map((m) => daysSince(m.created_at) ?? 0);
    const avgService = service.length ? Math.round(service.reduce((a, b) => a + b, 0) / service.length) : 0;
    const awards = members.reduce((sum, m) => sum + m.awards.length, 0);
    return {total, byRank, byDivision, byQualification, byCategory, joined30, promoted30, avgService, awards};
  }, [members]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={Users} tone="gold" label="Aktív állomány" value={stats.total}/>
        <StatCard icon={UserPlus} tone="emerald" label="Új tag (30 nap)" value={stats.joined30}/>
        <StatCard icon={TrendingUp} tone="blue" label="Előléptetve (30 nap)" value={stats.promoted30}/>
        <StatCard icon={CalendarClock} tone="violet" label="Átlagos szolgálati idő" value={formatSpan(stats.avgService)}/>
        <StatCard icon={Award} tone="orange" label="Kiosztott kitüntetés" value={stats.awards}/>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="panel p-5 lg:row-span-2">
          <h3 className="mb-4 text-sm font-semibold text-white">Rendfokozatok</h3>
          <Bars rows={stats.byRank} total={stats.total} tone="bg-primary/80"/>
        </section>
        <section className="panel p-5">
          <h3 className="mb-4 text-sm font-semibold text-white">Szintek</h3>
          <Bars rows={stats.byCategory} total={stats.total} tone="bg-violet-400/80"/>
        </section>
        <section className="panel p-5">
          <h3 className="mb-4 text-sm font-semibold text-white">Osztályok</h3>
          <Bars rows={stats.byDivision} total={stats.total} tone="bg-sky-400/80"/>
        </section>
        <section className="panel p-5 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-white">Képesítések</h3>
          <div className="grid gap-x-8 sm:grid-cols-2">
            <Bars rows={stats.byQualification.slice(0, Math.ceil(stats.byQualification.length / 2))} total={stats.total} tone="bg-emerald-400/80"/>
            <Bars rows={stats.byQualification.slice(Math.ceil(stats.byQualification.length / 2))} total={stats.total} tone="bg-emerald-400/80"/>
          </div>
        </section>
      </div>
    </div>
  );
}
