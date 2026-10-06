import {isAcademyInstructor} from "@shared/ranks";
import type {Row} from "../postgrest";
import {DAY, DEMO, SandboxError, type RpcHandler, type World} from "./context";
import {person} from "./people";

/**
 * The newer pages in the demo world: case tasks and seized items, practice, policies, polls, the
 * suggestion board, anonymous feedback, certificates, the leaderboard and the monthly recap.
 */

export function seedExtras(world: World) {
  const {tables, me, ago, day} = world;
  tables.case_tasks = [
    {id: world.id(), case_id: DEMO.case(1), title: "Kamerafelvételek bekérése a kikötőből", assignee_id: me.id, due_on: day(2), done_at: null, done_by: null,
      created_by: person(4), created_at: ago(DAY)},
    {id: world.id(), case_id: DEMO.case(1), title: "Tanúkihallgatás: a dokk éjszakás munkása", assignee_id: person(6), due_on: day(-1), done_at: null, done_by: null,
      created_by: person(4), created_at: ago(2 * DAY)},
  ];
  tables.case_items = [];
  tables.practice_progress = [];
  tables.practice_days = [{user_id: me.id, day: day(-1), answered: 12, correct: 10}, {user_id: me.id, day: day(-2), answered: 15, correct: 11}];
  tables.policies = [
    {id: "de-policy-1", title: "Járműhasználati szabályzat (bemutató)", category: "vehicles", summary: "Ki, mikor és hogyan használhatja a frakció járműveit.",
      version: 1, requires_ack: true, status: "published", published_at: ago(5 * DAY), updated_at: ago(5 * DAY), acked: false,
      body: [{type: "heading", props: {level: 2}, content: "Általános szabályok"},
        {type: "paragraph", content: "Szolgálati járművet csak szolgálatban, a kulcs birtokosa vezethet."},
        {type: "bulletListItem", content: "A járművet tisztán és tankolva kell leadni."}]},
  ];
  tables.polls = [
    {id: "de-poll-1", title: "Melyik estén legyen a havi gyűlés? (bemutató)", description: null, audience: "all", anonymous: false, max_choices: 1,
      results: "live", closes_at: new Date(Date.now() + 3 * DAY * 60_000).toISOString(), closed_at: null, created_at: ago(DAY), created_by: person(1),
      options: [{id: "de-option-1", label: "Kedd", votes: 2}, {id: "de-option-2", label: "Csütörtök", votes: 5}, {id: "de-option-3", label: "Vasárnap", votes: 1}],
      voted: null},
  ];
  tables.suggestions = [
    {id: "de-idea-1", title: "Havi közös lőtéri edzés", body: "Havonta egy közös edzés, ahol a felügyelők értékelnek is.", category: "training", status: "planned",
      response: "Novembertől lesz, az első időpont a naptárban.", responded_at: ago(DAY), created_at: ago(6 * DAY), author_id: person(9), votes: 7, voted: false},
  ];
  tables.member_settings = [];
}

const requireTask = (world: World, id: unknown) => {
  const task = (world.tables.case_tasks ?? []).find((row) => row.id === id);
  if (!task) throw new SandboxError("A teendő nem található.", "P0002");
  return task;
};

export function taskJson(world: World, row: Row) {
  const assignee = world.person(row.assignee_id as string);
  return {
    id: row.id, case_id: row.case_id, title: row.title, assignee_id: row.assignee_id, due_on: row.due_on, done_at: row.done_at, created_at: row.created_at,
    created_by: row.created_by, overdue: !row.done_at && !!row.due_on && String(row.due_on) < world.day(),
    assignee: assignee ? {full_name: assignee.full_name, badge_number: assignee.badge_number, avatar_url: null} : null,
    done_by_name: world.person(row.done_by as string)?.full_name ?? null, created_by_name: world.person(row.created_by as string)?.full_name ?? null,
  };
}

export function itemJson(world: World, row: Row) {
  return {...row, retention_over: false, events: (world.tables.case_item_events ?? []).filter((event) => event.item_id === row.id)
    .map((event) => ({...event, actor_name: world.person(event.actor_id as string)?.full_name ?? null}))};
}

/** Extra lists of get_case_detail() in the demo world. */
export const caseExtras = (world: World, caseId: unknown) => ({
  tasks: (world.tables.case_tasks ?? []).filter((row) => row.case_id === caseId).map((row) => taskJson(world, row)),
  items: (world.tables.case_items ?? []).filter((row) => row.case_id === caseId).map((row) => itemJson(world, row)),
  suggestions: [],
});

const policyJson = (row: Row) => ({
  id: row.id, title: row.title, category: row.category, summary: row.summary, version: row.version, requires_ack: row.requires_ack, status: row.status,
  published_at: row.published_at, updated_at: row.updated_at, my_ack_version: row.acked ? row.version : null, acknowledged: null, draft_changes: null,
});

const pollJson = (world: World, row: Row) => {
  const options = row.options as {id: string; label: string; votes: number}[];
  const total = options.reduce((sum, option) => sum + option.votes, 0);
  return {
    id: row.id, title: row.title, description: row.description, audience: row.audience, anonymous: row.anonymous, max_choices: row.max_choices,
    results: row.results, closes_at: row.closes_at, closed_at: row.closed_at, created_at: row.created_at, created_by: row.created_by,
    created_by_name: world.person(row.created_by as string)?.full_name ?? null, open: !row.closed_at, voted: !!row.voted, can_manage: false,
    voters: total, audience_size: (world.tables.profiles ?? []).length,
    results_visible: true, options: options.map((option) => ({id: option.id, label: option.label, votes: option.votes, mine: row.voted === option.id, voters: []})),
  };
};

export const extrasRpc: Record<string, RpcHandler> = {
  save_case_task: (args, world) => {
    if (args._task_id) {
      const task = requireTask(world, args._task_id);
      Object.assign(task, {title: args._title, assignee_id: args._assignee_id ?? null, due_on: args._due_on ?? null});
      return taskJson(world, task);
    }
    const task: Row = {id: world.id(), case_id: args._case_id, title: args._title, assignee_id: args._assignee_id ?? null, due_on: args._due_on ?? null,
      done_at: null, done_by: null, created_by: world.me.id, created_at: world.stamp()};
    (world.tables.case_tasks ??= []).push(task);
    return taskJson(world, task);
  },
  set_case_task_done: (args, world) => {
    const task = requireTask(world, args._task_id);
    Object.assign(task, args._done === false ? {done_at: null, done_by: null} : {done_at: world.stamp(), done_by: world.me.id});
    return taskJson(world, task);
  },
  delete_case_task: (args, world) => {
    world.tables.case_tasks = (world.tables.case_tasks ?? []).filter((row) => row.id !== args._task_id);
    return null;
  },
  get_my_case_tasks: (_args, world) => (world.tables.case_tasks ?? []).filter((row) => row.assignee_id === world.me.id && !row.done_at).map((row) => {
    const item = (world.tables.cases ?? []).find((entry) => entry.id === row.case_id);
    return {id: row.id, title: row.title, due_on: row.due_on, created_at: row.created_at, overdue: !!row.due_on && String(row.due_on) < world.day(),
      case: {id: row.case_id, case_number: item?.case_number ?? "", title: item?.title ?? "", status: item?.status ?? "open"}};
  }),
  save_case_item: (args, world) => {
    const input = (args._item ?? {}) as Row;
    const item: Row = {id: world.id(), case_id: args._case_id, label: input.label, description: input.description ?? null, quantity: input.quantity ?? null,
      evidence_id: input.evidence_id ?? null, status: "held", location: input.location ?? null, holder_id: world.me.id, holder_name: null,
      retain_until: input.retain_until ?? null, created_by: world.me.id, created_at: world.stamp()};
    (world.tables.case_items ??= []).push(item);
    (world.tables.case_item_events ??= []).push({id: Date.now(), item_id: item.id, case_id: item.case_id, action: "seized", location: item.location,
      note: input.note ?? null, holder_name: null, actor_id: world.me.id, created_at: world.stamp()});
    return itemJson(world, item);
  },
  record_case_item: (args, world) => {
    const item = (world.tables.case_items ?? []).find((row) => row.id === args._item_id);
    if (!item) throw new SandboxError("A tárgy nem található.", "P0002");
    const next: Record<string, string> = {moved: "held", checked_out: "checked_out", checked_in: "held", returned: "returned", destroyed: "destroyed"};
    if (next[String(args._action)]) item.status = next[String(args._action)];
    if (args._location) item.location = args._location;
    (world.tables.case_item_events ??= []).push({id: Date.now(), item_id: item.id, case_id: item.case_id, action: args._action, location: args._location ?? null,
      note: args._note ?? null, holder_name: args._holder_name ?? null, actor_id: world.me.id, created_at: world.stamp()});
    return itemJson(world, item);
  },
  delete_case_item: (args, world) => {
    world.tables.case_items = (world.tables.case_items ?? []).filter((row) => row.id !== args._item_id);
    return null;
  },

  get_practice_overview: (_args, world) => ({
    decks: Object.fromEntries((world.tables.practice_progress ?? []).map((row) => [row.deck, row])),
    streak: 2, best_streak: 5, today: world.day(),
    days: (world.tables.practice_days ?? []).filter((row) => row.user_id === world.me.id),
    can_edit: isAcademyInstructor(world.me),
    scenarios: [{id: "de-scenario-1", title: "Közúti ellenőrzés (bemutató)", summary: "Megállítás, rádió, arányos intézkedés.", category: "traffic", difficulty: 1,
      max_score: 9, pass_percent: 70, published: true, updated_at: world.ago(10 * DAY), steps: 6, result: null,
      stats: isAcademyInstructor(world.me) ? {players: 12, passed: 9} : null}],
    certificates: 2,
  }),
  save_practice_session: (args, world) => {
    const rows = (world.tables.practice_progress ??= []);
    const existing = rows.find((row) => row.deck === args._deck);
    const answered = Number(args._answered ?? 0);
    const correct = Number(args._correct ?? 0);
    if (existing) Object.assign(existing, {cards: args._cards, answered: Number(existing.answered) + answered, correct: Number(existing.correct) + correct,
      sessions: Number(existing.sessions) + 1, updated_at: world.stamp()});
    else rows.push({deck: args._deck, cards: args._cards, answered, correct, sessions: 1, updated_at: world.stamp()});
    return {streak: 3, best_streak: 5, today: {answered, correct}};
  },

  get_policies: (_args, world) => ({can_edit: false, members: (world.tables.profiles ?? []).length,
    policies: (world.tables.policies ?? []).map((row) => policyJson(row))}),
  get_policy: (args, world) => {
    const row = (world.tables.policies ?? []).find((entry) => entry.id === args._id);
    if (!row) throw new SandboxError("A szabályzat nem található.", "P0002");
    return {...policyJson(row), sort_order: 10, shown_version: row.version, body: row.body, change_note: "Első kiadás",
      published_by_name: world.person(person(1))?.full_name ?? null, versions: [{version: 1, published_at: row.published_at, change_note: "Első kiadás",
        published_by_name: world.person(person(1))?.full_name ?? null}], draft: null, missing: null};
  },
  acknowledge_policy: (args, world) => {
    const row = (world.tables.policies ?? []).find((entry) => entry.id === args._id);
    if (row) row.acked = true;
    return {version: row?.version ?? 1, acknowledged_at: world.stamp()};
  },

  get_polls: (_args, world) => (world.tables.polls ?? []).map((row) => pollJson(world, row)),
  cast_vote: (args, world) => {
    const row = (world.tables.polls ?? []).find((entry) => entry.id === args._poll_id);
    if (!row) throw new SandboxError("A szavazás nem található.", "P0002");
    if (row.voted) throw new SandboxError("Már szavaztál.");
    const choice = (args._option_ids as string[])[0];
    row.voted = choice;
    for (const option of row.options as {id: string; votes: number}[]) if (option.id === choice) option.votes += 1;
    return null;
  },

  get_suggestions: (_args, world) => ({can_respond: false, suggestions: (world.tables.suggestions ?? []).map((row) => ({
    ...row, author: {full_name: world.person(row.author_id as string)?.full_name ?? "", faction_rank: world.person(row.author_id as string)?.faction_rank ?? "", avatar_url: null},
    responded_by_name: world.person(person(1))?.full_name ?? null,
  }))}),
  toggle_suggestion_vote: (args, world) => {
    const row = (world.tables.suggestions ?? []).find((entry) => entry.id === args._id);
    if (!row) throw new SandboxError("Az ötlet nem található.", "P0002");
    row.voted = !row.voted;
    row.votes = Number(row.votes) + (row.voted ? 1 : -1);
    return {votes: row.votes, voted: row.voted};
  },
  get_my_feedback: () => ({blocked_until: null, sent_this_week: 0, reports: []}),

  get_my_certificates: (_args, world) => [
    {code: "SFSD-DE00-0001", kind: "exam", ref: "demo", title: "Deputy I. vizsga (bemutató)", subtitle: "Sikeres vizsga", issued_at: world.ago(30 * DAY), revoked_at: null},
  ],
  get_leaderboard: (_args, world) => ({month: world.month(), visible: false, participants: 4, categories: ["duty", "reports", "events", "practice"].map((key) => ({
    key, entries: [1, 2, 3, 4].map((n) => ({user_id: person(n), full_name: world.person(person(n))?.full_name ?? "", badge_number: "", faction_rank: "",
      avatar_url: null, value: 100 - n * 9, place: n, me: false})), me: {value: 40, place: 6, of: 9},
  }))}),
  set_leaderboard_visibility: (args) => ({visible: !!args._visible}),
  get_monthly_recap: (_args, world) => ({month: world.month(-1), duty_minutes: 2760, duty_avg: 2400, duty_better_than: 64, reports: 9, reports_avg: 6.5,
    reports_better_than: 70, events_attended: 2, events_total: 3, practice_correct: 48, practice_days: 4, pay: null, top_duty: null, top_report: 3,
    promotions: [], awards: [], certificates: 0, leaderboard_visible: false}),
};
