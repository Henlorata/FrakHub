import {useEffect, useMemo, useRef, useState, type CSSProperties} from "react";
import {BlockNoteSchema, defaultBlockSpecs} from "@blocknote/core";
import {BlockNoteView} from "@blocknote/mantine";
import {useCreateBlockNote} from "@blocknote/react";
import {Save, Loader2} from "lucide-react";
import {Button} from "@/components/ui/button";
import {toast} from "sonner";
import "@blocknote/mantine/style.css";
import {EvidenceBlock} from "@/pages/mcb/components/EvidenceBlock";
import {cn, errorMessage} from "@/lib/utils";
import {deleteCloudinaryAssets, uploadToCloudinary} from "@/lib/cloudinary";
import {extractImageUrls, toInitialContent} from "@/lib/blocknote-content";

interface AcademyEditorProps {
  initialContent: unknown;
  onSave: (content: unknown) => Promise<void>;
  readOnly?: boolean;
  theme?: string;
  /** Page id: images are uploaded into the academy/<pageId> Cloudinary folder. */
  pageId: string;
}

const schema = BlockNoteSchema.create({
  blockSpecs: {...defaultBlockSpecs, evidence: EvidenceBlock()},
});

const THEMES: Record<string, {className: string; editorTheme: "light" | "dark"; cssVars: Record<string, string>}> = {
  paper: {
    className: "bg-[#f5f0e6] text-[#3d342b] font-serif",
    editorTheme: "light",
    cssVars: {"--bn-colors-editor-background": "#f5f0e6", "--bn-colors-editor-text": "#3d342b"}
  },
  terminal: {
    className: "bg-[#0c0c0c] text-[#00ff00] selection:bg-green-900 selection:text-white",
    editorTheme: "dark",
    cssVars: {"--bn-colors-editor-background": "#0c0c0c", "--bn-colors-editor-text": "#00ff00"}
  },
  amber: {
    className: "bg-[#1a1200] text-[#ffb000] selection:bg-orange-900 selection:text-white",
    editorTheme: "dark",
    cssVars: {"--bn-colors-editor-background": "#1a1200", "--bn-colors-editor-text": "#ffb000"}
  },
  blue: {
    className: "bg-[#0f172a] text-[#bfdbfe] font-sans selection:bg-blue-900 selection:text-white",
    editorTheme: "dark",
    cssVars: {"--bn-colors-editor-background": "#0f172a", "--bn-colors-editor-text": "#bfdbfe"}
  },
  classic: {
    className: "bg-white text-slate-900 font-sans border-x border-slate-200 shadow-sm max-w-[800px] mx-auto my-4",
    editorTheme: "light",
    cssVars: {"--bn-colors-editor-background": "#ffffff", "--bn-colors-editor-text": "#0f172a"}
  },
  default: {className: "bg-[#0b1221] text-slate-200", editorTheme: "dark", cssVars: {}},
};

export function AcademyEditor({
                                initialContent,
                                onSave,
                                readOnly = false,
                                theme = 'default',
                                pageId
                              }: AcademyEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  // Read at upload time, so a page switch never uploads into the previous page's folder.
  const pageIdRef = useRef(pageId);
  useEffect(() => {
    pageIdRef.current = pageId;
  }, [pageId]);

  const safeContent = useMemo(() => toInitialContent<never>(initialContent), [initialContent]);

  const editor = useCreateBlockNote({
    initialContent: safeContent,
    schema: schema,
    uploadFile: async (file: File) => {
      const toastId = toast.loading("Kép feltöltése...");
      try {
        // Resized and converted to WebP before upload.
        const url = await uploadToCloudinary(file, 'academy', pageIdRef.current);
        toast.dismiss(toastId);
        return url;
      } catch (e) {
        toast.error("Képfeltöltés sikertelen: " + errorMessage(e), {id: toastId});
        // Rejecting lets BlockNote show its own "upload failed" state instead of
        // inserting a placeholder image into the material.
        throw e;
      }
    },
  });

  useEffect(() => {
    editor.replaceBlocks(editor.document, safeContent ?? [{type: "paragraph", content: ""}]);
    setHasChanges(false);
  }, [safeContent, editor]);

  useEffect(() => {
    if (readOnly) return;
    return editor.onChange(() => setHasChanges(true));
  }, [editor, readOnly]);

  const handleSaveClick = async () => {
    setIsSaving(true);
    try {
      const nextContent = editor.document;
      const removedImages = extractImageUrls(safeContent ?? []).filter(url => !extractImageUrls(nextContent).includes(url));

      await onSave(nextContent);
      setHasChanges(false);
      toast.success("Tananyag mentve.");

      // Images dropped from the page are no longer referenced anywhere: clean them up.
      if (removedImages.length > 0) void deleteCloudinaryAssets(removedImages);
    } catch (e) {
      console.error(e);
      toast.error("Hiba a mentés során.");
    } finally {
      setIsSaving(false);
    }
  };

  const themeConfig = THEMES[theme] ?? THEMES.default;

  return (
    <div
      className={cn("flex flex-col h-full relative group transition-colors duration-300 w-full overflow-hidden rounded-lg border border-slate-800 min-h-full font-mono", themeConfig.className)}
      style={themeConfig.cssVars as CSSProperties}
    >
      {theme === 'default' && (
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-0" style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}></div>
      )}

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 md:p-12 custom-scrollbar relative z-10 w-full">
        <BlockNoteView
          editor={editor}
          editable={!readOnly}
          theme={themeConfig.editorTheme}
          className="min-h-[500px] w-full"
        />
      </div>

      {!readOnly && hasChanges && (
        <div className="absolute bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-2">
          <Button
            onClick={handleSaveClick}
            disabled={isSaving}
            className="bg-[#c5a065] hover:bg-[#b08d55] text-black font-bold shadow-[0_0_20px_rgba(197,160,101,0.3)] transition-all hover:scale-105 border border-[#8a6d3b]"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Save className="w-4 h-4 mr-2"/>}
            VÁLTOZÁSOK MENTÉSE
          </Button>
        </div>
      )}

      <style>{`
            .bn-block-content[data-content-type="table"] { overflow-x: auto !important; width: 100% !important; display: block !important; padding-bottom: 12px; padding-right: 2px; }
            .bn-block-content[data-content-type="table"] table { width: max-content !important; min-width: 100% !important; }
        `}</style>
    </div>
  );
}
