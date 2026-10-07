import {useId, type PointerEvent as ReactPointerEvent, type ReactNode} from "react";
import {SKETCH_WIDTH, type Sketch, type SketchItem} from "./sketch-model";

const INK = "#0f172a";
const LABEL_FONT = "Inter, system-ui, sans-serif";

/** Half-size of an item in its own (unrotated) coordinates: selection outline and handles. */
export function itemExtent(item: SketchItem): {hw: number; hh: number} {
  switch (item.kind) {
    case "car":
    case "police":
      return {hw: 50, hh: 27};
    case "truck":
      return {hw: 76, hh: 31};
    case "bike":
      return {hw: 32, hh: 14};
    case "person":
    case "officer":
      return {hw: 20, hh: 17};
    case "tree":
      return {hw: 26, hh: 26};
    case "marker":
    case "shot":
      return {hw: 18, hh: 18};
    case "text":
      return {hw: Math.max(20, (item.label?.length ?? 6) * 6.6 + 8), hh: 17};
    default:
      return {hw: (item.w ?? 100) / 2 + 6, hh: (item.h ?? 100) / 2 + 6};
  }
}

/** Labels under people, vehicles and markers stay upright whatever the item's rotation. */
function Label({x, y, text}: {x: number; y: number; text: string}) {
  return (
    <text x={x} y={y} textAnchor="middle" fontSize={15} fontWeight={600} fontFamily={LABEL_FONT} fill={INK} paintOrder="stroke"
          stroke="#ffffff" strokeWidth={4} strokeLinejoin="round" pointerEvents="none">{text}</text>
  );
}

function Shape({item, ids}: {item: SketchItem; ids: {hatch: string; head: string}}) {
  const color = item.color ?? "#2563eb";
  switch (item.kind) {
    case "car":
      return (
        <g>
          {[[-33, -26], [19, -26], [-33, 21], [19, 21]].map(([x, y]) => <rect key={`${x}${y}`} x={x} y={y} width={14} height={5} rx={2} fill={INK}/>)}
          <rect x={-45} y={-22} width={90} height={44} rx={11} fill={color} stroke={INK} strokeWidth={2}/>
          <rect x={-21} y={-17} width={30} height={34} rx={5} fill="#ffffff" opacity={0.2}/>
          <rect x={10} y={-17} width={15} height={34} rx={4} fill={INK} opacity={0.72}/>
          <rect x={-34} y={-15} width={11} height={30} rx={3} fill={INK} opacity={0.55}/>
        </g>
      );
    case "police":
      return (
        <g>
          {[[-33, -26], [19, -26], [-33, 21], [19, 21]].map(([x, y]) => <rect key={`${x}${y}`} x={x} y={y} width={14} height={5} rx={2} fill={INK}/>)}
          <rect x={-45} y={-22} width={90} height={44} rx={11} fill="#f8fafc" stroke={INK} strokeWidth={2}/>
          <path d="M26 -22H34A11 11 0 0 1 45 -11V11A11 11 0 0 1 34 22H26Z" fill={INK}/>
          <path d="M-32 -22H-34A11 11 0 0 0 -45 -11V11A11 11 0 0 0 -34 22H-32Z" fill={INK}/>
          <rect x={10} y={-17} width={13} height={34} rx={4} fill={INK} opacity={0.72}/>
          <rect x={-7} y={-15} width={8} height={14} rx={2} fill="#dc2626"/>
          <rect x={-7} y={1} width={8} height={14} rx={2} fill="#2563eb"/>
        </g>
      );
    case "truck":
      return (
        <g>
          {[[-60, -30], [-20, -30], [40, -30], [-60, 25], [-20, 25], [40, 25]].map(([x, y]) => (
            <rect key={`${x}${y}`} x={x} y={y} width={16} height={5} rx={2} fill={INK}/>
          ))}
          <rect x={-70} y={-26} width={98} height={52} rx={5} fill={color} stroke={INK} strokeWidth={2}/>
          <rect x={31} y={-23} width={39} height={46} rx={8} fill={color} stroke={INK} strokeWidth={2}/>
          <rect x={54} y={-18} width={11} height={36} rx={3} fill={INK} opacity={0.72}/>
        </g>
      );
    case "bike":
      return (
        <g>
          <rect x={-30} y={-3} width={14} height={6} rx={3} fill={INK}/>
          <rect x={16} y={-3} width={14} height={6} rx={3} fill={INK}/>
          <ellipse cx={0} cy={0} rx={21} ry={7} fill={color} stroke={INK} strokeWidth={1.5}/>
          <line x1={13} y1={-11} x2={13} y2={11} stroke={INK} strokeWidth={3} strokeLinecap="round"/>
        </g>
      );
    case "person":
    case "officer": {
      const fill = item.kind === "officer" ? "#1d4ed8" : color;
      return (
        <g>
          <polygon points="11,-6 20,0 11,6" fill={fill} stroke="#ffffff" strokeWidth={1.5}/>
          <circle r={12} fill={fill} stroke="#ffffff" strokeWidth={2.5}/>
          {item.kind === "officer" && <text y={5} textAnchor="middle" fontSize={14} fill="#fde68a" fontFamily={LABEL_FONT}>★</text>}
        </g>
      );
    }
    case "road": {
      const w = item.w ?? 420;
      const h = item.h ?? 90;
      return (
        <g>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="#475569"/>
          <line x1={-w / 2} y1={-h / 2 + 5} x2={w / 2} y2={-h / 2 + 5} stroke="#f8fafc" strokeWidth={2} opacity={0.75}/>
          <line x1={-w / 2} y1={h / 2 - 5} x2={w / 2} y2={h / 2 - 5} stroke="#f8fafc" strokeWidth={2} opacity={0.75}/>
          <line x1={-w / 2} y1={0} x2={w / 2} y2={0} stroke="#facc15" strokeWidth={3} strokeDasharray="18 14"/>
        </g>
      );
    }
    case "building": {
      const w = item.w ?? 180;
      const h = item.h ?? 120;
      return <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={`url(#${ids.hatch})`} stroke="#334155" strokeWidth={2.5}/>;
    }
    case "zone": {
      const w = item.w ?? 220;
      const h = item.h ?? 150;
      return <ellipse rx={w / 2} ry={h / 2} fill={color} fillOpacity={0.12} stroke={color} strokeWidth={3} strokeDasharray="12 8"/>;
    }
    case "tree":
      return (
        <g>
          <circle r={22} fill="#16a34a" opacity={0.5}/>
          <circle r={9} fill="#15803d" opacity={0.85}/>
        </g>
      );
    case "marker":
      return (
        <g>
          <path d="M-15 12L0 -15L15 12Z" fill="#facc15" stroke={INK} strokeWidth={2} strokeLinejoin="round"/>
          <text y={8} textAnchor="middle" fontSize={13} fontWeight={800} fill={INK} fontFamily={LABEL_FONT}>{item.n ?? 1}</text>
        </g>
      );
    case "shot": {
      const points = Array.from({length: 16}, (_, index) => {
        const radius = index % 2 === 0 ? 15 : 6;
        const angle = (index * Math.PI) / 8;
        return `${(radius * Math.cos(angle)).toFixed(1)},${(radius * Math.sin(angle)).toFixed(1)}`;
      }).join(" ");
      return <polygon points={points} fill="#dc2626" stroke="#ffffff" strokeWidth={1.5}/>;
    }
    case "text":
      return (
        <text textAnchor="middle" dominantBaseline="middle" fontSize={22} fontWeight={700} fontFamily={LABEL_FONT} fill={color}
              paintOrder="stroke" stroke="#ffffff" strokeWidth={5} strokeLinejoin="round">{item.label || "Felirat"}</text>
      );
    default:
      return null;
  }
}

/** One item with its label; arrows are drawn between their two points (no rotation). */
export function SketchItemGraphic({item, ids, onPointerDown, selected, children}: {
  item: SketchItem;
  ids: {hatch: string; head: string};
  onPointerDown?: (event: ReactPointerEvent, item: SketchItem) => void;
  selected?: boolean;
  /** Handles drawn in the item's own coordinates (the editor). */
  children?: ReactNode;
}) {
  const down = onPointerDown ? (event: ReactPointerEvent) => onPointerDown(event, item) : undefined;
  if (item.kind === "arrow") {
    const x2 = item.x2 ?? item.x + 160;
    const y2 = item.y2 ?? item.y;
    const color = item.color ?? INK;
    return (
      <g data-sketch-item={item.kind} onPointerDown={down} style={{cursor: down ? "move" : undefined}}>
        <line x1={item.x} y1={item.y} x2={x2} y2={y2} stroke="transparent" strokeWidth={18}/>
        <line x1={item.x} y1={item.y} x2={x2} y2={y2} stroke={color} strokeWidth={4} strokeLinecap="round"
              strokeDasharray={item.dashed ? "14 10" : undefined} markerEnd={`url(#${ids.head}-${color.slice(1)})`}/>
        {selected && <line x1={item.x} y1={item.y} x2={x2} y2={y2} stroke="#0ea5e9" strokeWidth={1.5} strokeDasharray="5 4" pointerEvents="none"/>}
        {item.label && <Label x={(item.x + x2) / 2} y={(item.y + y2) / 2 - 12} text={item.label}/>}
        {children}
      </g>
    );
  }
  const {hw, hh} = itemExtent(item);
  const labelled = item.label && item.kind !== "text";
  const boxed = item.kind === "road" || item.kind === "building" || item.kind === "zone";
  return (
    <g data-sketch-item={item.kind} onPointerDown={down} style={{cursor: down ? "move" : undefined}}>
      <g transform={`translate(${item.x} ${item.y}) rotate(${item.rotation || 0})`}>
        <Shape item={item} ids={ids}/>
        {selected && (
          <rect x={-hw} y={-hh} width={hw * 2} height={hh * 2} fill="none" stroke="#0ea5e9" strokeWidth={1.5} strokeDasharray="5 4" pointerEvents="none"/>
        )}
        {children}
      </g>
      {labelled && (boxed
        ? <Label x={item.x} y={item.y + 5} text={item.label as string}/>
        : <Label x={item.x} y={item.y + Math.max(hw, hh) + 16} text={item.label as string}/>)}
    </g>
  );
}

/** The paper, the grid, the north arrow and the definitions (patterns, arrow heads). */
export function SketchPaper({height, ids, colors, children}: {height: number; ids: {hatch: string; head: string; grid: string}; colors: string[];
  children?: ReactNode}) {
  return (
    <>
      <defs>
        <pattern id={ids.grid} width={50} height={50} patternUnits="userSpaceOnUse">
          <path d="M50 0H0V50" fill="none" stroke="#cbd5e1" strokeWidth={1} opacity={0.7}/>
        </pattern>
        <pattern id={ids.hatch} width={12} height={12} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={12} height={12} fill="#e2e8f0"/>
          <line x1={0} y1={0} x2={0} y2={12} stroke="#94a3b8" strokeWidth={3}/>
        </pattern>
        {colors.map((color) => (
          <marker key={color} id={`${ids.head}-${color.slice(1)}`} viewBox="0 0 10 10" refX={6} refY={5} markerWidth={4.5} markerHeight={4.5}
                  orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10Z" fill={color}/>
          </marker>
        ))}
      </defs>
      <rect width={SKETCH_WIDTH} height={height} fill="#f8fafc"/>
      <rect width={SKETCH_WIDTH} height={height} fill={`url(#${ids.grid})`}/>
      {children}
      <g transform={`translate(${SKETCH_WIDTH - 44} 46)`} pointerEvents="none">
        <circle r={24} fill="#ffffff" stroke="#94a3b8" strokeWidth={1.5}/>
        <path d="M0 -17L7 6L0 1L-7 6Z" fill={INK}/>
        <text y={20} textAnchor="middle" fontSize={11} fontWeight={700} fill={INK} fontFamily={LABEL_FONT}>É</text>
      </g>
    </>
  );
}

export const sketchColors = (sketch: Sketch) => [...new Set(["#0f172a", ...sketch.items.filter((item) => item.kind === "arrow").map((item) => item.color ?? INK)])];

/** A finished sketch (the document and its print view). */
export function SketchView({sketch, height, title}: {sketch: Sketch; height: number; title?: string}) {
  const base = useId().replace(/:/g, "");
  const ids = {hatch: `${base}-hatch`, head: `${base}-head`, grid: `${base}-grid`};
  return (
    <svg viewBox={`0 0 ${SKETCH_WIDTH} ${height}`} role="img" aria-label={title ? `Helyszínrajz: ${title}` : "Helyszínrajz"}
         className="block h-auto w-full rounded-lg ring-1 ring-slate-300">
      <SketchPaper height={height} ids={ids} colors={sketchColors(sketch)}>
        {sketch.items.map((item) => <SketchItemGraphic key={item.id} item={item} ids={ids}/>)}
      </SketchPaper>
    </svg>
  );
}
