import {expect, test} from "@playwright/test";
import {computePayroll, inputChanges, inputFromRow} from "../src/lib/payroll";
import type {PayrollRow, PayrollSettings} from "../src/types/finance";

// The leadership's old payroll sheet (October): its amounts and a few of its rows.
const SETTINGS: PayrollSettings = {
  rank_pay: {
    "Commander": 15_000_000, "Deputy Commander": 15_000_000, "Captain III.": 14_000_000, "Lieutenant I.": 14_000_000,
    "Sergeant II.": 13_000_000, "Sergeant I.": 13_000_000, "Corporal": 12_000_000, "Staff Deputy Sheriff": 10_000_000,
    "Deputy Sheriff II.": 7_000_000, "Deputy Sheriff I.": 6_000_000, "Deputy Sheriff Trainee": 5_000_000,
  },
  unit_pay: {BM: 3_000_000, SEB: 500_000, MCB: 500_000, TSB: 0, SAHP: 450_000, GW: 400_000, AB: 400_000, FAB: 400_000, TB: 500_000, MU: 400_000},
  duty_tiers: [30, 40, 50, 60, 70, 80, 90, 100].map((hours) => ({hours, pay: hours * 100_000})),
  min_duty_hours: 30,
  top_duty_pay: [6_000_000, 5_000_000, 4_000_000],
  top_report_pay: [6_000_000, 5_000_000, 4_000_000],
  report_pay: 500_000,
  picture_pay: 0,
  training_pay: 1_000_000,
  tax_percent: 3,
  executive_unit: "BM",
};

let counter = 0;
const row = (overrides: Partial<PayrollRow>): PayrollRow => ({
  user_id: `u${++counter}`, name: "Tag", badge_number: "1000", rank: "Corporal", rank_order: 9, division: "TSB", qualifications: [],
  avatar_url: null, account_number: null, eligible: true, eligible_auto: true, duty_minutes: 0, hours: 0, reports: 0, reports_logged: 0,
  reports_auto: true, pictures: 0, trained: 0, top_duty: 0, top_duty_auto: true, top_report: 0, top_report_auto: true, unit: null,
  unit_auto: true, qualification: null, qualification_auto: true, bonus: 0, bonus_note: null,
  pay: {rank: 0, duty: 0, unit: 0, qualification: 0, reports: 0, pictures: 0, training: 0, top_duty: 0, top_report: 0, bonus: 0},
  total: 0, paid: false, paid_at: null,
  ...overrides,
});

const total = (rows: PayrollRow[], id: string) => rows.find((item) => item.user_id === id)!.total;

test.describe("payroll", () => {
  test("rows of the old sheet come out the same", () => {
    const lisa = row({rank: "Commander", rank_order: 0, division: "TSB", duty_minutes: 101 * 60});
    // Sergeant II. on the sheet: 19 reports (first), 1 trained, 10M recommendation, MCB + AB.
    const reid = row({rank: "Sergeant II.", rank_order: 7, division: "MCB", qualifications: ["AB", "FAB"], duty_minutes: 100 * 60 + 5,
      reports: 19, reports_auto: false, trained: 1, bonus: 10_000_000, top_duty: 0, top_duty_auto: false});
    const isaiah = row({rank: "Sergeant I.", rank_order: 8, division: "SEB", qualifications: ["SAHP"], duty_minutes: 20 * 60});
    const nina = row({rank: "Captain III.", rank_order: 2, division: "MCB", duty_minutes: 35 * 60, top_duty: 0, top_duty_auto: false});
    const daniel = row({rank: "Deputy Sheriff II.", rank_order: 14, duty_minutes: 10 * 60, reports_logged: 2, top_report: 0, top_report_auto: false});
    const trainee = row({rank: "Deputy Sheriff Trainee", rank_order: 16, duty_minutes: 50 * 60});

    const rows = computePayroll([lisa, reid, isaiah, nina, daniel, trainee], {}, SETTINGS);
    // 15M + BM 3M + 100+ hours 10M + first in duty time 6M.
    expect(total(rows, lisa.user_id)).toBe(34_000_000);
    // 13M + 0.5M + 0.4M + 10M + 9.5M + 1M + 6M (first in reports) + 10M.
    expect(total(rows, reid.user_id)).toBe(50_400_000);
    // Under 30 hours: SEB + SAHP only.
    expect(total(rows, isaiah.user_id)).toBe(950_000);
    expect(total(rows, nina.user_id)).toBe(17_500_000);
    // Two logged reports, under 30 hours.
    expect(total(rows, daniel.user_id)).toBe(1_000_000);
    expect(total(rows, trainee.user_id)).toBe(0);
    expect(rows.find((item) => item.user_id === reid.user_id)!.top_report).toBe(1);
  });

  test("TOP places follow the duty time and ties share the place", () => {
    const a = row({duty_minutes: 90 * 60});
    const b = row({duty_minutes: 90 * 60});
    const c = row({duty_minutes: 80 * 60});
    const d = row({duty_minutes: 70 * 60});
    const rows = computePayroll([a, b, c, d], {}, SETTINGS);
    expect(rows.map((item) => item.top_duty)).toEqual([1, 1, 3, 0]);
  });

  test("inputs override the automatic values and are diffed for saving", () => {
    const member = row({rank: "Corporal", division: "SEB", qualifications: ["MU"], duty_minutes: 61 * 60, reports_logged: 4});
    const base = inputFromRow(member);
    const input = {...base, reports: 6, qual_key: "", unit_key: "MCB"};
    const [computed] = computePayroll([member], {[member.user_id]: input}, SETTINGS);
    // 12M + 6M (60+) + MCB 0.5M + 6 reports 3M + first in reports and duty 12M.
    expect(computed.total).toBe(33_500_000);
    expect(computed.qualification).toBeNull();
    expect(inputChanges(base, input)).toEqual({reports: 6, qual_key: "", unit_key: "MCB"});
  });
});
