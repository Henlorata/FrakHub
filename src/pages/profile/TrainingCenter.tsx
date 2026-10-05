import {useEffect, useState, type CSSProperties} from "react";
import {CheckCircle2, Clock, FlaskConical, Lock, Play, RotateCcw, SkipForward} from "lucide-react";
import {Button} from "@/components/ui/button";
import {useAuth} from "@/context/AuthContext";
import {useTraining} from "@/context/TrainingContext";
import {formatDate} from "@/lib/datetime";
import {TONE_STYLES, TRAININGS} from "@/lib/training/catalog";
import {cn} from "@/lib/utils";

/** The trainings of the member: status, replay, and the locked ones with what unlocks them. */
export function TrainingCenter() {
  const {profile} = useAuth();
  const {trainings, progress, refreshProgress, start, busy} = useTraining();
  const [loaded, setLoaded] = useState(false);

  // The dates come from the database (the local copy may be from another device's start).
  useEffect(() => {
    refreshProgress().catch(() => undefined).finally(() => setLoaded(true));
  }, [refreshProgress]);

  if (!profile) return null;
  const available = new Set(trainings.map((training) => training.id));
  const done = trainings.filter((training) => progress[training.id]?.status === "completed").length;

  return (
    <div data-tour="profile-trainings" className="space-y-5">
      <section className="panel animate-rise flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/25">
          <FlaskConical className="size-6"/>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-white">Képzések</h2>
          <p className="text-sm text-slate-400">
            Rövid, kattintós bemutatók gyakorló módban: bemutató adatokkal dolgozol, semmi sem mentődik. Bármikor újrajátszhatod őket.
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-semibold text-white tabular-nums">{done}<span className="text-base text-slate-500">/{trainings.length}</span></p>
          <p className="text-xs text-slate-500">teljesítve</p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {TRAININGS.map((training, index) => {
          const unlocked = available.has(training.id);
          const record = progress[training.id];
          const tone = TONE_STYLES[training.tone];
          const outdated = !!record && record.version < training.version;
          return (
            <article key={training.id} style={{"--i": index} as CSSProperties}
                     className={cn("panel animate-rise relative flex min-w-0 flex-col overflow-hidden p-5", unlocked ? "lift" : "opacity-55")}>
              <span className={cn("absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r", unlocked ? tone.bar : "from-slate-600 to-slate-700")}/>
              <div className="flex items-start gap-3">
                <div className={cn("grid size-11 shrink-0 place-items-center rounded-xl ring-1", unlocked ? tone.tile : "bg-white/[0.03] text-slate-500 ring-white/10")}>
                  {unlocked ? <training.icon className="size-5"/> : <Lock className="size-5"/>}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-white wrap-anywhere">{training.title}</h3>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500"><Clock className="size-3"/> kb. {training.minutes} perc</p>
                </div>
              </div>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-400 wrap-anywhere">{training.summary}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {!unlocked ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-1 text-xs text-slate-400 ring-1 ring-white/10">
                    <Lock className="size-3"/> {training.requirement}
                  </span>
                ) : (
                  <>
                    {record?.status === "completed" && !outdated ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300 ring-1 ring-emerald-500/25">
                        <CheckCircle2 className="size-3.5"/> Teljesítve · {formatDate(record.updated_at)}
                      </span>
                    ) : record?.status === "skipped" && !outdated ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs text-amber-200 ring-1 ring-amber-500/25">
                        <SkipForward className="size-3.5"/> Kihagyva · {formatDate(record.updated_at)}
                      </span>
                    ) : (
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ring-1", tone.tile)}>
                        {outdated ? "Frissült, nézd meg újra" : loaded ? "Még nem játszottad" : "…"}
                      </span>
                    )}
                    <Button size="sm" variant={record ? "outline" : "default"} className="ml-auto" disabled={busy} onClick={() => start(training.id)}>
                      {record ? <><RotateCcw/> Újrajátszás</> : <><Play/> Lejátszás</>}
                    </Button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
