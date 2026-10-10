import {supabase} from "@/lib/supabaseClient";
import {monthKey, todayKey} from "@/lib/datetime";
import {monthLabel} from "@/lib/registry";
import {reportCode, reportDateKey, type ReportForm} from "@/lib/report-templates";

/**
 * Reports saved on the site (report_logs; get_reports, save_report and the rest): the generator
 * saves every report it makes, its author counts it, every member reads it (as on the forum). A
 * report counts for the payroll month it was written in, from one payment to the next (`period`);
 * the payment locks the month. The forum post stays required, its link is optional here.
 */

export interface ReportPerson {
  id: string;
  full_name: string;
  faction_rank: string;
  badge_number: string;
  avatar_url: string | null;
}

/** "report": a full report of the generator; "generator"/"manual": an entry of the old log (title and link). */
export type ReportSource = "report" | "generator" | "manual";

export interface ReportListItem {
  id: string;
  number: number;
  /** The payroll month it counts for ("2026-10-01"). */
  period: string;
  occurred_on: string;
  created_at: string;
  updated_at: string | null;
  source: ReportSource;
  title: string;
  forum_url: string | null;
  suspect_name: string | null;
  charges: string | null;
  fine: string | null;
  jail_time: string | null;
  unit_id: string | null;
  voided: boolean;
  void_reason: string | null;
  excerpt: string | null;
  author: ReportPerson | null;
}

export interface ReportDetail extends ReportListItem {
  officer_name: string | null;
  officer_rank: string | null;
  badge_number: string | null;
  colleagues: string | null;
  suspect_id_card: string | null;
  suspect_license: string | null;
  suspect_medical: string | null;
  report_date: string | null;
  confiscated_items: string | null;
  description: string | null;
  voided_at: string | null;
  voided_by: ReportPerson | null;
  updated_by: ReportPerson | null;
  /** The month was paid: nobody but the leadership changes it. */
  locked: boolean;
  locked_at: string | null;
  can_edit: boolean;
  can_link: boolean;
  can_void: boolean;
}

export interface SavedReport extends ReportListItem {
  locked: boolean;
  /** The author's reports in the report's month. */
  period_count: number;
}

export interface ReportPage {
  items: ReportListItem[];
  more: boolean;
  /** The month listed (null: every month). */
  period: string | null;
  /** The month reports count for now. */
  current: string;
  locked: boolean | null;
  locked_at: string | null;
  /** The payment that opened the month. */
  started_at: string | null;
}

export interface ReportOverviewMember {
  user_id: string;
  full_name: string;
  faction_rank: string;
  badge_number: string;
  avatar_url: string | null;
  reports: number;
  voided: number;
  /** What the payroll counts: the leadership's recorded number, otherwise the reports. */
  counted: number;
  recorded: boolean;
  last_on: string | null;
}

export interface ReportOverview {
  period: string;
  current: string;
  locked: boolean;
  locked_at: string | null;
  started_at: string | null;
  min_reports: number | null;
  total: number;
  voided: number;
  mine: number;
  periods: {period: string; count: number; locked: boolean}[];
  members: ReportOverviewMember[];
}

export interface ReportListFilter {
  period?: string | null;
  allPeriods?: boolean;
  userId?: string | null;
  query?: string;
  before?: number | null;
}

/** "2026. október" */
export const periodLabel = (period: string) => monthLabel(period);
export const reportNumber = (number: number) => `#${number}`;
export const isFullReport = (report: {source: ReportSource}) => report.source === "report";

/** The fields save_report stores (the form as typed) and the report's calendar day. */
export function reportPayload(form: ReportForm, forumUrl?: string | null) {
  return {
    officer_name: form.officerName, officer_rank: form.officerRank, badge_number: form.badgeNumber, colleagues: form.colleagues,
    unit_id: form.unitId, suspect_name: form.suspectName, suspect_id_card: form.suspectIdCard, suspect_license: form.suspectLicense,
    suspect_medical: form.suspectMedical, report_date: form.date, charges: form.charges, fine: form.fine, jail_time: form.jailTime,
    confiscated_items: form.confiscatedItems, description: form.description, occurred_on: reportDateKey(form.date) ?? todayKey(),
    ...(forumUrl !== undefined ? {forum_url: forumUrl} : {}),
  };
}

/** A saved report back in the generator's form (editing it, or its forum BBCode). */
export function reportForm(report: ReportDetail): ReportForm {
  return {
    officerName: report.officer_name ?? "", officerRank: report.officer_rank ?? "", badgeNumber: report.badge_number ?? "",
    colleagues: report.colleagues ?? "", unitId: report.unit_id ?? "", suspectName: report.suspect_name ?? "",
    suspectIdCard: report.suspect_id_card ?? "", suspectLicense: report.suspect_license ?? "", suspectMedical: report.suspect_medical ?? "",
    date: report.report_date ?? "", charges: report.charges ?? "", fine: report.fine ?? "", jailTime: report.jail_time ?? "",
    confiscatedItems: report.confiscated_items ?? "", description: report.description ?? "",
  };
}

/** The forum template of a saved report, as the generator made it. */
export const reportBbcode = (report: ReportDetail) => reportCode(reportForm(report));

/** A form worth saving: someone, a charge or a description. */
export const hasReportContent = (form: ReportForm) => !!(form.suspectName.trim() || form.charges.trim() || form.description.trim());

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const {data, error} = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
}

export const reportsApi = {
  period: () => rpc<{period: string; mine: number; started_at: string | null}>("get_report_period"),
  save: (id: string | null, form: ReportForm, forumUrl?: string | null) =>
    rpc<SavedReport>("save_report", {_report_id: id, _report: reportPayload(form, forumUrl)}),
  setLink: (id: string, url: string | null) => rpc<{id: string; forum_url: string | null}>("set_report_link", {_report_id: id, _forum_url: url}),
  remove: (id: string) => rpc<null>("delete_report", {_report_id: id}),
  void: (id: string, reason: string) => rpc<ReportDetail>("void_report", {_report_id: id, _reason: reason}),
  restore: (id: string) => rpc<ReportDetail>("restore_report", {_report_id: id}),
  get: (id: string) => rpc<ReportDetail>("get_report", {_report_id: id}),
  list: (filter: ReportListFilter = {}) => rpc<ReportPage>("get_reports", {
    _period: filter.period ?? null, _user_id: filter.userId ?? null, _query: filter.query?.trim() || null, _before: filter.before ?? null,
    _limit: 40, _all_periods: !!filter.allPeriods,
  }),
  overview: (period?: string | null) => rpc<ReportOverview>("get_report_overview", {_period: period ?? null}),
};

/** Hungarian text for the errors saving can hit (the server's own messages are Hungarian). */
export function reportError(error: unknown): string {
  const code = typeof error === "object" && error && "code" in error ? String((error as {code: unknown}).code) : "";
  if (code === "23505") return "Ez a fórum-hozzászólás már egy másik jelentéshez tartozik.";
  if (code === "23514") return "Csak forum.hl-rpg.eu link adható meg.";
  return typeof error === "object" && error && "message" in error ? String((error as {message: unknown}).message) : "Ismeretlen hiba történt.";
}

// --- The member's folder link ---------------------------------------------------------
// Members only get their folder's (thread's) link from the forum, so every report of a month
// carries the same link: it is remembered in the browser (and found among their reports otherwise).

const folderKey = (userId: string) => `frakhub.report.folder.${userId}`;

export interface RememberedFolder {
  url: string;
  /** The month ("2026-10-01") the link was last used in: folders are opened monthly. */
  month: string;
}

export function rememberFolder(userId: string, url: string | null) {
  if (!url) return;
  try {
    localStorage.setItem(folderKey(userId), JSON.stringify({url, month: monthKey()} satisfies RememberedFolder));
  } catch {
    // Storage disabled: the reports still have the link.
  }
}

export async function lastFolder(userId: string): Promise<RememberedFolder | null> {
  try {
    const saved = localStorage.getItem(folderKey(userId));
    if (saved) return JSON.parse(saved) as RememberedFolder;
  } catch {
    // Broken entry: ask the reports.
  }
  const {data} = await supabase.from("report_logs").select("forum_url, month").eq("user_id", userId).not("forum_url", "is", null)
    .order("created_at", {ascending: false}).limit(1).maybeSingle();
  const row = data as {forum_url: string; month: string} | null;
  return row ? {url: row.forum_url, month: row.month} : null;
}
