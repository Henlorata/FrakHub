import {useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent} from "react";
import {
  ArrowDownToLine, ArrowUpToLine, Bike, Car, Copy, Crosshair, Hash, Home, MoveUpRight, Redo2, Save, Shield, Siren, Square, Trash2, TreePine,
  Truck, Type, Undo2, User, Waypoints,
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Switch} from "@/components/ui/switch";
import {Dialog, DialogContent, DialogDescription, DialogTitle} from "@/components/ui/dialog";
import {useUndoable} from "@/lib/use-undoable";
import {cn} from "@/lib/utils";
import {
  newItem, rotatePoint, SKETCH_COLORS, SKETCH_HEIGHTS, SKETCH_KINDS, SKETCH_WIDTH, type Sketch, type SketchItem, type SketchKind,
} from "./sketch-model";
import {itemExtent, SketchItemGraphic, SketchPaper, sketchColors} from "./SketchView";

const PALETTE: {kind: SketchKind; icon: typeof Car}[] = [
  {kind: "car", icon: Car}, {kind: "police", icon: Siren}, {kind: "truck", icon: Truck}, {kind: "bike", icon: Bike},
  {kind: "person", icon: User}, {kind: "officer", icon: Shield},
  {kind: "road", icon: Waypoints}, {kind: "building", icon: Home}, {kind: "zone", icon: Square}, {kind: "tree", icon: TreePine},
  {kind: "arrow", icon: MoveUpRight}, {kind: "text", icon: Type}, {kind: "marker", icon: Hash}, {kind: "shot", icon: Crosshair},
];

const newItemId = () => Math.random().toString(36).slice(2, 10);
const COLOURED = new Set<SketchKind>(["car", "truck", "bike", "person", "zone", "arrow", "text"]);
const HEIGHT_LABELS = ["Alacsony", "Közepes", "Magas"];

type Drag =
  | {kind: "move"; lastX: number; lastY: number; moved: boolean}
  | {kind: "rotate"}
  | {kind: "resize"}
  | {kind: "end"; which: "start" | "end"};

/**
 * The scene sketch editor: pick elements from the palette, drag them into place, turn them with the
 * round handle, resize roads, buildings and areas from the corner, and label them. Saved as JSON in
 * the document's sketch block.
 */
export function SketchEditor({initial, title: initialTitle, height: initialHeight, onCancel, onSave}: {
  initial: Sketch;
  title: string;
  height: number;
  onCancel: () => void;
  onSave: (sketch: Sketch, title: string, height: number) => void;
}) {
  const history = useUndoable<Sketch>(initial);
  const sketch = history.value;
  const [selected, setSelected] = useState<string | null>(null);
  const [title, setTitle] = useState(initialTitle);
  const [height, setHeight] = useState(SKETCH_HEIGHTS.includes(initialHeight as typeof SKETCH_HEIGHTS[number]) ? initialHeight : SKETCH_HEIGHTS[1]);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const base = useId().replace(/:/g, "");
  const ids = {hatch: `${base}-hatch`, head: `${base}-head`, grid: `${base}-grid`};
  const colors = useMemo(() => [...new Set([...SKETCH_COLORS, ...sketchColors(sketch)])], [sketch]);
  const item = sketch.items.find((entry) => entry.id === selected) ?? null;

  const toSketch = (event: {clientX: number; clientY: number}) => {
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return {x: 0, y: 0};
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
    return {x: Math.min(SKETCH_WIDTH + 100, Math.max(-100, point.x)), y: Math.min(height + 100, Math.max(-100, point.y))};
  };

  const update = (id: string, patch: Partial<SketchItem>, live = false) => {
    const apply = (current: Sketch) => ({...current, items: current.items.map((entry) => (entry.id === id ? {...entry, ...patch} : entry))});
    if (live) history.replace(apply);
    else history.set(apply);
  };

  const add = (kind: SketchKind) => {
    // New items spread over the paper (a 5 × 3 grid of spots) instead of piling up in the middle;
    // roads, buildings, areas and trees go behind everything else.
    const spot = sketch.items.length % 15;
    const boxed = !!SKETCH_KINDS[kind].box;
    const x = boxed ? SKETCH_WIDTH / 2 : 160 + (spot % 5) * 170;
    const y = Math.round(height * (0.25 + Math.floor(spot / 5) * 0.25));
    const created = newItem(kind, x, y, sketch.items);
    const behind = boxed || kind === "tree";
    history.set((current) => ({...current, items: behind ? [created, ...current.items] : [...current.items, created]}));
    setSelected(created.id);
  };

  const remove = () => {
    if (!selected) return;
    history.set((current) => ({...current, items: current.items.filter((entry) => entry.id !== selected)}));
    setSelected(null);
  };

  const duplicate = () => {
    if (!item) return;
    const copy = {...item, id: newItemId(), x: item.x + 30, y: item.y + 30,
      ...(item.x2 !== undefined ? {x2: item.x2 + 30, y2: (item.y2 ?? item.y) + 30} : {})};
    history.set((current) => ({...current, items: [...current.items, copy]}));
    setSelected(copy.id);
  };

  const reorder = (toFront: boolean) => {
    if (!item) return;
    history.set((current) => {
      const others = current.items.filter((entry) => entry.id !== item.id);
      return {...current, items: toFront ? [...others, item] : [item, ...others]};
    });
  };

  const onItemDown = (event: ReactPointerEvent, target: SketchItem) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    setSelected(target.id);
    const {x, y} = toSketch(event);
    drag.current = {kind: "move", lastX: x, lastY: y, moved: false};
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const onHandleDown = (event: ReactPointerEvent, mode: Drag) => {
    event.stopPropagation();
    drag.current = mode;
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const onMove = (event: ReactPointerEvent) => {
    const state = drag.current;
    if (!state || !item) return;
    const {x, y} = toSketch(event);
    if (state.kind === "move") {
      const dx = x - state.lastX;
      const dy = y - state.lastY;
      if (!dx && !dy) return;
      state.lastX = x;
      state.lastY = y;
      state.moved = true;
      update(item.id, {x: item.x + dx, y: item.y + dy, ...(item.x2 !== undefined ? {x2: item.x2 + dx, y2: (item.y2 ?? item.y) + dy} : {})}, true);
    } else if (state.kind === "rotate") {
      const angle = (Math.atan2(y - item.y, x - item.x) * 180) / Math.PI + 90;
      const snapped = event.altKey ? angle : Math.round(angle / 15) * 15;
      update(item.id, {rotation: ((snapped % 360) + 360) % 360}, true);
    } else if (state.kind === "resize") {
      const [localX, localY] = rotatePoint(x, y, item.x, item.y, -(item.rotation || 0));
      update(item.id, {w: Math.max(30, Math.abs(localX - item.x) * 2), h: Math.max(24, Math.abs(localY - item.y) * 2)}, true);
    } else if (state.kind === "end") {
      update(item.id, state.which === "start" ? {x, y} : {x2: x, y2: y}, true);
    }
  };

  const onUp = () => {
    const state = drag.current;
    drag.current = null;
    if (!state) return;
    if (state.kind !== "move" || state.moved) history.commit();
  };

  // Delete, undo/redo, duplicate and nudging with the arrow keys (not while typing).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "z") {
        event.preventDefault();
        if (event.shiftKey) history.redo();
        else history.undo();
      } else if ((event.ctrlKey || event.metaKey) && key === "y") {
        event.preventDefault();
        history.redo();
      } else if ((event.ctrlKey || event.metaKey) && key === "d" && item) {
        event.preventDefault();
        duplicate();
      } else if ((key === "delete" || key === "backspace") && item) {
        event.preventDefault();
        remove();
      } else if (item && key.startsWith("arrow")) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 2;
        const dx = key === "arrowleft" ? -step : key === "arrowright" ? step : 0;
        const dy = key === "arrowup" ? -step : key === "arrowdown" ? step : 0;
        update(item.id, {x: item.x + dx, y: item.y + dy, ...(item.x2 !== undefined ? {x2: item.x2 + dx, y2: (item.y2 ?? item.y) + dy} : {})});
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const meta = item ? SKETCH_KINDS[item.kind] : null;
  const groups = ["Járművek", "Személyek", "Környezet", "Jelölések"] as const;

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent showCloseButton={false} onEscapeKeyDown={(event) => {
        if (selected) {
          event.preventDefault();
          setSelected(null);
        }
      }} className="flex h-[100dvh] max-h-none w-screen max-w-none flex-col gap-0 rounded-none border-0 bg-[#060b16]/95 p-0 backdrop-blur-xl sm:max-w-none">
        <DialogTitle className="sr-only">Helyszínrajz szerkesztése</DialogTitle>
        <DialogDescription className="sr-only">Járművek, személyek, utak, épületek, nyilak és jelölések a helyszínrajzon.</DialogDescription>

        <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2">
          <Input value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} aria-label="A rajz címe"
                 className="h-9 w-full sm:w-72" placeholder="Helyszínrajz"/>
          <div className="flex items-center gap-1 rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/10" aria-label="Magasság">
            {SKETCH_HEIGHTS.map((value, index) => (
              <button key={value} type="button" aria-pressed={height === value} onClick={() => setHeight(value)}
                      className={cn("h-7 rounded-lg px-2.5 text-xs transition", height === value ? "bg-white/15 text-white" : "text-slate-400 hover:bg-white/10")}>
                {HEIGHT_LABELS[index]}
              </button>
            ))}
          </div>
          <Button size="icon" variant="ghost" aria-label="Visszavonás (Ctrl+Z)" title="Visszavonás (Ctrl+Z)" disabled={!history.canUndo} onClick={history.undo}>
            <Undo2 className="size-4"/>
          </Button>
          <Button size="icon" variant="ghost" aria-label="Újra (Ctrl+Y)" title="Újra (Ctrl+Y)" disabled={!history.canRedo} onClick={history.redo}>
            <Redo2 className="size-4"/>
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" onClick={onCancel}>Mégse</Button>
            <Button onClick={() => onSave(sketch, title.trim() || "Helyszínrajz", height)} className="bg-amber-500 text-black hover:bg-amber-400">
              <Save className="size-4"/> Kész
            </Button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[13rem_minmax(0,1fr)_16rem] lg:overflow-hidden">
          <nav className="flex gap-1 overflow-x-auto border-b border-white/10 p-2 lg:flex-col lg:overflow-y-auto lg:border-r lg:border-b-0" aria-label="Elemek">
            {groups.map((group) => (
              <div key={group} className="flex shrink-0 gap-1 lg:flex-col">
                <p className="hidden px-2 pt-2 pb-1 text-[10px] font-semibold tracking-[0.18em] text-slate-500 uppercase lg:block">{group}</p>
                {PALETTE.filter((entry) => SKETCH_KINDS[entry.kind].group === group).map((entry) => (
                  <button key={entry.kind} type="button" onClick={() => add(entry.kind)}
                          className="flex h-9 shrink-0 items-center gap-2 rounded-lg px-2.5 text-sm text-slate-200 ring-1 ring-white/10 transition hover:bg-white/10 lg:ring-0">
                    <entry.icon className="size-4 text-amber-300"/> {SKETCH_KINDS[entry.kind].label}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div className="flex min-h-0 items-start justify-center overflow-auto p-3 lg:items-center">
            <svg ref={svgRef} viewBox={`0 0 ${SKETCH_WIDTH} ${height}`} data-testid="sketch-canvas"
                 className="h-auto w-full max-w-[1100px] touch-none rounded-lg shadow-2xl ring-1 ring-white/10 select-none"
                 onPointerDown={(event) => event.button === 0 && setSelected(null)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
              <SketchPaper height={height} ids={ids} colors={colors}>
                {sketch.items.map((entry) => (
                  <SketchItemGraphic key={entry.id} item={entry} ids={ids} onPointerDown={onItemDown} selected={entry.id === selected}>
                    {entry.id === selected && entry.kind !== "arrow" && SKETCH_KINDS[entry.kind].rotates && (() => {
                      const {hh} = itemExtent(entry);
                      return (
                        <g>
                          <line x1={0} y1={-hh} x2={0} y2={-hh - 22} stroke="#0ea5e9" strokeWidth={1.5}/>
                          <circle cx={0} cy={-hh - 26} r={7} fill="#ffffff" stroke="#0ea5e9" strokeWidth={2} style={{cursor: "grab"}}
                                  aria-label="Forgatás" onPointerDown={(event) => onHandleDown(event, {kind: "rotate"})}/>
                        </g>
                      );
                    })()}
                    {entry.id === selected && SKETCH_KINDS[entry.kind].box && (
                      <rect x={(entry.w ?? 100) / 2 - 6} y={(entry.h ?? 100) / 2 - 6} width={12} height={12} rx={2} fill="#ffffff" stroke="#0ea5e9"
                            strokeWidth={2} style={{cursor: "nwse-resize"}} onPointerDown={(event) => onHandleDown(event, {kind: "resize"})}/>
                    )}
                  </SketchItemGraphic>
                ))}
                {item?.kind === "arrow" && (
                  <g>
                    {([["start", item.x, item.y], ["end", item.x2 ?? item.x, item.y2 ?? item.y]] as const).map(([which, cx, cy]) => (
                      <circle key={which} cx={cx} cy={cy} r={8} fill="#ffffff" stroke="#0ea5e9" strokeWidth={2} style={{cursor: "crosshair"}}
                              onPointerDown={(event) => onHandleDown(event, {kind: "end", which})}/>
                    ))}
                  </g>
                )}
              </SketchPaper>
            </svg>
          </div>

          <aside className="space-y-4 border-t border-white/10 p-3 lg:overflow-y-auto lg:border-t-0 lg:border-l">
            {!item || !meta ? (
              <div className="space-y-2 text-sm text-slate-400">
                <p className="font-medium text-slate-200">{sketch.items.length} elem a rajzon</p>
                <p>Válassz elemet a bal oldali listából, majd húzd a helyére. A kék kör forgat, a sarokpont átméretez.</p>
                <p className="text-xs text-slate-500">Billentyűk: Delete törlés, Ctrl+D másolás, nyilak mozgatás (Shift: nagyobb lépés), Ctrl+Z visszavonás.</p>
              </div>
            ) : (
              <>
                <p className="text-sm font-semibold text-white">{meta.label}</p>
                <div className="space-y-1.5">
                  <Label htmlFor="sketch-label">{item.kind === "text" ? "Szöveg" : "Felirat"}</Label>
                  <Input id="sketch-label" value={item.label ?? ""} maxLength={60} placeholder={item.kind === "car" ? "pl. A jármű, SF-4821" : "pl. 1. gyanúsított"}
                         onChange={(event) => update(item.id, {label: event.target.value}, true)} onBlur={history.commit}/>
                </div>
                {COLOURED.has(item.kind) && (
                  <div className="space-y-1.5">
                    <Label>Szín</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {SKETCH_COLORS.map((value) => (
                        <button key={value} type="button" aria-label={`Szín: ${value}`} aria-pressed={item.color === value}
                                onClick={() => update(item.id, {color: value})}
                                className={cn("size-7 rounded-full ring-2 transition", item.color === value ? "ring-white" : "ring-white/10 hover:ring-white/40")}
                                style={{background: value}}/>
                      ))}
                    </div>
                  </div>
                )}
                {meta.rotates && item.kind !== "arrow" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="sketch-rotation">Elforgatás: {Math.round(item.rotation || 0)}°</Label>
                    <input id="sketch-rotation" type="range" min={0} max={359} step={1} value={Math.round(item.rotation || 0)} className="w-full accent-amber-400"
                           onChange={(event) => update(item.id, {rotation: Number(event.target.value)}, true)} onPointerUp={history.commit}
                           onKeyUp={history.commit}/>
                  </div>
                )}
                {item.kind === "marker" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="sketch-number">Sorszám</Label>
                    <Input id="sketch-number" type="number" min={1} max={999} value={item.n ?? 1}
                           onChange={(event) => update(item.id, {n: Math.max(1, Math.min(999, Number(event.target.value) || 1))})}/>
                  </div>
                )}
                {item.kind === "arrow" && (
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <Switch checked={!!item.dashed} onCheckedChange={(dashed) => update(item.id, {dashed})}/> Szaggatott (útvonal)
                  </label>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="outline" onClick={duplicate}><Copy className="size-4"/> Másolás</Button>
                  <Button size="sm" variant="outline" onClick={remove} className="text-red-300"><Trash2 className="size-4"/> Törlés</Button>
                  <Button size="sm" variant="ghost" onClick={() => reorder(true)}><ArrowUpToLine className="size-4"/> Előre</Button>
                  <Button size="sm" variant="ghost" onClick={() => reorder(false)}><ArrowDownToLine className="size-4"/> Hátra</Button>
                </div>
              </>
            )}
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
