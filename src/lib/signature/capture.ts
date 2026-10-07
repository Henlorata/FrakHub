import {outlinesToSignature, type SignatureData} from "./geometry";
import {strokeOutline, type InkPoint} from "./ink";
import {inkBounds, inkMask, luminance, removeSpecks, traceOutlines} from "./trace";

/**
 * The browser side of the two hand-made methods: drawn strokes and an uploaded picture. The picture
 * never leaves the browser: only the traced outline of the ink is kept.
 */

/** Drawn strokes (in the pad's pixels) to signature data. */
export function strokesToSignature(strokes: InkPoint[][], size: number): SignatureData | null {
  const outlines = strokes.filter((stroke) => stroke.length > 0).map((stroke) => strokeOutline(stroke, {size}));
  return outlinesToSignature({outlines, tolerance: 0.3}, size);
}

export interface DecodedPicture {
  gray: Uint8Array;
  width: number;
  height: number;
  /** The picture looks like light ink on a dark background. */
  darkBackground: boolean;
}

const MAX_WIDTH = 1400;
const MAX_HEIGHT = 800;

/** Decodes a picture (EXIF orientation applied) into a grey image of a workable size. */
export async function decodePicture(file: Blob): Promise<DecodedPicture> {
  const bitmap = await createImageBitmap(file, {imageOrientation: "from-image"});
  const scale = Math.min(1, MAX_WIDTH / bitmap.width, MAX_HEIGHT / bitmap.height);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", {willReadFrequently: true})!;
  // Transparent pictures sit on white paper.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const gray = luminance(ctx.getImageData(0, 0, width, height).data);
  let total = 0;
  for (const value of gray) total += value;
  return {gray, width, height, darkBackground: total / gray.length < 105};
}

export interface TraceResult {
  signature: SignatureData | null;
  /** Share of the cropped area that counts as ink (a photo of a whole page reads very high). */
  inkShare: number;
}

/** Traces the ink of a decoded picture. `sensitivity` 0.05–0.4 (higher keeps fainter lines). */
export function tracePicture(picture: DecodedPicture, sensitivity: number, invert: boolean): TraceResult {
  const {gray, width, height} = picture;
  const mask = inkMask(gray, width, height, {sensitivity, invert});
  const ink = removeSpecks(mask, width, height, Math.max(10, Math.round(width * height * 0.00004)));
  const bounds = ink ? inkBounds(mask, width, height) : null;
  if (!bounds) return {signature: null, inkShare: 0};
  // Trace only the cropped part (faster, and the outline starts at the ink).
  const pad = 2;
  const x0 = Math.max(0, bounds.minX - pad);
  const y0 = Math.max(0, bounds.minY - pad);
  const w = Math.min(width, bounds.maxX + pad + 1) - x0;
  const h = Math.min(height, bounds.maxY + pad + 1) - y0;
  const crop = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) crop.set(mask.subarray((y + y0) * width + x0, (y + y0) * width + x0 + w), y * w);
  return {signature: outlinesToSignature({outlines: traceOutlines(crop, w, h), tolerance: 0.75}), inkShare: ink / (w * h)};
}
