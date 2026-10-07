import {useCallback, useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent} from "react";
import {toast} from "sonner";
import {
  Circle, Crop, Grid3x3, Hash, Loader2, MousePointer2, MoveUpRight, PenLine, Redo2, Save, Square, Trash2, Type, Undo2, X,
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Dialog, DialogContent, DialogDescription, DialogTitle} from "@/components/ui/dialog";
import {useUndoable} from "@/lib/use-undoable";
import {cn, errorMessage} from "@/lib/utils";
import {
  ANNOTATION_COLORS, arrowHead, boxFrom, moveShape, renderAnnotated, sizesFor, type AnnotationTool, type Box, type Shape,
} from "./annotations";

const TOOLS: {tool: AnnotationTool; label: string; key: string; icon: typeof Square; hint: string}[] = [
  {tool: "select", label: "Kijelölés", key: "v", icon: MousePointer2, hint: "Kattints egy jelölésre: húzva mozgathatod, a Delete törli. A szövegre duplán kattintva átírhatod."},
  {tool: "arrow", label: "Nyíl", key: "a", icon: MoveUpRight, hint: "Húzd a nyilat a kezdőponttól a hegyéig."},
  {tool: "rect", label: "Téglalap", key: "r", icon: Square, hint: "Húzással keretezd be a fontos részt."},
  {tool: "ellipse", label: "Ellipszis", key: "e", icon: Circle, hint: "Húzással karikázd be a fontos részt."},
  {tool: "pen", label: "Toll", key: "p", icon: PenLine, hint: "Rajzolj szabadkézzel."},
  {tool: "text", label: "Szöveg", key: "t", icon: Type, hint: "Kattints oda, ahová a feliratot írnád, majd Enter."},
  {tool: "marker", label: "Számozás", key: "n", icon: Hash, hint: "Kattintásonként számozott jelölő: 1, 2, 3…"},
  {tool: "redact", label: "Kitakarás", key: "b", icon: Grid3x3, hint: "Húzással takard ki a személyes adatot: a mentett képen pixeles lesz."},
  {tool: "crop", label: "Vágás", key: "c", icon: Crop, hint: "Húzással jelöld ki a megtartandó részt."},
];

interface Drawing {
  shapes: Shape[];
  crop: Box | null;
}

type Drag =
  | {kind: "draw"; startX: number; startY: number}
  | {kind: "move"; lastX: number; lastY: number; moved: boolean};

const shapeId = () => Math.random().toString(36).slice(2, 10);
const clock = () => Date.now();
/** "x1,y1 x2,y2 …" from a flat list of coordinates. */
const polylinePoints = (points: number[]) => {
  const pairs: string[] = [];
  for (let index = 0; index + 1 < points.length; index += 2) pairs.push(`${points[index]},${points[index + 1]}`);
  return pairs.join(" ");
};
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** The bounding box of a shape (selection outline, text estimated). */
function bounds(shape: Shape): Box {
  switch (shape.kind) {
    case "arrow":
      return boxFrom(shape.x1, shape.y1, shape.x2, shape.y2);
    case "pen": {
      const xs = shape.points.filter((_, index) => index % 2 === 0);
      const ys = shape.points.filter((_, index) => index % 2 === 1);
      return boxFrom(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
    }
    case "text":
      return {x: shape.x, y: shape.y - shape.size * 0.6, w: Math.max(shape.size, shape.text.length * shape.size * 0.58), h: shape.size * 1.2};
    case "marker":
      return {x: shape.x - shape.size, y: shape.y - shape.size, w: shape.size * 2, h: shape.size * 2};
    default:
      return {x: shape.x, y: shape.y, w: shape.w, h: shape.h};
  }
}

/**
 * Draws on a picture before it becomes evidence (or onto a copy of an existing one): arrows, boxes,
 * circles, free lines, labels, numbered markers, pixelated redactions and a crop. Saving bakes the
 * drawing into a new picture; the original is never changed.
 */
export function ImageAnnotator({src, name, onCancel, onSave}: {
  src: string;
  /** The picture's name (the saved file is named after it). */
  name: string;
  onCancel: () => void;
  onSave: (file: File) => Promise<void> | void;
}) {
  const [image, setImage] = useState<{element: HTMLImageElement; w: number; h: number} | null>(null);
  const [failed, setFailed] = useState(false);
  const history = useUndoable<Drawing>({shapes: [], crop: null});
  const {shapes, crop} = history.value;
  const [tool, setTool] = useState<AnnotationTool>("arrow");
  const [color, setColor] = useState(ANNOTATION_COLORS[0]);
  const [size, setSize] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [cropDraft, setCropDraft] = useState<Box | null>(null);
  const [text, setText] = useState<{token: string; id: string | null; x: number; y: number; left: number; top: number; value: string} | null>(null);
  // A label is committed once (Enter blurs the field, and the blur commits); Escape drops it.
  const finishedText = useRef<string | null>(null);
  const cancelText = useRef(false);
  // The click that closed a label (by blurring it) does not open a new one.
  const closedAt = useRef(0);
  const [saving, setSaving] = useState(false);
  const [displayWidth, setDisplayWidth] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const clipBase = useId().replace(/:/g, "");

  useEffect(() => {
    let active = true;
    const element = new Image();
    element.crossOrigin = "anonymous";
    element.onload = () => active && setImage({element, w: element.naturalWidth, h: element.naturalHeight});
    element.onerror = () => active && setFailed(true);
    element.src = src;
    return () => {
      active = false;
    };
  }, [src]);

  // The picture's pixels per screen pixel (hit areas and handles stay the same size on screen).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(() => setDisplayWidth(svg.getBoundingClientRect().width));
    observer.observe(svg);
    return () => observer.disconnect();
  }, [image]);

  const sizes = useMemo(() => (image ? sizesFor(image.w, image.h) : {stroke: [3, 5, 9], text: [16, 24, 36], marker: [12, 16, 22]}), [image]);
  const unit = image && displayWidth ? image.w / displayWidth : 1;
  const nextNumber = shapes.reduce((max, shape) => (shape.kind === "marker" ? Math.max(max, shape.n) : max), 0) + 1;

  const toImage = (event: {clientX: number; clientY: number}) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm || !image) return {x: 0, y: 0};
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
    return {x: clamp(point.x, 0, image.w), y: clamp(point.y, 0, image.h)};
  };

  const setShapes = (next: (current: Shape[]) => Shape[]) => history.set((current) => ({...current, shapes: next(current.shapes)}));

  const commitText = useCallback(() => {
    if (!text || finishedText.current === text.token) return;
    finishedText.current = text.token;
    closedAt.current = clock();
    if (cancelText.current) {
      cancelText.current = false;
      setText(null);
      return;
    }
    const value = text.value.trim();
    if (text.id) {
      history.set((current) => ({...current, shapes: value
        ? current.shapes.map((shape) => (shape.id === text.id && shape.kind === "text" ? {...shape, text: value} : shape))
        : current.shapes.filter((shape) => shape.id !== text.id)}));
    } else if (value) {
      history.set((current) => ({...current, shapes: [...current.shapes, {id: shapeId(), kind: "text", x: text.x, y: text.y, text: value, color,
        size: sizes.text[size]}]}));
    }
    setText(null);
  }, [text, history, color, sizes, size]);

  const startText = (event: {clientX: number; clientY: number}, x: number, y: number, shape?: Extract<Shape, {kind: "text"}>) => {
    const stage = stageRef.current?.getBoundingClientRect();
    setText({token: shapeId(), id: shape?.id ?? null, x, y, value: shape?.text ?? "",
      left: event.clientX - (stage?.left ?? 0), top: event.clientY - (stage?.top ?? 0)});
  };

  const onDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    // A click beside an open label only closes it (the field's blur commits it).
    if (!image || event.button !== 0 || text) return;
    const {x, y} = toImage(event);
    const width = sizes.stroke[size];
    switch (tool) {
      case "select":
        setSelected(null);
        return;
      case "text":
        // Opened on click (below): a field focused on pointerdown would lose the focus to the mouse.
        return;
      case "marker":
        setShapes((current) => [...current, {id: shapeId(), kind: "marker", x, y, n: nextNumber, color, size: sizes.marker[size]}]);
        return;
      case "arrow":
        setDraft({id: shapeId(), kind: "arrow", x1: x, y1: y, x2: x, y2: y, color, width});
        break;
      case "pen":
        setDraft({id: shapeId(), kind: "pen", points: [x, y], color, width});
        break;
      case "crop":
        setCropDraft({x, y, w: 0, h: 0});
        break;
      default:
        setDraft({id: shapeId(), kind: tool, x, y, w: 0, h: 0, color, width});
    }
    drag.current = {kind: "draw", startX: x, startY: y};
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const state = drag.current;
    if (!state || !image) return;
    const {x, y} = toImage(event);
    if (state.kind === "move") {
      const dx = x - state.lastX;
      const dy = y - state.lastY;
      if (dx === 0 && dy === 0) return;
      state.lastX = x;
      state.lastY = y;
      state.moved = true;
      history.replace((current) => ({...current, shapes: current.shapes.map((shape) => (shape.id === selected ? moveShape(shape, dx, dy) : shape))}));
      return;
    }
    if (tool === "crop") {
      setCropDraft(boxFrom(state.startX, state.startY, x, y));
      return;
    }
    setDraft((current) => {
      if (!current) return current;
      if (current.kind === "arrow") return {...current, x2: x, y2: y};
      if (current.kind === "pen") {
        const lastX = current.points[current.points.length - 2];
        const lastY = current.points[current.points.length - 1];
        // A point every couple of screen pixels keeps the line smooth and light.
        return Math.hypot(x - lastX, y - lastY) < 2 * unit ? current : {...current, points: [...current.points, x, y]};
      }
      if (current.kind === "rect" || current.kind === "ellipse" || current.kind === "redact") {
        return {...current, ...boxFrom(state.startX, state.startY, x, y)};
      }
      return current;
    });
  };

  const onUp = () => {
    const state = drag.current;
    drag.current = null;
    if (!state) return;
    if (state.kind === "move") {
      if (state.moved) history.commit();
      return;
    }
    const minimum = 6 * unit;
    if (tool === "crop") {
      if (cropDraft && cropDraft.w >= minimum && cropDraft.h >= minimum) history.set((current) => ({...current, crop: cropDraft}));
      setCropDraft(null);
      return;
    }
    if (draft) {
      const big = draft.kind === "arrow" ? Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) >= minimum
        : draft.kind === "pen" ? draft.points.length >= 4
          : draft.kind === "rect" || draft.kind === "ellipse" || draft.kind === "redact" ? draft.w >= minimum && draft.h >= minimum : true;
      if (big) setShapes((current) => [...current, draft]);
    }
    setDraft(null);
  };

  const onClick = (event: {clientX: number; clientY: number}) => {
    if (tool !== "text" || text || clock() - closedAt.current < 400) return;
    const {x, y} = toImage(event);
    startText(event, x, y);
  };

  const onShapeDown = (event: ReactPointerEvent, shape: Shape) => {
    if (tool !== "select" || event.button !== 0) return;
    event.stopPropagation();
    setSelected(shape.id);
    const {x, y} = toImage(event);
    drag.current = {kind: "move", lastX: x, lastY: y, moved: false};
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const removeSelected = useCallback(() => {
    if (!selected) return;
    history.set((current) => ({...current, shapes: current.shapes.filter((shape) => shape.id !== selected)}));
    setSelected(null);
  }, [selected, history]);

  // Shortcuts: tools by letter, undo/redo, delete (not while typing a label).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (text || (event.target instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(event.target.tagName))) return;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "z") {
        event.preventDefault();
        if (event.shiftKey) history.redo();
        else history.undo();
      } else if ((event.ctrlKey || event.metaKey) && key === "y") {
        event.preventDefault();
        history.redo();
      } else if ((key === "delete" || key === "backspace") && selected) {
        event.preventDefault();
        removeSelected();
      } else if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        const match = TOOLS.find((item) => item.key === key);
        if (match) setTool(match.tool);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [text, selected, history, removeSelected]);

  const save = async () => {
    if (!image) return;
    setSaving(true);
    try {
      const blob = await renderAnnotated(image.element, image.w, image.h, shapes, crop);
      const base = name.replace(/\.[^.]+$/, "") || "kep";
      await onSave(new File([blob], `${base}-jelolt.${blob.type === "image/webp" ? "webp" : "png"}`, {type: blob.type, lastModified: Date.now()}));
    } catch (error) {
      toast.error(errorMessage(error, "A kép mentése nem sikerült."));
      setSaving(false);
    }
  };

  const hint = TOOLS.find((item) => item.tool === tool)?.hint;
  const all = draft ? [...shapes, draft] : shapes;
  const hit = Math.max(10 * unit, 6);
  const selectedShape = shapes.find((shape) => shape.id === selected) ?? null;

  const renderShape = (shape: Shape, preview: boolean) => {
    const common = {onPointerDown: preview ? undefined : (event: ReactPointerEvent) => onShapeDown(event, shape),
      style: {cursor: tool === "select" ? "move" : undefined}};
    switch (shape.kind) {
      case "arrow": {
        const head = arrowHead(shape.x1, shape.y1, shape.x2, shape.y2, shape.width);
        return (
          <g key={shape.id} {...common}>
            <line x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} stroke="transparent" strokeWidth={Math.max(hit, shape.width)}/>
            <line x1={shape.x1} y1={shape.y1} x2={(head[1][0] + head[2][0]) / 2} y2={(head[1][1] + head[2][1]) / 2} stroke={shape.color}
                  strokeWidth={shape.width} strokeLinecap="round"/>
            <polygon points={head.map((point) => point.join(",")).join(" ")} fill={shape.color}/>
          </g>
        );
      }
      case "rect":
        return (
          <g key={shape.id} {...common}>
            <rect x={shape.x} y={shape.y} width={shape.w} height={shape.h} fill="none" stroke="transparent" strokeWidth={Math.max(hit, shape.width)}/>
            <rect x={shape.x} y={shape.y} width={shape.w} height={shape.h} fill="none" stroke={shape.color} strokeWidth={shape.width}/>
          </g>
        );
      case "ellipse":
        return (
          <g key={shape.id} {...common}>
            <ellipse cx={shape.x + shape.w / 2} cy={shape.y + shape.h / 2} rx={shape.w / 2} ry={shape.h / 2} fill="none" stroke="transparent"
                     strokeWidth={Math.max(hit, shape.width)}/>
            <ellipse cx={shape.x + shape.w / 2} cy={shape.y + shape.h / 2} rx={shape.w / 2} ry={shape.h / 2} fill="none" stroke={shape.color}
                     strokeWidth={shape.width}/>
          </g>
        );
      case "pen": {
        const points = polylinePoints(shape.points);
        return (
          <g key={shape.id} {...common}>
            <polyline points={points} fill="none" stroke="transparent" strokeWidth={Math.max(hit, shape.width)} strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points={points} fill="none" stroke={shape.color} strokeWidth={shape.width} strokeLinecap="round" strokeLinejoin="round"/>
          </g>
        );
      }
      case "redact":
        return (
          <g key={shape.id} {...common}>
            <clipPath id={`${clipBase}-${shape.id}`}><rect x={shape.x} y={shape.y} width={shape.w} height={shape.h}/></clipPath>
            {image && <image href={src} width={image.w} height={image.h} clipPath={`url(#${clipBase}-${shape.id})`} filter={`url(#${clipBase}-blur)`}/>}
            <rect x={shape.x} y={shape.y} width={shape.w} height={shape.h} fill="rgb(0 0 0 / 0.15)" stroke="#e2e8f0" strokeWidth={unit * 1.5}
                  strokeDasharray={`${unit * 6} ${unit * 4}`}/>
          </g>
        );
      case "text":
        return (
          <text key={shape.id} {...common} x={shape.x} y={shape.y} fontSize={shape.size} fontWeight={700} dominantBaseline="middle"
                fontFamily="Inter, system-ui, sans-serif" fill={shape.color} paintOrder="stroke" strokeLinejoin="round"
                stroke={shape.color === "#111827" ? "rgb(255 255 255 / 0.9)" : "rgb(0 0 0 / 0.85)"} strokeWidth={Math.max(2, shape.size * 0.18)}
                onDoubleClick={(event) => tool === "select" && startText(event, shape.x, shape.y, shape)}>
            {shape.text}
          </text>
        );
      case "marker":
        return (
          <g key={shape.id} {...common}>
            <circle cx={shape.x} cy={shape.y} r={shape.size} fill={shape.color} stroke="#ffffff" strokeWidth={Math.max(2, shape.size * 0.16)}/>
            <text x={shape.x} y={shape.y + shape.size * 0.05} fontSize={shape.size * 1.1} fontWeight={800} textAnchor="middle" dominantBaseline="middle"
                  fontFamily="Inter, system-ui, sans-serif" fill={shape.color === "#ffffff" || shape.color === "#facc15" ? "#111827" : "#ffffff"}>
              {shape.n}
            </text>
          </g>
        );
      default:
        return null;
    }
  };

  const shownCrop = cropDraft ?? crop;

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onCancel()}>
      <DialogContent showCloseButton={false} onEscapeKeyDown={(event) => (text || saving) && event.preventDefault()}
                     className="flex h-[100dvh] max-h-none w-screen max-w-none flex-col gap-0 rounded-none border-0 bg-[#060b16]/95 p-0 backdrop-blur-xl sm:max-w-none">
        <DialogTitle className="sr-only">Kép jelölése</DialogTitle>
        <DialogDescription className="sr-only">Nyilak, keretek, feliratok és kitakarás a képen; mentéskor új kép készül.</DialogDescription>

        <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2">
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/10" role="toolbar" aria-label="Eszközök">
            {TOOLS.map((item) => (
              <button key={item.tool} type="button" aria-label={`${item.label} (${item.key.toUpperCase()})`} title={`${item.label} (${item.key.toUpperCase()})`}
                      aria-pressed={tool === item.tool}
                      onClick={() => {
                        setTool(item.tool);
                        if (item.tool !== "select") setSelected(null);
                      }}
                      className={cn("grid size-9 place-items-center rounded-lg transition",
                        tool === item.tool ? "bg-amber-400 text-black" : "text-slate-300 hover:bg-white/10")}>
                <item.icon className="size-4"/>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/10" aria-label="Szín">
            {ANNOTATION_COLORS.map((value) => (
              <button key={value} type="button" aria-label={`Szín: ${value}`} aria-pressed={color === value} onClick={() => setColor(value)}
                      className={cn("size-7 rounded-full ring-2 transition", color === value ? "ring-white" : "ring-transparent hover:ring-white/40")}
                      style={{background: value}}/>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/10" aria-label="Vastagság">
            {["S", "M", "L"].map((label, index) => (
              <button key={label} type="button" aria-pressed={size === index} onClick={() => setSize(index)}
                      className={cn("h-8 w-8 rounded-lg text-xs font-semibold transition", size === index ? "bg-white/15 text-white" : "text-slate-400 hover:bg-white/10")}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" aria-label="Visszavonás (Ctrl+Z)" title="Visszavonás (Ctrl+Z)" disabled={!history.canUndo} onClick={history.undo}>
              <Undo2 className="size-4"/>
            </Button>
            <Button size="icon" variant="ghost" aria-label="Újra (Ctrl+Y)" title="Újra (Ctrl+Y)" disabled={!history.canRedo} onClick={history.redo}>
              <Redo2 className="size-4"/>
            </Button>
            {selectedShape && (
              <Button size="icon" variant="ghost" aria-label="A kijelölt törlése" title="A kijelölt törlése (Delete)" className="text-red-300" onClick={removeSelected}>
                <Trash2 className="size-4"/>
              </Button>
            )}
            {crop && (
              <Button size="sm" variant="ghost" onClick={() => history.set((current) => ({...current, crop: null}))}>
                <X className="size-4"/> Vágás törlése
              </Button>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" onClick={onCancel} disabled={saving}>Mégse</Button>
            <Button onClick={() => void save()} disabled={!image || saving} className="bg-amber-500 text-black hover:bg-amber-400">
              {saving ? <Loader2 className="size-4 animate-spin"/> : <Save className="size-4"/>} Mentés
            </Button>
          </div>
        </header>

        <div ref={stageRef} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3 select-none">
          {failed ? (
            <p className="text-sm text-red-300">A kép nem tölthető be.</p>
          ) : !image ? (
            <Loader2 className="size-8 animate-spin text-slate-500"/>
          ) : (
            <svg ref={svgRef} viewBox={`0 0 ${image.w} ${image.h}`} preserveAspectRatio="xMidYMid meet" data-testid="annotator-canvas"
                 className={cn("max-h-full max-w-full touch-none", tool === "select" ? "cursor-default" : "cursor-crosshair")}
                 style={{aspectRatio: `${image.w} / ${image.h}`, width: "100%", height: "100%"}}
                 onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onClick={onClick}>
              <defs>
                <filter id={`${clipBase}-blur`}><feGaussianBlur stdDeviation={Math.max(6, image.w / 120)}/></filter>
              </defs>
              <image href={src} width={image.w} height={image.h}/>
              {all.filter((shape) => shape.kind === "redact").map((shape) => renderShape(shape, shape === draft))}
              {all.filter((shape) => shape.kind !== "redact").map((shape) => renderShape(shape, shape === draft))}
              {selectedShape && (() => {
                const box = bounds(selectedShape);
                const pad = 6 * unit;
                return <rect x={box.x - pad} y={box.y - pad} width={box.w + pad * 2} height={box.h + pad * 2} fill="none" stroke="#38bdf8"
                             strokeWidth={unit * 1.5} strokeDasharray={`${unit * 6} ${unit * 4}`} pointerEvents="none"/>;
              })()}
              {shownCrop && (
                <g pointerEvents="none">
                  <path fillRule="evenodd" fill="rgb(0 0 0 / 0.55)"
                        d={`M0 0H${image.w}V${image.h}H0Z M${shownCrop.x} ${shownCrop.y}h${shownCrop.w}v${shownCrop.h}h${-shownCrop.w}Z`}/>
                  <rect x={shownCrop.x} y={shownCrop.y} width={shownCrop.w} height={shownCrop.h} fill="none" stroke="#fbbf24" strokeWidth={unit * 2}
                        strokeDasharray={`${unit * 8} ${unit * 5}`}/>
                </g>
              )}
            </svg>
          )}
          {text && (
            <input autoFocus value={text.value} maxLength={120} aria-label="Felirat" placeholder="Felirat…"
                   onChange={(event) => setText({...text, value: event.target.value})}
                   onKeyDown={(event) => {
                     event.stopPropagation();
                     if (event.key === "Escape") cancelText.current = true;
                     if (event.key === "Enter" || event.key === "Escape") event.currentTarget.blur();
                   }}
                   onBlur={commitText}
                   className="absolute z-10 w-56 -translate-y-1/2 rounded-md border border-amber-400/60 bg-black/80 px-2 py-1 text-sm text-white shadow-xl outline-none"
                   style={{left: text.left, top: text.top}}/>
          )}
        </div>

        <footer className="shrink-0 border-t border-white/10 px-4 py-2 text-xs text-slate-400">{hint}</footer>
      </DialogContent>
    </Dialog>
  );
}
