import {isHighCommand, isSupervisory} from "@shared/ranks";
import type {Row} from "../postgrest";
import {DAY, DEMO, SandboxError, type RpcHandler, type World} from "./context";
import {person} from "./people";

export const DEMO_SHEET = DEMO.sheet(1);

interface DemoQuestion {
  id: string;
  page_number: number;
  question_text: string;
  question_type: "text" | "single_choice" | "multiple_choice";
  points: number;
  is_required: boolean;
  guide: string | null;
  options: {id: string; option_text: string; is_correct: boolean}[];
}

const option = (id: string, option_text: string, is_correct = false) => ({id, option_text, is_correct});

/** The questions of the demo admission exam (the sheet to grade). */
const QUESTIONS: DemoQuestion[] = [
  {id: "de-q1", page_number: 1, question_text: "Mit jelent a 10-4 rádiókód?", question_type: "single_choice", points: 1, is_required: true, guide: null,
    options: [option("de-q1a", "Vettem, értettem", true), option("de-q1b", "Segítséget kérek"), option("de-q1c", "Úton vagyok a helyszínre")]},
  {id: "de-q2", page_number: 1, question_text: "Mi kötelező egy közúti ellenőrzésnél?", question_type: "multiple_choice", points: 2, is_required: true,
    guide: null, options: [option("de-q2a", "Bemutatkozás és a jelvény felmutatása", true), option("de-q2b", "Az ellenőrzés okának közlése", true),
      option("de-q2c", "A fegyver előhúzása")]},
  {id: "de-q3", page_number: 2, question_text: "Mikor használhatsz lőfegyvert? Írd le röviden.", question_type: "text", points: 4, is_required: true,
    guide: "Teljes pont: közvetlen életveszély, arányosság, ha lehet, előzetes figyelmeztetés. Részpont, ha egy elem hiányzik.", options: []},
  {id: "de-q4", page_number: 2, question_text: "Mi a teendő, ha ittas sofőrt állítasz meg?", question_type: "text", points: 3, is_required: true,
    guide: "Megállítás, alkoholszonda, pozitív eredménynél előállítás és jármű lefoglalása.", options: []},
  {id: "de-q5", page_number: 2, question_text: "Ki hagyhatja jóvá a házkutatási parancsot?", question_type: "single_choice", points: 1, is_required: true,
    guide: null, options: [option("de-q5a", "Bármelyik járőr"), option("de-q5b", "Supervisory Staff és felette, illetve Investigator III.", true),
      option("de-q5c", "A bejelentő")]},
];

const ANSWERS: Record<string, {text: string | null; options: string[]; pasted: number}> = {
  "de-q1": {text: null, options: ["de-q1a"], pasted: 0},
  "de-q2": {text: null, options: ["de-q2a", "de-q2b"], pasted: 0},
  "de-q3": {text: "Csak közvetlen életveszély esetén, ha más eszköz nem elég. Ha lehet, előtte figyelmeztetek.", options: [], pasted: 0},
  "de-q4": {text: "Megállítom, megszondáztatom, és ha pozitív, előállítom.", options: [], pasted: 38},
  "de-q5": {text: null, options: ["de-q5a"], pasted: 0},
};

const autoPoints = (question: DemoQuestion, chosen: string[]) => {
  if (question.question_type === "text") return null;
  const correct = question.options.filter((item) => item.is_correct).map((item) => item.id).sort().join(",");
  return chosen.slice().sort().join(",") === correct ? question.points : 0;
};

const examRow = (n: number, title: string, description: string, type: string, extra: Row = {}): Row => ({
  id: DEMO.exam(n), title, description, type, division: null, required_rank: null, min_days_in_rank: 0, time_limit_minutes: 30,
  passing_percentage: 70, is_public: false, is_active: true, is_invitation_only: false, allow_sharing: false, shuffle_questions: true,
  shuffle_options: true, block_clipboard: true, auto_grade: false, retry_cooldown_hours: 24, created_by: person(1), created_at: "2026-01-10T18:00:00Z",
  ...extra,
});

export function seedExams(world: World) {
  const {tables, me, ago} = world;
  tables.exams = [
    examRow(1, "TGF felvételi vizsga", "Alapismeretek a felvételhez: rádiózás, intézkedés, fegyverhasználat.", "trainee", {is_public: true}),
    examRow(2, "Deputy I. vizsga", "Az akadémia lezárása: KRESZ, intézkedések, büntető törvénykönyv.", "deputy_i", {time_limit_minutes: 25, passing_percentage: 75}),
    examRow(3, "SAHP képesítő vizsga", "Autópálya-rendészet: üldözés, útzár, sebességmérés.", "other", {auto_grade: true}),
    examRow(4, "MCB alapvizsga", "Nyomozati alapismeretek az MCB-be lépéshez.", "division_exam", {division: "MCB", passing_percentage: 80}),
  ];

  const sheet = (n: number, examId: string, userId: string | null, status: string, minutesAgo: number, extra: Row = {}): Row => ({
    id: DEMO.sheet(n), exam_id: examId, user_id: userId, applicant_name: null, status, start_time: ago(minutesAgo + 26),
    end_time: status === "in_progress" ? null : ago(minutesAgo), deadline: ago(minutesAgo - 4), finish_reason: status === "in_progress" ? null : "submitted",
    total_score: null, max_score: 11, grading_notes: null, graded_at: null, graded_by: null, feedback_visible: false, retry_allowed_at: null,
    deleted_at: null, tab_switch_count: 1, created_at: ago(minutesAgo + 26), ...extra,
  });
  tables.exam_submissions = [
    sheet(1, DEMO.exam(1), person(13), "pending", 95),
    sheet(2, DEMO.exam(1), person(12), "pending", 4 * 60),
    sheet(3, DEMO.exam(2), me.id, "passed", 3 * DAY, {total_score: 19, max_score: 22, graded_at: ago(3 * DAY - 60), graded_by: person(5),
      feedback_visible: true}),
    sheet(4, DEMO.exam(3), person(11), "in_progress", -10, {start_time: ago(12), deadline: new Date(Date.now() + 18 * 60_000).toISOString()}),
    sheet(5, DEMO.exam(1), person(11), "passed", 30 * DAY, {total_score: 10, max_score: 11, graded_at: ago(30 * DAY), graded_by: person(5)}),
  ];
}

const isGrader = (world: World) => {
  const me = world.me;
  return !!me.is_bureau_manager || !!me.qualifications?.includes("TB") || isSupervisory(me) || isHighCommand(me);
};

const percentage = (row: Row) => row.total_score !== null && row.max_score ? Math.round((Number(row.total_score) / Number(row.max_score)) * 100) : null;

function candidate(world: World, row: Row) {
  const profile = world.person(row.user_id as string);
  return {name: profile?.full_name as string ?? (row.applicant_name as string) ?? "Vendég", badge: profile?.badge_number ?? null, avatar: profile?.avatar_url ?? null};
}

function sheetQuestions(submission: Row, grader: boolean) {
  const graded = (submission.scores ?? {}) as Record<string, {points: number; comment: string}>;
  return QUESTIONS.map((question) => {
    const answer = ANSWERS[question.id];
    const auto = autoPoints(question, answer.options);
    const score = graded[question.id];
    return {
      id: question.id, page_number: question.page_number, question_text: question.question_text, question_type: question.question_type,
      points: question.points, is_required: question.is_required,
      options: question.options.map((item) => (grader ? item : {id: item.id, option_text: item.option_text})),
      answer: {...answer, points: score?.points ?? auto, comment: score?.comment ?? null},
      ...(grader ? {guide: question.guide, auto_points: auto} : {}),
    };
  });
}

export const examsRpc: Record<string, RpcHandler> = {
  get_exam_hub: (_args, world) => {
    const {tables, me} = world;
    const sheets = (tables.exam_submissions ?? []).filter((row) => !row.deleted_at);
    const examOf = (id: unknown) => (tables.exams ?? []).find((exam) => exam.id === id);
    const grader = isGrader(world);
    return {
      server_now: world.stamp(),
      exams: (tables.exams ?? []).map((exam) => {
        const mine = sheets.filter((row) => row.exam_id === exam.id && row.user_id === me.id)
          .sort((a, b) => String(b.start_time).localeCompare(String(a.start_time)));
        const last = mine[0];
        const block = last?.status === "passed" ? {code: "passed", message: "Ezt a vizsgát már teljesítetted."}
          : exam.type === "trainee" ? {code: "recruits", message: "Ez a vizsga a jelentkezőknek szól."}
            : exam.division && exam.division !== me.division ? {code: "division", message: `Csak a(z) ${exam.division} tagjainak.`}
              : null;
        return {
          ...exam, question_count: exam.id === DEMO.exam(1) ? QUESTIONS.length : 20, block, open_attempt: null,
          last: last ? {id: last.id, status: last.status, end_time: last.end_time, retry_allowed_at: last.retry_allowed_at, percentage: percentage(last)} : null,
        };
      }),
      mine: sheets.filter((row) => row.user_id === me.id).map((row) => {
        const exam = examOf(row.exam_id);
        return {
          id: row.id, exam_id: row.exam_id, exam_title: exam?.title ?? "", status: row.status, total_score: row.total_score, max_score: row.max_score,
          percentage: percentage(row), passing_percentage: exam?.passing_percentage ?? 70, start_time: row.start_time, end_time: row.end_time,
          deadline: row.deadline, retry_allowed_at: row.retry_allowed_at, feedback_visible: !!row.feedback_visible, graded_at: row.graded_at,
          finish_reason: row.finish_reason,
        };
      }),
      queue: grader ? sheets.filter((row) => row.status === "pending").map((row) => {
        const exam = examOf(row.exam_id);
        const who = candidate(world, row);
        return {
          id: row.id, exam_id: row.exam_id, exam_title: exam?.title ?? "", exam_type: exam?.type ?? "other", exam_division: exam?.division ?? null,
          user_id: row.user_id, candidate_name: who.name, badge_number: who.badge, avatar_url: who.avatar, start_time: row.start_time,
          end_time: row.end_time, finish_reason: row.finish_reason, tab_switch_count: row.tab_switch_count,
          integrity: {away_count: 1, away_ms: 12_000, paste_count: row.id === DEMO_SHEET ? 1 : 0, paste_chars: row.id === DEMO_SHEET ? 38 : 0},
          total_score: row.total_score, max_score: row.max_score, open_questions: 2,
        };
      }) : [],
      live: grader ? sheets.filter((row) => row.status === "in_progress").map((row) => {
        const who = candidate(world, row);
        return {
          id: row.id, exam_id: row.exam_id, exam_title: examOf(row.exam_id)?.title ?? "", candidate_name: who.name, badge_number: who.badge,
          avatar_url: who.avatar, start_time: row.start_time, deadline: row.deadline, last_seen_at: world.ago(0.5), question_count: 20, answered: 9,
          integrity: {away_count: 0},
        };
      }) : [],
    };
  },

  get_exam_sheet: (args, world) => {
    const row = (world.tables.exam_submissions ?? []).find((item) => item.id === args._submission_id);
    if (!row) throw new SandboxError("A vizsgalap nem található.");
    const exam = (world.tables.exams ?? []).find((item) => item.id === row.exam_id)!;
    const grader = isGrader(world) && row.user_id !== world.me.id;
    const who = candidate(world, row);
    const profile = world.person(row.user_id as string);
    return {
      server_now: world.stamp(),
      viewer: {grader, can_grade: grader, can_trash: grader, can_purge: false},
      sheet: {
        id: row.id, exam_id: row.exam_id, user_id: row.user_id, candidate_name: who.name, applicant_name: row.applicant_name,
        badge_number: profile?.badge_number ?? null, avatar_url: profile?.avatar_url ?? null, status: row.status, start_time: row.start_time,
        end_time: row.end_time, deadline: row.deadline, finish_reason: row.finish_reason, last_seen_at: row.end_time, total_score: row.total_score,
        max_score: row.max_score, grading_notes: row.grading_notes, graded_at: row.graded_at,
        graded_by_name: world.person(row.graded_by as string)?.full_name ?? null, feedback_visible: !!row.feedback_visible,
        retry_allowed_at: row.retry_allowed_at, deleted_at: row.deleted_at, tab_switch_count: row.tab_switch_count,
        integrity: {away_count: 1, away_ms: 12_000, longest_away_ms: 12_000, paste_count: 1, paste_chars: 38, copy_count: 0, blocked_count: 1,
          offline_ms: 0, resume_count: 0},
        integrity_log: [
          {k: "page", at: 340_000, p: 2},
          {k: "away", at: 610_000, d: 12_000},
          {k: "blocked", at: 805_000, x: "copy", q: "de-q3"},
          {k: "paste", at: 1_120_000, n: 38, q: "de-q4"},
        ],
        claim_token: null,
      },
      exam: {id: exam.id, title: exam.title, type: exam.type, division: exam.division, passing_percentage: exam.passing_percentage,
        time_limit_minutes: exam.time_limit_minutes, retry_cooldown_hours: exam.retry_cooldown_hours},
      pages: [{page_number: 1, title: "Alapok", description: null}, {page_number: 2, title: "Intézkedés", description: null}],
      questions: sheetQuestions(row, grader),
    };
  },

  grade_exam_submission: (args, world) => {
    const row = (world.tables.exam_submissions ?? []).find((item) => item.id === args._submission_id);
    if (!row) throw new SandboxError("A vizsgalap nem található.");
    const scores = (args._scores ?? {}) as Record<string, {points: number; comment: string}>;
    const total = QUESTIONS.reduce((sum, question) => {
      const given = scores[question.id]?.points;
      return sum + (given ?? autoPoints(question, ANSWERS[question.id].options) ?? 0);
    }, 0);
    Object.assign(row, {
      status: args._status, total_score: total, max_score: 11, grading_notes: args._notes ?? null, feedback_visible: !!args._feedback_visible,
      graded_at: world.stamp(), graded_by: world.me.id, scores,
      retry_allowed_at: args._status === "failed" ? new Date(Date.now() + Number(args._retry_hours ?? 24) * 3_600_000).toISOString() : null,
    });
    return {status: row.status, total_score: total, max_score: 11};
  },

  get_exam_editor: (args, world) => {
    const exam = (world.tables.exams ?? []).find((item) => item.id === args._exam_id);
    if (!exam) throw new SandboxError("A vizsga nem található.");
    return {
      exam,
      pages: [{page_number: 1, title: "Alapok", description: null, draw_count: null}, {page_number: 2, title: "Intézkedés", description: null, draw_count: null}],
      questions: QUESTIONS.map(({id, page_number, question_text, question_type, points, is_required, guide, options}) =>
        ({id, page_number, question_text, question_type, points, is_required, guide, options})),
      sheet_count: (world.tables.exam_submissions ?? []).filter((row) => row.exam_id === exam.id).length,
      open_attempts: 0,
    };
  },

  save_exam: (args, world) => {
    const id = (args._exam_id as string | null) ?? world.id();
    const exams = (world.tables.exams ??= []);
    const existing = exams.find((item) => item.id === id);
    const values = (args._exam ?? {}) as Row;
    if (existing) Object.assign(existing, values);
    else exams.push({...examRow(9, String(values.title ?? "Új vizsga"), "", "other"), ...values, id, created_by: world.me.id, created_at: world.stamp()});
    return id;
  },

  get_exam_stats: () => ({
    totals: {sheets: 42, graded: 39, passed: 31, failed: 8, pending: 3, avg_percentage: 78, avg_minutes: 21, last_at: new Date().toISOString()},
    questions: QUESTIONS.map((question, index) => ({
      id: question.id, answered: 40 - index, graded: 38 - index, avg_ratio: [0.92, 0.71, 0.64, 0.58, 0.83][index] ?? 0.7,
      option_counts: Object.fromEntries(question.options.map((item, optionIndex) => [item.id, item.is_correct ? 28 - index : 6 + optionIndex])),
    })),
  }),

  exam_submission_trash: (args, world) => {
    const row = (world.tables.exam_submissions ?? []).find((item) => item.id === args._submission_id);
    if (row) row.deleted_at = world.stamp();
    return null;
  },
  exam_submission_restore: (args, world) => {
    const row = (world.tables.exam_submissions ?? []).find((item) => item.id === args._submission_id);
    if (row) row.deleted_at = null;
    return null;
  },
};

/** The `exam_submissions_view` rows (history and trash tabs of the hub). */
export function examViewRows(world: World): Row[] {
  return (world.tables.exam_submissions ?? []).map((row) => {
    const exam = (world.tables.exams ?? []).find((item) => item.id === row.exam_id);
    const profile = world.person(row.user_id as string);
    return {
      ...row, exam_title: exam?.title ?? null, user_full_name: profile?.full_name ?? null, user_badge_number: profile?.badge_number ?? null,
      percentage: percentage(row), deleted_by: null, exam_type: exam?.type ?? null, exam_division: exam?.division ?? null,
      integrity: {away_count: 1, away_ms: 12_000},
    };
  });
}
