import {useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type CSSProperties, type Ref} from "react";
import {BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs, type PartialBlock} from "@blocknote/core";
import {BlockNoteView} from "@blocknote/mantine";
import {
  createReactInlineContentSpec, getDefaultReactSlashMenuItems, SuggestionMenuController, useCreateBlockNote,
  type DefaultReactSuggestionItem,
} from "@blocknote/react";
import "@blocknote/mantine/style.css";
import {
  AlertTriangle, BadgeCheck, Check, CloudOff, FileClock, FolderOpen, History, ImagePlus, Loader2, Palette, RotateCcw, Save,
  ScrollText, ShieldAlert,
} from "lucide-react";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger} from "@/components/ui/dropdown-menu";
import {useSuspects} from "@/context/SuspectCacheContext";
import {useProfileDirectory} from "@/lib/profile-directory";
import {toInitialContent} from "@/lib/blocknote-content";
import {uploadToCloudinary} from "@/lib/cloudinary";
import {uploadInlineImages} from "@/lib/inline-images";
import {hu} from "@/lib/blocknote-hu";
import {formatAgo, formatDateTime, formatTime} from "@/lib/datetime";
import {documentReferences, mcbApi, type CaseListItem} from "@/lib/mcb";
import {cn, errorMessage} from "@/lib/utils";
import type {CaseEvidence} from "@/types/supabase";
import {DOCUMENT_SNIPPETS} from "../case-templates";
import {CaseEditorProvider, useCaseEditorContext, type MentionRole} from "./CaseEditorContext";
import {EvidenceBlock} from "./EvidenceBlock";

// --- Schema (stored format: never rename types or props) -------------------------

function MentionChip({role, label}: {role: string; label: string; id: string}) {
  const Icon = role === "suspect" ? ShieldAlert : role === "case" ? FolderOpen : BadgeCheck;
  return (
    <>
      <Icon className="size-3 shrink-0"/>
      {label}
    </>
  );
}

const Mention = createReactInlineContentSpec({
  type: "mention",
  propSchema: {
    user: {default: "Unknown"},
    id: {default: ""},
    role: {default: "officer"},
  },
  content: "none",
}, {
  render: function MentionView(props) {
    const {onMention} = useCaseEditorContext();
    const {role, id, user} = props.inlineContent.props;
    return (
      <span
        role="button"
        tabIndex={-1}
        className={cn("mention-chip", role === "suspect" ? "mention-suspect" : role === "case" ? "mention-case" : "mention-officer")}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (id) onMention((role === "suspect" || role === "case" ? role : "officer") as MentionRole, id);
        }}
      >
        <MentionChip role={role} label={user} id={id}/>
      </span>
    );
  },
});

// BlockNote replaces (does not merge) the default inline content when custom specs are
// given, so text and links must be listed explicitly next to the mention.
const schema = BlockNoteSchema.create({
  blockSpecs: {...defaultBlockSpecs, evidence: EvidenceBlock()},
  inlineContentSpecs: {...defaultInlineContentSpecs, mention: Mention},
});
type CaseBlock = PartialBlock<typeof schema.blockSchema, typeof schema.inlineContentSchema, typeof schema.styleSchema>;

/** Default slash items the case documents do not need (media live under Bizonyítékok). */
const HIDDEN_SLASH_ITEMS = new Set(["video", "audio", "file", "code_block", "emoji", "heading_4", "heading_5", "heading_6"]);

const fold = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function filterItems<T extends {title: string; aliases?: string[]; subtext?: string}>(items: T[], query: string, limit = 40): T[] {
  const term = fold(query.trim());
  if (!term) return items.slice(0, limit);
  return items.filter((item) => [item.title, item.subtext ?? "", ...(item.aliases ?? [])].some((value) => fold(value).includes(term)))
    .slice(0, limit);
}

// --- Themes -------------------------------------------------------------------------

export const CASE_THEMES: Record<string, {label: string; hint: string; light: boolean; swatch: string; surface: string;
  vars: Record<string, string>}> = {
  default: {label: "Modern", hint: "Sötét, a felület színeivel", light: false, swatch: "bg-gradient-to-br from-slate-700 to-slate-950",
    surface: "case-surface-default", vars: {}},
  paper: {label: "Papír akta", hint: "Klasszikus, sárgás papír", light: true, swatch: "bg-[#efe6d2]",
    surface: "case-surface-paper", vars: {"--bn-colors-editor-background": "#f5f0e6", "--bn-colors-editor-text": "#3d342b"}},
  classic: {label: "Hivatalos dokumentum", hint: "Fehér lap, középen", light: true, swatch: "bg-white",
    surface: "case-surface-classic", vars: {"--bn-colors-editor-background": "#ffffff", "--bn-colors-editor-text": "#0f172a"}},
  blue: {label: "Rendőrségi kék", hint: "Sötétkék, világos betűk", light: false, swatch: "bg-[#13233f]",
    surface: "case-surface-blue", vars: {"--bn-colors-editor-background": "#0f172a", "--bn-colors-editor-text": "#bfdbfe"}},
  terminal: {label: "Terminál", hint: "Fekete alap, zöld szöveg", light: false, swatch: "bg-black",
    surface: "case-surface-terminal", vars: {"--bn-colors-editor-background": "#0c0c0c", "--bn-colors-editor-text": "#00ff00"}},
  amber: {label: "Retro CRT", hint: "Borostyán monitor", light: false, swatch: "bg-[#2e2000]",
    surface: "case-surface-amber", vars: {"--bn-colors-editor-background": "#1a1200", "--bn-colors-editor-text": "#ffb000"}},
};
export const caseTheme = (theme: string | null | undefined) => CASE_THEMES[theme ?? "default"] ?? CASE_THEMES.default;

// --- Drafts -------------------------------------------------------------------------

interface Draft {
  version: number;
  at: string;
  document: unknown;
}

const draftKey = (caseId: string) => `frakhub.case.draft.${caseId}`;

function readDraft(caseId: string): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(caseId));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

function writeDraft(caseId: string, draft: Draft) {
  try {
    localStorage.setItem(draftKey(caseId), JSON.stringify(draft));
  } catch {
    // Full storage (e.g. large pasted images): the draft is a convenience only.
  }
}

const clearDraft = (caseId: string) => localStorage.removeItem(draftKey(caseId));

// --- Editor -------------------------------------------------------------------------

export type SaveState = "clean" | "dirty" | "saving" | "saved" | "conflict" | "error";

export interface CaseEditorHandle {
  save: () => Promise<boolean>;
  insertEvidence: (evidenceId: string) => void;
  isDirty: () => boolean;
}

interface CaseEditorProps {
  caseId: string;
  content: unknown;
  version: number;
  updatedAt: string;
  updatedByName: string | null;
  readOnly: boolean;
  theme: string;
  canChangeTheme: boolean;
  onThemeChange: (theme: string) => void;
  evidence: CaseEvidence[];
  numbers: Map<string, number>;
  onOpenEvidence: (evidenceId: string) => void;
  onMention: (role: MentionRole, id: string) => void;
  /** Someone else saved (broadcast); newer than `version` means this copy is outdated. */
  remote: {version: number; by: string} | null;
  /** Reload the document from the server (remounts the editor). */
  onReload: () => void;
  onSaved: (version: number, updatedAt: string) => void;
  onDirtyChange: (dirty: boolean) => void;
  /** The current document (debounced), for the references panel. */
  onDocument: (document: unknown) => void;
  ref?: Ref<CaseEditorHandle>;
}

const AUTOSAVE_MS = 20_000;

export function CaseEditor({
  caseId, content, version, updatedAt, updatedByName, readOnly, theme, canChangeTheme, onThemeChange, evidence, numbers,
  onOpenEvidence, onMention, remote, onReload, onSaved, onDirtyChange, onDocument, ref,
}: CaseEditorProps) {
  const {suspects} = useSuspects();
  const {profiles: officers} = useProfileDirectory();
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [state, setState] = useState<SaveState>("clean");
  const [savedAt, setSavedAt] = useState<string>(updatedAt);
  const [conflict, setConflict] = useState<{version: number; by: string | null; at?: string} | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [words, setWords] = useState(() => documentReferences(content).words);
  const [shownVersion, setShownVersion] = useState(version);
  const versionRef = useRef(version);
  const dirtyRef = useRef(false);
  const savingRef = useRef<Promise<boolean> | null>(null);
  const autosaveRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const look = caseTheme(theme);

  const initial = useMemo(() => toInitialContent<never>(content), [content]);
  const editor = useCreateBlockNote({
    schema,
    initialContent: initial,
    dictionary: hu,
    // Pasted or dropped images go to Cloudinary instead of into the case JSON.
    uploadFile: (file: File) => uploadToCloudinary(file, "evidence"),
  });

  // Case links for the @ menu (shared, cached list; editors only).
  useEffect(() => {
    if (readOnly) return;
    let active = true;
    mcbApi.list().then((list) => {
      if (active) setCases(list.filter((item) => item.id !== caseId));
    }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [caseId, readOnly]);

  // A draft from an earlier visit that never reached the server.
  useEffect(() => {
    if (readOnly) return;
    const stored = readDraft(caseId);
    if (stored && JSON.stringify(stored.document) !== JSON.stringify(content ?? [])) setDraft(stored);
    else if (stored) clearDraft(caseId);
  }, [caseId, content, readOnly]);

  const setDirty = useCallback((dirty: boolean) => {
    if (dirtyRef.current === dirty) return;
    dirtyRef.current = dirty;
    onDirtyChange(dirty);
  }, [onDirtyChange]);

  const save = useCallback(async (force = false): Promise<boolean> => {
    if (readOnly) return false;
    if (savingRef.current) return savingRef.current;
    if (!dirtyRef.current && !force) return true;
    clearTimeout(autosaveRef.current);
    const run = (async () => {
      setState("saving");
      try {
        // Images embedded by pasting (data: URLs) are uploaded first, so the case stays small.
        const {content: body, uploaded} = await uploadInlineImages(editor.document, "evidence");
        if (uploaded > 0) editor.replaceBlocks(editor.document, body as CaseBlock[]);
        const result = await mcbApi.saveDocument(caseId, body, force && conflict ? conflict.version : versionRef.current);
        if (!result.ok) {
          setConflict({version: result.version, by: result.updated_by_name, at: result.updated_at});
          setState("conflict");
          return false;
        }
        versionRef.current = result.version;
        setShownVersion(result.version);
        setConflict(null);
        setSavedAt(result.updated_at);
        setState("saved");
        setDirty(false);
        clearDraft(caseId);
        setDraft(null);
        mcbApi.invalidateList();
        onSaved(result.version, result.updated_at);
        return true;
      } catch (error) {
        setState("error");
        toast.error("A dokumentum mentése nem sikerült.", {description: errorMessage(error)});
        return false;
      }
    })();
    savingRef.current = run;
    try {
      return await run;
    } finally {
      savingRef.current = null;
    }
  }, [caseId, conflict, editor, onSaved, readOnly, setDirty]);

  // Change tracking: dirty flag, local draft (1 s) and autosave after a quiet period.
  useEffect(() => {
    return editor.onChange(() => {
      if (readOnly) return;
      setDirty(true);
      setState((current) => (current === "conflict" ? current : "dirty"));
      clearTimeout(draftTimerRef.current);
      draftTimerRef.current = setTimeout(() => {
        writeDraft(caseId, {version: versionRef.current, at: new Date().toISOString(), document: editor.document});
        setWords(documentReferences(editor.document).words);
        onDocument(editor.document);
      }, 1000);
      clearTimeout(autosaveRef.current);
      autosaveRef.current = setTimeout(() => {
        if (navigator.onLine) void save();
      }, AUTOSAVE_MS);
    });
  }, [caseId, editor, onDocument, readOnly, save, setDirty]);

  useEffect(() => () => {
    clearTimeout(autosaveRef.current);
    clearTimeout(draftTimerRef.current);
  }, []);

  // Ctrl+S saves; leaving the tab saves; closing the page with changes asks first.
  useEffect(() => {
    if (readOnly) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };
    const onHide = () => {
      if (document.visibilityState === "hidden" && dirtyRef.current && navigator.onLine) void save();
    };
    const onUnload = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current) event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [readOnly, save]);

  // Another editor saved: reload a clean copy at once, warn before a save would conflict.
  useEffect(() => {
    if (!remote || remote.version <= versionRef.current) return;
    if (dirtyRef.current) {
      setConflict({version: remote.version, by: remote.by});
      setState("conflict");
    } else {
      onReload();
    }
  }, [remote, onReload]);

  useImperativeHandle(ref, () => ({
    save: () => save(),
    isDirty: () => dirtyRef.current,
    insertEvidence: (evidenceId: string) => {
      if (readOnly) return;
      const position = editor.getTextCursorPosition().block;
      editor.insertBlocks([{type: "evidence", props: {evidenceId, layout: "side", width: "full"}}], position, "after");
      toast.success("Bizonyíték beillesztve a dokumentumba.");
    },
  }), [editor, readOnly, save]);

  const restoreDraft = () => {
    if (!draft) return;
    editor.replaceBlocks(editor.document, (Array.isArray(draft.document) ? draft.document : []) as CaseBlock[]);
    setDraft(null);
    toast.success("Piszkozat visszaállítva. Mentsd, ha meg szeretnéd tartani.");
  };

  const slashItems = useCallback((): DefaultReactSuggestionItem[] => [
    {
      title: "Bizonyíték",
      subtext: "Feltöltött fájl beillesztése az aktából",
      aliases: ["bizonyitek", "evidence", "kep", "foto", "fajl"],
      group: "Nyomozás",
      icon: <ImagePlus size={18}/>,
      onItemClick: () => editor.insertBlocks([{type: "evidence", props: {evidenceId: ""}}], editor.getTextCursorPosition().block, "after"),
    },
    ...DOCUMENT_SNIPPETS.map<DefaultReactSuggestionItem>((snippet) => ({
      title: snippet.title,
      subtext: snippet.subtext,
      aliases: snippet.aliases,
      group: "Nyomozás",
      icon: <ScrollText size={18}/>,
      onItemClick: () => editor.insertBlocks(snippet.blocks() as CaseBlock[], editor.getTextCursorPosition().block, "after"),
    })),
    ...getDefaultReactSlashMenuItems(editor).filter((item) => !HIDDEN_SLASH_ITEMS.has((item as {key?: string}).key ?? "")),
  ], [editor]);

  const mentionItems = useCallback((): DefaultReactSuggestionItem[] => {
    const insert = (props: {user: string; id: string; role: MentionRole}) => () => {
      editor.focus();
      editor.insertInlineContent([{type: "mention", props}, " "]);
    };
    return [
      ...officers.filter((officer) => officer.system_role !== "pending").map<DefaultReactSuggestionItem>((officer) => ({
        title: `${officer.full_name} (${officer.badge_number})`,
        subtext: officer.division === "MCB" && officer.division_rank ? `${officer.faction_rank} · ${officer.division_rank}` : officer.faction_rank,
        aliases: [officer.full_name, officer.badge_number],
        group: "Állomány",
        icon: <BadgeCheck size={18} className="text-sky-400"/>,
        onItemClick: insert({user: `${officer.badge_number} ${officer.full_name}`, id: officer.id, role: "officer"}),
      })),
      ...suspects.map<DefaultReactSuggestionItem>((suspect) => ({
        title: suspect.full_name,
        subtext: [suspect.alias && `„${suspect.alias}”`, suspect.gang_affiliation].filter(Boolean).join(" · ") || "Nyilvántartott személy",
        aliases: [suspect.alias ?? "", suspect.gang_affiliation ?? ""],
        group: "Nyilvántartás",
        icon: <ShieldAlert size={18} className="text-orange-400"/>,
        onItemClick: insert({user: suspect.full_name, id: suspect.id, role: "suspect"}),
      })),
      ...cases.map<DefaultReactSuggestionItem>((item) => ({
        title: `${item.case_number} · ${item.title}`,
        subtext: item.owner_name ? `Vezető: ${item.owner_name}` : "Akta",
        aliases: [item.case_number, item.title],
        group: "Akták",
        icon: <FolderOpen size={18} className="text-emerald-400"/>,
        onItemClick: insert({user: `AKTA ${item.case_number}`, id: item.id, role: "case"}),
      })),
    ];
  }, [cases, editor, officers, suspects]);

  return (
    <CaseEditorProvider evidenceList={evidence} numbers={numbers} readOnly={readOnly} light={look.light}
                        onOpenEvidence={onOpenEvidence} onMention={onMention}>
      <section className={cn("case-document panel relative flex h-full min-h-0 flex-col overflow-hidden p-0", look.surface)}>
        <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 bg-[#070c18]/70 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <ScrollText className="size-4 shrink-0 text-amber-300"/>
            <p className="truncate text-sm font-semibold text-white">Nyomozati dokumentum</p>
            <span className="hidden text-xs text-slate-500 sm:inline">· {words.toLocaleString("hu-HU")} szó{shownVersion > 0 ? ` · ${shownVersion}. mentés` : ""}</span>
          </div>
          <div className="ml-auto flex items-center gap-1.5" data-tour="case-save">
            <SaveIndicator state={state} savedAt={savedAt} updatedByName={updatedByName} readOnly={readOnly}/>
            {canChangeTheme && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-slate-300" title="A dokumentum megjelenése">
                    <Palette className="size-3.5"/><span className="hidden md:inline">{look.label}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>A dokumentum megjelenése</DropdownMenuLabel>
                  {Object.entries(CASE_THEMES).map(([key, option]) => (
                    <DropdownMenuItem key={key} onSelect={() => onThemeChange(key)} className="gap-3 py-2">
                      <span className={cn("size-7 shrink-0 rounded-md ring-1 ring-white/15", option.swatch)}/>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-slate-100">{option.label}</span>
                        <span className="block text-[11px] text-slate-500">{option.hint}</span>
                      </span>
                      {key === (theme || "default") && <Check className="size-4 text-amber-300"/>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {!readOnly && (
              <Button size="sm" onClick={() => void save()} disabled={state === "saving" || (state !== "dirty" && state !== "error")}
                      className={cn("h-8 gap-1.5", state === "dirty" || state === "error" || state === "saving"
                        ? "bg-amber-500 text-black hover:bg-amber-400" : "bg-white/5 text-slate-400 disabled:opacity-100")} title="Mentés (Ctrl+S)">
                {state === "saving" ? <Loader2 className="size-3.5 animate-spin"/> : <Save className="size-3.5"/>} Mentés
              </Button>
            )}
          </div>
        </header>

        {draft && !readOnly && (
          <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-amber-500/20 bg-amber-500/[0.07] px-4 py-2.5 text-sm text-amber-100">
            <FileClock className="size-4 shrink-0 text-amber-300"/>
            <p className="min-w-0 flex-1">
              Mentetlen piszkozatod van ebből az aktából ({formatDateTime(draft.at)}).
              {draft.version < version && " Azóta valaki más is mentett: a visszaállítás felülírja az ő változásait."}
            </p>
            <Button size="sm" variant="ghost" className="h-8 text-amber-100 hover:bg-amber-500/15" onClick={() => {
              clearDraft(caseId);
              setDraft(null);
            }}>Elvetés</Button>
            <Button size="sm" className="h-8 bg-amber-500 text-black hover:bg-amber-400" onClick={restoreDraft}>
              <RotateCcw className="size-3.5"/> Visszaállítás
            </Button>
          </div>
        )}

        {conflict && !readOnly && (
          <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-red-500/25 bg-red-500/[0.08] px-4 py-2.5 text-sm text-red-100">
            <AlertTriangle className="size-4 shrink-0 text-red-300"/>
            <p className="min-w-0 flex-1">
              <strong>{conflict.by ?? "Egy másik szerkesztő"}</strong> közben mentett az aktába
              {conflict.at ? ` (${formatAgo(conflict.at)})` : ""}. A te módosításaid még nincsenek mentve.
            </p>
            <Button size="sm" variant="ghost" className="h-8 text-red-100 hover:bg-red-500/15" onClick={() => {
              writeDraft(caseId, {version: versionRef.current, at: new Date().toISOString(), document: editor.document});
              setDirty(false);
              onReload();
            }}>
              <History className="size-3.5"/> Az ő verziója
            </Button>
            <Button size="sm" className="h-8 bg-red-500 text-white hover:bg-red-400" onClick={() => void save(true)}>
              Felülírom a sajátommal
            </Button>
          </div>
        )}

        <div className="case-scroll relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
             style={{...look.vars, wordBreak: "break-word", overflowWrap: "anywhere"} as CSSProperties}>
          {theme === "default" && <div aria-hidden className="tex-grid pointer-events-none absolute inset-0 opacity-[0.25]"/>}
          <div className={cn("case-page relative z-10", theme === "classic" ? "mx-auto my-6 max-w-[820px] bg-white shadow-xl ring-1 ring-slate-200" : "",
            "px-2 py-5 sm:px-4 md:py-8 2xl:px-8")}>
            <BlockNoteView editor={editor} editable={!readOnly} theme={look.light ? "light" : "dark"} slashMenu={false}
                           className="min-h-[480px] w-full">
              <SuggestionMenuController triggerCharacter="/" getItems={async (query) => filterItems(slashItems(), query)}/>
              <SuggestionMenuController triggerCharacter="@" getItems={async (query) => filterItems(mentionItems(), query)}/>
            </BlockNoteView>
          </div>
        </div>
      </section>
    </CaseEditorProvider>
  );
}

function SaveIndicator({state, savedAt, updatedByName, readOnly}: {state: SaveState; savedAt: string; updatedByName: string | null;
  readOnly: boolean}) {
  if (readOnly) {
    return <span className="hidden items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-400 ring-1 ring-white/10 sm:inline-flex">
      Csak olvasható · {formatDateTime(savedAt)}
    </span>;
  }
  const looks: Record<SaveState, {text: string; className: string; icon: typeof Check}> = {
    clean: {text: updatedByName ? `Utoljára: ${updatedByName}, ${formatAgo(savedAt)}` : `Mentve ${formatAgo(savedAt)}`,
      className: "text-slate-400 ring-white/10", icon: Check},
    saved: {text: `Mentve ${formatTime(savedAt)}`, className: "text-emerald-300 ring-emerald-500/30", icon: Check},
    dirty: {text: "Mentetlen módosítások", className: "text-amber-300 ring-amber-500/30", icon: Save},
    saving: {text: "Mentés…", className: "text-sky-300 ring-sky-500/30", icon: Loader2},
    conflict: {text: "Ütközés", className: "text-red-300 ring-red-500/40", icon: AlertTriangle},
    error: {text: "Mentés sikertelen", className: "text-red-300 ring-red-500/40", icon: CloudOff},
  };
  const look = looks[state];
  return (
    <span className={cn("hidden max-w-[260px] items-center gap-1.5 truncate rounded-full bg-white/[0.04] px-2.5 py-1 text-[11px] ring-1 sm:inline-flex",
      look.className)}>
      <look.icon className={cn("size-3 shrink-0", state === "saving" && "animate-spin")}/>
      <span className="truncate">{look.text}</span>
    </span>
  );
}

/** Read-only, light rendering of a case document (print view): same schema, no editing chrome. */
export function CaseDocumentReader({content, evidence, numbers}: {content: unknown; evidence: CaseEvidence[]; numbers: Map<string, number>}) {
  const initial = useMemo(() => toInitialContent<never>(content), [content]);
  const editor = useCreateBlockNote({schema, initialContent: initial, dictionary: hu});
  return (
    <CaseEditorProvider evidenceList={evidence} numbers={numbers} readOnly light onOpenEvidence={() => undefined} onMention={() => undefined}>
      <div className="print-light case-surface-classic">
        <BlockNoteView editor={editor} editable={false} theme="light" slashMenu={false} formattingToolbar={false} sideMenu={false}/>
      </div>
    </CaseEditorProvider>
  );
}
