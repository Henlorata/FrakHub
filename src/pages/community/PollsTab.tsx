import {useCallback, useEffect, useMemo, useState, type CSSProperties} from "react";
import {toast} from "sonner";
import {BarChart3, Check, Clock, EyeOff, Loader2, Lock, Plus, Trash2, Users, Vote, X} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Switch} from "@/components/ui/switch";
import {Textarea} from "@/components/ui/textarea";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {EmptyState} from "@/components/layout/EmptyState";
import {useConfirm} from "@/components/ConfirmDialog";
import {communityApi, type Poll, type PollDraft, type PollResults} from "@/lib/community";
import {audienceLabel, organisableAudiences} from "@/lib/events";
import {addDaysKey, formatDateTime, formatUntil, fromHungarian, todayKey} from "@/lib/datetime";
import {cn, errorMessage} from "@/lib/utils";
import type {Profile} from "@/types/supabase";

/** Single-series bar colour (categorical slot 1, validated on the dark surface). */
const SERIES = "#3987e5";

const RESULTS: Record<PollResults, string> = {
  live: "Azonnal látszik",
  after_vote: "Szavazás után látszik",
  after_close: "Csak a lezárás után",
};
const RESULTS_HINT: Record<PollResults, string> = {
  live: "Az eredmény már most látszik.",
  after_vote: "Az eredményt a szavazatod után látod.",
  after_close: "Az eredmény a lezárás után látszik.",
};

/**
 * Polls for an audience (like events: everyone, the staff, the command, a division or unit). A
 * vote is final; in an anonymous poll the ballot carries no voter, so nobody (the organiser
 * either) can see who chose what. Results show live, after voting or after the close.
 */
export function PollsTab({profile, focusId}: {profile: Profile; focusId: string | null}) {
  const [polls, setPolls] = useState<Poll[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [creating, setCreating] = useState(false);
  const audiences = organisableAudiences(profile);

  const load = useCallback(async () => {
    try {
      setPolls(await communityApi.polls());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!focusId || !polls) return;
    document.getElementById(`poll-${focusId}`)?.scrollIntoView({behavior: "smooth", block: "center"});
  }, [focusId, polls]);

  if (failed) return <EmptyState icon={X} title="A szavazások nem tölthetők be." action={<Button variant="outline" onClick={() => void load()}>Újra</Button>}/>;
  if (!polls) return <div className="grid gap-4 lg:grid-cols-2">{[0, 1].map((index) => <div key={index} className="skeleton h-64"/>)}</div>;

  const open = polls.filter((poll) => poll.open);
  const closed = polls.filter((poll) => !poll.open);
  return (
    <div className="space-y-6" data-tour="community-polls">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-sm text-slate-400">
          {open.length ? `${open.length} nyitott szavazás` : "Most nincs nyitott szavazás."}
          {open.some((poll) => !poll.voted) && <span className="text-amber-300"> · {open.filter((poll) => !poll.voted).length} vár a szavazatodra</span>}
        </p>
        {audiences.length > 0 && <Button onClick={() => setCreating(true)}><Plus/> Új szavazás</Button>}
      </div>
      {polls.length === 0 ? (
        <div className="panel"><EmptyState icon={Vote} title="Még nem volt szavazás." description={audiences.length ? "Indíts egyet: gyűlés időpontja, egyenruha, bármi, amiről a tagok véleménye számít." : undefined}/></div>
      ) : (
        <>
          {open.length > 0 && <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{open.map((poll, index) => (
            <PollCard key={poll.id} poll={poll} index={index} highlighted={poll.id === focusId} onChanged={load}/>
          ))}</div>}
          {closed.length > 0 && (
            <section>
              <h3 className="mb-3 text-sm font-semibold text-slate-300">Lezárt szavazások</h3>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{closed.map((poll, index) => (
                <PollCard key={poll.id} poll={poll} index={index} highlighted={poll.id === focusId} onChanged={load}/>
              ))}</div>
            </section>
          )}
        </>
      )}
      <NewPollDialog open={creating} audiences={audiences} onOpenChange={setCreating} onCreated={async () => {
        setCreating(false);
        await load();
      }}/>
    </div>
  );
}

function PollCard({poll, index, highlighted, onChanged}: {poll: Poll; index: number; highlighted: boolean; onChanged: () => Promise<void>}) {
  const [choice, setChoice] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();
  const total = poll.options.reduce((sum, option) => sum + (option.votes ?? 0), 0);
  const max = Math.max(1, ...poll.options.map((option) => option.votes ?? 0));
  const canVote = poll.open && !poll.voted;
  const turnout = poll.audience_size ? Math.round((poll.voters / poll.audience_size) * 100) : 0;

  const toggle = (id: string) => setChoice((prev) => poll.max_choices === 1 ? [id]
    : prev.includes(id) ? prev.filter((entry) => entry !== id) : prev.length < poll.max_choices ? [...prev, id] : prev);

  const vote = async () => {
    setBusy(true);
    try {
      await communityApi.vote(poll.id, choice);
      toast.success("Szavazat leadva.", {description: poll.anonymous ? "Névtelen: a szavazatod nem köthető hozzád." : undefined});
      await onChanged();
    } catch (error) {
      toast.error(errorMessage(error, "A szavazás nem sikerült."));
    } finally {
      setBusy(false);
    }
  };
  const close = async () => {
    if (!(await confirm({title: "Szavazás lezárása", description: "Lezárás után nem lehet több szavazatot leadni.", confirmLabel: "Lezárás"}))) return;
    try {
      await communityApi.closePoll(poll.id);
      await onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  const remove = async () => {
    if (!(await confirm({title: "Szavazás törlése", description: `„${poll.title}” és minden szavazata törlődik.`, confirmLabel: "Törlés", destructive: true, kind: "delete"}))) return;
    try {
      await communityApi.deletePoll(poll.id);
      await onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <article id={`poll-${poll.id}`} style={{"--i": Math.min(index, 8)} as CSSProperties}
             className={cn("panel animate-rise flex min-w-0 flex-col p-5", highlighted && "ring-2 ring-primary/50", !poll.open && "opacity-90")}>
      <header className="flex items-start gap-3">
        <div className={cn("grid size-10 shrink-0 place-items-center rounded-xl ring-1",
          poll.open ? "bg-sky-500/10 text-sky-300 ring-sky-500/25" : "bg-white/5 text-slate-400 ring-white/10")}>
          {poll.open ? <Vote className="size-5"/> : <Lock className="size-5"/>}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold wrap-anywhere text-white">{poll.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
            <span className="rounded-full bg-white/5 px-2 py-0.5 ring-1 ring-white/10">{audienceLabel(poll.audience)}</span>
            {poll.anonymous && <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-violet-200 ring-1 ring-violet-500/25"><EyeOff className="size-3"/> Névtelen</span>}
            {poll.max_choices > 1 && <span className="rounded-full bg-white/5 px-2 py-0.5 ring-1 ring-white/10">legfeljebb {poll.max_choices} választás</span>}
            <span className="inline-flex items-center gap-1"><Clock className="size-3"/>
              {poll.open ? `zárul ${formatUntil(poll.closes_at)} (${formatDateTime(poll.closes_at)})` : `lezárva ${formatDateTime(poll.closed_at ?? poll.closes_at)}`}</span>
          </div>
        </div>
        {poll.can_manage && (
          <div className="flex shrink-0 gap-0.5">
            {poll.open && <Button size="icon-sm" variant="ghost" title="Lezárás" onClick={() => void close()}><Lock/></Button>}
            <Button size="icon-sm" variant="ghost" title="Törlés" className="hover:text-red-300" onClick={() => void remove()}><Trash2/></Button>
          </div>
        )}
      </header>
      {poll.description && <p className="mt-3 text-sm whitespace-pre-wrap wrap-anywhere text-slate-300">{poll.description}</p>}

      <ul className="mt-4 space-y-2" role={canVote ? (poll.max_choices === 1 ? "radiogroup" : "group") : undefined} aria-label={poll.title}>
        {poll.options.map((option) => {
          const selected = choice.includes(option.id);
          const share = option.votes !== null && total ? Math.round((option.votes / total) * 100) : 0;
          if (canVote) {
            return (
              <li key={option.id}>
                <button type="button" role={poll.max_choices === 1 ? "radio" : "checkbox"} aria-checked={selected} onClick={() => toggle(option.id)}
                        className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ring-1 transition-colors",
                          selected ? "bg-primary/10 text-white ring-primary/40" : "bg-white/[0.03] text-slate-200 ring-white/10 hover:bg-white/[0.06]")}>
                  <span className={cn("grid size-5 shrink-0 place-items-center ring-1 transition-colors", poll.max_choices === 1 ? "rounded-full" : "rounded-md",
                    selected ? "bg-primary text-primary-foreground ring-primary" : "ring-white/25")}>{selected && <Check className="size-3.5"/>}</span>
                  <span className="min-w-0 flex-1 wrap-anywhere">{option.label}</span>
                  {poll.results_visible && option.votes !== null && <span className="shrink-0 text-xs text-slate-400 tabular-nums">{option.votes} szavazat</span>}
                </button>
              </li>
            );
          }
          return (
            <li key={option.id} className="group relative">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 wrap-anywhere text-slate-200">
                  {option.label}
                  {option.mine && <span className="ml-2 rounded-full bg-primary/15 px-1.5 py-px text-[10px] font-semibold text-primary">a te szavazatod</span>}
                </span>
                {poll.results_visible && <span className="shrink-0 text-xs text-slate-400 tabular-nums"><b className="text-white">{option.votes}</b> · {share}%</span>}
              </div>
              {poll.results_visible ? (
                <div className="mt-1 h-5 border-l border-white/15">
                  <div className="h-full origin-left rounded-r animate-[bar-grow-x_0.7s_cubic-bezier(0.2,0.7,0.2,1)_both]"
                       style={{width: `${Math.max(option.votes ? 1.5 : 0, ((option.votes ?? 0) / max) * 100)}%`, background: SERIES}}/>
                </div>
              ) : <div className="mt-1 h-1.5 rounded-full bg-white/[0.04]"/>}
              {option.voters && option.voters.length > 0 && (
                <span role="tooltip" className="pointer-events-none absolute top-full left-0 z-20 mt-1 hidden max-w-72 rounded-lg bg-[#0b1324] p-2.5 text-[11px] text-slate-300 shadow-xl ring-1 ring-white/15 group-hover:block">
                  {option.voters.map((voter) => voter.full_name).join(", ")}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <footer className="mt-auto flex flex-wrap items-center gap-3 pt-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1"><Users className="size-3.5"/> {poll.voters} / {poll.audience_size} szavazott ({turnout}%)</span>
        {!poll.results_visible && !canVote && <span className="inline-flex items-center gap-1"><BarChart3 className="size-3.5"/> Az eredmény a lezárás után látszik</span>}
        {poll.created_by_name && <span className="min-w-0 wrap-anywhere">· indította: {poll.created_by_name}</span>}
        {canVote && (
          <Button className="ml-auto" disabled={busy || choice.length === 0} onClick={() => void vote()}>
            {busy ? <Loader2 className="animate-spin"/> : <Vote/>} Szavazok
          </Button>
        )}
      </footer>
      {canVote && (
        <p className="mt-2 text-[11px] text-slate-500">
          A szavazat végleges. {RESULTS_HINT[poll.results]}
          {/* get_polls shows the counts of a named poll to its organisers all the time (never of an anonymous one). */}
          {poll.can_manage && !poll.anonymous && poll.results !== "live" && " Szervezőként az állást már most látod."}
        </p>
      )}
    </article>
  );
}

function NewPollDialog({open, audiences, onOpenChange, onCreated}: {
  open: boolean;
  audiences: string[];
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<void>;
}) {
  const blank = () => ({title: "", description: "", audience: audiences[0] ?? "all", anonymous: false, max_choices: 1, results: "after_vote" as PollResults,
    day: addDaysKey(todayKey(), 3), time: "20:00", options: ["", ""]});
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  // When the dialog opened (the server checks the closing time again when it is saved).
  const [openedAt, setOpenedAt] = useState(() => Date.now());
  useEffect(() => {
    if (open) {
      setForm(blank());
      setOpenedAt(Date.now());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const options = useMemo(() => form.options.map((option) => option.trim()).filter(Boolean), [form.options]);
  const closesAt = useMemo(() => {
    try {
      return fromHungarian(form.day, form.time);
    } catch {
      return null;
    }
  }, [form.day, form.time]);
  const tooSoon = !closesAt || Date.parse(closesAt) < openedAt + 15 * 60_000;
  const valid = form.title.trim().length >= 3 && options.length >= 2 && new Set(options).size === options.length && !tooSoon;

  const create = async () => {
    if (!closesAt) return;
    setSaving(true);
    try {
      const draft: PollDraft = {title: form.title.trim(), description: form.description.trim() || null, audience: form.audience, anonymous: form.anonymous,
        max_choices: Math.min(form.max_choices, options.length), results: form.results, closes_at: closesAt, options};
      await communityApi.createPoll(draft);
      toast.success("Szavazás elindítva.", {description: `${audienceLabel(form.audience)}: értesítést kaptak.`});
      await onCreated();
    } catch (error) {
      toast.error(errorMessage(error, "A szavazás nem indult el."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Új szavazás</DialogTitle>
          <DialogDescription>A közönség értesítést kap. A szavazatok véglegesek.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="poll-title">Kérdés</Label>
          <Input id="poll-title" maxLength={160} value={form.title} onChange={(event) => setForm((prev) => ({...prev, title: event.target.value}))}
                 placeholder="Például: Melyik estén legyen a havi gyűlés?"/>
        </div>
        <div className="space-y-1">
          <Label htmlFor="poll-description">Leírás (nem kötelező)</Label>
          <Textarea id="poll-description" rows={2} maxLength={1000} value={form.description} onChange={(event) => setForm((prev) => ({...prev, description: event.target.value}))}/>
        </div>
        <div className="space-y-1.5">
          <Label>Válaszlehetőségek</Label>
          {form.options.map((option, index) => (
            <div key={index} className="flex gap-2">
              <Input value={option} maxLength={120} placeholder={`${index + 1}. lehetőség`}
                     onChange={(event) => setForm((prev) => ({...prev, options: prev.options.map((entry, at) => (at === index ? event.target.value : entry))}))}/>
              {form.options.length > 2 && (
                <Button size="icon" variant="ghost" className="shrink-0" title="Eltávolítás"
                        onClick={() => setForm((prev) => ({...prev, options: prev.options.filter((_, at) => at !== index)}))}><X/></Button>
              )}
            </div>
          ))}
          {form.options.length < 12 && (
            <Button size="sm" variant="ghost" onClick={() => setForm((prev) => ({...prev, options: [...prev.options, ""]}))}><Plus/> Lehetőség</Button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Kik szavazhatnak</Label>
            <Select value={form.audience} onValueChange={(value) => setForm((prev) => ({...prev, audience: value}))}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>{audiences.map((audience) => <SelectItem key={audience} value={audience}>{audienceLabel(audience)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Eredmény</Label>
            <Select value={form.results} onValueChange={(value) => setForm((prev) => ({...prev, results: value as PollResults}))}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>{(Object.keys(RESULTS) as PollResults[]).map((key) => <SelectItem key={key} value={key}>{RESULTS[key]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="poll-day">Lezárás</Label>
            <div className="flex gap-2">
              <Input id="poll-day" type="date" min={todayKey()} max={addDaysKey(todayKey(), 59)} value={form.day} onChange={(event) => setForm((prev) => ({...prev, day: event.target.value}))}/>
              <Input type="time" aria-label="Lezárás ideje" value={form.time} onChange={(event) => setForm((prev) => ({...prev, time: event.target.value}))} className="w-28"/>
            </div>
            {tooSoon && <p className="text-[11px] text-amber-300">Legalább negyed óra múlva záruljon.</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="poll-max">Választható lehetőségek száma</Label>
            <Input id="poll-max" type="number" min={1} max={Math.max(1, options.length)} value={form.max_choices}
                   onChange={(event) => setForm((prev) => ({...prev, max_choices: Math.max(1, Math.min(10, Number(event.target.value) || 1))}))}/>
          </div>
        </div>
        <label className="flex items-start gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10">
          <Switch checked={form.anonymous} onCheckedChange={(value) => setForm((prev) => ({...prev, anonymous: value}))}/>
          <span className="text-sm">
            <span className="font-medium text-white">Névtelen szavazás</span>
            <span className="block text-xs text-slate-400">Csak az látszik, hányan szavaztak; hogy ki mire, azt senki (te sem) látja.</span>
          </span>
        </label>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button disabled={saving || !valid} onClick={() => void create()}>{saving ? <Loader2 className="animate-spin"/> : <Vote/>} Indítás</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
