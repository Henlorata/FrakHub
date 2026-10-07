import {expect, test} from "@playwright/test";
import {login, mockSupabase, TEST_USER_ID, testProfile} from "./support/mock-supabase";

const inHours = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

const event = (overrides: Record<string, unknown> = {}) => ({
  id: "e1", title: "Razzia a dokkoknál", description: null, kind: "patrol", starts_at: inHours(26), ends_at: inHours(28), location: "Kikötő",
  audience: "all", rsvp: true, cancelled_at: null, created_at: inHours(-48), created_by: TEST_USER_ID, created_by_name: "John Doe",
  can_manage: true, my_status: null, my_note: null, counts: {going: 0, maybe: 0, absent: 0}, responses: [], operation: null,
  ...overrides,
});

const member = (id: string, name: string, rank: string) => testProfile({
  id, full_name: name, faction_rank: rank, badge_number: id.slice(0, 4), system_role: "user",
});

const PLAN = {
  event_id: "e1", objective: "A raktár átvizsgálása", situation: null, execution: null, radio_channel: "3", rally_point: "3-as kapu",
  rally_at: null, updated_at: inHours(0), updated_by_name: "John Doe", case: null, report: null,
  roles: [{id: "r1", name: "Behatoló csapat", task: "Belépés a főbejáraton.", callsign: "ADAM", sort_order: 1,
    members: [{user_id: TEST_USER_ID, full_name: "John Doe", faction_rank: "Sergeant I.", badge_number: "1192", avatar_url: null,
      callsign: "2-ADAM-1", note: null, vehicle: {id: "v1", plate: "SFSD-102", model: "Cruiser", callsign: null}}]}],
};

test.describe("operation plans", () => {
  test("the organiser writes the plan with its teams", async ({page}) => {
    const mock = await mockSupabase(page, {
      tables: {profiles: [testProfile(), member("44444444-4444-4444-8444-444444444444", "Laura Graves", "Deputy Sheriff II.")]},
      rpc: {get_events: [event()], get_event_operation: null, save_event_operation: PLAN},
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/events");

    await page.locator("#event-e1").getByRole("button", {name: "Műveleti terv készítése"}).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Cél").fill("A raktár átvizsgálása");
    await dialog.getByLabel("Gyülekező").fill("3-as kapu");
    await dialog.getByLabel("Rádió").fill("3");
    await dialog.getByRole("button", {name: "Behatoló csapat"}).click();
    await dialog.getByRole("button", {name: "Tagok beosztása"}).click();
    await dialog.getByText("Laura Graves").click();
    await dialog.getByRole("button", {name: "Kész"}).click();
    await dialog.getByRole("button", {name: "Mentés"}).click();

    await expect.poll(() => mock.requests.find((request) => request.name === "save_event_operation")?.body).toMatchObject({
      _event_id: "e1",
      _plan: {objective: "A raktár átvizsgálása", rally_point: "3-as kapu", radio_channel: "3",
        roles: [{name: "Behatoló csapat", members: [{user_id: "44444444-4444-4444-8444-444444444444"}]}]},
    });
    // The saved plan is shown, and the card counts the teams.
    await expect(dialog.getByText("A te szereped")).toBeVisible();
    await expect(dialog.getByText("SFSD-102 · Cruiser")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#event-e1")).toContainText("1 csapat · 1 fő");
  });

  test("members see their role on the card and read the plan and the report", async ({page}) => {
    await mockSupabase(page, {
      tables: {profiles: [testProfile({faction_rank: "Deputy Sheriff II.", system_role: "user"})]},
      rpc: {
        get_events: [event({can_manage: false, starts_at: inHours(-3), ends_at: inHours(-1), operation: {roles: 1, assigned: 1, my_role: "Behatoló csapat", report: true}})],
        get_event_operation: {...PLAN, report: {outcome: "partial", summary: "Két gyanúsított elfogva.", went_well: null,
          improve: "Több egység a hátsó kijárathoz.", at: inHours(0), by_name: "Kapitány Kata"}},
      },
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/events?id=e1&plan=1");

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Részben sikeres")).toBeVisible();
    await expect(dialog.getByText("Több egység a hátsó kijárathoz.")).toBeVisible();
    await expect(dialog.getByRole("tab", {name: "Szerkesztés"})).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByText("Szereped: Behatoló csapat")).toBeVisible();
  });
});
