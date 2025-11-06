// FrakHub/src/pages/mcb/components/CaseEditor.tsx

import {
  useCreateBlockNote,
} from "@blocknote/react";

import {
  BlockNoteView,
} from "@blocknote/mantine";

import {
  BlockNoteEditor,
  type PartialBlock,
} from "@blocknote/core";
import { cn } from "@/lib/utils";

interface CaseEditorProps {
  initialContent: PartialBlock[] | "loading" | undefined;
  editable: boolean;
  onChange: (content: PartialBlock[]) => void;
  className?: string;
}

export function CaseEditor({initialContent, editable, onChange, className}: CaseEditorProps) {

  const editor: BlockNoteEditor | null = useCreateBlockNote({
    initialContent: initialContent === "loading" || initialContent === undefined
      ? undefined
      : initialContent,
  });

  if (initialContent === "loading") {
    return (
      <div className="p-4 text-slate-800 bg-slate-900 rounded-b-md">
        Akta tartalmának betöltése...
      </div>
    )
  }

  return (
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
        // JAVÍTÁS: h-full MELLÉ flex és flex-col HOZZÁADVA
        "h-full flex flex-col bg-slate-800 text-slate-200 rounded-b-md",
        className
      )}
    />
  );
}