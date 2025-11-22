import * as React from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SuspectDetailDialog } from "./components/SuspectDetailDialog";
import { Search, UserPlus, UserX, Skull, AlertTriangle, Lock, HelpCircle, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Suspect, SuspectStatus } from "@/types/supabase";
import {NewSuspectDialog} from "@/pages/mcb/components/NewSuspectDialog.tsx";

// Státusz Badge Segéd
const getStatusBadge = (status: SuspectStatus) => {
  switch(status) {
    case 'wanted': return <Badge className="bg-red-600 hover:bg-red-700 animate-pulse border-none"><AlertTriangle className="w-3 h-3 mr-1"/> KÖRÖZÖTT</Badge>;
    case 'jailed': return <Badge className="bg-orange-600 hover:bg-orange-700 border-none"><Lock className="w-3 h-3 mr-1"/> BÖRTÖNBEN</Badge>;
    case 'deceased': return <Badge variant="secondary" className="bg-slate-800 text-slate-400 border-none"><Skull className="w-3 h-3 mr-1"/> ELHUNYT</Badge>;
    case 'free': return <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10">SZABADLÁBON</Badge>;
    default: return <Badge variant="outline"><HelpCircle className="w-3 h-3 mr-1"/> ISMERETLEN</Badge>;
  }
}

// --- FŐ OLDAL ---
export function SuspectsPage() {
  const { supabase } = useAuth();
  const [suspects, setSuspects] = React.useState<Suspect[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [selectedSuspect, setSelectedSuspect] = React.useState<Suspect | null>(null);

  const fetchSuspects = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('suspects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      toast.error("Nem sikerült betölteni a listát.");
    } else {
      setSuspects(data || []);
    }
    setLoading(false);
  };

  React.useEffect(() => {
    fetchSuspects();
  }, []);

  const filtered = suspects.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (s.alias && s.alias.toLowerCase().includes(search.toLowerCase())) ||
    (s.gang_affiliation && s.gang_affiliation.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">

      <SuspectDetailDialog
        open={!!selectedSuspect}
        onOpenChange={(o) => !o && setSelectedSuspect(null)}
        suspect={selectedSuspect}
        onUpdate={fetchSuspects}
      />

      <NewSuspectDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} onSuccess={fetchSuspects} />

      {/* FEJLÉC */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <UserX className="w-8 h-8 text-red-500" /> Gyanúsítottak
          </h1>
          <p className="text-slate-400 mt-1">Bűnügyi nyilvántartás és körözési lista kezelése.</p>
        </div>
        <Button className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20" onClick={() => setIsDialogOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" /> Új Személy Rögzítése
        </Button>
      </div>

      {/* KERESŐ SÁV */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
        <Input
          placeholder="Keresés név, alias vagy banda alapján..."
          className="pl-12 h-12 bg-slate-900 border-slate-800 text-lg focus-visible:ring-red-500/50 rounded-xl"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* LISTA */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Adatok betöltése...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-slate-900/30 rounded-xl border border-slate-800 border-dashed flex flex-col items-center">
          <Users className="w-12 h-12 mb-3 opacity-20" />
          <p className="font-medium">Nincs találat a nyilvántartásban.</p>
          <p className="text-xs mt-1">Próbálj más kifejezést, vagy rögzíts új személyt.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(suspect => (
            <Card key={suspect.id} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-all group overflow-hidden shadow-lg">
              {/* Felső színes csík státusz alapján */}
              <div className={`h-2 w-full transition-colors ${
                suspect.status === 'wanted' ? 'bg-red-600' :
                  suspect.status === 'jailed' ? 'bg-orange-600' :
                    'bg-slate-800'
              }`} />

              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12 border-2 border-slate-700">
                      <AvatarImage src={suspect.mugshot_url || undefined} />
                      <AvatarFallback className="bg-slate-800 text-slate-400 font-bold text-lg">
                        {suspect.full_name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-bold text-white leading-tight">{suspect.full_name}</h3>
                      {suspect.alias && <p className="text-xs text-slate-400 italic">"{suspect.alias}"</p>}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-center">
                    {getStatusBadge(suspect.status)}
                    {suspect.gender && <span className="text-xs text-slate-500 uppercase font-bold">{suspect.gender === 'male' ? 'Férfi' : 'Nő'}</span>}
                  </div>
                  {suspect.gang_affiliation && (
                    <div className="text-xs bg-slate-950 px-2 py-1 rounded border border-slate-800 text-slate-300 truncate flex items-center gap-2">
                      <span className="text-slate-500">Szervezet:</span>
                      <span className="font-medium text-white truncate">{suspect.gang_affiliation}</span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-500 line-clamp-2 min-h-[2.5em] italic bg-slate-950/50 p-2 rounded border border-slate-800/50">
                  {suspect.description || "Nincs leírás megadva."}
                </p>

                {/* Később ide jöhet a "Részletek" vagy "Szerkesztés" gomb */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
                  <span className="text-[10px] text-slate-600 font-mono">Rögzítve: {new Date(suspect.created_at).toLocaleDateString()}</span>
                </div>
                <Button
                  variant="outline"
                  className="w-full mt-4 border-slate-700 hover:bg-slate-800 text-xs h-8"
                  onClick={() => setSelectedSuspect(suspect)} // <--- BEKÖTVE
                >
                  Adatlap Megnyitása
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}