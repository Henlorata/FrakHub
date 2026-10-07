import {expect, test} from "@playwright/test";
import {login, mockSupabase} from "./support/mock-supabase";

test("the MCB's organisation register lists the organisations and opens one", async ({page}) => {
  await mockSupabase(page, {
    rpc: {
      get_organizations: [{
        id: "o1", name: "Grove Street Families", kind: "gang", status: "active", threat: "high", color: "#16a34a", logo_url: null,
        territory: "Ganton", updated_at: "2026-10-06T10:00:00Z", members: 4, leaders: ["Sean Johnson"], wanted: 1, open_cases: 2, last_note_at: null,
      }, {
        id: "o2", name: "Régi banda", kind: "crew", status: "dismantled", threat: "low", color: null, logo_url: null,
        territory: null, updated_at: "2026-09-01T10:00:00Z", members: 0, leaders: [], wanted: 0, open_cases: 0, last_note_at: null,
      }],
      get_organization: {
        organization: {id: "o1", name: "Grove Street Families", kind: "gang", status: "active", threat: "high", color: "#16a34a", logo_url: null,
          territory: "Ganton", description: "Zöld színek.", created_at: "2026-10-01T10:00:00Z", updated_at: "2026-10-06T10:00:00Z",
          created_by_name: "John Doe", updated_by_name: null, can_delete: false},
        members: [{suspect_id: "s1", full_name: "Sean Johnson", alias: "Sweet", status: "wanted", mugshot_url: null, role: "leader", note: null,
          added_at: "2026-10-01T10:00:00Z", wanted: true}],
        notes: [{id: "n1", body: "A Grove Streeten gyülekeznek esténként.", source: "járőr", created_at: "2026-10-06T19:00:00Z",
          created_by: null, created_by_name: "John Doe", can_delete: false}],
        cases: [], vehicles: [], properties: [], warrants: [],
      },
    },
  });
  await login(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/mcb/organizations");

  // Active ones by default; the dismantled one is a filter away.
  await expect(page.getByText("Grove Street Families")).toBeVisible();
  await expect(page.getByText("Régi banda")).toHaveCount(0);
  await expect(page.getByText(/Vezető:.*Sean Johnson/)).toBeVisible();
  await page.getByRole("tab", {name: "Felszámolva"}).click();
  await expect(page.getByText("Régi banda")).toBeVisible();
  await page.getByRole("tab", {name: "Aktív"}).click();

  await page.getByText("Grove Street Families").click();
  await expect(page).toHaveURL(/\/mcb\/organizations\/o1$/);
  await expect(page.getByText("Hírszerzési napló")).toBeVisible();
  await expect(page.getByText("A Grove Streeten gyülekeznek esténként.")).toBeVisible();
  await expect(page.getByText("Sean Johnson").first()).toBeVisible();
});
