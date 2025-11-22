import * as React from "react";
import { useAuth } from "@/context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Profile } from "@/types/supabase";

interface AddCollaboratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  onCollaboratorAdded: () => void;
  existingUserIds: string[];
}

export function AddCollaboratorDialog({ open, onOpenChange, caseId, onCollaboratorAdded, existingUserIds }: AddCollaboratorDialogProps) {
  const { supabase } = useAuth();
  const [search, setSearch] = React.useState("");
  const [results, setResults] = React.useState<Profile[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState<Profile | null>(null);
  const [role, setRole] = React.useState("editor"); // editor, viewer

  React.useEffect(() => {
    const searchUsers = async () => {
      if (search.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .ilike('full_name', `%${search}%`)
        .limit(5);

      if (data) {
        setResults(data.filter(u => !existingUserIds.includes(u.id)));
      }
      setLoading(false);
    };

    const debounce = setTimeout(searchUsers, 500);
    return () => clearTimeout(debounce);
  }, [search, supabase, existingUserIds]);

  const handleAdd = async () => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase.from('case_collaborators').insert({
        case_id: caseId,
        user_id: selectedUser.id,
        role: role as any
      });

      if (error) throw error;

      toast.success(`${selectedUser.full_name} hozzáadva.`);
      onCollaboratorAdded();
      handleClose();

    } catch (error: any) {
      console.error(error);
      toast.error("Hiba történt.");
    }
  };

  const handleClose = () => {
    setSearch(""); setSelectedUser(null); setRole("editor");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Közreműködő hozzáadása</DialogTitle>
          <DialogDescription>Válassz munkatársat a listából.</DialogDescription>
        </DialogHeader>

        {!selectedUser ? (
          <div className="space-y-4 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Név keresése..."
                className="pl-9 bg-slate-950 border-slate-800"
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <ScrollArea className="h-[200px] rounded-md border border-slate-800 bg-slate-950/50 p-2">
              {loading ? <div className="flex justify-center p-4"><Loader2 className="animate-spin w-5 h-5 text-slate-500"/></div> :
                results.length === 0 ? <p className="text-center text-xs text-slate-500 p-4">Nincs találat.</p> : (
                  <div className="space-y-1">
                    {results.map(user => (
                      <button key={user.id} className="w-full flex items-center gap-3 p-2 rounded hover:bg-slate-800 transition-colors text-left" onClick={() => setSelectedUser(user)}>
                        <Avatar className="h-8 w-8 border border-slate-700"><AvatarImage src={user.avatar_url} /><AvatarFallback className="bg-slate-900 text-xs">{user.full_name.charAt(0)}</AvatarFallback></Avatar>
                        <div>
                          <p className="text-sm font-medium text-white">{user.full_name}</p>
                          <p className="text-xs text-slate-400">{user.badge_number} - {user.faction_rank}</p>
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
              <Avatar className="h-10 w-10 border border-slate-700"><AvatarImage src={selectedUser.avatar_url} /><AvatarFallback>{selectedUser.full_name.charAt(0)}</AvatarFallback></Avatar>
              <div>
                <p className="font-bold text-white">{selectedUser.full_name}</p>
                <button onClick={() => setSelectedUser(null)} className="text-xs text-blue-400 hover:underline">Vissza</button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Jogosultság</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="editor">Szerkesztő (Teljes hozzáférés)</SelectItem>
                  <SelectItem value="viewer">Megfigyelő (Csak olvasás)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>Mégse</Button>
          <Button onClick={handleAdd} disabled={!selectedUser} className="bg-blue-600 hover:bg-blue-700 text-white">Hozzáadás</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}