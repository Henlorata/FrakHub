import * as React from "react";
import { useAuth } from "@/context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { Suspect } from "@/types/supabase";

function NewSuspectDialog({ open, onOpenChange, onSuccess }: { open: boolean, onOpenChange: (o: boolean) => void, onSuccess: () => void }) {
  const { supabase, user } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [formData, setFormData] = React.useState<Partial<Suspect>>({
    full_name: "",
    alias: "",
    status: "free",
    gang_affiliation: "",
    description: "",
    gender: "male"
  });

  const handleSubmit = async () => {
    if (!formData.full_name) {
      toast.error("A név megadása kötelező!");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('suspects').insert({
        ...formData,
        created_by: user?.id
      } as any);
      if (error) throw error;
      toast.success("Gyanúsított rögzítve.");
      setFormData({ full_name: "", alias: "", status: "free", description: "", gender: "male" });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error(error);
      toast.error("Hiba történt.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Új személy nyilvántartásba vétele</DialogTitle>
          <DialogDescription>Rögzítsd a gyanúsított alapadatait.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Teljes Név *</Label>
              <Input
                value={formData.full_name}
                onChange={e => setFormData({...formData, full_name: e.target.value})}
                className="bg-slate-950 border-slate-800" placeholder="pl. John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label>Becenév / Alias</Label>
              <Input
                value={formData.alias || ""}
                onChange={e => setFormData({...formData, alias: e.target.value})}
                className="bg-slate-950 border-slate-800" placeholder="pl. The Ghost"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Státusz</Label>
              <Select value={formData.status} onValueChange={(val: any) => setFormData({...formData, status: val})}>
                <SelectTrigger className="bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="free">Szabadlábon</SelectItem>
                  <SelectItem value="wanted">Körözött</SelectItem>
                  <SelectItem value="jailed">Börtönben</SelectItem>
                  <SelectItem value="deceased">Elhunyt</SelectItem>
                  <SelectItem value="unknown">Ismeretlen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nem</Label>
              <Select value={formData.gender || "male"} onValueChange={(val) => setFormData({...formData, gender: val})}>
                <SelectTrigger className="bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="male">Férfi</SelectItem>
                  <SelectItem value="female">Nő</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Banda / Szervezet</Label>
            <Input
              value={formData.gang_affiliation || ""}
              onChange={e => setFormData({...formData, gang_affiliation: e.target.value})}
              className="bg-slate-950 border-slate-800" placeholder="pl. Vörös Sárkány Triád"
            />
          </div>

          <div className="space-y-2">
            <Label>Leírás / Ismertetőjelek</Label>
            <Textarea
              value={formData.description || ""}
              onChange={e => setFormData({...formData, description: e.target.value})}
              className="bg-slate-950 border-slate-800 h-24 resize-none" placeholder="Tetoválások, sebhelyek, viselkedés..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-yellow-600 hover:bg-yellow-700 text-black">Mentés</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { NewSuspectDialog };