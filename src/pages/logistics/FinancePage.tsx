import * as React from "react";
import {useAuth} from "@/context/AuthContext";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
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
  History
} from "lucide-react";
import type {BudgetRequest} from "@/types/supabase";
import {NewBudgetRequestDialog} from "./components/NewBudgetRequestDialog";
import {ScrollArea} from "@/components/ui/scroll-area"; // ÚJ IMPORT

export function FinancePage() {
  const {supabase, profile, user} = useAuth();
  const [requests, setRequests] = React.useState<BudgetRequest[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isNewOpen, setIsNewOpen] = React.useState(false);

  const [selectedRequest, setSelectedRequest] = React.useState<BudgetRequest | null>(null);
  const [actionType, setActionType] = React.useState<'approve' | 'reject' | null>(null);
  const [adminComment, setAdminComment] = React.useState("");
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [viewImageUrl, setViewImageUrl] = React.useState<string | null>(null);

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

  // JAVÍTOTT API HÍVÁS (daily-cleanup)
  const handleCleanup = async () => {
    setIsCleaning(true);
    try {
      const response = await fetch('/api/cron/daily-cleanup', {method: 'POST'}); // JAVÍTVA
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
    const {data} = await supabase.storage.from('finance_proofs').createSignedUrl(path, 60);
    if (data?.signedUrl) setViewImageUrl(data.signedUrl);
    else toast.error("Nem sikerült betölteni a képet.");
  };

  const closeAdminDialog = () => {
    setSelectedRequest(null);
    setActionType(null);
    setAdminComment("");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-600 hover:bg-green-700"><CheckCircle2
          className="w-3 h-3 mr-1"/> Kifizetve</Badge>;
      case 'rejected':
        return <Badge className="bg-red-900 hover:bg-red-900 text-red-200"><XCircle
          className="w-3 h-3 mr-1"/> Elutasítva</Badge>;
      default:
        return <Badge variant="secondary" className="bg-yellow-600/20 text-yellow-500 hover:bg-yellow-600/30"><Clock
          className="w-3 h-3 mr-1"/> Függőben</Badge>;
    }
  };

  if (isLoading && requests.length === 0) return <div className="flex h-screen items-center justify-center"><Loader2
    className="w-8 h-8 animate-spin text-yellow-500"/></div>;

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500 pb-10">
      <div className="flex justify-between items-center">
        <div><h1 className="text-3xl font-bold text-white">Pénzügy</h1><p className="text-slate-400">Költségtérítések és
          bírságok kezelése.</p></div>
        <div className="flex gap-2">
          {isExecutive && (
            <Button variant="outline" className="border-red-900/50 text-red-400 hover:bg-red-950/30"
                    onClick={() => setIsCleanupAlertOpen(true)} disabled={isCleaning}>
              <Trash2 className="w-4 h-4 mr-2"/> Régi Adatok Törlése
            </Button>
          )}
          <Button onClick={() => setIsNewOpen(true)} className="bg-green-600 hover:bg-green-700 text-white"><Plus
            className="w-4 h-4 mr-2"/> Új Igénylés</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* ... Kártyák maradnak változatlanul ... */}
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/20 text-yellow-500"><Clock
              className="w-6 h-6"/></div>
            <div><p className="text-xs text-slate-500 uppercase font-bold">Függő Kifizetés</p><p
              className="text-2xl font-bold text-white">${stats.pending.toLocaleString()}</p></div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-green-500/10 rounded-xl border border-green-500/20 text-green-500"><Wallet
              className="w-6 h-6"/></div>
            <div><p className="text-xs text-slate-500 uppercase font-bold">Jóváhagyva</p><p
              className="text-2xl font-bold text-white">${stats.approved.toLocaleString()}</p></div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-500"><TrendingUp
              className="w-6 h-6"/></div>
            <div><p className="text-xs text-slate-500 uppercase font-bold">Összes Kérelem</p><p
              className="text-2xl font-bold text-white">{stats.total} db</p></div>
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
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white border-none"
                               onClick={handleCleanup}>{isCleaning ?
              <Loader2 className="w-4 h-4 animate-spin mr-2"/> : null} Törlés</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="bg-slate-900 border-slate-800 shadow-lg flex flex-col h-[600px]"> {/* FIX MAGASSÁG */}
        <CardHeader className="border-b border-slate-800/50 pb-4 shrink-0">
          <CardTitle className="flex items-center gap-2 text-lg"><History
            className="w-5 h-5 text-slate-400"/> Tranzakciós Napló</CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full"> {/* SCROLL AREA */}
            <Table>
              <TableHeader className="bg-slate-950/50 sticky top-0 z-10">
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="w-[120px] text-slate-400">Státusz</TableHead>
                  <TableHead className="text-slate-400">Igénylő</TableHead>
                  <TableHead className="text-slate-400">Összeg</TableHead>
                  <TableHead className="text-slate-400 max-w-[300px]">Indoklás</TableHead>
                  <TableHead className="text-slate-400">Bizonyíték</TableHead>
                  <TableHead className="text-slate-400 text-right">Dátum</TableHead>
                  {isExecutive && <TableHead className="text-right"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => (
                  <TableRow key={req.id} className="border-slate-800 hover:bg-slate-800/30 transition-colors">
                    <TableCell>{getStatusBadge(req.status)}</TableCell>
                    <TableCell>
                      <div className="font-medium text-white">{req.profiles?.full_name}</div>
                      <div className="text-xs text-slate-500 font-mono">#{req.profiles?.badge_number}</div>
                    </TableCell>
                    <TableCell
                      className="font-mono font-bold text-green-400 text-base">${req.amount.toLocaleString()}</TableCell>
                    <TableCell className="max-w-[300px]"><p className="text-sm text-slate-300 truncate"
                                                            title={req.reason}>{req.reason}</p>{req.admin_comment &&
                      <p className="text-xs text-red-400 mt-1 italic truncate">Megj: {req.admin_comment}</p>}
                    </TableCell>
                    <TableCell><Button size="sm" variant="outline"
                                       className="h-7 text-xs border-slate-700 hover:bg-slate-800"
                                       onClick={() => handleViewImage(req.proof_image_path)}><Eye
                      className="w-3 h-3 mr-1"/> Megtekint</Button></TableCell>
                    <TableCell
                      className="text-slate-500 text-xs text-right font-mono">{new Date(req.created_at).toLocaleDateString('hu-HU')}</TableCell>
                    {isExecutive && req.status === 'pending' && (
                      <TableCell className="text-right space-x-1">
                        <Button size="icon" variant="ghost"
                                className="h-8 w-8 text-green-500 hover:text-green-400 hover:bg-green-900/30"
                                onClick={() => {
                                  setSelectedRequest(req);
                                  setActionType('approve');
                                }}><CheckCircle2 className="w-5 h-5"/></Button>
                        <Button size="icon" variant="ghost"
                                className="h-8 w-8 text-red-500 hover:text-red-400 hover:bg-red-900/30" onClick={() => {
                          setSelectedRequest(req);
                          setActionType('reject');
                        }}><XCircle className="w-5 h-5"/></Button>
                      </TableCell>
                    )}
                    {isExecutive && req.status !== 'pending' && <TableCell></TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <NewBudgetRequestDialog open={isNewOpen} onOpenChange={setIsNewOpen} onSuccess={fetchRequests}/>
      {/* ... (Dialogok maradnak) ... */}
      <Dialog open={!!viewImageUrl} onOpenChange={(o) => !o && setViewImageUrl(null)}>
        <DialogContent className="bg-black border-slate-800 text-white max-w-4xl p-0 overflow-hidden">
          <div className="relative w-full h-[80vh] flex items-center justify-center">
            {viewImageUrl && <img src={viewImageUrl} className="max-w-full max-h-full object-contain" alt="Proof"/>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedRequest} onOpenChange={(o) => !o && closeAdminDialog()}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader><DialogTitle>Kérelem {actionType === 'approve' ? 'Elfogadása' : 'Elutasítása'}</DialogTitle><DialogDescription>Összeg:
            ${selectedRequest?.amount}</DialogDescription></DialogHeader>
          <div className="py-4 space-y-4">
            {actionType === 'reject' && (<div className="space-y-2"><Textarea placeholder="Elutasítás indoka..."
                                                                              className="bg-slate-950 border-slate-700"
                                                                              value={adminComment}
                                                                              onChange={(e) => setAdminComment(e.target.value)}
                                                                              autoFocus/></div>)}
            {actionType === 'approve' && <p>Biztosan jóváhagyod a kifizetést?</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeAdminDialog}>Mégse</Button>
            <Button
              className={actionType === 'approve' ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}
              onClick={handleAdminAction} disabled={isProcessing}>{isProcessing && <Loader2
              className="w-4 h-4 mr-2 animate-spin"/>}{actionType === 'approve' ? 'Jóváhagyás' : 'Elutasítás'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}