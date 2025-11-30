import {Outlet, Navigate, useLocation, Link} from "react-router-dom";
import {useAuth} from "@/context/AuthContext";
import {Loader2, Shield, UserCog, LayoutGrid, UserX, Fingerprint, Database, ChevronRight} from "lucide-react";
import {cn} from "@/lib/utils";

// --- MCB SPECIFIC BACKGROUND EFFECT ---
const McbNetworkEffect = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
    {/* Kékes "Network" háló overlay */}
    <div className="absolute inset-0 opacity-[0.08]"
         style={{
           backgroundImage: 'radial-gradient(circle, #0ea5e9 1px, transparent 1px)',
           backgroundSize: '30px 30px',
           maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 80%)'
         }}>
    </div>
    {/* Egyedi fényeffekt a jobb sarokban */}
    <div
      className="absolute top-0 right-0 w-[500px] h-[500px] bg-sky-900/10 blur-[100px] rounded-full mix-blend-screen"></div>
  </div>
);

export function McbLayout() {
  const {profile, loading, session} = useAuth();
  const location = useLocation();

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2
    className="h-8 w-8 animate-spin text-sky-500"/></div>;
  if (!session || !profile) return <Navigate to="/login" state={{from: location}} replace/>;

  const hasAccess = profile.division === 'MCB' || profile.system_role === 'admin' || profile.system_role === 'supervisor';
  if (!hasAccess) return <Navigate to="/dashboard" replace/>;

  const isAdmin = profile.system_role === 'admin' || profile.system_role === 'supervisor';

  const mcbLinks = [
    {path: "/mcb", label: "Áttekintés", icon: LayoutGrid, exact: true},
    {path: "/mcb/suspects", label: "Gyanúsítottak", icon: UserX},
    // Ide jöhetnek majd további modulok később (pl. Bizonyíték raktár)
  ];

  if (isAdmin) {
    mcbLinks.push({path: "/mcb/admin", label: "Adminisztráció", icon: UserCog});
  }

  return (
    <div className="relative min-h-full flex flex-col">
      <McbNetworkEffect/>

      {/* --- MCB HEADER MODULE --- */}
      <div className="relative z-10 px-0 pb-6 pt-2">
        <div
          className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-sky-500/10 pb-4 mb-2">

          {/* Címsor & Identity */}
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 bg-sky-950/30 border border-sky-500/20 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(14,165,233,0.1)]">
              <Fingerprint className="w-6 h-6 text-sky-400"/>
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                MCB <span className="text-sky-500">DATABASE</span>
              </h1>
              <p className="text-[10px] text-sky-400/60 uppercase tracking-[0.2em] font-bold">Investigative Division</p>
            </div>
          </div>

          {/* Module Navigation (Tabs) */}
          <nav
            className="flex items-center gap-1 bg-slate-900/40 p-1 rounded-lg border border-white/5 backdrop-blur-md">
            {mcbLinks.map(link => {
              const isActive = link.exact
                ? location.pathname === link.path
                : location.pathname.startsWith(link.path);

              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all",
                    isActive
                      ? "bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-[0_0_10px_rgba(14,165,233,0.1)]"
                      : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                  )}
                >
                  <link.icon className="w-3.5 h-3.5"/>
                  {link.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      <main className="relative z-10 flex-1 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Outlet/>
      </main>
    </div>
  );
}