import {supabase} from "./supabaseClient";
import type {ErrorKind} from "./error-reporting";

/** The database's size against the free plan, measured by the daily housekeeping (private.app_state "db_health"). */
export interface DbHealth {
  bytes: number;
  limit_bytes: number;
  measured_at: string;
  largest: {table: string; bytes: number}[];
}

/** Share of the free plan's database used (whole percent). */
export const dbUsedPercent = (health: Pick<DbHealth, "bytes" | "limit_bytes"> | null | undefined) =>
  health && health.limit_bytes > 0 ? Math.round((health.bytes / health.limit_bytes) * 100) : null;

/** A row of the error log (get_client_errors): one kind of error with its repeats. */
export interface ClientError {
  id: string;
  kind: ErrorKind;
  message: string;
  detail: string | null;
  /** Newest first: the pages (ids folded), builds and browsers it came from. */
  routes: string[];
  builds: string[];
  browsers: string[];
  occurrences: number;
  /** Reports from visitors (public pages, guest exams): only counted. */
  guests: number;
  /** How many members met it; `users` names the latest five. */
  members: number;
  users: {id: string; full_name: string; badge_number: string | null}[];
  first_seen: string;
  last_seen: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export const ERROR_KIND_LABELS: Record<ErrorKind, string> = {
  crash: "Összeomlott oldal",
  error: "Kezeletlen hiba",
  upload: "Feltöltés",
  api: "Szerverfüggvény",
  database: "Adatbázis",
};

/** The error log for the Executive Staff and the Bureau Manager (statistics page). */
export const errorLogApi = {
  async load(): Promise<{open: number; items: ClientError[]}> {
    const {data, error} = await supabase.rpc("get_client_errors");
    if (error) throw error;
    return data as {open: number; items: ClientError[]};
  },
  /** Marks rows handled (or open again); returns how many changed. */
  async resolve(ids: string[], resolved = true): Promise<number> {
    const {data, error} = await supabase.rpc("resolve_client_errors", {_ids: ids, _resolved: resolved});
    if (error) throw error;
    return data as number;
  },
};
