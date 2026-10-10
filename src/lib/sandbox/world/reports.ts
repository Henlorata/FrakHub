import {isStaff} from "@shared/ranks";
import type {Row} from "../postgrest";
import {SandboxError, type RpcHandler, type World} from "./context";

/**
 * Practice mode's reports (as get_reports, save_report and the rest in the database): every member
 * reads them, the author changes their own, the Supervisory Staff and above void one. No payroll is paid in the
 * demo, so nothing is locked and every report counts for this month.
 */

const text = (value: unknown, limit: number) => (typeof value === "string" ? value.replace(/\r/g, "").trim().slice(0, limit) || null : null);

const FIELDS: [string, number][] = [
  ["officer_name", 120], ["officer_rank", 60], ["badge_number", 20], ["colleagues", 400], ["unit_id", 40], ["suspect_name", 120],
  ["suspect_id_card", 40], ["suspect_license", 40], ["suspect_medical", 40], ["report_date", 40], ["charges", 2000], ["fine", 20],
  ["jail_time", 20], ["confiscated_items", 1000], ["description", 8000],
];

function person(world: World, id: unknown) {
  const profile = world.person(id as string);
  return profile ? {id: profile.id, full_name: profile.full_name, faction_rank: profile.faction_rank, badge_number: profile.badge_number,
    avatar_url: profile.avatar_url ?? null, iab_title: null} : null;
}

const rows = (world: World) => (world.tables.report_logs ??= []);
const lead = (world: World) => isStaff(world.me);
const active = (row: Row) => !row.voided_at;

function find(world: World, id: unknown) {
  const row = rows(world).find((item) => item.id === id);
  if (!row) throw new SandboxError("A jelentés nem található.", "P0002");
  return row;
}

function listJson(world: World, row: Row): Row {
  return {
    id: row.id, number: row.number, period: row.period, occurred_on: row.occurred_on, created_at: row.created_at, updated_at: row.updated_at ?? null,
    source: row.source, title: row.title, forum_url: row.forum_url ?? null, suspect_name: row.suspect_name ?? null,
    charges: typeof row.charges === "string" ? row.charges.slice(0, 300) : null, fine: row.fine ?? null, jail_time: row.jail_time ?? null,
    unit_id: row.unit_id ?? null, voided: !!row.voided_at, void_reason: row.void_reason ?? null,
    excerpt: typeof row.description === "string" ? row.description.replace(/\s+/g, " ").slice(0, 220) : null, author: person(world, row.user_id),
  };
}

function fullJson(world: World, row: Row): Row {
  return {
    ...listJson(world, row), charges: row.charges ?? null, excerpt: null,
    ...Object.fromEntries(FIELDS.map(([key]) => [key, row[key] ?? null])),
    voided_at: row.voided_at ?? null, voided_by: person(world, row.voided_by), updated_by: person(world, row.updated_by),
    locked: false, locked_at: null, can_edit: row.user_id === world.me.id, can_link: row.user_id === world.me.id || lead(world), can_void: lead(world),
  };
}

const mineIn = (world: World, period: unknown) => rows(world).filter((row) => row.user_id === world.me.id && row.period === period && active(row)).length;

export const reportsRpc: Record<string, RpcHandler> = {
  get_report_period: (_args, world) => ({period: world.month(), mine: mineIn(world, world.month()), started_at: null}),

  save_report: (args, world) => {
    const fields = (args._report ?? {}) as Row;
    const values = Object.fromEntries(FIELDS.map(([key, limit]) => [key, text(fields[key], limit)]));
    if (!values.suspect_name && !values.charges && !values.description) {
      throw new SandboxError("Üres jelentést nem lehet menteni: add meg a személyt, a vádat vagy a leírást.", "22023");
    }
    const occurred = typeof fields.occurred_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fields.occurred_on) ? fields.occurred_on : world.day();
    const title = `${values.suspect_name ?? "Ismeretlen személy"}${values.charges ? ` – ${values.charges}` : ""}`.slice(0, 160);
    const link = "forum_url" in fields ? text(fields.forum_url, 500) : undefined;
    let row: Row;
    if (args._report_id) {
      row = find(world, args._report_id);
      if (row.user_id !== world.me.id) throw new SandboxError("Csak a saját jelentésedet szerkesztheted.", "42501");
      Object.assign(row, values, {occurred_on: occurred, month: `${occurred.slice(0, 7)}-01`, title, source: "report", updated_at: world.stamp(),
        updated_by: world.me.id}, link !== undefined ? {forum_url: link} : {});
    } else {
      const number = Math.max(100, ...rows(world).map((item) => Number(item.number ?? 0))) + 1;
      row = {id: world.id(), number, user_id: world.me.id, period: world.month(), occurred_on: occurred, month: `${occurred.slice(0, 7)}-01`, title,
        forum_url: link ?? null, source: "report", created_at: world.stamp(), created_by: world.me.id, ...values};
      rows(world).push(row);
    }
    return {...listJson(world, row), locked: false, period_count: mineIn(world, row.period)};
  },

  set_report_link: (args, world) => {
    const row = find(world, args._report_id);
    if (row.user_id !== world.me.id && !lead(world)) throw new SandboxError("Csak a saját jelentésedhez adhatsz linket.", "42501");
    row.forum_url = text(args._forum_url, 500);
    return {id: row.id, forum_url: row.forum_url};
  },

  delete_report: (args, world) => {
    const row = find(world, args._report_id);
    if (row.user_id !== world.me.id) throw new SandboxError("Csak a saját jelentésedet törölheted.", "42501");
    world.tables.report_logs = rows(world).filter((item) => item !== row);
    return null;
  },

  void_report: (args, world) => {
    if (!lead(world)) throw new SandboxError("Jelentést a Supervisory Staff és felette érvényteleníthet.", "42501");
    const reason = text(args._reason, 300);
    if (!reason || reason.length < 3) throw new SandboxError("Írd meg röviden, miért érvénytelen a jelentés.", "22023");
    const row = find(world, args._report_id);
    Object.assign(row, {voided_at: world.stamp(), voided_by: world.me.id, void_reason: reason});
    return fullJson(world, row);
  },

  restore_report: (args, world) => {
    if (!lead(world)) throw new SandboxError("Jelentést a Supervisory Staff és felette érvényteleníthet.", "42501");
    const row = find(world, args._report_id);
    Object.assign(row, {voided_at: null, voided_by: null, void_reason: null});
    return fullJson(world, row);
  },

  get_report: (args, world) => fullJson(world, find(world, args._report_id)),

  get_reports: (args, world) => {
    const period = args._all_periods ? null : (args._period as string | null) ?? world.month();
    const query = typeof args._query === "string" ? args._query.trim().toLowerCase() : "";
    const before = typeof args._before === "number" ? args._before : null;
    const limit = Math.min(100, Math.max(1, Number(args._limit ?? 40)));
    const matches = rows(world)
      .filter((row) => (!period || row.period === period) && (!args._user_id || row.user_id === args._user_id)
        && (before === null || Number(row.number) < before)
        && (!query || [`#${row.number}`, row.title, row.suspect_name, row.charges, row.officer_name, row.unit_id, row.description,
          world.person(row.user_id as string)?.full_name].some((value) => typeof value === "string" && value.toLowerCase().includes(query))))
      .sort((a, b) => Number(b.number) - Number(a.number));
    return {items: matches.slice(0, limit).map((row) => listJson(world, row)), more: matches.length > limit, period, current: world.month(),
      locked: period ? false : null, locked_at: null, started_at: null};
  },

  get_report_overview: (args, world) => {
    const period = (args._period as string | null) ?? world.month();
    const inPeriod = rows(world).filter((row) => row.period === period);
    const members = (world.tables.profiles ?? []).filter((profile) => profile.system_role !== "pending").map((profile) => {
      const own = inPeriod.filter((row) => row.user_id === profile.id);
      const counted = own.filter(active);
      return {user_id: profile.id, full_name: profile.full_name, faction_rank: profile.faction_rank, badge_number: profile.badge_number,
        avatar_url: profile.avatar_url ?? null, reports: counted.length, voided: own.length - counted.length, counted: counted.length, recorded: false,
        last_on: counted.map((row) => String(row.occurred_on)).sort().at(-1) ?? null};
    }).sort((a, b) => b.counted - a.counted || String(a.full_name).localeCompare(String(b.full_name), "hu"));
    return {
      period, current: world.month(), locked: false, locked_at: null, started_at: null,
      min_reports: world.tables.payroll_settings?.[0]?.min_reports ?? 8,
      total: inPeriod.filter(active).length, voided: inPeriod.filter((row) => !active(row)).length, mine: mineIn(world, period),
      periods: Array.from({length: 12}, (_, index) => {
        const month = world.month(-index);
        return {period: month, count: rows(world).filter((row) => row.period === month && active(row)).length, locked: false};
      }),
      members,
    };
  },
};
