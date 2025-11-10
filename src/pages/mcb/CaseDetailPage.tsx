// FrakHub/src/pages/mcb/CaseDetailPage.tsx
// (JAVÍTVA: A Közreműködők kártya most már dinamikus max-magassággal rendelkezik)

import * as React from "react";
import {useParams, Link} from "react-router-dom";
import {useAuth} from "@/context/AuthContext";
import type {Case, Profile, CaseCollaborator} from "@/types/supabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {
  Loader2,
  AlertTriangle,
  ArrowLeft,
  Users,
  Shield,
  Save,
  Edit,
  FileText,
  Image,
} from "lucide-react";
import {toast} from "sonner";
import {CaseEditor} from "@/pages/mcb/components/CaseEditor.tsx";
import type {PartialBlock} from "@blocknote/core";
import {MantineProvider, createTheme} from "@mantine/core";
import {AddCollaboratorDialog} from "@/pages/mcb/components/AddCollaboratorDialog.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter as DialogFooterComponent,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CaseEvidenceTab } from "./components/CaseEvidenceTab";

// --- Típusok (VÁLTOZATLAN) ---
interface CaseDetailsData {
  caseDetails: {
    case: Case;
    owner: Pick<Profile, 'full_name' | 'role'>;
  };
  collaborators: {
    collaborator: CaseCollaborator;
    user: Pick<Profile, 'full_name' | 'role'>;
  }[];
}
type CollaboratorDetail = CaseDetailsData['collaborators'][number];
const getStatusBadge = (status: string) => {
  switch (status) {
    case "open":
      return <Badge variant="default" className="bg-green-600">Nyitott</Badge>;
    case "closed":
      return <Badge variant="secondary">Lezárt</Badge>;
    case "archived":
      return <Badge variant="outline">Archivált</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};
const mantineTheme = createTheme({});


export function CaseDetailPage() {
  const {caseId} = useParams<{ caseId: string }>();
  const {supabase, profile} = useAuth();

  const [details, setDetails] = React.useState<CaseDetailsData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [editorContent, setEditorContent] = React.useState<PartialBlock[] | undefined>(undefined);

  const [isEditorOpen, setIsEditorOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [tempEditorContent, setTempEditorContent] = React.useState<PartialBlock[] | undefined>(undefined);

  const [isAddCollabOpen, setIsAddCollabOpen] = React.useState(false);
  const [activeView, setActiveView] = React.useState<'content' | 'evidence'>('content');

  // --- EREDETI LOGIKA KIEGÉSZÍTÉSE ---
  const rightColumnRef = React.useRef<HTMLDivElement>(null);
  const leftHeaderRef = React.useRef<HTMLDivElement>(null);
  const [editorCardHeight, setEditorCardHeight] = React.useState<string | number>('auto');

  // VÁLTOZÁS: Új ref és state a Közreműködők kártya magasságához
  const collaboratorsCardRef = React.useRef<HTMLDivElement>(null);
  const [collaboratorMaxHeight, setCollaboratorMaxHeight] = React.useState<string | number>('350px');

  // ... fetchCaseDetails (VÁLTOZATLAN) ...
  const fetchCaseDetails = React.useCallback(async () => {
    if (!caseId) {
      setError("Nincs akta ID megadva.");
      setIsLoading(false);
      return;
    }
    if (!details) setIsLoading(true);
    setError(null);
    try {
      const {data, error} = await supabase.rpc('get_case_details', {
        p_case_id: caseId,
      });

      if (error) {
        if (error.message.includes("Hozzáférés megtagadva")) {
          throw new Error("Nincs jogosultságod megtekinteni ezt az aktát, vagy az akta nem létezik.");
        }
        throw error;
      }

      const caseBody = data.caseDetails.case.body;
      let validBody: PartialBlock[];
      if (Array.isArray(caseBody)) {
        validBody = caseBody.length > 0 ? caseBody : [{type: "paragraph", content: ""}];
      } else {
        console.warn("Hibás akta-törzs formátum észlelve (nem tömb). Visszaállítás alaphelyzetbe.");
        validBody = [{type: "paragraph", content: ""}];
      }
      const validData: CaseDetailsData = {
        ...data,
        caseDetails: {
          ...data.caseDetails,
          case: {
            ...data.caseDetails.case,
            body: validBody,
          },
        },
      };

      setDetails(validData);
      setEditorContent(validData.caseDetails.case.body);

    } catch (err) {
      const error = err as Error;
      console.error(error);
      setError(error.message);
      toast.error("Hiba történt", {description: error.message});
    } finally {
      setIsLoading(false);
    }
  }, [caseId, supabase, details]);

  React.useEffect(() => {
    fetchCaseDetails();
  }, [fetchCaseDetails]);

  // --- AZ EREDETI LOGIKA (KIEGÉSZÍTVE) ---
  React.useLayoutEffect(() => {
    // VÁLTOZATLAN: Csak 'content' nézetben számolunk
    if (activeView === 'content') {
      const calculateHeight = () => {
        if (window.innerWidth < 1024) {
          setEditorCardHeight('auto');
          setCollaboratorMaxHeight('350px'); // Mobilon marad a fix
          return;
        }

        // VÁLTOZATLAN: Bal oldal magasságának számítása
        if (rightColumnRef.current && leftHeaderRef.current) {
          const rightHeight = rightColumnRef.current.offsetHeight;
          const leftHeaderHeight = leftHeaderRef.current.offsetHeight;
          const gap = 24;
          const newHeight = rightHeight - leftHeaderHeight - gap;
          setEditorCardHeight(newHeight > 400 ? newHeight : 400);
        }

        // --- VÁLTOZÁS: Jobb oldal (Közreműködők) max-magasságának számítása ---
        if (collaboratorsCardRef.current) {
          const topOffset = collaboratorsCardRef.current.getBoundingClientRect().top;
          // 24px = a grid 'gap-6' alul, hogy ne érjen le teljesen a lap aljáig
          const newMaxHeight = window.innerHeight - topOffset - 24;

          // A min magasság 350px, de a max ne legyen kevesebb ennél
          setCollaboratorMaxHeight(newMaxHeight > 350 ? newMaxHeight : 350);
        }
      };

      const timer = setTimeout(calculateHeight, 50);
      window.addEventListener('resize', calculateHeight);
      const observer = new ResizeObserver(calculateHeight);

      // VÁLTOZATLAN: Figyeljük a jobb oszlopot
      if (rightColumnRef.current) {
        observer.observe(rightColumnRef.current);
      }

      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', calculateHeight);
        observer.disconnect();
      };
    } else {
      // VÁLTOZATLAN: Más nézetben resetelünk
      setEditorCardHeight('auto');
      setCollaboratorMaxHeight('350px');
    }
  }, [details, isLoading, activeView]);


  // ... (a többi handler, canEdit, canManageCollaborators VÁLTOZATLAN) ...
  const handleEditorSave = async () => {
    if (!caseId || !tempEditorContent) return;
    setIsSaving(true);
    const {error} = await supabase
      .from("cases")
      .update({body: tempEditorContent})
      .eq("id", caseId);
    setIsSaving(false);
    if (error) {
      toast.error("Hiba mentés közben", {description: error.message});
    } else {
      toast.success("Akta tartalma sikeresen mentve!");
      setEditorContent(tempEditorContent);
      if (details) {
        setDetails({
          ...details,
          caseDetails: {
            ...details.caseDetails,
            case: {
              ...details.caseDetails.case,
              body: tempEditorContent,
            },
          },
        });
      }
      setIsEditorOpen(false);
    }
  };
  const handleEditorCancel = () => {
    setIsEditorOpen(false);
    setTempEditorContent(undefined);
  };
  const handleOpenEditor = () => {
    setTempEditorContent(editorContent);
    setIsEditorOpen(true);
  };
  const canEdit = React.useMemo(() => {
    if (!profile || !details) return false;
    if (profile.role === 'lead_detective') return true;
    if (profile.id === details?.caseDetails.case.owner_id) return true;
    return details.collaborators.some(
      (c: CollaboratorDetail) => c.collaborator.user_id === profile.id && c.collaborator.status === 'approved'
    );
  }, [profile, details]);
  const canManageCollaborators = React.useMemo(() => {
    if (!profile || !details) return false;
    if (profile.role === 'lead_detective') return true;
    if (profile.id === details?.caseDetails.case.owner_id) return true;
    return false;
  }, [profile, details]);

  // ... (Betöltés és Hiba nézet VÁLTOZATLAN) ...
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-12 w-12 animate-spin text-slate-400"/>
      </div>
    );
  }
  if (error || !details) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-red-400">
        <AlertTriangle className="h-12 w-12"/>
        <p className="mt-4 text-lg font-semibold">Hiba történt</p>
        <p className="text-sm text-red-300">{error || "Az akta nem található."}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/mcb">
            <ArrowLeft className="w-4 h-4 mr-2"/> Vissza a listához
          </Link>
        </Button>
      </div>
    );
  }

  const {case: caseData, owner} = details.caseDetails;
  const {collaborators} = details;

  return (
    <div className="space-y-6 flex-1 flex flex-col">

      {/* 1. SOR: FEJLÉC GOMBOK (VÁLTOZATLAN) */}
      <div className="flex justify-between items-center flex-shrink-0">
        <Button asChild variant="outline" className="w-fit">
          <Link to="/mcb">
            <ArrowLeft className="w-4 h-4 mr-2"/> Vissza az aktákhoz
          </Link>
        </Button>
        <div className="flex items-center gap-2 p-1 bg-slate-800 rounded-lg">
          <Button
            variant={activeView === 'content' ? 'default' : 'ghost'}
            onClick={() => setActiveView('content')}
            className={cn(
              "h-8 px-3",
              activeView === 'content' && "bg-slate-950 text-white"
            )}
          >
            <FileText className="w-4 h-4 mr-2" />
            Akta Tartalma
          </Button>
          <Button
            variant={activeView === 'evidence' ? 'default' : 'ghost'}
            onClick={() => setActiveView('evidence')}
            className={cn(
              "h-8 px-3",
              activeView === 'evidence' && "bg-slate-950 text-white"
            )}
          >
            <Image className="w-4 h-4 mr-2" />
            Bizonyítékok
          </Button>
        </div>
        {canEdit ? (
          <Button onClick={handleOpenEditor}>
            <Edit className="w-4 h-4 mr-2"/> Akta Szerkesztése
          </Button>
        ) : (
          <div className="w-fit" />
        )}
      </div>

      {/* 2. SOR: FŐ TARTALOM */}

      {/* 1. NÉZET: AKTA TARTALMA (AZ EREDETI LOGIKA) */}
      {activeView === 'content' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 lg:items-start">

          {/* BAL OSZLOP (VÁLTOZATLAN) */}
          <div className="lg:col-span-2 space-y-6 flex flex-col">
            <Card
              className="bg-slate-900 border-slate-700 text-white flex-shrink-0 !py-0 !gap-0"
              ref={leftHeaderRef}
            >
              <CardHeader className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-3xl">#{caseData.case_number}: {caseData.title}</CardTitle>
                    <CardDescription className="text-lg text-slate-400">
                      {caseData.short_description || "Nincs rövid leírás megadva."}
                    </CardDescription>
                  </div>
                  {getStatusBadge(caseData.status)}
                </div>
              </CardHeader>
            </Card>

            <Card
              className="bg-slate-900 border-slate-700 text-white flex flex-col !py-0 !gap-0"
              style={{ height: editorCardHeight }}
            >
              <CardHeader className="p-6">
                <h3 className="text-xl font-semibold">Akta Tartalma</h3>
              </CardHeader>
              <CardContent className="p-0 flex-1 flex flex-col min-h-0">
                <div className="flex-1 min-h-0">
                  <MantineProvider theme={mantineTheme} forceColorScheme="dark">
                    <CaseEditor
                      key={JSON.stringify(editorContent)}
                      initialContent={editorContent}
                      editable={false}
                      onChange={() => {
                      }}
                    />
                  </MantineProvider>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* JOBB OSZLOP (Ragadós oldalsáv) */}
          <div className="lg:col-span-1 space-y-6" ref={rightColumnRef}>

            <Card className="bg-slate-800 border-slate-700 !py-0 !gap-0">
              <CardHeader className="p-6 !pb-0">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-400"/> Akta Tulajdonosa
                </CardTitle>
              </CardHeader>
              {/* JAVÍTÁS (Előző kérésből): p-6 -> px-6 pt-0 pb-4 */}
              <CardContent className="px-6 pt-0 pb-4">
                <p className="text-base">{owner.full_name}</p>
                <p className="text-sm text-slate-400">{owner.role}</p>
              </CardContent>
            </Card>

            {/* --- VÁLTOZÁS ITT --- */}
            <Card
              ref={collaboratorsCardRef} // Ref hozzáadva
              className="bg-slate-800 border-slate-700 flex flex-col !py-0 !gap-0"
              // A h-[350px] eltávolítva, style hozzáadva
              style={{ minHeight: '350px', maxHeight: collaboratorMaxHeight }}
            >
              {/* --- VÁLTOZÁS VÉGE --- */}
              <CardHeader className="p-6 flex-shrink-0">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-green-400"/> Közreműködők
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 !pt-0 space-y-3 flex-1 min-h-0 overflow-y-auto">
                {collaborators.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">Nincsenek közreműködők.</p>
                ) : (
                  collaborators.map((collab: CollaboratorDetail) => (
                    <div key={collab.user.full_name} className="flex items-center justify-between">
                      <div>
                        <p className="text-base">{collab.user.full_name}</p>
                        <p className="text-sm text-slate-400">{collab.user.role}</p>
                      </div>
                      <Badge variant={collab.collaborator.status === 'approved' ? 'default' : 'secondary'}
                             className={collab.collaborator.status === 'approved' ? 'bg-green-600' : ''}>
                        {collab.collaborator.status === 'approved' ? 'Jóváhagyva' : 'Függőben'}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
              {canManageCollaborators && (
                <CardFooter className="p-6 !pt-4 mt-auto flex-shrink-0 border-t border-slate-700">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setIsAddCollabOpen(true)}
                  >
                    Közreműködő hozzáadása
                  </Button>
                </CardFooter>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* 2. NÉZET: BIZONYÍTÉKOK (VÁLTOZATLAN) */}
      {activeView === 'evidence' && (
        <div className="flex-1 flex flex-col min-h-0">
          <CaseEvidenceTab />
        </div>
      )}

      {/* --- DIALÓGUSOK (Változatlan) --- */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white w-[95vw] max-w-[95vw] sm:max-w-[95vw] h-[95vh] flex flex-col p-4">
          <DialogHeader>
            <DialogTitle>Akta Szerkesztése: #{caseData.case_number}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 -mx-4 min-h-0">
            <MantineProvider theme={mantineTheme} forceColorScheme="dark">
              <CaseEditor
                key={isEditorOpen ? 'editor-open' : 'editor-closed'}
                initialContent={tempEditorContent}
                editable={true}
                onChange={(content) => {
                  setTempEditorContent(content);
                }}
                className="rounded-none h-full"
              />
            </MantineProvider>
          </div>
          <DialogFooterComponent className="">
            <Button variant="outline" onClick={handleEditorCancel} disabled={isSaving}>Mégse</Button>
            <Button onClick={handleEditorSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin"/>
              ) : (
                <Save className="w-4 h-4 mr-2"/>
              )}
              Mentés
            </Button>
          </DialogFooterComponent>
        </DialogContent>
      </Dialog>

      {canManageCollaborators && (
        <AddCollaboratorDialog
          caseId={caseId!}
          ownerId={caseData.owner_id}
          existingCollaborators={collaborators.map((c: CollaboratorDetail) => c.collaborator.user_id)}
          open={isAddCollabOpen}
          onOpenChange={setIsAddCollabOpen}
          onCollaboratorAdded={() => {
            fetchCaseDetails();
          }}
        />
      )}
    </div>
  );
}