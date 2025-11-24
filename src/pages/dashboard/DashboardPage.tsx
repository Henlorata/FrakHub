import * as React from "react";
import {useAuth} from "@/context/AuthContext";
import {useSystemStatus, type AlertLevelId} from "@/context/SystemStatusContext";
import {Button} from "@/components/ui/button";
import {Card, CardHeader, CardTitle, CardContent, CardFooter} from "@/components/ui/card";
import {
  LogOut, ShieldAlert, Truck, Banknote, Gavel, Users,
  Clock, Megaphone, Activity, AlertTriangle, Briefcase, User, Plus, Trash2, Pin, ChevronDown
} from "lucide-react";
import {useNavigate} from "react-router-dom";
import {toast} from "sonner";
import {ScrollArea} from "@/components/ui/scroll-area";
import {formatDistanceToNow} from "date-fns";
import {hu} from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Label} from "@/components/ui/label";
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from "@/components/ui/dropdown-menu";

// Státusz definíciók
const ALERT_LEVELS: Record<AlertLevelId, { label: string; color: string; icon: any }> = {
  normal: {label: "Normál Ügymenet", color: "#eab308", icon: Activity},
  traffic: {label: "Fokozott Ellenőrzés", color: "#f97316", icon: AlertTriangle},
  border: {label: "Teljes Határzár", color: "#ef4444", icon: ShieldAlert},
  tactical: {label: "Kiemelt Riadó", color: "#dc2626", icon: ShieldAlert},
};

// Rang kategóriák
const EXECUTIVE_RANKS = [
  'Commander', 'Deputy Commander', 'Captain III.', 'Captain II.', 'Captain I.',
  'Lieutenant II.', 'Lieutenant I.'
];

const SUPERVISORY_RANKS = [
  'Sergeant II.', 'Sergeant I.'
];

// --- ÚJ HÍR DIALOG ---
function NewAnnouncementDialog({open, onOpenChange, onSuccess}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSuccess: () => void
}) {
  const {supabase, user} = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [formData, setFormData] = React.useState({
    title: "",
    content: "",
    type: "info",
    is_pinned: false,
    show_author: true
  });

  const handleSubmit = async () => {
    if (!formData.title || !formData.content) {
      toast.error("Kérlek tölts ki minden mezőt!");
      return;
    }
    setLoading(true);
    try {
      const {error} = await supabase.from('announcements').insert({
        title: formData.title,
        content: formData.content,
        type: formData.type as any,
        is_pinned: formData.is_pinned,
        show_author: formData.show_author,
        created_by: user?.id
      });

      if (error) throw error;
      toast.success("Hír közzétéve!");
      setFormData({title: "", content: "", type: "info", is_pinned: false, show_author: true});
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error("Hiba a mentés során.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Új hirdetmény közzététele</DialogTitle>
          <DialogDescription>A hír azonnal megjelenik mindenki számára.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Cím</Label>
            <Input
              placeholder="pl. Heti Állománygyűlés"
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              className="bg-slate-950 border-slate-800"
            />
          </div>
          <div className="space-y-2">
            <Label>Típus</Label>
            <div className="flex gap-2">
              {[
                {id: 'info', label: 'Infó', color: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50'},
                {id: 'training', label: 'Képzés', color: 'bg-blue-500/20 text-blue-500 border-blue-500/50'},
                {id: 'alert', label: 'Riasztás', color: 'bg-red-500/20 text-red-500 border-red-500/50'},
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setFormData({...formData, type: t.id})}
                  className={`flex-1 py-2 rounded-md border text-xs font-bold transition-all ${formData.type === t.id ? t.color : 'border-slate-800 text-slate-500 bg-slate-950 hover:bg-slate-900'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Tartalom</Label>
            <Textarea
              placeholder="Írd ide a részleteket..."
              value={formData.content}
              onChange={e => setFormData({...formData, content: e.target.value})}
              className="bg-slate-950 border-slate-800 h-24 resize-none"
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="pinned"
                checked={formData.is_pinned}
                onChange={e => setFormData({...formData, is_pinned: e.target.checked})}
                className="rounded border-slate-800 bg-slate-950 text-yellow-500 focus:ring-yellow-500"
              />
              <Label htmlFor="pinned" className="cursor-pointer text-sm text-slate-300">Rögzítés a lista tetején
                (PIN)</Label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showAuthor"
                checked={!formData.show_author}
                onChange={e => setFormData({...formData, show_author: !e.target.checked})}
                className="rounded border-slate-800 bg-slate-950 text-yellow-500 focus:ring-yellow-500"
              />
              <Label htmlFor="showAuthor" className="cursor-pointer text-sm text-slate-300">Név elrejtése (Rang
                kategória mutatása)</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button onClick={handleSubmit} disabled={loading}
                  className="bg-yellow-600 hover:bg-yellow-700 text-black">Közzététel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- FŐ KOMPONENS ---
export function DashboardPage() {
  const {profile, signOut, supabase} = useAuth();
  const {alertLevel, setAlertLevel} = useSystemStatus();
  const navigate = useNavigate();

  const currentTheme = ALERT_LEVELS[alertLevel] || ALERT_LEVELS.normal;
  const isLeader = profile?.system_role === 'admin' || profile?.system_role === 'supervisor';

  const [currentTime, setCurrentTime] = React.useState(new Date());
  const [stats, setStats] = React.useState({pendingVehicles: 0, pendingBudget: 0, activeOfficers: 0, openCases: 0});
  const [recentActions, setRecentActions] = React.useState<any[]>([]);
  const [announcements, setAnnouncements] = React.useState<any[]>([]);
  const [isLoadingStats, setIsLoadingStats] = React.useState(true);
  const [isNewsDialogOpen, setIsNewsDialogOpen] = React.useState(false);

  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Segédfüggvény a dátum frissítéséhez
  const updateLastUpdated = (newDateStr: string) => {
    const newDate = new Date(newDateStr);
    setLastUpdated(prev => (!prev || newDate > prev) ? newDate : prev);
  };

  const fetchNews = async () => {
    const {data} = await supabase
      .from('announcements')
      .select('*, profiles:created_by(full_name, faction_rank)')
      .order('is_pinned', {ascending: false})
      .order('created_at', {ascending: false})
      .limit(20);

    if (data) {
      setAnnouncements(data);
      if (data.length > 0) {
        // JAVÍTÁS: Nem csak az elsőt nézzük (mert az lehet egy régi pinned), hanem megkeressük a legfrissebbet
        const latestNews = data.reduce((latest, current) => {
          return new Date(current.created_at) > new Date(latest) ? current.created_at : latest;
        }, data[0].created_at);

        updateLastUpdated(latestNews);
      }
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
        if (actions) {
          setRecentActions(actions);
          if (actions.length > 0) {
            updateLastUpdated(actions[0].created_at);
          }
        }

        await fetchNews();

      } finally {
        setIsLoadingStats(false);
      }
    };
    fetchdata();

    const channel = supabase
      .channel('dashboard_combined')
      .on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'action_logs'}, async (payload) => {
        const {data: newAction} = await supabase.from('action_logs').select('*, profiles(full_name, badge_number)').eq('id', payload.new.id).single();
        if (newAction) {
          setRecentActions(prev => [newAction, ...prev].slice(0, 20));
          updateLastUpdated(payload.new.created_at);
        }
      })
      .on('postgres_changes', {event: '*', schema: 'public', table: 'announcements'}, () => {
        fetchNews();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleStatusChange = async (newLevel: string) => {
    await setAlertLevel(newLevel as AlertLevelId);
    toast.success(`Státusz átállítva: ${ALERT_LEVELS[newLevel as AlertLevelId].label}`);
  }

  const handleDeleteNews = async (id: string) => {
    if (!confirm("Biztosan törlöd ezt a hírt?")) return;
    const {error} = await supabase.from('announcements').delete().eq('id', id);
    if (error) toast.error("Nem sikerült törölni.");
    else toast.success("Hír törölve.");
  };

  const renderAuthor = (news: any) => {
    if (!news.profiles) return <span className="text-slate-500">Rendszer</span>;

    if (news.show_author) {
      return (
        <span className="text-slate-400 font-medium">
                  {news.profiles.faction_rank} {news.profiles.full_name}
              </span>
      );
    } else {
      const rank = news.profiles.faction_rank;

      if (EXECUTIVE_RANKS.includes(rank)) {
        return <span
          className="text-red-400 font-bold tracking-wide text-[10px] uppercase border border-red-900/50 px-1.5 py-0.5 rounded bg-red-950/30">Executive / Command Staff</span>;
      } else if (SUPERVISORY_RANKS.includes(rank)) {
        return <span
          className="text-green-400 font-bold tracking-wide text-[10px] uppercase border border-green-900/50 px-1.5 py-0.5 rounded bg-green-950/30">Supervisory Staff</span>;
      } else {
        return <span
          className="text-yellow-500 font-bold tracking-wide text-[10px] uppercase border border-yellow-900/50 px-1.5 py-0.5 rounded bg-yellow-950/30">Vezetőség</span>;
      }
    }
  }

  const themeStyle = {
    '--theme-color': currentTheme.color,
    '--theme-bg': `${currentTheme.color}10`,
    '--theme-border': `${currentTheme.color}40`,
  } as React.CSSProperties;

  return (
    <div className="space-y-6 animate-in fade-in duration-500" style={themeStyle}>

      <NewAnnouncementDialog open={isNewsDialogOpen} onOpenChange={setIsNewsDialogOpen} onSuccess={fetchNews}/>

      {/* --- PARANCSNOKI SÁV --- */}
      <div
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-900/80 p-6 rounded-2xl border transition-colors duration-700 backdrop-blur-md shadow-lg overflow-hidden relative"
        style={{borderColor: 'var(--theme-border)'}}>

        <div className="absolute inset-0 bg-[var(--theme-bg)] transition-colors duration-700 pointer-events-none"/>

        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-white tracking-tight">Irányítópult</h1>
          <p className="text-slate-400 mt-1">
            Üdvözöljük a szolgálatban, <span className="font-semibold transition-colors duration-700"
                                             style={{color: 'var(--theme-color)'}}>{profile?.faction_rank} {profile?.full_name}</span>!
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 relative z-10">
          <div
            className="bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2 flex items-center gap-3 shadow-inner">
            <Clock className="w-5 h-5 text-slate-500"/>
            <span className="text-xl font-mono font-bold text-white tracking-widest">
              {currentTime.toLocaleTimeString('hu-HU', {hour: '2-digit', minute: '2-digit'})}
            </span>
          </div>

          {isLeader ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="cursor-pointer select-none transition-all duration-500 active:scale-95 px-4 py-2 rounded-xl border flex items-center gap-3 shadow-lg bg-slate-950/50 hover:bg-slate-900 outline-none"
                  style={{borderColor: 'var(--theme-color)', color: 'var(--theme-color)'}}
                >
                  <currentTheme.icon className="w-5 h-5 animate-pulse"/>
                  <span className="font-bold uppercase tracking-wide text-sm">{currentTheme.label}</span>
                  <ChevronDown className="w-4 h-4 opacity-50 ml-1"/>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-slate-950 border-slate-800 min-w-[200px]">
                {Object.entries(ALERT_LEVELS).map(([key, val]) => (
                  <DropdownMenuItem
                    key={key}
                    onClick={() => handleStatusChange(key)}
                    className="text-slate-300 hover:text-white hover:bg-slate-900 cursor-pointer gap-2 py-2"
                  >
                    <val.icon className="w-4 h-4" style={{color: val.color}}/>
                    <span style={{color: val.color}}>{val.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div
              className="cursor-default select-none px-4 py-2 rounded-xl border flex items-center gap-3 shadow-lg bg-slate-950/50 opacity-80"
              style={{borderColor: 'var(--theme-color)', color: 'var(--theme-color)'}}
            >
              <currentTheme.icon className="w-5 h-5 animate-pulse"/>
              <span className="font-bold uppercase tracking-wide text-sm">{currentTheme.label}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

        {/* --- BAL OSZLOP (3/4) --- */}
        <div className="xl:col-span-3 space-y-6">

          {/* Statisztika */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {icon: Users, label: "Aktív Állomány", value: stats.activeOfficers, color: "text-blue-500"},
              {icon: Briefcase, label: "Nyitott Akták", value: stats.openCases, color: "text-yellow-500"},
              {icon: Truck, label: "Függő Jármű", value: stats.pendingVehicles, color: "text-orange-500"},
              {icon: Banknote, label: "Függő Pénzügy", value: stats.pendingBudget, color: "text-green-500"},
            ].map((stat, i) => (
              <Card key={i} className="bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-all">
                <CardContent className="p-5 flex flex-col items-center text-center">
                  <stat.icon className={`w-6 h-6 mb-2 opacity-80 ${stat.color}`}/>
                  <div className="text-2xl font-bold text-white">{isLoadingStats ? "-" : stat.value}</div>
                  <div
                    className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-1">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Rendszerek */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2 px-1">
              <Activity className="w-5 h-5 text-slate-400"/> Rendszerek
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div onClick={() => navigate('/mcb')}
                   className="group relative overflow-hidden rounded-xl bg-slate-900 border border-slate-800 p-5 cursor-pointer hover:border-yellow-600/50 transition-all">
                <div className="flex items-center gap-4 relative z-10">
                  <div
                    className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center border border-yellow-500/20 text-yellow-500 group-hover:scale-110 transition-transform">
                    <ShieldAlert className="w-5 h-5"/></div>
                  <div><h3 className="font-bold text-white">Nyomozó Iroda</h3><p
                    className="text-xs text-slate-400">Akták és nyomozás</p></div>
                </div>
              </div>
              <div onClick={() => navigate('/logistics')}
                   className="group relative overflow-hidden rounded-xl bg-slate-900 border border-slate-800 p-5 cursor-pointer hover:border-blue-600/50 transition-all">
                <div className="flex items-center gap-4 relative z-10">
                  <div
                    className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/20 text-blue-500 group-hover:scale-110 transition-transform">
                    <Truck className="w-5 h-5"/></div>
                  <div><h3 className="font-bold text-white">Logisztika</h3><p
                    className="text-xs text-slate-400">Járműflotta kezelés</p></div>
                </div>
              </div>
              <div onClick={() => navigate('/calculator')}
                   className="group relative overflow-hidden rounded-xl bg-slate-900 border border-slate-800 p-5 cursor-pointer hover:border-purple-600/50 transition-all">
                <div className="flex items-center gap-4 relative z-10">
                  <div
                    className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center border border-purple-500/20 text-purple-500 group-hover:scale-110 transition-transform">
                    <Gavel className="w-5 h-5"/></div>
                  <div><h3 className="font-bold text-white">Btk. Kalkulátor</h3><p
                    className="text-xs text-slate-400">Bírság és Börtön</p></div>
                </div>
              </div>
            </div>
          </div>

          {/* ACTION FEED */}
          <Card className="bg-slate-900/80 border-slate-800 overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-800/50 bg-slate-950/30">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500"/> Élő Eseménynapló
              </CardTitle>
            </CardHeader>
            <ScrollArea className="h-[300px]">
              <div className="divide-y divide-slate-800/50">
                {recentActions.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-sm">Még nincs rögzített esemény ma.</div>
                ) : (
                  recentActions.map((action) => (
                    <div key={action.id} className="p-4 flex items-start gap-3 hover:bg-slate-800/30 transition-colors">
                      <div
                        className={`mt-1 w-2 h-2 rounded-full shrink-0 ${action.action_type === 'arrest' ? 'bg-red-500' : 'bg-blue-500'}`}/>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <p className="text-sm font-medium text-slate-200">
                            <span
                              className="text-slate-400">{action.profiles?.badge_number}</span> {action.profiles?.full_name}
                          </p>
                          <span className="text-[10px] text-slate-500 whitespace-nowrap ml-2">
                                    {formatDistanceToNow(new Date(action.created_at), {addSuffix: true, locale: hu})}
                                 </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 font-mono break-words">
                          {action.action_type === 'ticket' ? 'BÍRSÁG: ' : action.action_type === 'arrest' ? 'LETARTÓZTATÁS: ' : ''}
                          {action.details}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </Card>

        </div>

        {/* --- JOBB OSZLOP (1/4) --- */}
        <div className="xl:col-span-1 space-y-6">

          {/* HÍREK */}
          <Card className="bg-slate-900 border-slate-800 shadow-lg">
            <CardHeader
              className="pb-3 border-b border-slate-800/50 flex flex-row items-center justify-between space-y-0 shrink-0">
              <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-400">
                <Megaphone className="w-4 h-4 text-yellow-500"/> Hirdetőtábla
              </CardTitle>
              {isLeader && (
                <Button size="icon" variant="ghost" className="h-6 w-6 -mr-2 text-slate-500 hover:text-white"
                        onClick={() => setIsNewsDialogOpen(true)} title="Új hír">
                  <Plus className="w-4 h-4"/>
                </Button>
              )}
            </CardHeader>
            <div className="p-0">
              <ScrollArea className="h-[400px] w-full rounded-b-lg">
                <div className="p-4 space-y-4">
                  {announcements.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-4">Jelenleg nincsenek hírek.</p>
                  ) : (
                    announcements.map((news) => (
                      <div key={news.id}
                           className={`pl-3 py-2 border-l-2 group relative ${news.type === 'alert' ? 'border-red-500 bg-red-500/5' : news.type === 'training' ? 'border-blue-500 bg-blue-500/5' : 'border-yellow-500 bg-yellow-500/5'}`}>
                        <div className="flex justify-between items-start">
                          <h4
                            className={`text-sm font-bold ${news.type === 'alert' ? 'text-red-200' : news.type === 'training' ? 'text-blue-200' : 'text-yellow-200'}`}>
                            {news.is_pinned && <Pin className="inline w-3 h-3 mr-1 -mt-0.5 text-slate-400"/>}
                            {news.title}
                          </h4>
                          {isLeader && (
                            <button onClick={() => handleDeleteNews(news.id)}
                                    className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-500 transition-opacity absolute top-1 right-1">
                              <Trash2 className="w-3 h-3"/>
                            </button>
                          )}
                        </div>

                        <p
                          className="text-xs text-slate-400 mt-1 leading-relaxed whitespace-pre-wrap">{news.content}</p>

                        <div
                          className="mt-2 flex flex-col md:flex-row justify-between items-start md:items-center text-[10px] gap-1">
                          <span
                            className="text-slate-600 font-mono">{new Date(news.created_at).toLocaleDateString('hu-HU')}</span>
                          {renderAuthor(news)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
            <CardFooter className="p-2 border-t border-slate-800 bg-slate-950/30 justify-center">
              <p className="text-[10px] text-slate-500">
                Utolsó frissítés: {lastUpdated ? formatDistanceToNow(lastUpdated, {
                addSuffix: true,
                locale: hu
              }) : "Nincs adat"}
              </p>
            </CardFooter>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="space-y-2 p-4">
              <Button variant="outline" className="w-full justify-start text-slate-400 hover:text-white"
                      onClick={() => navigate('/profile')}>
                <User className="w-4 h-4 mr-2"/> Profil
              </Button>
              <Button variant="destructive" className="w-full justify-start" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2"/> Kijelentkezés
              </Button>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}