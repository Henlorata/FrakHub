import {expect, test} from "@playwright/test";
import {login, mockSupabase} from "./support/mock-supabase";

test.describe("release notes", () => {
  test("the dashboard strip shows the latest release until dismissed", async ({page}) => {
    await mockSupabase(page);
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);

    const strip = page.locator("[data-tour=whats-new]");
    await expect(strip).toContainText("Újdonságok: Az új FrakHub");
    await strip.getByRole("button", {name: "Elrejtés"}).click();
    await expect(strip).toHaveCount(0);

    // Remembered in this browser.
    await page.reload();
    await expect(page.getByText("Irányítópult").first()).toBeVisible();
    await expect(page.locator("[data-tour=whats-new]")).toHaveCount(0);
  });

  test("the notes open from the strip, the account menu and the quick search", async ({page}) => {
    await mockSupabase(page);
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.locator("[data-tour=whats-new]").getByRole("button", {name: "Megnézem"}).click();
    await expect(page).toHaveURL(/\/changelog$/);
    await expect(page.getByRole("heading", {name: "Az új FrakHub"})).toBeVisible();
    await expect(page.getByRole("heading", {name: "Szervezeti ábra és vezetők"})).toBeVisible();
    await page.getByRole("link", {name: /Megnyitás/}).first().click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator("[data-tour=whats-new]")).toHaveCount(0);

    await page.getByRole("button", {name: "Fiók"}).click();
    await page.getByRole("menuitem", {name: /Újdonságok/}).click();
    await expect(page).toHaveURL(/\/changelog$/);

    await page.keyboard.press("Control+k");
    await page.getByRole("dialog").getByRole("textbox").fill("újdonság");
    await expect(page.getByRole("dialog").getByText("Újdonságok")).toBeVisible();
  });
});
