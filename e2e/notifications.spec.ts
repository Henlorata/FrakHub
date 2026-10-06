import {expect, test} from "@playwright/test";
import {login, mockSupabase, TEST_USER_ID} from "./support/mock-supabase";

const notification = (id: string, overrides: Record<string, unknown>) => ({
  id, user_id: TEST_USER_ID, title: "Értesítés", message: "Üzenet", type: "info", category: "system",
  is_read: false, link: null, actor_id: null, created_at: new Date().toISOString(), ...overrides,
});

const rows = [
  notification("n1", {title: "Előléptetés", message: "Új rendfokozatod: Sergeant II.", category: "hr", type: "success"}),
  notification("n2", {title: "Javítandó vizsgalap", message: "TGF – Vendég", category: "exam", link: "/exams?tab=grading"}),
  notification("n3", {title: "Hirdetmény: Teszt", message: "Régi hír", category: "announcement", is_read: true}),
];

test.describe("notification center", () => {
  test("the bell shows unread notifications and marks them read", async ({page}) => {
    const mock = await mockSupabase(page, {tables: {notifications: rows}});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);

    const bell = page.getByRole("button", {name: /Értesítések \(2 olvasatlan\)/});
    await expect(bell).toBeVisible();
    await bell.click();
    const popover = page.getByRole("dialog");
    await expect(popover.getByText("Javítandó vizsgalap")).toBeVisible();
    await expect(popover.getByText("Hirdetmény: Teszt")).toBeVisible();

    await page.getByRole("button", {name: "Összes olvasott"}).click();
    await expect(page.getByRole("button", {name: "Értesítések", exact: true})).toBeVisible();
    expect(mock.requests.some((r) => r.kind === "rest" && r.name === "notifications" && r.method === "PATCH")).toBe(true);
  });

  test("the page filters by category and opens links", async ({page}) => {
    await mockSupabase(page, {tables: {notifications: rows}});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/notifications");

    await page.getByRole("button", {name: /^Vizsgák/}).click();
    await expect(page.getByText("Javítandó vizsgalap")).toBeVisible();
    await expect(page.getByText("Előléptetés")).toHaveCount(0);

    await page.getByText("Javítandó vizsgalap").click();
    await expect(page).toHaveURL(/\/exams\?tab=grading$/);
  });

  test("categories can be muted in the settings", async ({page}) => {
    const mock = await mockSupabase(page, {tables: {notifications: rows, notification_preferences: []}});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/notifications?view=settings");

    const announcements = page.locator("label", {hasText: "Hirdetmények"}).getByRole("switch");
    await expect(announcements).toBeChecked();
    await announcements.click();
    await expect(announcements).not.toBeChecked();
    expect(mock.requests.some((r) => r.name === "notification_preferences" && r.method === "POST")).toBe(true);

    // System messages cannot be muted.
    await expect(page.locator("label", {hasText: "Rendszer"}).getByRole("switch")).toBeDisabled();
  });
});
