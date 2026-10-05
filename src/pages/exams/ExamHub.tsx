import {useCallback, useEffect, useState} from "react";
import {useNavigate, useSearchParams} from "react-router";
import {toast} from "sonner";
import {ClipboardCheck, Database, GraduationCap, History, LayoutGrid, Plus, RefreshCw, Trash2, UserPlus} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {EmptyState} from "@/components/layout/EmptyState";
import {PageHeader} from "@/components/layout/PageHeader";
import {useAuth} from "@/context/AuthContext";
import {examApi} from "@/lib/exams";
import {canCreateAnyExam, errorMessage, isExecutive, isHighCommand, isStaff, isSupervisory} from "@/lib/utils";
import type {ExamHubData, HubExam} from "@/types/exams";
import {AdminExamAssignDialog} from "./components/AdminExamAssignDialog";
import {ExamAccessDialog} from "./components/ExamAccessDialog";
import {ExamCatalog} from "./hub/ExamCatalog";
import {GradingTab} from "./hub/GradingTab";
import {HistoryTab} from "./hub/HistoryTab";
import {MyResultsTab} from "./hub/MyResultsTab";
import {TrashTab} from "./hub/TrashTab";

const TABS = ["available", "history", "grading", "all_history", "trash"] as const;
type HubTab = typeof TABS[number];

/** Exam centre: exams to take, own results, and for graders the queue, the database and the trash. One request. */
export function ExamHub() {
  const {supabase, profile} = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("tab") as HubTab | null;
  const [data, setData] = useState<ExamHubData | null>(null);
  const [failed, setFailed] = useState(false);
  const [clockOffset, setClockOffset] = useState(0);
  const [accessExam, setAccessExam] = useState<HubExam | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    try {
      const hub = await examApi.hub();
      setClockOffset(Date.parse(hub.server_now) - Date.now());
      setData(hub);
      setFailed(false);
    } catch (error) {
      console.error(error);
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!profile) return null;

  const graderRights = canCreateAnyExam(profile) || !!profile.qualifications?.includes("TB") || isSupervisory(profile) || isHighCommand(profile);
  const canTrash = isStaff(profile) && graderRights;
  const canPurge = isExecutive(profile) || !!profile.is_bureau_manager;
  const canAssign = isSupervisory(profile) || isHighCommand(profile) || !!profile.is_bureau_manager;
  const allowed = TABS.filter((tab) => (tab === "available" || tab === "history") || (graderRights && (tab !== "trash" || canTrash)));
  const tab: HubTab = requested && allowed.includes(requested) ? requested : "available";
  const setTab = (next: string) => {
    const params = new URLSearchParams(searchParams);
    if (next === "available") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, {replace: true});
  };

  const restore = async (id: string) => {
    const {error} = await supabase.rpc("exam_submission_restore", {_submission_id: id});
    if (error) {
      toast.error("Hiba: " + errorMessage(error));
      return;
    }
    toast.success("Vizsgalap visszaállítva.");
    setReloadKey((key) => key + 1);
    void load();
  };

  const trash = async (id: string) => {
    setWorkingId(id);
    const {error} = await supabase.rpc("exam_submission_trash", {_submission_id: id});
    setWorkingId(null);
    if (error) {
      toast.error("Hiba: " + errorMessage(error));
      return;
    }
    setData((current) => current && {...current, queue: current.queue.filter((sheet) => sheet.id !== id)});
    setReloadKey((key) => key + 1);
    toast.success("Vizsgalap a lomtárba helyezve.", {action: {label: "Visszavonás", onClick: () => void restore(id)}});
  };

  const queueCount = data?.queue.length ?? 0;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 pb-10">
      {accessExam && (
        <ExamAccessDialog open onOpenChange={(open) => !open && setAccessExam(null)} exam={accessExam} onUpdate={() => void load()}/>
      )}
      {canAssign && <AdminExamAssignDialog open={assignOpen} onOpenChange={setAssignOpen}/>}

      <PageHeader
        icon={GraduationCap}
        eyebrow="Oktatás"
        title="Vizsgaközpont"
        description="Vizsgák, eredmények és javítás egy helyen."
        actions={(
          <>
            {canAssign && <Button variant="outline" onClick={() => setAssignOpen(true)}><UserPlus/> Vendéglap párosítása</Button>}
            {canCreateAnyExam(profile) && <Button onClick={() => navigate("/exams/editor")}><Plus/> Új vizsga</Button>}
          </>
        )}
      />

      {failed && !data ? (
        <div className="panel">
          <EmptyState icon={RefreshCw} title="A vizsgaközpont betöltése nem sikerült."
                      action={<Button variant="outline" onClick={() => void load()}><RefreshCw/> Újra</Button>}/>
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab} className="space-y-5">
          <TabsList className="w-fit max-w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="available" className="h-9 px-4"><LayoutGrid/> Vizsgák</TabsTrigger>
            <TabsTrigger value="history" className="h-9 px-4"><History/> Eredményeim</TabsTrigger>
            {graderRights && (
              <>
                <TabsTrigger value="grading" className="h-9 px-4">
                  <ClipboardCheck/> Javítás
                  {queueCount > 0 && <span className="ml-1 rounded-full bg-primary/15 px-1.5 text-[11px] font-semibold text-primary">{queueCount}</span>}
                </TabsTrigger>
                <TabsTrigger value="all_history" className="h-9 px-4"><Database/> Adatbázis</TabsTrigger>
                {canTrash && <TabsTrigger value="trash" className="h-9 px-4"><Trash2/> Lomtár</TabsTrigger>}
              </>
            )}
          </TabsList>

          {!data ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({length: 6}, (_, index) => <div key={index} className="skeleton h-56"/>)}
            </div>
          ) : (
            <>
              <TabsContent value="available" className="mt-0">
                <ExamCatalog exams={data.exams} profile={profile} clockOffset={clockOffset} onManageAccess={setAccessExam}/>
              </TabsContent>
              <TabsContent value="history" className="mt-0">
                <MyResultsTab sheets={data.mine}/>
              </TabsContent>
              {graderRights && (
                <>
                  <TabsContent value="grading" className="mt-0">
                    <GradingTab queue={data.queue} live={data.live} clockOffset={clockOffset} canTrash={canTrash}
                                workingId={workingId} onTrash={(id) => void trash(id)}/>
                  </TabsContent>
                  <TabsContent value="all_history" className="mt-0">
                    {tab === "all_history" && (
                      <HistoryTab exams={data.exams} canTrash={canTrash} workingId={workingId} onTrash={(id) => void trash(id)} reloadKey={reloadKey}/>
                    )}
                  </TabsContent>
                  {canTrash && (
                    <TabsContent value="trash" className="mt-0">
                      {tab === "trash" && <TrashTab canPurge={canPurge} reloadKey={reloadKey} onRestored={() => void load()}/>}
                    </TabsContent>
                  )}
                </>
              )}
            </>
          )}
        </Tabs>
      )}
    </div>
  );
}
