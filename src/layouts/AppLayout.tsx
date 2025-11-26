import {useState, useEffect, useCallback} from "react";
import {Outlet, Link, useLocation, Navigate, useNavigate} from "react-router-dom";
import {useAuth} from "@/context/AuthContext";
import {useSystemStatus} from "@/context/SystemStatusContext";
import {LoadingScreen} from "@/components/ui/loading-screen";
import {PendingApprovalPage} from "@/pages/auth/PendingApprovalPage";
import {
  LayoutDashboard,
  Users,
  ShieldAlert,
  Truck,
  FileText,
  LogOut,
  Menu,
  X,
  Banknote,
  Gavel,
  Bell,
  User,
  ChevronUp, ClipboardPen, ClipboardList
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {cn} from "@/lib/utils";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppLayout() {
  const {profile, signOut, loading, supabase, user} = useAuth();
  const {alertLevel} = useSystemStatus();
  const location = useLocation();
  const navigate = useNavigate(); // Hook inicializálása a navigációhoz
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [unreadCount, setUnreadCount] = useState(0);

  // Számláló frissítő függvény
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    const {count, error} = await supabase
      .from('notifications')
      .select('*', {count: 'exact', head: true}) // HEAD request gyorsabb
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (!error) {
      console.log("Értesítések frissítve:", count);
      setUnreadCount(count || 0);
    }
  }, [user, supabase]);

  // 1. Kezdeti betöltés és navigáláskor frissítés
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount, location.pathname]);

  // 2. Realtime feliratkozás
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Minden esemény (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log("Realtime esemény:", payload);
          // Kis késleltetés, hogy a DB update biztosan lefusson
          setTimeout(() => fetchUnreadCount(), 100);
        }
      )
      .subscribe((status) => {
        console.log("Feliratkozás státusza:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase, fetchUnreadCount]);

  if (loading) return <LoadingScreen/>;
  if (!profile) return <Navigate to="/login" replace/>;
  if (profile.system_role === 'pending') return <PendingApprovalPage/>;

  const menuItems = [
    {icon: LayoutDashboard, label: "Irányítópult", path: "/dashboard", show: true},
    {icon: ClipboardList, label: "Vizsgaközpont", path: "/exams", show: true},
    {icon: Gavel, label: "Büntetés Kalkulátor", path: "/calculator", show: true},
    {icon: ClipboardPen, label: "Jelentés Generátor", path: "/reports", show: true},
    {
      icon: Users,
      label: "HR / Személyügy",
      path: "/hr",
      show: profile.system_role === 'admin' || profile.system_role === 'supervisor'
    },
    {
      icon: ShieldAlert,
      label: "Nyomozó Iroda (MCB)",
      path: "/mcb",
      show: profile.system_role === 'admin' || profile.division === 'MCB'
    },
    {icon: Truck, label: "Logisztika", path: "/logistics", show: true},
    {icon: Banknote, label: "Pénzügy", path: "/finance", show: true},
    {icon: FileText, label: "Dokumentáció", path: "/resources", show: true},
  ];

  const statusClass = `status-${alertLevel}`;

  return (
    <div className={cn("min-h-screen bg-slate-950 text-slate-100 flex transition-colors duration-700", statusClass)}>
      <div className="fixed inset-0 pointer-events-none z-0 transition-all duration-700"
           style={{background: 'var(--status-glow)'}}/>

      <aside
        className="hidden lg:flex w-64 flex-col border-r bg-slate-900/50 fixed h-full z-20 backdrop-blur-xl transition-colors duration-700"
        style={{borderColor: 'var(--status-border)'}}>
        <div className="h-16 flex items-center px-6 border-b transition-colors duration-700"
             style={{borderColor: 'var(--status-border)'}}>
          <ShieldAlert className="h-8 w-8 mr-3 transition-colors duration-700 drop-shadow-md"
                       style={{color: 'var(--status-accent)'}}/>
          <span className="font-bold text-lg tracking-wider text-white transition-colors duration-700">
            SFSD <span style={{color: 'var(--status-accent)'}}>INTRA</span>
          </span>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto scrollbar-hide">
          {menuItems.map((item) => item.show && (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative overflow-hidden",
                location.pathname.startsWith(item.path) ? "bg-slate-800" : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
              )}
              style={location.pathname.startsWith(item.path) ? {color: 'var(--status-accent)'} : {}}
            >
              {location.pathname.startsWith(item.path) && (
                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-r-full transition-colors duration-700"
                     style={{backgroundColor: 'var(--status-accent)'}}/>
              )}
              <item.icon
                className={cn("h-5 w-5 mr-3 transition-colors duration-300", !location.pathname.startsWith(item.path) && "group-hover:text-slate-200")}
                style={location.pathname.startsWith(item.path) ? {color: 'var(--status-accent)'} : {}}/>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t transition-colors duration-700 bg-slate-900/30"
             style={{borderColor: 'var(--status-border)'}}>

          {/* ÉRTESÍTÉS GOMB */}
          <Link
            to="/notifications"
            className={cn(
              "flex items-center justify-between px-3 py-2.5 mb-3 rounded-lg text-sm font-medium border border-slate-800 bg-slate-900/50 hover:bg-slate-800 hover:border-slate-700 transition-all group",
              location.pathname === '/notifications' && "border-yellow-500/30 bg-yellow-500/10"
            )}
          >
            <div className="flex items-center">
              <Bell
                className={cn("h-4 w-4 mr-3 text-slate-400 group-hover:text-yellow-500 transition-colors", location.pathname === '/notifications' && "text-yellow-500")}/>
              <span
                className={cn("text-slate-300 group-hover:text-white", location.pathname === '/notifications' && "text-yellow-500")}>Értesítések</span>
            </div>
            {unreadCount > 0 && (
              <span
                className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.5)]">
                  {unreadCount}
                </span>
            )}
          </Link>

          {/* PROFIL MENU */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="w-full flex items-center gap-3 hover:bg-slate-800/80 p-2 rounded-lg transition-all cursor-pointer group border border-transparent hover:border-slate-700 outline-none">
                <Avatar className="h-9 w-9 border border-slate-700 transition-colors duration-300"
                        style={{borderColor: 'var(--status-border)'}}>
                  <AvatarImage src={profile.avatar_url}/>
                  <AvatarFallback
                    className="bg-slate-800 text-slate-300 font-bold">{profile.badge_number}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <p
                    className="text-sm font-bold text-white truncate group-hover:text-yellow-500 transition-colors">{profile.full_name}</p>
                  <p className="text-[10px] text-slate-500 truncate uppercase tracking-wide">{profile.faction_rank}</p>
                </div>
                <ChevronUp className="w-4 h-4 text-slate-500 group-hover:text-slate-300"/>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end"
                                 className="w-56 bg-slate-900 border-slate-800 text-slate-200 ml-2 mb-2">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none text-white">{profile.full_name}</p>
                  <p className="text-xs leading-none text-slate-500">{profile.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-slate-800"/>
              <DropdownMenuItem onClick={() => navigate('/profile')}
                                className="cursor-pointer focus:bg-slate-800 focus:text-white">
                <User className="mr-2 h-4 w-4"/> <span>Profil</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-800"/>
              <DropdownMenuItem onClick={signOut}
                                className="cursor-pointer text-red-400 focus:text-red-300 focus:bg-red-950/30">
                <LogOut className="mr-2 h-4 w-4"/> <span>Kijelentkezés</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* --- MAIN CONTENT (Mobil) --- */}
      <main className="flex-1 lg:ml-64 flex flex-col min-h-screen transition-all duration-300 relative z-10">
        <header
          className="lg:hidden h-16 border-b bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-4 sticky top-0 z-30 transition-colors duration-700"
          style={{borderColor: 'var(--status-border)'}}>
          <div className="flex items-center">
            <ShieldAlert className="h-6 w-6 mr-2 transition-colors duration-700"
                         style={{color: 'var(--status-accent)'}}/>
            <span className="font-bold text-white">SFSD</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X className="h-6 w-6"/> : <Menu className="h-6 w-6"/>}
          </Button>
        </header>

        {isMobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-20 bg-slate-950/95 pt-20 px-4 space-y-2">
            {menuItems.map((item) => item.show && (
              <Link key={item.path} to={item.path} onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center px-4 py-4 rounded-xl text-base font-medium border border-transparent text-slate-400 hover:bg-slate-900">
                <item.icon className="h-6 w-6 mr-4"/>
                {item.label}
              </Link>
            ))}
            <Link to="/notifications" onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-between px-4 py-4 rounded-xl text-base font-medium border border-transparent text-yellow-500 bg-yellow-900/10">
              <div className="flex items-center"><Bell className="h-6 w-6 mr-4"/> Értesítések</div>
              {unreadCount > 0 &&
                <span className="bg-red-600 text-white px-2 rounded-full text-sm">{unreadCount}</span>}
            </Link>
            <Button variant="destructive" className="w-full mt-8 py-6 text-lg" onClick={signOut}>
              <LogOut className="h-6 w-6 mr-2"/> Kijelentkezés
            </Button>
          </div>
        )}

        <div className="flex-1 p-4 md:p-8 lg:p-10">
          <Outlet/>
        </div>
      </main>
    </div>
  );
}