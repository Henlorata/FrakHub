import penalCode from "../data/penalcode.json";
import {supabase} from "./supabaseClient";

/**
 * Department statistics (get_department_stats): what the department did in a period compared with
 * the period before, from the calculator's action log, the report log, the cases, the BOLO alerts
 * and the warrants. Only counts and sums; no names.
 */

export interface StatTotals {
  tickets: number;
  arrests: number;
  fines: number;
  jail_minutes: number;
  reports: number;
  bolos: number;
  bolos_resolved: number;
  cases_opened: number;
  cases_closed: number;
  warrants: number;
}

export interface DepartmentStats {
  days: number;
  from: string;
  to: string;
  unit: "week" | "month";
  current: StatTotals;
  previous: StatTotals;
  series: {start: string; tickets: number; arrests: number; fines: number; reports: number}[];
  offenses: {code: string; count: number}[];
  /** dow: 1 = Monday … 7 = Sunday (Hungarian time). */
  heatmap: {dow: number; hour: number; count: number}[];
}

export const statsApi = {
  load: async (days: number): Promise<DepartmentStats> => {
    const {data, error} = await supabase.rpc("get_department_stats", {_days: days});
    if (error) throw error;
    return data as DepartmentStats;
  },
};

// --- The penal code's names for the abbreviations the calculator copies ---------------------

interface PenalEntry {
  name: string;
  category: string;
}

let index: Map<string, PenalEntry> | null = null;

function buildIndex(): Map<string, PenalEntry> {
  const map = new Map<string, PenalEntry>();
  const tidy = (name: string) => name.replace(/^[-–\s]+/, "").trim();
  const add = (abbr: unknown, name: string, category: string) => {
    if (typeof abbr === "string" && abbr && !map.has(abbr.toUpperCase())) map.set(abbr.toUpperCase(), {name, category});
  };
  type Item = {megnevezes?: string; rovidites?: string | null; alpontok?: Item[]};
  for (const group of penalCode as {kategoria_nev: string; tetelek: Item[]}[]) {
    for (const item of group.tetelek ?? []) {
      const name = tidy(item.megnevezes ?? "");
      add(item.rovidites, name, group.kategoria_nev);
      // Sub-points carry their own abbreviation ("KBO/I."): named after the item and the point.
      for (const point of item.alpontok ?? []) add(point.rovidites, `${name} – ${tidy(point.megnevezes ?? "")}`, group.kategoria_nev);
    }
  }
  return map;
}

/** "RJVK/III." -> the item "RJVK" (the degree after the slash is kept in the code). */
export function penalEntry(code: string): PenalEntry | null {
  index ??= buildIndex();
  const base = code.split("/")[0].trim().toUpperCase();
  return index.get(code.trim().toUpperCase()) ?? index.get(base) ?? null;
}

/** Change against the previous period: +12 %, −5 %, or null when there is nothing to compare with. */
export function change(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export const compactNumber = (value: number) => new Intl.NumberFormat("hu-HU", {notation: value >= 100_000 ? "compact" : "standard",
  maximumFractionDigits: 1}).format(value);
