import {expect, test} from "@playwright/test";
import {login, mockSupabase} from "./support/mock-supabase";

test.describe("code book", () => {
  test("codes are searchable, the quiz works, and nothing is loaded from the database", async ({page}) => {
    const mock = await mockSupabase(page);
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.getByRole("link", {name: "Kódtár"}).first().click();
    await expect(page).toHaveURL(/\/codes$/);
    const before = mock.requests.filter((request) => request.kind === "rest" || request.kind === "rpc").length;

    await expect(page.getByRole("heading", {name: "10-es kódok"})).toBeVisible();
    await page.getByLabel("Keresés a kódok között").fill("erősítés");
    await expect(page.getByText("Code 4", {exact: true})).toBeVisible();
    await expect(page.getByText("10-4", {exact: true})).toHaveCount(0);

    await page.getByRole("tab", {name: /Gyakorlás/}).click();
    await page.locator("[data-quiz-option]").first().click();
    await expect(page.locator("[data-quiz-score]")).toHaveText(/^[01]\/1$/);

    expect(mock.requests.filter((request) => request.kind === "rest" || request.kind === "rpc").length).toBe(before);
  });
});
