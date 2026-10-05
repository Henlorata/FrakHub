/**
 * Reading a person's data from the in-game police tablet's "Polgárok" page (OCR words with their
 * boxes), for the report form.
 *
 * Pure functions without imports: also used by the end-to-end tests in Node.
 *
 * The page shows labels with a value box to their right: "Keresztnév", "Vezetéknév",
 * "Jogosítvány", "Személyi", "Egészségügyi sorszáma" (and "Jogosítvány eltiltás", "Munkahely",
 * which are not needed). Screenshots are cropped differently, so nothing relies on positions:
 * every label is matched fuzzily (OCR misreads accents) and its value is the text right of it on
 * the same row, up to the next label or a wide gap. The document numbers look like
 * "BED-C62-F95": three groups of one to three hexadecimal digits.
 */

export interface OcrBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrWordLike {
  text: string;
  /** 0-100, as reported by Tesseract. */
  confidence: number;
  bbox: OcrBox;
}

export type CitizenField = "firstName" | "lastName" | "license" | "idCard" | "medical";

export const CITIZEN_FIELDS: readonly CitizenField[] = ["firstName", "lastName", "license", "idCard", "medical"];

/** A label found on the picture: where its value starts and what may end it. */
export interface CitizenLabel {
  field: CitizenField;
  /** The label's box (picture coordinates of the pass). */
  bbox: OcrBox;
  /** Left edge of the next label on the same row, if any (the value ends before it). */
  limit: number | null;
}

export interface CitizenReading {
  /** Values that passed the format checks, per field. */
  values: Partial<Record<CitizenField, string>>;
  /** Labels found (the next pass reads their value boxes again). */
  labels: CitizenLabel[];
}

type LabelKind = CitizenField | "medicalPrefix" | "ban" | "other";

/** Labels as accent-free capitals. "other" labels only end a value. */
const LABELS: [LabelKind, string][] = [
  ["firstName", "KERESZTNEV"],
  ["lastName", "VEZETEKNEV"],
  ["license", "JOGOSITVANY"],
  ["idCard", "SZEMELYI"],
  ["medical", "SORSZAMA"],
  ["medical", "EGESZSEGUGYISORSZAMA"],
  ["medicalPrefix", "EGESZSEGUGYI"],
  ["ban", "ELTILTAS"],
  ["other", "JOGOSITVANYELTILTAS"],
  ["other", "MUNKAHELY"],
  ["other", "INFORMACIOK"],
  ["other", "POLGAROK"],
  ["other", "KERESES"],
];

/** Removes accents: "Keresztnév" -> "Keresztnev". */
const stripAccents = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Accent-free capitals and digits only: "Személyi:" -> "SZEMELYI". */
const labelKey = (value: string) => stripAccents(value).toUpperCase().replace(/[^A-Z0-9]/g, "");

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({length: b.length + 1}, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

/** The label a word stands for, if it looks like one ("Keresztn6v" -> firstName). */
export function labelKind(text: string): LabelKind | null {
  const key = labelKey(text);
  if (key.length < 5) return null;
  let best: {kind: LabelKind; distance: number} | null = null;
  for (const [kind, label] of LABELS) {
    const allowed = label.length >= 10 ? 2 : 1;
    const distance = levenshtein(key, label);
    if (distance <= allowed && (!best || distance < best.distance)) best = {kind, distance};
  }
  return best?.kind ?? null;
}

const height = (box: OcrBox) => Math.max(1, box.y1 - box.y0);
const centerY = (box: OcrBox) => (box.y0 + box.y1) / 2;

/** Whether two boxes sit on the same text row. */
const sameRow = (a: OcrBox, b: OcrBox) => Math.abs(centerY(a) - centerY(b)) <= Math.max(height(a), height(b)) * 0.6;

/** Look-alikes of hexadecimal digits (OCR of "0", "1", "5" ...). */
const HEX_LOOKALIKES: Record<string, string> = {O: "0", Q: "0", I: "1", L: "1", J: "1", "|": "1", "!": "1", S: "5", Z: "2", G: "6", T: "7"};

/**
 * A document number: "bed-c62 -f95" -> "BED-C62-F95". Null unless it is three groups of one
 * to three hexadecimal digits (a lost dash between two full groups is put back).
 */
export function cleanDocumentNumber(raw: string): string | null {
  let value = raw.toUpperCase().replace(/[‐-―−_~=]/g, "-").replace(/\s+/g, "");
  value = value.replace(/[OQILJ|!SZGT]/g, (char) => HEX_LOOKALIKES[char] ?? char).replace(/[^0-9A-F-]/g, "");
  value = value.replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
  let groups = value.split("-").filter(Boolean);
  // "BEDC62-F95": a group of six is two full groups.
  if (groups.length === 2) groups = groups.flatMap((group) => (group.length === 6 ? [group.slice(0, 3), group.slice(3)] : [group]));
  if (groups.length === 1 && groups[0].length === 9) groups = [groups[0].slice(0, 3), groups[0].slice(3, 6), groups[0].slice(6)];
  if (groups.length !== 3 || groups.some((group) => group.length < 1 || group.length > 3)) return null;
  return groups.join("-");
}

/**
 * A first or last name: "Adolf", "De La Cruz", "O'Neil". Null when it does not look like one
 * (digits or symbols inside are misreadings: another pass, or the member, has to supply it).
 */
export function cleanName(raw: string): string | null {
  const name = raw.replace(/\s+/g, " ").trim().replace(/^[^\p{L}]+|[^\p{L}.]+$/gu, "");
  if (!/^\p{L}[\p{L}' .-]*$/u.test(name) || name.length > 40) return null;
  const words = name.split(" ");
  if (words.length > 4 || name.replace(/[^\p{L}]/gu, "").length < 2) return null;
  // Single letters left from noise ("Adolf l") are not part of a name (initials have a dot).
  if (words.length > 1 && words.some((word) => word.replace(/[^\p{L}]/gu, "").length < 2 && !/^\p{Lu}\.$/u.test(word))) return null;
  if (labelKind(name) || words.some((word) => labelKind(word))) return null;
  return name;
}

/** The checked value of a field from its raw text. */
export const cleanValue = (field: CitizenField, raw: string): string | null =>
  field === "firstName" || field === "lastName" ? cleanName(raw) : cleanDocumentNumber(raw);

/** "eltiltás" right after "Jogosítvány", even when misread ("eltitds", "eltihis"). */
const looksLikeBan = (text: string) => {
  const key = labelKey(text);
  return key.startsWith("ELT") || levenshtein(key, "ELTILTAS") <= 3;
};

/** Labels on the picture (one per field and row; "Jogosítvány eltiltás" is not the licence). */
export function findLabels(words: OcrWordLike[]): CitizenLabel[] {
  const marked = words.map((word) => ({word, kind: labelKind(word.text)}));
  const isLabel = marked.filter((item) => item.kind);
  const found: CitizenLabel[] = [];
  for (const {word, kind} of isLabel) {
    if (!kind || kind === "ban" || kind === "other") continue;
    const h = height(word.bbox);
    // What follows on the same row, left to right.
    const after = marked
      .filter((item) => item.word !== word && item.word.bbox.x0 >= word.bbox.x1 - h * 0.3 && sameRow(item.word.bbox, word.bbox))
      .sort((a, b) => a.word.bbox.x0 - b.word.bbox.x0);
    const next = after[0];
    let field: CitizenField;
    if (kind === "medicalPrefix") {
      // "Egészségügyi sorszáma": the value follows "sorszáma"; without it, the prefix stands for both.
      if (next && next.kind === "medical" && next.word.bbox.x0 - word.bbox.x1 < h * 2.5) continue;
      field = "medical";
    } else if (kind === "license" && next && next.word.bbox.x0 - word.bbox.x1 < h * 2.5 && looksLikeBan(next.word.text)) {
      continue;
    } else {
      field = kind;
    }
    const limit = after.find((item) => item.kind && item.word.bbox.x0 > word.bbox.x1)?.word.bbox.x0 ?? null;
    found.push({field, bbox: word.bbox, limit});
  }
  return found;
}

/** The text right of a label, up to the next label or a wide gap. */
export function valueAfter(label: CitizenLabel, words: OcrWordLike[]): string {
  const h = height(label.bbox);
  const candidates = words
    .filter((word) => word.bbox.x0 >= label.bbox.x1 - h * 0.2 && sameRow(word.bbox, label.bbox)
      && (label.limit === null || word.bbox.x1 <= label.limit + h * 0.2) && !labelKind(word.text))
    .sort((a, b) => a.bbox.x0 - b.bbox.x0);
  const parts: string[] = [];
  let right = label.bbox.x1;
  for (const word of candidates) {
    // The value box starts close to its label; a gap of several characters ends the value.
    const gap = word.bbox.x0 - right;
    if (gap > h * (parts.length ? 2.2 : 6)) break;
    parts.push(word.text);
    right = word.bbox.x1;
  }
  return parts.join(" ").trim();
}

/** Every field whose label and a valid value were found. */
export function parseCitizen(words: OcrWordLike[]): CitizenReading {
  const labels = findLabels(words);
  const values: Partial<Record<CitizenField, string>> = {};
  for (const label of labels) {
    if (values[label.field]) continue;
    const value = cleanValue(label.field, valueAfter(label, words));
    if (value) values[label.field] = value;
  }
  return {values, labels};
}

/**
 * The value of a field from several readings: the most frequent one; ties go to the reading
 * listed first (the sharpest pass). `certain` when at least two readings agree and none differs.
 */
export function vote(candidates: (string | null | undefined)[]): {value: string | null; certain: boolean} {
  const counts = new Map<string, number>();
  candidates.forEach((candidate) => {
    if (candidate) counts.set(candidate, (counts.get(candidate) ?? 0) + 1);
  });
  let best: string | null = null;
  let bestCount = 0;
  for (const candidate of candidates) {
    if (!candidate) continue;
    const count = counts.get(candidate) ?? 0;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return {value: best, certain: counts.size === 1 && bestCount >= 2};
}

/** "Adolf" + "Garcia" -> "Adolf Garcia" (the game shows first name first). */
export const fullName = (firstName: string | null | undefined, lastName: string | null | undefined) =>
  [firstName, lastName].filter(Boolean).join(" ");
