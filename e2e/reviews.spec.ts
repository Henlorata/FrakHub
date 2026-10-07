import {expect, test} from "@playwright/test";
import {login, mockSupabase, TEST_USER_ID, testProfile} from "./support/mock-supabase";

const DEPUTY = {id: "33333333-3333-4333-8333-333333333333", full_name: "Deputy Dénes", faction_rank: "Deputy Sheriff II.", badge_number: "1300", avatar_url: null};
const REVIEWER = {id: TEST_USER_ID, full_name: "John Doe", faction_rank: "Sergeant I.", badge_number: "1192", avatar_url: null};
const SCORES = {activity: 4, reports: 5, teamwork: 4, conduct: 5, knowledge: 3, initiative: 4};

const review = (overrides: Record<string, unknown> = {}) => ({
  id: "rv1", user_id: DEPUTY.id, period: "2026-Q4", scores: SCORES, overall: 4.17, strengths: "Pontos jelentések.", improvements: null, goals: null,
  status: "draft", shared_at: null, acknowledged_at: null, member_comment: null, created_at: "2026-10-07T10:00:00Z", updated_at: "2026-10-07T10:00:00Z",
  member: DEPUTY, reviewer: REVIEWER, can_edit: true, can_delete: true, can_acknowledge: false, ...overrides,
});

test.describe("performance reviews", () => {
  test("a supervisor reviews a member and shares it", async ({page}) => {
    const mock = await mockSupabase(page, {
      rpc: {
        get_review_overview: {period: "2026-Q4", current_period: "2026-Q4", members: [{
          user_id: DEPUTY.id, full_name: DEPUTY.full_name, faction_rank: DEPUTY.faction_rank, badge_number: DEPUTY.badge_number, avatar_url: null,
          division: "TSB", can_write: true, review: null, last: {period: "2026-Q3", overall: 3.5, status: "acknowledged"}}]},
        save_review: review(),
        share_review: review({status: "shared", shared_at: "2026-10-07T10:05:00Z", can_edit: false, can_delete: false}),
      },
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/hr?tab=reviews");

    await expect(page.getByText("előző: 2026 Q3 – 3,5")).toBeVisible();
    await page.getByRole("button", {name: "Értékelés", exact: true}).click();
    const dialog = page.getByRole("dialog");
    const share = dialog.getByRole("button", {name: "Megosztás a taggal"});
    await expect(share).toBeDisabled();
    for (const [label, score] of [["Aktivitás", 4], ["Jelentések", 5], ["Csapatmunka", 4], ["Magatartás", 5], ["Szakmai tudás", 3], ["Kezdeményezés", 4]] as const) {
      await dialog.getByRole("radiogroup", {name: new RegExp(`^${label}`)}).getByRole("radio", {name: new RegExp(`^${score} –`)}).click();
    }
    await expect(dialog.getByText("4,17")).toBeVisible();
    await dialog.getByLabel("Erősségek").fill("Pontos jelentések.");
    await share.click();

    await expect.poll(() => mock.requests.find((request) => request.name === "share_review")?.body).toEqual({_id: "rv1"});
    expect(mock.requests.find((request) => request.name === "save_review")?.body).toMatchObject({
      _id: null, _user_id: DEPUTY.id, _period: "2026-Q4", _review: {scores: SCORES, strengths: "Pontos jelentések."},
    });
    await expect(page.getByText("Megosztva", {exact: true})).toBeVisible();
  });

  test("the member reads the shared review on their profile and acknowledges it", async ({page}) => {
    const mock = await mockSupabase(page, {
      tables: {profiles: [testProfile({faction_rank: "Deputy Sheriff II.", system_role: "user"})]},
      rpc: {
        get_reviews: {can_write: false, current_period: "2026-Q4", reviews: [review({status: "shared", can_edit: false, can_delete: false, can_acknowledge: true})]},
        acknowledge_review: review({status: "acknowledged", acknowledged_at: "2026-10-07T11:00:00Z", member_comment: "Köszönöm.", can_edit: false,
          can_delete: false}),
      },
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/profile?tab=reviews");

    await expect(page.getByText("1 értékelés vár a visszaigazolásodra.")).toBeVisible();
    await page.getByRole("button", {name: /2026 Q4/}).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Pontos jelentések.")).toBeVisible();
    await dialog.getByLabel("Válaszod (nem kötelező)").fill("Köszönöm.");
    await dialog.getByRole("button", {name: "Megismertem"}).click();
    await expect.poll(() => mock.requests.find((request) => request.name === "acknowledge_review")?.body).toEqual({_id: "rv1", _comment: "Köszönöm."});
    await expect(page.getByText("Visszaigazolva")).toBeVisible();
  });
});
