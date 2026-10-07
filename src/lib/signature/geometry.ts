/**
 * Vector helpers for signatures: polygons are simplified, smoothed into quadratic curves and
 * written as SVG path data, normalised to a fixed height so every signature scales the same.
 * Pure (no DOM), so the specs can import it.
 */

export interface Point {
  x: number;
  y: number;
}

export interface SignatureData {
  /** SVG path data (filled, nonzero), in a viewBox of `0 0 width height`. */
  path: string;
  width: number;
  height: number;
}

/** The stored height of every signature (the width follows the aspect ratio). */
export const SIGNATURE_HEIGHT = 100;
/** Above this the path is simplified harder (the database accepts 150 000 characters). */
const MAX_PATH_LENGTH = 110_000;

/** Shoelace area; positive for clockwise outlines on screen (y grows downwards). */
export function signedArea(points: Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function perpendicularDistance(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  return Math.abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x) / length;
}

/** Ramer–Douglas–Peucker on an open polyline (iterative, so long outlines do not overflow the stack). */
export function simplifyPolyline(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let index = -1;
    let max = tolerance;
    for (let i = first + 1; i < last; i++) {
      const distance = perpendicularDistance(points[i], points[first], points[last]);
      if (distance > max) {
        max = distance;
        index = i;
      }
    }
    if (index !== -1) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

/** Simplifies a closed outline: split at the point farthest from the first one, simplify both halves. */
export function simplifyClosed(points: Point[], tolerance: number): Point[] {
  if (points.length < 4) return points.slice();
  let far = 0;
  let max = -1;
  for (let i = 1; i < points.length; i++) {
    const distance = Math.hypot(points[i].x - points[0].x, points[i].y - points[0].y);
    if (distance > max) {
      max = distance;
      far = i;
    }
  }
  const first = simplifyPolyline(points.slice(0, far + 1), tolerance);
  const second = simplifyPolyline([...points.slice(far), points[0]], tolerance);
  return [...first.slice(0, -1), ...second.slice(0, -1)];
}

const round = (value: number) => {
  const rounded = Math.round(value * 10) / 10;
  return Object.is(rounded, -0) ? "0" : String(rounded);
};

/**
 * A closed outline as a smooth path: each vertex becomes a quadratic control point and the curve
 * runs through the midpoints of the edges (a cheap, round result for traced pixel outlines).
 */
export function smoothClosedPath(points: Point[], transform: (point: Point) => Point): string {
  if (points.length < 3) return "";
  const p = points.map(transform);
  const mid = (a: Point, b: Point) => ({x: (a.x + b.x) / 2, y: (a.y + b.y) / 2});
  const start = mid(p[p.length - 1], p[0]);
  let d = `M${round(start.x)} ${round(start.y)}`;
  for (let i = 0; i < p.length; i++) {
    const control = p[i];
    const end = mid(p[i], p[(i + 1) % p.length]);
    d += `Q${round(control.x)} ${round(control.y)} ${round(end.x)} ${round(end.y)}`;
  }
  return `${d}Z`;
}

export interface OutlineSet {
  outlines: Point[][];
  /** Simplification tolerance in source units (pixels). */
  tolerance: number;
}

/**
 * Turns outlines (in source pixels) into stored signature data: cropped to the ink, scaled to
 * SIGNATURE_HEIGHT, simplified harder when the path would grow too long.
 */
export function outlinesToSignature({outlines, tolerance}: OutlineSet, padding = 2): SignatureData | null {
  const usable = outlines.filter((outline) => outline.length >= 3);
  if (usable.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const outline of usable) {
    for (const point of outline) {
      if (point.x < minX) minX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.x > maxX) maxX = point.x;
      if (point.y > maxY) maxY = point.y;
    }
  }
  const sourceHeight = Math.max(maxY - minY, 1) + padding * 2;
  const scale = SIGNATURE_HEIGHT / sourceHeight;
  const width = Math.max((maxX - minX + padding * 2) * scale, 1);
  const transform = (point: Point) => ({x: (point.x - minX + padding) * scale, y: (point.y - minY + padding) * scale});

  for (let attempt = 0; attempt < 6; attempt++) {
    const factor = tolerance * (1 + attempt * 0.6);
    const path = usable.map((outline) => smoothClosedPath(simplifyClosed(outline, factor), transform)).filter(Boolean).join("");
    if (path.length <= MAX_PATH_LENGTH || attempt === 5) {
      if (!path) return null;
      return {path, width: Math.round(width * 10) / 10, height: SIGNATURE_HEIGHT};
    }
  }
  return null;
}

/** Joins two signatures side by side is not needed; this checks a stored path before rendering it. */
export const isSignaturePath = (path: string) => path.length >= 8 && /^[MLHVCSQTAZmlhvcsqtaz0-9eE ,.-]+$/.test(path);
