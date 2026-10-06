import type {CSSProperties, ReactNode} from "react";
import {useNavigate} from "react-router";
import {toast} from "sonner";
import {
  Award, BarChart3, CalendarClock, Clock, FileQuestion, Globe, Hourglass, Link as LinkIcon, Lock, PenTool, Percent, Play,
  Shield, Timer, Zap,
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {EmptyState} from "@/components/layout/EmptyState";
import {TONE_CLASSES, type Tone} from "@/components/layout/PageHeader";
import {EXAM_TYPE_LABELS, formatDateTime, formatDuration, HIDDEN_BLOCKS} from "@/lib/exams";
import {canGradeExam, canManageExamAccess, canManageExamContent, cn} from "@/lib/utils";
import type {Profile} from "@/types/supabase";
import type {HubExam} from "@/types/exams";

interface ExamCatalogProps {
  exams: HubExam[];
  profile: Profile;
  /** Server time minus local time (ms). */
  clockOffset: number;
  onManageAccess: (exam: HubExam) => void;
}

const manages = (profile: Profile, exam: HubExam) => canManageExamContent(profile, exam) || canManageExamAccess(profile, exam);

/** Order: open attempts, exams to take, then the rest. */
const rank = (exam: HubExam) => (exam.open_attempt ? 0 : !exam.block ? 1 : exam.block.code === "passed" ? 3 : 2);

/** The exams a member can take (or manages), as cards with their state and actions. */
export function ExamCatalog({exams, profile, clockOffset, onManageAccess}: ExamCatalogProps) {
  const shown = exams
    .filter((exam) => exam.open_attempt || !exam.block || !HIDDEN_BLOCKS.has(exam.block.code) || manages(profile, exam))
    .sort((a, b) => rank(a) - rank(b));

  if (!shown.length) {
    return (
      <div className="panel">
        <EmptyState icon={FileQuestion} title="Most nincs elérhető vizsga."
                    description="A meghívásos vizsgákhoz egy oktató ad hozzáférést; ilyenkor értesítést kapsz."/>
      </div>
    );
  }
  return (
    <div data-tour="exam-catalog" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {shown.map((exam, index) => (
        <ExamCard key={exam.id} exam={exam} profile={profile} index={index} clockOffset={clockOffset} onManageAccess={onManageAccess}/>
      ))}
    </div>
  );
}

function stateOf(exam: HubExam): {tone: Tone; label: string} {
  if (exam.open_attempt) return {tone: "blue", label: "Folyamatban"};
  if (!exam.is_active) return {tone: "red", label: "Inaktív"};
  switch (exam.block?.code) {
    case undefined:
      return {tone: "gold", label: "Elérhető"};
    case "passed":
      return {tone: "emerald", label: "Teljesítve"};
    case "pending":
      return {tone: "violet", label: "Javításra vár"};
    case "cooldown":
      return {tone: "orange", label: "Várakozás"};
    case "invitation":
      return {tone: "slate", label: "Meghívásos"};
    default:
      return {tone: "slate", label: "Nem elérhető"};
  }
}

function ExamCard({exam, profile, index, clockOffset, onManageAccess}: {
  exam: HubExam; profile: Profile; index: number; clockOffset: number; onManageAccess: (exam: HubExam) => void;
}) {
  const navigate = useNavigate();
  const canEdit = canManageExamContent(profile, exam);
  const canAccess = canManageExamAccess(profile, exam);
  const canShare = canGradeExam(profile, exam) && exam.allow_sharing;
  const state = stateOf(exam);
  const tone = TONE_CLASSES[state.tone];
  const block = exam.block;
  const open = () => navigate(`/exam/public/${exam.id}`);
  const left = exam.open_attempt ? Date.parse(exam.open_attempt.deadline) - (Date.now() + clockOffset) : 0;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/exam/public/${exam.id}`);
      toast.success("Link másolva.");
    } catch {
      toast.error("A link másolása nem sikerült.");
    }
  };

  let action: ReactNode;
  if (exam.open_attempt) {
    action = <Button className="flex-1" onClick={open}><Play/> Folytatás · {formatDuration(Math.max(0, left))}</Button>;
  } else if (!block) {
    action = <Button className="flex-1" onClick={open}><Play/> Megnyitás</Button>;
  } else if (block.code === "passed" && exam.last) {
    action = <Button variant="outline" className="flex-1" onClick={() => navigate(`/exams/grading/${exam.last?.id}`)}><Award/> Eredmény</Button>;
  } else {
    const Icon = block.code === "cooldown" ? Clock : block.code === "pending" ? Hourglass : block.code === "days" ? CalendarClock : Lock;
    action = (
      <Button variant="outline" disabled className="flex-1 justify-start overflow-hidden" title={block.message}>
        <Icon/> <span className="truncate">
          {block.code === "cooldown" && block.until ? `Újra: ${formatDateTime(block.until)}`
            : block.code === "days" && block.until ? `Elérhető: ${formatDateTime(block.until).slice(0, 11)}`
              : block.code === "pending" ? "Javításra vár"
                : block.code === "invitation" ? "Meghívás szükséges" : "Nem elérhető"}
        </span>
      </Button>
    );
  }

  return (
    <article style={{"--i": Math.min(index, 10)} as CSSProperties}
             className="panel lift animate-rise group relative flex min-w-0 flex-col overflow-hidden">
      <div className={cn("absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r opacity-80", tone.gradient)}/>
      <div className={cn("pointer-events-none absolute -top-14 -right-14 size-36 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-70", tone.soft)}/>
      <div className="relative flex-1 space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
          <span className={cn("rounded-full px-2 py-0.5 ring-1", tone.tile)}>{state.label}</span>
          <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-slate-300 ring-1 ring-white/10">{EXAM_TYPE_LABELS[exam.type]}</span>
          {exam.division && <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-slate-300 ring-1 ring-white/10">{exam.division}</span>}
          {exam.is_public && <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-sky-300 ring-1 ring-sky-500/25"><Globe className="size-3"/> Nyilvános</span>}
          {exam.is_invitation_only && <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-violet-300 ring-1 ring-violet-500/25"><Lock className="size-3"/> Meghívásos</span>}
        </div>
        <h3 className="line-clamp-2 text-lg leading-snug font-semibold text-white transition-colors wrap-anywhere group-hover:text-yellow-100">{exam.title}</h3>
        {exam.description && <p className="line-clamp-2 text-sm text-slate-400 wrap-anywhere">{exam.description}</p>}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
          <Fact icon={Timer}>{exam.time_limit_minutes} perc</Fact>
          <Fact icon={FileQuestion}>{exam.question_count} kérdés</Fact>
          <Fact icon={Percent}>{exam.passing_percentage}%</Fact>
          {exam.auto_grade && <Fact icon={Zap}>Azonnali eredmény</Fact>}
        </div>
        {exam.last && exam.last.status !== "pending" && !exam.open_attempt && (
          <p className="text-xs text-slate-500">
            Legutóbb: <span className={exam.last.status === "passed" ? "text-emerald-300" : exam.last.status === "failed" ? "text-red-300" : "text-slate-300"}>
              {exam.last.status === "passed" ? "sikeres" : exam.last.status === "failed" ? "sikertelen" : "leadva"}
              {exam.last.percentage != null ? ` (${exam.last.percentage}%)` : ""}
            </span> · {formatDateTime(exam.last.end_time)}
          </p>
        )}
      </div>
      <footer className="relative flex items-center gap-2 border-t border-white/5 p-3">
        {action}
        {canEdit && (
          <Button variant="ghost" size="icon" title="Szerkesztés" aria-label="Szerkesztés" onClick={() => navigate(`/exams/editor/${exam.id}`)}>
            <PenTool/>
          </Button>
        )}
        {canEdit && (
          <Button variant="ghost" size="icon" title="Statisztika" aria-label="Statisztika" onClick={() => navigate(`/exams/editor/${exam.id}?tab=stats`)}>
            <BarChart3/>
          </Button>
        )}
        {canAccess && (
          <Button variant="ghost" size="icon" title="Hozzáférések" aria-label="Hozzáférések" onClick={() => onManageAccess(exam)}>
            <Shield/>
          </Button>
        )}
        {canShare && (
          <Button variant="ghost" size="icon" title="Link másolása" aria-label="Link másolása" onClick={() => void copyLink()}>
            <LinkIcon/>
          </Button>
        )}
      </footer>
    </article>
  );
}

function Fact({icon: Icon, children}: {icon: typeof Timer; children: ReactNode}) {
  return <span className="inline-flex items-center gap-1.5"><Icon className="size-3.5 text-slate-500"/>{children}</span>;
}
