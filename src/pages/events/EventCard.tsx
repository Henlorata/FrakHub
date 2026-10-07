import {useState, type CSSProperties} from "react";
import {
  Ban, Check, ChevronDown, ClipboardCheck, ClipboardList, Clock, HelpCircle, MapPin, MessageSquareText, MoreHorizontal, Pencil, RotateCcw, Trash2,
  UserRound, Users, X,
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {MemberAvatar} from "@/pages/finance/components/MemberAvatar";
import {formatDate, formatTime, todayKey} from "@/lib/datetime";
import {
  audienceLabel, canRespond, canTakeAttendance, EVENT_KINDS, eventEnd, RESPONSE_LABELS, type EventStatus, type FactionEvent,
} from "@/lib/events";
import {cn} from "@/lib/utils";

const STATUS_LOOK: Record<EventStatus, {icon: typeof Check; active: string; text: string}> = {
  going: {icon: Check, active: "bg-emerald-500/20 text-emerald-100 ring-emerald-400/50", text: "text-emerald-300"},
  maybe: {icon: HelpCircle, active: "bg-amber-500/20 text-amber-100 ring-amber-400/50", text: "text-amber-300"},
  absent: {icon: X, active: "bg-red-500/15 text-red-100 ring-red-400/40", text: "text-red-300"},
};

/** "20:00–21:30", or with the end date when the event runs past midnight. */
function timeRange(event: FactionEvent) {
  const start = formatTime(event.starts_at);
  if (!event.ends_at) return start;
  const sameDay = todayKey(event.starts_at) === todayKey(event.ends_at);
  return `${start}–${sameDay ? "" : `${formatDate(event.ends_at)} `}${formatTime(event.ends_at)}`;
}

export function EventCard({event, index, now, highlighted, busy, inAudience, onRespond, onEdit, onToggleCancel, onDelete, onAttendance, onOperation}: {
  event: FactionEvent;
  index: number;
  /** The time of the page's last load (what counts as past). */
  now: number;
  highlighted: boolean;
  busy: boolean;
  /** The reader is one the event is for (their attendance is shown). */
  inAudience: boolean;
  onRespond: (status: EventStatus | null, note?: string | null) => void;
  onEdit: () => void;
  onToggleCancel: () => void;
  onDelete: () => void;
  onAttendance: () => void;
  onOperation: () => void;
}) {
  const look = EVENT_KINDS[event.kind] ?? EVENT_KINDS.other;
  const [expanded, setExpanded] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(event.my_note ?? "");
  const ended = eventEnd(event) < now;
  const open = canRespond(event, now);
  const going = event.responses.filter((response) => response.status === "going");
  const long = (event.description?.length ?? 0) > 240 || (event.description?.split("\n").length ?? 0) > 4;
  const total = event.counts.going + event.counts.maybe + event.counts.absent;
  const attendance = canTakeAttendance(event, now);
  const taken = !!event.attendance_taken_at;

  return (
    <article id={`event-${event.id}`} data-tour="event-card" style={{"--i": Math.min(index, 8)} as CSSProperties}
             className={cn("panel animate-rise relative overflow-hidden p-0 transition-shadow",
               event.cancelled_at && "opacity-70",
               highlighted && "ring-2 ring-primary/70 shadow-[0_0_40px_-12px_rgb(234_179_8/0.7)]")}>
      <span className={cn("absolute inset-y-0 left-0 w-1 bg-gradient-to-b", look.bar)}/>
      <div className="flex gap-4 p-4 pl-5">
        <div className={cn("grid size-11 shrink-0 place-items-center rounded-xl ring-1", look.tile)}><look.icon className="size-5"/></div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex min-w-0 items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className={cn("font-semibold tracking-wide uppercase", look.text)}>{look.label}</span>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-slate-300 ring-1 ring-white/10">{audienceLabel(event.audience)}</span>
                {event.cancelled_at && <span className="rounded-full bg-red-500/15 px-2 py-0.5 font-semibold text-red-200 ring-1 ring-red-500/30">Elmarad</span>}
                {!event.cancelled_at && ended && <span className="rounded-full bg-white/5 px-2 py-0.5 text-slate-400 ring-1 ring-white/10">Lezajlott</span>}
              </div>
              <h3 className={cn("mt-1 text-base font-semibold text-white wrap-anywhere", event.cancelled_at && "line-through decoration-red-400/60")}>
                {event.title}
              </h3>
            </div>
            {event.can_manage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon-sm" variant="ghost" aria-label="Esemény kezelése" className="text-slate-400"><MoreHorizontal/></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={onEdit}><Pencil/> Szerkesztés</DropdownMenuItem>
                  {!ended && (
                    <DropdownMenuItem onSelect={onToggleCancel}>
                      {event.cancelled_at ? <><RotateCcw/> Mégis megtartjuk</> : <><Ban/> Lemondás</>}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator/>
                  <DropdownMenuItem variant="destructive" onSelect={onDelete}><Trash2/> Törlés</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5 font-mono text-slate-200"><Clock className="size-3.5 text-slate-500"/>{timeRange(event)}</span>
            {event.location && <span className="inline-flex min-w-0 items-center gap-1.5 wrap-anywhere"><MapPin className="size-3.5 shrink-0 text-slate-500"/>{event.location}</span>}
            {event.created_by_name && <span className="inline-flex items-center gap-1.5"><UserRound className="size-3.5 text-slate-500"/>{event.created_by_name}</span>}
          </p>

          {event.description && (
            <div>
              <p className={cn("text-sm leading-relaxed whitespace-pre-wrap text-slate-300 wrap-anywhere", long && !expanded && "line-clamp-3")}>
                {event.description}
              </p>
              {long && (
                <button type="button" onClick={() => setExpanded((value) => !value)}
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary/90 hover:text-primary">
                  {expanded ? "Kevesebb" : "Tovább olvasom"} <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")}/>
                </button>
              )}
            </div>
          )}

          {event.rsvp && !event.cancelled_at && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {open ? (
                <div data-tour="event-rsvp" className="inline-flex flex-wrap gap-1 rounded-xl bg-white/[0.03] p-1 ring-1 ring-white/10">
                  {(Object.keys(STATUS_LOOK) as EventStatus[]).map((status) => {
                    const meta = STATUS_LOOK[status];
                    const active = event.my_status === status;
                    return (
                      <button key={status} type="button" disabled={busy} aria-pressed={active}
                              onClick={() => onRespond(active ? null : status, active ? null : event.my_note)}
                              className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium ring-1 transition-all disabled:opacity-60",
                                active ? meta.active : "text-slate-400 ring-transparent hover:bg-white/5 hover:text-slate-200")}>
                        <meta.icon className="size-3.5"/>{RESPONSE_LABELS[status]}
                        <span className={cn("tabular-nums", active ? "opacity-90" : "text-slate-500")}>{event.counts[status]}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <span className="text-xs text-slate-500">
                  {event.my_status ? <>A válaszod: <span className={STATUS_LOOK[event.my_status].text}>{RESPONSE_LABELS[event.my_status]}</span></> : "A jelentkezés lezárult."}
                </span>
              )}
              {open && event.my_status && !noteOpen && (
                <button type="button" onClick={() => setNoteOpen(true)}
                        className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200">
                  <MessageSquareText className="size-3.5"/>{event.my_note ? "Megjegyzés módosítása" : "Megjegyzés"}
                </button>
              )}
              {total > 0 && (
                <button type="button" onClick={() => setShowPeople((value) => !value)} aria-expanded={showPeople}
                        className="ml-auto inline-flex items-center gap-2 rounded-lg px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200">
                  {going.length > 0 && (
                    <span className="flex -space-x-1.5">
                      {going.slice(0, 6).map((person) => <MemberAvatar key={person.user_id} name={person.full_name} avatarUrl={person.avatar_url} size={24} className="ring-2 ring-[#0b1222]"/>)}
                    </span>
                  )}
                  <Users className="size-3.5"/>{event.counts.going} jön{event.counts.maybe ? ` · ${event.counts.maybe} talán` : ""}
                  <ChevronDown className={cn("size-3.5 transition-transform", showPeople && "rotate-180")}/>
                </button>
              )}
            </div>
          )}

          {(event.operation || (event.can_manage && !event.cancelled_at)) && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Button size="sm" variant="outline" className="h-7" onClick={onOperation}>
                <ClipboardList className="size-3.5"/> {event.operation ? "Műveleti terv" : "Műveleti terv készítése"}
              </Button>
              {event.operation && (
                <span className="text-slate-500">
                  {event.operation.roles} csapat · {event.operation.assigned} fő{event.operation.report ? " · értékelve" : ""}
                </span>
              )}
              {event.operation?.my_role && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-100 ring-1 ring-amber-400/30 wrap-anywhere">
                  Szereped: {event.operation.my_role}
                </span>
              )}
            </div>
          )}

          {!event.cancelled_at && (taken || attendance) && (
            <div data-tour="event-attendance" className="flex flex-wrap items-center gap-2 text-xs">
              {taken ? (
                <span className="inline-flex items-center gap-1.5 text-slate-400">
                  <ClipboardCheck className="size-3.5 text-emerald-300"/> Jelenlét: <strong className="font-semibold text-slate-200">{event.attended_count ?? 0} fő</strong>
                </span>
              ) : <span className="text-slate-500">A jelenlét még nincs rögzítve.</span>}
              {event.i_attended === true && (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-200 ring-1 ring-emerald-500/30">Jelen voltál</span>
              )}
              {event.i_attended === false && inAudience && (
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-400 ring-1 ring-white/10">Nem voltál jelen</span>
              )}
              {attendance && (
                <Button size="sm" variant="outline" className="ml-auto h-7" onClick={onAttendance}>
                  <ClipboardCheck className="size-3.5"/> {taken ? "Jelenlét módosítása" : "Jelenlét rögzítése"}
                </Button>
              )}
            </div>
          )}

          {noteOpen && (
            <form className="animate-fade flex gap-2" onSubmit={(formEvent) => {
              formEvent.preventDefault();
              onRespond(event.my_status, note.trim() || null);
              setNoteOpen(false);
            }}>
              <Input value={note} maxLength={200} autoFocus placeholder="Pl. csak 20:30-tól tudok jönni" className="h-8 text-xs"
                     onChange={(changeEvent) => setNote(changeEvent.target.value)}/>
              <Button size="sm" type="submit" disabled={busy}>Mentés</Button>
              <Button size="sm" type="button" variant="ghost" onClick={() => setNoteOpen(false)}>Mégse</Button>
            </form>
          )}
          {!noteOpen && event.my_note && event.my_status && (
            <p className="text-xs text-slate-500 wrap-anywhere">Megjegyzésed: „{event.my_note}”</p>
          )}

          {showPeople && (
            <div className="animate-fade grid grid-cols-1 gap-3 rounded-xl bg-white/[0.02] p-3 ring-1 ring-white/5 sm:grid-cols-3">
              {(["going", "maybe", "absent"] as const).map((status) => {
                const people = event.responses.filter((response) => response.status === status);
                return (
                  <div key={status} className="min-w-0 space-y-1.5">
                    <p className={cn("text-[11px] font-semibold tracking-wide uppercase", STATUS_LOOK[status].text)}>
                      {status === "going" ? "Jön" : status === "maybe" ? "Talán" : "Nem jön"} ({people.length})
                    </p>
                    {people.length === 0 ? <p className="text-xs text-slate-600">–</p> : people.map((person) => (
                      <div key={person.user_id} className="flex min-w-0 items-center gap-2">
                        <MemberAvatar name={person.full_name} avatarUrl={person.avatar_url} size={24}/>
                        <span className="min-w-0">
                          <span className="block truncate text-xs text-slate-200">{person.full_name}</span>
                          {person.note && <span className="block text-[11px] text-slate-500 wrap-anywhere">„{person.note}”</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
