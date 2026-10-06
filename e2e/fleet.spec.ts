import {expect, test, type Request} from "@playwright/test";
import {login, mockSupabase, TEST_USER_ID, testProfile} from "./support/mock-supabase";

const DEPUTY_ID = "22222222-2222-4222-8222-222222222222";
const TRAINEE_ID = "33333333-3333-4333-8333-333333333333";
const NOW = new Date().toISOString();
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const viewer = testProfile({faction_rank: "Captain II.", system_role: "admin"});
const deputy = testProfile({
  id: DEPUTY_ID, full_name: "Deputy Dénes", badge_number: "2001", faction_rank: "Deputy Sheriff II.", system_role: "user",
});
const trainee = testProfile({
  id: TRAINEE_ID, full_name: "Újonc Ubul", badge_number: "2002", faction_rank: "Deputy Sheriff Trainee", system_role: "user",
});

const categories = [
  {id: "explorer", name: "Marked Ford Explorer", description: null, unit: null, min_rank: null, tone: "orange", sort_order: 20},
  {id: "seb", name: "Special Enforcement Bureau [SEB]", description: null, unit: "SEB", min_rank: null, tone: "slate", sort_order: 90},
];

const vehicle = (overrides: Record<string, unknown>) => ({
  id: "v1", plate: "SFSD-012", model: "Ford Explorer", category_id: "explorer", game_id: 250562, station: "Downtown", callsign: null,
  license_name: null, capacity: 2, shared_label: null, allowed_units: null, min_rank: null, is_unmarked: false, registration_required: true,
  registration_expires_on: inDays(2), notes: null, is_active: true, created_at: NOW, updated_at: NOW, holders: [], ...overrides,
});

const holder = (userId: string) => ({user_id: userId, is_temporary: false, note: null, assigned_at: NOW});

const fleet = [
  vehicle({holders: [holder(DEPUTY_ID), holder(TEST_USER_ID)]}),
  vehicle({id: "v2", plate: "SFSD-015", game_id: 250565, registration_expires_on: null}),
  vehicle({id: "v3", plate: "SEB-004", model: "Chevrolet Tahoe Unmarked", category_id: "seb", is_unmarked: true}),
];

const posted = (request: Request, path: string) => request.url().includes(path) && request.method() === "POST";

test.describe("fleet", () => {
  test("one vehicle warning decision covers several people and several points", async ({page}) => {
    await mockSupabase(page, {
      tables: {
        profiles: [viewer, deputy, trainee], fleet_vehicles: fleet, fleet_categories: categories,
        vehicle_warnings: ["Parkolás", "Sérülés"].map((reason, index) => ({
          id: `w${index}`, vehicle_id: "v1", plate: "SFSD-012", user_id: DEPUTY_ID, reason, issued_by: TEST_USER_ID, batch_id: `b${index}`,
          created_at: NOW, revoked_at: null, revoked_by: null, converted_record_id: null,
        })),
      },
    });
    const bodies: unknown[] = [];
    page.on("request", (request) => {
      if (posted(request, "/rest/v1/vehicle_warnings")) bodies.push(request.postDataJSON());
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/logistics?tab=fleet");

    await page.getByRole("button", {name: "Hibapont", exact: true}).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder(/szabálytalan parkolás/).fill("Összetört jármű bevetés után");
    await dialog.getByRole("button", {name: /Súlyos eset/}).click();
    await dialog.getByPlaceholder(/Rendszám, típus/).fill("SFSD-012");
    await dialog.getByRole("button", {name: /SFSD-012/}).click();
    // The vehicle's holders are added (the viewer is not: nobody warns themselves).
    await expect(dialog.getByText("Deputy Dénes")).toBeVisible();
    await expect(dialog.getByText("figyelmeztetés lesz")).toBeVisible();
    await dialog.getByRole("button", {name: "Személy"}).click();
    await dialog.getByPlaceholder(/Név vagy jelvényszám/).fill("Újonc");
    await dialog.getByRole("option", {name: /Újonc Ubul/}).click();
    await dialog.getByRole("button", {name: /^Rögzítés \(2 fő × 2 pont\)/}).click();

    await expect(page.getByText("Hibapont rögzítve 2 főnek.")).toBeVisible();
    expect(bodies).toHaveLength(1);
    const rows = bodies[0] as {user_id: string; vehicle_id: string | null; batch_id: string; reason: string}[];
    expect(rows).toHaveLength(4);
    expect(new Set(rows.map((row) => row.batch_id)).size).toBe(1);
    expect(rows.filter((row) => row.user_id === DEPUTY_ID && row.vehicle_id === "v1")).toHaveLength(2);
    expect(rows.filter((row) => row.user_id === TRAINEE_ID)).toHaveLength(2);
  });

  test("on a vehicle's page the warning is about that vehicle", async ({page}) => {
    await mockSupabase(page, {
      tables: {
        profiles: [viewer, deputy, trainee], fleet_vehicles: fleet, fleet_categories: categories,
        vehicle_warnings: [{id: "w0", vehicle_id: "v2", plate: "SFSD-015", user_id: DEPUTY_ID, reason: "Parkolás", issued_by: TEST_USER_ID,
          batch_id: "b0", created_at: NOW, revoked_at: null, revoked_by: null, converted_record_id: null}],
      },
    });
    const bodies: unknown[] = [];
    page.on("request", (request) => {
      if (posted(request, "/rest/v1/vehicle_warnings")) bodies.push(request.postDataJSON());
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/logistics/fleet/v1");

    await page.getByRole("button", {name: "Hibapont", exact: true}).click();
    const dialog = page.getByRole("dialog");
    // The vehicle is set; its holder is listed, the viewer (also a holder) is not: nobody warns themselves.
    await expect(dialog.getByText("Ford Explorer").first()).toBeVisible();
    await expect(dialog.getByText("Deputy Dénes")).toBeVisible();
    await expect(dialog.getByText(/Nem kerültek a listára/)).toContainText(String(viewer.full_name));
    // Points count across every vehicle (the warning above is on another one).
    await expect(dialog.getByText("→ 2/3")).toBeVisible();

    // Anyone added later is recorded with this vehicle too.
    await dialog.getByRole("button", {name: "Személy"}).click();
    await dialog.getByPlaceholder(/Név vagy jelvényszám/).fill("Újonc");
    await dialog.getByRole("option", {name: /Újonc Ubul/}).click();
    await dialog.getByPlaceholder(/szabálytalan parkolás/).fill("Sérülten leadott jármű");
    await dialog.getByRole("button", {name: /^Rögzítés \(2 fő × 1 pont\)/}).click();

    await expect(page.getByText("Hibapont rögzítve 2 főnek.")).toBeVisible();
    const rows = bodies[0] as {user_id: string; vehicle_id: string | null; plate: string | null}[];
    expect(rows.map((row) => [row.user_id, row.vehicle_id, row.plate])).toEqual([
      [DEPUTY_ID, "v1", "SFSD-012"], [TRAINEE_ID, "v1", "SFSD-012"],
    ]);
  });

  test("categories are added and deleted; a deleted category's vehicles move or go with it", async ({page}) => {
    const mock = await mockSupabase(page, {
      tables: {profiles: [viewer, deputy], fleet_vehicles: fleet, fleet_categories: categories},
      rpc: {fleet_delete_category: (args: {_move_to: string | null}) => ({moved: args._move_to ? 2 : 0, deleted: args._move_to ? 0 : 2})},
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/logistics?tab=fleet");
    await page.getByRole("button", {name: "Kategóriák"}).click();
    const dialog = page.getByRole("dialog");

    await dialog.getByRole("button", {name: "Új kategória"}).click();
    await dialog.getByLabel("Név").fill("Különleges Járművek");
    await dialog.getByRole("button", {name: "Mentés"}).click();
    await expect(page.getByText("„Különleges Járművek” kategória létrehozva.")).toBeVisible();
    const insert = mock.requests.find((request) => request.kind === "rest" && request.name === "fleet_categories" && request.method === "POST");
    expect(insert?.body).toMatchObject({id: "kulonleges-jarmuvek", name: "Különleges Járművek", unit: null, tone: "orange"});

    // Two vehicles in "Marked Ford Explorer": they move to the chosen category.
    await dialog.getByRole("button", {name: "Marked Ford Explorer törlése"}).click();
    await expect(dialog.getByText("2 jármű", {exact: false}).first()).toBeVisible();
    await dialog.getByRole("button", {name: "Kategória törlése"}).click();
    await page.getByRole("alertdialog").getByRole("button", {name: "Törlés"}).click();
    await expect(page.getByText("Kategória törölve.")).toBeVisible();
    expect(mock.requests.find((request) => request.name === "fleet_delete_category")?.body)
      .toEqual({_category_id: "explorer", _move_to: "seb"});
  });

  test("assigning shows who holds each vehicle and which ones cannot be given", async ({page}) => {
    const mock = await mockSupabase(page, {tables: {profiles: [viewer, deputy, trainee], fleet_vehicles: fleet, fleet_categories: categories}});
    const bodies: unknown[] = [];
    page.on("request", (request) => {
      if (posted(request, "/rest/v1/fleet_assignments")) bodies.push(request.postDataJSON());
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/logistics?tab=fleet");
    await expect(page.getByRole("link", {name: /SFSD-015/})).toBeVisible();
    // The stock, its categories, the member list and the open reviews: no request per vehicle.
    expect(mock.count("rest", "fleet_vehicles")).toBe(1);
    expect(mock.count("rest", "fleet_categories")).toBe(1);

    await page.getByRole("button", {name: "Kiosztás"}).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder(/Név vagy jelvényszám/).fill("Újonc");
    await dialog.getByRole("option", {name: /Újonc Ubul/}).click();
    await dialog.getByRole("switch").first().click(); // show full vehicles too
    const full = dialog.getByRole("button", {name: /SFSD-012/});
    await expect(full).toContainText("Deputy Dénes");
    await expect(full).toContainText("Nincs szabad kulcs.");
    await expect(full).toBeDisabled();
    await expect(dialog.getByRole("button", {name: /SEB-004/})).toContainText("Csak SEB tagoknak.");
    await dialog.getByRole("button", {name: /SFSD-015/}).click();
    await dialog.getByRole("button", {name: /^Kiosztás \(1\)/}).click();

    await expect(page.getByText("Újonc Ubul: 1 jármű kiosztva.")).toBeVisible();
    expect(bodies).toEqual([[{vehicle_id: "v2", user_id: TRAINEE_ID, is_temporary: false}]]);
  });

  test("without the recognition engine a licence goes to review with its picture", async ({page}) => {
    const holderProfile = testProfile({faction_rank: "Deputy Sheriff II.", system_role: "user"});
    const mock = await mockSupabase(page, {
      tables: {
        profiles: [holderProfile], fleet_vehicles: [vehicle({holders: [holder(TEST_USER_ID)]})], fleet_categories: categories,
        fleet_registration_requests: [],
      },
      rpc: {
        get_hr_registry: {details: [], duty: [], vehicle_warnings: [], bank_accounts: [], vehicles: [{
          id: "v1", plate: "SFSD-012", model: "Ford Explorer", category_id: "explorer", callsign: null, registration_expires_on: inDays(2),
          registration_required: true, is_unmarked: false, shared_label: null, holder_ids: [TEST_USER_ID], pending_review: false,
        }]},
        fleet_registration_submit: {id: "r1", vehicle_id: "v1", status: "pending", submitted_by: TEST_USER_ID, created_at: NOW},
      },
    });
    const submits: Record<string, unknown>[] = [];
    const cdn: string[] = [];
    page.on("request", (request) => {
      if (posted(request, "/rest/v1/rpc/fleet_registration_submit")) submits.push(request.postDataJSON() as Record<string, unknown>);
    });
    // The engine's files (jsDelivr) are blocked like every other outside request.
    page.on("requestfinished", (request) => {
      if (request.url().includes("cdn.jsdelivr.net")) cdn.push(request.url());
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/profile");
    await page.locator("li", {hasText: "SFSD-012"}).getByRole("button", {name: /Forgalmi frissítése/}).click();

    const dialog = page.getByRole("dialog");
    // Any picture will do: the CDN of the recognition engine is unreachable in tests.
    await dialog.locator("input[type=file]").setInputFiles({
      name: "forgalmi.png", mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"),
    });
    // Nothing to recognise (or no engine at all): the picture goes to review.
    await expect(dialog.getByRole("button", {name: "Ellenőrzésre küldöm"})).toBeVisible({timeout: 30_000});
    await dialog.getByRole("button", {name: "Ellenőrzésre küldöm"}).click();
    await dialog.getByPlaceholder(/csak rosszul olvasta/).fill("A forgalmi 2026.11.20-ig érvényes.");
    await dialog.getByRole("button", {name: "Ellenőrzésre küldöm"}).click();

    await expect(dialog.getByText("Elküldve ellenőrzésre")).toBeVisible();
    expect(mock.count("storage")).toBeGreaterThanOrEqual(1);
    expect(submits).toHaveLength(1);
    expect(submits[0]).toMatchObject({_vehicle_id: "v1", _source: "not_detected", _note: "A forgalmi 2026.11.20-ig érvényes."});
    expect(String(submits[0]._image_path)).toMatch(new RegExp(`^${TEST_USER_ID}_v1_[0-9a-f]{8}\\.(webp|png)$`));
    expect(cdn).toEqual([]);
  });
});
