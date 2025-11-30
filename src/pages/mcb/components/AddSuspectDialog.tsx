import * as React from "react";
import {useAuth} from "@/context/AuthContext";
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Search, Loader2, UserPlus, Fingerprint} from "lucide-react";
import {toast} from "sonner";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {ScrollArea} from "@/components/ui/scroll-area";
import type {Suspect} from "@/types/supabase";

interface AddSuspectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  onSuspectAdded: () => void;
  existingSuspectIds: string[];
}

export function AddSuspectDialog({
                                   open,
                                   onOpenChange,
                                   caseId,
                                   onSuspectAdded,
                                   existingSuspectIds
                                 }: AddSuspectDialogProps) {
  const {supabase} = useAuth();
  const [search, setSearch] = React.useState("");
  const [results, setResults] = React.useState<Suspect[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedSuspect, setSelectedSuspect] = React.useState<Suspect | null>(null);
  const [role, setRole] = React.useState("suspect");
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    const searchSuspects = async () => {
      if (search.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      const {data} = await supabase.from('suspects').select('*').ilike('full_name', `%${search}%`).limit(5);
      if (data) setResults(data.filter(s => !existingSuspectIds.includes(s.id)));
      setLoading(false);
    };
    const debounce = setTimeout(searchSuspects, 500);
    return () => clearTimeout(debounce);
  }, [search, supabase, existingSuspectIds]);

  const handleAdd = async () => {
    if (!selectedSuspect) return;
    try {
      const {error} = await supabase.from('case_suspects').insert({
        case_id: caseId,
        suspect_id: selectedSuspect.id,
        involvement_type: role,
        notes: notes
      });
      if (error) throw error;
      toast.success(`${selectedSuspect.full_name} csatolva.`);
      onSuspectAdded();
      handleClose();
    } catch (error: any) {
      toast.error("Hiba történt.");
    }
  };

  const handleClose = () => {
    setSearch("");
    setSelectedSuspect(null);
    setRole("suspect");
    setNotes("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="bg-[#0a0f1c] border border-sky-900/50 text-white sm:max-w-md p-0 overflow-hidden shadow-2xl">
        <div className="bg-sky-950/30 border-b border-sky-900/30 px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-sky-500/10 flex items-center justify-center border border-sky-500/20">
            <UserPlus className="w-5 h-5 text-sky-400"/>
          </div>
          <div>
            <DialogTitle className="text-lg font-black tracking-tight text-white uppercase font-mono">SZEMÉLY
              CSATOLÁSA</DialogTitle>
            <p className="text-[10px] text-sky-500/70 font-mono tracking-widest uppercase">Link Subject to Case</p>
          </div>
        </div>

        <div className="p-6">
          {!selectedSuspect ? (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sky-500"/>
                <Input placeholder="Név keresése..."
                       className="pl-10 bg-slate-950 border-slate-800 focus-visible:ring-sky-500/50 h-10" value={search}
                       onChange={e => setSearch(e.target.value)} autoFocus/>
              </div>
              <ScrollArea className="h-[200px] rounded border border-slate-800 bg-slate-950/30 p-2">
                {loading ?
                  <div className="flex justify-center p-4"><Loader2 className="animate-spin w-5 h-5 text-sky-500"/>
                  </div>
                  : results.length === 0 ? <p
                      className="text-center text-xs text-slate-500 p-4 font-mono">{search.length < 2 ? "ÍRJ BE NEVET..." : "NINCS TALÁLAT"}</p>
                    : <div className="space-y-1">{results.map(suspect => (
                      <button key={suspect.id}
                              className="w-full flex items-center gap-3 p-2 rounded hover:bg-sky-500/10 hover:border-sky-500/30 border border-transparent transition-all text-left group"
                              onClick={() => setSelectedSuspect(suspect)}>
                        <Avatar
                          className="h-8 w-8 border border-slate-700 group-hover:border-sky-500 transition-colors">
                          <AvatarImage src={suspect.mugshot_url || undefined}/>
                          <AvatarFallback
                            className="bg-slate-900 text-xs">{suspect.full_name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-bold text-white group-hover:text-sky-400">{suspect.full_name}</p>
                          <p
                            className="text-[10px] text-slate-500 font-mono">{suspect.alias ? `ALIAS: ${suspect.alias}` : "NO ALIAS"}</p>
                        </div>
                      </button>
                    ))}</div>}
              </ScrollArea>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <div
                className="flex items-center gap-4 p-4 bg-slate-950/80 rounded border border-sky-500/30 relative overflow-hidden">
                <div className="absolute inset-0 bg-sky-500/5 animate-pulse pointer-events-none"></div>
                <Avatar className="h-12 w-12 border-2 border-sky-500/50">
                  <AvatarImage src={selectedSuspect.mugshot_url || undefined}/>
                  <AvatarFallback
                    className="bg-slate-900 font-bold">{selectedSuspect.full_name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-black text-white text-lg">{selectedSuspect.full_name}</p>
                  <button onClick={() => setSelectedSuspect(null)}
                          className="text-xs text-sky-400 hover:text-white font-mono uppercase underline decoration-sky-500/50">Vissza
                    a kereséshez
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-slate-500">Szerepkör</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger className="bg-slate-950 border-slate-800 h-9 text-xs"><SelectValue/></SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                      <SelectItem value="suspect" className="text-red-400 font-bold">GYANÚSÍTOTT</SelectItem>
                      <SelectItem value="perpetrator" className="text-red-600 font-bold">ELKÖVETŐ</SelectItem>
                      <SelectItem value="witness" className="text-blue-400">TANÚ</SelectItem>
                      <SelectItem value="victim" className="text-yellow-400">ÁLDOZAT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-slate-500">Megjegyzés</Label>
                  <Input placeholder="..." className="bg-slate-950 border-slate-800 h-9 text-xs" value={notes}
                         onChange={e => setNotes(e.target.value)}/>
                </div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="p-4 bg-slate-950/50 border-t border-slate-800/50">
          <Button variant="ghost" onClick={handleClose} size="sm" className="h-8">Mégse</Button>
          <Button onClick={handleAdd} disabled={!selectedSuspect} size="sm"
                  className="h-8 bg-sky-600 hover:bg-sky-500 text-white font-bold">CSATOLÁS</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}