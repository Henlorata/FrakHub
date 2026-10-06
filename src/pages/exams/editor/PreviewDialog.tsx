import {useMemo, useState} from "react";
import {ArrowLeft, ArrowRight, Eye} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Dialog, DialogContent, DialogDescription, DialogTitle} from "@/components/ui/dialog";
import type {DraftAnswer} from "@/lib/exams";
import {QuestionView} from "../runner/QuestionView";
import {orderedQuestions, pageNumbers, type Draft} from "./editor-model";

/** The exam as a candidate sees it (unsaved changes included). Answers are not kept. */
export function PreviewDialog({open, onOpenChange, draft}: {open: boolean; onOpenChange: (open: boolean) => void; draft: Draft}) {
  const [pageIndex, setPageIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, DraftAnswer>>({});
  const questions = useMemo(() => orderedQuestions(draft), [draft]);
  const pages = useMemo(() => pageNumbers(draft).filter((page) => questions.some((question) => question.page === page)), [draft, questions]);
  const page = pages[Math.min(pageIndex, pages.length - 1)] ?? 1;
  const meta = draft.pages[page];
  const onPage = questions.filter((question) => question.page === page);

  return (
    <Dialog open={open} onOpenChange={(next) => {
      onOpenChange(next);
      if (!next) setAnswers({});
    }}>
      <DialogContent className="max-h-[92dvh] gap-0 p-0 sm:max-w-3xl">
        <div className="sticky top-0 z-10 border-b border-white/5 bg-[#070c17]/95 p-5 backdrop-blur">
          <DialogTitle className="flex items-center gap-2"><Eye className="size-4 text-primary"/> Előnézet: {draft.settings.title || "Névtelen vizsga"}</DialogTitle>
          <DialogDescription className="mt-1">
            Így látja a vizsgázó. A válaszok itt nem mentődnek.
            {(draft.settings.shuffle_questions || draft.settings.shuffle_options) && " Keveréssel a vizsgázók más sorrendben látják."}
            {Object.values(draft.pages).some((item) => item.draw_count) && " A kérdésbankos oldalakon a vizsgázó csak a kihúzott kérdéseket kapja."}
          </DialogDescription>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-400/90">{pages.length > 1 ? `${pages.indexOf(page) + 1}. oldal / ${pages.length}` : "Kérdések"}</p>
            {meta?.title && <h3 className="text-lg font-semibold text-white wrap-anywhere">{meta.title}</h3>}
            {meta?.description && <p className="text-sm whitespace-pre-wrap text-slate-400 wrap-anywhere">{meta.description}</p>}
          </div>
          {onPage.map((question, index) => (
            <QuestionView key={question.key} index={index} number={questions.indexOf(question) + 1}
                          question={{
                            id: question.key, question_text: question.question_text || "(üres kérdés)", question_type: question.question_type,
                            points: question.points, is_required: question.is_required,
                            options: question.options.map((option) => ({id: option.key, option_text: option.option_text || "(üres válasz)"})),
                          }}
                          answer={answers[question.key]}
                          onChange={(patch) => setAnswers((current) => ({...current, [question.key]: {...current[question.key], ...patch}}))}/>
          ))}
        </div>
        {pages.length > 1 && (
          <div className="sticky bottom-0 flex justify-between border-t border-white/5 bg-[#070c17]/95 p-4 backdrop-blur">
            <Button variant="outline" disabled={pages.indexOf(page) === 0} onClick={() => setPageIndex(pages.indexOf(page) - 1)}><ArrowLeft/> Előző</Button>
            <Button variant="outline" disabled={pages.indexOf(page) === pages.length - 1} onClick={() => setPageIndex(pages.indexOf(page) + 1)}>Következő <ArrowRight/></Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
