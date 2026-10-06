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

const DEPUTY_ID = "22222222-2222-4222-8222-222222222222";
const budapestDay = (offsetDays = 0) =>
  new Intl.DateTimeFormat("sv-SE", {timeZone: "Europe/Budapest"}).format(new Date(Date.now() + offsetDays * 86_400_000));

test.describe("event attendance and absences", () => {
  const supervisor = testProfile({faction_rank: "Sergeant I.", system_role: "supervisor"});
  const deputy = testProfile({id: DEPUTY_ID, full_name: "Deputy Dénes", badge_number: "2001", faction_rank: "Deputy Sheriff II.", system_role: "user"});
  const past = (overrides: Record<string, unknown> = {}) => event({
    id: "past", title: "Közös akció a kikötőben", kind: "patrol", starts_at: inHours(-30), ends_at: inHours(-28), counts: {going: 1, maybe: 0, absent: 0},
    responses: [person(DEPUTY_ID, "Deputy Dénes", "going")], attendance_taken_at: null, attended_count: null, i_attended: null, attendee_ids: null,
    ...overrides,
  });

  test("organisers record who was there after the start", async ({page}) => {
    const mock = await mockSupabase(page, {
      tables: {profiles: [supervisor, deputy]},
      rpc: {get_events: [past({can_manage: true, attendee_ids: []})], get_absences: [], set_event_attendance: {attended: 1, attendance_taken_at: inHours(0)}},
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/events");
    await page.getByRole("button", {name: /Korábbi események/}).click();

    const card = page.locator("#event-past");
    await expect(card.getByText("A jelenlét még nincs rögzítve.")).toBeVisible();
    await card.getByRole("button", {name: /Jelenlét rögzítése/}).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", {name: "Jelentkezők bejelölése"}).click();
    await expect(dialog.getByText("1 fő bejelölve")).toBeVisible();
    await dialog.getByRole("button", {name: "Mentés"}).click();

    await expect(page.getByText("Jelenlét rögzítve: 1 fő.")).toBeVisible();
    expect(mock.requests.find((request) => request.name === "set_event_attendance")?.body).toEqual({_event_id: "past", _user_ids: [DEPUTY_ID]});
    await expect(card.locator("[data-tour=event-attendance]")).toContainText("Jelenlét: 1 fő");
    await expect(card.getByRole("button", {name: /Jelenlét módosítása/})).toBeVisible();
  });

  test("members see whether they were marked present, but not the list", async ({page}) => {
    await mockSupabase(page, {
      tables: {profiles: [testProfile({faction_rank: "Deputy Sheriff II.", system_role: "user"})]},
      rpc: {
        get_events: [
          past({attendance_taken_at: inHours(-20), attended_count: 12, i_attended: true}),
          past({id: "past2", title: "Lőtéri edzés", starts_at: inHours(-50), ends_at: inHours(-48), attendance_taken_at: inHours(-40), attended_count: 8,
            i_attended: false}),
        ],
        get_absences: [],
      },
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/events");
    await page.getByRole("button", {name: /Korábbi események/}).click();

    await expect(page.locator("#event-past").getByText("Jelen voltál")).toBeVisible();
    await expect(page.locator("#event-past2").getByText("Nem voltál jelen")).toBeVisible();
    await expect(page.getByRole("button", {name: /Jelenlét/})).toHaveCount(0);
  });

  test("approved leave shows in the calendar and while planning an event", async ({page}) => {
    const today = budapestDay();
    const mock = await mockSupabase(page, {
      tables: {profiles: [supervisor]},
      rpc: {
        get_events: [],
        get_absences: [{user_id: DEPUTY_ID, full_name: "Szabadságos Sára", badge_number: "2010", faction_rank: "Deputy Sheriff I.", avatar_url: null,
          starts_on: today, ends_on: budapestDay(2)}],
      },
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/events");

    const panel = page.locator("[data-tour=events-absences]");
    await expect(panel.getByRole("link", {name: /Szabadságos Sára/})).toHaveAttribute("href", `/hr?member=${DEPUTY_ID}`);
    await expect(page.locator("[data-tour=events-calendar]").getByRole("button", {name: new RegExp(`^${today}.*1 tag szabadságon`)})).toBeEnabled();
    expect(mock.count("rpc", "get_absences")).toBe(1);
    expect(mock.requests.find((request) => request.name === "get_absences")?.body).toMatchObject({_from: budapestDay(-45), _to: budapestDay(120)});

    await page.getByRole("button", {name: /Új esemény/}).first().click();
    await expect(page.getByRole("dialog").getByText(/Ezen a napon 1 tag szabadságon van: Szabadságos Sára/)).toBeVisible();
  });
});
