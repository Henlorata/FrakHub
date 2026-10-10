import {expect, test} from "@playwright/test";
import {login, mockSupabase, testProfile} from "./support/mock-supabase";

const overview = (extra: Record<string, unknown> = {}) => ({
  decks: {}, streak: 2, best_streak: 4, today: new Date().toISOString().slice(0, 10), days: [], can_edit: false, scenarios: [], certificates: 1, ...extra,
});

const scenario = {
  id: "s1", title: "Közúti ellenőrzés", summary: null, category: "traffic", difficulty: 1, start_node: "start", max_score: 5, pass_percent: 70,
  published: true, sort_order: 10, updated_at: "2026-10-01T00:00:00Z", my_result: null,
  nodes: {
    start: {text: "Egy autó áthajt a piroson. Mit teszel?", choices: [
      {id: "a", text: "Megállítom és bemondom a rádióba", next: "radio", points: 3, verdict: "good", feedback: "Helyes."},
      {id: "b", text: "Hagyom", next: "end", points: 0, verdict: "bad", feedback: "Kezelni kell."}]},
    radio: {text: "Mit mondasz be?", choices: [{id: "a", text: "10-28 és Code 6", next: null, points: 2, verdict: "good", feedback: "Pontos."}]},
    end: {end: {title: "Vége", text: "Nézd át a visszajelzéseket."}},
  },
};

test.describe("practice", () => {
  test("a deck session asks the cards and saves the result once at the end", async ({page}) => {
    const mock = await mockSupabase(page, {
      tables: {profiles: [testProfile({faction_rank: "Deputy Sheriff II.", system_role: "user"})]},
      rpc: {get_practice_overview: overview(), save_practice_session: {streak: 3, best_streak: 4, today: {answered: 5, correct: 3}}},
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/practice");
    await expect(page.getByText("2nap")).toBeVisible();

    await page.locator('[data-tour="practice-deck-radio"]').click();
    const done = page.getByText("Kész a mai adag!");
    let answered = 0;
    for (let step = 0; step < 14 && !(await done.isVisible()); step += 1) {
      await page.locator("[data-practice-option]").first().click();
      answered += 1;
      await page.getByRole("button", {name: /Tovább/}).click();
    }
    await expect(done).toBeVisible();
    await expect(page.getByText("3 napos sorozat")).toBeVisible();
    expect(mock.count("rpc", "save_practice_session")).toBe(1);
    const body = mock.requests.find((request) => request.name === "save_practice_session")?.body as {_deck: string; _answered: number; _cards: object};
    expect(body._deck).toBe("radio");
    expect(body._answered).toBe(answered);
    expect(Object.keys(body._cards).length).toBe(5);
  });

  test("a scenario sends only the chosen path; a pass shows the certificate", async ({page}) => {
    const mock = await mockSupabase(page, {
      tables: {profiles: [testProfile({faction_rank: "Deputy Sheriff II.", system_role: "user"})]},
      rpc: {
        get_practice_overview: overview({scenarios: [{id: "s1", title: "Közúti ellenőrzés", summary: null, category: "traffic", difficulty: 1, max_score: 5,
          pass_percent: 70, published: true, updated_at: "2026-10-01T00:00:00Z", steps: 3, result: null, stats: null}]}),
        get_scenario: scenario,
        submit_scenario_run: {score: 5, max_score: 5, percent: 100, passed: true, certificate: "SFSD-1A2B-3C4D",
          best: {scenario_id: "s1", user_id: "u", best_score: 5, max_score: 5, best_percent: 100, passed: true, attempts: 1, last_run_at: "2026-10-06T00:00:00Z"}},
      },
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/practice");
    await page.getByRole("button", {name: /Kezdés/}).click();

    await page.getByRole("button", {name: /Megállítom/}).click();
    await expect(page.getByText("Jó döntés.")).toBeVisible();
    await page.getByRole("button", {name: /Tovább/}).click();
    await page.getByRole("button", {name: /10-28 és Code 6/}).click();
    await page.getByRole("button", {name: "Eredmény"}).click();
    await expect(page.getByText("Sikeresen teljesítetted!")).toBeVisible();
    await expect(page.getByRole("link", {name: /SFSD-1A2B-3C4D/})).toHaveAttribute("href", "/certificates/SFSD-1A2B-3C4D");
    expect(mock.requests.find((request) => request.name === "submit_scenario_run")?.body).toEqual({_scenario_id: "s1", _choices: ["a", "a"]});
  });

  test("an instructor passing a hidden scenario learns the certificate comes with publishing", async ({page}) => {
    const hidden = {...scenario, published: false};
    await mockSupabase(page, {
      tables: {profiles: [testProfile({faction_rank: "Captain II.", system_role: "admin"})]},
      rpc: {
        get_practice_overview: overview({can_edit: true, scenarios: [{id: "s1", title: "Közúti ellenőrzés", summary: null, category: "traffic", difficulty: 1,
          max_score: 5, pass_percent: 70, published: false, updated_at: "2026-10-01T00:00:00Z", steps: 3, result: null, stats: {players: 0, passed: 0}}]}),
        get_scenario: hidden,
        submit_scenario_run: {score: 5, max_score: 5, percent: 100, passed: true, certificate: null,
          best: {scenario_id: "s1", user_id: "u", best_score: 5, max_score: 5, best_percent: 100, passed: true, attempts: 1, last_run_at: "2026-10-06T00:00:00Z"}},
      },
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/practice");
    await page.getByRole("button", {name: /Kezdés/}).click();
    await page.getByRole("button", {name: /Megállítom/}).click();
    await page.getByRole("button", {name: /Tovább/}).click();
    await page.getByRole("button", {name: /10-28 és Code 6/}).click();
    await page.getByRole("button", {name: "Eredmény"}).click();
    await expect(page.getByText("Sikeresen teljesítetted!")).toBeVisible();
    await expect(page.getByText("A gyakorlat még rejtett: az oklevelet a közzétételekor kapod meg, értesítéssel.")).toBeVisible();
  });
});

test.describe("recognition", () => {
  test("anyone checks a certificate code without signing in; a revoked one says so", async ({page}) => {
    await mockSupabase(page, {
      rpc: {
        verify_certificate: (args: {_code: string}) => ({code: args._code, kind: "qualification", ref: "AB", title: "AB képesítés", subtitle: "Képesítési okirat",
          issued_at: "2026-09-01T10:00:00Z", valid: args._code !== "SFSD-DEAD-BEEF", revoked_at: args._code === "SFSD-DEAD-BEEF" ? "2026-10-01T10:00:00Z" : null,
          holder: {full_name: "Nyomozó Nándor", badge_number: "1006", faction_rank: "Corporal"}}),
      },
    });
    await page.goto("/certificates/sfsd-1a2b-3c4d");
    await expect(page.getByText("Hiteles, érvényes oklevél.")).toBeVisible();
    await expect(page.getByText("Nyomozó Nándor")).toBeVisible();
    await expect(page.getByText("Aero Bureau képesítés")).toBeVisible();

    await page.getByLabel("Oklevél kódja").fill("SFSD DEAD BEEF");
    await page.getByRole("button", {name: /Ellenőrzés/}).click();
    await expect(page).toHaveURL(/\/certificates\/SFSD-DEAD-BEEF$/);
    await expect(page.getByText(/Visszavont oklevél/)).toBeVisible();
  });

  test("everyone is on the leaderboard, and a member can turn it off", async ({page}) => {
    let visible = true;
    const board = () => ({month: "2026-10-01", visible, participants: visible ? 3 : 2, categories: ["duty", "reports", "events", "practice"].map((key) => ({
      key, me: {value: 600, place: 2, of: 5},
      entries: [{user_id: "a", full_name: "Első Elek", badge_number: "1", faction_rank: "Corporal", avatar_url: null, value: 900, place: 1, me: false},
        ...(visible ? [{user_id: "me", full_name: "John Doe", badge_number: "2", faction_rank: "Deputy Sheriff II.", avatar_url: null, value: 600, place: 2, me: true}] : [])],
    }))});
    const mock = await mockSupabase(page, {
      tables: {profiles: [testProfile({faction_rank: "Deputy Sheriff II.", system_role: "user"})]},
      rpc: {
        get_leaderboard: board,
        set_leaderboard_visibility: (args: {_visible: boolean}) => {
          visible = args._visible;
          return {visible};
        },
      },
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/leaderboard");
    await expect(page.getByText("A helyed:").first()).toBeVisible();
    await expect(page.getByText("3 tag szerepel")).toBeVisible();
    await page.getByRole("switch").click();
    await expect(page.getByText("Levettünk a ranglistáról.")).toBeVisible();
    await expect(page.getByText("Ha szerepelnél:").first()).toBeVisible();
    expect(mock.requests.find((request) => request.name === "set_leaderboard_visibility")?.body).toEqual({_visible: false});
  });

  test("the monthly recap opens once at the start of a month", async ({page}) => {
    const mock = await mockSupabase(page, {
      tables: {profiles: [testProfile({faction_rank: "Deputy Sheriff II.", system_role: "user"})]},
      rpc: {
        get_dashboard_summary: {unread_notifications: 0, pending_exam_sheets: 0, my_pending_requests: 0, my_active_warnings: 0, members_total: 10,
          members_on_leave: 0, recap_month: "2026-09-01"},
        get_monthly_recap: {month: "2026-09-01", duty_minutes: 2760, duty_avg: 2400, duty_better_than: 64, reports: 9, reports_avg: 6.5, reports_better_than: 70,
          events_attended: 2, events_total: 3, practice_correct: 48, practice_days: 4, pay: 12500000, top_duty: null, top_report: 2, promotions: [],
          awards: [], certificates: 1, leaderboard_visible: false},
      },
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Havi összefoglaló")).toBeVisible();
    await expect(dialog.getByText("2. hely jelentésekben")).toBeVisible();
    await expect(dialog.getByText("Az állomány 64%-ánál többet")).toBeVisible();
    await dialog.getByRole("button", {name: /Szuper/}).click();
    await expect(dialog).toHaveCount(0);
    expect(mock.count("rpc", "get_monthly_recap")).toBe(1);

    await page.reload();
    await expect(page.getByRole("heading", {name: "Gyors elérés"})).toBeVisible();
    await page.waitForTimeout(1200);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("many scenarios: filtered by category and to the ones not passed yet, the choice kept in the browser", async ({page}) => {
    const card = (id: string, title: string, category: string, passed = false) => ({
      id, title, summary: null, category, difficulty: 1, max_score: 5, pass_percent: 70, published: true, updated_at: "2026-10-01T00:00:00Z", steps: 3,
      result: passed ? {scenario_id: id, user_id: "u", best_score: 5, max_score: 5, best_percent: 100, passed: true, attempts: 1, last_run_at: "2026-10-06T00:00:00Z"} : null,
      stats: null,
    });
    const scenarios = [
      card("t1", "Igazoltatás ADAM egységben", "traffic", true), card("t2", "Traffipax-ellenőrzés", "traffic"), card("t3", "Ittas sofőr", "traffic"),
      card("r1", "Rádióetikett", "radio", true), card("r2", "Betörésjelzés", "radio"), card("a1", "PIT vagy nem PIT?", "arrest"),
      card("a2", "Felony stop", "arrest", true),
    ];
    await mockSupabase(page, {
      tables: {profiles: [testProfile({faction_rank: "Deputy Sheriff II.", system_role: "user"})]},
      rpc: {get_practice_overview: overview({scenarios}), get_scenario: {...scenario, id: "t2", title: "Traffipax-ellenőrzés"}},
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/practice");
    const grid = page.locator('[data-tour="practice-scenarios"] article');
    await expect(page.getByText("3/7 teljesítve")).toBeVisible();
    await expect(grid).toHaveCount(7);

    await page.getByRole("button", {name: "Közlekedés 3"}).click();
    await expect(grid).toHaveCount(3);
    await page.getByRole("switch").click();
    await expect(grid).toHaveCount(2);
    await expect(grid.filter({hasText: "Igazoltatás ADAM egységben"})).toHaveCount(0);

    // Back from a scenario: the same selection.
    await grid.filter({hasText: "Traffipax-ellenőrzés"}).getByRole("button", {name: /Kezdés/}).click();
    await page.getByRole("button", {name: /^Gyakorlás$/}).first().click();
    await expect(grid).toHaveCount(2);
    await expect(page.getByRole("button", {name: "Közlekedés 3"})).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", {name: "Elfogás 2"}).click();
    await expect(grid).toHaveCount(1);
    await page.getByRole("button", {name: "Rádió 2"}).click();
    await expect(grid).toHaveCount(1);
    await page.getByRole("button", {name: "Mind 7"}).click();
    await expect(grid).toHaveCount(4);
  });
});
