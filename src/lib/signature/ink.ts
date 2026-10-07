import {signedArea, type Point} from "./geometry";

/**
 * Pen strokes to filled outlines: each stroke gets a width that follows the pen pressure (or, with a
 * mouse or finger, the speed: fast lines are thinner), tapers at both ends and is closed with round
 * caps. Pure (no DOM), so the specs can import it.
 */

export interface InkPoint {
  x: number;
  y: number;
  /** 0–1; null when the device reports none (mouse, most fingers). */
  pressure: number | null;
  /** Milliseconds. */
  t: number;
}

export interface InkOptions {
  /** Line width at full pressure, in the drawing's units. */
  size: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Drops points closer than `spacing` to the previous kept one. */
function thin(points: InkPoint[], spacing: number): InkPoint[] {
  const out: InkPoint[] = [];
  for (const point of points) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(point.x - last.x, point.y - last.y) >= spacing) out.push(point);
  }
  if (points.length > 1 && out.length === 1) out.push(points[points.length - 1]);
  return out;
}

/** One Chaikin pass: rounds the corners of a polyline, keeps its ends. */
function chaikin(points: InkPoint[]): InkPoint[] {
  if (points.length < 3) return points;
  const out: InkPoint[] = [points[0]];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const mix = (k: number): InkPoint => ({
      x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k,
      pressure: a.pressure === null || b.pressure === null ? null : a.pressure + (b.pressure - a.pressure) * k,
      t: a.t + (b.t - a.t) * k,
    });
    out.push(mix(0.25), mix(0.75));
  }
  out.push(points[points.length - 1]);
  return out;
}

function circle(center: Point, radius: number, steps = 12): Point[] {
  return Array.from({length: steps}, (_, i) => {
    const angle = (i / steps) * Math.PI * 2;
    return {x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius};
  });
}

/** The filled outline of one stroke (clockwise on screen, like traced ink). */
export function strokeOutline(raw: InkPoint[], {size}: InkOptions): Point[] {
  const points = chaikin(chaikin(thin(raw, Math.max(size * 0.35, 0.8))));
  if (points.length === 0) return [];
  if (points.length === 1) return circle(points[0], size * 0.45);

  // Width per point: pressure when there is one, otherwise from the speed (smoothed).
  const widths: number[] = [];
  let smoothed = 0.75;
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    let target: number;
    if (point.pressure !== null && point.pressure > 0) {
      target = clamp(0.25 + point.pressure * 0.9, 0.3, 1.1);
    } else {
      const previous = points[Math.max(i - 1, 0)];
      const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
      const elapsed = Math.max(point.t - previous.t, 1);
      const speed = distance / elapsed;
      target = clamp(1.15 - speed * 0.35, 0.38, 1.05);
    }
    smoothed = i === 0 ? target : smoothed + (target - smoothed) * 0.35;
    widths.push(smoothed);
  }

  // Tapered ends, as a pen lifts.
  const taper = Math.min(8, Math.floor(points.length / 3));
  const radius = (i: number) => {
    const fromStart = taper ? Math.min(1, (i + 1) / (taper + 1)) : 1;
    const fromEnd = taper ? Math.min(1, (points.length - i) / (taper + 1)) : 1;
    const ends = 0.35 + 0.65 * Math.min(fromStart, fromEnd ** 0.8);
    return (size / 2) * widths[i] * ends;
  };

  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const before = points[Math.max(i - 1, 0)];
    const after = points[Math.min(i + 1, points.length - 1)];
    let dx = after.x - before.x;
    let dy = after.y - before.y;
    const length = Math.hypot(dx, dy) || 1;
    dx /= length;
    dy /= length;
    const r = radius(i);
    left.push({x: points[i].x - dy * r, y: points[i].y + dx * r});
    right.push({x: points[i].x + dy * r, y: points[i].y - dx * r});
  }

  // Round caps: half circles around the last and the first point.
  const cap = (center: Point, from: Point, steps = 6): Point[] => {
    const angle = Math.atan2(from.y - center.y, from.x - center.x);
    const r = Math.hypot(from.x - center.x, from.y - center.y);
    return Array.from({length: steps - 1}, (_, i) => {
      const a = angle - ((i + 1) / steps) * Math.PI;
      return {x: center.x + Math.cos(a) * r, y: center.y + Math.sin(a) * r};
    });
  };
  const last = points[points.length - 1];
  const outline = [
    ...left,
    ...cap(last, left[left.length - 1]),
    ...right.reverse(),
    ...cap(points[0], right[right.length - 1]),
  ];
  return signedArea(outline) < 0 ? outline.reverse() : outline;
}
