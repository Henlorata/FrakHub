import {useState, useEffect} from "react";
import {useAuth} from "@/context/AuthContext";
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Label} from "@/components/ui/label";
import {toast} from "sonner";
import {Loader2, Medal, Plus} from "lucide-react";

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

  // Elérhető kitüntetések betöltése
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
      // JAVÍTÁS: RPC hívás a direkt insert helyett (RLS Bypass)
      const {error} = await supabase.rpc('hr_give_award', {
        _target_user_id: targetUserId,
        _ribbon_id: selectedRibbon
      });

      if (error) throw error;

      toast.success(`Kitüntetés átadva ${targetUserName} részére!`);
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
      <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-yellow-500">
            <Medal className="w-5 h-5"/> Kitüntetés Átadása
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-lg text-sm text-slate-400 text-center">
            Címzett: <span className="text-white font-bold">{targetUserName}</span>
          </div>

          <div className="space-y-2">
            <Label>Válassz Kitüntetést</Label>
            <Select value={selectedRibbon} onValueChange={setSelectedRibbon}>
              <SelectTrigger className="bg-slate-950 border-slate-700">
                <SelectValue placeholder="Válassz..."/>
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white">
                {ribbons.map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{backgroundColor: r.color_hex}}/>
                      <span>{r.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRibbon && (
              <p className="text-xs text-slate-500 mt-1 italic">
                "{ribbons.find(r => r.id === selectedRibbon)?.description}"
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button onClick={handleAward} disabled={!selectedRibbon || isLoading}
                  className="bg-yellow-600 hover:bg-yellow-700 text-black font-bold">
            {isLoading ? <Loader2 className="animate-spin"/> : <Plus className="w-4 h-4 mr-2"/>} Átadás
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}