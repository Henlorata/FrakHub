// FrakHub/src/pages/mcb/CaseDetailPage.tsx

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

// --- Típusok ---
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

// ... getStatusBadge (változatlan) ...
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
// ... mantineTheme (változatlan) ...
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

  // --- VISSZAÁLLÍTVA: A JS-alapú magasság-számításhoz szükséges state és ref-ek ---
  const rightColumnRef = React.useRef<HTMLDivElement>(null);
  const leftHeaderRef = React.useRef<HTMLDivElement>(null);
  const [editorCardHeight, setEditorCardHeight] = React.useState<string | number>('auto');

  // ... fetchCaseDetails (változatlan) ...
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

  // --- VISSZAÁLLÍTVA: A JS-alapú magasság-számítás ---
  React.useLayoutEffect(() => {
    const calculateHeight = () => {
      // Mobilon ne számoljunk
      if (window.innerWidth < 1024) {
        setEditorCardHeight('auto');
        return;
      }

      // Csak akkor számolunk, ha a ref-ek már léteznek
      if (rightColumnRef.current && leftHeaderRef.current) {
        const rightHeight = rightColumnRef.current.offsetHeight;
        const leftHeaderHeight = leftHeaderRef.current.offsetHeight;

        // A 'gap-6' értéke 1.5rem (24px)
        const gap = 24;

        // A bal oldali editor magassága =
        // (Jobb oszlop teljes magassága) - (Bal oszlop fejléc-kártyájának magassága) - (A két kártya közti rés)
        const newHeight = rightHeight - leftHeaderHeight - gap;

        // Beállítunk egy ésszerű minimális magasságot, pl. 400px
        setEditorCardHeight(newHeight > 400 ? newHeight : 400);
      }
    };

    // Késleltetés, hogy a renderelés befejeződjön
    const timer = setTimeout(calculateHeight, 50);

    // Figyeljük az ablak átméretezését
    window.addEventListener('resize', calculateHeight);

    // Figyeljük a JOBB OLDALI sáv magasságának VÁLTOZÁSÁT
    // Ez fog lefutni, amikor a közreműködők listája (az "ugrás" előtt) nő
    const observer = new ResizeObserver(calculateHeight);
    if (rightColumnRef.current) {
      observer.observe(rightColumnRef.current);
    }

    // Takarítás
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calculateHeight);
      observer.disconnect();
    };
  }, [details, isLoading]); // Lefut, ha a betöltés befejeződött vagy a 'details' változik


  // ... (a többi handler, canEdit, canManageCollaborators változatlan) ...
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

  // ... (Betöltés és Hiba nézet változatlan) ...
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
    // JAVÍTÁS: Gyökér elem 'flex-1 flex flex-col', hogy kitöltse a 'main'-t
    <div className="space-y-6 flex-1 flex flex-col">

      {/* 1. SOR: FEJLÉC GOMBOK (Változatlan) */}
      <div className="flex justify-between items-center flex-shrink-0">
        <Button asChild variant="outline" className="w-fit">
          <Link to="/mcb">
            <ArrowLeft className="w-4 h-4 mr-2"/> Vissza az aktákhoz
          </Link>
        </Button>
        {canEdit && (
          <Button onClick={handleOpenEditor}>
            <Edit className="w-4 h-4 mr-2"/> Akta Szerkesztése
          </Button>
        )}
      </div>

      {/* 2. SOR: FŐ TARTALOM */}
      {/* JAVÍTÁS: A grid 'flex-1' és 'lg:items-start' (ez tartja a jobb sávot felül) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 lg:items-start">

        {/* BAL OSZLOP (Görgőző tartalom) */}
        {/* JAVÍTÁS: 'flex flex-col' hogy a belső kártya nyúlhasson */}
        <div className="lg:col-span-2 space-y-6 flex flex-col">
          {/* JAVÍTÁS: Visszaállítva a 'leftHeaderRef' */}
          <Card className="bg-slate-900 border-slate-700 text-white flex-shrink-0" ref={leftHeaderRef}>
            <CardHeader>
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

          {/* Akta Tartalma Kártya (JAVÍTVA) */}
          {/* JAVÍTÁS: Visszaállítva a 'style' és a belső görgetés */}
          <Card
            className="bg-slate-900 border-slate-700 text-white flex flex-col"
            style={{ height: editorCardHeight }}
          >
            <CardHeader>
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
        {/* JAVÍTÁS: Visszaállítva a 'rightColumnRef' */}
        <div className="lg:col-span-1 space-y-6" ref={rightColumnRef}>
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="p-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-400"/> Akta Tulajdonosa
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-base">{owner.full_name}</p>
              <p className="text-sm text-slate-400">{owner.role}</p>
            </CardContent>
          </Card>

          {/* === A VÉGLEGES JAVÍTÁS AZ "UGRÁLÁSRA" === */}
          {/* JAVÍTÁS: A KÁRTYA fix 'h-[350px]' magasságot kap (lehet 300, 350, 400, ízlés szerint) */}
          <Card className="bg-slate-800 border-slate-700 flex flex-col h-[350px]">
            <CardHeader className="p-4 flex-shrink-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-green-400"/> Közreműködők
              </CardTitle>
            </CardHeader>

            {/* JAVÍTÁS: A CardContent 'flex-1 min-h-0'-t kap (max-h törölve) */}
            <CardContent className="p-4 pt-0 space-y-3 flex-1 min-h-0 overflow-y-auto">
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

            {/* JAVÍTÁS: A Footer 'mt-auto'-t kap (hogy alulra tapadjon) és 'flex-shrink-0' */}
            {canManageCollaborators && (
              <CardFooter className="p-4 pt-0 mt-auto flex-shrink-0">
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
                className="rounded-none h-full" // Ez felülírja a rounded-b-md-t
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
            toast.success("Közreműködői lista frissítve.");
            fetchCaseDetails();
          }}
        />
      )}
    </div>
  );
}