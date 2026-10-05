import {
  clampBox, draw, getWorker, median, PSM, recognize, scheduleRelease, setOcrProgress, strokes, type Box, type OcrWord,
} from "@/lib/ocr/engine";
import {CITIZEN_FIELDS, cleanValue, parseCitizen, vote, type CitizenField, type CitizenLabel} from "./parse";

/**
 * Reads a person's data from a screenshot of the in-game police tablet ("Polgárok" page), in the
 * browser: Tesseract runs in a web worker, the picture is never uploaded and is dropped once the
 * reading is done (only small cut-outs of the value boxes are kept, in memory, for checking).
 *
 *   1. The whole picture is reduced to its light strokes (the tablet shows light text on a dark
 *      background) and searched for the labels ("Keresztnév", "Személyi", ...); a value is the
 *      text right of its label.
 *   2. Each value box is cut out, enlarged and read again, limited to the characters the field
 *      may contain (document numbers: hexadecimal digits and dashes).
 *   3. The readings vote for each field; only values in the expected format are returned.
 */

export type CitizenScanStage = "loading" | "locating" | "reading" | "done";

export interface CitizenFieldResult {
  value: string | null;
  /** Every reading agreed (otherwise the most frequent one was taken: worth a closer look). */
  certain: boolean;
  /** The label was on the picture (a missing value was then unreadable rather than cut off). */
  labelFound: boolean;
  /** The label and its value box as a PNG data URL, for comparing with the reading. */
  preview: string | null;
}

export type CitizenScan = Record<CitizenField, CitizenFieldResult>;

const NAME_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÁÉÍÓÖŐÚÜŰáéíóöőúüű'-. ";
const DOCUMENT_CHARS = "0123456789ABCDEF-";
const isName = (field: CitizenField) => field === "firstName" || field === "lastName";

const toPicture = (word: OcrWord, scale: number): OcrWord => ({
  ...word,
  bbox: {x0: word.bbox.x0 / scale, y0: word.bbox.y0 / scale, x1: word.bbox.x1 / scale, y1: word.bbox.y1 / scale},
});

const height = (box: Box) => Math.max(1, box.y1 - box.y0);

/** The value box right of a label (until the next label on the row, or about 16 characters). */
function valueBox(label: CitizenLabel, width: number, imageHeight: number): Box {
  const h = height(label.bbox);
  const center = (label.bbox.y0 + label.bbox.y1) / 2;
  const right = label.limit !== null ? label.limit - h * 0.4 : label.bbox.x1 + h * 16;
  return clampBox({x0: label.bbox.x1 + h * 0.25, y0: center - h * 1.05, x1: Math.max(label.bbox.x1 + h * 2, right), y1: center + h * 1.05},
    width, imageHeight);
}

/**
 * Reads the person's name and document numbers from a screenshot. `onStage` and `onProgress`
 * (0-1 within a pass) drive the scanning animation.
 */
export async function readCitizen(file: Blob, {onStage, onProgress}: {
  onStage?: (stage: CitizenScanStage) => void;
  onProgress?: (progress: number) => void;
} = {}): Promise<CitizenScan> {
  onStage?.("loading");
  const bitmap = await createImageBitmap(file);
  setOcrProgress(onProgress ?? null);
  try {
    await getWorker();
    const {width, height: imageHeight} = bitmap;
    const whole: Box = {x0: 0, y0: 0, x1: width, y1: imageHeight};
    const longest = Math.max(width, imageHeight);
    const candidates = Object.fromEntries(CITIZEN_FIELDS.map((field) => [field, [] as (string | null)[]])) as Record<CitizenField, (string | null)[]>;
    let labels: CitizenLabel[] = [];

    // 1. Labels on the whole picture. The tablet's text is ~13 px on a 1080p screen (a crop keeps
    // that size), the strokes filter likes ~25 px: pictures up to 1440p are doubled first.
    onStage?.("locating");
    const base = longest > 4000 ? 2600 / longest : longest > 2600 ? 1 : 2;
    const tries = [
      {scale: base, size: 41, delta: 22},
      {scale: base * 1.5, size: 61, delta: 18},
      {scale: base / 2, size: 31, delta: 22},
    ].filter((attempt) => longest * attempt.scale <= 4200 && longest * attempt.scale >= 200);
    for (const attempt of tries) {
      const picture = strokes(draw(bitmap, whole, attempt.scale, "grayscale(1)"), attempt.size, attempt.delta, "light");
      const lines = await recognize(picture, PSM.SPARSE_TEXT, `locate x${attempt.scale.toFixed(2)}`);
      const reading = parseCitizen(lines.flatMap((line) => line.words).map((word) => toPicture(word, attempt.scale)));
      CITIZEN_FIELDS.forEach((field) => candidates[field].push(reading.values[field] ?? null));
      const fields = new Set(reading.labels.map((label) => label.field));
      if (fields.size > new Set(labels.map((label) => label.field)).size) labels = reading.labels;
      if (fields.size >= 3) break;
    }

    // 2. Every value box, enlarged (two sizes around 40 px text, two clean-ups each) and read
    // with the field's characters only.
    const previews: Partial<Record<CitizenField, string>> = {};
    if (labels.length) {
      onStage?.("reading");
      const textHeight = median(labels.map((label) => height(label.bbox)));
      for (const label of labels) {
        const box = valueBox(label, width, imageHeight);
        if (box.x1 - box.x0 < textHeight) continue;
        const whitelist = isName(label.field) ? NAME_CHARS : DOCUMENT_CHARS;
        const readings: (string | null)[] = [];
        for (const target of [40, 48]) {
          const area = draw(bitmap, box, Math.min(8, Math.max(1, target / textHeight)), "grayscale(1)");
          const passes: [HTMLCanvasElement, string][] = [
            [strokes(area, 61, 18, "light"), "strokes"],
            [draw(area, {x0: 0, y0: 0, x1: area.width, y1: area.height}, 1, "invert(1) contrast(1.6)"), "inverted"],
          ];
          for (const [image, kind] of passes) {
            const lines = await recognize(image, PSM.SINGLE_LINE, `${label.field} ${kind} ${target}`, whitelist);
            readings.push(cleanValue(label.field, lines.map((line) => line.text).join(" ")));
          }
        }
        // The sharper readings go first: they win a tie.
        candidates[label.field].unshift(...readings);
        if (!previews[label.field]) {
          const shown = clampBox({...box, x0: label.bbox.x0 - textHeight * 0.4}, width, imageHeight);
          previews[label.field] = draw(bitmap, shown, Math.min(3, Math.max(1, 26 / textHeight))).toDataURL("image/png");
        }
      }
    }

    onStage?.("done");
    const found = new Set(labels.map((label) => label.field));
    return Object.fromEntries(CITIZEN_FIELDS.map((field) => [field, {
      ...vote(candidates[field]),
      labelFound: found.has(field),
      preview: previews[field] ?? null,
    }])) as CitizenScan;
  } finally {
    setOcrProgress(null);
    bitmap.close();
    scheduleRelease();
  }
}

export {warmUpOcr} from "@/lib/ocr/engine";
