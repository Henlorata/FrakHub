import {expect, test} from "@playwright/test";
import {login, MFA_CODE, mockSupabase, testProfile} from "./support/mock-supabase";

test.describe("authentication", () => {
  test("valid credentials open the dashboard", async ({page}) => {
    await mockSupabase(page);
    await login(page);

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", {name: /,\s*john\.$/i})).toBeVisible();
  });

  test("wrong password is rejected", async ({page}) => {
    await mockSupabase(page);
    await login(page, "deputy@sfsd.test", "wrong-password");

    await expect(page.getByText("Belépés megtagadva")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("an authenticator app adds a second step before any data loads", async ({page}) => {
    const mock = await mockSupabase(page, {mfa: true});
    await login(page);

    await expect(page.getByRole("heading", {name: "Hitelesítő kód"})).toBeVisible();
    expect(mock.count("rest", "profiles")).toBe(0);

    const code = page.getByLabel("Hitelesítő kód");
    await code.fill("000000");
    await expect(page.getByText(/hibás kód/i)).toBeVisible();
    expect(mock.count("rest", "profiles")).toBe(0);

    await page.getByLabel("Hitelesítő kód").fill(MFA_CODE);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", {name: /,\s*john\.$/i})).toBeVisible();
  });

  test("a stored session without the second step shows the code screen", async ({page}) => {
    const mock = await mockSupabase(page, {mfa: true});
    await login(page);
    await expect(page.getByRole("heading", {name: "Hitelesítő kód"})).toBeVisible();

    await page.goto("/hr");
    await expect(page.getByRole("heading", {name: "Hitelesítő kód"})).toBeVisible();
    expect(mock.count("rest", "profiles")).toBe(0);
    await page.getByRole("button", {name: "Kilépés"}).click();
    await expect(page.getByPlaceholder("badge@sfsd.com")).toBeVisible();
  });

  test("pending accounts see the approval screen", async ({page}) => {
    await mockSupabase(page, {tables: {profiles: [testProfile({system_role: "pending"})]}});
    await login(page);

    await expect(page.getByRole("heading", {name: "Jóváhagyásra Vár"})).toBeVisible();
  });

  test("the session survives a reload and sign-out ends it", async ({page}) => {
    await mockSupabase(page);
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.reload();
    await expect(page.getByRole("heading", {name: /,\s*john\.$/i})).toBeVisible();

    await page.getByRole("button", {name: "Fiók"}).click();
    await page.getByRole("menuitem", {name: /kijelentkezés/i}).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("members without MCB rights cannot open the MCB area", async ({page}) => {
    await mockSupabase(page, {
      tables: {profiles: [testProfile({faction_rank: "Deputy Sheriff II.", system_role: "user", division: "TSB"})]},
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/mcb");
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
