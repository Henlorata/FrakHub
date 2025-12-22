import * as React from "react";
import {useParams, useNavigate} from "react-router-dom";
import {useAuth} from "@/context/AuthContext";
import {Button} from "@/components/ui/button";
import {
  Loader2,
  ArrowLeft,
  Lock,
  Unlock,
  Archive,
  ShieldAlert,
  Laptop2,
  Terminal,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Palette, Trash2, AlertTriangle
} from "lucide-react";
import {toast} from "sonner";
import {CaseEditor} from "./components/CaseEditor";
import {AddSuspectDialog} from "./components/AddSuspectDialog";
import {CaseInfoCard, CollaboratorsCard, EvidenceCard, SuspectsCard} from "./components/CaseSidebar";
import {UploadEvidenceDialog} from "./components/UploadEvidenceDialog";
import {CaseChat} from "./components/CaseChat";
import {CaseWarrants} from "./components/CaseWarrants";
import {Badge} from "@/components/ui/badge";
import {AddCollaboratorDialog} from "./components/AddCollaboratorDialog";
import {canViewCaseDetails, canEditCase, isHighCommand, cn} from "@/lib/utils";
import type {Case, CaseCollaborator, CaseEvidence} from "@/types/supabase";
import {SuspectDetailDialog} from "@/pages/mcb/components/SuspectDetailDialog";
import {ImageViewerDialog} from "@/pages/mcb/components/ImageViewerDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function CaseDetailPage() {
  const {caseId} = useParams<{ caseId: string }>();
  const {supabase, profile} = useAuth();
  const navigate = useNavigate();

  // STATE
  const [caseData, setCaseData] = React.useState<Case | null>(null);
  const [collaborators, setCollaborators] = React.useState<CaseCollaborator[]>([]);
  const [evidence, setEvidence] = React.useState<CaseEvidence[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [caseSuspects, setCaseSuspects] = React.useState<any[]>([]);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // UI STATE
  const [showLeftSidebar, setShowLeftSidebar] = React.useState(true);
  const [showRightSidebar, setShowRightSidebar] = React.useState(true);

  // ALERT STATE
  const [alertConfig, setAlertConfig] = React.useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => Promise<void> | void;
    actionLabel: string;
    variant?: "default" | "destructive";
  }>({
    open: false, title: "", description: "", action: () => {
    }, actionLabel: "Végrehajtás", variant: "default"
  });

  // DIALOGS
  const [isAddSuspectOpen, setIsAddSuspectOpen] = React.useState(false);
  const [viewSuspect, setViewSuspect] = React.useState<any>(null);
  const [isUploadOpen, setIsUploadOpen] = React.useState(false);
  const [isAddCollabOpen, setIsAddCollabOpen] = React.useState(false);
  const [viewEvidence, setViewEvidence] = React.useState<any>(null);

  const canEdit = React.useMemo(() => {
    const isCollabEditor = collaborators.some(c => c.user_id === profile?.id && c.role === 'editor');
    return canEditCase(profile, caseData, isCollabEditor);
  }, [profile, caseData, collaborators]);

  const handleDeleteCase = async () => {
    if (!caseId) return;
    setIsDeleting(true);
    const toastId = toast.loading("Akta és csatolt fájlok törlése...");

    try {
      // API hívás a szerver felé (ami törli a képeket és az adatbázist is)
      const response = await fetch('/api/case/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` // Auth token küldése
        },
        body: JSON.stringify({caseId})
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Hiba történt a törlés során.");
      }

      toast.success("Akta és minden adat véglegesen törölve.", {id: toastId});
      navigate('/mcb/dashboard'); // Visszairányítás
    } catch (e: any) {
      console.error(e);
      toast.error("Törlés sikertelen: " + e.message, {id: toastId});
    } finally {
      setIsDeleting(false);
    }
  };

  const getHeaderStyles = (theme?: string) => {
    switch (theme) {
      case 'paper':
        return 'bg-[#e6dac3] border-[#d4c5a8] text-[#5c4d3c]';
      case 'terminal':
        return 'bg-slate-900 border-slate-800 text-green-500';
      case 'amber':
        return 'bg-[#2e2000] border-[#4d3600] text-[#ffb000]';
      case 'blue':
        return 'bg-[#1e293b] border-[#334155] text-blue-300';
      case 'classic':
        return 'bg-slate-100 border-slate-200 text-slate-700';
      default:
        return 'bg-slate-900 border-slate-800 text-slate-500';
    }
  };

  const getBackgroundStyle = (theme?: string) => {
    switch (theme) {
      case 'paper':
        return '#f5f0e6';
      case 'terminal':
        return '#0c0c0c';
      case 'amber':
        return '#1a1200';
      case 'blue':
        return '#0f172a';
      case 'classic':
        return '#f1f5f9'; // Szürke háttér a fehér lap mögött
      default:
        return undefined;
    }
  };

  // DATA FETCH
  const fetchData = React.useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      const {
        data: cData,
        error: cError
      } = await supabase.from('cases').select('*, owner:owner_id(full_name, badge_number)').eq('id', caseId).single();
      if (cError) throw cError;
      setCaseData(cData as unknown as Case);

      const {data: colData} = await supabase.from('case_collaborators').select('*, profile:user_id(full_name, badge_number, faction_rank)').eq('case_id', caseId);
      setCollaborators(colData as unknown as CaseCollaborator[] || []);

      const {data: evData} = await supabase.from('case_evidence').select('*').eq('case_id', caseId);
      setEvidence(evData as CaseEvidence[] || []);

      const {data: susData} = await supabase.from('case_suspects').select('*, suspect:suspect_id(*)').eq('case_id', caseId);
      setCaseSuspects(susData || []);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [caseId, supabase]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // AUTH CHECK (After fetch)
  React.useEffect(() => {
    if (!loading && profile && caseData) {
      if (!canViewCaseDetails(profile, caseData, collaborators.some(c => c.user_id === profile.id))) {
        setError("Nincs jogosultságod megtekinteni az akta részleteit.");
      }
    }
  }, [loading, profile, caseData, collaborators]);

  // HELPER: Alert Trigger
  const showAlert = (title: string, description: string, action: () => Promise<void> | void, actionLabel = "Igen", variant: "default" | "destructive" = "default") => {
    setAlertConfig({open: true, title, description, action, actionLabel, variant});
  };

  const handleAlertConfirm = async () => {
    await alertConfig.action();
    setAlertConfig(prev => ({...prev, open: false}));
  };

  // HANDLERS
  const handleDeleteSuspect = (id: string) => {
    showAlert("Gyanúsított eltávolítása", "Biztosan eltávolítod ezt a személyt az aktából? Az adatbázisból nem törlődik végleg, csak innen.", async () => {
      await supabase.from('case_suspects').delete().eq('id', id);
      fetchData();
      toast.success("Eltávolítva.");
    }, "Eltávolítás", "destructive");
  };

  const handleDeleteCollaborator = (id: string) => {
    showAlert("Közreműködő eltávolítása", "Biztosan visszavonod a hozzáférést ettől a személytől?", async () => {
      await supabase.from('case_collaborators').delete().eq('id', id);
      fetchData();
      toast.success("Hozzáférés visszavonva.");
    }, "Visszavonás", "destructive");
  };

  const handleDeleteEvidence = (id: string) => {
    showAlert("Bizonyíték törlése", "Ez a művelet nem vonható vissza. Biztosan törlöd a fájlt?", async () => {
      await supabase.from('case_evidence').delete().eq('id', id);
      fetchData();
      toast.success("Bizonyíték törölve.");
    }, "Törlés", "destructive");
  };

  const handleStatusChange = (newStatus: 'open' | 'closed' | 'archived') => {
    const labels = {open: "Újranyitás", closed: "Lezárás", archived: "Archiválás"};
    showAlert(
      `${labels[newStatus]} megerősítése`,
      `Biztosan módosítani szeretnéd az akta státuszát erre: ${labels[newStatus]}?`,
      async () => {
        const {error} = await supabase.from('cases').update({status: newStatus}).eq('id', caseId!);
        if (!error) {
          toast.success("Státusz frissítve!");
          setCaseData(prev => prev ? ({...prev, status: newStatus}) : null);
        }
      },
      "Módosítás"
    );
  };

  const handleThemeChange = async (newTheme: string) => {
    if (!caseData) return;
    setCaseData({...caseData, theme: newTheme}); // Optimistic update
    const {error} = await supabase.from('cases').update({theme: newTheme} as any).eq('id', caseId!);
    if (error) {
      toast.error("Nem sikerült menteni a témát");
      fetchData(); // Revert on error
    } else {
      toast.success("Téma módosítva");
    }
  };

  const openEvidenceViewer = async (file: any) => {
    if (file.file_type === 'image') {
      const {data} = await supabase.storage.from('case_evidence').createSignedUrl(file.file_path, 3600);
      if (data) setViewEvidence({...file, url: data.signedUrl});
    } else toast.info("Ez a fájltípus nem támogatott.");
  };

  if (loading) return <div className="flex h-[80vh] items-center justify-center"><Loader2
    className="w-12 h-12 animate-spin text-sky-500 opacity-50"/></div>;
  if (error || !caseData) return <div className="flex flex-col items-center justify-center h-[80vh] text-slate-400">
    <ShieldAlert className="w-20 h-20 mb-6 text-red-500/50"/><h2 className="text-2xl font-bold text-white mb-2">ACCESS
    DENIED</h2><p className="mb-6">{error}</p><Button variant="outline" onClick={() => navigate('/mcb')}>Vissza</Button>
  </div>;

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] overflow-hidden space-y-4">

      {/* GLOBAL ALERT DIALOG */}
      <AlertDialog open={alertConfig.open} onOpenChange={(open) => setAlertConfig(prev => ({...prev, open}))}>
        <AlertDialogContent className="bg-slate-950 border-slate-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">{alertConfig.title}</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {alertConfig.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="bg-transparent border-slate-700 hover:bg-slate-800 text-slate-300">Mégse</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAlertConfirm}
              className={cn(alertConfig.variant === 'destructive' ? "bg-red-600 hover:bg-red-700 text-white" : "bg-sky-600 hover:bg-sky-500 text-white")}
            >
              {alertConfig.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DIALOGS */}
      <AddSuspectDialog open={isAddSuspectOpen} onOpenChange={setIsAddSuspectOpen} caseId={caseId!}
                        onSuspectAdded={fetchData} existingSuspectIds={caseSuspects.map(s => s.suspect_id)}/>
      <SuspectDetailDialog open={!!viewSuspect} onOpenChange={(o) => !o && setViewSuspect(null)} suspect={viewSuspect}
                           onUpdate={() => {
                             fetchData();
                             setViewSuspect(null);
                           }}/>
      <UploadEvidenceDialog open={isUploadOpen} onOpenChange={setIsUploadOpen} caseId={caseId!}
                            onUploadComplete={fetchData}/>
      <AddCollaboratorDialog open={isAddCollabOpen} onOpenChange={setIsAddCollabOpen} caseId={caseId!}
                             onCollaboratorAdded={fetchData} existingUserIds={collaborators.map(c => c.user_id)}/>
      <ImageViewerDialog open={!!viewEvidence} onOpenChange={(o) => !o && setViewEvidence(null)}
                         imageUrl={viewEvidence?.url} fileName={viewEvidence?.file_name}/>

      {/* --- HEADER BAR --- */}
      <div
        className="shrink-0 bg-slate-950/80 border-y border-sky-900/30 backdrop-blur-md px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/mcb')}
                  className="text-sky-500 hover:text-white hover:bg-sky-500/10">
            <ArrowLeft className="w-5 h-5"/>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <Terminal className="w-5 h-5 text-sky-500"/>
              <h1 className="text-xl font-bold text-white tracking-tight uppercase font-mono">{caseData.title}</h1>
              <Badge className="font-mono bg-sky-900/50 text-sky-400 border-sky-500/30">
                {caseData.case_number}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* LAYOUT TOGGLES */}
          <div className="flex bg-slate-900/50 rounded-md border border-slate-800 mr-2">
            <Button variant="ghost" size="icon" onClick={() => setShowLeftSidebar(!showLeftSidebar)}
                    className={cn("h-8 w-8", !showLeftSidebar && "text-slate-600")}>
              {showLeftSidebar ? <PanelLeftClose className="w-4 h-4"/> : <PanelLeftOpen className="w-4 h-4"/>}
            </Button>
            <div className="w-px bg-slate-800 my-1"></div>
            <Button variant="ghost" size="icon" onClick={() => setShowRightSidebar(!showRightSidebar)}
                    className={cn("h-8 w-8", !showRightSidebar && "text-slate-600")}>
              {showRightSidebar ? <PanelRightClose className="w-4 h-4"/> : <PanelRightOpen className="w-4 h-4"/>}
            </Button>
          </div>

          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="border-slate-800 h-8 gap-2 bg-slate-900/50">
                  <Palette className="w-3.5 h-3.5"/>
                  <span className="hidden sm:inline">Kinézet</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-slate-900 border-slate-800 text-white w-56">
                <DropdownMenuItem onClick={() => handleThemeChange('default')}>
                  <div className="w-3 h-3 rounded-full bg-slate-800 border border-slate-600 mr-2"></div>
                  Alapértelmezett (Modern)
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-800"/>
                <DropdownMenuItem onClick={() => handleThemeChange('paper')}>
                  <div className="w-3 h-3 rounded-full bg-[#f5f0e6] border border-[#d4c5a8] mr-2"></div>
                  Papír akta (Klasszikus)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleThemeChange('classic')}>
                  <div className="w-3 h-3 rounded-full bg-white border border-slate-300 mr-2"></div>
                  Hivatalos Dokumentum (Fehér)
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-800"/>
                <DropdownMenuItem onClick={() => handleThemeChange('terminal')}>
                  <div className="w-3 h-3 rounded-full bg-black border border-green-500 mr-2"></div>
                  Terminál (Zöld)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleThemeChange('amber')}>
                  <div className="w-3 h-3 rounded-full bg-[#1a1200] border border-amber-500 mr-2"></div>
                  Retro CRT (Borostyán)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleThemeChange('blue')}>
                  <div className="w-3 h-3 rounded-full bg-[#0f172a] border border-blue-500 mr-2"></div>
                  Rendőrségi (Kék)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {canEdit ? (
            <>
              <Button variant="outline" size="sm"
                      className="border-sky-800 text-sky-400 hover:bg-sky-900/50 h-8 text-xs font-mono uppercase"
                      onClick={() => handleStatusChange('closed')}><Lock className="w-3 h-3 mr-2"/> Lezárás</Button>
              <Button variant="ghost" size="sm"
                      className="text-red-400 hover:bg-red-950/20 h-8 text-xs font-mono uppercase"
                      onClick={() => handleStatusChange('archived')}><Archive
                className="w-3 h-3 mr-2"/> Archiválás</Button>
            </>
          ) : (
            caseData.status !== 'open' && isHighCommand(profile) && (
              <Button variant="outline" size="sm"
                      className="border-yellow-700/50 text-yellow-500 hover:bg-yellow-900/20 h-8 text-xs uppercase"
                      onClick={() => handleStatusChange('open')}><Unlock className="w-3 h-3 mr-2"/> Újranyitás</Button>
            )
          )}

          {(caseData?.owner_id === profile?.id || profile?.is_bureau_manager || (profile?.division === 'MCB' && profile?.is_bureau_commander)) && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm"
                        className="ml-2 bg-red-950/50 border border-red-900 hover:bg-red-900 text-red-500 hover:text-white transition-all">
                  <Trash2 className="w-4 h-4 mr-2"/> TÖRLÉS
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-red-950 border border-red-500 text-white">
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-2xl font-black uppercase">
                    <AlertTriangle className="w-8 h-8 text-white"/> Végleges Törlés
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-red-100/80 font-bold">
                    FIGYELEM! Ez a művelet visszavonhatatlan.
                    <br/><br/>
                    Törlődik az akta teljes tartalma:
                    <ul className="list-disc list-inside mt-2 text-sm opacity-80">
                      <li>Minden bizonyíték és kép</li>
                      <li>Minden gyanúsított kapcsolat</li>
                      <li>Az összes jegyzet és jelentés</li>
                      <li>Minden kiadott elfogatóparancs</li>
                    </ul>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel
                    className="bg-black/20 border-white/10 text-white hover:bg-black/40">Mégse</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteCase} disabled={isDeleting}
                                     className="bg-white text-red-900 font-black hover:bg-red-100">
                    {isDeleting ? "Törlés folyamatban..." : "IGEN, TÖRLÖM AZ AKTÁT"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* --- WORKSPACE GRID --- */}
      <div className="flex-1 min-h-0 flex gap-6 px-6 pb-6 relative">

        {/* LEFT COLUMN */}
        {showLeftSidebar && (
          <div
            className="w-80 flex flex-col gap-4 overflow-y-auto custom-scrollbar shrink-0 animate-in slide-in-from-left-4 duration-300">
            <CaseInfoCard caseData={caseData}/>
            <SuspectsCard suspects={caseSuspects} onAdd={canEdit ? () => setIsAddSuspectOpen(true) : undefined}
                          onView={(s) => setViewSuspect(s)} onDelete={canEdit ? handleDeleteSuspect : undefined}/>
            <CollaboratorsCard collaborators={collaborators}
                               onAdd={canEdit ? () => setIsAddCollabOpen(true) : undefined}
                               onDelete={canEdit ? handleDeleteCollaborator : undefined}/>
          </div>
        )}

        {/* CENTER COLUMN (Editor) */}
        <div
          className={cn("flex-1 flex flex-col border rounded-lg overflow-hidden relative shadow-2xl transition-all duration-300",
            caseData.theme === 'paper' ? 'border-[#d4c5a8]' :
              caseData.theme === 'classic' ? 'border-slate-200' :
                caseData.theme === 'amber' ? 'border-amber-900/30' :
                  'border-slate-800'
          )} style={{backgroundColor: getBackgroundStyle(caseData.theme)}}>

          {/* Editor Header styling matches theme */}
          <div className={cn("h-8 border-b flex items-center px-3 justify-between transition-colors",
            getHeaderStyles(caseData.theme)
          )}>
            <span className="text-[10px] font-mono uppercase flex items-center gap-2">
              <Laptop2 className="w-3 h-3"/> Investigation Log
            </span>
            <div className="flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500/20"></div>
              <div className="w-2 h-2 rounded-full bg-yellow-500/20"></div>
              <div className="w-2 h-2 rounded-full bg-green-500/20"></div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden relative">
            <CaseEditor
              caseId={caseId!}
              initialContent={caseData.body}
              readOnly={!canEdit}
              evidenceList={evidence}
              theme={caseData.theme}
            />
          </div>
        </div>

        {/* RIGHT COLUMN */}
        {showRightSidebar && (
          <div
            className="w-80 flex flex-col gap-4 overflow-y-auto custom-scrollbar shrink-0 animate-in slide-in-from-right-4 duration-300">
            <div className="flex-1 min-h-[250px] max-h-[400px]">
              <EvidenceCard evidence={evidence} onUpload={canEdit ? () => setIsUploadOpen(true) : undefined}
                            onView={openEvidenceViewer} onDelete={canEdit ? handleDeleteEvidence : undefined}/>
            </div>
            <CaseWarrants caseId={caseId!} suspects={caseSuspects}/>
            <div className="flex-1 min-h-[300px] flex flex-col">
              <CaseChat caseId={caseId!}/>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}