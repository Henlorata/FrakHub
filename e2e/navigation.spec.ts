import {expect, test} from "@playwright/test";
import {login, mockSupabase, TEST_USER_ID, testProfile} from "./support/mock-supabase";

const DEPUTY_ID = "22222222-2222-4222-8222-222222222222";

test.describe("menu groups", () => {
  test("a group closes, stays closed after a reload and opens again", async ({page}) => {
    await mockSupabase(page);
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);

    const nav = page.locator("aside nav");
    const group = nav.getByRole("button", {name: "Oktatás"});
    await expect(group).toHaveAttribute("aria-expanded", "true");
    await expect(nav.getByRole("link", {name: "Akadémia"})).toBeVisible();

    await group.click();
    await expect(group).toHaveAttribute("aria-expanded", "false");
    await expect(nav.getByRole("link", {name: "Akadémia"})).toHaveCount(0);

    await page.reload();
    await expect(nav.getByRole("button", {name: "Oktatás"})).toHaveAttribute("aria-expanded", "false");
    await expect(nav.getByRole("link", {name: "Akadémia"})).toHaveCount(0);
    // The other groups stay open.
    await expect(nav.getByRole("link", {name: "Irányítópult"})).toBeVisible();

    await nav.getByRole("button", {name: "Oktatás"}).click();
    await expect(nav.getByRole("link", {name: "Akadémia"})).toBeVisible();
  });

  test("a closed group keeps the current page and shows the count it hides", async ({page}) => {
    await mockSupabase(page, {tables: {notifications: [1, 2, 3].map((index) => ({
      id: `00000000-0000-4000-8000-00000000000${index}`, user_id: TEST_USER_ID, title: `Értesítés ${index}`, message: "", type: "info",
      category: "system", link: null, is_read: false, created_at: new Date().toISOString(),
    }))}});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);

    const nav = page.locator("aside nav");
    const group = nav.getByRole("button", {name: /Áttekintés/});
    await group.click();
    await expect(nav.getByRole("link", {name: "Irányítópult"})).toBeVisible();
    await expect(nav.getByRole("link", {name: /Értesítések/})).toHaveCount(0);
    await expect(group).toContainText("3");
  });
});

test.describe("new deploy", () => {
  test("an open tab loads the new build on the next page change", async ({page}) => {
    await mockSupabase(page);
    await page.route("**/version.json", (route) => route.fulfill({json: {build: "a-newer-build"}}));
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.evaluate(() => Object.assign(window, {oldBuild: true}));
    const checked = page.waitForResponse("**/version.json");
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await checked;

    // An in-app page change fires no load event; the reload does.
    const reloaded = page.waitForEvent("load");
    await page.locator("aside nav").getByRole("link", {name: "Események"}).click();
    await reloaded;
    await expect(page).toHaveURL(/\/events$/);
    expect(await page.evaluate(() => "oldBuild" in window)).toBe(false);
  });

  test("without a new deploy the page changes as before", async ({page}) => {
    await mockSupabase(page);
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.evaluate(() => Object.assign(window, {sameBuild: true}));
    const checked = page.waitForResponse("**/version.json");
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    expect((await checked).ok()).toBe(true);

    await page.locator("aside nav").getByRole("link", {name: "Események"}).click();
    await expect(page).toHaveURL(/\/events$/);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => "sameBuild" in window)).toBe(true);
  });
});

test.describe("member sheet tabs", () => {
  const viewer = testProfile({faction_rank: "Captain II.", system_role: "admin"});
  const deputy = testProfile({id: DEPUTY_ID, full_name: "Deputy Dénes", badge_number: "2001", faction_rank: "Deputy Sheriff II.", system_role: "user"});

  test("every tab fits the sheet on a desktop", async ({page}) => {
    await page.setViewportSize({width: 1366, height: 900});
    await mockSupabase(page, {tables: {profiles: [viewer, deputy]}});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/hr?member=${DEPUTY_ID}`);

    const sheet = page.getByRole("dialog");
    const last = sheet.getByRole("tab", {name: "Értékelések"});
    await expect(last).toBeVisible();
    const sheetBox = (await sheet.boundingBox())!;
    const tabBox = (await last.boundingBox())!;
    expect(tabBox.x + tabBox.width).toBeLessThanOrEqual(sheetBox.x + sheetBox.width);
  });

  test("on a phone the tabs scroll and the chosen one comes into view", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await mockSupabase(page, {tables: {profiles: [viewer, deputy]}});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/hr?member=${DEPUTY_ID}`);

    const sheet = page.getByRole("dialog");
    const list = sheet.getByRole("tablist");
    expect(await list.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    await sheet.getByRole("tab", {name: "Értékelések"}).click();
    await expect(sheet.getByRole("tab", {name: "Értékelések"})).toHaveAttribute("data-state", "active");
    await expect(sheet.getByRole("tab", {name: "Értékelések"})).toBeInViewport();
    // The page itself never scrolls sideways.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test.describe("profile card", () => {
  test("an emblem that does not load is left out", async ({page}) => {
    await mockSupabase(page, {tables: {profiles: [testProfile({division: "MCB"})]}});
    await page.route(/\/assets\/mcb-[\w-]+\.webp$/, (route) => route.fulfill({status: 404, body: ""}));
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/profile");
    await expect(page.getByText(/Major Crimes Bureau/i).first()).toBeVisible();
    await expect(page.locator("img[src*='/assets/mcb-']")).toHaveCount(0);
  });
});
