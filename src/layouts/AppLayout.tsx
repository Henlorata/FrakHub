import {useState, useEffect, useCallback} from "react";
import {Outlet, Link, useLocation, Navigate, useNavigate} from "react-router-dom";
import {useAuth} from "@/context/AuthContext";
import {useSystemStatus} from "@/context/SystemStatusContext";
import {LoadingScreen} from "@/components/ui/loading-screen";
import {PendingApprovalPage} from "@/pages/auth/PendingApprovalPage";
import {
  LayoutDashboard, Users, ShieldAlert, Truck, FileText, LogOut, Menu, X,
  Banknote, Gavel, Bell, User, ChevronRight, ClipboardPen, ClipboardList,
  Settings, Shield
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {canViewCaseList, cn} from "@/lib/utils";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// --- ÚJ MODERN HÁTTÉR ---
// Nem retro, hanem modern, sötét, "High-End" érzet
const ModernAmbientBackground = () => (
  <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden bg-[#02040a]">
    {/* 1. Mély sötét alap gradiens */}
    <div className="absolute inset-0 bg-gradient-to-b from-[#050a14] via-[#02040a] to-black"></div>

    {/* 2. Ambient Fények (Tactical Blue & Alert Colors) */}
    {/* Bal felső kék fény */}
    <div className="ambient-light bg-blue-900/20 w-[500px] h-[500px] -top-20 -left-20 animate-pulse"
         style={{animationDuration: '8s'}}></div>
    {/* Jobb alsó sárgás fény (Sheriff Gold) */}
    <div className="ambient-light bg-yellow-900/10 w-[600px] h-[600px] -bottom-40 -right-20 animate-pulse"
         style={{animationDuration: '12s'}}></div>

    {/* 3. Nagyon finom zaj (Noise) a textúrához (opcionális, de ad egy kis 'anyagot' a sötétségnek) */}
    <div className="absolute inset-0 opacity-[0.03]"
         style={{backgroundImage: 'url("https://www.transparenttextures.com/patterns/stardust.png")'}}></div>
  </div>
);

export function AppLayout() {
  const {profile, signOut, loading, supabase, user} = useAuth();
  const {alertLevel} = useSystemStatus();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // --- LOGIC ---
  const showSidebar = location.pathname !== '/onboarding';

  // Státusz színek definiálása a JS oldalon is a dinamikus stílushoz
  const getStatusColor = () => {
    switch (alertLevel) {
      case 'traffic':
        return '#f97316'; // Narancs
      case 'border':
        return '#ef4444'; // Piros
      case 'tactical':
        return '#dc2626'; // Sötétvörös
      default:
        return '#eab308'; // Sárga (Normál)
    }
  };
  const statusColor = getStatusColor();

  useEffect(() => {
    // CSS változó frissítése a status colorhoz
    document.documentElement.style.setProperty('--status-color', statusColor);
    document.documentElement.style.setProperty('--status-glow', `${statusColor}80`); // 50% opacity
  }, [alertLevel, statusColor]);

  // Auth & Routing védelem
  useEffect(() => {
    if (loading || !profile) return;
    if (profile.faction_rank === 'Deputy Sheriff Trainee' && !profile.onboarding_completed) {
      if (location.pathname !== '/onboarding') navigate('/onboarding', {replace: true});
    } else if (location.pathname === '/onboarding') {
      navigate('/', {replace: true});
    }
  }, [profile, loading, navigate, location.pathname]);

  // Értesítések lekérése
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    const {count, error} = await supabase
      .from('notifications')
      .select('*', {count: 'exact', head: true})
      .eq('user_id', user.id)
      .eq('is_read', false);
    if (!error) setUnreadCount(count || 0);
  }, [user, supabase]);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount, location.pathname]);

  // Realtime notification listener
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`user-notifications-${user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}`
      }, () => setTimeout(() => fetchUnreadCount(), 100))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase, fetchUnreadCount]);

  if (loading) return <LoadingScreen/>;
  if (!profile) return <Navigate to="/login" replace/>;
  if (profile.system_role === 'pending') return <PendingApprovalPage/>;

  // --- MENU ---
  const menuItems = [
    {icon: LayoutDashboard, label: "Irányítópult", path: "/dashboard", show: true},
    {type: 'divider', label: 'Operatív'},
    {icon: ShieldAlert, label: "Nyomozó Iroda (MCB)", path: "/mcb", show: canViewCaseList(profile)},
    {icon: Truck, label: "Logisztika & Készlet", path: "/logistics", show: true},
    {icon: Banknote, label: "Pénzügy", path: "/finance", show: true},
    {type: 'divider', label: 'Adminisztráció'},
    {icon: ClipboardList, label: "Vizsgaközpont", path: "/exams", show: true},
    {icon: Gavel, label: "Büntetés Kalkulátor", path: "/calculator", show: true},
    {icon: ClipboardPen, label: "Jelentés Generátor", path: "/reports", show: true},
    {icon: Users, label: "HR / Személyügy", path: "/hr", show: true},
  ];

  return (
    <div className="min-h-screen text-slate-100 flex font-sans selection:bg-yellow-500/30 relative">
      <ModernAmbientBackground/>

      {/* --- STATUS LINE (Felső vékony csík) --- */}
      <div className="status-line-top"></div>

      {/* --- SIDEBAR (DESKTOP) --- */}
      {showSidebar && (
        <aside className="hidden lg:flex w-72 flex-col fixed inset-y-0 left-0 z-40 glass-panel shadow-2xl">

          {/* Logo Area */}
          <div className="relative h-20 flex items-center px-6 border-b border-white/5 shrink-0">
            <div
              className="w-10 h-10 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mr-4 shadow-[0_0_15px_rgba(234,179,8,0.2)]">
              <Shield className="text-yellow-500 h-6 w-6"/>
            </div>
            <div>
              <h1 className="font-bold text-xl tracking-tight text-white leading-none">SFSD <span
                style={{color: statusColor}}>INTRA</span></h1>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{backgroundColor: statusColor}}></div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Online</p>
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="relative flex-1 py-6 px-4 space-y-1 overflow-y-auto scrollbar-hide">
            {menuItems.map((item, idx) => {
              if (!item.show) return null;

              if (item.type === 'divider') {
                return (
                  <div key={idx} className="mt-6 mb-2 px-2 flex items-center gap-2">
                    <div className="h-px bg-white/10 flex-1"></div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">{item.label}</span>
                  </div>
                );
              }

              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center justify-between px-3 py-3 rounded-lg text-sm font-medium transition-all duration-300 group relative",
                    isActive ? "nav-item-active text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center">
                    <item.icon
                      className={cn("h-5 w-5 mr-3 transition-colors duration-300", isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300")}
                      style={isActive ? {color: statusColor} : {}}
                    />
                    <span className="tracking-wide">{item.label}</span>
                  </div>

                  {isActive && <div className="w-1.5 h-1.5 rounded-full shadow-[0_0_5px_currentColor]"
                                    style={{backgroundColor: statusColor}}/>}
                </Link>
              );
            })}
          </nav>

          {/* User Profile Section (Bottom) */}
          <div className="relative p-4 border-t border-white/5 bg-black/20">

            {/* Notification Button */}
            <Link to="/notifications" className="block mb-4">
              <div className={cn(
                "flex items-center p-3 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 transition-all cursor-pointer group",
                unreadCount > 0 && "border-red-500/30 bg-red-500/10"
              )}>
                <div className="relative">
                  <Bell
                    className={cn("w-5 h-5 text-slate-400 group-hover:text-white transition-colors", unreadCount > 0 && "text-red-400 animate-pulse")}/>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                        <span
                          className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                     </span>
                  )}
                </div>
                <span
                  className="ml-3 text-xs font-bold text-slate-300 group-hover:text-white uppercase tracking-wider">Értesítések</span>
                {unreadCount > 0 && <span className="ml-auto text-xs font-bold text-red-400">{unreadCount} DB</span>}
              </div>
            </Link>

            {/* Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center w-full gap-3 group outline-none hover:bg-white/5 p-2 rounded-lg transition-colors">
                  <Avatar className="h-9 w-9 border border-slate-700 transition-colors duration-500">
                    <AvatarImage src={profile.avatar_url}/>
                    <AvatarFallback
                      className="bg-slate-800 text-slate-200 font-bold">{profile.badge_number}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left min-w-0">
                    <p
                      className="text-sm font-bold text-white truncate group-hover:text-yellow-500 transition-colors">{profile.full_name}</p>
                    <p
                      className="text-[10px] text-slate-400 uppercase tracking-wider truncate">{profile.faction_rank}</p>
                  </div>
                  <Settings className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors"/>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end"
                                   className="w-60 bg-[#0f172a] border-slate-800 text-slate-200 ml-4 mb-2 shadow-2xl p-1 rounded-lg">
                <DropdownMenuLabel className="font-normal p-2">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-bold text-white">{profile.full_name}</p>
                    <p className="text-xs text-slate-500 font-mono">{profile.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-800"/>
                <DropdownMenuItem onClick={() => navigate('/profile')}
                                  className="cursor-pointer focus:bg-slate-800 focus:text-white py-2.5 rounded-md">
                  <User className="mr-2 h-4 w-4 text-yellow-500"/> <span
                  className="font-medium text-xs uppercase tracking-wider">Személyes Profil</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut}
                                  className="cursor-pointer text-red-400 focus:text-red-300 focus:bg-red-950/20 py-2.5 rounded-md">
                  <LogOut className="mr-2 h-4 w-4"/> <span
                  className="font-medium text-xs uppercase tracking-wider">Kijelentkezés</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>
      )}

      {/* --- MAIN CONTENT AREA --- */}
      <main className={cn(
        "flex-1 flex flex-col min-h-screen relative z-10 transition-all duration-300",
        showSidebar ? "lg:ml-72" : ""
      )}>

        {/* MOBILE HEADER */}
        {showSidebar && (
          <header
            className="lg:hidden h-16 border-b border-white/10 bg-[#02040a]/90 backdrop-blur-md flex items-center justify-between px-4 sticky top-0 z-30">
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-yellow-500"/>
              <span className="font-black text-white tracking-tight">SFSD INTRA</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="text-white hover:bg-white/10">
              {isMobileMenuOpen ? <X className="h-6 w-6"/> : <Menu className="h-6 w-6"/>}
            </Button>
          </header>
        )}

        {/* MOBILE MENU */}
        {showSidebar && isMobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-[#02040a] p-4 animate-in slide-in-from-top-5 duration-200">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-black text-white">MENÜ</h2>
              <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)}>
                <X className="h-6 w-6 text-slate-400"/>
              </Button>
            </div>
            <div className="space-y-2">
              {menuItems.map((item, idx) => {
                if (!item.show) return null;
                if (item.type === 'divider') return <div key={idx}
                                                         className="text-xs font-bold text-slate-600 uppercase tracking-widest mt-4 mb-2 border-b border-white/5 pb-1">{item.label}</div>;
                return (
                  <Link key={item.path} to={item.path} onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center px-4 py-4 rounded-lg bg-white/5 text-slate-200 font-medium active:bg-yellow-500/20 active:text-yellow-500 transition-all border border-transparent active:border-yellow-500/30">
                    <item.icon className="h-5 w-5 mr-3"/>
                    {item.label}
                  </Link>
                )
              })}
              <Button onClick={signOut} variant="destructive"
                      className="w-full mt-8 py-6 font-bold uppercase tracking-wider">
                <LogOut className="h-5 w-5 mr-2"/> Kijelentkezés
              </Button>
            </div>
          </div>
        )}

        {/* PAGE CONTENT CONTAINER */}
        <div
          className="flex-1 p-4 md:p-6 lg:p-8 animate-in fade-in slide-in-from-bottom-2 duration-500 relative overflow-hidden">
          <Outlet/>
        </div>

      </main>
    </div>
  );
}