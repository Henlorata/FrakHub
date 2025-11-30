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
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Search, Loader2, UserCog, ShieldCheck} from "lucide-react";
import {toast} from "sonner";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {ScrollArea} from "@/components/ui/scroll-area";
import type {Profile} from "@/types/supabase";

interface AddCollaboratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  onCollaboratorAdded: () => void;
  existingUserIds: string[];
}

export function AddCollaboratorDialog({
                                        open,
                                        onOpenChange,
                                        caseId,
                                        onCollaboratorAdded,
                                        existingUserIds
                                      }: AddCollaboratorDialogProps) {
  const {supabase} = useAuth();
  const [search, setSearch] = React.useState("");
  const [results, setResults] = React.useState<Profile[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState<Profile | null>(null);
  const [role, setRole] = React.useState("editor");

  React.useEffect(() => {
    const searchUsers = async () => {
      if (search.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      const {data} = await supabase.from('profiles').select('*').ilike('full_name', `%${search}%`).limit(5);
      if (data) setResults(data.filter(u => !existingUserIds.includes(u.id)));
      setLoading(false);
    };
    const debounce = setTimeout(searchUsers, 500);
    return () => clearTimeout(debounce);
  }, [search, supabase, existingUserIds]);

  const handleAdd = async () => {
    if (!selectedUser) return;
    try {
      const {error} = await supabase.from('case_collaborators').insert({
        case_id: caseId,
        user_id: selectedUser.id,
        role: role as any
      });
      if (error) throw error;
      toast.success(`${selectedUser.full_name} hozzáadva.`);
      onCollaboratorAdded();
      handleClose();
    } catch (e) {
      toast.error("Hiba történt.");
    }
  };

  const handleClose = () => {
    setSearch("");
    setSelectedUser(null);
    setRole("editor");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="bg-[#0a0f1c] border border-blue-900/50 text-white sm:max-w-md p-0 overflow-hidden shadow-2xl">
        <div className="bg-blue-950/20 border-b border-blue-900/30 px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
            <UserCog className="w-5 h-5 text-blue-400"/>
          </div>
          <div>
            <DialogTitle className="text-lg font-black tracking-tight text-white uppercase font-mono">HOZZÁFÉRÉS
              KEZELÉS</DialogTitle>
            <p className="text-[10px] text-blue-500/70 font-mono tracking-widest uppercase">Grant Personnel Access</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {!selectedUser ? (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>
                <Input placeholder="Név vagy jelvényszám..."
                       className="pl-9 bg-slate-950 border-slate-800 focus-visible:ring-blue-500/50 h-10 text-sm"
                       value={search} onChange={e => setSearch(e.target.value)} autoFocus/>
              </div>
              <ScrollArea className="h-[200px] rounded border border-slate-800 bg-slate-950/30 p-2">
                {loading ?
                  <div className="flex justify-center p-4"><Loader2 className="animate-spin w-5 h-5 text-blue-500"/>
                  </div> :
                  results.length === 0 ? <p
                    className="text-center text-xs text-slate-500 p-4 font-mono">{search.length < 2 ? "KERESÉS..." : "NINCS TALÁLAT"}</p> : (
                    <div className="space-y-1">
                      {results.map(user => (
                        <button key={user.id}
                                className="w-full flex items-center gap-3 p-2 rounded hover:bg-blue-500/10 hover:border-blue-500/30 border border-transparent transition-all text-left group"
                                onClick={() => setSelectedUser(user)}>
                          <Avatar className="h-8 w-8 border border-slate-700 group-hover:border-blue-500"><AvatarImage
                            src={user.avatar_url}/><AvatarFallback
                            className="bg-slate-900 text-[10px]">{user.full_name.charAt(0)}</AvatarFallback></Avatar>
                          <div>
                            <p className="text-sm font-bold text-white group-hover:text-blue-400">{user.full_name}</p>
                            <p
                              className="text-[10px] text-slate-500 font-mono uppercase">{user.faction_rank} • {user.badge_number}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
              </ScrollArea>
            </>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <div
                className="flex items-center gap-4 p-4 bg-slate-950/80 rounded border border-blue-500/30 relative overflow-hidden">
                <div className="absolute inset-0 bg-blue-500/5 pointer-events-none"></div>
                <Avatar className="h-12 w-12 border-2 border-blue-500/50"><AvatarImage
                  src={selectedUser.avatar_url}/><AvatarFallback
                  className="bg-slate-900 font-bold">{selectedUser.full_name.charAt(0)}</AvatarFallback></Avatar>
                <div>
                  <p className="font-black text-white text-lg">{selectedUser.full_name}</p>
                  <p className="text-xs text-blue-400 font-mono uppercase">{selectedUser.faction_rank}</p>
                  <button onClick={() => setSelectedUser(null)}
                          className="text-[10px] text-slate-500 hover:text-white mt-1 underline decoration-slate-700">MÁSIK
                    SZEMÉLY VÁLASZTÁSA
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-slate-500">Jogosultsági Szint</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 h-10"><SelectValue/></SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                    <SelectItem value="editor" className="font-bold text-blue-400">SZERKESZTŐ (Editor)</SelectItem>
                    <SelectItem value="viewer">MEGFIGYELŐ (Viewer)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-slate-500 italic mt-1">
                  {role === 'editor' ? 'Teljes hozzáférést kap az akta szerkesztéséhez, bizonyítékok kezeléséhez.' : 'Csak olvasási jogot kap, nem módosíthatja a tartalmat.'}
                </p>
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="p-4 bg-slate-950/50 border-t border-slate-800/50">
          <Button variant="ghost" onClick={handleClose} size="sm">Mégse</Button>
          <Button onClick={handleAdd} disabled={!selectedUser} size="sm"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold">HOZZÁADÁS</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}