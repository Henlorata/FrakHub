import {expect, test} from "@playwright/test";
import {login, mockSupabase, testProfile} from "./support/mock-supabase";

test.describe("signature", () => {
  test("a member draws a signature and saves it as a vector outline", async ({page}) => {
    const mock = await mockSupabase(page, {tables: {profiles: [testProfile({signature: null})], member_signatures: []}});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/profile?tab=settings&signature=1");

    const pad = page.locator('canvas[aria-label="Rajzolj ide"]');
    await expect(pad).toBeVisible();
    const box = (await pad.boundingBox())!;
    await page.mouse.move(box.x + 40, box.y + box.height * 0.6);
    await page.mouse.down();
    for (let i = 1; i <= 24; i++) await page.mouse.move(box.x + 40 + i * 12, box.y + box.height * (0.6 - Math.sin(i / 3) * 0.2), {steps: 2});
    await page.mouse.up();

    await page.getByRole("dialog").getByRole("button", {name: "Mentés"}).click();
    await expect.poll(() => mock.requests.find((request) => request.name === "save_signature")?.body).toMatchObject({_method: "draw", _height: 100});
    const body = mock.requests.find((request) => request.name === "save_signature")?.body as {_path: string};
    expect(body._path).toMatch(/^M[\d. ]+Q/);
  });

  test("members without a signature are asked after the trainings, never before", async ({page}) => {
    const mock = await mockSupabase(page, {tables: {profiles: [testProfile({signature: null})], member_signatures: []}});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", {name: "Állítsd be az aláírásodat"})).toBeVisible({timeout: 10_000});
    await page.getByRole("button", {name: "Később"}).click();
    await expect(page.getByRole("heading", {name: "Állítsd be az aláírásodat"})).toHaveCount(0);
    // Known from the profile read: the reminder never asks the database itself.
    expect(mock.count("rest", "member_signatures")).toBe(0);
  });
});
