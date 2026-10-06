import {expect, test} from "@playwright/test";
import {login, mockSupabase} from "./support/mock-supabase";

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
        my_month: {month: "2026-10-01", reports: 9, duty_minutes: 1900, duty_updated_at: null, min_reports: 8, min_duty_hours: 30},
        upcoming_events: [],
      }),
      get_announcements: [],
    }});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator("[data-tour=dashboard-month]").getByText("Teljesítve").first()).toBeVisible();
    await expect(page.locator("[data-tour=dashboard-events]").getByText("Nincs esemény a következő két hétben.")).toBeVisible();
  });
});
