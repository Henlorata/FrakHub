import { Link, NavLink, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { Menu, Shield } from "lucide-react";

export function SfsdLayout() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-950 text-white">
      {/* Felső navigációs sáv */}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-slate-800 bg-slate-950/95 px-4 backdrop-blur-sm md:px-6">

        {/* Logó (Link a főoldalra) */}
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <Shield className="h-6 w-6 text-blue-500" />
          <span className="">FrakHub</span>
        </Link>

        {/* Desktop Navigáció (elrejtve mobilon) */}
        <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6 ml-auto">
          <NavLink
            to="/sfsd"
            end // Fontos: 'end' biztosítja, hogy csak a /sfsd legyen aktív, a /sfsd/penalcode ne
            className={({ isActive }) =>
              `transition-colors hover:text-white ${isActive ? "text-white font-bold" : "text-slate-400"}`
            }
          >
            SFSD Kezdőlap
          </NavLink>
          <NavLink
            to="/sfsd/penalcode"
            className={({ isActive }) =>
              `transition-colors hover:text-white ${isActive ? "text-white font-bold" : "text-slate-400"}`
            }
          >
            Büntetés Kalkulátor
          </NavLink>
          {/* ÚJ MENÜPONT: */}
          <NavLink
            to="/sfsd/szabalyzat"
            className={({ isActive }) =>
              `transition-colors hover:text-white ${isActive ? "text-white font-bold" : "text-slate-400"}`
            }
          >
            Szabályzat
          </NavLink>
        </nav>

        {/* Mobil Navigáció (Sheet) */}
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="ml-auto shrink-0 md:hidden"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Navigációs menü</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="bg-slate-950 border-slate-800">
            <nav className="grid gap-6 text-lg font-medium mt-8">
              <SheetClose asChild>
                <NavLink
                  to="/sfsd"
                  end
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-white ${isActive ? "text-white bg-slate-800" : "text-slate-400"}`
                  }
                >
                  SFSD Kezdőlap
                </NavLink>
              </SheetClose>
              <SheetClose asChild>
                <NavLink
                  to="/sfsd/penalcode"
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-white ${isActive ? "text-white bg-slate-800" : "text-slate-400"}`
                  }
                >
                  Büntetés Kalkulátor
                </NavLink>
              </SheetClose>
              {/* ÚJ MOBIL MENÜPONT: */}
              <SheetClose asChild>
                <NavLink
                  to="/sfsd/szabalyzat"
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-white ${isActive ? "text-white bg-slate-800" : "text-slate-400"}`
                  }
                >
                  Szabályzat
                </NavLink>
              </SheetClose>
            </nav>
          </SheetContent>
        </Sheet>
      </header>

      {/* Oldal tartalma */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}