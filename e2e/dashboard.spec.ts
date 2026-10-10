import {expect, test} from "@playwright/test";
import {login, mockSupabase, TEST_USER_ID} from "./support/mock-supabase";

const inHours = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

const summary = (overrides: Record<string, unknown> = {}) => ({
  unread_notifications: 0, pending_exam_sheets: 0, pending_registrations: null, pending_leave_requests: null, pending_vehicle_requests: null,
  pending_budget_requests: null, pending_warrants: null, my_open_cases: null, my_pending_requests: 0, my_active_warnings: 0,
  my_vehicle_warnings: 0, my_vehicles_due: 0, fleet_registration_due: null, fleet_registration_reviews: null, members_total: 24, members_on_leave: 0,
  my_month: {month: "2026-10-01", reports: 5, duty_minutes: 600, duty_updated_at: "2026-10-03T19:00:00Z", min_reports: 8, min_duty_hours: 30},
  upcoming_events: [{id: "e1", title: "Heti állománygyűlés", kind: "meeting", starts_at: inHours(26), ends_at: null, location: "Downtown",
    rsvp: true, my_status: null}],
  ...overrides,
});

test.describe("dashboard", () => {
  test("the member's month, the next events and the announcements share the side column", async ({page}) => {
    const mock = await mockSupabase(page, {rpc: {get_dashboard_summary: summary(), get_announcements: []}});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);

    const month = page.locator("[data-tour=dashboard-month]");
    await expect(month.getByText("5 / 8")).toBeVisible();
    await expect(month.getByText("10 óra / 30 óra")).toBeVisible();
    await expect(month.getByText("Még 3 kell")).toBeVisible();
    // Saved by the member, not recorded by the leadership yet.
    await expect(month.getByText("(a mentett jelentéseid szerint)")).toBeVisible();

    const events = page.locator("[data-tour=dashboard-events]");
    await expect(events.getByText("Heti állománygyűlés")).toBeVisible();
    await expect(events.getByText("Válaszolj")).toBeVisible();
    await expect(events.getByRole("link", {name: /Heti állománygyűlés/})).toHaveAttribute("href", "/events?id=e1");

    // No announcement: one line instead of an empty box.
    await expect(page.locator("[data-tour=dashboard-announcements]").getByText("Nincs friss hirdetmény.")).toBeVisible();
    // Still two calls: the summary carries the month and the events.
    expect(mock.count("rpc", "get_dashboard_summary")).toBe(1);
    expect(mock.count("rpc", "get_announcements")).toBe(1);
    expect(mock.count("rpc", "get_events")).toBe(0);
  });

  test("a met requirement shows as done and missing data hides the widgets", async ({page}) => {
    await mockSupabase(page, {rpc: {
      get_dashboard_summary: summary({
        my_month: {month: "2026-10-01", reports: 9, reports_recorded: true, duty_minutes: 1900, duty_updated_at: null, min_reports: 8, min_duty_hours: 30},
        upcoming_events: [],
      }),
      get_announcements: [],
    }});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator("[data-tour=dashboard-month]").getByText("Teljesítve").first()).toBeVisible();
    await expect(page.locator("[data-tour=dashboard-month]").getByText("(a mentett jelentéseid szerint)")).toHaveCount(0);
    await expect(page.locator("[data-tour=dashboard-events]").getByText("Nincs esemény a következő két hétben.")).toBeVisible();
  });

  test("until the leadership records the month, the card shows what is required and last month's result", async ({page}) => {
    await mockSupabase(page, {rpc: {
      get_dashboard_summary: summary({
        my_month: {month: "2026-10-01", reports: 0, reports_recorded: false, duty_minutes: null, duty_updated_at: null, min_reports: 8, min_duty_hours: 30,
          previous: {month: "2026-09-01", duty_minutes: 2040, reports: 9, min_duty_hours: 30, min_reports: 8, closed: true}},
      }),
      get_announcements: [],
    }});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    const month = page.locator("[data-tour=dashboard-month]");
    await expect(month.getByText("8 kell", {exact: true})).toBeVisible();
    await expect(month.getByText("30 óra kell", {exact: true})).toBeVisible();
    await expect(month.getByText("A hónap végén rögzítik")).toHaveCount(1);
    await expect(month.getByText("A mentett jelentéseid ide számítanak")).toBeVisible();
    // No zeros and no warning before anything was recorded.
    await expect(month.getByText("0 / 8")).toHaveCount(0);
    await expect(month.getByText(/duty-minimum alatt/)).toHaveCount(0);
    const previous = month.locator("[data-tour=dashboard-month-previous]");
    await expect(previous).toContainText("szeptember");
    await expect(previous).toContainText("34 óra · 9 jelentés");
    await expect(previous.getByText("Teljesítve")).toBeVisible();
  });

  test("until last month is paid, the reports saved now count for it", async ({page}) => {
    await mockSupabase(page, {rpc: {
      get_dashboard_summary: summary({
        my_month: {month: "2026-10-01", reports: 0, report_period: "2026-09-01", period_reports: 6, reports_recorded: false, duty_minutes: null,
          duty_updated_at: null, min_reports: 8, min_duty_hours: 30, previous: null},
      }),
      get_announcements: [],
    }});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    const month = page.locator("[data-tour=dashboard-month]");
    await expect(month.getByText("6 / 8")).toBeVisible();
    await expect(month.getByText(/a fizetésig a szeptemberi elszámolásba számít/)).toBeVisible();
    await expect(month.getByRole("link", {name: /Jelentések/})).toHaveAttribute("href", "/reports?tab=list&mine=1");
  });

  test("the member chooses and orders the quick access tiles", async ({page}) => {
    await mockSupabase(page, {rpc: {get_dashboard_summary: summary(), get_announcements: []}});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);

    const quick = page.locator("[data-tour=dashboard-modules]");
    const tiles = quick.locator("[data-tile]");
    await expect(quick.getByRole("button", {name: /Logisztika/})).toBeVisible();
    await expect(tiles).toHaveCount(13);

    await quick.getByRole("button", {name: "Testreszabás"}).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", {name: "Eltávolítás: Logisztika"}).click();
    await dialog.getByRole("button", {name: "Hozzáadás: Új BOLO"}).click();
    await dialog.getByRole("button", {name: "Feljebb: Új BOLO"}).click();
    await dialog.getByRole("button", {name: "Mentés"}).click();
    await expect(dialog).toHaveCount(0);

    await expect(quick.getByRole("button", {name: /Logisztika/})).toHaveCount(0);
    await expect(tiles).toHaveCount(13);
    await expect(tiles.nth(11)).toContainText("Új BOLO");
    await expect(tiles.nth(12)).toContainText("Közösség");

    // Kept in this browser.
    await page.reload();
    await expect(tiles.nth(11)).toContainText("Új BOLO");
    expect(await page.evaluate((key) => localStorage.getItem(key), `frakhub.dashboard.tiles.${TEST_USER_ID}`)).toContain("/briefing?new=bolo");

    // A tile opens its page (an action opens its dialog there).
    await tiles.nth(11).click();
    await expect(page).toHaveURL(/\/briefing\?new=bolo$/);

    // Back to the default set: nothing is stored.
    await page.goto("/dashboard");
    await quick.getByRole("button", {name: "Testreszabás"}).click();
    await dialog.getByRole("button", {name: "Alapértelmezés"}).click();
    await dialog.getByRole("button", {name: "Mentés"}).click();
    await expect(quick.getByRole("button", {name: /Logisztika/})).toBeVisible();
    await expect(quick.getByRole("button", {name: /Új BOLO/})).toHaveCount(0);
    expect(await page.evaluate((key) => localStorage.getItem(key), `frakhub.dashboard.tiles.${TEST_USER_ID}`)).toBeNull();
  });
});
