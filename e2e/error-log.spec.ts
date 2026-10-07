import {expect, test} from "@playwright/test";
import {login, MOCK_SUPABASE_URL, mockSupabase, testProfile, type MockSupabase} from "./support/mock-supabase";

const PIXEL = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const picture = {name: "foto.png", mimeType: "image/png", buffer: PIXEL};

const reports = (mock: MockSupabase) => mock.requests.filter((request) => request.kind === "rpc" && request.name === "report_client_error")
  .map((request) => request.body as Record<string, string | null>);

const leader = testProfile({faction_rank: "Commander", system_role: "admin", is_bureau_manager: true});

test.describe("error log", () => {
  test("a failed upload is reported without the page's query; a file the member picked is not", async ({page}) => {
    const mock = await mockSupabase(page);
    let answer = "Upload preset not found";
    await page.route("https://api.cloudinary.com/**", (route) => route.fulfill({status: 400, json: {error: {message: answer}}}));
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/profile?tab=settings");
    const input = page.locator("input[type=file][accept='image/*']").first();
    await input.setInputFiles(picture);
    await expect(page.getByText(/A képfeltöltés nincs beállítva/)).toBeVisible();
    await expect.poll(() => reports(mock).length).toBe(1);
    const [report] = reports(mock);
    expect(report._kind).toBe("upload");
    expect(report._message).toBe("avatar (e2e-avatars): Upload preset not found");
    expect(report._route).toBe("/profile");
    expect(report._build).toMatch(/^[a-z0-9]+$/);
    expect(report._browser).toMatch(/^Chrome \d+ · /);

    answer = "File size too large. Got 12000000. Maximum is 10485760.";
    await input.setInputFiles({...picture, name: "nagy.png"});
    await expect(page.getByText("A fájl túl nagy a feltöltéshez.")).toBeVisible();
    await page.waitForTimeout(300);
    expect(reports(mock)).toHaveLength(1);
  });

  test("an error nothing caught is reported once with its stack; an extension's error is not", async ({page}) => {
    const mock = await mockSupabase(page);
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    for (let i = 0; i < 2; i += 1) {
      await page.addScriptTag({content: "setTimeout(() => { throw new TypeError('Teszt: elkapatlan hiba'); });"});
    }
    await page.addScriptTag({content: "Promise.reject(new Error('Teszt: elutasított ígéret'));"});
    await page.evaluate(() => window.dispatchEvent(new ErrorEvent("error", {
      message: "Bővítmény hibája", filename: "chrome-extension://abcdef/content.js", error: new Error("Bővítmény hibája"),
    })));
    await expect.poll(() => reports(mock).length).toBe(2);
    await page.waitForTimeout(300);
    const messages = reports(mock).map((report) => report._message);
    expect(messages).toEqual(expect.arrayContaining(["TypeError: Teszt: elkapatlan hiba", "Teszt: elutasított ígéret"]));
    expect(messages).toHaveLength(2);
    expect(reports(mock)[0]._kind).toBe("error");
    expect(reports(mock).find((report) => report._message?.startsWith("TypeError"))?._detail).toContain("Teszt: elkapatlan hiba");
  });

  test("a crashed page is reported with its component stack", async ({page}) => {
    const mock = await mockSupabase(page, {rpc: {get_dashboard_summary: {upcoming_events: "nem lista"}}});
    await login(page);
    await expect(page.getByText("Hiba történt az oldalon")).toBeVisible();
    await expect.poll(() => reports(mock).length).toBe(1);
    const [report] = reports(mock);
    expect(report._kind).toBe("crash");
    expect(report._message).toMatch(/^TypeError: .*map is not a function/);
    expect(report._route).toBe("/dashboard");
    expect(report._detail).toContain("DashboardPage-");
  });

  test("a database answer that points at a bug is reported; an expected refusal is not", async ({page}) => {
    const mock = await mockSupabase(page);
    let answer: {status: number; json: Record<string, unknown>} = {status: 400, json: {code: "P0001", message: "Nincs jogosultságod.", details: null, hint: null}};
    await page.route(`${MOCK_SUPABASE_URL}/rest/v1/rpc/get_dashboard_summary`, (route) => route.fulfill(answer));
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.waitForTimeout(500);
    expect(reports(mock)).toHaveLength(0);

    answer = {status: 404, json: {code: "PGRST202", message: "Could not find the function public.get_dashboard_summary without parameters in the schema cache",
      details: null, hint: "Perhaps you meant to call the function public.get_db_health"}};
    await page.reload();
    await expect.poll(() => reports(mock).length).toBe(1);
    const [report] = reports(mock);
    expect(report._kind).toBe("database");
    expect(report._message).toBe("rpc/get_dashboard_summary: PGRST202 Could not find the function public.get_dashboard_summary without parameters in the schema cache");
    expect(report._detail).toContain("Perhaps you meant");
  });

  test("the leadership reads the log on the statistics page and marks a row handled", async ({page}) => {
    let handled = false;
    const row = {
      id: "e0000000-0000-4000-8000-000000000001", kind: "upload", message: "avatar (frakhub_avatars): Upload preset not found",
      detail: "Error: Upload preset not found\n    at uploadToCloudinary (index-abc.js:1:200)", routes: ["/profile", "/mcb/suspects"], builds: ["abc123"],
      browsers: ["Chrome 141 · Windows"], occurrences: 7, guests: 1, members: 6,
      users: [{id: "u1", full_name: "Lisa Clark", badge_number: "1001"}, {id: "u2", full_name: "Nina Brownie", badge_number: null}],
      first_seen: "2026-10-06T19:00:00Z", last_seen: "2026-10-07T21:00:00Z", resolved_at: null, resolved_by: null,
    };
    const mock = await mockSupabase(page, {
      tables: {profiles: [leader]},
      rpc: {
        get_dashboard_summary: () => ({client_errors: handled ? 0 : 1}),
        get_client_errors: () => (handled
          ? {open: 0, items: [{...row, resolved_at: "2026-10-08T08:00:00Z", resolved_by: "John Doe"}]}
          : {open: 1, items: [row]}),
        resolve_client_errors: () => {
          handled = true;
          return 1;
        },
      },
    });
    await login(page);
    const task = page.getByRole("button", {name: /Nyitott hiba a hibanaplóban/});
    await expect(task).toBeVisible();
    await task.click();
    await expect(page).toHaveURL(/\/stats#hibak$/);

    const card = page.locator("#hibak");
    await expect(card.getByText("avatar (frakhub_avatars): Upload preset not found")).toBeVisible();
    await expect(card).toBeInViewport();
    await expect(card.getByText(/7× · 6 tag · 1 látogató/)).toBeVisible();
    await expect(card.getByText("Lisa Clark (#1001), Nina Brownie és még 4")).toBeVisible();
    await expect(card.getByText("/mcb/suspects")).toBeVisible();
    await card.getByText("Részletek").click();
    await expect(card.getByText(/at uploadToCloudinary/)).toBeVisible();

    await card.getByRole("button", {name: "Elintézve"}).click();
    await expect(page.getByText("Elintézettnek jelölve.")).toBeVisible();
    await expect(card.getByText("Nincs nyitott hiba.")).toBeVisible();
    expect(mock.requests.find((request) => request.name === "resolve_client_errors")?.body).toEqual({_ids: [row.id], _resolved: true});
    await card.getByRole("button", {name: "Elintézett hibák (1)"}).click();
    await expect(card.getByText(/elintézte: John Doe/)).toBeVisible();
  });

  test("members see neither the counter nor the log", async ({page}) => {
    const mock = await mockSupabase(page, {rpc: {get_dashboard_summary: {client_errors: null}}});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("button", {name: /Nyitott hiba a hibanaplóban/})).toHaveCount(0);
    await page.goto("/stats");
    await expect(page.getByRole("heading", {name: "Statisztika"})).toBeVisible();
    await expect(page.locator("#hibak")).toHaveCount(0);
    expect(mock.count("rpc", "get_client_errors")).toBe(0);
  });
});
