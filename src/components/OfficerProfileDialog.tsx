import {useEffect, useState} from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {Badge} from "@/components/ui/badge";
import {ScrollArea} from "@/components/ui/scroll-area";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {useAuth} from "@/context/AuthContext";
import {
  Shield,
  Mail,
  Phone,
  Award,
  X,
  Loader2,
  Lock,
  FileKey,
  Siren,
  Eye,
  Edit3,
  UserCheck,
  UserX
} from "lucide-react";
import {cn} from "@/lib/utils";

interface OfficerProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  caseId?: string;
}

export function OfficerProfileDialog({open, onOpenChange, userId, caseId}: OfficerProfileDialogProps) {
  const {supabase} = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [awards, setAwards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [accessInfo, setAccessInfo] = useState<{ code: string, label: string, color: string, icon: any }>({
    code: "...", label: "ELLENŐRZÉS...", color: "text-slate-500 border-slate-700", icon: Loader2
  });

  const getDivisionDisplay = (p: any) => {
    const div = p.division || "ISMERETLEN";
    if (div !== 'TSB') return div;
    const rank = p.faction_rank || "";
    if (['Commander', 'Deputy Commander'].includes(rank)) return 'EXECUTIVE STAFF';
    if (rank.includes('Captain') || rank.includes('Lieutenant')) return 'COMMAND STAFF';
    if (rank.includes('Sergeant')) return 'SUPERVISORY STAFF';
    return 'FIELD STAFF';
  };

  useEffect(() => {
    if (!open || !userId) return;

    if (profile && profile.id === userId && !loading) return;

    setLoading(true);

    const fetchData = async () => {
      try {
        const {data: profileData} = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (profileData) {
          setProfile(profileData);
          const {data: awardsData} = await supabase.from('user_ribbons').select('*, ribbon:ribbons(*)').eq('user_id', userId);
          setAwards(awardsData || []);
        } else {
          setProfile(null);
        }
      } catch (e) {
        console.error("Profile fetch error:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [open, userId]);

  // ACCESS LOGIC
  useEffect(() => {
    if (!profile) return;

    const calculateAccess = async () => {
      if (!caseId) {
        setAccessInfo({
          code: "N/A",
          label: "ÁLTALÁNOS ADATLAP",
          color: "text-blue-400 border-blue-900 bg-blue-950/30",
          icon: UserCheck
        });
        return;
      }

      if (profile.is_bureau_manager || ['Commander', 'Deputy Commander'].includes(profile.faction_rank)) {
        setAccessInfo({
          code: "O5-CLR",
          label: "RENDSZERGAZDA / MANAGER",
          color: "text-purple-400 border-purple-900 bg-purple-950/30",
          icon: Shield
        });
        return;
      }

      const {data: caseData} = await supabase.from('cases').select('owner_id').eq('id', caseId).single();
      if (caseData?.owner_id === profile.id) {
        setAccessInfo({
          code: "OWNER",
          label: "AKTA TULAJDONOS",
          color: "text-yellow-400 border-yellow-900 bg-yellow-950/30",
          icon: Shield
        });
        return;
      }

      const {data: collab} = await supabase.from('case_collaborators')
        .select('role')
        .eq('case_id', caseId)
        .eq('user_id', profile.id)
        .maybeSingle();

      if (collab?.role === 'editor') {
        setAccessInfo({
          code: "EDIT-RW",
          label: "MEGBÍZOTT NYOMOZÓ",
          color: "text-orange-400 border-orange-900 bg-orange-950/30",
          icon: Edit3
        });
      } else if (collab?.role === 'viewer') {
        setAccessInfo({
          code: "VIEW-R",
          label: "MEGFIGYELŐ",
          color: "text-blue-400 border-blue-900 bg-blue-950/30",
          icon: Eye
        });
      } else {
        setAccessInfo({
          code: "DENIED",
          label: "NINCS HOZZÁFÉRÉS",
          color: "text-red-500 border-red-900 bg-red-950/30",
          icon: Lock
        });
      }
    };

    calculateAccess();
  }, [profile, caseId]);

  if (!open) return null;

  const AccessIcon = accessInfo.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#0b1120] border-2 border-slate-800 text-slate-200 max-w-2xl p-0 gap-0 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] [&>button]:hidden rounded-xl">

        {/* AKADÁLYMENTESÍTÉS JAVÍTÁS */}
        <DialogTitle className="sr-only">Profil Adatok</DialogTitle>
        <DialogDescription className="sr-only">Részletes információk a kiválasztott személyről.</DialogDescription>

        {/* HEADER */}
        <div className="relative h-40 bg-slate-950/80 border-b border-slate-800 shrink-0">
          <div
            className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-600 to-transparent opacity-50 z-50"></div>
          <div className="absolute inset-0 bg-blue-900/10 mix-blend-overlay"></div>

          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-slate-500 hover:text-red-400 hover:bg-red-950/30 z-50 rounded transition-all border border-transparent hover:border-red-900"
            onClick={() => onOpenChange(false)}
          >
            <X className="w-5 h-5"/>
          </Button>

          <div className="absolute top-4 left-4 flex gap-2">
            <div
              className="px-2 py-0.5 bg-slate-900/80 border border-slate-700 text-[10px] font-mono text-slate-400 rounded uppercase tracking-widest flex items-center gap-2">
              <Siren className="w-3 h-3 text-blue-500 animate-pulse"/> SFSD PERSONNEL DATABASE
            </div>
          </div>
        </div>

        {/* LOADING VAGY TARTALOM */}
        {loading ? (
          <div className="h-[350px] flex flex-col items-center justify-center gap-4 bg-[#0b1120]">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500"/>
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500 font-mono animate-pulse">Adatok letöltése...</span>
          </div>
        ) : profile ? (
          <div className="relative z-10 bg-[#0b1120] flex flex-col">

            {/* PROFILKÉP & NÉV */}
            <div className="px-8 pb-6 -mt-16 flex items-end gap-6 relative">
              <div className="relative z-20 group">
                <div
                  className="w-32 h-32 rounded-lg bg-slate-900 border-2 border-slate-700 p-1 shadow-2xl relative overflow-hidden">
                  <Avatar className="w-full h-full rounded bg-slate-950">
                    <AvatarImage src={profile?.avatar_url} className="object-cover"/>
                    <AvatarFallback className="text-3xl font-bold bg-slate-900 text-slate-600 rounded">
                      {profile?.full_name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 bg-[length:100%_2px,3px_100%] pointer-events-none opacity-40"></div>
                </div>
                <div
                  className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-slate-900 text-blue-400 text-[10px] font-black px-2 py-0.5 rounded border border-blue-900 shadow-lg tracking-widest z-30 whitespace-nowrap">
                  {profile.badge_number}
                </div>
              </div>

              <div className="flex-1 pb-1 min-w-0">
                <h2
                  className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3 drop-shadow-md truncate">
                  {profile.full_name}
                  {profile.faction_rank === 'Sheriff' &&
                    <Shield className="w-5 h-5 text-yellow-500 fill-yellow-500/20"/>}
                </h2>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <Badge variant="secondary"
                         className="bg-slate-800 text-slate-300 border-slate-700 rounded-sm font-mono text-xs px-2">
                    {profile.faction_rank}
                  </Badge>
                  <div className="h-4 w-px bg-slate-700"></div>
                  <span className="text-blue-400 text-xs font-bold uppercase tracking-wide">
                      {getDivisionDisplay(profile)}
                    </span>
                </div>
              </div>
            </div>

            {/* TABS & CONTENT */}
            <div className="px-8 pb-8 mt-2">
              <Tabs defaultValue="info" className="w-full">
                <TabsList
                  className="bg-slate-900/50 border-b border-slate-800 w-full justify-start h-10 p-0 rounded-none mb-6">
                  <TabsTrigger value="info"
                               className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-400 data-[state=active]:bg-transparent rounded-none h-full px-6 text-xs uppercase font-bold tracking-wider text-slate-500 transition-all">Személyi
                    Akta</TabsTrigger>
                  <TabsTrigger value="awards"
                               className="data-[state=active]:border-b-2 data-[state=active]:border-yellow-500 data-[state=active]:text-yellow-500 data-[state=active]:bg-transparent rounded-none h-full px-6 text-xs uppercase font-bold tracking-wider text-slate-500 transition-all">Kitüntetések <span
                    className="ml-2 opacity-50">({awards.length})</span></TabsTrigger>
                </TabsList>

                <div className="min-h-[240px]">
                  <TabsContent value="info" className="space-y-6 animate-in fade-in slide-in-from-left-2 duration-300">

                    {/* JOGOSULTSÁG SÁV */}
                    <div
                      className={cn("p-3 rounded border flex items-center justify-between shadow-sm", accessInfo.color)}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded bg-black/20">
                          <AccessIcon className="w-4 h-4"/>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold opacity-70 tracking-widest">AKTÁHOZ VALÓ HOZZÁFÉRÉS</p>
                          <p className="text-xs font-black tracking-wide">{accessInfo.label}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-mono opacity-60">AUTH CODE</p>
                        <p className="text-sm font-mono font-bold">{accessInfo.code}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 auto-rows-fr">
                      {/* BAL OSZLOP */}
                      <div className="flex flex-col gap-4 h-full">
                        <div className="group flex-1 flex flex-col">
                          <label
                            className="text-[9px] uppercase text-slate-500 font-bold tracking-widest flex items-center gap-2 mb-1">
                            <Mail className="w-3 h-3"/> Privát Email
                          </label>
                          <div
                            className="relative p-2 bg-slate-900/50 border border-slate-800 rounded overflow-hidden flex-1 flex items-center min-h-[44px]">
                            <span
                              className="text-xs font-mono text-red-500/50 blur-[3px] select-none font-bold w-full">confidential@sfsd.gov</span>
                            <div
                              className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1px]">
                              <span
                                className="text-[9px] text-red-500 font-bold border border-red-900/50 bg-red-950/80 px-1.5 py-0.5 rounded">RESTRICTED</span>
                            </div>
                          </div>
                        </div>

                        <div className="group flex-1 flex flex-col">
                          <label
                            className="text-[9px] uppercase text-slate-500 font-bold tracking-widest flex items-center gap-2 mb-1">
                            <Phone className="w-3 h-3"/> Privát Telefonszám
                          </label>
                          <div
                            className="relative p-2 bg-slate-900/50 border border-slate-800 rounded overflow-hidden flex-1 flex items-center min-h-[44px]">
                            <span
                              className="text-xs font-mono text-red-500/50 blur-[3px] select-none font-bold w-full">555-0192-384</span>
                            <div
                              className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1px]">
                              <span
                                className="text-[9px] text-red-500 font-bold border border-red-900/50 bg-red-950/80 px-1.5 py-0.5 rounded">RESTRICTED</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* JOBB OSZLOP */}
                      <div className="flex flex-col gap-4 h-full">
                        <div className="flex-1 flex flex-col">
                          <label
                            className="text-[9px] uppercase text-slate-500 font-bold tracking-widest flex items-center gap-2 mb-1">
                            <Shield className="w-3 h-3"/> Beosztás
                          </label>
                          <div
                            className="p-2 bg-slate-900/50 border border-slate-800 rounded flex-1 flex items-center min-h-[44px]">
                            <p
                              className="text-xs text-blue-200 font-bold">{profile.division_rank || "Nincs rögzítve"}</p>
                          </div>
                        </div>

                        <div className="flex-1 flex flex-col">
                          <label
                            className="text-[9px] uppercase text-slate-500 font-bold tracking-widest flex items-center gap-2 mb-1">
                            <FileKey className="w-3 h-3"/> Rendszer Jogosultság
                          </label>
                          <div
                            className="p-2 bg-slate-900/50 border border-slate-800 rounded flex items-center gap-2 flex-1 min-h-[44px]">
                            <div
                              className={cn("w-2 h-2 rounded-full", profile.system_role === 'admin' ? "bg-red-500 shadow-[0_0_8px_red]" : "bg-blue-500")}></div>
                            <p className="text-xs text-slate-300 font-mono uppercase">{profile.system_role}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="awards" className="animate-in fade-in slide-in-from-right-2 duration-300">
                    <ScrollArea className="h-[240px] w-full pr-3 custom-scrollbar">
                      {awards.length > 0 ? (
                        <div className="grid grid-cols-1 gap-2">
                          {awards.map((awardItem) => (
                            <div key={awardItem.id}
                                 className="flex items-start gap-4 p-3 rounded bg-gradient-to-r from-slate-900/80 to-slate-900/40 border border-slate-800 hover:border-yellow-900/50 transition-colors group">
                              <div
                                className="w-10 h-10 rounded bg-black/40 border border-slate-700 flex items-center justify-center shrink-0 overflow-hidden shadow-inner group-hover:border-yellow-700/50 transition-colors">
                                {awardItem.ribbon?.image_url ? (
                                  <img src={awardItem.ribbon.image_url} alt="" className="w-full h-full object-cover"/>
                                ) : (
                                  <Award className="w-5 h-5 text-yellow-600 group-hover:text-yellow-500"/>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                  <p
                                    className="text-xs font-bold text-yellow-500 truncate pr-2">{awardItem.ribbon?.name || "Ismeretlen Kitüntetés"}</p>
                                  <span
                                    className="text-[9px] font-mono text-slate-600 bg-slate-950 px-1 rounded border border-slate-900">{new Date(awardItem.awarded_at).toLocaleDateString('hu-HU')}</span>
                                </div>
                                <p
                                  className="text-[10px] text-slate-400 mt-1 line-clamp-2">{awardItem.ribbon?.description || "Nincs leírás a kitüntetéshez."}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div
                          className="flex flex-col items-center justify-center h-[200px] text-slate-600 border-2 border-dashed border-slate-800/50 rounded-lg bg-slate-900/10">
                          <div className="p-4 rounded-full bg-slate-900/50 mb-3">
                            <Award className="w-8 h-8 opacity-20"/>
                          </div>
                          <p className="text-xs font-mono uppercase tracking-widest opacity-50">Nincs kitüntetés</p>
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>
                </div>
              </Tabs>
            </div>

            <div
              className="px-6 py-2 bg-slate-950 border-t border-slate-800 flex justify-between items-center text-[9px] font-mono text-slate-600 uppercase tracking-widest shrink-0">
              <span>SFSD DATABASE V3.0 // SECURE CONNECTION</span>
              <span className="flex items-center gap-1.5 text-green-600">
                 <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>
                 LIVE
               </span>
            </div>

          </div>
        ) : (
          <div className="p-20 text-center text-slate-500 bg-[#0b1120]">
            <UserX className="w-12 h-12 mx-auto mb-4 opacity-20"/>
            <p className="uppercase tracking-widest text-xs">Profil nem elérhető</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}