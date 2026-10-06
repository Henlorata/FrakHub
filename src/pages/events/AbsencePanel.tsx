import type {CSSProperties} from "react";
import {Link} from "react-router";
import {CalendarOff} from "lucide-react";
import {MemberAvatar} from "@/pages/finance/components/MemberAvatar";
import {addDaysKey, formatDayLabel} from "@/lib/datetime";
import {absentOn, type Absence} from "@/lib/events";

/** "10.07." */
const shortDay = (day: string) => `${day.slice(5, 7)}.${day.slice(8, 10)}.`;
const range = (absence: Absence) =>
  absence.starts_on === absence.ends_on ? shortDay(absence.starts_on) : `${shortDay(absence.starts_on)}–${shortDay(absence.ends_on)}`;

/**
 * Who is away (approved leave): on the day picked in the calendar, or today and in the next two
 * weeks. Helps to plan events around absences.
 */
export function AbsencePanel({absences, selected, today}: {absences: Absence[]; selected: string | null; today: string}) {
  const day = selected ?? today;
  const away = absentOn(absences, day);
  const soon = selected ? [] : absences
    .filter((item) => item.starts_on > today && item.starts_on <= addDaysKey(today, 14))
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on) || a.full_name.localeCompare(b.full_name, "hu"));

  return (
    <section data-tour="events-absences" className="panel animate-rise space-y-3 p-4" style={{"--i": 3} as CSSProperties}>
      <header>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><CalendarOff className="size-4 text-sky-300"/> Távollétek</h2>
        <p className="text-[11px] text-slate-500">Jóváhagyott szabadságok, hogy az eseményeket ehhez igazíthasd.</p>
      </header>
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase first-letter:uppercase">{formatDayLabel(day, today)}</p>
        {away.length === 0 ? <p className="text-xs text-slate-500">Senki sincs szabadságon.</p> : <People list={away}/>}
      </div>
      {soon.length > 0 && (
        <div className="space-y-1.5 border-t border-white/5 pt-3">
          <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">A következő két hétben</p>
          <People list={soon}/>
        </div>
      )}
    </section>
  );
}

function People({list}: {list: Absence[]}) {
  return (
    <ul className="space-y-1">
      {list.map((item) => (
        <li key={`${item.user_id}-${item.starts_on}`}>
          <Link to={`/hr?member=${item.user_id}`} className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 transition-colors hover:bg-white/[0.04]">
            <MemberAvatar name={item.full_name} avatarUrl={item.avatar_url} size={24}/>
            <span className="min-w-0 flex-1 truncate text-xs text-slate-200">{item.full_name}</span>
            <span className="shrink-0 font-mono text-[11px] text-sky-300 tabular-nums">{range(item)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
