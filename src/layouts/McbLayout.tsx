import {Suspense} from "react";
import {Link, Navigate, Outlet, useLocation} from "react-router";
import {Fingerprint, LayoutGrid, UserCog, UserX} from "lucide-react";
import {useAuth} from "@/context/AuthContext";
import {SuspectCacheProvider} from "@/context/SuspectCacheContext";
import {canViewCaseList, cn} from "@/lib/utils";
import {PageLoader} from "@/layouts/AppLayout";

/** MCB area shell. AppLayout already guarantees a signed-in, approved profile. */
export function McbLayout() {
  const {profile} = useAuth();
  const location = useLocation();

  // Same rule as the sidebar entry (single source: canViewCaseList).
  if (!profile || !canViewCaseList(profile)) return <Navigate to="/dashboard" replace/>;

  const isAdmin = profile.system_role === 'admin' || profile.system_role === 'supervisor';

  const mcbLinks = [
    {path: "/mcb", label: "Áttekintés", icon: LayoutGrid, exact: true},
    {path: "/mcb/suspects", label: "Gyanúsítottak", icon: UserX},
    ...(isAdmin ? [{path: "/mcb/admin", label: "Adminisztráció", icon: UserCog}] : []),
  ];

  return (
    <SuspectCacheProvider>
      <div className="relative min-h-full flex flex-col">

        {/* Section header: fixed height on desktop (--mcb-header in index.css). */}
        <div className="relative z-10 mb-4 flex flex-col gap-3 md:h-14 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/25">
              <Fingerprint className="size-5"/>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-400">Major Crimes Bureau</p>
              <h1 className="text-xl font-semibold tracking-tight text-white">Nyomozó Iroda</h1>
            </div>
          </div>

          <nav className="inline-flex w-fit items-center gap-1 rounded-lg bg-white/[0.04] p-1 ring-1 ring-white/10">
            {mcbLinks.map(link => {
              const isActive = 'exact' in link && link.exact
                ? location.pathname === link.path
                : location.pathname.startsWith(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={cn(
                    "flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                    isActive ? "bg-sky-500/15 text-sky-300" : "text-slate-400 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <link.icon className="size-4"/>
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <main className="relative z-10 flex-1">
          <Suspense fallback={<PageLoader/>}>
            <Outlet/>
          </Suspense>
        </main>
      </div>
    </SuspectCacheProvider>
  );
}
