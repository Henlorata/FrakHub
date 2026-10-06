import {useEffect, useMemo, useState, type CSSProperties} from "react";
import {BarChart3, CheckCircle2, Clock, FileText, Percent} from "lucide-react";
import {EmptyState} from "@/components/layout/EmptyState";
import {StatCard} from "@/components/layout/StatCard";
import {examApi} from "@/lib/exams";
import {cn} from "@/lib/utils";
import type {ExamStats} from "@/types/exams";
import {orderedQuestions, type Draft} from "./editor-model";

const difficulty = (ratio: number) =>
  ratio < 0.4 ? {label: "Nehéz", tone: "text-red-300", bar: "from-red-500 to-orange-400"}
    : ratio < 0.75 ? {label: "Közepes", tone: "text-amber-300", bar: "from-amber-500 to-yellow-300"}
      : {label: "Könnyű", tone: "text-emerald-300", bar: "from-emerald-500 to-teal-300"};

/** How the exam went so far: results, time, and which questions are hard (by graded sheets). */
export function StatsTab({examId, draft}: {examId: string; draft: Draft}) {
  const [stats, setStats] = useState<ExamStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    examApi.stats(examId).then((result) => active && setStats(result)).catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [examId]);

  const byId = useMemo(() => new Map((stats?.questions ?? []).map((question) => [question.id, question])), [stats]);
  const questions = orderedQuestions(draft).filter((question) => question.id && byId.has(question.id));

  if (failed) return <div className="panel"><EmptyState icon={BarChart3} title="A statisztika nem tölthető be."/></div>;
  if (!stats) return <div className="grid gap-4 md:grid-cols-4">{Array.from({length: 4}, (_, index) => <div key={index} className="skeleton h-24"/>)}</div>;

  const {totals} = stats;
  if (!totals.sheets) {
    return <div className="panel"><EmptyState icon={BarChart3} title="Még nincs leadott vizsgalap." description="Az első kitöltések után itt látod, melyik kérdés okoz nehézséget."/></div>;
  }
  const passRate = totals.graded ? Math.round((100 * totals.passed) / totals.graded) : null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard index={0} icon={FileText} tone="blue" label="Leadott lapok" value={totals.sheets} hint={totals.pending ? `${totals.pending} javításra vár` : undefined}/>
        <StatCard index={1} icon={CheckCircle2} tone="emerald" label="Sikeres arány" value={passRate === null ? "–" : `${passRate}%`}
                  hint={`${totals.passed} sikeres · ${totals.failed} sikertelen`}/>
        <StatCard index={2} icon={Percent} tone="gold" label="Átlagos eredmény" value={totals.avg_percentage === null ? "–" : `${totals.avg_percentage}%`}/>
        <StatCard index={3} icon={Clock} tone="violet" label="Átlagos kitöltési idő" value={totals.avg_minutes === null ? "–" : `${totals.avg_minutes} perc`}/>
      </div>

      <section className="panel overflow-hidden">
        <div className="border-b border-white/5 px-5 py-4">
          <h2 className="text-sm font-semibold text-white">Kérdésenként</h2>
          <p className="text-xs text-slate-400">A javított lapok alapján: a megszerezhető pontok hány százalékát kapták meg átlagosan a vizsgázók.</p>
        </div>
        <ul className="divide-y divide-white/5">
          {questions.map((question, index) => {
            const stat = byId.get(question.id ?? "");
            if (!stat) return null;
            const ratio = stat.avg_ratio ?? null;
            const level = ratio === null ? null : difficulty(ratio);
            const picks = Object.values(stat.option_counts ?? {}).reduce((sum, count) => sum + count, 0);
            return (
              <li key={question.key} style={{"--i": Math.min(index, 12)} as CSSProperties} className="animate-fade space-y-3 px-5 py-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-xs font-semibold text-slate-300 ring-1 ring-white/10">{index + 1}</span>
                  <p className="min-w-0 flex-1 text-sm text-slate-200 line-clamp-2 wrap-anywhere">{question.question_text}</p>
                  <span className="shrink-0 text-xs text-slate-500">{stat.answered} válasz</span>
                </div>
                {question.points > 0 && ratio !== null && level && (
                  <div className="flex items-center gap-3 pl-10">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                      <div className={cn("h-full rounded-full bg-gradient-to-r", level.bar)} style={{width: `${Math.round(ratio * 100)}%`}}/>
                    </div>
                    <span className={cn("w-28 shrink-0 text-right text-xs font-medium", level.tone)}>{Math.round(ratio * 100)}% · {level.label}</span>
                  </div>
                )}
                {question.question_type !== "text" && picks > 0 && (
                  <ul className="space-y-1.5 pl-10">
                    {question.options.map((option) => {
                      const count = stat.option_counts?.[option.id ?? ""] ?? 0;
                      const share = stat.answered ? count / stat.answered : 0;
                      return (
                        <li key={option.key} className="flex items-center gap-3 text-xs">
                          <span className={cn("w-48 shrink-0 truncate", option.is_correct ? "text-emerald-300" : "text-slate-400")}>
                            {option.is_correct ? "✓ " : ""}{option.option_text}
                          </span>
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                            <span className={cn("block h-full rounded-full", option.is_correct ? "bg-emerald-400/80" : "bg-slate-400/60")} style={{width: `${share * 100}%`}}/>
                          </span>
                          <span className="w-10 shrink-0 text-right tabular-nums text-slate-500">{count}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
