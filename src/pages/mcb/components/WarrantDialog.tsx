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
import {Loader2, MapPin, User, CheckSquare, Square, FileWarning, AlertTriangle, ShieldAlert} from "lucide-react";
import {ScrollArea} from "@/components/ui/scroll-area";
import {Badge} from "@/components/ui/badge";
import {cn} from "@/lib/utils";

interface WarrantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  suspects: any[];
  onSuccess: () => void;
}

export function WarrantDialog({open, onOpenChange, caseId, suspects, onSuccess}: WarrantDialogProps) {
  const {supabase, user} = useAuth();
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
        const {data} = await supabase.from('suspect_properties').select('*').eq('suspect_id', selectedSuspectId);
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
    setSelectedPropertyIds(prev => prev.includes(propId) ? prev.filter(id => id !== propId) : [...prev, propId]);
  };

  const checkDuplicate = async (criteria: any) => {
    const {data} = await supabase.from('case_warrants').select('id').eq('case_id', caseId).eq('type', type).eq('status', 'pending').match(criteria);
    return data && data.length > 0;
  };

  const handleSubmit = async () => {
    if (!reason) return toast.error("Indoklás kötelező!");
    const requests = [];
    setLoading(true);

    try {
      if (type === 'arrest') {
        if (!selectedSuspectId) {
          setLoading(false);
          return toast.error("Válassz személyt!");
        }
        if (selectedSuspectId !== 'unknown') {
          if (await checkDuplicate({suspect_id: selectedSuspectId})) {
            setLoading(false);
            return toast.error("Már van függőben lévő kérelem!");
          }
          requests.push({
            case_id: caseId,
            type: 'arrest',
            suspect_id: selectedSuspectId,
            target_name: null,
            reason,
            description,
            requested_by: user?.id,
            status: 'pending'
          });
        } else if (!manualTarget) {
          setLoading(false);
          return toast.error("Add meg a nevet!");
        } else {
          if (await checkDuplicate({target_name: manualTarget})) {
            setLoading(false);
            return toast.error("Már van függőben lévő kérelem!");
          }
          requests.push({
            case_id: caseId,
            type: 'arrest',
            suspect_id: null,
            target_name: manualTarget,
            reason,
            description,
            requested_by: user?.id,
            status: 'pending'
          });
        }
      } else { // Search
        if (selectedSuspectId && selectedSuspectId !== 'unknown') {
          if (selectedPropertyIds.length > 0) {
            for (const propId of selectedPropertyIds) {
              if (await checkDuplicate({property_id: propId})) {
                toast.error("Duplikáció!");
                setLoading(false);
                return;
              }
              requests.push({
                case_id: caseId,
                type: 'search',
                suspect_id: selectedSuspectId,
                property_id: propId,
                target_name: null,
                reason,
                description,
                requested_by: user?.id,
                status: 'pending'
              });
            }
          } else if (manualTarget) {
            requests.push({
              case_id: caseId,
              type: 'search',
              suspect_id: selectedSuspectId,
              property_id: null,
              target_name: manualTarget,
              reason,
              description,
              requested_by: user?.id,
              status: 'pending'
            });
          } else {
            setLoading(false);
            return toast.error("Válassz ingatlant vagy adj meg címet!");
          }
        } else {
          if (!manualTarget) {
            setLoading(false);
            return toast.error("Add meg a címet!");
          }
          requests.push({
            case_id: caseId,
            type: 'search',
            suspect_id: null,
            property_id: null,
            target_name: manualTarget,
            reason,
            description,
            requested_by: user?.id,
            status: 'pending'
          });
        }
      }

      const {error} = await supabase.from('case_warrants').insert(requests);
      if (error) throw error;
      toast.success(`${requests.length} parancs igényelve.`);
      onSuccess();
      onOpenChange(false);
      setReason("");
      setDescription("");
      setManualTarget("");
      setSelectedSuspectId("");
      setSelectedPropertyIds([]);
    } catch (e) {
      toast.error("Hiba történt.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#0a0f1c] border border-red-900/40 text-white sm:max-w-lg max-h-[90vh] p-0 overflow-hidden shadow-[0_0_50px_rgba(220,38,38,0.1)]">
        <div className="bg-red-950/20 border-b border-red-900/30 px-6 py-4 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded bg-red-500/10 flex items-center justify-center border border-red-500/20 animate-pulse">
            <ShieldAlert className="w-5 h-5 text-red-500"/>
          </div>
          <div>
            <DialogTitle className="text-lg font-black tracking-tight text-white uppercase font-mono">PARANCS
              IGÉNYLÉSE</DialogTitle>
            <p className="text-[10px] text-red-500/70 font-mono tracking-widest uppercase">Judicial Authorization
              Request</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => {
              setType("arrest");
              setSelectedSuspectId("");
            }}
                    className={cn("flex items-center justify-center gap-2 py-3 rounded border font-bold uppercase text-xs transition-all",
                      type === 'arrest' ? 'bg-red-600/20 border-red-600 text-red-500 shadow-[0_0_15px_rgba(220,38,38,0.2)]' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700')}>
              <FileWarning className="w-4 h-4"/> ELFOGATÓ (Arrest)
            </button>
            <button onClick={() => {
              setType("search");
              setSelectedSuspectId("");
            }}
                    className={cn("flex items-center justify-center gap-2 py-3 rounded border font-bold uppercase text-xs transition-all",
                      type === 'search' ? 'bg-orange-600/20 border-orange-600 text-orange-500 shadow-[0_0_15px_rgba(234,88,12,0.2)]' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700')}>
              <AlertTriangle className="w-4 h-4"/> HÁZKUTATÁSI (Search)
            </button>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold text-slate-500">Célpont Kiválasztása</Label>
            <Select value={selectedSuspectId} onValueChange={setSelectedSuspectId}>
              <SelectTrigger className="bg-slate-950 border-slate-800 h-10"><SelectValue
                placeholder="Válassz az aktából..."/></SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white">
                <SelectItem value="unknown" className="text-yellow-500 font-bold">ISMERETLEN / KÜLSŐ
                  CÉLPONT</SelectItem>
                {suspects.map(s => <SelectItem key={s.suspect_id}
                                               value={s.suspect_id}>{s.suspect?.full_name} ({s.involvement_type})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {type === 'search' && selectedSuspectId && selectedSuspectId !== 'unknown' && (
            <div className="space-y-2 p-3 rounded bg-slate-950/50 border border-slate-800">
              <Label className="text-[10px] uppercase font-bold text-slate-500">Ismert Ingatlanok</Label>
              {suspectProperties.length === 0 ?
                <p className="text-xs text-slate-500 italic">Nincsenek rögzített ingatlanok.</p> :
                <div className="space-y-1">
                  {suspectProperties.map(p => {
                    const isSelected = selectedPropertyIds.includes(p.id);
                    return (
                      <div key={p.id}
                           className={cn("flex items-center gap-3 p-2 rounded cursor-pointer transition-colors border", isSelected ? 'bg-orange-500/10 border-orange-500/50' : 'border-transparent hover:bg-slate-900')}
                           onClick={() => toggleProperty(p.id)}>
                        {isSelected ? <CheckSquare className="w-4 h-4 text-orange-500"/> :
                          <Square className="w-4 h-4 text-slate-600"/>}
                        <span
                          className={cn("text-xs font-mono", isSelected ? "text-orange-200" : "text-slate-400")}>{p.address} ({p.property_type})</span>
                      </div>
                    )
                  })}
                </div>
              }
            </div>
          )}

          {((selectedSuspectId === 'unknown' || !selectedSuspectId) || (type === 'search' && selectedPropertyIds.length === 0)) && (
            <div className="space-y-2">
              <Label
                className="text-[10px] uppercase font-bold text-slate-500">{type === 'arrest' ? 'Név (Manuális)' : 'Cím (Manuális)'}</Label>
              <div className="relative">
                {type === 'search' ?
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/> :
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>}
                <Input placeholder="..." value={manualTarget} onChange={e => setManualTarget(e.target.value)}
                       className="bg-slate-950 border-slate-800 pl-9"/>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold text-slate-500">Hivatalos Indoklás</Label>
            <Input value={reason} onChange={e => setReason(e.target.value)} className="bg-slate-950 border-slate-800"
                   placeholder="Pl. Fegyveres rablás megalapozott gyanúja"/>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold text-slate-500">Bizonyítékok hivatkozása</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)}
                      className="bg-slate-950 border-slate-800 h-20 resize-none break-all"
                      placeholder="Lásd: 3-as számú jelentés..."/>
          </div>
        </div>

        <DialogFooter className="p-4 bg-slate-950/50 border-t border-slate-800/50">
          <Button variant="ghost" onClick={() => onOpenChange(false)} size="sm">Mégse</Button>
          <Button onClick={handleSubmit} disabled={loading} size="sm"
                  className="bg-red-600 hover:bg-red-500 text-white font-bold">
            {loading && <Loader2 className="w-3 h-3 animate-spin mr-2"/>} IGÉNYLÉS BENYÚJTÁSA
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}