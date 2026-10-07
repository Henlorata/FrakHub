import {expect, test} from "@playwright/test";
import {login, mockSupabase, TEST_USER_ID} from "./support/mock-supabase";

const bolo = (overrides: Record<string, unknown> = {}) => ({
  id: "b1", kind: "vehicle", reason: "stolen", danger: "high", title: "Lopott fekete Sultan", plate: "ABC-123", vehicle_model: "Sultan",
  vehicle_color: "fekete", person_name: null, description: "Doherty felé tartott.", last_seen_location: "Doherty", last_seen_at: null,
  image_url: null, status: "active", expires_at: "2026-12-01T10:00:00Z", resolved_at: null, resolution: null, resolved_by_name: null,
  created_by: TEST_USER_ID, created_by_name: "John Doe", created_at: "2026-10-07T08:00:00Z", updated_at: "2026-10-07T08:00:00Z",
  can_manage: true, case: null, suspect: null, ...overrides,
});

const briefing = (bolos: unknown[]) => ({
  generated_at: "2026-10-07T08:00:00Z", bolos, resolved: [], wanted: [], events: [], announcements: [],
  last24h: {tickets: 3, arrests: 1, reports: 2},
});

test.describe("patrol", () => {
  test("the briefing lists the active alerts and a new alert is checked before it is sent", async ({page}) => {
    const mock = await mockSupabase(page, {rpc: {get_briefing: briefing([bolo()]), get_bolos: {active: [bolo()], closed: []}}});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/briefing");
    await expect(page.getByText("Lopott fekete Sultan").first()).toBeVisible();
    await expect(page.getByText("ABC-123").first()).toBeVisible();

    await page.getByRole("button", {name: "Új BOLO"}).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", {name: "BOLO kiadása"}).click();
    await expect(page.getByText(/Adj rövid címet/)).toBeVisible();
    expect(mock.requests.filter((request) => request.name === "bolo_alerts" && request.method === "POST")).toHaveLength(0);

    await dialog.getByLabel("Rövid cím").fill("Piros Infernus");
    await dialog.getByLabel("Rendszám").fill("xyz 777");
    await dialog.getByRole("button", {name: "BOLO kiadása"}).click();
    await expect.poll(() => mock.requests.find((request) => request.name === "bolo_alerts" && request.method === "POST")?.body)
      .toMatchObject({kind: "vehicle", title: "Piros Infernus", plate: "XYZ 777"});
  });

  test("the quick search looks up a plate", async ({page}) => {
    const mock = await mockSupabase(page, {
      rpc: {
        lookup_plate: {
          bolos: [{id: "b1", title: "Lopott fekete Sultan", plate: "ABC-123", status: "active", danger: "high", active: true}],
          fleet: [{id: "v1", plate: "SFSD-012", model: "Ford Explorer"}],
          persons: [],
        },
      },
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.keyboard.press("Control+K");
    await page.getByPlaceholder(/rendszám/).fill("abc 123");
    await expect(page.getByText("BOLO: Lopott fekete Sultan")).toBeVisible();
    await expect(page.getByText("SFSD-012 · Ford Explorer")).toBeVisible();
    expect(mock.requests.filter((request) => request.name === "lookup_plate").map((request) => request.body)).toEqual([{_query: "abc 123"}]);
  });
});
