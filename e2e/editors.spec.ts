import {expect, test, type Page} from "@playwright/test";
import {login, mockSupabase, TEST_USER_ID, testProfile} from "./support/mock-supabase";

const CASE_ID = "22222222-2222-4222-8222-222222222222";
const EVIDENCE_ID = "33333333-3333-4333-8333-333333333333";
const PAGE_ID = "44444444-4444-4444-8444-444444444444";
const NOW = "2026-10-01T12:00:00Z";
// A 2x2 PNG, as BlockNote stores an image pasted from another document.
const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mNk+M9QzwAEjDAGNzIwAAAZ8QH/0VwBYwAAAABJRU5ErkJggg==";
const ACADEMY_OVERVIEW = {
  viewer: {instructor: false, trainee: false}, today: "2026-10-02",
  cycle: {id: "cycle-1", start_date: "2026-10-01", status: "active"},
  basic: [{day: 1, pages: 1}, {day: 2, pages: 0}, {day: 3, pages: 0}, {day: 4, pages: 0}, {day: 5, pages: 0}],
  courses: [{id: "qual_AB", title: "AB képesítés", description: null, category: "qualification", is_open: true, required_rank: null,
    linear_progression: false, pages: 1, completed: 0, readable: true, rank_ok: true}],
};

const paragraph = (id: string, content: unknown[]) => ({
  id,
  type: "paragraph",
  props: {textColor: "default", backgroundColor: "default", textAlignment: "left"},
  content,
  children: [],
});

/** Fails the test on uncaught exceptions (e.g. an editor schema mismatch after an upgrade). */
function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test.describe("rich text editors (BlockNote)", () => {
  test("a case document renders text, mentions and evidence blocks", async ({page}) => {
    const errors = collectPageErrors(page);
    const mock = await mockSupabase(page, {
      rpc: {
        get_case_detail: {
          case: {
            id: CASE_ID, case_number: "SD-192/007/261001", title: "Éjszakai Bagoly", description: "Teszt akta", status: "open",
            priority: "high", category: null, theme: "default", owner_id: TEST_USER_ID, created_at: NOW, updated_at: NOW, closed_at: null,
            body_version: 3, body_updated_by: TEST_USER_ID, body_updated_by_name: "John Doe",
            body: [
              paragraph("b1", [
                {type: "text", text: "Helyszíni szemle jegyzőkönyve ", styles: {}},
                {type: "mention", props: {user: "1192 John Doe", id: TEST_USER_ID, role: "officer"}},
              ]),
              {
                id: "b2",
                type: "evidence",
                props: {evidenceId: EVIDENCE_ID, caption: "Bejárati ajtó", layout: "side", width: "full"},
                children: [],
              },
            ],
          },
          owner: {id: TEST_USER_ID, full_name: "John Doe", badge_number: "1192", faction_rank: "Sergeant I.", division: "TSB",
            division_rank: null, avatar_url: null},
          collaborators: [],
          evidence: [{
            id: EVIDENCE_ID,
            case_id: CASE_ID,
            file_path: "https://res.cloudinary.com/e2e-cloud/image/upload/v1700000000/evidence/door.jpg",
            file_name: "door.jpg",
            file_type: "image",
            uploaded_by: TEST_USER_ID,
            uploader_name: "John Doe",
            created_at: NOW,
          }],
          people: [],
          warrants: [],
          viewer: {role: "owner", can_edit: true, can_manage: true, is_lead: false, can_approve: true},
        },
        get_case_list: [],
      },
    });

    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/mcb/case/${CASE_ID}`);

    await expect(page.getByRole("heading", {name: "Éjszakai Bagoly"})).toBeVisible();
    await expect(page.getByText("Helyszíni szemle jegyzőkönyve")).toBeVisible();
    await expect(page.getByText("1192 John Doe").first()).toBeVisible();
    await expect(page.getByText("BIZONYÍTÉK: door.jpg")).toBeVisible();
    // Inline evidence is served resized through a Cloudinary transformation.
    await expect(page.locator('img[alt="door.jpg"]').first()).toHaveAttribute("src", /\/upload\/c_limit,w_1200,q_auto,f_auto\//);
    // One call for the whole case; the cases table itself is never read by the page.
    expect(mock.count("rpc", "get_case_detail")).toBe(1);
    expect(mock.count("rest", "cases")).toBe(0);
    expect(errors).toEqual([]);
  });

  test("the case list does not download document bodies", async ({page}) => {
    const mock = await mockSupabase(page, {
      rpc: {
        get_case_list: [{
          id: CASE_ID, case_number: "SD-192/007/261001", title: "Éjszakai Bagoly", description: null, status: "open", priority: "high",
          category: "weapons", created_at: NOW, updated_at: NOW, closed_at: null, owner_id: TEST_USER_ID, owner_name: "John Doe",
          owner_badge: "1192", owner_avatar: null, evidence: 2, people: 1, collaborators: 0, warrants_pending: 0, warrants_active: 0,
          my_role: "owner", can_open: true,
        }],
      },
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/mcb");

    await expect(page.getByRole("heading", {name: "Éjszakai Bagoly"})).toBeVisible();
    expect(mock.count("rpc", "get_case_list")).toBeGreaterThan(0);
    for (const query of mock.requests.filter((r) => r.kind === "rest")) {
      expect(decodeURIComponent(new URL(query.url).searchParams.get("select") ?? "")).not.toMatch(/\bbody\b/);
    }
    expect(mock.count("rest", "cases")).toBe(0);
  });

  test("academy material loads page content on demand", async ({page}) => {
    const errors = collectPageErrors(page);
    const mock = await mockSupabase(page, {
      tables: {
        academy_materials: [{
          id: PAGE_ID,
          title: "Nap 1 - Oldal 1",
          day_number: 1,
          page_order: 1,
          category: "basic",
          theme: "default",
          updated_at: NOW,
          content: [paragraph("a1", [{type: "text", text: "Üdv az akadémián!", styles: {}}])],
        }],
      },
      rpc: {get_academy_overview: ACADEMY_OVERVIEW},
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/academy");
    await page.getByRole("button", {name: /1\. nap/}).first().click();

    await expect(page.getByText("Üdv az akadémián!")).toBeVisible();
    // The list query leaves out the document; the content comes from a per-page query.
    const selects = mock.requests.filter((r) => r.name === "academy_materials").map((r) => new URL(r.url).searchParams.get("select") ?? "");
    expect(selects).toContain("content");
    expect(selects.filter((select) => select !== "content").every((select) => !select.includes("content") && select !== "*")).toBe(true);
    expect(mock.count("rpc", "get_academy_overview")).toBe(1);
    expect(errors).toEqual([]);
  });

  test("pasted (embedded) images are uploaded to Cloudinary before an academy page is saved", async ({page}) => {
    const errors = collectPageErrors(page);
    await mockSupabase(page, {
      tables: {
        profiles: [testProfile({faction_rank: "Sergeant I.", qualifications: ["TB"]})],
        academy_division_materials: [{
          id: PAGE_ID, course_id: "qual_AB", title: "AB bevezető", page_order: 1, theme: "default",
          content: [paragraph("p1", [{type: "text", text: "Helikopter alapok", styles: {}}]),
            {id: "i1", type: "image", props: {url: PIXEL, caption: "", name: "", showPreview: true, previewWidth: 200, textAlignment: "left", backgroundColor: "default"}, children: []}],
        }],
      },
      rpc: {get_academy_overview: {...ACADEMY_OVERVIEW, viewer: {instructor: true, trainee: false}}},
    });
    let uploads = 0;
    await page.route("https://api.cloudinary.com/**", (route) => {
      uploads += 1;
      return route.fulfill({json: {secure_url: "https://res.cloudinary.com/e2e-cloud/image/upload/v1/academy/pixel.webp"}});
    });
    const saved: unknown[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/rest/v1/academy_division_materials") && request.method() === "PATCH") saved.push(request.postDataJSON());
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/academy?course=qual_AB");
    await expect(page.getByText("Helikopter alapok")).toBeVisible();
    await page.getByRole("button", {name: "Szerkesztés"}).click();
    await expect(page.getByText(/1 kép az oldalba ágyazva/)).toBeVisible();
    await page.getByRole("button", {name: "Feltöltés most"}).click();

    await expect(page.getByText(/1 beágyazott kép feltöltve/)).toBeVisible();
    expect(uploads).toBe(1);
    const body = JSON.stringify(saved.at(-1));
    expect(body).toContain("https://res.cloudinary.com/e2e-cloud/image/upload/v1/academy/pixel.webp");
    expect(body).not.toContain("data:image/");
    expect(errors).toEqual([]);
  });
});
