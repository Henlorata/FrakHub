import {useCallback, useEffect, useState} from "react";
import {toast} from "sonner";
import {Lock, Settings2, ShieldCheck} from "lucide-react";
import {Button} from "@/components/ui/button";
import {EmptyState} from "@/components/layout/EmptyState";
import {TONE_CLASSES} from "@/components/layout/PageHeader";
import {useAuth} from "@/context/AuthContext";
import {courseLook, type CourseSummary} from "@/lib/academy";
import {cn, errorMessage} from "@/lib/utils";
import {CourseSettingsDialog} from "../components/CourseSettingsDialog";
import {MaterialWorkspace, type MaterialPage} from "../components/MaterialWorkspace";
import {MATERIAL_LIST_COLUMNS} from "../useMaterialContent";

const TABLE = "academy_division_materials";

interface CourseViewProps {
  course: CourseSummary;
  canEdit: boolean;
  page: number;
  onPage: (page: number) => void;
  onChanged: () => void;
  onClosed: () => void;
}

/** One course: its pages (read in order when the course asks for it) and, for instructors, editing. */
export function CourseView({course, canEdit, page, onPage, onChanged, onClosed}: CourseViewProps) {
  const {supabase, user} = useAuth();
  const [pages, setPages] = useState<MaterialPage[] | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState(false);
  const look = courseLook(course);
  const tone = TONE_CLASSES[look.tone];

  const load = useCallback(async () => {
    if (!course.readable) {
      setPages([]);
      return;
    }
    const [pageResult, progressResult] = await Promise.all([
      supabase.from(TABLE).select(MATERIAL_LIST_COLUMNS[TABLE]).eq("course_id", course.id).order("page_order"),
      user ? supabase.from("academy_progress").select("material_id").eq("user_id", user.id) : Promise.resolve({data: []}),
    ]);
    if (pageResult.error) toast.error("A tananyag betöltése nem sikerült.");
    setPages((pageResult.data ?? []) as unknown as MaterialPage[]);
    setCompleted(new Set((progressResult.data ?? []).map((row: {material_id: string}) => row.material_id)));
  }, [supabase, course.id, course.readable, user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!course.readable) {
    return (
      <div className="panel">
        <EmptyState icon={Lock} title="Ez a tananyag számodra még nem elérhető."
                    description={!course.is_open ? "Az oktatók még dolgoznak rajta, vagy zártkörű." : course.required_rank ? `${course.required_rank} és afeletti rendfokozat kell hozzá.` : undefined}/>
      </div>
    );
  }

  const done = pages ? pages.filter((item) => completed.has(item.id)).length : 0;

  return (
    <>
      {pages === null ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]"><div className="skeleton h-72"/><div className="skeleton h-96"/></div>
      ) : (
        <MaterialWorkspace
          table={TABLE}
          pages={pages}
          onPagesChange={setPages}
          index={page}
          onIndexChange={onPage}
          canEdit={canEdit}
          emptyTitle="Ebben a tananyagban még nincs oldal."
          progress={{
            completed,
            linear: course.linear_progression,
            onComplete: async (id) => {
              if (!user) return;
              const {error} = await supabase.from("academy_progress").insert({user_id: user.id, material_id: id});
              if (error && error.code !== "23505") {
                toast.error("Nem sikerült menteni: " + errorMessage(error));
                return;
              }
              setCompleted((current) => new Set(current).add(id));
              toast.success("Oldal teljesítve.");
              onChanged();
            },
          }}
          aside={(
            <div className="panel p-4">
              <div className="flex items-start gap-3">
                <div className={cn("grid size-10 shrink-0 place-items-center rounded-xl ring-1", tone.tile)}><look.icon className="size-5"/></div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white wrap-anywhere">{course.title}</p>
                  <p className="text-xs text-slate-400">{pages.length} oldal{course.linear_progression ? " · sorrendben" : ""}</p>
                </div>
                {canEdit && (
                  <Button size="icon" variant="ghost" className="size-8" aria-label="Beállítások" onClick={() => setSettings(true)}><Settings2/></Button>
                )}
              </div>
              {pages.length > 0 && (
                <p className="mt-3 text-xs text-slate-400">Haladás: <span className="font-semibold text-white">{Math.round((done / pages.length) * 100)}%</span></p>
              )}
              {canEdit && !course.is_open && (
                <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200 ring-1 ring-amber-500/20">
                  <ShieldCheck className="size-3.5 shrink-0"/> Zárva: csak az oktatók látják.
                </p>
              )}
            </div>
          )}
          onCreatePage={async () => {
            const {data, error} = await supabase.from(TABLE).insert({
              course_id: course.id, title: `${pages.length + 1}. oldal`, page_order: pages.length + 1, content: [],
              theme: pages[pages.length - 1]?.theme ?? "default",
            }).select(MATERIAL_LIST_COLUMNS[TABLE]).single();
            if (error) throw error;
            onChanged();
            return data as unknown as MaterialPage;
          }}
        />
      )}
      {settings && (
        <CourseSettingsDialog course={course} onClose={() => setSettings(false)}
                              onSaved={() => {
                                setSettings(false);
                                onChanged();
                              }}
                              onDeleted={() => {
                                setSettings(false);
                                onClosed();
                              }}/>
      )}
    </>
  );
}
