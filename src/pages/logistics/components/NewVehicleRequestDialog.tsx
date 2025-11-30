import * as React from "react";
import {useAuth} from "@/context/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {toast} from "sonner";
import {Loader2, FileText, Lock, ChevronRight, AlertCircle, ShieldAlert} from "lucide-react";
import {FACTION_RANKS, type FactionRank, type Qualification} from "@/types/supabase";
import {cn} from "@/lib/utils";

// --- KONFIGURÁCIÓ ---
interface VehicleDef {
  name: string;
  minRank?: FactionRank;
  requiredQual?: Qualification;
}

// RANG HIERARCHIA: 0 = Commander (High), 16 = Trainee (Low)
// A rendszerben a tömb indexe fordított arányban áll a rang magasságával.
// Alacsonyabb index = Magasabb rang.

const VEHICLES: VehicleDef[] = [
  {name: "Ford Crown Victoria", minRank: "Deputy Sheriff I."},
  {name: "Ford Taurus", minRank: "Deputy Sheriff I."},
  {name: "Ford Explorer", minRank: "Deputy Sheriff I."},
  {name: "Dodge Charger SRT 2006", minRank: "Deputy Sheriff II."},
  {name: "Dodge Charger SRT 2012", minRank: "Deputy Sheriff II."},
  {name: "Dodge Charger SRT 2015", minRank: "Deputy Sheriff II."},
  {name: "Ford F-150 Vontató", minRank: "Deputy Sheriff II."},
  {name: "Mercedes Arocs", minRank: "Deputy Sheriff II."},
  {name: "Predator (hajó)", minRank: "Staff Deputy Sheriff"},
  {name: "Mercedes-Benz Vito", minRank: "Sergeant I."},
  {name: "Ford Raptor 2022", requiredQual: "GW"},
  {name: "Police Maverick", requiredQual: "AB"},
  {name: "SAHP Dodge Demon SRT", requiredQual: "SAHP"},
  {name: "Egyéb / Speciális"}
];

const getRankIndex = (rank: FactionRank) => FACTION_RANKS.indexOf(rank);

interface NewVehicleRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function NewVehicleRequestDialog({open, onOpenChange, onSuccess}: NewVehicleRequestDialogProps) {
  const {supabase, user, profile} = useAuth();
  const [isLoading, setIsLoading] = React.useState(false);

  // Form State
  const [vehicleType, setVehicleType] = React.useState("");
  const [customType, setCustomType] = React.useState("");
  const [reason, setReason] = React.useState("");

  // JOGOSULTSÁG ELLENŐRZÉS
  const checkAvailability = (veh: VehicleDef) => {
    if (!profile) return {visible: false, disabled: true, reason: "Nincs profil"};

    // Bureau Manager mindent lát
    if (profile.is_bureau_manager) return {visible: true, disabled: false};

    // 1. Képesítés ellenőrzés
    if (veh.requiredQual) {
      if (!profile.qualifications?.includes(veh.requiredQual)) {
        // Ha nincs képesítése, akkor is láthatja, de zárolva
        return {visible: true, disabled: true, reason: `REQ: ${veh.requiredQual} QUAL`};
      }
    }

    // 2. Rang ellenőrzés
    if (veh.minRank) {
      const myRankIndex = getRankIndex(profile.faction_rank);
      const reqRankIndex = getRankIndex(veh.minRank);

      // Ha a user indexe NAGYOBB mint a szükséges, akkor a rangja KISEBB -> Lock
      if (myRankIndex > reqRankIndex) {
        return {visible: true, disabled: true, reason: `REQ: ${veh.minRank}`};
      }
    }

    return {visible: true, disabled: false};
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const finalType = vehicleType === "Egyéb / Speciális" ? customType : vehicleType;
    if (!finalType || !reason) {
      toast.error("Kérjük tölts ki minden mezőt!");
      return;
    }

    setIsLoading(true);
    try {
      const {error} = await (supabase.from('vehicle_requests') as any).insert({
        user_id: user.id, vehicle_type: finalType, reason: reason, status: 'pending'
      });
      if (error) throw error;
      toast.success("Igénylés rögzítve.");
      setReason("");
      setVehicleType("");
      setCustomType("");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error("Hiba történt", {description: (error as Error).message});
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#0b1221] border border-orange-500/30 text-white sm:max-w-lg p-0 shadow-[0_0_40px_rgba(249,115,22,0.15)] overflow-hidden">

        {/* --- FORM HEADER --- */}
        <div className="bg-orange-500/10 border-b border-orange-500/20 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 border border-orange-500/50 rounded bg-orange-500/10 text-orange-500 flex items-center justify-center">
              <FileText className="w-5 h-5"/>
            </div>
            <div>
              <DialogTitle className="text-lg font-black uppercase tracking-tighter font-mono text-white">IGÉNYLŐLAP
                10-B</DialogTitle>
              <p className="text-[10px] text-orange-500/70 font-mono tracking-widest uppercase font-bold">LOGISTICS
                DEPT. FORM #8921</p>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">REQ. OFFICER</div>
            <div
              className="text-xs font-bold text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-700">{profile?.badge_number}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 relative">
          {/* Háttér minta */}
          <div
            className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/graphy.png')] opacity-10 pointer-events-none"></div>

          {/* JÁRMŰ LISTA */}
          <div className="space-y-2 relative z-10">
            <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Igényelhető
              Járművek</Label>
            <div
              className="max-h-[220px] overflow-y-auto pr-2 custom-scrollbar border border-slate-700 bg-slate-950/80 rounded-sm">
              {VEHICLES.map(veh => {
                const status = checkAvailability(veh);
                if (!status.visible) return null;
                const isSelected = vehicleType === veh.name;

                return (
                  <div key={veh.name}
                       onClick={() => !status.disabled && setVehicleType(veh.name)}
                       className={cn(
                         "flex items-center justify-between p-2.5 cursor-pointer text-xs font-mono uppercase border-b border-slate-800 transition-all",
                         status.disabled ? 'opacity-60 bg-slate-900/50' : 'hover:bg-orange-500/10 hover:text-orange-400',
                         isSelected && "bg-orange-500/20 text-orange-400 border-l-2 border-l-orange-500 pl-3"
                       )}
                  >
                    <span
                      className={cn("font-bold tracking-wide", status.disabled && "text-slate-500 decoration-slate-600 line-through")}>
                       {veh.name}
                    </span>

                    {status.disabled ? (
                      <span
                        className="text-[9px] text-red-500 bg-red-950/30 px-1.5 py-0.5 rounded border border-red-900/50 flex items-center gap-1 font-bold">
                          <Lock className="w-2.5 h-2.5"/> {status.reason}
                       </span>
                    ) : isSelected && (
                      <ChevronRight className="w-3 h-3"/>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* EGYÉB TÍPUS INPUT */}
          {vehicleType === "Egyéb / Speciális" && (
            <div className="space-y-1 animate-in fade-in slide-in-from-top-2 relative z-10">
              <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Pontos Típus
                Megnevezése</Label>
              <Input placeholder="PL. ENUS STAFFORD"
                     className="bg-slate-950 border-slate-700 font-mono text-sm h-10 focus-visible:ring-orange-500/50"
                     value={customType} onChange={(e) => setCustomType(e.target.value)}/>
            </div>
          )}

          {/* INDOKLÁS */}
          <div className="space-y-1 relative z-10">
            <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Indoklás (Szolgálati
              Cél)</Label>
            <div className="relative">
              <ShieldAlert className="absolute top-3 left-3 w-4 h-4 text-slate-600"/>
              <Textarea
                placeholder="FEJTSD KI RÖVIDEN A HASZNÁLAT CÉLJÁT..."
                className="bg-slate-950 border-slate-700 min-h-[80px] pl-9 font-mono text-xs leading-relaxed focus-visible:ring-orange-500/50 resize-none break-all"
                value={reason} onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="pt-2 relative z-10">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}
                    className="hover:bg-slate-800 text-slate-400 hover:text-white">MÉGSE</Button>
            <Button type="submit"
                    className="bg-orange-600 hover:bg-orange-500 text-black font-bold uppercase tracking-wider"
                    disabled={isLoading || !vehicleType}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : "BENYÚJTÁS"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}