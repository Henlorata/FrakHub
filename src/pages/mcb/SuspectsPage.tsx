import * as React from "react";
import {useAuth} from "@/context/AuthContext";
import {useSuspects} from "@/context/SuspectCacheContext";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {
  Search, UserPlus, Lock, Skull, Eye,
  FolderOpen, ChevronRight, Home, Trash2, FileText, User,
  ArrowLeft, ShieldAlert, Fingerprint, Activity, Siren, Folder
} from "lucide-react";
import {toast} from "sonner";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import type {Suspect} from "@/types/supabase";
import {NewSuspectDialog} from "@/pages/mcb/components/NewSuspectDialog";
import {cn} from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Navigációs Típusok
type FolderType = 'root' | 'status' | 'case' | 'creator';

interface FolderView {
  type: FolderType;
  id?: string;
  label: string;
}

export function SuspectsPage() {
  const {supabase} = useAuth();
  const {
    suspects,
    caseMap,
    cases,
    creators,
    loading,
    refreshSuspects,
    deleteSuspectFromCache,
    openSuspectId
  } = useSuspects();

  const [search, setSearch] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  // Törlés state
  const [suspectToDelete, setSuspectToDelete] = React.useState<Suspect | null>(null);
  const [isDeleteLoading, setIsDeleteLoading] = React.useState(false);

  // Navigáció (Breadcrumbs)
  const [path, setPath] = React.useState<FolderView[]>([{type: 'root', label: 'Adatbázis'}]);
  const currentFolder = path[path.length - 1];

  // Navigációs függvények
  const handleNavigate = (folder: FolderView) => {
    setSearch("");
    setPath(prev => [...prev, folder]);
  };
  const handleNavigateUp = (index: number) => setPath(prev => prev.slice(0, index + 1));
  const goBack = () => {
    if (path.length > 1) setPath(prev => prev.slice(0, -1));
  };

  // Törlés logika
  const handleDelete = async () => {
    if (!suspectToDelete) return;
    setIsDeleteLoading(true);
    try {
      const {data, error} = await supabase.rpc('delete_suspect_safely', {_suspect_id: suspectToDelete.id});
      if (error) throw error;
      if (data.success) {
        toast.success(data.message);
        deleteSuspectFromCache(suspectToDelete.id);
        setSuspectToDelete(null);
      } else {
        toast.error(data.message);
      }
    } catch (e: any) {
      toast.error("Hiba: " + e.message);
    } finally {
      setIsDeleteLoading(false);
    }
  };

  // Tartalom szűrése
  const getFolderContent = () => {
    let items = suspects;
    if (search) return items.filter(s => s.full_name.toLowerCase().includes(search.toLowerCase()) || s.alias?.toLowerCase().includes(search.toLowerCase()));

    switch (currentFolder.type) {
      case 'root':
        return null;
      case 'status':
        if (currentFolder.id === 'wanted') return items.filter(s => s.status === 'wanted');
        if (currentFolder.id === 'jailed') return items.filter(s => s.status === 'jailed');
        if (currentFolder.id === 'deceased') return items.filter(s => s.status === 'deceased');
        if (currentFolder.id === 'free') return items.filter(s => s.status === 'free' || !s.status);
        return items;
      case 'case':
        return items.filter(s => caseMap[s.id]?.includes(currentFolder.id!));
      case 'creator':
        return items.filter(s => s.created_by === currentFolder.id);
      default:
        return items;
    }
  };
  const displayedSuspects = getFolderContent();

  // --- KOMPONENSEK ---

  // 1. Mappa Ikon
  const FolderItem = ({label, icon: Icon, count, onClick, color = "blue"}: any) => {
    const colors: any = {
      blue: "text-blue-500 border-blue-500/20 hover:border-blue-400 group-hover:text-blue-400 bg-blue-950/20",
      red: "text-red-500 border-red-500/20 hover:border-red-400 group-hover:text-red-400 bg-red-950/20",
      orange: "text-orange-500 border-orange-500/20 hover:border-orange-400 group-hover:text-orange-400 bg-orange-950/20",
      purple: "text-purple-500 border-purple-500/20 hover:border-purple-400 group-hover:text-purple-400 bg-purple-950/20",
      green: "text-green-500 border-green-500/20 hover:border-green-400 group-hover:text-green-400 bg-green-950/20",
      slate: "text-slate-400 border-slate-700 hover:border-slate-500 group-hover:text-slate-300 bg-slate-900/40",
    };

    return (
      <div onClick={onClick}
           className={cn("group flex flex-col p-4 rounded-xl border transition-all cursor-pointer hover:shadow-lg hover:scale-[1.02] relative overflow-hidden", colors[color])}>
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Icon
          className="w-16 h-16"/></div>
        <div className="flex items-center gap-3 mb-2 relative z-10">
          <div className={cn("p-2 rounded-lg bg-black/40 shadow-inner")}><Icon className="w-6 h-6"/></div>
          <div className="font-black uppercase text-sm tracking-widest text-slate-200">{label}</div>
        </div>
        <div className="mt-auto relative z-10">
          <div className="text-[10px] uppercase font-mono font-bold opacity-60 flex items-center gap-1">
            <FolderOpen className="w-3 h-3"/> {count ?? 0} ADATLAP
          </div>
        </div>
      </div>
    );
  };

  // 2. High-Tech Suspect Card (ÚJ DESIGN)
  const SuspectCard = ({suspect}: { suspect: Suspect }) => {
    const statusColors = {
      wanted: {
        border: 'border-red-500',
        text: 'text-red-500',
        bg: 'bg-red-950/30',
        shadow: 'shadow-red-900/20',
        label: 'KÖRÖZÖTT',
        icon: Siren
      },
      jailed: {
        border: 'border-orange-500',
        text: 'text-orange-500',
        bg: 'bg-orange-950/30',
        shadow: 'shadow-orange-900/20',
        label: 'BÖRTÖNBEN',
        icon: Lock
      },
      deceased: {
        border: 'border-slate-600',
        text: 'text-slate-400',
        bg: 'bg-slate-900/50',
        shadow: 'shadow-black/50',
        label: 'ELHUNYT',
        icon: Skull
      },
      free: {
        border: 'border-green-500',
        text: 'text-green-500',
        bg: 'bg-green-950/30',
        shadow: 'shadow-green-900/20',
        label: 'SZABAD',
        icon: Eye
      },
    };
    const style = statusColors[suspect.status as keyof typeof statusColors] || statusColors.free;
    const StatusIcon = style.icon;

    return (
      <div className="group relative h-full">
        {/* Kártya Keret */}
        <div
          onClick={() => openSuspectId(suspect.id)}
          className={cn(
            "relative h-full bg-[#080c14] border hover:border-opacity-100 border-opacity-40 rounded-xl overflow-hidden transition-all duration-300 cursor-pointer flex flex-col",
            style.border, style.shadow, "hover:shadow-2xl hover:-translate-y-1"
          )}
        >
          {/* Fejléc - Holografikus Csík */}
          <div className={cn("h-1 w-full relative overflow-hidden", style.bg)}>
            <div
              className={cn("absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite]")}></div>
          </div>

          {/* Tartalom */}
          <div className="p-4 flex gap-4 flex-1">
            {/* Mugshot + Status */}
            <div className="relative shrink-0">
              <Avatar className={cn("w-20 h-20 rounded-lg border-2", style.border)}>
                <AvatarImage src={suspect.mugshot_url || undefined} className="object-cover sepia-[.2]"/>
                <AvatarFallback
                  className="bg-slate-900 text-slate-600 font-bold text-2xl rounded-lg">{suspect.full_name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div
                className={cn("absolute -bottom-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border shadow-lg whitespace-nowrap flex items-center gap-1 z-10 bg-[#080c14]", style.text, style.border)}>
                <StatusIcon className="w-3 h-3"/> {style.label}
              </div>
            </div>

            {/* Adatok */}
            <div className="min-w-0 flex-1 flex flex-col">
              <h3
                className="font-black text-slate-100 text-base leading-tight truncate font-mono uppercase tracking-tight">{suspect.full_name}</h3>
              {suspect.alias && <p className="text-xs text-sky-500 font-bold italic truncate">"{suspect.alias}"</p>}

              <div className="mt-auto pt-4 space-y-1">
                <div className="flex justify-between text-[10px] font-mono border-b border-slate-800 pb-1">
                  <span className="text-slate-500">SZERVEZET</span>
                  <span className="text-slate-300 font-bold">{suspect.gang_affiliation || "-"}</span>
                </div>
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-slate-500">ID</span>
                  <span className="text-slate-600">#{suspect.id.slice(0, 4).toUpperCase()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Törlés Gomb (Rejtett, csak hoverre) */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
            <Button
              variant="ghost" size="icon"
              className="h-6 w-6 rounded-full bg-black/60 hover:bg-red-600 text-slate-400 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                setSuspectToDelete(suspect);
              }}
            >
              <Trash2 className="w-3.5 h-3.5"/>
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] animate-in fade-in duration-500">
      <NewSuspectDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} onSuccess={() => refreshSuspects(true)}/>

      {/* Delete Alert */}
      <AlertDialog open={!!suspectToDelete} onOpenChange={(o) => !o && setSuspectToDelete(null)}>
        <AlertDialogContent className="bg-slate-950 border-red-900/50 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-500">VÉGLEGES TÖRLÉS</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Biztosan törölni akarod <b>{suspectToDelete?.full_name}</b> személyt?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 hover:bg-slate-800 text-slate-300">Mégse</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleteLoading}
                               className="bg-red-600 hover:bg-red-700 font-bold">Törlés</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* HEADER */}
      <div
        className="flex items-center justify-between shrink-0 mb-6 bg-[#0a0f1c] p-4 rounded-xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-sky-500/10 rounded-lg border border-sky-500/20">
            <Fingerprint className="w-6 h-6 text-sky-500"/>
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight uppercase">Bűnügyi Nyilvántartás</h1>
            <p className="text-sky-500/60 text-[10px] font-mono font-bold tracking-[0.2em]">CRIMINAL INTELLIGENCE
              DATABASE</p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>
            <Input placeholder="KERESÉS..."
                   className="pl-9 bg-slate-900 border-slate-700 h-10 font-mono text-xs focus-visible:ring-sky-500"
                   value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
          <Button className="bg-sky-600 hover:bg-sky-500 text-white font-bold h-10"
                  onClick={() => setIsDialogOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2"/> ÚJ AKTA
          </Button>
        </div>
      </div>

      {/* BREADCRUMBS + BACK BUTTON */}
      <div className="flex items-center gap-2 mb-6 bg-slate-950/50 p-2 rounded-lg border border-slate-800/50">
        <Button variant="ghost" size="icon" onClick={goBack} disabled={path.length <= 1}
                className="h-8 w-8 text-slate-400 hover:text-white disabled:opacity-30">
          <ArrowLeft className="w-4 h-4"/>
        </Button>
        <div className="h-4 w-px bg-slate-800 mx-2"></div>
        <div className="flex items-center gap-2 text-xs font-mono overflow-x-auto">
          {path.map((folder, idx) => (
            <React.Fragment key={folder.label + idx}>
              <div
                onClick={() => handleNavigateUp(idx)}
                className={cn("flex items-center gap-2 cursor-pointer hover:text-white transition-colors uppercase font-bold select-none",
                  idx === path.length - 1 ? "text-sky-400 pointer-events-none" : "text-slate-500"
                )}>
                {idx === 0 && <Home className="w-3.5 h-3.5"/>}
                {folder.label}
              </div>
              {idx < path.length - 1 && <ChevronRight className="w-3 h-3 text-slate-700"/>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* --- TARTALOM --- */}
      <div
        className="flex-1 overflow-y-auto custom-scrollbar bg-[#050a14] rounded-xl border border-slate-800/50 p-6 relative min-h-[400px]">
        {loading && <div
          className="absolute inset-0 flex items-center justify-center bg-black/80 z-50 backdrop-blur-sm text-sky-500 font-bold font-mono">
          <Activity className="w-6 h-6 animate-spin mr-3"/> ADATBÁZIS SZINKRONIZÁLÁSA...</div>}

        {/* ROOT NÉZET: MAPPÁK */}
        {currentFolder.type === 'root' && !search && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            <section>
              <h3
                className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-slate-800 pb-2">
                <ShieldAlert className="w-4 h-4"/> Státusz Szerint</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <FolderItem label="Körözött Személyek" icon={Siren} color="red"
                            count={suspects.filter(s => s.status === 'wanted').length}
                            onClick={() => handleNavigate({type: 'status', id: 'wanted', label: 'Körözött'})}/>
                <FolderItem label="Börtönben" icon={Lock} color="orange"
                            count={suspects.filter(s => s.status === 'jailed').length}
                            onClick={() => handleNavigate({type: 'status', id: 'jailed', label: 'Börtönben'})}/>
                <FolderItem label="Elhunyt" icon={Skull} color="slate"
                            count={suspects.filter(s => s.status === 'deceased').length}
                            onClick={() => handleNavigate({type: 'status', id: 'deceased', label: 'Elhunyt'})}/>
                <FolderItem label="Szabadlábon" icon={Eye} color="green"
                            count={suspects.filter(s => s.status === 'free').length}
                            onClick={() => handleNavigate({type: 'status', id: 'free', label: 'Szabadlábon'})}/>
              </div>
            </section>
            <section>
              <h3
                className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-slate-800 pb-2">
                <FolderOpen className="w-4 h-4"/> Rendszerezés</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <FolderItem label="Akták Szerint" icon={FileText} color="blue"
                            onClick={() => handleNavigate({type: 'case', label: 'Akták'})}/>
                <FolderItem label="Létrehozó Szerint" icon={User} color="purple"
                            onClick={() => handleNavigate({type: 'creator', label: 'Létrehozók'})}/>
              </div>
            </section>
          </div>
        )}

        {/* AKTÁK LISTÁZÁSA (Ha az 'Akták' mappába léptünk) */}
        {currentFolder.type === 'case' && !currentFolder.id && !search && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-300">
            {Object.entries(cases).map(([id, title]) => (
              <div key={id} onClick={() => handleNavigate({type: 'case', id, label: title})}
                   className="flex items-center gap-3 p-4 bg-slate-900/40 border border-slate-800 rounded-lg cursor-pointer hover:border-blue-500/50 hover:bg-slate-800 transition-all group">
                <Folder className="w-8 h-8 text-blue-500 fill-blue-500/20 group-hover:scale-110 transition-transform"/>
                <div
                  className="font-mono text-sm font-bold text-slate-300 truncate group-hover:text-blue-400">{title}</div>
              </div>
            ))}
            {Object.keys(cases).length === 0 &&
              <div className="col-span-full text-center text-slate-500 opacity-50 font-mono">NINCSENEK ELÉRHETŐ
                AKTÁK</div>}
          </div>
        )}

        {/* LÉTREHOZÓK LISTÁZÁSA */}
        {currentFolder.type === 'creator' && !currentFolder.id && !search && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-300">
            {Object.entries(creators).map(([id, name]) => (
              <div key={id} onClick={() => handleNavigate({type: 'creator', id, label: name})}
                   className="flex items-center gap-3 p-4 bg-slate-900/40 border border-slate-800 rounded-lg cursor-pointer hover:border-purple-500/50 hover:bg-slate-800 transition-all group">
                <User
                  className="w-8 h-8 text-purple-500 bg-purple-500/10 p-1.5 rounded-full group-hover:scale-110 transition-transform"/>
                <div className="font-bold text-slate-300 group-hover:text-purple-400">{name}</div>
              </div>
            ))}
          </div>
        )}

        {/* GYANÚSÍTOTTAK MEGJELENÍTÉSE (Ha mappában vagyunk vagy keresünk) */}
        {(displayedSuspects && (currentFolder.id || search)) && (
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in zoom-in-95 duration-300">
            {displayedSuspects.map(suspect => <SuspectCard key={suspect.id} suspect={suspect}/>)}
            {displayedSuspects.length === 0 && (
              <div className="col-span-full text-center py-20 text-slate-600 font-mono flex flex-col items-center">
                <FolderOpen className="w-12 h-12 mb-4 opacity-50"/>
                EB A MAPPA ÜRES
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}