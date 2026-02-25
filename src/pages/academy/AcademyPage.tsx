import {useState, useMemo} from "react";
import {useAuth} from "@/context/AuthContext";
import {cn, isSupervisory, isHighCommand} from "@/lib/utils";
import {
  GraduationCap, Siren, Crosshair, BookOpen, ShieldAlert, Lock, ChevronLeft, ChevronRight, Target
} from "lucide-react";
import {BasicAcademyView} from "./views/BasicAcademyView";
// import {DivisionAcademyView} from "./views/DivisionAcademyView";

type AcademyView = 'basic' | 'mcb' | 'seb' | string;

export default function AcademyPage() {
  const {profile} = useAuth();
  const [currentView, setCurrentView] = useState<AcademyView>('basic');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isInstructor = useMemo(() => {
    if (!profile) return false;
    if (profile.faction_rank === 'Deputy Sheriff Trainee') return false;
    if (profile.qualifications?.includes("TB") || profile.is_bureau_manager || isSupervisory(profile) || isHighCommand(profile)) return true;
    return false;
  }, [profile]);

  // Dinamikus kvalifikációk (amiknek lehet tananyaga)
  const availableQualifications = ['SAHP', 'AB', 'MU', 'GW', 'FAB', 'SIB', 'TB'];

  return (
    <div className="flex h-[calc(100vh-64px)] bg-[#0b1120] overflow-hidden text-slate-200 font-sans rounded-xl border border-slate-800 shadow-2xl relative">

      {/* Kinyitó gomb, ha össze van csukva */}
      {isCollapsed && (
        <button
          onClick={() => setIsCollapsed(false)}
          className="absolute top-4 left-4 z-50 p-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-md shadow-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-slate-300"/>
        </button>
      )}

      {/* SIDEBAR */}
      <div className={cn(
        "bg-slate-950 border-r border-slate-800 flex flex-col shrink-0 transition-all duration-300 relative",
        isCollapsed ? "w-0 opacity-0 overflow-hidden border-none" : "w-72 opacity-100"
      )}>
        {/* Header */}
        <div className="p-6 border-b border-slate-900 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-600 to-blue-700 flex items-center justify-center shadow-lg shadow-sky-900/20">
              <GraduationCap className="text-white w-6 h-6"/>
            </div>
            <div>
              <h1 className="font-black text-white uppercase tracking-wider text-sm leading-tight">SFSD Academy</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Education Center</p>
            </div>
          </div>
          <button onClick={() => setIsCollapsed(true)} className="p-1.5 bg-slate-900 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white transition-colors">
            <ChevronLeft className="w-4 h-4"/>
          </button>
        </div>

        {/* Menu Items */}
        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-8 custom-scrollbar">

          <div className="space-y-1">
            <p className="px-3 text-[10px] uppercase font-black text-slate-600 mb-2">Tanulmányok</p>
            <NavItem active={currentView === 'basic'} onClick={() => setCurrentView('basic')} icon={<BookOpen className="w-4 h-4"/>} label="Alapkiképzés" desc="Trainee Academy"/>
          </div>

          <div className="space-y-1">
            <p className="px-3 text-[10px] uppercase font-black text-slate-600 mb-2">Osztály Tananyagok</p>
            <NavItem active={currentView === 'mcb'} onClick={() => setCurrentView('mcb')} icon={<Siren className="w-4 h-4 text-sky-500"/>} label="MCB Nyomozói" desc="Major Crimes Bureau" highlightColor="group-hover:text-sky-400"/>
            <NavItem active={currentView === 'seb'} onClick={() => setCurrentView('seb')} icon={<Crosshair className="w-4 h-4 text-red-500"/>} label="SEB Taktikai" desc="Special Enforcement" highlightColor="group-hover:text-red-400"/>
          </div>

          <div className="space-y-1">
            <p className="px-3 text-[10px] uppercase font-black text-slate-600 mb-2 flex items-center justify-between">
              Képesítések (Certifications)
            </p>
            {availableQualifications.map(qual => (
              <NavItem
                key={qual} active={currentView === `qual_${qual}`} onClick={() => setCurrentView(`qual_${qual}`)}
                icon={<Target className="w-4 h-4 text-yellow-500"/>} label={`${qual} Képesítés`} highlightColor="group-hover:text-yellow-400"
              />
            ))}
          </div>
        </div>

        {isInstructor && (
          <div className="p-4 border-t border-slate-900 bg-slate-900/30 shrink-0">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-yellow-500 shrink-0"/>
              <div>
                <p className="text-xs font-bold text-yellow-500 uppercase leading-none mb-1">Oktatói Jogkör</p>
                <p className="text-[10px] text-yellow-500/60 leading-none">Teljes hozzáférés és szerkesztés</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0b1120] relative">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.02] pointer-events-none"></div>
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-sky-500/5 blur-[100px] pointer-events-none rounded-full"></div>

        <div className="flex-1 relative z-10 overflow-hidden flex flex-col">
          {currentView === 'basic' ? (
            <BasicAcademyView isInstructor={isInstructor}/>
          ) : (
            <DivisionAcademyView
              courseId={currentView}
              isInstructor={isInstructor}
              currentUser={profile}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function NavItem({active, onClick, icon, label, desc, highlightColor = "group-hover:text-white", isLocked = false}: any) {
  return (
    <button
      onClick={isLocked ? undefined : onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg group transition-all duration-200 border border-transparent",
        active ? "bg-slate-800 text-white border-slate-700 shadow-lg" : isLocked ? "opacity-50 cursor-not-allowed grayscale" : "text-slate-400 hover:bg-slate-900 hover:border-slate-800"
      )}
    >
      <div className={cn("transition-colors", active ? "text-white" : highlightColor)}>{icon}</div>
      <div className="text-left flex-1 min-w-0">
        <p className={cn("text-sm font-bold truncate leading-none transition-colors", active ? "text-white" : "text-slate-300 group-hover:text-white")}>{label}</p>
        {desc && <p className="text-[10px] font-mono mt-0.5 truncate text-slate-500 group-hover:text-slate-400">{desc}</p>}
      </div>
      {isLocked && <Lock className="w-3 h-3 text-slate-600 shrink-0"/>}
    </button>
  )
}