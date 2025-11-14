import * as React from "react";
import {useParams, Link} from "react-router-dom";
import {useAuth} from "@/context/AuthContext";
import type {Case, Profile, CaseCollaborator, CaseStatus, CaseEvidence} from "@/types/supabase";
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
  Lock,
  Archive,
  FolderOpen,
  Settings,
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
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {cn} from "@/lib/utils";
import {CaseEvidenceTab} from "./components/CaseEvidenceTab";

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

type EvidenceWithUrl = CaseEvidence & { signedUrl: string };

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

  const [evidence, setEvidence] = React.useState<CaseEvidence[]>([]);

  const [isEditorOpen, setIsEditorOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [tempEditorContent, setTempEditorContent] = React.useState<PartialBlock[] | undefined>(undefined);

  const [isAddCollabOpen, setIsAddCollabOpen] = React.useState(false);
  const [activeView, setActiveView] = React.useState<'content' | 'evidence'>('content');

  const [isStatusAlertOpen, setIsStatusAlertOpen] = React.useState(false);
  const [targetStatus, setTargetStatus] = React.useState<CaseStatus | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);

  const leftHeaderRef = React.useRef<HTMLDivElement>(null);
  const contentCardRef = React.useRef<HTMLDivElement>(null);
  const [contentCardHeight, setContentCardHeight] = React.useState<string | number>('auto');

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

  React.useLayoutEffect(() => {
    if (activeView === 'content') {
      const calculateHeight = () => {
        if (window.innerWidth < 1024) {
          setContentCardHeight('auto');
          return;
        }
        if (leftHeaderRef.current && contentCardRef.current) {
          const contentTopOffset = contentCardRef.current.getBoundingClientRect().top;
          const viewportHeight = window.innerHeight;
          const bottomPadding = 32; // 2rem (p-8)
          const newHeight = viewportHeight - contentTopOffset - bottomPadding;
          setContentCardHeight(newHeight > 400 ? newHeight : 400);
        }
      };
      const timer = setTimeout(calculateHeight, 50);
      window.addEventListener('resize', calculateHeight);
      const observer = new ResizeObserver(calculateHeight);
      if (leftHeaderRef.current) {
        observer.observe(leftHeaderRef.current);
      }
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', calculateHeight);
        observer.disconnect();
      };
    } else {
      setContentCardHeight('auto');
    }
  }, [details, isLoading, activeView]);


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
    if (details.caseDetails.case.status !== 'open') {
      return false;
    }
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

  const handleOpenStatusAlert = (newStatus: CaseStatus) => {
    setTargetStatus(newStatus);
    setIsStatusAlertOpen(true);
  };
  const handleCancelStatusChange = () => {
    setIsStatusAlertOpen(false);
    setIsUpdatingStatus(false);
    setTimeout(() => setTargetStatus(null), 300);
  };
  const handleConfirmStatusChange = async () => {
    if (!targetStatus || !caseId || !details) return;
    setIsUpdatingStatus(true);
    const {error} = await supabase
      .from("cases")
      .update({status: targetStatus})
      .eq("id", caseId);
    setIsUpdatingStatus(false);
    if (error) {
      toast.error("Hiba az akta státuszának frissítésekor", {
        description: error.message,
      });
      handleCancelStatusChange();
    } else {
      toast.success("Akta státusza sikeresen frissítve!");
      setDetails({
        ...details,
        caseDetails: {
          ...details.caseDetails,
          case: {
            ...details.caseDetails.case,
            status: targetStatus,
          },
        },
      });
      handleCancelStatusChange();
    }
  };
  const getAlertDialogStrings = () => {
    switch (targetStatus) {
      case 'open':
        return {
          title: 'Akta újranyitása',
          description: 'Biztosan újranyitod ezt az aktát? A közreműködők ismét szerkeszthetik.'
        };
      case 'closed':
        return {
          title: 'Akta lezárása',
          description: 'Biztosan lezárod ezt az aktát? A közreműködők többé nem szerkeszthetik.'
        };
      case 'archived':
        return {
          title: 'Akta archiválása',
          description: 'Biztosan archiválod ezt az aktát? Az akta elkerül az aktív listáról és nem szerkeszthető.'
        };
      default:
        return {title: '', description: ''};
    }
  };

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
  const {title: alertTitle, description: alertDescription} = getAlertDialogStrings();

  return (
    <div className="space-y-6 flex-1 flex flex-col">

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
            <FileText className="w-4 h-4 mr-2"/>
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
            <Image className="w-4 h-4 mr-2"/>
            Bizonyítékok
          </Button>
        </div>
        {canEdit ? (
          <Button onClick={handleOpenEditor}>
            <Edit className="w-4 h-4 mr-2"/> Akta Szerkesztése
          </Button>
        ) : (
          <div className="w-fit"/>
        )}
      </div>

      {activeView === 'content' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 lg:items-start">

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
              ref={contentCardRef}
              className="bg-slate-900 border-slate-700 text-white flex flex-col !py-0 !gap-0"
              style={{height: contentCardHeight}}
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

          <div className="lg:col-span-1 lg:sticky top-24">
            <div className="space-y-6 max-h-[calc(100vh-15rem)] overflow-y-auto scrollbar-hide">
              <Card className="bg-slate-800 border-slate-700 !py-0 !gap-0">
                <CardHeader className="p-6 !pb-0">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-400"/> Akta Tulajdonosa
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-6 pt-0 pb-4">
                  <p className="text-base">{owner.full_name}</p>
                  <p className="text-sm text-slate-400">{owner.role}</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-800 border-slate-700 flex flex-col h-[350px] !py-0 !gap-0">
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

              {canManageCollaborators && (
                <Card className="bg-slate-800 border-slate-700 !py-0 !gap-0">
                  <CardHeader className="p-6 !pb-0">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Settings className="w-5 h-5 text-gray-400"/> Akta Kezelése
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-2">
                    {caseData.status === 'open' && (
                      <>
                        <Button variant="outline" className="w-full" onClick={() => handleOpenStatusAlert('closed')}>
                          <Lock className="w-4 h-4 mr-2"/> Akta Lezárása
                        </Button>
                        <Button variant="destructive" className="w-full"
                                onClick={() => handleOpenStatusAlert('archived')}>
                          <Archive className="w-4 h-4 mr-2"/> Akta Archiválása
                        </Button>
                      </>
                    )}
                    {caseData.status === 'closed' && (
                      <Button variant="outline" className="w-full" onClick={() => handleOpenStatusAlert('open')}>
                        <FolderOpen className="w-4 h-4 mr-2"/> Akta Újranyitása
                      </Button>
                    )}
                    {caseData.status === 'archived' && (
                      <Button variant="outline" className="w-full" onClick={() => handleOpenStatusAlert('open')}>
                        <FolderOpen className="w-4 h-4 mr-2"/> Akta Visszaállítása (Megnyitás)
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

        </div>
      )}

      {activeView === 'evidence' && (
        <div className="flex-1 flex flex-col min-h-0">
          <CaseEvidenceTab/>
        </div>
      )}

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent
          className="bg-slate-900 border-slate-700 text-white w-[95vw] max-w-[95vw] sm:max-w-[95vw] h-[95vh] flex flex-col p-4">
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
                caseId={caseId}
                supabase={supabase}
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

      <AlertDialog open={isStatusAlertOpen} onOpenChange={handleCancelStatusChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {alertDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdatingStatus}>Mégse</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmStatusChange} disabled={isUpdatingStatus}>
              {isUpdatingStatus ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin"/>
              ) : null}
              {isUpdatingStatus ? 'Folyamatban...' : 'Igen, megerősítem'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}