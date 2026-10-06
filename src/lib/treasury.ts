import {addMonths} from "./datetime";
import type {FinanceOverview, FinanceOverviewMonth} from "../types/finance";

/**
 * Treasury forecast of the finance overview, from the balances the leadership reads in the game
 * before each payout (payroll page) and the known outgoings. Simple on purpose: the latest
 * balance minus what is still to pay, and the average monthly change carried forward.
 */

export interface TreasuryForecast {
  /** The latest recorded balance (before that month's payout). */
  latest: {month: string; balance: number; at: string | null} | null;
  /** The pay of the latest balance's month with tax: paid out (closed month) or expected. */
  monthCost: number | null;
  monthCostKind: "paid" | "estimate" | null;
  /** Reimbursements waiting for a decision. */
  pending: number;
  /** latest − monthCost − pending (null without a balance). */
  remaining: number | null;
  /** Average monthly change of the balance between the first and the last reading. */
  monthlyChange: number | null;
  /** Months between the first and the last reading. */
  span: number;
  /** Average monthly income: the change plus what left (only when every payout in between is known). */
  monthlyIncome: number | null;
  /** The coming months' balance at this pace (before their payout). */
  projection: {month: string; balance: number}[];
  /** Months the money lasts at this pace (only when it shrinks). */
  runway: number | null;
  /** The recorded balances, oldest first. */
  history: {month: string; balance: number}[];
}

/** Whole months from one month value ("2026-08-01") to another. */
export function monthsBetween(from: string, to: string): number {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  return toYear * 12 + toMonth - (fromYear * 12 + fromMonth);
}

const withTax = (amount: number, taxPercent: number | null | undefined) => Math.round(amount * (1 + (taxPercent ?? 0) / 100));

/** What a closed month's payout took from the account: the recorded withdrawal, else the pay with tax. */
export function payoutOf(month: FinanceOverviewMonth): number | null {
  if (month.payroll_status !== "closed") return null;
  if (month.payroll_withdrawn !== null && month.payroll_withdrawn !== undefined) return month.payroll_withdrawn;
  return month.payroll_total === null ? null : withTax(month.payroll_total, month.payroll_tax_percent);
}

export function forecastTreasury(overview: FinanceOverview, horizon = 3): TreasuryForecast {
  const months = [...overview.months].sort((a, b) => a.month.localeCompare(b.month));
  const recorded = months.filter((month) => typeof month.balance === "number");
  const history = recorded.map((month) => ({month: month.month, balance: month.balance as number}));
  const latestMonth = recorded[recorded.length - 1] ?? null;
  const latest = latestMonth ? {month: latestMonth.month, balance: latestMonth.balance as number, at: latestMonth.balance_at ?? null} : null;
  const pending = overview.pending.amount ?? 0;

  // A month's pay: the average of the last three closed months, or this month's figures so far
  // (whichever is higher: the running sheet grows until the duty times are recorded).
  const payouts = months.map(payoutOf).filter((value): value is number => value !== null).slice(-3);
  const average = payouts.length ? Math.round(payouts.reduce((sum, value) => sum + value, 0) / payouts.length) : null;
  const current = overview.current;
  const running = current && current.estimate !== null && current.estimate !== undefined ? withTax(current.estimate, current.tax_percent) : null;

  let monthCost: number | null = null;
  let monthCostKind: TreasuryForecast["monthCostKind"] = null;
  if (latestMonth) {
    const paid = payoutOf(latestMonth);
    if (paid !== null) {
      monthCost = paid;
      monthCostKind = "paid";
    } else {
      const estimates = [average, latestMonth.month === current?.month ? running : null].filter((value): value is number => value !== null);
      if (estimates.length) {
        monthCost = Math.max(...estimates);
        monthCostKind = "estimate";
      }
    }
  }
  const remaining = latest ? latest.balance - (monthCost ?? 0) - pending : null;

  let monthlyChange: number | null = null;
  let monthlyIncome: number | null = null;
  let span = 0;
  if (history.length >= 2) {
    const first = history[0];
    const last = history[history.length - 1];
    span = monthsBetween(first.month, last.month);
    if (span > 0) {
      monthlyChange = Math.round((last.balance - first.balance) / span);
      // Between two readings the account paid the earlier months' pay and the reimbursements.
      const between = months.filter((month) => month.month >= first.month && month.month < last.month);
      const paid = between.map(payoutOf);
      if (between.length === span && paid.every((value) => value !== null)) {
        const outgoing = paid.reduce<number>((sum, value) => sum + (value ?? 0), 0) + between.reduce((sum, month) => sum + month.reimbursed, 0);
        monthlyIncome = Math.round((last.balance - first.balance + outgoing) / span);
      }
    }
  }

  const change = monthlyChange;
  const projection = latest && change !== null
    ? Array.from({length: horizon}, (_, index) => ({month: addMonths(latest.month, index + 1), balance: latest.balance + change * (index + 1)}))
    : [];
  const runway = latest && change !== null && change < 0 && latest.balance > 0 ? latest.balance / -change : null;

  return {latest, monthCost, monthCostKind, pending, remaining, monthlyChange, span, monthlyIncome, projection, runway, history};
}
