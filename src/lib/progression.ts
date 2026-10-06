import {supabase} from "@/lib/supabaseClient";

/**
 * Promotions, the trainee week, the activity watch and the HR statistics. The database computes
 * every list (get_promotion_board, get_trainees, get_activity_watch, get_workload,
 * get_recruitment_funnel) and enforces who may do what; the types mirror the JSON it returns.
 */

export interface PromotionCheck {
  key: string;
  label: string;
  /** Null when there is no data (e.g. duty time not recorded yet). */
  value?: number | null;
  target?: number;
  unit: string;
  ok: boolean;
  /** The target is an upper limit (warnings). */
  max?: boolean;
}

export interface PromotionCriteria {
  rank: string;
  min_days_in_rank: number | null;
  min_duty_hours: number | null;
  window_months: number;
  min_reports: number | null;
  max_warnings: number | null;
  exam_ids: string[];
  note: string | null;
  updated_at: string;
  updated_by: string | null;
}

export type NominationStatus = "pending" | "approved" | "rejected" | "withdrawn";

export interface Nomination {
  id: string;
  user_id: string;
  from_rank: string;
  to_rank: string;
  reason: string;
  status: NominationStatus;
  created_at: string;
  decided_at: string | null;
  decision_note: string | null;
  nominated_by: string | null;
  nominated_by_name: string | null;
  decided_by_name: string | null;
  member: {full_name: string; badge_number: string; faction_rank: string; avatar_url: string | null; division: string};
  can_decide: boolean;
  can_withdraw: boolean;
}

export interface BoardMember {
  user_id: string;
  full_name: string;
  badge_number: string;
  faction_rank: string;
  rank_order: number;
  division: string;
  avatar_url: string | null;
  next_rank: string | null;
  /** The next rank has criteria. */
  configured: boolean;
  since: string;
  days_in_rank: number;
  checks: PromotionCheck[];
  missing: number;
  eligible: boolean;
  on_leave: boolean;
  activity_status: string | null;
  nomination: Nomination | null;
}

export interface PromotionBoard {
  criteria: PromotionCriteria[];
  exams: {id: string; title: string; type: string}[];
  can_edit_criteria: boolean;
  members: BoardMember[];
  nominations: Nomination[];
}

export type CriteriaDraft = Pick<PromotionCriteria, "min_days_in_rank" | "min_duty_hours" | "window_months" | "min_reports" | "max_warnings" | "exam_ids" | "note">;

export interface TraineeCheck {
  key: string;
  label: string;
  ok: boolean;
  value?: number;
  target?: number;
}

export interface TraineeNote {
  id: string;
  body: string;
  created_at: string;
  author_name: string | null;
}

export interface Trainee {
  user_id: string;
  full_name: string;
  badge_number: string;
  avatar_url: string | null;
  joined_on: string;
  /** Days since joining. */
  days: number;
  mentor: {id: string; full_name: string; faction_rank: string; avatar_url: string | null} | null;
  assigned_at: string | null;
  signed_off_at: string | null;
  sign_off_note: string | null;
  signed_off_by_name: string | null;
  is_mentor: boolean;
  checks: TraineeCheck[];
  ready: boolean;
  /** Internal: the mentor, the instructors and the staff (null for the trainee themselves). */
  notes: TraineeNote[] | null;
}

export interface WatchMember {
  user_id: string;
  full_name: string;
  badge_number: string;
  faction_rank: string;
  avatar_url: string | null;
  activity_status: string | null;
  m1_minutes: number | null;
  m2_minutes: number | null;
  m1_leave: boolean;
  m2_leave: boolean;
  /** 2: both recorded months stayed under the minimum. */
  level: 1 | 2;
  review: "reminded" | "dismissed" | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export interface ActivityWatch {
  /** [last month, the month before]. */
  months: [string, string];
  /** Whether the staff recorded each month (most members have a value). */
  recorded: [boolean, boolean];
  min_minutes: number;
  members: WatchMember[];
}

export interface WorkloadMember {
  user_id: string;
  full_name: string;
  badge_number: string;
  faction_rank: string;
  avatar_url: string | null;
  division: string;
  /** Keyed by the month's first day ("2026-10-01"). */
  reports: Record<string, number>;
  duty: Record<string, number>;
  events: Record<string, number>;
}

export interface Workload {
  /** Newest first. */
  months: string[];
  members: WorkloadMember[];
}

export interface FunnelMonth {
  month: string;
  exam_takers: number;
  exam_passed: number;
  joined: number;
  deputy: number;
  /** Null while the month is too recent to tell. */
  stayed_30: number | null;
  stayed_90: number | null;
}

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const {data, error} = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
}

export const progressionApi = {
  board: () => rpc<PromotionBoard>("get_promotion_board"),
  saveCriteria: (rank: string, criteria: CriteriaDraft) => rpc<PromotionCriteria>("save_promotion_criteria", {_rank: rank, _criteria: criteria}),
  nominate: (userId: string, reason: string) => rpc<Nomination>("nominate_for_promotion", {_user_id: userId, _reason: reason}),
  decide: (id: string, decision: "rejected" | "withdrawn", note?: string | null) =>
    rpc<Nomination>("decide_promotion_nomination", {_id: id, _decision: decision, _note: note ?? null}),
  trainees: async () => (await rpc<Trainee[] | null>("get_trainees")) ?? [],
  assignMentor: (traineeId: string, mentorId: string | null) => rpc<unknown>("assign_trainee_mentor", {_trainee_id: traineeId, _mentor_id: mentorId}),
  addNote: (traineeId: string, body: string) => rpc<TraineeNote>("add_trainee_note", {_trainee_id: traineeId, _body: body}),
  signOff: (traineeId: string, ready: boolean, note?: string | null) =>
    rpc<{signed_off_at: string | null; sign_off_note: string | null}>("sign_off_trainee", {_trainee_id: traineeId, _ready: ready, _note: note ?? null}),
  activityWatch: () => rpc<ActivityWatch>("get_activity_watch"),
  remind: (userId: string, note?: string | null) => rpc<{review: string}>("send_activity_reminder", {_user_id: userId, _note: note ?? null}),
  dismiss: (userId: string, note?: string | null) => rpc<{review: string}>("dismiss_activity_flag", {_user_id: userId, _note: note ?? null}),
  workload: () => rpc<Workload>("get_workload"),
  funnel: (months = 6) => rpc<FunnelMonth[]>("get_recruitment_funnel", {_months: months}),
};

export const NOMINATION_STATUS: Record<NominationStatus, {label: string; tone: string}> = {
  pending: {label: "Döntésre vár", tone: "bg-amber-500/15 text-amber-200 ring-amber-500/30"},
  approved: {label: "Előléptetve", tone: "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30"},
  rejected: {label: "Elutasítva", tone: "bg-red-500/15 text-red-200 ring-red-500/30"},
  withdrawn: {label: "Visszavonva", tone: "bg-white/5 text-slate-400 ring-white/10"},
};

/** "12/30 óra"-like text of a check. */
export function checkValueText(check: PromotionCheck): string {
  if (check.key.startsWith("exam:")) return check.ok ? "Letéve" : "Nincs meg";
  const value = check.value === null || check.value === undefined ? "–" : String(check.value).replace(".", ",");
  if (check.max) return `${value} / max. ${check.target ?? 0} ${check.unit}`;
  return `${value} / ${check.target ?? 0} ${check.unit}`;
}

/** How close a member is: 0..1 over the checks with a target (an exam counts as 0 or 1). */
export function readiness(member: BoardMember): number {
  if (!member.checks.length) return 0;
  const parts = member.checks.map((check) => {
    if (check.ok) return 1;
    if (check.max || check.key.startsWith("exam:") || !check.target) return 0;
    return Math.max(0, Math.min(1, (check.value ?? 0) / check.target));
  });
  return parts.reduce((sum, part) => sum + part, 0) / parts.length;
}
