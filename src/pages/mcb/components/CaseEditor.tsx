// FrakHub/src/pages/mcb/components/CaseEditor.tsx
// (JAVÍTVA: TS2322 és TS7006 - slashMenuItems a 'useCreateBlockNote' hook-ba helyezve)

import * as React from "react";
import {useCreateBlockNote} from "@blocknote/react";
import {BlockNoteView} from "@blocknote/mantine";

import {
  BlockNoteEditor,
  type PartialBlock,
  getDefaultSlashMenuItems, // Ez a helyes import
} from "@blocknote/core";
import {cn} from "@/lib/utils";
import {supabase as supabaseClient} from "@/lib/supabaseClient";
import type {CaseEvidence} from "@/types/supabase";
import {toast} from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {ScrollArea} from "@/components/ui/scroll-area";
import {Loader2, Image as ImageIcon} from "lucide-react";

// Props interfész (VÁLTOZATLAN)
interface CaseEditorProps {
  initialContent: PartialBlock[] | "loading" | undefined;
  editable: boolean;
  onChange: (content: PartialBlock[]) => void;
  className?: string;
  caseId?: string;
  supabase?: typeof supabaseClient;
}

// EvidencePickerDialog komponens (VÁLTOZATLAN)
function EvidencePickerDialog({
                                open,
                                onOpenChange,
                                caseId,
                                supabase,
                                onImageSelect,
                              }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  supabase: typeof supabaseClient;
  onImageSelect: (item: CaseEvidence) => void;
}) {
  const [evidence, setEvidence] = React.useState<CaseEvidence[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (open) {
      setIsLoading(true);
      const fetchEvidence = async () => {
        const {data, error} = await supabase
          .from("case_evidence")
          .select("*")
          .eq("case_id", caseId)
          .order("created_at", {ascending: false});

        if (error) {
          toast.error("Bizonyítékok lekérése sikertelen", {description: error.message});
        } else {
          setEvidence(data || []);
        }
        setIsLoading(false);
      };
      fetchEvidence();
    } else {
      setEvidence([]);
    }
  }, [open, caseId, supabase]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bizonyíték Beillesztése</DialogTitle>
          <DialogDescription>
            Kattints egy képre, hogy beilleszd az akta szövegébe.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-96 w-full rounded-md border border-slate-700 bg-slate-800 p-4">
          {isLoading ? (
            <div className="flex h-full w-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400"/>
            </div>
          ) : evidence.length === 0 ? (
            <p className="text-center text-slate-400">Nincsenek feltöltött bizonyítékok ehhez az aktához.</p>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {evidence.map((item) => {
                const {data: publicUrlData} = supabase.storage
                  .from("case_evidence")
                  .getPublicUrl(item.file_path);

                return (
                  <div
                    key={item.id}
                    className="group relative cursor-pointer overflow-hidden rounded-lg border border-slate-600 aspect-video"
                    onClick={() => onImageSelect(item)}
                  >
                    <img
                      src={publicUrlData.publicUrl}
                      alt={item.description || item.file_name}
                      className="h-full w-full object-cover transition-transform group-hover:scale-110"
                    />
                    <div
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                      <p className="text-xs text-center text-white" title={item.file_name}>
                        {item.description || item.file_name}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// A FŐ KOMPONENS (JAVÍTVA)
export function CaseEditor({
                             initialContent,
                             editable,
                             onChange,
                             className,
                             caseId,
                             supabase = supabaseClient,
                           }: CaseEditorProps) {

  const [isEvidencePickerOpen, setIsEvidencePickerOpen] = React.useState(false);

  // Az egyedi parancs (VÁLTOZATLAN)
  const insertEvidenceCommand = {
    title: "Bizonyíték Beillesztése",
    aliases: ["bizonyitek", "kep", "evidence", "img"],
    group: "Média",
    icon: <ImageIcon size={18}/>,
    onItemClick: () => {
      setIsEvidencePickerOpen(true);
    },
  };

  // --- JAVÍTÁS: A 'slashMenuItems' prop a 'useCreateBlockNote' hook-ba került ---
  const editor: BlockNoteEditor | null = useCreateBlockNote({
    initialContent:
      initialContent === "loading" || initialContent === undefined
        ? undefined
        : initialContent,
    // A 'slashMenuItems' prop itt van definiálva
    slashMenuItems: (
      // A 'TS7006' javítása: explicit típus 'BlockNoteEditor'
      editor: BlockNoteEditor
    ) => [
      // Lekérjük az alapértelmezett parancsokat
      ...getDefaultSlashMenuItems(editor),
      // És hozzáadjuk a sajátunkat, ha szerkeszthető és van caseId
      ...(editable && caseId ? [insertEvidenceCommand] : []),
    ],
  });
  // --- JAVÍTÁS VÉGE ---

  // handleEvidenceSelect (VÁLTOZATLAN)
  const handleEvidenceSelect = (item: CaseEvidence) => {
    if (!supabase || !editor) return;

    // A kép URL-jét már nem kérjük le itt, nincs rá szükség a hivatkozáshoz.
    // const { data: publicUrlData } = supabase.storage
    //   .from("case_evidence")
    //   .getPublicUrl(item.file_path);

    // Kép helyett egy formázott linket szúrunk be.
    // Az 'href' egy belső horgony, amit a CaseDetailPage fog elkapni.
    const evidenceLink = `evidence://${item.id}`;
    const evidenceText = `[Bizonyíték: ${item.description || item.file_name}]`;

    editor.insertBlocks(
      [
        {
          type: "paragraph",
          props: {
            textAlignment: "center",
          },
          content: [
            {
              type: "link",
              href: evidenceLink,
              content: [
                {
                  type: "text",
                  text: evidenceText,
                  styles: {bold: true, italic: true},
                },
              ],
            },
          ],
        },
        {
          type: "paragraph",
          content: "",
        },
      ],
      editor.getTextCursorPosition().block,
      "after"
    );

    setIsEvidencePickerOpen(false);
  };


  if (initialContent === "loading") {
    return (
      <div className="p-4 text-slate-800 bg-slate-900 rounded-b-md">
        Akta tartalmának betöltése...
      </div>
    );
  }

  if (!editor) {
    return (
      <div className={cn(
        "h-full flex flex-col items-center justify-center bg-slate-800 text-slate-200 rounded-b-md",
        className
      )}>
        <Loader2 className="h-8 w-8 animate-spin text-slate-400"/>
      </div>
    );
  }

  return (
    <>
      {/* --- JAVÍTÁS: A 'slashMenuItems' prop innen el lett távolítva --- */}
      <BlockNoteView
        editor={editor}
        editable={editable}
        onChange={() => {
          if (editor) {
            onChange(editor.topLevelBlocks);
          }
        }}
        theme="dark"
        className={cn(
          "h-full flex flex-col bg-slate-800 text-slate-200 rounded-b-md",
          className
        )}
      />

      {editable && caseId && (
        <EvidencePickerDialog
          open={isEvidencePickerOpen}
          onOpenChange={setIsEvidencePickerOpen}
          caseId={caseId}
          supabase={supabase}
          onImageSelect={handleEvidenceSelect}
        />
      )}
    </>
  );
}