import {useState, useEffect, useCallback} from "react";
import {Outlet, Link, useLocation, Navigate, useNavigate} from "react-router-dom";
import {useAuth} from "@/context/AuthContext";
import {useSystemStatus} from "@/context/SystemStatusContext";
import {LoadingScreen} from "@/components/ui/loading-screen";
import {PendingApprovalPage} from "@/pages/auth/PendingApprovalPage";
import {
  LayoutDashboard, Users, ShieldAlert, Truck, LogOut, Menu, X,
  Banknote, Gavel, Bell, User, ClipboardPen, ClipboardList,
  Settings, Shield, GraduationCap, School, ChevronDown, ChevronLeft, ChevronRight
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {canViewCaseList, cn} from "@/lib/utils";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {getOptimizedAvatarUrl} from "@/lib/cloudinary";

const ModernAmbientBackground = () => (
  <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden bg-[#02040a]">
    <div className="absolute inset-0 bg-gradient-to-b from-[#050a14] via-[#02040a] to-black"></div>
    <div className="ambient-light bg-blue-900/20 w-[500px] h-[500px] -top-20 -left-20 animate-pulse"
         style={{animationDuration: '8s'}}></div>
    <div className="ambient-light bg-yellow-900/10 w-[600px] h-[600px] -bottom-40 -right-20 animate-pulse"
         style={{animationDuration: '12s'}}></div>
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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({'education': true});

  const showSidebar = location.pathname !== '/onboarding';

  const getStatusColor = () => {
    switch (alertLevel) {
      case 'traffic': return '#f97316';
      case 'border': return '#ef4444';
      case 'tactical': return '#dc2626';
      default: return '#eab308';
    }
  };
  const statusColor = getStatusColor();

  useEffect(() => {
    document.documentElement.style.setProperty('--status-color', statusColor);
    document.documentElement.style.setProperty('--status-glow', `${statusColor}80`);
  }, [alertLevel, statusColor]);

  useEffect(() => {
    if (loading || !profile) return;
    if (profile.faction_rank === 'Deputy Sheriff Trainee' && !profile.onboarding_completed) {
      if (location.pathname !== '/onboarding') navigate('/onboarding', {replace: true});
    } else if (location.pathname === '/onboarding') {
      navigate('/', {replace: true});
    }
  }, [profile, loading, navigate, location.pathname]);

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

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`user-notifications-${user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}`
      }, () => setTimeout(() => fetchUnreadCount(), 100))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, supabase, fetchUnreadCount]);

  if (loading) return <LoadingScreen/>;
  if (!profile) return <Navigate to="/login" replace/>;
  if (profile.system_role === 'pending') return <PendingApprovalPage/>;

  const menuItems = [
    {icon: LayoutDashboard, label: "Irányítópult", path: "/dashboard", show: true},
    {type: 'divider', label: 'Operatív'},
    {icon: ShieldAlert, label: "Nyomozó Iroda", path: "/mcb", show: canViewCaseList(profile)},
    {icon: Truck, label: "Logisztika", path: "/logistics", show: true},
    {icon: Banknote, label: "Pénzügy", path: "/finance", show: true},
    {type: 'divider', label: 'Adminisztráció'},
    {
      type: 'group', id: 'education', label: 'Oktatás', icon: GraduationCap, show: true,
      children: [
        {icon: School, label: "Akadémia", path: "/academy", show: true},
        {icon: ClipboardList, label: "Vizsgaközpont", path: "/exams", show: true},
      ]
    },
    {icon: Gavel, label: "Kalkulátor", path: "/calculator", show: true},
    {icon: ClipboardPen, label: "Jelentések", path: "/reports", show: true},
    {icon: Users, label: "Személyügy", path: "/hr", show: true},
  ];

  const toggleGroup = (id: string) => {
    if (isCollapsed) setIsCollapsed(false);
    setOpenGroups(prev => ({...prev, [id]: !prev[id]}));
  };

  return (
    <div className="min-h-screen text-slate-100 flex font-sans selection:bg-yellow-500/30 relative">
      <ModernAmbientBackground/>
      <div className="status-line-top"></div>

      {showSidebar && (
        <aside className={cn(
          "hidden lg:flex flex-col fixed inset-y-0 left-0 z-40 glass-panel shadow-2xl transition-all duration-300",
          isCollapsed ? "w-20" : "w-72"
        )}>
          {/* Collapse Toggle Button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute -right-3 top-6 w-6 h-6 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full flex items-center justify-center z-50 transition-colors"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-300"/> : <ChevronLeft className="w-4 h-4 text-slate-300"/>}
          </button>

          <div className={cn("relative h-20 flex items-center border-b border-white/5 shrink-0 transition-all", isCollapsed ? "justify-center px-0" : "px-6")}>
            <div className={cn("w-10 h-10 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shadow-[0_0_15px_rgba(234,179,8,0.2)] shrink-0", !isCollapsed && "mr-4")}>
              <Shield className="text-yellow-500 h-6 w-6"/>
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden whitespace-nowrap">
                <h1 className="font-bold text-xl tracking-tight text-white leading-none">SFSD <span style={{color: statusColor}}>INTRA</span></h1>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{backgroundColor: statusColor}}></div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Online</p>
                </div>
              </div>
            )}
          </div>

          <nav className="relative flex-1 py-6 px-3 space-y-1 overflow-y-auto custom-scrollbar">
            {menuItems.map((item: any, idx) => {
              if (!item.show) return null;

              if (item.type === 'divider') {
                return isCollapsed ? (
                  <div key={idx} className="my-4 h-px bg-white/10 mx-2"></div>
                ) : (
                  <div key={idx} className="mt-6 mb-2 px-3 flex items-center gap-2">
                    <div className="h-px bg-white/10 flex-1"></div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest whitespace-nowrap">{item.label}</span>
                  </div>
                );
              }

              if (item.type === 'group') {
                const isOpen = openGroups[item.id] && !isCollapsed;
                const isGroupActive = item.children.some((child: any) => location.pathname.startsWith(child.path));

                return (
                  <div key={idx} className="space-y-1">
                    <button
                      onClick={() => toggleGroup(item.id)}
                      title={isCollapsed ? item.label : undefined}
                      className={cn(
                        "w-full flex items-center rounded-lg text-sm font-medium transition-all duration-300 group relative",
                        isCollapsed ? "justify-center p-3" : "justify-between px-3 py-3",
                        isGroupActive ? "text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <div className="flex items-center">
                        <item.icon className={cn("h-5 w-5 transition-colors duration-300", !isCollapsed && "mr-3", isGroupActive ? "text-white" : "text-slate-500 group-hover:text-slate-300")} style={isGroupActive ? {color: statusColor} : {}}/>
                        {!isCollapsed && <span className="tracking-wide whitespace-nowrap">{item.label}</span>}
                      </div>
                      {!isCollapsed && <ChevronDown className={cn("h-4 w-4 transition-transform text-slate-500 shrink-0", isOpen && "rotate-180")}/>}
                    </button>

                    {isOpen && !isCollapsed && (
                      <div className="pl-4 space-y-1 animate-in slide-in-from-top-2 duration-200">
                        {item.children.map((child: any) => {
                          const isChildActive = location.pathname.startsWith(child.path);
                          return (
                            <Link key={child.path} to={child.path} className={cn("flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 relative", isChildActive ? "nav-item-active text-white bg-white/5" : "text-slate-400 hover:text-white hover:bg-white/5")}>
                              <child.icon className={cn("h-4 w-4 mr-3 transition-colors shrink-0", isChildActive ? "text-sky-500" : "text-slate-600")}/>
                              <span className="whitespace-nowrap">{child.label}</span>
                              {isChildActive && <div className="absolute left-0 w-1 h-4 rounded-r bg-sky-500"/>}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path} to={item.path} title={isCollapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center rounded-lg text-sm font-medium transition-all duration-300 group relative",
                    isCollapsed ? "justify-center p-3" : "justify-between px-3 py-3",
                    isActive ? "nav-item-active text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center">
                    <item.icon className={cn("h-5 w-5 transition-colors duration-300 shrink-0", !isCollapsed && "mr-3", isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300")} style={isActive ? {color: statusColor} : {}}/>
                    {!isCollapsed && <span className="tracking-wide whitespace-nowrap">{item.label}</span>}
                  </div>
                  {!isCollapsed && isActive && <div className="w-1.5 h-1.5 rounded-full shrink-0 shadow-[0_0_5px_currentColor]" style={{backgroundColor: statusColor}}/>}
                </Link>
              );
            })}
          </nav>

          <div className="relative p-3 border-t border-white/5 bg-black/20 flex flex-col gap-3">
            <Link to="/notifications" title={isCollapsed ? "Értesítések" : undefined}>
              <div className={cn(
                "flex items-center rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 transition-all cursor-pointer group",
                isCollapsed ? "justify-center p-3" : "p-3",
                unreadCount > 0 && "border-red-500/30 bg-red-500/10"
              )}>
                <div className="relative shrink-0">
                  <Bell className={cn("w-5 h-5 text-slate-400 group-hover:text-white transition-colors", unreadCount > 0 && "text-red-400 animate-pulse")}/>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                    </span>
                  )}
                </div>
                {!isCollapsed && (
                  <>
                    <span className="ml-3 text-xs font-bold text-slate-300 group-hover:text-white uppercase tracking-wider whitespace-nowrap">Értesítések</span>
                    {unreadCount > 0 && <span className="ml-auto text-xs font-bold text-red-400">{unreadCount} DB</span>}
                  </>
                )}
              </div>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn(
                  "flex items-center group outline-none hover:bg-white/5 rounded-lg transition-colors",
                  isCollapsed ? "justify-center p-2" : "w-full gap-3 p-2"
                )}>
                  <Avatar className="h-9 w-9 shrink-0 border border-slate-700 transition-colors duration-500">
                    <AvatarImage src={getOptimizedAvatarUrl(profile.avatar_url, 100) || ""}/>
                    <AvatarFallback className="bg-slate-800 text-slate-200 font-bold">{profile.badge_number}</AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <>
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-bold text-white truncate group-hover:text-yellow-500 transition-colors">{profile.full_name}</p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider truncate">{profile.faction_rank}</p>
                      </div>
                      <Settings className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors shrink-0"/>
                    </>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-60 bg-[#0f172a] border-slate-800 text-slate-200 ml-4 mb-2 shadow-2xl p-1 rounded-lg">
                <DropdownMenuLabel className="font-normal p-2">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-bold text-white">{profile.full_name}</p>
                    <p className="text-xs text-slate-500 font-mono">{profile.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-800"/>
                <DropdownMenuItem onClick={() => navigate('/profile')} className="cursor-pointer focus:bg-slate-800 focus:text-white py-2.5 rounded-md">
                  <User className="mr-2 h-4 w-4 text-yellow-500"/> <span className="font-medium text-xs uppercase tracking-wider">Személyes Profil</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut} className="cursor-pointer text-red-400 focus:text-red-300 focus:bg-red-950/20 py-2.5 rounded-md">
                  <LogOut className="mr-2 h-4 w-4"/> <span className="font-medium text-xs uppercase tracking-wider">Kijelentkezés</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>
      )}

      <main className={cn("flex-1 flex flex-col min-h-screen relative z-10 transition-all duration-300", showSidebar ? (isCollapsed ? "lg:ml-20" : "lg:ml-72") : "")}>
        {showSidebar && (
          <header className="lg:hidden h-16 border-b border-white/10 bg-[#02040a]/90 backdrop-blur-md flex items-center justify-between px-4 sticky top-0 z-30">
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-yellow-500"/>
              <span className="font-black text-white tracking-tight">SFSD INTRA</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-white hover:bg-white/10">
              {isMobileMenuOpen ? <X className="h-6 w-6"/> : <Menu className="h-6 w-6"/>}
            </Button>
          </header>
        )}

        {showSidebar && isMobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-[#02040a] p-4 animate-in slide-in-from-top-5 duration-200">
            {/* ... (meghagytam az eredeti mobilos menüt) ... */}
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-black text-white">MENÜ</h2>
              <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)}>
                <X className="h-6 w-6 text-slate-400"/>
              </Button>
            </div>
            <div className="space-y-2 overflow-y-auto h-[80vh] custom-scrollbar">
              {menuItems.map((item: any, idx) => {
                if (!item.show) return null;
                if (item.type === 'divider') return <div key={idx} className="text-xs font-bold text-slate-600 uppercase tracking-widest mt-4 mb-2 border-b border-white/5 pb-1">{item.label}</div>;

                if (item.type === 'group') {
                  return (
                    <div key={idx} className="space-y-2 mt-2">
                      <div className="text-xs font-bold text-slate-500 px-4 uppercase">{item.label}</div>
                      {item.children.map((child: any) => (
                        <Link key={child.path} to={child.path} onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-4 rounded-lg bg-white/5 text-slate-200 font-medium pl-8">
                          <child.icon className="h-5 w-5 mr-3"/>{child.label}
                        </Link>
                      ))}
                    </div>
                  )
                }

                return (
                  <Link key={item.path} to={item.path} onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-4 rounded-lg bg-white/5 text-slate-200 font-medium active:bg-yellow-500/20 active:text-yellow-500 transition-all border border-transparent active:border-yellow-500/30">
                    <item.icon className="h-5 w-5 mr-3"/>{item.label}
                  </Link>
                )
              })}
              <Button onClick={signOut} variant="destructive" className="w-full mt-8 py-6 font-bold uppercase tracking-wider"><LogOut className="h-5 w-5 mr-2"/> Kijelentkezés</Button>
            </div>
          </div>
        )}

        <div className="flex-1 p-4 md:p-6 lg:p-8 animate-in fade-in slide-in-from-bottom-2 duration-500 relative overflow-hidden flex flex-col">
          <Outlet/>
        </div>
      </main>
    </div>
  );
}