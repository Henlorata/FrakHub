import {createWorker, OEM, PSM, type Line, type Page, type Worker} from "tesseract.js";

/**
 * The browser OCR engine shared by the screenshot readers (vehicle licence, citizen record):
 * Tesseract in a web worker, the engine and the English model from the jsDelivr CDN (cached by
 * the browser). The picture never leaves the browser and no server time is used.
 */

export {PSM};

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrWord {
  text: string;
  /** 0-100, as reported by Tesseract. */
  confidence: number;
  bbox: Box;
}

export interface OcrTextLine {
  text: string;
  confidence: number;
  bbox: Box;
  words: OcrWord[];
}

const IDLE_MS = 90_000;
let workerPromise: Promise<Worker> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let progressListener: ((progress: number) => void) | null = null;
let debugHook: ((label: string, image: HTMLCanvasElement, lines: OcrTextLine[]) => void) | null = null;

/** Development aid (temp/ocr harness): sees every pass. */
export const setOcrDebug = (hook: typeof debugHook) => {
  debugHook = hook;
};

/** Receives the progress (0-1) of the running pass. */
export const setOcrProgress = (listener: ((progress: number) => void) | null) => {
  progressListener = listener;
};

export function getWorker(): Promise<Worker> {
  clearTimeout(idleTimer);
  workerPromise ??= createWorker("eng", OEM.LSTM_ONLY, {
    logger: (message) => {
      if (message.status === "recognizing text") progressListener?.(message.progress);
    },
  }).then(async (worker) => {
    await worker.setParameters({preserve_interword_spaces: "1", user_defined_dpi: "300"});
    return worker;
  }).catch((error: unknown) => {
    workerPromise = null;
    throw error;
  });
  return workerPromise;
}

/** Frees the OCR engine (~100 MB) once nobody used it for a while. */
export function scheduleRelease() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => void releaseOcr(), IDLE_MS);
}

export async function releaseOcr() {
  const pending = workerPromise;
  workerPromise = null;
  if (pending) await pending.then((worker) => worker.terminate()).catch(() => undefined);
}

/** Starts downloading the engine early (when a dialog opens), so the scan starts faster. */
export function warmUpOcr() {
  void getWorker().then(scheduleRelease).catch(() => undefined);
}

export const newCanvas = (width: number, height: number) => {
  const element = document.createElement("canvas");
  element.width = Math.max(1, Math.round(width));
  element.height = Math.max(1, Math.round(height));
  return element;
};

/** Draws a part of the picture scaled (`filter`: CSS canvas filter). */
export function draw(source: CanvasImageSource, box: Box, scale: number, filter = "none") {
  const target = newCanvas((box.x1 - box.x0) * scale, (box.y1 - box.y0) * scale);
  const context = target.getContext("2d", {willReadFrequently: true})!;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.filter = filter;
  context.fillStyle = "#fff";
  context.fillRect(0, 0, target.width, target.height);
  context.drawImage(source, box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0, 0, 0, target.width, target.height);
  return target;
}

/**
 * Black where a pixel stands out from the mean of its `size` x `size` neighbourhood by `delta`,
 * white elsewhere. `dark` keeps dark text on light backgrounds, `light` keeps light text on dark
 * ones (and gives it back as dark text, which Tesseract reads best); both drop scenery and HUD.
 */
export function strokes(source: HTMLCanvasElement, size: number, delta: number, polarity: "dark" | "light" = "dark") {
  const {width, height} = source;
  const target = newCanvas(width, height);
  const context = target.getContext("2d", {willReadFrequently: true})!;
  context.drawImage(source, 0, 0);
  const image = context.getImageData(0, 0, width, height);
  const data = image.data;
  const sign = polarity === "dark" ? 1 : -1;
  const luminance = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    luminance[p] = sign * (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  const stride = width + 1;
  const integral = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y += 1) {
    let row = 0;
    for (let x = 0; x < width; x += 1) {
      row += luminance[y * width + x];
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + row;
    }
  }
  const radius = Math.max(1, Math.floor(size / 2));
  for (let y = 0; y < height; y += 1) {
    const top = Math.max(0, y - radius);
    const bottom = Math.min(height, y + radius + 1);
    for (let x = 0; x < width; x += 1) {
      const left = Math.max(0, x - radius);
      const right = Math.min(width, x + radius + 1);
      const sum = integral[bottom * stride + right] - integral[top * stride + right]
        - integral[bottom * stride + left] + integral[top * stride + left];
      const mean = sum / ((right - left) * (bottom - top));
      const p = y * width + x;
      const value = luminance[p] < mean - delta ? 0 : 255;
      data[p * 4] = data[p * 4 + 1] = data[p * 4 + 2] = value;
      data[p * 4 + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return target;
}

function linesOf(page: Page): OcrTextLine[] {
  const lines: Line[] = (page.blocks ?? []).flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines));
  return lines
    .map((line) => ({
      text: line.text.trim(),
      confidence: line.confidence,
      bbox: line.bbox,
      words: line.words.map((word) => ({text: word.text, confidence: word.confidence, bbox: word.bbox})).filter((word) => word.text.trim()),
    }))
    .filter((line) => line.text.length > 0);
}

/** One OCR pass. `whitelist` limits the characters (empty: any). */
export async function recognize(image: HTMLCanvasElement, mode: PSM, label: string, whitelist = ""): Promise<OcrTextLine[]> {
  const worker = await getWorker();
  // The worker is shared: every pass sets each parameter it depends on.
  await worker.setParameters({tessedit_pageseg_mode: mode, tessedit_char_whitelist: whitelist});
  const {data} = await worker.recognize(image, {}, {blocks: true, text: false});
  const lines = linesOf(data);
  debugHook?.(label, image, lines);
  return lines;
}

export const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

export const clampBox = (box: Box, width: number, height: number): Box => ({
  x0: Math.max(0, Math.min(width - 1, box.x0)),
  y0: Math.max(0, Math.min(height - 1, box.y0)),
  x1: Math.max(1, Math.min(width, box.x1)),
  y1: Math.max(1, Math.min(height, box.y1)),
});
