import {useCallback, useEffect, useMemo, useRef, useState, type CSSProperties} from "react";
import {toast} from "sonner";
import {
  ArrowRight, Check, ChevronRight, CircleDashed, Loader2, Medal, PalmtreeIcon, RefreshCw, Search, Settings2, Sparkles, ThumbsDown, Undo2, X,
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {EmptyState} from "@/components/layout/EmptyState";
import {MemberAvatar} from "@/components/MemberAvatar";
import {useConfirm} from "@/components/ConfirmDialog";
import {
  checkValueText, NOMINATION_STATUS, progressionApi, readiness, type BoardMember, type CriteriaDraft, type Nomination, type PromotionBoard,
  type PromotionCheck, type PromotionCriteria,
} from "@/lib/progression";
import {canAssignRank, cn, errorMessage, getRankPriority} from "@/lib/utils";
import {formatDate} from "@/lib/datetime";
import type {Profile} from "@/types/supabase";
import {RankPill} from "./RankControls";
import {formatSpan} from "../hr-utils";
import type {HrMember} from "../useHrData";
import {formatPeriod, formatScore} from "@/lib/reviews";

type Filter = "ready" | "close" | "all";

interface PromotionsPanelProps {
  viewer: Profile;
  members: HrMember[];
  /** The rank change of the HR page (toast with undo); the database then closes the nomination. */
  onPromote: (member: HrMember, rank: string) => Promise<void>;
  onOpenMember: (memberId: string) => void;
}

/**
 * The eligibility board: who meets the criteria of their next rank (time in rank, recorded duty
 * time, reports, warnings, exams), the nominations of the supervisors and the decisions of the
 * command. Approval is the promotion itself.
 */
export function PromotionsPanel({viewer, members, onPromote, onOpenMember}: PromotionsPanelProps) {
  const [board, setBoard] = useState<PromotionBoard | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("ready");
  const [query, setQuery] = useState("");
  const [nominating, setNominating] = useState<BoardMember | null>(null);
  const [rejecting, setRejecting] = useState<Nomination | null>(null);
  const [criteriaOpen, setCriteriaOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const confirm = useConfirm();

  const load = useCallback(async () => {
    try {
      setBoard(await progressionApi.board());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // A rank change (also the toast's undo) closes or reopens nominations in the database: read the board again.
  const rankKey = useMemo(() => members.map((member) => `${member.id}:${member.faction_rank}`).join("|"), [members]);
  const loadedRanks = useRef(rankKey);
  useEffect(() => {
    if (loadedRanks.current === rankKey) return;
    loadedRanks.current = rankKey;
    void load();
  }, [rankKey, load]);

  const byId = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

  const counts = useMemo(() => {
    const list = board?.members ?? [];
    return {
      ready: list.filter((member) => member.eligible).length,
      close: list.filter((member) => !member.eligible && member.configured && member.missing === 1).length,
      all: list.length,
    };
  }, [board]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (board?.members ?? []).filter((member) => {
      if (filter === "ready" && !member.eligible) return false;
      if (filter === "close" && (member.eligible || !member.configured || member.missing !== 1)) return false;
      if (!needle) return true;
      return member.full_name.toLowerCase().includes(needle) || member.badge_number.includes(needle);
    });
  }, [board, filter, query]);

  const promote = async (userId: string, rank: string) => {
    const member = byId.get(userId);
    if (!member) return;
    const nominated = board?.nominations.some((nomination) => nomination.status === "pending" && nomination.user_id === userId && nomination.to_rank === rank);
    if (!(await confirm({
      title: "Előléptetés",
      description: (
        <>
          <span className="block">{member.full_name}: {member.faction_rank} → {rank}</span>
          {nominated && <span className="mt-1 block">A függő javaslat ezzel elfogadottá válik.</span>}
        </>
      ),
      confirmLabel: "Előléptetés",
    }))) return;
    setBusy(userId);
    try {
      // The board is read again by the rank watch above once the roster has the new rank.
      await onPromote(member, rank);
    } finally {
      setBusy(null);
    }
  };

  const withdraw = async (nomination: Nomination) => {
    if (!(await confirm({title: "Javaslat visszavonása", description: `${nomination.member.full_name} → ${nomination.to_rank}`, confirmLabel: "Visszavonás"}))) return;
    setBusy(nomination.id);
    try {
      await progressionApi.decide(nomination.id, "withdrawn");
      toast.success("A javaslatot visszavontad.");
      await load();
    } catch (error) {
      toast.error(errorMessage(error, "A visszavonás nem sikerült."));
    } finally {
      setBusy(null);
    }
  };

  if (failed) {
    return <EmptyState icon={X} title="Az előléptetési tábla nem tölthető be." action={<Button variant="outline" onClick={() => void load()}><RefreshCw/> Újra</Button>}/>;
  }
  if (!board) return <div className="space-y-3">{[0, 1, 2, 3].map((index) => <div key={index} className="skeleton h-20"/>)}</div>;

  const pending = board.nominations.filter((nomination) => nomination.status === "pending");
  const decided = board.nominations.filter((nomination) => nomination.status !== "pending");

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <section className="min-w-0 space-y-4" data-tour="hr-promotions">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/10" role="tablist" aria-label="Szűrés">
            {([["ready", "Előléptethető", counts.ready], ["close", "Egy hiányzik", counts.close], ["all", "Mindenki", counts.all]] as const).map(([id, label, count]) => (
              <button key={id} type="button" role="tab" aria-selected={filter === id} onClick={() => setFilter(id)}
                      className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
                        filter === id ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200")}>
                {label}
                <span className={cn("rounded-full px-1.5 text-[10px] tabular-nums", filter === id ? "bg-primary/20 text-primary" : "bg-white/5 text-slate-500")}>{count}</span>
              </button>
            ))}
          </div>
          <div className="relative min-w-0 flex-1 sm:max-w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-500"/>
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Név vagy jelvényszám" className="h-8 pl-8 text-xs"/>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={() => setCriteriaOpen(true)}><Settings2/> Feltételek</Button>
            <Button size="icon" variant="ghost" className="size-8" title="Frissítés" disabled={refreshing} onClick={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}><RefreshCw className={cn(refreshing && "animate-spin")}/></Button>
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="panel">
            <EmptyState icon={filter === "ready" ? Sparkles : CircleDashed}
                        title={filter === "ready" ? "Most senki sem teljesíti a következő rang feltételeit." : "Nincs találat."}
                        description={filter === "ready" ? "A „Mindenki” nézetben látod, kinek mi hiányzik még." : undefined}/>
          </div>
        ) : (
          <ul className="space-y-2">
            {shown.map((member, index) => (
              <BoardRow key={member.user_id} member={member} index={index} viewer={viewer} hrMember={byId.get(member.user_id)}
                        busy={busy === member.user_id}
                        onOpen={() => onOpenMember(member.user_id)}
                        onNominate={() => setNominating(member)}
                        onPromote={(rank) => void promote(member.user_id, rank)}/>
            ))}
          </ul>
        )}
      </section>

      <aside className="min-w-0 space-y-4">
        <section className="panel overflow-hidden p-0" data-tour="hr-nominations">
          <header className="flex items-center gap-3 px-4 py-3.5">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/25"><Medal className="size-4"/></div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-white">Javaslatok</h3>
              <p className="text-xs text-slate-500">{pending.length ? `${pending.length} döntésre vár` : "Nincs függő javaslat"}</p>
            </div>
          </header>
          {pending.length > 0 && (
            <ul className="space-y-2 border-t border-white/5 p-3">
              {pending.map((nomination) => {
                const target = byId.get(nomination.user_id);
                const canPromote = !!target && target.id !== viewer.id && canAssignRank(viewer, target, nomination.to_rank);
                return (
                  <li key={nomination.id} className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/[0.06]">
                    <button type="button" onClick={() => onOpenMember(nomination.user_id)} className="flex w-full min-w-0 items-center gap-2.5 text-left">
                      <MemberAvatar name={nomination.member.full_name} avatarUrl={nomination.member.avatar_url} size={32}/>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-white">{nomination.member.full_name}</div>
                        <div className="flex min-w-0 items-center gap-1 text-[11px] text-slate-400">
                          <span className="truncate">{nomination.from_rank}</span><ArrowRight className="size-3 shrink-0"/>
                          <span className="truncate font-medium text-emerald-300">{nomination.to_rank}</span>
                        </div>
                      </div>
                    </button>
                    <p className="mt-2 text-xs leading-relaxed wrap-anywhere text-slate-300">„{nomination.reason}”</p>
                    <p className="mt-1.5 text-[11px] text-slate-500">{nomination.nominated_by_name ?? "Ismeretlen"} · {formatDate(nomination.created_at)}</p>
                    {(canPromote || nomination.can_decide || nomination.can_withdraw) && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {canPromote && (
                          <Button size="sm" disabled={busy === nomination.user_id} onClick={() => void promote(nomination.user_id, nomination.to_rank)}>
                            {busy === nomination.user_id ? <Loader2 className="animate-spin"/> : <Check/>} Előléptetés
                          </Button>
                        )}
                        {nomination.can_decide && (
                          <Button size="sm" variant="outline" onClick={() => setRejecting(nomination)}><ThumbsDown/> Elutasítás</Button>
                        )}
                        {nomination.can_withdraw && !nomination.can_decide && (
                          <Button size="sm" variant="ghost" disabled={busy === nomination.id} onClick={() => void withdraw(nomination)}><Undo2/> Visszavonás</Button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {decided.length > 0 && (
            <details className="group border-t border-white/5">
              <summary className="flex cursor-pointer list-none items-center gap-1 px-4 py-2.5 text-xs font-medium text-slate-400 hover:text-white">
                <ChevronRight className="size-3.5 transition-transform group-open:rotate-90"/> Döntések (60 nap) · {decided.length}
              </summary>
              <ul className="divide-y divide-white/5">
                {decided.map((nomination) => (
                  <li key={nomination.id} className="flex items-start gap-2.5 px-4 py-2.5">
                    <MemberAvatar name={nomination.member.full_name} avatarUrl={nomination.member.avatar_url} size={28}/>
                    <div className="min-w-0 flex-1 text-xs">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium text-slate-200">{nomination.member.full_name}</span>
                        <span className={cn("shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold ring-1", NOMINATION_STATUS[nomination.status].tone)}>
                          {NOMINATION_STATUS[nomination.status].label}
                        </span>
                      </div>
                      <div className="text-slate-500">{nomination.to_rank} · {nomination.decided_at ? formatDate(nomination.decided_at) : ""}
                        {nomination.decided_by_name ? ` · ${nomination.decided_by_name}` : ""}</div>
                      {nomination.decision_note && <p className="mt-0.5 wrap-anywhere text-slate-400">{nomination.decision_note}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
        <p className="px-1 text-[11px] leading-relaxed text-slate-500">
          A feltételeket az Executive Staff állítja be rangonként. A duty időt a gyűléseken rögzített havi idő adja, a jelentéseket a jelentésnapló.
          Elfogadni egy javaslatot az előléptetéssel lehet; a javaslat ekkor magától lezárul.
        </p>
      </aside>

      <NominateDialog member={nominating} onOpenChange={(open) => !open && setNominating(null)} onDone={() => {
        setNominating(null);
        void load();
      }}/>
      <RejectDialog nomination={rejecting} onOpenChange={(open) => !open && setRejecting(null)} onDone={() => {
        setRejecting(null);
        void load();
      }}/>
      <CriteriaDialog open={criteriaOpen} onOpenChange={setCriteriaOpen} board={board} onSaved={(saved) => {
        setBoard((prev) => prev && {...prev, criteria: prev.criteria.map((row) => row.rank === saved.rank ? saved : row)});
        void load();
      }}/>
    </div>
  );
}

function BoardRow({member, index, viewer, hrMember, busy, onOpen, onNominate, onPromote}: {
  member: BoardMember;
  index: number;
  viewer: Profile;
  hrMember: HrMember | undefined;
  busy: boolean;
  onOpen: () => void;
  onNominate: () => void;
  onPromote: (rank: string) => void;
}) {
  const ratio = readiness(member);
  const canPromote = !!hrMember && !!member.next_rank && hrMember.id !== viewer.id && canAssignRank(viewer, hrMember, member.next_rank);
  // nominate_for_promotion: only members below the nominator's own rank (the bureau manager anyone).
  const canNominate = !member.nomination && !!member.next_rank && member.user_id !== viewer.id
    && (!!viewer.is_bureau_manager || getRankPriority(viewer.faction_rank) < getRankPriority(member.faction_rank));
  return (
    <li className="panel animate-rise group grid grid-cols-1 gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" style={{"--i": Math.min(index, 12)} as CSSProperties}>
      <div className="flex min-w-0 items-start gap-3">
        <button type="button" onClick={onOpen} className="relative shrink-0" title="Adatlap">
          <ReadinessRing value={ratio} ok={member.eligible}/>
          <MemberAvatar name={member.full_name} avatarUrl={member.avatar_url} size={36} className="absolute top-1/2 left-1/2 -translate-1/2"/>
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <button type="button" onClick={onOpen} className="truncate text-sm font-semibold text-white hover:underline">{member.full_name}</button>
            <span className="font-mono text-[11px] text-slate-500">#{member.badge_number}</span>
            {member.on_leave && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-1.5 py-px text-[10px] font-medium text-sky-300 ring-1 ring-sky-500/25">
                <PalmtreeIcon className="size-3"/> Szabadságon
              </span>
            )}
            {member.nomination && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-px text-[10px] font-medium text-amber-200 ring-1 ring-amber-500/25">
                <Medal className="size-3"/> Javasolva
              </span>
            )}
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
            <RankPill rank={member.faction_rank} className="h-5 text-[11px]"/>
            <ArrowRight className="size-3 text-slate-500"/>
            {member.next_rank && <RankPill rank={member.next_rank} className="h-5 text-[11px]"/>}
            <span className="text-[11px] text-slate-500">· {formatSpan(member.days_in_rank)} a rangban</span>
            {member.last_review && (
              <span className="text-[11px] text-amber-200/90" title="A legutóbbi teljesítményértékelés átlaga">
                · értékelés: {formatScore(member.last_review.overall)} ({formatPeriod(member.last_review.period)})
              </span>
            )}
          </div>
          {member.configured ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {member.checks.map((check) => <CheckChip key={check.key} check={check}/>)}
            </ul>
          ) : (
            <p className="mt-2 text-[11px] text-slate-500">Ehhez a ranghoz még nincs feltétel beállítva.</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 sm:justify-end">
        {canPromote && member.eligible && (
          <Button size="sm" disabled={busy} onClick={() => member.next_rank && onPromote(member.next_rank)}>
            {busy ? <Loader2 className="animate-spin"/> : <Check/>} Előléptetés
          </Button>
        )}
        {canNominate && (
          <Button size="sm" variant={member.eligible && !canPromote ? "default" : "outline"} onClick={onNominate}><Medal/> Javaslom</Button>
        )}
      </div>
    </li>
  );
}

/** Progress around the avatar: how much of the next rank's criteria is met. */
function ReadinessRing({value, ok}: {value: number; ok: boolean}) {
  const radius = 23;
  const length = 2 * Math.PI * radius;
  return (
    <svg viewBox="0 0 52 52" className="size-[52px] -rotate-90" aria-hidden>
      <circle cx="26" cy="26" r={radius} fill="none" strokeWidth="3" className="stroke-white/[0.07]"/>
      <circle cx="26" cy="26" r={radius} fill="none" strokeWidth="3" strokeLinecap="round"
              strokeDasharray={length} strokeDashoffset={length * (1 - Math.max(0.02, value))}
              className={cn("transition-[stroke-dashoffset] duration-700", ok ? "stroke-emerald-400" : value >= 0.6 ? "stroke-sky-400" : "stroke-amber-400")}/>
    </svg>
  );
}

function CheckChip({check}: {check: PromotionCheck}) {
  return (
    <li title={`${check.label}: ${checkValueText(check)}`}
        className={cn("inline-flex max-w-full min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] ring-1",
          check.ok ? "bg-emerald-500/10 text-emerald-200 ring-emerald-500/20" : "bg-white/[0.03] text-slate-300 ring-white/10")}>
      {check.ok ? <Check className="size-3 shrink-0 text-emerald-400"/> : <X className="size-3 shrink-0 text-red-400"/>}
      <span className="truncate">{check.label}</span>
      <span className={cn("shrink-0 font-mono tabular-nums", check.ok ? "text-emerald-300/80" : "text-slate-400")}>{checkValueText(check)}</span>
    </li>
  );
}

function NominateDialog({member, onOpenChange, onDone}: {member: BoardMember | null; onOpenChange: (open: boolean) => void; onDone: () => void}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (member) setReason("");
  }, [member]);
  const submit = async () => {
    if (!member) return;
    setSaving(true);
    try {
      await progressionApi.nominate(member.user_id, reason);
      toast.success("Javaslat elküldve.", {description: "Akik dönthetnek róla, értesítést kaptak."});
      onDone();
    } catch (error) {
      toast.error(errorMessage(error, "A javaslat nem ment el."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={!!member} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Előléptetési javaslat</DialogTitle>
          <DialogDescription>{member ? `${member.full_name}: ${member.faction_rank} → ${member.next_rank}` : ""}</DialogDescription>
        </DialogHeader>
        {member && member.checks.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">{member.checks.map((check) => <CheckChip key={check.key} check={check}/>)}</ul>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="nomination-reason">Miért javaslod?</Label>
          <Textarea id="nomination-reason" rows={4} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)}
                    placeholder="Például: megbízható, jó jelentéseket ír, segíti a Trainee-ket."/>
          <p className="text-[11px] text-slate-500">Legalább 10 karakter. A Supervisory Staff és felette látja, a javasolt tag nem.</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button disabled={saving || reason.trim().length < 10} onClick={() => void submit()}>
            {saving ? <Loader2 className="animate-spin"/> : <Medal/>} Javaslat küldése
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({nomination, onOpenChange, onDone}: {nomination: Nomination | null; onOpenChange: (open: boolean) => void; onDone: () => void}) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (nomination) setNote("");
  }, [nomination]);
  const submit = async () => {
    if (!nomination) return;
    setSaving(true);
    try {
      await progressionApi.decide(nomination.id, "rejected", note);
      toast.success("Javaslat elutasítva.", {description: "A javasló értesítést kapott az indoklással."});
      onDone();
    } catch (error) {
      toast.error(errorMessage(error, "Az elutasítás nem sikerült."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={!!nomination} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Javaslat elutasítása</DialogTitle>
          <DialogDescription>{nomination ? `${nomination.member.full_name} → ${nomination.to_rank}` : ""}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="reject-note">Indoklás</Label>
          <Textarea id="reject-note" rows={3} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)}
                    placeholder="Például: még egy hónap tapasztalat kell a rangban."/>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button variant="destructive" disabled={saving || !note.trim()} onClick={() => void submit()}>
            {saving ? <Loader2 className="animate-spin"/> : <ThumbsDown/>} Elutasítás
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const numberOrNull = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const number = Number(trimmed);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : null;
};

/** Criteria per rank: the executive staff edits them, everyone else reads them. */
function CriteriaDialog({open, onOpenChange, board, onSaved}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  board: PromotionBoard;
  onSaved: (criteria: PromotionCriteria) => void;
}) {
  const ranks = board.criteria;
  const [selected, setSelected] = useState<string | null>(null);
  const current = ranks.find((row) => row.rank === selected) ?? ranks[ranks.length - 1] ?? null;
  const [draft, setDraft] = useState<Record<keyof Omit<CriteriaDraft, "exam_ids" | "note">, string> & {note: string; exam_ids: string[]}>(
    {min_days_in_rank: "", min_duty_hours: "", window_months: "1", min_reports: "", max_warnings: "", note: "", exam_ids: []});
  const [saving, setSaving] = useState(false);
  const editable = board.can_edit_criteria;

  useEffect(() => {
    if (!current) return;
    setDraft({
      min_days_in_rank: current.min_days_in_rank?.toString() ?? "", min_duty_hours: current.min_duty_hours?.toString() ?? "",
      window_months: String(current.window_months ?? 1), min_reports: current.min_reports?.toString() ?? "",
      max_warnings: current.max_warnings?.toString() ?? "", note: current.note ?? "", exam_ids: current.exam_ids ?? [],
    });
  }, [current]);

  const save = async () => {
    if (!current) return;
    setSaving(true);
    try {
      const saved = await progressionApi.saveCriteria(current.rank, {
        min_days_in_rank: numberOrNull(draft.min_days_in_rank), min_duty_hours: numberOrNull(draft.min_duty_hours),
        window_months: Math.min(3, Math.max(1, numberOrNull(draft.window_months) ?? 1)), min_reports: numberOrNull(draft.min_reports),
        max_warnings: numberOrNull(draft.max_warnings), exam_ids: draft.exam_ids, note: draft.note.trim() || null,
      });
      toast.success(`${current.rank}: feltételek mentve.`);
      onSaved(saved);
    } catch (error) {
      toast.error(errorMessage(error, "A mentés nem sikerült."));
    } finally {
      setSaving(false);
    }
  };

  const summary = (row: PromotionCriteria) => [
    row.min_days_in_rank !== null && `${row.min_days_in_rank} nap`,
    row.min_duty_hours !== null && `${row.min_duty_hours} óra`,
    row.min_reports !== null && `${row.min_reports} jelentés`,
    row.exam_ids.length > 0 && `${row.exam_ids.length} vizsga`,
  ].filter(Boolean).join(" · ") || "Nincs feltétel";

  const field = (key: "min_days_in_rank" | "min_duty_hours" | "window_months" | "min_reports" | "max_warnings", label: string, hint: string) => (
    <div className="space-y-1">
      <Label htmlFor={`criteria-${key}`} className="text-xs">{label}</Label>
      <Input id={`criteria-${key}`} inputMode="numeric" disabled={!editable} value={draft[key]} placeholder="Nincs"
             onChange={(event) => setDraft((prev) => ({...prev, [key]: event.target.value.replace(/[^0-9]/g, "")}))}/>
      <p className="text-[11px] text-slate-500">{hint}</p>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Előléptetési feltételek</DialogTitle>
          <DialogDescription>
            {editable ? "Rangonként: mi kell ahhoz, hogy valaki megkapja. Az üres mező nem feltétel." : "Rangonként: mi kell ahhoz, hogy valaki megkapja (az Executive Staff állítja be)."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 grid-cols-1 gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
          <ul className="max-h-72 space-y-0.5 overflow-y-auto pr-1 md:max-h-[420px]">
            {[...ranks].reverse().map((row) => (
              <li key={row.rank}>
                <button type="button" onClick={() => setSelected(row.rank)}
                        className={cn("w-full rounded-lg px-2.5 py-1.5 text-left transition-colors",
                          current?.rank === row.rank ? "bg-primary/15 ring-1 ring-primary/30" : "hover:bg-white/[0.04]")}>
                  <div className="truncate text-xs font-medium text-slate-100">{row.rank}</div>
                  <div className="truncate text-[11px] text-slate-500">{summary(row)}</div>
                </button>
              </li>
            ))}
          </ul>
          {current && (
            <div className="min-w-0 space-y-4">
              <h4 className="text-sm font-semibold text-white">Előléptetés erre: <span className="text-primary">{current.rank}</span></h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {field("min_days_in_rank", "Idő az előző rangban (nap)", "Az utolsó előléptetés óta.")}
                {field("min_duty_hours", "Duty idő (óra / hónap)", "A rögzített havi idő átlaga.")}
                {field("window_months", "Időszak (hónap, 1–3)", "Ennyi lezárt hónapot néz.")}
                {field("min_reports", "Jelentések", "Az időszak alatt összesen.")}
                {field("max_warnings", "Aktív figyelmeztetés legfeljebb", "0: egy sem lehet.")}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Kötelező vizsgák (legfeljebb öt)</Label>
                <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                  {board.exams.map((exam) => {
                    const on = draft.exam_ids.includes(exam.id);
                    return (
                      <button key={exam.id} type="button" disabled={!editable || (!on && draft.exam_ids.length >= 5)}
                              onClick={() => setDraft((prev) => ({...prev, exam_ids: on ? prev.exam_ids.filter((id) => id !== exam.id) : [...prev.exam_ids, exam.id]}))}
                              className={cn("rounded-md px-2 py-1 text-[11px] ring-1 transition-colors disabled:opacity-50",
                                on ? "bg-primary/15 text-primary ring-primary/30" : "bg-white/[0.03] text-slate-300 ring-white/10 enabled:hover:bg-white/[0.06]")}>
                        {on && <Check className="mr-1 inline size-3"/>}{exam.title}
                      </button>
                    );
                  })}
                  {board.exams.length === 0 && <span className="text-[11px] text-slate-500">Nincs aktív vizsga.</span>}
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="criteria-note" className="text-xs">Megjegyzés</Label>
                <Input id="criteria-note" maxLength={300} disabled={!editable} value={draft.note}
                       onChange={(event) => setDraft((prev) => ({...prev, note: event.target.value}))} placeholder="Például: Command Staff interjú is kell."/>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Bezárás</Button>
          {editable && current && (
            <Button disabled={saving} onClick={() => void save()}>{saving ? <Loader2 className="animate-spin"/> : <Check/>} Mentés: {current.rank}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
