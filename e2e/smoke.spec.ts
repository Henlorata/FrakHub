import {expect, test} from "@playwright/test";
import {login, mockSupabase, testProfile} from "./support/mock-supabase";

/**
 * Opens every route as a high-ranking member (so admin-only UI renders too) and fails on
 * uncaught exceptions or React error screens. Data is mostly empty: this catches crashes,
 * not layout details.
 */
const ROUTES: {path: string; text: RegExp}[] = [
  {path: "/dashboard", text: /Gyors elérés/i},
  {path: "/notifications", text: /Kommunikáció/i},
  {path: "/notifications?view=settings", text: /Asztali értesítések/i},
  {path: "/reports", text: /jelentés/i},
  {path: "/hr", text: /Human Resources/i},
  {path: "/hr?tab=requests", text: /Regisztrációk/i},
  {path: "/hr?tab=history", text: /Állományváltozások/i},
  {path: "/hr?tab=stats", text: /Rendfokozatok/i},
  {path: "/mcb", text: /Major Crimes Bureau/i},
  {path: "/mcb/suspects", text: /Bűnügyi Nyilvántartás/i},
  {path: "/mcb/admin", text: /ACCESS CONTROL/i},
  {path: "/exams", text: /Képzések, vizsgák/i},
  {path: "/exams?tab=trash", text: /Törölt vizsgalapok/i},
  {path: "/exams/editor", text: /ÚJ VIZSGA LÉTREHOZÁSA/i},
  {path: "/logistics", text: /Flotta és ellátás/i},
  {path: "/logistics?tab=fleet", text: /Marked Ford Explorer/i},
  {path: "/logistics?tab=fleet&view=reviews", text: /Nincs ellenőrzésre váró forgalmi/i},
  {path: "/logistics?tab=fleet&view=warnings", text: /Jármű-hibapontok/i},
  {path: "/logistics?tab=fleet&view=tuning", text: /hivatalos tuning/i},
  {path: "/logistics/fleet/v1", text: /Kulcsosok/i},
  {path: "/finance", text: /Költségtérítések/i},
  {path: "/profile", text: /Személyi Akta/i},
  {path: "/calculator", text: /kalkulátor|büntető/i},
  {path: "/academy", text: /SFSD Academy/i},
];

test("every page renders without runtime errors", async ({page}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`${page.url()}: ${error.message}`));

  await mockSupabase(page, {
    tables: {
      profiles: [testProfile({
        faction_rank: "Commander",
        system_role: "admin",
        division: "MCB",
        division_rank: "Investigator III.",
        is_bureau_manager: true,
        qualifications: ["TB"],
      })],
      fleet_categories: [{id: "explorer", name: "Marked Ford Explorer", description: null, unit: null, min_rank: null, tone: "orange",
        sort_order: 20}],
      fleet_vehicles: [{
        id: "v1", plate: "SFSD-012", model: "Ford Explorer", category_id: "explorer", game_id: 250562, station: "Downtown",
        callsign: null, license_name: null, capacity: 2, shared_label: null, allowed_units: null, min_rank: null, is_unmarked: true,
        registration_required: true, registration_expires_on: null, notes: null, is_active: true,
        created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z", holders: [],
      }],
    },
  });
  await login(page);
  await expect(page).toHaveURL(/\/dashboard$/);

  for (const route of ROUTES) {
    await page.goto(route.path);
    await expect(page.getByText(route.text).first(), route.path).toBeVisible();
    await expect(page.getByText("Váratlan hiba történt"), route.path).toHaveCount(0);
  }

  expect(errors).toEqual([]);
});
