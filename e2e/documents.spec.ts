import {expect, test} from "@playwright/test";
import {login, mockSupabase, TEST_USER_ID} from "./support/mock-supabase";

const CLOSER = {id: "u2", full_name: "Laura Graves", faction_rank: "Captain II.", badge_number: "1203"};

const PAYSLIP = {
  month: "2026-09-01", paid: true, paid_at: "2026-10-03T19:00:00Z", closed_at: "2026-10-02T18:00:00Z", closed_by: CLOSER, tax_percent: 3,
  member: {id: TEST_USER_ID, full_name: "John Doe", faction_rank: "Sergeant I.", badge_number: "1192"},
  row: {name: "John Doe", rank: "Sergeant I.", division: "TSB", unit: "TSB", qualification: null, duty_minutes: 2400, reports: 9, pictures: 0, trained: 0,
    top_duty: 0, top_report: 0, bonus: 0, bonus_note: null, account_number: null,
    pay: {rank: 6000000, duty: 1000000, unit: 0, qualification: 0, reports: 4500000, pictures: 0, training: 0, top_duty: 0, top_report: 0, bonus: 0},
    total: 11500000},
};

test.describe("printable documents", () => {
  test("a member prints a closed month's payslip, signed by whoever closed it", async ({page}) => {
    const mock = await mockSupabase(page, {rpc: {get_payslip_document: PAYSLIP}});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/finance/payslip/2026-09");

    await expect(page.getByRole("heading", {name: "Fizetési papír"})).toBeVisible();
    await expect(page.getByText(/11\s500\s000\s\$/)).toBeVisible();
    await expect(page.getByText("Kiállította · Captain II.")).toBeVisible();
    await expect(page.getByText("Laura Graves")).toBeVisible();
    await expect(page.getByText("Átvette · Sergeant I.")).toBeVisible();
    expect(mock.requests.find((request) => request.name === "get_payslip_document")?.body).toEqual({_month: "2026-09-01", _user: null});
  });

  test("a ribbon's certificate names the member, whoever gave it and the head of the department", async ({page}) => {
    await mockSupabase(page, {rpc: {get_award_document: {
      kind: "ribbon", id: "r1", number: "AB12CD34", title: "Szolgálati Érdemérem", text: "Kiemelkedő szolgálatért", color: "#d4af37", image_url: null,
      date: "2026-10-01T10:00:00Z", member: {id: TEST_USER_ID, full_name: "John Doe", faction_rank: "Sergeant I.", badge_number: "1192", division: "TSB"},
      issuer: CLOSER, head: {id: "u9", full_name: "Lisa Clark", faction_rank: "Commander", badge_number: "1020", title: "Bureau Manager"},
    }}});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/hr/award/ribbon/r1");

    await expect(page.getByRole("heading", {name: "Kitüntetési okirat"})).toBeVisible();
    await expect(page.getByRole("article").getByText("John Doe", {exact: true})).toBeVisible();
    await expect(page.getByText("Szolgálati Érdemérem")).toBeVisible();
    await expect(page.getByText("· Adományozta")).toBeVisible();
    await expect(page.getByText("· Bureau Manager")).toBeVisible();
  });

  test("members sign out their other devices", async ({page}) => {
    const mock = await mockSupabase(page);
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/profile?tab=settings");

    await page.getByRole("button", {name: "Kijelentkezés a többi eszközön"}).click();
    await page.getByRole("alertdialog").getByRole("button", {name: "Kijelentkeztetés"}).click();
    await expect.poll(() => mock.requests.find((request) => request.kind === "auth" && request.name === "logout")?.url ?? "").toContain("scope=others");
    // This device stays signed in.
    await expect(page).toHaveURL(/\/profile/);
  });

  test("the leadership panel of the HR page folds away and stays folded", async ({page}) => {
    await mockSupabase(page);
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/hr");

    const panel = page.getByRole("region", {name: "Vezetőség"});
    await panel.getByRole("button", {name: "Elrejtés"}).click();
    await expect(panel.getByRole("button", {name: "Megjelenítés"})).toBeVisible();
    await page.reload();
    await expect(page.getByRole("region", {name: "Vezetőség"}).getByRole("button", {name: "Megjelenítés"})).toBeVisible();
  });
});
