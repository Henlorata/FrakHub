import {useMemo, useState, type CSSProperties} from "react";
import {ChevronLeft, ChevronRight} from "lucide-react";
import {Button} from "@/components/ui/button";
import {addMonths, monthKey, todayKey} from "@/lib/datetime";
import {absentOn, EVENT_KINDS, type Absence, type FactionEvent} from "@/lib/events";
import {cn} from "@/lib/utils";

const monthTitle = new Intl.DateTimeFormat("hu-HU", {timeZone: "UTC", year: "numeric", month: "long"});
const WEEKDAYS = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];

/**
 * A month at a glance: the days with events carry a dot per kind, the days when members are on
 * leave a line on top; a click selects the day.
 */
export function MiniCalendar({events, absences, selected, onSelect}: {
  events: FactionEvent[];
  absences: Absence[];
  selected: string | null;
  onSelect: (day: string) => void;
}) {
  const today = todayKey();
  const [month, setMonth] = useState(() => monthKey());
  const byDay = useMemo(() => {
    const map = new Map<string, FactionEvent[]>();
    events.forEach((event) => {
      const day = todayKey(event.starts_at);
      map.set(day, [...(map.get(day) ?? []), event]);
    });
    return map;
  }, [events]);

  const [year, monthIndex] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthIndex - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  // Weeks start on Monday.
  const lead = (first.getUTCDay() + 6) % 7;
  const cells = Array.from({length: Math.ceil((lead + daysInMonth) / 7) * 7}, (_, index) => {
    const day = index - lead + 1;
    return day >= 1 && day <= daysInMonth ? `${month.slice(0, 8)}${String(day).padStart(2, "0")}` : null;
  });

  return (
    <section data-tour="events-calendar" className="panel animate-rise p-4" style={{"--i": 1} as CSSProperties}>
      <header className="mb-3 flex items-center gap-2">
        <h2 className="flex-1 text-sm font-semibold text-white">{monthTitle.format(first)}</h2>
        <Button size="icon-sm" variant="ghost" aria-label="Előző hónap" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft/></Button>
        <Button size="icon-sm" variant="ghost" aria-label="Következő hónap" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight/></Button>
      </header>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((day) => <span key={day} className="pb-1 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">{day}</span>)}
        {cells.map((day, index) => {
          if (!day) return <span key={`empty-${index}`}/>;
          const dayEvents = byDay.get(day) ?? [];
          const away = absentOn(absences, day).length;
          const kinds = [...new Set(dayEvents.filter((event) => !event.cancelled_at).map((event) => event.kind))].slice(0, 3);
          return (
            <button key={day} type="button" disabled={!dayEvents.length && !away} onClick={() => onSelect(day)}
                    aria-label={[day, dayEvents.length ? `${dayEvents.length} esemény` : "", away ? `${away} tag szabadságon` : ""].filter(Boolean).join(", ")}
                    className={cn("relative flex aspect-square flex-col items-center justify-center rounded-lg text-xs tabular-nums transition-colors",
                      dayEvents.length ? "font-semibold text-white hover:bg-white/10" : away ? "text-slate-300 hover:bg-white/10" : "text-slate-500",
                      day === today && "ring-1 ring-primary/60",
                      day === selected && "bg-primary/15 text-primary",
                      day < today && "opacity-60")}>
              {away > 0 && <span aria-hidden className="absolute top-1 h-0.5 w-3 rounded-full bg-sky-400/80"/>}
              {Number(day.slice(8))}
              {kinds.length > 0 && (
                <span className="absolute bottom-1 flex gap-0.5">
                  {kinds.map((kind) => <span key={kind} className={cn("size-1 rounded-full", EVENT_KINDS[kind].dot)}/>)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
