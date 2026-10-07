import type {Row} from "../postgrest";
import {DAY, SandboxError, type RpcHandler, type World} from "./context";
import {person} from "./people";

/** The shift briefing in the demo world: a few BOLO alerts, the wanted persons, the last day. */

export function seedPatrol(world: World) {
  const {tables, ago} = world;
  const later = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
  tables.bolo_alerts = [
    {id: "de-bolo-1", kind: "vehicle", reason: "stolen", danger: "high", title: "Lopott fekete Sultan (bemutató)", plate: "SF-4821",
      vehicle_model: "Sultan", vehicle_color: "fekete", person_name: null, description: "A hátsó lökhárító sérült; két fegyveres ült benne.",
      last_seen_location: "Doherty, a vasútállomásnál", last_seen_at: ago(90), image_url: null, suspect_id: null, case_id: null, status: "active",
      expires_at: later(2 * DAY), resolved_at: null, resolved_by: null, resolution: null, created_by: person(2), created_at: ago(120), updated_at: ago(120)},
    {id: "de-bolo-2", kind: "person", reason: "missing", danger: "low", title: "Eltűnt idős férfi (bemutató)", plate: null, vehicle_model: null,
      vehicle_color: null, person_name: "Gipsz Jakab", description: "Szürke kabát, botot használ; zavart lehet.", last_seen_location: "Esplanade North",
      last_seen_at: ago(300), image_url: null, suspect_id: null, case_id: null, status: "active", expires_at: later(5 * DAY), resolved_at: null,
      resolved_by: null, resolution: null, created_by: person(5), created_at: ago(400), updated_at: ago(400)},
  ];
}

const bolos = (world: World) => (world.tables.bolo_alerts ??= []);
const isActive = (row: Row) => row.status === "active" && String(row.expires_at) > new Date().toISOString();

function boloJson(world: World, row: Row) {
  const author = world.person(row.created_by as string);
  const resolver = world.person(row.resolved_by as string);
  return {...row, created_by_name: author?.full_name ?? null, resolved_by_name: resolver?.full_name ?? null,
    can_manage: row.created_by === world.me.id || world.me.system_role !== "user", case: null, suspect: null};
}

const requireBolo = (world: World, id: unknown) => {
  const row = bolos(world).find((item) => item.id === id);
  if (!row) throw new SandboxError("A BOLO nem található.");
  return row;
};

export const patrolRpc: Record<string, RpcHandler> = {
  get_briefing: (_args, world) => ({
    generated_at: world.stamp(),
    bolos: bolos(world).filter(isActive).map((row) => boloJson(world, row)),
    resolved: bolos(world).filter((row) => row.status === "resolved").map((row) => boloJson(world, row)),
    wanted: [{id: "de-wanted-1", name: "Tony Montana (bemutató)", alias: "Scarface", mugshot_url: null, suspect_status: "wanted",
      decided_at: world.ago(DAY), expires_at: new Date(Date.now() + 6 * DAY * 60_000).toISOString(), case: null}],
    events: [],
    announcements: [],
    last24h: {tickets: 7, arrests: 2, reports: 3},
  }),
  get_bolos: (_args, world) => ({
    active: bolos(world).filter(isActive).map((row) => boloJson(world, row)),
    closed: bolos(world).filter((row) => !isActive(row)).map((row) => boloJson(world, row)),
  }),
  set_bolo_status: (args, world) => {
    const row = requireBolo(world, args._id);
    if (args._status === "active") {
      Object.assign(row, {status: "active", resolved_at: null, resolved_by: null, resolution: null,
        expires_at: new Date(Date.now() + Number(args._hours ?? 72) * 3_600_000).toISOString()});
    } else {
      Object.assign(row, {status: args._status, resolved_at: world.stamp(), resolved_by: world.me.id, resolution: args._note ?? null});
    }
    return boloJson(world, row);
  },
  extend_bolo: (args, world) => {
    const row = requireBolo(world, args._id);
    row.expires_at = new Date(Math.max(Date.now(), new Date(String(row.expires_at)).getTime()) + Number(args._hours ?? 24) * 3_600_000).toISOString();
    return boloJson(world, row);
  },
  lookup_plate: (args, world) => {
    const key = String(args._query ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const plateKey = (value: unknown) => String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    return {
      bolos: bolos(world).filter((row) => key.length >= 2 && plateKey(row.plate).startsWith(key))
        .map((row) => ({id: row.id, title: row.title, plate: row.plate, status: row.status, danger: row.danger, active: isActive(row)})),
      fleet: (world.tables.fleet_vehicles ?? []).filter((row) => key.length >= 2 && plateKey(row.plate).startsWith(key)).slice(0, 5)
        .map((row) => ({id: row.id, plate: row.plate, model: row.model})),
      persons: [],
    };
  },
};
