import {Suspense, useCallback, useEffect, useState} from "react";
import {Link, Navigate, Outlet, useLocation, useNavigate} from "react-router";
import {
  BellRing, ChevronsLeft, ChevronsRight, Loader2, LogOut, Menu, RotateCcw, Search, Sparkles, User,
} from "lucide-react";
import {useAuth} from "@/context/AuthContext";
import {useSystemStatus} from "@/context/SystemStatusContext";
import {NotificationsProvider, useNotifications} from "@/context/NotificationsContext";
import {LoadingScreen} from "@/components/ui/loading-screen";
import {PendingApprovalPage} from "@/pages/auth/PendingApprovalPage";
import {PageErrorBoundary} from "@/components/PageErrorBoundary";
import {Button} from "@/components/ui/button";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {Sheet, SheetContent, SheetTitle} from "@/components/ui/sheet";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";
import {NotificationBell} from "@/components/notifications/NotificationBell";
import {CommandPalette} from "@/components/layout/CommandPalette";
import {SystemStatusMenu} from "@/components/layout/SystemStatusMenu";
import {AppBackdrop} from "@/components/layout/AppBackdrop";
import {SheriffStar} from "@/components/brand/SheriffStar";
import {useChangelogUnseen} from "@/lib/changelog";
import {ALERT_LEVELS} from "@/lib/alert-levels";
import {getOptimizedAvatarUrl} from "@/lib/cloudinary";
import {cn} from "@/lib/utils";
import {pageTitleFor, visibleSections} from "./navigation";
import type {Profile} from "@/types/supabase";

const COLLAPSED_KEY = "frakhub:sidebar-collapsed";

/** Inline fallback while a page chunk loads, so the shell stays on screen. */
export const PageLoader = () => (
  <div className="flex flex-1 items-center justify-center py-24">
    <Loader2 className="h-8 w-8 animate-spin text-primary/70"/>
  </div>
);

export function AppLayout() {
  const {profile, signOut, loading, profileError, refreshProfile} = useAuth();

  if (loading) return <LoadingScreen/>;
  if (profileError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="panel w-full max-w-sm space-y-5 p-8 text-center">
          <h1 className="text-lg font-semibold text-white">A profil betöltése nem sikerült</h1>
          <p className="text-sm text-muted-foreground">Ellenőrizd az internetkapcsolatot, majd próbáld újra.</p>
          <div className="flex justify-center gap-3">
            <Button onClick={() => void refreshProfile()}>
              <RotateCcw className="size-4"/> Újra
            </Button>
            <Button variant="ghost" onClick={() => void signOut()}>Kijelentkezés</Button>
          </div>
        </div>
      </div>
    );
  }
  if (!profile) return <Navigate to="/login" replace/>;
  if (profile.system_role === "pending") return <PendingApprovalPage/>;

  return (
    <NotificationsProvider>
      <Shell profile={profile} signOut={signOut}/>
    </NotificationsProvider>
  );
}

function Shell({profile, signOut}: {profile: Profile; signOut: () => Promise<void>}) {
  const location = useLocation();
  const navigate = useNavigate();
  const {alertLevel} = useSystemStatus();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === "1");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const showChrome = location.pathname !== "/onboarding";
  const statusColor = ALERT_LEVELS[alertLevel].color;

  useEffect(() => {
    document.documentElement.style.setProperty("--status-color", statusColor);
    document.documentElement.style.setProperty("--status-glow", `${statusColor}80`);
  }, [statusColor]);

  // Trainees finish onboarding before anything else.
  useEffect(() => {
    if (profile.faction_rank === "Deputy Sheriff Trainee" && !profile.onboarding_completed) {
      if (location.pathname !== "/onboarding") navigate("/onboarding", {replace: true});
    } else if (location.pathname === "/onboarding") {
      navigate("/", {replace: true});
    }
  }, [profile, navigate, location.pathname]);

  // Ctrl+K / ⌘K opens the quick search anywhere.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((value) => {
      localStorage.setItem(COLLAPSED_KEY, value ? "0" : "1");
      return !value;
    });
  }, []);

  return (
    <div className="relative flex min-h-screen text-slate-100 selection:bg-primary/30">
      <div className="contents print:hidden">
        <AppBackdrop/>
        <div className="status-line-top"/>
      </div>

      {showChrome && (
        <aside className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r bg-gradient-to-b from-[#0a1324]/65 via-[#060b16]/60 to-[#060b16]/75 backdrop-blur-2xl transition-[width] duration-300 lg:flex print:hidden",
          collapsed ? "w-[76px]" : "w-64",
        )}>
          <Brand collapsed={collapsed}/>
          <SidebarNav profile={profile} collapsed={collapsed} tour/>
          <div className="border-t p-3">
            <button
              type="button"
              onClick={toggleCollapsed}
              className={cn(
                "flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-200",
                collapsed && "justify-center px-0",
              )}
              title={collapsed ? "Menü kinyitása" : "Menü összecsukása"}
            >
              {collapsed ? <ChevronsRight className="size-4"/> : <><ChevronsLeft className="size-4"/> Összecsukás</>}
            </button>
          </div>
        </aside>
      )}

      <div className={cn("flex min-w-0 flex-1 flex-col transition-[padding] duration-300 print:pl-0", showChrome && (collapsed ? "lg:pl-[76px]" : "lg:pl-64"))}>
        {showChrome && (
          <header data-shell-header="" className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-[#050913]/60 px-3 backdrop-blur-2xl sm:gap-3 sm:px-5 print:hidden">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Menü" data-tour="menu-button">
              <Menu className="size-5"/>
            </Button>
            <h2 className="min-w-0 truncate text-sm font-semibold text-white">{pageTitleFor(location.pathname)}</h2>

            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Gyorskereső"
              data-tour="search"
              className="ml-auto flex h-9 items-center gap-2 rounded-lg border bg-white/[0.03] px-2.5 text-sm text-slate-500 transition-colors hover:border-white/20 hover:text-slate-300 md:w-72 md:px-3"
            >
              <Search className="size-4"/>
              <span className="hidden md:inline">Keresés…</span>
              <kbd className="ml-auto hidden rounded border bg-white/5 px-1.5 text-[10px] font-medium text-slate-400 md:inline">Ctrl K</kbd>
            </button>

            <SystemStatusMenu/>
            <NotificationBell/>
            <UserMenu profile={profile} signOut={signOut}/>
          </header>
        )}

        <main className="relative flex min-w-0 flex-1 flex-col p-4 md:p-6 lg:p-8 print:p-0">
          {/* Pages never stretch past ~1800 px; sparse pages set a narrower width themselves. */}
          <div key={location.pathname.split("/")[1]} className="page-enter mx-auto flex w-full max-w-[1800px] min-w-0 flex-1 flex-col">
            <PageErrorBoundary key={location.pathname}>
              <Suspense fallback={<PageLoader/>}>
                <Outlet/>
              </Suspense>
            </PageErrorBoundary>
          </div>
        </main>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 bg-[#060b16]/95 p-0 backdrop-blur-2xl">
          <SheetTitle className="sr-only">Navigáció</SheetTitle>
          <Brand collapsed={false}/>
          <SidebarNav profile={profile} collapsed={false} onNavigate={() => setMobileOpen(false)}/>
        </SheetContent>
      </Sheet>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen}/>
    </div>
  );
}

function Brand({collapsed}: {collapsed: boolean}) {
  const {alertLevel} = useSystemStatus();
  const level = ALERT_LEVELS[alertLevel];
  return (
    <Link to="/dashboard" className={cn("group/brand flex h-14 shrink-0 items-center gap-3 border-b px-5", collapsed && "justify-center px-0")}>
      <SheriffStar className="size-9 shrink-0 drop-shadow-[0_0_10px_rgb(234_179_8/0.35)] transition-transform duration-500 group-hover/brand:rotate-[51deg]"/>
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-bold tracking-tight text-white">SFSD Intranet</p>
          <p className={cn("truncate text-[11px] font-medium", level.text)}>{level.label}</p>
        </div>
      )}
    </Link>
  );
}

function SidebarNav({profile, collapsed, onNavigate, tour}: {profile: Profile; collapsed: boolean; onNavigate?: () => void; tour?: boolean}) {
  const location = useLocation();
  const {unreadCount} = useNotifications();

  return (
    <nav data-tour={tour ? "nav" : undefined} className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {visibleSections(profile).map((section) => (
        <div key={section.label}>
          {!collapsed && (
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{section.label}</p>
          )}
          {collapsed && <div className="mx-auto mb-2 h-px w-8 bg-white/5"/>}
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const active = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
              const badge = item.path === "/notifications" && unreadCount > 0 ? unreadCount : 0;
              const link = (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onNavigate}
                  data-tour={tour ? `nav-${item.path.slice(1)}` : undefined}
                  className={cn(
                    "group relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                    collapsed && "justify-center px-0",
                    active ? "bg-gradient-to-r from-white/[0.08] to-white/[0.02] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100",
                  )}
                >
                  {active && <span className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-r-full bg-[var(--status-color)] shadow-[0_0_12px_var(--status-color)]"/>}
                  <item.icon className={cn("size-[18px] shrink-0 transition-transform duration-200 group-hover:scale-110",
                    active ? "text-[var(--status-color)] drop-shadow-[0_0_6px_var(--status-glow)]" : "text-slate-500 group-hover:text-slate-300")}/>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {badge > 0 && (
                    <span className={cn(
                      "grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground tabular-nums",
                      collapsed ? "absolute top-0.5 right-2" : "ml-auto",
                    )}>
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </Link>
              );
              return collapsed ? (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : link;
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function UserMenu({profile, signOut}: {profile: Profile; signOut: () => Promise<void>}) {
  const navigate = useNavigate();
  const unseen = useChangelogUnseen();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Fiók" data-tour="user-menu"
                className="flex items-center gap-2 rounded-full p-0.5 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:pr-2">
          <Avatar className="size-8 ring-1 ring-white/10">
            <AvatarImage src={getOptimizedAvatarUrl(profile.avatar_url, 64) || undefined} alt=""/>
            <AvatarFallback className="bg-slate-800 text-xs font-semibold text-slate-200">{profile.full_name.charAt(0)}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[140px] truncate text-sm font-medium text-slate-200 xl:block">{profile.full_name}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-semibold text-white">{profile.full_name}</p>
          <p className="truncate text-xs text-muted-foreground">#{profile.badge_number} · {profile.faction_rank}</p>
          {profile.email && <p className="truncate text-xs text-slate-500">{profile.email}</p>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator/>
        <DropdownMenuItem onSelect={() => navigate("/profile")} data-tour="user-menu-profile">
          <User/> Profilom
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate("/notifications?view=settings")}>
          <BellRing/> Értesítési beállítások
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate("/changelog")}>
          <Sparkles/> Újdonságok
          {unseen && <span className="ml-auto size-2 rounded-full bg-primary shadow-[0_0_8px_rgb(234_179_8/0.8)]" aria-label="Új"/>}
        </DropdownMenuItem>
        <DropdownMenuSeparator/>
        <DropdownMenuItem variant="destructive" onSelect={() => void signOut()}>
          <LogOut/> Kijelentkezés
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
