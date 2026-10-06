import {supabase} from "@/lib/supabaseClient";

/**
 * The report log: members record the reports they posted on the forum (the forum cannot be
 * read by programs), the monthly payroll counts them. One row per report; a forum post can be
 * recorded once.
 */
export interface ReportLog {
  id: string;
  user_id: string;
  occurred_on: string;
  month: string;
  title: string;
  forum_url: string | null;
  source: "generator" | "manual";
  created_at: string;
  created_by: string | null;
}

export type NewReportLog = Pick<ReportLog, "user_id" | "occurred_on" | "title" | "forum_url" | "source">;

const COLUMNS = "id, user_id, occurred_on, month, title, forum_url, source, created_at, created_by";

export const reportLog = {
  /** The month's reports: the caller's own, or everyone's for staff (RLS decides). */
  month: async (month: string, userId?: string) => {
    let query = supabase.from("report_logs").select(COLUMNS).eq("month", month).order("occurred_on", {ascending: false})
      .order("created_at", {ascending: false});
    if (userId) query = query.eq("user_id", userId);
    const {data, error} = await query;
    if (error) throw error;
    return (data ?? []) as unknown as ReportLog[];
  },
  count: async (month: string, userId: string) => {
    const {count, error} = await supabase.from("report_logs").select("id", {count: "exact", head: true})
      .eq("month", month).eq("user_id", userId);
    if (error) throw error;
    return count ?? 0;
  },
  add: async (rows: NewReportLog[]) => {
    const {error} = await supabase.from("report_logs").insert(rows);
    if (error) throw error;
  },
  update: async (id: string, patch: Partial<Pick<ReportLog, "title" | "forum_url" | "occurred_on">>) => {
    const {error} = await supabase.from("report_logs").update(patch).eq("id", id);
    if (error) throw error;
  },
  remove: async (id: string) => {
    const {error} = await supabase.from("report_logs").delete().eq("id", id);
    if (error) throw error;
  },
};

// --- The member's folder link ---------------------------------------------------------
// Members only get their folder's (thread's) link from the forum, so every report of a month
// carries the same link: it is remembered in the browser (and found in the log otherwise).

const folderKey = (userId: string) => `frakhub.report.folder.${userId}`;

export interface RememberedFolder {
  url: string;
  /** The month ("2026-10-01") the link was last used in: folders are opened monthly. */
  month: string;
}

export function rememberFolder(userId: string, url: string | null, month: string) {
  if (!url) return;
  try {
    localStorage.setItem(folderKey(userId), JSON.stringify({url, month}));
  } catch {
    // Storage disabled: the log still has the link.
  }
}

export async function lastFolder(userId: string): Promise<RememberedFolder | null> {
  try {
    const saved = localStorage.getItem(folderKey(userId));
    if (saved) return JSON.parse(saved) as RememberedFolder;
  } catch {
    // Broken entry: ask the log.
  }
  const {data} = await supabase.from("report_logs").select("forum_url, month").eq("user_id", userId).not("forum_url", "is", null)
    .order("created_at", {ascending: false}).limit(1).maybeSingle();
  const row = data as {forum_url: string; month: string} | null;
  return row ? {url: row.forum_url, month: row.month} : null;
}

/** Hungarian text for the errors a log insert can hit. */
export function reportLogError(error: unknown): string {
  const code = typeof error === "object" && error && "code" in error ? String((error as {code: unknown}).code) : "";
  if (code === "23505") return "Ez a fórum-bejegyzés már rögzítve van.";
  if (code === "23514") return "Csak forum.hl-rpg.eu link adható meg.";
  if (code === "42501") return "Ehhez nincs jogosultságod (vagy a dátum túl régi).";
  return typeof error === "object" && error && "message" in error ? String((error as {message: unknown}).message) : "Ismeretlen hiba történt.";
}
