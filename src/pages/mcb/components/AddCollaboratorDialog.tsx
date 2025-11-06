import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Plus, UserCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import type { UserRole } from "@/types/supabase";
import { ScrollArea } from "@/components/ui/scroll-area";

// Keresési eredmény típusa
type SearchResultProfile = {
  id: string;
  full_name: string;
  role: UserRole;
}

interface AddCollaboratorDialogProps {
  caseId: string;
  ownerId: string;
  existingCollaborators: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCollaboratorAdded: () => void;
}

export function AddCollaboratorDialog({
                                        caseId,
                                        ownerId,
                                        existingCollaborators,
                                        open,
                                        onOpenChange,
                                        onCollaboratorAdded,
                                      }: AddCollaboratorDialogProps) {
  const { supabase, profile } = useAuth();
  const [searchTerm, setSearchTerm] = React.useState("");

  // --- JAVÍTOTT LOGIKA ---
  const [isLoading, setIsLoading] = React.useState(false); // Ez már csak a teljes lista betöltését jelzi
  const [allDetectives, setAllDetectives] = React.useState<SearchResultProfile[]>([]); // Itt tároljuk a teljes listát
  const [filteredResults, setFilteredResults] = React.useState<SearchResultProfile[]>([]); // Itt a szűrt listát
  // --- VÉGE ---

  const [isAdding, setIsAdding] = React.useState<string | null>(null);

  // JAVÍTÁS: Keresés helyett mostantól a 'searchTerm' változását figyeljük
  React.useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredResults(allDetectives); // Ha üres a kereső, mutass mindent
    } else {
      const lowerSearch = searchTerm.toLowerCase();
      const filtered = allDetectives.filter(user =>
        user.full_name.toLowerCase().includes(lowerSearch)
      );
      setFilteredResults(filtered);
    }
  }, [searchTerm, allDetectives]); // Figyeljük a searchTerm ÉS az allDetectives változását

  // JAVÍTÁS: Adatok lekérése a dialógus megnyitásakor
  React.useEffect(() => {
    if (open) {
      // Csak akkor töltsük be, ha még nem tettük meg
      if (allDetectives.length === 0) {
        setIsLoading(true);
        const fetchAllDetectives = async () => {
          const { data, error } = await supabase
            .from("profiles")
            .select("id, full_name, role")
            .neq("role", "pending") // Függőben lévőket ne
            .neq("id", profile!.id) // Saját magunkat ne
            .neq("id", ownerId)   // <-- JAVÍTÁS: Kiszűrjük az akta tulajdonosát is

          if (error) {
            toast.error("Hiba a nyomozók listájának lekérésekor", { description: error.message });
          } else {
            setAllDetectives(data as SearchResultProfile[]);
            setFilteredResults(data as SearchResultProfile[]);
          }
          setIsLoading(false);
        };
        fetchAllDetectives();
      }
    } else {
      // Dialógus bezárásakor resetelünk
      setSearchTerm("");
      setFilteredResults(allDetectives); // Reset a szűrésre
    }
  }, [open, supabase, profile, allDetectives.length]); // Figyeljük az 'open' állapotot

  // Felhasználó hozzáadása (VÁLTOZATLAN)
  const handleAddUser = async (user: SearchResultProfile) => {
    setIsAdding(user.id);
    const { error } = await supabase.from("case_collaborators").insert({
      case_id: caseId,
      user_id: user.id,
      status: "approved",
    });
    setIsAdding(null);
    if (error) {
      toast.error("Hiba a hozzáadás közben", { description: error.message });
    } else {
      toast.success(`${user.full_name} hozzáadva az aktához.`);
      onCollaboratorAdded();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Közreműködő Hozzáadása</DialogTitle>
          <DialogDescription>
            Keress rá a nyomozóra a neve alapján, és add hozzá az aktához.
          </DialogDescription>
        </DialogHeader>

        {/* --- JAVÍTÁS: Keresőgomb eltávolítva --- */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            id="search"
            placeholder="Keresés a nyomozók között..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-64 w-full rounded-md border border-slate-700 bg-slate-800 p-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : filteredResults.length === 0 ? (
            <p className="text-center text-sm text-slate-500 pt-4">
              {allDetectives.length > 0 ? "Nincs találat." : "Nincsenek más nyomozók a rendszerben."}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredResults.map((user) => {
                const isAlreadyAdded = existingCollaborators.includes(user.id);
                return (
                  <div key={user.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{user.full_name}</p>
                      <p className="text-sm text-slate-400">{user.role}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="default"
                      disabled={isAlreadyAdded || isAdding === user.id}
                      onClick={() => handleAddUser(user)}
                    >
                      {isAdding === user.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isAlreadyAdded ? (
                        <UserCheck className="w-4 h-4 mr-2" />
                      ) : (
                        <Plus className="w-4 h-4 mr-2" />
                      )}
                      {isAlreadyAdded ? "Hozzáadva" : "Hozzáadás"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Mégse</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}