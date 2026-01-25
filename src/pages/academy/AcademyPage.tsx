import {useState, useMemo} from "react";
import {useAuth} from "@/context/AuthContext";
import {cn} from "@/lib/utils";
import {
  GraduationCap,
  Siren,
  Crosshair,
  BookOpen,
  ShieldAlert,
  Lock
} from "lucide-react";
import {BasicAcademyView} from "./views/BasicAcademyView";
import {isSupervisory, isHighCommand} from "@/lib/utils"; // Importáljuk a utils-ból

type AcademyView = 'basic' | 'mcb' | 'seb';

export default function AcademyPage() {
  const {profile} = useAuth();
  const [currentView, setCurrentView] = useState<AcademyView>('basic');

  // JOGOSULTSÁG JAVÍTÁSA a utils használatával
  const isInstructor = useMemo(() => {
    if (!profile) return false;

    // FONTOS: Ha Trainee, akkor SEMMIKÉPP nem oktató
    if (profile.faction_rank === 'Deputy Sheriff Trainee') {
      return false;
    }

    // Oktatói feltételek
    if (profile.division === "Training Bureau") return true;
    if (profile.is_bureau_manager) return true;
    if (isSupervisory(profile)) return true;
    if (isHighCommand(profile)) return true;

    return false;
  }, [profile]);

  return (
    <div className="flex h-[calc(100vh-64px)] bg-[#0b1120] overflow-hidden text-slate-200 font-sans">

      {/* SIDEBAR NAVIGATION */}
      <div className="w-72 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0">
        {/* Header */}
        <div className="p-6 border-b border-slate-900 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-600 to-blue-700 flex items-center justify-center shadow-lg shadow-sky-900/20">
            <GraduationCap className="text-white w-6 h-6"/>
          </div>
          <div>
            <h1 className="font-black text-white uppercase tracking-wider text-sm">SFSD Academy</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Education Center</p>
          </div>
        </div>

        {/* Menu Items */}
        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-8 custom-scrollbar">

          <div className="space-y-1">
            <p className="px-3 text-[10px] uppercase font-black text-slate-600 mb-2">Tanulmányok</p>
            <NavItem
              active={currentView === 'basic'}
              onClick={() => setCurrentView('basic')}
              icon={<BookOpen className="w-4 h-4"/>}
              label="Alapkiképzés"
              desc="Trainee Academy"
            />
          </div>

          <div className="space-y-1">
            <p className="px-3 text-[10px] uppercase font-black text-slate-600 mb-2">Specializációk</p>
            <NavItem
              active={currentView === 'mcb'}
              onClick={() => setCurrentView('mcb')}
              icon={<Siren className="w-4 h-4 text-sky-500"/>}
              label="MCB Nyomozói"
              desc="Major Crimes Bureau"
              highlightColor="group-hover:text-sky-400"
              isLocked={false}
            />
            <NavItem
              active={currentView === 'seb'}
              onClick={() => setCurrentView('seb')}
              icon={<Crosshair className="w-4 h-4 text-red-500"/>}
              label="SEB Taktikai"
              desc="Special Enforcement"
              highlightColor="group-hover:text-red-400"
              isLocked={true}
            />
          </div>
        </div>

        {isInstructor && (
          <div className="p-4 border-t border-slate-900 bg-slate-900/30">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-yellow-500"/>
              <div>
                <p className="text-xs font-bold text-yellow-500 uppercase">Oktatói Jogkör</p>
                <p className="text-[10px] text-yellow-500/60">Teljes hozzáférés</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0b1120] relative">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.02] pointer-events-none"></div>
        <div
          className="absolute top-0 right-0 w-1/2 h-1/2 bg-sky-500/5 blur-[100px] pointer-events-none rounded-full"></div>

        <div className="flex-1 relative z-10 overflow-hidden h-full">
          {currentView === 'basic' && <BasicAcademyView isInstructor={isInstructor}/>}

          {currentView === 'mcb' &&
            <PlaceholderView title="MCB Nyomozói Akadémia" icon={<Siren className="w-12 h-12 text-sky-500"/>}/>}
          {currentView === 'seb' &&
            <PlaceholderView title="SEB Taktikai Képzés" icon={<Crosshair className="w-12 h-12 text-red-500"/>}
                             locked/>}
        </div>
      </div>
    </div>
  );
}

function NavItem({
                   active,
                   onClick,
                   icon,
                   label,
                   desc,
                   highlightColor = "group-hover:text-white",
                   isLocked = false
                 }: any) {
  return (
    <button
      onClick={isLocked ? undefined : onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg group transition-all duration-200 border border-transparent",
        active
          ? "bg-slate-800 text-white border-slate-700 shadow-lg"
          : isLocked
            ? "opacity-50 cursor-not-allowed grayscale"
            : "text-slate-400 hover:bg-slate-900 hover:border-slate-800"
      )}
    >
      <div className={cn("transition-colors", active ? "text-white" : highlightColor)}>
        {icon}
      </div>
      <div className="text-left flex-1">
        <p
          className={cn("text-sm font-bold leading-none transition-colors", active ? "text-white" : "text-slate-300 group-hover:text-white")}>{label}</p>
        {desc && <p className="text-[10px] font-mono mt-0.5 text-slate-500 group-hover:text-slate-400">{desc}</p>}
      </div>
      {isLocked && <Lock className="w-3 h-3 text-slate-600"/>}
    </button>
  )
}

function PlaceholderView({title, icon, desc, locked}: any) {
  return (
    <div
      className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-500">
      <div className="p-6 bg-slate-900/50 rounded-full border border-slate-800 mb-6 shadow-2xl relative">
        {icon}
        {locked && (
          <div className="absolute -bottom-1 -right-1 bg-slate-950 p-1.5 rounded-full border border-slate-800">
            <Lock className="w-4 h-4 text-slate-500"/>
          </div>
        )}
      </div>
      <h2 className="text-3xl font-black text-white tracking-tight mb-2 uppercase">{title}</h2>
      <p className="text-slate-400 max-w-md mx-auto text-lg">
        {locked ? "Ez a tananyag jelenleg nem elérhető az Ön számára." : (desc || "A tananyag feltöltése folyamatban van.")}
      </p>
    </div>
  )
}