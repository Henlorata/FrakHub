import {supabase} from "@/lib/supabaseClient";
import {addMonths, monthKey} from "@/lib/datetime";
import type {FinanceOverview, PayrollInput, PayrollMonth, PayrollSettings, Payslip} from "@/types/finance";

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const {data, error} = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
}

export type PayrollEntryChange = {user_id: string} & Partial<Omit<PayrollInput, "duty_minutes">> & {duty_minutes?: number | null};

export const financeApi = {
  payroll: (month: string) => rpc<PayrollMonth>("get_payroll", {_month: month}),
  savePayroll: (month: string, entries: PayrollEntryChange[]) =>
    rpc<PayrollMonth>("save_payroll_entries", {_month: month, _entries: entries}),
  closePayroll: (month: string, withdrawn: number | null, note: string) =>
    rpc<PayrollMonth>("close_payroll", {_month: month, _withdrawn: withdrawn, _note: note}),
  reopenPayroll: (month: string) => rpc<PayrollMonth>("reopen_payroll", {_month: month}),
  setPaid: (month: string, userIds: string[], paid: boolean) =>
    rpc<PayrollMonth>("set_payroll_paid", {_month: month, _user_ids: userIds, _paid: paid}),
  saveSettings: (settings: Partial<PayrollSettings>) => rpc<PayrollSettings>("save_payroll_settings", {_settings: settings}),
  payslips: () => rpc<Payslip[]>("get_my_payslips"),
  decide: (requestId: string, approve: boolean, comment: string) =>
    rpc<{id: string; status: string}>("decide_budget_request", {_request_id: requestId, _approve: approve, _comment: comment}),
  overview: (months = 6) => rpc<FinanceOverview>("get_finance_overview", {_months: months}),
};

// --- Formatting ------------------------------------------------------------------

const money = new Intl.NumberFormat("hu-HU", {maximumFractionDigits: 0});

/** 12500000 -> "12 500 000 $" */
export const formatMoney = (value: number | null | undefined) => `${money.format(value ?? 0)} $`;

/** 12500000 -> "12,5M", 450000 -> "450e" (tight cells and charts). */
export function formatMoneyShort(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toLocaleString("hu-HU", {maximumFractionDigits: 2})}M`;
  if (abs >= 1_000) return `${Math.round(value / 1_000).toLocaleString("hu-HU")}e`;
  return String(value);
}

/** Digits only ("15 000 000 $" -> 15000000); null when empty. */
export function parseMoney(input: string): number | null {
  const negative = input.trim().startsWith("-");
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;
  const value = Number(digits.slice(0, 13));
  return negative ? -value : value;
}

// --- Months ------------------------------------------------------------------------

/**
 * The month the payroll page opens with: the previous month until it is closed, then the
 * current one (the meeting that pays a month is held after it ended).
 */
export function defaultPayrollMonth(closedMonths: string[]): string {
  const current = monthKey();
  const previous = addMonths(current, -1);
  return closedMonths.includes(previous) ? current : previous;
}

// --- Reimbursement proofs ----------------------------------------------------------

/** `proof_image_path` holds an array, a JSON-encoded array or (legacy) a single path. */
export function proofPaths(raw: string[] | string | null | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (raw === "{}" || raw === "[]") return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch {
    // A plain storage path.
  }
  return [raw.replace(/['"]+/g, "")];
}
