import {useEffect, useState} from "react";
import {createReactBlockSpec, type ReactCustomBlockRenderProps} from "@blocknote/react";
import {
  Columns2, FileText, GalleryVertical, ImageIcon, Loader2, Maximize2, Minimize2, PanelTop, Paperclip, Search, SquareDashed, X,
} from "lucide-react";
import {supabase} from "@/lib/supabaseClient";
import {cn} from "@/lib/utils";
import {getOptimizedImageUrl, withTransformation} from "@/lib/cloudinary";
import {isRemoteFile} from "@/lib/mcb";
import {useCaseEditorContext} from "./CaseEditorContext";

// The stored block format: never rename the type or its props (existing case documents use them).
const evidenceBlockConfig = {
  type: "evidence",
  propSchema: {
    evidenceId: {default: ""},
    caption: {default: ""},
    layout: {default: "side"},
    width: {default: "full"},
  },
  content: "none",
} as const;

type EvidenceBlockProps = ReactCustomBlockRenderProps<typeof evidenceBlockConfig>;

/**
 * Display URL of an evidence file: Cloudinary (resized) or legacy Supabase Storage (signed).
 * Uses the client module directly: BlockNote also renders blocks outside the React tree (copy).
 */
export function useEvidenceImageUrl(filePath: string | undefined, isImage: boolean, width = 1200) {
  const [signedUrl, setSignedUrl] = useState<{path: string; url: string} | null>(null);
  const isRemote = isRemoteFile(filePath);

  useEffect(() => {
    if (!filePath || !isImage || isRemote) return;
    let active = true;
    supabase.storage
      .from("case_evidence")
      .createSignedUrl(filePath, 3600)
      .then(({data, error}) => {
        if (error) console.error("Error loading evidence image:", error);
        if (active && data) setSignedUrl({path: filePath, url: data.signedUrl});
      });
    return () => {
      active = false;
    };
  }, [filePath, isImage, isRemote]);

  if (!filePath || !isImage) return {url: null, loading: false};
  if (isRemote) return {url: getOptimizedImageUrl(filePath, width), loading: false};
  const url = signedUrl?.path === filePath ? signedUrl.url : null;
  return {url, loading: !url};
}

const LAYOUTS = [
  {value: "side", label: "Kép mellett leírás", icon: Columns2},
  {value: "bottom", label: "Leírás a kép alatt", icon: PanelTop},
  {value: "card", label: "Kártya", icon: GalleryVertical},
  {value: "image-only", label: "Csak kép", icon: ImageIcon},
] as const;

function EvidencePicker({onPick}: {onPick: (id: string) => void}) {
  const {evidenceList, numbers, light} = useCaseEditorContext();
  const [query, setQuery] = useState("");
  const term = query.trim().toLowerCase();
  const items = evidenceList.filter((item) => !term || item.file_name.toLowerCase().includes(term)
    || String(numbers.get(item.id) ?? "").includes(term));

  return (
    <div className={cn("evidence-picker my-4 rounded-2xl border border-dashed p-4 select-none", light ? "evidence-light" : "evidence-dark")}
         contentEditable={false}>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/30">
          <Paperclip className="size-4"/>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Bizonyíték beillesztése</p>
          <p className="text-xs opacity-60">Válassz az akta feltöltött fájljai közül.</p>
        </div>
        {evidenceList.length > 6 && (
          <label className="evidence-search flex h-8 items-center gap-2 rounded-lg px-2.5 text-xs">
            <Search className="size-3.5 opacity-60"/>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Keresés…"
                   className="w-32 bg-transparent outline-none"/>
          </label>
        )}
      </div>
      {evidenceList.length === 0 ? (
        <p className="rounded-xl px-3 py-6 text-center text-xs opacity-60">
          Az aktához még nincs feltöltött fájl. A jobb oldali „Bizonyítékok” panelen tölthetsz fel.
        </p>
      ) : (
        <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <button key={item.id} type="button" onClick={() => onPick(item.id)}
                    className="evidence-tile group relative overflow-hidden rounded-xl text-left transition">
              <div className="aspect-[4/3] w-full overflow-hidden">
                {item.file_type === "image" && isRemoteFile(item.file_path) ? (
                  <img src={withTransformation(item.file_path, "c_fill,w_240,h_180,q_auto,f_auto")} alt="" loading="lazy"
                       className="size-full object-cover transition duration-300 group-hover:scale-105"/>
                ) : (
                  <div className="grid size-full place-items-center opacity-50"><FileText className="size-7"/></div>
                )}
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1.5 text-[11px]">
                <span className="font-mono font-bold text-amber-500">#{numbers.get(item.id)}</span>
                <span className="min-w-0 flex-1 truncate">{item.file_name}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EvidenceBlockView({block, editor}: EvidenceBlockProps) {
  const {evidenceList, numbers, readOnly, light, onOpenEvidence} = useCaseEditorContext();
  const {evidenceId, layout, width, caption} = block.props;
  const selected = evidenceList.find((item) => item.id === evidenceId);
  const isImage = selected?.file_type === "image";
  const {url: imageUrl, loading} = useEvidenceImageUrl(selected?.file_path, isImage);

  const setProps = (patch: Partial<typeof block.props>) => editor.updateBlock(block, {props: {...block.props, ...patch}});

  if (!evidenceId) {
    if (readOnly) return null;
    return <EvidencePicker onPick={(id) => setProps({evidenceId: id})}/>;
  }

  const isSide = layout === "side";
  const isImageOnly = layout === "image-only";
  const isCard = layout === "card";
  const isOverlay = layout === "overlay";
  const number = numbers.get(evidenceId);
  const widthClass = width === "small" ? "w-[250px] max-w-full" : width === "half" ? "w-[48%] max-sm:w-full" : "w-full";

  return (
    <div className={cn("group/evidence relative my-4 mr-2 inline-block align-top select-none", widthClass)} contentEditable={false}>
      {!readOnly && (
        <div className="pointer-events-none absolute -top-11 right-0 left-0 z-50 flex justify-center pb-2 opacity-0 transition group-hover/evidence:pointer-events-auto group-hover/evidence:opacity-100">
          <div className="flex gap-0.5 rounded-xl border border-white/10 bg-[#0b1220]/95 p-1 text-slate-300 shadow-xl backdrop-blur">
            {LAYOUTS.map((item) => (
              <button key={item.value} type="button" title={item.label} onClick={() => setProps({layout: item.value})}
                      className={cn("grid size-7 place-items-center rounded-lg hover:bg-white/10", layout === item.value && "bg-amber-500/15 text-amber-300")}>
                <item.icon className="size-3.5"/>
              </button>
            ))}
            <span className="mx-1 w-px bg-white/10"/>
            <button type="button" title="Teljes szélesség" onClick={() => setProps({width: "full"})}
                    className={cn("grid size-7 place-items-center rounded-lg hover:bg-white/10", width === "full" && "bg-amber-500/15 text-amber-300")}>
              <Maximize2 className="size-3.5"/>
            </button>
            <button type="button" title="Fél szélesség (két kép egymás mellett)" onClick={() => setProps({width: "half"})}
                    className={cn("grid size-7 place-items-center rounded-lg hover:bg-white/10", width === "half" && "bg-amber-500/15 text-amber-300")}>
              <Minimize2 className="size-3.5"/>
            </button>
            <span className="mx-1 w-px bg-white/10"/>
            <button type="button" title="Másik fájl választása" onClick={() => setProps({evidenceId: ""})}
                    className="grid size-7 place-items-center rounded-lg hover:bg-white/10"><SquareDashed className="size-3.5"/></button>
            <button type="button" title="Blokk törlése" onClick={() => editor.removeBlocks([block])}
                    className="grid size-7 place-items-center rounded-lg hover:bg-red-500/20 hover:text-red-300"><X className="size-3.5"/></button>
          </div>
        </div>
      )}

      <figure className={cn("evidence-card overflow-hidden", light ? "evidence-light" : "evidence-dark",
        isSide && "flex flex-col gap-4 p-3 md:flex-row",
        layout === "bottom" && "flex flex-col gap-3 p-3",
        isCard && "flex flex-col",
        isOverlay && "relative",
        isImageOnly && "evidence-bare")}>
        <button type="button" onClick={() => selected && onOpenEvidence(selected.id)} disabled={!selected}
                className={cn("evidence-media relative flex items-center justify-center overflow-hidden",
                  isSide ? "min-h-[120px] w-full shrink-0 md:w-2/5" : "w-full", !isImageOnly && "rounded-xl",
                  selected && "cursor-zoom-in")}>
          {loading ? (
            <span className="flex flex-col items-center gap-2 p-10 text-xs opacity-60"><Loader2 className="size-6 animate-spin"/> Betöltés…</span>
          ) : imageUrl ? (
            <img src={imageUrl} alt={selected?.file_name ?? "Bizonyíték"} loading="lazy"
                 className={cn("object-contain", isImageOnly ? "max-h-[800px] w-full" : "max-h-[500px]", isOverlay && "h-auto w-full")}/>
          ) : (
            <span className="flex flex-col items-center gap-2 p-8 text-xs opacity-60">
              <FileText className="size-8"/>
              {selected ? selected.file_name : "A bizonyítékot törölték az aktából."}
            </span>
          )}
          {number && !isImageOnly && (
            <span className="absolute top-2 left-2 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300">#{number}</span>
          )}
        </button>

        {!isImageOnly && (
          <figcaption className={cn("flex min-w-0 flex-1 flex-col justify-center", isCard && "p-3",
            isOverlay && "absolute right-0 bottom-0 left-0 bg-black/75 p-3 text-slate-200 backdrop-blur-sm")}>
            <span className="evidence-label mb-1 font-mono text-[10px] font-bold tracking-widest uppercase">
              {/* "BIZONYÍTÉK: <name>": kept for the older documents' look and the end-to-end tests. */}
              BIZONYÍTÉK: {selected?.file_name ?? "törölve"}
            </span>
            {readOnly ? (
              caption ? <p className="text-sm leading-relaxed whitespace-pre-wrap wrap-anywhere">{caption}</p> : null
            ) : (
              <textarea value={caption} rows={Math.min(6, Math.max(1, caption.split("\n").length))}
                        onChange={(event) => setProps({caption: event.target.value})}
                        placeholder="Leírás, megjegyzés a bizonyítékhoz…"
                        className="evidence-caption w-full resize-none bg-transparent text-sm leading-relaxed outline-none"/>
            )}
          </figcaption>
        )}
      </figure>
    </div>
  );
}

export const EvidenceBlock = createReactBlockSpec(evidenceBlockConfig, {render: EvidenceBlockView});
