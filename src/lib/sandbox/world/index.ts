import {isHighCommand, isStaff, isSupervisory} from "@shared/ranks";
import {canViewCaseList} from "@/lib/utils";
import type {Profile} from "@/types/supabase";
import type {SandboxBackend} from "../state";
import {handleRest, type Row, type Schema} from "../postgrest";
import {createWorld, SandboxError, type RpcHandler, type World} from "./context";
import {peopleApi, peopleRpc, seedPeople} from "./people";
import {dashboardRpc, seedDashboard} from "./dashboard";
import {afterVehicleRequestUpdate, fleetRpc, seedFleet} from "./fleet";
import {mcbApi, mcbRpc, seedMcb} from "./mcb";
import {examViewRows, examsRpc, seedExams} from "./exams";
import {financeRpc, seedFinance} from "./finance";
import {academyRpc, seedAcademy} from "./academy";
import {eventsRpc, seedEvents} from "./events";
import {progressionRpc, seedProgression} from "./progression";
import {extrasRpc, seedExtras} from "./extras";

/** Foreign keys the app embeds (`owner:owner_id(...)`, `profiles!x_user_id_fkey(...)`, `holders:fleet_assignments(...)`). */
const RELATIONS: Schema["relations"] = {
  action_logs: {user_id: "profiles"},
  announcements: {created_by: "profiles"},
  vehicle_requests: {user_id: "profiles", processed_by: "profiles"},
  budget_requests: {user_id: "profiles", processed_by: "profiles"},
  hr_records: {user_id: "profiles", created_by: "profiles", decided_by: "profiles"},
  user_ribbons: {user_id: "profiles", ribbon_id: "ribbons"},
  member_events: {user_id: "profiles", actor_id: "profiles"},
  cases: {owner_id: "profiles"},
  case_events: {case_id: "cases", actor_id: "profiles"},
  case_evidence: {case_id: "cases", uploaded_by: "profiles"},
  case_suspects: {case_id: "cases", suspect_id: "suspects"},
  case_warrants: {case_id: "cases", suspect_id: "suspects", property_id: "suspect_properties", requested_by: "profiles",
    approved_by: "profiles", closed_by: "profiles"},
  case_notes: {case_id: "cases", user_id: "profiles"},
  case_collaborators: {case_id: "cases", user_id: "profiles"},
  suspect_properties: {suspect_id: "suspects"},
  suspect_vehicles: {suspect_id: "suspects"},
  suspect_associates: {suspect_id: "suspects", associate_id: "suspects"},
  fleet_vehicles: {category_id: "fleet_categories"},
  fleet_assignments: {vehicle_id: "fleet_vehicles", user_id: "profiles"},
  fleet_registration_requests: {vehicle_id: "fleet_vehicles", submitted_by: "profiles"},
  vehicle_warnings: {vehicle_id: "fleet_vehicles", user_id: "profiles"},
  academy_students: {cycle_id: "academy_cycles", user_id: "profiles"},
  exam_submissions: {exam_id: "exams", user_id: "profiles"},
  exam_overrides: {exam_id: "exams", user_id: "profiles"},
};

/** Upsert targets that are not `id`. */
const KEYS: Record<string, string[]> = {
  member_details: ["user_id"],
  member_bank_accounts: ["user_id"],
  duty_time_entries: ["user_id", "month"],
  notification_preferences: ["user_id"],
  academy_logs: ["cycle_id", "student_id", "day_number"],
  academy_progress: ["user_id", "material_id"],
};

function withDefaults(world: World, table: string, row: Row): Row {
  const now = world.stamp();
  const out: Row = {...row};
  if (!KEYS[table] && out.id === undefined) out.id = world.id();
  out.created_at ??= now;
  switch (table) {
    case "cases": {
      const owner = world.person(out.owner_id as string);
      const count = (world.tables.cases ?? []).length + 20;
      out.case_number ??= `SD-${String(owner?.badge_number ?? "000").slice(-3)}/0${count}/${world.day().replace(/-/g, "").slice(2)}`;
      Object.assign(out, {status: out.status ?? "open", priority: out.priority ?? "medium", category: out.category ?? null,
        description: out.description ?? null, body_version: 1, body_updated_by: world.me.id, theme: out.theme ?? "default", updated_at: now,
        closed_at: null});
      break;
    }
    case "report_logs": {
      const occurred = String(out.occurred_on ?? world.day());
      const post = typeof out.forum_url === "string" ? out.forum_url.match(/(?:\/posts\/|post-)(\d{1,18})/)?.[1] : undefined;
      Object.assign(out, {month: `${occurred.slice(0, 7)}-01`, forum_post_id: post ? Number(post) : null, source: out.source ?? "manual",
        created_by: out.created_by ?? world.me.id, forum_url: out.forum_url ?? null});
      break;
    }
    case "hr_records":
      Object.assign(out, {status: out.status ?? "active", decided_by: null, decided_at: null, details: out.details ?? null,
        starts_on: out.starts_on ?? null, ends_on: out.ends_on ?? null});
      break;
    case "vehicle_requests":
    case "budget_requests":
      Object.assign(out, {status: out.status ?? "pending", admin_comment: null, processed_by: null, updated_at: now, vehicle_plate: out.vehicle_plate ?? null,
        proofs_removed_at: null});
      break;
    case "case_warrants":
      Object.assign(out, {status: out.status ?? "pending", approved_by: null, decided_at: null, decision_note: null, closed_at: null, closed_by: null,
        closing_note: null, updated_at: now, description: out.description ?? null, property_id: out.property_id ?? null,
        suspect_id: out.suspect_id ?? null, target_name: out.target_name ?? null});
      break;
    case "case_suspects":
      out.added_at ??= now;
      break;
    case "fleet_assignments":
      Object.assign(out, {assigned_at: out.assigned_at ?? now, is_temporary: out.is_temporary ?? false, note: out.note ?? null});
      break;
    case "suspects":
      Object.assign(out, {status: out.status ?? "free", updated_at: now, mugshot_url: out.mugshot_url ?? null, description: out.description ?? null,
        gender: out.gender ?? null, alias: out.alias ?? null, gang_affiliation: out.gang_affiliation ?? null});
      break;
    case "announcements":
      Object.assign(out, {is_pinned: out.is_pinned ?? false, show_author: out.show_author ?? true});
      break;
    case "academy_students":
      out.status ??= "enrolled";
      break;
    case "events":
      Object.assign(out, {created_by: world.me.id, updated_at: now, updated_by: null, cancelled_at: null, rsvp: out.rsvp ?? true,
        description: out.description ?? null, ends_at: out.ends_at ?? null, location: out.location ?? null, audience: out.audience ?? "all"});
      break;
    case "case_templates":
      Object.assign(out, {kind: out.kind ?? "document", description: out.description ?? null, icon: out.icon ?? "file", aliases: out.aliases ?? [],
        blocks: out.blocks ?? [], sort_order: out.sort_order ?? 100, created_by: world.me.id, updated_at: now, updated_by: null});
      break;
    case "member_details":
    case "duty_time_entries":
    case "former_members":
      Object.assign(out, {updated_at: now, updated_by: world.me.id});
      break;
  }
  return out;
}

/** The database triggers the trainings can see (case log, keys of approved requests). */
function triggers(world: World, table: string, kind: "insert" | "update" | "delete", rows: Row[]) {
  const log = (caseId: unknown, eventKind: string, details: Row) => {
    const events = (world.tables.case_events ??= []);
    events.push({id: events.length + 2000, case_id: caseId, kind: eventKind, details, actor_id: world.me.id, created_at: world.stamp()});
  };
  const suspectName = (id: unknown) => (world.tables.suspects ?? []).find((row) => row.id === id)?.full_name ?? "";
  for (const row of rows) {
    if (table === "case_evidence" && kind === "insert") log(row.case_id, "evidence_added", {name: row.file_name});
    if (table === "case_evidence" && kind === "delete") log(row.case_id, "evidence_removed", {name: row.file_name});
    if (table === "case_suspects" && kind === "insert") log(row.case_id, "person_linked", {name: suspectName(row.suspect_id), role: row.involvement_type});
    if (table === "case_collaborators" && kind === "insert") {
      log(row.case_id, "collaborator_added", {name: world.person(row.user_id as string)?.full_name ?? "", role: row.role});
    }
    if (table === "case_warrants" && kind === "insert") log(row.case_id, "warrant_requested", {type: row.type, target: suspectName(row.suspect_id)});
  }
  if (table === "vehicle_requests" && kind === "update") afterVehicleRequestUpdate(world, rows);
}

/** What Row Level Security would let the member read (the demo lists look like the real ones). */
function visibility(me: Profile): Partial<Record<string, (row: Row) => boolean>> {
  const staff = isStaff(me);
  const admin = me.system_role === "admin" || !!me.is_bureau_manager;
  const grader = staff || !!me.qualifications?.includes("TB") || isSupervisory(me) || isHighCommand(me);
  const own = (row: Row) => row.user_id === me.id;
  return {
    vehicle_requests: (row) => own(row) || staff,
    budget_requests: (row) => own(row) || admin,
    hr_records: (row) => staff || (own(row) && row.kind !== "note"),
    vehicle_warnings: (row) => own(row) || staff,
    report_logs: (row) => own(row) || staff,
    member_bank_accounts: (row) => own(row) || staff,
    notifications: own,
    exam_submissions: (row) => own(row) || grader,
    exam_submissions_view: (row) => own(row) || grader,
    fleet_registration_requests: (row) => row.submitted_by === me.id || staff,
    former_members: () => staff,
    case_templates: () => canViewCaseList(me),
    duty_time_entries: () => true,
  };
}

const reply = (status: number, body?: unknown, headers: Record<string, string> = {}) =>
  new Response(body === undefined || status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {"Content-Type": "application/json", "Access-Control-Expose-Headers": "Content-Range", ...headers},
  });

const failure = (error: unknown) => {
  const message = error instanceof Error ? error.message : "Gyakorló módban ez nem sikerült.";
  const code = error instanceof SandboxError ? error.code : "P0001";
  return reply(code === "42501" ? 403 : 400, {code, message, details: null, hint: null});
};

const latency = () => new Promise((resolve) => setTimeout(resolve, 80 + Math.random() * 140));

const parseBody = (body: BodyInit | null | undefined): unknown => {
  if (typeof body !== "string" || !body) return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
};

/**
 * A complete in-memory demo world for one training: the signed-in member (their real profile) among
 * made-up colleagues, cases, exams, vehicles and money. Lives only in this tab; nothing is sent to
 * the database, so any number of members may practise at the same time without seeing each other.
 */
export function createSandbox(profile: Profile): SandboxBackend {
  const world = createWorld(profile);
  seedPeople(world);
  seedDashboard(world);
  seedFleet(world);
  seedMcb(world);
  seedExams(world);
  seedFinance(world);
  seedAcademy(world);
  seedEvents(world);
  seedProgression(world);
  seedExtras(world);

  const rpc: Record<string, RpcHandler> = {...peopleRpc, ...dashboardRpc, ...mcbRpc, ...examsRpc, ...fleetRpc, ...financeRpc, ...academyRpc, ...eventsRpc,
    ...progressionRpc, ...extrasRpc};
  const api: Record<string, (body: Row, world: World) => unknown> = {...peopleApi, ...mcbApi, "/api/delete-image": () => ({deleted: 0})};
  const virtual: Record<string, () => Row[]> = {exam_submissions_view: () => examViewRows(world)};
  const visible = visibility(profile);
  const schema: Schema = {
    relations: RELATIONS,
    keys: KEYS,
    onInsert: (table, row) => withDefaults(world, table, row),
    afterWrite: (table, kind, rows) => triggers(world, table, kind, rows),
  };

  return {
    async handle(url, init) {
      await latency();
      const parsed = new URL(url);
      const method = (init?.method ?? "GET").toUpperCase();
      const restAt = parsed.pathname.indexOf("/rest/v1/");
      if (restAt >= 0) {
        const name = decodeURIComponent(parsed.pathname.slice(restAt + "/rest/v1/".length));
        if (name.startsWith("rpc/")) {
          const handler = rpc[name.slice(4)];
          if (!handler) return reply(404, {code: "PGRST202", message: "Ez a funkció gyakorló módban nem érhető el.", details: null, hint: null});
          try {
            const args = (parseBody(init?.body) ?? Object.fromEntries(parsed.searchParams)) as Record<string, unknown>;
            return reply(200, structuredClone(handler(args, world) ?? null));
          } catch (error) {
            return failure(error);
          }
        }
        if (virtual[name]) world.tables[name] = virtual[name]();
        // Reads see what RLS would show; writes work on the whole table.
        const rule = visible[name];
        const tables = rule && (method === "GET" || method === "HEAD")
          ? {...world.tables, [name]: (world.tables[name] ?? []).filter(rule)} : world.tables;
        try {
          const result = handleRest(schema, tables, {
            table: name, method, params: parsed.searchParams, headers: new Headers(init?.headers), body: parseBody(init?.body),
          });
          return reply(result.status, result.body === undefined ? undefined : structuredClone(result.body), result.headers);
        } catch (error) {
          return failure(error);
        }
      }

      // Storage: uploads are accepted and forgotten, signed links point nowhere (demo files are public pictures).
      const storage = parsed.pathname.split("/storage/v1/")[1] ?? "";
      if (storage.startsWith("object/sign/")) {
        const rest = storage.slice("object/sign/".length);
        const body = parseBody(init?.body) as {paths?: string[]} | null;
        if (body?.paths) return reply(200, body.paths.map((path) => ({path, signedURL: `/object/sign/${rest}/${path}?token=practice`, error: null})));
        return reply(200, {signedURL: `/object/sign/${rest}?token=practice`});
      }
      if (storage.startsWith("object/list/")) return reply(200, []);
      if (method === "DELETE") return reply(200, []);
      if (storage.startsWith("object/")) return reply(200, {Key: storage.slice("object/".length), Id: world.id()});
      return reply(200, {});
    },

    async api(path, body) {
      await latency();
      const handler = api[path];
      if (!handler) throw new Error("Ez a művelet gyakorló módban nem érhető el.");
      return structuredClone(handler((body ?? {}) as Row, world));
    },
  };
}
