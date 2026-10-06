import {useCallback, useEffect, useMemo, useRef, useState, type CSSProperties} from "react";
import {toast} from "sonner";
import {
  BadgeCheck, Check, CircleDashed, GraduationCap, HeartHandshake, Loader2, MessageSquarePlus, RefreshCw, Sparkles, UserCheck, UserMinus, UserPlus, X,
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {EmptyState} from "@/components/layout/EmptyState";
import {MemberAvatar} from "@/components/MemberAvatar";
import {PersonPicker} from "@/components/fleet/Pickers";
import {useConfirm} from "@/components/ConfirmDialog";
import {progressionApi, type Trainee} from "@/lib/progression";
import {useProfileDirectory} from "@/lib/profile-directory";
import {canAssignRank, cn, errorMessage, isAcademyInstructor, isStaff} from "@/lib/utils";
import {formatDate, formatDateTime} from "@/lib/datetime";
import {TRAINEE_RANK} from "@shared/ranks";
import type {Profile} from "@/types/supabase";
import type {HrMember} from "../useHrData";

const NEXT_RANK = "Deputy Sheriff I.";
const WEEK = 7;

interface TraineesPanelProps {
  viewer: Profile;
  members: HrMember[];
  onPromote: (member: HrMember, rank: string) => Promise<void>;
  onOpenMember: (memberId: string) => void;
}

/**
 * The trainee week: the checklist (admission exam, first steps, basic academy days, first
 * report, the mentor's sign-off), the mentor and their short notes. A trainee is one for about
 * a week, so the mentor follows that week only.
 */
export function TraineesPanel({viewer, members, onPromote, onOpenMember}: TraineesPanelProps) {
  const [trainees, setTrainees] = useState<Trainee[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [mentorFor, setMentorFor] = useState<Trainee | null>(null);
  const [signOffFor, setSignOffFor] = useState<Trainee | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const confirm = useConfirm();
  const coach = isStaff(viewer) || isAcademyInstructor(viewer);
  const byId = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

  const load = useCallback(async () => {
    try {
      setTrainees(await progressionApi.trainees());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // A rank change (also the toast's undo) adds or removes a trainee: read the list again.
  const rankKey = useMemo(() => members.map((member) => `${member.id}:${member.faction_rank}`).join("|"), [members]);
  const loadedRanks = useRef(rankKey);
  useEffect(() => {
    if (loadedRanks.current === rankKey) return;
    loadedRanks.current = rankKey;
    void load();
  }, [rankKey, load]);

  const promote = async (trainee: Trainee) => {
    const member = byId.get(trainee.user_id);
    if (!member) return;
    if (!(await confirm({title: "Felavatás", description: `${trainee.full_name}: ${TRAINEE_RANK} → ${NEXT_RANK}`, confirmLabel: "Előléptetés"}))) return;
    setBusy(trainee.user_id);
    try {
      await onPromote(member, NEXT_RANK);
    } finally {
      setBusy(null);
    }
  };

  const unsign = async (trainee: Trainee) => {
    setBusy(trainee.user_id);
    try {
      await progressionApi.signOff(trainee.user_id, false);
      toast.success("A jóváhagyást visszavontad.");
      await load();
    } catch (error) {
      toast.error(errorMessage(error, "Nem sikerült."));
    } finally {
      setBusy(null);
    }
  };

  if (failed) {
    return <EmptyState icon={X} title="A Trainee-k listája nem tölthető be." action={<Button variant="outline" onClick={() => void load()}><RefreshCw/> Újra</Button>}/>;
  }
  if (!trainees) return <div className="grid gap-4 lg:grid-cols-2">{[0, 1].map((index) => <div key={index} className="skeleton h-72"/>)}</div>;

  if (trainees.length === 0) {
    return (
      <div className="panel">
        <EmptyState icon={GraduationCap} title={coach ? "Most nincs Trainee az állományban." : "Nincs követett Trainee-d."}
                    description={coach ? "Az új tagok a felvételi után itt jelennek meg." : "Ha mentornak jelölnek ki, itt követheted a Trainee hetét."}/>
      </div>
    );
  }

  const withoutMentor = trainees.filter((trainee) => !trainee.mentor).length;
  const ready = trainees.filter((trainee) => trainee.ready).length;

  return (
    <div className="space-y-4" data-tour="hr-trainees">
      {coach && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-slate-300 ring-1 ring-white/10"><b className="text-white tabular-nums">{trainees.length}</b> Trainee</span>
          {withoutMentor > 0 && (
            <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-200 ring-1 ring-amber-500/25"><b className="tabular-nums">{withoutMentor}</b> mentor nélkül</span>
          )}
          {ready > 0 && (
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-200 ring-1 ring-emerald-500/25"><b className="tabular-nums">{ready}</b> kész a felavatásra</span>
          )}
          <Button size="icon" variant="ghost" className="ml-auto size-8" title="Frissítés" onClick={() => void load()}><RefreshCw/></Button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {trainees.map((trainee, index) => {
          const member = byId.get(trainee.user_id);
          const canPromote = !!member && member.id !== viewer.id && canAssignRank(viewer, member, NEXT_RANK);
          const canSign = coach || trainee.is_mentor;
          return (
            <TraineeCard key={trainee.user_id} trainee={trainee} index={index} self={trainee.user_id === viewer.id} coach={coach}
                         canPromote={canPromote} canSign={canSign} busy={busy === trainee.user_id}
                         onOpen={() => onOpenMember(trainee.user_id)} onMentor={() => setMentorFor(trainee)}
                         onSignOff={() => setSignOffFor(trainee)} onUnsign={() => void unsign(trainee)}
                         onPromote={() => void promote(trainee)} onNoteAdded={load}/>
          );
        })}
      </div>
      <MentorDialog trainee={mentorFor} onOpenChange={(open) => !open && setMentorFor(null)} onDone={() => {
        setMentorFor(null);
        void load();
      }}/>
      <SignOffDialog trainee={signOffFor} onOpenChange={(open) => !open && setSignOffFor(null)} onDone={() => {
        setSignOffFor(null);
        void load();
      }}/>
    </div>
  );
}

function TraineeCard({trainee, index, self, coach, canPromote, canSign, busy, onOpen, onMentor, onSignOff, onUnsign, onPromote, onNoteAdded}: {
  trainee: Trainee;
  index: number;
  self: boolean;
  coach: boolean;
  canPromote: boolean;
  canSign: boolean;
  busy: boolean;
  onOpen: () => void;
  onMentor: () => void;
  onSignOff: () => void;
  onUnsign: () => void;
  onPromote: () => void;
  onNoteAdded: () => Promise<void>;
}) {
  const done = trainee.checks.filter((check) => check.ok).length;
  const day = Math.min(trainee.days + 1, 99);
  const overdue = trainee.days >= WEEK;
  return (
    <article className="panel animate-rise flex min-w-0 flex-col overflow-hidden p-0" style={{"--i": index} as CSSProperties}>
      <header className="flex items-center gap-3 p-4">
        <button type="button" onClick={onOpen} className="shrink-0" title="Adatlap">
          <MemberAvatar name={trainee.full_name} avatarUrl={trainee.avatar_url} size={44}/>
        </button>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={onOpen} className="block max-w-full truncate text-left text-sm font-semibold text-white hover:underline">{trainee.full_name}</button>
          <div className="text-[11px] text-slate-500">#{trainee.badge_number} · csatlakozott: {formatDate(trainee.joined_on)}</div>
        </div>
        <div className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
          trainee.ready ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30"
            : overdue ? "bg-amber-500/15 text-amber-200 ring-amber-500/30" : "bg-sky-500/10 text-sky-200 ring-sky-500/25")}>
          {trainee.ready ? "Kész" : `${day}. nap`}
        </div>
      </header>

      <div className="px-4" aria-label={`${day}. nap a ${WEEK} napos Trainee hétből`}>
        <div className="flex gap-1">
          {Array.from({length: WEEK}, (_, slot) => (
            <span key={slot} className={cn("h-1.5 flex-1 rounded-full",
              slot < Math.min(day, WEEK) ? (overdue ? "bg-amber-400/80" : "bg-sky-400/80") : "bg-white/[0.06]")}/>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>1. nap</span><span>{overdue ? "túl a héten" : "7. nap"}</span></div>
      </div>

      <ul className="mt-3 space-y-1 px-4">
        {trainee.checks.map((check) => (
          <li key={check.key} className="flex items-center gap-2 text-xs">
            {check.ok ? (
              <span className="grid size-4 shrink-0 place-items-center rounded-full bg-emerald-500 text-[#04120c]"><Check className="size-3"/></span>
            ) : (
              <CircleDashed className="size-4 shrink-0 text-slate-500"/>
            )}
            <span className={cn("min-w-0 flex-1 truncate", check.ok ? "text-slate-300" : "text-slate-200")}>{check.label}</span>
            {check.target !== undefined && (
              <span className="font-mono text-[11px] text-slate-500 tabular-nums">{Math.min(check.value ?? 0, check.target)}/{check.target}</span>
            )}
          </li>
        ))}
      </ul>
      <div className="mx-4 mt-3 h-1 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-[width] duration-700"
             style={{width: `${(done / Math.max(1, trainee.checks.length)) * 100}%`}}/>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/5 px-4 py-3">
        <HeartHandshake className="size-4 shrink-0 text-rose-300"/>
        {trainee.mentor ? (
          <span className="flex min-w-0 items-center gap-2">
            <MemberAvatar name={trainee.mentor.full_name} avatarUrl={trainee.mentor.avatar_url} size={24}/>
            <span className="truncate text-xs text-slate-200">{trainee.mentor.full_name}</span>
            <span className="hidden truncate text-[11px] text-slate-500 sm:inline">{trainee.mentor.faction_rank}</span>
          </span>
        ) : (
          <span className="text-xs text-amber-200/90">Nincs még mentora</span>
        )}
        {coach && (
          <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs" onClick={onMentor}>
            {trainee.mentor ? <UserCheck/> : <UserPlus/>} {trainee.mentor ? "Csere" : "Mentor kijelölése"}
          </Button>
        )}
      </div>

      {trainee.signed_off_at ? (
        <div className="mx-4 mb-3 rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-100 ring-1 ring-emerald-500/25">
          <div className="flex items-center gap-1.5 font-semibold"><BadgeCheck className="size-4 text-emerald-300"/> A mentor jóváhagyta</div>
          <p className="mt-0.5 text-emerald-200/80">{trainee.signed_off_by_name ?? ""} · {formatDateTime(trainee.signed_off_at)}</p>
          {trainee.sign_off_note && <p className="mt-1 wrap-anywhere text-emerald-50/90">„{trainee.sign_off_note}”</p>}
        </div>
      ) : null}

      {!self && (canSign || canPromote) && (
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {canSign && !trainee.signed_off_at && (
            <Button size="sm" variant="outline" onClick={onSignOff}><BadgeCheck/> Jóváhagyom</Button>
          )}
          {canSign && trainee.signed_off_at && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={onUnsign}><UserMinus/> Jóváhagyás visszavonása</Button>
          )}
          {canPromote && (
            <Button size="sm" variant={trainee.ready ? "default" : "outline"} disabled={busy} onClick={onPromote} className="ml-auto">
              {busy ? <Loader2 className="animate-spin"/> : <Sparkles/>} Felavatás: {NEXT_RANK}
            </Button>
          )}
        </div>
      )}

      {trainee.notes && <NotesBox trainee={trainee} onAdded={onNoteAdded}/>}
    </article>
  );
}

function NotesBox({trainee, onAdded}: {trainee: Trainee; onAdded: () => Promise<void>}) {
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const add = async () => {
    setSaving(true);
    try {
      await progressionApi.addNote(trainee.user_id, body);
      setBody("");
      await onAdded();
    } catch (error) {
      toast.error(errorMessage(error, "A jegyzet nem ment el."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="mt-auto border-t border-white/5 bg-black/10 px-4 py-3">
      <p className="mb-2 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Mentori jegyzetek <span className="font-normal normal-case text-slate-600">(a Trainee nem látja)</span></p>
      {trainee.notes && trainee.notes.length > 0 ? (
        <ul className="mb-2 max-h-40 space-y-2 overflow-y-auto pr-1">
          {trainee.notes.map((note) => (
            <li key={note.id} className="text-xs">
              <p className="wrap-anywhere text-slate-200">{note.body}</p>
              <p className="text-[10px] text-slate-500">{note.author_name ?? "Ismeretlen"} · {formatDateTime(note.created_at)}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-2 text-xs text-slate-500">Még nincs jegyzet.</p>
      )}
      <div className="flex items-end gap-2">
        <Textarea rows={1} maxLength={400} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Rövid megjegyzés a hétről…"
                  className="min-h-9 flex-1 resize-none text-xs" aria-label="Új mentori jegyzet"
                  onKeyDown={(event) => {
                    // Enter sends, Shift+Enter starts a new line.
                    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
                    event.preventDefault();
                    if (!saving && body.trim().length >= 2) void add();
                  }}/>
        <Button size="icon" variant="outline" className="size-9 shrink-0" title="Jegyzet hozzáadása" disabled={saving || body.trim().length < 2}
                onClick={() => void add()}>
          {saving ? <Loader2 className="animate-spin"/> : <MessageSquarePlus/>}
        </Button>
      </div>
    </div>
  );
}

function MentorDialog({trainee, onOpenChange, onDone}: {trainee: Trainee | null; onOpenChange: (open: boolean) => void; onDone: () => void}) {
  const {profiles} = useProfileDirectory();
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setSelected(trainee?.mentor?.id ?? null);
  }, [trainee]);
  const save = async (mentorId: string | null) => {
    if (!trainee) return;
    setSaving(true);
    try {
      await progressionApi.assignMentor(trainee.user_id, mentorId);
      toast.success(mentorId ? "Mentor kijelölve." : "A mentort levetted.", {description: mentorId ? "A mentor és a Trainee értesítést kapott." : undefined});
      onDone();
    } catch (error) {
      toast.error(errorMessage(error, "Nem sikerült."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={!!trainee} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mentor: {trainee?.full_name}</DialogTitle>
          <DialogDescription>Egy felavatott tag, aki az első héten végigkíséri a Trainee-t: közös járőr, kérdések, rövid jegyzetek.</DialogDescription>
        </DialogHeader>
        <PersonPicker people={profiles} selected={selected ? [selected] : []} autoFocus
                      blocker={(person) => person.faction_rank === TRAINEE_RANK ? "Trainee" : person.id === trainee?.user_id ? "Saját maga" : null}
                      onToggle={(person) => setSelected((current) => current === person.id ? null : person.id)}/>
        <DialogFooter className="gap-2 sm:justify-between">
          {trainee?.mentor ? (
            <Button variant="ghost" disabled={saving} onClick={() => void save(null)}><UserMinus/> Mentor levétele</Button>
          ) : <span/>}
          <Button disabled={saving || !selected || selected === trainee?.mentor?.id} onClick={() => void save(selected)}>
            {saving ? <Loader2 className="animate-spin"/> : <UserCheck/>} Kijelölés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SignOffDialog({trainee, onOpenChange, onDone}: {trainee: Trainee | null; onOpenChange: (open: boolean) => void; onDone: () => void}) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (trainee) setNote("");
  }, [trainee]);
  const missing = trainee?.checks.filter((check) => !check.ok && check.key !== "mentor") ?? [];
  const save = async () => {
    if (!trainee) return;
    setSaving(true);
    try {
      await progressionApi.signOff(trainee.user_id, true, note);
      toast.success("Jóváhagyva.", {description: "A mentort kijelölő tag és a TB vezetői értesítést kaptak."});
      onDone();
    } catch (error) {
      toast.error(errorMessage(error, "Nem sikerült."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={!!trainee} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kész az előléptetésre?</DialogTitle>
          <DialogDescription>{trainee?.full_name} felavatható {NEXT_RANK} rangra? Az előléptetésről ezután a Supervisory Staff dönt.</DialogDescription>
        </DialogHeader>
        {missing.length > 0 && (
          <div className="rounded-xl bg-amber-500/10 p-3 text-xs text-amber-100 ring-1 ring-amber-500/25">
            Még hiányzik: {missing.map((check) => check.label).join(", ")}. Ettől még jóváhagyhatod, ha szerinted megállja a helyét.
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="sign-off-note">Megjegyzés (nem kötelező)</Label>
          <Textarea id="sign-off-note" rows={3} maxLength={400} value={note} onChange={(event) => setNote(event.target.value)}
                    placeholder="Például: magabiztos a rádióban, jól intézkedett."/>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button disabled={saving} onClick={() => void save()}>{saving ? <Loader2 className="animate-spin"/> : <BadgeCheck/>} Jóváhagyás</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
