import * as React from "react";
import { useAuth } from "@/context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Suspect } from "@/types/supabase";

interface AddSuspectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  onSuspectAdded: () => void;
  existingSuspectIds: string[]; // Hogy ne adhassuk hozzá kétszer ugyanazt
}

export function AddSuspectDialog({ open, onOpenChange, caseId, onSuspectAdded, existingSuspectIds }: AddSuspectDialogProps) {
  const { supabase } = useAuth();
  const [search, setSearch] = React.useState("");
  const [results, setResults] = React.useState<Suspect[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedSuspect, setSelectedSuspect] = React.useState<Suspect | null>(null);

  // Form adatok
  const [role, setRole] = React.useState("suspect"); // suspect, witness, victim, perpetrator
  const [notes, setNotes] = React.useState("");

  // Keresés (Debounce-al)
  React.useEffect(() => {
    const searchSuspects = async () => {
      if (search.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      const { data } = await supabase
        .from('suspects')
        .select('*')
        .ilike('full_name', `%${search}%`)
        .limit(5);

      if (data) {
        // Szűrjük ki azokat, akik már hozzá vannak adva az aktához
        setResults(data.filter(s => !existingSuspectIds.includes(s.id)));
      }
      setLoading(false);
    };

    const debounce = setTimeout(searchSuspects, 500);
    return () => clearTimeout(debounce);
  }, [search, supabase, existingSuspectIds]);

  const handleAdd = async () => {
    if (!selectedSuspect) return;

    try {
      const { error } = await supabase.from('case_suspects').insert({
        case_id: caseId,
        suspect_id: selectedSuspect.id,
        involvement_type: role,
        notes: notes
      });

      if (error) throw error;

      toast.success(`${selectedSuspect.full_name} hozzáadva az aktához.`);
      onSuspectAdded();
      handleClose();

    } catch (error: any) {
      console.error(error);
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
      <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Személy hozzáadása az aktához</DialogTitle>
          <DialogDescription>Keress a nyilvántartásban szereplő személyek között.</DialogDescription>
        </DialogHeader>

        {!selectedSuspect ? (
          <div className="space-y-4 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Név keresése..."
                className="pl-9 bg-slate-950 border-slate-800 focus-visible:ring-yellow-500/50"
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>

            <ScrollArea className="h-[200px] rounded-md border border-slate-800 bg-slate-950/50 p-2">
              {loading ? (
                <div className="flex justify-center p-4"><Loader2 className="animate-spin w-5 h-5 text-slate-500"/></div>
              ) : results.length === 0 ? (
                <p className="text-center text-xs text-slate-500 p-4">
                  {search.length < 2 ? "Írj be legalább 2 karaktert." : "Nincs találat a nyilvántartásban."}
                </p>
              ) : (
                <div className="space-y-1">
                  {results.map(suspect => (
                    <button
                      key={suspect.id}
                      className="w-full flex items-center gap-3 p-2 rounded hover:bg-slate-800 transition-colors text-left"
                      onClick={() => setSelectedSuspect(suspect)}
                    >
                      <Avatar className="h-8 w-8 border border-slate-700">
                        <AvatarImage src={suspect.mugshot_url || undefined} />
                        <AvatarFallback className="bg-slate-900 text-xs">{suspect.full_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-white">{suspect.full_name}</p>
                        <p className="text-xs text-slate-400">{suspect.alias ? `"${suspect.alias}"` : "Nincs alias"}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        ) : (
          <div className="space-y-4 py-2 animate-in fade-in slide-in-from-right-4">
            <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800">
              <Avatar className="h-10 w-10 border border-slate-700">
                <AvatarImage src={selectedSuspect.mugshot_url || undefined} />
                <AvatarFallback>{selectedSuspect.full_name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-bold text-white">{selectedSuspect.full_name}</p>
                <button onClick={() => setSelectedSuspect(null)} className="text-xs text-blue-400 hover:underline hover:text-blue-300">Vissza a kereséshez</button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Szerepkör az ügyben</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="suspect">Gyanúsított</SelectItem>
                  <SelectItem value="perpetrator">Elkövető</SelectItem>
                  <SelectItem value="witness">Tanú</SelectItem>
                  <SelectItem value="victim">Áldozat</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Megjegyzés (Opcionális)</Label>
              <Input
                placeholder="pl. A helyszínen látták menekülni..."
                className="bg-slate-950 border-slate-800"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>Mégse</Button>
          <Button onClick={handleAdd} disabled={!selectedSuspect} className="bg-yellow-600 hover:bg-yellow-700 text-black font-semibold">Hozzáadás</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}