import {useState} from "react";
import {useSearchParams} from "react-router";
import {BarChart3, FilePlus2, FileText, FolderOpen, ListChecks} from "lucide-react";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {PageHeader} from "@/components/layout/PageHeader";
import {useAuth} from "@/context/AuthContext";
import {isExecutive, isStaff} from "@/lib/utils";
import {ReportGenerator} from "./ReportGenerator";
import {FolderTab} from "./FolderTab";
import {MyReportsTab} from "./MyReportsTab";
import {MonthlySummaryTab} from "./MonthlySummaryTab";

const TABS = ["new", "folder", "mine", "summary"] as const;
type ReportsTab = typeof TABS[number];

/**
 * Forum reports: the generator for the forum's template, the folder post, and the report log
 * (members record what they posted, the leadership sees the monthly count the payroll uses).
 */
export function ReportsPage() {
  const {profile} = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [reloadKey, setReloadKey] = useState(0);

  if (!profile) return null;
  const staff = isStaff(profile);
  const allowed = TABS.filter((tab) => tab !== "summary" || staff);
  const requested = searchParams.get("tab") as ReportsTab | null;
  const tab: ReportsTab = requested && allowed.includes(requested) ? requested : "new";
  const setTab = (next: string) => {
    const params = new URLSearchParams(searchParams);
    if (next === "new") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, {replace: true});
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 pb-10">
      <PageHeader icon={FileText} tone="blue" eyebrow="Jelentések" title="Fórum-jelentések"
                  description="Jelentés a fórum sablonjával, és a havi jelentésszám rögzítése a fizetéshez."/>

      <Tabs value={tab} onValueChange={setTab} className="space-y-5">
        <TabsList className="w-fit max-w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="new" className="h-9 px-4"><FilePlus2/> Új jelentés</TabsTrigger>
          <TabsTrigger value="folder" className="h-9 px-4"><FolderOpen/> Mappa nyitása</TabsTrigger>
          <TabsTrigger value="mine" className="h-9 px-4"><ListChecks/> Jelentéseim</TabsTrigger>
          {staff && <TabsTrigger value="summary" className="h-9 px-4"><BarChart3/> Havi összesítő</TabsTrigger>}
        </TabsList>
        <TabsContent value="new" className="mt-0">
          <ReportGenerator onLogged={() => setReloadKey((key) => key + 1)}/>
        </TabsContent>
        <TabsContent value="folder" className="mt-0">{tab === "folder" && <FolderTab/>}</TabsContent>
        <TabsContent value="mine" className="mt-0">{tab === "mine" && <MyReportsTab reloadKey={reloadKey}/>}</TabsContent>
        {staff && (
          <TabsContent value="summary" className="mt-0">
            {tab === "summary" && <MonthlySummaryTab canPayroll={isExecutive(profile) || !!profile.is_bureau_manager}/>}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
