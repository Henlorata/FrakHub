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
import { FilePlus, Loader2, FileSearch, AlertTriangle } from "lucide-react";
import { Toaster, toast } from "sonner";
import { NewCaseDialog } from "./components/NewCaseDialog";
import type { CaseRow } from "@/types/supabase";
import {Link} from "react-router-dom";

// Segédfüggvény a státusz színezéséhez
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
  const { supabase } = useAuth();
  const [cases, setCases] = React.useState<CaseRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isNewCaseOpen, setIsNewCaseOpen] = React.useState(false);

  // Adatlekérő funkció
  const fetchCases = async () => {
    setIsLoading(true);
    setError(null);

    // Az új, biztonságos SQL függvényünket hívjuk!
    const { data, error } = await supabase.rpc('get_my_cases');

    if (error) {
      console.error("Hiba az akták lekérésekor:", error);
      setError(error.message);
      toast.error("Hiba az akták lekérésekor", { description: error.message });
    } else {
      setCases(data || []);
    }
    setIsLoading(false);
  };

  // Betöltéskor lefuttatjuk
  React.useEffect(() => {
    fetchCases();
  }, []);

  // Callback, amit a NewCaseDialog hív meg
  const handleCaseCreated = () => {
    // Újra lekérjük az összeset, hogy a lista frissüljön
    // (A CaseRow és Case típusok nem egyeznek, ezért egyszerűbb újra lekérni)
    fetchCases();
  };

  // A tartalom renderelése
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center py-16">
          <Loader2 className="h-12 w-12 animate-spin text-slate-400" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-red-400">
          <AlertTriangle className="h-12 w-12" />
          <p className="mt-4 text-lg font-semibold">Hiba történt</p>
          <p className="text-sm text-red-300">{error}</p>
        </div>
      );
    }

    if (cases.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <FileSearch className="h-12 w-12" />
          <p className="mt-4 text-lg font-semibold">Nincsenek aktáid</p>
          <p className="text-sm">Nincsenek hozzád rendelt akták, vagy még nem hoztál létre egyet sem.</p>
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
          {cases.map((caseItem) => (
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

      <Card className="bg-slate-900 border-slate-700 text-white">
        <CardHeader>
          <CardTitle>Aktáim</CardTitle>
          <CardDescription>
            Az összes 'Nyitott' akta, amihez hozzáférésed van.
          </CardDescription>
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