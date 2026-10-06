import {useState} from "react";
import {useSearchParams} from "react-router";
import {BarChart3, Plus, Receipt, SlidersHorizontal, Wallet} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {PageHeader} from "@/components/layout/PageHeader";
import {useAuth} from "@/context/AuthContext";
import {useDialogParam} from "@/lib/use-dialog-param";
import {isExecutive} from "@/lib/utils";
import {NewBudgetRequestDialog} from "./components/NewBudgetRequestDialog";
import {ReimbursementsTab} from "./ReimbursementsTab";
import {OverviewTab} from "./OverviewTab";
import {PayrollTab} from "./payroll/PayrollTab";
import {MyPayslips} from "./payroll/MyPayslips";
import {PayrollSettingsTab} from "./payroll/PayrollSettingsTab";

const TABS = ["requests", "payroll", "settings", "overview"] as const;
type FinanceTab = typeof TABS[number];

/**
 * The faction's money: reimbursement claims, the monthly payroll (the leadership fills it at
 * the meeting, members see their own pay), the Commander's pay table and a monthly overview.
 */
export function FinancePage() {
  const {profile} = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isNewOpen, setIsNewOpen] = useDialogParam("new");
  const [reloadKey, setReloadKey] = useState(0);

  if (!profile) return null;

  // Mirrors private.is_admin(), private.is_executive_or_manager() and private.is_commander_or_manager().
  const highCommand = profile.system_role === "admin" || !!profile.is_bureau_manager;
  const payrollManager = isExecutive(profile) || !!profile.is_bureau_manager;
  const settingsEditor = profile.faction_rank === "Commander" || !!profile.is_bureau_manager;

  const allowed = TABS.filter((tab) => tab === "requests" || tab === "payroll" || (tab === "settings" && payrollManager) || (tab === "overview" && highCommand));
  const requested = searchParams.get("tab") as FinanceTab | null;
  const tab: FinanceTab = requested && allowed.includes(requested) ? requested : "requests";
  const setTab = (next: string) => {
    const params = new URLSearchParams(searchParams);
    if (next === "requests") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, {replace: true});
  };

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-6 pb-10">
      <PageHeader
        icon={Wallet}
        tone="emerald"
        eyebrow="Költségtérítések és fizetések"
        title="Pénzügy"
        description={payrollManager ? "Kérelmek elbírálása, havi fizetés a gyűlés után, fizetési tábla." : "Költségtérítési kérelmeid és a havi fizetéseid."}
        actions={<Button onClick={() => setIsNewOpen(true)} className="bg-emerald-500 text-black hover:bg-emerald-400"><Plus/> Új kérelem</Button>}
      />

      <Tabs value={tab} onValueChange={setTab} className="space-y-5">
        <TabsList className="w-fit max-w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="requests" className="h-9 px-4"><Receipt/> Költségtérítés</TabsTrigger>
          <TabsTrigger value="payroll" className="h-9 px-4"><Wallet/> {payrollManager ? "Havi fizetés" : "Fizetéseim"}</TabsTrigger>
          {payrollManager && <TabsTrigger value="settings" className="h-9 px-4"><SlidersHorizontal/> Fizetési tábla</TabsTrigger>}
          {highCommand && <TabsTrigger value="overview" className="h-9 px-4"><BarChart3/> Áttekintés</TabsTrigger>}
        </TabsList>

        <TabsContent value="requests" className="mt-0">
          <ReimbursementsTab canDecide={highCommand} reloadKey={reloadKey}/>
        </TabsContent>
        <TabsContent value="payroll" className="mt-0">
          {tab === "payroll" && (payrollManager ? <PayrollTab/> : <MyPayslips/>)}
        </TabsContent>
        {payrollManager && (
          <TabsContent value="settings" className="mt-0">
            {tab === "settings" && <PayrollSettingsTab canEdit={settingsEditor}/>}
          </TabsContent>
        )}
        {highCommand && (
          <TabsContent value="overview" className="mt-0">
            {tab === "overview" && <OverviewTab onOpenPending={() => setTab("requests")} onOpenPayroll={payrollManager ? () => setTab("payroll") : undefined}/>}
          </TabsContent>
        )}
      </Tabs>

      <NewBudgetRequestDialog open={isNewOpen} onOpenChange={setIsNewOpen} onSuccess={() => setReloadKey((key) => key + 1)}/>
    </div>
  );
}
