import {expect, test} from "@playwright/test";
import {forecastTreasury, monthsBetween} from "../src/lib/treasury";
import type {FinanceOverview, FinanceOverviewMonth} from "../src/types/finance";
import {login, mockSupabase, testProfile} from "./support/mock-supabase";

const month = (key: string, overrides: Partial<FinanceOverviewMonth> = {}): FinanceOverviewMonth => ({
  month: key, reimbursed: 0, reimbursements: 0, payroll_status: null, payroll_total: null, payroll_withdrawn: null, payroll_tax_percent: null,
  balance: null, balance_at: null, ...overrides,
});

/** Newest month first, like get_finance_overview(). */
const growing: FinanceOverview = {
  pending: {count: 2, amount: 3_000_000},
  current: {month: "2026-10-01", status: "open", estimate: 40_000_000, tax_percent: 5},
  months: [
    month("2026-10-01", {payroll_status: "open", balance: 130_000_000, balance_at: "2026-10-04T18:00:00Z"}),
    month("2026-09-01", {payroll_status: "closed", payroll_total: 50_000_000, payroll_tax_percent: 5, balance: 120_000_000, reimbursed: 2_000_000}),
    month("2026-08-01", {payroll_status: "closed", payroll_total: 48_000_000, payroll_withdrawn: 50_000_000, balance: 100_000_000, reimbursed: 1_000_000}),
    month("2026-07-01"),
  ],
};

test.describe("treasury forecast", () => {
  test("the latest balance minus what is still to pay, and the pace of the recorded months", () => {
    const forecast = forecastTreasury(growing);
    expect(forecast.latest).toMatchObject({month: "2026-10-01", balance: 130_000_000});
    // The closed months paid 50 M (withdrawal) and 52.5 M (pay with tax); this month's sheet is lower so far.
    expect(forecast).toMatchObject({monthCostKind: "estimate", monthCost: 51_250_000, pending: 3_000_000});
    expect(forecast.remaining).toBe(130_000_000 - 51_250_000 - 3_000_000);
    // August 100 M -> October 130 M: +15 M a month.
    expect(forecast).toMatchObject({monthlyChange: 15_000_000, span: 2});
    // The change plus what left in between (two payouts and the reimbursements).
    expect(forecast.monthlyIncome).toBe((30_000_000 + 50_000_000 + 52_500_000 + 3_000_000) / 2);
    expect(forecast.projection).toEqual([
      {month: "2026-11-01", balance: 145_000_000}, {month: "2026-12-01", balance: 160_000_000}, {month: "2027-01-01", balance: 175_000_000},
    ]);
    expect(forecast.runway).toBeNull();
    expect(forecast.history.map((item) => item.month)).toEqual(["2026-08-01", "2026-09-01", "2026-10-01"]);
  });

  test("a shrinking account shows how long it lasts; a closed month counts what was paid", () => {
    const forecast = forecastTreasury({
      pending: {count: 0, amount: 0},
      current: {month: "2026-10-01", status: "closed", estimate: null, tax_percent: 3},
      months: [
        month("2026-10-01", {payroll_status: "closed", payroll_total: 20_000_000, payroll_withdrawn: 21_000_000, balance: 60_000_000}),
        month("2026-09-01", {balance: 100_000_000}),
      ],
    });
    expect(forecast).toMatchObject({monthCostKind: "paid", monthCost: 21_000_000, remaining: 39_000_000, monthlyChange: -40_000_000});
    expect(forecast.runway).toBe(1.5);
    // September's payout is not known: no income estimate.
    expect(forecast.monthlyIncome).toBeNull();
  });

  test("without recorded balances there is nothing to forecast", () => {
    const forecast = forecastTreasury({pending: {count: 1, amount: 500}, months: [month("2026-10-01")]});
    expect(forecast).toMatchObject({latest: null, remaining: null, monthlyChange: null, projection: []});
    expect(monthsBetween("2025-11-01", "2026-02-01")).toBe(3);
  });

  test("the overview shows the forecast to the high command", async ({page}) => {
    await mockSupabase(page, {
      tables: {profiles: [testProfile({faction_rank: "Commander", system_role: "admin"})]},
      rpc: {get_finance_overview: growing},
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/finance?tab=overview");

    const panel = page.locator("[data-tour=treasury-forecast]");
    await expect(panel.getByText("Kassza-előrejelzés")).toBeVisible();
    await expect(panel.getByText(/^130\s000\s000 \$$/)).toBeVisible();
    await expect(panel.getByText(/^− 51\s250\s000 \$$/)).toBeVisible();
    await expect(panel.getByText("Utána marad")).toBeVisible();
    await expect(panel.getByText(/^75\s750\s000 \$$/)).toBeVisible();
    await expect(panel).toContainText("havonta átlagosan 15M $-ral gyarapodott");
    await expect(panel).toContainText("2027. január elején kb. 175M $ lehet");
  });

  test("without a balance the payroll managers are pointed to the payroll sheet", async ({page}) => {
    await mockSupabase(page, {
      tables: {profiles: [testProfile({faction_rank: "Commander", system_role: "admin"})]},
      rpc: {get_finance_overview: {pending: {count: 0, amount: 0}, months: [month("2026-10-01")]}, get_payroll: null},
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/finance?tab=overview");

    const panel = page.locator("[data-tour=treasury-forecast]");
    await expect(panel.getByText("Még nincs beírt kasszaegyenleg.")).toBeVisible();
    await panel.getByRole("button", {name: /Havi fizetés/}).click();
    await expect(page).toHaveURL(/tab=payroll/);
  });
});
