import {useState, useEffect} from "react";
import {useAuth} from "@/context/AuthContext";
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Label} from "@/components/ui/label";
import {toast} from "sonner";
import {Loader2, Medal, Check} from "lucide-react";

interface GiveAwardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string;
  targetUserName: string;
  onSuccess: () => void;
}

export function GiveAwardDialog({open, onOpenChange, targetUserId, targetUserName, onSuccess}: GiveAwardDialogProps) {
  const {supabase, user} = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [ribbons, setRibbons] = useState<any[]>([]);
  const [selectedRibbon, setSelectedRibbon] = useState("");

  useEffect(() => {
    if (open) {
      const fetchRibbons = async () => {
        const {data} = await supabase.from('ribbons').select('*').order('name');
        setRibbons(data || []);
      };
      fetchRibbons();
    }
  }, [open, supabase]);

  const handleAward = async () => {
    if (!selectedRibbon || !user) return;
    setIsLoading(true);
    try {
      const {error} = await supabase.rpc('hr_give_award', {_target_user_id: targetUserId, _ribbon_id: selectedRibbon});
      if (error) throw error;
      toast.success(`Kitüntetés átadva: ${targetUserName}`);
      onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Hiba: " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#0b1221] border border-yellow-600/30 text-white sm:max-w-md p-0 overflow-hidden shadow-[0_0_40px_rgba(234,179,8,0.15)]">

        {/* Tech Header */}
        <div className="bg-yellow-600/10 border-b border-yellow-600/20 p-5 flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-yellow-500 shadow-lg">
            <Medal className="w-6 h-6"/>
          </div>
          <div>
            <DialogTitle className="text-lg font-black uppercase tracking-tight text-white">KITÜNTETÉS
              ÁTADÁSA</DialogTitle>
            <p className="text-[10px] text-yellow-500/70 font-mono tracking-widest uppercase font-bold">COMMENDATION
              PROTOCOL</p>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-slate-950 border border-slate-800 p-3 rounded flex justify-between items-center">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">KEDVEZMÉNYEZETT</span>
            <span className="font-mono text-sm text-white font-bold">{targetUserName}</span>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Válassz Szalagot</Label>
            <Select value={selectedRibbon} onValueChange={setSelectedRibbon}>
              <SelectTrigger className="bg-slate-950 border-slate-700 h-12">
                <SelectValue placeholder="Válassz a listából..."/>
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white max-h-[300px]">
                {ribbons.map(r => (
                  <SelectItem key={r.id} value={r.id} className="focus:bg-yellow-900/20 focus:text-yellow-200">
                    <div className="flex items-center gap-3 py-1">
                      <div className="w-8 h-3 rounded-sm shadow-sm border border-white/10"
                           style={{backgroundColor: r.color_hex}}/>
                      <span className="font-bold text-sm uppercase tracking-wide">{r.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedRibbon && (
              <div className="mt-2 p-3 bg-yellow-500/5 border border-yellow-500/10 rounded">
                <p className="text-xs text-yellow-200/80 italic text-center">
                  "{ribbons.find(r => r.id === selectedRibbon)?.description}"
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="p-4 bg-slate-950/50 border-t border-slate-800 flex justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)}
                  className="hover:bg-slate-800 text-slate-400">MÉGSE</Button>
          <Button onClick={handleAward} disabled={!selectedRibbon || isLoading}
                  className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold uppercase tracking-wider px-6">
            {isLoading ? <Loader2 className="animate-spin w-4 h-4"/> :
              <div className="flex items-center gap-2"><Check className="w-4 h-4"/> ÁTADÁS</div>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}