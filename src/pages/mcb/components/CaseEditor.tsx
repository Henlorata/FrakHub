import {useEffect, useState, useMemo, useRef, useCallback} from "react";
import {BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs} from "@blocknote/core";
import {BlockNoteView} from "@blocknote/mantine";
import {useCreateBlockNote} from "@blocknote/react";
import {SuggestionMenuController, getDefaultReactSlashMenuItems} from "@blocknote/react";
import {createReactInlineContentSpec} from "@blocknote/react";
import "@blocknote/mantine/style.css";
import {useAuth} from "@/context/AuthContext";
import {toast} from "sonner";
import {Save, Loader2, ImagePlus, ShieldAlert, Badge as BadgeIcon, FolderOpen} from "lucide-react";
import {Button} from "@/components/ui/button";
import type {CaseEvidence} from "@/types/supabase";
import {CaseEditorProvider} from "./CaseEditorContext";
import {EvidenceBlock} from "./EvidenceBlock";
import {cn} from "@/lib/utils";
import {useSuspects} from "@/context/SuspectCacheContext";
import {useProfileDirectory} from "@/lib/profile-directory";
import {toInitialContent} from "@/lib/blocknote-content";

interface CaseEditorProps {
  caseId: string;
  initialContent: unknown;
  readOnly?: boolean;
  evidenceList: CaseEvidence[];
  theme?: string;
}

const Mention = createReactInlineContentSpec({
  type: "mention",
  propSchema: {
    user: {default: "Unknown"},
    id: {default: ""},
    role: {default: "officer"}
  },
  content: "none",
}, {
  render: (props) => {
    const role = props.inlineContent.props.role;
    let icon = <BadgeIcon className="w-3 h-3"/>;
    let style = "bg-[#1e3a8a] text-blue-200 border-blue-500/50 hover:bg-blue-600 hover:text-white";

    if (role === 'suspect') {
      icon = <ShieldAlert className="w-3 h-3"/>;
      style = "bg-[#7c2d12] text-orange-200 border-orange-500/50 hover:bg-orange-600 hover:text-white";
    } else if (role === 'case') {
      icon = <FolderOpen className="w-3 h-3"/>;
      style = "bg-emerald-950 text-emerald-300 border-emerald-500/40 hover:bg-emerald-600 hover:text-white";
    }

    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wide select-none mx-0.5 align-middle border transition-all cursor-pointer shadow-sm relative top-[-1px]",
          style
        )}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          let eventName = 'FRAKHUB_V2_OPEN_OFFICER';
          if (role === 'suspect') eventName = 'FRAKHUB_V2_OPEN_SUSPECT';
          if (role === 'case') eventName = 'FRAKHUB_V2_OPEN_CASE';

          window.dispatchEvent(new CustomEvent(eventName, {detail: {id: props.inlineContent.props.id}}));
        }}
      >
        {icon}
        {props.inlineContent.props.user}
      </span>
    );
  }
});

/** Officer ids mentioned anywhere in a BlockNote document (nested blocks and tables included). */
function collectOfficerMentions(node: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(node)) {
    node.forEach((child) => collectOfficerMentions(child, found));
  } else if (node && typeof node === "object") {
    const record = node as {type?: unknown; props?: {role?: unknown; id?: unknown}};
    if (record.type === "mention" && record.props?.role === "officer" && typeof record.props.id === "string" && record.props.id) {
      found.add(record.props.id);
    }
    Object.values(node).forEach((value) => collectOfficerMentions(value, found));
  }
  return found;
}

// BlockNote replaces (does not merge) the default inline content when custom specs are
// given, so text and links must be listed explicitly next to the mention.
const schema = BlockNoteSchema.create({
  blockSpecs: {...defaultBlockSpecs, evidence: EvidenceBlock()},
  inlineContentSpecs: {...defaultInlineContentSpecs, mention: Mention}
});

interface CaseReference {
  id: string;
  case_number: number | string;
  title: string;
}

export function CaseEditor({
                             caseId,
                             initialContent,
                             readOnly = false,
                             evidenceList,
                             theme = 'default'
                           }: CaseEditorProps) {
  const {supabase, user} = useAuth();
  const {suspects} = useSuspects();
  // Shared, cached member list (no fresh profiles query per opened case).
  const {profiles: officers} = useProfileDirectory();
  const [availableCases, setAvailableCases] = useState<CaseReference[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const hasChangesRef = useRef(false);

  useEffect(() => {
    if (readOnly) return;
    let active = true;
    supabase.from('cases')
      .select('id, case_number, title')
      .neq('id', caseId)
      .order('updated_at', {ascending: false})
      .limit(50)
      .then(({data}) => {
        if (active && data) setAvailableCases(data as CaseReference[]);
      });
    return () => {
      active = false;
    };
  }, [caseId, readOnly, supabase]);

  // Warn before leaving the page with unsaved investigation notes.
  useEffect(() => {
    if (!hasChanges) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasChanges]);

  const safeContent = useMemo(() => toInitialContent<never>(initialContent), [initialContent]);
  // Officers already mentioned in the saved version: only new mentions are notified.
  const notifiedMentionsRef = useRef<Set<string> | null>(null);

  const editor = useCreateBlockNote({initialContent: safeContent, schema: schema});

  const getCustomSlashMenuItems = useCallback((editor: any) => [
    {
      title: "Bizonyíték Csatolása",
      onItemClick: () => {
        editor.insertBlocks([{
          type: "evidence",
          props: {evidenceId: ""}
        }], editor.getTextCursorPosition().block, "after");
      },
      aliases: ["evidence", "kép", "bizonyíték", "fotó"],
      group: "Média",
      icon: <ImagePlus size={18}/>,
      subtext: "Feltöltött bizonyíték beillesztése."
    },
    ...getDefaultReactSlashMenuItems(editor),
  ], []);

  const getMentionMenuItems = useCallback((editor: any) => {
    const items: any[] = [];
    const usedIds = new Set();

    officers.forEach(officer => {
      if (officer.system_role === 'pending' || usedIds.has(officer.id)) return;
      usedIds.add(officer.id);

      items.push({
        title: `${officer.full_name} (${officer.badge_number})`,
        onItemClick: () => {
          editor.focus();
          editor.insertInlineContent([
            {
              type: "mention",
              props: {
                user: `${officer.badge_number} ${officer.full_name}`,
                id: officer.id,
                role: "officer"
              }
            },
            " "
          ]);
        },
        aliases: [officer.full_name, officer.badge_number],
        group: "Rendvédelem",
        icon: <BadgeIcon size={18} className="text-blue-400"/>,
        subtext: officer.faction_rank
      });
    });

    suspects.forEach(suspect => {
      if (usedIds.has(suspect.id)) return;
      usedIds.add(suspect.id);

      items.push({
        title: suspect.full_name,
        onItemClick: () => {
          editor.focus();
          editor.insertInlineContent([
            {
              type: "mention",
              props: {
                user: suspect.full_name,
                id: suspect.id,
                role: "suspect"
              }
            },
            " "
          ]);
        },
        aliases: [suspect.alias || ""],
        group: "Gyanúsítottak",
        icon: <ShieldAlert size={18} className="text-orange-400"/>,
        subtext: suspect.alias || "Gyanúsított"
      });
    });

    availableCases.forEach(c => {
      if (usedIds.has(c.id)) return;
      usedIds.add(c.id);

      items.push({
        title: `Akta #${c.case_number}: ${c.title}`,
        onItemClick: () => {
          editor.focus();
          editor.insertInlineContent([
            {
              type: "mention",
              props: {
                user: `CASE #${c.case_number}`,
                id: c.id,
                role: "case"
              }
            },
            " "
          ]);
        },
        aliases: [c.case_number.toString(), c.title],
        group: "Kapcsolódó Akták",
        icon: <FolderOpen size={18} className="text-emerald-400"/>,
        subtext: "Kattints a hivatkozáshoz"
      });
    });

    return items;
  }, [officers, suspects, availableCases]);

  useEffect(() => {
    const unsubscribe = editor.onChange(() => {
      if (!hasChangesRef.current) {
        hasChangesRef.current = true;
        setHasChanges(true);
      }
    });
    return unsubscribe;
  }, [editor]);

  const handleSave = async () => {
    if (!hasChanges) return;
    setIsSaving(true);
    const content = editor.document;
    try {
      const {error} = await supabase.from('cases').update({
        body: content,
        updated_at: new Date().toISOString()
      }).eq('id', caseId);
      if (error) throw error;
      toast.success("Mentve.");

      // Tell newly @mentioned officers (once per mention, never the author).
      const mentioned = collectOfficerMentions(content);
      const previous = notifiedMentionsRef.current ?? collectOfficerMentions(safeContent);
      const fresh = [...mentioned].filter((id) => !previous.has(id) && id !== user?.id);
      notifiedMentionsRef.current = mentioned;
      if (fresh.length > 0) {
        void supabase.rpc('notify_case_mentions', {_case_id: caseId, _user_ids: fresh}).then(({error: notifyError}) => {
          if (notifyError) console.error('Említés értesítése sikertelen:', notifyError);
        });
      }
      setHasChanges(false);
      hasChangesRef.current = false;
    } catch {
      toast.error("Hiba a mentés során.");
    } finally {
      setIsSaving(false);
    }
  };

  const getThemeAttributes = () => {
    const baseClasses = "min-h-full font-mono";
    switch (theme) {
      case 'paper':
        return {
          className: `${baseClasses} bg-[#f5f0e6] text-[#3d342b] font-serif`,
          editorTheme: "light" as const,
          cssVars: {"--bn-colors-editor-background": "#f5f0e6", "--bn-colors-editor-text": "#3d342b"}
        };
      case 'terminal':
        return {
          className: `${baseClasses} bg-[#0c0c0c] text-[#00ff00] selection:bg-green-900 selection:text-white`,
          editorTheme: "dark" as const,
          cssVars: {"--bn-colors-editor-background": "#0c0c0c", "--bn-colors-editor-text": "#00ff00"}
        };
      case 'amber':
        return {
          className: `${baseClasses} bg-[#1a1200] text-[#ffb000] selection:bg-orange-900 selection:text-white`,
          editorTheme: "dark" as const,
          cssVars: {"--bn-colors-editor-background": "#1a1200", "--bn-colors-editor-text": "#ffb000"}
        };
      case 'blue':
        return {
          className: `${baseClasses} bg-[#0f172a] text-[#bfdbfe] font-sans selection:bg-blue-900 selection:text-white`,
          editorTheme: "dark" as const,
          cssVars: {"--bn-colors-editor-background": "#0f172a", "--bn-colors-editor-text": "#bfdbfe"}
        };
      case 'classic':
        return {
          className: `${baseClasses} bg-white text-slate-900 font-sans border-x border-slate-200 shadow-sm max-w-[800px] mx-auto my-4`,
          editorTheme: "light" as const,
          cssVars: {"--bn-colors-editor-background": "#ffffff", "--bn-colors-editor-text": "#0f172a"}
        };
      default:
        return {className: `${baseClasses} bg-[#0b1221] text-slate-200`, editorTheme: "dark" as const, cssVars: {}};
    }
  };

  const themeConfig = getThemeAttributes();

  const filterMenu = useCallback((items: any[], query: string) => {
    return items.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()) || (item.aliases && item.aliases.some((a: string) => a.toLowerCase().includes(query.toLowerCase()))));
  }, []);

  return (
    <CaseEditorProvider evidenceList={evidenceList} readOnly={readOnly}>
      <style>{`
        .bn-block-content[data-content-type="table"] { overflow-x: auto !important; width: 100% !important; display: block !important; padding-bottom: 12px; padding-right: 2px; }
        .bn-block-content[data-content-type="table"] table { width: max-content !important; min-width: 100% !important; }
      `}</style>

      <div
        className={cn("flex flex-col h-full relative group transition-colors duration-300 w-full overflow-hidden", themeConfig.className)}
        style={{...themeConfig.cssVars as React.CSSProperties, wordBreak: 'break-word', overflowWrap: 'anywhere'}}>
        {theme === 'default' && (
          <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-0" style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }}></div>
        )}

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 md:p-12 custom-scrollbar relative z-10 w-full">
          <BlockNoteView editor={editor} editable={!readOnly} theme={themeConfig.editorTheme} slashMenu={false}
                         className="min-h-[500px] w-full">
            <SuggestionMenuController triggerCharacter={"/"}
                                      getItems={async (query) => filterMenu(getCustomSlashMenuItems(editor), query)}/>
            <SuggestionMenuController triggerCharacter={"@"}
                                      getItems={async (query) => filterMenu(getMentionMenuItems(editor), query)}/>
          </BlockNoteView>
        </div>

        {!readOnly && hasChanges && (
          <div className="absolute bottom-6 right-6 animate-in fade-in slide-in-from-bottom-4 z-50">
            <Button onClick={handleSave} disabled={isSaving}
                    className="bg-[#c5a065] hover:bg-[#b08d55] text-black font-bold shadow-[0_0_20px_rgba(197,160,101,0.3)] transition-all hover:scale-105 border border-[#8a6d3b]">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Save className="w-4 h-4 mr-2"/>}
              VÁLTOZÁSOK MENTÉSE
            </Button>
          </div>
        )}
      </div>
    </CaseEditorProvider>
  );
}