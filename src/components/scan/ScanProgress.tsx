import {Check, Loader2} from "lucide-react";
import {cn} from "@/lib/utils";

/**
 * The scanning animation of the screenshot readers: the picture under a moving scan line, and
 * the stages with the progress of the running one.
 */
export function ScanProgress<Stage extends string>({preview, stages, stage, progress, progressStages}: {
  preview: string | null;
  stages: readonly {stage: Stage; label: string}[];
  stage: Stage;
  /** 0-1 within the running OCR pass. */
  progress: number;
  /** Stages that report a progress. */
  progressStages: readonly Stage[];
}) {
  const current = stages.findIndex((item) => item.stage === stage);
  return (
    <div className="animate-fade space-y-4">
      <div className="scan-frame relative overflow-hidden rounded-2xl bg-black/40 ring-1 ring-white/10">
        {preview && <img src={preview} alt="" className="max-h-60 w-full object-contain opacity-80"/>}
        <span className="scan-grid pointer-events-none absolute inset-0"/>
        <span className="scan-line pointer-events-none absolute inset-x-0"/>
        {(["top-2 left-2 border-t-2 border-l-2", "top-2 right-2 border-t-2 border-r-2", "bottom-2 left-2 border-b-2 border-l-2",
          "bottom-2 right-2 border-b-2 border-r-2"] as const).map((corner) => (
          <span key={corner} className={cn("pointer-events-none absolute size-6 rounded-sm border-primary/80", corner)}/>
        ))}
      </div>
      <ol className="space-y-1.5">
        {stages.map((item, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li key={item.stage} className={cn("flex items-center gap-2.5 text-sm transition-colors", done ? "text-emerald-300" : active ? "text-white" : "text-slate-500")}>
              <span className={cn("grid size-5 place-items-center rounded-full ring-1 transition-all",
                done ? "bg-emerald-500/20 ring-emerald-400/50" : active ? "ring-primary/60" : "ring-white/15")}>
                {done ? <Check className="animate-pop size-3"/> : active ? <Loader2 className="size-3 animate-spin text-primary"/> : null}
              </span>
              {item.label}
              {active && progressStages.includes(item.stage) && progress > 0 && (
                <span className="ml-auto text-xs tabular-nums text-slate-400">{Math.round(progress * 100)}%</span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
