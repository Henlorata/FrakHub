import {expect, test} from "@playwright/test";
import {mockSupabase} from "./support/mock-supabase";

test.describe("public pages", () => {
  test("login page renders the sign-in form", async ({page}) => {
    await mockSupabase(page);
    await page.goto("/login");

    await expect(page.getByRole("heading", {name: "SFSD INTRANET"})).toBeVisible();
    await expect(page.getByPlaceholder("badge@sfsd.com")).toBeVisible();
    await expect(page.getByRole("button", {name: /belépés/i})).toBeEnabled();
  });

  test("protected routes redirect anonymous visitors to the login page", async ({page}) => {
    await mockSupabase(page);
    for (const path of ["/dashboard", "/hr", "/mcb", "/does-not-exist"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    }
  });

  test("registration shows the recruitment stop notice", async ({page}) => {
    await mockSupabase(page, {
      tables: {system_status: [{id: "global", alert_level: "normal", recruitment_open: false}]},
    });
    await page.goto("/register");

    await expect(page.getByRole("heading", {name: /Regisztráció az intranetre/i})).toBeVisible();
    await expect(page.getByText(/létszámstop/i).first()).toBeVisible();
  });

  test("registration surfaces server-side validation errors", async ({page}) => {
    await mockSupabase(page);
    await page.route("**/api/register", (route) =>
      route.fulfill({status: 409, json: {error: "Ez a jelvényszám már regisztrálva van."}}),
    );
    await page.goto("/register");

    await page.getByPlaceholder("John Doe").fill("John Doe");
    await page.getByPlaceholder("0000").fill("1192");
    await page.getByPlaceholder("email@example.com").fill("john@sfsd.test");
    await page.locator('input[type="password"]').fill("secret123");
    await page.getByRole("button", {name: /regisztráció küldése/i}).click();

    // The message used to be stored in state but never rendered.
    await expect(page.getByRole("alert")).toHaveText("Ez a jelvényszám már regisztrálva van.");
  });

  test("successful registration returns to the login page", async ({page}) => {
    await mockSupabase(page);
    let body: Record<string, unknown> | null = null;
    await page.route("**/api/register", async (route) => {
      body = route.request().postDataJSON();
      await route.fulfill({status: 201, json: {success: true}});
    });
    await page.goto("/register");

    await page.getByPlaceholder("John Doe").fill("John Doe");
    await page.getByPlaceholder("0000").fill("1192");
    await page.getByPlaceholder("email@example.com").fill("john@sfsd.test");
    await page.locator('input[type="password"]').fill("secret123");
    await page.getByRole("button", {name: /regisztráció küldése/i}).click();

    await expect(page).toHaveURL(/\/login$/);
    expect(body).toMatchObject({email: "john@sfsd.test", badge_number: "1192", faction_rank: "Deputy Sheriff Trainee"});
  });
});
