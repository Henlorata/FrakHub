import * as React from "react";
import { useAuth } from "@/context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface NewCaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCaseCreated?: () => void;
}

export function NewCaseDialog({ open, onOpenChange, onCaseCreated }: NewCaseDialogProps) {
  const { supabase, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);
  const [formData, setFormData] = React.useState({
    title: "",
    description: "",
    priority: "medium",
  });

  const handleSubmit = async () => {
    if (!formData.title) {
      toast.error("Az akta címét kötelező megadni.");
      return;
    }

    setLoading(true);
    try {
      // 1. Létrehozás
      const { data, error } = await supabase.from('cases').insert({
        title: formData.title,
        description: formData.description,
        priority: formData.priority as any,
        status: 'open',
        owner_id: profile?.id,
        body: [] // Üres tömbbel hozzuk létre (a CaseEditor már kezeli)
      }).select().single();

      if (error) throw error;

      toast.success("Akta sikeresen létrehozva!");

      // 2. Reset és Bezárás
      setFormData({ title: "", description: "", priority: "medium" });
      onOpenChange(false);

      // 3. Navigálás vagy Lista frissítés
      if (onCaseCreated) onCaseCreated();
      // Opcionális: Azonnal odaugrunk
      navigate(`/mcb/case/${data.id}`);

    } catch (error: any) {
      console.error(error);
      toast.error("Hiba történt:", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Új Nyomozati Akta</DialogTitle>
          <DialogDescription>
            Hozzon létre egy új ügyiratot. A részleteket a létrehozás után tudja szerkeszteni.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Akta Megnevezése (Cím)</Label>
            <Input
              placeholder="pl. 'Vörös Sárkány' Bűnszervezet"
              className="bg-slate-950 border-slate-800 focus-visible:ring-yellow-600/50"
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <Label>Rövid Leírás (Összefoglaló)</Label>
            <Textarea
              placeholder="Rövid összefoglaló a listanézethez..."
              className="bg-slate-950 border-slate-800 resize-none h-20 focus-visible:ring-yellow-600/50"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <Label>Prioritás</Label>
            <Select
              value={formData.priority}
              onValueChange={(val) => setFormData({...formData, priority: val})}
            >
              <SelectTrigger className="bg-slate-950 border-slate-800">
                <SelectValue placeholder="Válassz prioritást" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white">
                <SelectItem value="low">Alacsony</SelectItem>
                <SelectItem value="medium">Közepes</SelectItem>
                <SelectItem value="high" className="text-orange-400">Magas</SelectItem>
                <SelectItem value="critical" className="text-red-500 font-bold">KRITIKUS</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-yellow-600 hover:bg-yellow-700 text-black font-semibold">
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Létrehozás
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}