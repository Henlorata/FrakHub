/** Same values as the request_status enum (kept here so the payroll logic can be tested in Node). */
type RequestStatus = "pending" | "approved" | "rejected";

// --- Reimbursements ------------------------------------------------------------

export interface ReimbursementRequest {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  /** Paths in the `finance_proofs` bucket: a JSON array, (legacy) a single path or "{}". */
  proof_image_path: string[] | string | null;
  status: RequestStatus;
  admin_comment: string | null;
  processed_by: string | null;
  created_at: string;
  updated_at: string;
  /** Set when the daily cron removed the proof images (the request stays in the history). */
  proofs_removed_at: string | null;
  requester: {full_name: string; badge_number: string; faction_rank: string; avatar_url: string | null} | null;
  processor: {full_name: string} | null;
}

// --- Payroll -------------------------------------------------------------------

export interface DutyTier {
  hours: number;
  pay: number;
}

/** The pay table the Commander maintains (payroll_settings). */
export interface PayrollSettings {
  rank_pay: Record<string, number>;
  unit_pay: Record<string, number>;
  duty_tiers: DutyTier[];
  min_duty_hours: number;
  top_duty_pay: number[];
  top_report_pay: number[];
  report_pay: number;
  picture_pay: number;
  training_pay: number;
  tax_percent: number;
  /** Executive staff are paid as this unit (the old sheet's "BM"); null: their division. */
  executive_unit: string | null;
  updated_at?: string;
  updated_by?: string | null;
}

export interface PayrollPay {
  rank: number;
  duty: number;
  unit: number;
  qualification: number;
  reports: number;
  pictures: number;
  training: number;
  top_duty: number;
  top_report: number;
  bonus: number;
}

/** One member's month as computed by the server (an open month) or as stored (a closed one). */
export interface PayrollRow {
  user_id: string;
  name: string;
  badge_number: string;
  rank: string;
  rank_order: number;
  division: string;
  qualifications: string[];
  avatar_url: string | null;
  account_number: string | null;
  eligible: boolean;
  eligible_auto: boolean;
  duty_minutes: number;
  hours: number;
  reports: number;
  reports_logged: number;
  reports_auto: boolean;
  pictures: number;
  trained: number;
  top_duty: number;
  top_duty_auto: boolean;
  top_report: number;
  top_report_auto: boolean;
  unit: string | null;
  unit_auto: boolean;
  qualification: string | null;
  qualification_auto: boolean;
  bonus: number;
  bonus_note: string | null;
  pay: PayrollPay;
  total: number;
  paid: boolean;
  paid_at: string | null;
}

export type PayrollStatus = "open" | "closed";

export interface PayrollMonth {
  month: string;
  status: PayrollStatus;
  /** False until something was saved for the month. */
  saved: boolean;
  withdrawn: number | null;
  note: string | null;
  closed_at: string | null;
  closed_by_name: string | null;
  settings: PayrollSettings;
  rows: PayrollRow[];
  total: number;
  tax: number;
  paid_total: number;
  can_edit_settings: boolean;
  months: {month: string; status: PayrollStatus}[];
}

/**
 * What the leadership enters for a member in a month. `null` means automatic (taken from
 * HR, the duty time and the report log); `qual_key: ""` switches the qualification pay off.
 */
export interface PayrollInput {
  eligible: boolean | null;
  reports: number | null;
  pictures: number;
  trained: number;
  top_duty: number | null;
  top_report: number | null;
  bonus: number;
  bonus_note: string | null;
  unit_key: string | null;
  qual_key: string | null;
  duty_minutes: number;
  account_number: string | null;
}

export interface Payslip {
  month: string;
  row: PayrollRow;
  paid: boolean;
  paid_at: string | null;
}

// --- Overview ------------------------------------------------------------------

export interface FinanceOverview {
  pending: {count: number; amount: number};
  months: {
    month: string;
    reimbursed: number;
    reimbursements: number;
    payroll_status: PayrollStatus | null;
    payroll_total: number | null;
    payroll_withdrawn: number | null;
    payroll_tax_percent: number | null;
  }[];
}
