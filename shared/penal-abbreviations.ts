/**
 * Penal code abbreviations in a report ("GV", "KV", "IFB", "GYO/III.", ...): what each stands for in
 * the faction's penal code (src/data/penalcode.json, passed in), so the AI helper gets only the
 * offences the member wrote instead of the whole code. Pure and dependency-free (the report page and
 * e2e/report-assist.spec.ts use it).
 */

export interface PenalAbbreviation {
  /** As the penal code writes it ("GYO/III." for "gyo/3"). */
  abbr: string;
  /** The offence's full name; several when the abbreviation is ambiguous (KV: Közúti Veszélyeztetés, Kiskorú Veszélyeztetése). */
  names: string[];
}

/** Normalized abbreviation -> the offence(s). */
export type AbbreviationIndex = Map<string, PenalAbbreviation>;

/**
 * The meaning the faction writes an ambiguous abbreviation for: "KV" in a report is Közúti
 * Veszélyeztetés, a charge of almost every ticket, never Kiskorú Veszélyeztetése (the members' rule
 * of 2026-10-10; given both, the model wrote "közúti veszélyeztetés vagy kiskorú veszélyeztetése").
 */
const USUAL_MEANING: Record<string, string> = {KV: "Közúti Veszélyeztetés"};

interface RawItem {
  megnevezes?: unknown;
  rovidites?: unknown;
  alpontok?: unknown;
}

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

/** "gyo / 3." -> "GYO/III": upper case, no spaces, no closing dot, sub-points in Roman numerals. */
export function normalizeAbbreviation(value: string): string {
  return value.toUpperCase().replace(/\s+/g, "").replace(/\.+$/, "")
    .replace(/\/(\d{1,2})$/, (whole, digits: string) => (ROMAN[Number(digits)] ? `/${ROMAN[Number(digits)]}` : whole));
}

/** A sub-point's own name without the list dash and the closing colon ("-Halálesetkor" -> "Halálesetkor"). */
const cleanName = (value: string) => value.trim().replace(/^[-–\s]+/, "").replace(/\s*:$/, "");

/** Every abbreviation of the code with its offence; a sub-point is named with its main offence ("Gyorshajtás Országúton (90km/h) – 100% (180km/h)"). */
export function abbreviationIndex(data: unknown): AbbreviationIndex {
  const index: AbbreviationIndex = new Map();
  const add = (abbr: string, name: string) => {
    const key = normalizeAbbreviation(abbr);
    if (key.replace(/\/.*/, "").length < 2) return;
    const entry = index.get(key);
    if (!entry) {
      index.set(key, {abbr: abbr.trim(), names: [name]});
      return;
    }
    // The only sub-point of a main offence under the same abbreviation (HEH): the sub-point says more.
    const general = entry.names.findIndex((known) => name.startsWith(`${known} – `));
    if (general >= 0) entry.names[general] = name;
    else if (!entry.names.includes(name)) entry.names.push(name);
  };
  const walk = (items: unknown, parent: string | null) => {
    if (!Array.isArray(items)) return;
    for (const raw of items as RawItem[]) {
      const own = typeof raw.megnevezes === "string" ? cleanName(raw.megnevezes) : "";
      if (!own) continue;
      const name = parent ? `${parent} – ${own}` : own;
      const abbr = typeof raw.rovidites === "string" ? raw.rovidites.trim() : "";
      const subPoints = Array.isArray(raw.alpontok) ? raw.alpontok as RawItem[] : [];
      if (abbr) add(abbr, name);
      // "GYO" alone names the main offence of the "GYO/I." - "GYO/IV." sub-points.
      const stems = new Set(subPoints.map((point) => (typeof point.rovidites === "string" ? point.rovidites.split("/")[0].trim() : "")).filter(Boolean));
      if (!abbr && stems.size === 1) add([...stems][0], name);
      walk(subPoints, name);
    }
  };
  for (const category of Array.isArray(data) ? data : []) walk((category as {tetelek?: unknown}).tetelek, null);
  for (const [key, meaning] of Object.entries(USUAL_MEANING)) {
    const entry = index.get(key);
    if (entry?.names.includes(meaning)) entry.names = [meaning];
  }
  return index;
}

/**
 * Upper-case words of two to eight letters, optionally with a sub-point ("GV", "TJVÁ", "GYO/III.",
 * "GYO/3"), but not a unit ("KM/H"). Lower-case ones are words ("km/h", "-ra"), never offences,
 * except in the list of charges.
 */
const TOKEN = /(?<![\p{L}\p{N}])(\p{Lu}{2,8}(?:\s?\/\s?(?:[IVX]{1,4}|\d{1,2})\.?)?)(?![\p{L}\p{N}]|\/\p{L})/gu;
const LIST_SEPARATOR = /[,;\n+]|\s(?:és|valamint|illetve)\s/;

/** A sub-point the code does not have ("GYO/V") falls back to its main offence ("GYO"). */
const lookup = (index: AbbreviationIndex, value: string) => {
  const key = normalizeAbbreviation(value);
  return index.get(key) ?? (key.includes("/") ? index.get(key.replace(/\/.*/, "")) : undefined);
};

/**
 * The offences a report names by abbreviation, each once, in order (at most `limit`): the upper-case
 * ones of the charges and the description, and the charges' items in any case ("gv, kv").
 */
export function reportAbbreviations(index: AbbreviationIndex, report: {charges?: string; description?: string}, limit = 20): PenalAbbreviation[] {
  const found = new Map<string, PenalAbbreviation>();
  const take = (entry: PenalAbbreviation | undefined) => {
    if (entry && found.size < limit) found.set(entry.abbr, entry);
  };
  const charges = report.charges ?? "";
  for (const item of charges.split(LIST_SEPARATOR)) take(lookup(index, item.replace(/\(?\s*x\s*\d+\s*\)?\s*$/i, "").trim()));
  for (const text of [charges, report.description ?? ""]) {
    for (const match of text.matchAll(TOKEN)) take(lookup(index, match[1]));
  }
  return [...found.values()];
}
