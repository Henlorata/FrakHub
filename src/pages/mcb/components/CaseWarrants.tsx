import * as React from "react";
import {useAuth} from "@/context/AuthContext";
import {Card, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {ScrollArea} from "@/components/ui/scroll-area";
import {Badge} from "@/components/ui/badge";
import {FileWarning, Plus, Check, X, MapPin, User, Gavel, Clock} from "lucide-react";
import {toast} from "sonner";
import {canApproveWarrant, cn} from "@/lib/utils";
import type {CaseWarrant} from "@/types/supabase";
import {WarrantDialog} from "./WarrantDialog";
import {formatDistanceToNow} from "date-fns";
import {hu} from "date-fns/locale";

export function CaseWarrants({caseId, suspects}: { caseId: string, suspects: any[] }) {
  const {supabase, profile, user} = useAuth();
  const [warrants, setWarrants] = React.useState<CaseWarrant[]>([]);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  const fetchWarrants = async () => {
    const {data} = await supabase.from('case_warrants')
      .select(`*, requester:requested_by(full_name, badge_number), approver:approved_by(full_name, badge_number), suspect:suspect_id(full_name), property:property_id(address)`)
      .eq('case_id', caseId).order('created_at', {ascending: false});
    if (data) setWarrants(data as any);
  };

  React.useEffect(() => {
    fetchWarrants();
    const channel = supabase.channel(`case_warrants_${caseId}`).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'case_warrants',
      filter: `case_id=eq.${caseId}`
    }, () => fetchWarrants()).subscribe();
    return () => {
      supabase.removeChannel(channel);
    }
  }, [caseId, supabase]);

  const handleWarrantAction = async (id: string, status: 'approved' | 'rejected' | 'executed', requesterId?: string, warrantType?: string) => {
    const {error} = await supabase.from('case_warrants').update({
      status,
      approved_by: user?.id,
      updated_at: new Date().toISOString()
    }).eq('id', id);
    if (error) {
      toast.error("Hiba történt.");
      return;
    }
    toast.success("Státusz frissítve.");
    fetchWarrants();
  };

  const getTargetName = (w: CaseWarrant) => w.suspect ? w.suspect.full_name : w.property ? w.property.address : w.target_name || "Ismeretlen";
  const canManage = canApproveWarrant(profile);

  return (
    <Card
      className="bg-slate-950/80 border border-slate-800 backdrop-blur-md flex flex-col h-[400px] shrink-0 shadow-lg group">
      <WarrantDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} caseId={caseId} suspects={suspects}
                     onSuccess={fetchWarrants}/>

      <CardHeader
        className="pb-2 py-3 border-b border-slate-800/50 bg-slate-900/30 flex flex-row items-center justify-between space-y-0 shrink-0">
        <CardTitle className="text-[10px] uppercase tracking-[0.2em] text-red-500 font-bold flex items-center gap-2">
          <FileWarning className="w-3.5 h-3.5"/> Aktív Parancsok
        </CardTitle>
        <Button size="icon" variant="ghost" className="h-5 w-5 text-slate-400 hover:text-white -mr-2"
                onClick={() => setIsDialogOpen(true)}><Plus className="w-3.5 h-3.5"/></Button>
      </CardHeader>

      <div className="flex-1 min-h-0 relative">
        <ScrollArea className="h-full">
          <div className="p-3 space-y-3">
            {warrants.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-slate-600 opacity-50">
                <FileWarning className="w-8 h-8 mb-2"/>
                <p className="text-[10px] uppercase font-mono">Nincs adat</p>
              </div>
            ) : warrants.map(w => (
              <div key={w.id}
                   className="relative bg-[#0b1221] border border-slate-800 rounded overflow-hidden group hover:border-slate-600 transition-all">
                {/* Left Colored Stripe */}
                <div className={cn("absolute left-0 top-0 bottom-0 w-1",
                  w.type === 'arrest' ? 'bg-red-600' : 'bg-orange-500',
                  w.status === 'executed' ? 'bg-blue-500' : w.status === 'rejected' ? 'bg-slate-700' : '')}/>

                <div className="p-3 pl-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                         <span
                           className={cn("text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border",
                             w.type === 'arrest' ? "text-red-400 border-red-500/30 bg-red-500/10" : "text-orange-400 border-orange-500/30 bg-orange-500/10")}>
                            {w.type === 'arrest' ? 'ELFOGATÓ' : 'HÁZKUTATÁSI'}
                         </span>
                      {w.status === 'pending' &&
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></span>}
                    </div>
                    <span className="text-[9px] font-mono text-slate-500 flex items-center gap-1">
                         <Clock className="w-2.5 h-2.5"/> {formatDistanceToNow(new Date(w.created_at), {
                      locale: hu,
                      addSuffix: true
                    })}
                      </span>
                  </div>

                  <div className="flex items-center gap-2 mb-1">
                    {w.type === 'arrest' ? <User className="w-3.5 h-3.5 text-slate-400"/> :
                      <MapPin className="w-3.5 h-3.5 text-slate-400"/>}
                    <span className="text-sm font-bold text-white truncate">{getTargetName(w)}</span>
                  </div>

                  <p className="text-[10px] text-slate-400 italic mb-3 line-clamp-1 opacity-80">{w.reason}</p>

                  {/* Footer Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/50">
                    <div className="text-[9px] text-slate-600 font-mono uppercase">
                      REQ: {w.requester?.badge_number}
                    </div>

                    <div className="flex gap-1">
                      {w.status === 'pending' && canManage ? (
                        <>
                          <Button size="icon"
                                  className="h-6 w-6 bg-green-900/20 text-green-500 hover:bg-green-600 hover:text-white border border-green-900/50"
                                  onClick={() => handleWarrantAction(w.id, 'approved', w.requested_by, w.type)}><Check
                            className="w-3 h-3"/></Button>
                          <Button size="icon"
                                  className="h-6 w-6 bg-red-900/20 text-red-500 hover:bg-red-600 hover:text-white border border-red-900/50"
                                  onClick={() => handleWarrantAction(w.id, 'rejected', w.requested_by, w.type)}><X
                            className="w-3 h-3"/></Button>
                        </>
                      ) : w.status === 'approved' ? (
                        <Button size="sm"
                                className="h-6 text-[9px] bg-blue-600/10 text-blue-400 border border-blue-500/30 hover:bg-blue-600 hover:text-white px-2"
                                onClick={() => handleWarrantAction(w.id, 'executed')}>
                          <Gavel className="w-3 h-3 mr-1"/> VÉGREHAJTVA
                        </Button>
                      ) : (
                        <Badge variant="outline"
                               className="text-[9px] border-slate-700 text-slate-500">{w.status.toUpperCase()}</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </Card>
  );
}