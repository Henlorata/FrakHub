import {devices, expect, test, type Page} from "@playwright/test";
import {login, mockSupabase} from "./support/mock-supabase";

const lite = (page: Page) => page.evaluate(() => document.documentElement.classList.contains("lite"));
const panelBlur = (page: Page) => page.locator(".panel").first().evaluate((element) => getComputedStyle(element).backdropFilter);

// A phone: a touch screen without a mouse (the descriptor without its browser type, which a group cannot change).
const {defaultBrowserType: _browser, ...phone} = devices["Pixel 7"];

test.describe("light rendering on a phone", () => {
  test.use(phone);

  test("is on by itself: no frosted blur, a still backdrop; the profile can switch it off for this device", async ({page}) => {
    await mockSupabase(page);
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    expect(await lite(page)).toBe(true);
    expect(await panelBlur(page)).toBe("none");
    expect(await page.locator(".backdrop-glow").first().evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
    // The corner star still turns, as one layer.
    expect(await page.locator(".backdrop-emblem > svg").evaluate((element) => getComputedStyle(element).animationName)).toBe("emblem-turn");

    await page.goto("/profile?tab=settings");
    const card = page.locator("[data-tour=display-mode]");
    await card.getByRole("radio", {name: /^Teljes/}).click();
    expect(await lite(page)).toBe(false);
    expect(await panelBlur(page)).toContain("blur");
    await page.reload();
    await expect(card).toBeVisible();
    expect(await lite(page)).toBe(false);
    await expect(card.getByRole("radio", {name: /^Teljes/})).toHaveAttribute("aria-checked", "true");

    await card.getByRole("radio", {name: /^Automatikus/}).click();
    expect(await lite(page)).toBe(true);
  });
});

test("a computer keeps the full look", async ({page}) => {
  await mockSupabase(page);
  await login(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(await lite(page)).toBe(false);
  expect(await panelBlur(page)).toContain("blur");
});
