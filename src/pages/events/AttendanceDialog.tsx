import {useMemo, useState} from "react";
import {toast} from "sonner";
import {CalendarOff, ClipboardCheck, Loader2, Search} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Checkbox} from "@/components/ui/checkbox";
import {Input} from "@/components/ui/input";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {MemberAvatar} from "@/pages/finance/components/MemberAvatar";
import {todayKey} from "@/lib/datetime";
import {absentOn, eventsApi, isInAudience, RESPONSE_LABELS, type Absence, type EventStatus, type FactionEvent} from "@/lib/events";
import {useProfileDirectory} from "@/lib/profile-directory";
import {cn, errorMessage} from "@/lib/utils";

const ORDER: Record<EventStatus | "none", number> = {going: 0, maybe: 1, none: 2, absent: 3};
const STATUS_TEXT: Record<EventStatus, string> = {going: "text-emerald-300", maybe: "text-amber-300", absent: "text-red-300"};
const fold = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * Who was there: the organiser ticks the members of the audience (those who said they come first).
 * Saving replaces the list; members see whether they were marked present.
 */
export function AttendanceDialog({event, absences, onClose, onSaved}: {
  event: FactionEvent;
  absences: Absence[];
  onClose: () => void;
  onSaved: (attendeeIds: string[], takenAt: string) => void;
}) {
  const {profiles, loading} = useProfileDirectory();
  const [picked, setPicked] = useState<Set<string>>(() => new Set(event.attendee_ids ?? []));
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const day = todayKey(event.starts_at);
  const onLeave = useMemo(() => new Set(absentOn(absences, day).map((item) => item.user_id)), [absences, day]);

  const people = useMemo(() => {
    const answers = new Map(event.responses.map((response) => [response.user_id, response]));
    const recorded = new Set(event.attendee_ids ?? []);
    return profiles
      .filter((person) => person.system_role !== "pending"
        && (isInAudience(person, event.audience) || answers.has(person.id) || recorded.has(person.id)))
      .map((person) => ({person, answer: answers.get(person.id) ?? null}))
      .sort((a, b) => ORDER[a.answer?.status ?? "none"] - ORDER[b.answer?.status ?? "none"]
        || a.person.full_name.localeCompare(b.person.full_name, "hu"));
  }, [event, profiles]);

  const term = fold(search.trim());
  const shown = term ? people.filter(({person}) => fold(person.full_name).includes(term) || person.badge_number.includes(term)) : people;
  const going = people.filter(({answer}) => answer?.status === "going").map(({person}) => person.id);

  const toggle = (id: string) => setPicked((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const save = async () => {
    setSaving(true);
    try {
      const ids = [...picked];
      const result = await eventsApi.setAttendance(event.id, ids);
      toast.success(`Jelenlét rögzítve: ${result.attended} fő.`);
      onSaved(ids, result.attendance_taken_at);
    } catch (error) {
      toast.error(errorMessage(error, "A jelenlét mentése nem sikerült."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="grid-rows-[auto_auto_minmax(0,1fr)_auto] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ClipboardCheck className="size-5 text-primary"/> Jelenlét</DialogTitle>
          <DialogDescription className="wrap-anywhere">
            {event.title}: jelöld be, ki volt ott. A tagok az esemény kártyáján látják, rögzítettük-e a jelenlétüket.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
            <Input value={search} onChange={(changeEvent) => setSearch(changeEvent.target.value)} placeholder="Név vagy jelvényszám…" className="h-9 pl-9"/>
          </div>
          <Button size="sm" variant="outline" className="h-9" disabled={!going.length}
                  onClick={() => setPicked((current) => new Set([...current, ...going]))}>Jelentkezők bejelölése</Button>
          <Button size="sm" variant="ghost" className="h-9" disabled={!picked.size} onClick={() => setPicked(new Set())}>Senki</Button>
        </div>

        <ul className="-mx-1 max-h-[50vh] min-h-0 space-y-0.5 overflow-y-auto px-1" aria-label="Résztvevők">
          {loading && !people.length ? (
            [0, 1, 2, 3].map((index) => <li key={index} className="skeleton h-11 rounded-lg"/>)
          ) : shown.length === 0 ? (
            <li className="py-6 text-center text-xs text-slate-500">Nincs ilyen tag.</li>
          ) : shown.map(({person, answer}) => (
            <li key={person.id}>
              <label className={cn("flex min-w-0 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]",
                picked.has(person.id) && "bg-emerald-500/[0.06]")}>
                <Checkbox checked={picked.has(person.id)} onCheckedChange={() => toggle(person.id)} aria-label={person.full_name}/>
                <MemberAvatar name={person.full_name} avatarUrl={person.avatar_url} size={28}/>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-slate-100">{person.full_name}</span>
                  <span className="block truncate text-[11px] text-slate-500">{person.badge_number} · {person.faction_rank}</span>
                </span>
                {onLeave.has(person.id) && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-sky-300"><CalendarOff className="size-3"/> szabadságon</span>
                )}
                {answer && <span className={cn("shrink-0 text-[11px]", STATUS_TEXT[answer.status])}>{RESPONSE_LABELS[answer.status]}</span>}
              </label>
            </li>
          ))}
        </ul>

        <DialogFooter className="items-center">
          <span className="mr-auto text-xs text-slate-400 tabular-nums">{picked.size} fő bejelölve</span>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Mégse</Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="animate-spin"/> : <ClipboardCheck/>} Mentés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
