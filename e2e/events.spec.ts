import {expect, test} from "@playwright/test";
import {login, mockSupabase, testProfile} from "./support/mock-supabase";

const inHours = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

const person = (id: string, name: string, status: string, note: string | null = null) =>
  ({user_id: id, status, full_name: name, badge_number: "2000", faction_rank: "Deputy Sheriff II.", avatar_url: null, note});

const event = (overrides: Record<string, unknown> = {}) => ({
  id: "e1", title: "Heti állománygyűlés", description: "Napirend: előléptetések.", kind: "meeting", starts_at: inHours(26), ends_at: inHours(27),
  location: "Downtown Station", audience: "all", rsvp: true, cancelled_at: null, created_at: inHours(-48), created_by: "x",
  created_by_name: "Kapitány Kata", can_manage: false, my_status: null, my_note: null, counts: {going: 2, maybe: 0, absent: 1},
  responses: [person("p1", "Deputy Dénes", "going"), person("p2", "Nyomozó Nándor", "going"), person("p3", "Újonc Ubul", "absent")],
  ...overrides,
});

test.describe("events", () => {
  test("members see the calendar in one call and answer whether they come", async ({page}) => {
    const mock = await mockSupabase(page, {
      tables: {profiles: [testProfile({faction_rank: "Deputy Sheriff II.", system_role: "user"})]},
      rpc: {
        get_events: [event(), event({id: "e2", title: "Lőtéri edzés", kind: "training", starts_at: inHours(50), ends_at: null, cancelled_at: inHours(-1)})],
        respond_to_event: {going: 3, maybe: 0, absent: 1},
      },
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/events");

    const card = page.locator("#event-e1");
    await expect(card.getByRole("heading", {name: "Heti állománygyűlés"})).toBeVisible();
    await expect(page.locator("#event-e2").getByText("Elmarad")).toBeVisible();
    // Only organisers create events.
    await expect(page.getByRole("button", {name: /Új esemény/})).toHaveCount(0);
    // One call for the whole calendar, no table reads.
    expect(mock.count("rpc", "get_events")).toBe(1);
    expect(mock.requests.filter((request) => request.kind === "rest" && request.name.startsWith("event"))).toHaveLength(0);

    await card.getByRole("button", {name: /Ott leszek/}).click();
    await expect(card.getByRole("button", {name: /Ott leszek/})).toHaveAttribute("aria-pressed", "true");
    await expect(card.getByRole("button", {name: /Ott leszek/})).toContainText("3");
    expect(mock.requests.find((request) => request.name === "respond_to_event")?.body).toMatchObject({_event_id: "e1", _status: "going"});

    // Who comes: names for everyone.
    await card.getByRole("button", {name: /3 jön/}).click();
    await expect(card.getByText("Nyomozó Nándor")).toBeVisible();
  });

  test("organisers create an event in Hungarian time and the audience is told", async ({page}) => {
    const supervisor = testProfile({faction_rank: "Sergeant I.", system_role: "supervisor"});
    const mock = await mockSupabase(page, {tables: {profiles: [supervisor]}, rpc: {get_events: []}});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/events");
    await expect(page.getByText("Nincs tervezett esemény.")).toBeVisible();

    await page.getByRole("button", {name: /Új esemény/}).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Cím").fill("Heti gyűlés");
    await dialog.getByLabel("Nap").fill("2030-07-04");
    await dialog.getByLabel("Kezdés").fill("20:00");
    await dialog.getByLabel(/^Vége/).fill("21:30");
    await dialog.getByLabel("Helyszín").fill("Downtown");
    await dialog.getByRole("button", {name: "Létrehozás"}).click();

    await expect(page.getByText("Esemény létrehozva.")).toBeVisible();
    const insert = mock.requests.find((request) => request.kind === "rest" && request.name === "events" && request.method === "POST");
    // 20:00 in Budapest in July is 18:00 UTC; the organiser is set by the database.
    expect(insert?.body).toEqual({
      title: "Heti gyűlés", kind: "meeting", audience: "all", rsvp: true, location: "Downtown", description: null,
      starts_at: "2030-07-04T18:00:00.000Z", ends_at: "2030-07-04T19:30:00.000Z",
    });
    await expect.poll(() => mock.count("rpc", "get_events")).toBe(2);
  });
});
