import {expect, test, type Page} from "@playwright/test";
import {login, mockSupabase, TEST_USER_ID} from "./support/mock-supabase";

const CASE_ID = "22222222-2222-4222-8222-222222222222";
const EVIDENCE_ID = "33333333-3333-4333-8333-333333333333";
const PAGE_ID = "44444444-4444-4444-8444-444444444444";
const NOW = "2026-10-01T12:00:00Z";

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
    await mockSupabase(page, {
      tables: {
        cases: [{
          id: CASE_ID,
          case_number: 7,
          title: "Éjszakai Bagoly",
          description: "Teszt akta",
          status: "open",
          priority: "high",
          owner_id: TEST_USER_ID,
          theme: "default",
          created_at: NOW,
          updated_at: NOW,
          owner: {full_name: "John Doe", badge_number: "1192"},
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
        }],
        case_evidence: [{
          id: EVIDENCE_ID,
          case_id: CASE_ID,
          file_path: "https://res.cloudinary.com/e2e-cloud/image/upload/v1700000000/evidence/door.jpg",
          file_name: "door.jpg",
          file_type: "image",
          uploaded_by: TEST_USER_ID,
          created_at: NOW,
        }],
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
    expect(errors).toEqual([]);
  });

  test("the case list does not download document bodies", async ({page}) => {
    const mock = await mockSupabase(page, {
      tables: {
        cases: [{
          id: CASE_ID, case_number: 7, title: "Éjszakai Bagoly", status: "open", priority: "high",
          owner_id: TEST_USER_ID, updated_at: NOW, owner: {full_name: "John Doe"},
        }],
      },
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/mcb");

    await expect(page.getByRole("cell", {name: "Éjszakai Bagoly"})).toBeVisible();
    const listQueries = mock.requests.filter((r) => r.name === "cases" && r.method === "GET");
    expect(listQueries.length).toBeGreaterThan(0);
    for (const query of listQueries) {
      expect(decodeURIComponent(new URL(query.url).searchParams.get("select") ?? "")).not.toMatch(/\*|body/);
    }
  });

  test("academy material loads page content on demand", async ({page}) => {
    const errors = collectPageErrors(page);
    const mock = await mockSupabase(page, {
      tables: {
        academy_cycles: [{id: "cycle-1", start_date: "2026-01-01", status: "active", created_at: NOW}],
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
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/academy");

    await expect(page.getByText("Üdv az akadémián!")).toBeVisible();
    // The list query leaves out the document; the content comes from a per-page query.
    const academyQueries = mock.requests.filter((r) => r.name === "academy_materials");
    expect(academyQueries.some((r) => new URL(r.url).searchParams.get("select") === "content")).toBe(true);
    expect(academyQueries.every((r) => new URL(r.url).searchParams.get("select") !== "*")).toBe(true);
    expect(errors).toEqual([]);
  });
});
