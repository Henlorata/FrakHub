import {useEffect, useState, type CSSProperties, type ReactNode} from "react";
import {Link} from "react-router";
import {Award, Banknote, BrainCircuit, CalendarCheck, Clock, FileText, Loader2, Medal, Sparkles, Star, Trophy, TrendingUp} from "lucide-react";
import {Dialog, DialogContent, DialogDescription, DialogTitle} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {SheriffStar} from "@/components/brand/SheriffStar";
import {recognitionApi, type MonthlyRecap} from "@/lib/recognition";
import {formatDuty, monthLabel} from "@/lib/registry";
import {useCountUp} from "@/lib/use-count-up";
import {cn} from "@/lib/utils";

const money = new Intl.NumberFormat("hu-HU");

function CountUp({value, format}: {value: number; format?: (value: number) => string}) {
  const current = useCountUp(value, 1100);
  return <>{format ? format(current) : current}</>;
}

/** Light confetti for a month with something to celebrate (no motion with reduced motion). */
function Confetti() {
  const colors = ["#fcd34d", "#38bdf8", "#34d399", "#f472b6", "#a78bfa"];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden">
      {Array.from({length: 26}, (_, index) => (
        <span key={index} className="absolute top-[-8%] block h-2.5 w-1.5 rounded-[1px] animate-[recap-fall_3.2s_cubic-bezier(0.3,0.6,0.4,1)_both]"
              style={{left: `${(index * 37) % 100}%`, background: colors[index % colors.length], animationDelay: `${(index % 9) * 0.12}s`,
                transform: `rotate(${index * 29}deg)`} as CSSProperties}/>
      ))}
    </div>
  );
}

function Tile({icon: Icon, label, children, hint, index, tone}: {
  icon: typeof Clock;
  label: string;
  children: ReactNode;
  hint?: ReactNode;
  index: number;
  tone: string;
}) {
  return (
    <div className="animate-rise rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10" style={{"--i": index + 2} as CSSProperties}>
      <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-slate-400 uppercase"><Icon className={cn("size-4", tone)}/>{label}</div>
      <div className="mt-2 text-2xl font-bold text-white tabular-nums">{children}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

/**
 * The member's month in one animated card: recorded duty time and reports against the faction,
 * attended events, practice, pay, TOP places, promotions, awards and certificates. Opens once at
 * the start of a month (dashboard) and any time from the profile.
 */
export function MonthlyRecapDialog({month, open, onOpenChange}: {month: string | null; open: boolean; onOpenChange: (open: boolean) => void}) {
  const [recap, setRecap] = useState<MonthlyRecap | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || !month) return;
    let active = true;
    setRecap(null);
    setFailed(false);
    recognitionApi.recap(month).then((data) => active && setRecap(data)).catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [open, month]);

  const celebrate = !!recap && (!!recap.top_duty || !!recap.top_report || recap.promotions.length > 0 || recap.awards.length > 0);
  const empty = !!recap && !recap.duty_minutes && !recap.reports && !recap.events_attended && !recap.practice_days;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden border-white/10 bg-[#070c18]/95 p-0 sm:max-w-2xl">
        <div className="relative">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgb(234_179_8/0.22),transparent_45%),radial-gradient(circle_at_90%_10%,rgb(56_189_248/0.18),transparent_50%)]"/>
          {celebrate && <Confetti/>}
          <div className="relative p-6 sm:p-8">
            <div className="animate-rise flex items-center gap-4" style={{"--i": 0} as CSSProperties}>
              <SheriffStar className="size-14 shrink-0 drop-shadow-[0_6px_14px_rgb(0_0_0/0.5)] motion-safe:animate-[float-y_6s_ease-in-out_infinite]"/>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-[0.25em] text-yellow-400/80 uppercase">Havi összefoglaló</p>
                <DialogTitle className="text-2xl font-black tracking-tight text-white sm:text-3xl">{month ? monthLabel(month) : ""}</DialogTitle>
                <DialogDescription className="text-sm text-slate-400">Így telt a hónapod a frakcióban.</DialogDescription>
              </div>
            </div>

            {failed ? (
              <p className="mt-8 text-center text-sm text-slate-400">Az összefoglaló most nem tölthető be.</p>
            ) : !recap ? (
              <div className="flex justify-center py-16"><Loader2 className="size-8 animate-spin text-slate-500"/></div>
            ) : (
              <>
                {(recap.top_duty || recap.top_report || recap.promotions.length > 0) && (
                  <div className="animate-rise mt-6 flex flex-wrap gap-2" style={{"--i": 1} as CSSProperties}>
                    {recap.top_duty && <Highlight icon={Trophy} text={`${recap.top_duty}. hely duty időben`}/>}
                    {recap.top_report && <Highlight icon={Trophy} text={`${recap.top_report}. hely jelentésekben`}/>}
                    {recap.promotions.map((promotion) => <Highlight key={promotion.at} icon={TrendingUp} text={`Előléptetés: ${promotion.to}`}/>)}
                  </div>
                )}
                {empty ? (
                  <p className="animate-rise mt-8 rounded-2xl bg-white/[0.03] p-5 text-center text-sm text-slate-300 ring-1 ring-white/10" style={{"--i": 2} as CSSProperties}>
                    Ebből a hónapból még nincs rögzített adatod. A duty időt a gyűlésen rögzítik, a jelentéseket a jelentésnaplóba veheted fel.
                  </p>
                ) : (
                  <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Tile icon={Clock} label="Duty idő" index={0} tone="text-sky-300"
                          hint={recap.duty_better_than !== null && recap.duty_minutes ? `Az állomány ${recap.duty_better_than}%-ánál többet` : recap.duty_avg ? `Átlag: ${formatDuty(recap.duty_avg)}` : "Még nincs rögzítve"}>
                      {recap.duty_minutes ? <CountUp value={recap.duty_minutes} format={(value) => formatDuty(value)}/> : "–"}
                    </Tile>
                    <Tile icon={FileText} label="Jelentések" index={1} tone="text-amber-300"
                          hint={recap.reports_avg !== null ? `Átlag: ${String(recap.reports_avg).replace(".", ",")} / fő` : undefined}>
                      <CountUp value={recap.reports}/>
                    </Tile>
                    <Tile icon={CalendarCheck} label="Események" index={2} tone="text-emerald-300"
                          hint={recap.events_total ? `${recap.events_total} rögzített eseményből` : "Nem volt rögzített esemény"}>
                      <CountUp value={recap.events_attended}/>
                    </Tile>
                    <Tile icon={BrainCircuit} label="Gyakorlás" index={3} tone="text-cyan-300"
                          hint={recap.practice_days ? `${recap.practice_correct} helyes válasz` : "Próbáld ki a Gyakorlás oldalt!"}>
                      <CountUp value={recap.practice_days}/><span className="ml-1 text-sm font-semibold text-slate-400">nap</span>
                    </Tile>
                  </div>
                )}
                {(recap.pay !== null || recap.awards.length > 0 || recap.certificates > 0) && (
                  <div className="animate-rise mt-3 flex flex-wrap items-center gap-2 text-xs" style={{"--i": 7} as CSSProperties}>
                    {recap.pay !== null && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-emerald-100 ring-1 ring-emerald-500/25">
                        <Banknote className="size-3.5"/> Fizetés: <b className="tabular-nums">{money.format(recap.pay)} $</b>
                      </span>
                    )}
                    {recap.awards.map((award) => (
                      <span key={award.name} className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-slate-100 ring-1 ring-white/10">
                        <span className="h-2.5 w-5 rounded-sm" style={{background: award.color_hex ?? "#94a3b8"}}/><Medal className="size-3.5"/>{award.name}
                      </span>
                    ))}
                    {recap.certificates > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-amber-100 ring-1 ring-amber-500/25">
                        <Award className="size-3.5"/> {recap.certificates} új oklevél
                      </span>
                    )}
                  </div>
                )}
                <div className="animate-rise mt-6 flex flex-wrap items-center gap-2" style={{"--i": 8} as CSSProperties}>
                  {!recap.leaderboard_visible && (
                    <p className="min-w-0 flex-1 text-xs text-slate-400"><Star className="mr-1 inline size-3.5 text-amber-300"/>Nem szerepelsz a ranglistán; a ranglista oldalán visszakapcsolhatod.</p>
                  )}
                  <Button variant="outline" asChild className="ml-auto"><Link to="/leaderboard" onClick={() => onOpenChange(false)}><Trophy/> Ranglista</Link></Button>
                  <Button onClick={() => onOpenChange(false)}><Sparkles/> Szuper</Button>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Highlight({icon: Icon, text}: {icon: typeof Trophy; text: string}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400/25 to-yellow-500/10 px-3 py-1.5 text-sm font-semibold text-amber-50 ring-1 ring-amber-400/40 shadow-[0_0_20px_rgb(251_191_36/0.25)]">
      <Icon className="size-4 text-amber-300"/>{text}
    </span>
  );
}
