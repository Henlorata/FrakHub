import {Suspense, useEffect, useMemo, useState} from "react";
import {createReactBlockSpec, type ReactCustomBlockRenderProps} from "@blocknote/react";
import {Loader2, Map as MapIcon, PencilRuler, X} from "lucide-react";
import {parseSketch, serializeSketch, SKETCH_HEIGHTS} from "@/components/sketch/sketch-model";
import {SketchView} from "@/components/sketch/SketchView";
import {lazyComponent} from "@/lib/lazy";

// The editor (palette, handles) loads only when a sketch is edited.
const SketchEditor = lazyComponent(() => import("@/components/sketch/SketchEditor"), "SketchEditor");

// The stored block format: never rename the type or its props (case documents use them).
const sketchConfig = {
  type: "sketch",
  propSchema: {
    data: {default: ""},
    title: {default: "Helyszínrajz"},
    height: {default: SKETCH_HEIGHTS[1] as number},
  },
  content: "none",
} as const;

type SketchProps = ReactCustomBlockRenderProps<typeof sketchConfig>;

const SketchEditorFallback = () => (
  <div className="fixed inset-0 z-50 grid place-items-center bg-black/60"><Loader2 className="size-8 animate-spin text-slate-300"/></div>
);

/** Sketches inserted from the "/" menu open their editor at once. */
const openOnMount = new Set<string>();
export const requestSketchEditor = (blockId: string) => openOnMount.add(blockId);

function SketchBlockView({block, editor}: SketchProps) {
  const editable = editor.isEditable;
  const [editing, setEditing] = useState(() => editable && openOnMount.has(block.id));
  const sketch = useMemo(() => parseSketch(block.props.data), [block.props.data]);
  const empty = sketch.items.length === 0;

  useEffect(() => {
    openOnMount.delete(block.id);
  }, [block.id]);

  return (
    <figure className="group/sketch relative my-3 w-full select-none" contentEditable={false}>
      {editable && (
        <div className="absolute -top-3 right-0 z-30 flex gap-1 opacity-0 transition group-hover/sketch:opacity-100 focus-within:opacity-100">
          <button type="button" title="Helyszínrajz szerkesztése" onClick={() => setEditing(true)}
                  className="grid size-7 place-items-center rounded-lg border border-white/10 bg-[#0b1220]/95 text-slate-300 shadow-xl hover:text-amber-300">
            <PencilRuler className="size-3.5"/>
          </button>
          <button type="button" title="Helyszínrajz törlése" onClick={() => editor.removeBlocks([block])}
                  className="grid size-7 place-items-center rounded-lg border border-white/10 bg-[#0b1220]/95 text-slate-300 shadow-xl hover:bg-red-500/20 hover:text-red-300">
            <X className="size-3.5"/>
          </button>
        </div>
      )}
      {empty && editable ? (
        <button type="button" onClick={() => setEditing(true)}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-400/40 px-4 py-10 text-sm text-slate-400 hover:border-amber-400/50 hover:text-amber-200">
          <MapIcon className="size-6"/> Üres helyszínrajz. Kattints a rajzoláshoz.
        </button>
      ) : (
        <button type="button" disabled={!editable} onClick={() => setEditing(true)} className="block w-full text-left disabled:cursor-default"
                aria-label={editable ? "Helyszínrajz szerkesztése" : undefined}>
          <SketchView sketch={sketch} height={block.props.height} title={block.props.title}/>
        </button>
      )}
      {block.props.title && <figcaption className="mt-1.5 text-center text-xs text-slate-500 italic">{block.props.title}</figcaption>}
      {editing && (
        <Suspense fallback={<SketchEditorFallback/>}>
          <SketchEditor initial={sketch} title={block.props.title} height={block.props.height} onCancel={() => setEditing(false)}
                        onSave={(next, title, height) => {
                          editor.updateBlock(block, {props: {...block.props, data: serializeSketch(next), title, height}});
                          setEditing(false);
                        }}/>
        </Suspense>
      )}
    </figure>
  );
}

export const SketchBlock = createReactBlockSpec(sketchConfig, {render: SketchBlockView});
