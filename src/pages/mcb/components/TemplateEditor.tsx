import {useEffect, useMemo} from "react";
import {BlockNoteSchema, defaultBlockSpecs, type PartialBlock} from "@blocknote/core";
import {BlockNoteView} from "@blocknote/mantine";
import {getDefaultReactSlashMenuItems, SuggestionMenuController, useCreateBlockNote, type DefaultReactSuggestionItem} from "@blocknote/react";
import {Stamp} from "lucide-react";
import "@blocknote/mantine/style.css";
import {toInitialContent} from "@/lib/blocknote-content";
import {hu} from "@/lib/blocknote-hu";
import type {TemplateBlock} from "@/lib/case-templates";
import {LetterheadBlock} from "./LetterheadBlock";

// Templates hold text only (headings, lists, tables, quotes) and the letterhead, whose logos are
// files of the app: no uploaded pictures or files; evidence is added to the case itself. The
// blocks are the same as the case documents' ones.
const {image: _image, video: _video, audio: _audio, file: _file, ...textBlocks} = defaultBlockSpecs;
const schema = BlockNoteSchema.create({blockSpecs: {...textBlocks, letterhead: LetterheadBlock()}});
type Block = PartialBlock<typeof schema.blockSchema, typeof schema.inlineContentSchema, typeof schema.styleSchema>;

/** Default slash items the case documents do not use either. */
const HIDDEN_SLASH_ITEMS = new Set(["code_block", "emoji", "heading_4", "heading_5", "heading_6"]);

// No mentions in templates: the placeholder only offers the "/" menu.
const dictionary = {...hu, placeholders: {...hu.placeholders, default: "Írj, vagy nyomd meg a „/” gombot a blokkokhoz"}};

const fold = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** The body of a template; remount it (key) to load another one. */
export function TemplateEditor({initial, onChange}: {initial: TemplateBlock[]; onChange: (blocks: TemplateBlock[]) => void}) {
  const content = useMemo(() => toInitialContent<Block>(structuredClone(initial)), [initial]);
  const editor = useCreateBlockNote({schema, initialContent: content, dictionary});

  useEffect(() => editor.onChange(() => onChange(editor.document as unknown as TemplateBlock[])), [editor, onChange]);

  const items = (query: string): DefaultReactSuggestionItem[] => {
    const term = fold(query.trim());
    const letterhead: DefaultReactSuggestionItem = {
      title: "Fejléc", subtext: "Az iroda hivatalos fejléce logókkal", aliases: ["fejlec", "letterhead", "logo", "cimer"], group: "Nyomozás",
      icon: <Stamp size={18}/>,
      onItemClick: () => editor.insertBlocks([{type: "letterhead"}], editor.getTextCursorPosition().block, "before"),
    };
    return [letterhead, ...getDefaultReactSlashMenuItems(editor)]
      .filter((item) => !HIDDEN_SLASH_ITEMS.has((item as {key?: string}).key ?? ""))
      .filter((item) => !term || [item.title, item.subtext ?? "", ...(item.aliases ?? [])].some((value) => fold(value).includes(term)));
  };

  return (
    <div className="case-surface-default min-h-[420px] rounded-xl bg-[#070c18]/60 px-1 py-4 ring-1 ring-white/10 sm:px-3"
         style={{wordBreak: "break-word", overflowWrap: "anywhere"}}>
      <BlockNoteView editor={editor} theme="dark" slashMenu={false} className="min-h-[380px] w-full">
        <SuggestionMenuController triggerCharacter="/" getItems={async (query) => items(query)}/>
      </BlockNoteView>
    </div>
  );
}
