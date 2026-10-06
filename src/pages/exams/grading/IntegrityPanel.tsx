import {useMemo, useState, type CSSProperties} from "react";
import {ClipboardCopy, ClipboardPaste, EyeOff, FileStack, Ban, RotateCcw, ShieldCheck, WifiOff} from "lucide-react";
import {TONE_CLASSES} from "@/components/layout/PageHeader";
import {formatClock, formatDuration, INTEGRITY_LEVEL_META, integrityFacts, integrityLevel} from "@/lib/exams";
import {cn} from "@/lib/utils";
import type {IntegrityEvent, IntegritySummary} from "@/types/exams";

const BLOCKED_LABELS: Record<string, string> = {paste: "beillesztés", copy: "másolás", drop: "behúzás", menu: "helyi menü"};

function describe(event: IntegrityEvent, number: (id: string | undefined) => string) {
  switch (event.k) {
    case "away":
      return {icon: EyeOff, text: `Elhagyta az oldalt · ${formatDuration(event.d ?? 0)}${event.p ? ` · ${event.p}. oldal` : ""}`, strong: (event.d ?? 0) >= 30_000};
    case "paste":
      return {icon: ClipboardPaste, text: `Szöveget illesztett be · ${event.n ?? 0} karakter${number(event.q)}`, strong: (event.n ?? 0) >= 100};
    case "copy":
      return {icon: ClipboardCopy, text: `Másolt a kérdésből${number(event.q)}`, strong: false};
    case "blocked":
      return {icon: Ban, text: `Tiltott ${BLOCKED_LABELS[event.x ?? ""] ?? "művelet"} (megakadályozva)${number(event.q)}`, strong: false};
    case "offline":
      return {icon: WifiOff, text: `Megszakadt a kapcsolat · ${formatDuration(event.d ?? 0)}`, strong: false};
    case "resume":
      return {icon: RotateCcw, text: "Újranyitotta a vizsgát (újratöltés vagy másik eszköz)", strong: false};
    default:
      return {icon: FileStack, text: `Oldalt váltott: ${event.p}. oldal`, strong: false};
  }
}

interface IntegrityPanelProps {
  summary: Partial<IntegritySummary> | null;
  log: IntegrityEvent[] | null;
  /** Old sheets only have a counter. */
  legacyCount: number | null;
  questionNumbers: Map<string, number>;
}

/** What happened during the attempt, as facts on a timeline (no verdict). */
export function IntegrityPanel({summary, log, legacyCount, questionNumbers}: IntegrityPanelProps) {
  const [showPages, setShowPages] = useState(false);
  const events = useMemo(() => [...(log ?? [])].sort((a, b) => a.at - b.at), [log]);
  const hasLog = events.length > 0 || Object.keys(summary ?? {}).length > 0;
  const level = integrityLevel(summary);
  const meta = INTEGRITY_LEVEL_META[level];
  const facts = integrityFacts(summary);
  const visible = events.filter((event) => showPages || event.k !== "page");
  const pageEvents = events.length - events.filter((event) => event.k !== "page").length;
  const number = (id: string | undefined) => (id && questionNumbers.has(id) ? ` · ${questionNumbers.get(id)}. kérdés` : "");

  return (
    <section className="panel animate-rise p-5" style={{"--i": 2} as CSSProperties} data-tour="grading-integrity">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><ShieldCheck className="size-4 text-slate-400"/> Integritási napló</h3>
        {hasLog && <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1", TONE_CLASSES[meta.tone].tile)}>{meta.label}</span>}
      </div>

      {!hasLog ? (
        <p className="mt-3 text-sm text-slate-400">
          {legacyCount ? `Régi vizsgalap: ${legacyCount}× fókuszvesztés, időpontok nélkül.` : "Régi vizsgalap, napló nélkül."}
        </p>
      ) : (
        <>
          <p className="mt-2 text-xs text-slate-400">{meta.hint}</p>
          {facts.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-slate-200">
              {facts.map((fact) => <li key={fact} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-slate-500"/>{fact}</li>)}
            </ul>
          )}
          {visible.length > 0 && (
            <ol className="relative mt-4 space-y-3 border-l border-white/10 pl-4">
              {visible.map((event, index) => {
                const {icon: Icon, text, strong} = describe(event, number);
                return (
                  <li key={`${event.k}-${event.at}-${index}`} className="animate-fade relative" style={{"--i": Math.min(index, 12)} as CSSProperties}>
                    <span className={cn("absolute top-0.5 -left-[25px] grid size-[18px] place-items-center rounded-full ring-1",
                      strong ? "bg-orange-500/20 text-orange-200 ring-orange-400/40" : "bg-slate-800 text-slate-300 ring-white/10")}>
                      <Icon className="size-2.5"/>
                    </span>
                    <p className="text-[11px] tabular-nums text-slate-500">{formatClock(event.at)} a kezdéstől</p>
                    <p className={cn("text-sm", strong ? "text-orange-100" : "text-slate-300")}>{text}</p>
                  </li>
                );
              })}
            </ol>
          )}
          {pageEvents > 0 && (
            <button type="button" onClick={() => setShowPages((value) => !value)} className="mt-3 text-xs text-primary hover:underline">
              {showPages ? "Oldalváltások elrejtése" : `Oldalváltások mutatása (${pageEvents})`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
