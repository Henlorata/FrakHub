import {useEffect, useMemo, useRef, useState} from "react";
import {BlockNoteSchema, defaultBlockSpecs} from "@blocknote/core";
import {BlockNoteView} from "@blocknote/mantine";
import {useCreateBlockNote} from "@blocknote/react";
import {ImageUp, Loader2, Save} from "lucide-react";
import {Button} from "@/components/ui/button";
import {toast} from "sonner";
import "@blocknote/mantine/style.css";
import {EvidenceBlock} from "@/pages/mcb/components/EvidenceBlock";
import {cn, errorMessage} from "@/lib/utils";
import {deleteCloudinaryAssets, getOptimizedImageUrl, uploadToCloudinary} from "@/lib/cloudinary";
import {extractImageUrls, toInitialContent} from "@/lib/blocknote-content";
import {countInlineImages, uploadInlineImages} from "@/lib/inline-images";

interface AcademyEditorProps {
  initialContent: unknown;
  onSave?: (content: unknown) => Promise<void>;
  readOnly?: boolean;
  theme?: string;
  /** Page id: images are uploaded into the academy/<pageId> Cloudinary folder. */
  pageId: string;
  /** Reports unsaved changes (the page asks before leaving). */
  onDirtyChange?: (dirty: boolean) => void;
}

const schema = BlockNoteSchema.create({
  blockSpecs: {...defaultBlockSpecs, evidence: EvidenceBlock()},
});

/** Page looks of the material (stored per page; the keys are kept for the existing pages). */
export const ACADEMY_THEMES: Record<string, {label: string; className: string; editorTheme: "light" | "dark"; background: string; text: string; font?: string}> = {
  default: {label: "Sötét", className: "bg-[#0b1221]/70", editorTheme: "dark", background: "transparent", text: "#e2e8f0"},
  paper: {label: "Papír", className: "bg-[#f5f0e6]", editorTheme: "light", background: "#f5f0e6", text: "#3d342b", font: "Georgia, 'Times New Roman', serif"},
  classic: {label: "Hivatalos (fehér)", className: "bg-white", editorTheme: "light", background: "#ffffff", text: "#0f172a"},
  blue: {label: "Kék", className: "bg-[#0f172a]", editorTheme: "dark", background: "#0f172a", text: "#bfdbfe"},
  terminal: {label: "Terminál", className: "bg-[#0c0c0c]", editorTheme: "dark", background: "#0c0c0c", text: "#4ade80", font: "ui-monospace, monospace"},
  amber: {label: "Borostyán", className: "bg-[#1a1200]", editorTheme: "dark", background: "#1a1200", text: "#ffb000", font: "ui-monospace, monospace"},
};

// BlockNote sets its colours on .bn-container; the page look overrides them.
const THEME_CSS = Object.entries(ACADEMY_THEMES).map(([key, look]) => `.academy-theme-${key} .bn-container { --bn-colors-editor-background: ${look.background} !important; --bn-colors-editor-text: ${look.text} !important;${look.font ? ` --bn-font-family: ${look.font} !important;` : ""} }${look.font ? ` .academy-theme-${key} .bn-default-styles { font-family: ${look.font}; }` : ""}`).join("\n");

interface Block {
  type?: string;
  props?: Record<string, unknown>;
  children?: Block[];
}

/** For reading: Cloudinary images in a bounded size and the browser's best format. */
function optimizeImages(blocks: Block[]): Block[] {
  return blocks.map((block) => ({
    ...block,
    props: block.type === "image" && typeof block.props?.url === "string" ? {...block.props, url: getOptimizedImageUrl(block.props.url, 1600)} : block.props,
    children: Array.isArray(block.children) ? optimizeImages(block.children) : block.children,
  }));
}

/**
 * The academy's BlockNote editor (and reader). Pasted images that arrive embedded are uploaded
 * to Cloudinary when saving, so the page JSON stays small.
 */
export function AcademyEditor({initialContent, onSave, readOnly = false, theme = "default", pageId, onDirtyChange}: AcademyEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  // Read at upload time, so a page switch never uploads into the previous page's folder.
  const pageIdRef = useRef(pageId);
  useEffect(() => {
    pageIdRef.current = pageId;
  }, [pageId]);

  const safeContent = useMemo(() => {
    const content = toInitialContent<Block>(initialContent);
    return content && readOnly ? optimizeImages(content) : content;
  }, [initialContent, readOnly]);
  const inlineImages = useMemo(() => readOnly ? 0 : countInlineImages(initialContent), [initialContent, readOnly]);

  const editor = useCreateBlockNote({
    initialContent: safeContent as never,
    schema,
    uploadFile: async (file: File) => {
      const toastId = toast.loading("Kép feltöltése…");
      try {
        // Resized and converted to WebP before upload.
        const url = await uploadToCloudinary(file, "academy", pageIdRef.current);
        toast.dismiss(toastId);
        return url;
      } catch (error) {
        toast.error("Képfeltöltés sikertelen: " + errorMessage(error), {id: toastId});
        // Rejecting lets BlockNote show its own "upload failed" state instead of
        // inserting a placeholder image into the material.
        throw error;
      }
    },
  });

  useEffect(() => {
    editor.replaceBlocks(editor.document, (safeContent ?? [{type: "paragraph", content: ""}]) as never);
    setHasChanges(false);
  }, [safeContent, editor]);

  useEffect(() => {
    if (readOnly) return;
    return editor.onChange(() => setHasChanges(true));
  }, [editor, readOnly]);

  useEffect(() => {
    onDirtyChange?.(hasChanges);
  }, [hasChanges, onDirtyChange]);

  // Warn before leaving the page with unsaved material.
  useEffect(() => {
    if (!hasChanges) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasChanges]);

  const save = async () => {
    if (!onSave) return;
    setIsSaving(true);
    const toastId = toast.loading("Mentés…");
    try {
      const {content: nextContent, uploaded} = await uploadInlineImages(editor.document, "academy", pageIdRef.current);
      const kept = extractImageUrls(nextContent);
      const removedImages = extractImageUrls(toInitialContent(initialContent) ?? []).filter((url) => !kept.includes(url));

      await onSave(nextContent);
      if (uploaded > 0) editor.replaceBlocks(editor.document, nextContent as never);
      setHasChanges(false);
      toast.success(uploaded > 0 ? `Tananyag mentve (${uploaded} beágyazott kép feltöltve).` : "Tananyag mentve.", {id: toastId});

      // Images dropped from the page are no longer referenced anywhere: clean them up.
      if (removedImages.length > 0) void deleteCloudinaryAssets(removedImages);
    } catch (error) {
      console.error(error);
      toast.error("Hiba a mentés során: " + errorMessage(error), {id: toastId});
    } finally {
      setIsSaving(false);
    }
  };

  const themeConfig = ACADEMY_THEMES[theme] ?? ACADEMY_THEMES.default;

  return (
    <div className={cn("relative w-full overflow-hidden rounded-2xl ring-1 ring-white/10 transition-colors duration-300", themeConfig.className, `academy-theme-${ACADEMY_THEMES[theme] ? theme : "default"}`)}>
      {!readOnly && inlineImages > 0 && !hasChanges && (
        <div className="flex flex-wrap items-center gap-2 border-b border-amber-500/30 bg-[#2a1f06] px-4 py-2 text-xs text-amber-100">
          <ImageUp className="size-4 shrink-0"/>
          Ezen az oldalon {inlineImages} kép az oldalba ágyazva van (lassú betöltés). Mentéskor feltöltjük őket.
          <Button size="sm" variant="outline" className="ml-auto h-7 border-amber-400/40 text-amber-100" disabled={isSaving}
                  onClick={() => void save()}>{isSaving ? <Loader2 className="animate-spin"/> : <ImageUp/>} Feltöltés most</Button>
        </div>
      )}
      <div className={cn("w-full overflow-x-hidden", readOnly ? "px-2 py-6 md:px-6 md:py-10" : "px-2 py-6 md:px-6")}>
        <BlockNoteView editor={editor} editable={!readOnly} theme={themeConfig.editorTheme} className="min-h-[420px] w-full"/>
      </div>

      {!readOnly && hasChanges && (
        <div className="animate-rise sticky bottom-4 z-30 flex justify-end px-4 pb-4">
          <Button onClick={() => void save()} disabled={isSaving} className="bg-amber-400 text-black shadow-xl shadow-amber-900/30 hover:bg-amber-300">
            {isSaving ? <Loader2 className="animate-spin"/> : <Save/>} Változások mentése
          </Button>
        </div>
      )}

      <style>{`
        ${THEME_CSS}
        .bn-block-content[data-content-type="table"] { overflow-x: auto !important; width: 100% !important; display: block !important; padding-bottom: 12px; padding-right: 2px; }
        .bn-block-content[data-content-type="table"] table { width: max-content !important; min-width: 100% !important; }
      `}</style>
    </div>
  );
}
