import {expect, test} from "@playwright/test";
import {fleetUsage, modelKey, type UsageVehicle} from "../src/lib/fleet-usage";
import {login, mockSupabase, testProfile} from "./support/mock-supabase";

const NOW = Date.parse("2026-10-06T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW - days * 86_400_000).toISOString();

const categories = [
  {id: "explorer", name: "Marked Ford Explorer", description: null, unit: null, min_rank: null, tone: "orange", sort_order: 10},
  {id: "mu", name: "Medical Unit [MU]", description: null, unit: "MU", min_rank: null, tone: "rose", sort_order: 20},
];

const holder = (userId: string) => ({user_id: userId, is_temporary: false, note: null, assigned_at: daysAgo(10)});

const vehicle = (overrides: Partial<Omit<UsageVehicle, "holders">> & {plate?: string; holders?: ReturnType<typeof holder>[]}) => ({
  id: "v1", plate: "SFSD-012", model: "Ford Explorer", category_id: "explorer", game_id: null, station: "Downtown", callsign: null,
  license_name: null, capacity: 2, shared_label: null, allowed_units: null, min_rank: null, is_unmarked: false, registration_required: true,
  registration_expires_on: null, notes: null, is_active: true, created_at: daysAgo(100), updated_at: daysAgo(1),
  holders: [] as ReturnType<typeof holder>[], ...overrides,
});

const vehicles = [
  vehicle({holders: [holder("a"), holder("b")]}),
  vehicle({id: "v2", plate: "SFSD-015", model: "Ford Crown Victoria", created_at: daysAgo(200)}),
  vehicle({id: "v3", plate: "MU-001", model: "Ambulance", category_id: "mu", capacity: null, holders: [holder("c")]}),
  vehicle({id: "v4", plate: "MU-002", model: "Ambulance", category_id: "mu", capacity: null, shared_label: "Medical Unit"}),
  vehicle({id: "v5", plate: "OLD-001", model: "Mercedes Arocs", category_id: null, capacity: 1, created_at: daysAgo(50)}),
];

const request = (id: string, type: string, status: "pending" | "approved" | "rejected", age: number) => ({
  id, user_id: "u", vehicle_type: type, vehicle_plate: null, reason: "Járőrözéshez", status, created_at: daysAgo(age), updated_at: daysAgo(age),
});

const requests = [
  request("r1", "Ford Explorer", "pending", 3), request("r2", "Ford Explorer", "pending", 5), request("r3", "Ford Explorer", "rejected", 20),
  request("r4", "ford  explorer", "approved", 40), request("r5", "Buffalo STX", "pending", 1), request("r6", "Mercedes Arocs", "pending", 120),
];

test.describe("fleet utilisation", () => {
  test("keys against the limits, idle and full vehicles, shared pools apart", () => {
    const usage = fleetUsage(vehicles, categories, requests, {now: NOW});
    expect(usage.totals).toMatchObject({vehicles: 5, keys: 3, capacity: 5, limitedKeys: 2, utilisation: 0.4, unused: 2, full: 1, shared: 1});
    expect(usage.categories.map((group) => [group.category?.id ?? null, group.utilisation, group.unused, group.full, group.shared])).toEqual([
      ["explorer", 0.5, 1, 1, 0], ["mu", null, 0, 0, 1], [null, 0, 1, 0, 0],
    ]);
    // The longest in stock first; the shared ambulance is never "idle".
    expect(usage.idle.map((item) => item.id)).toEqual(["v2", "v5"]);
    expect(usage.saturated.map((item) => item.id)).toEqual(["v1"]);
  });

  test("requested models of the last 90 days against the stock", () => {
    const usage = fleetUsage(vehicles, categories, requests, {now: NOW});
    expect(usage.requestCount).toBe(5);
    expect(usage.demand).toEqual([
      {model: "Ford Explorer", requests: 4, pending: 2, approved: 1, rejected: 1, stock: 1, freeKeys: 0, status: "full"},
      {model: "Buffalo STX", requests: 1, pending: 1, approved: 0, rejected: 0, stock: 0, freeKeys: 0, status: "missing"},
    ]);
    expect(modelKey("  Dodge Charger SRT  2012 ")).toBe("dodge charger srt 2012");
    expect(modelKey("Rendőrségi hajó")).toBe("rendorsegi hajo");
  });

  test("the staff see the utilisation tab computed from the loaded data", async ({page}) => {
    const mock = await mockSupabase(page, {
      tables: {
        fleet_vehicles: vehicles, fleet_categories: categories,
        vehicle_requests: requests.map((item) => ({...item, created_at: new Date(Date.now() - (NOW - Date.parse(item.created_at))).toISOString()})),
      },
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/logistics?tab=fleet");
    await page.getByRole("button", {name: /Kihasználtság/}).click();

    const panel = page.locator("[data-tour=fleet-usage]");
    await expect(panel.getByText("40%", {exact: true})).toBeVisible();
    await expect(panel.locator("li", {hasText: "Buffalo STX"})).toContainText("Nincs a járműparkban");
    await expect(panel.locator("li", {hasText: "Ford Explorer"}).filter({hasText: "igénylés"})).toContainText("Minden kulcs kiadva");
    await expect(panel.getByText("OLD-001")).toBeVisible();
    // No extra request: the stock and the requests were loaded by the page already.
    const reads = mock.requests.filter((item) => item.kind === "rest" && ["fleet_vehicles", "vehicle_requests"].includes(item.name)).length;
    expect(reads).toBe(2);

    // A category opens its vehicles.
    await panel.getByRole("button", {name: /Medical Unit \[MU\]/}).click();
    await expect(page).not.toHaveURL(/view=usage/);
    await expect(page.getByText("MU-002")).toBeVisible();
    await expect(page.getByText("SFSD-012")).toHaveCount(0);
  });

  test("members do not get the utilisation tab", async ({page}) => {
    await mockSupabase(page, {
      tables: {profiles: [testProfile({faction_rank: "Deputy Sheriff II.", system_role: "user"})], fleet_vehicles: vehicles, fleet_categories: categories},
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/logistics?tab=fleet&view=usage");
    await expect(page.locator("[data-tour=fleet-list]")).toBeVisible();
    await expect(page.getByRole("button", {name: /Kihasználtság/})).toHaveCount(0);
  });
});
