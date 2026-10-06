import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {toast} from "sonner";
import {ArrowLeft, Check, ChevronRight, Flame, PartyPopper, RotateCcw, TrendingUp, X} from "lucide-react";
import {Button} from "@/components/ui/button";
import {TONE_CLASSES} from "@/components/layout/PageHeader";
import {practiceApi, type DeckProgress} from "@/lib/practice/api";
import type {DeckDefinition, Question} from "@/lib/practice/decks";
import {answerCard, pickSession, pruneState, type DeckState} from "@/lib/practice/srs";
import {cn, errorMessage} from "@/lib/utils";

interface Answer {
  cardId: string;
  right: boolean;
  /** The box before and after (moved up or back). */
  from: number;
  to: number;
}

/**
 * One practice session: a dozen cards (due reviews first, a few new ones), multiple choice with
 * the right answer explained, wrong cards asked again at the end. The new card states are saved
 * once, when the session ends (or when the member leaves it half-way).
 */
export function DeckSession({deck, progress, today, onExit}: {deck: DeckDefinition; progress: DeckProgress | null; today: string; onExit: () => void}) {
  const ids = useMemo(() => deck.cards.map((card) => card.id), [deck]);
  const cardById = useMemo(() => new Map(deck.cards.map((card) => [card.id, card])), [deck]);
  const [state, setState] = useState<DeckState>(() => pruneState(progress?.cards ?? {}, ids));
  const [queue, setQueue] = useState<string[]>(() => pickSession(ids, pruneState(progress?.cards ?? {}, ids), today));
  const [position, setPosition] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [combo, setCombo] = useState(0);
  const [saved, setSaved] = useState<{streak: number} | null>(null);
  const repeated = useRef(new Set<string>());
  const pending = useRef<{state: DeckState; answered: number; correct: number} | null>(null);
  const tone = TONE_CLASSES[deck.tone];

  const done = position >= queue.length;
  const currentId = queue[position];

  useEffect(() => {
    if (!currentId) return;
    const card = cardById.get(currentId);
    if (card) setQuestion(deck.question(card, state[currentId]));
    setPicked(null);
    // The question is built once per position (the state changes when it is answered).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, position]);

  const save = useCallback(async (finalState: DeckState, answered: number, correct: number) => {
    pending.current = null;
    if (answered === 0) return;
    try {
      const result = await practiceApi.saveSession(deck.id, finalState, answered, correct);
      setSaved({streak: result.streak});
    } catch (error) {
      toast.error(errorMessage(error, "A gyakorlás eredménye nem ment el."));
    }
  }, [deck.id]);

  // Leaving half-way still saves what was answered.
  useEffect(() => () => {
    const left = pending.current;
    if (left && left.answered > 0) void practiceApi.saveSession(deck.id, left.state, left.answered, left.correct).catch(() => undefined);
  }, [deck.id]);

  const choose = (optionId: string) => {
    if (picked || !question) return;
    setPicked(optionId);
    const right = optionId === question.correct;
    const before = state[question.cardId];
    const after = answerCard(before, right, today);
    const nextState = {...state, [question.cardId]: after};
    setState(nextState);
    const nextAnswers = [...answers, {cardId: question.cardId, right, from: before?.b ?? 0, to: after.b}];
    setAnswers(nextAnswers);
    setCombo((value) => (right ? value + 1 : 0));
    // A missed card comes back once at the end of the session.
    if (!right && !repeated.current.has(question.cardId)) {
      repeated.current.add(question.cardId);
      setQueue((prev) => [...prev, question.cardId]);
    }
    pending.current = {state: nextState, answered: nextAnswers.length, correct: nextAnswers.filter((answer) => answer.right).length};
  };

  const next = useCallback(() => {
    if (!picked) return;
    const nextPosition = position + 1;
    setPosition(nextPosition);
    if (nextPosition >= queue.length && pending.current) {
      const {state: finalState, answered, correct} = pending.current;
      void save(finalState, answered, correct);
    }
  }, [picked, position, queue.length, save]);

  // Keyboard: 1-4 picks, Enter or Space continues.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (done || !question) return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      if (!picked && /^[1-4]$/.test(event.key)) {
        const option = question.options[Number(event.key) - 1];
        if (option) choose(option.id);
      } else if (picked && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const restart = () => {
    const fresh = pickSession(ids, state, today);
    repeated.current = new Set();
    setQueue(fresh);
    setPosition(0);
    setAnswers([]);
    setCombo(0);
    setSaved(null);
  };

  const right = answers.filter((answer) => answer.right).length;
  const firstTry = new Map<string, boolean>();
  for (const answer of answers) if (!firstTry.has(answer.cardId)) firstTry.set(answer.cardId, answer.right);
  // Per card: the box before its first answer against the box after its last one (a missed card
  // answered again counts once, and only when it really ended higher).
  const firstFrom = new Map<string, number>();
  const last = new Map<string, Answer>();
  for (const answer of answers) {
    if (!firstFrom.has(answer.cardId)) firstFrom.set(answer.cardId, answer.from);
    last.set(answer.cardId, answer);
  }
  const movedUp = [...last.values()].filter((answer) => answer.right && answer.to > (firstFrom.get(answer.cardId) ?? 0)).length;
  const missed = [...firstTry].filter(([, ok]) => !ok).map(([id]) => cardById.get(id)).filter(Boolean);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5" data-tour="practice-session">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onExit}><ArrowLeft/> Gyakorlás</Button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <deck.icon className={cn("size-4 shrink-0", tone.text)}/>
          <span className="truncate text-sm font-semibold text-white">{deck.label}</span>
        </div>
        {!done && combo >= 3 && (
          <span className="animate-rise inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2.5 py-1 text-xs font-semibold text-orange-200 ring-1 ring-orange-500/30">
            <Flame className="size-3.5"/> {combo} egymás után
          </span>
        )}
        <span className="text-xs text-slate-400 tabular-nums">{Math.min(position + (done ? 0 : 1), queue.length)} / {queue.length}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <div className={cn("h-full rounded-full bg-gradient-to-r transition-[width] duration-500", tone.gradient)} style={{width: `${queue.length ? (position / queue.length) * 100 : 0}%`}}/>
      </div>

      {!done && question ? (
        <div key={`${question.cardId}-${position}`} className="animate-rise space-y-4">
          <div className="panel relative overflow-hidden p-6 text-center sm:p-8">
            <div aria-hidden className={cn("pointer-events-none absolute -top-20 left-1/2 size-56 -translate-x-1/2 rounded-full opacity-30 blur-3xl", tone.soft)}/>
            <p className={cn("relative text-[11px] font-semibold tracking-[0.2em] uppercase", tone.text)}>{question.title}</p>
            <p className={cn("relative mt-3 font-semibold wrap-anywhere text-white", question.promptMono ? "font-mono text-4xl tracking-tight sm:text-5xl" : "text-xl leading-snug sm:text-2xl")}>
              {question.prompt}
            </p>
            {question.sub && <p className="relative mt-2 text-xs text-slate-500">{question.sub}</p>}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {question.options.map((option, index) => {
              const isRight = option.id === question.correct;
              const chosen = picked === option.id;
              return (
                <button key={option.id} type="button" onClick={() => choose(option.id)} disabled={!!picked} data-practice-option=""
                        className={cn("group flex min-h-16 items-center gap-3 rounded-xl px-4 py-3 text-left text-sm ring-1 transition",
                          !picked && "bg-white/[0.03] text-slate-200 ring-white/10 hover:-translate-y-0.5 hover:bg-white/[0.06] hover:ring-white/20",
                          picked && isRight && "bg-emerald-500/15 text-emerald-50 ring-emerald-500/50",
                          picked && chosen && !isRight && "auth-shake bg-red-500/15 text-red-50 ring-red-500/50",
                          picked && !isRight && !chosen && "opacity-45 ring-white/5")}>
                  <span className={cn("grid size-6 shrink-0 place-items-center rounded-md text-[11px] font-semibold ring-1",
                    picked && isRight ? "bg-emerald-500 text-[#04120c] ring-emerald-500" : "text-slate-400 ring-white/15")}>
                    {picked && isRight ? <Check className="size-3.5"/> : picked && chosen ? <X className="size-3.5"/> : index + 1}
                  </span>
                  <span className={cn("min-w-0 flex-1 wrap-anywhere", option.mono && "font-mono font-semibold")}>{option.text}</span>
                </button>
              );
            })}
          </div>
          {picked && (
            <div className={cn("animate-rise flex flex-col gap-3 rounded-xl p-4 ring-1 sm:flex-row sm:items-center",
              picked === question.correct ? "bg-emerald-500/[0.07] ring-emerald-500/25" : "bg-red-500/[0.07] ring-red-500/25")}>
              <p className="min-w-0 flex-1 text-sm wrap-anywhere text-slate-200">
                <b className={picked === question.correct ? "text-emerald-300" : "text-red-300"}>{picked === question.correct ? "Helyes! " : "Nem egészen. "}</b>
                {question.explain}
              </p>
              <Button onClick={next} className="shrink-0">Tovább <ChevronRight/></Button>
            </div>
          )}
          <p className="text-center text-[11px] text-slate-600">Billentyűzet: 1–4 a válasz, Enter a következő.</p>
        </div>
      ) : (
        <div className="panel animate-rise relative overflow-hidden p-6 text-center sm:p-8">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgb(56_189_248/0.18),transparent_60%)]"/>
          <PartyPopper className="relative mx-auto size-12 text-amber-300 motion-safe:animate-[float-y_4s_ease-in-out_infinite]"/>
          <h2 className="relative mt-3 text-2xl font-bold text-white">Kész a mai adag!</h2>
          <p className="relative mt-1 text-sm text-slate-300">{right} helyes válasz {answers.length}-ből · {movedUp} kártya lépett feljebb</p>
          {saved && saved.streak > 0 && (
            <p className="relative mt-3 inline-flex items-center gap-1.5 rounded-full bg-orange-500/15 px-3 py-1.5 text-sm font-semibold text-orange-100 ring-1 ring-orange-500/30">
              <Flame className="size-4 text-orange-300"/> {saved.streak} napos sorozat
            </p>
          )}
          {missed.length > 0 && (
            <div className="relative mx-auto mt-5 max-w-md rounded-xl bg-white/[0.03] p-3 text-left ring-1 ring-white/[0.06]">
              <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Ezeket nézd át még egyszer</p>
              <ul className="space-y-1">
                {missed.map((card) => card && (
                  <li key={card.id} className="text-xs"><span className="font-mono font-semibold text-slate-100">{card.label}</span>
                    <span className="text-slate-500"> – {card.detail}</span></li>
                ))}
              </ul>
            </div>
          )}
          <div className="relative mt-6 flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={restart}><RotateCcw/> Még egy kör</Button>
            <Button onClick={onExit}><TrendingUp/> Vissza az áttekintéshez</Button>
          </div>
        </div>
      )}
    </div>
  );
}
