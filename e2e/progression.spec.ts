import {expect, test} from "@playwright/test";
import {login, mockSupabase, TEST_USER_ID, testProfile} from "./support/mock-supabase";

const NOW = "2026-10-01T12:00:00Z";
const member = (id: string, name: string, rank: string, extra: Record<string, unknown> = {}) => testProfile({
  id, email: undefined, full_name: name, badge_number: id.slice(0, 4), faction_rank: rank, system_role: "user", ...extra,
});
const me = testProfile({faction_rank: "Sergeant I.", system_role: "supervisor"});
const deputy = member("d1000000-0000-4000-8000-000000000001", "Deputy Dénes", "Deputy Sheriff II.");
const mentor = member("m1000000-0000-4000-8000-000000000001", "Mentor Márk", "Senior Deputy Sheriff");
const trainee = member("t1000000-0000-4000-8000-000000000001", "Újonc Ubul", "Deputy Sheriff Trainee");

const check = (key: string, label: string, ok = true) => ({key, label, value: 1, target: 1, unit: "db", ok});

test.describe("HR progression", () => {
  test("the staff sees who is ready and nominates with a reason", async ({page}) => {
    const mock = await mockSupabase(page, {
      tables: {profiles: [me, deputy]},
      rpc: {
        get_promotion_board: {
          criteria: [{rank: "Deputy Sheriff III.", min_days_in_rank: 14, min_duty_hours: 30, window_months: 1, min_reports: 8, max_warnings: 0, exam_ids: [],
            note: null, updated_at: NOW, updated_by: null}],
          exams: [], can_edit_criteria: false, nominations: [],
          members: [{user_id: deputy.id, full_name: "Deputy Dénes", badge_number: "d100", faction_rank: "Deputy Sheriff II.", rank_order: 14, division: "TSB",
            avatar_url: null, next_rank: "Deputy Sheriff III.", configured: true, since: "2026-08-01", days_in_rank: 60,
            checks: [check("days", "Idő a jelenlegi rangban"), check("duty", "Duty idő (előző hónap)"), check("reports", "Jelentések (előző hónap)")],
            missing: 0, eligible: true, on_leave: false, activity_status: "active", nomination: null}],
        },
        nominate_for_promotion: {id: "n1"},
      },
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/hr?tab=promotions");

    const row = page.locator('[data-tour="hr-promotions"] li').filter({hasText: "Deputy Dénes"});
    await expect(row.getByText("Duty idő (előző hónap)")).toBeVisible();
    await expect(row.getByRole("button", {name: /Előléptetés/})).toBeVisible();
    await row.getByRole("button", {name: /Javaslom/}).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", {name: /Javaslat küldése/})).toBeDisabled();
    await dialog.getByLabel("Miért javaslod?").fill("Megbízható járőr, mindig pontos jelentéseket ír.");
    await dialog.getByRole("button", {name: /Javaslat küldése/}).click();
    await expect(page.getByText("Javaslat elküldve.")).toBeVisible();
    expect(mock.requests.find((request) => request.name === "nominate_for_promotion")?.body)
      .toEqual({_user_id: deputy.id, _reason: "Megbízható járőr, mindig pontos jelentéseket ír."});

    // Criteria are read-only below the executive staff.
    await page.getByRole("button", {name: /Feltételek/}).click();
    await expect(page.getByRole("dialog").getByText("a vezérkar állítja be")).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("button", {name: /Mentés:/})).toHaveCount(0);
  });

  test("a coach gives a trainee a mentor for the trainee week", async ({page}) => {
    const mock = await mockSupabase(page, {
      tables: {profiles: [me, mentor, trainee]},
      rpc: {
        get_trainees: [{user_id: trainee.id, full_name: "Újonc Ubul", badge_number: "t100", avatar_url: null, joined_on: "2026-10-03", days: 2, mentor: null,
          assigned_at: null, signed_off_at: null, sign_off_note: null, signed_off_by_name: null, is_mentor: false, ready: false, notes: [],
          checks: [{key: "exam", label: "Felvételi vizsga", ok: true}, {key: "academy", label: "Alapképzés napjai", value: 2, target: 5, ok: false},
            {key: "mentor", label: "Mentor jóváhagyása", ok: false}]}],
        assign_trainee_mentor: {trainee_id: trainee.id, mentor_id: mentor.id},
      },
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/hr?tab=trainees");

    await expect(page.getByText("3. nap")).toBeVisible();
    await expect(page.getByText("Nincs még mentora")).toBeVisible();
    await page.getByRole("button", {name: /Mentor kijelölése/}).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("option", {name: /Mentor Márk/}).click();
    await dialog.getByRole("button", {name: /Kijelölés/}).click();
    await expect(page.getByText("Mentor kijelölve.")).toBeVisible();
    expect(mock.requests.find((request) => request.name === "assign_trainee_mentor")?.body).toEqual({_trainee_id: trainee.id, _mentor_id: mentor.id});
  });

  test("the activity watch only flags recorded duty time and a reminder is sent by hand", async ({page}) => {
    const mock = await mockSupabase(page, {
      tables: {profiles: [me, deputy]},
      rpc: {
        get_activity_watch: {months: ["2026-09-01", "2026-08-01"], recorded: [true, true], min_minutes: 1800, members: [{
          user_id: deputy.id, full_name: "Deputy Dénes", badge_number: "d100", faction_rank: "Deputy Sheriff II.", avatar_url: null, activity_status: "active",
          m1_minutes: 420, m2_minutes: 300, m1_leave: false, m2_leave: false, level: 2, review: null, reviewed_at: null, reviewed_by: null}]},
        send_activity_reminder: {review: "reminded"},
      },
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/hr?tab=duty");

    const watch = page.locator('[data-tour="hr-activity-watch"]');
    await expect(watch.getByText("2. hónapja")).toBeVisible();
    await expect(watch.getByText(/Automatikusan senki nem kap üzenetet/)).toBeVisible();
    await watch.getByRole("button", {name: /Emlékeztető/}).click();
    await page.getByRole("dialog").getByRole("button", {name: /Küldés/}).click();
    await expect(page.getByText("Emlékeztető elküldve.")).toBeVisible();
    expect(mock.requests.find((request) => request.name === "send_activity_reminder")?.body).toMatchObject({_user_id: deputy.id});
  });
});

test.describe("case tasks", () => {
  test("the case editors add a task to the to-do list", async ({page}) => {
    const caseId = "22222222-2222-4222-8222-222222222222";
    const mock = await mockSupabase(page, {
      tables: {profiles: [testProfile({division: "MCB", division_rank: "Investigator II."})]},
      rpc: {
        get_case_list: [],
        get_case_detail: {
          case: {id: caseId, case_number: "SD-192/007/261001", title: "Éjszakai Bagoly", description: null, status: "open", priority: "high", category: null,
            theme: "default", owner_id: TEST_USER_ID, created_at: NOW, updated_at: NOW, closed_at: null, body_version: 1, body_updated_by: TEST_USER_ID,
            body_updated_by_name: "John Doe", body: []},
          owner: {id: TEST_USER_ID, full_name: "John Doe", badge_number: "1192", faction_rank: "Sergeant I.", division: "MCB", division_rank: "Investigator II.", avatar_url: null},
          collaborators: [], evidence: [], people: [], warrants: [], tasks: [], items: [], suggestions: [],
          viewer: {role: "owner", can_edit: true, can_manage: true, is_lead: false, can_approve: true},
        },
        save_case_task: (args: {_title: string; _assignee_id: string | null}) => ({
          id: "task1", case_id: caseId, title: args._title, assignee_id: args._assignee_id, due_on: null, done_at: null, created_at: NOW,
          created_by: TEST_USER_ID, overdue: false, assignee: null, done_by_name: null, created_by_name: "John Doe",
        }),
      },
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/mcb/case/${caseId}`);
    await page.getByRole("tab", {name: "Teendők"}).click();
    await page.getByRole("button", {name: /Új teendő/}).click();
    await page.getByPlaceholder("Mi a teendő?").fill("Kamerafelvételek bekérése");
    await page.getByRole("button", {name: "Mentés", exact: true}).last().click();
    await expect(page.locator('[data-tour="case-tasks"]').getByText("Kamerafelvételek bekérése")).toBeVisible();
    expect(mock.requests.find((request) => request.name === "save_case_task")?.body)
      .toMatchObject({_case_id: caseId, _task_id: null, _title: "Kamerafelvételek bekérése", _assignee_id: null, _due_on: null});
  });
});
