import {
  clampBox, draw, getWorker, median, PSM, recognize, scheduleRelease, setOcrProgress, strokes, type Box, type OcrTextLine,
} from "@/lib/ocr/engine";
import {cleanMemberName, findDutyRows, parseMinutes, vote, type DutyReading, type DutyRow} from "./parse";

export {warmUpOcr} from "@/lib/ocr/engine";

/**
 * Reads the members' duty time from screenshots of the game's control panel (UCP "Frakció
 * tagok" list), in the browser: Tesseract runs in a web worker, the pictures are never
 * uploaded and are dropped once read (only small cut-outs stay, in memory, for checking).
 *
 *   1. The whole picture is reduced to its light strokes (light text on a dark page) and read;
 *      the "perc" pills anchor the rows, the names come from the column of the status lines.
 *   2. Every pill (and every name) is cut out, enlarged and read again with the characters it
 *      may contain; the readings vote.
 */

export type DutyScanStage = "loading" | "reading" | "checking" | "done";

export interface DutyScanRow extends DutyReading {
  /** The name and the pill as PNG data URLs, for comparing with the reading. */
  namePreview: string | null;
  valuePreview: string | null;
}

const NAME_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÁÉÍÓÖŐÚÜŰáéíóöőúüű'-. ";
const PILL_CHARS = "0123456789perc ";

const height = (box: Box) => Math.max(1, box.y1 - box.y0);

const toPicture = (lines: OcrTextLine[], scale: number): OcrTextLine[] => lines.map((line) => ({
  ...line,
  bbox: {x0: line.bbox.x0 / scale, y0: line.bbox.y0 / scale, x1: line.bbox.x1 / scale, y1: line.bbox.y1 / scale},
  words: line.words.map((word) => ({...word, bbox: {x0: word.bbox.x0 / scale, y0: word.bbox.y0 / scale, x1: word.bbox.x1 / scale, y1: word.bbox.y1 / scale}})),
}));

async function readTwice(bitmap: ImageBitmap, box: Box, textHeight: number, whitelist: string, label: string) {
  const area = draw(bitmap, box, Math.min(8, Math.max(1, 40 / textHeight)), "grayscale(1)");
  const passes: [HTMLCanvasElement, string][] = [
    [strokes(area, 61, 18, "light"), "strokes"],
    [draw(area, {x0: 0, y0: 0, x1: area.width, y1: area.height}, 1, "invert(1) contrast(1.6)"), "inverted"],
  ];
  const texts: string[] = [];
  for (const [image, kind] of passes) {
    const lines = await recognize(image, PSM.SINGLE_LINE, `${label} ${kind}`, whitelist);
    texts.push(lines.map((line) => line.text).join(" ").trim());
  }
  return texts;
}

const preview = (bitmap: ImageBitmap, box: Box, textHeight: number) =>
  draw(bitmap, box, Math.min(3, Math.max(1, 22 / textHeight))).toDataURL("image/png");

/**
 * Whether the number fits the pill's width ("101 perc" is wider than "1 perc"): measured on
 * the panel, the pill is ~2.4 text heights plus ~0.62 per digit.
 */
function plausibleWidth(box: Box, minutes: number): boolean {
  const expected = ((box.x1 - box.x0) / height(box) - 2.4) / 0.62;
  return Math.abs(String(minutes).length - expected) < 1.4;
}

async function locateRows(bitmap: ImageBitmap, scale: number): Promise<DutyRow[]> {
  const {width, height: imageHeight} = bitmap;
  const picture = strokes(draw(bitmap, {x0: 0, y0: 0, x1: width, y1: imageHeight}, scale, "grayscale(1)"), Math.round(scale * 20) + 1, 22, "light");
  return findDutyRows(toPicture(await recognize(picture, PSM.SPARSE_TEXT, `locate x${scale.toFixed(2)}`), scale));
}

/** Reads one screenshot. `onProgress` (0-1) covers the whole picture. */
async function readPicture(file: Blob, onProgress?: (progress: number) => void): Promise<DutyScanRow[]> {
  const bitmap = await createImageBitmap(file);
  try {
    const {width, height: imageHeight} = bitmap;
    const longest = Math.max(width, imageHeight);
    // The panel's text is ~13 px on a 1080p screen; ~20 px suits the strokes filter.
    const scale = longest <= 1400 ? 2 : longest <= 2600 ? 1.5 : longest <= 4000 ? 1 : 2600 / longest;
    setOcrProgress((progress) => onProgress?.(progress * 0.4));
    let rows = await locateRows(bitmap, scale);
    // Small text (a shrunk screenshot) is read again larger.
    const nameHeight = rows.length ? median(rows.map((row) => height(row.nameBox))) : 0;
    if (rows.length && nameHeight * scale < 18 && scale < 3) {
      setOcrProgress((progress) => onProgress?.(0.4 + progress * 0.2));
      const larger = await locateRows(bitmap, Math.min(3, 22 / nameHeight));
      if (larger.length >= rows.length) rows = larger;
    }
    setOcrProgress(null);
    if (!rows.length) return [];

    // Pills without a reading are looked for where the other pills are.
    const pillColumn = rows.filter((row) => row.valueBox).map((row) => row.valueBox!);
    const pillLeft = pillColumn.length ? median(pillColumn.map((box) => box.x0)) : null;
    const pillWidth = pillColumn.length ? median(pillColumn.map((box) => box.x1 - box.x0)) : null;

    const result: DutyScanRow[] = [];
    for (const [index, row] of rows.entries()) {
      onProgress?.(0.6 + (index / rows.length) * 0.4);
      const textHeight = height(row.nameBox);
      const nameBox = clampBox({x0: row.nameBox.x0 - textHeight * 0.3, y0: row.nameBox.y0 - textHeight * 0.35,
        x1: row.nameBox.x1 + textHeight * 0.6, y1: row.nameBox.y1 + textHeight * 0.35}, width, imageHeight);
      const names = (await readTwice(bitmap, nameBox, textHeight, NAME_CHARS, "name")).map(cleanMemberName);
      const nameVote = vote([row.name, ...names]);

      let valueBox: Box | null = row.valueBox;
      if (!valueBox && pillLeft !== null && pillWidth !== null) {
        // The pill sits at the middle of the block, a little lower than the name.
        const middle = row.nameBox.y1 + textHeight * 0.2;
        valueBox = {x0: pillLeft, y0: middle - textHeight * 0.6, x1: pillLeft + pillWidth, y1: middle + textHeight * 0.6};
      }
      let minutes: number | null = row.minutes;
      let certain = false;
      let valuePreview: string | null = null;
      if (valueBox) {
        const h = height(valueBox);
        const box = clampBox({x0: valueBox.x0 - h * 0.3, y0: valueBox.y0 - h * 0.45, x1: valueBox.x1 + h * 0.5, y1: valueBox.y1 + h * 0.45},
          width, imageHeight);
        const readings = (await readTwice(bitmap, box, h, PILL_CHARS, "pill")).map(parseMinutes);
        // The sharper (enlarged) readings go first: they win a tie.
        const counted = vote([...readings, row.minutes]);
        minutes = counted.value;
        // A pill found only by its position, or a number too short or long for the pill, is a guess.
        certain = counted.certain && !!row.valueBox && (minutes === null || plausibleWidth(row.valueBox, minutes));
        valuePreview = preview(bitmap, box, h);
      }
      result.push({
        name: nameVote.value ?? row.name, minutes, certain,
        namePreview: preview(bitmap, nameBox, textHeight), valuePreview,
      });
    }
    return result;
  } finally {
    setOcrProgress(null);
    bitmap.close();
  }
}

/**
 * Reads every screenshot (one after the other). `onStage` reports the picture being read,
 * `onProgress` the progress within it.
 */
export async function readDutyScreenshots(files: Blob[], {onStage, onProgress}: {
  onStage?: (stage: DutyScanStage, picture: number) => void;
  onProgress?: (progress: number) => void;
} = {}): Promise<DutyScanRow[][]> {
  onStage?.("loading", 0);
  try {
    await getWorker();
    const pictures: DutyScanRow[][] = [];
    for (const [index, file] of files.entries()) {
      onStage?.("reading", index);
      pictures.push(await readPicture(file, onProgress));
    }
    onStage?.("done", files.length);
    return pictures;
  } finally {
    scheduleRelease();
  }
}
