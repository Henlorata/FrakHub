import {expect, test, type Page} from "@playwright/test";
import {login, mockSupabase, TEST_USER_ID, testProfile} from "./support/mock-supabase";

/**
 * Interactive trainings: they start by themselves for members who have not played them, run in
 * practice mode (an in-memory demo world: nothing reaches Supabase) and store only the result.
 */

const overlay = (page: Page) => page.locator("[data-tour-overlay]");
const stepTitle = (page: Page) => overlay(page).locator("h3").first();

/** Writes the app sent to the (mocked) database. */
const writes = (mock: Awaited<ReturnType<typeof mockSupabase>>) =>
  mock.requests.filter((request) => request.kind === "rest" && !["GET", "HEAD"].includes(request.method));

/** Moves the tour on: does what an action step asks, or presses the card's button. */
async function advance(page: Page, title: string) {
  const actions: Record<string, () => Promise<void>> = {
    "Értesítések": () => page.locator("[data-tour=bell]").click(),
    "Büntető kalkulátor": () => page.locator("[data-tour=nav-calculator]").click(),
    "Keresés": () => page.locator("[data-tour=calc-search] input").fill("ittas"),
    "Tétel hozzáadása": () => page.locator("[data-tour=calc-add]").first().click(),
    "Jelentés a tételekből": () => page.locator("[data-tour=calc-report]").click(),
    "Járműpark": () => page.locator("[data-tour=logistics-tab-fleet]").click(),
    "Képzések": () => page.getByRole("tab", {name: "Képzések"}).click(),
    "Ott leszel?": () => page.locator("[data-tour=event-rsvp]").first().getByRole("button", {name: /Ott leszek/}).click(),
  };
  if (actions[title]) await actions[title]();
  else await overlay(page).getByRole("button", {name: /^(Tovább|Befejezés)/}).click();
}

test.describe("trainings", () => {
  test("a new member is offered the basic training, and Later leaves nothing behind", async ({page}) => {
    const mock = await mockSupabase(page, {tables: {training_progress: []}});
    await login(page);
    await expect(overlay(page).getByText("Új képzés érhető el")).toBeVisible();
    await expect(overlay(page).getByRole("heading", {name: "Alapképzés"})).toBeVisible();

    await overlay(page).getByRole("button", {name: "Később"}).click();
    await expect(overlay(page)).toHaveCount(0);
    expect(writes(mock)).toHaveLength(0);

    // The rest of the visit stays quiet (the next visit offers it again).
    await page.getByRole("link", {name: "Logisztika"}).first().click();
    await page.waitForTimeout(2_500);
    await expect(overlay(page)).toHaveCount(0);
  });

  test("skipping warns first and stores the skip", async ({page}) => {
    const mock = await mockSupabase(page, {tables: {training_progress: []}});
    await login(page);
    await overlay(page).getByText("Kihagyom ezt a képzést").click();
    await expect(overlay(page).getByText("Nem javasoljuk.")).toBeVisible();
    await overlay(page).getByRole("button", {name: "Mégis kihagyom"}).click();

    await expect.poll(() => writes(mock).length).toBe(1);
    const [saved] = writes(mock);
    expect(saved.name).toBe("training_progress");
    expect(saved.body).toMatchObject({user_id: TEST_USER_ID, training_id: "basic", status: "skipped"});
  });

  test("the basic training runs on demo data and only its result is stored", async ({page}) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const mock = await mockSupabase(page, {tables: {training_progress: []}});
    // The member closed every menu group: the steps still find their menu items (practice mode shows them all).
    await page.addInitScript(() => localStorage.setItem("frakhub:nav-closed",
      JSON.stringify(["Áttekintés", "Operatív", "Oktatás", "Eszközök", "Közösség", "Adminisztráció"])));
    await login(page);
    await overlay(page).getByRole("button", {name: "Kezdjük"}).click();
    await expect(overlay(page).getByText("Gyakorló mód", {exact: true})).toBeVisible();
    // Demo data, not the (mocked) real dashboard.
    await expect(page.getByText("Gyakorló mód: üdv a bemutató világban!")).toBeVisible();
    const sent = mock.requests.length;

    const seen: string[] = [];
    for (let guard = 0; guard < 60; guard += 1) {
      const title = (await stepTitle(page).textContent()) ?? "";
      seen.push(title);
      if (title === "Ennyi volt!") break;
      await advance(page, title);
      await expect(stepTitle(page)).not.toHaveText(title, {timeout: 10_000});
    }
    expect(seen).toContain("Kiszabás");
    expect(seen.at(-1)).toBe("Ennyi volt!");
    // The calculator handed its items to the report form (in the demo world).
    expect(seen).toContain("Jelentésíró");

    // Nothing reached the database while practising (the training's own progress read aside).
    expect(mock.requests.slice(sent).filter((request) => request.kind !== "auth" && request.name !== "training_progress")).toEqual([]);

    await overlay(page).getByRole("button", {name: /Befejezés/}).click();
    await expect(overlay(page).getByText("Képzés teljesítve")).toBeVisible();
    await expect.poll(() => writes(mock).length).toBe(1);
    expect(writes(mock)[0].body).toMatchObject({training_id: "basic", status: "completed", version: 1});
    // Back on the real data.
    await expect(page.getByText("Gyakorló mód: üdv a bemutató világban!")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("every training of a bureau manager plays to the end without errors", async ({page}) => {
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const profile = testProfile({
      faction_rank: "Commander", system_role: "admin", division: "MCB", division_rank: "Investigator III.", qualifications: ["TB", "SAHP"],
      is_bureau_manager: true, is_bureau_commander: true, commanded_divisions: ["SAHP"],
    });
    await mockSupabase(page, {tables: {profiles: [profile]}});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/profile?tab=trainings");
    const cards = page.locator("[data-tour=profile-trainings] article");
    await expect(cards).toHaveCount(8);

    for (let index = 0; index < 8; index += 1) {
      await cards.nth(index).getByRole("button", {name: /játszás/}).click();
      await overlay(page).getByRole("button", {name: "Kezdjük"}).click();
      await expect(overlay(page).getByText("Gyakorló mód", {exact: true})).toBeVisible();
      for (let guard = 0; guard < 60; guard += 1) {
        const button = overlay(page).getByRole("button", {name: /^(Tovább|Befejezés|Lépés átugrása)/}).first();
        const label = (await button.textContent()) ?? "";
        await button.click();
        if (label.startsWith("Befejezés")) break;
      }
      await expect(overlay(page).getByText("Képzés teljesítve")).toBeVisible();
      await overlay(page).getByRole("button", {name: /Később|Kezdjük a munkát/}).click();
      await expect(overlay(page)).toHaveCount(0);
      await expect(page).toHaveURL(/\/profile\?tab=trainings$/);
    }
    expect(errors).toEqual([]);
  });

  test("locked trainings show what unlocks them and cannot be played", async ({page}) => {
    await mockSupabase(page);
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/profile?tab=trainings");
    const command = page.locator("[data-tour=profile-trainings] article", {has: page.getByRole("heading", {name: "Command Staff képzés"})});
    await expect(command.getByText("Lieutenant I. rangtól")).toBeVisible();
    await expect(command.getByRole("button")).toHaveCount(0);
  });
});
