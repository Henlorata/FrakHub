import {useEffect, useState} from "react";
import {createReactBlockSpec, type ReactCustomBlockRenderProps} from "@blocknote/react";
import {useCaseEditorContext} from "./CaseEditorContext";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {
  LayoutTemplate,
  CreditCard,
  Image,
  Square,
  Maximize2,
  Minimize2,
  HardDrive,
  FileImage,
  Loader2
} from "lucide-react";
import {useAuth} from "@/context/AuthContext";
import {cn} from "@/lib/utils";
import {getOptimizedImageUrl} from "@/lib/cloudinary";

const evidenceBlockConfig = {
  type: "evidence",
  propSchema: {
    evidenceId: {default: ""},
    caption: {default: ""},
    layout: {default: "side"},
    width: {default: "full"}
  },
  content: "none",
} as const;

type EvidenceBlockProps = ReactCustomBlockRenderProps<typeof evidenceBlockConfig>;

/** Resolves the display URL of an evidence file: Cloudinary (resized) or legacy Supabase Storage (signed). */
function useEvidenceImageUrl(filePath: string | undefined, isImage: boolean) {
  const {supabase} = useAuth();
  const [signedUrl, setSignedUrl] = useState<{path: string; url: string} | null>(null);
  const isRemote = !!filePath && filePath.startsWith("http");

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
  }, [filePath, isImage, isRemote, supabase]);

  if (!filePath || !isImage) return {url: null, loading: false};
  if (isRemote) return {url: getOptimizedImageUrl(filePath, 1200), loading: false};
  const url = signedUrl?.path === filePath ? signedUrl.url : null;
  return {url, loading: !url};
}

function EvidenceBlockView({block, editor}: EvidenceBlockProps) {
  const {evidenceList, readOnly} = useCaseEditorContext();
  const {evidenceId, layout, width, caption} = block.props;
  const selectedEvidence = evidenceList.find(e => e.id === evidenceId);
  const {url: imageUrl, loading} = useEvidenceImageUrl(
    selectedEvidence?.file_path,
    selectedEvidence?.file_type === "image",
  );

  const setProps = (patch: Partial<typeof block.props>) =>
    editor.updateBlock(block, {props: {...block.props, ...patch}});

  // --- ÜRES ÁLLAPOT (Placeholder) ---
  if (!evidenceId) {
    if (readOnly) return null;
    return (
      <div
        className="my-6 p-8 bg-slate-950/30 border border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center group hover:border-[#c5a065]/50 hover:bg-slate-900/50 transition-all select-none relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
          backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)',
          backgroundSize: '10px 10px'
        }}></div>

        <div
          className="w-12 h-12 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center mb-3 group-hover:border-[#c5a065] group-hover:text-[#c5a065] text-slate-500 transition-all shadow-lg">
          <HardDrive className="w-6 h-6"/>
        </div>
        <Label
          className="mb-4 text-xs uppercase text-slate-400 font-bold tracking-widest group-hover:text-[#c5a065] transition-colors">Bizonyíték
          Beillesztése</Label>

        <Select onValueChange={(val) => setProps({evidenceId: val})}>
          <SelectTrigger
            className="w-[320px] bg-slate-950 border-slate-700 focus:ring-[#c5a065]/30 h-10 text-sm font-mono"><SelectValue
            placeholder="VÁLASSZ FÁJLT AZ AKTÁBÓL..."/></SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-800 text-white z-[9999]">
            {evidenceList.length === 0 ? <SelectItem value="none" disabled>Nincs feltöltött fájl</SelectItem> :
              evidenceList.map(e => <SelectItem key={e.id} value={e.id}
                                                className="font-mono text-xs">{e.file_type === 'image' ? '📷' : '📄'} {e.file_name}</SelectItem>)
            }
          </SelectContent>
        </Select>
      </div>
    );
  }

  const isSide = layout === 'side';
  const isBottom = layout === 'bottom';
  const isImageOnly = layout === 'image-only';
  const isCard = layout === 'card';
  const isOverlay = layout === 'overlay';
  const containerWidthClass = width === 'small' ? "w-[250px]" : width === 'half' ? "w-[48%]" : "w-full";

  const layoutButton = (value: string, Icon: typeof CreditCard) => (
    <button onClick={() => setProps({layout: value})}
            className={cn("p-1.5 rounded hover:bg-slate-800", layout === value && "text-[#c5a065] bg-slate-800")}>
      <Icon className="w-3.5 h-3.5"/>
    </button>
  );

  return (
    <div
      className={cn("my-4 relative select-none transition-all inline-block align-top mr-2", containerWidthClass, "group/evidence")}>
      {!readOnly && (
        <div
          className="absolute -top-10 left-0 right-0 flex justify-center opacity-0 group-hover/evidence:opacity-100 transition-all z-50 pb-2 pointer-events-none group-hover/evidence:pointer-events-auto">
          <div
            className="bg-slate-900 border border-slate-700 rounded shadow-xl p-1 flex gap-1 pointer-events-auto scale-90 backdrop-blur-md">
            <div className="flex gap-1 border-r border-slate-700 pr-2">
              {layoutButton('side', CreditCard)}
              {layoutButton('bottom', LayoutTemplate)}
              {layoutButton('card', Square)}
              {layoutButton('image-only', Image)}
            </div>
            <div className="flex gap-1 border-r border-slate-700 pr-2">
              <button onClick={() => setProps({width: 'full'})}
                      className={cn("p-1.5 rounded hover:bg-slate-800", width === 'full' && "text-[#c5a065]")}>
                <Maximize2 className="w-3.5 h-3.5"/></button>
              <button onClick={() => setProps({width: 'half'})}
                      className={cn("p-1.5 rounded hover:bg-slate-800", width === 'half' && "text-[#c5a065]")}>
                <Minimize2 className="w-3.5 h-3.5"/></button>
            </div>
            <button
              onClick={() => setProps({evidenceId: ""})}
              className="p-1.5 rounded hover:bg-red-900/30 text-slate-400 hover:text-red-400"><Square
              className="w-3.5 h-3.5 fill-current"/></button>
          </div>
        </div>
      )}

      <div className={cn(
        "flex gap-4 items-start rounded border transition-all duration-300 overflow-hidden",
        isSide && "flex-col md:flex-row p-3 bg-[#0a0f1c]/80 backdrop-blur-xl border-slate-800",
        isBottom && "flex-col p-3 bg-[#0a0f1c]/80 backdrop-blur-xl border-slate-800",
        isCard && "flex-col bg-slate-900 border-slate-800 shadow-md",
        isOverlay && "relative rounded overflow-hidden border-0",
        isImageOnly && "flex-col border-transparent p-0 bg-transparent"
      )}>
        <div className={cn("flex items-center justify-center overflow-hidden relative bg-black/40 rounded",
          isSide ? "w-full md:w-1/3 min-h-[120px] border border-slate-800" : "w-full",
          isOverlay && "w-full h-full rounded-none"
        )}>
          {loading ? (
            <div className="p-10 flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#c5a065]"/>
              <span className="text-[10px] text-slate-500 uppercase">Betöltés...</span>
            </div>
          ) : imageUrl ? (
            <img src={imageUrl} alt={selectedEvidence?.file_name ?? "Bizonyíték"} loading="lazy"
                 className={cn("object-contain", isImageOnly ? "max-h-[800px]" : "max-h-[500px]", isOverlay && "w-full h-auto")}/>
          ) : (
            <div className="p-6 flex flex-col items-center text-slate-600"><FileImage
              className="w-8 h-8 mb-2"/><span
              className="text-[10px] uppercase font-mono">{selectedEvidence?.file_name ?? "Törölt bizonyíték"}</span></div>
          )}
        </div>

        {!isImageOnly && (
          <div
            className={cn("flex-1 w-full min-w-0 flex flex-col justify-center", isSide && "py-1", isCard && "p-3", isOverlay && "absolute bottom-0 left-0 right-0 bg-black/80 p-3 backdrop-blur-sm")}>
            <div
              className="text-[9px] font-mono font-bold uppercase tracking-widest mb-1 text-[#c5a065]">BIZONYÍTÉK: {selectedEvidence?.file_name}</div>
            {readOnly ? (
              <p
                className={cn("text-xs leading-relaxed font-mono", isOverlay ? "text-slate-300" : "text-slate-400")}>{caption}</p>
            ) : (
              <Input value={caption} onChange={(e) => setProps({caption: e.target.value})}
                     className="bg-transparent border-none focus-visible:ring-0 px-0 h-auto py-0 text-xs font-mono text-slate-300 placeholder:text-slate-700"
                     placeholder="// Add megjegyzést..."/>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const EvidenceBlock = createReactBlockSpec(evidenceBlockConfig, {render: EvidenceBlockView});
