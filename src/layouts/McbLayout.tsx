import { Outlet, Navigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {Loader2, Shield, UserCog, LogOut, LayoutGrid, UserX} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function McbLayout() {
  const { profile, loading, session, signOut } = useAuth();
  const location = useLocation();

  // 1. Töltés
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-white">
        <Loader2 className="h-16 w-16 animate-spin text-yellow-500" />
      </div>
    );
  }

  // 2. Nincs bejelentkezve
  if (!session || !profile) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. JOGOSULTSÁG ELLENŐRZÉS (JAVÍTVA)
  // Akkor léphet be, ha: MCB tag VAGY Admin VAGY Supervisor
  const hasAccess =
    profile.division === 'MCB' ||
    profile.system_role === 'admin' ||
    profile.system_role === 'supervisor';

  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  // Admin link láthatósága (Admin vagy Supervisor)
  const isAdmin = profile.system_role === 'admin' || profile.system_role === 'supervisor';

  const mcbLinks = [
    { path: "/mcb", label: "Áttekintés", icon: LayoutGrid },
    { path: "/mcb/suspects", label: "Gyanúsítottak", icon: UserX },
  ];

  if (isAdmin) {
    mcbLinks.push({ path: "/mcb/admin", label: "Adminisztráció", icon: UserCog });
  }

  return (
    <div className="text-slate-100 min-h-screen flex flex-col bg-slate-950">
      {/* Fejléc */}
      <header className="p-4 md:p-6 border-b border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-40">

        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center border border-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.1)]">
            <Shield className="w-6 h-6 text-yellow-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Major Crimes Bureau</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Nyomozói Adatbázis</p>
          </div>
        </div>

        {/* Navigáció */}
        <nav className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-hide">
          {mcbLinks.map(link => {
            const isActive = location.pathname === link.path || (link.path !== '/mcb' && location.pathname.startsWith(link.path));
            return (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all border whitespace-nowrap",
                  isActive
                    ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20 shadow-sm"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 hover:border-slate-700"
                )}
              >
                <link.icon className="w-4 h-4" />
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-4 hidden md:flex">
          <div className="text-right">
            <p className="text-sm font-medium text-white">{profile.full_name}</p>
            <p className="text-xs text-slate-500">{profile.faction_rank}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} className="text-slate-400 hover:text-red-400 hover:bg-red-950/20">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 md:p-8 animate-in fade-in duration-500">
        <Outlet />
      </main>
    </div>
  );
}