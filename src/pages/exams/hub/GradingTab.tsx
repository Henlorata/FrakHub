import type {CSSProperties} from "react";
import {useNavigate} from "react-router";
import {formatDistanceToNow} from "date-fns";
import {hu} from "date-fns/locale";
import {ChevronRight, ClipboardCheck, Radio, Trash2} from "lucide-react";
import {Button} from "@/components/ui/button";
import {EmptyState} from "@/components/layout/EmptyState";
import {TONE_CLASSES} from "@/components/layout/PageHeader";
import {formatDuration, INTEGRITY_LEVEL_META, integrityLevel} from "@/lib/exams";
import {cn} from "@/lib/utils";
import type {LiveAttempt, QueueSheet} from "@/types/exams";
import {CandidateAvatar} from "../components/CandidateAvatar";

interface GradingTabProps {
  queue: QueueSheet[];
  live: LiveAttempt[];
  clockOffset: number;
  canTrash: boolean;
  workingId: string | null;
  onTrash: (id: string) => void;
}

const ago = (iso: string | null) => (iso ? formatDistanceToNow(new Date(iso), {locale: hu, addSuffix: true}) : "–");

function IntegrityChip({summary}: {summary: QueueSheet["integrity"]}) {
  const level = integrityLevel(summary);
  if (level === "clean") return null;
  const meta = INTEGRITY_LEVEL_META[level];
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium ring-1", TONE_CLASSES[meta.tone].tile)}>{meta.label}</span>;
}

/** Sheets waiting for a grader, and the attempts running right now. */
export function GradingTab({queue, live, clockOffset, canTrash, workingId, onTrash}: GradingTabProps) {
  const navigate = useNavigate();
  return (
    <div data-tour="grading-list" className="space-y-6">
      {live.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Radio className="size-4 animate-pulse text-sky-300"/> Éppen vizsgázik ({live.length})
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {live.map((attempt, index) => {
              const left = Date.parse(attempt.deadline) - (Date.now() + clockOffset);
              const share = attempt.question_count ? attempt.answered / attempt.question_count : 0;
              return (
                <button key={attempt.id} type="button" onClick={() => navigate(`/exams/grading/${attempt.id}`)}
                        style={{"--i": index} as CSSProperties}
                        className="panel lift animate-rise flex min-w-0 flex-col gap-3 p-4 text-left">
                  <div className="flex items-center gap-3">
                    <CandidateAvatar name={attempt.candidate_name} url={attempt.avatar_url}/>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{attempt.candidate_name}</p>
                      <p className="truncate text-xs text-slate-400">{attempt.exam_title}</p>
                    </div>
                    <IntegrityChip summary={attempt.integrity}/>
                  </div>
                  <div className="space-y-1">
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-cyan-300 transition-[width] duration-700" style={{width: `${share * 100}%`}}/>
                    </div>
                    <p className="flex justify-between text-[11px] text-slate-500">
                      <span>{attempt.answered} / {attempt.question_count} megválaszolva</span>
                      <span>{left > 0 ? `${formatDuration(left)} van hátra` : "lejárt"}</span>
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <ClipboardCheck className="size-4 text-yellow-400"/> Javításra vár ({queue.length})
        </h2>
        {queue.length === 0 ? (
          <div className="panel"><EmptyState icon={ClipboardCheck} title="Nincs javításra váró vizsgalap." compact/></div>
        ) : (
          <ul className="panel divide-y divide-white/5 overflow-hidden">
            {queue.map((sheet, index) => (
              <li key={sheet.id} style={{"--i": Math.min(index, 12)} as CSSProperties} className="animate-fade" data-tour="grading-sheet">
                <div className="flex flex-col gap-3 p-4 transition-colors hover:bg-white/[0.02] sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <CandidateAvatar name={sheet.candidate_name} url={sheet.avatar_url}/>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {sheet.candidate_name}
                        <span className="ml-2 text-xs font-normal text-slate-500">{sheet.badge_number ? `#${sheet.badge_number}` : "vendég"}</span>
                      </p>
                      <p className="truncate text-xs text-slate-400">{sheet.exam_title} · leadva {ago(sheet.end_time)}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                        <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-slate-300 ring-1 ring-white/10">
                          {sheet.open_questions > 0 ? `${sheet.open_questions} kifejtős kérdés vár pontozásra` : "Csak automatikusan pontozott kérdések"}
                        </span>
                        {sheet.finish_reason && sheet.finish_reason !== "submitted" && (
                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-200 ring-1 ring-amber-400/25">
                            {sheet.finish_reason === "time_up" ? "Lejárt az idő" : "Nem adta le (lejárt)"}
                          </span>
                        )}
                        <IntegrityChip summary={sheet.integrity}/>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {canTrash && (
                      <Button variant="ghost" size="icon" title="Hibás / teszt kitöltés: lomtárba" aria-label="Lomtárba"
                              disabled={workingId === sheet.id} onClick={() => onTrash(sheet.id)} className="text-slate-500 hover:text-red-300">
                        <Trash2/>
                      </Button>
                    )}
                    <Button onClick={() => navigate(`/exams/grading/${sheet.id}`)}>Javítás <ChevronRight/></Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
