import * as React from "react";
import { useAuth } from "@/context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Car } from "lucide-react";

const VEHICLE_TYPES = [
  "Vapid Stanier (Cruiser)",
  "Vapid Scout (SUV)",
  "Bravado Buffalo (Interceptor)",
  "Vapid Speedo (Transport)",
  "Egyéb / Speciális"
];

interface NewVehicleRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function NewVehicleRequestDialog({ open, onOpenChange, onSuccess }: NewVehicleRequestDialogProps) {
  const { supabase, user } = useAuth();
  const [isLoading, setIsLoading] = React.useState(false);

  const [vehicleType, setVehicleType] = React.useState(VEHICLE_TYPES[0]);
  const [customType, setCustomType] = React.useState("");
  const [reason, setReason] = React.useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const finalType = vehicleType === "Egyéb / Speciális" ? customType : vehicleType;

    if (!finalType || !reason) {
      toast.error("Kérjük, tölts ki minden mezőt!");
      return;
    }

    setIsLoading(true);

    try {
      // JAVÍTÁS: 'any' használata az adatoknál és a metódushívásnál is
      const insertData: any = {
        user_id: user.id,
        vehicle_type: finalType,
        reason: reason,
        status: 'pending'
      };

      // Itt a (supabase.from(...) as any) a lényeg
      const { error } = await (supabase.from('vehicle_requests') as any)
        .insert(insertData);

      if (error) throw error;

      toast.success("Igénylés sikeresen elküldve!");
      setReason("");
      setVehicleType(VEHICLE_TYPES[0]);
      setCustomType("");
      onSuccess();
      onOpenChange(false);

    } catch (error) {
      toast.error("Hiba történt az igénylés során", { description: (error as Error).message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="w-5 h-5 text-yellow-500" />
            Új Járműigénylés
          </DialogTitle>
          <DialogDescription>
            Szolgálati gépjármű igénylése tartós használatra.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Jármű Típusa</Label>
            <select
              className="w-full h-10 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white focus:border-yellow-600/50 focus:outline-none"
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
            >
              {VEHICLE_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {vehicleType === "Egyéb / Speciális" && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
              <Label>Pontos Típus</Label>
              <Input
                placeholder="Pl. Enus Stafford"
                className="bg-slate-950 border-slate-700"
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Igénylés Indoklása</Label>
            <Textarea
              placeholder="Miért van szükséged erre a járműre? (Pl. Beosztás, feladatkör)"
              className="bg-slate-950 border-slate-700 min-h-[100px]"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Mégse</Button>
            <Button type="submit" className="bg-yellow-600 hover:bg-yellow-700 text-black" disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Igénylés Leadása"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}