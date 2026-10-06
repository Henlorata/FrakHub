/**
 * The monthly pay, computed in the browser while the leadership types (the server computes
 * the same in `private.payroll_rows()` and its result replaces this one after saving).
 *
 * Pure functions without runtime imports: also used by the end-to-end tests in Node.
 *
 * Rules (the leadership's old sheet): rank pay and duty pay only from the minimum duty time;
 * unit, qualification, report, picture, training, TOP and other pay always; nothing for a
 * member who is not paid this month. TOP places go automatically by duty time and by report
 * count among the paid members (ties share the place) unless set by hand.
 */
import type {PayrollInput, PayrollPay, PayrollRow, PayrollSettings} from "../types/finance";

const TRAINEE_RANK = "Deputy Sheriff Trainee";

/** What was entered for the member (null fields: automatic). */
export function inputFromRow(row: PayrollRow): PayrollInput {
  return {
    eligible: row.eligible_auto ? null : row.eligible,
    reports: row.reports_auto ? null : row.reports,
    pictures: row.pictures,
    trained: row.trained,
    top_duty: row.top_duty_auto ? null : row.top_duty,
    top_report: row.top_report_auto ? null : row.top_report,
    bonus: row.bonus,
    bonus_note: row.bonus_note,
    unit_key: row.unit_auto ? null : row.unit,
    qual_key: row.qualification_auto ? null : row.qualification ?? "",
    duty_minutes: row.duty_minutes,
    account_number: row.account_number,
  };
}

/** Places like SQL rank(): 1 + the number of greater values; null stays null. */
function places(values: (number | null)[]): (number | null)[] {
  return values.map((value) => value === null ? null : 1 + values.filter((other) => other !== null && other > value).length);
}

export const dutyHours = (minutes: number) => Math.round((minutes / 60) * 100) / 100;

/** The duty tier reached (its pay), 0 below every tier. */
export function dutyTierPay(hours: number, settings: PayrollSettings): number {
  return Math.max(0, ...settings.duty_tiers.filter((tier) => hours >= tier.hours).map((tier) => tier.pay));
}

export const payTotal = (pay: PayrollPay) =>
  pay.rank + pay.duty + pay.unit + pay.qualification + pay.reports + pay.pictures + pay.training + pay.top_duty + pay.top_report + pay.bonus;

/** Every row with the given inputs applied (rows without an input keep what was entered). */
export function computePayroll(rows: PayrollRow[], inputs: Record<string, PayrollInput>, settings: PayrollSettings): PayrollRow[] {
  const resolved = rows.map((row) => {
    const input = inputs[row.user_id] ?? inputFromRow(row);
    const eligible = input.eligible ?? row.rank !== TRAINEE_RANK;
    const reports = input.reports ?? row.reports_logged;
    return {row, input, eligible, reports};
  });
  const dutyPlaces = places(resolved.map(({input, eligible}) => eligible && input.duty_minutes > 0 ? input.duty_minutes : null));
  const reportPlaces = places(resolved.map(({eligible, reports}) => eligible && reports > 0 ? reports : null));

  return resolved.map(({row, input, eligible, reports}, index) => {
    const autoPlace = (place: number | null) => place !== null && place <= 3 ? place : 0;
    const topDuty = input.top_duty ?? autoPlace(dutyPlaces[index]);
    const topReport = input.top_report ?? autoPlace(reportPlaces[index]);
    const unit = input.unit_key ?? (row.rank_order <= 1 && settings.executive_unit ? settings.executive_unit : row.division);
    const qualification = input.qual_key === null ? row.qualifications[0] ?? null : input.qual_key || null;
    const hours = dutyHours(input.duty_minutes);
    const meetsMinimum = hours >= settings.min_duty_hours;
    const place = (table: number[], position: number) => position >= 1 && position <= 3 ? table[position - 1] ?? 0 : 0;

    const pay: PayrollPay = {
      rank: meetsMinimum ? settings.rank_pay[row.rank] ?? 0 : 0,
      duty: meetsMinimum ? dutyTierPay(hours, settings) : 0,
      unit: unit ? settings.unit_pay[unit] ?? 0 : 0,
      qualification: qualification ? settings.unit_pay[qualification] ?? 0 : 0,
      reports: reports * settings.report_pay,
      pictures: input.pictures * settings.picture_pay,
      training: input.trained * settings.training_pay,
      top_duty: place(settings.top_duty_pay, topDuty),
      top_report: place(settings.top_report_pay, topReport),
      bonus: input.bonus,
    };

    return {
      ...row,
      eligible,
      eligible_auto: input.eligible === null,
      duty_minutes: input.duty_minutes,
      hours,
      reports,
      reports_auto: input.reports === null,
      pictures: input.pictures,
      trained: input.trained,
      top_duty: topDuty,
      top_duty_auto: input.top_duty === null,
      top_report: topReport,
      top_report_auto: input.top_report === null,
      unit,
      unit_auto: input.unit_key === null,
      qualification,
      qualification_auto: input.qual_key === null,
      bonus: input.bonus,
      bonus_note: input.bonus_note,
      account_number: input.account_number,
      pay,
      total: eligible ? payTotal(pay) : 0,
    };
  });
}

/** The fields of `next` that differ from `base`, in the shape save_payroll_entries() takes. */
export function inputChanges(base: PayrollInput, next: PayrollInput): Partial<PayrollInput> {
  const changes: Partial<PayrollInput> = {};
  for (const key of Object.keys(next) as (keyof PayrollInput)[]) {
    if (next[key] !== base[key]) (changes as Record<string, unknown>)[key] = next[key];
  }
  return changes;
}
