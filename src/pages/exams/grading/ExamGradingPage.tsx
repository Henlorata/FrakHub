import {useCallback, useEffect, useMemo, useState, type CSSProperties} from "react";
import {Link, useNavigate, useParams} from "react-router";
import {toast} from "sonner";
import {
  ArrowLeft, BookOpenCheck, CheckCircle2, ClipboardPaste, EyeOff, Hourglass, Loader2, MessageSquare, Pencil, Play, RotateCcw,
  Trash2, XCircle,
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Switch} from "@/components/ui/switch";
import {Textarea} from "@/components/ui/textarea";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {EmptyState} from "@/components/layout/EmptyState";
import {TONE_CLASSES} from "@/components/layout/PageHeader";
import {useAuth} from "@/context/AuthContext";
import {examApi, FINISH_LABELS, formatDateTime, formatDuration, percentOf, QUESTION_TYPE_LABELS, STATUS_META} from "@/lib/exams";
import {cn, errorMessage} from "@/lib/utils";
import type {ExamSheet, SheetQuestion} from "@/types/exams";
import {CandidateAvatar} from "../components/CandidateAvatar";
import {IntegrityPanel} from "./IntegrityPanel";
import {ScoreRing} from "./ScoreRing";

const RETRY_CHOICES = [0, 1, 12, 24, 72, 168];
const retryLabel = (hours: number) =>
  hours === 0 ? "Azonnal" : hours < 24 ? `${hours} óra múlva` : hours % 24 === 0 ? `${hours / 24} nap múlva` : `${hours} óra múlva`;

type Scores = Record<string, {points: number; comment: string}>;

const initialScores = (sheet: ExamSheet): Scores => Object.fromEntries(sheet.questions.map((question) => {
  // Old sheets were never scored automatically: their choice questions start from the automatic points.
  const auto = sheet.sheet.status === "pending" && question.question_type !== "text" && question.auto_points != null;
  return [question.id, {
    points: auto ? question.auto_points ?? 0 : question.answer?.points ?? 0,
    comment: question.answer?.comment ?? "",
  }];
}));

/** One exam sheet: graders score it and decide, the candidate sees the result (and, if released, the details). */
export function ExamGradingPage() {
  const {submissionId = ""} = useParams();
  const navigate = useNavigate();
  const {supabase} = useAuth();
  const [data, setData] = useState<ExamSheet | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [scores, setScores] = useState<Scores>({});
  const [notes, setNotes] = useState("");
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [retryHours, setRetryHours] = useState(0);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<"passed" | "failed" | null>(null);

  const load = useCallback(async () => {
    try {
      const sheet = await examApi.sheet(submissionId);
      setData(sheet);
      setScores(initialScores(sheet));
      setNotes(sheet.sheet.grading_notes ?? "");
      setFeedbackVisible(sheet.sheet.feedback_visible);
      setRetryHours(sheet.exam.retry_cooldown_hours ?? 0);
      setEditing(false);
    } catch (error) {
      setFailed(errorMessage(error));
    }
  }, [submissionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const numbers = useMemo(() => new Map((data?.questions ?? []).map((question, index) => [question.id, index + 1])), [data]);

  if (failed) {
    return (
      <div className="panel mx-auto w-full max-w-xl">
        <EmptyState icon={EyeOff} title="A vizsgalap nem nyitható meg." description={failed}
                    action={<Button asChild variant="outline"><Link to="/exams"><ArrowLeft/> Vizsgaközpont</Link></Button>}/>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mx-auto w-full max-w-[1500px] space-y-4">
        <div className="skeleton h-36"/>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]"><div className="skeleton h-96"/><div className="skeleton h-96"/></div>
      </div>
    );
  }

  const {viewer, sheet, exam, questions, pages} = data;
  const grader = viewer.grader;
  const decided = sheet.status === "passed" || sheet.status === "failed";
  const canEdit = viewer.can_grade && (sheet.status === "pending" || editing);
  const details = questions.length > 0;
  const total = details ? questions.reduce((sum, question) => sum + (scores[question.id]?.points ?? 0), 0) : sheet.total_score ?? 0;
  const max = details ? questions.reduce((sum, question) => sum + question.points, 0) : sheet.max_score ?? 0;
  const percent = percentOf(total, max);
  const suggestion: "passed" | "failed" = percent >= exam.passing_percentage ? "passed" : "failed";
  const status = STATUS_META[sheet.status];
  const pageNumbers = [...new Set(questions.map((question) => question.page_number))].sort((a, b) => a - b);
  const pageTitle = new Map(pages.map((page) => [page.page_number, page]));
  const duration = sheet.end_time ? Date.parse(sheet.end_time) - Date.parse(sheet.start_time) : null;

  const save = async (decision: "passed" | "failed") => {
    setConfirm(null);
    setSaving(true);
    try {
      await examApi.grade(sheet.id, scores, decision, notes, feedbackVisible, retryHours);
      toast.success(decision === "passed" ? "Sikeresnek jelölve." : "Sikertelennek jelölve.");
      if (sheet.status === "pending") navigate("/exams?tab=grading");
      else await load();
    } catch (error) {
      toast.error("A mentés nem sikerült: " + errorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  const decide = (decision: "passed" | "failed") => (decision === suggestion ? void save(decision) : setConfirm(decision));

  const setTrashed = async (trashed: boolean) => {
    setSaving(true);
    const {error} = await supabase.rpc(trashed ? "exam_submission_trash" : "exam_submission_restore", {_submission_id: sheet.id});
    setSaving(false);
    if (error) {
      toast.error("Hiba: " + errorMessage(error));
      return;
    }
    toast.success(trashed ? "A vizsgalap a lomtárba került." : "A vizsgalap visszaállítva.");
    if (trashed) navigate("/exams?tab=trash");
    else await load();
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5">
      <Link to={grader ? "/exams?tab=grading" : "/exams?tab=history"} className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-white">
        <ArrowLeft className="size-4"/> {grader ? "Javítás" : "Eredményeim"}
      </Link>

      <section className="panel glow-border animate-rise relative overflow-hidden p-5 md:p-6">
        <div className={cn("pointer-events-none absolute -top-20 -right-16 size-64 rounded-full opacity-60 blur-3xl", TONE_CLASSES[status.tone].soft)}/>
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <CandidateAvatar name={sheet.candidate_name} url={sheet.avatar_url} className="size-12"/>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-400 wrap-anywhere">{exam.title}</p>
              <h1 className="text-2xl font-semibold text-white wrap-anywhere">{sheet.candidate_name}</h1>
              <p className="text-xs text-slate-400">
                {sheet.badge_number ? `#${sheet.badge_number} · ` : sheet.user_id ? "" : "Vendég · "}
                Kezdés: {formatDateTime(sheet.start_time)}{duration !== null ? ` · ${formatDuration(duration)}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full px-3 py-1 text-xs font-semibold ring-1", TONE_CLASSES[status.tone].tile)}>{status.label}</span>
            {grader && decided && viewer.can_grade && !editing && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil/> Értékelés módosítása</Button>
            )}
            {viewer.can_trash && !sheet.deleted_at && (
              <Button variant="ghost" size="sm" disabled={saving} onClick={() => void setTrashed(true)} className="text-slate-400 hover:text-red-300"
                      title="Hibás vagy teszt kitöltés: a lomtárba kerül, visszaállítható">
                <Trash2/> Lomtárba
              </Button>
            )}
          </div>
        </div>
      </section>

      {sheet.deleted_at && (
        <div className="animate-rise flex flex-col gap-3 rounded-2xl bg-red-950/30 p-4 ring-1 ring-red-500/30 sm:flex-row sm:items-center">
          <Trash2 className="size-5 shrink-0 text-red-300"/>
          <p className="flex-1 text-sm text-red-100">A lap a lomtárban van ({formatDateTime(sheet.deleted_at)}). A vizsgázó nem látja, és nem számít bele az eredményeibe.</p>
          {viewer.can_trash && <Button size="sm" variant="outline" disabled={saving} onClick={() => void setTrashed(false)}><RotateCcw/> Visszaállítás</Button>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5">
          {sheet.status === "in_progress" && (
            <div className="panel animate-rise flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
              <Hourglass className="size-5 shrink-0 text-sky-300"/>
              <p className="flex-1 text-sm text-slate-200">
                A vizsga még folyamatban van (határidő: {formatDateTime(sheet.deadline)}). {grader ? "A lap a leadás után javítható; addig a mentett válaszokat látod." : ""}
              </p>
              {!grader && <Button asChild size="sm"><Link to={`/exam/public/${sheet.exam_id}`}><Play/> Folytatás</Link></Button>}
            </div>
          )}

          {details ? pageNumbers.map((page) => (
            <div key={page} className="space-y-3">
              {(pageNumbers.length > 1 || pageTitle.get(page)?.title) && (
                <div className="animate-fade px-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{pageNumbers.indexOf(page) + 1}. oldal</p>
                  {pageTitle.get(page)?.title && <p className="text-base font-semibold text-white wrap-anywhere">{pageTitle.get(page)?.title}</p>}
                </div>
              )}
              {questions.filter((question) => question.page_number === page).map((question, index) => (
                <SheetQuestionCard key={question.id} question={question} number={numbers.get(question.id) ?? index + 1} index={index}
                                   grader={grader} editable={canEdit} score={scores[question.id]}
                                   onScore={(patch) => setScores((current) => ({...current, [question.id]: {...current[question.id], ...patch}}))}/>
              ))}
            </div>
          )) : sheet.status !== "in_progress" && (
            <div className="panel">
              <EmptyState icon={EyeOff} title="A részletes eredmény nem nyilvános."
                          description="A javító nem tette közzé a válaszonkénti értékelést. Az összesített eredményt látod."/>
            </div>
          )}

          {!grader && sheet.grading_notes && (
            <section className="panel animate-rise p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><MessageSquare className="size-4 text-yellow-400"/> A javító értékelése</h3>
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-slate-200 wrap-anywhere">{sheet.grading_notes}</p>
              {sheet.graded_by_name && <p className="mt-2 text-xs text-slate-500">{sheet.graded_by_name} · {formatDateTime(sheet.graded_at)}</p>}
            </section>
          )}
        </div>

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:h-fit lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:pr-1">
          <section className="panel animate-rise p-5">
            <div className="flex items-center gap-5">
              <ScoreRing percent={percent} passing={exam.passing_percentage} caption={`határ ${exam.passing_percentage}%`}/>
              <div className="min-w-0 space-y-1">
                <p className="text-2xl font-semibold tabular-nums text-white">{total} <span className="text-base text-slate-500">/ {max} pont</span></p>
                {(grader || decided) && (
                  <p className={cn("text-sm font-medium", (decided ? sheet.status === "passed" : suggestion === "passed") ? "text-emerald-300" : "text-red-300")}>
                    {decided && !canEdit ? status.label : `A pontszám alapján: ${suggestion === "passed" ? "sikeres" : "sikertelen"}`}
                  </p>
                )}
                {sheet.retry_allowed_at && sheet.status === "failed" && (
                  <p className="text-xs text-slate-400">Újra: {formatDateTime(sheet.retry_allowed_at)}</p>
                )}
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-white/5 pt-4 text-xs">
              <dt className="text-slate-500">Leadva</dt><dd className="text-right text-slate-200">{formatDateTime(sheet.end_time)}</dd>
              {sheet.finish_reason && <><dt className="text-slate-500">Lezárás</dt><dd className="text-right text-slate-200">{FINISH_LABELS[sheet.finish_reason]}</dd></>}
              {sheet.graded_at && (
                <>
                  <dt className="text-slate-500">Értékelés</dt>
                  <dd className="text-right text-slate-200">{sheet.graded_by_name ?? "Automatikus"} · {formatDateTime(sheet.graded_at)}</dd>
                </>
              )}
              {grader && sheet.claim_token && <><dt className="text-slate-500">Vizsgakód</dt><dd className="text-right font-mono text-slate-200">{sheet.claim_token}</dd></>}
            </dl>
          </section>

          {canEdit && (
            <section className="panel animate-rise space-y-4 p-5" style={{"--i": 1} as CSSProperties} data-tour="grading-decision">
              <h3 className="text-sm font-semibold text-white">{decided ? "Értékelés módosítása" : "Döntés"}</h3>
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={4000}
                        placeholder="Összegzés a vizsgázónak (nem kötelező)" className="min-h-24"/>
              <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5">
                <span>
                  <span className="block text-sm font-medium text-slate-100">Részletes visszajelzés</span>
                  <span className="block text-xs text-slate-400">A vizsgázó látja a válaszait, a helyes válaszokat és a megjegyzéseidet.</span>
                </span>
                <Switch checked={feedbackVisible} onCheckedChange={setFeedbackVisible}/>
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs text-slate-400">Újrapróbálkozás bukás esetén</span>
                <Select value={String(retryHours)} onValueChange={(value) => setRetryHours(Number(value))}>
                  <SelectTrigger className="w-full"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {[...new Set([...RETRY_CHOICES, exam.retry_cooldown_hours ?? 0])].sort((a, b) => a - b).map((hours) => (
                      <SelectItem key={hours} value={String(hours)}>{retryLabel(hours)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" disabled={saving} onClick={() => decide("failed")}
                        className={cn("h-11 text-red-200 hover:text-red-100", suggestion === "failed" && "ring-2 ring-red-400/40")}>
                  <XCircle/> Sikertelen
                </Button>
                <Button disabled={saving} onClick={() => decide("passed")}
                        className={cn("h-11 bg-emerald-600 text-white hover:bg-emerald-500", suggestion === "passed" && "ring-2 ring-emerald-300/50")}>
                  {saving ? <Loader2 className="animate-spin"/> : <CheckCircle2/>} Sikeres
                </Button>
              </div>
              {editing && <Button variant="ghost" size="sm" className="w-full" onClick={() => void load()}>Mégse</Button>}
            </section>
          )}

          {grader && (
            <IntegrityPanel summary={sheet.integrity} log={sheet.integrity_log} legacyCount={sheet.tab_switch_count} questionNumbers={numbers}/>
          )}

          {grader && details && (
            <section className="panel animate-rise p-5" style={{"--i": 3} as CSSProperties}>
              <h3 className="mb-3 text-sm font-semibold text-white">Kérdések</h3>
              <div className="flex flex-wrap gap-1.5">
                {questions.map((question) => {
                  const points = scores[question.id]?.points ?? 0;
                  const open = question.question_type === "text" && question.points > 0 && sheet.status === "pending" && points === 0;
                  return (
                    <button key={question.id} type="button"
                            onClick={() => document.getElementById(`sheet-question-${question.id}`)?.scrollIntoView({behavior: "smooth", block: "center"})}
                            className={cn("grid size-8 place-items-center rounded-lg text-xs font-semibold ring-1 transition-transform hover:scale-110",
                              question.points === 0 ? "bg-white/[0.03] text-slate-400 ring-white/10"
                                : open ? "bg-amber-500/15 text-amber-200 ring-amber-400/40"
                                  : points >= question.points ? "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30"
                                    : points > 0 ? "bg-sky-500/15 text-sky-200 ring-sky-400/30" : "bg-red-500/15 text-red-200 ring-red-400/30")}>
                      {numbers.get(question.id)}
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] text-slate-500">Sárga: pontozásra vár · zöld: teljes pont · kék: részpont · piros: 0 pont</p>
            </section>
          )}
        </aside>
      </div>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Biztosan {confirm === "passed" ? "sikeresnek" : "sikertelennek"} jelölöd?</AlertDialogTitle>
            <AlertDialogDescription>
              A pontszám {percent}%, a sikeres határ {exam.passing_percentage}%. A döntés eltér attól, amit a pontszám mutat; írd le az okát az összegzésben.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mégse</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirm && void save(confirm)}>Igen, mentés</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface SheetQuestionCardProps {
  question: SheetQuestion;
  number: number;
  index: number;
  grader: boolean;
  editable: boolean;
  score: {points: number; comment: string} | undefined;
  onScore: (patch: Partial<{points: number; comment: string}>) => void;
}

function SheetQuestionCard({question, number, index, grader, editable, score, onScore}: SheetQuestionCardProps) {
  const answer = question.answer;
  const isText = question.question_type === "text";
  const selected = answer?.options ?? [];
  const points = score?.points ?? 0;
  const pasted = answer?.pasted ?? 0;
  const textLength = answer?.text?.length ?? 0;
  const [commentOpen, setCommentOpen] = useState(!!score?.comment);

  return (
    <article id={`sheet-question-${question.id}`} style={{"--i": Math.min(index, 8)} as CSSProperties}
             className="panel animate-rise scroll-mt-24 p-5 md:p-6">
      <header className="flex items-start gap-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-sm font-semibold text-slate-200 ring-1 ring-white/10">{number}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-slate-100 wrap-anywhere">{question.question_text}</p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
            <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-slate-300 ring-1 ring-white/10">{QUESTION_TYPE_LABELS[question.question_type]}</span>
            <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-slate-300 ring-1 ring-white/10">
              {question.points === 0 ? "Nem pontozott" : `${question.points} pont`}
            </span>
          </div>
        </div>
      </header>

      {grader && question.guide && (
        <div className="mt-4 rounded-xl bg-amber-500/[0.07] p-3 ring-1 ring-amber-400/20 md:ml-13">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-300"><BookOpenCheck className="size-3.5"/> Javítási útmutató</p>
          <p className="mt-1 text-sm whitespace-pre-wrap text-amber-50/90 wrap-anywhere">{question.guide}</p>
        </div>
      )}

      <div className="mt-4 space-y-2 md:ml-13">
        {isText ? (
          <>
            <div className="rounded-xl bg-black/25 p-4 text-sm leading-relaxed whitespace-pre-wrap text-slate-100 ring-1 ring-white/5 wrap-anywhere">
              {answer?.text?.trim() ? answer.text : <span className="text-slate-500 italic">Nem érkezett válasz.</span>}
            </div>
            {grader && pasted > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-orange-300">
                <ClipboardPaste className="size-3.5"/>
                Beillesztett szöveg: {pasted} karakter{textLength > 0 ? ` (a válasz kb. ${Math.min(100, Math.round((100 * pasted) / textLength))}%-a)` : ""}
              </p>
            )}
          </>
        ) : (
          <ul className="space-y-1.5">
            {question.options.map((option) => {
              const chosen = selected.includes(option.id);
              // Unscored questions (e.g. "which division?") have no right answer.
              const correct = question.points > 0 ? option.is_correct : undefined;
              return (
                <li key={option.id}
                    className={cn("flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm",
                      chosen && correct ? "bg-emerald-500/10 text-emerald-100 ring-1 ring-emerald-400/40"
                        : chosen && correct === false ? "bg-red-500/10 text-red-100 ring-1 ring-red-400/40"
                          : chosen ? "bg-white/[0.06] text-white ring-1 ring-white/20"
                            : correct ? "border border-dashed border-emerald-400/35 bg-emerald-500/[0.04] text-emerald-200/90"
                              : "bg-white/[0.02] text-slate-400 ring-1 ring-white/5")}>
                  <span className={cn("grid size-5 shrink-0 place-items-center ring-1", question.question_type === "multiple_choice" ? "rounded-md" : "rounded-full",
                    chosen ? "bg-current/20 ring-current" : "ring-white/20")}>
                    {chosen && <span className="size-2 rounded-full bg-current"/>}
                  </span>
                  <span className="min-w-0 flex-1 wrap-anywhere">{option.option_text}</span>
                  {chosen && <span className="text-[11px] font-medium opacity-80">Választott</span>}
                  {!chosen && correct && <span className="text-[11px] font-medium">Helyes válasz</span>}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {(question.points > 0 || (editable && !commentOpen)) && (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/5 pt-4 md:ml-13">
          {question.points > 0 && (editable ? (
            <ScoreControl value={points} max={question.points} onChange={(value) => onScore({points: value})}/>
          ) : (
            <span className="rounded-full bg-white/[0.04] px-3 py-1 text-sm font-semibold tabular-nums text-white ring-1 ring-white/10">{points} / {question.points} pont</span>
          ))}
          {question.points > 0 && !isText && question.auto_points != null && grader && (
            <span className="text-xs text-slate-500">{points === question.auto_points ? "Automatikusan pontozva" : `Automatikus: ${question.auto_points} pont (felülírva)`}</span>
          )}
          {editable && !commentOpen && (
            <button type="button" onClick={() => setCommentOpen(true)} className="ml-auto flex items-center gap-1.5 text-xs text-primary hover:underline">
              <MessageSquare className="size-3.5"/> Megjegyzés
            </button>
          )}
        </div>
      )}

      {editable && commentOpen && (
        <div className="mt-3 md:ml-13">
          <Textarea value={score?.comment ?? ""} onChange={(event) => onScore({comment: event.target.value})} maxLength={2000}
                    placeholder="Megjegyzés a vizsgázónak ehhez a kérdéshez (a részletes visszajelzéssel látja)" className="min-h-16 text-sm"/>
        </div>
      )}
      {!editable && answer?.comment && (
        <div className="mt-3 rounded-xl bg-sky-500/[0.06] p-3 text-sm text-sky-50/90 ring-1 ring-sky-400/20 md:ml-13">
          <p className="mb-0.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sky-300"><MessageSquare className="size-3.5"/> A javító megjegyzése</p>
          <p className="whitespace-pre-wrap wrap-anywhere">{answer.comment}</p>
        </div>
      )}
    </article>
  );
}

/** Points of one question: quick buttons (0, half, full) and an exact value. */
function ScoreControl({value, max, onChange}: {value: number; max: number; onChange: (value: number) => void}) {
  const quick = [...new Set([0, Math.round(max / 2), max])];
  return (
    <div className="flex items-center gap-2">
      <div className="flex rounded-xl bg-white/[0.03] p-0.5 ring-1 ring-white/10">
        {quick.map((option) => (
          <button key={option} type="button" onClick={() => onChange(option)}
                  className={cn("min-w-9 rounded-lg px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors",
                    value === option ? "bg-primary text-primary-foreground" : "text-slate-300 hover:bg-white/5")}>
            {option === max ? `${option} (max)` : option}
          </button>
        ))}
      </div>
      <input type="number" min={0} max={max} value={value} aria-label="Pontszám"
             onChange={(event) => {
               const next = Number.parseInt(event.target.value, 10);
               onChange(Number.isNaN(next) ? 0 : Math.max(0, Math.min(max, next)));
             }}
             className="h-8 w-16 rounded-lg bg-black/30 px-2 text-center text-sm tabular-nums text-white ring-1 ring-white/10 outline-none focus:ring-primary/60"/>
      <span className="text-xs text-slate-500">/ {max}</span>
    </div>
  );
}
