import { Outlet, Navigate, useLocation, Link } from "react-router-dom"; // Link importálva
import { useAuth } from "@/context/AuthContext";
import { Loader2, Shield, UserCog, LogOut } from "lucide-react"; // Ikonok importálva
import { Button } from "@/components/ui/button"; // Button importálva

export function McbLayout() {
  const { profile, isLoading, session, logout } = useAuth();
  const location = useLocation();

  // --- DEBUG TESZTEK (ILLESZD BE A FÜGGVÉNY ELEJÉRE) ---
  console.log("DEBUG 13: McbLayout: Renderelés INDUL. Állapotok:", {
    isLoading, // Az AuthContext tölt?
    hasSession: !!session,
    hasProfile: !!profile,
    profileRole: profile?.role,
    path: location.pathname
  });
  // --- EDDIG ---

  // 1. Töltés állapot
  if (isLoading) {
    console.log("DEBUG 14: McbLayout: DÖNTÉS -> 1. Töltés állapot (return Loader2)");
    return (
      <div className="flex h-screen w-full items-center justify-center text-white">
        <Loader2 className="h-16 w-16 animate-spin" />
      </div>
    );
  }

  // 2. Nincs bejelentkezve
  if (!session) {
    console.log("DEBUG 15: McbLayout: DÖNTÉS -> 2. Nincs session (return Navigate to /mcb/login)");
    return <Navigate to="/mcb/login" state={{ from: location }} replace />;
  }

  // 3. Be van jelentkezve, de a profil még tölt (ritka eset) vagy nincs
  if (!profile) {
    // Az AuthContextnek ezt már kezelnie kellett volna (DEBUG 9),
    // de ez egy biztonsági háló.
    console.error("DEBUG 16: McbLayout: DÖNTÉS -> 3. Van session, de NINCS profil! (return Navigate to /mcb/login)");
    logout(); // Kijelentkeztetés, hogy ne legyen hurok
    return <Navigate to="/mcb/login" replace />;
  }

  // 4. Be van jelentkezve, de "pending" státuszú
  if (profile.role === "pending") {
    // Ha a pending oldalon van, ott marad
    if (location.pathname === "/mcb/pending") {
      console.log("DEBUG 17: McbLayout: DÖNTÉS -> 4a. Pending státusz, /mcb/pending oldalon (return Outlet)");
      return <Outlet />; // Engedjük a /mcb/pending oldalt megjelenni
    }
    // Ha máshova (pl. /mcb) akarna menni, átirányítjuk
    console.log("DEBUG 18: McbLayout: DÖNTÉS -> 4b. Pending státusz, rossz oldalon (return Navigate to /mcb/pending)");
    return <Navigate to="/mcb/pending" replace />;
  }

  // 5. Be van jelentkezve, és rangja van (detective, lead_detective)
  // DE véletlenül a /mcb/pending oldalra téved
  if (location.pathname === "/mcb/pending") {
    console.log("DEBUG 19: McbLayout: DÖNTÉS -> 5. Rangja van, de a /mcb/pending oldalon (return Navigate to /mcb)");
    return <Navigate to="/mcb" replace />;
  }

  // MINDEN RENDBEN: Be van jelentkezve ÉS van rangja
  console.log("DEBUG 20: McbLayout: DÖNTÉS -> 6. SIKER (return Outlet)");
  return (
    <div className="text-white min-h-screen flex flex-col">
      {/* JAVÍTOTT FEJLÉC NAVIGÁCIÓVAL */}
      <header className="p-4 bg-slate-800 rounded-lg mb-4 flex justify-between items-center">
        {/* Bal oldal: Navigáció */}
        <nav className="flex items-center gap-4">
          <Link
            to="/mcb"
            className="flex items-center gap-2 text-lg font-semibold text-white hover:text-slate-300"
          >
            <Shield className="w-5 h-5" /> MCB Irányítópult
          </Link>

          {/* KIZÁRÓLAG ADMINOKNAK MEGJELENŐ LINK */}
          {profile.role === 'lead_detective' && (
            <Link
              to="/mcb/admin"
              className="flex items-center gap-2 text-lg font-semibold text-white hover:text-slate-300"
            >
              <UserCog className="w-5 h-5" /> Felhasználókezelés
            </Link>
          )}

          {/* Ide jöhetnek majd a "Saját Akták" stb. linkek */}
        </nav>

        {/* Jobb oldal: Profil és Kijelentkezés */}
        <div className="flex items-center gap-4">
           <span className="text-sm text-slate-400 hidden md:block">
            Bejelentkezve: <strong>{profile.full_name}</strong>
          </span>
          <Button
            variant="destructive"
            onClick={logout}
          >
            <LogOut className="w-4 h-4 mr-2" /> Kijelentkezés
          </Button>
        </div>
      </header>
      <main className="flex-1 flex flex-col min-h-0">
        <Outlet />
      </main>
    </div>
  );
}