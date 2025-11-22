import { createReactBlockSpec } from "@blocknote/react";
import { useCaseEditorContext } from "./CaseEditorContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Image as ImageIcon, FileText, LayoutTemplate, CreditCard, Image, Square, Maximize2, Minimize2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const EvidenceBlock = createReactBlockSpec(
  {
    type: "evidence",
    propSchema: {
      evidenceId: { default: "" },
      caption: { default: "" },
      layout: { default: "side" },
      width: { default: "full" },
    },
    content: "none",
  },
  {
    render: (props) => {
      const { evidenceList, readOnly } = useCaseEditorContext();
      const { supabase } = useAuth();
      const [imageUrl, setImageUrl] = useState<string | null>(null);

      const selectedEvidence = evidenceList.find(e => e.id === props.block.props.evidenceId);
      const { layout, width } = props.block.props;

      useEffect(() => {
        if (selectedEvidence && selectedEvidence.file_type === 'image') {
          supabase.storage.from('case_evidence').createSignedUrl(selectedEvidence.file_path, 3600)
            .then(({ data }) => { if(data) setImageUrl(data.signedUrl); });
        }
      }, [selectedEvidence]);

      if (!props.block.props.evidenceId) {
        if (readOnly) return null;
        return (
          <div className="my-4 p-6 bg-slate-900/40 border-2 border-dashed border-slate-700 rounded-xl flex flex-col items-center transition-all hover:border-yellow-500/50 hover:bg-slate-900/60 select-none group/empty">
            <ImageIcon className="w-8 h-8 text-slate-500 mb-2 opacity-50 group-hover/empty:text-yellow-500 group-hover/empty:opacity-100 transition-all" />
            <Label className="mb-3 text-xs uppercase text-slate-400 font-bold tracking-wider">Bizonyíték Beszúrása</Label>
            <Select onValueChange={(val) => props.editor.updateBlock(props.block, { props: { ...props.block.props, evidenceId: val } })}>
              <SelectTrigger className="w-[300px] bg-slate-950 border-slate-700 focus:ring-yellow-500/20"><SelectValue placeholder="Válassz a feltöltött fájlok közül..." /></SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white">
                {evidenceList.length === 0 ? (
                  <SelectItem value="none" disabled>Nincs feltöltött bizonyíték</SelectItem>
                ) : (
                  evidenceList.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.file_type === 'image' ? '📷' : '📄'} {e.file_name}</SelectItem>
                  ))
                )}
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

      const containerWidthClass =
        width === 'small' ? "w-[250px]" :
          width === 'half' ? "w-[48%]" : "w-full";

      return (
        <div className={cn("my-4 relative select-none transition-all inline-block align-top mr-2", containerWidthClass, "group/evidence")}>

          {/* --- TOOLBAR (JAVÍTVA: HOVER GAP FIX) --- */}
          {!readOnly && (
            // pb-3 adja a "hidat" a menü és a doboz között
            <div className="absolute -top-11 left-0 right-0 flex justify-center opacity-0 group-hover/evidence:opacity-100 transition-all duration-200 z-50 pb-3 pointer-events-none group-hover/evidence:pointer-events-auto">
              <div className="bg-slate-950 border border-slate-700 rounded-full shadow-2xl p-1 flex gap-1 items-center pointer-events-auto">
                <div className="flex gap-1 border-r border-slate-700 pr-2">
                  <button onClick={() => props.editor.updateBlock(props.block, { props: { ...props.block.props, layout: 'side' } })} className={cn("p-1.5 rounded-full hover:bg-slate-800 transition-colors", layout === 'side' && "text-yellow-500 bg-slate-800")} title="Oldalnézet"><CreditCard className="w-3.5 h-3.5" /></button>
                  <button onClick={() => props.editor.updateBlock(props.block, { props: { ...props.block.props, layout: 'bottom' } })} className={cn("p-1.5 rounded-full hover:bg-slate-800 transition-colors", layout === 'bottom' && "text-yellow-500 bg-slate-800")} title="Kép alatt szöveg"><LayoutTemplate className="w-3.5 h-3.5" /></button>
                  <button onClick={() => props.editor.updateBlock(props.block, { props: { ...props.block.props, layout: 'card' } })} className={cn("p-1.5 rounded-full hover:bg-slate-800", layout === 'card' && "text-yellow-500 bg-slate-800")} title="Kártya"><div className="border rounded w-3.5 h-3.5 bg-slate-700" /></button>
                  <button onClick={() => props.editor.updateBlock(props.block, { props: { ...props.block.props, layout: 'overlay' } })} className={cn("p-1.5 rounded-full hover:bg-slate-800", layout === 'overlay' && "text-yellow-500 bg-slate-800")} title="Overlay"><div className="border rounded w-3.5 h-3.5 bg-slate-500" /></button>
                  <button onClick={() => props.editor.updateBlock(props.block, { props: { ...props.block.props, layout: 'image-only' } })} className={cn("p-1.5 rounded-full hover:bg-slate-800 transition-colors", layout === 'image-only' && "text-yellow-500 bg-slate-800")} title="Csak kép"><Image className="w-3.5 h-3.5" /></button>
                </div>
                <div className="flex gap-1 border-r border-slate-700 pr-2">
                  <button onClick={() => props.editor.updateBlock(props.block, { props: { ...props.block.props, width: 'full' } })} className={cn("p-1.5 rounded-full hover:bg-slate-800", width === 'full' && "text-yellow-500")} title="Teljes"><Maximize2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => props.editor.updateBlock(props.block, { props: { ...props.block.props, width: 'half' } })} className={cn("p-1.5 rounded-full hover:bg-slate-800", width === 'half' && "text-yellow-500")} title="Fél"><Minimize2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => props.editor.updateBlock(props.block, { props: { ...props.block.props, width: 'small' } })} className={cn("p-1.5 rounded-full hover:bg-slate-800", width === 'small' && "text-yellow-500")} title="Kicsi"><Square className="w-3 h-3" /></button>
                </div>
                <button onClick={() => props.editor.updateBlock(props.block, { props: { ...props.block.props, evidenceId: "" } })} className="p-1.5 rounded-full hover:bg-red-900/30 text-slate-400 hover:text-red-400"><Square className="w-3.5 h-3.5 fill-current" /></button>
              </div>
            </div>
          )}

          {/* TARTALOM KONTÉNER */}
          <div className={cn(
            "flex gap-4 items-start rounded-xl border transition-all duration-300 overflow-hidden",
            isSide && "flex-col md:flex-row p-3 bg-slate-950/40 border-slate-800/60",
            isBottom && "flex-col p-4 bg-slate-950/40 border-slate-800/60",
            isCard && "flex-col bg-slate-900 border-slate-800 shadow-md",
            isOverlay && "relative rounded-xl overflow-hidden border-0",
            isImageOnly && "flex-col border-transparent p-0 bg-transparent"
          )}>

            {/* KÉP */}
            <div className={cn(
              "flex items-center justify-center overflow-hidden relative transition-all duration-300",
              !isImageOnly && !isOverlay && "bg-black/30 rounded-lg",
              isSide ? "w-full md:w-1/3 min-h-[120px] border border-slate-800/50" : "w-full",
              (isBottom || isCard) && "border border-slate-800/50",
              isCard && "rounded-none border-x-0 border-t-0 border-b",
              isOverlay && "w-full h-full"
            )}>
              {selectedEvidence?.file_type === 'image' && imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Evidence"
                  className={cn(
                    "object-contain transition-all duration-300",
                    isImageOnly ? "w-full max-h-[800px]" : "max-h-[500px]",
                    isCard && "max-h-[400px]",
                    isOverlay && "w-full h-auto"
                  )}
                />
              ) : (
                <div className="p-8 flex flex-col items-center text-slate-500">
                  <FileText className="w-12 h-12 mb-2" />
                  <span className="text-xs">{selectedEvidence?.file_name || "Törölt fájl"}</span>
                </div>
              )}
            </div>

            {/* SZÖVEG */}
            {!isImageOnly && (
              <div className={cn(
                "flex-1 w-full min-w-0 flex flex-col justify-center",
                isSide && "py-1",
                isCard && "p-4",
                isOverlay && "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 pt-12"
              )}>
                <div className={cn(
                  "text-[10px] font-mono font-bold uppercase tracking-wider mb-1",
                  isOverlay ? "text-yellow-400" : "text-yellow-600"
                )}>
                  {selectedEvidence?.file_name}
                </div>

                {readOnly ? (
                  <p className={cn("text-sm leading-relaxed whitespace-pre-wrap", isOverlay ? "text-white text-shadow" : "text-slate-300")}>
                    {props.block.props.caption}
                  </p>
                ) : (
                  <Input
                    value={props.block.props.caption}
                    onChange={(e) => props.editor.updateBlock(props.block, { props: { ...props.block.props, caption: e.target.value } })}
                    className={cn(
                      "bg-transparent border-none focus-visible:ring-0 px-0 h-auto py-1 text-sm",
                      isOverlay ? "text-white placeholder:text-white/50" : "text-slate-300 placeholder:text-slate-600"
                    )}
                    placeholder="Képaláírás..."
                  />
                )}
              </div>
            )}
          </div>
        </div>
      );
    },
  }
);