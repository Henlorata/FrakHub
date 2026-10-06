import {expect, test} from "@playwright/test";
import {login, mockSupabase, TEST_USER_ID, testProfile} from "./support/mock-supabase";

const NOW = "2026-10-01T12:00:00Z";
const CASE_ID = "22222222-2222-4222-8222-222222222222";

const props = {textColor: "default", backgroundColor: "default", textAlignment: "left"};
const paragraph = (text: string) => ({type: "paragraph", props, content: [{type: "text", text, styles: {}}], children: []});

const template = (overrides: Record<string, unknown>) => ({
  id: "t1", kind: "document", label: "Körözési akta", description: "Körözött személy adatai", icon: "siren", aliases: [],
  blocks: [paragraph("Körözés oka:")], sort_order: 10, updated_at: NOW, ...overrides,
});

const templates = [
  template({}),
  template({id: "t2", label: "Helyszíni szemle", description: "Jegyzőkönyv a helyszínről", icon: "clipboard", blocks: [paragraph("Szemle helye:")], sort_order: 20}),
  template({id: "s1", kind: "snippet", label: "Gyanúsított adatlap", description: "Személyleírás", icon: "shield", aliases: ["gyanusitott"],
    blocks: [paragraph("Személyleírás:")]}),
];

const investigator = testProfile({division: "MCB", division_rank: "Investigator II."});
const manager = testProfile({faction_rank: "Commander", system_role: "admin", is_bureau_manager: true});

test.describe("case templates", () => {
  test("a new case starts from the leadership's templates (one read)", async ({page}) => {
    const mock = await mockSupabase(page, {tables: {profiles: [investigator], case_templates: templates}, rpc: {get_case_list: []}});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/mcb?new=case");

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", {name: /Körözési akta/})).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.getByRole("button", {name: /Üres akta/})).toBeVisible();
    // Snippets belong to the editor's "/" menu, not to the starting documents.
    await expect(dialog.getByText("Gyanúsított adatlap")).toHaveCount(0);

    await dialog.getByRole("button", {name: /Helyszíni szemle/}).click();
    await dialog.getByLabel("Megnevezés / fedőnév").fill("Raktártűz");
    await dialog.getByRole("button", {name: "Akta megnyitása"}).click();

    await expect.poll(() => mock.requests.find((request) => request.name === "cases" && request.method === "POST")?.body)
      .toMatchObject({title: "Raktártűz", body: [paragraph("Szemle helye:")]});
    expect(mock.count("rest", "case_templates")).toBe(1);
  });

  test("the starter templates are offered when the list cannot be loaded", async ({page}) => {
    await mockSupabase(page, {tables: {profiles: [investigator]}, rpc: {get_case_list: []}});
    await page.route("**/rest/v1/case_templates*", (route) => route.fulfill({status: 500, json: {message: "boom"}}));
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/mcb?new=case");

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", {name: /Nyomozati akta/})).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.getByRole("button", {name: /Kihallgatási jegyzőkönyv/})).toBeVisible();
  });

  test("the editor's \"/\" menu offers the stored snippets", async ({page}) => {
    await mockSupabase(page, {
      tables: {profiles: [investigator], case_templates: templates},
      rpc: {
        get_case_list: [],
        get_case_detail: {
          case: {id: CASE_ID, case_number: "SD-192/007/261001", title: "Éjszakai Bagoly", description: null, status: "open", priority: "high",
            category: null, theme: "default", owner_id: TEST_USER_ID, created_at: NOW, updated_at: NOW, closed_at: null, body_version: 1,
            body_updated_by: TEST_USER_ID, body_updated_by_name: "John Doe", body: [paragraph("Megfigyelés a dokknál.")]},
          owner: {id: TEST_USER_ID, full_name: "John Doe", badge_number: "1192", faction_rank: "Sergeant I.", division: "MCB",
            division_rank: "Investigator II.", avatar_url: null},
          collaborators: [], evidence: [], people: [], warrants: [],
          viewer: {role: "owner", can_edit: true, can_manage: true, is_lead: false, can_approve: true},
        },
      },
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/mcb/case/${CASE_ID}`);
    await page.getByText("Megfigyelés a dokknál.").click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/gyanus");
    await expect(page.getByText("Gyanúsított adatlap")).toBeVisible();
  });

  test("the MCB leadership edits and reorders the templates", async ({page}) => {
    const mock = await mockSupabase(page, {tables: {profiles: [manager], case_templates: templates}, rpc: {reorder_case_templates: null}});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/mcb/templates");

    const list = page.locator("[data-tour=templates-list]");
    await list.getByRole("button", {name: "Körözési akta lejjebb"}).click();
    await expect.poll(() => mock.requests.find((request) => request.name === "reorder_case_templates")?.body).toEqual({_ids: ["t2", "t1"]});

    await list.getByRole("button", {name: /Körözési akta/}).first().click();
    await page.getByLabel("Név").fill("Körözési adatlap");
    await page.getByRole("button", {name: "Mentés"}).click();
    await expect(page.getByText("Sablon mentve.")).toBeVisible();
    const update = mock.requests.find((request) => request.name === "case_templates" && request.method === "PATCH");
    expect(update?.url).toContain("id=eq.t1");
    expect(update?.body).toMatchObject({label: "Körözési adatlap", icon: "siren", aliases: []});
  });

  test("other members of the case area cannot open the template library", async ({page}) => {
    await mockSupabase(page, {tables: {profiles: [investigator], case_templates: templates}, rpc: {get_case_list: []}});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/mcb/templates");
    await expect(page).toHaveURL(/\/mcb$/);
    await expect(page.locator("[data-tour=mcb-nav]").getByRole("link", {name: "Sablonok"})).toHaveCount(0);
  });
});
