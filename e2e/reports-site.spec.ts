import {expect, test, type Page} from "@playwright/test";
import {login, mockSupabase, TEST_USER_ID, testProfile} from "./support/mock-supabase";

/** Reports saved on the site (20261010154417): the generator saves on copying, every member reads them, the payment locks the month. */
const PERIOD = "2026-10-01";
const REPORT_ID = "9b1c2f00-0000-4000-8000-000000000001";
const LEGACY_ID = "9b1c2f00-0000-4000-8000-000000000002";
const author = {id: "22222222-2222-4222-8222-222222222222", full_name: "Kovács Anna", faction_rank: "Corporal", badge_number: "1201", avatar_url: null};

const listItem = {
  id: REPORT_ID, number: 42, period: PERIOD, occurred_on: "2026-10-08", created_at: "2026-10-08T19:00:00Z", updated_at: null, source: "report",
  title: "Carl Johnson – Gyorshajtás", forum_url: "https://forum.hl-rpg.eu/posts/5001/", suspect_name: "Carl Johnson", charges: "Gyorshajtás",
  fine: "1500", jail_time: "-", unit_id: "6-L-005", voided: false, void_reason: null, excerpt: "A Garcia utcán 65 km/h-val mértük be a járművet.", author,
};
const legacyItem = {
  ...listItem, id: LEGACY_ID, number: 7, source: "manual", title: "Régi fórum-jelentés (1/2)", suspect_name: null, charges: null, fine: null, jail_time: null,
  unit_id: null, excerpt: null, forum_url: "https://forum.hl-rpg.eu/threads/kovacs-anna-jelentesi-mappaja.88/",
};
const detail = (overrides: Record<string, unknown> = {}) => ({
  ...listItem, officer_name: "Kovács Anna", officer_rank: "Corporal", badge_number: "1201", colleagues: "John Smith, Deputy Sheriff II.",
  suspect_id_card: "BED-C62-F95", suspect_license: "-", suspect_medical: "-", report_date: "2026. 10. 08.", confiscated_items: "-",
  description: "A Garcia utcán 65 km/h-val mértük be a járművet.\n\nFélreállítottuk, helyszíni bírságot szabtunk ki.", excerpt: null,
  voided_at: null, voided_by: null, updated_by: null, locked: false, locked_at: null, can_edit: false, can_link: false, can_void: false, ...overrides,
});
const page = (items: unknown[], extra: Record<string, unknown> = {}) => ({
  items, more: false, period: PERIOD, current: PERIOD, locked: false, locked_at: null, started_at: "2026-10-07T09:49:00Z", ...extra,
});

const overflow = (target: Page) => target.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("reports on the site", () => {
  test.use({permissions: ["clipboard-read", "clipboard-write"]});

  test("copying the report saves it once; a change saves the same report again", async ({page: browser}) => {
    let saves = 0;
    const mock = await mockSupabase(browser, {
      rpc: {
        get_report_period: {period: PERIOD, mine: 2, started_at: null},
        save_report: () => ({...listItem, id: REPORT_ID, number: 42, author: null, period_count: 3 + saves++}),
      },
    });
    await login(browser);
    await expect(browser).toHaveURL(/\/dashboard$/);
    await browser.goto("/reports");

    await browser.getByPlaceholder("pl. Gyorshajtás, rendőri utasítás megtagadása").fill("Gyorshajtás");
    await browser.getByPlaceholder(/Mi történt/).fill("A Garcia utcán 65 km/h-val mértük be a járművet.");
    await browser.locator("[data-tour=report-output]").getByRole("button", {name: "Másolás"}).click();
    const status = browser.locator("[data-tour=report-save]");
    await expect(status.getByText("Mentve: #42")).toBeVisible();
    await expect(status.getByRole("link", {name: /Megnyitás/})).toHaveAttribute("href", `/reports/${REPORT_ID}`);

    const saved = mock.requests.filter((request) => request.name === "save_report");
    expect(saved).toHaveLength(1);
    expect(saved[0].body).toMatchObject({_report_id: null, _report: {charges: "Gyorshajtás", officer_name: "John Doe", badge_number: "1192"}});

    // Copying again without a change saves nothing; a change is saved into the same report.
    await browser.locator("[data-tour=report-output]").getByRole("button", {name: /Másol/}).click();
    expect(mock.requests.filter((request) => request.name === "save_report")).toHaveLength(1);
    await browser.getByPlaceholder("pl. Gyorshajtás, rendőri utasítás megtagadása").fill("Gyorshajtás, Piros jelzés");
    await expect(status.getByText("Változtattál a mentés óta (#42)")).toBeVisible();
    await status.getByRole("button", {name: "Változások mentése"}).click();
    await expect(status.getByText("Mentve: #42")).toBeVisible();
    const again = mock.requests.filter((request) => request.name === "save_report");
    expect(again).toHaveLength(2);
    expect(again[1].body).toMatchObject({_report_id: REPORT_ID, _report: {charges: "Gyorshajtás, Piros jelzés"}});
  });

  test("every member's reports are listed and open as a page with the forum code", async ({page: browser}) => {
    const mock = await mockSupabase(browser, {
      rpc: {get_reports: page([listItem, legacyItem]), get_report: (args: {_report_id: string}) => args._report_id === LEGACY_ID
        ? detail({...legacyItem, officer_name: null, description: null}) : detail()},
    });
    await login(browser);
    await expect(browser).toHaveURL(/\/dashboard$/);
    await browser.goto("/reports?tab=list");

    await expect(browser.getByText("Kovács Anna").first()).toBeVisible();
    await expect(browser.getByText(/2026\. október · nyitott/)).toBeVisible();
    await expect(browser.getByText("Régi bejegyzés: csak a címe és a fórum linkje van meg.")).toBeVisible();
    expect(mock.requests.find((request) => request.name === "get_reports")?.body).toMatchObject({_period: null, _all_periods: false, _user_id: null});

    await browser.getByRole("link", {name: /#42/}).click();
    await expect(browser).toHaveURL(new RegExp(`/reports/${REPORT_ID}$`));
    await expect(browser.getByRole("heading", {name: "Carl Johnson"})).toBeVisible();
    await expect(browser.getByText("BED-C62-F95")).toBeVisible();
    await expect(browser.getByText("Félreállítottuk, helyszíni bírságot szabtunk ki.")).toBeVisible();
    // Someone else's report: no editing; the forum code is the template's.
    await expect(browser.getByRole("link", {name: /Szerkesztés/})).toHaveCount(0);
    await browser.getByRole("button", {name: /Fórum-kód$/}).click();
    await expect(browser.getByText(/\[B\]Előállított személy teljes neve:\[\/B\]\[\/COLOR\] Carl Johnson/)).toBeVisible();
  });

  test("the leadership voids a report with a reason; the author's open report can be edited", async ({page: browser}) => {
    let current: Record<string, unknown> = detail({can_void: true, locked: true, locked_at: "2026-10-07T09:49:00Z"});
    const mock = await mockSupabase(browser, {
      tables: {profiles: [testProfile({faction_rank: "Commander", system_role: "admin"})]},
      rpc: {
        get_report: () => current,
        void_report: (args: {_reason: string}) => (current = {...current, voided: true, void_reason: args._reason, voided_at: "2026-10-10T18:00:00Z"}),
      },
    });
    await login(browser);
    await expect(browser).toHaveURL(/\/dashboard$/);
    await browser.goto(`/reports/${REPORT_ID}`);

    await expect(browser.getByText(/lezárva/).first()).toBeVisible();
    await browser.getByRole("button", {name: "Érvénytelenítés"}).click();
    const dialog = browser.getByRole("dialog");
    await dialog.getByLabel("Indoklás").fill("Nincs fent a fórumon");
    await dialog.getByRole("button", {name: "Érvénytelenítés"}).click();
    await expect(browser.getByText(/Nem számít bele a havi számba:/)).toBeVisible();
    expect(mock.requests.find((request) => request.name === "void_report")?.body).toMatchObject({_report_id: REPORT_ID, _reason: "Nincs fent a fórumon"});
  });

  test("the author edits an open report in the generator", async ({page: browser}) => {
    await mockSupabase(browser, {
      rpc: {get_report: detail({author: {...author, id: TEST_USER_ID}, can_edit: true, can_link: true}), get_report_period: {period: PERIOD, mine: 1}},
    });
    await login(browser);
    await expect(browser).toHaveURL(/\/dashboard$/);
    await browser.goto(`/reports/${REPORT_ID}`);
    await browser.getByRole("link", {name: /Szerkesztés/}).click();
    await expect(browser).toHaveURL(/\/reports$/);
    await expect(browser.getByPlaceholder("pl. Gyorshajtás, rendőri utasítás megtagadása")).toHaveValue("Gyorshajtás");
    await expect(browser.locator("[data-tour=report-save]").getByText("Mentve: #42")).toBeVisible();
  });

  test("the month's summary lists everyone's count and opens a member's reports", async ({page: browser}) => {
    await mockSupabase(browser, {
      rpc: {
        get_report_overview: {
          period: PERIOD, current: PERIOD, locked: false, locked_at: null, started_at: null, min_reports: 8, total: 9, voided: 1, mine: 0,
          periods: [{period: PERIOD, count: 9, locked: false}, {period: "2026-09-01", count: 30, locked: true}],
          members: [
            {user_id: author.id, full_name: "Kovács Anna", faction_rank: "Corporal", badge_number: "1201", avatar_url: null, reports: 9, voided: 1, counted: 9,
              recorded: false, last_on: "2026-10-08"},
            {user_id: TEST_USER_ID, full_name: "John Doe", faction_rank: "Sergeant I.", badge_number: "1192", avatar_url: null, reports: 0, voided: 0, counted: 0,
              recorded: false, last_on: null},
          ],
        },
        get_reports: page([listItem]),
      },
    });
    await login(browser);
    await expect(browser).toHaveURL(/\/dashboard$/);
    await browser.goto("/reports?tab=summary");
    await expect(browser.getByText("+1 érvénytelen")).toBeVisible();
    await browser.getByRole("link", {name: "Kovács Anna jelentései"}).click();
    await expect(browser).toHaveURL(new RegExp(`tab=list&period=${PERIOD}&user=${author.id}`));
    await expect(browser.getByText(/jelentései/).first()).toBeVisible();
  });

  test("the old Jelentéseim link opens the member's own reports", async ({page: browser}) => {
    const mock = await mockSupabase(browser, {rpc: {get_reports: page([])}});
    await login(browser);
    await expect(browser).toHaveURL(/\/dashboard$/);
    await browser.goto("/reports?tab=mine");
    await expect(browser).toHaveURL(/tab=list&mine=1/);
    await expect.poll(() => mock.requests.filter((request) => request.name === "get_reports").at(-1)?.body?._user_id).toBe(TEST_USER_ID);
  });

  test("long text never widens the list or the report page (390px)", async ({page: browser}) => {
    const long = "rsgysdgrrsgysdgr".repeat(20);
    const wide = {...listItem, suspect_name: long, charges: long, excerpt: long, unit_id: long.slice(0, 40)};
    await browser.setViewportSize({width: 390, height: 844});
    await mockSupabase(browser, {rpc: {get_reports: page([wide]), get_report: detail({...wide, description: long, colleagues: long, confiscated_items: long})}});
    await login(browser);
    await expect(browser).toHaveURL(/\/dashboard$/);
    await browser.goto("/reports?tab=list");
    await expect(browser.getByRole("link", {name: /#42/})).toBeVisible();
    expect(await overflow(browser)).toBeLessThanOrEqual(0);
    await browser.goto(`/reports/${REPORT_ID}`);
    await expect(browser.getByRole("heading", {level: 1})).toBeVisible();
    expect(await overflow(browser)).toBeLessThanOrEqual(0);
  });
});
