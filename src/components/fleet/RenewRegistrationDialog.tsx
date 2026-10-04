import * as React from "react";
import {toast} from "sonner";
import {Loader2, Save} from "lucide-react";
import {useAuth} from "@/context/AuthContext";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {errorMessage} from "@/lib/utils";
import type {FleetVehicle} from "@/types/supabase";

const today = () => new Date().toISOString().slice(0, 10);

/** The owner (or staff) records the new expiry date after renewing the registration in game. */
export function RenewRegistrationDialog({vehicle, onOpenChange, onRenewed}: {
  vehicle: FleetVehicle | null; onOpenChange: (open: boolean) => void; onRenewed: (vehicle: FleetVehicle) => void;
}) {
  const {supabase} = useAuth();
  // Mounted per vehicle (key), so the default is computed once: 30 days from today.
  const [date, setDate] = React.useState(() => {
    const next = new Date();
    next.setDate(next.getDate() + 30);
    return next.toISOString().slice(0, 10);
  });
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    if (!vehicle || !date) return;
    setSaving(true);
    const {data, error} = await supabase.rpc("fleet_renew_registration", {_vehicle_id: vehicle.id, _expires_on: date});
    setSaving(false);
    if (error) return toast.error(errorMessage(error, "A mentés nem sikerült."));
    toast.success(`${vehicle.plate}: forgalmi rögzítve.`);
    onRenewed(data as FleetVehicle);
    onOpenChange(false);
  };

  return (
    <Dialog open={!!vehicle} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Forgalmi engedély megújítása</DialogTitle>
          <DialogDescription>{vehicle?.plate} – {vehicle?.model}. Add meg az új lejárati dátumot.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Érvényes eddig</Label>
          <Input type="date" value={date} min={today()} onChange={(event) => setDate(event.target.value)}/>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button onClick={() => void save()} disabled={saving || !date}>{saving ? <Loader2 className="animate-spin"/> : <Save/>} Mentés</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
