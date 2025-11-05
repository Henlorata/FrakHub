import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react"; // Töltés ikon

export function McbLayout() {
  const { profile, isLoading, session, logout } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center text-white">
        <Loader2 className="h-16 w-16 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/mcb/login" state={{ from: location }} replace />;
  }

  if (!profile) {
    logout();
    return <Navigate to="/mcb/login" replace />;
  }

  if (profile.role === "pending") {
    if (location.pathname === "/mcb/pending") {
      return <Outlet />;
    }
    return <Navigate to="/mcb/pending" replace />;
  }

  if (location.pathname === "/mcb/pending") {
    return <Navigate to="/mcb" replace />;
  }

  return (
    <div className="text-white">
      <header className="p-4 bg-slate-800 rounded-lg mb-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">MCB Rendszer</h1>
          <p className="text-sm text-slate-400">
            Bejelentkezve: <strong>{profile.full_name}</strong> ({profile.role})
          </p>
        </div>
        <button
          onClick={logout}
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
        >
          Kijelentkezés
        </button>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}