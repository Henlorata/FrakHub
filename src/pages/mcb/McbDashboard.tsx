// FrakHub/src/pages/mcb/McbDashboard.tsx
// (JAVÍTVA: TypeScript hiba ('error.message') és hibaállapot-kezelés)

import * as React from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilePlus, Loader2, FileSearch, AlertTriangle, Search } from "lucide-react";
import { Toaster, toast } from "sonner";
import { NewCaseDialog } from "./components/NewCaseDialog";
import type { CaseRow } from "@/types/supabase";
import {Link} from "react-router-dom";

// Segédfüggvény a státusz színezéséhez (VÁLTOZATLAN)
const getStatusBadge = (status: string) => {
  switch (status) {
    case "open":
      return <Badge variant="default" className="bg-green-600">Nyitott</Badge>;
    case "closed":
      return <Badge variant="secondary">Lezárt</Badge>;
    case "archived":
      return <Badge variant="outline">Archivált</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export function McbDashboard() {
  const { supabase, profile } = useAuth();

  const [myCases, setMyCases] = React.useState<CaseRow[]>([]);
  const [allCases, setAllCases] = React.useState<CaseRow[]>([]);
  const [isLoadingMyCases, setIsLoadingMyCases] = React.useState(true);
  const [isLoadingAllCases, setIsLoadingAllCases] = React.useState(true);

  // --- JAVÍTÁS: 'error' átnevezve 'dashboardError'-ra ---
  const [dashboardError, setDashboardError] = React.useState<string | null>(null);
  const [isNewCaseOpen, setIsNewCaseOpen] = React.useState(false);

  const [activeTab, setActiveTab] = React.useState("my-cases");
  const [searchTerm, setSearchTerm] = React.useState("");

  // Adatlekérő funkciók
  const fetchMyCases = async () => {
    setIsLoadingMyCases(true);
    setDashboardError(null); // Töröljük a korábbi hibát
    const { data, error } = await supabase.rpc('get_my_cases');
    if (error) {
      console.error("Hiba a 'saját' akták lekérésekor:", error);
      setDashboardError(error.message); // JAVÍTVA
      toast.error("Hiba a saját akták lekérésekor", { description: error.message });
    } else {
      setMyCases(data || []);
    }
    setIsLoadingMyCases(false);
  };

  const fetchAllCases = async () => {
    setIsLoadingAllCases(true);
    // (A dashboardError-t nem töröljük, hátha a myCases-nél már volt hiba)
    const { data, error } = await supabase.rpc('get_all_mcb_cases');

    if (error) {
      console.error("Hiba az 'összes' akta lekérésekor:", error);

      // --- JAVÍTÁS: A hibaellenőrzés javítva ---
      // Csak akkor állítjuk be a hibát, ha még nem volt hiba a 'myCases' lekérésnél
      if (!dashboardError) {
        setDashboardError(error.message);
        toast.error("Hiba az összes akta lekérésekor", { description: error.message });
      }
      // --- JAVÍTÁS VÉGE ---
    } else {
      setAllCases(data || []);
    }
    setIsLoadingAllCases(false);
  };

  // Betöltéskor lefuttatjuk
  React.useEffect(() => {
    fetchMyCases();
    if (profile?.role === 'lead_detective') {
      fetchAllCases();
    }
  }, [profile]);

  // Callback, amit a NewCaseDialog hív meg
  const handleCaseCreated = () => {
    fetchMyCases();
    if (profile?.role === 'lead_detective') {
      fetchAllCases();
    }
  };

  // Keresési és szűrési logika (VÁLTOZATLAN)
  const filteredData = React.useMemo(() => {
    const sourceData = (activeTab === 'my-cases' || profile?.role !== 'lead_detective')
      ? myCases
      : allCases;
    if (!searchTerm) {
      return sourceData;
    }
    const lowerSearch = searchTerm.toLowerCase();
    return sourceData.filter(caseItem => {
      if (caseItem.title.toLowerCase().includes(lowerSearch)) {
        return true;
      }
      if (caseItem.owner_full_name.toLowerCase().includes(lowerSearch)) {
        return true;
      }
      const caseNumberString = typeof caseItem.case_number === 'number'
        ? caseItem.case_number.toString()
        : caseItem.case_number;
      if (caseNumberString.toLowerCase().includes(lowerSearch)) {
        return true;
      }
      return false;
    });
  }, [searchTerm, activeTab, myCases, allCases, profile]);

  const isLoading = activeTab === 'my-cases' ? isLoadingMyCases : isLoadingAllCases;

  // A tartalom renderelése (most már a 'dashboardError'-t használja)
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center py-16">
          <Loader2 className="h-12 w-12 animate-spin text-slate-400" />
        </div>
      );
    }

    // --- JAVÍTVA: 'dashboardError'-t ellenőrizzük ---
    if (dashboardError) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-red-400">
          <AlertTriangle className="h-12 w-12" />
          <p className="mt-4 text-lg font-semibold">Hiba történt</p>
          <p className="text-sm text-red-300">{dashboardError}</p>
        </div>
      );
    }

    if (filteredData.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <FileSearch className="h-12 w-12" />
          <p className="mt-4 text-lg font-semibold">
            {searchTerm ? "Nincs a keresésnek megfelelő akta" : "Nincsenek akták"}
          </p>
          <p className="text-sm">
            {searchTerm
              ? "Próbálj más keresőszót használni."
              : (activeTab === 'my-cases'
                ? "Nincsenek hozzád rendelt akták."
                : "Nincsenek akták a rendszerben.")}
          </p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Cím</TableHead>
            <TableHead>Státusz</TableHead>
            <TableHead>Tulajdonos</TableHead>
            <TableHead className="text-right">Műveletek</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredData.map((caseItem) => (
            <TableRow key={caseItem.id}>
              <TableCell className="font-medium">#{caseItem.case_number}</TableCell>
              <TableCell>{caseItem.title}</TableCell>
              <TableCell>{getStatusBadge(caseItem.status)}</TableCell>
              <TableCell>{caseItem.owner_full_name}</TableCell>
              <TableCell className="text-right">
                <Button asChild variant="outline" size="sm">
                  <Link to={`/mcb/case/${caseItem.id}`}>
                    Megnyitás
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  // --- Visszatérés (VÁLTOZATLAN) ---
  return (
    <>
      <Toaster position="top-center" richColors theme="dark" />

      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-3xl font-bold">MCB Irányítópult</h1>
          <p className="text-slate-400">
            Itt láthatod a hozzád rendelt és általad létrehozott aktákat.
          </p>
        </div>
        <Button onClick={() => setIsNewCaseOpen(true)}>
          <FilePlus className="w-4 h-4 mr-2" /> Új Akta
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
        <TabsList className="bg-slate-800">
          <TabsTrigger value="my-cases">Saját Aktáim</TabsTrigger>
          {profile?.role === 'lead_detective' && (
            <TabsTrigger value="all-cases">Összes Akta</TabsTrigger>
          )}
        </TabsList>
      </Tabs>

      <Card className="bg-slate-900 border-slate-700 text-white">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>
              {activeTab === 'my-cases' ? "Saját Aktáim" : "Összes Akta"}
            </CardTitle>
            <CardDescription>
              {activeTab === 'my-cases'
                ? "Az összes akta, amihez hozzáférésed van."
                : "Az összes akta a rendszerben (Admin nézet)."
              }
            </CardDescription>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              placeholder="Keresés (cím, #szám, tulajdonos)..."
              className="pl-10 bg-slate-800"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {renderContent()}
        </CardContent>
      </Card>

      <NewCaseDialog
        open={isNewCaseOpen}
        onOpenChange={setIsNewCaseOpen}
        onCaseCreated={handleCaseCreated}
      />
    </>
  );
}