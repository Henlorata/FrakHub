import * as React from "react";
import {useAuth} from "@/context/AuthContext";
import {Card, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {ScrollArea} from "@/components/ui/scroll-area";
import {Badge} from "@/components/ui/badge";
import {FileWarning, Plus, Check, X, MapPin, User, Gavel} from "lucide-react";
import {toast} from "sonner";
import {canApproveWarrant} from "@/lib/utils";
import type {CaseWarrant} from "@/types/supabase";
import {WarrantDialog} from "./WarrantDialog";
import {formatDistanceToNow} from "date-fns";
import {hu} from "date-fns/locale";

export function CaseWarrants({caseId, suspects}: { caseId: string, suspects: any[] }) {
  const {supabase, profile, user} = useAuth();
  const [warrants, setWarrants] = React.useState<CaseWarrant[]>([]);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  const fetchWarrants = async () => {
    const {data} = await supabase
      .from('case_warrants')
      .select(`
            *,
            requester:requested_by(full_name, badge_number),
            approver:approved_by(full_name, badge_number),
            suspect:suspect_id(full_name),
            property:property_id(address)
        `)
      .eq('case_id', caseId)
      .order('created_at', {ascending: false});
    if (data) setWarrants(data as any);
  };

  React.useEffect(() => {
    fetchWarrants();

    const channel = supabase
      .channel(`case_warrants_${caseId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'case_warrants',
        filter: `case_id=eq.${caseId}`
      }, () => {
        fetchWarrants();
      })
      .subscribe();
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

    if (requesterId && requesterId !== user?.id && status !== 'executed') {
      await supabase.from('notifications').insert({
        user_id: requesterId,
        title: status === 'approved' ? 'Parancs Jóváhagyva' : 'Parancs Elutasítva',
        message: `A(z) ${warrantType === 'arrest' ? 'Elfogató' : 'Házkutatási'} parancs kérelmed ${status === 'approved' ? 'jóváhagyták' : 'elutasították'}.`,
        type: status === 'approved' ? 'success' : 'alert',
        link: `/mcb/case/${caseId}`
      });
    }

    toast.success(status === 'approved' ? "Parancs jóváhagyva." : status === 'executed' ? "Parancs végrehajtva." : "Parancs elutasítva.");
    fetchWarrants();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge
          className="bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20">JÓVÁHAGYVA</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20">ELUTASÍTVA</Badge>;
      case 'executed':
        return <Badge
          className="bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20">VÉGREHAJTVA</Badge>;
      case 'expired':
        return <Badge className="bg-slate-800 text-slate-500 border-slate-700 hover:bg-slate-800">LEJÁRT</Badge>;
      default:
        return <Badge
          className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 hover:bg-yellow-500/20 animate-pulse">FÜGGŐBEN</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    if (type === 'arrest') return <Badge variant="outline" className="border-red-500/30 text-red-400">ELFOGATÓ</Badge>;
    return <Badge variant="outline" className="border-orange-500/30 text-orange-400">HÁZKUTATÁSI</Badge>;
  }

  const getTargetName = (w: CaseWarrant) => {
    if (w.suspect) return w.suspect.full_name;
    if (w.property) return w.property.address;
    return w.target_name || "Ismeretlen";
  }

  const canManage = canApproveWarrant(profile);

  return (
    <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm flex flex-col h-[400px] shrink-0">
      <WarrantDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} caseId={caseId} suspects={suspects}
                     onSuccess={fetchWarrants}/>

      <CardHeader
        className="pb-2 py-3 border-b border-slate-800/50 flex flex-row items-center justify-between space-y-0 shrink-0">
        <CardTitle className="text-xs uppercase tracking-widest text-slate-500 font-bold flex items-center gap-2">
          <FileWarning className="w-4 h-4 text-red-500"/> Parancsok ({warrants.length})
        </CardTitle>
        <Button size="icon" variant="ghost" className="h-6 w-6 text-slate-400 hover:text-white -mr-2"
                onClick={() => setIsDialogOpen(true)}>
          <Plus className="w-4 h-4"/>
        </Button>
      </CardHeader>

      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-3 space-y-3">
            {warrants.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-slate-500">
                <FileWarning className="w-8 h-8 mb-2 opacity-20"/>
                <p className="text-xs">Nincs aktív parancs.</p>
              </div>
            ) : warrants.map(w => (
              <div key={w.id}
                   className="bg-slate-950/40 border border-slate-800/60 rounded-lg p-3 flex flex-col gap-2 group hover:border-slate-700 transition-all">
                {/* Header */}
                <div className="flex justify-between items-start">
                  <div className="flex gap-2 items-center">
                    {getTypeBadge(w.type)}
                    {getStatusBadge(w.status)}
                  </div>
                  <span className="text-[10px] text-slate-500">
                        {formatDistanceToNow(new Date(w.created_at), {locale: hu, addSuffix: true})}
                    </span>
                </div>

                {/* Content */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {w.type === 'arrest' ? <User className="w-4 h-4 text-slate-400"/> :
                      <MapPin className="w-4 h-4 text-slate-400"/>}
                    <span className="font-bold text-slate-200 text-sm">{getTargetName(w)}</span>
                  </div>
                  <p
                    className="text-xs text-slate-400 italic border-l-2 border-slate-800 pl-2 line-clamp-2">{w.reason}</p>
                </div>

                {/* Footer */}
                <div className="flex justify-between items-end mt-1">
                  <div className="text-[10px] text-slate-500">
                    <div className="flex items-center gap-1">Igényelte: <span
                      className="text-slate-400">{w.requester?.full_name}</span></div>
                    {w.approver && <div className="flex items-center gap-1">Jóváhagyta: <span
                      className="text-yellow-600">{w.approver.full_name}</span></div>}
                  </div>

                  {/* Actions */}
                  {w.status === 'pending' && canManage && (
                    <div className="flex gap-1">
                      <Button size="icon"
                              className="h-6 w-6 bg-green-600/20 text-green-500 hover:bg-green-600 hover:text-white border border-green-900/50"
                              title="Elfogad"
                              onClick={() => handleWarrantAction(w.id, 'approved', w.requested_by, w.type)}>
                        <Check className="w-3 h-3"/>
                      </Button>
                      <Button size="icon"
                              className="h-6 w-6 bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white border border-red-900/50"
                              title="Elutasít"
                              onClick={() => handleWarrantAction(w.id, 'rejected', w.requested_by, w.type)}>
                        <X className="w-3 h-3"/>
                      </Button>
                    </div>
                  )}
                  {w.status === 'approved' && (
                    <Button size="sm" variant="ghost"
                            className="h-6 px-2 text-[10px] bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-900/30"
                            onClick={() => handleWarrantAction(w.id, 'executed')}>
                      <Gavel className="w-3 h-3 mr-1"/> Végrehajtva
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </Card>
  );
}