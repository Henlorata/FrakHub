import {Suspense} from "react";
import {Link, Navigate, Outlet, useLocation} from "react-router";
import {FolderKanban, Gavel, LayoutTemplate, LineChart, Network, ShieldQuestion, UserSearch, Waypoints} from "lucide-react";
import {useAuth} from "@/context/AuthContext";
import {SuspectCacheProvider} from "@/context/SuspectCacheContext";
import {useBureauCatalog} from "@/lib/bureaus";
import {canViewCaseList, cn} from "@/lib/utils";
import {canViewMcbOverview, isMcbLead} from "@/lib/mcb";
import {PageLoader} from "@/layouts/AppLayout";
import {BRAND_IMAGES} from "@/lib/brand";

/** MCB area shell. AppLayout already guarantees a signed-in, approved profile. */
export function McbLayout() {
  const {profile} = useAuth();
  const location = useLocation();
  // The MCB rights of a bureau rank follow the bureau's own list (the privileged flag).
  useBureauCatalog(!!profile && canViewCaseList(profile));

  // Same rule as the sidebar entry (single source: canViewCaseList).
  if (!profile || !canViewCaseList(profile)) return <Navigate to="/dashboard" replace/>;

  // A case gets the whole height: its own header carries the way back.
  const onCasePage = location.pathname.startsWith("/mcb/case/");

  const links = [
    {path: "/mcb", label: "Akták", icon: FolderKanban, exact: true},
    {path: "/mcb/suspects", label: "Nyilvántartás", icon: UserSearch},
    {path: "/mcb/organizations", label: "Szervezetek", icon: Network},
    {path: "/mcb/graph", label: "Kapcsolati háló", icon: Waypoints},
    {path: "/mcb/warrants", label: "Parancsok", icon: Gavel},
    ...(canViewMcbOverview(profile) ? [{path: "/mcb/admin", label: "Vezetés", icon: LineChart}] : []),
    ...(isMcbLead(profile) ? [{path: "/mcb/templates", label: "Sablonok", icon: LayoutTemplate}] : []),
    // Leads see every informant, handlers (MCB members) their own.
    ...(isMcbLead(profile) || profile.division === "MCB" ? [{path: "/mcb/informants", label: "Informátorok", icon: ShieldQuestion}] : []),
  ];

  return (
    <SuspectCacheProvider>
      <div className="relative flex min-h-full flex-col">
        {!onCasePage && (
          // Fixed height on desktop (--mcb-header in index.css) for the full-height pages.
          <div className="relative z-10 mb-4 flex flex-col gap-3 md:h-14 md:flex-row md:items-center md:justify-between print:hidden">
            <div className="flex items-center gap-3">
              <div className="relative grid size-11 place-items-center">
                <span className="absolute inset-0 rounded-2xl bg-sky-500/20 blur-lg"/>
                <img src={BRAND_IMAGES.mcb} alt="" className="relative size-11 object-contain drop-shadow-[0_0_10px_rgb(56_189_248/0.45)]"/>
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-[0.2em] text-sky-400 uppercase">Major Crimes Bureau</p>
                <h1 className="text-xl font-semibold tracking-tight text-white">Nyomozó Iroda</h1>
              </div>
            </div>

            <nav data-tour="mcb-nav" className="flex w-full items-center gap-1 overflow-x-auto rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/10 md:w-fit">
              {links.map((link) => {
                const active = link.exact ? location.pathname === link.path : location.pathname.startsWith(link.path);
                return (
                  <Link key={link.path} to={link.path}
                        className={cn("flex h-8 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
                          active ? "bg-sky-500/15 text-sky-200 shadow-[inset_0_0_0_1px_rgb(56_189_248/0.3)]"
                            : "text-slate-400 hover:bg-white/5 hover:text-white")}>
                    <link.icon className="size-4"/>
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        <main className="relative z-10 flex flex-1 flex-col">
          <Suspense fallback={<PageLoader/>}>
            <Outlet/>
          </Suspense>
        </main>
      </div>
    </SuspectCacheProvider>
  );
}
