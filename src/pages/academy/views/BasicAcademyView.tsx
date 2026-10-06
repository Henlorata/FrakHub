import {useCallback, useEffect, useMemo, useState} from "react";
import {CalendarDays, ClipboardCheck, Lock, Sunrise} from "lucide-react";
import {toast} from "sonner";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {EmptyState} from "@/components/layout/EmptyState";
import {useAuth} from "@/context/AuthContext";
import {ACADEMY_DAYS, cycleDay, isDayOpen, type AcademyOverview} from "@/lib/academy";
import {addDaysKey, formatDate} from "@/lib/datetime";
import {cn} from "@/lib/utils";
import {InstructorPanel} from "../components/InstructorPanel";
import {MaterialWorkspace, type MaterialPage} from "../components/MaterialWorkspace";
import {MATERIAL_LIST_COLUMNS} from "../useMaterialContent";

const TABLE = "academy_materials";

/** "Az 1. nap", "A 2. nap" (the article follows the spoken number). */
const theDay = (day: number) => `${day === 1 || day === 5 ? "Az" : "A"} ${day}. nap`;

interface BasicPage extends MaterialPage {
  day_number: number;
}

interface BasicAcademyViewProps {
  overview: AcademyOverview;
  canEdit: boolean;
  day: number;
  page: number;
  onNavigate: (day: number, page: number) => void;
  onChanged: () => void;
}

/**
 * The five-day basic academy: each day's pages, opened day by day for trainees (Hungarian
 * calendar, from the active cycle's start), the attendance log for instructors.
 */
export function BasicAcademyView({overview, canEdit, day, page, onNavigate, onChanged}: BasicAcademyViewProps) {
  const {supabase} = useAuth();
  const [pages, setPages] = useState<BasicPage[] | null>(null);
  const [tab, setTab] = useState<"material" | "log">("material");
  const trainee = overview.viewer.trainee;
  const cycle = overview.cycle;
  const today = cycleDay(cycle?.start_date, overview.today);

  const load = useCallback(async () => {
    const {data, error} = await supabase.from(TABLE).select(MATERIAL_LIST_COLUMNS[TABLE]).eq("category", "basic")
      .order("day_number").order("page_order");
    if (error) {
      toast.error("Az alapkiképzés betöltése nem sikerült.");
      setPages([]);
      return;
    }
    setPages((data ?? []) as unknown as BasicPage[]);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const open = (target: number) => !trainee || isDayOpen(target, cycle?.start_date, overview.today);
  const dayPages = useMemo(() => (pages ?? []).filter((item) => item.day_number === day), [pages, day]);

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as "material" | "log")} className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Napok">
          {ACADEMY_DAYS.map((item) => {
            const available = open(item);
            const count = (pages ?? []).filter((entry) => entry.day_number === item).length;
            return (
              <button key={item} type="button" disabled={!available} onClick={() => onNavigate(item, 0)} aria-pressed={day === item}
                      className={cn("relative flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium ring-1 transition-all",
                        day === item ? "bg-cyan-500/15 text-white ring-cyan-400/50 shadow-[0_0_20px_-6px] shadow-cyan-400/60"
                          : available ? "text-slate-300 ring-white/10 hover:bg-white/[0.04]" : "cursor-not-allowed text-slate-600 ring-white/5")}>
                {!available && <Lock className="size-3.5"/>}
                {item}. nap
                <span className="text-[11px] text-slate-500 tabular-nums">{count}</span>
                {today === item && <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0a1120]" title="Ma"/>}
              </button>
            );
          })}
        </div>
        {canEdit && (
          <TabsList className="w-fit lg:ml-auto">
            <TabsTrigger value="material" className="h-8 px-3"><CalendarDays/> Tananyag</TabsTrigger>
            <TabsTrigger value="log" className="h-8 px-3"><ClipboardCheck/> Napló</TabsTrigger>
          </TabsList>
        )}
      </div>

      <TabsContent value="material" className="mt-0">
        {pages === null ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]"><div className="skeleton h-72"/><div className="skeleton h-96"/></div>
        ) : !open(day) ? (
          <div className="panel">
            <EmptyState icon={Lock} title={`${theDay(day)} tananyaga még zárva van.`}
                        description={cycle ? `Megnyílik: ${formatDate(addDaysKey(cycle.start_date, day - 1))}` : "Jelenleg nincs aktív akadémiai ciklus."}/>
          </div>
        ) : (
          <MaterialWorkspace
            table={TABLE}
            pages={dayPages}
            onPagesChange={(next) => setPages((current) => [...(current ?? []).filter((item) => item.day_number !== day),
              ...next.map((item) => ({...item, day_number: day}))].sort((a, b) => a.day_number - b.day_number || a.page_order - b.page_order))}
            index={page}
            onIndexChange={(next) => onNavigate(day, next)}
            canEdit={canEdit}
            emptyTitle={`${theDay(day)}hoz még nincs tananyag.`}
            aside={(
              <div className="panel p-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/25"><Sunrise className="size-5"/></div>
                  <div className="min-w-0">
                    <p className="font-semibold text-white">{day}. nap</p>
                    <p className="text-xs text-slate-400">
                      {cycle ? <>Ciklus: {formatDate(cycle.start_date)}{today >= 1 && today <= 5 ? ` · ma: ${today}. nap` : today > 5 ? " · véget ért" : " · még nem indult"}</>
                        : "Nincs aktív ciklus"}
                    </p>
                  </div>
                </div>
              </div>
            )}
            onCreatePage={async () => {
              const {data, error} = await supabase.from(TABLE).insert({
                title: `${day}. nap – ${dayPages.length + 1}. oldal`, day_number: day, page_order: dayPages.length + 1, category: "basic", content: [],
                theme: dayPages[dayPages.length - 1]?.theme ?? "paper",
              }).select(MATERIAL_LIST_COLUMNS[TABLE]).single();
              if (error) throw error;
              onChanged();
              return data as unknown as BasicPage;
            }}
          />
        )}
      </TabsContent>

      {canEdit && (
        <TabsContent value="log" className="mt-0">
          {tab === "log" && <InstructorPanel activeCycle={cycle} today={overview.today} onRefresh={onChanged}/>}
        </TabsContent>
      )}
    </Tabs>
  );
}
