import * as React from "react";
import {useAuth} from "@/context/AuthContext";
import {Button} from "@/components/ui/button";
import {Label} from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {Textarea} from "@/components/ui/textarea";
import {toast} from "sonner";
import {
  Plus, Check, X, Clock, Loader2, Trash2, Eye, Wallet, History, DollarSign, FileBarChart, CreditCard
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
import {Tabs} from "@/components/ui/tabs";
import {cn} from "@/lib/utils";

// --- LEDGER BACKGROUND ---
const LedgerGrid = () => (
  <div className="absolute inset-0 pointer-events-none opacity-[0.05]"
       style={{
         backgroundImage: 'linear-gradient(to right, #22c55e 1px, transparent 1px), linear-gradient(to bottom, #22c55e 1px, transparent 1px)',
         backgroundSize: '40px 40px'
       }}
  />
);

export function FinancePage() {
  const {supabase, profile, user} = useAuth();
  const [requests, setRequests] = React.useState<BudgetRequest[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isNewOpen, setIsNewOpen] = React.useState(false);
  const [filter, setFilter] = React.useState("all");

  // State
  const [selectedRequest, setSelectedRequest] = React.useState<BudgetRequest | null>(null);
  const [actionType, setActionType] = React.useState<'approve' | 'reject' | null>(null);
  const [adminComment, setAdminComment] = React.useState("");
  const [isProcessing, setIsProcessing] = React.useState(false);

  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [viewImage, setViewImage] = React.useState<{ url: string, name: string } | null>(null);
  const [isCleanupAlertOpen, setIsCleanupAlertOpen] = React.useState(false);
  const [isCleaning, setIsCleaning] = React.useState(false);

  // Adatok lekérése
  const fetchRequests = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const {data, error} = await supabase.from('budget_requests')
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

  // Statisztikák
  const stats = React.useMemo(() => ({
    pending: requests.filter(r => r.status === 'pending').reduce((acc, curr) => acc + curr.amount, 0),
    approved: requests.filter(r => r.status === 'approved').reduce((acc, curr) => acc + curr.amount, 0),
    total: requests.length
  }), [requests]);

  const filteredRequests = React.useMemo(() => {
    if (filter === 'all') return requests;
    return requests.filter(r => r.status === filter);
  }, [requests, filter]);

  // Admin műveletek
  const handleAdminAction = async () => {
    if (!selectedRequest || !actionType || !user) return;
    setIsProcessing(true);
    try {
      const updates: any = {
        status: actionType === 'approve' ? 'approved' : 'rejected',
        processed_by: user.id,
        updated_at: new Date().toISOString()
      };
      if (actionType === 'reject' && !adminComment) throw new Error("Indoklás kötelező!");
      if (adminComment) updates.admin_comment = adminComment;

      const {error} = await (supabase.from('budget_requests') as any).update(updates).eq('id', selectedRequest.id);
      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: selectedRequest.user_id,
        title: 'Pénzügyi Értesítés',
        message: `A kérelmed státusza frissült: ${actionType === 'approve' ? 'JÓVÁHAGYVA' : 'ELUTASÍTVA'}.`,
        type: actionType === 'approve' ? 'success' : 'alert',
        link: '/finance'
      });

      toast.success("Tranzakció feldolgozva.");
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
      if (!response.ok) throw new Error();
      toast.success("Archiválás kész.");
      void fetchRequests();
    } catch {
      toast.error("Hiba a tisztítás közben");
    } finally {
      setIsCleaning(false);
      setIsCleanupAlertOpen(false);
    }
  };

  const handleViewImage = async (path: string) => {
    const cleanPath = path.replace(/['"]+/g, '');
    const {data} = await supabase.storage.from('finance_proofs').createSignedUrl(cleanPath, 3600);
    if (data?.signedUrl) {
      setViewImage({url: data.signedUrl, name: 'Bizonyíték'});
      setViewerOpen(true);
    } else toast.error("Nem sikerült megnyitni.");
  };

  const closeAdminDialog = () => {
    setSelectedRequest(null);
    setActionType(null);
    setAdminComment("");
  };

  // Bizonyíték path helper
  const getProofPaths = (req: any): string[] => {
    const raw = req.proof_image_path;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [String(raw)];
    }
    return [String(raw)];
  };

  if (isLoading && requests.length === 0) return <div className="flex h-screen items-center justify-center"><Loader2
    className="w-10 h-10 animate-spin text-green-500"/></div>;

  return (
    <div
      className="space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-10 h-[calc(100vh-6rem)] flex flex-col">

      {/* --- FINANCE HEADER --- */}
      <div
        className="flex justify-between items-center shrink-0 bg-[#050a14] border-b-2 border-green-500/20 p-6 relative overflow-hidden shadow-lg">
        <LedgerGrid/>
        <div className="relative z-10 flex items-center gap-4">
          <div
            className="p-3 bg-green-500/10 border border-green-500/30 text-green-500 rounded-md shadow-[0_0_15px_rgba(34,197,94,0.15)]">
            <Wallet className="w-8 h-8"/>
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight uppercase font-mono">PÉNZÜGYI NAPLÓ</h1>
            <p className="text-xs text-green-500/60 font-bold uppercase tracking-widest">Treasury Department Ledger</p>
          </div>
        </div>
        <div className="relative z-10 flex gap-3">
          {isExecutive && (
            <Button variant="outline" className="border-red-900/50 text-red-400 hover:bg-red-900/20 hover:text-red-300"
                    onClick={() => setIsCleanupAlertOpen(true)}>
              <Trash2 className="w-4 h-4 mr-2"/> ARCHÍVUM
            </Button>
          )}
          <Button onClick={() => setIsNewOpen(true)}
                  className="bg-green-600 hover:bg-green-500 text-white font-bold uppercase tracking-wider h-10 px-6 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
            <Plus className="w-4 h-4 mr-2"/> ÚJ TÉTEL
          </Button>
        </div>
      </div>

      {/* --- STATS ROW --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        {[
          {
            label: 'FÜGGŐ KIFIZETÉS',
            val: stats.pending,
            icon: Clock,
            color: 'text-yellow-500',
            bg: 'bg-yellow-500/10',
            border: 'border-yellow-500/20'
          },
          {
            label: 'KIFIZETETT ÖSSZEG',
            val: stats.approved,
            icon: DollarSign,
            color: 'text-green-500',
            bg: 'bg-green-500/10',
            border: 'border-green-500/20'
          },
          {
            label: 'TRANZAKCIÓK SZÁMA',
            val: stats.total,
            icon: FileBarChart,
            color: 'text-blue-500',
            bg: 'bg-blue-500/10',
            border: 'border-blue-500/20',
            isCount: true
          }
        ].map((s, i) => (
          <div key={i}
               className="bg-[#0b1221] border border-slate-800 p-5 flex items-center gap-4 relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className={`p-3 rounded ${s.bg} ${s.border} ${s.color} border`}>
              <s.icon className="w-6 h-6"/>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">{s.label}</div>
              <div
                className={`text-2xl font-mono font-bold text-white group-hover:scale-105 transition-transform origin-left`}>
                {s.isCount ? s.val : `$${s.val.toLocaleString()}`}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* --- LEDGER TABLE --- */}
      <Tabs value={filter} onValueChange={setFilter} className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="text-xs font-mono text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <History className="w-4 h-4"/> LIVE TRANSACTION FEED
          </div>
          <div className="flex gap-2">
            {['all', 'pending', 'approved', 'rejected'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                      className={cn("px-3 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider border transition-all", filter === f ? "bg-slate-800 text-white border-slate-600" : "text-slate-500 border-transparent hover:bg-slate-900")}>
                {f === 'all' ? 'ÖSSZES' : f}
              </button>
            ))}
          </div>
        </div>

        <div
          className="flex-1 bg-[#0b1221] border border-slate-800 rounded-sm relative overflow-hidden flex flex-col shadow-2xl">
          {/* Table Header */}
          <div
            className="bg-slate-950/80 border-b border-slate-800 grid grid-cols-12 gap-2 px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest sticky top-0 z-10 backdrop-blur-md">
            <div className="col-span-1">STATUS</div>
            <div className="col-span-2">BENEFICIARY</div>
            <div className="col-span-2 text-right pr-4">AMOUNT</div>
            <div className="col-span-4">DESCRIPTION</div>
            <div className="col-span-2">EVIDENCE</div>
            <div className="col-span-1 text-right">DATE</div>
          </div>

          <ScrollArea className="flex-1">
            {filteredRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 opacity-30 text-slate-500">
                <CreditCard className="w-16 h-16 mb-4"/>
                <p className="font-mono text-sm uppercase tracking-widest">NO TRANSACTIONS FOUND</p>
              </div>
            ) : filteredRequests.map((req, i) => {
              const paths = getProofPaths(req);
              return (
                <div key={req.id}
                     className={cn("grid grid-cols-12 gap-2 px-4 py-3 border-b border-slate-800/50 hover:bg-slate-900/50 transition-colors group text-sm items-start font-mono relative", i % 2 === 0 ? 'bg-[#0b1221]' : 'bg-[#0d1526]')}>

                  {/* Bal oldali státusz csík */}
                  <div
                    className={cn("absolute left-0 top-0 bottom-0 w-0.5", req.status === 'approved' ? 'bg-green-500' : req.status === 'rejected' ? 'bg-red-500' : 'bg-yellow-500')}/>

                  <div className="col-span-1 pt-1">
                    {req.status === 'approved' ?
                      <span className="text-green-500 font-bold bg-green-500/10 px-1 rounded">PAID</span> :
                      req.status === 'rejected' ?
                        <span className="text-red-500 font-bold bg-red-500/10 px-1 rounded">VOID</span> :
                        <span
                          className="text-yellow-500 font-bold bg-yellow-500/10 px-1 rounded animate-pulse">PEND</span>}
                  </div>

                  <div className="col-span-2 pt-1">
                    <div className="text-white font-bold truncate">{req.profiles?.full_name}</div>
                    <div className="text-[10px] text-slate-500">ID: {req.profiles?.badge_number}</div>
                  </div>

                  <div className="col-span-2 text-right pr-4 pt-1">
                          <span
                            className={cn("font-bold text-base", req.status === 'rejected' ? "text-slate-500 line-through" : "text-white")}>
                             ${req.amount.toLocaleString()}
                          </span>
                  </div>

                  <div className="col-span-4 pr-4 pt-1">
                    <div className="text-slate-300 text-xs leading-relaxed break-words">{req.reason}</div>
                    {req.admin_comment && <div
                      className="mt-1 text-[10px] text-red-400 bg-red-950/20 p-1 rounded border border-red-900/30">REJECT
                      REASON: {req.admin_comment}</div>}
                  </div>

                  <div className="col-span-2 pt-1 flex flex-wrap gap-1">
                    {paths.length > 0 ? paths.map((path, idx) => (
                      <button key={idx} onClick={() => handleViewImage(path)}
                              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 text-[9px] text-slate-300 rounded flex items-center gap-1 transition-all">
                        <Eye className="w-2.5 h-2.5"/> IMG {idx + 1}
                      </button>
                    )) : <span className="text-slate-600 text-[10px] italic">N/A</span>}
                  </div>

                  <div className="col-span-1 text-right text-slate-500 text-[10px] pt-1">
                    {new Date(req.created_at).toLocaleDateString()}
                  </div>

                  {/* Quick Actions (Admin) */}
                  {isExecutive && req.status === 'pending' && (
                    <div
                      className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-[#0b1221] p-1 rounded border border-slate-700 shadow-xl">
                      <Button size="icon" className="h-6 w-6 bg-green-600 hover:bg-green-500 text-white"
                              onClick={() => {
                                setSelectedRequest(req);
                                setActionType('approve');
                              }}><Check className="w-3.5 h-3.5"/></Button>
                      <Button size="icon" className="h-6 w-6 bg-red-600 hover:bg-red-500 text-white" onClick={() => {
                        setSelectedRequest(req);
                        setActionType('reject');
                      }}><X className="w-3.5 h-3.5"/></Button>
                    </div>
                  )}
                </div>
              )
            })}
          </ScrollArea>
        </div>
      </Tabs>

      <NewBudgetRequestDialog open={isNewOpen} onOpenChange={setIsNewOpen} onSuccess={fetchRequests}/>
      <ImageViewerDialog open={viewerOpen} onOpenChange={setViewerOpen} imageUrl={viewImage?.url || null}
                         fileName={viewImage?.name || "Bizonyíték"}/>

      {/* ADMIN PROCESS DIALOG */}
      <Dialog open={!!selectedRequest} onOpenChange={(o) => !o && closeAdminDialog()}>
        <DialogContent
          className="bg-[#0b1221] border border-slate-700 text-white sm:max-w-md p-0 overflow-hidden shadow-2xl">
          <div
            className={`p-4 border-b border-white/10 ${actionType === 'approve' ? 'bg-green-900/20' : 'bg-red-900/20'} flex items-center gap-3`}>
            <div
              className={`p-2 rounded border ${actionType === 'approve' ? 'border-green-500 text-green-500' : 'border-red-500 text-red-500'}`}>
              <DollarSign className="w-5 h-5"/>
            </div>
            <div>
              <DialogTitle className="font-mono uppercase font-bold text-lg tracking-tight">
                {actionType === 'approve' ? 'TRANZAKCIÓ JÓVÁHAGYÁSA' : 'TRANZAKCIÓ ELUTASÍTÁSA'}
              </DialogTitle>
              <DialogDescription
                className="text-xs text-slate-400 font-mono">ID: {selectedRequest?.id.slice(0, 8).toUpperCase()}</DialogDescription>
            </div>
          </div>

          <div className="p-6">
            {actionType === 'reject' ? (
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-slate-500">Elutasítás Indoka</Label>
                <Textarea className="bg-slate-950 border-slate-700 font-mono text-xs focus-visible:ring-red-500/50 break-all"
                          placeholder="Hivatalos indoklás..." value={adminComment}
                          onChange={e => setAdminComment(e.target.value)} autoFocus/>
              </div>
            ) : (
              <div className="text-center space-y-2">
                <p className="text-slate-400 text-xs uppercase font-bold">Kifizetendő összeg</p>
                <p
                  className="font-mono text-3xl font-bold text-green-400 tracking-tighter">${selectedRequest?.amount.toLocaleString()}</p>
                <p className="text-[10px] text-slate-500 italic mt-2">A tranzakció rögzítésre kerül a főkönyvben.</p>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 bg-slate-950 border-t border-slate-800">
            <Button variant="ghost" onClick={closeAdminDialog}
                    className="hover:bg-slate-800 text-slate-400">Mégse</Button>
            <Button
              className={cn("font-bold uppercase tracking-wider text-black", actionType === 'approve' ? "bg-green-600 hover:bg-green-500" : "bg-red-600 hover:bg-red-500 text-white")}
              onClick={handleAdminAction} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin"/> : "VÉGREHAJTÁS"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ARCHIVE CONFIRM */}
      <AlertDialog open={isCleanupAlertOpen} onOpenChange={setIsCleanupAlertOpen}>
        <AlertDialogContent className="bg-slate-900 border-slate-800 text-white">
          <AlertDialogHeader><AlertDialogTitle>Archiválás</AlertDialogTitle><AlertDialogDescription>Törlöd a 40 napnál
            régebbi lezárt tételeket?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 hover:bg-slate-800 text-white">Mégse</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 border-none" onClick={handleCleanup}>{isCleaning ?
              <Loader2 className="animate-spin w-4 h-4"/> : "Törlés"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}