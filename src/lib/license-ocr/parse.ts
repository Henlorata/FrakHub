/**
 * Reading the in-game vehicle licence ("TRAFFIC LICENSE" card) from OCR text, and comparing
 * it with a vehicle of the stock.
 *
 * Pure functions without imports: also used by the end-to-end tests in Node.
 *
 * The card's lines: "Név: <model>", "KM: ...", "Rendsz.: <plate>", "Alvázsz.: <VIN>",
 * "Szín: ...", "Lejár: <yyyy.mm.dd.>", "Kiállító: ...", "Tuning(ok): ...". OCR on a busy
 * background misreads accents and look-alike characters, so labels are matched fuzzily and
 * values are compared through folded keys.
 */

export interface OcrLine {
  text: string;
  /** 0-100, as reported by Tesseract. */
  confidence: number;
}

export interface LicenseReading {
  /** Text after "Név:" (vehicle name / type). */
  model: string | null;
  /** Text after "Rendsz.:" (plate), cleaned. */
  plate: string | null;
  /** Expiry date as yyyy-MM-dd. */
  expiresOn: string | null;
  /** Number of labelled lines that were recognised (a measure of the reading's quality). */
  labels: number;
  /** All recognised text (for the plate/model fallback search). */
  text: string;
  /** Every model and plate reading of several passes (any of them may be the right one). */
  models?: string[];
  plates?: string[];
}

export type LicenseVerdict = "match" | "mismatch" | "expired" | "stale" | "unchanged" | "unreadable";

export interface LicenseCheck {
  verdict: LicenseVerdict;
  plateMatches: boolean;
  modelMatches: boolean;
  /** What to show: the reading that matched the stock, otherwise the best reading. */
  model: string | null;
  plate: string | null;
  expiresOn: string | null;
  /** A plausible new expiry was read (today or later, within 400 days, not earlier than the stored one). */
  dateOk: boolean;
  /** Hungarian explanations for the user (empty for a match). */
  problems: string[];
}

export interface StockVehicle {
  plate: string;
  model: string;
  license_name?: string | null;
  registration_expires_on?: string | null;
}

export type LicenseField = "model" | "km" | "plate" | "vin" | "color" | "expires" | "issuer" | "tuning" | "title";
type Field = LicenseField;

/** Row of each labelled line on the card (0 = "Név"). */
export const FIELD_ROWS: Partial<Record<LicenseField, number>> = {
  model: 0, km: 1, plate: 2, vin: 3, color: 4, expires: 5, issuer: 6, tuning: 7,
};

const LABELS: [Field, string[]][] = [
  ["model", ["NEV"]],
  ["km", ["KM"]],
  ["plate", ["RENDSZ", "RENDSZAM"]],
  ["vin", ["ALVAZSZ", "ALVAZSZAM", "ALVAZ"]],
  ["color", ["SZIN"]],
  ["expires", ["LEJAR", "LEJARAT", "LEJAR0"]],
  ["issuer", ["KIALLITO"]],
  ["tuning", ["TUNING", "TUNINGOK"]],
  ["title", ["TRAFFIC", "LICENSE"]],
];

/** Removes accents: "Lejár" -> "Lejar". */
export const stripAccents = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Folds look-alike characters (O/Q/D -> 0, I/L/J -> 1, Z -> 2, S -> 5, G -> 6, B -> 8). */
const fold = (value: string) => value.replace(/[OQDILJZSGB]/g, (char) => "0001112568"["OQDILJZSGB".indexOf(char)]);

/** Comparison key of a plate. Same rule as private.plate_key() in the database. */
export const plateKey = (plate: string | null | undefined) =>
  fold(stripAccents(plate ?? "").toUpperCase().replace(/[^A-Z0-9]/g, ""));

export function levenshtein(a: string, b: string): number {
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

/** The label of a line ("Rendsz.", "Lejér", "7 Alvézsz") as a field, if it looks like one. */
function classifyLabel(raw: string): Field | null {
  // Junk in front of the label comes from the card's border or chip: use the last word.
  const word = stripAccents(raw).toUpperCase().split(/\s+/).filter(Boolean).pop() ?? "";
  const letters = word.replace(/[^A-Z0-9]/g, "");
  if (letters.length < 2 || letters.length > 10) return null;
  let best: {field: Field; distance: number} | null = null;
  for (const [field, candidates] of LABELS) {
    for (const candidate of candidates) {
      const distance = levenshtein(letters, candidate);
      const allowed = candidate.length <= 3 ? (letters.length === candidate.length ? 1 : 0) : candidate.length <= 5 ? 1 : 2;
      if (distance <= allowed && (!best || distance < best.distance)) best = {field, distance};
    }
  }
  return best?.field ?? null;
}

/** The field a recognised line belongs to ("Lejér: 2026.09.20." -> "expires"). */
export function lineField(text: string): LicenseField | null {
  if (/TRAFF|LICEN/i.test(text) && /\b(TRAFF\w*|\w*ICENSE)\b/i.test(stripAccents(text))) return "title";
  const parts = splitLine(text);
  return parts ? classifyLabel(parts.label) : null;
}

/** "Rendsz.:-GOBLIN-" -> label "Rendsz.", value "-GOBLIN-". */
function splitLine(text: string): {label: string; value: string} | null {
  const line = text.replace(/\s+/g, " ").trim();
  const colon = line.search(/[:;]/);
  if (colon > 0 && colon <= 16) return {label: line.slice(0, colon), value: line.slice(colon + 1).trim()};
  const match = line.match(/^(.{1,14}?)\s+(.+)$/);
  return match ? {label: match[1], value: match[2].trim()} : null;
}

/** Drops background noise after a value (short lowercase fragments such as "aay", "met 8"). */
function trimNoise(value: string): string {
  const tokens = value.split(" ").filter(Boolean);
  while (tokens.length > 1) {
    const last = tokens[tokens.length - 1];
    if (/^[a-z]{1,4}$/.test(last) || /^[^A-Za-z0-9]+$/.test(last) || /^.$/.test(last)) tokens.pop();
    else break;
  }
  return tokens.join(" ").replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9')]+$/g, "");
}

/** The first plate-like token: "-GOBLIN- Poy" -> "GOBLIN". */
function cleanPlate(value: string): string | null {
  const token = value.split(/\s+/).map((part) => part.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, ""))
    .find((part) => part.replace(/[^A-Za-z0-9]/g, "").length >= 2);
  return token ? token.toUpperCase() : null;
}

const DIGIT_LIKE: Record<string, string> = {O: "0", o: "0", D: "0", Q: "0", I: "1", l: "1", i: "1", "|": "1", "!": "1", Z: "2", z: "2",
  S: "5", s: "5", B: "8", g: "9", q: "9"};

const isoDate = (year: number, month: number, day: number): string | null => {
  if (year < 2000 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

/** "2026.09.20.", "2026. 9. 20", "2O26.09.2O" or "20.09.2026" -> "2026-09-20". */
export function parseDate(value: string): string | null {
  const digits = value.replace(/[ODQIlZzSsBgqoi|!]/g, (char) => DIGIT_LIKE[char] ?? char);
  let match = digits.match(/(20\d\d)\s*[.,\-/]\s*(\d{1,2})\s*[.,\-/]\s*(\d{1,2})/);
  if (match) return isoDate(Number(match[1]), Number(match[2]), Number(match[3]));
  match = digits.match(/(\d{1,2})\s*[.,\-/]\s*(\d{1,2})\s*[.,\-/]\s*(20\d\d)/);
  if (match) return isoDate(Number(match[3]), Number(match[2]), Number(match[1]));
  return null;
}

/** Fields of the licence from the recognised lines (best line per field). */
export function parseLicense(lines: OcrLine[]): LicenseReading {
  const best = new Map<Field, {value: string; confidence: number}>();
  for (const line of lines) {
    const parts = splitLine(line.text);
    if (!parts) continue;
    const field = classifyLabel(parts.label);
    if (!field) continue;
    const current = best.get(field);
    if (!current || line.confidence > current.confidence || (!current.value && parts.value)) {
      best.set(field, {value: parts.value, confidence: line.confidence});
    }
  }
  const text = lines.map((line) => line.text).join("\n");
  const modelValue = best.get("model")?.value;
  const plateValue = best.get("plate")?.value;
  const expiresValue = best.get("expires")?.value;
  return {
    model: modelValue ? trimNoise(modelValue) || null : null,
    plate: plateValue ? cleanPlate(plateValue) : null,
    // Without its label the only date on the card is still the expiry.
    expiresOn: (expiresValue ? parseDate(expiresValue) : null) ?? singleDate(text),
    labels: [...best.keys()].filter((field) => field !== "title").length,
    text,
  };
}

function singleDate(text: string): string | null {
  const dates = new Set(text.split("\n").map(parseDate).filter((date): date is string => !!date));
  return dates.size === 1 ? [...dates][0] : null;
}

// --- Comparing with the stock ---------------------------------------------------------

/** Words that describe the livery or the unit rather than the vehicle itself. */
const NOISE = new Set(["MARKED", "UNMARKED", "SLICKTOP", "POLICE", "PARAMEDIC", "VONTATO", "THE"]);

const tokens = (value: string) =>
  stripAccents(value).toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim().split(" ")
    .filter((token) => token.length >= 2 && !NOISE.has(token));

function tokenMatches(a: string, b: string): boolean {
  const x = fold(a);
  const y = fold(b);
  if (x === y) return true;
  // Model years: "'14" and "2014", "22" and "2022".
  if (/^\d{2}$/.test(a) && /^20\d{2}$/.test(b) && b.endsWith(a)) return true;
  if (/^\d{2}$/.test(b) && /^20\d{2}$/.test(a) && a.endsWith(b)) return true;
  return x.length >= 5 && y.length >= 5 && levenshtein(x, y) <= 1;
}

/** Whether the name on the licence is the same vehicle type as the stock's model name. */
export function modelMatches(detected: string | null, expected: string): boolean {
  if (!detected) return false;
  const want = tokens(expected);
  const got = tokens(detected);
  if (!want.length || !got.length) return false;
  const forward = want.filter((token) => got.some((other) => tokenMatches(token, other))).length / want.length;
  if (forward >= 0.66) return true;
  // A shorter in-game name ("Dodge Charger" for "Dodge Charger SRT 2015").
  const matched = got.filter((token) => want.some((other) => tokenMatches(token, other)));
  return matched.length === got.length && matched.some((token) => token.length >= 4);
}

/**
 * The recognised text that shows the vehicle's plate (a plate reading, or a line of the
 * card as a fallback), or null when the plate is not on the licence.
 */
export function findPlate(reading: Pick<LicenseReading, "plate" | "plates" | "text">, expected: string): string | null {
  const key = plateKey(expected);
  if (key.length < 2) return null;
  const plate = [reading.plate, ...(reading.plates ?? [])].find((candidate) => !!candidate && plateKey(candidate) === key);
  if (plate) return plate;
  return reading.text.split("\n").find((line) => plateKey(line).includes(key))?.trim().slice(0, 40) ?? null;
}

export const plateMatches = (reading: Pick<LicenseReading, "plate" | "plates" | "text">, expected: string) =>
  findPlate(reading, expected) !== null;

function dateLooksRight(expiresOn: string | null, current: string | null, today: string): boolean {
  if (!expiresOn) return false;
  const days = Math.round((Date.parse(expiresOn) - Date.parse(today)) / 86_400_000);
  return days >= 0 && days <= MAX_DAYS_AHEAD && (!current || expiresOn >= current);
}

/** The model reading (of any pass) that names the expected vehicle. */
const matchingModel = (reading: LicenseReading, expected: string | null | undefined) =>
  expected ? [reading.model, ...(reading.models ?? [])].find((model) => modelMatches(model, expected)) ?? null : null;

const MAX_DAYS_AHEAD = 400;

/**
 * Whether the reading can be applied to the vehicle without a review. `today` is yyyy-MM-dd
 * (local date), so the result does not depend on the time zone of the test machine.
 */
export function checkLicense(reading: LicenseReading, vehicle: StockVehicle, today: string): LicenseCheck {
  const plateOk = plateMatches(reading, vehicle.plate);
  const modelText = matchingModel(reading, vehicle.model) ?? matchingModel(reading, vehicle.license_name);
  const modelOk = modelText !== null
    // Model not labelled: the name may still be on the card.
    || (!reading.model && reading.text.split("\n").some((line) => modelMatches(line, vehicle.license_name || vehicle.model)));
  const problems: string[] = [];
  const expiresOn = reading.expiresOn;
  // Shown to the user: the readings that matched (a pass may have misread a letter).
  const shown = {
    plateMatches: plateOk,
    modelMatches: modelOk,
    model: modelText ?? reading.model,
    plate: plateOk ? vehicle.plate : reading.plate,
    dateOk: dateLooksRight(expiresOn, vehicle.registration_expires_on ?? null, today),
  };

  if (!expiresOn && !reading.plate && !reading.model && reading.labels < 2) {
    return {verdict: "unreadable", ...shown, expiresOn: null, problems: ["Nem találtunk forgalmi engedélyt a képen."]};
  }
  if (!plateOk) {
    problems.push(reading.plate
      ? `A képen lévő rendszám (${reading.plate}) nem egyezik a jármű rendszámával (${vehicle.plate}).`
      : "A rendszámot nem sikerült kiolvasni.");
  }
  if (!modelOk) {
    problems.push(reading.model
      ? `A képen lévő jármű (${reading.model}) nem egyezik a nyilvántartott típussal (${vehicle.model}).`
      : "A jármű nevét nem sikerült kiolvasni.");
  }
  if (!expiresOn) problems.push("A lejárati dátumot nem sikerült kiolvasni.");
  if (problems.length) {
    return {verdict: expiresOn || plateOk || modelOk ? "mismatch" : "unreadable", ...shown, expiresOn, problems};
  }

  const days = Math.round((Date.parse(expiresOn!) - Date.parse(today)) / 86_400_000);
  if (days < 0) {
    return {verdict: "expired", ...shown, expiresOn,
      problems: ["A képen lévő forgalmi már lejárt. Előbb újítsd meg a játékban, majd tölts fel új képet."]};
  }
  if (days > MAX_DAYS_AHEAD) {
    return {verdict: "mismatch", ...shown, expiresOn,
      problems: ["A kiolvasott lejárati dátum túl távoli, valószínűleg hibás."]};
  }
  const current = vehicle.registration_expires_on ?? null;
  if (current && expiresOn! === current) {
    return {verdict: "unchanged", ...shown, expiresOn,
      problems: ["Ez a lejárat már szerepel a nyilvántartásban."]};
  }
  if (current && expiresOn! < current) {
    return {verdict: "stale", ...shown, expiresOn,
      problems: ["A képen lévő lejárat korábbi a nyilvántartottnál; lehet, hogy egy régi képet töltöttél fel."]};
  }
  return {verdict: "match", ...shown, expiresOn, problems: []};
}
