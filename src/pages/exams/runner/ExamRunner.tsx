import {useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ClipboardEvent, type DragEvent} from "react";
import {toast} from "sonner";
import {
  AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Cloud, CloudOff, ListChecks, Loader2, Send, ShieldCheck,
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {SheriffStar} from "@/components/brand/SheriffStar";
import {
  clearActiveAttempt, examApi, forgetAnswerBackup, formatDuration, isAnswered, loadAnswerBackup, saveProgressOnExit,
  setActiveAttempt, storeAnswerBackup, type DraftAnswer,
} from "@/lib/exams";
import {cn, errorMessage} from "@/lib/utils";
import type {AttemptPayload, AttemptStateReply, SheetQuestion} from "@/types/exams";
import {ExamTimer} from "./ExamTimer";
import {QuestionView} from "./QuestionView";
import {useIntegrityMonitor} from "./useIntegrityMonitor";

/** A save waits this long after the last change, and never longer than MAX_WAIT after the first. */
const SAVE_DELAY = 4000;
const MAX_WAIT = 20000;
/** Events alone (no answer change) are sent a little later. */
const EVENT_DELAY = 10000;

type SaveStatus = "idle" | "saving" | "saved" | "error" | "offline";

interface ExamRunnerProps {
  payload: AttemptPayload;
  /** Server time minus local time (ms). */
  clockOffset: number;
  /** Guests prove the attempt is theirs with this secret; members do not need it. */
  secret: string | null;
  accessToken: string | null;
  owner: string;
  candidateName: string;
  onFinished: (reply: AttemptStateReply) => void;
}

const initialAnswers = (questions: SheetQuestion[], attemptId: string) => {
  const answers: Record<string, DraftAnswer> = {};
  questions.forEach((question) => {
    if (question.answer) {
      answers[question.id] = {
        text: question.answer.text ?? undefined,
        options: question.answer.options ?? [],
        pasted: question.answer.pasted ?? 0,
      };
    }
  });
  // Answers this browser could not save yet (lost connection, closed tab) win over the server copy.
  const backup = loadAnswerBackup(attemptId);
  const dirty = new Set<string>();
  if (backup) {
    backup.dirty.forEach((id) => {
      if (backup.answers[id] && questions.some((question) => question.id === id)) {
        answers[id] = backup.answers[id];
        dirty.add(id);
      }
    });
  }
  return {answers, dirty};
};

/** The running exam: one page of questions at a time, autosave, server clock, review and hand-in. */
export function ExamRunner({payload, clockOffset, secret, accessToken, owner, candidateName, onFinished}: ExamRunnerProps) {
  const {attempt, exam, questions} = payload;
  const attemptId = attempt.id;
  const deadline = Date.parse(attempt.deadline ?? payload.server_now);
  const startedAt = Date.parse(attempt.started_at ?? payload.server_now);

  // The server's clock (the difference was measured when the attempt arrived).
  const now = useCallback(() => Date.now() + clockOffset, [clockOffset]);

  const pages = useMemo(() => [...new Set(questions.map((question) => question.page_number))].sort((a, b) => a - b), [questions]);
  const pageMeta = useMemo(() => new Map(payload.pages.map((page) => [page.page_number, page])), [payload.pages]);
  const numbers = useMemo(() => new Map(questions.map((question, index) => [question.id, index + 1])), [questions]);

  const initial = useMemo(() => initialAnswers(questions, attemptId), [questions, attemptId]);
  const [answers, setAnswers] = useState(initial.answers);
  const answersRef = useRef(answers);
  const dirty = useRef(new Map<string, number>([...initial.dirty].map((id) => [id, 1])));
  const versions = useRef(new Map<string, number>());

  const [pageIndex, setPageIndex] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [finishing, setFinishing] = useState<false | "manual" | "time_up">(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(initial.dirty.size ? "idle" : "saved");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [blockedHint, setBlockedHint] = useState(false);

  const timer = useRef<number | null>(null);
  const firstDirtyAt = useRef<number | null>(initial.dirty.size ? Date.now() : null);
  const saving = useRef(false);
  const queued = useRef(false);
  const failures = useRef(0);
  const done = useRef(false);
  const flushRef = useRef<() => Promise<void>>(async () => undefined);

  const currentPage = pages[pageIndex] ?? 1;
  const pageQuestions = questions.filter((question) => question.page_number === currentPage);
  const answeredCount = questions.filter((question) => isAnswered(question.question_type, answers[question.id])).length;
  const missingRequired = questions.filter((question) => question.is_required && !isAnswered(question.question_type, answers[question.id]));

  const schedule = useCallback((delay?: number) => {
    if (done.current) return;
    if (timer.current !== null) window.clearTimeout(timer.current);
    const waited = firstDirtyAt.current === null ? 0 : Date.now() - firstDirtyAt.current;
    const wait = delay ?? Math.max(0, Math.min(SAVE_DELAY, MAX_WAIT - waited));
    timer.current = window.setTimeout(() => {
      timer.current = null;
      void flushRef.current();
    }, wait);
  }, []);

  const onIntegrityEvent = useCallback(() => {
    if (timer.current === null) schedule(EVENT_DELAY);
  }, [schedule]);
  const onBlocked = useCallback(() => {
    setBlockedHint(true);
    window.setTimeout(() => setBlockedHint(false), 4000);
  }, []);
  const {onPaste: logPaste, onCopy, onContextMenu, take, putBack, stats} = useIntegrityMonitor({
    startedAt, now, page: currentPage, blockClipboard: exam.block_clipboard, onEvent: onIntegrityEvent, onBlocked,
  });

  const backupTimer = useRef<number | null>(null);
  const writeBackup = useCallback(() => {
    storeAnswerBackup(attemptId, {answers: answersRef.current, dirty: [...dirty.current.keys()]});
  }, [attemptId]);
  // While typing, the local copy is written at most every 800 ms.
  const writeBackupSoon = useCallback(() => {
    if (backupTimer.current !== null) return;
    backupTimer.current = window.setTimeout(() => {
      backupTimer.current = null;
      if (!done.current) writeBackup();
    }, 800);
  }, [writeBackup]);

  const finishWith = useCallback((reply: AttemptStateReply) => {
    done.current = true;
    if (timer.current !== null) window.clearTimeout(timer.current);
    forgetAnswerBackup(attemptId);
    clearActiveAttempt(exam.id);
    onFinished(reply);
  }, [attemptId, exam.id, onFinished]);

  const flush = useCallback(async () => {
    if (done.current) return;
    if (saving.current) {
      queued.current = true;
      return;
    }
    const ids = [...dirty.current.keys()];
    const events = take();
    if (!ids.length && !events.length) return;
    const sentVersions = new Map(ids.map((id) => [id, versions.current.get(id) ?? 0]));
    const body = Object.fromEntries(ids.map((id) => [id, answersRef.current[id] ?? {}]));
    saving.current = true;
    setSaveStatus("saving");
    try {
      const reply = await examApi.save(attemptId, body, events, secret);
      failures.current = 0;
      sentVersions.forEach((version, id) => {
        if ((versions.current.get(id) ?? 0) === version) dirty.current.delete(id);
      });
      if (!dirty.current.size) firstDirtyAt.current = null;
      writeBackup();
      setSaveStatus("saved");
      setSavedAt(Date.now());
      if (reply.finished) finishWith(reply);
    } catch (error) {
      console.error("Exam autosave failed:", error);
      putBack(events);
      failures.current += 1;
      setSaveStatus(navigator.onLine ? "error" : "offline");
      schedule(Math.min(60_000, 5000 * 2 ** (failures.current - 1)));
    } finally {
      saving.current = false;
      if (queued.current && !done.current) {
        queued.current = false;
        schedule(1000);
      }
    }
  }, [attemptId, secret, take, putBack, writeBackup, finishWith, schedule]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  // The chip on other pages ("your exam is still running") and a save of restored answers.
  useEffect(() => {
    setActiveAttempt({examId: exam.id, title: exam.title, deadline: attempt.deadline ?? "", owner});
    if (dirty.current.size) schedule(500);
  }, [exam.id, exam.title, attempt.deadline, owner, schedule]);

  // Save when the tab is hidden; a last keepalive request when the page is closed.
  useEffect(() => {
    const hidden = () => {
      if (document.visibilityState === "hidden") void flushRef.current();
    };
    const leaving = () => {
      if (done.current) return;
      const ids = [...dirty.current.keys()];
      saveProgressOnExit(accessToken, attemptId, Object.fromEntries(ids.map((id) => [id, answersRef.current[id] ?? {}])), take(), secret);
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", leaving);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", leaving);
    };
  }, [accessToken, attemptId, secret, take]);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    if (backupTimer.current !== null) window.clearTimeout(backupTimer.current);
  }, []);

  // The ref is the source of truth (saves read it); the state only renders it.
  const change = useCallback((questionId: string, patch: DraftAnswer) => {
    const next = {...answersRef.current, [questionId]: {...answersRef.current[questionId], ...patch}};
    answersRef.current = next;
    setAnswers(next);
    versions.current.set(questionId, (versions.current.get(questionId) ?? 0) + 1);
    dirty.current.set(questionId, versions.current.get(questionId) ?? 1);
    if (firstDirtyAt.current === null) firstDirtyAt.current = Date.now();
    setSaveStatus((status) => (status === "saving" ? status : "idle"));
    writeBackupSoon();
    schedule();
  }, [schedule, writeBackupSoon]);

  const clipboard = useMemo(() => ({
    onPaste: (event: ClipboardEvent<HTMLTextAreaElement> | DragEvent<HTMLTextAreaElement>, questionId: string) => {
      const pasted = logPaste(event, questionId);
      if (pasted > 0) change(questionId, {pasted: (answersRef.current[questionId]?.pasted ?? 0) + pasted});
    },
    onCopy,
    onContextMenu,
  }), [logPaste, onCopy, onContextMenu, change]);

  const goTo = (index: number, questionId?: string) => {
    void flush();
    setReviewing(false);
    setPageIndex(index);
    window.requestAnimationFrame(() => {
      if (questionId) document.getElementById(`question-${questionId}`)?.scrollIntoView({behavior: "smooth", block: "center"});
      else window.scrollTo({top: 0, behavior: "smooth"});
    });
  };

  const finish = useCallback(async (timeUp: boolean) => {
    if (done.current) return;
    if (timer.current !== null) window.clearTimeout(timer.current);
    setFinishing(timeUp ? "time_up" : "manual");
    const events = take();
    try {
      const reply = await examApi.finish(attemptId, answersRef.current, events, secret);
      if (!reply.finished) {
        // Saved, but required questions are still open (the client check and the server disagree).
        dirty.current.clear();
        setFinishing(false);
        setReviewing(true);
        setShowMissing(true);
        toast.error(`Még ${reply.missing ?? 1} kötelező kérdés vár válaszra.`);
        return;
      }
      finishWith(reply);
    } catch (error) {
      putBack(events);
      if (timeUp) {
        // The server still accepts the answers for a short while after the deadline.
        window.setTimeout(() => void finish(true), 4000);
        return;
      }
      setFinishing(false);
      toast.error("A leadás nem sikerült: " + errorMessage(error));
    }
  }, [attemptId, secret, take, putBack, finishWith]);

  const requestFinish = () => {
    if (missingRequired.length) {
      setReviewing(true);
      setShowMissing(true);
      window.scrollTo({top: 0, behavior: "smooth"});
      return;
    }
    setConfirmOpen(true);
  };

  const onExpire = useCallback(() => void finish(true), [finish]);
  const onWarning = useCallback((minutes: 5 | 1) => {
    toast.info(minutes === 5 ? "Még 5 perc van hátra." : "Még 1 perc van hátra: az idő végén a lap automatikusan leadódik.");
  }, []);

  const unanswered = questions.length - answeredCount;
  const meta = pageMeta.get(currentPage);

  return (
    <div className="relative min-h-dvh pb-16">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#050912]/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <SheriffStar className="size-8 shrink-0"/>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{exam.title}</p>
            <p className="truncate text-[11px] text-slate-400">{candidateName}</p>
          </div>
          <SaveIndicator status={saveStatus} savedAt={savedAt}/>
          <IntegrityInfo stats={stats} blockClipboard={exam.block_clipboard}/>
          <ExamTimer deadline={deadline} totalMs={deadline - startedAt} now={now} onExpire={onExpire} onWarning={onWarning}/>
        </div>
        <div className="h-0.5 bg-white/5">
          <div className="h-full bg-gradient-to-r from-amber-400 to-yellow-200 transition-[width] duration-700"
               style={{width: `${questions.length ? (100 * answeredCount) / questions.length : 0}%`}}/>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 pt-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <section className="min-w-0 space-y-4">
          <Navigator className="lg:hidden" pages={pages} questions={questions} answers={answers} current={reviewing ? null : currentPage}
                     numbers={numbers} onJump={goTo} onReview={() => setReviewing(true)} showMissing={showMissing}/>

          {reviewing ? (
            <ReviewPanel questions={questions} answers={answers} numbers={numbers} pages={pages} showMissing={showMissing}
                         onJump={goTo} onFinish={requestFinish} missing={missingRequired.length}/>
          ) : (
            <>
              <div key={`intro-${currentPage}`} className="animate-fade flex flex-wrap items-end justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-400/90">
                    {pages.length > 1 ? `${pageIndex + 1}. oldal / ${pages.length}` : "Kérdések"}
                  </p>
                  {meta?.title && <h2 className="text-xl font-semibold text-white wrap-anywhere">{meta.title}</h2>}
                  {meta?.description && <p className="mt-1 max-w-2xl text-sm whitespace-pre-wrap text-slate-400 wrap-anywhere">{meta.description}</p>}
                </div>
                <p className="text-xs text-slate-500">{answeredCount} / {questions.length} megválaszolva</p>
              </div>

              <div key={`page-${currentPage}`} className="space-y-4">
                {pageQuestions.map((question, index) => (
                  <QuestionView key={question.id} index={index} question={question} number={numbers.get(question.id) ?? index + 1}
                                answer={answers[question.id]} onChange={(patch) => change(question.id, patch)}
                                clipboard={clipboard} blockClipboard={exam.block_clipboard}
                                missing={showMissing && question.is_required && !isAnswered(question.question_type, answers[question.id])}/>
                ))}
              </div>

              <nav className="flex flex-wrap items-center justify-between gap-3 pt-2">
                {pages.length > 1 ? (
                  <Button variant="outline" disabled={pageIndex === 0} onClick={() => goTo(pageIndex - 1)}>
                    <ArrowLeft/> Előző oldal
                  </Button>
                ) : <span/>}
                {pageIndex < pages.length - 1 ? (
                  <Button onClick={() => goTo(pageIndex + 1)}>Következő oldal <ArrowRight/></Button>
                ) : (
                  <Button onClick={() => {
                    void flush();
                    setReviewing(true);
                    window.scrollTo({top: 0, behavior: "smooth"});
                  }}>
                    <ListChecks/> Áttekintés és leadás
                  </Button>
                )}
              </nav>
            </>
          )}
        </section>

        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-3">
            <Navigator pages={pages} questions={questions} answers={answers} current={reviewing ? null : currentPage}
                       numbers={numbers} onJump={goTo} onReview={() => setReviewing(true)} showMissing={showMissing}/>
            <Button className="w-full" variant={reviewing ? "default" : "outline"} onClick={reviewing ? requestFinish : () => setReviewing(true)}>
              <Send/> {reviewing ? "Vizsga leadása" : "Áttekintés és leadás"}
            </Button>
          </div>
        </aside>
      </main>

      {blockedHint && (
        <div className="animate-rise fixed inset-x-0 bottom-6 z-40 mx-auto w-fit max-w-[90vw] rounded-full bg-slate-900/95 px-4 py-2 text-xs text-slate-200 shadow-xl ring-1 ring-white/10">
          Ebben a vizsgában a másolás és a beillesztés ki van kapcsolva.
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leadod a vizsgát?</AlertDialogTitle>
            <AlertDialogDescription>
              {unanswered > 0
                ? `${unanswered} nem kötelező kérdés megválaszolatlan. Leadás után a válaszokon már nem változtathatsz.`
                : "Minden kérdésre válaszoltál. Leadás után a válaszokon már nem változtathatsz."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Még átnézem</AlertDialogCancel>
            <AlertDialogAction onClick={() => void finish(false)}><Send/> Leadás</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {finishing && (
        <div className="animate-fade fixed inset-0 z-50 grid place-items-center bg-[#03060c]/80 p-4 backdrop-blur-md">
          <div className="panel animate-pop flex max-w-sm flex-col items-center gap-4 p-8 text-center">
            <Loader2 className="size-10 animate-spin text-primary"/>
            <div>
              <p className="text-lg font-semibold text-white">{finishing === "time_up" ? "Lejárt az idő" : "Leadás folyamatban"}</p>
              <p className="mt-1 text-sm text-slate-400">
                {finishing === "time_up" ? "A válaszaidat most adjuk le, ahogy vannak." : "A válaszaidat elküldjük a javítóknak."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SaveIndicator({status, savedAt}: {status: SaveStatus; savedAt: number | null}) {
  const time = savedAt ? new Date(savedAt).toLocaleTimeString("hu-HU", {hour: "2-digit", minute: "2-digit"}) : null;
  const content = {
    idle: {icon: Cloud, text: "Változás…", tone: "text-slate-400"},
    saving: {icon: Loader2, text: "Mentés…", tone: "text-slate-300"},
    saved: {icon: CheckCircle2, text: time ? `Mentve ${time}` : "Mentve", tone: "text-emerald-300"},
    error: {icon: AlertTriangle, text: "Mentési hiba, újrapróbáljuk", tone: "text-amber-300"},
    offline: {icon: CloudOff, text: "Nincs kapcsolat; a válaszok itt megmaradnak", tone: "text-amber-300"},
  }[status];
  const Icon = content.icon;
  return (
    <span role="status" className={cn("hidden items-center gap-1.5 text-xs sm:flex", content.tone)} title={content.text}>
      <Icon className={cn("size-4", status === "saving" && "animate-spin")}/>
      <span className="hidden max-w-[14rem] truncate md:inline">{content.text}</span>
    </span>
  );
}

function IntegrityInfo({stats, blockClipboard}: {stats: ReturnType<typeof useIntegrityMonitor>["stats"]; blockClipboard: boolean}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Mit lát a javító?"
                className="grid size-9 place-items-center rounded-full text-slate-400 ring-1 ring-white/10 transition-colors hover:bg-white/5 hover:text-slate-200">
          <ShieldCheck className="size-4"/>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3 text-sm">
        <p className="font-semibold text-white">Mit lát a javító?</p>
        <ul className="list-disc space-y-1 pl-4 text-xs text-slate-300">
          <li>ha elhagyod a vizsga oldalát (másik lap vagy ablak), és mennyi időre;</li>
          <li>ha szöveget illesztesz be egy válaszba, vagy a kérdésekből másolsz;</li>
          <li>ha megszakad a kapcsolat, vagy újranyitod a vizsgát.</li>
        </ul>
        <p className="text-xs text-slate-400">Ezek tények, nem ítéletek: a döntést a javító hozza meg.{blockClipboard && " Ebben a vizsgában a másolás és a beillesztés ki van kapcsolva."}</p>
        <div className="rounded-lg bg-white/[0.03] p-3 text-xs text-slate-300 ring-1 ring-white/5">
          <p className="mb-1 font-medium text-slate-200">Ebben a munkamenetben</p>
          <p>Távollét: {stats.awayCount ? `${stats.awayCount}× (${formatDuration(stats.awayMs)})` : "nincs"}</p>
          <p>Beillesztés: {stats.pasteCount ? `${stats.pasteCount}× (${stats.pasteChars} karakter)` : "nincs"}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface NavigatorProps {
  pages: number[];
  questions: SheetQuestion[];
  answers: Record<string, DraftAnswer>;
  numbers: Map<string, number>;
  current: number | null;
  showMissing: boolean;
  onJump: (pageIndex: number, questionId?: string) => void;
  onReview: () => void;
  className?: string;
}

/** Question numbers by page: answered, open, and (after a hand-in attempt) missing ones. */
function Navigator({pages, questions, answers, numbers, current, showMissing, onJump, onReview, className}: NavigatorProps) {
  return (
    <div className={cn("panel p-4", className)}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Kérdések</p>
        <button type="button" onClick={onReview} className="text-xs text-primary hover:underline">Áttekintés</button>
      </div>
      <div className="space-y-3">
        {pages.map((page, pageIndex) => (
          <div key={page}>
            {pages.length > 1 && <p className="mb-1.5 text-[10px] uppercase tracking-wider text-slate-500">{pageIndex + 1}. oldal</p>}
            <div className="flex flex-wrap gap-1.5">
              {questions.filter((question) => question.page_number === page).map((question) => {
                const answered = isAnswered(question.question_type, answers[question.id]);
                const missing = showMissing && question.is_required && !answered;
                return (
                  <button key={question.id} type="button" onClick={() => onJump(pageIndex, question.id)}
                          aria-label={`${numbers.get(question.id)}. kérdés${answered ? ", megválaszolva" : ""}`}
                          className={cn("grid size-8 place-items-center rounded-lg text-xs font-semibold tabular-nums ring-1 transition-all duration-200",
                            answered ? "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30"
                              : missing ? "bg-amber-500/15 text-amber-200 ring-amber-400/50"
                                : "bg-white/[0.03] text-slate-400 ring-white/10 hover:text-slate-200",
                            current === page && "ring-2 ring-primary/60")}>
                    {numbers.get(question.id)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ReviewPanelProps {
  questions: SheetQuestion[];
  answers: Record<string, DraftAnswer>;
  numbers: Map<string, number>;
  pages: number[];
  showMissing: boolean;
  missing: number;
  onJump: (pageIndex: number, questionId?: string) => void;
  onFinish: () => void;
}

function ReviewPanel({questions, answers, numbers, pages, showMissing, missing, onJump, onFinish}: ReviewPanelProps) {
  return (
    <div className="panel animate-rise overflow-hidden">
      <div className="border-b border-white/5 p-5">
        <h2 className="text-lg font-semibold text-white">Áttekintés</h2>
        <p className="mt-1 text-sm text-slate-400">
          {missing > 0
            ? `${missing} kötelező kérdés még válaszra vár. Kattints rá, és pótold.`
            : "Minden kötelező kérdésre válaszoltál. Átnézheted a válaszaidat, aztán leadhatod a vizsgát."}
        </p>
      </div>
      <ul className="divide-y divide-white/5">
        {questions.map((question, index) => {
          const answer = answers[question.id];
          const answered = isAnswered(question.question_type, answer);
          const isMissing = question.is_required && !answered;
          const preview = question.question_type === "text"
            ? answer?.text?.trim()
            : question.options.filter((option) => answer?.options?.includes(option.id)).map((option) => option.option_text).join(", ");
          return (
            <li key={question.id} style={{"--i": Math.min(index, 12)} as CSSProperties} className="animate-fade">
              <button type="button" onClick={() => onJump(pages.indexOf(question.page_number), question.id)}
                      className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-white/[0.03]">
                <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg text-xs font-semibold ring-1",
                  answered ? "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30"
                    : isMissing && showMissing ? "bg-amber-500/15 text-amber-200 ring-amber-400/50" : "bg-white/[0.03] text-slate-400 ring-white/10")}>
                  {numbers.get(question.id)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 text-sm text-slate-200 wrap-anywhere">{question.question_text}</span>
                  <span className={cn("mt-0.5 line-clamp-1 text-xs wrap-anywhere", answered ? "text-slate-400" : isMissing ? "text-amber-300" : "text-slate-500")}>
                    {answered ? preview : isMissing ? "Kötelező, még nincs válasz" : "Nincs válasz (nem kötelező)"}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex justify-end border-t border-white/5 p-4">
        <Button onClick={onFinish}><Send/> Vizsga leadása</Button>
      </div>
    </div>
  );
}
