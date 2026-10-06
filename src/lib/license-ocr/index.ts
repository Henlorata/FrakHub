import {
  clampBox, draw, getWorker, median, PSM, recognize, scheduleRelease, setOcrProgress, strokes, type Box, type OcrTextLine,
} from "@/lib/ocr/engine";
import {FIELD_ROWS, lineField, parseLicense, type LicenseReading} from "./parse";

export {releaseOcr, setOcrDebug, warmUpOcr} from "@/lib/ocr/engine";

/**
 * Finds the in-game licence on a screenshot and reads it, in the browser (Tesseract in a
 * web worker; the engine and the English model come from the jsDelivr CDN and are cached
 * by the browser, so nothing is uploaded and no server time is used).
 *
 * Screenshots differ in size and the card is usually only a small part of them:
 *   1. the whole picture is reduced to its dark strokes (darker than their surroundings:
 *      the card's text, but not the colourful game scene) and searched for the card's
 *      labels ("Név:", "Rendsz.:", "Lejár:", ...);
 *   2. the card's layout is fixed, so one or two labels tell where the whole card is; that
 *      part alone is enlarged and read again in several clean-ups;
 *   3. the readings vote for each field.
 */

export type ScanStage = "loading" | "locating" | "reading" | "done";

export interface LicenseScan {
  reading: LicenseReading;
  /** The card cut out of the screenshot (WebP), for a review and for the preview; null when not found. */
  crop: Blob | null;
}

type FoundLine = OcrTextLine;

/**
 * The card's layout in line pitches (distance between two labelled rows), measured on the
 * in-game card: the first row ("Név") is 3.1 pitches below the top edge, labels start 5.2
 * pitches from the left edge, the card is 21.5 x 12.85 pitches.
 */
const CARD = {width: 21.5, height: 12.85, firstRow: 3.125, labelX: 5.2, titleRow: 1.25, titleX: 4.8, pitchPerHeight: 1.74};

interface CardPosition {
  /** The whole card, in picture coordinates. */
  card: Box;
  /** Distance of two rows in picture pixels. */
  pitch: number;
  /** How many labelled rows agree with the position. */
  anchors: number;
}

/** Where the card is, from the labelled rows found on a pass made at `scale`. */
function locate(lines: FoundLine[], scale: number): CardPosition | null {
  const rows = lines.flatMap((line) => {
    const field = lineField(line.text);
    const row = field ? FIELD_ROWS[field] : undefined;
    if (row === undefined) return [];
    const bbox = {x0: line.bbox.x0 / scale, y0: line.bbox.y0 / scale, x1: line.bbox.x1 / scale, y1: line.bbox.y1 / scale};
    return [{row, bbox, center: (bbox.y0 + bbox.y1) / 2, height: bbox.y1 - bbox.y0}];
  });
  if (rows.length === 0) return null;

  const pitches: number[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      if (rows[i].row !== rows[j].row) pitches.push((rows[j].center - rows[i].center) / (rows[j].row - rows[i].row));
    }
  }
  const fromHeight = median(rows.map((row) => row.height)) * CARD.pitchPerHeight;
  const positive = pitches.filter((pitch) => pitch > fromHeight * 0.6 && pitch < fromHeight * 1.6);
  const pitch = positive.length ? median(positive) : fromHeight;

  // Every row suggests a top-left corner; outliers (a "Lejár" somewhere else) are dropped.
  const corners = rows.map((row) => ({
    top: row.center - (CARD.firstRow + row.row) * pitch,
    left: row.bbox.x0 - CARD.labelX * pitch,
  }));
  const top = median(corners.map((corner) => corner.top));
  const left = median(corners.map((corner) => corner.left));
  const agreeing = corners.filter((corner) => Math.abs(corner.top - top) < pitch && Math.abs(corner.left - left) < pitch * 2);
  return {
    pitch,
    anchors: agreeing.length,
    card: {x0: left, y0: top, x1: left + CARD.width * pitch, y1: top + CARD.height * pitch},
  };
}

const score = (reading: LicenseReading) =>
  (reading.expiresOn ? 4 : 0) + (reading.plate ? 2 : 0) + (reading.model ? 2 : 0) + Math.min(reading.labels, 8) * 0.25;

/** Every pass votes: the most frequent date wins, the best pass breaks ties. */
function merge(readings: LicenseReading[]): LicenseReading {
  const ranked = [...readings].sort((a, b) => score(b) - score(a));
  const votes = new Map<string, number>();
  ranked.forEach((reading) => {
    if (reading.expiresOn) votes.set(reading.expiresOn, (votes.get(reading.expiresOn) ?? 0) + 1);
  });
  const date = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const unique = (values: (string | null)[]) => [...new Set(values.filter((value): value is string => !!value))];
  return {
    model: ranked.find((reading) => reading.model)?.model ?? null,
    plate: ranked.find((reading) => reading.plate)?.plate ?? null,
    expiresOn: date,
    labels: Math.max(0, ...readings.map((reading) => reading.labels)),
    text: readings.map((reading) => reading.text).join("\n"),
    models: unique(readings.map((reading) => reading.model)),
    plates: unique(readings.map((reading) => reading.plate)),
  };
}

async function toWebp(source: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => source.toBlob((blob) => resolve(blob), "image/webp", 0.85));
}

/**
 * Reads a licence screenshot. `onStage` and `onProgress` (0-1 within a pass) drive the
 * scanning animation.
 */
export async function readLicense(file: Blob, {onStage, onProgress}: {
  onStage?: (stage: ScanStage) => void;
  onProgress?: (progress: number) => void;
} = {}): Promise<LicenseScan> {
  onStage?.("loading");
  const bitmap = await createImageBitmap(file);
  setOcrProgress(onProgress ?? null);
  try {
    await getWorker();
    const {width, height} = bitmap;
    const whole: Box = {x0: 0, y0: 0, x1: width, y1: height};
    const longest = Math.max(width, height);
    const readings: LicenseReading[] = [];

    // 1. Locate the card on the whole picture (dark strokes only), in up to three tries.
    onStage?.("locating");
    // The strokes filter works best on ~25 px text; the card's text is ~12 px on a 1080p
    // screen, so pictures up to 2K are doubled first. Further tries cover bigger and smaller text.
    const base = longest > 4000 ? 2600 / longest : longest > 2000 ? 1 : 2;
    const tries = [
      {scale: base, size: 41, delta: 15},
      {scale: base / 2, size: 41, delta: 15},
      {scale: base, size: 21, delta: 25},
      {scale: base * 1.5, size: 61, delta: 15},
    ].filter((attempt) => longest * attempt.scale <= 4200 && longest * attempt.scale >= 300);
    let position: CardPosition | null = null;
    for (const attempt of tries) {
      const picture = strokes(draw(bitmap, whole, attempt.scale), attempt.size, attempt.delta);
      const lines = await recognize(picture, PSM.SPARSE_TEXT, `locate x${attempt.scale.toFixed(2)}`);
      readings.push(parseLicense(lines));
      const found = locate(lines, attempt.scale);
      if (found && (!position || found.anchors > position.anchors)) position = found;
      if (position && position.anchors >= 2) break;
    }

    // 2. The card's text area, enlarged to 40 px rows, in three clean-ups.
    let card: HTMLCanvasElement | null = null;
    if (position) {
      onStage?.("reading");
      const {pitch, card: cardBox} = position;
      const text = clampBox({
        x0: cardBox.x0 + (CARD.labelX - 0.8) * pitch, y0: cardBox.y0 + (CARD.firstRow - 0.9) * pitch,
        x1: cardBox.x0 + (CARD.width - 1.2) * pitch, y1: cardBox.y0 + (CARD.firstRow + 7.9) * pitch,
      }, width, height);
      const scale = Math.min(6, Math.max(0.5, 40 / pitch));
      const area = draw(bitmap, text, scale, "grayscale(1)");
      const passes: [HTMLCanvasElement, PSM, string][] = [
        [strokes(area, 45, 15), PSM.SINGLE_BLOCK, "card strokes"],
        [strokes(area, 31, 25), PSM.SINGLE_BLOCK, "card strokes (fine)"],
        [draw(area, {x0: 0, y0: 0, x1: area.width, y1: area.height}, 1, "contrast(1.4)"), PSM.SINGLE_BLOCK, "card grey"],
      ];
      for (const [image, mode, label] of passes) readings.push(parseLicense(await recognize(image, mode, label)));
      const preview = clampBox(cardBox, width, height);
      card = draw(bitmap, preview, Math.min(1.5, 900 / Math.max(1, preview.x1 - preview.x0)));
    } else if (longest <= 1400) {
      // A tight crop without recognisable labels: read the picture as it is.
      onStage?.("reading");
      const area = draw(bitmap, whole, Math.min(4, Math.max(1, 1000 / width)), "grayscale(1)");
      readings.push(parseLicense(await recognize(area, PSM.SINGLE_BLOCK, "whole grey")));
      readings.push(parseLicense(await recognize(strokes(area, 41, 15), PSM.SINGLE_BLOCK, "whole strokes")));
    }

    onStage?.("done");
    return {reading: merge(readings), crop: card ? await toWebp(card) : null};
  } finally {
    setOcrProgress(null);
    bitmap.close();
    scheduleRelease();
  }
}
