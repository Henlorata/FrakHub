import {expect, test, type Page} from "@playwright/test";
import {login, mockSupabase, TEST_USER_ID} from "./support/mock-supabase";
import {formatStandardDate} from "../src/lib/datetime";

const draftKey = `frakhub.report.draft.${TEST_USER_ID}`;
const minutesAgo = (minutes: number) => Date.now() - minutes * 60_000;

async function openWithDraft(page: Page, draft: Record<string, unknown>) {
  await mockSupabase(page);
  await login(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [draftKey, JSON.stringify(draft)]);
  await page.goto("/reports");
}

const description = (page: Page) => page.getByPlaceholder(/Mi történt/);
const storedDraft = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), draftKey);

test.describe("report form draft", () => {
  test("a draft from a few minutes ago comes back, with today's date", async ({page}) => {
    await openWithDraft(page, {date: "2026. 10. 06.", suspectName: "Teszt Elek", description: "Félbehagyott leírás", savedAt: minutesAgo(2)});
    await expect(page.getByLabel("Időpont")).toHaveValue(formatStandardDate());
    await expect(description(page)).toHaveValue("Félbehagyott leírás");
  });

  test("a draft older than ten minutes is wiped", async ({page}) => {
    await openWithDraft(page, {date: "2026. 10. 06.", suspectName: "Teszt Elek", description: "Tegnapi leírás", savedAt: minutesAgo(11)});
    await expect(page.getByLabel("Időpont")).toHaveValue(formatStandardDate());
    await expect(description(page)).toHaveValue("");
    await expect.poll(async () => (await storedDraft(page)).description ?? "").toBe("");
  });

  test("a draft without its time (from before) is wiped too", async ({page}) => {
    await openWithDraft(page, {date: "2026. 10. 06.", description: "Régi leírás"});
    await expect(description(page)).toHaveValue("");
  });

  test("leaving the page saves the last keystrokes and the time", async ({page}) => {
    await openWithDraft(page, {});
    await expect(description(page)).toHaveValue("");
    // At once, before the delayed save: another tab of the page unmounts the form...
    await description(page).fill("Most írt leírás");
    await page.getByRole("tab", {name: "Mappa nyitása"}).click({force: true});
    await expect(description(page)).toHaveCount(0);
    expect((await storedDraft(page)).description).toBe("Most írt leírás");
    await page.getByRole("tab", {name: "Új jelentés"}).click();
    await expect(description(page)).toHaveValue("Most írt leírás");

    // ... and a reload leaves the page too.
    await description(page).fill("Újratöltés előtt");
    await page.reload();
    await expect(description(page)).toHaveValue("Újratöltés előtt");
    expect(Date.now() - (await storedDraft(page)).savedAt).toBeLessThan(60_000);
  });

  test("a date typed in stays with the draft", async ({page}) => {
    await openWithDraft(page, {date: "2026. 10. 06.", dateEdited: true, suspectName: "Teszt Elek", savedAt: minutesAgo(1)});
    await expect(page.getByLabel("Időpont")).toHaveValue("2026. 10. 06.");

    await page.getByLabel("Időpont").fill("2026. 10. 05.");
    await expect.poll(async () => (await storedDraft(page)).date).toBe("2026. 10. 05.");
    await page.reload();
    await expect(page.getByLabel("Időpont")).toHaveValue("2026. 10. 05.");

    // A new report follows today again.
    await page.getByRole("button", {name: "Űrlap ürítése"}).click();
    await expect(page.getByLabel("Időpont")).toHaveValue(formatStandardDate());
    await page.reload();
    await expect(page.getByLabel("Időpont")).toHaveValue(formatStandardDate());
  });
});

test.describe("calculator to report", () => {
  test("a sub-offence goes to the report with its main offence", async ({page}) => {
    await mockSupabase(page);
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/calculator");
    await page.getByLabel("Keresés a tételek között").fill("Lakott Területen");
    await page.locator("main button[aria-expanded]").filter({hasText: "Gyorshajtás Lakott Területen"}).first().click();
    await page.locator("main [data-tour=calc-add]").first().click();
    await page.getByRole("button", {name: /Jelentés készítése ezekkel/}).click();
    await expect(page).toHaveURL(/\/reports$/);
    // "25% (65km/h)" alone would mean nothing in the report.
    await expect(page.getByPlaceholder("pl. Gyorshajtás, rendőri utasítás megtagadása"))
      .toHaveValue("Gyorshajtás Lakott Területen (50km/h) – 25% (65km/h)");
  });
});
