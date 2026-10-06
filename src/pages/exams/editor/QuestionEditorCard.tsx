import {memo, useState, type CSSProperties} from "react";
import {ArrowDown, ArrowUp, BookOpenCheck, Check, CheckSquare, CircleDot, Copy, Plus, Trash2, Type, X} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Switch} from "@/components/ui/switch";
import {Textarea} from "@/components/ui/textarea";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {cn} from "@/lib/utils";
import type {QuestionType} from "@/types/exams";
import {newOption, type DraftQuestion} from "./editor-model";

const TYPES: {value: QuestionType; label: string; icon: typeof Type}[] = [
  {value: "text", label: "Kifejtős", icon: Type},
  {value: "single_choice", label: "Egy helyes", icon: CircleDot},
  {value: "multiple_choice", label: "Több helyes", icon: CheckSquare},
];

interface QuestionEditorCardProps {
  question: DraftQuestion;
  number: number;
  index: number;
  pages: number[];
  isFirst: boolean;
  isLast: boolean;
  highlighted: boolean;
  onChange: (key: string, patch: Partial<DraftQuestion>) => void;
  onMove: (key: string, direction: -1 | 1) => void;
  onDuplicate: (key: string) => void;
  onRemove: (key: string) => void;
}

/** Editing one question: type, text, points, options with the correct answers, and the grader's guide. */
export const QuestionEditorCard = memo(function QuestionEditorCard({
  question, number, index, pages, isFirst, isLast, highlighted, onChange, onMove, onDuplicate, onRemove,
}: QuestionEditorCardProps) {
  const [guideOpen, setGuideOpen] = useState(!!question.guide);
  const change = (patch: Partial<DraftQuestion>) => onChange(question.key, patch);
  const choice = question.question_type !== "text";
  const correctCount = question.options.filter((option) => option.is_correct).length;
  const missingCorrect = choice && question.points > 0 && correctCount === 0 && question.options.length >= 2;

  const setType = (type: QuestionType) => {
    if (type === question.question_type) return;
    if (type === "text") return change({question_type: type});
    const options = question.options.length >= 2 ? question.options : [...question.options, ...Array.from({length: 2 - question.options.length}, newOption)];
    // A single-choice question keeps only the first correct answer.
    let seen = false;
    change({
      question_type: type,
      options: type === "single_choice" ? options.map((option) => {
        const keep = option.is_correct && !seen;
        if (option.is_correct) seen = true;
        return {...option, is_correct: keep};
      }) : options,
    });
  };

  const toggleCorrect = (key: string) => change({
    options: question.options.map((option) => question.question_type === "single_choice"
      ? {...option, is_correct: option.key === key}
      : option.key === key ? {...option, is_correct: !option.is_correct} : option),
  });

  return (
    <article id={`edit-question-${question.key}`} style={{"--i": Math.min(index, 8)} as CSSProperties}
             className={cn("panel animate-rise scroll-mt-28 p-5 transition-shadow duration-500", highlighted && "ring-2 ring-amber-400/60")}>
      <header className="flex flex-wrap items-center gap-3">
        <span className="grid size-8 place-items-center rounded-lg bg-yellow-500/10 text-sm font-semibold text-yellow-200 ring-1 ring-yellow-500/25">{number}</span>
        <div className="flex rounded-xl bg-white/[0.03] p-0.5 ring-1 ring-white/10" role="radiogroup" aria-label="Kérdéstípus">
          {TYPES.map(({value, label, icon: Icon}) => (
            <button key={value} type="button" role="radio" aria-checked={question.question_type === value} onClick={() => setType(value)}
                    className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                      question.question_type === value ? "bg-primary text-primary-foreground" : "text-slate-300 hover:bg-white/5")}>
              <Icon className="size-3.5"/> {label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          {pages.length > 1 && (
            <Select value={String(question.page)} onValueChange={(value) => change({page: Number(value)})}>
              <SelectTrigger className="h-8 w-[7.5rem] text-xs" aria-label="Oldal"><SelectValue/></SelectTrigger>
              <SelectContent>
                {pages.map((page, pageIndex) => <SelectItem key={page} value={String(page)}>{pageIndex + 1}. oldal</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button variant="ghost" size="icon" className="size-8" disabled={isFirst} aria-label="Feljebb" title="Feljebb" onClick={() => onMove(question.key, -1)}><ArrowUp/></Button>
          <Button variant="ghost" size="icon" className="size-8" disabled={isLast} aria-label="Lejjebb" title="Lejjebb" onClick={() => onMove(question.key, 1)}><ArrowDown/></Button>
          <Button variant="ghost" size="icon" className="size-8" aria-label="Másolat" title="Másolat" onClick={() => onDuplicate(question.key)}><Copy/></Button>
          <Button variant="ghost" size="icon" className="size-8 text-slate-400 hover:text-red-300" aria-label="Kérdés törlése" title="Kérdés törlése" onClick={() => onRemove(question.key)}><Trash2/></Button>
        </div>
      </header>

      <div className="mt-4 space-y-4">
        <Textarea value={question.question_text} onChange={(event) => change({question_text: event.target.value})} maxLength={2000}
                  placeholder="A kérdés szövege…" aria-label={`${number}. kérdés szövege`}
                  className={cn("min-h-20 text-[15px]", !question.question_text.trim() && "ring-1 ring-amber-400/30")}/>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            Pont
            <Input type="number" min={0} max={1000} value={question.points}
                   onChange={(event) => {
                     const value = Number.parseInt(event.target.value, 10);
                     change({points: Number.isNaN(value) ? 0 : Math.max(0, Math.min(1000, value))});
                   }}
                   className="h-8 w-20 text-center"/>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <Switch checked={question.points === 0} onCheckedChange={(checked) => change({points: checked ? 0 : choice ? 1 : 2})}/>
            Nem pontozott (pl. Discord-név)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <Switch checked={question.is_required} onCheckedChange={(checked) => change({is_required: checked})}/>
            Kötelező
          </label>
        </div>

        {choice && (
          <div className="space-y-2 rounded-xl bg-white/[0.02] p-3 ring-1 ring-white/5">
            <div className="flex items-center justify-between px-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Válaszlehetőségek · {question.question_type === "single_choice" ? "jelöld meg a helyeset" : "jelöld meg az összes helyeset"}
              </p>
              {missingCorrect && <span className="text-[11px] font-medium text-amber-300">Nincs helyes válasz megjelölve</span>}
            </div>
            {question.options.map((option, optionIndex) => (
              <div key={option.key} className="animate-fade flex items-center gap-2" style={{"--i": optionIndex} as CSSProperties}>
                <button type="button" onClick={() => toggleCorrect(option.key)}
                        aria-pressed={option.is_correct} aria-label={option.is_correct ? "Helyes válasz" : "Megjelölés helyesként"}
                        title={option.is_correct ? "Helyes válasz" : "Megjelölés helyesként"}
                        className={cn("grid size-8 shrink-0 place-items-center ring-1 transition-all",
                          question.question_type === "multiple_choice" ? "rounded-lg" : "rounded-full",
                          option.is_correct ? "bg-emerald-500/20 text-emerald-200 ring-emerald-400/50 scale-105" : "text-slate-500 ring-white/15 hover:text-slate-300")}>
                  {option.is_correct ? <Check className="size-4"/> : <span className="size-1.5 rounded-full bg-current"/>}
                </button>
                <Input value={option.option_text} maxLength={1000} placeholder={`${optionIndex + 1}. válasz`}
                       onChange={(event) => change({options: question.options.map((item) => item.key === option.key ? {...item, option_text: event.target.value} : item)})}
                       className={cn("h-9", !option.option_text.trim() && "ring-1 ring-amber-400/25")}/>
                <Button variant="ghost" size="icon" className="size-8 shrink-0" disabled={optionIndex === 0} aria-label="Válasz feljebb"
                        title="Feljebb" onClick={() => {
                          const options = [...question.options];
                          [options[optionIndex - 1], options[optionIndex]] = [options[optionIndex], options[optionIndex - 1]];
                          change({options});
                        }}>
                  <ArrowUp/>
                </Button>
                <Button variant="ghost" size="icon" className="size-8 shrink-0 text-slate-500 hover:text-red-300" disabled={question.options.length <= 2}
                        aria-label="Válasz törlése" onClick={() => change({options: question.options.filter((item) => item.key !== option.key)})}>
                  <X/>
                </Button>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="text-slate-300" onClick={() => change({options: [...question.options, newOption()]})}>
              <Plus/> Válaszlehetőség
            </Button>
          </div>
        )}

        {guideOpen ? (
          <div className="space-y-1.5 rounded-xl bg-amber-500/[0.05] p-3 ring-1 ring-amber-400/20">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-300">
              <BookOpenCheck className="size-3.5"/> Javítási útmutató · csak a javítók látják
            </p>
            <Textarea value={question.guide} onChange={(event) => change({guide: event.target.value})} maxLength={4000}
                      placeholder="Mit tartalmazzon egy teljes pontos válasz? Mikor jár részpont?" className="min-h-16 bg-black/20 text-sm"/>
          </div>
        ) : (
          <button type="button" onClick={() => setGuideOpen(true)} className="flex items-center gap-1.5 text-xs text-amber-300/90 hover:underline">
            <BookOpenCheck className="size-3.5"/> Javítási útmutató hozzáadása
          </button>
        )}
      </div>
    </article>
  );
});
