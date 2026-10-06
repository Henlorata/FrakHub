import {addDaysKey, addMonths, monthKey, todayKey} from "@/lib/datetime";
import type {Profile} from "@/types/supabase";
import type {Row} from "../postgrest";

/** An error the demo world returns like the database would (the UI shows `message`). */
export class SandboxError extends Error {
  readonly code: string;

  constructor(message: string, code = "P0001") {
    super(message);
    this.code = code;
  }
}

export type Tables = Record<string, Row[]>;

export interface World {
  me: Profile;
  tables: Tables;
  /** ISO time `minutes` before the world was built. */
  ago: (minutes: number) => string;
  /** ISO time now (writes). */
  stamp: () => string;
  /** A Hungarian calendar day relative to today ("2026-10-05"). */
  day: (offset?: number) => string;
  /** First day of a month relative to this one ("2026-10-01"). */
  month: (offset?: number) => string;
  person: (id: string | null | undefined) => Row | undefined;
  id: () => string;
}

export type RpcHandler = (args: Record<string, unknown>, world: World) => unknown;

/** Fixed ids of the demo rows the trainings open (the same in every practice world). */
export const DEMO = {
  person: (n: number) => `de000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`,
  case: (n: number) => `de000000-0000-4000-8000-0000000002${String(n).padStart(2, "0")}`,
  suspect: (n: number) => `de000000-0000-4000-8000-0000000003${String(n).padStart(2, "0")}`,
  exam: (n: number) => `de000000-0000-4000-8000-0000000004${String(n).padStart(2, "0")}`,
  sheet: (n: number) => `de000000-0000-4000-8000-0000000005${String(n).padStart(2, "0")}`,
  vehicle: (n: number) => `de000000-0000-4000-8000-0000000006${String(n).padStart(2, "0")}`,
  page: (n: number) => `de000000-0000-4000-8000-0000000007${String(n).padStart(2, "0")}`,
  event: (n: number) => `de000000-0000-4000-8000-0000000008${String(n).padStart(2, "0")}`,
} as const;

export function createWorld(me: Profile): World {
  const builtAt = Date.now();
  const tables: Tables = {};
  const today = todayKey();
  const thisMonth = monthKey();
  return {
    me,
    tables,
    ago: (minutes) => new Date(builtAt - minutes * 60_000).toISOString(),
    stamp: () => new Date().toISOString(),
    day: (offset = 0) => addDaysKey(today, offset),
    month: (offset = 0) => addMonths(thisMonth, offset),
    person: (id) => (id ? tables.profiles?.find((row) => row.id === id) : undefined),
    id: () => crypto.randomUUID(),
  };
}

export const DAY = 24 * 60;
