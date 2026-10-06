import {useCallback, useEffect, useMemo, useState, type CSSProperties} from "react";
import {Link, useSearchParams} from "react-router";
import {
  Award, BrainCircuit, ChevronRight, Flame, GraduationCap, Pencil, Play, Plus, Route, Sparkles, Target, Trophy, Users, X,
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {PageHeader, TONE_CLASSES} from "@/components/layout/PageHeader";
import {EmptyState} from "@/components/layout/EmptyState";
import {practiceApi, SCENARIO_CATEGORIES, type PracticeOverview, type ScenarioSummary} from "@/lib/practice/api";
import {DECK_ORDER, DECKS, type DeckId} from "@/lib/practice/decks";
import {addDays, deckStats, weakSpots} from "@/lib/practice/srs";
import {formatDate} from "@/lib/datetime";
import {cn} from "@/lib/utils";
import {DeckSession} from "./DeckSession";
import {ScenarioPlayer} from "./ScenarioPlayer";
import {ScenarioEditor} from "./ScenarioEditor";

/** Heat steps for the activity grid on the dark surface (sequential blue: brighter = more practice). */
const HEAT = ["rgb(255 255 255 / 0.05)", "#184f95", "#256abf", "#3987e5", "#6da7ec", "#9ec5f4"];
const heatStep = (answered: number) => (answered <= 0 ? 0 : answered < 10 ? 1 : answered < 20 ? 2 : answered < 40 ? 3 : answered < 80 ? 4 : 5);

/**
 * Optional training: spaced-repetition decks (radio codes, the penal code) with a daily streak and
 * weak spots, and branching scenarios written by the instructors (scored on the server, a passed
 * published scenario gives a certificate).
 */
export function PracticePage() {
  const [params, setParams] = useSearchParams();
  const [overview, setOverview] = useState<PracticeOverview | null>(null);
  const [failed, setFailed] = useState(false);
  const deck = params.get("deck") as DeckId | null;
  const scenario = params.get("scenario");
  const edit = params.get("edit");

  const load = useCallback(async () => {
    try {
      setOverview(await practiceApi.overview());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const back = useCallback(() => {
    setParams({});
    void load();
  }, [load, setParams]);

  if (failed) return <EmptyState icon={X} title="A gyakorlás nem tölthető be." action={<Button variant="outline" onClick={() => void load()}>Újra</Button>}/>;
  if (!overview) return <div className="mx-auto max-w-[1440px] space-y-4"><div className="skeleton h-40"/><div className="grid gap-4 md:grid-cols-2"><div className="skeleton h-56"/><div className="skeleton h-56"/></div></div>;

  if (deck && DECKS[deck]) {
    return <DeckSession deck={DECKS[deck]} progress={overview.decks[deck] ?? null} today={overview.today} onExit={back}/>;
  }
  if (scenario) return <ScenarioPlayer id={scenario} onExit={back}/>;
  if (edit && overview.can_edit) return <ScenarioEditor id={edit === "new" ? null : edit} onExit={back} onPlay={(id) => setParams({scenario: id})}/>;

  return <Overview overview={overview} onDeck={(id) => setParams({deck: id})} onScenario={(id) => setParams({scenario: id})}
                   onEdit={(id) => setParams({edit: id ?? "new"})}/>;
}

function Overview({overview, onDeck, onScenario, onEdit}: {
  overview: PracticeOverview;
  onDeck: (id: DeckId) => void;
  onScenario: (id: string) => void;
  onEdit: (id: string | null) => void;
}) {
  const today = overview.today;
  const practisedToday = overview.days.find((day) => day.day === today);
  const totalAnswered = Object.values(overview.decks).reduce((sum, deck) => sum + (deck?.answered ?? 0), 0);
  const totalCorrect = Object.values(overview.decks).reduce((sum, deck) => sum + (deck?.correct ?? 0), 0);

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6">
      <PageHeader icon={BrainCircuit} tone="cyan" eyebrow="Oktatás" title="Gyakorlás"
                  description="Rövid, napi gyakorlás: amit tudsz, ritkábban jön elő, amit elfelejtesz, hamarosan újra. Nem kötelező, de látszik az eredménye."
                  actions={<Button variant="outline" asChild><Link to="/profile?tab=certificates"><Award/> Okleveleim ({overview.certificates})</Link></Button>}/>

      <section className="panel animate-rise relative overflow-hidden p-5 md:p-6" data-tour="practice-streak">
        <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 size-64 rounded-full bg-orange-500/10 blur-3xl"/>
        <div className="relative grid grid-cols-1 gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
          <div className="flex items-center gap-5">
            <div className="relative grid size-24 shrink-0 place-items-center">
              <div className={cn("absolute inset-0 rounded-full blur-xl", overview.streak > 0 ? "bg-orange-500/30 motion-safe:animate-[backdrop-breathe_4s_ease-in-out_infinite]" : "bg-white/5")}/>
              <Flame className={cn("relative size-16", overview.streak > 0 ? "fill-orange-500/30 text-orange-400 drop-shadow-[0_0_18px_rgb(249_115_22/0.6)]" : "text-slate-600")}/>
            </div>
            <div>
              <p className="text-4xl font-black tracking-tight text-white tabular-nums">{overview.streak}<span className="ml-1 text-lg font-semibold text-slate-400">nap</span></p>
              <p className="text-sm text-slate-300">{overview.streak === 0 ? "Kezdj el egy sorozatot ma!" : practisedToday ? "A mai nap megvan. Holnap is jössz?" : "Ma még nem gyakoroltál: tartsd meg a sorozatot!"}</p>
              <p className="mt-1 text-xs text-slate-500">Leghosszabb sorozat: {overview.best_streak} nap · összesen {totalAnswered} válasz, {totalAnswered ? Math.round((totalCorrect / totalAnswered) * 100) : 0}% helyes</p>
            </div>
          </div>
          <ActivityGrid days={overview.days} today={today}/>
        </div>
      </section>

      <section aria-labelledby="decks-title">
        <h2 id="decks-title" className="mb-3 px-1 text-sm font-semibold text-slate-300">Kártyacsomagok</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2" data-tour="practice-decks">
          {DECK_ORDER.map((id, index) => {
            const deck = DECKS[id];
            const state = overview.decks[id]?.cards ?? {};
            const stats = deckStats(deck.cards.map((card) => card.id), state, today);
            const weak = weakSpots(state, 4).map((cardId) => deck.cards.find((card) => card.id === cardId)).filter(Boolean);
            const tone = TONE_CLASSES[deck.tone];
            return (
              <article key={id} className="panel animate-rise flex min-w-0 flex-col p-5" style={{"--i": index} as CSSProperties}>
                <header className="flex items-start gap-4">
                  <MasteryRing value={stats.mastery} tone={deck.tone}><deck.icon className={cn("size-6", tone.text)}/></MasteryRing>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-white">{deck.label}</h3>
                    <p className="text-xs text-slate-400">{deck.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                      <span className={cn("rounded-full px-2 py-0.5 ring-1", stats.due ? "bg-amber-500/10 text-amber-200 ring-amber-500/25" : "bg-white/5 text-slate-400 ring-white/10")}>
                        {stats.due} esedékes
                      </span>
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-slate-400 ring-1 ring-white/10">{stats.fresh} új</span>
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-200 ring-1 ring-emerald-500/25">{stats.learnt}/{stats.total} megy</span>
                    </div>
                  </div>
                </header>
                {weak.length > 0 && (
                  <div className="mt-4 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/[0.06]">
                    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-slate-400 uppercase"><Target className="size-3.5 text-rose-300"/> Gyenge pontok</p>
                    <ul className="space-y-1">
                      {weak.map((card) => card && (
                        <li key={card.id} className="flex min-w-0 gap-2 text-xs">
                          <span className="shrink-0 font-mono font-semibold text-slate-100">{card.label}</span>
                          <span className="min-w-0 truncate text-slate-500">{card.detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="mt-auto flex items-center gap-2 pt-4">
                  <p className="min-w-0 flex-1 text-[11px] text-slate-500">
                    {overview.decks[id]?.sessions ? `${overview.decks[id]?.sessions} alkalom · utoljára ${formatDate(overview.decks[id]!.updated_at)}` : "Még nem gyakoroltad."}
                  </p>
                  <Button onClick={() => onDeck(id)} data-tour={`practice-deck-${id}`}><Play/> {stats.due || stats.fresh ? "Gyakorlás" : "Ismétlés"}</Button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="scenarios-title">
        <div className="mb-3 flex items-center gap-2 px-1">
          <h2 id="scenarios-title" className="text-sm font-semibold text-slate-300">Szituációs gyakorlatok</h2>
          <span className="text-xs text-slate-500">· döntések egy helyzetben, mindegyikre visszajelzéssel</span>
          {overview.can_edit && <Button size="sm" variant="outline" className="ml-auto" onClick={() => onEdit(null)}><Plus/> Új gyakorlat</Button>}
        </div>
        {overview.scenarios.length === 0 ? (
          <div className="panel"><EmptyState icon={Route} title="Még nincs szituációs gyakorlat." description="Az oktatók írhatnak ilyet: helyzet, döntések, visszajelzés."/></div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" data-tour="practice-scenarios">
            {overview.scenarios.map((item, index) => (
              <ScenarioCard key={item.id} item={item} index={index} canEdit={overview.can_edit} onPlay={() => onScenario(item.id)} onEdit={() => onEdit(item.id)}/>
            ))}
          </div>
        )}
      </section>

      <p className="flex items-center justify-center gap-2 pb-2 text-xs text-slate-500">
        <Trophy className="size-3.5 text-amber-300"/> A gyakorlással töltött napok a <Link to="/leaderboard" className="text-slate-300 hover:text-white">ranglistán</Link> is számítanak.
      </p>
    </div>
  );
}

function MasteryRing({value, tone, children}: {value: number; tone: keyof typeof TONE_CLASSES; children: React.ReactNode}) {
  const radius = 26;
  const length = 2 * Math.PI * radius;
  return (
    <div className="relative grid size-16 shrink-0 place-items-center" title={`${Math.round(value * 100)}% megy`}>
      <svg viewBox="0 0 60 60" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle cx="30" cy="30" r={radius} fill="none" strokeWidth="4" className="stroke-white/[0.07]"/>
        <circle cx="30" cy="30" r={radius} fill="none" strokeWidth="4" strokeLinecap="round" strokeDasharray={length}
                strokeDashoffset={length * (1 - Math.max(0.02, value))} className={cn("transition-[stroke-dashoffset] duration-1000", TONE_CLASSES[tone].text)}
                stroke="currentColor"/>
      </svg>
      {children}
    </div>
  );
}

/** Six weeks of practice, Monday to Sunday (tooltips give the exact answers). */
function ActivityGrid({days, today}: {days: PracticeOverview["days"]; today: string}) {
  const byDay = useMemo(() => new Map(days.map((day) => [day.day, day])), [days]);
  // Start on the Monday five weeks before this week.
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const start = addDays(today, -weekday - 35);
  const cells = Array.from({length: 42}, (_, index) => addDays(start, index));
  return (
    <div className="min-w-0 lg:justify-self-end">
      <div className="flex items-end justify-between gap-6">
        <p className="text-xs font-medium text-slate-300">Az utolsó hat hét</p>
        <div className="flex items-center gap-1 text-[10px] text-slate-500" aria-hidden>
          Kevesebb {HEAT.map((color) => <span key={color} className="size-2.5 rounded-sm" style={{background: color}}/>)} Több
        </div>
      </div>
      <div className="mt-2 grid w-max auto-cols-[16px] grid-flow-col grid-rows-7 gap-1 sm:auto-cols-[18px] sm:gap-1.5" role="img"
           aria-label="Gyakorlási napok az utolsó hat hétben">
        {cells.map((day) => {
          const entry = byDay.get(day);
          const future = day > today;
          return (
            <span key={day} title={future ? undefined : `${formatDate(day)}: ${entry ? `${entry.answered} válasz, ${entry.correct} helyes` : "nem gyakoroltál"}`}
                  className={cn("size-4 rounded-[4px] transition-transform hover:scale-125 sm:size-[18px]", day === today && "ring-1 ring-white/60", future && "opacity-0")}
                  style={{background: HEAT[heatStep(entry?.answered ?? 0)]}}/>
          );
        })}
      </div>
    </div>
  );
}

const DIFFICULTY = ["", "Könnyű", "Közepes", "Nehéz"];

function ScenarioCard({item, index, canEdit, onPlay, onEdit}: {item: ScenarioSummary; index: number; canEdit: boolean; onPlay: () => void; onEdit: () => void}) {
  const result = item.result;
  return (
    <article className="panel lift animate-rise flex min-w-0 flex-col p-4" style={{"--i": index} as CSSProperties}>
      <div className="flex items-center gap-2 text-[11px]">
        <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-cyan-200 ring-1 ring-cyan-500/25">{SCENARIO_CATEGORIES[item.category]}</span>
        <span className="flex items-center gap-0.5 text-slate-400" title={DIFFICULTY[item.difficulty]}>
          {[1, 2, 3].map((step) => <span key={step} className={cn("size-1.5 rounded-full", step <= item.difficulty ? "bg-cyan-300" : "bg-white/10")}/>)}
          <span className="ml-1">{DIFFICULTY[item.difficulty]}</span>
        </span>
        {!item.published && <span className="ml-auto rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-200 ring-1 ring-amber-500/25">Rejtett</span>}
      </div>
      <h3 className="mt-2 text-sm font-semibold wrap-anywhere text-white">{item.title}</h3>
      {item.summary && <p className="mt-1 line-clamp-2 text-xs text-slate-400">{item.summary}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
        <span>{item.steps} lépés · {item.pass_percent}% a sikerhez</span>
        {result && (
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1", result.passed ? "bg-emerald-500/10 text-emerald-200 ring-emerald-500/25" : "bg-white/5 text-slate-300 ring-white/10")}>
            {result.passed ? <Sparkles className="size-3"/> : <GraduationCap className="size-3"/>} legjobb: {result.best_percent}%
          </span>
        )}
        {canEdit && item.stats && <span className="inline-flex items-center gap-1"><Users className="size-3"/>{item.stats.passed}/{item.stats.players} teljesítette</span>}
      </div>
      <div className="mt-auto flex items-center gap-2 pt-4">
        {canEdit && <Button size="sm" variant="ghost" onClick={onEdit}><Pencil/> Szerkesztés</Button>}
        <Button size="sm" className="ml-auto" onClick={onPlay}>{result ? "Újra" : "Kezdés"} <ChevronRight/></Button>
      </div>
    </article>
  );
}
