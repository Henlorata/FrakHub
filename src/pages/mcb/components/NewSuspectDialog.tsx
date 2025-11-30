import * as React from "react";
import {useAuth} from "@/context/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {toast} from "sonner";
import {UserPlus, ScanFace, FileText} from "lucide-react";
import type {Suspect} from "@/types/supabase";

function NewSuspectDialog({open, onOpenChange, onSuccess}: {
  open: boolean,
  onOpenChange: (o: boolean) => void,
  onSuccess: () => void
}) {
  const {supabase, user} = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [formData, setFormData] = React.useState<Partial<Suspect>>({
    full_name: "", alias: "", status: "free", gang_affiliation: "", description: "", gender: "male"
  });

  const handleSubmit = async () => {
    if (!formData.full_name) {
      toast.error("A név megadása kötelező!");
      return;
    }
    setLoading(true);
    try {
      const {error} = await supabase.from('suspects').insert({...formData, created_by: user?.id} as any);
      if (error) throw error;
      toast.success("Adatlap létrehozva.");
      setFormData({full_name: "", alias: "", status: "free", description: "", gender: "male"});
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Hiba történt.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#050a14] border border-slate-800 text-white sm:max-w-lg p-0 overflow-hidden shadow-2xl">
        {/* Tech Header */}
        <div
          className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center gap-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-full bg-gradient-to-l from-red-900/20 to-transparent"></div>
          <div className="w-10 h-10 rounded bg-red-500/10 flex items-center justify-center border border-red-500/20">
            <ScanFace className="w-5 h-5 text-red-500"/>
          </div>
          <div>
            <DialogTitle className="text-lg font-black tracking-tight text-white uppercase font-mono">ÚJ
              NYILVÁNTARTÁS</DialogTitle>
            <p className="text-[10px] text-red-500/60 font-mono tracking-widest uppercase">Create Criminal Record</p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Teljes Név *</Label>
              <Input
                value={formData.full_name}
                onChange={e => setFormData({...formData, full_name: e.target.value})}
                className="bg-slate-950 border-slate-800 h-10 font-mono text-sm focus-visible:ring-red-500/30"
                placeholder="ISMERETLEN..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Alias / Becenév</Label>
              <Input
                value={formData.alias || ""}
                onChange={e => setFormData({...formData, alias: e.target.value})}
                className="bg-slate-950 border-slate-800 h-10 font-mono text-sm focus-visible:ring-red-500/30"
                placeholder="NINCS..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Jelenlegi Státusz</Label>
              <Select value={formData.status} onValueChange={(val: any) => setFormData({...formData, status: val})}>
                <SelectTrigger className="bg-slate-950 border-slate-800 h-10 text-sm"><SelectValue/></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="free" className="text-green-400">SZABADLÁBON</SelectItem>
                  <SelectItem value="wanted" className="text-red-500 font-bold">KÖRÖZÖTT</SelectItem>
                  <SelectItem value="jailed" className="text-orange-400">BÖRTÖNBEN</SelectItem>
                  <SelectItem value="deceased" className="text-slate-500">ELHUNYT</SelectItem>
                  <SelectItem value="unknown">ISMERETLEN</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Nem</Label>
              <Select value={formData.gender || "male"}
                      onValueChange={(val) => setFormData({...formData, gender: val})}>
                <SelectTrigger className="bg-slate-950 border-slate-800 h-10 text-sm"><SelectValue/></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="male">FÉRFI</SelectItem>
                  <SelectItem value="female">NŐ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Bűnszervezet /
              Kapcsolat</Label>
            <Input
              value={formData.gang_affiliation || ""}
              onChange={e => setFormData({...formData, gang_affiliation: e.target.value})}
              className="bg-slate-950 border-slate-800 h-10 font-mono text-sm" placeholder="PL. TRIÁDOK..."
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Személyleírás /
              Ismertetőjelek</Label>
            <div className="relative">
              <FileText className="absolute top-3 left-3 w-4 h-4 text-slate-600"/>
              <Textarea
                value={formData.description || ""}
                onChange={e => setFormData({...formData, description: e.target.value})}
                className="bg-slate-950 border-slate-800 min-h-[100px] pl-10 font-mono text-xs leading-relaxed resize-none focus-visible:ring-red-500/30 break-all"
                placeholder="Tetoválások, sebhelyek, feltűnő viselkedés..."
              />
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 bg-slate-950 border-t border-slate-800">
          <Button variant="ghost" onClick={() => onOpenChange(false)}
                  className="hover:bg-slate-900 hover:text-white">MÉGSE</Button>
          <Button onClick={handleSubmit} disabled={loading}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold tracking-wider shadow-[0_0_15px_rgba(220,38,38,0.3)]">
            ADATLAP MENTÉSE
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export {NewSuspectDialog};