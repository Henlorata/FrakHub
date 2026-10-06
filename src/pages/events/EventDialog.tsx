import {useState} from "react";
import {toast} from "sonner";
import {CalendarOff, CalendarPlus, Loader2, Save} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Switch} from "@/components/ui/switch";
import {Textarea} from "@/components/ui/textarea";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {formatTime, fromHungarian, todayKey} from "@/lib/datetime";
import {
  absentOn, audienceLabel, EVENT_KIND_ORDER, EVENT_KINDS, eventsApi, type Absence, type EventDraft, type EventKind, type FactionEvent,
} from "@/lib/events";
import {cn, errorMessage} from "@/lib/utils";

const DAY = 86_400_000;
const NAMES_SHOWN = 4;

/** Organising an event (new, or editing one). Saving a new one notifies its audience. */
export function EventDialog({event, audiences, absences = [], onClose, onSaved}: {
  /** The event to edit; null: a new one. */
  event: FactionEvent | null;
  /** Audiences the member may organise for. */
  audiences: string[];
  /** Approved leave: who is away on the chosen day. */
  absences?: Absence[];
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [kind, setKind] = useState<EventKind>(event?.kind ?? "meeting");
  const [title, setTitle] = useState(event?.title ?? "");
  const [date, setDate] = useState(event ? todayKey(event.starts_at) : todayKey());
  const [from, setFrom] = useState(event ? formatTime(event.starts_at) : "20:00");
  const [to, setTo] = useState(event?.ends_at ? formatTime(event.ends_at) : "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [audience, setAudience] = useState(event?.audience ?? audiences[0] ?? "all");
  const [description, setDescription] = useState(event?.description ?? "");
  const [rsvp, setRsvp] = useState(event?.rsvp ?? true);
  const [saving, setSaving] = useState(false);
  const options = [...new Set([...audiences, ...(event ? [event.audience] : [])])];
  const away = /^\d{4}-\d{2}-\d{2}$/.test(date) ? absentOn(absences, date) : [];

  const save = async () => {
    if (title.trim().length < 3) return toast.error("Adj meg címet (legalább 3 karakter).");
    if (!date || !/^\d{2}:\d{2}$/.test(from)) return toast.error("Add meg a napot és a kezdés idejét.");
    const startsAt = fromHungarian(date, from);
    let endsAt = /^\d{2}:\d{2}$/.test(to) ? fromHungarian(date, to) : null;
    // An end before the start runs past midnight.
    if (endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) endsAt = new Date(Date.parse(endsAt) + DAY).toISOString();
    if (!event && Date.parse(startsAt) < Date.now() - 3_600_000) return toast.error("Múltbeli időpontra nem hozhatsz létre eseményt.");
    const draft: EventDraft = {
      kind, title: title.trim(), starts_at: startsAt, ends_at: endsAt, location: location.trim() || null, audience,
      description: description.trim() || null, rsvp,
    };
    setSaving(true);
    try {
      if (event) {
        await eventsApi.update(event.id, draft);
        toast.success("Esemény mentve.", {description: event.starts_at !== startsAt && !event.cancelled_at ? "Aki jelentkezett, értesítést kap a változásról." : undefined});
        onSaved(event.id);
      } else {
        const id = await eventsApi.create(draft);
        toast.success("Esemény létrehozva.", {description: `${audienceLabel(audience)}: mindenki értesítést kap róla.`});
        onSaved(id);
      }
    } catch (error) {
      toast.error(errorMessage(error, "A mentés nem sikerült."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CalendarPlus className="size-5 text-primary"/> {event ? "Esemény szerkesztése" : "Új esemény"}</DialogTitle>
          <DialogDescription>Gyűlés, képzés, vizsga vagy közös akció: az érintettek a naptárban látják, és jelezhetik, ott lesznek-e.</DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {EVENT_KIND_ORDER.map((key) => {
              const meta = EVENT_KINDS[key];
              return (
                <button key={key} type="button" onClick={() => setKind(key)} aria-pressed={kind === key}
                        className={cn("flex flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 text-[11px] font-medium ring-1 transition-colors",
                          kind === key ? meta.tile : "text-slate-400 ring-white/10 hover:text-slate-200")}>
                  <meta.icon className="size-4"/>{meta.label}
                </button>
              );
            })}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="event-title">Cím</Label>
            <Input id="event-title" value={title} maxLength={120} placeholder="Pl. Heti állománygyűlés" onChange={(changeEvent) => setTitle(changeEvent.target.value)}/>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="event-date">Nap</Label>
              <Input id="event-date" type="date" value={date} onChange={(changeEvent) => setDate(changeEvent.target.value)}/>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-from">Kezdés</Label>
              <Input id="event-from" type="time" value={from} onChange={(changeEvent) => setFrom(changeEvent.target.value)}/>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-to">Vége (nem kötelező)</Label>
              <Input id="event-to" type="time" value={to} onChange={(changeEvent) => setTo(changeEvent.target.value)}/>
            </div>
          </div>
          {away.length > 0 && (
            <p className="-mt-1 flex items-start gap-1.5 text-xs text-sky-200 wrap-anywhere" data-tour="event-absences">
              <CalendarOff className="mt-0.5 size-3.5 shrink-0 text-sky-300"/>
              <span>
                Ezen a napon {away.length} tag szabadságon van: {away.slice(0, NAMES_SHOWN).map((item) => item.full_name).join(", ")}
                {away.length > NAMES_SHOWN ? ` és még ${away.length - NAMES_SHOWN}` : ""}.
              </span>
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="event-location">Helyszín</Label>
              <Input id="event-location" value={location} maxLength={120} placeholder="Pl. Downtown Station, eligazító"
                     onChange={(changeEvent) => setLocation(changeEvent.target.value)}/>
            </div>
            <div className="space-y-1.5">
              <Label>Kiknek szól</Label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger className="w-full"><SelectValue/></SelectTrigger>
                <SelectContent className="max-h-72">
                  {options.map((value) => <SelectItem key={value} value={value}>{audienceLabel(value)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="event-description">Leírás (nem kötelező)</Label>
            <Textarea id="event-description" value={description} rows={4} maxLength={2000} className="max-h-[30vh]"
                      placeholder="Napirend, mit hozzanak, öltözet…" onChange={(changeEvent) => setDescription(changeEvent.target.value)}/>
          </div>
          <label className="flex items-center justify-between gap-3 text-sm text-slate-200">
            <span>Részvétel jelzése <span className="block text-xs text-slate-500">A tagok jelezhetik: ott lesznek, talán, vagy nem tudnak menni.</span></span>
            <Switch checked={rsvp} onCheckedChange={setRsvp}/>
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Mégse</Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="animate-spin"/> : event ? <Save/> : <CalendarPlus/>} {event ? "Mentés" : "Létrehozás"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
