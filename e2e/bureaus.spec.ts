import {expect, test} from "@playwright/test";
import {login, mockSupabase, testProfile} from "./support/mock-supabase";

const CATALOG = {
  ranks: [
    {id: "r1", division: "SEB", name: "Operator III.", sort_order: 1, privileged: false},
    {id: "r2", division: "SEB", name: "Operator II.", sort_order: 2, privileged: false},
    {id: "r3", division: "SEB", name: "Operator I.", sort_order: 3, privileged: false},
    {id: "r4", division: "MCB", name: "Investigator III.", sort_order: 1, privileged: true},
    {id: "r5", division: "MCB", name: "Investigator II.", sort_order: 2, privileged: false},
  ],
  titles: [
    {id: "t1", division: "SEB", name: "Medic", icon: "heart-pulse", tone: "rose", description: null, sort_order: 1},
    {id: "t2", division: "SEB", name: "Marksman", icon: "crosshair", tone: "amber", description: null, sort_order: 2},
  ],
};

test("a Bureau Commander edits the ranks of their own division only", async ({page}) => {
  const mock = await mockSupabase(page, {
    tables: {profiles: [testProfile({faction_rank: "Lieutenant I.", system_role: "admin", division: "SEB", division_rank: "Operator III.",
      is_bureau_commander: true})]},
    rpc: {get_bureau_catalog: CATALOG, save_division_rank: {id: "r9", division: "SEB", name: "Team Leader", sort_order: 4, privileged: false}},
  });
  await login(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/hr?tab=bureaus");

  await expect(page.getByText("Marksman").first()).toBeVisible();
  // One editable card (SEB); MCB and TSB are shown read-only.
  await expect(page.getByText("Szerkeszthető")).toHaveCount(1);
  await expect(page.getByPlaceholder("Új rang, pl. Team Leader")).toHaveCount(1);
  await expect(page.getByRole("button", {name: "Investigator III. törlése"})).toHaveCount(0);

  await page.getByPlaceholder("Új rang, pl. Team Leader").fill("Team Leader");
  await page.getByPlaceholder("Új rang, pl. Team Leader").press("Enter");
  await expect.poll(() => mock.requests.find((request) => request.name === "save_division_rank")?.body)
    .toMatchObject({_id: null, _division: "SEB", _name: "Team Leader"});
});
