import {canManageRecords, getRankPriority, isAcademyInstructor, isStaff, TRAINEE_RANK, FACTION_RANKS} from "@shared/ranks";
import type {Row} from "../postgrest";
import {DAY, SandboxError, type RpcHandler, type World} from "./context";
import {person} from "./people";

/**
 * Promotions, the trainee week, the activity watch and the HR statistics of the demo world (the
 * same shapes as get_promotion_board(), get_trainees(), get_activity_watch() ...).
 */

export function seedProgression(world: World) {
  const {tables, ago} = world;
  tables.promotion_nominations = [
    {id: world.id(), user_id: person(10), from_rank: "Deputy Sheriff II.", to_rank: "Deputy Sheriff III.", status: "pending",
      reason: "Két hónapja hiánytalanul hozza a jelentéseket, és sokat segít a Trainee-knek.", nominated_by: person(5), created_at: ago(2 * DAY),
      decided_at: null, decided_by: null, decision_note: null},
  ];
  tables.trainee_mentors = [
    {trainee_id: person(12), mentor_id: person(9), assigned_by: person(5), assigned_at: ago(2 * DAY), signed_off_at: null, signed_off_by: null,
      sign_off_note: null, completed_at: null},
  ];
  tables.trainee_notes = [
    {id: world.id(), trainee_id: person(12), author_id: person(9), body: "Első közös járőr: a rádiózás még bizonytalan, a megállításnál figyelmes volt.",
      created_at: ago(DAY)},
  ];
  tables.activity_reviews = [];
}

const rankName = (index: number) => FACTION_RANKS[index] ?? null;
const name = (world: World, id: unknown) => world.person(id as string)?.full_name ?? null;

function nominationJson(world: World, row: Row) {
  const member = world.person(row.user_id as string);
  const decider = isStaff(world.me) && getRankPriority(world.me.faction_rank) <= 6;
  return {
    ...row, nominated_by_name: name(world, row.nominated_by), decided_by_name: name(world, row.decided_by),
    member: member ? {full_name: member.full_name, badge_number: member.badge_number, faction_rank: member.faction_rank, avatar_url: null, division: member.division} : null,
    can_decide: decider && row.status === "pending" && row.user_id !== world.me.id,
    can_withdraw: row.status === "pending" && (row.nominated_by === world.me.id || decider),
  };
}

function boardMember(world: World, profile: Row) {
  const month = world.month(-1);
  const minutes = Number((world.tables.duty_time_entries ?? []).find((entry) => entry.user_id === profile.id && String(entry.month) === month)?.minutes ?? 0);
  const reports = (world.tables.report_logs ?? []).filter((row) => row.user_id === profile.id && String(row.month) === month).length;
  const warnings = (world.tables.hr_records ?? []).filter((row) => row.user_id === profile.id && row.kind === "warning" && row.status === "active").length;
  const days = Math.max(0, Math.round((Date.now() - Date.parse(String(profile.last_promotion_date ?? profile.created_at))) / 86_400_000));
  const index = getRankPriority(profile.faction_rank as string);
  const checks = [
    {key: "days", label: "Idő a jelenlegi rangban", value: days, target: index >= 10 ? 14 : 30, unit: "nap", ok: days >= (index >= 10 ? 14 : 30)},
    {key: "duty", label: "Duty idő (előző hónap)", value: Math.round(minutes / 6) / 10, target: 30, unit: "óra", ok: minutes >= 1800},
    {key: "reports", label: "Jelentések (előző hónap)", value: reports, target: index <= 6 ? 0 : 2, unit: "db", ok: reports >= (index <= 6 ? 0 : 2)},
    {key: "warnings", label: "Aktív figyelmeztetés", value: warnings, target: 0, unit: "db", max: true, ok: warnings === 0},
  ];
  const missing = checks.filter((check) => !check.ok).length;
  const nomination = (world.tables.promotion_nominations ?? []).find((row) => row.user_id === profile.id && row.status === "pending");
  return {
    user_id: profile.id, full_name: profile.full_name, badge_number: profile.badge_number, faction_rank: profile.faction_rank, rank_order: index,
    division: profile.division, avatar_url: profile.avatar_url ?? null, next_rank: rankName(index - 1), configured: true,
    since: String(profile.last_promotion_date ?? profile.created_at).slice(0, 10), days_in_rank: days, checks, missing, eligible: missing === 0,
    on_leave: false, activity_status: "active", nomination: nomination ? nominationJson(world, nomination) : null,
  };
}

function traineeJson(world: World, profile: Row) {
  const link = (world.tables.trainee_mentors ?? []).find((row) => row.trainee_id === profile.id);
  const mentor = link?.mentor_id ? world.person(link.mentor_id as string) : undefined;
  const coach = isStaff(world.me) || isAcademyInstructor(world.me);
  const reports = (world.tables.report_logs ?? []).filter((row) => row.user_id === profile.id).length;
  const checks = [
    {key: "exam", label: "Felvételi vizsga", ok: true},
    {key: "onboarding", label: "Első lépések", ok: !!profile.onboarding_completed},
    {key: "academy", label: "Alapképzés napjai", value: 2, target: 5, ok: false},
    {key: "reports", label: "Első jelentés", value: reports, target: 1, ok: reports >= 1},
    {key: "mentor", label: "Mentor jóváhagyása", ok: !!link?.signed_off_at},
  ];
  const joined = String(profile.created_at).slice(0, 10);
  return {
    user_id: profile.id, full_name: profile.full_name, badge_number: profile.badge_number, avatar_url: null, joined_on: joined,
    days: Math.max(0, Math.round((Date.now() - Date.parse(String(profile.created_at))) / 86_400_000)),
    mentor: mentor ? {id: mentor.id, full_name: mentor.full_name, faction_rank: mentor.faction_rank, avatar_url: null} : null,
    assigned_at: link?.assigned_at ?? null, signed_off_at: link?.signed_off_at ?? null, sign_off_note: link?.sign_off_note ?? null,
    signed_off_by_name: name(world, link?.signed_off_by), is_mentor: link?.mentor_id === world.me.id, checks,
    ready: checks.every((check) => check.ok),
    notes: coach || link?.mentor_id === world.me.id
      ? (world.tables.trainee_notes ?? []).filter((note) => note.trainee_id === profile.id)
        .map((note) => ({id: note.id, body: note.body, created_at: note.created_at, author_name: name(world, note.author_id)}))
      : null,
  };
}

const requireStaff = (world: World) => {
  if (!isStaff(world.me)) throw new SandboxError("Nincs jogosultságod.", "42501");
};

// --- Performance reviews (practice mode) ------------------------------------------------------------

const quarterKey = (date = new Date()) => `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;

function reviewPerson(world: World, id: unknown) {
  const who = world.person(id as string);
  return who ? {id: who.id, full_name: who.full_name, faction_rank: who.faction_rank, badge_number: who.badge_number, avatar_url: who.avatar_url} : null;
}

function reviewJson(world: World, row: Row) {
  const target = world.person(row.user_id as string);
  const canWrite = !!target && canManageRecords(world.me, target as never);
  return {
    ...row, member: reviewPerson(world, row.user_id), reviewer: reviewPerson(world, row.reviewer_id),
    can_edit: row.status === "draft" && canWrite && (row.reviewer_id === world.me.id || !row.reviewer_id),
    can_delete: (row.status === "draft" && row.reviewer_id === world.me.id) || isStaff(world.me),
    can_acknowledge: row.status === "shared" && row.user_id === world.me.id,
  };
}

const readable = (world: World, row: Row) =>
  (row.user_id === world.me.id && row.status !== "draft") || row.reviewer_id === world.me.id || (isStaff(world.me) && row.status !== "draft");

const average = (scores: Record<string, number>) => {
  const values = Object.values(scores);
  return values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100 : null;
};

export const progressionRpc: Record<string, RpcHandler> = {
  get_reviews: (args, world) => {
    const target = (args._user_id as string | null) ?? world.me.id;
    const member = world.person(target);
    return {
      can_write: !!member && canManageRecords(world.me, member as never),
      current_period: quarterKey(),
      reviews: (world.tables.performance_reviews ?? []).filter((row) => row.user_id === target && readable(world, row))
        .sort((a, b) => String(b.period).localeCompare(String(a.period))).map((row) => reviewJson(world, row)),
    };
  },

  get_review_overview: (args, world) => {
    if (!isStaff(world.me)) throw new SandboxError("Az értékeléseket a Supervisory Staff és felette látja.", "42501");
    const period = (args._period as string | null) || quarterKey();
    return {
      period, current_period: quarterKey(),
      members: (world.tables.profiles ?? []).filter((row) => row.system_role !== "pending" && row.faction_rank !== TRAINEE_RANK)
        .sort((a, b) => getRankPriority(a.faction_rank as string) - getRankPriority(b.faction_rank as string)).map((row) => {
          const review = (world.tables.performance_reviews ?? []).find((item) => item.user_id === row.id && item.period === period && readable(world, item));
          return {
            user_id: row.id, full_name: row.full_name, faction_rank: row.faction_rank, badge_number: row.badge_number, avatar_url: row.avatar_url,
            division: row.division, can_write: canManageRecords(world.me, row as never), review: review ? reviewJson(world, review) : null, last: null,
          };
        }),
    };
  },

  save_review: (args, world) => {
    const draft = (args._review ?? {}) as Row;
    const scores = Object.fromEntries(Object.entries((draft.scores ?? {}) as Record<string, number>)
      .filter(([, value]) => Number.isInteger(value) && value >= 1 && value <= 5));
    const fields = {scores, overall: average(scores), strengths: draft.strengths || null, improvements: draft.improvements || null,
      goals: draft.goals || null, updated_at: world.stamp()};
    let row = (world.tables.performance_reviews ?? []).find((item) => item.id === args._id);
    if (row) {
      Object.assign(row, fields, {reviewer_id: world.me.id});
    } else {
      const target = world.person(args._user_id as string);
      if (!target || !canManageRecords(world.me, target as never)) {
        throw new SandboxError("Értékelést a Supervisory Staff és felette ír, a nála alacsonyabb rangúakról.", "42501");
      }
      row = {id: world.id(), user_id: target.id, reviewer_id: world.me.id, period: args._period, status: "draft", shared_at: null,
        acknowledged_at: null, member_comment: null, created_at: world.stamp(), ...fields};
      world.tables.performance_reviews = [...(world.tables.performance_reviews ?? []), row];
    }
    return reviewJson(world, row);
  },

  share_review: (args, world) => {
    const row = (world.tables.performance_reviews ?? []).find((item) => item.id === args._id);
    if (!row) throw new SandboxError("Az értékelés nem található.", "P0002");
    if (Object.keys((row.scores ?? {}) as object).length < 6) throw new SandboxError("Megosztás előtt pontozd mind a hat szempontot.");
    Object.assign(row, {status: "shared", shared_at: world.stamp()});
    return reviewJson(world, row);
  },

  acknowledge_review: (args, world) => {
    const row = (world.tables.performance_reviews ?? []).find((item) => item.id === args._id && item.user_id === world.me.id);
    if (!row) throw new SandboxError("Az értékelés nem található.", "P0002");
    Object.assign(row, {status: "acknowledged", acknowledged_at: world.stamp(), member_comment: args._comment || null});
    return reviewJson(world, row);
  },

  delete_review: (args, world) => {
    world.tables.performance_reviews = (world.tables.performance_reviews ?? []).filter((item) => item.id !== args._id);
    return null;
  },

  get_promotion_board: (_args, world) => {
    requireStaff(world);
    const members = (world.tables.profiles ?? []).filter((row) => row.system_role !== "pending" && row.id !== world.me.id)
      .filter((row) => {
        const index = getRankPriority(row.faction_rank as string);
        return index >= 1 && index <= 15;
      })
      .map((row) => boardMember(world, row))
      .sort((a, b) => Number(b.eligible) - Number(a.eligible) || a.missing - b.missing || a.rank_order - b.rank_order);
    return {
      criteria: FACTION_RANKS.slice(0, 15).map((rank, index) => ({rank, min_days_in_rank: index >= 10 ? 14 : 30, min_duty_hours: 30, window_months: 1,
        min_reports: index <= 6 ? null : 2, max_warnings: 0, exam_ids: [], note: null, updated_at: world.ago(30 * DAY), updated_by: null})).reverse(),
      exams: [], can_edit_criteria: getRankPriority(world.me.faction_rank) <= 1 || !!world.me.is_bureau_manager, members,
      nominations: (world.tables.promotion_nominations ?? []).map((row) => nominationJson(world, row)),
    };
  },
  nominate_for_promotion: (args, world) => {
    requireStaff(world);
    const target = world.person(args._user_id as string);
    if (!target) throw new SandboxError("A tag nem található.");
    if ((world.tables.promotion_nominations ?? []).some((row) => row.user_id === target.id && row.status === "pending")) {
      throw new SandboxError("Ennek a tagnak már van függő javaslata.");
    }
    const row: Row = {id: world.id(), user_id: target.id, from_rank: target.faction_rank, to_rank: rankName(getRankPriority(target.faction_rank as string) - 1),
      reason: String(args._reason ?? ""), status: "pending", nominated_by: world.me.id, created_at: world.stamp(), decided_at: null, decided_by: null, decision_note: null};
    (world.tables.promotion_nominations ??= []).push(row);
    return nominationJson(world, row);
  },
  decide_promotion_nomination: (args, world) => {
    const row = (world.tables.promotion_nominations ?? []).find((entry) => entry.id === args._id);
    if (!row) throw new SandboxError("A javaslat nem található.");
    Object.assign(row, {status: args._decision, decided_by: world.me.id, decided_at: world.stamp(), decision_note: args._note ?? null});
    return nominationJson(world, row);
  },
  save_promotion_criteria: (args) => ({rank: args._rank, ...(args._criteria as Row), updated_at: new Date().toISOString(), updated_by: null}),

  get_trainees: (_args, world) => {
    const coach = isStaff(world.me) || isAcademyInstructor(world.me);
    return (world.tables.profiles ?? []).filter((row) => row.faction_rank === TRAINEE_RANK && row.system_role !== "pending")
      .filter((row) => coach || row.id === world.me.id
        || (world.tables.trainee_mentors ?? []).some((link) => link.trainee_id === row.id && link.mentor_id === world.me.id))
      .map((row) => traineeJson(world, row));
  },
  assign_trainee_mentor: (args, world) => {
    const links = (world.tables.trainee_mentors ??= []);
    let link = links.find((row) => row.trainee_id === args._trainee_id);
    if (!link) {
      link = {trainee_id: args._trainee_id, assigned_at: world.stamp(), signed_off_at: null, signed_off_by: null, sign_off_note: null, completed_at: null};
      links.push(link);
    }
    Object.assign(link, {mentor_id: args._mentor_id ?? null, assigned_by: world.me.id, assigned_at: world.stamp()});
    return {trainee_id: args._trainee_id, mentor_id: args._mentor_id ?? null};
  },
  add_trainee_note: (args, world) => {
    const note = {id: world.id(), trainee_id: args._trainee_id, author_id: world.me.id, body: String(args._body ?? ""), created_at: world.stamp()};
    (world.tables.trainee_notes ??= []).push(note);
    return {id: note.id, body: note.body, created_at: note.created_at, author_name: world.me.full_name};
  },
  sign_off_trainee: (args, world) => {
    const links = (world.tables.trainee_mentors ??= []);
    let link = links.find((row) => row.trainee_id === args._trainee_id);
    if (!link) {
      link = {trainee_id: args._trainee_id, mentor_id: null, assigned_by: world.me.id, assigned_at: world.stamp(), completed_at: null};
      links.push(link);
    }
    const ready = args._ready !== false;
    Object.assign(link, {signed_off_at: ready ? world.stamp() : null, signed_off_by: ready ? world.me.id : null, sign_off_note: ready ? args._note ?? null : null});
    return {signed_off_at: link.signed_off_at, sign_off_note: link.sign_off_note};
  },

  get_activity_watch: (_args, world) => {
    requireStaff(world);
    const [m1, m2] = [world.month(-1), world.month(-2)];
    const minutes = (userId: unknown, month: string) => {
      const entry = (world.tables.duty_time_entries ?? []).find((row) => row.user_id === userId && String(row.month) === month);
      return entry ? Number(entry.minutes) : null;
    };
    const reviews = world.tables.activity_reviews ?? [];
    const members = (world.tables.profiles ?? []).filter((row) => row.system_role !== "pending" && row.faction_rank !== TRAINEE_RANK)
      .map((row) => ({row, first: minutes(row.id, m1), second: minutes(row.id, m2)}))
      .filter(({first}) => (first ?? 0) < 1800)
      .map(({row, first, second}) => {
        const review = reviews.find((entry) => entry.user_id === row.id && entry.month === m1);
        return {user_id: row.id, full_name: row.full_name, badge_number: row.badge_number, faction_rank: row.faction_rank, avatar_url: null,
          activity_status: "active", m1_minutes: first, m2_minutes: second, m1_leave: false, m2_leave: false, level: (second ?? 0) < 1800 ? 2 : 1,
          review: review?.action ?? null, reviewed_at: review?.created_at ?? null, reviewed_by: review ? world.me.full_name : null};
      });
    return {months: [m1, m2], recorded: [true, true], min_minutes: 1800, members};
  },
  send_activity_reminder: (args, world) => {
    (world.tables.activity_reviews ??= []).push({user_id: args._user_id, month: world.month(-1), action: "reminded", created_at: world.stamp()});
    return {review: "reminded"};
  },
  dismiss_activity_flag: (args, world) => {
    (world.tables.activity_reviews ??= []).push({user_id: args._user_id, month: world.month(-1), action: "dismissed", created_at: world.stamp()});
    return {review: "dismissed"};
  },

  get_workload: (_args, world) => {
    requireStaff(world);
    const months = [0, -1, -2, -3, -4, -5].map((offset) => world.month(offset));
    return {
      months,
      members: (world.tables.profiles ?? []).filter((row) => row.system_role !== "pending").map((row) => ({
        user_id: row.id, full_name: row.full_name, badge_number: row.badge_number, faction_rank: row.faction_rank, avatar_url: null, division: row.division,
        reports: Object.fromEntries(months.map((month) => [month, (world.tables.report_logs ?? []).filter((log) => log.user_id === row.id && String(log.month) === month).length])
          .filter(([, value]) => Number(value) > 0)),
        duty: Object.fromEntries((world.tables.duty_time_entries ?? []).filter((entry) => entry.user_id === row.id).map((entry) => [String(entry.month), Number(entry.minutes)])),
        events: {},
      })),
    };
  },
  get_recruitment_funnel: (args, world) => {
    requireStaff(world);
    const count = Math.min(12, Math.max(1, Number(args._months ?? 6)));
    return Array.from({length: count}, (_, index) => ({
      month: world.month(-index), exam_takers: 6 + ((index * 5) % 7), exam_passed: 4 + ((index * 3) % 4), joined: 3 + ((index * 2) % 3),
      deputy: index === 0 ? 1 : 2 + (index % 2), stayed_30: index >= 2 ? 2 + (index % 2) : null, stayed_90: index >= 4 ? 1 + (index % 2) : null,
    }));
  },
};
