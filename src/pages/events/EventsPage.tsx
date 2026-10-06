import {useEffect, useMemo, useRef, useState, type CSSProperties} from "react";
import {useSearchParams} from "react-router";
import {toast} from "sonner";
import {CalendarDays, CalendarPlus, CalendarX2, ChevronDown, History} from "lucide-react";
import {Button} from "@/components/ui/button";
import {PageHeader} from "@/components/layout/PageHeader";
import {EmptyState} from "@/components/layout/EmptyState";
import {useConfirm} from "@/components/ConfirmDialog";
import {useAuth} from "@/context/AuthContext";
import {formatCalendarDay, formatDayLabel, todayKey} from "@/lib/datetime";
import {
  EVENT_KIND_ORDER, EVENT_KINDS, eventEnd, eventsApi, isInAudience, organisableAudiences, type Absence, type EventStatus, type FactionEvent,
} from "@/lib/events";
import {useDialogParam} from "@/lib/use-dialog-param";
import {errorMessage} from "@/lib/utils";
import {AbsencePanel} from "./AbsencePanel";
import {AttendanceDialog} from "./AttendanceDialog";
import {EventCard} from "./EventCard";
import {EventDialog} from "./EventDialog";
import {MiniCalendar} from "./MiniCalendar";

const DAY = 86_400_000;
/** One call loads this window (past events for the history, the next four months). */
const PAST_DAYS = 45;
const FUTURE_DAYS = 120;

function groupByDay(events: FactionEvent[]) {
  const groups: {day: string; events: FactionEvent[]}[] = [];
  events.forEach((event) => {
    const day = todayKey(event.starts_at);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.events.push(event);
    else groups.push({day, events: [event]});
  });
  return groups;
}

/**
 * Events of the department: meetings, trainings, exams and joint actions. Everyone sees the
 * events meant for them and answers whether they come; organisers (staff, unit leaders) create
 * and manage them. The audience is notified of new events and of changes.
 */
export function EventsPage() {
  const {profile} = useAuth();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState<FactionEvent[] | null>(null);
  // "Now" of the last load: what counts as upcoming or past (stable between renders).
  const [now, setNow] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<FactionEvent | "new" | null>(null);
  // The quick search opens a new event with /events?new=1.
  const [newFromUrl, setNewFromUrl] = useDialogParam("new");
  const [showPast, setShowPast] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [attendanceFor, setAttendanceFor] = useState<FactionEvent | null>(null);
  const focusId = searchParams.get("id");
  const audiences = useMemo(() => organisableAudiences(profile), [profile]);

  // Approved leave of the same window (dates only): the calendar and the planning hints.
  useEffect(() => {
    let active = true;
    const now = Date.now();
    eventsApi.absences(todayKey(now - PAST_DAYS * DAY), todayKey(now + FUTURE_DAYS * DAY))
      .then((list) => {
        if (active) setAbsences(list);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  // A link to a past event (notification, training) keeps the history open after the highlight ends.
  const linkedEvent = useRef(focusId);
  useEffect(() => {
    let active = true;
    const now = Date.now();
    eventsApi.list(new Date(now - PAST_DAYS * DAY), new Date(now + FUTURE_DAYS * DAY))
      .then((data) => {
        if (!active) return;
        setEvents(data ?? []);
        setNow(Date.now());
        const linked = (data ?? []).find((item) => item.id === linkedEvent.current);
        if (linked && eventEnd(linked) < Date.now()) setShowPast(true);
        linkedEvent.current = null;
      })
      .catch((error: unknown) => {
        if (!active) return;
        toast.error(errorMessage(error, "Az események betöltése nem sikerült."));
        setEvents([]);
        setNow(Date.now());
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const upcoming = useMemo(() => (events ?? []).filter((event) => eventEnd(event) >= now), [events, now]);
  const past = useMemo(() => (events ?? []).filter((event) => eventEnd(event) < now).reverse(), [events, now]);
  const focused = focusId ? (events ?? []).find((event) => event.id === focusId) ?? null : null;
  const pastOpen = showPast || (!!focused && eventEnd(focused) < now);

  // A notification's link (?id=...) scrolls to the event and highlights it for a moment.
  useEffect(() => {
    if (!focused) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`event-${focused.id}`)?.scrollIntoView({behavior: "smooth", block: "center"});
    }, 150);
    const clear = window.setTimeout(() => {
      setSearchParams((params) => {
        const next = new URLSearchParams(params);
        next.delete("id");
        return next;
      }, {replace: true});
    }, 4000);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(clear);
    };
  }, [focused, setSearchParams]);

  if (!profile) return null;

  const patch = (id: string, change: (event: FactionEvent) => FactionEvent) =>
    setEvents((current) => current && current.map((event) => (event.id === id ? change(event) : event)));

  const respond = async (event: FactionEvent, status: EventStatus | null, note?: string | null) => {
    setBusyId(event.id);
    try {
      const counts = await eventsApi.respond(event.id, status, note);
      const others = event.responses.filter((response) => response.user_id !== profile.id);
      patch(event.id, (current) => ({
        ...current, counts, my_status: status, my_note: status ? note ?? null : null,
        responses: status ? [...others, {
          user_id: profile.id, status, note: note ?? null, full_name: profile.full_name, badge_number: profile.badge_number,
          faction_rank: profile.faction_rank, avatar_url: profile.avatar_url ?? null,
        }] : others,
      }));
      if (status === "going") toast.success("Rendben, számítunk rád!");
    } catch (error) {
      toast.error(errorMessage(error, "A válasz mentése nem sikerült."));
    } finally {
      setBusyId(null);
    }
  };

  const toggleCancel = async (event: FactionEvent) => {
    const cancelling = !event.cancelled_at;
    if (cancelling && !(await confirm({
      title: "Esemény lemondása", confirmLabel: "Lemondás", destructive: true,
      description: `„${event.title}” elmarad. Aki jelezte, hogy jön (vagy talán jön), értesítést kap.`,
    }))) return;
    try {
      await eventsApi.update(event.id, {cancelled_at: cancelling ? new Date().toISOString() : null});
      toast.success(cancelling ? "Az esemény elmarad." : "Az esemény mégis megtartásra kerül.");
      setReloadKey((key) => key + 1);
    } catch (error) {
      toast.error(errorMessage(error, "A módosítás nem sikerült."));
    }
  };

  const remove = async (event: FactionEvent) => {
    if (!(await confirm({
      title: "Esemény törlése", confirmLabel: "Törlés", destructive: true, kind: "delete",
      description: `„${event.title}” és a jelentkezések végleg törlődnek. Ha csak elmarad, inkább mondd le: arról a jelentkezők értesítést kapnak.`,
    }))) return;
    try {
      await eventsApi.remove(event.id);
      setEvents((current) => current && current.filter((item) => item.id !== event.id));
      toast.success("Esemény törölve.");
    } catch (error) {
      toast.error(errorMessage(error, "A törlés nem sikerült."));
    }
  };

  const jumpTo = (day: string) => {
    // A second click on the picked day goes back to today's absences.
    if (day === selectedDay) return setSelectedDay(null);
    setSelectedDay(day);
    if (day < todayKey(now)) setShowPast(true);
    window.setTimeout(() => document.getElementById(`day-${day}`)?.scrollIntoView({behavior: "smooth", block: "start"}), 60);
  };

  const card = (event: FactionEvent, index: number) => (
    <EventCard key={event.id} event={event} index={index} now={now} highlighted={event.id === focusId} busy={busyId === event.id}
               inAudience={isInAudience(profile, event.audience)}
               onRespond={(status, note) => void respond(event, status, note)} onEdit={() => setEditing(event)}
               onToggleCancel={() => void toggleCancel(event)} onDelete={() => void remove(event)}
               onAttendance={() => setAttendanceFor(event)}/>
  );

  const myAnswers = upcoming.filter((event) => !event.cancelled_at && event.my_status === "going").length;
  const unanswered = upcoming.filter((event) => !event.cancelled_at && event.rsvp && !event.my_status).length;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 pb-10">
      <PageHeader icon={CalendarDays} tone="gold" eyebrow="Naptár" title="Események"
                  description="Gyűlések, képzések, vizsgák és közös akciók. Jelezd, ott leszel-e."
                  actions={audiences.length > 0 && (
                    <Button onClick={() => setEditing("new")} data-tour="event-new"><CalendarPlus/> Új esemény</Button>
                  )}/>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div data-tour="events-list" className="min-w-0 space-y-6">
          {events === null ? (
            <div className="space-y-3">{[0, 1, 2].map((index) => <div key={index} className="skeleton h-36"/>)}</div>
          ) : upcoming.length === 0 ? (
            <div className="panel">
              <EmptyState icon={CalendarX2} title="Nincs tervezett esemény."
                          description={audiences.length ? "Hozz létre egyet: az érintettek értesítést kapnak, és jelezhetik, ott lesznek-e." : "Ha a vezetőség eseményt hirdet, itt jelenik meg, és értesítést kapsz róla."}
                          action={audiences.length > 0 ? <Button variant="outline" onClick={() => setEditing("new")}><CalendarPlus/> Új esemény</Button> : undefined}/>
            </div>
          ) : (
            groupByDay(upcoming).map((group, groupIndex) => (
              <section key={group.day} id={`day-${group.day}`} className="scroll-mt-24 space-y-3">
                <h2 className="animate-rise flex items-baseline gap-2 px-1" style={{"--i": Math.min(groupIndex, 6)} as CSSProperties}>
                  <span className="text-sm font-semibold text-white first-letter:uppercase">{formatDayLabel(group.day, todayKey(now))}</span>
                  {formatDayLabel(group.day, todayKey(now)) !== formatCalendarDay(group.day, todayKey(now)) && (
                    <span className="text-xs text-slate-500">{formatCalendarDay(group.day, todayKey(now))}</span>
                  )}
                </h2>
                {group.events.map(card)}
              </section>
            ))
          )}

          {past.length > 0 && (
            <section className="space-y-3">
              <button type="button" onClick={() => setShowPast((value) => !value)} aria-expanded={pastOpen}
                      className="flex w-full items-center gap-2 rounded-xl px-1 py-1 text-left text-sm font-semibold text-slate-300 hover:text-white">
                <History className="size-4 text-slate-500"/> Korábbi események <span className="text-xs font-normal text-slate-500">({past.length})</span>
                <ChevronDown className={`ml-auto size-4 transition-transform ${pastOpen ? "rotate-180" : ""}`}/>
              </button>
              {pastOpen && groupByDay(past).map((group) => (
                <section key={group.day} id={`day-${group.day}`} className="scroll-mt-24 space-y-3">
                  <h3 className="px-1 text-xs font-semibold text-slate-400 first-letter:uppercase">{formatDayLabel(group.day, todayKey(now))}</h3>
                  {group.events.map(card)}
                </section>
              ))}
            </section>
          )}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20">
          <MiniCalendar events={events ?? []} absences={absences} selected={selectedDay} onSelect={jumpTo}/>
          <section className="panel animate-rise space-y-3 p-4" style={{"--i": 2} as CSSProperties}>
            <p className="text-xs text-slate-400">
              {myAnswers ? <>A következő hetekben <span className="font-semibold text-emerald-300">{myAnswers}</span> eseményre jelentkeztél.</> : "Még nem jelentkeztél eseményre."}
              {unanswered > 0 && <> <span className="font-semibold text-amber-300">{unanswered}</span> esemény vár a válaszodra.</>}
            </p>
            <ul className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-400">
              {EVENT_KIND_ORDER.map((kind) => (
                <li key={kind} className="flex items-center gap-1.5"><span className={`size-2 rounded-full ${EVENT_KINDS[kind].dot}`}/>{EVENT_KINDS[kind].label}</li>
              ))}
              <li className="flex items-center gap-1.5"><span className="h-0.5 w-2.5 rounded-full bg-sky-400/80"/>Szabadság</li>
            </ul>
          </section>
          {now > 0 && <AbsencePanel absences={absences} selected={selectedDay} today={todayKey(now)}/>}
        </aside>
      </div>

      {(editing ?? (newFromUrl && audiences.length > 0 ? "new" : null)) && (
        <EventDialog event={editing && editing !== "new" ? editing : null} audiences={audiences} absences={absences}
                     onClose={() => {
                       setEditing(null);
                       setNewFromUrl(false);
                     }}
                     onSaved={() => {
                       setEditing(null);
                       setNewFromUrl(false);
                       setReloadKey((key) => key + 1);
                     }}/>
      )}
      {attendanceFor && (
        <AttendanceDialog event={attendanceFor} absences={absences} onClose={() => setAttendanceFor(null)}
                          onSaved={(ids, takenAt) => {
                            patch(attendanceFor.id, (current) => ({
                              ...current, attendance_taken_at: takenAt, attended_count: ids.length, attendee_ids: ids,
                              i_attended: ids.includes(profile.id),
                            }));
                            setAttendanceFor(null);
                          }}/>
      )}
    </div>
  );
}
