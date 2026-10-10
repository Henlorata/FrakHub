import {expect, test} from "@playwright/test";
import {login, mockSupabase, testProfile, TEST_USER_ID} from "./support/mock-supabase";

const categories = [
  {id: "patrol", name: "Járőrautók", description: null, unit: null, min_rank: null, tone: "orange", sort_order: 10},
  {id: "sahp", name: "Highway Patrol", description: null, unit: "SAHP", min_rank: null, tone: "sky", sort_order: 20},
  {id: "mu", name: "Medical Unit", description: null, unit: "MU", min_rank: null, tone: "rose", sort_order: 30},
];

const holder = (userId: string) => ({user_id: userId, is_temporary: false, note: null, assigned_at: "2026-10-01T10:00:00Z"});

const vehicle = (id: string, plate: string, model: string, category: string, extra: Record<string, unknown> = {}) => ({
  id, plate, model, category_id: category, game_id: null, station: "Downtown", callsign: null, license_name: null, capacity: 1,
  shared_label: null, allowed_units: null, min_rank: null, is_unmarked: false, registration_required: true, registration_expires_on: null,
  notes: null, is_active: true, created_at: "2026-09-01T10:00:00Z", updated_at: "2026-09-01T10:00:00Z", holders: [], ...extra,
});

const vehicles = [
  vehicle("v1", "SFSD-010", "Ford Explorer", "patrol", {capacity: 2}),
  vehicle("v2", "SFSD-011", "Ford Explorer", "patrol", {holders: [holder("someone")]}),
  vehicle("v3", "SFSD-020", "Ford Crown Victoria", "patrol", {holders: [holder("someone")]}),
  vehicle("v4", "SFSD-030", "Dodge Charger SRT 2015", "patrol", {min_rank: "Sergeant I."}),
  vehicle("v5", "SAHP-001", "Dodge Demon SRT", "sahp"),
  vehicle("v6", "MU-001", "Ambulance", "mu", {capacity: null, shared_label: "Medical Unit"}),
  vehicle("v7", "SFSD-040", "Ford Taurus", "patrol", {holders: [holder(TEST_USER_ID)]}),
];

test.describe("vehicle requests", () => {
  test("the dialog offers the real fleet: free keys, locks with the reason, no shared pools", async ({page}) => {
    const mock = await mockSupabase(page, {
      tables: {
        profiles: [testProfile({faction_rank: "Deputy Sheriff II.", system_role: "user"})],
        fleet_vehicles: vehicles, fleet_categories: categories, vehicle_requests: [],
      },
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/logistics");
    await page.getByRole("button", {name: "Új igénylés"}).click();

    const dialog = page.getByRole("dialog", {name: "Járműigénylés"});
    const option = (name: string) => dialog.getByRole("radio", {name: new RegExp(`^${name}`)});
    await expect(option("Ford Explorer")).toContainText("2 szabad kulcs");
    await expect(option("Ford Crown Victoria")).toContainText("Most nincs szabad kulcs");
    await expect(option("Ford Taurus")).toContainText("Már van kulcsod");
    await expect(option("Dodge Charger SRT 2015")).toBeDisabled();
    await expect(option("Dodge Charger SRT 2015")).toContainText("Legalább Sergeant I. rang kell.");
    await expect(option("Dodge Demon SRT")).toBeDisabled();
    await expect(option("Dodge Demon SRT")).toContainText("Csak SAHP tagoknak.");
    await expect(dialog.getByText("Ambulance")).toHaveCount(0);
    await expect(dialog.getByText("Járőrautók")).toBeVisible();

    // A very long reason stays inside the dialog, and the dialog inside the window.
    await option("Ford Explorer").click();
    await dialog.getByLabel("Indoklás").fill(`Napi járőrszolgálat ${"a".repeat(300)} ${"Hosszú indoklás. ".repeat(25)}`.slice(0, 600));
    const box = await dialog.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    await expect(dialog.getByRole("button", {name: "Benyújtás"})).toBeInViewport();

    await dialog.getByRole("button", {name: "Benyújtás"}).click();
    await expect(page.getByText("Igénylés benyújtva.")).toBeVisible();
    const insert = mock.requests.find((request) => request.kind === "rest" && request.name === "vehicle_requests" && request.method === "POST");
    expect(insert?.body).toMatchObject({user_id: TEST_USER_ID, vehicle_type: "Ford Explorer", status: "pending"});
  });

  test("a vehicle that is not in the fleet can be requested by name", async ({page}) => {
    const mock = await mockSupabase(page, {tables: {fleet_vehicles: vehicles, fleet_categories: categories, vehicle_requests: []}});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/logistics?new=1");
    const dialog = page.getByRole("dialog", {name: "Járműigénylés"});
    await dialog.getByRole("radio", {name: /Más jármű/}).click();
    await dialog.getByLabel("A jármű típusa").fill("Enus Stafford");
    await dialog.getByLabel("Indoklás").fill("Protokolláris feladatokhoz.");
    await dialog.getByRole("button", {name: "Benyújtás"}).click();
    await expect(page.getByText("Igénylés benyújtva.")).toBeVisible();
    expect(mock.requests.find((request) => request.name === "vehicle_requests" && request.method === "POST")?.body)
      .toMatchObject({vehicle_type: "Enus Stafford", reason: "Protokolláris feladatokhoz."});
  });
});
