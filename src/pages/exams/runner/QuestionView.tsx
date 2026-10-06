import type {ClipboardEvent, CSSProperties, DragEvent} from "react";
import {Check} from "lucide-react";
import {Textarea} from "@/components/ui/textarea";
import type {DraftAnswer} from "@/lib/exams";
import {cn} from "@/lib/utils";
import type {SheetQuestion} from "@/types/exams";

export const ANSWER_LIMIT = 5000;

export interface ClipboardHandlers {
  /** Logs (or blocks) a paste or drop into an answer and counts the characters. */
  onPaste: (event: ClipboardEvent<HTMLTextAreaElement> | DragEvent<HTMLTextAreaElement>, questionId: string) => void;
  onCopy: (event: ClipboardEvent<HTMLElement>, questionId: string) => void;
  onContextMenu: (event: React.MouseEvent<HTMLElement>) => void;
}

interface QuestionViewProps {
  question: Pick<SheetQuestion, "id" | "question_text" | "question_type" | "points" | "is_required" | "options">;
  number: number;
  answer: DraftAnswer | undefined;
  /** Without it the question is shown read-only. Receives the changed fields only. */
  onChange?: (patch: DraftAnswer) => void;
  clipboard?: ClipboardHandlers;
  blockClipboard?: boolean;
  /** Required but unanswered after a hand-in attempt. */
  missing?: boolean;
  index?: number;
}

/** One question of a running exam (also used by the editor's preview). */
export function QuestionView({question, number, answer, onChange, clipboard, blockClipboard, missing, index = 0}: QuestionViewProps) {
  const selected = answer?.options ?? [];
  const multiple = question.question_type === "multiple_choice";
  const toggle = (optionId: string) => {
    if (!onChange) return;
    if (multiple) {
      onChange({options: selected.includes(optionId) ? selected.filter((id) => id !== optionId) : [...selected, optionId]});
    } else {
      onChange({options: [optionId]});
    }
  };

  return (
    <article
      id={`question-${question.id}`}
      style={{"--i": Math.min(index, 8)} as CSSProperties}
      onCopy={clipboard ? (event) => clipboard.onCopy(event, question.id) : undefined}
      onCut={clipboard ? (event) => clipboard.onCopy(event, question.id) : undefined}
      onContextMenu={clipboard?.onContextMenu}
      className={cn("panel animate-rise scroll-mt-28 p-5 transition-shadow duration-500 md:p-6",
        missing && "ring-2 ring-amber-400/50")}
    >
      <header className="flex items-start gap-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-yellow-300/20 to-amber-600/10 text-sm font-semibold text-yellow-200 ring-1 ring-yellow-400/25">
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("text-[15px] leading-relaxed whitespace-pre-wrap text-slate-100 wrap-anywhere", blockClipboard && "select-none")}>
            {question.question_text}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-medium">
            <span className={cn("rounded-full px-2 py-0.5 ring-1",
              question.points === 0 ? "bg-slate-500/10 text-slate-300 ring-slate-500/25" : "bg-yellow-500/10 text-yellow-300 ring-yellow-500/25")}>
              {question.points === 0 ? "Nem pontozott" : `${question.points} pont`}
            </span>
            {question.is_required && <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-sky-300 ring-1 ring-sky-500/25">Kötelező</span>}
            {multiple && <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-violet-300 ring-1 ring-violet-500/25">Több helyes válasz is lehet</span>}
            {missing && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-200 ring-1 ring-amber-400/30">Válasz szükséges</span>}
          </div>
        </div>
      </header>

      <div className="mt-5 md:pl-13">
        {question.question_type === "text" ? (
          <div className="space-y-1.5">
            <Textarea
              value={answer?.text ?? ""}
              readOnly={!onChange}
              maxLength={ANSWER_LIMIT}
              placeholder="Írd ide a válaszod…"
              aria-label={`${number}. kérdés válasza`}
              onChange={(event) => onChange?.({text: event.target.value})}
              onPaste={clipboard ? (event) => clipboard.onPaste(event, question.id) : undefined}
              onDrop={clipboard ? (event) => clipboard.onPaste(event, question.id) : undefined}
              className="min-h-32 resize-y rounded-xl bg-black/20 text-[15px] leading-relaxed"
            />
            <p className="text-right text-[11px] text-slate-500 tabular-nums">{(answer?.text ?? "").length} / {ANSWER_LIMIT}</p>
          </div>
        ) : (
          <div role={multiple ? "group" : "radiogroup"} aria-label={`${number}. kérdés válaszai`} className="grid grid-cols-1 gap-2">
            {question.options.map((option) => {
              const checked = selected.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  role={multiple ? "checkbox" : "radio"}
                  aria-checked={checked}
                  disabled={!onChange}
                  onClick={() => toggle(option.id)}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm ring-1 transition-all duration-200",
                    checked ? "bg-primary/10 text-white ring-primary/50 shadow-[0_0_24px_-12px_rgb(234_179_8/0.8)]"
                      : "bg-white/[0.02] text-slate-200 ring-white/10 hover:bg-white/[0.05] hover:ring-white/20",
                    !onChange && "cursor-default",
                  )}
                >
                  <span className={cn("grid size-5 shrink-0 place-items-center ring-1 transition-all duration-200",
                    multiple ? "rounded-md" : "rounded-full",
                    checked ? "bg-primary text-primary-foreground ring-primary scale-110" : "ring-white/25 group-hover:ring-white/40")}>
                    {checked && (multiple ? <Check className="size-3.5"/> : <span className="size-2 rounded-full bg-primary-foreground"/>)}
                  </span>
                  <span className={cn("min-w-0 flex-1 wrap-anywhere", blockClipboard && "select-none")}>{option.option_text}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </article>
  );
}
