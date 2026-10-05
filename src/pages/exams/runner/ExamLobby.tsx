import {useState, type CSSProperties, type ReactNode} from "react";
import {Link} from "react-router";
import {
  Award, CalendarClock, Clock, Cloud, Eye, FileQuestion, Hourglass, Layers, Lock, LogIn, PauseCircle, Percent, Play,
  RotateCcw, Shuffle, ShieldCheck, Sparkles, Timer, UserRound, Zap,
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {SheriffStar} from "@/components/brand/SheriffStar";
import {EXAM_TYPE_LABELS, formatDateTime, STATUS_META} from "@/lib/exams";
import {cn} from "@/lib/utils";
import type {AttemptInfo, ExamBlockCode, ExamIntro} from "@/types/exams";
import {ClaimCode} from "./ExamDone";

const BLOCK_ICONS: Partial<Record<ExamBlockCode, typeof Lock>> = {
  cooldown: Clock, pending: Hourglass, passed: Award, invitation: Lock, days: CalendarClock, inactive: PauseCircle, login: LogIn,
};

interface ExamLobbyProps {
  intro: ExamIntro;
  /** A guest's sheet handed in from this browser. */
  guestFinished: AttemptInfo | null;
  starting: boolean;
  onStart: (applicantName: string | null) => void;
  onNewGuestAttempt: () => void;
}

/** The exam's start page: what to expect, how it works, and the start button. */
export function ExamLobby({intro, guestFinished, starting, onStart, onNewGuestAttempt}: ExamLobbyProps) {
  const {exam, viewer, block, last} = intro;
  const [name, setName] = useState("");
  const needsName = !viewer.name;
  const nameOk = name.trim().replace(/\s+/g, " ").length >= 3;
  const BlockIcon = block ? BLOCK_ICONS[block.code] ?? Lock : Lock;
  const backTo = viewer.member ? "/exams" : "/login";

  const facts: {icon: typeof Clock; label: string; value: ReactNode}[] = [
    {icon: Timer, label: "Időkorlát", value: `${exam.time_limit_minutes} perc`},
    {icon: FileQuestion, label: "Kérdések", value: `${exam.question_count} db${exam.page_count > 1 ? ` · ${exam.page_count} oldal` : ""}`},
    {icon: Percent, label: "Sikeres határ", value: `${exam.passing_percentage}%`},
    {icon: exam.auto_grade ? Zap : UserRound, label: "Értékelés", value: exam.auto_grade ? "Azonnali" : "Oktató javítja"},
  ];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-10 md:py-16">
      <Link to={backTo} className="text-sm text-slate-400 transition-colors hover:text-white">
        ← {viewer.member ? "Vizsgaközpont" : "Bejelentkezés"}
      </Link>

      <section className="panel glow-border animate-rise relative overflow-hidden p-6 md:p-8">
        <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-yellow-500/10 blur-3xl"/>
        <div className="relative flex items-start gap-5">
          <SheriffStar className="hidden size-16 shrink-0 drop-shadow-[0_0_24px_rgb(234_179_8/0.35)] sm:block"/>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-yellow-400">
              {EXAM_TYPE_LABELS[exam.type]}{exam.division ? ` · ${exam.division}` : ""}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white wrap-anywhere md:text-3xl">{exam.title}</h1>
            {exam.description && <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-slate-300 wrap-anywhere">{exam.description}</p>}
          </div>
        </div>
        <div className="relative mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {facts.map(({icon: Icon, label, value}, index) => (
            <div key={label} style={{"--i": index + 1} as CSSProperties}
                 className="animate-rise rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5">
              <Icon className="size-4 text-yellow-400/80"/>
              <p className="mt-2 text-[11px] text-slate-500">{label}</p>
              <p className="text-sm font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>
        {(exam.shuffle_questions || exam.block_clipboard) && (
          <div className="relative mt-3 flex flex-wrap gap-2 text-[11px]">
            {exam.shuffle_questions && <Chip icon={Shuffle}>Kérdések véletlen sorrendben</Chip>}
            {exam.block_clipboard && <Chip icon={Lock}>Másolás és beillesztés kikapcsolva</Chip>}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <section className="panel animate-rise p-5" style={{"--i": 2} as CSSProperties}>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Sparkles className="size-4 text-yellow-400"/> Így működik</h2>
          <ul className="mt-3 space-y-2.5 text-sm text-slate-300">
            <Step icon={Clock}>Az idő a szerveren telik: az indítás után akkor is fogy, ha bezárod az oldalt.</Step>
            <Step icon={Cloud}>
              A válaszaid menet közben mentődnek. {viewer.signed_in
              ? "Újratöltés vagy másik eszköz után ott folytatod, ahol abbahagytad."
              : "Újratöltés után ebben a böngészőben folytathatod."}
            </Step>
            <Step icon={Layers}>Oldalanként haladsz; a végén áttekintheted a válaszaidat, mielőtt leadod.</Step>
            <Step icon={Hourglass}>Ha lejár az idő, a lap automatikusan leadódik azzal, amit addig beírtál.</Step>
          </ul>
        </section>
        <section className="panel animate-rise p-5" style={{"--i": 3} as CSSProperties}>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><ShieldCheck className="size-4 text-emerald-400"/> Tisztességes vizsga</h2>
          <p className="mt-3 text-sm text-slate-300">A javító látja, ha a vizsga alatt:</p>
          <ul className="mt-2 space-y-2.5 text-sm text-slate-300">
            <Step icon={Eye}>elhagyod a vizsga oldalát (másik lap vagy ablak), és mennyi időre;</Step>
            <Step icon={FileQuestion}>szöveget illesztesz be egy válaszba, vagy a kérdésekből másolsz.</Step>
          </ul>
          <p className="mt-3 text-xs text-slate-400">
            Ezek tények, nem ítéletek: a döntést a javító hozza meg. A saját tudásodból dolgozz, és nyugodtan haladj a saját tempódban.
          </p>
        </section>
      </div>

      <section className="panel animate-rise p-5 md:p-6" style={{"--i": 4} as CSSProperties}>
        {guestFinished ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-white">Ebből a böngészőből már leadtál egy lapot</p>
              <p className="text-sm text-slate-400">Állapot: {STATUS_META[guestFinished.status]?.label ?? "Leadva"}. Őrizd meg a kódot: ezzel kapcsolod a vizsgát a profilodhoz.</p>
            </div>
            {guestFinished.claim_token && <ClaimCode code={guestFinished.claim_token}/>}
            <Button variant="outline" onClick={onNewGuestAttempt}><RotateCcw/> Új kitöltés indítása</Button>
          </div>
        ) : block ? (
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-slate-300 ring-1 ring-white/10">
              <BlockIcon className="size-5"/>
            </span>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="text-sm font-semibold text-white">Most nem indíthatod el</p>
                <p className="text-sm text-slate-300">{block.message}</p>
              </div>
              {last && (
                <p className="text-xs text-slate-500">
                  Legutóbbi lapod: {STATUS_META[last.status]?.label ?? last.status}
                  {last.percentage !== null ? ` (${last.percentage}%)` : ""} · {formatDateTime(last.end_time)}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {block.code === "login" ? (
                  <Button asChild><Link to="/login"><LogIn/> Bejelentkezés</Link></Button>
                ) : last && ["passed", "failed"].includes(last.status) && viewer.member ? (
                  <Button asChild variant="outline"><Link to={`/exams/grading/${last.id}`}>Eredmény megtekintése</Link></Button>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={(event) => {
            event.preventDefault();
            if (needsName && !nameOk) return;
            onStart(needsName ? name.trim() : null);
          }}>
            {needsName ? (
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-200">Teljes IC neved</span>
                <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={64} autoComplete="off"
                       placeholder="Például: John Doe" className="h-11"/>
                <span className="block text-xs text-slate-500">Ezen a néven kerül a lapod a javítókhoz.</span>
              </label>
            ) : (
              <p className="text-sm text-slate-300">Vizsgázó: <span className="font-semibold text-white">{viewer.name}</span></p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button type="submit" size="lg" disabled={starting || (needsName && !nameOk)}
                      className={cn("h-12 px-6 text-base", !starting && "shadow-[0_0_32px_-8px_rgb(234_179_8/0.7)]")}>
                <Play/> {starting ? "Indítás…" : "Vizsga indítása"}
              </Button>
              <p className="text-xs text-slate-500">Az indítás után {exam.time_limit_minutes} perced van; az idő azonnal indul.</p>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

function Chip({icon: Icon, children}: {icon: typeof Clock; children: ReactNode}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-1 text-slate-300 ring-1 ring-white/10">
      <Icon className="size-3.5 text-yellow-400/80"/>{children}
    </span>
  );
}

function Step({icon: Icon, children}: {icon: typeof Clock; children: ReactNode}) {
  return (
    <li className="flex gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-slate-500"/>
      <span className="min-w-0">{children}</span>
    </li>
  );
}
