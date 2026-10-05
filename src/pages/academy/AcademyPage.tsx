import {useCallback, useEffect, useState} from "react";
import {useSearchParams} from "react-router";
import {ArrowLeft, GraduationCap, RefreshCw} from "lucide-react";
import {Button} from "@/components/ui/button";
import {EmptyState} from "@/components/layout/EmptyState";
import {PageHeader} from "@/components/layout/PageHeader";
import {academyApi, type AcademyOverview} from "@/lib/academy";
import {AcademyCatalog} from "./AcademyCatalog";
import {BasicAcademyView} from "./views/BasicAcademyView";
import {CourseView} from "./views/CourseView";
import {CourseSettingsDialog} from "./components/CourseSettingsDialog";

/**
 * SFSD Academy: the catalogue (basic academy and courses with progress, one request), the
 * basic academy's days and the courses. The open course/day/page is in the URL, so a page can
 * be linked to trainees.
 */
export default function AcademyPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [overview, setOverview] = useState<AcademyOverview | null>(null);
  const [failed, setFailed] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setOverview(await academyApi.overview());
      setFailed(false);
    } catch (error) {
      console.error(error);
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const view = searchParams.get("course");
  const page = Math.max(0, Number(searchParams.get("p") ?? 1) - 1) || 0;
  const day = Math.min(5, Math.max(1, Number(searchParams.get("day") ?? 1) || 1));
  const navigate = (params: Record<string, string | number | null>) => {
    const next = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== "") next.set(key, String(value));
    });
    setSearchParams(next);
    window.scrollTo({top: 0, behavior: "smooth"});
  };

  const course = overview?.courses.find((item) => item.id === view) ?? null;
  const title = view === "basic" ? "Alapkiképzés" : course?.title ?? "SFSD Academy";

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 pb-10">
      <PageHeader
        icon={GraduationCap}
        tone="cyan"
        eyebrow={view ? "SFSD Academy" : "Oktatás"}
        title={title}
        description={view === "basic" ? "Az öt napos trainee akadémia tananyaga." : course?.description ?? "Alapkiképzés, osztály- és képesítési tananyagok egy helyen."}
        actions={view ? <Button variant="outline" onClick={() => navigate({})}><ArrowLeft/> Összes tananyag</Button> : undefined}
      />

      {failed && !overview ? (
        <div className="panel">
          <EmptyState icon={RefreshCw} title="Az akadémia betöltése nem sikerült." action={<Button variant="outline" onClick={() => void load()}><RefreshCw/> Újra</Button>}/>
        </div>
      ) : !overview ? (
        <div className="space-y-4"><div className="skeleton h-56"/><div className="grid grid-cols-1 gap-4 md:grid-cols-3">{[0, 1, 2].map((key) => <div key={key} className="skeleton h-44"/>)}</div></div>
      ) : view === "basic" ? (
        <BasicAcademyView overview={overview} canEdit={overview.viewer.instructor} day={day} page={page}
                          onNavigate={(nextDay, nextPage) => navigate({course: "basic", day: nextDay, p: nextPage ? nextPage + 1 : null})}
                          onChanged={() => void load()}/>
      ) : view && course ? (
        <CourseView key={course.id} course={course} canEdit={overview.viewer.instructor} page={page}
                    onPage={(next) => navigate({course: course.id, p: next ? next + 1 : null})}
                    onChanged={() => void load()} onClosed={() => {
                      navigate({});
                      void load();
                    }}/>
      ) : view ? (
        <div className="panel"><EmptyState icon={GraduationCap} title="Ez a tananyag nem található." action={<Button variant="outline" onClick={() => navigate({})}><ArrowLeft/> Vissza</Button>}/></div>
      ) : (
        <AcademyCatalog overview={overview}
                        onOpenBasic={(target) => navigate({course: "basic", day: target ?? 1})}
                        onOpenCourse={(id) => navigate({course: id})}
                        onNewCourse={() => setCreating(true)}/>
      )}

      {creating && (
        <CourseSettingsDialog course={null} onClose={() => setCreating(false)} onSaved={(id) => {
          setCreating(false);
          void load().then(() => navigate({course: id}));
        }}/>
      )}
    </div>
  );
}
