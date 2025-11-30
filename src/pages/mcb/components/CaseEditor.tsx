import {useEffect, useState, useMemo} from "react";
import {type PartialBlock, BlockNoteSchema, defaultBlockSpecs} from "@blocknote/core";
import {BlockNoteView} from "@blocknote/mantine";
import {useCreateBlockNote} from "@blocknote/react";
import {SuggestionMenuController, getDefaultReactSlashMenuItems} from "@blocknote/react";
import "@blocknote/mantine/style.css";
import {useAuth} from "@/context/AuthContext";
import {toast} from "sonner";
import {Save, Loader2, ImagePlus} from "lucide-react";
import {Button} from "@/components/ui/button";
import type {CaseEvidence} from "@/types/supabase";
import {CaseEditorProvider} from "./CaseEditorContext";
import {EvidenceBlock} from "./EvidenceBlock";

interface CaseEditorProps {
  caseId: string;
  initialContent: any;
  readOnly?: boolean;
  evidenceList: CaseEvidence[];
}

const filterItems = (items: any[], query: string) => {
  return items.filter((item: any) =>
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    (item.aliases && item.aliases.some((alias: string) => alias.toLowerCase().includes(query.toLowerCase())))
  );
};

const schema = BlockNoteSchema.create({blockSpecs: {...defaultBlockSpecs, evidence: EvidenceBlock()}});

export function CaseEditor({caseId, initialContent, readOnly = false, evidenceList}: CaseEditorProps) {
  const {supabase} = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const safeContent = useMemo(() => {
    if (Array.isArray(initialContent) && initialContent.length > 0) return initialContent as PartialBlock[];
    return undefined;
  }, [initialContent]);

  const editor = useCreateBlockNote({initialContent: safeContent, schema: schema});

  const getCustomSlashMenuItems = (editor: any) => [
    ...getDefaultReactSlashMenuItems(editor),
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
      subtext: "Feltöltött bizonyíték beillesztése a szövegbe."
    }
  ];

  useEffect(() => {
    const unsubscribe = editor.onChange(() => {
      setHasChanges(true);
    });
    return unsubscribe;
  }, [editor]);

  const handleSave = async () => {
    if (!hasChanges) return;
    setIsSaving(true);
    const content = editor.document;
    try {
      const {error} = await (supabase.from('cases' as any) as any).update({
        body: content,
        updated_at: new Date().toISOString()
      }).eq('id', caseId);
      if (error) throw error;
      toast.success("Mentve.");
      setHasChanges(false);
    } catch (error) {
      toast.error("Hiba a mentés során.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <CaseEditorProvider evidenceList={evidenceList} readOnly={readOnly}>
      <div className="flex flex-col h-full bg-[#0b1221] overflow-hidden relative group">

        {/* Háttér Rács (nagyon halvány) */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}></div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar relative z-10">
          <BlockNoteView editor={editor} editable={!readOnly} theme="dark" slashMenu={false} className="min-h-[500px]">
            <SuggestionMenuController triggerCharacter={"/"}
                                      getItems={async (query) => filterItems(getCustomSlashMenuItems(editor), query)}/>
          </BlockNoteView>
        </div>

        {/* Floating Save Button */}
        {!readOnly && hasChanges && (
          <div className="absolute bottom-6 right-6 animate-in fade-in slide-in-from-bottom-4 z-50">
            <Button onClick={handleSave} disabled={isSaving}
                    className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold shadow-[0_0_20px_rgba(234,179,8,0.3)] transition-all hover:scale-105 border border-yellow-600">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Save className="w-4 h-4 mr-2"/>}
              VÁLTOZÁSOK MENTÉSE
            </Button>
          </div>
        )}
      </div>
    </CaseEditorProvider>
  );
}