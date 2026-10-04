import {expect, test, type Page} from "@playwright/test";
import {login, mockSupabase, TEST_USER_ID, testProfile} from "./support/mock-supabase";

/** An unbroken "word" far wider than any column (pasted links, keyboard mashing). */
const LONG = "rsgysdgrrsgysdgr".repeat(24);

const viewer = testProfile({
  faction_rank: "Commander", system_role: "admin", is_bureau_manager: true, division: "MCB",
  division_rank: "Investigator III.", qualifications: ["TB"],
});
const longMember = testProfile({
  id: "44444444-4444-4444-8444-444444444444", full_name: LONG.slice(0, 64), badge_number: "4001",
  faction_rank: "Deputy Sheriff II.", system_role: "user",
});

const data = {
  tables: {
    profiles: [viewer, longMember],
    notifications: [{
      id: "n1", user_id: TEST_USER_ID, title: LONG.slice(0, 160), message: LONG, type: "info", category: "system",
      is_read: false, link: null, actor_id: null, created_at: new Date().toISOString(),
    }],
    vehicle_requests: [{
      id: "v1", user_id: longMember.id, vehicle_type: LONG.slice(0, 60), reason: LONG, status: "pending",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      profiles: {full_name: LONG.slice(0, 64), badge_number: "4001", faction_rank: "Deputy Sheriff II."},
    }],
  },
  rpc: {
    get_announcements: [{
      id: "a1", title: LONG.slice(0, 120), content: LONG, type: "info", is_pinned: true, show_author: true,
      created_at: new Date().toISOString(), created_by: TEST_USER_ID, author_name: LONG.slice(0, 64), author_rank: "Commander",
      author_category: "executive", can_delete: true,
    }],
  },
};

/** Nothing may push the page wider than the window. */
async function expectNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${label} overflows horizontally by ${overflow}px`).toBeLessThanOrEqual(0);
}

test.describe("long unbroken text", () => {
  test("never pushes a dialog out of the window", async ({page}) => {
    await mockSupabase(page, {tables: {profiles: [viewer]}});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole("button", {name: "Új hirdetmény"}).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("Rövid, beszédes cím").fill(LONG.slice(0, 120));
    await dialog.getByPlaceholder("Írd ide az üzenetet…").fill(LONG);

    const viewport = page.viewportSize()!;
    const dialogBox = (await dialog.boundingBox())!;
    const textareaBox = (await dialog.locator("textarea").boundingBox())!;
    expect(dialogBox.x).toBeGreaterThanOrEqual(0);
    expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(viewport.width);
    expect(textareaBox.x + textareaBox.width).toBeLessThanOrEqual(dialogBox.x + dialogBox.width);
    await expect(dialog.getByRole("button", {name: "Közzététel"})).toBeInViewport();
  });

  for (const viewport of [{width: 1280, height: 800}, {width: 390, height: 844}]) {
    test(`wraps in feeds, lists and profiles (${viewport.width}px)`, async ({page}) => {
      await page.setViewportSize(viewport);
      await mockSupabase(page, data);
      await login(page);
      await expect(page).toHaveURL(/\/dashboard$/);

      for (const path of ["/dashboard", "/notifications", "/logistics", "/hr", "/profile"]) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await expectNoHorizontalOverflow(page, path);
      }
    });
  }
});
