import {useEffect, useState} from "react";
import {Link} from "react-router";
import {toast} from "sonner";
import {ArrowLeft, Award, CheckCircle2, ChevronRight, CircleAlert, Loader2, RotateCcw, Route, ThumbsUp, XCircle} from "lucide-react";
import {Button} from "@/components/ui/button";
import {EmptyState} from "@/components/layout/EmptyState";
import {practiceApi, SCENARIO_CATEGORIES, type RunResult, type Scenario, type ScenarioChoice, type Verdict} from "@/lib/practice/api";
import {cn, errorMessage} from "@/lib/utils";

const VERDICT: Record<Verdict, {label: string; tone: string; icon: typeof CheckCircle2}> = {
  good: {label: "Jó döntés", tone: "bg-emerald-500/[0.08] text-emerald-100 ring-emerald-500/30", icon: CheckCircle2},
  ok: {label: "Elfogadható", tone: "bg-amber-500/[0.08] text-amber-100 ring-amber-500/30", icon: CircleAlert},
  bad: {label: "Rossz döntés", tone: "bg-red-500/[0.08] text-red-100 ring-red-500/30", icon: XCircle},
};

interface Step {
  node: string;
  choice: ScenarioChoice;
}

/**
 * Plays a branching scenario: a situation, a few choices, feedback on each decision, until an
 * ending. Only the chosen path is sent when it ends; the server scores it (and issues the
 * certificate of a published scenario that was passed).
 */
export function ScenarioPlayer({id, onExit}: {id: string; onExit: () => void}) {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [node, setNode] = useState<string>("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [pending, setPending] = useState<ScenarioChoice | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    practiceApi.scenario(id).then((loaded) => {
      setScenario(loaded);
      setNode(loaded.start_node);
    }).catch((error) => setFailed(errorMessage(error, "A gyakorlat nem tölthető be.")));
  }, [id]);

  if (failed) return <EmptyState icon={Route} title={failed} action={<Button variant="outline" onClick={onExit}>Vissza</Button>}/>;
  if (!scenario) return <div className="mx-auto max-w-3xl space-y-4"><div className="skeleton h-12"/><div className="skeleton h-72"/></div>;

  const current = scenario.nodes[node];
  const ending = !!current && (!current.choices || current.choices.length === 0);

  const choose = (choice: ScenarioChoice) => {
    if (pending) return;
    setPending(choice);
  };
  const proceed = async () => {
    if (!pending) return;
    const nextSteps = [...steps, {node, choice: pending}];
    setSteps(nextSteps);
    if (pending.next) {
      setPending(null);
      setNode(pending.next);
      window.scrollTo({top: 0, behavior: "smooth"});
    } else {
      // The choice itself ends the scenario: the feedback stays until the result arrives.
      await finish(nextSteps);
      setPending(null);
    }
  };
  const finish = async (path: Step[]) => {
    setSubmitting(true);
    try {
      setResult(await practiceApi.submitRun(scenario.id, path.map((step) => step.choice.id)));
    } catch (error) {
      toast.error(errorMessage(error, "Az eredmény nem ment el."));
    } finally {
      setSubmitting(false);
    }
  };
  const restart = () => {
    setNode(scenario.start_node);
    setSteps([]);
    setPending(null);
    setResult(null);
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5" data-tour="practice-scenario">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onExit}><ArrowLeft/> Gyakorlás</Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{scenario.title}</p>
          <p className="text-[11px] text-slate-500">
            {SCENARIO_CATEGORIES[scenario.category]} · {ending || result ? `vége, ${steps.length} döntés` : `${steps.length + 1}. döntés`}
          </p>
        </div>
      </div>

      {result ? (
        <ResultCard scenario={scenario} result={result} steps={steps} onRestart={restart} onExit={onExit}/>
      ) : current ? (
        <div key={node} className="animate-rise space-y-4">
          {ending ? (
            <div className="panel p-6 text-center sm:p-8">
              <Route className="mx-auto size-10 text-cyan-300"/>
              <h2 className="mt-3 text-xl font-semibold text-white">{current.end?.title ?? "Vége"}</h2>
              {(current.end?.text ?? current.text) && <p className="mt-2 text-sm text-slate-300">{current.end?.text ?? current.text}</p>}
              <Button className="mt-5" disabled={submitting} onClick={() => void finish(steps)}>
                {submitting ? <Loader2 className="animate-spin"/> : <Award/>} Eredmény
              </Button>
            </div>
          ) : (
            <>
              <div className="panel relative overflow-hidden p-6 sm:p-7">
                <div aria-hidden className="pointer-events-none absolute -top-24 -left-10 size-60 rounded-full bg-cyan-500/10 blur-3xl"/>
                <p className="relative text-[11px] font-semibold tracking-[0.2em] text-cyan-300/80 uppercase">Helyzet</p>
                <p className="relative mt-2 text-base leading-relaxed whitespace-pre-wrap wrap-anywhere text-white sm:text-lg">{current.text}</p>
              </div>
              <div className="space-y-2">
                {(current.choices ?? []).map((choice, index) => {
                  const chosen = pending?.id === choice.id;
                  return (
                    <button key={choice.id} type="button" disabled={!!pending} onClick={() => choose(choice)}
                            className={cn("flex w-full items-start gap-3 rounded-xl px-4 py-3 text-left text-sm ring-1 transition",
                              !pending && "bg-white/[0.03] text-slate-100 ring-white/10 hover:-translate-y-0.5 hover:bg-white/[0.06] hover:ring-white/20",
                              chosen && VERDICT[choice.verdict].tone, pending && !chosen && "opacity-40 ring-white/5")}>
                      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md text-[11px] font-semibold text-slate-400 ring-1 ring-white/15">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className="min-w-0 flex-1 wrap-anywhere">{choice.text}</span>
                    </button>
                  );
                })}
              </div>
              {pending && (() => {
                const look = VERDICT[pending.verdict];
                return (
                  <div className={cn("animate-rise flex flex-col gap-3 rounded-xl p-4 ring-1 sm:flex-row sm:items-center", look.tone)}>
                    <look.icon className="size-6 shrink-0"/>
                    <p className="min-w-0 flex-1 text-sm wrap-anywhere"><b>{look.label}.</b> {pending.feedback}</p>
                    <Button className="shrink-0" disabled={submitting} onClick={() => void proceed()}>
                      {submitting ? <Loader2 className="animate-spin"/> : null}{pending.next ? <>Tovább <ChevronRight/></> : "Eredmény"}
                    </Button>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      ) : (
        <EmptyState icon={Route} title="Ez a lépés hiányzik a gyakorlatból." action={<Button variant="outline" onClick={restart}>Újrakezdés</Button>}/>
      )}
    </div>
  );
}

function ResultCard({scenario, result, steps, onRestart, onExit}: {
  scenario: Scenario;
  result: RunResult;
  steps: Step[];
  onRestart: () => void;
  onExit: () => void;
}) {
  const radius = 54;
  const length = 2 * Math.PI * radius;
  return (
    <div className="animate-rise space-y-4">
      <div className="panel relative overflow-hidden p-6 text-center sm:p-8">
        <div aria-hidden className={cn("pointer-events-none absolute inset-0", result.passed
          ? "bg-[radial-gradient(circle_at_50%_0%,rgb(16_185_129/0.2),transparent_60%)]" : "bg-[radial-gradient(circle_at_50%_0%,rgb(245_158_11/0.15),transparent_60%)]")}/>
        <div className="relative mx-auto grid size-36 place-items-center">
          <svg viewBox="0 0 120 120" className="absolute inset-0 size-full -rotate-90" aria-hidden>
            <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="8" className="stroke-white/[0.07]"/>
            <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="8" strokeLinecap="round" strokeDasharray={length}
                    strokeDashoffset={length * (1 - result.percent / 100)}
                    className={cn("transition-[stroke-dashoffset] duration-1000", result.passed ? "stroke-emerald-400" : "stroke-amber-400")}/>
          </svg>
          <div>
            <p className="text-4xl font-black text-white tabular-nums">{result.percent}%</p>
            <p className="text-xs text-slate-400">{result.score} / {result.max_score} pont</p>
          </div>
        </div>
        <h2 className="relative mt-4 text-xl font-bold text-white">{result.passed ? "Sikeresen teljesítetted!" : "Ezúttal nem sikerült"}</h2>
        <p className="relative mt-1 text-sm text-slate-300">
          {result.passed ? "Szép munka: jól döntöttél a fontos pillanatokban." : `A sikerhez ${scenario.pass_percent}% kell. Nézd át a visszajelzéseket, és próbáld újra!`}
        </p>
        {result.certificate && (
          <Link to={`/certificates/${result.certificate}`}
                className="relative mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-100 ring-1 ring-amber-500/30 hover:bg-amber-500/20">
            <Award className="size-4"/> Oklevél: <span className="font-mono">{result.certificate}</span>
          </Link>
        )}
        <p className="relative mt-3 text-[11px] text-slate-500">Eddigi legjobb: {result.best.best_percent}% · {result.best.attempts}. próbálkozás</p>
      </div>
      <section className="panel p-5">
        <h3 className="mb-3 text-sm font-semibold text-white">A döntéseid</h3>
        <ol className="space-y-2">
          {steps.map((step, index) => {
            const look = VERDICT[step.choice.verdict];
            return (
              <li key={`${step.node}-${index}`} className={cn("flex items-start gap-3 rounded-xl p-3 text-sm ring-1", look.tone)}>
                <look.icon className="mt-0.5 size-4 shrink-0"/>
                <div className="min-w-0 flex-1">
                  <p className="wrap-anywhere">{step.choice.text}</p>
                  {step.choice.feedback && <p className="mt-0.5 text-xs opacity-80 wrap-anywhere">{step.choice.feedback}</p>}
                </div>
                <span className="shrink-0 text-xs font-semibold tabular-nums">+{step.choice.points}</span>
              </li>
            );
          })}
        </ol>
      </section>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" onClick={onRestart}><RotateCcw/> Újra</Button>
        <Button onClick={onExit}><ThumbsUp/> Vissza a gyakorláshoz</Button>
      </div>
    </div>
  );
}
