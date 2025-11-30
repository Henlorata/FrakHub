import * as React from "react";
import {useParams, useNavigate} from "react-router-dom";
import {useAuth} from "@/context/AuthContext";
import {Button} from "@/components/ui/button";
import {Loader2, ArrowLeft, Lock, Unlock, Archive, ShieldAlert, Laptop2, Terminal} from "lucide-react";
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

  // DIALOGS
  const [isSuspectDialogOpen, setIsSuspectDialogOpen] = React.useState(false);
  const [isAddSuspectOpen, setIsAddSuspectOpen] = React.useState(false);
  const [viewSuspect, setViewSuspect] = React.useState<any>(null);
  const [isUploadOpen, setIsUploadOpen] = React.useState(false);
  const [isAddCollabOpen, setIsAddCollabOpen] = React.useState(false);
  const [viewEvidence, setViewEvidence] = React.useState<any>(null);

  // AUTH CHECK
  React.useEffect(() => {
    if (!loading && profile && caseData) {
      if (!canViewCaseDetails(profile, caseData)) setError("Nincs jogosultságod megtekinteni az akta részleteit.");
    }
  }, [loading, profile, caseData]);

  const canEdit = React.useMemo(() => {
    const isCollabEditor = collaborators.some(c => c.user_id === profile?.id && c.role === 'editor');
    return canEditCase(profile, caseData, isCollabEditor);
  }, [profile, caseData, collaborators]);

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

  // HANDLERS
  const handleDeleteSuspect = async (id: string) => {
    if (!confirm("Biztosan eltávolítod?")) return;
    await supabase.from('case_suspects').delete().eq('id', id);
    fetchData();
  };
  const handleDeleteCollaborator = async (id: string) => {
    if (!confirm("Biztosan eltávolítod?")) return;
    await supabase.from('case_collaborators').delete().eq('id', id);
    fetchData();
  };
  const handleDeleteEvidence = async (id: string) => {
    if (!confirm("Törlöd a bizonyítékot?")) return;
    await supabase.from('case_evidence').delete().eq('id', id);
    fetchData();
  };
  const openEvidenceViewer = async (file: any) => {
    if (file.file_type === 'image') {
      const {data} = await supabase.storage.from('case_evidence').createSignedUrl(file.file_path, 3600);
      if (data) setViewEvidence({...file, url: data.signedUrl});
    } else toast.info("Ez a fájltípus nem támogatott.");
  };
  const handleStatusChange = async (newStatus: 'open' | 'closed' | 'archived') => {
    if (!confirm(`Biztosan módosítod a státuszt?`)) return;
    const {error} = await supabase.from('cases').update({status: newStatus}).eq('id', caseId!);
    if (!error) {
      toast.success("Státusz frissítve!");
      setCaseData(prev => prev ? ({...prev, status: newStatus}) : null);
    }
  };

  if (loading) return <div className="flex h-[80vh] items-center justify-center"><Loader2
    className="w-12 h-12 animate-spin text-sky-500 opacity-50"/></div>;
  if (error || !caseData) return <div className="flex flex-col items-center justify-center h-[80vh] text-slate-400">
    <ShieldAlert className="w-20 h-20 mb-6 text-red-500/50"/><h2 className="text-2xl font-bold text-white mb-2">ACCESS
    DENIED</h2><p className="mb-6">{error}</p><Button variant="outline" onClick={() => navigate('/mcb')}>Vissza</Button>
  </div>;

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] overflow-hidden space-y-4">

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

      {/* --- HEADER BAR (Terminal Style) --- */}
      <div
        className="shrink-0 bg-slate-950/80 border-y border-sky-900/30 backdrop-blur-md px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/mcb')}
                  className="text-sky-500 hover:text-white hover:bg-sky-500/10"><ArrowLeft
            className="w-5 h-5"/></Button>
          <div>
            <div className="flex items-center gap-3">
              <Terminal className="w-5 h-5 text-sky-500"/>
              <h1 className="text-xl font-bold text-white tracking-tight uppercase font-mono">{caseData.title}</h1>
              <Badge className="font-mono bg-sky-900/50 text-sky-400 border-sky-500/30">CASE
                #{caseData.case_number}</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
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
        </div>
      </div>

      {/* --- WORKSPACE GRID --- */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-6 px-6 pb-6">

        {/* LEFT COLUMN (Details) */}
        <div className="lg:col-span-3 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2">
          <CaseInfoCard caseData={caseData}/>
          <SuspectsCard suspects={caseSuspects} onAdd={canEdit ? () => setIsAddSuspectOpen(true) : undefined}
                        onView={(s) => setViewSuspect(s)} onDelete={canEdit ? handleDeleteSuspect : undefined}/>
          <CollaboratorsCard collaborators={collaborators} onAdd={canEdit ? () => setIsAddCollabOpen(true) : undefined}
                             onDelete={canEdit ? handleDeleteCollaborator : undefined}/>
        </div>

        {/* CENTER COLUMN (Editor) */}
        <div
          className="lg:col-span-6 flex flex-col bg-slate-950/50 border border-slate-800 rounded-lg overflow-hidden relative shadow-2xl">
          {/* Editor Top Bar */}
          <div className="h-8 bg-slate-900 border-b border-slate-800 flex items-center px-3 justify-between">
            <span className="text-[10px] font-mono text-slate-500 uppercase flex items-center gap-2"><Laptop2
              className="w-3 h-3"/> Investigation Log</span>
            <div className="flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500/20"></div>
              <div className="w-2 h-2 rounded-full bg-yellow-500/20"></div>
              <div className="w-2 h-2 rounded-full bg-green-500/20"></div>
            </div>
          </div>
          <div className="flex-1 overflow-hidden relative">
            <CaseEditor caseId={caseId!} initialContent={caseData.body} readOnly={!canEdit} evidenceList={evidence}/>
          </div>
        </div>

        {/* RIGHT COLUMN (Evidence & Comms) */}
        <div className="lg:col-span-3 flex flex-col gap-4 overflow-y-auto custom-scrollbar pl-2">
          <div className="flex-1 min-h-[250px] max-h-[400px]">
            <EvidenceCard evidence={evidence} onUpload={canEdit ? () => setIsUploadOpen(true) : undefined}
                          onView={openEvidenceViewer} onDelete={canEdit ? handleDeleteEvidence : undefined}/>
          </div>
          <CaseWarrants caseId={caseId!} suspects={caseSuspects}/>
          <div className="flex-1 min-h-[300px] flex flex-col">
            <CaseChat caseId={caseId!}/>
          </div>
        </div>
      </div>
    </div>
  );
}