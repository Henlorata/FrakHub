import { useEffect, useState, useMemo } from "react";
import { type PartialBlock, BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { SuggestionMenuController, getDefaultReactSlashMenuItems } from "@blocknote/react";
import "@blocknote/mantine/style.css";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Save, Loader2, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CaseEvidence } from "@/types/supabase";
import { CaseEditorProvider } from "./CaseEditorContext";
import { EvidenceBlock } from "./EvidenceBlock";

interface CaseEditorProps {
  caseId: string;
  initialContent: any;
  readOnly?: boolean;
  evidenceList: CaseEvidence[];
}

// Segédfüggvény a menü szűréséhez
const filterItems = (items: any[], query: string) => {
  return items.filter((item: any) =>
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    (item.aliases && item.aliases.some((alias: string) => alias.toLowerCase().includes(query.toLowerCase())))
  );
};

// SÉMA LÉTREHOZÁSA KÍVÜL
// JAVÍTÁS: Az EvidenceBlock-ot meg kell hívni (), mert az egy factory függvény!
const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    evidence: EvidenceBlock(), // <--- ITT VOLT A HIBA (zárójelek kellenek)
  },
});

export function CaseEditor({ caseId, initialContent, readOnly = false, evidenceList }: CaseEditorProps) {
  const { supabase } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const safeContent = useMemo(() => {
    if (Array.isArray(initialContent) && initialContent.length > 0) {
      return initialContent as PartialBlock[];
    }
    return undefined;
  }, [initialContent]);

  // Editor létrehozása a külső sémával
  const editor = useCreateBlockNote({
    initialContent: safeContent,
    schema: schema,
  });

  // Slash Menü
  const getCustomSlashMenuItems = (editor: any) => [
    ...getDefaultReactSlashMenuItems(editor),
    {
      title: "Bizonyíték Csatolása",
      onItemClick: () => {
        editor.insertBlocks(
          [{ type: "evidence", props: { evidenceId: "" } }],
          editor.getTextCursorPosition().block,
          "after"
        );
      },
      aliases: ["evidence", "kép", "bizonyíték", "fotó"],
      group: "Média",
      icon: <ImagePlus size={18} />,
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
      const { error } = await (supabase.from('cases' as any) as any).update({
        body: content,
        updated_at: new Date().toISOString()
      }).eq('id', caseId);

      if (error) throw error;

      toast.success("Akta tartalma mentve.");
      setHasChanges(false);
    } catch (error) {
      console.error(error);
      toast.error("Hiba a mentés során.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <CaseEditorProvider evidenceList={evidenceList} readOnly={readOnly}>
      <div className="flex flex-col h-full bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden relative group backdrop-blur-sm">
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <BlockNoteView
            editor={editor}
            editable={!readOnly}
            theme="dark"
            slashMenu={false}
            className="min-h-[500px]"
          >
            <SuggestionMenuController
              triggerCharacter={"/"}
              getItems={async (query) => filterItems(getCustomSlashMenuItems(editor), query)}
            />
          </BlockNoteView>
        </div>

        {!readOnly && hasChanges && (
          <div className="absolute bottom-6 right-6 animate-in fade-in slide-in-from-bottom-2 z-50">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold shadow-lg shadow-yellow-900/20 transition-all hover:scale-105"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Változások mentése
            </Button>
          </div>
        )}
      </div>
    </CaseEditorProvider>
  );
}