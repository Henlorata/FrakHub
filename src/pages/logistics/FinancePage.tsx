import * as React from "react";
import {useAuth} from "@/context/AuthContext";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardTitle} from "@/components/ui/card";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {Badge} from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import {Textarea} from "@/components/ui/textarea";
import {toast} from "sonner";
import {
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Trash2,
  Eye,
  Wallet,
  TrendingUp,
  History,
  DollarSign
} from "lucide-react";
import type {BudgetRequest} from "@/types/supabase";
import {NewBudgetRequestDialog} from "./components/NewBudgetRequestDialog";
import {ScrollArea} from "@/components/ui/scroll-area";
import {ImageViewerDialog} from "@/pages/mcb/components/ImageViewerDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {Tabs, TabsList, TabsTrigger} from "@/components/ui/tabs";

export function FinancePage() {
  const {supabase, profile, user} = useAuth();
  const [requests, setRequests] = React.useState<BudgetRequest[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isNewOpen, setIsNewOpen] = React.useState(false);
  const [filter, setFilter] = React.useState("all");

  const [selectedRequest, setSelectedRequest] = React.useState<BudgetRequest | null>(null);
  const [actionType, setActionType] = React.useState<'approve' | 'reject' | null>(null);
  const [adminComment, setAdminComment] = React.useState("");
  const [isProcessing, setIsProcessing] = React.useState(false);

  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [viewImage, setViewImage] = React.useState<{ url: string, name: string } | null>(null);

  const [isCleanupAlertOpen, setIsCleanupAlertOpen] = React.useState(false);
  const [isCleaning, setIsCleaning] = React.useState(false);

  const fetchRequests = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const {data, error} = await supabase
        .from('budget_requests')
        .select(`*, profiles!budget_requests_user_id_fkey (full_name, badge_number, faction_rank)`)
        .order('created_at', {ascending: false});
      if (error) throw error;
      setRequests((data as unknown as BudgetRequest[]) || []);
    } catch {
      toast.error("Hiba az adatok betöltésekor");
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  React.useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  const isExecutive = profile?.system_role === 'admin';

  const stats = React.useMemo(() => {
    const pending = requests.filter(r => r.status === 'pending').reduce((acc, curr) => acc + curr.amount, 0);
    const approved = requests.filter(r => r.status === 'approved').reduce((acc, curr) => acc + curr.amount, 0);
    const total = requests.length;
    return {pending, approved, total};
  }, [requests]);

  const filteredRequests = React.useMemo(() => {
    if (filter === 'all') return requests;
    return requests.filter(r => r.status === filter);
  }, [requests, filter]);

  const handleAdminAction = async () => {
    if (!selectedRequest || !actionType || !user) return;
    setIsProcessing(true);
    try {
      const updates: any = {
        status: actionType === 'approve' ? 'approved' : 'rejected',
        processed_by: user.id,
        updated_at: new Date().toISOString(),
      };

      if (actionType === 'reject' && !adminComment) throw new Error("Elutasításkor kötelező indoklást írni!");
      if (adminComment) updates.admin_comment = adminComment;

      const {error} = await (supabase.from('budget_requests') as any).update(updates).eq('id', selectedRequest.id);
      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: selectedRequest.user_id,
        title: 'Pénzügyi Kérelem Frissítés',
        message: `A $${selectedRequest.amount} értékű kérelmedet ${actionType === 'approve' ? 'elfogadták' : 'elutasították'}.`,
        type: actionType === 'approve' ? 'success' : 'alert',
        link: '/finance'
      });

      toast.success("Kérelem feldolgozva!");
      void fetchRequests();
      closeAdminDialog();
    } catch (err) {
      toast.error("Hiba", {description: (err as Error).message});
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCleanup = async () => {
    setIsCleaning(true);
    try {
      const response = await fetch('/api/cron/daily-cleanup', {method: 'POST'});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Hiba");
      toast.success("Takarítás kész!", {description: data.message});
      void fetchRequests();
    } catch (err) {
      toast.error("Hiba a takarítás közben");
    } finally {
      setIsCleaning(false);
      setIsCleanupAlertOpen(false);
    }
  };

  const handleViewImage = async (path: string) => {
    // Tisztítjuk a path-t, ha esetleg idézőjelek maradtak volna benne
    const cleanPath = path.replace(/['"]+/g, '');

    const {data} = await supabase.storage.from('finance_proofs').createSignedUrl(cleanPath, 3600);
    if (data?.signedUrl) {
      setViewImage({url: data.signedUrl, name: 'Bizonyíték'});
      setViewerOpen(true);
    } else {
      toast.error("Nem sikerült betölteni a képet.");
    }
  };

  const closeAdminDialog = () => {
    setSelectedRequest(null);
    setActionType(null);
    setAdminComment("");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-600 hover:bg-green-700 shadow-[0_0_10px_rgba(22,163,74,0.3)]"><CheckCircle2
          className="w-3 h-3 mr-1"/> Kifizetve</Badge>;
      case 'rejected':
        return <Badge className="bg-red-900 hover:bg-red-900 text-red-200 border border-red-800"><XCircle
          className="w-3 h-3 mr-1"/> Elutasítva</Badge>;
      default:
        return <Badge variant="secondary"
                      className="bg-yellow-600/20 text-yellow-500 hover:bg-yellow-600/30 border border-yellow-600/30 animate-pulse"><Clock
          className="w-3 h-3 mr-1"/> Függőben</Badge>;
    }
  };

  // Bizonyítékok normalizálása (Array vagy String kezelése)
  const getProofPaths = (req: any): string[] => {
    const raw = req.proof_image_path;
    if (!raw) return [];

    // Ha már tömb
    if (Array.isArray(raw)) return raw;

    // Ha string, de JSON tömbnek néz ki
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        // Nem JSON, sima string path
        return [raw];
      }
    }

    // Fallback: egy elemű tömb
    return [String(raw)];
  };

  if (isLoading && requests.length === 0) return <div className="flex h-screen items-center justify-center"><Loader2
    className="w-8 h-8 animate-spin text-yellow-500"/></div>;

  return (
    <div
      className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500 pb-10 h-[calc(100vh-6rem)] flex flex-col">
      <div
        className="flex justify-between items-center shrink-0 bg-slate-900/50 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-green-600/20 rounded-lg text-green-500"><Wallet className="w-6 h-6"/></div>
            Pénzügy
          </h1>
          <p className="text-slate-400 mt-1 ml-1">Költségtérítések, bírságok és pénzügyi tranzakciók.</p>
        </div>
        <div className="flex gap-2">
          {isExecutive && (
            <Button variant="outline"
                    className="border-red-900/50 text-red-400 hover:bg-red-950/30 hover:border-red-800 hover:text-red-300 transition-all"
                    onClick={() => setIsCleanupAlertOpen(true)} disabled={isCleaning}>
              <Trash2 className="w-4 h-4 mr-2"/> Régi Törlése
            </Button>
          )}
          <Button onClick={() => setIsNewOpen(true)}
                  className="bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/20 transition-all active:scale-95">
            <Plus className="w-4 h-4 mr-2"/> Új Igénylés
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        <Card
          className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors bg-gradient-to-br from-slate-900 to-slate-900/50">
          <CardContent className="p-6 flex items-center gap-4">
            <div
              className="p-4 bg-yellow-500/10 rounded-2xl border border-yellow-500/20 text-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.1)]">
              <Clock className="w-8 h-8"/></div>
            <div><p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Függő Kifizetés</p><p
              className="text-3xl font-bold text-white mt-1">${stats.pending.toLocaleString()}</p></div>
          </CardContent>
        </Card>
        <Card
          className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors bg-gradient-to-br from-slate-900 to-slate-900/50">
          <CardContent className="p-6 flex items-center gap-4">
            <div
              className="p-4 bg-green-500/10 rounded-2xl border border-green-500/20 text-green-500 shadow-[0_0_15px_rgba(34,197,94,0.1)]">
              <DollarSign className="w-8 h-8"/></div>
            <div><p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Kifizetve</p><p
              className="text-3xl font-bold text-white mt-1">${stats.approved.toLocaleString()}</p></div>
          </CardContent>
        </Card>
        <Card
          className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors bg-gradient-to-br from-slate-900 to-slate-900/50">
          <CardContent className="p-6 flex items-center gap-4">
            <div
              className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
              <TrendingUp className="w-8 h-8"/></div>
            <div><p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Összes Kérelem</p><p
              className="text-3xl font-bold text-white mt-1">{stats.total} db</p></div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={isCleanupAlertOpen} onOpenChange={setIsCleanupAlertOpen}>
        <AlertDialogContent className="bg-slate-900 border-slate-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Biztosan törlöd a régi adatokat?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">Ez a művelet véglegesen törli a 40 napnál régebbi, már
              lezárt kérelmeket.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 hover:bg-slate-800 text-white">Mégse</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white border-none" onClick={handleCleanup}>
              {isCleaning ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : null} Törlés
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs value={filter} onValueChange={setFilter} className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2">
          <CardTitle className="flex items-center gap-2 text-lg"><History
            className="w-5 h-5 text-slate-400"/> Tranzakciós Napló</CardTitle>
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="all">Összes</TabsTrigger>
            <TabsTrigger value="pending" className="data-[state=active]:text-yellow-500">Függőben</TabsTrigger>
            <TabsTrigger value="approved" className="data-[state=active]:text-green-500">Kifizetve</TabsTrigger>
            <TabsTrigger value="rejected" className="data-[state=active]:text-red-500">Elutasítva</TabsTrigger>
          </TabsList>
        </div>

        <Card className="bg-slate-900 border-slate-800 shadow-xl flex flex-col flex-1 min-h-0 overflow-hidden">
          <CardContent className="p-0 flex-1 min-h-0 overflow-hidden relative">
            <ScrollArea className="h-full w-full">
              <Table className="table-fixed w-full">
                <TableHeader className="bg-slate-900 sticky top-0 z-10 shadow-sm">
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="w-[120px] text-slate-400 font-semibold">Státusz</TableHead>
                    <TableHead className="w-[200px] text-slate-400 font-semibold">Igénylő</TableHead>
                    <TableHead className="w-[120px] text-slate-400 font-semibold">Összeg</TableHead>
                    <TableHead className="w-auto text-slate-400 font-semibold">Indoklás</TableHead>
                    <TableHead className="w-[120px] text-slate-400 font-semibold">Bizonyítékok</TableHead>
                    <TableHead className="w-[120px] text-slate-400 font-semibold text-right">Dátum</TableHead>
                    {isExecutive ? <TableHead className="w-[100px] text-right"></TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((req) => {
                    const paths = getProofPaths(req);

                    return (
                      <TableRow key={req.id} className="border-slate-800 hover:bg-slate-800/50 transition-colors group">
                        <TableCell className="align-top pt-4">{getStatusBadge(req.status)}</TableCell>
                        <TableCell className="align-top pt-4">
                          <div className="font-medium text-white truncate pr-2">{req.profiles?.full_name}</div>
                          <div className="text-xs text-slate-500 font-mono">#{req.profiles?.badge_number}</div>
                        </TableCell>
                        <TableCell className="font-mono font-bold text-green-400 text-base align-top pt-4">
                          ${req.amount.toLocaleString()}
                        </TableCell>

                        <TableCell className="align-top pt-4">
                          <div
                            className="break-all whitespace-pre-wrap text-sm text-slate-300 w-full max-w-[300px] md:max-w-none">
                            {req.reason}
                          </div>
                          {req.admin_comment && (
                            <div
                              className="text-xs text-red-400 mt-2 italic break-all whitespace-pre-wrap w-full bg-red-950/20 p-1.5 rounded border border-red-900/20">
                              Megj: {req.admin_comment}
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="align-top pt-4">
                          <div className="flex flex-wrap gap-1">
                            {paths.length > 0 ? (
                              paths.map((path, idx) => (
                                <Button key={idx} size="sm" variant="outline"
                                        className="h-6 text-[10px] border-slate-700 hover:bg-slate-800 px-2 mb-1 text-slate-400 hover:text-white"
                                        onClick={() => handleViewImage(path)}>
                                  <Eye className="w-3 h-3 mr-1"/> {idx + 1}.
                                </Button>
                              ))
                            ) : <span className="text-xs text-slate-500 italic">Nincs</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-500 text-xs text-right font-mono align-top pt-4">
                          {new Date(req.created_at).toLocaleDateString('hu-HU')}
                        </TableCell>

                        {isExecutive ? (
                          <TableCell className="text-right space-x-1 align-top pt-3 whitespace-nowrap">
                            {req.status === 'pending' && (
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="icon" variant="ghost"
                                        className="h-8 w-8 text-green-500 hover:text-green-400 hover:bg-green-900/20"
                                        onClick={() => {
                                          setSelectedRequest(req);
                                          setActionType('approve');
                                        }}><CheckCircle2 className="w-5 h-5"/></Button>
                                <Button size="icon" variant="ghost"
                                        className="h-8 w-8 text-red-500 hover:text-red-400 hover:bg-red-900/20"
                                        onClick={() => {
                                          setSelectedRequest(req);
                                          setActionType('reject');
                                        }}><XCircle className="w-5 h-5"/></Button>
                              </div>
                            )}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </Tabs>

      <NewBudgetRequestDialog open={isNewOpen} onOpenChange={setIsNewOpen} onSuccess={fetchRequests}/>
      <ImageViewerDialog open={viewerOpen} onOpenChange={setViewerOpen} imageUrl={viewImage?.url || null}
                         fileName={viewImage?.name || "Bizonyíték"}/>

      {/* ADMIN DIALOG */}
      <Dialog open={!!selectedRequest} onOpenChange={(o) => !o && closeAdminDialog()}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kérelem {actionType === 'approve' ? 'Elfogadása' : 'Elutasítása'}</DialogTitle>
            <DialogDescription>Összeg: ${selectedRequest?.amount}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {actionType === 'reject' && (
              <div className="space-y-2">
                <Label>Elutasítás Indoka</Label>
                <Textarea
                  placeholder="Elutasítás indoka..."
                  className="bg-slate-950 border-slate-700 resize-none h-24 break-all"
                  value={adminComment}
                  onChange={(e) => setAdminComment(e.target.value)}
                  autoFocus
                />
              </div>
            )}
            {actionType === 'approve' && <p>Biztosan jóváhagyod a kifizetést?</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeAdminDialog}>Mégse</Button>
            <Button
              className={actionType === 'approve' ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}
              onClick={handleAdminAction} disabled={isProcessing}>
              {isProcessing ? <Loader2
                className="w-4 h-4 animate-spin mr-2"/> : null}{actionType === 'approve' ? 'Jóváhagyás' : 'Elutasítás'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}