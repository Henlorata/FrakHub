import * as React from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {useAuth} from "@/context/AuthContext";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Search, UserCheck, UserX, Shield, Lock} from "lucide-react";
import {toast} from "sonner";
import {ScrollArea} from "@/components/ui/scroll-area";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {Badge} from "@/components/ui/badge";
import type {Profile} from "@/types/supabase";
import type {Exam} from "@/types/exams";
import {cn} from "@/lib/utils";

interface ExamAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam: Exam;
  onUpdate?: () => void;
}

export function ExamAccessDialog({open, onOpenChange, exam, onUpdate}: ExamAccessDialogProps) {
  const {supabase, user} = useAuth();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [allUsers, setAllUsers] = React.useState<Profile[]>([]);
  const [overrides, setOverrides] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  // LOGIKA: Eredeti adatlekérás
  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      // 1. Meglévő kivételek
      const {data: ovData} = await supabase.from('exam_overrides')
        .select('*, profile:user_id(full_name, badge_number, avatar_url, faction_rank)')
        .eq('exam_id', exam.id);
      setOverrides(ovData || []);

      // 2. Összes felhasználó
      const {data: userData} = await supabase.from('profiles')
        .select('*')
        .neq('system_role', 'pending')
        .order('full_name');
      setAllUsers(userData || []);

    } catch (e) {
      toast.error("Hiba az adatok betöltésekor.");
    } finally {
      setLoading(false);
    }
  }, [exam.id, supabase]);

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
    try {
      const {error} = await supabase.from('exam_overrides').insert({
        exam_id: exam.id,
        user_id: targetUserId,
        access_type: type,
        created_by: user?.id
      });
      if (error) throw error;
      toast.success(`Kivétel rögzítve: ${type === 'allow' ? 'ENGEDÉLY' : 'TILTÁS'}`);
      fetchData();
      if (onUpdate) onUpdate();
    } catch (e) {
      toast.error("Hiba a mentéskor.");
    }
  };

  const removeOverride = async (id: string) => {
    try {
      await supabase.from('exam_overrides').delete().eq('id', id);
      toast.success("Kivétel törölve.");
      fetchData();
      if (onUpdate) onUpdate();
    } catch (e) {
      toast.error("Hiba a törléskor.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* JAVÍTÁS: h-[80vh] és flex flex-col a teljes magasság kitöltéséhez */}
      <DialogContent
        className="bg-[#0b1221] border border-blue-900/30 text-white sm:max-w-xl h-[80vh] max-h-[800px] flex flex-col p-0 shadow-2xl overflow-hidden">

        {/* Header (Fix magasság) */}
        <div className="bg-blue-950/20 border-b border-blue-900/30 p-5 flex items-center gap-4 shrink-0">
          <div
            className="w-10 h-10 bg-blue-600/10 border border-blue-500/30 rounded flex items-center justify-center text-blue-400">
            <Lock className="w-5 h-5"/>
          </div>
          <div>
            <DialogTitle className="text-lg font-black uppercase tracking-tight font-mono">HOZZÁFÉRÉS
              VEZÉRLÉS</DialogTitle>
            <DialogDescription className="text-[10px] text-blue-400/60 font-mono uppercase tracking-widest font-bold">
              EXAM ID: {exam.id.slice(0, 8)}
            </DialogDescription>
          </div>
        </div>

        {/* Tabs Container (Kitölti a maradék helyet) */}
        <Tabs defaultValue="add" className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsList
            className="grid w-full grid-cols-2 bg-slate-950 border-b border-slate-800 rounded-none h-12 p-0 shrink-0">
            <TabsTrigger value="add"
                         className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-none h-full text-xs font-bold uppercase tracking-wider border-r border-slate-800">ÚJ
              KIVÉTEL</TabsTrigger>
            <TabsTrigger value="active"
                         className="data-[state=active]:bg-slate-800 data-[state=active]:text-white rounded-none h-full text-xs font-bold uppercase tracking-wider">
              AKTÍV SZABÁLYOK {overrides.length > 0 &&
              <span className="ml-2 bg-white text-black px-1.5 py-0.5 rounded text-[10px]">{overrides.length}</span>}
            </TabsTrigger>
          </TabsList>

          {/* ADD TAB CONTENT (Görgethető) */}
          <TabsContent value="add" className="flex-1 flex flex-col min-h-0 p-0 m-0 bg-[#050a14] overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-900/50 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500"/>
                <Input placeholder="Név vagy jelvényszám keresése..." value={searchTerm}
                       onChange={e => setSearchTerm(e.target.value)}
                       className="pl-10 bg-slate-950 border-slate-700 font-mono text-xs h-10 focus-visible:ring-blue-500/50"/>
              </div>
            </div>

            {/* A ScrollArea-nak kell a flex-1, hogy kitöltse a helyet, és overflow-hidden a szülőn */}
            <div className="flex-1 min-h-0 overflow-hidden relative">
              <ScrollArea className="h-full w-full">
                <div className="p-2 space-y-1">
                  {loading ?
                    <p className="text-center py-10 text-xs text-slate-500 font-mono">ADATBÁZIS LEKÉRDEZÉSE...</p> :
                    filteredUsers.length === 0 ?
                      <p className="text-center py-10 text-xs text-slate-500 font-mono">NINCS TALÁLAT</p> :
                      filteredUsers.map(u => (
                        <div key={u.id}
                             className="flex items-center justify-between p-3 rounded border border-slate-800/50 hover:bg-slate-900 hover:border-slate-700 transition-all group">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 border border-slate-700"><AvatarImage
                              src={u.avatar_url}/><AvatarFallback
                              className="bg-slate-900 text-[10px] font-bold">{u.full_name.charAt(0)}</AvatarFallback></Avatar>
                            <div>
                              <p className="text-sm font-medium text-slate-200">{u.full_name}</p>
                              <p
                                className="text-[10px] text-slate-500 font-mono">{u.faction_rank} [#{u.badge_number}]</p>
                            </div>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="sm" variant="outline"
                                    className="h-7 text-green-500 border-green-900/30 hover:bg-green-900/20 hover:text-green-400 text-xs"
                                    onClick={() => addOverride(u.id, 'allow')}>
                              <UserCheck className="w-3 h-3 mr-1"/> Engedélyez
                            </Button>
                            <Button size="sm" variant="outline"
                                    className="h-7 text-red-500 border-red-900/30 hover:bg-red-900/20 hover:text-red-400 text-xs"
                                    onClick={() => addOverride(u.id, 'deny')}>
                              <UserX className="w-3 h-3 mr-1"/> Tiltás
                            </Button>
                          </div>
                        </div>
                      ))}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* ACTIVE TAB CONTENT (Görgethető) */}
          <TabsContent value="active" className="flex-1 flex flex-col min-h-0 p-0 m-0 bg-[#050a14] overflow-hidden">
            <div className="flex-1 min-h-0 overflow-hidden relative">
              <ScrollArea className="h-full w-full">
                <div className="p-2 space-y-2">
                  {overrides.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-slate-600 opacity-50">
                      <Shield className="w-10 h-10 mb-2"/>
                      <p className="text-[10px] font-mono uppercase">NINCSENEK KIVÉTELEK</p>
                    </div>
                  ) : overrides.map(ov => (
                    <div key={ov.id}
                         className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 border border-slate-700"><AvatarImage
                          src={ov.profile?.avatar_url}/><AvatarFallback
                          className="bg-slate-950 text-[10px]">{ov.profile?.full_name?.charAt(0)}</AvatarFallback></Avatar>
                        <div>
                          <p className="text-sm font-bold text-white">{ov.profile?.full_name}</p>
                          <Badge variant="outline"
                                 className={cn("text-[9px] font-mono", ov.access_type === 'allow' ? "text-green-500 border-green-900/50 bg-green-900/10" : "text-red-500 border-red-900/50 bg-red-900/10")}>
                            {ov.access_type === 'allow' ? 'ENGEDÉLYEZVE' : 'LETILTVA'}
                          </Badge>
                        </div>
                      </div>
                      <Button size="icon" variant="ghost"
                              className="h-8 w-8 text-slate-500 hover:text-red-500 hover:bg-red-900/20"
                              onClick={() => removeOverride(ov.id)}><UserX className="w-4 h-4"/></Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="p-4 bg-slate-950 border-t border-slate-800 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}
                  className="w-full border-slate-700 hover:bg-slate-800 text-slate-400">BEZÁRÁS</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}