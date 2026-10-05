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

/** Hungarian text for the errors a log insert can hit. */
export function reportLogError(error: unknown): string {
  const code = typeof error === "object" && error && "code" in error ? String((error as {code: unknown}).code) : "";
  if (code === "23505") return "Ez a fórum-bejegyzés már rögzítve van.";
  if (code === "23514") return "Csak forum.hl-rpg.eu link adható meg.";
  if (code === "42501") return "Ehhez nincs jogosultságod (vagy a dátum túl régi).";
  return typeof error === "object" && error && "message" in error ? String((error as {message: unknown}).message) : "Ismeretlen hiba történt.";
}
