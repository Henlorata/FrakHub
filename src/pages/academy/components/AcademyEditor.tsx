import {useEffect, useState, useMemo, useRef} from "react";
import {BlockNoteSchema, defaultBlockSpecs} from "@blocknote/core";
import {BlockNoteView} from "@blocknote/mantine";
import {useCreateBlockNote} from "@blocknote/react";
import {Save, Loader2} from "lucide-react";
import {Button} from "@/components/ui/button";
import {toast} from "sonner";
import "@blocknote/mantine/style.css";
import {EvidenceBlock} from "@/pages/mcb/components/EvidenceBlock";
import {cn} from "@/lib/utils";

interface AcademyEditorProps {
  initialContent: any;
  onSave: (content: any) => Promise<void>;
  readOnly?: boolean;
  theme?: string;
  pageId: string; // FONTOS: Ezzel azonosítjuk a mappát
}

const schema = BlockNoteSchema.create({
  blockSpecs: {...defaultBlockSpecs, evidence: EvidenceBlock()},
});

// Helper: Public ID kinyerése URL-ből a törléshez
const getPublicIdFromUrl = (url: string) => {
  try {
    if (!url.includes('/upload/')) return null;
    const splitUrl = url.split('/upload/');
    let path = splitUrl[1];

    // Verziószám eltávolítása (pl. v123456/)
    path = path.replace(/^v\d+\//, '');

    // Kiterjesztés eltávolítása
    const lastDotIndex = path.lastIndexOf('.');
    if (lastDotIndex !== -1) path = path.substring(0, lastDotIndex);

    return path;
  } catch (e) {
    return null;
  }
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
  const hasChangesRef = useRef(false);

  const safeContent = useMemo(() => {
    if (Array.isArray(initialContent) && initialContent.length > 0) return initialContent;
    return undefined;
  }, [initialContent]);

  // Képek URL-jeinek kinyerése
  const extractImageUrls = (content: any[]): string[] => {
    if (!Array.isArray(content)) return [];
    const urls: string[] = [];
    const traverse = (blocks: any[]) => {
      blocks.forEach(block => {
        if (block.type === 'image' && block.props?.url) {
          urls.push(block.props.url);
        }
        if (block.children) traverse(block.children);
      });
    };
    traverse(content);
    return urls;
  };

  const uploadToCloudinary = async (file: File) => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    // ÚJ PRESET AZ AKADÉMIÁHOZ
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_ACADEMY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      toast.error("Cloudinary konfig hiányzik (ACADEMY PRESET)!");
      return "https://placehold.co/600x400?text=Config+Error";
    }

    const toastId = toast.loading("Kép feltöltése...");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    // Mappa beállítása: academy/OLDAL_ID
    formData.append("folder", `academy/${pageId}`);

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST", body: formData
      });

      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      toast.dismiss(toastId);
      return data.secure_url;
    } catch (e) {
      console.error(e);
      toast.dismiss(toastId);
      toast.error("Képfeltöltés sikertelen.");
      return "https://placehold.co/600x400?text=Upload+Error";
    }
  };

  const editor = useCreateBlockNote({
    initialContent: safeContent,
    schema: schema,
    uploadFile: uploadToCloudinary,
  });

  useEffect(() => {
    if (editor && safeContent) {
      editor.replaceBlocks(editor.document, safeContent);
    } else if (editor && !safeContent) {
      editor.replaceBlocks(editor.document, [{type: "paragraph", content: ""}]);
    }
  }, [safeContent, editor]);

  useEffect(() => {
    if (!editor) return;
    const unsubscribe = editor.onChange(() => {
      if (!readOnly) {
        setHasChanges(true);
        hasChangesRef.current = true;
      }
    });
    return unsubscribe;
  }, [editor, readOnly]);

  const handleSaveClick = async () => {
    setIsSaving(true);
    try {
      // 1. Képek detektálása törléshez
      const oldImages = extractImageUrls(safeContent || []);
      const newImages = extractImageUrls(editor.document);
      const imagesToDelete = oldImages.filter(url => !newImages.includes(url));

      // 2. Mentés DB-be
      await onSave(editor.document);

      // 3. Törlés a Cloudinary-ról (Régi API-val)
      if (imagesToDelete.length > 0) {
        imagesToDelete.forEach(async (url) => {
          const publicId = getPublicIdFromUrl(url);
          if (publicId) {
            console.log("Deleting orphaned image:", publicId);
            try {
              await fetch('/api/delete-image', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({publicId}) // Csak publicId-t küldünk, ahogy a régi szereti
              });
            } catch (err) {
              console.error("Failed to delete image:", err);
            }
          }
        });
      }

      setHasChanges(false);
      hasChangesRef.current = false;
      toast.success("Tananyag mentve.");
    } catch (e) {
      console.error(e);
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

  return (
    <div
      className={cn("flex flex-col h-full relative group transition-colors duration-300 w-full overflow-hidden rounded-lg border border-slate-800", themeConfig.className)}
      style={{...themeConfig.cssVars as React.CSSProperties}}
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