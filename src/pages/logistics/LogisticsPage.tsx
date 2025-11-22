import * as React from "react";
import {useAuth} from "@/context/AuthContext";
import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import {Badge} from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {toast} from "sonner";
import {Plus, CheckCircle2, XCircle, Search, Loader2, Car, User} from "lucide-react";
import type {VehicleRequest} from "@/types/supabase";
import {NewVehicleRequestDialog} from "./components/NewVehicleRequestDialog";

export function LogisticsPage() {
  const {supabase, profile, user} = useAuth();
  const [requests, setRequests] = React.useState<VehicleRequest[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isNewOpen, setIsNewOpen] = React.useState(false);

  const [selectedRequest, setSelectedRequest] = React.useState<VehicleRequest | null>(null);
  const [actionType, setActionType] = React.useState<'approve' | 'reject' | null>(null);
  const [adminPlate, setAdminPlate] = React.useState("");
  const [adminComment, setAdminComment] = React.useState("");
  const [isProcessing, setIsProcessing] = React.useState(false);

  const fetchRequests = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const {data, error} = await supabase
        .from('vehicle_requests')
        .select(`*, profiles!vehicle_requests_user_id_fkey (full_name, badge_number, faction_rank)`)
        .order('created_at', {ascending: false});
      if (error) throw error;
      setRequests((data as unknown as VehicleRequest[]) || []);
    } catch (err) {
      toast.error("Hiba az igénylések betöltésekor");
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  React.useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  const isAdmin = profile?.system_role === 'admin' || profile?.system_role === 'supervisor';

  const handleAdminAction = async () => {
    if (!selectedRequest || !actionType || !user) return;
    setIsProcessing(true);
    try {
      const updates: any = {
        status: actionType === 'approve' ? 'approved' : 'rejected',
        processed_by: user.id,
        updated_at: new Date().toISOString(),
      };

      if (actionType === 'approve') {
        if (!adminPlate) throw new Error("Rendszám megadása kötelező!");
        updates.vehicle_plate = adminPlate;
      } else {
        if (!adminComment) throw new Error("Indoklás megadása kötelező!");
        updates.admin_comment = adminComment;
      }

      const {error} = await (supabase.from('vehicle_requests') as any).update(updates).eq('id', selectedRequest.id);
      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: selectedRequest.user_id,
        title: 'Járműigénylés Frissítés',
        message: `A(z) ${selectedRequest.vehicle_type} igénylésedet ${actionType === 'approve' ? 'elfogadták' : 'elutasították'}.`,
        type: actionType === 'approve' ? 'success' : 'alert',
        link: '/logistics'
      });

      toast.success("Igénylés frissítve!");
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
    className="w-10 h-10 text-yellow-500 animate-spin"/></div>;

  return (
    <div
      className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500 pb-10 h-[calc(100vh-6rem)] flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div><h1 className="text-3xl font-bold text-white tracking-tight">Logisztika</h1><p
          className="text-slate-400">Szolgálati gépjárművek és flotta menedzsment.</p></div>
        <Button onClick={() => setIsNewOpen(true)}
                className="bg-yellow-600 hover:bg-yellow-700 text-black shadow-lg shadow-yellow-900/20"><Plus
          className="w-4 h-4 mr-2"/> Új Igénylés</Button>
      </div>

      {requests.length === 0 ? (
        <div
          className="text-center py-20 text-slate-500 bg-slate-900/30 rounded-xl border border-slate-800 border-dashed">
          <Search className="w-12 h-12 mb-2 opacity-20 mx-auto"/><p>Jelenleg nincs megjeleníthető igénylés.</p>
        </div>
      ) : (
        // SCROLL AREA A GRIDNEK
        <ScrollArea className="flex-1 -mr-4 pr-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-10">
            {requests.map((req) => (
              <Card key={req.id}
                    className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-all flex flex-col">

                {/* KÁRTYA FEJLÉC */}
                <div
                  className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/30 rounded-t-xl">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${req.status === 'approved' ? 'bg-green-500/10 text-green-500' : req.status === 'rejected' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                      <Car className="w-5 h-5"/>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{req.vehicle_type}</div>
                      <div
                        className="text-xs text-slate-500 font-mono">{new Date(req.created_at).toLocaleDateString('hu-HU')}</div>
                    </div>
                  </div>
                  {req.status === 'approved' ? (
                    <Badge
                      className="bg-green-900/30 text-green-400 border-green-900/50 font-mono">{req.vehicle_plate}</Badge>
                  ) : req.status === 'rejected' ? (
                    <Badge variant="destructive"
                           className="bg-red-900/30 text-red-400 border-red-900/50">ELUTASÍTVA</Badge>
                  ) : (
                    <Badge variant="secondary"
                           className="bg-yellow-900/30 text-yellow-500 border-yellow-900/50 animate-pulse">FÜGGŐBEN</Badge>
                  )}
                </div>

                {/* TARTALOM */}
                <div className="p-4 flex-1 space-y-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 border border-slate-700">
                      <User className="w-4 h-4"/>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{req.profiles?.full_name}</div>
                      <div
                        className="text-xs text-slate-500">{req.profiles?.faction_rank} [#{req.profiles?.badge_number}]
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Indoklás</p>
                    <p className="text-sm text-slate-300 italic">"{req.reason}"</p>
                  </div>

                  {req.admin_comment && (
                    <div className="text-xs text-red-400 mt-2">
                      <strong>Megjegyzés:</strong> {req.admin_comment}
                    </div>
                  )}
                </div>

                {/* ADMIN ACTIONS */}
                {isAdmin && req.status === 'pending' && (
                  <div className="p-3 border-t border-slate-800 grid grid-cols-2 gap-3 bg-slate-950/30 rounded-b-xl">
                    <Button size="sm" variant="outline"
                            className="border-green-900/50 text-green-500 hover:bg-green-900/20 hover:text-green-400"
                            onClick={() => {
                              setSelectedRequest(req);
                              setActionType('approve');
                            }}>
                      <CheckCircle2 className="w-4 h-4 mr-2"/> Elfogadás
                    </Button>
                    <Button size="sm" variant="outline"
                            className="border-red-900/50 text-red-500 hover:bg-red-900/20 hover:text-red-400"
                            onClick={() => {
                              setSelectedRequest(req);
                              setActionType('reject');
                            }}>
                      <XCircle className="w-4 h-4 mr-2"/> Elutasítás
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      <NewVehicleRequestDialog open={isNewOpen} onOpenChange={setIsNewOpen} onSuccess={fetchRequests}/>

      <Dialog open={!!selectedRequest} onOpenChange={(o) => !o && closeAdminDialog()}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader><DialogTitle>Igénylés {actionType === 'approve' ? 'Elfogadása' : 'Elutasítása'}</DialogTitle><DialogDescription>Igénylő: {selectedRequest?.profiles?.full_name}</DialogDescription></DialogHeader>
          <div className="py-4 space-y-4">
            {actionType === 'approve' ? (
              <div className="space-y-2"><Label>Kiosztott Rendszám</Label><Input placeholder="Pl. SFSD-01"
                                                                                 className="bg-slate-950 border-slate-700 font-mono uppercase"
                                                                                 value={adminPlate}
                                                                                 onChange={(e) => setAdminPlate(e.target.value)}
                                                                                 autoFocus/><p
                className="text-xs text-slate-500">Add meg a jármű rendszámát.</p></div>
            ) : (
              <div className="space-y-2"><Label>Elutasítás Indoka</Label><Textarea placeholder="Indoklás..."
                                                                                   className="bg-slate-950 border-slate-700"
                                                                                   value={adminComment}
                                                                                   onChange={(e) => setAdminComment(e.target.value)}
                                                                                   autoFocus/></div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeAdminDialog}>Mégse</Button>
            <Button
              className={actionType === 'approve' ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}
              onClick={handleAdminAction} disabled={isProcessing}>{isProcessing && <Loader2
              className="w-4 h-4 mr-2 animate-spin"/>}{actionType === 'approve' ? 'Elfogadás' : 'Elutasítás'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}