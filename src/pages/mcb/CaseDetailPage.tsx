import * as React from "react";
import {useParams, useNavigate} from "react-router-dom";
import {useAuth} from "@/context/AuthContext";
import {Button} from "@/components/ui/button";
import {Loader2, ArrowLeft, Lock, Unlock, Archive, ShieldAlert} from "lucide-react";
import {toast} from "sonner";
import {CaseEditor} from "./components/CaseEditor";
import {AddSuspectDialog} from "./components/AddSuspectDialog";
import {CaseInfoCard, CollaboratorsCard, EvidenceCard, SuspectsCard} from "./components/CaseSidebar";
import {UploadEvidenceDialog} from "./components/UploadEvidenceDialog";
import {CaseChat} from "./components/CaseChat";
import {CaseWarrants} from "./components/CaseWarrants";
import {Badge} from "@/components/ui/badge";
import {AddCollaboratorDialog} from "./components/AddCollaboratorDialog";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {canViewCaseDetails, canEditCase, isHighCommand} from "@/lib/utils";
import type {Case, CaseCollaborator, CaseEvidence} from "@/types/supabase";
import {SuspectDetailDialog} from "@/pages/mcb/components/SuspectDetailDialog.tsx";
import {ImageViewerDialog} from "@/pages/mcb/components/ImageViewerDialog.tsx";

export function CaseDetailPage() {
  const {caseId} = useParams<{ caseId: string }>();
  const {supabase, profile} = useAuth();
  const navigate = useNavigate();

  const [caseData, setCaseData] = React.useState<Case | null>(null);
  const [collaborators, setCollaborators] = React.useState<CaseCollaborator[]>([]);
  const [evidence, setEvidence] = React.useState<CaseEvidence[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [caseSuspects, setCaseSuspects] = React.useState<any[]>([]);
  const [isSuspectDialogOpen, setIsSuspectDialogOpen] = React.useState(false);
  const [isAddSuspectOpen, setIsAddSuspectOpen] = React.useState(false);
  const [viewSuspect, setViewSuspect] = React.useState<any>(null);
  const [isUploadOpen, setIsUploadOpen] = React.useState(false);
  const [isAddCollabOpen, setIsAddCollabOpen] = React.useState(false);
  const [viewEvidence, setViewEvidence] = React.useState<any>(null);

  // Jogosultság ellenőrzés (Betöltés előtt/közben nem tudjuk a caseData-t, de ha betöltött, ellenőrzünk)
  React.useEffect(() => {
    if (!loading && profile && caseData) {
      if (!canViewCaseDetails(profile, caseData)) {
        setError("Nincs jogosultságod megtekinteni az akta részleteit. (Supervisory Staff csak a listát láthatja)");
      }
    }
  }, [loading, profile, caseData]);

  // Szerkesztési jog (Memoizálva a segédfüggvénnyel)
  const canEdit = React.useMemo(() => {
    const isCollabEditor = collaborators.some(c => c.user_id === profile?.id && c.role === 'editor');
    return canEditCase(profile, caseData, isCollabEditor);
  }, [profile, caseData, collaborators]);

  // Adatok betöltése
  const fetchData = React.useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      // 1. Akta
      const {
        data: cData,
        error: cError
      } = await supabase.from('cases').select('*, owner:owner_id(full_name, badge_number)').eq('id', caseId).single();
      if (cError) throw cError;
      setCaseData(cData as unknown as Case);

      // 2. Közreműködők
      const {data: colData} = await supabase.from('case_collaborators').select('*, profile:user_id(full_name, badge_number, faction_rank)').eq('case_id', caseId);
      setCollaborators(colData as unknown as CaseCollaborator[] || []);

      // 3. Bizonyítékok
      const {data: evData} = await supabase.from('case_evidence').select('*').eq('case_id', caseId);
      setEvidence(evData as CaseEvidence[] || []);

      // 4. Gyanúsítottak (ÚJ)
      const {data: susData} = await supabase.from('case_suspects').select('*, suspect:suspect_id(*)').eq('case_id', caseId);
      setCaseSuspects(susData || []);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [caseId, supabase]);

  // TÖRLÉS KEZELŐK
  const handleDeleteSuspect = async (id: string) => {
    if (!confirm("Biztosan eltávolítod ezt a személyt az aktából?")) return;
    await supabase.from('case_suspects').delete().eq('id', id);
    fetchData();
  };

  const handleDeleteCollaborator = async (id: string) => {
    if (!confirm("Biztosan eltávolítod ezt a közreműködőt?")) return;
    await supabase.from('case_collaborators').delete().eq('id', id);
    fetchData();
  };

  const handleDeleteEvidence = async (id: string) => {
    if (!confirm("Biztosan törlöd ezt a bizonyítékot?")) return;
    await supabase.from('case_evidence').delete().eq('id', id);
    // A fájlt is törölni kéne a storage-ból, de azt majd a napi cleanup intézi, vagy itt is lehetne.
    fetchData();
  };

  // Képnézegető helper
  const openEvidenceViewer = async (file: any) => {
    if (file.file_type === 'image') {
      const {data} = await supabase.storage.from('case_evidence').createSignedUrl(file.file_path, 3600);
      if (data) setViewEvidence({...file, url: data.signedUrl});
    } else {
      toast.info("Ez a fájltípus nem támogatott a gyorsnézetben.");
    }
  };

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusChange = async (newStatus: 'open' | 'closed' | 'archived') => {
    if (!confirm(`Biztosan módosítod az akta státuszát?`)) return;
    const {error} = await supabase.from('cases').update({status: newStatus}).eq('id', caseId!);
    if (error) toast.error("Hiba történt.");
    else {
      toast.success("Státusz frissítve!");
      setCaseData(prev => prev ? ({...prev, status: newStatus}) : null);
    }
  };

  if (loading) return <div className="flex h-[80vh] items-center justify-center"><Loader2
    className="w-12 h-12 animate-spin text-yellow-500 opacity-50"/></div>;

  if (error || !caseData) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-slate-400">
        <ShieldAlert className="w-20 h-20 mb-6 text-red-500/50"/>
        <h2 className="text-2xl font-bold text-white mb-2">Hozzáférés Megtagadva</h2>
        <p className="mb-6 max-w-md text-center">{error || "Az akta nem található, vagy nincs jogosultságod."}</p>
        <Button variant="outline" onClick={() => navigate('/mcb')} className="border-slate-700 hover:bg-slate-800">Vissza
          az irányítópultra</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8 h-[calc(100vh-100px)] flex flex-col">

      {/* DIALÓGUSOK */}
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

      {/* KÉPNÉZEGETŐ MODAL */}
      <ImageViewerDialog
        open={!!viewEvidence}
        onOpenChange={(o) => !o && setViewEvidence(null)}
        imageUrl={viewEvidence?.url}
        fileName={viewEvidence?.file_name || "Bizonyíték"}
      />

      <div
        className="flex justify-between items-start shrink-0 bg-slate-900/30 p-4 rounded-xl border border-slate-800/50">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/mcb')}
                  className="text-slate-400 hover:text-white hover:bg-slate-800">
            <ArrowLeft className="w-5 h-5"/>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">{caseData.title}</h1>
              <Badge variant="outline" className="font-mono text-yellow-500 border-yellow-500/30 bg-yellow-500/10">
                #{caseData.case_number.toString().padStart(4, '0')}
              </Badge>
            </div>
            <p
              className="text-slate-400 text-sm mt-0.5 max-w-2xl truncate">{caseData.description || "Nincs rövid leírás."}</p>
          </div>
        </div>

        <div className="flex gap-2 self-end md:self-auto">
          {canEdit ? (
            <>
              <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:bg-slate-800"
                      onClick={() => handleStatusChange('closed')}>
                <Lock className="w-4 h-4 mr-2"/> Lezárás
              </Button>
              <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-950/20"
                      onClick={() => handleStatusChange('archived')}>
                <Archive className="w-4 h-4 mr-2"/> Archiválás
              </Button>
            </>
          ) : (
            caseData.status !== 'open' && isHighCommand(profile) && (
              <Button variant="outline" size="sm"
                      className="border-yellow-700/50 text-yellow-500 hover:bg-yellow-900/20"
                      onClick={() => handleStatusChange('open')}>
                <Unlock className="w-4 h-4 mr-2"/> Újranyitás
              </Button>
            )
          )}
        </div>
      </div>

      {/* TARTALOM GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">

        {/* BAL OSZLOP */}
        <div className="lg:col-span-3 space-y-6 overflow-y-auto pr-1 custom-scrollbar h-full pb-10">
          <CaseInfoCard caseData={caseData}/>

          <SuspectsCard
            suspects={caseSuspects}
            onAdd={canEdit ? () => setIsAddSuspectOpen(true) : undefined}
            onView={(s) => setViewSuspect(s)}
            onDelete={canEdit ? handleDeleteSuspect : undefined} // <--- BEKÖTVE
          />

          <CollaboratorsCard
            collaborators={collaborators}
            onAdd={canEdit ? () => setIsAddCollabOpen(true) : undefined} // <--- BEKÖTVE
            onDelete={canEdit ? handleDeleteCollaborator : undefined} // <--- BEKÖTVE
          />
        </div>

        {/* KÖZÉPSŐ OSZLOP */}
        <div className="lg:col-span-6 h-full min-h-[500px] flex flex-col">
          <CaseEditor caseId={caseId!} initialContent={caseData.body} readOnly={!canEdit} evidenceList={evidence}/>
        </div>

        {/* JOBB OSZLOP */}
        <div className="lg:col-span-3 h-full flex flex-col space-y-4 overflow-y-auto custom-scrollbar pb-10 pr-2">
          <div className="min-h-[200px] max-h-[300px] flex flex-col shrink-0">
            <EvidenceCard
              evidence={evidence}
              onUpload={canEdit ? () => setIsUploadOpen(true) : undefined}
              onView={openEvidenceViewer} // <--- BEKÖTVE
              onDelete={canEdit ? handleDeleteEvidence : undefined} // <--- BEKÖTVE
            />
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