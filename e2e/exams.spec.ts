import {expect, test} from "@playwright/test";
import {login, mockSupabase} from "./support/mock-supabase";

const EXAM_ID = "44444444-4444-4444-8444-444444444444";
const ATTEMPT_ID = "55555555-5555-4555-8555-555555555555";
const SHEET_ID = "66666666-6666-4666-8666-666666666666";
const SECRET = "a".repeat(48);
const iso = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();

const intro = (attempt: unknown = null) => () => ({
  server_now: iso(),
  exam: {
    id: EXAM_ID, title: "TGF Felvételi", description: "Teszt vizsga", type: "trainee", division: null, time_limit_minutes: 30,
    passing_percentage: 70, is_public: true, is_active: true, block_clipboard: false, shuffle_questions: false, auto_grade: false,
    question_count: 2, page_count: 1,
  },
  viewer: {signed_in: false, member: false, name: null},
  block: null,
  attempt,
  last: null,
});

const questions = (answers: Record<string, unknown> = {}) => [
  {id: "q1", page_number: 1, question_text: "Mi a Discord neved?", question_type: "text", points: 0, is_required: true, options: [],
    answer: answers.q1 ?? null},
  {id: "q2", page_number: 1, question_text: "Mit jelent a Code 3?", question_type: "single_choice", points: 2, is_required: true,
    options: [{id: "o1", option_text: "Megkülönböztető jelzés"}, {id: "o2", option_text: "Járőrözés"}], answer: answers.q2 ?? null},
];

const attemptPayload = (deadlineMs: number, answers: Record<string, unknown> = {}) => () => ({
  server_now: iso(), finished: false, secret: SECRET,
  attempt: {id: ATTEMPT_ID, status: "in_progress", started_at: iso(-60_000), deadline: iso(deadlineMs), applicant_name: "Vendég Vilmos"},
  exam: {id: EXAM_ID, title: "TGF Felvételi", description: null, type: "trainee", time_limit_minutes: 30, passing_percentage: 70,
    block_clipboard: false, auto_grade: false},
  pages: [{page_number: 1, title: "Alapok", description: null}],
  questions: questions(answers),
});

const saved = () => ({server_now: iso(), finished: false, saved_at: iso(), attempt: {id: ATTEMPT_ID, status: "in_progress", deadline: iso(30 * 60_000)}});
const handedIn = (reason: string) => () => ({
  server_now: iso(), finished: true,
  attempt: {id: ATTEMPT_ID, status: "pending", deadline: iso(), finish_reason: reason, claim_token: "TR-TEST-CODE"},
});

test.describe("taking an exam", () => {
  test("a guest works on the server's clock, autosaves, reviews and gets a claim code", async ({page}) => {
    const mock = await mockSupabase(page, {
      rpc: {get_exam_intro: intro(), start_exam: attemptPayload(30 * 60_000), save_exam_progress: saved, finish_exam: handedIn("submitted")},
    });
    await page.goto(`/exam/public/${EXAM_ID}`);
    await expect(page.getByText("Tisztességes vizsga")).toBeVisible();
    await page.getByPlaceholder("Például: John Doe").fill("Vendég Vilmos");
    await page.getByRole("button", {name: "Vizsga indítása"}).click();

    await expect(page.getByText("Nem pontozott")).toBeVisible();
    await expect(page.getByText("2 pont")).toBeVisible();
    await expect(page.getByRole("timer")).toContainText(/^(29|30):/);
    expect(mock.requests.find((request) => request.name === "start_exam")?.body).toMatchObject({_applicant_name: "Vendég Vilmos"});

    await page.getByRole("textbox", {name: "1. kérdés válasza"}).fill("vilmos#1234");
    await page.getByRole("radio", {name: "Megkülönböztető jelzés"}).click();
    // Autosave a few seconds after the last change.
    await expect.poll(() => mock.count("rpc", "save_exam_progress"), {timeout: 12_000}).toBeGreaterThan(0);
    const save = mock.requests.find((request) => request.name === "save_exam_progress");
    expect(save?.body).toMatchObject({_attempt_id: ATTEMPT_ID, _secret: SECRET});
    // The browser keeps the guest's attempt (secret) to continue it after a reload.
    expect(await page.evaluate((id) => localStorage.getItem(`frakhub.exam.guest.${id}`), EXAM_ID)).toContain(ATTEMPT_ID);

    await page.getByRole("navigation").getByRole("button", {name: "Áttekintés és leadás"}).click();
    await expect(page.getByText("Minden kötelező kérdésre válaszoltál")).toBeVisible();
    await page.getByRole("button", {name: "Vizsga leadása"}).first().click();
    await page.getByRole("alertdialog").getByRole("button", {name: "Leadás"}).click();

    await expect(page.getByText("TR-TEST-CODE")).toBeVisible();
    expect(mock.count("rpc", "start_exam")).toBe(1);
    expect(mock.count("rpc", "finish_exam")).toBe(1);
    const finish = mock.requests.find((request) => request.name === "finish_exam")?.body as {_answers: Record<string, {text?: string; options?: string[]}>};
    expect(finish._answers.q1.text).toBe("vilmos#1234");
    expect(finish._answers.q2.options).toEqual(["o1"]);
    // The exam tables are never read or written directly, and nobody is threatened with warnings.
    expect(mock.requests.some((request) => request.kind === "rest" && request.name.startsWith("exam"))).toBe(false);
    await expect(page.getByText(/WARNING|FIGYELEM|ANTI-CHEAT/i)).toHaveCount(0);
  });

  test("a required answer is asked for before the hand-in", async ({page}) => {
    const mock = await mockSupabase(page, {
      rpc: {get_exam_intro: intro(), start_exam: attemptPayload(30 * 60_000), save_exam_progress: saved, finish_exam: handedIn("submitted")},
    });
    await page.goto(`/exam/public/${EXAM_ID}`);
    await page.getByPlaceholder("Például: John Doe").fill("Vendég Vilmos");
    await page.getByRole("button", {name: "Vizsga indítása"}).click();
    await page.getByRole("navigation").getByRole("button", {name: "Áttekintés és leadás"}).click();
    await page.getByRole("button", {name: "Vizsga leadása"}).first().click();

    await expect(page.getByText("2 kötelező kérdés még válaszra vár")).toBeVisible();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    expect(mock.count("rpc", "finish_exam")).toBe(0);
  });

  test("a reload continues the open attempt with its saved answers", async ({page}) => {
    const mock = await mockSupabase(page, {
      rpc: {
        get_exam_intro: intro({id: ATTEMPT_ID, status: "in_progress", deadline: iso(20 * 60_000)}),
        start_exam: attemptPayload(20 * 60_000, {q1: {text: "vilmos#1234", options: [], points: 0, comment: null, pasted: 0}}),
        save_exam_progress: saved,
      },
    });
    await page.goto(`/exam/public/${EXAM_ID}`);
    await expect(page.getByRole("textbox", {name: "1. kérdés válasza"})).toHaveValue("vilmos#1234");
    await expect(page.getByRole("timer")).toContainText(/^(19|20):/);
    // Straight back into the exam: no start page, no new attempt.
    await expect(page.getByRole("button", {name: "Vizsga indítása"})).toHaveCount(0);
    expect(mock.count("rpc", "start_exam")).toBe(1);
  });

  test("the sheet is handed in automatically when the time is up", async ({page}) => {
    const mock = await mockSupabase(page, {
      rpc: {get_exam_intro: intro(), start_exam: attemptPayload(4000), save_exam_progress: saved, finish_exam: handedIn("time_up")},
    });
    await page.goto(`/exam/public/${EXAM_ID}`);
    await page.getByPlaceholder("Például: John Doe").fill("Vendég Vilmos");
    await page.getByRole("button", {name: "Vizsga indítása"}).click();
    await page.getByRole("textbox", {name: "1. kérdés válasza"}).fill("félkész válasz");

    await expect(page.getByText("Lejárt az idő, a lapot leadtuk")).toBeVisible({timeout: 10_000});
    expect(mock.count("rpc", "finish_exam")).toBe(1);
    const finish = mock.requests.find((request) => request.name === "finish_exam")?.body as {_answers: Record<string, {text?: string}>};
    expect(finish._answers.q1.text).toBe("félkész válasz");
  });
});

const hubExam = {
  id: EXAM_ID, title: "SEB alapvizsga", description: "Taktika", type: "division_exam", division: "SEB", required_rank: null,
  min_days_in_rank: 0, time_limit_minutes: 20, passing_percentage: 80, is_public: false, is_active: true, is_invitation_only: false,
  allow_sharing: false, created_by: null, created_at: "2026-01-01T00:00:00Z", shuffle_questions: true, shuffle_options: false,
  block_clipboard: false, auto_grade: false, retry_cooldown_hours: 24, question_count: 10, block: null, open_attempt: null, last: null,
};

const hub = {
  server_now: new Date().toISOString(),
  exams: [hubExam, {...hubExam, id: "77777777-7777-4777-8777-777777777777", title: "Másik osztály vizsgája",
    block: {code: "division", message: "Ez a vizsga másik osztály tagjainak szól."}}],
  mine: [],
  queue: [{
    id: SHEET_ID, exam_id: EXAM_ID, exam_title: "SEB alapvizsga", exam_type: "division_exam", exam_division: "SEB", user_id: null,
    candidate_name: "Vendég Viktor", badge_number: null, avatar_url: null, start_time: "2026-10-01T10:00:00Z", end_time: "2026-10-01T10:20:00Z",
    finish_reason: "submitted", integrity: {away_count: 3, away_ms: 95_000, longest_away_ms: 60_000, paste_count: 0, paste_chars: 0},
    tab_switch_count: 3, total_score: 4, max_score: 10, open_questions: 2,
  }],
  live: [],
};

test.describe("exam centre and grading", () => {
  test("the exam centre loads with one request and lists the grading queue", async ({page}) => {
    const mock = await mockSupabase(page, {rpc: {get_exam_hub: hub}});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/exams");

    await expect(page.getByRole("heading", {name: "SEB alapvizsga"})).toBeVisible();
    // Exams for another division are not offered.
    await expect(page.getByText("Másik osztály vizsgája")).toHaveCount(0);
    await page.getByRole("tab", {name: /Javítás/}).click();
    await expect(page.getByText("Vendég Viktor")).toBeVisible();
    await expect(page.getByText("2 kifejtős kérdés vár pontozásra")).toBeVisible();
    await expect(page.getByText("Érdemes átnézni")).toBeVisible();

    expect(mock.count("rpc", "get_exam_hub")).toBe(1);
    expect(mock.requests.some((request) => request.kind === "rest" && request.name.startsWith("exam"))).toBe(false);
  });

  test("a grader scores the essay and decides in one request", async ({page}) => {
    const sheet = {
      server_now: new Date().toISOString(),
      viewer: {grader: true, can_grade: true, can_trash: true, can_purge: false},
      sheet: {
        id: SHEET_ID, exam_id: EXAM_ID, user_id: null, candidate_name: "Vendég Viktor", applicant_name: "Vendég Viktor", badge_number: null,
        avatar_url: null, status: "pending", start_time: "2026-10-01T10:00:00Z", end_time: "2026-10-01T10:20:00Z", deadline: "2026-10-01T10:30:00Z",
        finish_reason: "submitted", last_seen_at: null, total_score: 2, max_score: 5, grading_notes: null, graded_at: null, graded_by_name: null,
        feedback_visible: false, retry_allowed_at: null, deleted_at: null, tab_switch_count: 1,
        integrity: {away_count: 1, away_ms: 4000, longest_away_ms: 4000, paste_count: 1, paste_chars: 120},
        integrity_log: [{k: "away", at: 30_000, d: 4000, p: 1}, {k: "paste", at: 60_000, n: 120, q: "q3"}],
        claim_token: "TR-ABCD-EFGH",
      },
      exam: {id: EXAM_ID, title: "SEB alapvizsga", type: "division_exam", division: "SEB", passing_percentage: 80, time_limit_minutes: 30, retry_cooldown_hours: 24},
      pages: [],
      questions: [
        {id: "q2", page_number: 1, question_text: "Mit jelent a Code 3?", question_type: "single_choice", points: 2, is_required: true,
          options: [{id: "o1", option_text: "Megkülönböztető jelzés", is_correct: true}, {id: "o2", option_text: "Járőrözés", is_correct: false}],
          answer: {text: null, options: ["o1"], points: 2, comment: null, pasted: 0}, guide: null, auto_points: 2},
        {id: "q3", page_number: 1, question_text: "Miért szeretnél csatlakozni?", question_type: "text", points: 3, is_required: true, options: [],
          answer: {text: "Szeretnék segíteni a városnak.", options: [], points: 0, comment: null, pasted: 120},
          guide: "Teljes pont: konkrét ok, két mondat.", auto_points: null},
      ],
    };
    const mock = await mockSupabase(page, {
      rpc: {get_exam_sheet: sheet, get_exam_hub: hub, grade_exam_submission: {id: SHEET_ID, status: "passed", total_score: 5, max_score: 5}},
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/exams/grading/${SHEET_ID}`);

    await expect(page.getByText("Teljes pont: konkrét ok, két mondat.")).toBeVisible();
    await expect(page.getByText(/Beillesztett szöveg: 120 karakter/)).toBeVisible();
    await expect(page.getByText("Szöveget illesztett be · 120 karakter · 2. kérdés")).toBeVisible();
    await page.locator("#sheet-question-q3").getByRole("button", {name: "3 (max)"}).click();
    await expect(page.getByText("A pontszám alapján: sikeres")).toBeVisible();
    await page.getByRole("button", {name: "Sikeres"}).click();

    await expect(page).toHaveURL(/\/exams\?tab=grading$/);
    expect(mock.count("rpc", "grade_exam_submission")).toBe(1);
    expect(mock.requests.find((request) => request.name === "grade_exam_submission")?.body).toMatchObject({
      _submission_id: SHEET_ID, _status: "passed", _retry_hours: 24,
      _scores: {q2: {points: 2}, q3: {points: 3}},
    });
  });

  test("a clean attempt reads as clean; only a sheet from before the exam system has no log", async ({page}) => {
    // A clean attempt sends no events, so the server never writes its totals (2026-10-10: the first one
    // on prod was labelled as an old sheet).
    const sheet = (overrides: Record<string, unknown>) => ({
      server_now: new Date().toISOString(),
      viewer: {grader: true, can_grade: true, can_trash: false, can_purge: false},
      sheet: {
        id: SHEET_ID, exam_id: EXAM_ID, user_id: null, candidate_name: "Vendég Viktor", applicant_name: "Vendég Viktor", badge_number: null,
        avatar_url: null, status: "pending", start_time: "2026-10-01T10:00:00Z", end_time: "2026-10-01T10:20:00Z", deadline: "2026-10-01T10:30:00Z",
        finish_reason: "submitted", last_seen_at: null, total_score: 0, max_score: 3, grading_notes: null, graded_at: null, graded_by_name: null,
        feedback_visible: false, retry_allowed_at: null, deleted_at: null, tab_switch_count: 0, integrity: {}, integrity_log: [], claim_token: null,
        ...overrides,
      },
      exam: {id: EXAM_ID, title: "SEB alapvizsga", type: "division_exam", division: "SEB", passing_percentage: 80, time_limit_minutes: 30, retry_cooldown_hours: 24},
      pages: [],
      questions: [{id: "q3", page_number: 1, question_text: "Miért szeretnél csatlakozni?", question_type: "text", points: 3, is_required: true, options: [],
        answer: {text: "Szeretnék segíteni a városnak.", options: [], points: 0, comment: null, pasted: 0}, guide: null, auto_points: null}],
    });
    let current = sheet({});
    await mockSupabase(page, {rpc: {get_exam_sheet: () => current, get_exam_hub: hub}});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/exams/grading/${SHEET_ID}`);

    const panel = page.locator("[data-tour=grading-integrity]");
    await expect(panel.getByText("Nincs eltérés")).toBeVisible();
    await expect(panel.getByText("A vizsgázó végig az oldalon maradt, nem illesztett be szöveget.")).toBeVisible();
    await expect(panel.getByText(/Régi vizsgalap/)).toHaveCount(0);

    current = sheet({deadline: null, finish_reason: null, tab_switch_count: 2});
    await page.reload();
    await expect(panel.getByText("Régi vizsgalap: 2× fókuszvesztés, időpontok nélkül.")).toBeVisible();
  });
});

test("long unbroken text wraps on the exam start page and in the runner (390px)", async ({page}) => {
  const long = "rsgysdgrrsgysdgr".repeat(24);
  await page.setViewportSize({width: 390, height: 844});
  const payload = attemptPayload(30 * 60_000, {q1: {text: long, options: [], points: 0, comment: null, pasted: 0}});
  await mockSupabase(page, {
    rpc: {
      get_exam_intro: () => ({...intro()(), exam: {...intro()().exam, title: long.slice(0, 120), description: long}}),
      start_exam: () => {
        const reply = payload();
        return {...reply, questions: reply.questions.map((question) => ({...question, question_text: long}))};
      },
      save_exam_progress: saved,
    },
  });
  await page.goto(`/exam/public/${EXAM_ID}`);
  await expect(page.getByRole("button", {name: "Vizsga indítása"})).toBeVisible();
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(await overflow()).toBeLessThanOrEqual(0);

  await page.getByPlaceholder("Például: John Doe").fill("Vendég Vilmos");
  await page.getByRole("button", {name: "Vizsga indítása"}).click();
  await expect(page.getByRole("textbox", {name: "1. kérdés válasza"})).toHaveValue(long);
  expect(await overflow()).toBeLessThanOrEqual(0);
});

test.describe("Hungarian time", () => {
  // A browser reporting UTC (privacy modes, misconfigured machines) still sees Hungarian time.
  test.use({timezoneId: "UTC"});

  test("times are shown in Hungarian time whatever the browser's time zone", async ({page}) => {
    await mockSupabase(page, {
      rpc: {
        get_exam_hub: {
          ...hub,
          mine: [{id: SHEET_ID, exam_id: EXAM_ID, exam_title: "SEB alapvizsga", status: "passed", total_score: 9, max_score: 10, percentage: 90,
            passing_percentage: 80, start_time: "2026-07-01T22:30:00Z", end_time: "2026-07-01T22:50:00Z", deadline: null,
            retry_allowed_at: null, feedback_visible: false, graded_at: null, finish_reason: "submitted"}],
        },
      },
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/exams?tab=history");
    // 22:30 UTC on 1 July is 00:30 on 2 July in Budapest (summer time, UTC+2).
    await expect(page.getByText("2026.07.02. 00:30")).toBeVisible();
  });
});
