import * as React from "react";
import { useAuth } from "@/context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, MapPin, User, CheckSquare, Square } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface WarrantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  suspects: any[];
  onSuccess: () => void;
}

export function WarrantDialog({ open, onOpenChange, caseId, suspects, onSuccess }: WarrantDialogProps) {
  const { supabase, user } = useAuth();
  const [loading, setLoading] = React.useState(false);

  const [type, setType] = React.useState("arrest");
  const [selectedSuspectId, setSelectedSuspectId] = React.useState<string | "unknown">("");

  const [suspectProperties, setSuspectProperties] = React.useState<any[]>([]);
  const [selectedPropertyIds, setSelectedPropertyIds] = React.useState<string[]>([]);

  const [manualTarget, setManualTarget] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [description, setDescription] = React.useState("");

  React.useEffect(() => {
    if (selectedSuspectId && selectedSuspectId !== "unknown" && type === 'search') {
      const fetchProps = async () => {
        const { data } = await supabase.from('suspect_properties').select('*').eq('suspect_id', selectedSuspectId);
        setSuspectProperties(data || []);
        setSelectedPropertyIds([]);
      };
      fetchProps();
    } else {
      setSuspectProperties([]);
      setSelectedPropertyIds([]);
    }
  }, [selectedSuspectId, type, supabase]);

  const toggleProperty = (propId: string) => {
    setSelectedPropertyIds(prev =>
      prev.includes(propId) ? prev.filter(id => id !== propId) : [...prev, propId]
    );
  };

  // JAVÍTÁS: Duplikáció ellenőrző segédfüggvény
  const checkDuplicate = async (criteria: any) => {
    const { data, error } = await supabase
      .from('case_warrants')
      .select('id')
      .eq('case_id', caseId)
      .eq('type', type)
      .eq('status', 'pending') // Csak a függőben lévőket nézzük
      .match(criteria); // Dinamikus szűrés (pl. suspect_id: '...')

    if (error) {
      console.error("Check error:", error);
      return false; // Hiba esetén engedjük (vagy tilthatjuk), most engedjük
    }
    return data.length > 0;
  };

  const handleSubmit = async () => {
    if (!reason) return toast.error("Indoklás kötelező!");

    const requests = [];
    setLoading(true);

    try {
      if (type === 'arrest') {
        if (!selectedSuspectId) { setLoading(false); return toast.error("Válassz személyt!"); }

        if (selectedSuspectId !== 'unknown') {
          // Check duplicate
          if (await checkDuplicate({ suspect_id: selectedSuspectId })) {
            setLoading(false);
            return toast.error("Már van függőben lévő elfogatóparancs erre a személyre ebben az aktában!");
          }

          requests.push({
            case_id: caseId, type: 'arrest', suspect_id: selectedSuspectId, target_name: null,
            reason, description, requested_by: user?.id, status: 'pending'
          });
        } else if (!manualTarget) {
          setLoading(false); return toast.error("Add meg a személy nevét!");
        } else {
          // Check duplicate (név alapján)
          if (await checkDuplicate({ target_name: manualTarget })) {
            setLoading(false);
            return toast.error("Már van függőben lévő parancs erre a névre!");
          }
          requests.push({
            case_id: caseId, type: 'arrest', suspect_id: null, target_name: manualTarget,
            reason, description, requested_by: user?.id, status: 'pending'
          });
        }
      } else { // Search
        if (selectedSuspectId && selectedSuspectId !== 'unknown') {
          if (selectedPropertyIds.length > 0) {
            // Több ingatlan -> Egyesével ellenőrizzük
            for (const propId of selectedPropertyIds) {
              if (await checkDuplicate({ property_id: propId })) {
                toast.error(`Az egyik ingatlanra már van folyamatban lévő kérelem!`);
                setLoading(false);
                return;
              }
              requests.push({
                case_id: caseId, type: 'search', suspect_id: selectedSuspectId, property_id: propId, target_name: null,
                reason, description, requested_by: user?.id, status: 'pending'
              });
            }
          } else if (manualTarget) {
            // Csak cím
            if (await checkDuplicate({ target_name: manualTarget })) {
              setLoading(false);
              return toast.error("Már van függőben lévő parancs erre a címre!");
            }
            requests.push({ case_id: caseId, type: 'search', suspect_id: selectedSuspectId, property_id: null, target_name: manualTarget, reason, description, requested_by: user?.id, status: 'pending' });
          } else {
            setLoading(false); return toast.error("Válassz legalább egy ingatlant vagy adj meg címet!");
          }
        } else {
          // Ismeretlen tettes / Csak cím
          if (!manualTarget) { setLoading(false); return toast.error("Add meg a címet!"); }
          if (await checkDuplicate({ target_name: manualTarget })) {
            setLoading(false);
            return toast.error("Már van függőben lévő parancs erre a címre!");
          }
          requests.push({ case_id: caseId, type: 'search', suspect_id: null, property_id: null, target_name: manualTarget, reason, description, requested_by: user?.id, status: 'pending' });
        }
      }

      // Mentés
      const { error } = await supabase.from('case_warrants').insert(requests);
      if (error) throw error;

      toast.success(`${requests.length} db parancs igényelve!`);
      onSuccess();
      onOpenChange(false);

      setReason(""); setDescription(""); setManualTarget(""); setSelectedSuspectId(""); setSelectedPropertyIds([]);
    } catch (error: any) {
      toast.error("Hiba történt.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-2 bg-slate-950/50 shrink-0">
          <DialogTitle>Parancs Igénylése</DialogTitle>
          <DialogDescription>Hatósági intézkedés engedélyezése.</DialogDescription>
        </DialogHeader>

        {/* ScrollArea a tartalomnak, hogy ne lógjon ki */}
        <div className="flex-1 overflow-y-auto p-6 pt-2">
          <div className="space-y-4">
            {/* ... (A form tartalma UGYANAZ mint eddig, csak a ScrollArea miatt most már jó helyen lesz) ... */}
            {/* ... (Típus választó) ... */}
            <div className="space-y-2">
              <Label>Parancs Típusa</Label>
              <div className="flex gap-2">
                <button onClick={() => { setType("arrest"); setSelectedSuspectId(""); }} className={`flex-1 py-2 rounded border text-sm font-medium transition-colors ${type === 'arrest' ? 'bg-red-600/20 border-red-600 text-red-500' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>Elfogató (Arrest)</button>
                <button onClick={() => { setType("search"); setSelectedSuspectId(""); }} className={`flex-1 py-2 rounded border text-sm font-medium transition-colors ${type === 'search' ? 'bg-orange-600/20 border-orange-600 text-orange-500' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>Házkutatási (Search)</button>
              </div>
            </div>

            {/* ... (Célpont választó) ... */}
            <div className="space-y-2">
              <Label>{type === 'arrest' ? 'Célszemély' : 'Tulajdonos / Célpont'}</Label>
              <Select value={selectedSuspectId} onValueChange={setSelectedSuspectId}>
                <SelectTrigger className="bg-slate-950 border-slate-800"><SelectValue placeholder="Válassz az aktából..." /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="unknown">{type === 'arrest' ? 'Ismeretlen / Nincs az aktában' : 'Ismeretlen / Csak Cím'}</SelectItem>
                  {suspects.map(s => (
                    <SelectItem key={s.suspect_id} value={s.suspect_id}>{s.suspect?.full_name} ({s.involvement_type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ingatlanok (Checkbox lista) */}
            {type === 'search' && selectedSuspectId && selectedSuspectId !== 'unknown' && (
              <div className="space-y-2 pl-4 border-l-2 border-slate-800">
                <Label>Ingatlanok Kiválasztása</Label>
                {suspectProperties.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">Ennek a személynek nincsenek rögzített ingatlanjai.</p>
                ) : (
                  <ScrollArea className="h-[120px] border border-slate-800 rounded-md bg-slate-950 p-2">
                    <div className="space-y-1">
                      {suspectProperties.map(p => {
                        const isSelected = selectedPropertyIds.includes(p.id);
                        return (
                          <div key={p.id} className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${isSelected ? 'bg-yellow-500/10 border border-yellow-500/30' : 'hover:bg-slate-800'}`} onClick={() => toggleProperty(p.id)}>
                            {isSelected ? <CheckSquare className="w-4 h-4 text-yellow-500 shrink-0"/> : <Square className="w-4 h-4 text-slate-500 shrink-0"/>}
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-[10px] h-4 px-1">{p.property_type}</Badge>
                                <span className={`text-sm font-medium ${isSelected ? 'text-yellow-200' : 'text-slate-300'}`}>{p.address}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}

            {/* Manuális Input */}
            {((selectedSuspectId === 'unknown' || !selectedSuspectId) || (type === 'search' && selectedPropertyIds.length === 0)) && (
              <div className="space-y-2">
                <Label>{type === 'arrest' ? 'Személy Neve (Ha nincs listában)' : 'Cím (Ha nincs ingatlan választva)'}</Label>
                <div className="relative">
                  {type === 'search' ? <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/> : <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>}
                  <Input placeholder={type === 'search' ? "pl. Santa Maria Beach 4." : "pl. John Doe"} value={manualTarget} onChange={e => setManualTarget(e.target.value)} className="bg-slate-950 border-slate-800 pl-9"/>
                </div>
              </div>
            )}

            {/* Indoklás */}
            <div className="space-y-2">
              <Label>Indoklás</Label>
              <Input placeholder="Röviden..." value={reason} onChange={e => setReason(e.target.value)} className="bg-slate-950 border-slate-800"/>
            </div>
            <div className="space-y-2">
              <Label>Részletek / Bizonyítékok hivatkozása</Label>
              <Textarea placeholder="Fejtsd ki..." value={description} onChange={e => setDescription(e.target.value)} className="bg-slate-950 border-slate-800 resize-none h-20"/>
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 pt-2 border-t border-slate-800 bg-slate-950/50 shrink-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-red-600 hover:bg-red-700 text-white">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Igénylés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}