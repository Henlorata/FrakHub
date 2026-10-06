import {expect, test} from "@playwright/test";

/**
 * Serverless functions, served by the dev middleware (tooling/vite-vercel-api.ts)
 * exactly as Vercel invokes them. Only input validation and authorization paths are
 * exercised: anything further would need a real Supabase project.
 */
test.describe("api functions", () => {
  test("register validates input before touching the database", async ({request}) => {
    let response = await request.post("/api/register", {data: {email: "a@b.hu"}});
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toMatch(/kötelező/);

    response = await request.post("/api/register", {
      data: {email: "a@b.hu", password: "secret12", full_name: "John Doe", badge_number: "12a4", faction_rank: "Corporal"},
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toMatch(/jelvényszám/i);

    response = await request.post("/api/register", {
      data: {email: "a@b.hu", password: "secret12", full_name: "John Doe", badge_number: "1234", faction_rank: "Emperor"},
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe("Ismeretlen rendfokozat.");
  });

  test("unsupported methods and private modules are rejected", async ({request}) => {
    expect((await request.get("/api/register")).status()).toBe(405);
    expect((await request.post("/api/_lib/http", {data: {}})).status()).toBe(404);
    expect((await request.post("/api/does-not-exist", {data: {}})).status()).toBe(404);
  });

  test("privileged endpoints require a bearer token", async ({request}) => {
    for (const path of [
      "/api/admin/update-role",
      "/api/admin/delete-user",
      "/api/admin/update-password",
      "/api/case/delete",
      "/api/delete-image",
    ]) {
      const response = await request.post(path, {data: {}});
      expect(response.status(), path).toBe(401);
    }
  });

  test("the cron job refuses requests without the secret", async ({request}) => {
    let response = await request.get("/api/cron/daily-cleanup");
    expect(response.status()).toBe(401);

    // The old check accepted "Bearer undefined" whenever CRON_SECRET was missing.
    response = await request.get("/api/cron/daily-cleanup", {headers: {Authorization: "Bearer undefined"}});
    expect(response.status()).toBe(401);
  });
});
