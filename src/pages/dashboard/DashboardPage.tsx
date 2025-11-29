import * as React from "react";
import {useAuth} from "@/context/AuthContext";
import {useSystemStatus, type AlertLevelId} from "@/context/SystemStatusContext";
import {Button} from "@/components/ui/button";
import {
  ShieldAlert, Truck, Banknote, Gavel, Users,
  Clock, Megaphone, Activity, AlertTriangle, Briefcase, User, Plus, Trash2, Pin, ChevronDown,
  Search, Siren, CloudSun, Radio, Power, FileBarChart, Quote, BookOpen, Signal, Layers
} from "lucide-react";
import {useNavigate} from "react-router-dom";
import {toast} from "sonner";
import {ScrollArea} from "@/components/ui/scroll-area";
import {formatDistanceToNow} from "date-fns";
import {hu} from "date-fns/locale";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Label} from "@/components/ui/label";
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";

// --- KONSTANSOK ---
const ALERT_LEVELS: Record<AlertLevelId, { label: string; color: string; bg: string; icon: any }> = {
  normal: {label: "NORMÁL ÜGYMENET", color: "#eab308", bg: "bg-yellow-500", icon: Activity},
  traffic: {label: "FOKOZOTT ELLENŐRZÉS", color: "#f97316", bg: "bg-orange-500", icon: AlertTriangle},
  border: {label: "TELJES HATÁRZÁR", color: "#ef4444", bg: "bg-red-500", icon: ShieldAlert},
  tactical: {label: "KIEMELT RIADÓ", color: "#dc2626", bg: "bg-red-600", icon: Siren},
};

const EXECUTIVE_RANKS = ['Commander', 'Deputy Commander', 'Captain III.', 'Captain II.', 'Captain I.', 'Lieutenant II.', 'Lieutenant I.'];
const SUPERVISORY_RANKS = ['Sergeant II.', 'Sergeant I.'];

const MOTIVATIONAL_QUOTES = [
  "A törvény szolgálatában, a közösség védelmében.",
  "Az igazság nem alkudozik.",
  "Légy éber, a város sosem alszik.",
  "A becsület a legfontosabb jelvényünk.",
  "Ma is tehetsz valamit a biztonságért.",
  "San Fierro számít ránk.",
  "A bátorság nem a félelem hiánya, hanem a cselekvés a félelem ellenére.",
  "Minden akta mögött egy emberi sors rejlik.",
  "A rendfenntartás nem munka, hanem hivatás.",
  "Egységben az erő, hűségben a becsület.",
  "A törvény nem csak betű, hanem szellem is.",
  "Szolgálunk és védünk.",
  "A rend a szabadság alapja.",
  "Hűség, Bátorság, Becsület.",
  "Az egyenruha kötelez.",
  "Vigyázzunk egymásra, hogy vigyázhassunk másokra.",
  "A jelvény mögött szív dobog.",
  "Nincs megoldhatatlan ügy, csak kevés kitartás.",
  "A közbiztonság közös ügyünk.",
  "Légy példakép, ne csak rendőr."
];

const RADIO_CODES = [
  {code: "10-4", desc: "Vettem / Értettem"},
  {code: "10-20", desc: "Pozíció / Helyszín"},
  {code: "10-3", desc: "Rádiócsend"},
  {code: "10-6", desc: "Elfoglalt / Nem elérhető"},
  {code: "10-7", desc: "Szolgálaton kívül"},
  {code: "10-8", desc: "Szolgálatban / Elérhető"},
  {code: "10-27", desc: "Igazoltatás / Adatlekérdezés"},
  {code: "10-32", desc: "Erősítést kérek (Sürgős)"},
  {code: "10-38", desc: "Igazoltatás (Járműmegállítás)"},
  {code: "10-50", desc: "Baleset történt"},
  {code: "10-70", desc: "Tűzeset"},
  {code: "10-80", desc: "Üldözés folyamatban"},
  {code: "CODE 0", desc: "Sürgős segítség! (Minden egység)"},
  {code: "CODE 4", desc: "Helyzet megoldva / Tiszta"},
];

// --- STATIKUS HÁTTÉR ---
const StaticBackground = () => (
  <div className="fixed inset-0 pointer-events-none z-[-1] bg-[#02040a]">
    <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f1c] via-[#02040a] to-black"></div>
    {/* Halvány rács */}
    <div className="absolute inset-0 opacity-10" style={{
      backgroundImage: `linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)`,
      backgroundSize: '40px 40px'
    }}></div>
    <div className="absolute inset-0 bg-radial-gradient from-transparent via-[#02040a]/40 to-[#02040a]"></div>
  </div>
);

// --- HUD PANEL ---
const HudPanel = ({
                    children, className = "", title, icon: Icon, action, themeColor, glow = false
                  }: {
  children: React.ReactNode,
  className?: string,
  title?: string,
  icon?: any,
  action?: React.ReactNode,
  themeColor: string,
  glow?: boolean
}) => (
  <div
    className={`relative flex flex-col bg-[#0a0f1c]/70 backdrop-blur-md border border-white/10 shadow-xl overflow-hidden rounded-sm transition-all duration-500 hover:border-white/20 ${className}`}
    style={{boxShadow: glow ? `0 0 20px -10px ${themeColor}10` : 'none'}}
  >
    {/* Sarok jelölők */}
    <div className="absolute top-0 left-0 w-2 h-2 border-l-2 border-t-2 opacity-30 pointer-events-none"
         style={{borderColor: themeColor}}></div>
    <div className="absolute top-0 right-0 w-2 h-2 border-r-2 border-t-2 opacity-30 pointer-events-none"
         style={{borderColor: themeColor}}></div>
    <div className="absolute bottom-0 left-0 w-2 h-2 border-l-2 border-b-2 opacity-30 pointer-events-none"
         style={{borderColor: themeColor}}></div>
    <div className="absolute bottom-0 right-0 w-2 h-2 border-r-2 border-b-2 opacity-30 pointer-events-none"
         style={{borderColor: themeColor}}></div>

    {/* Header */}
    {title && (
      <div
        className="relative px-4 py-3 border-b border-white/5 bg-white/[0.02] flex items-center justify-between shrink-0 z-10 min-h-[44px]">
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded border border-white/5 bg-${themeColor}/5`}>
            {Icon && <Icon className="w-3.5 h-3.5 transition-colors duration-500" style={{color: themeColor}}/>}
          </div>
          <span
            className="text-xs font-black uppercase tracking-[0.2em] text-slate-200 font-mono shadow-black drop-shadow-md">{title}</span>
        </div>
        {action}
      </div>
    )}

    {/* Tartalom (Flex-1 kitölti a teret, min-h-0 engedi a scrollt) */}
    <div className="flex-1 min-h-0 relative z-10 flex flex-col">
      {children}
    </div>
  </div>
);

// --- ÚJ HÍR DIALOG ---
function NewAnnouncementDialog({open, onOpenChange, onSuccess}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSuccess: () => void
}) {
  const {supabase, user} = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [formData, setFormData] = React.useState({title: "", content: "", type: "info", is_pinned: false});

  const handleSubmit = async () => {
    if (!formData.title || !formData.content) return toast.error("Minden mező kötelező!");
    setLoading(true);
    try {
      const {error} = await supabase.from('announcements').insert({
        title: formData.title,
        content: formData.content,
        type: formData.type as any,
        is_pinned: formData.is_pinned,
        created_by: user?.id
      });
      if (error) throw error;
      toast.success("Hír közzétéve!");
      setFormData({title: "", content: "", type: "info", is_pinned: false});
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error("Hiba történt.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0f172a]/95 border-slate-700 text-white sm:max-w-lg backdrop-blur-xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-yellow-500 font-black uppercase tracking-widest text-lg flex items-center gap-2">
            <Megaphone className="w-5 h-5"/> Új Közlemény
          </DialogTitle>
          <DialogDescription className="text-slate-400 font-mono text-xs">A hír azonnal megjelenik az állomány
            számára.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase font-bold text-slate-500 tracking-wider">Cím / Tárgy</Label>
            <Input placeholder="PL. RENDKÍVÜLI ÉRTEKEZLET..." value={formData.title}
                   onChange={e => setFormData({...formData, title: e.target.value})}
                   className="bg-black/40 border-slate-700 font-bold text-white focus:border-yellow-500/50"/>
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase font-bold text-slate-500 tracking-wider">Prioritás</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  id: 'info',
                  label: 'INFORMÁCIÓ',
                  color: 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20'
                },
                {
                  id: 'training',
                  label: 'KÉPZÉS',
                  color: 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20'
                },
                {
                  id: 'alert',
                  label: 'RIASZTÁS',
                  color: 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20 animate-pulse'
                },
              ].map(t => (
                <button key={t.id} onClick={() => setFormData({...formData, type: t.id})}
                        className={`py-3 rounded border text-xs font-black tracking-widest transition-all ${formData.type === t.id ? t.color.replace('hover:', '') + ' ring-1 ring-current' : 'border-slate-800 text-slate-600 bg-black/40 hover:bg-slate-900'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase font-bold text-slate-500 tracking-wider">Tartalom</Label>
            <Textarea placeholder="Üzenet szövege..." value={formData.content}
                      onChange={e => setFormData({...formData, content: e.target.value})}
                      className="bg-black/40 border-slate-700 h-32 resize-none focus:border-yellow-500/50 font-mono text-sm leading-relaxed"/>
          </div>
          <div className="flex items-center gap-3 p-3 rounded bg-yellow-500/5 border border-yellow-500/10">
            <input type="checkbox" id="pinned" checked={formData.is_pinned}
                   onChange={e => setFormData({...formData, is_pinned: e.target.checked})}
                   className="w-4 h-4 rounded border-slate-700 bg-slate-900 accent-yellow-500"/>
            <Label htmlFor="pinned" className="cursor-pointer text-xs uppercase font-bold text-yellow-500/80">Kiemelt
              üzenet (Pin)</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}
                  className="text-slate-400 hover:text-white">MÉGSE</Button>
          <Button onClick={handleSubmit} disabled={loading}
                  className="bg-yellow-600 hover:bg-yellow-500 text-black font-black uppercase tracking-wider">KÖZZÉTÉTEL</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- FŐ DASHBOARD COMPONENT ---
export function DashboardPage() {
  const {profile, signOut, supabase} = useAuth();
  const {alertLevel, setAlertLevel} = useSystemStatus();
  const navigate = useNavigate();

  const currentTheme = ALERT_LEVELS[alertLevel] || ALERT_LEVELS.normal;
  const isLeader = profile?.system_role === 'admin' || profile?.system_role === 'supervisor';

  // --- STATE ---
  const [currentTime, setCurrentTime] = React.useState(new Date());
  const [stats, setStats] = React.useState({pendingVehicles: 0, pendingBudget: 0, activeOfficers: 0, openCases: 0});
  const [recentActions, setRecentActions] = React.useState<any[]>([]);
  const [announcements, setAnnouncements] = React.useState<any[]>([]);
  const [isLoadingStats, setIsLoadingStats] = React.useState(true);
  const [isNewsDialogOpen, setIsNewsDialogOpen] = React.useState(false);
  const [deleteAlertOpen, setDeleteAlertOpen] = React.useState(false);
  const [selectedNewsId, setSelectedNewsId] = React.useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);

  const [dailyQuote, setDailyQuote] = React.useState("");

  // --- HANDLERS ---
  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleStatusChange = async (newLevel: string) => {
    await setAlertLevel(newLevel as AlertLevelId);
    toast.success(`Státusz módosítva: ${ALERT_LEVELS[newLevel as AlertLevelId].label}`);
  };

  const handleDeleteNews = async () => {
    if (!selectedNewsId) return;
    await supabase.from('announcements').delete().eq('id', selectedNewsId);
    toast.success("Hír törölve.");
    setAnnouncements(prev => prev.filter(n => n.id !== selectedNewsId));
    setDeleteAlertOpen(false);
  };

  const confirmDelete = (id: string) => {
    setSelectedNewsId(id);
    setDeleteAlertOpen(true);
  };

  // --- EFFECTS ---
  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    setDailyQuote(MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]);
    return () => clearInterval(timer);
  }, []);

  const fetchNews = async () => {
    const {data} = await supabase.from('announcements').select('*, profiles:created_by(full_name, faction_rank)').order('is_pinned', {ascending: false}).order('created_at', {ascending: false}).limit(20);
    if (data) {
      setAnnouncements(data);
      if (data.length > 0) setLastUpdated(new Date(data[0].created_at));
    }
  };

  React.useEffect(() => {
    const fetchdata = async () => {
      try {
        const [vehicles, budget, officers, cases] = await Promise.all([
          supabase.from('vehicle_requests').select('id', {count: 'exact', head: true}).eq('status', 'pending'),
          supabase.from('budget_requests').select('id', {count: 'exact', head: true}).eq('status', 'pending'),
          supabase.from('profiles').select('id', {count: 'exact', head: true}).neq('system_role', 'pending'),
          supabase.from('cases').select('id', {count: 'exact', head: true}).eq('status', 'open'),
        ]);
        setStats({
          pendingVehicles: vehicles.count || 0,
          pendingBudget: budget.count || 0,
          activeOfficers: officers.count || 0,
          openCases: cases.count || 0
        });
        const {data: actions} = await supabase.from('action_logs').select('*, profiles(full_name, badge_number)').order('created_at', {ascending: false}).limit(20);
        if (actions) setRecentActions(actions);
        await fetchNews();
      } finally {
        setIsLoadingStats(false);
      }
    };
    fetchdata();

    const channel = supabase.channel('dashboard_v9')
      .on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'action_logs'}, (payload) => {
        // Frissítés (opcionális)
      })
      .on('postgres_changes', {event: '*', schema: 'public', table: 'announcements'}, () => fetchNews())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const renderAuthor = (news: any) => {
    if (!news.profiles) return <span className="text-slate-500 font-mono text-[10px]">SYSTEM</span>;
    const rank = news.profiles.faction_rank;
    let badgeClass = "text-slate-400 bg-slate-800";
    if (EXECUTIVE_RANKS.includes(rank)) badgeClass = "text-red-400 bg-red-950/40 border-red-900/50";
    else if (SUPERVISORY_RANKS.includes(rank)) badgeClass = "text-green-400 bg-green-950/40 border-green-900/50";
    else badgeClass = "text-yellow-500 bg-yellow-950/40 border-yellow-900/50";

    return <span
      className={`font-bold text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/5 ${badgeClass}`}>{rank}</span>;
  }

  // --- RENDER (NO SCROLL LAYOUT) ---
  return (
    // h-screen és overflow-hidden: Nincs ablakszintű görgetés.
    <div
      className="h-screen w-full text-slate-200 animate-in fade-in duration-700 flex flex-col overflow-hidden bg-[#02040a]">

      {/* STATIKUS HÁTTÉR */}
      <StaticBackground/>

      <NewAnnouncementDialog open={isNewsDialogOpen} onOpenChange={setIsNewsDialogOpen} onSuccess={fetchNews}/>
      <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent
          className="bg-slate-900 border-red-900/50 text-white"><AlertDialogHeader><AlertDialogTitle>Törlés</AlertDialogTitle><AlertDialogDescription>Biztosan?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel
          className="bg-slate-800">Mégse</AlertDialogCancel><AlertDialogAction onClick={handleDeleteNews}
                                                                               className="bg-red-600">Törlés</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      {/* === HEADER (Nem sticky, fix helyen) === */}
      <div
        className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 p-5 bg-[#0a0f1c]/80 backdrop-blur-md border-b border-white/10 shadow-lg shrink-0 mx-6 mt-4 rounded-sm mb-6">

        <div className="flex items-center gap-5">
          <div className="relative group">
            <div
              className="absolute inset-0 bg-current blur-lg opacity-20 group-hover:opacity-40 transition-opacity rounded-full"
              style={{color: currentTheme.color}}></div>
            <div className="relative p-2 bg-black/40 border border-white/10 rounded-lg backdrop-blur-sm">
              <ShieldAlert className="w-8 h-8 transition-colors duration-500" style={{color: currentTheme.color}}/>
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tighter leading-none font-mono drop-shadow-md">
              COMMAND <span style={{color: currentTheme.color}} className="transition-colors duration-500">CENTER</span>
            </h1>
            <div className="flex items-center gap-2 mt-1.5 opacity-90">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-sm uppercase tracking-[0.2em] text-slate-300 font-bold text-shadow">
                    {profile?.badge_number} • {profile?.faction_rank}
                  </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Weather */}
          <div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-black/20 border border-white/5 rounded">
            <CloudSun className="w-5 h-5 text-yellow-500"/>
            <div className="flex flex-col leading-none text-right">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">San Fierro</span>
              <span className="text-sm font-mono font-bold text-white tracking-widest">18°C CLR</span>
            </div>
          </div>

          {/* Time */}
          <div
            className="hidden md:flex items-center gap-3 px-4 py-2 bg-black/20 border border-white/10 rounded shadow-inner">
            <Clock className="w-5 h-5 text-slate-400"/>
            <span className="text-2xl font-mono font-bold text-white tracking-widest leading-none">
                    {currentTime.toLocaleTimeString('hu-HU', {hour: '2-digit', minute: '2-digit'})}
                </span>
          </div>

          {/* Status */}
          {isLeader ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-3 px-5 py-3 bg-black/40 border transition-all rounded-sm hover:bg-black/60 group min-w-[220px]"
                  style={{borderColor: `${currentTheme.color}60`}}>
                  <currentTheme.icon className="w-5 h-5 animate-pulse transition-colors duration-500"
                                     style={{color: currentTheme.color}}/>
                  <div className="text-left flex-1">
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Rendszer Státusz
                    </div>
                    <div
                      className="text-sm font-black uppercase tracking-wide leading-none text-white shadow-current drop-shadow-sm transition-colors duration-500"
                      style={{color: currentTheme.color}}>
                      {currentTheme.label}
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-500"/>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[#0a0f1c] border-slate-700 min-w-[220px] p-1 shadow-2xl">
                {Object.entries(ALERT_LEVELS).map(([key, val]) => (
                  <DropdownMenuItem key={key} onClick={() => handleStatusChange(key)}
                                    className="text-slate-300 focus:text-white cursor-pointer gap-2 focus:bg-white/5 py-2">
                    <val.icon className="w-4 h-4" style={{color: val.color}}/>
                    <span className="uppercase font-bold text-xs tracking-wide"
                          style={{color: val.color}}>{val.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div
              className="flex items-center gap-3 px-5 py-3 bg-black/40 border border-white/10 rounded-sm min-w-[220px]">
              <currentTheme.icon className="w-5 h-5 animate-pulse" style={{color: currentTheme.color}}/>
              <div className="text-left">
                <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Jelenlegi Státusz</div>
                <div className="text-sm font-black uppercase tracking-wide leading-none text-white"
                     style={{color: currentTheme.color}}>{currentTheme.label}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* === CONTENT GRID (FLEX-1 kitölti a maradék helyet) === */}
      <div className="flex-1 px-6 pb-6 min-h-0 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">

          {/* --- BAL OSZLOP (3/4 szélesség) --- */}
          <div className="lg:col-span-3 flex flex-col gap-6 h-full min-h-0">

            {/* 1. STATISZTIKÁK (Fix magasság) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
              {[
                {title: "AKTÍV EGYSÉG", val: stats.activeOfficers, icon: Users, color: "text-blue-400"},
                {title: "NYITOTT AKTA", val: stats.openCases, icon: Briefcase, color: "text-yellow-400"},
                {title: "JÁRMŰ IGÉNY", val: stats.pendingVehicles, icon: Truck, color: "text-orange-400"},
                {title: "PÉNZÜGY", val: stats.pendingBudget, icon: Banknote, color: "text-green-400"},
              ].map((s, i) => (
                <div key={i}
                     className={`relative bg-[#050a14]/60 backdrop-blur-sm border border-white/10 p-5 overflow-hidden group hover:border-white/30 transition-all rounded-sm shadow-lg`}>
                  <div className="flex justify-between items-start mb-3 relative z-10">
                    <s.icon className={`w-7 h-7 opacity-80 ${s.color}`}/>
                    <div
                      className={`text-4xl font-black text-white font-mono leading-none drop-shadow-md`}>{isLoadingStats ? '-' : s.val}</div>
                  </div>
                  <div
                    className="text-xs uppercase tracking-wider font-bold text-slate-400 relative z-10">{s.title}</div>
                  <div
                    className={`absolute -bottom-6 -right-6 w-24 h-24 bg-current opacity-[0.04] blur-2xl rounded-full ${s.color}`}></div>
                </div>
              ))}
            </div>

            {/* 2. RENDSZER ELÉRÉS (GYORSGOMBOK) - Fix magasság */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
              {[
                {
                  title: "NYOMOZÓ IRODA",
                  sub: "MCB ADATBÁZIS & AKTÁK",
                  icon: Search,
                  path: "/mcb",
                  color: "text-blue-400"
                },
                {
                  title: "LOGISZTIKA",
                  sub: "JÁRMŰ ÉS FEGYVERZET",
                  icon: Layers,
                  path: "/logistics",
                  color: "text-orange-400"
                },
                {
                  title: "BTK. KALKULÁTOR",
                  sub: "BÜNTETÉS VÉGREHAJTÁS",
                  icon: Gavel,
                  path: "/calculator",
                  color: "text-purple-400"
                },
              ].map((sys, i) => (
                <div key={i} onClick={() => navigate(sys.path)}
                     className={`group cursor-pointer relative bg-[#0a0f1c]/60 border border-white/10 p-5 transition-all hover:bg-white/5 hover:border-white/20 flex items-center gap-5 rounded-sm shadow-lg`}>
                  <div
                    className={`p-3 rounded bg-black/40 border border-white/5 ${sys.color} group-hover:scale-110 transition-transform`}>
                    <sys.icon className="w-6 h-6"/>
                  </div>
                  <div className="flex-1">
                    <h3
                      className="text-lg font-black text-white tracking-tight group-hover:text-yellow-500 transition-colors">{sys.title}</h3>
                    <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">{sys.sub}</p>
                  </div>
                  <ChevronDown
                    className="w-5 h-5 text-slate-600 -rotate-90 group-hover:translate-x-1 transition-transform"/>
                </div>
              ))}
            </div>

            {/* 3. MEGOSZTOTT ALSÓ SÁV: ÉLŐ NAPLÓ + RÁDIÓ KÓDOK */}
            <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* ÉLŐ ESEMÉNYNAPLÓ (2/3 szélesség) */}
              <HudPanel title="ÉLŐ ESEMÉNYNAPLÓ" icon={Radio} themeColor={currentTheme.color}
                        className="md:col-span-2 h-full">
                <ScrollArea className="h-full">
                  <div className="flex flex-col">
                    {recentActions.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-40 text-slate-600">
                        <Activity className="w-10 h-10 mb-3 opacity-20"/>
                        <span className="text-sm font-mono uppercase tracking-widest">Nincs rögzített esemény</span>
                      </div>
                    ) : (
                      recentActions.map((action, i) => (
                        <div key={action.id}
                             className={`flex items-start gap-4 p-4 border-b border-white/5 hover:bg-white/[0.05] transition-colors group`}>
                          <div className="w-14 text-xs font-mono text-slate-500 pt-1 shrink-0 text-right">
                            {new Date(action.created_at).toLocaleTimeString('hu-HU', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>

                          <div className="flex flex-col items-center shrink-0 pt-2">
                            <div
                              className={`w-2 h-2 rounded-full ${action.action_type === 'arrest' ? 'bg-red-500' : 'bg-blue-500'} shadow-[0_0_8px_currentColor]`}></div>
                          </div>

                          <div className="flex-1 min-w-0 pb-1">
                            <div className="flex justify-between items-start mb-1">
                              <div className="flex items-center gap-2">
                                                        <span
                                                          className="text-xs font-black text-slate-300 font-mono bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                                                            {action.profiles?.badge_number}
                                                        </span>
                                <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                                                            {action.profiles?.full_name}
                                                        </span>
                              </div>
                              <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                action.action_type === 'arrest' ? 'bg-red-950/40 text-red-500 border border-red-900/50' : 'bg-blue-950/40 text-blue-500 border border-blue-900/50'
                              }`}>
                                                        {action.action_type === 'arrest' ? 'LETARTÓZTATÁS' : 'BÍRSÁG'}
                                                    </span>
                            </div>
                            <p
                              className="text-sm text-slate-400 font-mono leading-relaxed opacity-90 group-hover:opacity-100 transition-opacity">
                              {action.details}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </HudPanel>

              {/* RÁDIÓ KÓDOK GYORSTÁR (1/3 szélesség) */}
              <HudPanel title="RÁDIÓ KÓDOK" icon={Signal} themeColor="#3b82f6" className="h-full">
                <ScrollArea className="h-full">
                  <div className="p-2 space-y-1">
                    {RADIO_CODES.map((rc, i) => (
                      <div key={i}
                           className="flex items-center gap-3 p-2 hover:bg-white/5 rounded transition-colors group cursor-help">
                        <span
                          className="text-xs font-black text-blue-400 font-mono min-w-[45px] group-hover:text-blue-300">{rc.code}</span>
                        <span
                          className="text-[10px] uppercase font-bold text-slate-400 group-hover:text-white">{rc.desc}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </HudPanel>

            </div>

          </div>

          {/* --- JOBB OSZLOP (1/4) --- */}
          <div className="lg:col-span-1 flex flex-col gap-6 h-full min-h-0">

            {/* 1. HIRDETŐTÁBLA (Flex-1 kitölti a helyet) */}
            <HudPanel
              title="HIRDETŐTÁBLA"
              icon={FileBarChart}
              themeColor={currentTheme.color}
              className="flex-1 min-h-0"
              glow={true}
              action={isLeader && (
                <button onClick={() => setIsNewsDialogOpen(true)}
                        className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                        title="Új hír">
                  <Plus className="w-4 h-4"/>
                </button>
              )}
            >
              <ScrollArea className="h-full">
                <div className="p-4 space-y-4">
                  {announcements.length === 0 ? (
                    <div className="text-center py-20 opacity-30">
                      <Megaphone className="w-10 h-10 mx-auto mb-4"/>
                      <span className="text-xs font-mono uppercase tracking-widest">Nincsenek aktív hírek</span>
                    </div>
                  ) : (
                    announcements.map(news => (
                      <div key={news.id}
                           className={`group relative p-4 border-l-2 bg-gradient-to-r from-white/[0.03] to-transparent hover:from-white/[0.07] transition-all ${
                             news.type === 'alert' ? 'border-l-red-500' : news.type === 'training' ? 'border-l-blue-500' : 'border-l-yellow-500'
                           }`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            {news.is_pinned && <Pin className="w-3.5 h-3.5 text-yellow-500 rotate-45"/>}
                            <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              news.type === 'alert' ? 'bg-red-950/50 text-red-500' : news.type === 'training' ? 'bg-blue-950/50 text-blue-500' : 'bg-yellow-950/50 text-yellow-500'
                            }`}>
                                                    {news.type === 'alert' ? 'RIASZTÁS' : news.type === 'training' ? 'KÉPZÉS' : 'INFO'}
                                                </span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono font-bold">
                                                {formatDistanceToNow(new Date(news.created_at), {
                                                  addSuffix: true,
                                                  locale: hu
                                                })}
                                            </span>
                        </div>

                        <h4 className="text-sm font-bold text-white mb-2 leading-snug">{news.title}</h4>
                        <p
                          className="text-xs text-slate-400 leading-relaxed font-mono opacity-80 whitespace-pre-wrap line-clamp-6 group-hover:line-clamp-none transition-all">
                          {news.content}
                        </p>

                        <div className="mt-3 pt-3 border-t border-white/5 flex justify-between items-center">
                          {renderAuthor(news)}
                          {isLeader && (
                            <button onClick={() => confirmDelete(news.id)}
                                    className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-500 transition-all">
                              <Trash2 className="w-3.5 h-3.5"/>
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
              <div
                className="absolute bottom-0 w-full bg-[#0a0f1c]/90 border-t border-white/5 py-1.5 text-center backdrop-blur-md">
                <div
                  className="flex items-center justify-center gap-2 text-[9px] text-slate-500 font-mono uppercase tracking-widest font-bold">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                  SYNC: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "IDLE"}
                </div>
              </div>
            </HudPanel>

            {/* 2. NAPI ELIGAZÍTÁS */}
            <div className="relative p-5 bg-[#0a0f1c]/60 border border-white/10 rounded-sm shadow-lg shrink-0">
              <div className="absolute top-0 left-0 w-1 h-full bg-yellow-500/50"></div>
              <div className="flex items-start gap-4">
                <Quote className="w-8 h-8 text-yellow-500 opacity-30 shrink-0"/>
                <div>
                  <div className="text-[10px] uppercase font-black text-slate-500 tracking-widest mb-2">Napi
                    Eligazítás
                  </div>
                  <p className="text-sm text-white font-medium italic leading-relaxed">
                    "{dailyQuote}"
                  </p>
                </div>
              </div>
            </div>

            {/* 3. PROFIL & LOGOUT */}
            <div className="grid grid-cols-2 gap-3 shrink-0">
              <button onClick={() => navigate('/profile')}
                      className="flex flex-col items-center justify-center p-3 bg-[#0a0f1c]/60 border border-white/10 hover:border-yellow-500/30 hover:bg-white/5 transition-all group shadow-lg rounded-sm">
                <User className="w-5 h-5 text-slate-400 group-hover:text-white mb-1"/>
                <span
                  className="text-[10px] font-bold uppercase tracking-widest text-slate-500 group-hover:text-white">Profil</span>
              </button>
              <button onClick={handleLogout}
                      className="flex flex-col items-center justify-center p-3 bg-red-950/20 border border-red-900/30 hover:bg-red-900/40 hover:border-red-500/50 transition-all group shadow-lg rounded-sm">
                <Power className="w-5 h-5 text-red-500/70 group-hover:text-red-500 mb-1"/>
                <span
                  className="text-[10px] font-bold uppercase tracking-widest text-red-500/70 group-hover:text-red-500">Kilépés</span>
              </button>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}