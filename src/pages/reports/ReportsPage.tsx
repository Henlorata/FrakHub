import {useEffect, useState} from "react";
import {useSearchParams} from "react-router";
import {BarChart3, FilePlus2, FileText, FolderOpen, ListChecks} from "lucide-react";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {PageHeader} from "@/components/layout/PageHeader";
import {useAuth} from "@/context/AuthContext";
import {ReportGenerator} from "./ReportGenerator";
import {FolderTab} from "./FolderTab";
import {ReportsListTab} from "./ReportsListTab";
import {ReportsSummaryTab} from "./ReportsSummaryTab";

const TABS = ["new", "list", "summary", "folder"] as const;
type ReportsTab = typeof TABS[number];

/**
 * Reports: the generator for the forum's template (copying saves the report here too), every
 * member's saved reports, the month's count per member, and the folder post of the forum.
 */
export function ReportsPage() {
  const {profile} = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [reloadKey, setReloadKey] = useState(0);

  // The old "Jelentéseim" tab (links from earlier notifications) is the list's own filter now.
  useEffect(() => {
    if (searchParams.get("tab") !== "mine") return;
    const params = new URLSearchParams(searchParams);
    params.set("tab", "list");
    params.set("mine", "1");
    setSearchParams(params, {replace: true});
  }, [searchParams, setSearchParams]);

  if (!profile) return null;
  const requested = searchParams.get("tab") as ReportsTab | null;
  const tab: ReportsTab = requested && TABS.includes(requested) ? requested : "new";
  const setTab = (next: string) => {
    const params = new URLSearchParams();
    if (next !== "new") params.set("tab", next);
    setSearchParams(params, {replace: true});
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 pb-10">
      <PageHeader icon={FileText} tone="blue" eyebrow="Jelentések" title="Jelentések"
                  description="Jelentés a fórum sablonjával: a másolás el is menti, a havi elszámolásba számít, és mindenki látja. A fórumra ugyanúgy fel kell tölteni."/>

      <Tabs value={tab} onValueChange={setTab} className="space-y-5">
        <TabsList className="w-fit max-w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="new" className="h-9 px-4"><FilePlus2/> Új jelentés</TabsTrigger>
          <TabsTrigger value="list" className="h-9 px-4" data-tour="reports-list-tab"><ListChecks/> Jelentések</TabsTrigger>
          <TabsTrigger value="summary" className="h-9 px-4"><BarChart3/> Havi összesítő</TabsTrigger>
          <TabsTrigger value="folder" className="h-9 px-4"><FolderOpen/> Mappa nyitása</TabsTrigger>
        </TabsList>
        <TabsContent value="new" className="mt-0">
          <ReportGenerator onSaved={() => setReloadKey((key) => key + 1)}/>
        </TabsContent>
        <TabsContent value="list" className="mt-0">{tab === "list" && <ReportsListTab reloadKey={reloadKey}/>}</TabsContent>
        <TabsContent value="summary" className="mt-0">{tab === "summary" && <ReportsSummaryTab/>}</TabsContent>
        <TabsContent value="folder" className="mt-0">{tab === "folder" && <FolderTab/>}</TabsContent>
      </Tabs>
    </div>
  );
}
