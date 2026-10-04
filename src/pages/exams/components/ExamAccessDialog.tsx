import * as React from "react";
import {
  Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {useAuth} from "@/context/AuthContext";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Search, UserCheck, UserX, Shield, Lock, AlertCircle} from "lucide-react";
import {toast} from "sonner";
import {ScrollArea} from "@/components/ui/scroll-area";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {Badge} from "@/components/ui/badge";
import type {Exam, ExamOverride} from "@/types/exams";
import {cn} from "@/lib/utils";
import {getProfileDirectory, type DirectoryProfile} from "@/lib/profile-directory";
import {getOptimizedAvatarUrl} from "@/lib/cloudinary";

interface ExamAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam: Exam | null;
  onUpdate?: () => void;
}

export function ExamAccessDialog({open, onOpenChange, exam, onUpdate}: ExamAccessDialogProps) {
  const {supabase, user} = useAuth();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [allUsers, setAllUsers] = React.useState<DirectoryProfile[]>([]);
  const [overrides, setOverrides] = React.useState<ExamOverride[]>([]);
  const [loading, setLoading] = React.useState(false);
  const examId = exam?.id;

  const fetchOverrides = React.useCallback(async () => {
    if (!examId) return;
    const {data, error} = await supabase.from('exam_overrides')
      .select('*, profile:profiles(full_name, badge_number, avatar_url, faction_rank)')
      .eq('exam_id', examId);
    if (error) throw error;
    setOverrides((data ?? []) as ExamOverride[]);
  }, [examId, supabase]);

  const fetchData = React.useCallback(async () => {
    if (!examId) return;
    setLoading(true);
    try {
      // The member list comes from the shared cache instead of a full profiles query.
      const [directory] = await Promise.all([getProfileDirectory(), fetchOverrides()]);
      setAllUsers(directory.filter(member => member.system_role !== 'pending'));
    } catch (e) {
      console.error(e);
      toast.error("Hiba az adatok betöltésekor.");
    } finally {
      setLoading(false);
    }
  }, [examId, fetchOverrides]);

  React.useEffect(() => {
    if (open) {
      fetchData();
      setSearchTerm("");
    }
  }, [open, fetchData]);

  const filteredUsers = React.useMemo(() => {
    const existingIds = overrides.map(o => o.user_id);
    return allUsers.filter(u =>
      !existingIds.includes(u.id) &&
      (u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || u.badge_number.includes(searchTerm))
    );
  }, [allUsers, overrides, searchTerm]);

  const addOverride = async (targetUserId: string, type: 'allow' | 'deny') => {
    if (!exam) return;
    try {
      const {error} = await supabase.from('exam_overrides').insert({
        exam_id: exam.id,
        user_id: targetUserId,
        access_type: type,
        granted_by: user?.id
      });
      if (error) throw error;
      toast.success(`Kivétel rögzítve: ${type === 'allow' ? 'ENGEDÉLY' : 'TILTÁS'}`);
      void fetchOverrides();
      if (onUpdate) onUpdate();
    } catch {
      toast.error("Hiba a mentéskor.");
    }
  };

  const removeOverride = async (id: string) => {
    const {error} = await supabase.from('exam_overrides').delete().eq('id', id);
    if (error) {
      toast.error("Hiba a törléskor.");
      return;
    }
    toast.success("Kivétel törölve.");
    setOverrides(prev => prev.filter(ov => ov.id !== id));
    if (onUpdate) onUpdate();
  };

  if (!exam) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-slate-950 border-slate-800 text-white sm:max-w-xl h-[80vh] max-h-[800px] flex flex-col p-0 shadow-2xl overflow-hidden">

        {/* HEADER */}
        <div className="p-6 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-6 h-6 text-sky-500"/>
            <DialogTitle>Hozzáférési Jogosultságok</DialogTitle>
          </div>
          <DialogDescription className="text-slate-400">
            {exam.title}
          </DialogDescription>

          <div className={cn("mt-4 p-3 rounded text-xs border flex items-center gap-3",
            exam.is_invitation_only
              ? "bg-purple-500/10 border-purple-500/30 text-purple-300"
              : "bg-yellow-500/10 border-yellow-500/30 text-yellow-500"
          )}>
            {exam.is_invitation_only ? <Lock className="w-4 h-4"/> : <AlertCircle className="w-4 h-4"/>}
            <div>
              {exam.is_invitation_only
                ? "Ez a vizsga MEGHÍVÁSOS. Csak a listán szereplő (Engedélyezett) személyek tölthetik ki."
                : "Ez a vizsga NYILVÁNOS (Ranghoz kötött). Itt egyéni tiltásokat vagy kivételeket adhatsz meg."
              }
            </div>
          </div>
        </div>

        <Tabs defaultValue="add" className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsList className="w-full justify-start rounded-none border-b border-slate-800 bg-slate-950 p-0 h-12">
            <TabsTrigger value="add"
                         className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-sky-500 data-[state=active]:bg-slate-900">Új
              Személy</TabsTrigger>
            <TabsTrigger value="active"
                         className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-sky-500 data-[state=active]:bg-slate-900">
              Aktív Szabályok <Badge className="ml-2 bg-slate-800 hover:bg-slate-800">{overrides.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="add" className="flex-1 flex flex-col min-h-0 p-0 m-0">
            <div className="p-4 border-b border-slate-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500"/>
                <Input placeholder="Név vagy jelvényszám keresése..." value={searchTerm}
                       onChange={e => setSearchTerm(e.target.value)} className="pl-10 bg-slate-900 border-slate-700"/>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {loading ?
                  <p className="text-center py-10 text-xs text-slate-500">Betöltés...</p> : filteredUsers.length === 0 ?
                    <p className="text-center py-10 text-xs text-slate-500">Nincs találat</p> : filteredUsers.map(u => (
                      <div key={u.id}
                           className="flex items-center justify-between p-3 rounded hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-all group">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 border border-slate-700"><AvatarImage
                            src={getOptimizedAvatarUrl(u.avatar_url, 64) || undefined}/><AvatarFallback
                            className="bg-slate-900 text-[10px] font-bold">{u.full_name.charAt(0)}</AvatarFallback></Avatar>
                          <div>
                            <p className="text-sm font-medium text-slate-200">{u.full_name}</p>
                            <p className="text-[10px] text-slate-500">{u.faction_rank} [#{u.badge_number}]</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline"
                                  className="h-7 text-green-500 border-green-900/30 hover:bg-green-900/20"
                                  onClick={() => addOverride(u.id, 'allow')}><UserCheck className="w-3 h-3 mr-1"/> Enged</Button>
                          <Button size="sm" variant="outline"
                                  className="h-7 text-red-500 border-red-900/30 hover:bg-red-900/20"
                                  onClick={() => addOverride(u.id, 'deny')}><UserX
                            className="w-3 h-3 mr-1"/> Tilt</Button>
                        </div>
                      </div>
                    ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="active" className="flex-1 flex flex-col min-h-0 p-0 m-0">
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-2">
                {overrides.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-slate-600 opacity-50"><Shield
                    className="w-10 h-10 mb-2"/><p className="text-[10px] uppercase">Nincsenek kivételek</p></div>
                ) : overrides.map(ov => (
                  <div key={ov.id}
                       className="flex items-center justify-between p-3 bg-slate-900/50 rounded border border-slate-800">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 border border-slate-700"><AvatarImage
                        src={getOptimizedAvatarUrl(ov.profile?.avatar_url, 64) || undefined}/><AvatarFallback
                        className="bg-slate-950 text-[10px]">{ov.profile?.full_name?.charAt(0)}</AvatarFallback></Avatar>
                      <div>
                        <p className="text-sm font-bold text-white">{ov.profile?.full_name}</p>
                        <Badge variant="outline"
                               className={cn("text-[9px]", ov.access_type === 'allow' ? "text-green-500 border-green-900/50" : "text-red-500 border-red-900/50")}>
                          {ov.access_type === 'allow' ? 'ENGEDÉLYEZVE' : 'LETILTVA'}
                        </Badge>
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-red-500"
                            onClick={() => removeOverride(ov.id)}><UserX className="w-4 h-4"/></Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter className="p-4 border-t border-slate-800">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Bezárás</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}