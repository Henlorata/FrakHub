import {expect, test} from "@playwright/test";
import {login, mockSupabase, TEST_USER_ID, testProfile} from "./support/mock-supabase";

const MEMBER_ID = "22222222-2222-4222-8222-222222222222";

const SETTINGS = {
  rank_pay: {"Commander": 15_000_000, "Corporal": 12_000_000}, unit_pay: {BM: 3_000_000, MCB: 500_000, GW: 400_000},
  duty_tiers: [{hours: 30, pay: 3_000_000}, {hours: 50, pay: 5_000_000}], min_duty_hours: 30, top_duty_pay: [6_000_000, 5_000_000, 4_000_000],
  top_report_pay: [6_000_000, 5_000_000, 4_000_000], report_pay: 500_000, picture_pay: 0, training_pay: 1_000_000, tax_percent: 3,
  executive_unit: "BM",
};

const payRow = (overrides: Record<string, unknown>) => ({
  user_id: MEMBER_ID, name: "Nyomozó Nándor", badge_number: "1006", rank: "Corporal", rank_order: 9, division: "MCB", qualifications: ["GW"],
  avatar_url: null, account_number: "11712345-67891234-00012345", eligible: true, eligible_auto: true, duty_minutes: 3000, hours: 50,
  reports: 0, reports_logged: 0, reports_auto: true, pictures: 0, trained: 0, top_duty: 1, top_duty_auto: true, top_report: 0,
  top_report_auto: true, unit: "MCB", unit_auto: true, qualification: "GW", qualification_auto: true, bonus: 0, bonus_note: null,
  pay: {rank: 12_000_000, duty: 5_000_000, unit: 500_000, qualification: 400_000, reports: 0, pictures: 0, training: 0, top_duty: 6_000_000, top_report: 0, bonus: 0},
  total: 23_900_000, paid: false, paid_at: null,
  ...overrides,
});

const payroll = (month: string, rows = [payRow({})]) => ({
  month, status: "open", saved: false, withdrawn: null, note: null, closed_at: null, closed_by_name: null, settings: SETTINGS, rows,
  total: rows.reduce((sum, row) => sum + (row.total as number), 0), tax: 0, paid_total: 0, can_edit_settings: true, months: [],
});

test.describe("finance", () => {
  test("the payroll sheet recalculates while typing and saves only the changes", async ({page}) => {
    const mock = await mockSupabase(page, {
      tables: {profiles: [testProfile({faction_rank: "Commander", system_role: "admin"})]},
      rpc: {
        get_payroll: (args: {_month: string}) => payroll(args._month),
        save_payroll_entries: (args: {_month: string}) => payroll(args._month, [payRow({reports: 19, reports_auto: false, total: 33_900_000,
          pay: {...payRow({}).pay, reports: 9_500_000, top_report: 6_000_000}})]),
      },
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/finance?tab=payroll");

    const sheetRow = page.locator("tr", {hasText: "Nyomozó Nándor"});
    await expect(sheetRow.getByRole("button", {name: "23 900 000 $"})).toBeVisible();
    await sheetRow.getByLabel("Nyomozó Nándor – reports").fill("19");
    // 19 reports (9.5M) and the first place in reports (6M) are added at once.
    await expect(sheetRow.getByRole("button", {name: "39 400 000 $"})).toBeVisible();
    await page.getByRole("button", {name: "Mentés"}).click();
    await expect(page.getByText("1 tag adatai mentve.")).toBeVisible();

    const save = mock.requests.find((request) => request.name === "save_payroll_entries");
    expect(save?.body).toMatchObject({_entries: [{user_id: MEMBER_ID, reports: 19}]});
    expect(Object.keys((save?.body as {_entries: Record<string, unknown>[]})._entries[0]).sort()).toEqual(["reports", "user_id"]);
  });

  test("members see their own pay of the closed months", async ({page}) => {
    await mockSupabase(page, {
      tables: {profiles: [testProfile({faction_rank: "Corporal", system_role: "user"})]},
      rpc: {get_my_payslips: [{month: "2026-09-01", paid: true, paid_at: "2026-10-02T18:00:00Z", row: payRow({user_id: TEST_USER_ID})}]},
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/finance?tab=payroll");

    await expect(page.getByRole("tab", {name: "Fizetéseim"})).toBeVisible();
    await expect(page.getByText("2026. szeptember")).toBeVisible();
    await expect(page.getByText("23 900 000 $").first()).toBeVisible();
    await expect(page.getByText(/Kifizetve 2026\.10\.02\./)).toBeVisible();
    await expect(page.getByRole("tab", {name: "Fizetési tábla"})).toHaveCount(0);
  });

  test("a reimbursement is decided through the server function", async ({page}) => {
    const mock = await mockSupabase(page, {
      tables: {
        profiles: [testProfile({faction_rank: "Captain II.", system_role: "admin"})],
        budget_requests: [{
          id: "b1", user_id: MEMBER_ID, amount: 25_000, reason: "Üzemanyag a járőrhöz", proof_image_path: "[\"a.webp\"]", status: "pending",
          admin_comment: null, processed_by: null, created_at: "2026-10-04T10:00:00Z", updated_at: "2026-10-04T10:00:00Z", proofs_removed_at: null,
          requester: {full_name: "Nyomozó Nándor", badge_number: "1006", faction_rank: "Corporal", avatar_url: null}, processor: null,
        }],
      },
      rpc: {decide_budget_request: {id: "b1", status: "approved"}},
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/finance");

    await expect(page.getByText("Üzemanyag a járőrhöz")).toBeVisible();
    await expect(page.getByText("Beküldve: 2026.10.04. 12:00")).toBeVisible();
    await page.getByRole("button", {name: "Jóváhagyás"}).click();
    await page.getByRole("dialog").getByRole("button", {name: "Jóváhagyás"}).click();
    await expect(page.getByText("Kérelem jóváhagyva.")).toBeVisible();
    expect(mock.requests.find((request) => request.name === "decide_budget_request")?.body).toEqual({_request_id: "b1", _approve: true, _comment: ""});
    // No direct table update any more.
    expect(mock.requests.some((request) => request.name === "budget_requests" && request.method === "PATCH")).toBe(false);
  });
});
