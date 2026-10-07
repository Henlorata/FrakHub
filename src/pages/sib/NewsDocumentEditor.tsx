import {useEffect, useMemo} from "react";
import {toast} from "sonner";
import {BlockNoteSchema, defaultBlockSpecs, type PartialBlock} from "@blocknote/core";
import {BlockNoteView} from "@blocknote/mantine";
import {getDefaultReactSlashMenuItems, SuggestionMenuController, useCreateBlockNote, type DefaultReactSuggestionItem} from "@blocknote/react";
import "@blocknote/mantine/style.css";
import {toInitialContent} from "@/lib/blocknote-content";
import {hu} from "@/lib/blocknote-hu";
import {uploadToCloudinary} from "@/lib/cloudinary";
import {cn, errorMessage} from "@/lib/utils";

// Text and pictures (no video, audio or files): what the public article renders.
const {video: _video, audio: _audio, file: _file, ...newsBlocks} = defaultBlockSpecs;
const schema = BlockNoteSchema.create({blockSpecs: newsBlocks});
type Block = PartialBlock<typeof schema.blockSchema, typeof schema.inlineContentSchema, typeof schema.styleSchema>;

const HIDDEN_SLASH_ITEMS = new Set(["code_block", "emoji", "heading_4", "heading_5", "heading_6", "toggle_heading", "toggle_heading_2", "toggle_heading_3", "toggle_list"]);
const dictionary = {...hu, placeholders: {...hu.placeholders, default: "Írd a cikket, vagy nyomd meg a „/” gombot (címsor, lista, kép, idézet)"}};
const fold = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** The article editor of the SIB: text and pictures, the pictures uploaded to Cloudinary (news folder). */
export default function NewsDocumentEditor({initial, onChange, className}: {initial: unknown[]; onChange: (blocks: unknown[]) => void; className?: string}) {
  const content = useMemo(() => toInitialContent<Block>(structuredClone(initial)), [initial]);
  const editor = useCreateBlockNote({
    schema, initialContent: content, dictionary,
    uploadFile: async (file: File) => {
      const id = toast.loading("Kép feltöltése…");
      try {
        const url = await uploadToCloudinary(file, "news");
        toast.dismiss(id);
        return url;
      } catch (error) {
        toast.error("A kép feltöltése nem sikerült: " + errorMessage(error), {id});
        throw error;
      }
    },
  });

  useEffect(() => editor.onChange(() => onChange(editor.document as unknown[])), [editor, onChange]);

  const items = (query: string): DefaultReactSuggestionItem[] => {
    const term = fold(query.trim());
    return getDefaultReactSlashMenuItems(editor)
      .filter((item) => !HIDDEN_SLASH_ITEMS.has((item as {key?: string}).key ?? ""))
      .filter((item) => !term || [item.title, item.subtext ?? "", ...(item.aliases ?? [])].some((value) => fold(value).includes(term)));
  };

  return (
    <div className={cn("case-surface-default min-h-[460px] rounded-xl bg-[#070c18]/60 px-1 py-4 ring-1 ring-white/10 sm:px-3", className)}
         style={{wordBreak: "break-word", overflowWrap: "anywhere"}}>
      <BlockNoteView editor={editor} theme="dark" slashMenu={false} className="min-h-[420px] w-full">
        <SuggestionMenuController triggerCharacter="/" getItems={async (query) => items(query)}/>
      </BlockNoteView>
    </div>
  );
}
