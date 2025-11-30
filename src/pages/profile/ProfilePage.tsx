import * as React from "react";
import {useAuth} from "@/context/AuthContext";
import {useSystemStatus} from "@/context/SystemStatusContext";
import {Card, CardContent, CardHeader, CardTitle, CardDescription} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {Badge} from "@/components/ui/badge";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {ScrollArea} from "@/components/ui/scroll-area";
import {toast} from "sonner";
import {
  Key, Save, Loader2, Star, Briefcase, Calendar, Crown, Award,
  Shield, UserCog, Medal, PlusCircle, Sparkles, Fingerprint,
  Activity, ScanLine, QrCode, Bell, Check, Radio, AlertTriangle, Siren, FileText, Zap
} from "lucide-react";
import {getDepartmentLabel, isExecutive} from "@/lib/utils";
import {GiveAwardDialog} from "./components/GiveAwardDialog";
import {formatDistanceToNow} from "date-fns";
import {hu} from "date-fns/locale";
import {SheriffBackground} from "@/components/SheriffBackground";
import {cn} from "@/lib/utils";

// --- TURBO COUNTER ---
const TurboCounter = ({value}: { value: number }) => {
  const [count, setCount] = React.useState(0);
  React.useEffect(() => {
    let start = 0;
    const end = value;
    if (start === end) return;
    const duration = 1500;
    const startTime = performance.now();
    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(Math.floor(ease * end));
      if (progress < 1) requestAnimationFrame(step); else setCount(end);
    };
    requestAnimationFrame(step);
  }, [value]);
  return <>{count}</>;
};

// --- 3D TILT CARD ---
const TiltCard = ({children, className}: { children: React.ReactNode, className?: string }) => {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const shineRef = React.useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || !shineRef.current || window.innerWidth < 1024) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -3;
    const rotateY = ((x - centerX) / centerX) * 3;

    cardRef.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.01)`;
    shineRef.current.style.background = `radial-gradient(circle at ${(x / rect.width) * 100}% ${(y / rect.height) * 100}%, rgba(255,255,255,0.1), transparent 60%)`;
  };

  const handleMouseLeave = () => {
    if (!cardRef.current || !shineRef.current) return;
    cardRef.current.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)`;
    shineRef.current.style.background = 'transparent';
  };

  return (
    <div ref={cardRef}
         className={`relative transition-transform duration-300 ease-out will-change-transform ${className}`}
         onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <div ref={shineRef}
           className="absolute inset-0 pointer-events-none z-20 mix-blend-overlay transition-all duration-300 rounded-xl"/>
      {children}
    </div>
  );
};

// --- FINGERPRINT SCANNER ---
const FingerprintScanner = ({colorClass, profile}: { colorClass: string, profile: any }) => (
  <div
    className="w-full h-full bg-black/80 flex flex-col items-center justify-center relative overflow-hidden border border-white/10 rounded-md group cursor-pointer shadow-inner">
    <div
      className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:10px_10px]"></div>

    {/* Default: Ujjlenyomat */}
    <div
      className="absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-300 group-hover:opacity-0">
      <Fingerprint className={`w-24 h-24 ${colorClass} opacity-80 z-10 animate-pulse`}/>
      <div
        className="absolute inset-x-0 h-0.5 bg-white/50 shadow-[0_0_15px_rgba(255,255,255,0.8)] z-20 animate-[scan-vertical_2.5s_ease-in-out_infinite]"></div>
      <div
        className="absolute bottom-3 text-[8px] uppercase tracking-widest text-slate-400 font-mono z-10 bg-black/90 px-2 py-0.5 rounded border border-white/10">
        BIOMETRIC ID
      </div>
    </div>

    {/* Hover: Profilkép */}
    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-slate-900">
      <Avatar className="w-full h-full rounded-none">
        <AvatarImage src={profile.avatar_url} className="object-cover"/>
        <AvatarFallback
          className="bg-slate-800 text-slate-500 font-bold text-4xl">{profile.full_name.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="absolute inset-0 bg-green-500/10 mix-blend-overlay pointer-events-none"></div>
      <div className="absolute bottom-0 w-full bg-black/80 text-center py-1 border-t border-green-500/30">
        <span
          className="text-[9px] text-green-400 font-mono font-bold tracking-widest animate-pulse">ACCESS GRANTED</span>
      </div>
    </div>
  </div>
);

// --- SYSTEM MONITOR ---
const SystemMonitor = ({alertLevel}: { alertLevel: string }) => {
  const getLevelInfo = () => {
    switch (alertLevel) {
      case 'tactical':
        return {
          label: 'KIEMELT RIADÓ',
          color: 'text-red-500',
          border: 'border-red-500',
          bg: 'bg-red-950/20',
          glow: 'shadow-red-500/20',
          icon: Siren
        };
      case 'border':
        return {
          label: 'HATÁRZÁR',
          color: 'text-orange-500',
          border: 'border-orange-500',
          bg: 'bg-orange-950/20',
          glow: 'shadow-orange-500/20',
          icon: AlertTriangle
        };
      case 'traffic':
        return {
          label: 'FOKOZOTT ELLENŐRZÉS',
          color: 'text-yellow-500',
          border: 'border-yellow-500',
          bg: 'bg-yellow-950/20',
          glow: 'shadow-yellow-500/20',
          icon: Activity
        };
      default:
        return {
          label: 'NORMÁL ÜGYMENET',
          color: 'text-green-500',
          border: 'border-green-500',
          bg: 'bg-green-950/20',
          glow: 'shadow-green-500/20',
          icon: Shield
        };
    }
  }
  const info = getLevelInfo();
  const Icon = info.icon;

  return (
    <div
      className={`relative overflow-hidden rounded-xl border ${info.border} ${info.bg} p-6 flex items-center justify-between shadow-lg ${info.glow} group cursor-default transition-all hover:scale-[1.01]`}>
      <div
        className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-10 pointer-events-none"></div>
      <div
        className={`absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-gradient-to-t from-transparent via-${info.color.split('-')[1]}-500/10 to-transparent rotate-45 translate-y-full group-hover:animate-[scan-down_2s_linear_infinite] pointer-events-none`}></div>

      <div className="flex items-center gap-5 z-10">
        <div className={`p-4 rounded-full border-2 ${info.border} bg-black/60 ${info.color} relative overflow-hidden`}>
          <Icon className="w-8 h-8 relative z-10"/>
          <div className={`absolute inset-0 ${info.bg} animate-ping opacity-50`}></div>
        </div>
        <div>
          <div className="text-[10px] text-slate-400 uppercase font-bold tracking-[0.2em] mb-1">Rendszer Státusz</div>
          <div className={`text-3xl font-black italic tracking-tighter ${info.color} drop-shadow-md`}>{info.label}</div>
        </div>
      </div>
      <div className="text-right z-10 hidden sm:block">
        <div className="text-[9px] text-slate-500 font-mono mb-1">DEFCON</div>
        <div
          className="text-2xl font-mono font-bold text-white">{alertLevel === 'tactical' ? '1' : alertLevel === 'border' ? '2' : alertLevel === 'traffic' ? '3' : '4'}</div>
      </div>
    </div>
  );
}

// --- NOTIFICATION FEED ---
const NotificationFeed = ({notifications, markRead}: { notifications: any[], markRead: (id: string) => void }) => (
  <Card
    className="bg-[#0b1221] border border-slate-800 h-[320px] flex flex-col shadow-lg relative overflow-hidden group">
    <div
      className="absolute inset-0 bg-gradient-to-b from-blue-900/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"/>
    <CardHeader className="pb-3 border-b border-slate-800/50 bg-slate-950/50">
      <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
        <Bell className="w-4 h-4 text-yellow-500"/> Kommunikációs Csatorna
      </CardTitle>
    </CardHeader>
    <div className="flex-1 min-h-0 relative">
      <ScrollArea className="h-full">
        <div className="p-0">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-600 opacity-50">
              <Radio className="w-8 h-8 mb-2"/>
              <p className="text-[10px] font-mono uppercase">NINCS ÚJ ÜZENET</p>
            </div>
          ) : notifications.map((notif) => (
            <div key={notif.id}
                 className="p-4 border-b border-slate-800/50 hover:bg-slate-900/50 transition-colors relative group/item">
              <div className="flex justify-between items-start mb-1">
                      <span
                        className={cn("text-xs font-bold uppercase", notif.type === 'alert' ? "text-red-400" : notif.type === 'success' ? "text-green-400" : "text-blue-400")}>
                         {notif.title}
                      </span>
                <span className="text-[9px] text-slate-600 font-mono">{formatDistanceToNow(new Date(notif.created_at), {
                  locale: hu,
                  addSuffix: true
                })}</span>
              </div>
              <p className="text-sm text-slate-300 leading-snug pr-8">{notif.message}</p>
              {!notif.is_read && (
                <Button size="icon" variant="ghost" onClick={() => markRead(notif.id)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 text-slate-600 hover:text-green-500 opacity-0 group-hover/item:opacity-100 transition-all">
                  <Check className="w-3 h-3"/>
                </Button>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  </Card>
);

export function ProfilePage() {
  const {profile, supabase} = useAuth();
  const {alertLevel} = useSystemStatus();

  const [isUpdating, setIsUpdating] = React.useState(false);
  const [stats, setStats] = React.useState({serviceDays: 0, closedCases: 0});
  const [ribbons, setRibbons] = React.useState<any[]>([]);
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [recentActivity, setRecentActivity] = React.useState<any[]>([]);
  const [isAwardDialogOpen, setIsAwardDialogOpen] = React.useState(false);

  const [newName, setNewName] = React.useState(profile?.full_name || "");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  const greeting = React.useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 6) return "Jó éjszakát";
    if (hour < 10) return "Jó reggelt";
    if (hour < 18) return "Szép napot";
    return "Jó estét";
  }, []);

  const loadData = React.useCallback(async () => {
    if (!profile) return;
    const start = new Date(profile.created_at);
    const diffDays = Math.ceil(Math.abs(new Date().getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const {count} = await supabase.from('cases').select('id', {
      count: 'exact',
      head: true
    }).eq('owner_id', profile.id).eq('status', 'closed');
    const {data: userRibbons} = await supabase.from('user_ribbons').select(`awarded_at, ribbons (id, name, description, color_hex, image_url)`).eq('user_id', profile.id);
    const {data: notifs} = await supabase.from('notifications').select('*').eq('user_id', profile.id).order('created_at', {ascending: false}).limit(10);
    const {data: activities} = await supabase.from('cases').select('id, title, updated_at, status').eq('owner_id', profile.id).order('updated_at', {ascending: false}).limit(5);

    setRibbons(userRibbons?.map((ur: any) => ({...ur.ribbons, awarded_at: ur.awarded_at})) || []);
    setNotifications(notifs || []);
    setRecentActivity(activities || []);
    setStats({serviceDays: diffDays, closedCases: count || 0});
  }, [profile, supabase]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);
  const markRead = async (id: string) => {
    await supabase.from('notifications').update({is_read: true}).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? {...n, is_read: true} : n));
  };
  const handleNameChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return toast.error("A név nem lehet üres.");
    setIsUpdating(true);
    try {
      const {error} = await supabase.rpc('change_user_name', {_new_name: newName});
      if (error) throw error;
      toast.success("Név frissítve!");
      window.location.reload();
    } catch (e: any) {
      toast.error("Hiba: " + e.message);
    } finally {
      setIsUpdating(false);
    }
  };
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return toast.error("A jelszavak nem egyeznek!");
    setIsUpdating(true);
    const {error} = await supabase.auth.updateUser({password: newPassword});
    setIsUpdating(false);
    if (error) toast.error("Hiba: " + error.message); else {
      toast.success("Jelszó módosítva!");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  if (!profile) return null;
  const isCommandStaff = ['Captain', 'Lieutenant', 'Commander', 'Deputy'].some(r => profile.faction_rank.includes(r));
  const showAwardButton = isExecutive(profile);
  const isVeteran = stats.serviceDays > 365;

  const getTheme = () => {
    if (profile.is_bureau_manager) return {
      bg: 'bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#312e81]',
      border: 'border-purple-500/50',
      shadow: 'shadow-purple-900/20',
      text: 'text-purple-400',
      scanColor: 'text-purple-500'
    };
    if (profile.division === 'SEB') return {
      bg: 'bg-gradient-to-br from-[#0f172a] via-[#1a0505] to-black',
      border: 'border-red-600/50',
      shadow: 'shadow-red-900/20',
      text: 'text-red-500',
      scanColor: 'text-red-500',
      logo: '/seb.png'
    };
    if (profile.division === 'MCB') return {
      bg: 'bg-gradient-to-br from-[#0f172a] via-[#050f1a] to-black',
      border: 'border-blue-500/50',
      shadow: 'shadow-blue-900/20',
      text: 'text-blue-400',
      scanColor: 'text-blue-400',
      logo: '/mcb.png'
    };
    return {
      bg: 'bg-gradient-to-br from-[#0f172a] via-[#051a0f] to-black',
      border: 'border-green-600/50',
      shadow: 'shadow-green-900/20',
      text: 'text-green-500',
      scanColor: 'text-green-500'
    };
  };
  const theme = getTheme();

  // --- ID KÁRTYA (Nagyított) ---
  const IDCard = () => (
    <TiltCard
      className={`relative overflow-hidden rounded-xl border-2 ${theme.border} ${theme.shadow} shadow-2xl ${theme.bg} p-8 w-full min-h-[400px] flex flex-col justify-between group select-none`}>
      <div
        className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-30 mix-blend-overlay pointer-events-none"></div>

      {/* HEADER */}
      <div className="flex justify-between items-start relative z-10 border-b border-white/10 pb-6 mb-6">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded border border-white/10 bg-black/40 shadow-inner`}>
            <Shield className={`w-12 h-12 ${theme.text}`}/>
          </div>
          <div className="leading-tight">
            <div className="text-[11px] text-slate-400 uppercase tracking-[0.3em] font-bold">SAN FIERRO</div>
            <div className="text-3xl font-black text-white uppercase tracking-tighter">SHERIFF'S DEPT</div>
            <div
              className={`text-sm font-bold ${theme.text} uppercase tracking-[0.4em] mt-1`}>{getDepartmentLabel(profile.division)}</div>
          </div>
        </div>
        <div className="w-24 h-24 opacity-90 drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]">
          {theme.logo ? <img src={theme.logo} className="w-full h-full object-contain"/> :
            <Shield className="w-full h-full text-slate-700 opacity-50"/>}
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex gap-8 relative z-10 items-center flex-1">
        {/* SCANNER */}
        <div
          className="w-40 aspect-[3/4] shrink-0 relative rounded border border-white/20 overflow-hidden shadow-2xl bg-black">
          <FingerprintScanner colorClass={theme.scanColor} profile={profile}/>
        </div>

        {/* DETAILS */}
        <div className="flex-1 flex flex-col justify-center space-y-6 w-full">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">OPERATIVE NAME</div>
            <div
              className="text-4xl font-black text-white uppercase tracking-tight leading-none drop-shadow-lg break-words">{profile.full_name}</div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">RANK</div>
              <div
                className={`text-base font-bold uppercase ${theme.text} truncate tracking-wide`}>{profile.faction_rank}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">BADGE</div>
              <div
                className="text-xl font-mono font-black text-white bg-white/10 px-3 py-1 rounded inline-block tracking-[0.2em] shadow-inner">#{profile.badge_number}</div>
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t border-white/5">
            <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">CLEARANCE & CERTS</div>
            <div className="flex flex-wrap gap-2">
              {profile.is_bureau_manager && <Badge
                className="bg-purple-600 text-white text-xs px-2 py-1 border-none shadow-lg shadow-purple-500/20">MANAGER</Badge>}
              {profile.is_bureau_commander && <Badge
                className="bg-blue-600 text-white text-xs px-2 py-1 border-none shadow-lg shadow-blue-500/20">COMMANDER</Badge>}
              {profile.commanded_divisions?.map(d => <Badge key={d}
                                                            className="bg-yellow-500 text-black font-bold text-xs px-2 py-1 border-none">LEAD: {d}</Badge>)}
              {(profile.qualifications || []).slice(0, 6).map(q => (
                <Badge key={q} variant="outline"
                       className="text-xs border-slate-600 text-slate-300 px-2 py-1 bg-black/20">{q}</Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="relative z-10 flex justify-between items-end mt-auto pt-6 border-t border-white/10 opacity-60">
        <div className="flex items-center gap-3">
          <QrCode className="w-8 h-8 text-white/80"/>
          <div
            className="text-[9px] font-mono text-slate-400 leading-tight">ID: {profile.id.split('-')[0].toUpperCase()}<br/>ISSUE: {new Date().getFullYear()}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${profile.system_role !== 'pending' ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500'} animate-pulse`}></div>
          <span className="text-xs font-bold uppercase text-white tracking-[0.15em]">ACTIVE STATUS</span></div>
      </div>
    </TiltCard>
  );

  // ... (Rest of the component remains the same: render method, grids, tabs, etc.)
  // A teljesség kedvéért a render blokk eleje:
  return (
    <div className="min-h-screen bg-[#050a14] relative overflow-hidden pb-20">
      {/* Dialogs & Background */}
      <GiveAwardDialog open={isAwardDialogOpen} onOpenChange={setIsAwardDialogOpen} targetUserId={profile.id}
                       targetUserName={profile.full_name} onSuccess={loadData}/>
      <SheriffBackground/>

      <div className="max-w-7xl mx-auto px-6 py-10 relative z-10">
        {/* HEADER... */}
        {/* GRID... (BAL OLDAL IDCard, JOBB OLDAL TABS) */}
        {/* (A kód többi része változatlan, csak az IDCard lett felülírva) */}
        {/* ... */}

        {/* --- TELJES RETURN BLOKK AZ ISMÉTLÉS KEDVÉÉRT --- */}

        {/* HEADER */}
        <div
          className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="flex items-center gap-5">
            <div
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 border border-slate-700 flex items-center justify-center shadow-2xl">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500 blur-lg opacity-20 animate-pulse"></div>
                <UserCog className="w-8 h-8 text-slate-300 relative z-10"/></div>
            </div>
            <div>
              <h1 className="text-4xl font-black text-white tracking-tight uppercase">Személyi Akta</h1>
              <p className="text-sm text-slate-400 font-mono tracking-widest uppercase flex items-center gap-2"><span
                className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> {greeting}, Deputy.</p>
            </div>
          </div>
          <div className="flex gap-3">
            {isVeteran && <Badge
              className="bg-yellow-600/20 text-yellow-500 border-yellow-500/50 uppercase tracking-wider px-3 py-1 font-bold shadow-lg shadow-yellow-900/20">VETERÁN</Badge>}
            <div
              className="px-4 py-2 rounded-full bg-slate-900/80 border border-slate-700 text-xs font-mono text-slate-300 backdrop-blur-md shadow-lg">SESSION: {new Date().toLocaleTimeString()}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* BAL OLDAL (6 col - MEGNÖVELVE) */}
          <div className="lg:col-span-6 space-y-8 animate-in slide-in-from-left-8 duration-700 delay-100">
            <IDCard/>

            <div className="grid grid-cols-2 gap-4">
              <div
                className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl flex flex-col items-center justify-center hover:bg-slate-900/80 transition-colors group shadow-lg">
                <Calendar
                  className="w-8 h-8 text-yellow-500 mb-2 group-hover:scale-110 transition-transform drop-shadow-[0_0_10px_rgba(234,179,8,0.3)]"/>
                <div className="text-3xl font-black text-white"><TurboCounter value={stats.serviceDays}/></div>
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">Szolgálati Nap
                </div>
              </div>
              <div
                className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl flex flex-col items-center justify-center hover:bg-slate-900/80 transition-colors group shadow-lg">
                <Briefcase
                  className="w-8 h-8 text-blue-500 mb-2 group-hover:scale-110 transition-transform drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]"/>
                <div className="text-3xl font-black text-white"><TurboCounter value={stats.closedCases}/></div>
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">Lezárt Akták</div>
              </div>
            </div>
            <SystemMonitor alertLevel={alertLevel}/>
          </div>

          {/* JOBB OLDAL (6 col) */}
          <div className="lg:col-span-6 space-y-6 animate-in slide-in-from-right-8 duration-700 delay-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <NotificationFeed notifications={notifications} markRead={markRead}/>

              <Card
                className="bg-[#0b1221] border border-slate-800 h-[320px] flex flex-col shadow-lg relative overflow-hidden">
                <CardHeader className="pb-3 border-b border-slate-800/50 bg-slate-950/50">
                  <CardTitle
                    className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Activity
                    className="w-4 h-4 text-green-500"/> Aktivitás Napló</CardTitle>
                </CardHeader>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                  {recentActivity.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-600 opacity-50">
                      <FileText className="w-10 h-10 mb-3"/><p className="text-[10px] font-mono uppercase">NINCS
                      ADAT</p></div>
                  ) : (
                    <div className="divide-y divide-slate-800/50">
                      {recentActivity.map((act) => (
                        <div key={act.id}
                             className="p-3.5 flex items-center gap-3 hover:bg-slate-900/50 transition-colors">
                          <div className="p-2 rounded bg-slate-900 text-slate-500 border border-slate-800"><ScanLine
                            className="w-4 h-4"/></div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-slate-200 truncate">{act.title}</div>
                            <div
                              className="text-[9px] text-slate-500 font-mono uppercase mt-0.5">{formatDistanceToNow(new Date(act.updated_at), {
                              locale: hu,
                              addSuffix: true
                            })}</div>
                          </div>
                          <Badge variant="outline"
                                 className="text-[9px] h-5 border-slate-700 text-slate-500 font-mono">{act.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </div>

            <Tabs defaultValue="awards" className="w-full">
              <TabsList
                className="w-full bg-slate-900/60 border border-slate-800 p-1 h-14 rounded-xl mb-6 flex gap-2 backdrop-blur-sm">
                <TabsTrigger value="awards"
                             className="flex-1 h-full data-[state=active]:bg-yellow-600 data-[state=active]:text-black font-bold uppercase tracking-wider text-xs rounded-lg transition-all"><Medal
                  className="w-4 h-4 mr-2"/> Kitüntetések</TabsTrigger>
                <TabsTrigger value="settings"
                             className="flex-1 h-full data-[state=active]:bg-slate-800 data-[state=active]:text-white font-bold uppercase tracking-wider text-xs rounded-lg transition-all"><UserCog
                  className="w-4 h-4 mr-2"/> Fiókkezelés</TabsTrigger>
              </TabsList>

              <TabsContent value="awards" className="mt-0 space-y-6">
                {showAwardButton && (
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => setIsAwardDialogOpen(true)}
                            className="border-slate-700 text-yellow-500 hover:text-yellow-400 hover:bg-yellow-900/10 text-xs uppercase font-bold tracking-wider h-9 px-4"><PlusCircle
                      className="w-3.5 h-3.5 mr-1.5"/> Kitüntetés Adása</Button>
                  </div>
                )}
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 bg-[#0a0a0f] rounded-2xl border border-slate-800 shadow-inner min-h-[200px]">
                  {ribbons.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center text-slate-600 opacity-50">
                      <Medal className="w-16 h-16 mb-4"/><p
                      className="text-xs font-mono uppercase tracking-widest">VITRIN ÜRES</p></div>
                  ) : (
                    ribbons.map((ribbon, idx) => (
                      <div key={idx}
                           className="bg-slate-900/80 border border-slate-700 p-4 rounded-xl flex items-center gap-4 hover:border-yellow-500/40 transition-all group relative overflow-hidden shadow-md hover:shadow-lg">
                        <div
                          className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"/>
                        {ribbon.image_url ?
                          <div className="w-16 h-10 flex items-center justify-center drop-shadow-lg shrink-0"><img
                            src={ribbon.image_url} alt={ribbon.name} className="max-w-full max-h-full object-contain"/>
                          </div> :
                          <div className="w-4 h-12 rounded-sm shadow shadow-black/50 border border-white/10 shrink-0"
                               style={{backgroundColor: ribbon.color_hex}}/>}
                        <div className="min-w-0 relative z-10">
                          <div
                            className="text-sm font-bold text-white group-hover:text-yellow-400 transition-colors flex items-center gap-2 truncate">{ribbon.name}
                            <Sparkles
                              className="w-3 h-3 text-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"/>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{ribbon.description}</p>
                          <div className="text-[9px] text-slate-600 mt-2 font-mono uppercase flex items-center gap-1">
                            <Calendar className="w-3 h-3"/> {new Date(ribbon.awarded_at).toLocaleDateString('hu-HU')}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
              <TabsContent value="settings" className="mt-0">
                <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-md shadow-xl"><CardHeader><CardTitle
                  className="text-lg font-bold text-white">Fiók Biztonság</CardTitle><CardDescription
                  className="text-xs">Személyes adatok és biztonság.</CardDescription></CardHeader>
                  <CardContent className="space-y-8">
                    <div className="space-y-3 p-5 rounded-xl bg-slate-950/50 border border-slate-800/50"><Label
                      className="text-xs uppercase text-slate-500 font-bold tracking-wider">Megjelenített Név
                      (IC)</Label>
                      <div className="flex gap-3"><Input value={newName} onChange={(e) => setNewName(e.target.value)}
                                                         className="bg-slate-900 border-slate-700 font-bold text-white h-11"/><Button
                        onClick={handleNameChange} disabled={isUpdating || newName === profile.full_name}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 h-11">{isUpdating ?
                        <Loader2 className="animate-spin"/> : <Save className="w-5 h-5"/>}</Button></div>
                      <p className="text-[10px] text-blue-400/80 flex items-center gap-1"><Zap className="w-3 h-3"/> A
                        névváltoztatás naplózásra kerül.</p></div>
                    <div className="space-y-3 p-5 rounded-xl bg-slate-950/50 border border-slate-800/50"><Label
                      className="text-xs uppercase text-slate-500 font-bold tracking-wider">Jelszó Módosítás</Label>
                      <form onSubmit={handlePasswordChange} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4"><Input type="password" placeholder="Új jelszó"
                                                                       value={newPassword}
                                                                       onChange={(e) => setNewPassword(e.target.value)}
                                                                       className="bg-slate-900 border-slate-700 h-11"/><Input
                          type="password" placeholder="Megerősítés" value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="bg-slate-900 border-slate-700 h-11"/></div>
                        <Button type="submit" disabled={isUpdating || !newPassword}
                                className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-black uppercase tracking-wider mt-2 h-12 shadow-lg shadow-yellow-900/20">{isUpdating ?
                          <Loader2 className="animate-spin mr-2"/> : <Key className="w-4 h-4 mr-2"/>} Jelszó
                          Frissítése</Button></form>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}