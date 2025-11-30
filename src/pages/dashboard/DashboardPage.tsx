import * as React from "react";
import {useAuth} from "@/context/AuthContext";
import {useSystemStatus, type AlertLevelId} from "@/context/SystemStatusContext";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {ScrollArea} from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Switch} from "@/components/ui/switch";
import {
  Shield,
  Activity,
  Users,
  Radio,
  CloudRain,
  Sun,
  Cloud,
  Wind,
  Clock,
  Bell,
  ChevronRight,
  AlertTriangle,
  FileText,
  Terminal,
  Truck,
  Siren,
  Database,
  Lock,
  Gavel,
  Plus,
  Megaphone,
  Check,
  Ticket,
  AlertOctagon,
  Info,
  Podcast,
  Pin,
  Trash2,
  EyeOff,
  User,
  UserCheck,
  Eye, GraduationCap, Signal
} from "lucide-react";
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
import {useNavigate} from "react-router-dom";
import {SheriffBackground} from "@/components/SheriffBackground";
import {cn, isMcbMember, isSupervisory, isHighCommand, isCommand, isExecutive} from "@/lib/utils";
import {formatDistanceToNow} from "date-fns";
import {hu} from "date-fns/locale";
import {toast} from "sonner";

// --- KONFIGURÁCIÓ ---
const ALERT_LEVELS: Record<AlertLevelId, { label: string, color: string, icon: any }> = {
  'normal': {label: 'NORMÁL', color: 'text-green-500', icon: Shield},
  'traffic': {label: 'FOKOZOTT ELLENŐRZÉS', color: 'text-yellow-500', icon: Activity},
  'border': {label: 'HATÁRZÁR', color: 'text-orange-500', icon: AlertTriangle},
  'tactical': {label: 'TAKTIKAI RIADÓ', color: 'text-red-500', icon: Siren},
};

// --- SEGÉD: RANG KATEGÓRIA ---
const getStaffCategory = (rank: string) => {
  const EXECUTIVE = ['Commander', 'Deputy Commander'];
  const COMMAND = ['Captain III.', 'Captain II.', 'Captain I.', 'Lieutenant II.', 'Lieutenant I.'];
  const SUPERVISORY = ['Sergeant II.', 'Sergeant I.'];

  if (EXECUTIVE.includes(rank)) return "EXECUTIVE STAFF";
  if (COMMAND.includes(rank)) return "COMMAND STAFF";
  if (SUPERVISORY.includes(rank)) return "SUPERVISORY STAFF";
  return "SHERIFF'S DEPARTMENT";
};

// --- WIDGETEK ---
const WeatherWidget = () => {
  const weather = React.useMemo(() => {
    const types = [
      {icon: Sun, label: "Tiszta", temp: "24°C", color: "text-yellow-500"},
      {icon: Cloud, label: "Felhős", temp: "19°C", color: "text-slate-400"},
      {icon: CloudRain, label: "Esős", temp: "16°C", color: "text-blue-400"},
      {icon: Wind, label: "Szeles", temp: "18°C", color: "text-slate-300"},
    ];
    return types[Math.floor(Math.random() * types.length)];
  }, []);
  const Icon = weather.icon;
  return (
    <div
      className="flex items-center gap-4 bg-slate-950/60 p-3 rounded-xl border border-slate-800 backdrop-blur-md shadow-lg group hover:border-slate-700 transition-all">
      <div className={`p-2 rounded-lg bg-slate-900 ${weather.color}`}><Icon className="w-6 h-6"/></div>
      <div>
        <div className="text-lg font-bold text-white leading-none">{weather.temp}</div>
        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{weather.label}</div>
      </div>
    </div>
  );
};

const ClockWidget = () => {
  const [time, setTime] = React.useState(new Date());
  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div
      className="flex items-center gap-4 bg-slate-950/60 p-3 rounded-xl border border-slate-800 backdrop-blur-md shadow-lg group hover:border-slate-700 transition-all">
      <div className="p-2 rounded-lg bg-slate-900 text-blue-500"><Clock className="w-6 h-6"/></div>
      <div>
        <div className="text-lg font-mono font-bold text-white leading-none">{time.toLocaleTimeString('hu-HU', {
          hour: '2-digit',
          minute: '2-digit'
        })}</div>
        <div
          className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{time.toLocaleDateString('hu-HU', {
          month: 'short',
          day: 'numeric'
        })}</div>
      </div>
    </div>
  );
};

// --- MODUL KÁRTYA ---
const ModuleCard = ({title, desc, icon: Icon, colorClass, onClick, locked = false}: any) => (
  <div onClick={!locked ? onClick : undefined}
       className={cn("relative overflow-hidden rounded-xl border p-6 transition-all group cursor-pointer flex flex-col justify-between h-[160px]",
         locked ? "bg-slate-950/40 border-slate-800/50 opacity-50 cursor-not-allowed" : "bg-slate-900/80 border-slate-700/50 hover:border-yellow-500/50 hover:bg-slate-900 hover:shadow-lg hover:shadow-yellow-500/10 backdrop-blur-sm")}
  >
    <div
      className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
    <div
      className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full blur-3xl transition-opacity opacity-0 group-hover:opacity-20 ${colorClass.replace('text-', 'bg-')}`}></div>
    <div className="relative z-10">
      <div
        className={cn("w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-all group-hover:scale-110", locked ? "bg-slate-900 text-slate-600" : "bg-slate-950 border border-slate-800", colorClass)}>
        {locked ? <Lock className="w-5 h-5"/> : <Icon className="w-5 h-5"/>}
      </div>
      <h3
        className={cn("text-base font-black uppercase tracking-tight mb-1", locked ? "text-slate-500" : "text-white group-hover:text-yellow-500 transition-colors")}>{title}</h3>
      <p className="text-[10px] text-slate-400 font-medium line-clamp-2 leading-relaxed">{desc}</p>
    </div>
    {!locked && (<div className="relative z-10 mt-auto pt-2 flex justify-end"><ChevronRight
      className="w-4 h-4 text-slate-600 group-hover:text-yellow-500 group-hover:translate-x-1 transition-all"/></div>)}
  </div>
);

// --- ÚJ HIRDETÉS DIALÓGUS (JAVÍTOTT GOMBOKKAL) ---
const NewAnnouncementDialog = ({open, onOpenChange, onSuccess}: {
  open: boolean,
  onOpenChange: (o: boolean) => void,
  onSuccess: () => void
}) => {
  const {supabase, user} = useAuth();
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [type, setType] = React.useState("info");
  const [isPinned, setIsPinned] = React.useState(false);
  const [showAuthor, setShowAuthor] = React.useState(true);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async () => {
    if (!title || !content) return toast.error("Minden mező kötelező!");
    setLoading(true);
    try {
      const {error} = await supabase.from('announcements').insert({
        title, content, type, created_by: user?.id,
        is_pinned: isPinned, show_author: showAuthor
      });
      if (error) throw error;
      toast.success("Hirdetés közzétéve!");
      onSuccess();
      onOpenChange(false);
      setTitle("");
      setContent("");
      setIsPinned(false);
      setShowAuthor(true);
    } catch (e) {
      toast.error("Hiba történt.");
    } finally {
      setLoading(false);
    }
  };

  const TypeCard = ({id, label, icon: Icon, colorClass, activeClass, borderColor}: any) => (
    <div onClick={() => setType(id)}
         className={cn("flex flex-col items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-all flex-1 select-none", type === id ? cn("bg-slate-900/80", borderColor, activeClass) : "bg-slate-950 border-slate-800 text-slate-500 hover:bg-slate-900 hover:border-slate-700")}>
      <Icon className={cn("w-6 h-6 mb-2 transition-colors", type === id ? colorClass : "text-slate-600")}/>
      <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
    </div>
  );

  // Jól látható Toggle Kártya
  const ToggleOption = ({label, description, active, onChange, icon: Icon, activeColor, activeText}: any) => (
    <div onClick={() => onChange(!active)}
         className={cn("flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all select-none", active ? cn("bg-slate-900/80", activeColor) : "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700")}>
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-md", active ? "bg-white/10 text-white" : "bg-slate-900 text-slate-600")}><Icon
          className="w-5 h-5"/></div>
        <div>
          <div
            className={cn("text-xs font-bold uppercase tracking-wider", active ? "text-white" : "text-slate-500")}>{label}</div>
          <div className="text-[9px] text-slate-600 font-bold">{description}</div>
        </div>
      </div>
      <div
        className={cn("px-2 py-1 rounded text-[9px] font-black uppercase", active ? activeText : "bg-slate-900 text-slate-600")}>
        {active ? "AKTÍV" : "KI"}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#0b1221] border border-yellow-500/30 text-white sm:max-w-lg shadow-[0_0_40px_rgba(234,179,8,0.15)] p-0 overflow-hidden">
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 p-5 flex items-center gap-3">
          <div className="p-2 rounded bg-yellow-500/10 border border-yellow-500/30 text-yellow-500"><Podcast
            className="w-5 h-5"/></div>
          <div><DialogTitle className="text-lg font-black uppercase tracking-tight">ADÁS
            INDÍTÁSA</DialogTitle><DialogDescription
            className="text-[10px] text-yellow-500/60 font-mono uppercase tracking-widest font-bold">Secure Broadcast
            Terminal</DialogDescription></div>
        </div>
        <div className="p-6 space-y-5">
          <div className="space-y-2"><Label
            className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Kategória</Label>
            <div className="flex gap-3"><TypeCard id="info" label="INFO" icon={Info} colorClass="text-blue-400"
                                                  activeClass="text-blue-100" borderColor="border-blue-500"/><TypeCard
              id="alert" label="RIASZTÁS" icon={AlertTriangle} colorClass="text-red-500" activeClass="text-red-100"
              borderColor="border-red-500"/><TypeCard id="training" label="KÉPZÉS" icon={GraduationCap}
                                                      colorClass="text-green-500" activeClass="text-green-100"
                                                      borderColor="border-green-500"/></div>
          </div>
          <div className="space-y-1.5"><Label
            className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Címsor</Label><Input
            value={title} onChange={e => setTitle(e.target.value)}
            className="bg-slate-950 border-slate-800 focus-visible:ring-yellow-500/50 font-bold"
            placeholder="Rövid cím..."/></div>
          <div className="space-y-1.5"><Label
            className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Üzenet</Label><Textarea
            value={content} onChange={e => setContent(e.target.value)}
            className="bg-slate-950 border-slate-800 h-32 resize-none break-words whitespace-pre-wrap text-sm leading-relaxed placeholder:text-slate-700 break-all"
            placeholder="Írd ide az üzenetet..."/></div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
            <ToggleOption label="KIEMELÉS" description="Lista tetejére rögzít" active={isPinned} onChange={setIsPinned}
                          icon={Pin} activeColor="border-yellow-500/50 shadow-yellow-900/20"
                          activeText="bg-yellow-500 text-black"/>
            <ToggleOption label="ALÁÍRÁS" description={showAuthor ? "Név megjelenítése" : "Csak rang látszik"}
                          active={showAuthor} onChange={setShowAuthor} icon={showAuthor ? Eye : EyeOff}
                          activeColor="border-blue-500/50 shadow-blue-900/20" activeText="bg-blue-500 text-white"/>
          </div>
        </div>
        <DialogFooter className="p-5 bg-slate-950 border-t border-slate-800 flex justify-between"><Button
          variant="ghost" onClick={() => onOpenChange(false)}
          className="hover:bg-slate-900 text-slate-400 text-xs font-bold uppercase">Mégse</Button><Button
          onClick={handleSubmit} disabled={loading}
          className="bg-yellow-600 hover:bg-yellow-500 text-black font-black uppercase tracking-widest px-6 shadow-[0_0_20px_rgba(234,179,8,0.3)] hover:scale-105 transition-all"><Signal
          className="w-4 h-4 mr-2"/> ADÁS KÜLDÉSE</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// --- STÁTUSZ KEZELŐ ---
const StatusControlDialog = ({open, onOpenChange}: { open: boolean, onOpenChange: (o: boolean) => void }) => {
  const {alertLevel, setAlertLevel, recruitmentOpen, toggleRecruitment} = useSystemStatus();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0b1221] border border-slate-800 text-white sm:max-w-sm p-0 shadow-2xl">
        <div className="bg-slate-900/50 border-b border-slate-800 p-4"><DialogTitle
          className="text-sm font-bold uppercase tracking-wider flex items-center gap-2"><Activity
          className="w-4 h-4 text-blue-500"/> Rendszer Státusz</DialogTitle></div>
        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-widest">Riasztási Szint
              (DEFCON)</Label>
            <div className="grid grid-cols-1 gap-2">
              {(Object.keys(ALERT_LEVELS) as AlertLevelId[]).map((level) => (
                <div key={level} onClick={() => setAlertLevel(level)}
                     className={cn("flex items-center justify-between p-3 rounded border cursor-pointer transition-all", alertLevel === level ? "bg-slate-800 border-yellow-500/50" : "bg-slate-950 border-slate-800 hover:bg-slate-900")}>
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${ALERT_LEVELS[level].color.replace('text-', 'bg-')}`}></div>
                    <span
                      className={cn("text-xs font-bold uppercase", alertLevel === level ? "text-white" : "text-slate-400")}>{ALERT_LEVELS[level].label}</span>
                  </div>
                  {alertLevel === level && <Check className="w-3 h-3 text-yellow-500"/>}
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-widest">TGF Kapu</Label>
            <Button onClick={toggleRecruitment}
                    className={cn("w-full font-bold h-9 text-xs uppercase tracking-wider", recruitmentOpen ? "bg-green-600 hover:bg-green-500" : "bg-red-600 hover:bg-red-500")}>{recruitmentOpen ? "TGF NYITVA (Lezárás)" : "TGF ZÁRVA (Megnyitás)"}</Button>
          </div>
        </div>
        <DialogFooter className="p-4 bg-slate-950 border-t border-slate-800"><Button variant="ghost" size="sm"
                                                                                     onClick={() => onOpenChange(false)}>Bezárás</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// --- FEED ITEM (JAVÍTOTT) ---
const FeedItem = ({item, onDelete, currentUser}: { item: any, onDelete: (id: string) => void, currentUser: any }) => {
  const canDelete = (currentUser.id === item.created_by) || isCommand(currentUser) || isExecutive(currentUser) || currentUser.is_bureau_manager;
  const authorName = item.show_author ? item.profiles?.full_name : getStaffCategory(item.profiles?.faction_rank);
  const authorRank = item.show_author ? item.profiles?.faction_rank : "CLASSIFIED";

  return (
    <div
      className={cn("p-4 border-l-4 bg-slate-950/40 hover:bg-slate-950/60 hover:border-yellow-500/50 transition-all rounded-r-lg group mb-3 relative", item.is_pinned ? "border-yellow-500 bg-yellow-900/10" : "border-slate-700")}>
      <div className="flex justify-between items-start mb-2">
        <div className="flex gap-2 items-center">
          {item.is_pinned && <Pin className="w-3 h-3 text-yellow-500 fill-current rotate-45"/>}
          <Badge variant="outline"
                 className={cn("text-[9px] h-5 uppercase border-opacity-50", item.type === 'alert' ? "text-red-400 border-red-500 bg-red-500/10" : item.type === 'training' ? "text-blue-400 border-blue-500 bg-blue-500/10" : "text-slate-400 border-slate-600 bg-slate-500/10")}>{item.type === 'alert' ? 'RIASZTÁS' : item.type === 'training' ? 'KÉPZÉS' : 'INFÓ'}</Badge>
          <span className="text-[9px] text-slate-600 font-mono">{formatDistanceToNow(new Date(item.created_at), {
            locale: hu,
            addSuffix: true
          })}</span>
        </div>
        {canDelete && <Button size="icon" variant="ghost"
                              className="h-5 w-5 text-slate-600 hover:text-red-500 -mr-2 opacity-0 group-hover:opacity-100 transition-all"
                              onClick={() => onDelete(item.id)}><Trash2 className="w-3 h-3"/></Button>}
      </div>
      <h4 className="text-sm font-bold text-white group-hover:text-yellow-500 transition-colors mb-2">{item.title}</h4>
      <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap break-all mb-3">{item.content}</div>
      <div className="pt-2 border-t border-white/5 flex items-center gap-2">
        <div className={cn("w-1.5 h-1.5 rounded-full", item.show_author ? "bg-green-500" : "bg-blue-500")}></div>
        <div className="text-[9px] text-slate-500 font-mono uppercase">FROM: <span
          className={cn("font-bold", item.show_author ? "text-slate-300" : "text-blue-400")}>{authorName}</span> <span
          className="mx-1 text-slate-700">|</span> RANK: {authorRank}</div>
      </div>
    </div>
  );
};

// --- ACTION LOG ITEM ---
const ActionItem = ({log}: { log: any }) => (
  <div className="flex items-start gap-3 p-3 border-b border-slate-800/50 hover:bg-slate-900/30 transition-colors">
    <div
      className={cn("p-1.5 rounded bg-slate-950 border shrink-0", log.action_type === 'arrest' ? "border-red-900/50 text-red-500" : log.action_type === 'ticket' ? "border-orange-900/50 text-orange-500" : "border-blue-900/50 text-blue-500")}>
      {log.action_type === 'arrest' ? <AlertOctagon className="w-3 h-3"/> : log.action_type === 'ticket' ?
        <Ticket className="w-3 h-3"/> : <Info className="w-3 h-3"/>}
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex justify-between items-baseline">
            <span
              className={cn("text-xs font-black uppercase tracking-wide", log.action_type === 'arrest' ? "text-red-400" : log.action_type === 'ticket' ? "text-orange-400" : "text-blue-400")}>
               {log.action_type === 'arrest' ? 'LETARTÓZTATÁS' : log.action_type === 'ticket' ? 'BÍRSÁG' : 'NAPLÓ'}
            </span>
        <span className="text-[9px] text-slate-500 font-mono">{new Date(log.created_at).toLocaleTimeString('hu-HU', {
          hour: '2-digit',
          minute: '2-digit'
        })}</span>
      </div>
      <div className="flex items-center gap-1 mt-0.5">
        <User className="w-2.5 h-2.5 text-slate-600"/>
        <span className="text-[10px] font-bold text-slate-300">{log.profiles?.full_name || "Ismeretlen"}</span>
        <span className="text-[9px] text-slate-600">#{log.profiles?.badge_number}</span>
      </div>
      <p
        className="text-[10px] text-slate-400 mt-1 leading-snug border-l-2 border-slate-800 pl-2 italic break-all whitespace-pre-wrap">{log.details}</p>
    </div>
  </div>
);

export function DashboardPage() {
  const {profile, supabase} = useAuth();
  const {alertLevel} = useSystemStatus();
  const navigate = useNavigate();

  const [announcements, setAnnouncements] = React.useState<any[]>([]);
  const [actionLogs, setActionLogs] = React.useState<any[]>([]);
  const [activeUnitCount, setActiveUnitCount] = React.useState(0);
  const [isAnnouncementOpen, setIsAnnouncementOpen] = React.useState(false);
  const [isStatusOpen, setIsStatusOpen] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    const {data: news} = await supabase.from('announcements').select('*, profiles(full_name, faction_rank)').order('is_pinned', {ascending: false}).order('created_at', {ascending: false}).limit(10);
    if (news) setAnnouncements(news);

    const {count} = await supabase.from('profiles').select('id', {
      count: 'exact',
      head: true
    }).neq('system_role', 'pending');
    setActiveUnitCount(count || 0);

    const {data: logs} = await supabase.from('action_logs').select('*, profiles!action_logs_user_id_fkey(full_name, badge_number)').order('created_at', {ascending: false}).limit(8);
    if (logs) setActionLogs(logs);
  }, [supabase]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeleteAnnouncement = async (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const {error} = await supabase.from('announcements').delete().eq('id', deleteId);
    if (error) toast.error("Hiba a törléskor."); else {
      toast.success("Törölve.");
      fetchData();
    }
    setDeleteId(null);
  };

  const greeting = React.useMemo(() => {
    const h = new Date().getHours();
    return h < 6 ? "Jó éjszakát" : h < 10 ? "Jó reggelt" : h < 18 ? "Szép napot" : "Jó estét";
  }, []);

  if (!profile) return null;
  const canCreateNews = profile.system_role === 'admin' || isHighCommand(profile);
  const canManageStatus = profile.system_role === 'admin' || isHighCommand(profile);
  const alertInfo = ALERT_LEVELS[alertLevel];

  return (
    <div className="min-h-screen bg-[#050a14] relative overflow-hidden pb-20">
      <SheriffBackground side="left"/>

      <NewAnnouncementDialog open={isAnnouncementOpen} onOpenChange={setIsAnnouncementOpen} onSuccess={fetchData}/>
      <StatusControlDialog open={isStatusOpen} onOpenChange={setIsStatusOpen}/>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="bg-[#0b1221] border border-red-900/50 text-white">
          <AlertDialogHeader><AlertDialogTitle className="text-red-500 flex items-center gap-2"><Trash2
            className="w-5 h-5"/> HIRDETÉS TÖRLÉSE</AlertDialogTitle><AlertDialogDescription className="text-slate-400">Biztosan
            törlöd ezt a hirdetményt? A művelet nem visszavonható.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel
            className="bg-slate-900 border-slate-700 hover:bg-slate-800 text-white">Mégse</AlertDialogCancel><AlertDialogAction
            onClick={confirmDelete}
            className="bg-red-600 hover:bg-red-700 border-none text-white font-bold">Törlés</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="max-w-[1600px] mx-auto px-6 py-10 relative z-10">
        {/* HEADER */}
        <div
          className="flex flex-col lg:flex-row justify-between items-end gap-8 mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-yellow-500/80 mb-2"><Shield className="w-5 h-5"/><span
              className="text-xs font-bold uppercase tracking-[0.3em]">San Fierro Sheriff's Dept.</span></div>
            <h1
              className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter leading-none drop-shadow-lg">{greeting}, <br/><span
              className="text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">{profile.full_name.split(' ')[0]}.</span>
            </h1>
            <div className="flex items-center gap-3 pt-2"><Badge variant="outline"
                                                                 className="border-slate-600 text-slate-300 font-mono uppercase">{profile.faction_rank}</Badge><Badge
              className="bg-yellow-600 text-black font-bold font-mono border-none">#{profile.badge_number}</Badge></div>
          </div>
          <div className="flex flex-wrap gap-4 items-center">
            <WeatherWidget/> <ClockWidget/>
            <div onClick={() => canManageStatus && setIsStatusOpen(true)}
                 className={cn("flex items-center gap-4 bg-slate-950/60 p-3 rounded-xl border backdrop-blur-md px-6 shadow-lg transition-all", canManageStatus ? "cursor-pointer hover:bg-slate-900 hover:scale-105" : "cursor-default", alertLevel === 'tactical' ? "border-red-500/50 bg-red-950/40" : alertLevel === 'border' ? "border-orange-500/50 bg-orange-950/40" : "border-green-500/30 bg-green-950/20")}>
              <div>
                <div
                  className={cn("text-lg font-black uppercase italic tracking-tighter leading-none drop-shadow-md", alertInfo.color)}>{alertInfo.label}</div>
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mt-1">Jelenlegi
                  Készültség {canManageStatus && "(Kezelés)"}</div>
              </div>
              {canManageStatus &&
                <div className="p-1 rounded bg-black/30 text-white"><Shield className="w-4 h-4"/></div>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* LEFT: MODULES */}
          <div className="lg:col-span-8 space-y-8 animate-in slide-in-from-left-8 duration-700 delay-100">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div
                className="bg-slate-900/60 border border-slate-800/50 p-4 rounded-lg flex items-center gap-3 backdrop-blur-sm shadow-md">
                <div className="p-2 bg-blue-500/10 rounded-full"><Users className="w-5 h-5 text-blue-500"/></div>
                <div>
                  <div className="text-xl font-bold text-white">{activeUnitCount}</div>
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Aktív Egység</div>
                </div>
              </div>
              <div
                className="bg-slate-900/60 border border-slate-800/50 p-4 rounded-lg flex items-center gap-3 backdrop-blur-sm shadow-md">
                <div className="p-2 bg-green-500/10 rounded-full"><Radio className="w-5 h-5 text-green-500"/></div>
                <div>
                  <div className="text-xl font-bold text-white">ONLINE</div>
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Rádió Status</div>
                </div>
              </div>
              <div
                className="bg-slate-900/60 border border-slate-800/50 p-4 rounded-lg flex items-center gap-3 backdrop-blur-sm shadow-md">
                <Activity className="w-6 h-6 text-yellow-500"/>
                <div className="w-full">
                  <div className="flex justify-between text-[10px] text-slate-500 uppercase font-bold mb-1"><span>Rendszer Terhelés</span><span
                    className="text-white">STABIL</span></div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full w-[12%] bg-yellow-500 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)]"></div>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <h3
                className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 pl-1 mb-4">
                <Terminal className="w-4 h-4"/> Rendszer Modulok</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <ModuleCard title="NYOMOZÓ IRODA" desc="Akták, gyanúsítottak, körözések." icon={Siren}
                            colorClass="text-blue-500" onClick={() => navigate('/mcb')}
                            locked={!isMcbMember(profile) && !isSupervisory(profile) && profile.system_role !== 'admin'}/>
                <ModuleCard title="LOGISZTIKA" desc="Járműigénylés, raktárkészlet." icon={Truck}
                            colorClass="text-orange-500" onClick={() => navigate('/logistics')}/>
                <ModuleCard title="PÉNZÜGY" desc="Költségtérítések, bírságok." icon={Database}
                            colorClass="text-green-500" onClick={() => navigate('/finance')}/>
                <ModuleCard title="VIZSGAKÖZPONT" desc="Képzések, tesztek, vizsgáztatás." icon={FileText}
                            colorClass="text-yellow-500" onClick={() => navigate('/exams')}/>
                <ModuleCard title="BÜNTETŐ TÖRVÉNYKÖNYV" desc="Bírság kalkulátor és jogszabályok." icon={Gavel}
                            colorClass="text-purple-500" onClick={() => navigate('/calculator')}/>
                <ModuleCard title="JELENTÉSEK" desc="Napi jelentések generálása." icon={FileText}
                            colorClass="text-cyan-500" onClick={() => navigate('/reports')}/>
              </div>
            </div>
          </div>
          {/* RIGHT: FEEDS */}
          <div className="lg:col-span-4 space-y-6 animate-in slide-in-from-right-8 duration-700 delay-200">
            <Card
              className="bg-[#0b1221]/90 border border-slate-800 h-[320px] flex flex-col shadow-xl backdrop-blur-md">
              <CardHeader className="pb-2 border-b border-slate-800/50 bg-slate-950/50"><CardTitle
                className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between"><span
                className="flex items-center gap-2"><Activity
                className="w-4 h-4 text-green-500"/> Eseménynapló</span><span
                className="text-[9px] bg-green-900/20 text-green-500 px-1.5 py-0.5 rounded animate-pulse">LIVE</span></CardTitle></CardHeader>
              <div className="flex-1 min-h-0 relative"><ScrollArea className="h-full">{actionLogs.length === 0 ?
                <div className="flex flex-col items-center justify-center h-full text-slate-600 opacity-50"><Activity
                  className="w-8 h-8 mb-2"/><p className="text-[10px] font-mono uppercase">CSENDES ÜZEMMÓD</p></div> :
                <div className="divide-y divide-slate-800/30">{actionLogs.map((log) => <ActionItem key={log.id}
                                                                                                   log={log}/>)}</div>}</ScrollArea>
              </div>
            </Card>
            <Card
              className="bg-[#0b1221]/80 border border-slate-800 h-[450px] flex flex-col shadow-2xl backdrop-blur-md">
              <CardHeader
                className="pb-3 border-b border-slate-800/50 bg-slate-950/50 flex flex-row items-center justify-between"><CardTitle
                className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Bell
                className="w-4 h-4 text-yellow-500"/> Hirdetmények</CardTitle>{canCreateNews &&
                <Button size="icon" variant="ghost" className="h-6 w-6 text-slate-400 hover:text-white"
                        onClick={() => setIsAnnouncementOpen(true)}><Plus className="w-4 h-4"/></Button>}</CardHeader>
              <div className="flex-1 min-h-0 relative"><ScrollArea className="h-full">
                <div className="p-4">{announcements.length === 0 ?
                  <div className="flex flex-col items-center justify-center h-40 text-slate-600 opacity-50"><Megaphone
                    className="w-8 h-8 mb-2"/><p className="text-[10px] font-mono uppercase">NINCS FRISS HÍR</p>
                  </div> : announcements.map((item) => <FeedItem key={item.id} item={item}
                                                                 onDelete={handleDeleteAnnouncement}
                                                                 currentUser={profile}/>)}</div>
              </ScrollArea>
                <div
                  className="absolute bottom-0 left-0 w-full h-16 bg-gradient-to-t from-[#0b1221] to-transparent pointer-events-none"></div>
              </div>
              <div className="p-3 border-t border-slate-800 bg-slate-900/50 text-center"><Button variant="ghost"
                                                                                                 size="sm"
                                                                                                 className="text-[10px] uppercase font-bold text-slate-400 hover:text-white w-full"
                                                                                                 onClick={() => navigate('/resources')}>DOKUMENTÁCIÓS
                TÁR MEGNYITÁSA</Button></div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}