import * as React from "react";
import {useAuth} from "@/context/AuthContext";
import {Button} from "@/components/ui/button";
import {Card, CardContent} from "@/components/ui/card";
import {Badge} from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {ScrollArea} from "@/components/ui/scroll-area";
import {toast} from "sonner";
import {
  Plus, CheckSquare, XSquare, Search, Loader2, Car, Truck, Ship, Plane,
  AlertTriangle, ShieldCheck, Clock, Box, Container, Wrench, ChevronRight, Hash
} from "lucide-react";
import type {VehicleRequest} from "@/types/supabase";
import {NewVehicleRequestDialog} from "./components/NewVehicleRequestDialog";
import {isSupervisory, isHighCommand, cn} from "@/lib/utils";

// --- BLUEPRINT BACKGROUND EFFECT ---
const BlueprintGrid = () => (
  <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
       style={{
         backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
         backgroundSize: '20px 20px'
       }}
  />
);

// Jármű ikon választó
const getVehicleIcon = (type: string) => {
  const t = type.toLowerCase();
  if (t.includes('maverick') || t.includes('helikopter')) return <Plane className="w-5 h-5"/>;
  if (t.includes('predator') || t.includes('hajó')) return <Ship className="w-5 h-5"/>;
  if (t.includes('vontató') || t.includes('arocs') || t.includes('teher')) return <Truck className="w-5 h-5"/>;
  return <Car className="w-5 h-5"/>;
};

export function LogisticsPage() {
  const {supabase, profile, user} = useAuth();
  const [requests, setRequests] = React.useState<VehicleRequest[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isNewOpen, setIsNewOpen] = React.useState(false);
  const [filter, setFilter] = React.useState("all");

  // Admin műveletekhez
  const [selectedRequest, setSelectedRequest] = React.useState<VehicleRequest | null>(null);
  const [actionType, setActionType] = React.useState<'approve' | 'reject' | null>(null);
  const [adminPlate, setAdminPlate] = React.useState("");
  const [adminComment, setAdminComment] = React.useState("");
  const [isProcessing, setIsProcessing] = React.useState(false);

  // Adatok betöltése
  const fetchRequests = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const {data, error} = await supabase.from('vehicle_requests')
        .select(`*, profiles!vehicle_requests_user_id_fkey (full_name, badge_number, faction_rank)`)
        .order('created_at', {ascending: false});
      if (error) throw error;
      setRequests((data as unknown as VehicleRequest[]) || []);
    } catch (err) {
      toast.error("Hiba az adatok betöltésekor");
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  React.useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  // Statisztikák
  const stats = React.useMemo(() => ({
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  }), [requests]);

  // Szűrés
  const filteredRequests = React.useMemo(() => {
    if (filter === 'all') return requests;
    return requests.filter(r => r.status === filter);
  }, [requests, filter]);

  // Jogosultság ellenőrzés (Admin/Supervisor/HighCommand)
  const canManageRequests = profile?.system_role === 'admin' || isSupervisory(profile) || isHighCommand(profile);

  // Admin művelet végrehajtása
  const handleAdminAction = async () => {
    if (!selectedRequest || !actionType || !user) return;
    setIsProcessing(true);
    try {
      const updates: any = {
        status: actionType === 'approve' ? 'approved' : 'rejected',
        processed_by: user.id,
        updated_at: new Date().toISOString(),
      };

      // Validációk
      if (actionType === 'approve') {
        if (!adminPlate) throw new Error("Rendszám megadása kötelező!");
        updates.vehicle_plate = adminPlate;
      } else {
        if (!adminComment) throw new Error("Indoklás megadása kötelező!");
        updates.admin_comment = adminComment;
      }

      const {error} = await (supabase.from('vehicle_requests') as any).update(updates).eq('id', selectedRequest.id);
      if (error) throw error;

      // Értesítés küldése
      await supabase.from('notifications').insert({
        user_id: selectedRequest.user_id,
        title: 'Járműigénylés Státusz',
        message: `A(z) ${selectedRequest.vehicle_type} igénylésedet ${actionType === 'approve' ? 'ELFOGADTÁK' : 'ELUTASÍTOTTÁK'}.`,
        type: actionType === 'approve' ? 'success' : 'alert',
        link: '/logistics'
      });

      toast.success("Művelet sikeres.");
      void fetchRequests();
      closeAdminDialog();
    } catch (err) {
      toast.error("Hiba", {description: (err as Error).message});
    } finally {
      setIsProcessing(false);
    }
  };

  const closeAdminDialog = () => {
    setSelectedRequest(null);
    setActionType(null);
    setAdminPlate("");
    setAdminComment("");
  };

  if (isLoading && requests.length === 0) return <div className="flex h-screen items-center justify-center"><Loader2
    className="w-12 h-12 text-orange-500 animate-spin"/></div>;

  return (
    <div
      className="space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-10 h-[calc(100vh-6rem)] flex flex-col">

      {/* --- INDUSTRIAL HEADER --- */}
      <div
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0 bg-[#0a0f1c] border-b-2 border-orange-500/20 p-6 relative overflow-hidden shadow-lg">
        {/* Dekoratív háttér elem */}
        <div
          className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
        <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-orange-500/10 to-transparent"></div>

        <div className="relative z-10 flex items-center gap-4">
          <div
            className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-md text-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.1)]">
            <Container className="w-8 h-8"/>
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight uppercase font-mono">LOGISZTIKA</h1>
            <p className="text-xs text-orange-500/60 font-bold uppercase tracking-[0.2em]">Fleet Operations & Supply</p>
          </div>
        </div>

        <div className="relative z-10 flex gap-4 items-center">
          {/* Mini Dashboard */}
          <div className="hidden lg:flex gap-4 border-r border-white/10 pr-6 mr-2">
            <div className="text-right">
              <div className="text-2xl font-mono font-bold text-white leading-none">{stats.pending}</div>
              <div className="text-[9px] uppercase text-slate-500 font-bold tracking-wider">FÜGGŐBEN</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-mono font-bold text-white leading-none">{stats.approved}</div>
              <div className="text-[9px] uppercase text-slate-500 font-bold tracking-wider">AKTÍV ÁLLOMÁNY</div>
            </div>
          </div>

          <Button onClick={() => setIsNewOpen(true)}
                  className="bg-orange-600 hover:bg-orange-500 text-black font-bold uppercase tracking-wider h-12 px-6 shadow-[0_0_20px_rgba(249,115,22,0.3)] border border-orange-400">
            <Plus className="w-5 h-5 mr-2"/> ÚJ IGÉNYLÉS
          </Button>
        </div>
      </div>

      {/* --- FILTER TABS --- */}
      <div
        className="flex gap-2 p-1 bg-slate-950/50 border border-slate-800 rounded-md w-fit shrink-0 backdrop-blur-sm">
        {['all', 'pending', 'approved', 'rejected'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
                  className={cn("px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wider transition-all border",
                    filter === f ? "bg-orange-500/10 text-orange-500 border-orange-500/30" : "text-slate-500 border-transparent hover:text-slate-300 hover:bg-slate-900")}>
            {f === 'all' ? 'ÖSSZES' : f === 'pending' ? 'FÜGGŐ' : f === 'approved' ? 'ELFOGADVA' : 'ELUTASÍTVA'}
          </button>
        ))}
      </div>

      {/* --- GRID (REQUESTS) --- */}
      <div
        className="flex-1 min-h-0 bg-[#050a14] border border-slate-800 relative rounded-md overflow-hidden flex flex-col shadow-2xl">
        <BlueprintGrid/>

        <ScrollArea className="flex-1">
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredRequests.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-20 opacity-30">
                <Box className="w-20 h-20 text-slate-500 mb-4"/>
                <p className="font-mono text-sm uppercase tracking-widest text-slate-500">NINCS MEGJELENÍTHETŐ ADAT</p>
              </div>
            ) : (
              filteredRequests.map(req => (
                <div key={req.id}
                     className="relative bg-[#0b1221]/90 border border-slate-700/50 hover:border-orange-500/50 transition-all group overflow-hidden rounded-sm shadow-md">

                  {/* Status Strip & ID */}
                  <div className={cn("absolute top-0 left-0 w-1 h-full",
                    req.status === 'approved' ? 'bg-green-500' : req.status === 'rejected' ? 'bg-red-500' : 'bg-yellow-500')}
                  />

                  {/* Header Section */}
                  <div
                    className="p-4 border-b border-slate-800/50 flex justify-between items-start pl-6 bg-slate-900/30">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className="text-[9px] font-mono text-slate-500 bg-slate-950 px-1.5 py-0.5 border border-slate-800 rounded-sm">REQ-{req.id.slice(0, 4).toUpperCase()}</div>
                        <span
                          className="text-[9px] font-mono text-slate-500">{new Date(req.created_at).toLocaleDateString()}</span>
                      </div>
                      <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                        {getVehicleIcon(req.vehicle_type)} <span className="truncate max-w-[200px]"
                                                                 title={req.vehicle_type}>{req.vehicle_type}</span>
                      </h3>
                    </div>

                    <div className="text-right">
                      {req.status === 'approved' ? (
                        <div className="inline-block">
                          <div
                            className="text-[9px] text-green-500 font-bold uppercase tracking-wider mb-0.5">RENDSZÁM
                          </div>
                          <div
                            className="font-mono text-lg font-bold text-white bg-green-900/20 px-2 border border-green-900/50 rounded-sm">{req.vehicle_plate}</div>
                        </div>
                      ) : req.status === 'rejected' ? (
                        <Badge variant="destructive"
                               className="bg-red-950/50 border-red-900 text-red-500 uppercase rounded-sm font-mono">REJECTED</Badge>
                      ) : (
                        <Badge variant="secondary"
                               className="bg-yellow-900/20 border-yellow-900 text-yellow-500 uppercase rounded-sm animate-pulse font-mono">PENDING</Badge>
                      )}
                    </div>
                  </div>

                  {/* Details Section */}
                  <div className="p-4 pl-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-950/50 p-2 rounded-sm border border-slate-800/50">
                        <div className="text-[9px] uppercase text-slate-500 font-bold tracking-wider mb-1">IGÉNYLŐ</div>
                        <div className="font-bold text-sm text-white truncate">{req.profiles?.full_name}</div>
                        <div className="text-[10px] text-slate-400 truncate">{req.profiles?.faction_rank}</div>
                      </div>
                      <div className="bg-slate-950/50 p-2 rounded-sm border border-slate-800/50">
                        <div className="text-[9px] uppercase text-slate-500 font-bold tracking-wider mb-1">JELVÉNYSZÁM
                        </div>
                        <div className="font-mono text-lg text-orange-400 font-bold flex items-center gap-2">
                          <Hash className="w-3 h-3 text-orange-600"/> {req.profiles?.badge_number}
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-950/30 p-2.5 border border-slate-800/50 rounded-sm">
                      <div
                        className="text-[9px] uppercase text-slate-500 font-bold tracking-wider mb-1 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3"/> INDOKLÁS
                      </div>
                      <p
                        className="text-xs text-slate-300 font-mono leading-relaxed line-clamp-3 italic">"{req.reason}"</p>
                    </div>

                    {req.admin_comment && (
                      <div className="bg-red-950/10 p-2 border border-red-900/30 rounded-sm">
                        <div
                          className="text-[9px] uppercase text-red-500 font-bold tracking-wider mb-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3"/> ELUTASÍTVA
                        </div>
                        <p className="text-xs text-red-400 font-mono leading-relaxed">{req.admin_comment}</p>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons (Admin Only) */}
                  {canManageRequests && req.status === 'pending' && (
                    <div className="grid grid-cols-2 border-t border-slate-800">
                      <button onClick={() => {
                        setSelectedRequest(req);
                        setActionType('approve');
                      }}
                              className="py-2.5 bg-slate-900 hover:bg-green-900/20 text-slate-400 hover:text-green-400 border-r border-slate-800 text-[10px] font-black uppercase transition-colors flex items-center justify-center gap-2 tracking-wider">
                        <CheckSquare className="w-3.5 h-3.5"/> JÓVÁHAGYÁS
                      </button>
                      <button onClick={() => {
                        setSelectedRequest(req);
                        setActionType('reject');
                      }}
                              className="py-2.5 bg-slate-900 hover:bg-red-900/20 text-slate-400 hover:text-red-400 text-[10px] font-black uppercase transition-colors flex items-center justify-center gap-2 tracking-wider">
                        <XSquare className="w-3.5 h-3.5"/> ELUTASÍTÁS
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <NewVehicleRequestDialog open={isNewOpen} onOpenChange={setIsNewOpen} onSuccess={fetchRequests}/>

      {/* ADMIN DIALOG */}
      <Dialog open={!!selectedRequest} onOpenChange={(o) => !o && closeAdminDialog()}>
        <DialogContent
          className="bg-[#0b1221] border border-slate-700 text-white sm:max-w-md p-0 overflow-hidden shadow-2xl">
          <div
            className={`p-4 border-b border-white/5 flex items-center gap-3 ${actionType === 'approve' ? 'bg-green-900/20' : 'bg-red-900/20'}`}>
            <div
              className={`p-2 rounded border ${actionType === 'approve' ? 'border-green-500 text-green-500' : 'border-red-500 text-red-500'}`}>
              <Wrench className="w-5 h-5"/>
            </div>
            <div>
              <DialogTitle className="text-lg font-black uppercase font-mono tracking-tight">
                {actionType === 'approve' ? 'IGÉNYLÉS JÓVÁHAGYÁSA' : 'IGÉNYLÉS ELUTASÍTÁSA'}
              </DialogTitle>
              <DialogDescription className="text-xs font-mono text-slate-400 uppercase">
                UNIT: {selectedRequest?.profiles?.badge_number} // {selectedRequest?.vehicle_type}
              </DialogDescription>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {actionType === 'approve' ? (
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Kiosztott
                  Rendszám</Label>
                <Input placeholder="PL. SFSD-01"
                       className="bg-slate-950 border-slate-700 font-mono uppercase text-xl tracking-[0.2em] text-center h-12 text-green-400 focus-visible:ring-green-500/50 placeholder:text-slate-700"
                       value={adminPlate} onChange={(e) => setAdminPlate(e.target.value)} autoFocus/>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Elutasítás
                  Indoka</Label>
                <Textarea placeholder="HIVATALOS INDOKLÁS..."
                          className="bg-slate-950 border-slate-700 resize-none h-24 font-mono text-sm focus-visible:ring-red-500/50 placeholder:text-slate-700 break-all"
                          value={adminComment} onChange={(e) => setAdminComment(e.target.value)} autoFocus/>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 bg-slate-950/50 border-t border-white/5">
            <Button variant="ghost" onClick={closeAdminDialog}
                    className="hover:bg-slate-800 text-slate-400 hover:text-white">MÉGSE</Button>
            <Button
              className={cn("font-bold uppercase tracking-wider text-black", actionType === 'approve' ? "bg-green-600 hover:bg-green-500" : "bg-red-600 hover:bg-red-500")}
              onClick={handleAdminAction} disabled={isProcessing}>
              {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>} VÉGREHAJTÁS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}