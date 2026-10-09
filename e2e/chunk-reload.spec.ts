import {expect, test, type Page} from "@playwright/test";
import {mockSupabase, type MockSupabase} from "./support/mock-supabase";

/**
 * A lazy page whose code does not load (a tab left open across a deploy: Vercel answers a chunk of
 * an earlier deployment with a 404) reloads the page once (src/lib/lazy.ts). Until the reload the
 * loading screen stays: no crash screen, nothing in the error log. A page that still fails right
 * after the reload shows the error, which is reported, and the page does not reload again.
 */

const CHUNK = /\/assets\/CertificatePage-[\w-]+\.js$/;
const CRASH = "Váratlan hiba történt";
const CERTIFICATE = {
  code: "SFSD-0000-0001", kind: "exam", ref: null, title: "Deputy I. vizsga", subtitle: "Sikeres vizsga", issued_at: "2026-10-01T10:00:00Z",
  valid: true, revoked_at: null, holder: {full_name: "Teszt Elek", badge_number: "1001", faction_rank: "Commander"},
};

const reports = (mock: MockSupabase) => mock.requests.filter((request) => request.kind === "rpc" && request.name === "report_client_error")
  .map((request) => request.body as Record<string, string | null>);

/** Fails the certificate page's chunk while `fail(documents loaded so far)` says so, and counts what happens. */
async function watch(page: Page, fail: (documents: number) => boolean) {
  const seen = {documents: 0, crashScreens: 0};
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) seen.documents += 1;
  });
  await page.route(CHUNK, (route) => (fail(seen.documents)
    ? route.fulfill({status: 404, contentType: "text/plain", body: "The page could not be found"})
    : route.continue()));
  // The crash screen, even if it would show only for a moment before the reload.
  await page.exposeFunction("crashScreenShown", () => (seen.crashScreens += 1));
  await page.addInitScript((text) => {
    new MutationObserver((_, observer) => {
      if (!document.body?.textContent?.includes(text)) return;
      observer.disconnect();
      void (window as unknown as {crashScreenShown: () => Promise<void>}).crashScreenShown();
    }).observe(document, {childList: true, subtree: true});
  }, CRASH);
  return seen;
}

test.describe("a lazy page whose code does not load", () => {
  test("reloads once, without a crash screen or an error report", async ({page}) => {
    const mock = await mockSupabase(page, {rpc: {verify_certificate: CERTIFICATE}});
    const seen = await watch(page, (documents) => documents < 2);
    await page.goto("/certificates/SFSD-0000-0001");
    await expect(page.getByText(/Ezennel igazoljuk/)).toBeVisible();
    expect(seen.documents).toBe(2);
    await page.waitForTimeout(300);
    expect(seen.crashScreens).toBe(0);
    expect(reports(mock)).toEqual([]);
  });

  test("still failing right after the reload: the error shows and is reported, no second reload", async ({page}) => {
    const mock = await mockSupabase(page, {rpc: {verify_certificate: CERTIFICATE}});
    const seen = await watch(page, () => true);
    await page.goto("/certificates/SFSD-0000-0001");
    await expect(page.getByText(CRASH)).toBeVisible();
    await expect.poll(() => reports(mock).length).toBe(1);
    const [report] = reports(mock);
    expect(report._kind).toBe("crash");
    expect(report._message).toMatch(/dynamically imported module/i);
    expect(report._route).toBe("/certificates/:id");
    await page.waitForTimeout(500);
    expect(seen.documents).toBe(2);
  });
});
