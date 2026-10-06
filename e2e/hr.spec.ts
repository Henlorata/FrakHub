import {expect, test} from "@playwright/test";
import {login, mockSupabase, testProfile} from "./support/mock-supabase";

const DEPUTY_ID = "22222222-2222-4222-8222-222222222222";
const PENDING_ID = "33333333-3333-4333-8333-333333333333";

const viewer = testProfile({faction_rank: "Captain II.", system_role: "admin"});
const deputy = testProfile({
  id: DEPUTY_ID, full_name: "Deputy Dénes", badge_number: "2001", faction_rank: "Deputy Sheriff II.", system_role: "user",
  last_promotion_date: "2026-01-01T00:00:00Z",
});
const pending = testProfile({
  id: PENDING_ID, full_name: "Jelölt Jenő", badge_number: "3001", faction_rank: "Deputy Sheriff Trainee", system_role: "pending",
});

test.describe("HR", () => {
  test("one click promotes a member and the toast can undo it", async ({page}) => {
    await mockSupabase(page, {tables: {profiles: [viewer, deputy, pending]}});
    const calls: Record<string, unknown>[] = [];
    await page.route("**/api/admin/update-role", async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      calls.push(body);
      await route.fulfill({json: {success: true, changed: ["faction_rank"], profile: {...deputy, faction_rank: body.faction_rank}}});
    });

    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/hr");

    const row = page.locator("tr", {hasText: "Deputy Dénes"});
    await row.getByRole("button", {name: "Előléptetés"}).click();
    await expect(row.getByText("Deputy Sheriff III.")).toBeVisible();
    expect(calls[0]).toMatchObject({userId: DEPUTY_ID, faction_rank: "Deputy Sheriff III."});

    await page.locator("[data-sonner-toast]").filter({hasText: "előléptetve"}).getByRole("button", {name: "Visszavonás"}).click();
    await expect(row.getByText("Deputy Sheriff II.")).toBeVisible();
    expect(calls[1]).toMatchObject({
      userId: DEPUTY_ID, faction_rank: "Deputy Sheriff II.", restore_promotion_date: "2026-01-01T00:00:00Z",
    });
  });

  test("members cannot change ranks they do not manage", async ({page}) => {
    await mockSupabase(page, {
      tables: {profiles: [testProfile({faction_rank: "Deputy Sheriff III.", system_role: "user"}), deputy]},
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/hr");

    await expect(page.locator("tr", {hasText: "Deputy Dénes"})).toBeVisible();
    await expect(page.getByRole("button", {name: "Előléptetés"})).toHaveCount(0);
    await expect(page.getByRole("button", {name: /Kérelmek/})).toHaveCount(0);
  });

  test("registrations are approved from the requests tab", async ({page}) => {
    await mockSupabase(page, {tables: {profiles: [viewer, deputy, pending]}});
    const calls: Record<string, unknown>[] = [];
    await page.route("**/api/admin/update-role", async (route) => {
      calls.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill({json: {success: true, changed: ["system_role"], profile: {...pending, system_role: "user"}}});
    });

    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/hr?tab=requests");
    await expect(page.getByText("Jelölt Jenő")).toBeVisible();
    await page.getByRole("button", {name: "Jóváhagyás", exact: true}).click();

    await expect(page.getByText(/jóváhagyva/i).first()).toBeVisible();
    expect(calls[0]).toMatchObject({userId: PENDING_ID});
  });

  test("the member panel opens from the roster and from a link", async ({page}) => {
    await mockSupabase(page, {tables: {profiles: [viewer, deputy]}});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto(`/hr?member=${DEPUTY_ID}`);
    const panel = page.getByRole("dialog");
    await expect(panel.getByText("Deputy Dénes")).toBeVisible();
    await panel.getByRole("tab", {name: /Feljegyzések/}).click();
    await expect(panel.getByRole("button", {name: /Rögzítés/})).toBeVisible();
  });

  test("leaders are marked on the roster and listed for everyone", async ({page}) => {
    const commander = testProfile({
      id: "44444444-4444-4444-8444-444444444444", full_name: "Parancsnok Péter", badge_number: "2002", faction_rank: "Sergeant I.",
      system_role: "supervisor", division: "SEB", is_bureau_commander: true, commanded_divisions: ["MU"],
    });
    const manager = testProfile({
      id: "55555555-5555-4555-8555-555555555555", full_name: "Vezető Vera", badge_number: "2003", faction_rank: "Commander",
      system_role: "admin", is_bureau_manager: true,
    });
    // A member, not staff: the leaders are for everyone to see.
    await mockSupabase(page, {tables: {profiles: [testProfile({faction_rank: "Deputy Sheriff II.", system_role: "user"}), commander, manager, deputy]}});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/hr");

    const row = page.locator("tr", {hasText: "Parancsnok Péter"});
    await expect(row.getByText("SEB parancsnok")).toBeVisible();
    await expect(row.getByText("MU vezető")).toBeVisible();
    await expect(page.locator("tr", {hasText: "Vezető Vera"}).getByText("Bureau Manager")).toBeVisible();

    const leaders = page.locator("[data-tour=hr-leaders]");
    await expect(leaders.locator("li", {hasText: "Divízió parancsnoka"}).filter({hasText: "SEB"})).toContainText("Parancsnok Péter");
    await expect(leaders.locator("li", {hasText: "Divízió parancsnoka"}).filter({hasText: "MCB"})).toContainText("Nincs kinevezve");
    await expect(leaders.locator("li", {hasText: "Irodavezető"})).toContainText("Vezető Vera");
    await leaders.getByRole("button", {name: /Parancsnok Péter/}).first().click();
    await expect(page).toHaveURL(/member=44444444/);
  });

  test("the org chart shows the bureau manager, the divisions and the units", async ({page}) => {
    const commander = testProfile({
      id: "44444444-4444-4444-8444-444444444444", full_name: "Parancsnok Péter", badge_number: "2002", faction_rank: "Sergeant I.",
      system_role: "supervisor", division: "SEB", division_rank: "Operator III.", is_bureau_commander: true, commanded_divisions: ["MU"],
    });
    const manager = testProfile({
      id: "55555555-5555-4555-8555-555555555555", full_name: "Vezető Vera", badge_number: "2003", faction_rank: "Commander",
      system_role: "admin", is_bureau_manager: true,
    });
    const medic = testProfile({
      id: "66666666-6666-4666-8666-666666666666", full_name: "Mentős Márk", badge_number: "2004", faction_rank: "Deputy Sheriff III.",
      system_role: "user", division: "SEB", division_rank: "Operator I.", qualifications: ["MU"],
    });
    const self = testProfile({faction_rank: "Deputy Sheriff II.", system_role: "user"});
    await mockSupabase(page, {tables: {profiles: [self, commander, manager, deputy, medic]}});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/hr");
    await page.getByRole("tab", {name: "Szervezeti ábra"}).click();
    await expect(page).toHaveURL(/view=org/);

    const chart = page.locator("[data-tour=hr-org-chart]");
    await expect(chart.getByRole("button", {name: /Vezető Vera/}).first()).toBeVisible();
    const seb = chart.locator("article", {hasText: "Special Enforcement Bureau"});
    await expect(seb).toContainText("Parancsnok Péter");
    const mu = chart.locator("article", {hasText: "Medical Unit"});
    await expect(mu).toContainText("Parancsnok Péter");

    await chart.getByRole("button", {name: "Mind kibontása"}).click();
    await expect(seb.getByText("Operator I.", {exact: false})).toBeVisible();
    await expect(seb.getByRole("button", {name: /Mentős Márk/})).toBeVisible();
    await expect(mu.getByRole("button", {name: /Mentős Márk/})).toBeVisible();
    await expect(chart.locator("article", {hasText: "Field Staff"}).getByRole("button", {name: /Deputy Dénes/})).toBeVisible();

    await chart.getByPlaceholder("Név vagy jelvényszám…").fill("márk");
    await expect(chart.getByText("1 találat")).toBeVisible();
    await seb.getByRole("button", {name: /Mentős Márk/}).click();
    await expect(page).toHaveURL(/member=66666666/);
  });
});
