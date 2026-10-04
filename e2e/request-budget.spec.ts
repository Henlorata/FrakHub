import {expect, test} from "@playwright/test";
import {login, mockSupabase} from "./support/mock-supabase";

/**
 * Free-tier guards: these tests count the queries the app sends, so regressions that
 * silently burn Supabase egress or request quota fail the suite.
 */
test.describe("request budget", () => {
  test("an idle login page stays quiet", async ({page}) => {
    const mock = await mockSupabase(page);
    await page.goto("/login");
    await expect(page.getByPlaceholder("badge@sfsd.com")).toBeVisible();
    await page.waitForTimeout(3_000);

    // Previously the suspect cache re-fetched suspects + links + all profiles in an
    // endless loop for anonymous visitors (empty result -> refetch).
    expect(mock.count("rest", "suspects")).toBe(0);
    expect(mock.count("rest", "profiles")).toBe(0);
    expect(mock.count("rest")).toBeLessThanOrEqual(1); // the public system_status row
  });

  test("navigation does not refetch the unread counter", async ({page}) => {
    const mock = await mockSupabase(page);
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);

    for (const label of ["Logisztika", "Pénzügy", "Kalkulátor", "Irányítópult"]) {
      await page.getByRole("link", {name: label}).first().click();
    }
    await page.waitForTimeout(500);

    // One unread count and one page of notifications per sign-in, shared by every page.
    expect(mock.count("rest", "notifications")).toBe(2);
    // The profile is loaded once per sign-in, not on every token refresh or page.
    expect(mock.requests.filter((r) => r.kind === "rest" && r.name === "profiles" && r.url.includes("id=eq.")).length)
      .toBe(1);
  });

  test("the dashboard loads with a small, fixed number of requests", async ({page}) => {
    const mock = await mockSupabase(page);
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText(/Gyors elérés/)).toBeVisible();
    await page.waitForTimeout(800);

    // Every "to do" counter comes from one RPC instead of a query per card.
    expect(mock.count("rpc", "get_dashboard_summary")).toBe(1);
    expect(mock.count("rpc", "get_announcements")).toBe(1);
    const dataRequests = mock.requests.filter((r) => r.kind === "rest" || r.kind === "rpc");
    expect(dataRequests.length).toBeLessThanOrEqual(9);
  });

  test("pages outside the MCB area never load the suspect database or the editor", async ({page}) => {
    const mock = await mockSupabase(page);
    const scripts: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "script") scripts.push(request.url());
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.getByRole("link", {name: "Kalkulátor"}).first().click();
    await expect(page).toHaveURL(/\/calculator$/);

    expect(mock.count("rest", "suspects")).toBe(0);
    expect(scripts.some((url) => url.includes("@blocknote") || url.includes("@mantine"))).toBe(false);
  });
});
