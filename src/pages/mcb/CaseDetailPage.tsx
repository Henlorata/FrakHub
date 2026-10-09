import {Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode} from "react";
import {Link, useNavigate, useParams} from "react-router";
import {
  AlertTriangle, ArchiveRestore, ArrowLeft, Boxes, Check, ChevronRight, FileText, FolderArchive, Gavel, History, Info, ListTodo, Loader2, Lock,
  LogOut, MessageSquare, MoreHorizontal, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Paperclip, Pencil,
  Printer, ShieldAlert, Trash2, Unlock, ArrowRightLeft, X,
} from "lucide-react";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {OfficerProfileDialog} from "@/components/OfficerProfileDialog";
import {useAuth} from "@/context/AuthContext";
import {useSuspects} from "@/context/SuspectCacheContext";
import {deleteCloudinaryAssets, uploadToCloudinary} from "@/lib/cloudinary";
import {formatAgo, formatDate} from "@/lib/datetime";
import {lazyComponent} from "@/lib/lazy";
import {
  CATEGORIES, CATEGORY, PRIORITIES, PRIORITY, WARRANT_SELECT, documentReferences, evidenceNumbers, mcbApi,
  type CaseDetail, type CaseListItem,
} from "@/lib/mcb";
import {cn, errorMessage, isStaff} from "@/lib/utils";
import type {CaseCategory, CaseCollaborator, CaseEvidence, CasePriority, CaseStatus, CaseSuspect, CaseWarrant} from "@/types/supabase";
import {CaseEditor, type CaseEditorHandle} from "./components/CaseEditor";
import {AddSuspectDialog} from "./components/AddSuspectDialog";
import {AddCollaboratorDialog, TransferCaseDialog} from "./components/AddCollaboratorDialog";
import {CaseChat} from "./components/CaseChat";
import {CaseTimeline} from "./components/CaseTimeline";
import {EvidencePanel} from "./components/EvidencePanel";
import {EvidenceViewer} from "./components/EvidenceViewer";
import {LinkedCaseDialog} from "./components/LinkedCaseDialog";
import {CaseStatusChip, CategoryChip, MemberAvatar, PriorityChip} from "./components/McbBadges";
import {PeopleCard, ReferencesCard, SummaryCard, TeamCard} from "./components/CaseSidebar";
import {UploadEvidenceDialog} from "./components/UploadEvidenceDialog";
import {TasksPanel} from "./components/TasksPanel";
import {ItemsPanel} from "./components/ItemsPanel";
import {SuggestionsCard} from "./components/SuggestionsCard";
import {WarrantActionDialog, WarrantCard, type WarrantAction, type WarrantPermissions} from "./components/WarrantCard";
import {WarrantDialog} from "./components/WarrantDialog";
import {WarrantDocument} from "./components/WarrantDocument";
import {useCaseRoom, type CaseChange, type CaseNoteRow} from "./useCaseRoom";

type RightTab = "evidence" | "tasks" | "warrants" | "items" | "chat" | "log";
type MobileTab = "document" | "info" | RightTab;

const RAILS_KEY = "frakhub.mcb.rails";

function useWideLayout() {
  const query = "(min-width: 1280px)";
  const [wide, setWide] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setWide(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return wide;
}

// The drawing tool loads only when it is opened.
const ImageAnnotator = lazyComponent(() => import("@/components/annotate/ImageAnnotator"), "ImageAnnotator");

interface ConfirmState {
  title: string;
  description: ReactNode;
  action: string;
  destructive?: boolean;
  run: () => Promise<void> | void;
}

export function CaseDetailPage() {
  const {caseId = ""} = useParams<{caseId: string}>();
  const {supabase, profile} = useAuth();
  const navigate = useNavigate();
  const {openSuspectId} = useSuspects();
  const wide = useWideLayout();

  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [failure, setFailure] = useState<{denied: boolean; message: string} | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [snapshot, setSnapshot] = useState<unknown>(null);
  const [dirty, setDirty] = useState(false);
  const [remote, setRemote] = useState<{version: number; by: string} | null>(null);
  const [liveNote, setLiveNote] = useState<CaseNoteRow | null>(null);
  const [unread, setUnread] = useState(0);
  const [logKey, setLogKey] = useState(0);
  const [rightTab, setRightTab] = useState<RightTab>("evidence");
  const [mobileTab, setMobileTab] = useState<MobileTab>("document");
  const [rails, setRails] = useState(() => {
    try {
      return {left: true, right: true, ...(JSON.parse(localStorage.getItem(RAILS_KEY) ?? "{}") as object)} as {left: boolean; right: boolean};
    } catch {
      return {left: true, right: true};
    }
  });

  // Dialogs.
  const [uploadFiles, setUploadFiles] = useState<File[] | null>(null);
  const [personDialog, setPersonDialog] = useState<{preselect: string | null} | null>(null);
  const [collabOpen, setCollabOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [warrantOpen, setWarrantOpen] = useState(false);
  const [warrantAction, setWarrantAction] = useState<{warrant: CaseWarrant; action: WarrantAction} | null>(null);
  const [warrantDoc, setWarrantDoc] = useState<CaseWarrant | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [officerId, setOfficerId] = useState<string | null>(null);
  const [linkedCase, setLinkedCase] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  // An uploaded picture being annotated: the drawing becomes a new piece of evidence.
  const [annotating, setAnnotating] = useState<CaseEvidence | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [listInfo, setListInfo] = useState<CaseListItem | null>(null);

  const editorRef = useRef<CaseEditorHandle>(null);
  const chatVisible = wide ? rails.right && rightTab === "chat" : mobileTab === "chat";
  const chatVisibleRef = useRef(chatVisible);
  useEffect(() => {
    chatVisibleRef.current = chatVisible;
    if (chatVisible) setUnread(0);
  }, [chatVisible]);

  // --- Data ------------------------------------------------------------------------

  const load = useCallback(async () => {
    try {
      const data = await mcbApi.detail(caseId);
      setDetail(data);
      setSnapshot(data.case.body);
      setFailure(null);
      return data;
    } catch (error) {
      const code = (error as {code?: string}).code;
      setFailure({denied: code === "42501", message: errorMessage(error)});
      if (code === "42501") mcbApi.list().then((list) => setListInfo(list.find((item) => item.id === caseId) ?? null)).catch(() => undefined);
      return null;
    }
  }, [caseId]);

  useEffect(() => {
    setDetail(null);
    setFailure(null);
    setEditorKey((key) => key + 1);
    void load();
  }, [load]);

  const patch = useCallback((update: (current: CaseDetail) => CaseDetail) => setDetail((current) => (current ? update(current) : current)), []);

  const refreshEvidence = useCallback(async () => {
    const {data} = await supabase.from("case_evidence")
      .select("id, case_id, file_path, file_name, file_type, uploaded_by, created_at, uploader:uploaded_by(full_name)")
      .eq("case_id", caseId).order("created_at");
    const rows = ((data ?? []) as unknown as (CaseEvidence & {uploader?: {full_name: string} | null})[])
      .map(({uploader, ...row}) => ({...row, uploader_name: uploader?.full_name ?? null}));
    patch((current) => ({...current, evidence: rows}));
  }, [caseId, patch, supabase]);

  const refreshPeople = useCallback(async () => {
    const {data} = await supabase.from("case_suspects").select("id, case_id, suspect_id, involvement_type, notes, added_at, suspect:suspect_id(*)")
      .eq("case_id", caseId).order("added_at");
    patch((current) => ({...current, people: (data ?? []) as unknown as CaseSuspect[]}));
  }, [caseId, patch, supabase]);

  const refreshWarrants = useCallback(async () => {
    const {data} = await supabase.from("case_warrants").select(WARRANT_SELECT).eq("case_id", caseId).order("created_at", {ascending: false});
    patch((current) => ({...current, warrants: (data ?? []) as unknown as CaseWarrant[]}));
  }, [caseId, patch, supabase]);

  /** Case fields, team and permissions again (the document stays as it is in the editor). */
  const refreshMeta = useCallback(async () => {
    try {
      const data = await mcbApi.detail(caseId);
      setDetail((current) => (current ? {...data, case: {...data.case, body: current.case.body}} : data));
    } catch (error) {
      setFailure({denied: (error as {code?: string}).code === "42501", message: errorMessage(error)});
    }
  }, [caseId]);

  // --- Realtime room -------------------------------------------------------------

  const me = useMemo(() => (profile ? {id: profile.id, name: profile.full_name, avatar: profile.avatar_url ?? null} : null),
    [profile]);
  const warrantTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const room = useCaseRoom(caseId, detail ? me : null, {
    onSaved: (payload) => {
      setRemote(payload);
      setLogKey((key) => key + 1);
    },
    onChanged: (what: CaseChange) => {
      setLogKey((key) => key + 1);
      if (what === "evidence") void refreshEvidence();
      else if (what === "people") void refreshPeople();
      else if (what === "tasks") void mcbApi.tasks(caseId).then((tasks) => patch((current) => ({...current, tasks}))).catch(() => undefined);
      else if (what === "items") void mcbApi.items(caseId).then((items) => patch((current) => ({...current, items}))).catch(() => undefined);
      else void refreshMeta();
    },
    onNote: (note) => {
      setLiveNote(note);
      if (!chatVisibleRef.current && note.user_id !== profile?.id) setUnread((count) => count + 1);
    },
    onWarrants: () => {
      clearTimeout(warrantTimer.current);
      warrantTimer.current = setTimeout(() => {
        void refreshWarrants();
        setLogKey((key) => key + 1);
      }, 300);
    },
  });

  useEffect(() => () => clearTimeout(warrantTimer.current), []);
  useEffect(() => room.setEditing(dirty), [dirty, room]);

  const announce = useCallback((what: CaseChange) => {
    room.broadcastChange(what);
    setLogKey((key) => key + 1);
    mcbApi.invalidateList();
  }, [room]);

  const reloadDocument = useCallback(async () => {
    const data = await load();
    if (data) {
      setRemote(null);
      setEditorKey((key) => key + 1);
      toast.info("Az akta frissült egy másik szerkesztő mentése után.");
    }
  }, [load]);

  // --- Derived -------------------------------------------------------------------

  const numbers = useMemo(() => evidenceNumbers(detail?.evidence ?? []), [detail?.evidence]);
  const refs = useMemo(() => documentReferences(snapshot), [snapshot]);
  const viewer = detail?.viewer;
  const canEdit = !!viewer?.can_edit;
  const status = detail?.case.status ?? "open";
  const canChat = status === "open";
  const linkedSuspectIds = useMemo(() => (detail?.people ?? []).map((item) => item.suspect_id), [detail?.people]);
  const sortedEvidence = useMemo(() => [...(detail?.evidence ?? [])].sort((a, b) => (numbers.get(a.id) ?? 0) - (numbers.get(b.id) ?? 0)),
    [detail?.evidence, numbers]);
  const pendingWarrants = (detail?.warrants ?? []).filter((item) => item.status === "pending" || (item.status === "approved" && !!item.renewal_requested_at)).length;
  const openTasks = (detail?.tasks ?? []).filter((task) => !task.done_at).length;
  const overdueTasks = (detail?.tasks ?? []).filter((task) => !task.done_at && task.overdue).length;

  const perms: WarrantPermissions = useMemo(() => ({
    myId: profile?.id,
    canApprove: !!viewer?.can_approve,
    canEditCase: () => canEdit,
    canManageCase: () => !!viewer?.can_manage,
  }), [canEdit, profile?.id, viewer?.can_approve, viewer?.can_manage]);

  // Files dropped or pasted anywhere on the page become evidence (editors of an open case).
  useEffect(() => {
    if (!canEdit) return;
    const onDragOver = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
    };
    const onDrop = (event: DragEvent) => {
      const files = [...(event.dataTransfer?.files ?? [])];
      if (files.length === 0) return;
      // The document handles its own drops (images go into the text).
      if ((event.target as HTMLElement | null)?.closest?.(".bn-editor")) return;
      event.preventDefault();
      setUploadFiles(files);
    };
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.(".bn-editor, input, textarea, [role='dialog']")) return;
      const files = [...(event.clipboardData?.files ?? [])];
      if (files.length > 0) {
        event.preventDefault();
        setUploadFiles(files);
      }
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("paste", onPaste);
    };
  }, [canEdit]);

  // --- Actions -------------------------------------------------------------------

  const updateCase = async (changes: Parameters<typeof mcbApi.update>[1], success?: string) => {
    try {
      const result = await mcbApi.update(caseId, changes);
      patch((current) => ({...current, case: {...current.case, ...result}}));
      announce("meta");
      if (success) toast.success(success);
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    }
  };

  const changeStatus = (next: CaseStatus) => {
    const texts: Record<string, {title: string; description: string; action: string}> = {
      closed: {title: "Akta lezárása", action: "Lezárás",
        description: "Lezárás után az akta csak olvasható, az elbírálatlan parancskérelmek megszűnnek. Újranyitni a vezető nyomozó és az MCB vezetése tud."},
      open: {title: status === "archived" ? "Visszaállítás és újranyitás" : "Akta újranyitása", action: "Újranyitás",
        description: "Az akta újra szerkeszthető lesz, a csapat értesítést kap."},
      archived: {title: "Akta archiválása", action: "Archiválás",
        description: "Az archivált akta kikerül a listából (az Archívum szűrő alatt marad), csak olvasható. Visszaállítani az MCB vezetése tud."},
    };
    const restoring = status === "archived" && next === "closed";
    const text = restoring
      ? {title: "Visszaállítás az archívumból", action: "Visszaállítás", description: "Az akta visszakerül a lezárt akták közé."}
      : texts[next];
    setConfirm({
      ...text,
      run: async () => {
        if (next !== "open" && editorRef.current?.isDirty()) {
          const saved = await editorRef.current.save();
          if (!saved) throw new Error("Előbb mentsd a dokumentumot (vagy oldd fel az ütközést).");
        }
        const result = await mcbApi.setStatus(caseId, next);
        toast.success(next === "closed" ? (restoring ? "Az akta visszakerült a lezártak közé." : "Akta lezárva.")
          : next === "archived" ? "Akta archiválva." : "Akta újranyitva.",
        {description: result.expired_warrants > 0 ? `${result.expired_warrants} elbírálatlan parancskérelem megszűnt.` : undefined});
        await refreshMeta();
        if (result.expired_warrants > 0) void refreshWarrants();
        setEditorKey((key) => key + 1);
        announce("meta");
      },
    });
  };

  const trashCase = () => setConfirm({
    title: "Akta a lomtárba",
    description: <>A(z) <strong>{detail?.case.case_number}</strong> eltűnik a listákból, a keresésből és a kapcsolati hálóból, a parancsai sem
      látszanak, és senki sem szerkesztheti. A lomtárból 30 napig visszaállítható, utána a fájlokkal együtt véglegesen törlődik.</>,
    action: "Lomtárba",
    destructive: true,
    run: async () => {
      if (editorRef.current?.isDirty()) {
        const saved = await editorRef.current.save();
        if (!saved) throw new Error("Előbb mentsd a dokumentumot (vagy oldd fel az ütközést).");
      }
      await mcbApi.trash(caseId);
      mcbApi.invalidateList();
      announce("meta");
      toast.success("Az akta a lomtárba került.", {
        description: "30 napig visszaállítható.",
        action: {label: "Visszavonás", onClick: () => {
          mcbApi.restore(caseId).then(() => {
            mcbApi.invalidateList();
            toast.success("Akta visszaállítva.");
            navigate(`/mcb/case/${caseId}`);
          }, (error) => toast.error("A visszaállítás nem sikerült.", {description: errorMessage(error)}));
        }},
      });
      navigate("/mcb");
    },
  });

  const saveAnnotated = async (source: CaseEvidence, file: File) => {
    if (!profile) return;
    const url = await uploadToCloudinary(file, "evidence");
    const {error} = await supabase.from("case_evidence").insert({
      case_id: caseId, uploaded_by: profile.id, file_name: `${source.file_name} (jelölt)`.slice(0, 120), file_path: url, file_type: "image",
    });
    if (error) {
      void deleteCloudinaryAssets([url]);
      throw error;
    }
    setAnnotating(null);
    await refreshEvidence();
    announce("evidence");
    toast.success("A jelölt másolat bekerült a bizonyítékok közé.");
  };

  const renameEvidence = async (item: CaseEvidence, name: string) => {
    const {error} = await supabase.from("case_evidence").update({file_name: name}).eq("id", item.id);
    if (error) {
      toast.error("Az átnevezés nem sikerült.", {description: errorMessage(error)});
      return false;
    }
    patch((current) => ({...current, evidence: current.evidence.map((entry) => (entry.id === item.id ? {...entry, file_name: name} : entry))}));
    announce("evidence");
    return true;
  };

  const deleteEvidence = (item: CaseEvidence) => {
    const used = refs.evidence.get(item.id) ?? 0;
    setConfirm({
      title: "Bizonyíték törlése",
      description: <>A(z) <strong>#{numbers.get(item.id)} {item.file_name}</strong> véglegesen törlődik.
        {used > 0 && ` A dokumentum ${used} helyen hivatkozik rá: ott „törölt bizonyíték” jelenik meg.`}</>,
      action: "Törlés",
      destructive: true,
      run: async () => {
        const {error} = await supabase.from("case_evidence").delete().eq("id", item.id);
        if (error) throw error;
        patch((current) => ({...current, evidence: current.evidence.filter((entry) => entry.id !== item.id)}));
        // The file itself afterwards (the server refuses files that are still referenced).
        if (item.file_path.startsWith("http")) void deleteCloudinaryAssets([item.file_path]);
        else void supabase.storage.from("case_evidence").remove([item.file_path]);
        announce("evidence");
        toast.success("Bizonyíték törölve.");
      },
    });
  };

  const setInvolvement = async (link: CaseSuspect, role: string) => {
    if (link.involvement_type === role) return;
    const {error} = await supabase.from("case_suspects").update({involvement_type: role}).eq("id", link.id);
    if (error) return void toast.error("A módosítás nem sikerült.", {description: errorMessage(error)});
    patch((current) => ({...current, people: current.people.map((entry) => (entry.id === link.id ? {...entry, involvement_type: role} : entry))}));
    announce("people");
  };

  const setLinkNotes = async (link: CaseSuspect, notes: string) => {
    const {error} = await supabase.from("case_suspects").update({notes: notes.trim() || null}).eq("id", link.id);
    if (error) {
      toast.error("A megjegyzés mentése nem sikerült.", {description: errorMessage(error)});
      return false;
    }
    patch((current) => ({...current, people: current.people.map((entry) => (entry.id === link.id ? {...entry, notes: notes.trim() || null} : entry))}));
    announce("people");
    return true;
  };

  const unlinkPerson = (link: CaseSuspect) => setConfirm({
    title: "Személy eltávolítása",
    description: <><strong>{link.suspect?.full_name}</strong> kikerül az aktából. A nyilvántartásban megmarad.</>,
    action: "Eltávolítás",
    destructive: true,
    run: async () => {
      const {error} = await supabase.from("case_suspects").delete().eq("id", link.id);
      if (error) throw error;
      patch((current) => ({...current, people: current.people.filter((entry) => entry.id !== link.id)}));
      announce("people");
    },
  });

  const setCollaboratorRole = async (collaborator: CaseCollaborator, role: "editor" | "viewer") => {
    if (collaborator.role === role) return;
    const {error} = await supabase.from("case_collaborators").update({role}).eq("id", collaborator.id);
    if (error) return void toast.error("A módosítás nem sikerült.", {description: errorMessage(error)});
    patch((current) => ({...current, collaborators: current.collaborators.map((entry) => (entry.id === collaborator.id ? {...entry, role} : entry))}));
    announce("team");
  };

  const removeCollaborator = (collaborator: CaseCollaborator) => setConfirm({
    title: "Közreműködő eltávolítása",
    description: <><strong>{collaborator.profile?.full_name}</strong> elveszíti a hozzáférését az aktához.</>,
    action: "Eltávolítás",
    destructive: true,
    run: async () => {
      const {error} = await supabase.from("case_collaborators").delete().eq("id", collaborator.id);
      if (error) throw error;
      patch((current) => ({...current, collaborators: current.collaborators.filter((entry) => entry.id !== collaborator.id)}));
      announce("team");
    },
  });

  const leaveCase = () => setConfirm({
    title: "Kilépés az aktából",
    description: "Elveszíted a hozzáférésedet; újra a tulajdonos vagy az MCB vezetése vehet fel.",
    action: "Kilépés",
    destructive: true,
    run: async () => {
      const {error} = await supabase.from("case_collaborators").delete().eq("case_id", caseId).eq("user_id", profile?.id ?? "");
      if (error) throw error;
      announce("team");
      mcbApi.invalidateList();
      navigate("/mcb");
    },
  });

  const onMention = useCallback((role: "officer" | "suspect" | "case", id: string) => {
    if (role === "officer") setOfficerId(id);
    else if (role === "suspect") openSuspectId(id);
    else setLinkedCase(id);
  }, [openSuspectId]);

  const onEditorSaved = useCallback((version: number, updatedAt: string) => {
    room.broadcastSaved(version, profile?.full_name ?? "Egy szerkesztő");
    setLogKey((key) => key + 1);
    setDetail((current) => (current ? {...current, case: {...current.case, body_version: version, updated_at: updatedAt,
      body_updated_by_name: profile?.full_name ?? null}} : current));
  }, [profile?.full_name, room]);

  const toggleRail = (side: "left" | "right") => setRails((current) => {
    const next = {...current, [side]: !current[side]};
    localStorage.setItem(RAILS_KEY, JSON.stringify(next));
    return next;
  });

  // --- Render --------------------------------------------------------------------

  if (failure && !detail) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
        <span className="grid size-16 place-items-center rounded-2xl bg-red-500/10 text-red-300 ring-1 ring-red-500/30">
          {failure.denied ? <Lock className="size-7"/> : <AlertTriangle className="size-7"/>}
        </span>
        <h1 className="text-xl font-semibold text-white">{failure.denied ? "Nincs hozzáférésed ehhez az aktához" : "Az akta nem nyitható meg"}</h1>
        <p className="text-sm text-slate-400">{failure.message}</p>
        {failure.denied && listInfo && (
          <div className="panel flex w-full items-center gap-3 p-3 text-left">
            <MemberAvatar url={listInfo.owner_avatar} name={listInfo.owner_name} size={36}/>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{listInfo.case_number} · {listInfo.title}</p>
              <p className="text-xs text-slate-400">Hozzáférést a vezető nyomozótól kérhetsz: {listInfo.owner_name ?? "–"}</p>
            </div>
          </div>
        )}
        <Button variant="outline" onClick={() => navigate("/mcb")}><ArrowLeft className="size-4"/> Vissza az aktákhoz</Button>
      </div>
    );
  }

  if (!detail || !viewer) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <div className="skeleton h-32 rounded-2xl"/>
        <div className="grid flex-1 grid-cols-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)_380px]">
          <div className="skeleton hidden h-96 rounded-2xl xl:block"/>
          <div className="skeleton h-[60vh] rounded-2xl"/>
          <div className="skeleton hidden h-96 rounded-2xl xl:block"/>
        </div>
      </div>
    );
  }

  const item = detail.case;
  const priority = PRIORITY[item.priority] ?? PRIORITY.medium;
  const canDeleteEvidence = (entry: CaseEvidence) => status === "open"
    && (entry.uploaded_by === profile?.id || canEdit || isStaff(profile));

  const editor = (
    <CaseEditor
      key={editorKey}
      ref={editorRef}
      caseId={caseId}
      caseNumber={item.case_number as string}
      content={item.body}
      version={item.body_version}
      updatedAt={item.updated_at}
      updatedByName={item.body_updated_by_name ?? null}
      readOnly={!canEdit}
      theme={item.theme ?? "default"}
      canChangeTheme={canEdit}
      onThemeChange={(theme) => void updateCase({theme})}
      evidence={detail.evidence}
      numbers={numbers}
      onOpenEvidence={setViewing}
      onMention={onMention}
      remote={remote}
      onReload={() => void reloadDocument()}
      onSaved={onEditorSaved}
      onDirtyChange={setDirty}
      onDocument={setSnapshot}
    />
  );

  const leftRail = (
    <div className="flex flex-col gap-4" data-tour="case-rail">
      <SummaryCard detail={detail} canEdit={canEdit} onSaveDescription={(text) => updateCase({description: text}, "Összefoglaló mentve.")}/>
      <PeopleCard people={detail.people} canEdit={canEdit} onAdd={() => setPersonDialog({preselect: null})} onOpen={openSuspectId}
                  onRole={(link, role) => void setInvolvement(link, role)} onNotes={setLinkNotes} onRemove={unlinkPerson}/>
      <TeamCard detail={detail} myId={profile?.id} onAdd={() => setCollabOpen(true)} onRole={(collaborator, role) => void setCollaboratorRole(collaborator, role)}
                onRemove={removeCollaborator} onLeave={leaveCase} onTransfer={() => setTransferOpen(true)} onOpenMember={setOfficerId}/>
      <ReferencesCard refs={refs} linkedSuspectIds={linkedSuspectIds} canEdit={canEdit} onOfficer={setOfficerId} onSuspect={openSuspectId}
                      onLinkSuspect={(id) => setPersonDialog({preselect: id})} onCase={setLinkedCase}/>
      <SuggestionsCard suggestions={(detail.suggestions ?? []).filter((entry) => !refs.cases.has(entry.id))} onOpen={(entry) => setLinkedCase(entry.id)}/>
    </div>
  );

  const warrantList = (
    <div className="flex h-full min-h-0 flex-col" data-tour="case-warrants">
      <div className="flex shrink-0 items-center gap-2 px-3 pt-3 pb-2">
        <p className="text-xs text-slate-500">{detail.warrants.length === 0 ? "Nincs parancs." : `${detail.warrants.length} parancs, ${pendingWarrants} elbírálatlan`}</p>
        {canEdit && (
          <Button size="sm" onClick={() => setWarrantOpen(true)} className="ml-auto h-8 bg-red-600 text-white hover:bg-red-500">
            <Gavel className="size-4"/> Kérelem
          </Button>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">
        {detail.warrants.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-500">
            Elfogató- és házkutatási parancsot az akta szerkesztői kérhetnek; a Supervisory Staff és felette vagy egy Investigator III. bírálja el.
          </p>
        ) : detail.warrants.map((warrant) => (
          <WarrantCard key={warrant.id} warrant={warrant} perms={perms} onAction={(entry, action) => setWarrantAction({warrant: entry, action})}
                       onOpenDocument={setWarrantDoc} onOpenPerson={openSuspectId}/>
        ))}
      </div>
    </div>
  );

  const tabs: {value: RightTab; label: string; icon: typeof Paperclip; badge?: number; alert?: boolean}[] = [
    {value: "evidence", label: "Bizonyítékok", icon: Paperclip, badge: detail.evidence.length},
    {value: "tasks", label: "Teendők", icon: ListTodo, badge: openTasks || undefined, alert: overdueTasks > 0},
    {value: "warrants", label: "Parancsok", icon: Gavel, badge: detail.warrants.length, alert: pendingWarrants > 0},
    {value: "items", label: "Tárgyak", icon: Boxes, badge: (detail.items ?? []).length || undefined},
    {value: "chat", label: "Üzenetek", icon: MessageSquare, badge: unread || undefined, alert: unread > 0},
    {value: "log", label: "Napló", icon: History},
  ];

  const tabBody = (tab: RightTab) => tab === "evidence" ? (
    <EvidencePanel evidence={detail.evidence} numbers={numbers} usage={refs.evidence} canEdit={canEdit} canDelete={canDeleteEvidence}
                   onUpload={() => setUploadFiles([])} onView={setViewing}
                   onInsert={(id) => {
                     editorRef.current?.insertEvidence(id);
                     if (!wide) setMobileTab("document");
                   }}
                   onRename={renameEvidence} onDelete={deleteEvidence} onAnnotate={setAnnotating}/>
  ) : tab === "tasks" ? (
    <div className="h-full p-3">
      <TasksPanel detail={detail} myId={profile?.id} onChanged={(tasks) => {
        patch((current) => ({...current, tasks}));
        announce("tasks");
      }}/>
    </div>
  ) : tab === "items" ? (
    <div className="h-full p-3">
      <ItemsPanel detail={detail} myId={profile?.id} onChanged={(items) => {
        patch((current) => ({...current, items}));
        announce("items");
      }}/>
    </div>
  ) : tab === "warrants" ? warrantList : tab === "chat" ? (
    <CaseChat caseId={caseId} canWrite={canChat} liveNote={liveNote}/>
  ) : (
    <div className="h-full overflow-y-auto"><CaseTimeline caseId={caseId} refreshKey={logKey}/></div>
  );

  return (
    <div className={cn("flex flex-col gap-4", wide && "h-shell")}>
      {/* --- Header ------------------------------------------------------------- */}
      <header className="panel animate-rise relative shrink-0 overflow-hidden p-0" data-tour="case-header">
        <div aria-hidden className={cn("pointer-events-none absolute -top-24 -left-16 size-72 rounded-full opacity-25 blur-3xl", priority.dot)}/>
        <div className="relative flex flex-col gap-3 px-4 py-3.5 sm:px-5 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <Link to="/mcb" aria-label="Vissza az aktákhoz"
                  className="mt-1 grid size-9 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-slate-300 ring-1 ring-white/10 hover:bg-white/10 hover:text-white">
              <ArrowLeft className="size-4"/>
            </Link>
            <div className="min-w-0 flex-1">
              <nav className="flex items-center gap-1 text-[11px] text-slate-500">
                <Link to="/mcb" className="hover:text-slate-300">Nyomozó Iroda</Link><ChevronRight className="size-3"/>
                <span className="font-mono text-sky-300/90">{item.case_number}</span>
              </nav>
              <TitleEditor title={item.title} canEdit={canEdit} onSave={(title) => updateCase({title}, "Akta átnevezve.")}/>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <CaseStatusChip status={item.status}/>
                {canEdit ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50" aria-label="Prioritás">
                      <PriorityChip priority={item.priority} className="cursor-pointer hover:brightness-125"/>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuLabel>Prioritás</DropdownMenuLabel>
                      {PRIORITIES.map((value) => (
                        <DropdownMenuItem key={value} onSelect={() => void updateCase({priority: value as CasePriority}, "Prioritás módosítva.")}>
                          <span className={cn("size-2 rounded-full", PRIORITY[value].dot)}/>{PRIORITY[value].label}
                          {item.priority === value && <Check className="ml-auto size-3.5"/>}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : <PriorityChip priority={item.priority}/>}
                {canEdit ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50" aria-label="Ügytípus">
                      {item.category ? <CategoryChip category={item.category} className="cursor-pointer hover:bg-white/10"/> : (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-slate-500 ring-1 ring-dashed ring-white/15 hover:text-slate-300">
                          + ügytípus
                        </span>
                      )}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
                      <DropdownMenuLabel>Ügytípus</DropdownMenuLabel>
                      {CATEGORIES.map((value) => {
                        const look = CATEGORY[value];
                        return (
                          <DropdownMenuItem key={value} onSelect={() => void updateCase({category: value as CaseCategory}, "Ügytípus módosítva.")}>
                            <look.icon className="size-4"/>{look.label}
                            {item.category === value && <Check className="ml-auto size-3.5"/>}
                          </DropdownMenuItem>
                        );
                      })}
                      {item.category && (
                        <>
                          <DropdownMenuSeparator/>
                          <DropdownMenuItem onSelect={() => void updateCase({category: null})}><X className="size-4"/> Nincs megadva</DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : <CategoryChip category={item.category}/>}
                <span className="ml-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                  <MemberAvatar url={detail.owner?.avatar_url} name={detail.owner?.full_name} size={18}/>
                  {detail.owner?.full_name ?? "Nincs tulajdonos"} · megnyitva {formatDate(item.created_at)} · frissítve {formatAgo(item.updated_at)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {room.peers.length > 0 && (
              <div className="flex items-center -space-x-2 pr-1" title={room.peers.map((peer) => `${peer.name}${peer.editing ? " (szerkeszt)" : ""}`).join(", ")}>
                {room.peers.slice(0, 5).map((peer) => (
                  <span key={peer.id} className="relative">
                    <MemberAvatar url={peer.avatar} name={peer.name} size={28} className="ring-2 ring-[#0a1020]"/>
                    <span className={cn("absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-[#0a1020]", peer.editing ? "bg-amber-400" : "bg-emerald-400")}/>
                  </span>
                ))}
                <span className="pl-3 text-[11px] text-slate-400">{room.peers.length === 1 ? "is itt van" : `+${room.peers.length} itt`}</span>
              </div>
            )}
            {wide && (
              <div className="flex rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/10">
                <button type="button" onClick={() => toggleRail("left")} title="Bal panel" className="grid size-8 place-items-center rounded-md text-slate-400 hover:text-white">
                  {rails.left ? <PanelLeftClose className="size-4"/> : <PanelLeftOpen className="size-4"/>}
                </button>
                <button type="button" onClick={() => toggleRail("right")} title="Jobb panel" className="grid size-8 place-items-center rounded-md text-slate-400 hover:text-white">
                  {rails.right ? <PanelRightClose className="size-4"/> : <PanelRightOpen className="size-4"/>}
                </button>
              </div>
            )}
            <Button variant="outline" size="sm" className="h-9" asChild>
              <Link to={`/mcb/case/${caseId}/print`} target="_blank" rel="noopener"><Printer className="size-4"/> Nyomtatás</Link>
            </Button>
            {status === "open" && viewer.can_manage && (
              <Button size="sm" className="h-9 bg-slate-200 text-slate-900 hover:bg-white" onClick={() => changeStatus("closed")}>
                <Lock className="size-4"/> Lezárás
              </Button>
            )}
            {status === "closed" && viewer.can_manage && (
              <Button size="sm" variant="outline" className="h-9 border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10" onClick={() => changeStatus("open")}>
                <Unlock className="size-4"/> Újranyitás
              </Button>
            )}
            {status === "archived" && viewer.is_lead && (
              <Button size="sm" variant="outline" className="h-9" onClick={() => changeStatus("closed")}><ArchiveRestore className="size-4"/> Visszaállítás</Button>
            )}
            {(viewer.can_manage || viewer.role === "editor" || viewer.role === "viewer") && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="size-9" aria-label="További műveletek"><MoreHorizontal className="size-4"/></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  {viewer.can_manage && status !== "archived" && (
                    <DropdownMenuItem onSelect={() => setTransferOpen(true)}><ArrowRightLeft className="size-4"/> Akta átadása</DropdownMenuItem>
                  )}
                  {status === "closed" && viewer.is_lead && (
                    <DropdownMenuItem onSelect={() => changeStatus("archived")}><FolderArchive className="size-4"/> Archiválás</DropdownMenuItem>
                  )}
                  {(viewer.role === "editor" || viewer.role === "viewer") && (
                    <DropdownMenuItem onSelect={leaveCase}><LogOut className="size-4"/> Kilépés az aktából</DropdownMenuItem>
                  )}
                  {viewer.can_manage && (
                    <>
                      <DropdownMenuSeparator/>
                      <DropdownMenuItem variant="destructive" onSelect={trashCase}><Trash2 className="size-4"/> Lomtárba</DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        {status !== "open" && (
          <div className="relative flex items-center gap-2 border-t border-white/5 bg-white/[0.02] px-5 py-2 text-xs text-slate-400">
            <Info className="size-3.5 text-slate-500"/>
            {status === "closed" ? `Lezárva ${formatDate(item.closed_at)}: az akta csak olvasható.` : "Archivált akta: csak olvasható, a listában az Archívum szűrő alatt található."}
          </div>
        )}
      </header>

      {/* --- Body ---------------------------------------------------------------- */}
      {wide ? (
        <div className={cn("grid min-h-0 flex-1 gap-4", rails.left && rails.right ? "grid-cols-[300px_minmax(0,1fr)_380px]"
          : rails.left ? "grid-cols-[300px_minmax(0,1fr)]" : rails.right ? "grid-cols-[minmax(0,1fr)_380px]" : "grid-cols-1")}>
          {rails.left && <aside className="min-h-0 overflow-y-auto pr-1 animate-fade">{leftRail}</aside>}
          <div className="min-h-0 min-w-0" data-tour="case-editor">{editor}</div>
          {rails.right && (
            <aside className="panel animate-fade flex min-h-0 flex-col overflow-hidden p-0" data-tour="case-panel">
              <TabBar tabs={tabs} active={rightTab} onChange={setRightTab}/>
              <div className="min-h-0 flex-1">{tabBody(rightTab)}</div>
            </aside>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="sticky top-14 z-20 -mx-1 overflow-x-auto rounded-xl bg-[#070c18]/90 p-1 ring-1 ring-white/10 backdrop-blur">
            <div className="flex min-w-max gap-1">
              {([{value: "document", label: "Dokumentum", icon: FileText}, {value: "info", label: "Adatok", icon: ShieldAlert}, ...tabs] as
                {value: MobileTab; label: string; icon: typeof FileText; badge?: number; alert?: boolean}[]).map((tab) => (
                <button key={tab.value} type="button" onClick={() => setMobileTab(tab.value)}
                        className={cn("relative flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition",
                          mobileTab === tab.value ? "bg-white/10 text-white" : "text-slate-400")}>
                  <tab.icon className="size-3.5"/>{tab.label}
                  {!!tab.badge && <span className={cn("rounded-md px-1 text-[10px]", tab.alert ? "bg-amber-500/20 text-amber-200" : "bg-white/10")}>{tab.badge}</span>}
                </button>
              ))}
            </div>
          </div>
          <div className={cn("h-[calc(100dvh-14rem)] min-h-[420px]", mobileTab !== "document" && "hidden")} data-tour="case-editor">{editor}</div>
          {mobileTab === "info" && leftRail}
          {mobileTab !== "document" && mobileTab !== "info" && (
            <div className="panel h-[calc(100dvh-14rem)] min-h-[420px] overflow-hidden p-0">{tabBody(mobileTab)}</div>
          )}
        </div>
      )}

      {/* --- Dialogs ------------------------------------------------------------- */}
      <UploadEvidenceDialog open={uploadFiles !== null} onOpenChange={(open) => !open && setUploadFiles(null)} caseId={caseId}
                            initialFiles={uploadFiles ?? []} onUploaded={() => {
        void refreshEvidence();
        announce("evidence");
      }}/>
      <EvidenceViewer items={sortedEvidence} numbers={numbers} activeId={viewing} onActiveChange={setViewing}/>
      <AddSuspectDialog open={!!personDialog} onOpenChange={(open) => !open && setPersonDialog(null)} caseId={caseId}
                        linkedIds={linkedSuspectIds} preselectId={personDialog?.preselect} onLinked={() => {
        void refreshPeople();
        announce("people");
      }}/>
      <AddCollaboratorDialog open={collabOpen} onOpenChange={setCollabOpen} caseId={caseId}
                             existingUserIds={[...detail.collaborators.map((entry) => entry.user_id), ...(item.owner_id ? [item.owner_id] : [])]}
                             onAdded={() => {
                               void refreshMeta();
                               announce("team");
                             }}/>
      <TransferCaseDialog open={transferOpen} onOpenChange={setTransferOpen} caseId={caseId} ownerId={item.owner_id}
                          onTransferred={() => {
                            void refreshMeta();
                            announce("team");
                          }}/>
      <WarrantDialog open={warrantOpen} onOpenChange={setWarrantOpen} caseId={caseId} people={detail.people} warrants={detail.warrants}
                     evidence={detail.evidence} numbers={numbers} onCreated={() => {
        void refreshWarrants();
        setLogKey((key) => key + 1);
      }}/>
      <WarrantActionDialog warrant={warrantAction?.warrant ?? null} action={warrantAction?.action ?? null} onClose={() => setWarrantAction(null)}
                           onDone={(updated) => {
                             setWarrantAction(null);
                             patch((current) => ({...current, warrants: current.warrants.map((entry) => (entry.id === updated.id ? updated : entry))}));
                             setLogKey((key) => key + 1);
                           }}/>
      <WarrantDocument warrant={warrantDoc} onClose={() => setWarrantDoc(null)}/>
      {annotating && (
        <Suspense fallback={null}>
          <ImageAnnotator src={annotating.file_path} name={annotating.file_name} onCancel={() => setAnnotating(null)}
                          onSave={(file) => saveAnnotated(annotating, file)}/>
        </Suspense>
      )}
      <LinkedCaseDialog caseId={linkedCase} onClose={() => setLinkedCase(null)}/>
      <OfficerProfileDialog open={!!officerId} onOpenChange={(open) => !open && setOfficerId(null)} userId={officerId ?? ""} caseId={caseId}/>

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && !confirmBusy && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription asChild><div className="text-sm text-slate-400">{confirm?.description}</div></AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmBusy}>Mégse</AlertDialogCancel>
            <AlertDialogAction disabled={confirmBusy}
                               className={confirm?.destructive ? "bg-red-600 text-white hover:bg-red-500" : "bg-sky-600 text-white hover:bg-sky-500"}
                               onClick={async (event) => {
                                 event.preventDefault();
                                 if (!confirm) return;
                                 setConfirmBusy(true);
                                 try {
                                   await confirm.run();
                                   setConfirm(null);
                                 } catch (error) {
                                   toast.error(errorMessage(error));
                                 } finally {
                                   setConfirmBusy(false);
                                 }
                               }}>
              {confirmBusy && <Loader2 className="size-4 animate-spin"/>}{confirm?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

function TabBar<T extends string>({tabs, active, onChange}: {
  tabs: {value: T; label: string; icon: typeof Paperclip; badge?: number; alert?: boolean}[];
  active: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex shrink-0 gap-0.5 border-b border-white/10 bg-black/10 p-1" role="tablist" data-tour="case-tabs">
      {tabs.map((tab) => (
        <button key={tab.value} type="button" role="tab" aria-selected={active === tab.value} aria-label={tab.label} title={tab.label}
                data-tour={`case-tab-${tab.value}`}
                onClick={() => onChange(tab.value)}
                className={cn("relative flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-medium whitespace-nowrap transition",
                  active === tab.value ? "flex-auto bg-white/10 text-white" : "flex-none text-slate-400 hover:bg-white/5 hover:text-slate-200")}>
          <tab.icon className="size-3.5 shrink-0"/>
          {active === tab.value && <span className="truncate">{tab.label}</span>}
          {!!tab.badge && (
            <span className={cn("rounded-md px-1 text-[10px] tabular-nums", tab.alert ? "bg-amber-500/25 text-amber-200" : "bg-white/10 text-slate-300")}>
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function TitleEditor({title, canEdit, onSave}: {title: string; canEdit: boolean; onSave: (title: string) => Promise<boolean>}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [busy, setBusy] = useState(false);

  if (editing) {
    return (
      <form className="mt-0.5 flex items-center gap-1.5" onSubmit={async (event) => {
        event.preventDefault();
        if (!value.trim() || value.trim() === title) return setEditing(false);
        setBusy(true);
        const ok = await onSave(value.trim());
        setBusy(false);
        if (ok) setEditing(false);
      }}>
        <Input value={value} autoFocus maxLength={160} onChange={(event) => setValue(event.target.value)} className="h-9 text-lg font-semibold"
               onKeyDown={(event) => event.key === "Escape" && setEditing(false)}/>
        <Button type="submit" size="icon" className="size-9 shrink-0 bg-emerald-600 text-white hover:bg-emerald-500" disabled={busy} aria-label="Mentés">
          {busy ? <Loader2 className="size-4 animate-spin"/> : <Check className="size-4"/>}
        </Button>
        <Button type="button" size="icon" variant="ghost" className="size-9 shrink-0" onClick={() => setEditing(false)} aria-label="Mégse">
          <X className="size-4"/>
        </Button>
      </form>
    );
  }
  return (
    <div className="group flex min-w-0 items-center gap-2">
      <h1 className="truncate text-xl font-semibold tracking-tight text-white md:text-2xl" title={title}>{title}</h1>
      {canEdit && (
        <button type="button" onClick={() => {
          setValue(title);
          setEditing(true);
        }} aria-label="Átnevezés" className="rounded-md p-1 text-slate-500 opacity-0 transition group-hover:opacity-100 hover:bg-white/10 hover:text-white focus:opacity-100">
          <Pencil className="size-3.5"/>
        </button>
      )}
    </div>
  );
}

