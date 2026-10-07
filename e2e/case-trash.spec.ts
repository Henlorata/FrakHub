import {expect, test} from "@playwright/test";
import {login, mockSupabase, TEST_USER_ID} from "./support/mock-supabase";

const CASE_ID = "22222222-2222-4222-8222-222222222222";
const NOW = "2026-10-07T12:00:00Z";

const detail = {
  case: {
    id: CASE_ID, case_number: "SD-192/007/261001", title: "Éjszakai Bagoly", description: "Fegyvercsempészet a kikötőben.", status: "open",
    priority: "high", category: "weapons", theme: "default", owner_id: TEST_USER_ID, created_at: NOW, updated_at: NOW, closed_at: null,
    body_version: 1, body_updated_by: TEST_USER_ID, body_updated_by_name: "John Doe",
    body: [{id: "b1", type: "paragraph", props: {textColor: "default", backgroundColor: "default", textAlignment: "left"},
      content: [{type: "text", text: "Megfigyelés a dokknál.", styles: {}}], children: []}],
  },
  owner: {id: TEST_USER_ID, full_name: "John Doe", badge_number: "1192", faction_rank: "Sergeant I.", division: "MCB", division_rank: null, avatar_url: null},
  collaborators: [], evidence: [], people: [], warrants: [], tasks: [], items: [], suggestions: [],
  viewer: {role: "owner", can_edit: true, can_manage: true, is_lead: false, can_approve: false},
};

const trashed = {
  id: CASE_ID, case_number: "SD-192/007/261001", title: "Éjszakai Bagoly", status: "open", priority: "high", owner_id: TEST_USER_ID,
  owner_name: "John Doe", deleted_at: NOW, deleted_by_name: "John Doe", purge_at: new Date(Date.now() + 29 * 86_400_000).toISOString(),
  evidence: 2, people: 1, warrants: 0,
};

test.describe("the MCB's trash", () => {
  test("a case goes to the trash first and can be restored from there", async ({page}) => {
    const mock = await mockSupabase(page, {
      rpc: {get_case_detail: detail, get_case_list: [], trash_case: {purge_at: trashed.purge_at}, get_case_trash: [trashed], restore_case: null},
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/mcb/case/${CASE_ID}`);
    await expect(page.getByText("Megfigyelés a dokknál.")).toBeVisible();

    await page.getByRole("button", {name: "További műveletek"}).click();
    await page.getByRole("menuitem", {name: "Lomtárba"}).click();
    await expect(page.getByRole("alertdialog")).toContainText("30 napig visszaállítható");
    await page.getByRole("alertdialog").getByRole("button", {name: "Lomtárba"}).click();

    await expect(page).toHaveURL(/\/mcb$/);
    expect(mock.requests.find((request) => request.name === "trash_case")?.body).toEqual({_case_id: CASE_ID});

    await page.goto("/mcb/trash");
    const row = page.getByRole("listitem").filter({hasText: "SD-192/007/261001"});
    await expect(row).toContainText("2 bizonyíték");
    await expect(row).toContainText(/nap múlva törlődik/);
    await row.getByRole("button", {name: "Visszaállítás"}).click();
    await expect.poll(() => mock.requests.find((request) => request.name === "restore_case")?.body).toEqual({_case_id: CASE_ID});
    await expect(page.getByText("A lomtár üres")).toBeVisible();
  });

  test("deleting for good happens only from the trash", async ({page}) => {
    await mockSupabase(page, {rpc: {get_case_trash: [trashed], get_case_list: []}});
    let deleted: unknown = null;
    await page.route("**/api/case/delete", async (route) => {
      deleted = route.request().postDataJSON();
      await route.fulfill({json: {success: true, failedAssets: 0}});
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/mcb/trash");

    await page.getByRole("button", {name: "Végleges törlés"}).click();
    await page.getByRole("alertdialog").getByRole("button", {name: "Végleges törlés"}).click();
    await expect.poll(() => deleted).toEqual({caseId: CASE_ID});
    await expect(page.getByText("A lomtár üres")).toBeVisible();
  });
});
