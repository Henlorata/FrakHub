import {expect, test} from "@playwright/test";
import {login, mockSupabase} from "./support/mock-supabase";

const ARTICLE = {
  id: "n1", slug: "sikeres-kozos-akcio", title: "Sikeres közös akció a kikötőben", excerpt: "Lőfegyvereket foglaltak le.", cover_url: null,
  category: "operation", featured: true, published_at: "2026-10-07T08:00:00Z", author_display: "Sheriff's Information Bureau",
};

const SITE = {
  content: {
    hero: {title: "A megye szolgálatában.", highlight: "Egy jelvény. Egy csapat."},
    recruitment: {title: "Csatlakozz hozzánk", requirements: ["Tiszta előélet"], steps: [{title: "Jelentkezés", text: "Regisztrálj az oldalon."}]},
    faq: [{q: "Hogyan jelentkezhetek?", a: "A gombbal."}],
    sections: {},
  },
  news: [ARTICLE],
  stats: {members: 48, divisions: {TSB: 30, SEB: 10, MCB: 8}, cases_closed_year: 12, actions_30d: 300, duty_hours_month: 1200, since: 2024},
  leadership: [{full_name: "Millie D Lowe", faction_rank: "Commander", avatar_url: null, division: "TSB", bureau_manager: true, bureau_commander: false, tier: 0}],
  recruitment: {open: true},
  alert_level: "normal",
};

const PAGE = {
  post: {...ARTICLE, status: "published", updated_at: "2026-10-07T08:00:00Z",
    body: [{type: "heading", props: {level: 2}, content: [{type: "text", text: "Mi történt?", styles: {}}]},
      {type: "paragraph", content: [{type: "text", text: "Csütörtök éjjel közös akció volt.", styles: {}}]}]},
  newer: null, older: null, related: [],
};

test.describe("public front page", () => {
  test("a visitor sees the front page and reads an article", async ({page}) => {
    const mock = await mockSupabase(page, {rpc: {get_public_site: SITE, get_news_post: PAGE}});
    await page.goto("/");

    await expect(page.getByRole("heading", {level: 1})).toContainText("A megye szolgálatában.");
    await expect(page.getByRole("link", {name: /Belépés/}).first()).toBeVisible();
    await expect(page.getByText("Millie D Lowe")).toBeAttached();
    await expect(page.getByText("A toborzás nyitva")).toBeVisible();

    await page.locator("#hirek").getByRole("link", {name: /Sikeres közös akció a kikötőben/}).click();
    await expect(page).toHaveURL(/\/news\/sikeres-kozos-akcio$/);
    await expect(page.getByRole("heading", {name: "Mi történt?"})).toBeVisible();
    await expect(page.getByText("Csütörtök éjjel közös akció volt.")).toBeVisible();
    // The front page's data is read once and reused on the article page.
    expect(mock.count("rpc", "get_public_site")).toBe(1);
  });

  test("joining goes to the forum's application board", async ({page}) => {
    const forum = "https://forum.hl-rpg.eu/forums/jelentkez%C3%A9sek.574/";
    await mockSupabase(page, {rpc: {get_public_site: SITE}});
    await page.goto("/");
    const hero = page.getByRole("link", {name: /Csatlakozz hozzánk/});
    await expect(hero).toHaveAttribute("href", forum);
    await expect(hero).toHaveAttribute("target", "_blank");
    // The recruitment section, the closing call and the footer.
    const links = page.getByRole("link", {name: /Jelentkezés a fórumon/});
    await expect(links).toHaveCount(3);
    for (const link of await links.all()) await expect(link).toHaveAttribute("href", forum);
    await expect(page.locator("a[href='/register']")).toHaveCount(0);

    await page.goto("/register");
    await expect(page.getByRole("heading", {name: "Regisztráció az intranetre"})).toBeVisible();
    await expect(page.getByRole("link", {name: "fórum Jelentkezések rovatában"})).toHaveAttribute("href", forum);
  });

  test("an unknown article shows a friendly page", async ({page}) => {
    await mockSupabase(page, {rpc: {get_public_site: SITE, get_news_post: null}});
    await page.goto("/news/nincs-ilyen");
    await expect(page.getByRole("heading", {name: "Ez a hír nem található"})).toBeVisible();
  });

  test("signed-in members land on their dashboard; /home still shows the front page", async ({page}) => {
    await mockSupabase(page, {rpc: {get_public_site: SITE}});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/home");
    await expect(page.getByRole("heading", {level: 1})).toContainText("A megye szolgálatában.");
    await expect(page.getByRole("link", {name: /Intranet/})).toBeVisible();
  });
});
