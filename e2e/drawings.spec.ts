import {expect, test} from "@playwright/test";
import {login, mockSupabase, TEST_USER_ID} from "./support/mock-supabase";

const CASE_ID = "22222222-2222-4222-8222-222222222222";
const NOW = "2026-10-07T12:00:00Z";

const detail = {
  case: {
    id: CASE_ID, case_number: "SD-192/007/261001", title: "Éjszakai Bagoly", description: null, status: "open", priority: "high", category: "weapons",
    theme: "default", owner_id: TEST_USER_ID, created_at: NOW, updated_at: NOW, closed_at: null, body_version: 1, body_updated_by: TEST_USER_ID,
    body_updated_by_name: "John Doe",
    body: [{id: "b1", type: "paragraph", props: {textColor: "default", backgroundColor: "default", textAlignment: "left"},
      content: [{type: "text", text: "Megfigyelés a dokknál.", styles: {}}], children: []}],
  },
  owner: {id: TEST_USER_ID, full_name: "John Doe", badge_number: "1192", faction_rank: "Sergeant I.", division: "MCB", division_rank: null, avatar_url: null},
  collaborators: [], evidence: [], people: [], warrants: [], tasks: [], items: [], suggestions: [],
  viewer: {role: "owner", can_edit: true, can_manage: true, is_lead: false, can_approve: false},
};

test.describe("drawings in cases", () => {
  test("a scene sketch is drawn from the editor's \"/\" menu and saved in the document", async ({page}) => {
    const mock = await mockSupabase(page, {
      rpc: {get_case_detail: detail, get_case_list: [], save_case_document: {ok: true, version: 2, updated_at: NOW}},
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/mcb/case/${CASE_ID}`);

    await page.getByText("Megfigyelés a dokknál.").click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/helyszin");
    await expect(page.getByText("Járművek, személyek, utak és nyilak a helyszínről")).toBeVisible();
    await page.keyboard.press("Enter");

    // The editor opens at once: two cars, a person and an arrow.
    const editor = page.getByRole("dialog");
    await editor.getByRole("button", {name: "Járőrautó", exact: true}).click();
    await editor.getByRole("button", {name: "Autó", exact: true}).click();
    await editor.getByLabel("Felirat").fill("A jármű");
    await editor.getByRole("button", {name: "Személy", exact: true}).click();
    await editor.getByRole("button", {name: "Nyíl", exact: true}).click();
    await expect(editor.getByText("Nyíl", {exact: true}).last()).toBeVisible();
    await editor.getByRole("button", {name: "Kész"}).click();

    const sketch = page.getByRole("img", {name: "Helyszínrajz: Helyszínrajz"});
    await expect(sketch).toBeVisible();
    await expect(sketch.locator("[data-sketch-item]")).toHaveCount(4);

    await page.getByRole("button", {name: "Mentés", exact: true}).click();
    await expect.poll(() => JSON.stringify(mock.requests.find((request) => request.name === "save_case_document")?.body ?? {})).toContain("\"sketch\"");
    const body = JSON.stringify(mock.requests.find((request) => request.name === "save_case_document")?.body);
    expect(body).toContain("A jármű");
    expect(body).not.toContain("data:image");
  });

  test("a picture is marked before it is uploaded as evidence", async ({page}) => {
    await mockSupabase(page, {rpc: {get_case_detail: detail, get_case_list: []}});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/mcb/case/${CASE_ID}`);
    await expect(page.getByText("Megfigyelés a dokknál.")).toBeVisible();
    const picture = await page.screenshot({type: "png"});

    await page.getByRole("button", {name: "Feltöltés"}).first().click();
    const upload = page.getByRole("dialog");
    await upload.locator("input[type=file]").setInputFiles({name: "helyszin.png", mimeType: "image/png", buffer: picture});
    const before = await upload.locator("li img").getAttribute("src");
    await upload.getByRole("button", {name: "Jelölés a képen"}).click();

    const canvas = page.getByTestId("annotator-canvas");
    await expect(canvas).toBeVisible();
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5, {steps: 5});
    await page.mouse.up();
    await page.getByRole("button", {name: "Szöveg (T)"}).click();
    await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.6);
    await page.getByLabel("Felirat").fill("Itt állt");
    await page.keyboard.press("Enter");
    await expect(canvas.locator("text", {hasText: "Itt állt"})).toBeVisible();
    await page.getByRole("button", {name: "Mentés"}).click();

    // Back in the upload dialog with the marked picture in place of the original.
    await expect(canvas).toHaveCount(0);
    await expect(upload.locator("li img")).not.toHaveAttribute("src", before ?? "");
  });
});
