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
    fleet_categories: [{id: "other", name: LONG.slice(0, 80), description: LONG.slice(0, 300), unit: null, min_rank: null, tone: "green", sort_order: 1}],
    fleet_vehicles: [{
      id: "fv1", plate: "SFSD-0123456789", model: LONG.slice(0, 60), category_id: "other", game_id: 99999999, station: "Downtown",
      callsign: null, license_name: null, capacity: 2, shared_label: LONG.slice(0, 60), allowed_units: null, min_rank: null,
      is_unmarked: true, registration_required: true, registration_expires_on: null, notes: LONG.slice(0, 500), is_active: true,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      holders: [{user_id: longMember.id, is_temporary: true, note: LONG.slice(0, 200), assigned_at: new Date().toISOString()}],
    }],
  },
  rpc: {
    get_announcements: [{
      id: "a1", title: LONG.slice(0, 120), content: LONG, type: "info", is_pinned: true, show_author: true,
      created_at: new Date().toISOString(), created_by: TEST_USER_ID, author_name: LONG.slice(0, 64), author_rank: "Commander",
      author_category: "executive", can_delete: true,
    }],
    get_policies: {can_edit: true, members: 2, policies: [{id: "p1", title: LONG.slice(0, 120), category: "general", summary: LONG.slice(0, 300), version: 1,
      requires_ack: true, status: "published", published_at: new Date().toISOString(), updated_at: new Date().toISOString(), my_ack_version: null,
      acknowledged: 1, draft_changes: false}]},
    get_policy: {id: "p1", title: LONG.slice(0, 120), category: "general", summary: LONG.slice(0, 300), version: 1, requires_ack: true, status: "published",
      sort_order: 10, shown_version: 1, published_at: new Date().toISOString(), change_note: LONG.slice(0, 300), published_by_name: LONG.slice(0, 64),
      my_ack_version: null, body: [{type: "paragraph", content: LONG}], versions: [{version: 1, published_at: new Date().toISOString(),
        change_note: LONG.slice(0, 300), published_by_name: LONG.slice(0, 64)}], draft: null,
      missing: [{user_id: longMember.id, full_name: LONG.slice(0, 64), badge_number: "4001", faction_rank: "Deputy Sheriff II.", avatar_url: null}]},
    get_polls: [{id: "poll1", title: LONG.slice(0, 160), description: LONG.slice(0, 1000), audience: "all", anonymous: false, max_choices: 1, results: "live",
      closes_at: new Date(Date.now() + 86_400_000).toISOString(), closed_at: null, created_at: new Date().toISOString(), created_by: TEST_USER_ID,
      created_by_name: LONG.slice(0, 64), open: true, voted: true, can_manage: true, voters: 1, audience_size: 2, results_visible: true,
      options: [{id: "o1", label: LONG.slice(0, 120), votes: 1, mine: true, voters: [{full_name: LONG.slice(0, 64), avatar_url: null}]}]}],
    get_suggestions: {can_respond: true, suggestions: [{id: "i1", title: LONG.slice(0, 120), body: LONG, category: "website", status: "planned",
      response: LONG.slice(0, 1000), responded_at: new Date().toISOString(), created_at: new Date().toISOString(), author_id: longMember.id,
      author: {full_name: LONG.slice(0, 64), faction_rank: "Deputy Sheriff II.", avatar_url: null}, responded_by_name: LONG.slice(0, 64), votes: 3, voted: false}]},
    get_leaderboard: {month: "2026-10-01", visible: true, participants: 2, categories: ["duty", "reports", "events", "practice"].map((key) => ({key,
      me: {value: 3, place: 2, of: 2}, entries: [{user_id: longMember.id, full_name: LONG.slice(0, 64), badge_number: "4001", faction_rank: "Deputy Sheriff II.",
        avatar_url: null, value: 9, place: 1, me: false}, {user_id: TEST_USER_ID, full_name: LONG.slice(0, 64), badge_number: "1", faction_rank: "Commander",
        avatar_url: null, value: 3, place: 2, me: true}]}))},
    get_promotion_board: {criteria: [], exams: [], can_edit_criteria: true, nominations: [], members: [{user_id: longMember.id, full_name: LONG.slice(0, 64),
      badge_number: "4001", faction_rank: "Deputy Sheriff II.", rank_order: 14, division: "TSB", avatar_url: null, next_rank: "Deputy Sheriff III.",
      configured: true, since: "2026-08-01", days_in_rank: 60, missing: 0, eligible: true, on_leave: false, activity_status: "active", nomination: null,
      checks: [{key: "duty", label: LONG.slice(0, 80), value: 12, target: 30, unit: "óra", ok: false}]}]},
    get_trainees: [{user_id: longMember.id, full_name: LONG.slice(0, 64), badge_number: "4001", avatar_url: null, joined_on: "2026-10-01", days: 3,
      mentor: {id: TEST_USER_ID, full_name: LONG.slice(0, 64), faction_rank: "Commander", avatar_url: null}, assigned_at: null, signed_off_at: new Date().toISOString(),
      sign_off_note: LONG.slice(0, 400), signed_off_by_name: LONG.slice(0, 64), is_mentor: true, ready: false,
      checks: [{key: "exam", label: LONG.slice(0, 60), ok: true}], notes: [{id: "note1", body: LONG.slice(0, 400), created_at: new Date().toISOString(),
        author_name: LONG.slice(0, 64)}]}],
    verify_certificate: {code: "SFSD-0000-0001", kind: "scenario", ref: null, title: LONG.slice(0, 120), subtitle: LONG.slice(0, 80),
      issued_at: new Date().toISOString(), valid: true, revoked_at: null, holder: {full_name: LONG.slice(0, 64), badge_number: "4001", faction_rank: "Deputy Sheriff II."}},
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

      for (const path of ["/dashboard", "/notifications", "/logistics", "/logistics?tab=fleet", "/logistics?tab=fleet&view=usage",
        "/logistics/fleet/fv1", "/hr", "/hr?view=org", "/profile", "/events", "/changelog", "/mcb/templates", "/policies", "/community",
        "/community?tab=ideas", "/leaderboard", "/hr?tab=promotions", "/hr?tab=trainees", "/permissions", "/certificates/SFSD-0000-0001"]) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await expectNoHorizontalOverflow(page, path);
      }
    });
  }
});
