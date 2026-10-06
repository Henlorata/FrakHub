/**
 * Penal code changes: flattens src/data/penalcode.json to one entry per offence (with the same
 * stable ids as src/lib/penalcode-processor.ts) and compares two versions. Used by the change-log
 * script (tooling/penal-changelog.ts), its guard test and the calculator's "what changed" list.
 * Dependency- and alias-free (shared with api/ and the e2e tests).
 */

export interface PenalEntry {
  /** item:<paragraph>[|<sub-paragraph>]|<abbreviation>, as in the calculator. */
  id: string;
  paragraph: string;
  name: string;
  category: string;
  fine: [number | null, number | null];
  jail: [number | string | null, number | string | null];
  note: string;
}

export type PenalField = "name" | "fine" | "jail" | "note";

export interface PenalChange {
  kind: "added" | "removed" | "changed";
  id: string;
  paragraph: string;
  name: string;
  /** What changed (only for "changed"): the old and the new text. */
  fields?: {field: PenalField; from: string; to: string}[];
}

interface RawItem {
  paragrafus: string;
  megnevezes: string;
  min_birsag: number | null;
  max_birsag: number | null;
  min_fegyhaz: number | string | null;
  max_fegyhaz: number | string | null;
  rovidites: string | null;
  megjegyzes?: string | null;
  alpontok?: RawItem[];
}

interface RawCategory {
  kategoria_nev: string;
  tetelek: RawItem[];
}

const stableId = (...parts: (string | null | undefined)[]) => `item:${parts.filter(Boolean).join("|")}`;

/** One entry per offence that can be charged (groups contribute their sub-items). */
export function flattenPenalCode(data: unknown): PenalEntry[] {
  const entries: PenalEntry[] = [];
  for (const category of (data as RawCategory[]) ?? []) {
    for (const item of category.tetelek ?? []) {
      if (item.alpontok && item.alpontok.length > 0) {
        for (const sub of item.alpontok) {
          entries.push({
            id: stableId(item.paragrafus, sub.paragrafus, sub.rovidites), paragraph: `${item.paragrafus} ${sub.paragrafus}`.trim(),
            name: `${item.megnevezes} – ${sub.megnevezes}`, category: category.kategoria_nev,
            fine: [sub.min_birsag, sub.max_birsag], jail: [sub.min_fegyhaz, sub.max_fegyhaz],
            note: `${item.megjegyzes ?? ""} ${sub.megjegyzes ?? ""}`.trim(),
          });
        }
      } else if (item.rovidites) {
        entries.push({
          id: stableId(item.paragrafus, item.rovidites), paragraph: item.paragrafus, name: item.megnevezes, category: category.kategoria_nev,
          fine: [item.min_birsag, item.max_birsag], jail: [item.min_fegyhaz, item.max_fegyhaz], note: (item.megjegyzes ?? "").trim(),
        });
      }
    }
  }
  return entries;
}

const money = (value: number | string | null) => (value === null ? "–" : typeof value === "number" ? `$${value.toLocaleString("hu-HU")}` : value);
const minutes = (value: number | string | null) => (value === null ? "–" : typeof value === "number" ? `${value} perc` : value);

function range(pair: [number | string | null, number | string | null], format: (value: number | string | null) => string): string {
  if (pair[0] === null && pair[1] === null) return "nincs";
  return pair[0] === pair[1] ? format(pair[0]) : `${format(pair[0])} – ${format(pair[1])}`;
}

/** Human-readable value of a field (the change list shows "from → to"). */
export function fieldText(entry: PenalEntry, field: PenalField): string {
  switch (field) {
    case "name":
      return entry.name;
    case "fine":
      return range(entry.fine, money);
    case "jail":
      return range(entry.jail, minutes);
    case "note":
      return entry.note || "–";
  }
}

const FIELDS: PenalField[] = ["name", "fine", "jail", "note"];

/** What changed from `before` to `after` (by stable id; a renamed abbreviation shows as removed + added). */
export function diffPenalCode(before: PenalEntry[], after: PenalEntry[]): PenalChange[] {
  const old = new Map(before.map((entry) => [entry.id, entry]));
  const next = new Map(after.map((entry) => [entry.id, entry]));
  const changes: PenalChange[] = [];
  for (const entry of after) {
    const previous = old.get(entry.id);
    if (!previous) {
      changes.push({kind: "added", id: entry.id, paragraph: entry.paragraph, name: entry.name});
      continue;
    }
    const fields = FIELDS.filter((field) => fieldText(previous, field) !== fieldText(entry, field))
      .map((field) => ({field, from: fieldText(previous, field), to: fieldText(entry, field)}));
    if (fields.length > 0) changes.push({kind: "changed", id: entry.id, paragraph: entry.paragraph, name: entry.name, fields});
  }
  for (const entry of before) {
    if (!next.has(entry.id)) changes.push({kind: "removed", id: entry.id, paragraph: entry.paragraph, name: entry.name});
  }
  return changes;
}

/** "3 új, 5 módosult és 1 törölt tétel." */
export function summarizeChanges(changes: PenalChange[]): string {
  const count = (kind: PenalChange["kind"]) => changes.filter((change) => change.kind === kind).length;
  const parts = [
    count("added") && `${count("added")} új`,
    count("changed") && `${count("changed")} módosult`,
    count("removed") && `${count("removed")} törölt`,
  ].filter(Boolean) as string[];
  if (parts.length === 0) return "Nincs változás.";
  const last = parts.pop();
  return `${parts.length ? `${parts.join(", ")} és ${last}` : last} tétel.`;
}
