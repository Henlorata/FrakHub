import type {CSSProperties} from "react";
import {useNavigate} from "react-router";
import {Award, ChevronRight, Clock, FileText, Hourglass, Play, XCircle} from "lucide-react";
import {EmptyState} from "@/components/layout/EmptyState";
import {TONE_CLASSES} from "@/components/layout/PageHeader";
import {formatDateTime, STATUS_META} from "@/lib/exams";
import {cn} from "@/lib/utils";
import type {MySheet} from "@/types/exams";

const ICONS = {in_progress: Play, pending: Hourglass, grading: Hourglass, passed: Award, failed: XCircle};

/** The member's own sheets, newest first. */
export function MyResultsTab({sheets}: {sheets: MySheet[]}) {
  const navigate = useNavigate();
  if (!sheets.length) {
    return <div className="panel"><EmptyState icon={FileText} title="Még nincs vizsgalapod." description="A kitöltött vizsgáid eredménye itt jelenik meg."/></div>;
  }
  return (
    <ul className="panel divide-y divide-white/5 overflow-hidden">
      {sheets.map((sheet, index) => {
        const meta = STATUS_META[sheet.status];
        const Icon = ICONS[sheet.status] ?? FileText;
        const decided = sheet.status === "passed" || sheet.status === "failed";
        const target = sheet.status === "in_progress" ? `/exam/public/${sheet.exam_id}` : `/exams/grading/${sheet.id}`;
        return (
          <li key={sheet.id} style={{"--i": Math.min(index, 12)} as CSSProperties} className="animate-fade">
            <button type="button" onClick={() => navigate(target)}
                    className="group flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-white/[0.03]">
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl ring-1", TONE_CLASSES[meta.tone].tile)}>
                <Icon className="size-5"/>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-white">{sheet.exam_title}</span>
                <span className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Clock className="size-3"/>{formatDateTime(sheet.start_time)}
                  {sheet.status === "failed" && sheet.retry_allowed_at && Date.parse(sheet.retry_allowed_at) > Date.now() && (
                    <span className="text-slate-500">· újra: {formatDateTime(sheet.retry_allowed_at)}</span>
                  )}
                </span>
              </span>
              {decided && sheet.percentage != null ? (
                <span className="hidden w-40 shrink-0 sm:block">
                  <span className="flex justify-between text-xs">
                    <span className={TONE_CLASSES[meta.tone].text}>{meta.label}</span>
                    <span className="tabular-nums text-slate-300">{sheet.percentage}%</span>
                  </span>
                  <span className="relative mt-1 block h-1.5 overflow-hidden rounded-full bg-white/5">
                    <span className={cn("absolute inset-y-0 left-0 rounded-full bg-gradient-to-r", TONE_CLASSES[meta.tone].gradient)} style={{width: `${sheet.percentage}%`}}/>
                    <span className="absolute inset-y-0 w-px bg-white/60" style={{left: `${sheet.passing_percentage}%`}}/>
                  </span>
                </span>
              ) : (
                <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1", TONE_CLASSES[meta.tone].tile)}>{meta.label}</span>
              )}
              <ChevronRight className="size-4 shrink-0 text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-300"/>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
