import {expect, test} from "@playwright/test";
import {login, mockSupabase, TEST_USER_ID, testProfile} from "./support/mock-supabase";

const DEPUTY_ID = "22222222-2222-4222-8222-222222222222";
const PENDING_ID = "33333333-3333-4333-8333-333333333333";

const viewer = testProfile({faction_rank: "Captain II.", system_role: "admin"});
const deputy = testProfile({
  id: DEPUTY_ID, full_name: "Deputy Dénes", badge_number: "2001", faction_rank: "Deputy Sheriff II.", system_role: "user",
});
const returning = testProfile({
  id: PENDING_ID, full_name: "Visszatérő Vilmos", badge_number: "1288", faction_rank: "Deputy Sheriff I.", system_role: "pending",
});

/** First day of the month `offset` months ago, as stored by the app. */
const monthStart = (offset: number) => {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
};

const registry = (overrides: Record<string, unknown> = {}) => ({
  details: [], duty: [], vehicles: [], vehicle_warnings: [], bank_accounts: [], ...overrides,
});

test.describe("HR registry", () => {
  test("duty time is typed into the sheet and saved in one request", async ({page}) => {
    const mock = await mockSupabase(page, {
      tables: {profiles: [viewer, deputy]},
      rpc: {get_hr_registry: registry({duty: [{user_id: DEPUTY_ID, month: monthStart(2), minutes: 600}]})},
    });
    const posted: unknown[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/rest/v1/duty_time_entries") && request.method() === "POST") posted.push(request.postDataJSON());
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/hr?tab=duty");

    const cells = page.locator("tr", {hasText: "Deputy Dénes"}).locator("input");
    await expect(cells).toHaveCount(6);
    await expect(cells.nth(3)).toHaveValue("10:00");
    await cells.nth(4).fill("95 óra 48 perc");
    await cells.nth(4).press("Enter");
    await cells.nth(5).fill("nem szám");
    await expect(page.getByText("1 hibás cella")).toBeVisible();
    await cells.nth(5).fill("");
    await page.getByRole("button", {name: "Mentés"}).click();

    await expect(page.getByText("1 duty idő mentve.")).toBeVisible();
    expect(posted).toEqual([[{user_id: DEPUTY_ID, month: monthStart(1), minutes: 5748}]]);
    expect(mock.count("rest", "duty_time_entries")).toBe(1);
  });

  test("a dismissal is archived with its reason", async ({page}) => {
    await mockSupabase(page, {tables: {profiles: [viewer, deputy]}});
    let body: Record<string, unknown> | null = null;
    await page.route("**/api/admin/delete-user", async (route) => {
      body = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({json: {success: true}});
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/hr?member=${DEPUTY_ID}`);

    await page.getByRole("button", {name: "Távozás / elbocsátás"}).click();
    const dialog = page.getByRole("dialog", {name: /távozása/});
    await dialog.getByRole("button", {name: "Kilépett"}).click();
    await dialog.getByPlaceholder(/saját kérésre/).fill("Elköltözött a megyéből.");
    await dialog.getByRole("button", {name: "Távozás rögzítése"}).click();

    await expect(page.getByText(/távozása rögzítve/)).toBeVisible();
    expect(body).toMatchObject({userId: DEPUTY_ID, leave_type: "resigned", reason: "Elköltözött a megyéből.", rehire: "eligible"});
  });

  test("returning applicants are recognised from the former members list", async ({page}) => {
    await mockSupabase(page, {
      tables: {
        profiles: [viewer, deputy, returning],
        former_members: [{
          id: "f1", profile_id: null, full_name: "Visszatérő Vilmos", badge_number: "1288", faction_rank: "Corporal", division: "SEB",
          joined_on: "2025-01-01", left_on: "2026-02-01", leave_type: "dismissed", reason: "Ismételt szabályszegés.",
          rehire: "not_eligible", rehire_note: "Vezetői döntés.", recorded_by: TEST_USER_ID, created_at: "2026-02-01T00:00:00Z",
          updated_at: "2026-02-01T00:00:00Z",
        }],
      },
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/hr?tab=requests");
    await expect(page.getByText("Korábbi tag: Nem térhet vissza")).toBeVisible();

    await page.goto("/hr?tab=former");
    await expect(page.getByRole("cell", {name: /Visszatérő Vilmos/})).toBeVisible();
    await expect(page.getByText("Elbocsátva")).toBeVisible();
  });
});
