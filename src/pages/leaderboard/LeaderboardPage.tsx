import {useCallback, useEffect, useState, type CSSProperties} from "react";
import {toast} from "sonner";
import {BrainCircuit, CalendarCheck, Clock, Crown, EyeOff, FileText, Medal, Trophy, X} from "lucide-react";
import {Switch} from "@/components/ui/switch";
import {Button} from "@/components/ui/button";
import {PageHeader} from "@/components/layout/PageHeader";
import {EmptyState} from "@/components/layout/EmptyState";
import {MemberAvatar} from "@/components/MemberAvatar";
import {LEADERBOARD_CATEGORIES, recognitionApi, type Leaderboard, type LeaderboardCategory, type LeaderboardEntry} from "@/lib/recognition";
import {formatDuty, monthLabel} from "@/lib/registry";
import {addMonths, monthKey} from "@/lib/datetime";
import {cn, errorMessage} from "@/lib/utils";

const ICON: Record<LeaderboardCategory, typeof Clock> = {duty: Clock, reports: FileText, events: CalendarCheck, practice: BrainCircuit};
const UNIT: Record<LeaderboardCategory, (value: number) => string> = {
  duty: (value) => formatDuty(value, true),
  reports: (value) => `${value} db`,
  events: (value) => `${value} alkalom`,
  practice: (value) => `${value} nap`,
};
/** Places 1-3 (medal colours: gold, silver, bronze). */
const MEDAL = [
  {ring: "ring-amber-300", text: "text-amber-300", glow: "shadow-[0_0_24px_rgb(252_211_77/0.45)]", bg: "from-amber-300/25"},
  {ring: "ring-slate-300", text: "text-slate-200", glow: "shadow-[0_0_18px_rgb(203_213_225/0.35)]", bg: "from-slate-300/20"},
  {ring: "ring-orange-400", text: "text-orange-300", glow: "shadow-[0_0_18px_rgb(251_146_60/0.35)]", bg: "from-orange-400/20"},
];

/**
 * The monthly leaderboard, independent of the pay: duty time, reports, attended events and
 * practice days. Nobody is listed unless they choose to be; everyone sees their own place.
 */
export function LeaderboardPage() {
  const [month, setMonth] = useState(monthKey());
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [failed, setFailed] = useState(false);
  const [switching, setSwitching] = useState(false);

  const load = useCallback(async (target: string) => {
    try {
      setBoard(await recognitionApi.leaderboard(target));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load(month);
  }, [load, month]);

  const toggle = async (visible: boolean) => {
    setSwitching(true);
    try {
      await recognitionApi.setVisible(visible);
      toast.success(visible ? "Mostantól szerepelsz a ranglistán." : "Levettünk a ranglistáról.");
      await load(month);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSwitching(false);
    }
  };

  const months = [monthKey(), addMonths(monthKey(), -1)];
  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6">
      <PageHeader icon={Trophy} tone="gold" eyebrow="Közösség" title="Ranglista"
                  description="Havi ranglista a fizetéstől függetlenül. Csak az szerepel rajta, aki szeretne; a saját helyedet mindig látod."/>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/10" role="tablist" aria-label="Hónap">
          {months.map((key) => (
            <button key={key} type="button" role="tab" aria-selected={month === key} onClick={() => setMonth(key)}
                    className={cn("h-8 rounded-md px-3 text-xs font-medium transition-colors", month === key ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200")}>
              {monthLabel(key)}
            </button>
          ))}
        </div>
        {board && (
          <label className="ml-auto flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-white/10" data-tour="leaderboard-optin">
            <span className="text-right text-xs">
              <span className="block font-medium text-white">Szerepelek a ranglistán</span>
              <span className="block text-slate-500">{board.participants} tag vállalta</span>
            </span>
            <Switch checked={board.visible} disabled={switching} onCheckedChange={(value) => void toggle(value)}/>
          </label>
        )}
      </div>

      {failed ? (
        <EmptyState icon={X} title="A ranglista nem tölthető be." action={<Button variant="outline" onClick={() => void load(month)}>Újra</Button>}/>
      ) : !board ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((index) => <div key={index} className="skeleton h-96"/>)}</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-tour="leaderboard">
          {board.categories.map((category, index) => (
            <CategoryBoard key={category.key} category={category} index={index} visible={board.visible}/>
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryBoard({category, index, visible}: {category: Leaderboard["categories"][number]; index: number; visible: boolean}) {
  const Icon = ICON[category.key];
  const meta = LEADERBOARD_CATEGORIES[category.key];
  const format = UNIT[category.key];
  const podium = category.entries.slice(0, 3);
  const rest = category.entries.slice(3);
  return (
    <section className="panel animate-rise flex min-w-0 flex-col overflow-hidden p-0" style={{"--i": index} as CSSProperties}>
      <header className="flex items-center gap-3 px-4 py-3.5">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/25"><Icon className="size-4"/></div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-white">{meta.label}</h2>
          <p className="truncate text-[11px] text-slate-500">{meta.hint}</p>
        </div>
      </header>
      {category.entries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-10 text-center text-xs text-slate-500">
          <Medal className="size-8 text-slate-600"/> Még senki sincs a listán.
        </div>
      ) : (
        <>
          <ol className="grid grid-cols-3 items-end gap-2 border-t border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent px-3 pt-4 pb-3">
            {[1, 0, 2].map((slot) => {
              const entry = podium[slot];
              if (!entry) return <li key={slot}/>;
              const medal = MEDAL[Math.min(entry.place, 3) - 1] ?? MEDAL[2];
              return (
                <li key={entry.user_id} className={cn("flex min-w-0 flex-col items-center text-center", slot === 0 && "-translate-y-2")}>
                  <div className="relative">
                    {entry.place === 1 && <Crown className="absolute -top-4 left-1/2 size-4 -translate-x-1/2 text-amber-300"/>}
                    <MemberAvatar name={entry.full_name} avatarUrl={entry.avatar_url} size={slot === 0 ? 52 : 42}
                                  className={cn("ring-2", medal.ring, medal.glow)}/>
                  </div>
                  <span className={cn("mt-1.5 text-[10px] font-bold", medal.text)}>{entry.place}.</span>
                  <span className={cn("w-full truncate text-xs font-medium", entry.me ? "text-primary" : "text-slate-100")}>{entry.full_name}</span>
                  <span className="text-[11px] text-slate-400 tabular-nums">{format(entry.value)}</span>
                </li>
              );
            })}
          </ol>
          {rest.length > 0 && (
            <ol className="divide-y divide-white/5 border-t border-white/5">
              {rest.map((entry) => <Row key={entry.user_id} entry={entry} format={format}/>)}
            </ol>
          )}
        </>
      )}
      <footer className="mt-auto border-t border-white/5 bg-black/10 px-4 py-2.5 text-xs">
        {category.me ? (
          <p className="text-slate-300">
            {visible ? "A helyed: " : <><EyeOff className="mr-1 inline size-3 text-slate-500"/>Ha szerepelnél: </>}
            <b className="text-white">{category.me.place}.</b> <span className="text-slate-500">/ {category.me.of}</span> · {format(category.me.value)}
          </p>
        ) : <p className="text-slate-500">Ebben a hónapban nálad még nincs adat.</p>}
      </footer>
    </section>
  );
}

function Row({entry, format}: {entry: LeaderboardEntry; format: (value: number) => string}) {
  return (
    <li className={cn("flex items-center gap-3 px-4 py-2", entry.me && "bg-primary/[0.07]")}>
      <span className="w-5 text-right text-xs font-semibold text-slate-500 tabular-nums">{entry.place}.</span>
      <MemberAvatar name={entry.full_name} avatarUrl={entry.avatar_url} size={24}/>
      <span className={cn("min-w-0 flex-1 truncate text-xs", entry.me ? "font-semibold text-primary" : "text-slate-200")}>{entry.full_name}</span>
      <span className="text-xs text-slate-400 tabular-nums">{format(entry.value)}</span>
    </li>
  );
}
