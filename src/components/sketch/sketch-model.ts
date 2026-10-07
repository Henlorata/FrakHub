/**
 * Scene sketches (helyszínrajz) in case documents: vehicles, people, roads, buildings, areas,
 * arrows, labels and numbered evidence markers on a 1000 units wide canvas. Stored in the block's
 * `data` prop as JSON (no pictures), so a sketch costs a few kilobytes of the case document.
 */

export const SKETCH_WIDTH = 1000;
export const SKETCH_HEIGHTS = [420, 560, 760] as const;
export const SKETCH_MAX_ITEMS = 300;

export type SketchKind =
  | "car" | "police" | "truck" | "bike"
  | "person" | "officer"
  | "road" | "building" | "zone" | "tree"
  | "arrow" | "text" | "marker" | "shot";

export interface SketchItem {
  id: string;
  kind: SketchKind;
  /** Centre (start point of an arrow). */
  x: number;
  y: number;
  /** Degrees, clockwise. */
  rotation: number;
  /** Size of roads, buildings and areas. */
  w?: number;
  h?: number;
  /** End point of an arrow. */
  x2?: number;
  y2?: number;
  /** A dashed arrow: a route rather than a movement. */
  dashed?: boolean;
  color?: string;
  label?: string;
  /** Number of an evidence marker. */
  n?: number;
}

export interface Sketch {
  v: 1;
  items: SketchItem[];
}

export const SKETCH_COLORS = ["#dc2626", "#2563eb", "#16a34a", "#f59e0b", "#7c3aed", "#0f172a", "#e2e8f0"];

export const SKETCH_KINDS: Record<SketchKind, {label: string; group: "Járművek" | "Személyek" | "Környezet" | "Jelölések"; color?: string;
  box?: {w: number; h: number}; rotates: boolean}> = {
  car: {label: "Autó", group: "Járművek", color: "#2563eb", rotates: true},
  police: {label: "Járőrautó", group: "Járművek", rotates: true},
  truck: {label: "Teherautó", group: "Járművek", color: "#f59e0b", rotates: true},
  bike: {label: "Motor", group: "Járművek", color: "#dc2626", rotates: true},
  person: {label: "Személy", group: "Személyek", color: "#dc2626", rotates: true},
  officer: {label: "Rendőr", group: "Személyek", rotates: true},
  road: {label: "Út", group: "Környezet", box: {w: 420, h: 90}, rotates: true},
  building: {label: "Épület", group: "Környezet", box: {w: 180, h: 120}, rotates: true},
  zone: {label: "Terület", group: "Környezet", color: "#dc2626", box: {w: 220, h: 150}, rotates: true},
  tree: {label: "Fa", group: "Környezet", rotates: false},
  arrow: {label: "Nyíl", group: "Jelölések", color: "#0f172a", rotates: false},
  text: {label: "Felirat", group: "Jelölések", color: "#0f172a", rotates: true},
  marker: {label: "Bizonyíték", group: "Jelölések", rotates: false},
  shot: {label: "Lövés / becsapódás", group: "Jelölések", rotates: false},
};

const num = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

/** Reads a stored sketch; anything malformed is dropped (an empty sketch at worst). */
export function parseSketch(data: string | null | undefined): Sketch {
  if (!data) return {v: 1, items: []};
  try {
    const parsed = JSON.parse(data) as {items?: unknown};
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    return {
      v: 1,
      items: items.slice(0, SKETCH_MAX_ITEMS).flatMap((raw): SketchItem[] => {
        const item = raw as Partial<SketchItem>;
        if (!item || typeof item !== "object" || !item.kind || !(item.kind in SKETCH_KINDS)) return [];
        return [{
          id: typeof item.id === "string" ? item.id.slice(0, 20) : Math.random().toString(36).slice(2, 10),
          kind: item.kind, x: num(item.x, 500, -200, 1200), y: num(item.y, 300, -200, 1200), rotation: num(item.rotation, 0, -360, 360),
          ...(item.w !== undefined ? {w: num(item.w, 100, 10, 1400)} : {}), ...(item.h !== undefined ? {h: num(item.h, 100, 10, 1400)} : {}),
          ...(item.x2 !== undefined ? {x2: num(item.x2, 600, -200, 1200)} : {}), ...(item.y2 !== undefined ? {y2: num(item.y2, 300, -200, 1200)} : {}),
          ...(item.dashed ? {dashed: true} : {}),
          ...(typeof item.color === "string" && /^#[0-9a-f]{6}$/i.test(item.color) ? {color: item.color} : {}),
          ...(typeof item.label === "string" && item.label.trim() ? {label: item.label.slice(0, 60)} : {}),
          ...(item.n !== undefined ? {n: Math.round(num(item.n, 1, 1, 999))} : {}),
        }];
      }),
    };
  } catch {
    return {v: 1, items: []};
  }
}

/** Stores a sketch with rounded numbers (small and stable JSON). */
export function serializeSketch(sketch: Sketch): string {
  const round = (value: number) => Math.round(value * 10) / 10;
  return JSON.stringify({v: 1, items: sketch.items.slice(0, SKETCH_MAX_ITEMS).map((item) => {
    const out: Record<string, unknown> = {id: item.id, kind: item.kind, x: round(item.x), y: round(item.y)};
    if (item.rotation) out.rotation = round(item.rotation);
    for (const key of ["w", "h", "x2", "y2"] as const) if (item[key] !== undefined) out[key] = round(item[key] as number);
    if (item.dashed) out.dashed = true;
    if (item.color) out.color = item.color;
    if (item.label) out.label = item.label;
    if (item.n !== undefined) out.n = item.n;
    return out;
  })});
}

/** A new item of a kind at a point (with its default size and colour). */
export function newItem(kind: SketchKind, x: number, y: number, items: SketchItem[]): SketchItem {
  const meta = SKETCH_KINDS[kind];
  const id = Math.random().toString(36).slice(2, 10);
  const base: SketchItem = {id, kind, x, y, rotation: 0, ...(meta.color ? {color: meta.color} : {})};
  if (meta.box) return {...base, w: meta.box.w, h: meta.box.h};
  if (kind === "arrow") return {...base, x: x - 80, x2: x + 80, y2: y};
  if (kind === "marker") return {...base, n: items.reduce((max, item) => (item.kind === "marker" ? Math.max(max, item.n ?? 0) : max), 0) + 1};
  if (kind === "text") return {...base, label: "Felirat"};
  return base;
}

/** A point turned around a centre (degrees, clockwise on screen). */
export function rotatePoint(x: number, y: number, cx: number, cy: number, degrees: number): [number, number] {
  const angle = (degrees * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * Math.cos(angle) - dy * Math.sin(angle), cy + dx * Math.sin(angle) + dy * Math.cos(angle)];
}
