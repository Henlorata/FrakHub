import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {Badge} from "@/components/ui/badge";
import {
  Shield,
  Briefcase,
  Mail,
  Star,
  Lock,
  AlertOctagon,
  ChevronsUp,
  Fingerprint,
  ScanLine,
  CheckCircle,
  XCircle
} from "lucide-react";
import {getOptimizedAvatarUrl} from "@/lib/cloudinary";
import {cn} from "@/lib/utils";

interface OfficerProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  officer: {
    id: string;
    full_name: string;
    badge_number: string;
    faction_rank: string;
    division: string;
    division_rank?: string;
    qualifications?: string[];
    is_bureau_manager?: boolean;
    is_bureau_commander?: boolean;
    avatar_url?: string | null;
    email?: string;
  } | null;
  accessStatus?: 'authorized' | 'unauthorized' | null;
}

export function OfficerProfileDialog({open, onOpenChange, officer, accessStatus}: OfficerProfileDialogProps) {
  if (!officer) return null;

  // --- JAVÍTOTT STAFF SZINT MEGHATÁROZÁSA ---
  const getStaffLevel = () => {
    const rank = officer.faction_rank || "";

    // 1. EXECUTIVE: Sheriff, Undersheriff, Assistant Sheriff (DE NEM Deputy Sheriff!)
    // Pontos egyezést vagy speciális kivételeket nézünk
    if (rank === 'Sheriff' || rank.includes('Undersheriff') || rank.includes('Assistant Sheriff')) {
      return {label: "EXECUTIVE STAFF", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50", icon: Star};
    }

    // 2. COMMAND: Captain, Commander
    if (rank.includes('Captain') || rank.includes('Commander')) {
      return {label: "COMMAND STAFF", color: "bg-red-500/20 text-red-400 border-red-500/50", icon: Shield};
    }

    // 3. SUPERVISORY: Lieutenant, Sergeant
    if (rank.includes('Lieutenant') || rank.includes('Sergeant')) {
      return {label: "SUPERVISORY STAFF", color: "bg-blue-500/20 text-blue-400 border-blue-500/50", icon: ChevronsUp};
    }

    // 4. FIELD: Minden más (Deputy, Corporal, Investigator, stb.)
    return {label: "FIELD OPERATIVE", color: "bg-slate-800 text-slate-400 border-slate-700", icon: Fingerprint};
  };

  const staffLevel = getStaffLevel();
  const StaffIcon = staffLevel.icon;

  // --- JOGKÖR / CLEARANCE LOGIKA ---
  const getClearanceDisplay = () => {
    // 1. ESET: Van konkrét akta kontextus
    if (accessStatus) {
      if (accessStatus === 'authorized') {
        return {
          label: "CASE ACCESS GRANTED",
          code: "AUTHORIZED PERSONEL",
          color: "text-green-400",
          bg: "bg-green-950/40",
          border: "border-green-500/50",
          icon: CheckCircle
        };
      } else {
        return {
          label: "ACCESS DENIED",
          code: "UNAUTHORIZED ENTITY",
          color: "text-red-500",
          bg: "bg-red-950/40",
          border: "border-red-500/50",
          icon: XCircle
        };
      }
    }

    // 2. ESET: Általános nézet
    if (officer.is_bureau_manager || officer.is_bureau_commander || staffLevel.label === "EXECUTIVE STAFF" || staffLevel.label === "COMMAND STAFF") {
      return {
        label: "TOP SECRET",
        code: "CLEARANCE L-5",
        color: "text-green-400",
        bg: "bg-green-950/40",
        border: "border-green-500/50",
        icon: AlertOctagon
      };
    }
    if (staffLevel.label === "SUPERVISORY STAFF") {
      return {
        label: "SECRET",
        code: "CLEARANCE L-3",
        color: "text-blue-400",
        bg: "bg-blue-950/40",
        border: "border-blue-500/50",
        icon: AlertOctagon
      };
    }
    return {
      label: "CONFIDENTIAL",
      code: "CLEARANCE L-1",
      color: "text-slate-400",
      bg: "bg-slate-900",
      border: "border-slate-700",
      icon: AlertOctagon
    };
  };

  const clearance = getClearanceDisplay();
  const ClearanceIcon = clearance.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#0b1221] border border-slate-800 text-white sm:max-w-md p-0 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.6)] backdrop-blur-xl">

        {/* Háttér Grafika */}
        <div className="absolute top-0 left-0 w-full h-32 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 to-transparent"></div>
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-500/5 blur-3xl rounded-full"></div>
        </div>

        <div className="p-6 relative z-10">

          {/* FEJLÉC */}
          <div className="flex gap-5 items-start">
            <div className="relative shrink-0 group">
              <Avatar
                className="w-24 h-24 border-2 border-slate-700 shadow-2xl rounded-xl group-hover:border-slate-500 transition-colors">
                <AvatarImage src={getOptimizedAvatarUrl(officer.avatar_url, 200) || ""} className="object-cover"/>
                <AvatarFallback
                  className="bg-slate-900 text-3xl font-black text-slate-700 rounded-xl">{officer.full_name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div
                className="absolute -bottom-2 -right-2 bg-[#0b1221] px-1.5 py-0.5 border border-slate-700 rounded text-[10px] font-black font-mono text-slate-400 shadow-lg">
                {officer.division || "N/A"}
              </div>
            </div>

            <div className="flex-1 min-w-0 pt-1">
              <div
                className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border mb-2 shadow-sm", staffLevel.color)}>
                <StaffIcon className="w-3 h-3"/> {staffLevel.label}
              </div>

              <h2 className="text-xl font-black text-white uppercase tracking-tight leading-none mb-1 truncate">
                {officer.full_name}
              </h2>
              <p className="text-sky-500 font-mono text-xs font-bold flex items-center gap-2">
                #{officer.badge_number} <span className="text-slate-600">|</span> {officer.faction_rank}
              </p>
            </div>
          </div>

          {/* ADATLAP RÁCS */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div
              className="bg-slate-900/40 p-3 rounded-lg border border-slate-800 flex flex-col justify-between h-20 hover:bg-slate-900/60 transition-colors">
              <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                <Briefcase className="w-3 h-3"/> Beosztás
              </div>
              <div className="font-bold text-sm text-slate-200 truncate" title={officer.division_rank || "Unassigned"}>
                {officer.division_rank || "Unassigned"}
              </div>
            </div>

            <div
              className={cn("p-3 rounded-lg border flex flex-col justify-between h-20 relative overflow-hidden transition-colors", clearance.bg, clearance.border)}>
              <div className={cn("absolute right-2 top-2 opacity-10 scale-150 rotate-12", clearance.color)}>
                <ClearanceIcon className="w-12 h-12"/></div>
              <div
                className="flex items-center gap-2 text-[10px] text-slate-400 uppercase font-bold tracking-wider relative z-10">
                <ClearanceIcon
                  className={cn("w-3 h-3", clearance.color)}/> {accessStatus ? "Akta Hozzáférés" : "Biztonsági Szint"}
              </div>
              <div className={cn("font-black text-sm uppercase tracking-wider relative z-10", clearance.color)}>
                {clearance.label}
                <div className="text-[9px] opacity-70 font-mono">{clearance.code}</div>
              </div>
            </div>
          </div>

          {/* KÉPESÍTÉSEK */}
          {officer.qualifications && officer.qualifications.length > 0 && (
            <div className="mt-4 animate-in fade-in duration-500 delay-100">
              <div
                className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-2 flex items-center gap-2">
                <Award className="w-3 h-3"/> Képesítések
              </div>
              <div className="flex flex-wrap gap-1.5">
                {officer.qualifications.map((q, idx) => (
                  <Badge key={idx} variant="outline"
                         className="bg-slate-900/50 border-slate-800 text-slate-400 hover:text-sky-400 hover:border-sky-500/50 transition-all text-[9px] py-0.5 shadow-sm">
                    {q}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* EMAIL (REDACTED) */}
          <div className="mt-5 pt-4 border-t border-slate-800/60">
            <div
              className="flex items-center justify-between bg-black/40 p-3 rounded border border-red-900/20 group hover:border-red-900/40 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-red-900/10 rounded text-red-500"><Mail className="w-4 h-4"/></div>
                <div>
                  <div className="text-[9px] text-red-400/60 font-mono uppercase tracking-widest mb-0.5">TITKOSÍTOTT
                    ADAT
                  </div>
                  <div
                    className="text-xs font-mono text-red-500 font-bold tracking-widest blur-[3px] group-hover:blur-[2px] transition-all duration-300 cursor-not-allowed select-none">
                    CONFIDENTIAL_DATA
                  </div>
                </div>
              </div>
              <Lock className="w-4 h-4 text-red-500/30 group-hover:text-red-500/60 transition-colors"/>
            </div>
          </div>

          <div className="mt-4 text-center">
            <p className="text-[9px] text-slate-600 font-mono">
              SYSTEM ID: {officer.id.split('-')[0].toUpperCase()} // LSPD NET
            </p>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}