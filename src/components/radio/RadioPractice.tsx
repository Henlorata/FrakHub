import {useMemo, useState} from "react";
import {Check, Copy, Flame, Radio, RotateCcw, Shuffle, Trophy, X} from "lucide-react";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {BASIC_CODES, DIVISION_NUMBERS, TEN_CODES, UNIT_TYPES, type RadioTerm} from "@/data/radio-codes";
import {cn} from "@/lib/utils";

/**
 * Radio practice shared by the onboarding page's practice corner and the code book (Kódtár):
 * static data only, no request.
 */

// --- Radio code quiz -------------------------------------------------------------

const DECKS: {value: string; label: string; terms: RadioTerm[]}[] = [
  {value: "ten", label: "10-es kódok", terms: TEN_CODES},
  {value: "codes", label: "Alapkódok", terms: BASIC_CODES},
  {value: "units", label: "Egységjelek", terms: UNIT_TYPES.map((unit) => ({code: `${unit.code} (${unit.short})`, meaning: unit.meaning}))},
  {value: "divisions", label: "Divízió számok", terms: DIVISION_NUMBERS.map((item) => ({code: `${item.code}-os`, meaning: item.meaning}))},
];
const BEST_KEY = "frakhub.onboarding.quiz.best";

const shuffle = <T,>(items: T[]) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

interface Question {
  term: RadioTerm;
  options: RadioTerm[];
  reverse: boolean;
}

function makeQuestion(terms: RadioTerm[], previous?: RadioTerm): Question {
  const pool = terms.length > 1 && previous ? terms.filter((term) => term.code !== previous.code) : terms;
  const term = pool[Math.floor(Math.random() * pool.length)];
  const others = shuffle(terms.filter((item) => item.code !== term.code)).slice(0, Math.min(3, terms.length - 1));
  return {term, options: shuffle([term, ...others]), reverse: Math.random() < 0.35};
}

/** Radio code quiz: code to meaning and back, with streak and best score (kept in the browser). */
export function RadioQuiz() {
  const [deck, setDeck] = useState(DECKS[0].value);
  const terms = useMemo(() => (deck === "all" ? DECKS.flatMap((item) => item.terms) : DECKS.find((item) => item.value === deck)!.terms), [deck]);
  const [question, setQuestion] = useState(() => makeQuestion(DECKS[0].terms));
  const [picked, setPicked] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState({right: 0, total: 0});
  const [best, setBest] = useState(() => Number(localStorage.getItem(BEST_KEY) ?? 0));

  const pickDeck = (value: string) => {
    setDeck(value);
    const nextTerms = value === "all" ? DECKS.flatMap((item) => item.terms) : DECKS.find((item) => item.value === value)!.terms;
    setQuestion(makeQuestion(nextTerms));
    setPicked(null);
  };

  const answer = (option: RadioTerm) => {
    if (picked) return;
    setPicked(option.code);
    const right = option.code === question.term.code;
    setScore((current) => ({right: current.right + (right ? 1 : 0), total: current.total + 1}));
    const nextStreak = right ? streak + 1 : 0;
    setStreak(nextStreak);
    if (nextStreak > best) {
      setBest(nextStreak);
      localStorage.setItem(BEST_KEY, String(nextStreak));
    }
  };

  const next = () => {
    setQuestion(makeQuestion(terms, question.term));
    setPicked(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {[...DECKS, {value: "all", label: "Mind", terms: []}].map((item) => (
          <button key={item.value} type="button" onClick={() => pickDeck(item.value)}
                  className={cn("h-7 rounded-full px-3 text-xs ring-1 transition",
                    deck === item.value ? "bg-sky-500/15 text-sky-100 ring-sky-500/40" : "text-slate-400 ring-white/10 hover:text-white")}>
            {item.label}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1"><Flame className={cn("size-3.5", streak > 2 ? "text-orange-400" : "text-slate-600")}/>{streak}</span>
          <span className="flex items-center gap-1"><Trophy className="size-3.5 text-amber-300"/>{best}</span>
          <span className="tabular-nums" data-quiz-score="">{score.right}/{score.total}</span>
        </span>
      </div>

      <div key={`${question.term.code}-${score.total}`} className="animate-rise rounded-2xl bg-gradient-to-br from-sky-500/10 via-transparent to-transparent p-5 ring-1 ring-sky-500/20">
        <p className="text-[11px] tracking-widest text-sky-300/80 uppercase">{question.reverse ? "Melyik kód jelenti ezt?" : "Mit jelent?"}</p>
        <p className={cn("mt-2 font-semibold text-white", question.reverse ? "text-lg leading-snug" : "font-mono text-3xl tracking-tight")}>
          {question.reverse ? question.term.meaning : question.term.code}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {question.options.map((option) => {
          const right = option.code === question.term.code;
          const chosen = picked === option.code;
          return (
            <button key={option.code} type="button" onClick={() => answer(option)} disabled={!!picked} data-quiz-option=""
                    className={cn("flex min-h-14 items-center gap-3 rounded-xl px-4 py-3 text-left text-sm ring-1 transition",
                      !picked && "bg-white/[0.03] text-slate-200 ring-white/10 hover:bg-white/[0.06] hover:ring-white/20",
                      picked && right && "bg-emerald-500/15 text-emerald-100 ring-emerald-500/50",
                      picked && chosen && !right && "auth-shake bg-red-500/15 text-red-100 ring-red-500/50",
                      picked && !right && !chosen && "opacity-50 ring-white/5")}>
              <span className={cn("min-w-0 flex-1 wrap-anywhere", !question.reverse ? "" : "font-mono font-semibold")}>
                {question.reverse ? option.code : option.meaning}
              </span>
              {picked && right && <Check className="size-4 shrink-0 text-emerald-300"/>}
              {picked && chosen && !right && <X className="size-4 shrink-0 text-red-300"/>}
            </button>
          );
        })}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => {
          setScore({right: 0, total: 0});
          setStreak(0);
          next();
        }}><RotateCcw className="size-4"/> Újrakezdés</Button>
        <Button size="sm" onClick={next} disabled={!picked} className="bg-sky-600 text-white hover:bg-sky-500"><Shuffle className="size-4"/> Következő</Button>
      </div>
    </div>
  );
}

// --- Call sign builder ---------------------------------------------------------------

/** Builds a call sign and shows the usual radio messages with it. */
export function CallSignBuilder() {
  const [division, setDivision] = useState("6");
  const [unit, setUnit] = useState("A");
  const [plate, setPlate] = useState("029");
  const [place, setPlace] = useState("Downtown");
  const [car, setCar] = useState({color: "kék", make: "BMW", model: "X5", plate: "ABC-123", people: "két fő"});
  const sign = `${division}${unit}${plate.replace(/\D/g, "").padStart(3, "0").slice(-3)}`;

  const messages = [
    {title: "Járőrszolgálat", text: `${sign} 10-20 ${place}, járőrszolgálat teljesítése, az egység 10-98.`},
    {title: "Elfoglalt egység", text: `${sign} 10-20 Repair Co., szereltetés, 10-6.`},
    {title: "Igazoltatás", text: `${sign} 10-20 ${place}. Igazoltatás: ${car.color} színű, ${car.make} ${car.model}, rsz: ${car.plate}, ${car.people}. Az egység 10-6.`},
    {title: "Reagálás riasztásra", text: `${sign} fogadja a hívást, reagál rá, CODE 3.`},
  ];

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Vágólapra másolva.");
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="space-y-4">
        <div className="flex items-center justify-center rounded-2xl bg-black/30 py-6 ring-1 ring-white/10">
          <span className="font-mono text-5xl font-black tracking-[0.15em] text-amber-200 drop-shadow-[0_0_18px_rgb(245_158_11/0.4)]">
            <span className="text-sky-300">{division}</span><span className="text-amber-300">{unit}</span>{sign.slice(division.length + unit.length)}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-slate-400">
          <span><span className="block font-semibold text-sky-300">Divízió</span>{DIVISION_NUMBERS.find((item) => item.code === division)?.meaning.split(" (")[0]}</span>
          <span><span className="block font-semibold text-amber-300">Egység</span>{UNIT_TYPES.find((item) => item.short === unit)?.code}</span>
          <span><span className="block font-semibold text-slate-200">Szám</span>a rendszám számjegyei</span>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-slate-500">Divízió</p>
          <div className="flex flex-wrap gap-1.5">
            {DIVISION_NUMBERS.slice(0, 2).map((item) => (
              <button key={item.code} type="button" onClick={() => setDivision(item.code)}
                      className={cn("h-8 rounded-lg px-3 text-xs ring-1", division === item.code ? "bg-sky-500/15 text-sky-100 ring-sky-500/40" : "text-slate-400 ring-white/10")}>
                {item.code} · {item.meaning.split(" (")[0]}
              </button>
            ))}
          </div>
          <p className="pt-1 text-xs text-slate-500">Egység típusa</p>
          <div className="flex flex-wrap gap-1.5">
            {UNIT_TYPES.map((item) => (
              <button key={item.short} type="button" onClick={() => setUnit(item.short)} title={item.meaning}
                      className={cn("h-8 rounded-lg px-2.5 font-mono text-xs ring-1", unit === item.short ? "bg-amber-500/15 text-amber-100 ring-amber-500/40" : "text-slate-400 ring-white/10")}>
                {item.short}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <label className="space-y-1 text-xs text-slate-500">Rendszám számjegyei
              <Input value={plate} maxLength={3} onChange={(event) => setPlate(event.target.value.replace(/\D/g, ""))} className="h-9 font-mono"/>
            </label>
            <label className="space-y-1 text-xs text-slate-500">Helyszín
              <Input value={place} maxLength={40} onChange={(event) => setPlace(event.target.value)} className="h-9"/>
            </label>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10">
          <p className="mb-2 text-xs text-slate-400">Igazoltatott jármű (sorrend: szín, márka, típus, rendszám, utasok)</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(["color", "make", "model", "plate", "people"] as const).map((field) => (
              <Input key={field} value={car[field]} maxLength={24} onChange={(event) => setCar({...car, [field]: event.target.value})}
                     className="h-8 text-xs" aria-label={field}/>
            ))}
          </div>
        </div>
        {messages.map((message) => (
          <div key={message.title} className="group flex items-start gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10">
            <Radio className="mt-0.5 size-4 shrink-0 text-emerald-300"/>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] tracking-wider text-slate-500 uppercase">{message.title}</p>
              <p className="mt-0.5 font-mono text-sm text-slate-100 wrap-anywhere">„{message.text}”</p>
            </div>
            <button type="button" onClick={() => void copy(message.text)} aria-label="Másolás"
                    className="rounded-md p-1.5 text-slate-500 opacity-0 transition group-hover:opacity-100 hover:bg-white/10 hover:text-white focus:opacity-100">
              <Copy className="size-4"/>
            </button>
          </div>
        ))}
        <p className="text-xs text-slate-500">ADAM egységben mindig az anyósülésen ülő rádiózik, legalább 5 percenként.</p>
      </div>
    </div>
  );
}
