import * as React from "react";
import {useAuth} from "@/context/AuthContext";
import {Card, CardContent} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {Input} from "@/components/ui/input";
import {SuspectDetailDialog} from "./components/SuspectDetailDialog";
import {Search, UserPlus, AlertTriangle, Lock, Skull, HelpCircle, Eye, ShieldAlert} from "lucide-react";
import {toast} from "sonner";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import type {Suspect, SuspectStatus} from "@/types/supabase";
import {NewSuspectDialog} from "@/pages/mcb/components/NewSuspectDialog.tsx";

const getStatusConfig = (status: SuspectStatus) => {
  switch (status) {
    case 'wanted':
      return {
        label: 'KÖRÖZÖTT',
        color: 'text-red-500',
        bg: 'bg-red-500/10',
        border: 'border-red-500/40',
        icon: AlertTriangle
      };
    case 'jailed':
      return {
        label: 'BÖRTÖNBEN',
        color: 'text-orange-500',
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/40',
        icon: Lock
      };
    case 'deceased':
      return {label: 'ELHUNYT', color: 'text-slate-400', bg: 'bg-slate-800', border: 'border-slate-700', icon: Skull};
    case 'free':
      return {
        label: 'SZABADLÁBON',
        color: 'text-green-500',
        bg: 'bg-green-500/10',
        border: 'border-green-500/40',
        icon: Eye
      };
    default:
      return {
        label: 'ISMERETLEN',
        color: 'text-slate-500',
        bg: 'bg-slate-800',
        border: 'border-slate-700',
        icon: HelpCircle
      };
  }
}

export function SuspectsPage() {
  const {supabase} = useAuth();
  const [suspects, setSuspects] = React.useState<Suspect[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [selectedSuspect, setSelectedSuspect] = React.useState<Suspect | null>(null);

  const fetchSuspects = async () => {
    setLoading(true);
    const {data, error} = await supabase.from('suspects').select('*').order('created_at', {ascending: false});
    if (error) toast.error("Hiba az adatok betöltésekor.");
    else setSuspects(data || []);
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
      <SuspectDetailDialog open={!!selectedSuspect} onOpenChange={(o) => !o && setSelectedSuspect(null)}
                           suspect={selectedSuspect} onUpdate={fetchSuspects}/>
      <NewSuspectDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} onSuccess={fetchSuspects}/>

      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 pb-4 border-b border-white/5">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-red-500"/> CRIMINAL DATABASE
          </h1>
          <p className="text-slate-400 text-sm font-mono mt-1">Gyanúsítottak és körözött személyek nyilvántartása</p>
        </div>
        <Button className="bg-red-600 hover:bg-red-500 text-white font-bold" onClick={() => setIsDialogOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2"/> ÚJ SZEMÉLY RÖGZÍTÉSE
        </Button>
      </div>

      {/* SEARCH BAR */}
      <div className="relative max-w-lg">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>
        <Input
          placeholder="Név, Alias, Szervezet..."
          className="pl-10 bg-slate-900/50 border-slate-700 focus-visible:ring-red-500/50"
          value={search} onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* GRID VIEW */}
      {loading ? (
        <div className="text-center py-20 text-slate-500 font-mono animate-pulse">ADATBÁZIS LEKÉRDEZÉSE...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-600 border-2 border-dashed border-slate-800 rounded-xl">Nincs
          találat.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(suspect => {
            const status = getStatusConfig(suspect.status);
            return (
              <Card key={suspect.id}
                    className="bg-slate-900/60 border-slate-800 overflow-hidden group hover:border-slate-600 transition-all hover:shadow-[0_0_20px_rgba(0,0,0,0.5)] cursor-pointer"
                    onClick={() => setSelectedSuspect(suspect)}>

                {/* Mugshot Area with Overlay */}
                <div
                  className="relative h-32 bg-black/40 border-b border-slate-800 flex items-center justify-center overflow-hidden">
                  <div
                    className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent z-10"></div>
                  <Avatar
                    className="w-20 h-20 border-2 border-slate-700 z-0 group-hover:scale-110 transition-transform duration-500">
                    <AvatarImage src={suspect.mugshot_url || undefined} className="object-cover"/>
                    <AvatarFallback
                      className="bg-slate-800 text-slate-500 font-bold text-2xl">{suspect.full_name.charAt(0)}</AvatarFallback>
                  </Avatar>

                  {/* Status Stamp Overlay */}
                  {suspect.status === 'wanted' && (
                    <div
                      className="absolute top-2 right-2 z-20 rotate-12 border-2 border-red-500/50 text-red-500 text-[10px] font-black px-2 py-0.5 rounded opacity-70">WANTED</div>
                  )}
                </div>

                <CardContent className="p-4 relative z-20">
                  {/* Identity */}
                  <div className="text-center -mt-10 mb-3">
                    <h3
                      className="font-black text-white text-lg leading-none mb-1 shadow-black drop-shadow-md">{suspect.full_name}</h3>
                    {suspect.alias && <p className="text-xs text-slate-400 font-mono italic">"{suspect.alias}"</p>}
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div
                      className={`col-span-2 flex items-center justify-center gap-2 py-1.5 rounded border ${status.bg} ${status.border} ${status.color}`}>
                      <status.icon className="w-3.5 h-3.5"/>
                      <span className="text-[10px] font-black uppercase tracking-widest">{status.label}</span>
                    </div>

                    {suspect.gang_affiliation && (
                      <div className="col-span-2 text-center py-1 bg-slate-950 rounded border border-slate-800">
                        <span className="text-[9px] text-slate-500 uppercase block">SZERVEZET</span>
                        <span className="text-xs font-bold text-slate-300">{suspect.gang_affiliation}</span>
                      </div>
                    )}
                  </div>

                  <Button
                    className="w-full h-8 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300">
                    ADATLAP MEGTEKINTÉSE
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}