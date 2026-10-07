import {supabase} from "./supabaseClient";

/**
 * Performance reviews: a quarterly evaluation of a member by a staff member above them. Six
 * criteria scored 1–5 (the database keeps the same keys in private.review_criteria()), strengths,
 * things to improve and goals. Drafts are the reviewer's; shared, the member acknowledges them.
 */

export type ReviewCriterion = "activity" | "reports" | "teamwork" | "conduct" | "knowledge" | "initiative";
export type ReviewStatus = "draft" | "shared" | "acknowledged";

export const REVIEW_CRITERIA: {key: ReviewCriterion; label: string; hint: string}[] = [
  {key: "activity", label: "Aktivitás", hint: "Szolgálatban töltött idő, rendezvények, elérhetőség"},
  {key: "reports", label: "Jelentések", hint: "A jelentések száma, pontossága és formája"},
  {key: "teamwork", label: "Csapatmunka", hint: "Együttműködés, segítőkészség, kommunikáció a rádión"},
  {key: "conduct", label: "Magatartás", hint: "Fegyelem, megjelenés, a szabályzatok betartása"},
  {key: "knowledge", label: "Szakmai tudás", hint: "Büntető törvénykönyv, eljárások, kódok ismerete"},
  {key: "initiative", label: "Kezdeményezés", hint: "Önállóság, ötletek, felelősségvállalás"},
];

export const SCORE_LABELS = ["", "Gyenge", "Fejlesztendő", "Megfelelő", "Jó", "Kiváló"];

export const REVIEW_STATUS: Record<ReviewStatus, {label: string; tone: string}> = {
  draft: {label: "Piszkozat", tone: "bg-white/5 text-slate-300 ring-white/10"},
  shared: {label: "Megosztva", tone: "bg-sky-500/10 text-sky-200 ring-sky-500/25"},
  acknowledged: {label: "Visszaigazolva", tone: "bg-emerald-500/10 text-emerald-200 ring-emerald-500/25"},
};

export interface ReviewPerson {
  id: string;
  full_name: string;
  faction_rank: string | null;
  badge_number: string | null;
  avatar_url: string | null;
}

export interface Review {
  id: string;
  user_id: string;
  /** "2026-Q4" */
  period: string;
  scores: Partial<Record<ReviewCriterion, number>>;
  overall: number | null;
  strengths: string | null;
  improvements: string | null;
  goals: string | null;
  status: ReviewStatus;
  shared_at: string | null;
  acknowledged_at: string | null;
  member_comment: string | null;
  created_at: string;
  updated_at: string;
  member: ReviewPerson | null;
  reviewer: ReviewPerson | null;
  can_edit: boolean;
  can_delete: boolean;
  can_acknowledge: boolean;
}

export interface ReviewDraft {
  scores: Partial<Record<ReviewCriterion, number>>;
  strengths: string;
  improvements: string;
  goals: string;
}

export interface MemberReviews {
  can_write: boolean;
  current_period: string;
  reviews: Review[];
}

export interface ReviewOverviewMember {
  user_id: string;
  full_name: string;
  faction_rank: string;
  badge_number: string | null;
  avatar_url: string | null;
  division: string | null;
  can_write: boolean;
  /** The review of the chosen quarter, if any (drafts only for their reviewer and the leadership). */
  review: Review | null;
  /** The latest shared review before the chosen quarter. */
  last: {period: string; overall: number | null; status: ReviewStatus} | null;
}

export interface ReviewOverview {
  period: string;
  current_period: string;
  members: ReviewOverviewMember[];
}

/** "2026 Q4" */
export const formatPeriod = (period: string) => period.replace("-", " ");

/** The quarter before or after ("2026-Q4", -1 -> "2026-Q3"). */
export function shiftPeriod(period: string, step: number): string {
  const [year, quarter] = period.split("-Q").map(Number);
  const index = year * 4 + (quarter - 1) + step;
  return `${Math.floor(index / 4)}-Q${(index % 4) + 1}`;
}

/** The average of the given scores, two decimals (as the database computes it). */
export function averageScore(scores: ReviewDraft["scores"]): number | null {
  const values = Object.values(scores).filter((value): value is number => typeof value === "number");
  return values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100 : null;
}

export const formatScore = (value: number | null | undefined) =>
  value === null || value === undefined ? "–" : value.toLocaleString("hu-HU", {minimumFractionDigits: 1, maximumFractionDigits: 2});

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const {data, error} = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
}

export const reviewsApi = {
  /** A member's reviews (own without an id). */
  list: (userId?: string | null) => rpc<MemberReviews>("get_reviews", {_user_id: userId ?? null}),
  overview: (period?: string | null) => rpc<ReviewOverview>("get_review_overview", {_period: period ?? null}),
  save: (id: string | null, userId: string | null, period: string | null, draft: ReviewDraft) =>
    rpc<Review>("save_review", {_id: id, _user_id: userId, _period: period, _review: draft}),
  share: (id: string) => rpc<Review>("share_review", {_id: id}),
  acknowledge: (id: string, comment: string) => rpc<Review>("acknowledge_review", {_id: id, _comment: comment || null}),
  remove: (id: string) => rpc<null>("delete_review", {_id: id}),
};
