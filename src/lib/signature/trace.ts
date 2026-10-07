import type {Point} from "./geometry";

/**
 * Raster to vector for signatures: a picture (or a rendered handwriting style) becomes a binary ink
 * mask, specks are dropped, and the ink's outlines are traced on the pixel grid. Pure (works on
 * plain arrays), so the specs can import it.
 */

/** Luminance (0–255) of RGBA pixels; transparent pixels count as white paper. */
export function luminance(rgba: Uint8ClampedArray): Uint8Array {
  const out = new Uint8Array(rgba.length / 4);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
    const alpha = rgba[i + 3] / 255;
    const value = 0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2];
    out[j] = Math.round(value * alpha + 255 * (1 - alpha));
  }
  return out;
}

/** Otsu's threshold of a luminance image. */
export function otsuThreshold(gray: Uint8Array): number {
  const histogram = new Array<number>(256).fill(0);
  for (const value of gray) histogram[value]++;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];
  let sumBackground = 0;
  let weightBackground = 0;
  let best = 0;
  let threshold = 127;
  for (let i = 0; i < 256; i++) {
    weightBackground += histogram[i];
    if (weightBackground === 0) continue;
    const weightForeground = total - weightBackground;
    if (weightForeground === 0) break;
    sumBackground += i * histogram[i];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const between = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;
    if (between > best) {
      best = between;
      threshold = i;
    }
  }
  return threshold;
}

export interface InkOptions {
  /** 0–1: how much darker than its surroundings a pixel must be to count as ink (Bradley–Roth). */
  sensitivity: number;
  /** Light ink on a dark background. */
  invert: boolean;
}

/**
 * Ink mask (1 = ink). A pixel is ink when it is darker than the mean of its neighbourhood by the
 * sensitivity (copes with shadows and uneven light on photos) and darker than the global Otsu
 * threshold plus a margin (keeps paper texture out).
 */
export function inkMask(gray: Uint8Array, width: number, height: number, {sensitivity, invert}: InkOptions): Uint8Array {
  const source = invert ? gray.map((value) => 255 - value) : gray;
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += source[y * width + x];
      integral[(y + 1) * (width + 1) + x + 1] = integral[y * (width + 1) + x + 1] + row;
    }
  }
  const half = Math.max(8, Math.round(Math.max(width, height) / 16));
  const global = Math.min(otsuThreshold(source) + 30, 235);
  const mask = new Uint8Array(width * height);
  const factor = 1 - Math.min(Math.max(sensitivity, 0.02), 0.6);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - half);
    const y1 = Math.min(height, y + half + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(width, x + half + 1);
      const area = (x1 - x0) * (y1 - y0);
      const sum = integral[y1 * (width + 1) + x1] - integral[y0 * (width + 1) + x1] - integral[y1 * (width + 1) + x0] + integral[y0 * (width + 1) + x0];
      const value = source[y * width + x];
      if (value * area < sum * factor && value < global) mask[y * width + x] = 1;
    }
  }
  return mask;
}

/** Mask from alpha (rendered text and strokes on a transparent canvas). */
export function alphaMask(rgba: Uint8ClampedArray, threshold = 110): Uint8Array {
  const mask = new Uint8Array(rgba.length / 4);
  for (let i = 3, j = 0; i < rgba.length; i += 4, j++) mask[j] = rgba[i] > threshold ? 1 : 0;
  return mask;
}

/** Drops ink components (8-connected) smaller than `minArea` pixels, in place. Returns the ink left. */
export function removeSpecks(mask: Uint8Array, width: number, height: number, minArea: number): number {
  const label = new Int32Array(mask.length).fill(-1);
  const queue = new Int32Array(mask.length);
  let remaining = 0;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || label[start] !== -1) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    label[start] = start;
    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = (index - x) / width;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if ((dx === 0 && dy === 0) || nx < 0 || nx >= width) continue;
          const next = ny * width + nx;
          if (mask[next] && label[next] === -1) {
            label[next] = start;
            queue[tail++] = next;
          }
        }
      }
    }
    if (tail < minArea) {
      for (let i = 0; i < tail; i++) mask[queue[i]] = 0;
    } else {
      remaining += tail;
    }
  }
  return remaining;
}

/**
 * Closed outlines of the ink, as polygons through the midpoints of the pixel edges (smoother than
 * the corners). Boundary edges are directed with the ink on their right, so outer outlines run
 * clockwise on screen and holes counter-clockwise (nonzero filling). Diagonally touching pixels are
 * joined (thin diagonal pen strokes stay one shape).
 */
export function traceOutlines(mask: Uint8Array, width: number, height: number): Point[][] {
  const stride = width + 1;
  const ink = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] === 1;
  // Directed edges between pixel corners; up to two leave a corner (at diagonal touches).
  const edgeFrom: number[] = [];
  const edgeDir: number[] = [];
  const first = new Int32Array(stride * (height + 1)).fill(-1);
  const next: number[] = [];
  const add = (x: number, y: number, dir: number) => {
    const id = edgeFrom.length;
    const corner = y * stride + x;
    edgeFrom.push(corner);
    edgeDir.push(dir);
    next.push(first[corner]);
    first[corner] = id;
  };
  // Directions: 0 east, 1 south, 2 west, 3 north.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      if (!ink(x, y - 1)) add(x, y, 0);
      if (!ink(x + 1, y)) add(x + 1, y, 1);
      if (!ink(x, y + 1)) add(x + 1, y + 1, 2);
      if (!ink(x - 1, y)) add(x, y + 1, 3);
    }
  }
  const DX = [1, 0, -1, 0];
  const DY = [0, 1, 0, -1];
  const used = new Uint8Array(edgeFrom.length);
  const outlines: Point[][] = [];
  for (let startEdge = 0; startEdge < edgeFrom.length; startEdge++) {
    if (used[startEdge]) continue;
    const outline: Point[] = [];
    let edge = startEdge;
    while (edge !== -1 && !used[edge]) {
      used[edge] = 1;
      const corner = edgeFrom[edge];
      const x = corner % stride;
      const y = (corner - x) / stride;
      const dir = edgeDir[edge];
      outline.push({x: x + DX[dir] / 2, y: y + DY[dir] / 2});
      const end = (y + DY[dir]) * stride + (x + DX[dir]);
      // Prefer the left turn at a diagonal touch (joins the pixels), then straight, then right.
      let chosen = -1;
      let rank = 9;
      for (let candidate = first[end]; candidate !== -1; candidate = next[candidate]) {
        if (used[candidate]) continue;
        const turn = (edgeDir[candidate] - dir + 4) % 4;
        const order = turn === 3 ? 0 : turn === 0 ? 1 : 2;
        if (order < rank) {
          rank = order;
          chosen = candidate;
        }
      }
      edge = chosen;
    }
    if (outline.length >= 3) outlines.push(outline);
  }
  return outlines;
}

/** Bounding box of the ink (or null when empty). */
export function inkBounds(mask: Uint8Array, width: number, height: number) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : {minX, minY, maxX, maxY};
}
