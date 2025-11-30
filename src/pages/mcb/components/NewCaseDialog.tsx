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
import {Loader2, FolderPlus, Terminal} from "lucide-react";
import {toast} from "sonner";
import {useNavigate} from "react-router-dom";

interface NewCaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCaseCreated?: () => void;
}

export function NewCaseDialog({open, onOpenChange, onCaseCreated}: NewCaseDialogProps) {
  const {supabase, profile} = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);
  const [formData, setFormData] = React.useState({title: "", description: "", priority: "medium"});

  const handleSubmit = async () => {
    if (!formData.title) return toast.error("Az akta címét kötelező megadni.");
    setLoading(true);
    try {
      const {data, error} = await supabase.from('cases').insert({
        title: formData.title, description: formData.description, priority: formData.priority as any,
        status: 'open', owner_id: profile?.id, body: []
      }).select().single();

      if (error) throw error;
      toast.success("Akta inicializálva.");
      setFormData({title: "", description: "", priority: "medium"});
      onOpenChange(false);
      if (onCaseCreated) onCaseCreated();
      navigate(`/mcb/case/${data.id}`);
    } catch (error: any) {
      toast.error("Hiba történt:", {description: error.message});
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#0a0f1c] border border-sky-900/50 text-slate-100 sm:max-w-md shadow-[0_0_50px_rgba(14,165,233,0.1)] p-0 overflow-hidden">
        {/* Tech Header Strip */}
        <div className="bg-sky-950/30 border-b border-sky-900/30 px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-sky-500/10 flex items-center justify-center border border-sky-500/20">
            <FolderPlus className="w-5 h-5 text-sky-400"/>
          </div>
          <div>
            <DialogTitle className="text-lg font-black tracking-tight text-white uppercase font-mono">ÚJ
              NYOMOZÁS</DialogTitle>
            <p className="text-[10px] text-sky-500/70 font-mono tracking-widest uppercase">Protocol: INIT_CASE_FILE</p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <Label className="text-xs uppercase font-bold text-slate-500 tracking-wider">Kódnév / Megnevezés</Label>
            <div className="relative">
              <Terminal className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sky-600"/>
              <Input
                placeholder="PL. 'ÉJSZAKAI BAGOLY' MŰVELET"
                className="bg-slate-950 border-slate-800 focus-visible:ring-sky-500/50 pl-10 font-mono text-sm"
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase font-bold text-slate-500 tracking-wider">Rövid Összefoglaló</Label>
            <Textarea
              placeholder="Ügy rövid leírása..."
              className="bg-slate-950 border-slate-800 resize-none h-24 focus-visible:ring-sky-500/50 font-mono text-xs leading-relaxed break-all"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase font-bold text-slate-500 tracking-wider">Prioritás Szint</Label>
            <Select value={formData.priority} onValueChange={(val) => setFormData({...formData, priority: val})}>
              <SelectTrigger className="bg-slate-950 border-slate-800 font-mono text-sm"><SelectValue/></SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white">
                <SelectItem value="low">ALACSONY (Routine)</SelectItem>
                <SelectItem value="medium">KÖZEPES (Standard)</SelectItem>
                <SelectItem value="high" className="text-orange-400">MAGAS (High Profile)</SelectItem>
                <SelectItem value="critical" className="text-red-500 font-bold">KRITIKUS (Immediate Action)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="p-6 pt-2 bg-slate-950/50 border-t border-slate-800/50">
          <Button variant="ghost" onClick={() => onOpenChange(false)}
                  className="hover:bg-slate-800 hover:text-white">MÉGSE</Button>
          <Button onClick={handleSubmit} disabled={loading}
                  className="bg-sky-600 hover:bg-sky-500 text-white font-bold tracking-wider">
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>} LÉTREHOZÁS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}