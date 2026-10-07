import {expect, test} from "@playwright/test";
import {login, mockSupabase, TEST_USER_ID, testProfile} from "./support/mock-supabase";

const CASE_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_ID = "55555555-5555-4555-8555-555555555555";
const SUSPECT_ID = "66666666-6666-4666-8666-666666666666";
const NOW = "2026-10-01T12:00:00Z";

const caseDetail = (overrides: {status?: string; viewer?: Record<string, unknown>} = {}) => ({
  case: {
    id: CASE_ID, case_number: "SD-192/007/261001", title: "Éjszakai Bagoly", description: "Fegyvercsempészet a kikötőben.",
    status: overrides.status ?? "open", priority: "high", category: "weapons", theme: "default", owner_id: TEST_USER_ID,
    created_at: NOW, updated_at: NOW, closed_at: overrides.status === "closed" ? NOW : null, body_version: 3,
    body_updated_by: TEST_USER_ID, body_updated_by_name: "John Doe",
    body: [{id: "b1", type: "paragraph", props: {textColor: "default", backgroundColor: "default", textAlignment: "left"},
      content: [{type: "text", text: "Megfigyelés a dokknál.", styles: {}}], children: []}],
  },
  owner: {id: TEST_USER_ID, full_name: "John Doe", badge_number: "1192", faction_rank: "Sergeant I.", division: "MCB",
    division_rank: "Investigator II.", avatar_url: null},
  collaborators: [],
  evidence: [],
  people: [{id: "l1", case_id: CASE_ID, suspect_id: SUSPECT_ID, involvement_type: "suspect", notes: null, added_at: NOW,
    suspect: {id: SUSPECT_ID, full_name: "Tony Montana", alias: "Scarface", status: "free", mugshot_url: null, gang_affiliation: null,
      gender: "male", description: null, created_by: TEST_USER_ID, created_at: NOW, updated_at: NOW}}],
  warrants: [],
  viewer: {role: "owner", can_edit: overrides.status !== "closed", can_manage: true, is_lead: false, can_approve: true, ...overrides.viewer},
});

test.describe("MCB", () => {
  test("a save reports someone else's newer version instead of overwriting it", async ({page}) => {
    let saves = 0;
    const mock = await mockSupabase(page, {
      rpc: {
        get_case_detail: caseDetail(),
        get_case_list: [],
        save_case_document: () => {
          saves += 1;
          return saves === 1
            ? {ok: false, conflict: true, version: 5, updated_at: NOW, updated_by_name: "Nyomozó Nándor"}
            : {ok: true, version: 6, updated_at: NOW};
        },
      },
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/mcb/case/${CASE_ID}`);
    await expect(page.getByText("Megfigyelés a dokknál.")).toBeVisible();

    await page.getByText("Megfigyelés a dokknál.").click();
    await page.keyboard.press("End");
    await page.keyboard.type(" Új megállapítás.");
    await page.getByRole("button", {name: "Mentés", exact: true}).click();

    await expect(page.getByText(/közben mentett az aktába/)).toBeVisible();
    const first = mock.requests.find((request) => request.name === "save_case_document");
    expect(first?.body?._base_version).toBe(3);
    expect(JSON.stringify(first?.body?._body)).toContain("Új megállapítás.");

    await page.getByRole("button", {name: "Felülírom a sajátommal"}).click();
    await expect(page.getByText(/^Mentve/)).toBeVisible();
    const second = mock.requests.filter((request) => request.name === "save_case_document")[1];
    expect(second?.body?._base_version).toBe(5);
  });

  test("Ctrl+S saves the document", async ({page}) => {
    const mock = await mockSupabase(page, {
      rpc: {get_case_detail: caseDetail(), get_case_list: [], save_case_document: {ok: true, version: 4, updated_at: NOW}},
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/mcb/case/${CASE_ID}`);

    await page.getByText("Megfigyelés a dokknál.").click();
    await page.keyboard.press("End");
    await page.keyboard.type(" Gyorsmentés.");
    await expect(page.getByText("Mentetlen módosítások")).toBeVisible();
    await page.keyboard.press("Control+s");
    await expect.poll(() => mock.count("rpc", "save_case_document")).toBe(1);
    await expect(page.getByText(/^Mentve/)).toBeVisible();
  });

  test("a closed case is read-only and can be reopened by its owner", async ({page}) => {
    await mockSupabase(page, {rpc: {get_case_detail: caseDetail({status: "closed"}), get_case_list: []}});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/mcb/case/${CASE_ID}`);

    await expect(page.getByText(/Csak olvasható/)).toBeVisible();
    await expect(page.getByRole("button", {name: "Mentés", exact: true})).toHaveCount(0);
    await expect(page.getByRole("button", {name: /Újranyitás/})).toBeVisible();
    await page.getByRole("tab", {name: /Üzenetek/}).click();
    await expect(page.getByText(/a csatorna csak olvasható/)).toBeVisible();
  });

  test("approvers decide requests from the case list, never their own", async ({page}) => {
    const warrant = (id: string, requestedBy: string, target: string) => ({
      id, case_id: CASE_ID, type: "arrest", status: "pending", reason: "Fegyvercsempészet gyanúja", description: null, suspect_id: null,
      property_id: null, target_name: target, requested_by: requestedBy, approved_by: null, created_at: NOW, updated_at: NOW,
      requester: {full_name: "Nyomozó Nándor", badge_number: "1006"}, approver: null, suspect: null, property: null,
      case: {id: CASE_ID, case_number: "SD-192/007/261001", title: "Éjszakai Bagoly", status: "open"},
    });
    const mock = await mockSupabase(page, {
      tables: {case_warrants: [warrant("w1", OTHER_ID, "Tony Montana"), warrant("w2", TEST_USER_ID, "Manny Ribera")]},
      rpc: {get_case_list: [], decide_warrant: (args: {_warrant_id: string}) => ({...warrant(args._warrant_id, OTHER_ID, "Tony Montana"),
        status: "approved"})},
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/mcb");

    const own = page.locator("li", {hasText: "Manny Ribera"});
    await expect(own.getByRole("button", {name: /Jóváhagyás/})).toBeDisabled();
    await page.locator("li", {hasText: "Tony Montana"}).getByRole("button", {name: /Jóváhagyás/}).click();
    await expect.poll(() => mock.requests.find((request) => request.name === "decide_warrant")?.body)
      .toMatchObject({_warrant_id: "w1", _status: "approved"});
  });

  test("a person's file opens with one call", async ({page}) => {
    const person = {id: SUSPECT_ID, full_name: "Tony Montana", alias: "Scarface", status: "wanted", mugshot_url: null, gang_affiliation: "Kikötői Banda",
      gender: "male", description: "Sebhely a bal arcán.", created_by: TEST_USER_ID, created_at: NOW, updated_at: NOW};
    const mock = await mockSupabase(page, {
      tables: {suspects: [person], case_suspects: []},
      rpc: {
        get_suspect_dossier: {suspect: person, creator_name: "John Doe",
          vehicles: [{id: "v1", suspect_id: SUSPECT_ID, plate_number: "SCAR01", vehicle_type: "Infernus", color: "fehér", notes: null, created_at: NOW}],
          properties: [], associates: [], linked_by: [], cases: [], warrants: []},
      },
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/mcb/suspects");

    await expect(page.getByText("Körözési lista")).toBeVisible();
    await page.getByRole("button", {name: /Tony Montana/}).last().click();
    await expect(page.getByText("Sebhely a bal arcán.")).toBeVisible();
    await page.getByRole("button", {name: /Járművek, ingatlanok/}).click();
    await expect(page.getByText("SCAR01")).toBeVisible();
    expect(mock.count("rpc", "get_suspect_dossier")).toBe(1);
  });

  test("the leadership page shows the workload from one call", async ({page}) => {
    const mock = await mockSupabase(page, {
      tables: {profiles: [testProfile({faction_rank: "Commander", system_role: "admin", is_bureau_manager: true})]},
      rpc: {
        get_mcb_overview: {
          viewer: {is_lead: true},
          totals: {open: 4, closed: 9, archived: 1, critical: 1, opened_30d: 3, closed_30d: 2, avg_close_days: 6.5, warrants_pending: 1,
            warrants_active: 2, wanted: 1, suspects: 30},
          monthly: [{month: "2026-09", opened: 2, closed: 1}, {month: "2026-10", opened: 3, closed: 2}],
          categories: [{category: "weapons", open: 2, total: 5}],
          members: [{id: OTHER_ID, full_name: "Nyomozó Nándor", badge_number: "1006", faction_rank: "Corporal", division: "MCB",
            division_rank: "Investigator III.", avatar_url: null, system_role: "user", is_bureau_commander: false, is_bureau_manager: false,
            open_owned: 3, critical_owned: 1, closed_owned: 7, closed_90d: 2, collaborations: 1, evidence_30d: 4, last_activity: NOW}],
          unattended: [{id: CASE_ID, case_number: "SD-192/007/261001", title: "Éjszakai Bagoly", priority: "high", updated_at: NOW,
            owner_id: null, owner_name: null, owner_division: null, reason: "no_owner"}],
          recent: [],
        },
      },
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/mcb/admin");

    await expect(page.getByRole("heading", {name: "Az iroda vezetése"})).toBeVisible();
    await expect(page.getByText("Nyomozó Nándor")).toBeVisible();
    await expect(page.getByText("Nincs tulajdonosa")).toBeVisible();
    await expect(page.getByRole("button", {name: /Átadás/})).toBeVisible();
    expect(mock.count("rpc", "get_mcb_overview")).toBe(1);
  });

  test("the letterhead stays readable in the narrow document column of a laptop", async ({page}) => {
    const detail = caseDetail();
    detail.case.body = [{id: "lh", type: "letterhead", props: {left: "", right: "mcb", title: "Major Crime’s Bureau",
      subtitle: "Detective Division", address: "San Fierro, Downtown 1257"}, content: undefined, children: []}, ...detail.case.body] as typeof detail.case.body;
    await page.setViewportSize({width: 1440, height: 900});
    await mockSupabase(page, {rpc: {get_case_detail: detail, get_case_list: []}});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/mcb/case/${CASE_ID}`);
    const title = page.locator(".letterhead-title");
    await expect(title).toHaveText("Major Crime’s Bureau");
    // Both side panels are open: the name gets the room of the column, not a strip between the logos.
    const box = (await title.boundingBox())!;
    expect(box.width).toBeGreaterThan(150);
    expect(box.height).toBeLessThan(70);
  });
});
