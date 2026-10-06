import {calculateSystemRole, isStaff} from "@shared/ranks";
import type {Row} from "../postgrest";
import {DAY, DEMO, SandboxError, type RpcHandler, type World} from "./context";

/**
 * The demo members. Their names are obviously made up ("Teszt Elek" is the Hungarian John Doe), so
 * nobody mistakes the practice world for the real roster.
 */
const PEOPLE: [name: string, rank: string, division: string, divisionRank: string | null, qualifications: string[], extra?: Row][] = [
  ["Teszt Elek", "Commander", "TSB", null, ["TB", "FAB"]],
  ["Minta Márta", "Captain II.", "TSB", null, ["SAHP"]],
  ["Kamu Kálmán", "Lieutenant I.", "SEB", "Operator III.", ["MU"], {is_bureau_commander: true}],
  ["Próba Panna", "Sergeant II.", "MCB", "Investigator III.", ["GW"], {is_bureau_commander: true}],
  ["Gyakorló Gábor", "Sergeant I.", "TSB", null, ["SAHP", "TB"]],
  ["Példa Piroska", "Corporal", "MCB", "Investigator II.", []],
  ["Demó Dénes", "Staff Deputy Sheriff", "TSB", null, ["AB", "MU"], {commanded_divisions: ["AB"]}],
  ["Szimuláns Szilvia", "Senior Deputy Sheriff", "SEB", "Operator I.", []],
  ["Bemutató Bence", "Deputy Sheriff III.", "TSB", null, []],
  ["Fiktív Flóra", "Deputy Sheriff II.", "MCB", "Investigator I.", []],
  ["Kitalált Kristóf", "Deputy Sheriff I.", "TSB", null, []],
  ["Újonc Ubul", "Deputy Sheriff Trainee", "TSB", null, []],
  ["Jelölt Janka", "Deputy Sheriff Trainee", "TSB", null, []],
  ["Várakozó Vilmos", "Deputy Sheriff Trainee", "TSB", null, [], {system_role: "pending", onboarding_completed: false}],
];

export const person = DEMO.person;

export function seedPeople(world: World) {
  const {tables, me, ago, day, month} = world;
  const days = [1400, 900, 620, 480, 400, 310, 260, 200, 150, 95, 60, 3, 2, 0.2];
  tables.profiles = [
    {...me, email: undefined},
    ...PEOPLE.map(([full_name, faction_rank, division, division_rank, qualifications, extra], index) => ({
      id: person(index + 1),
      full_name,
      badge_number: String(9101 + index),
      faction_rank,
      division,
      division_rank,
      qualifications,
      is_bureau_manager: false,
      is_bureau_commander: false,
      commanded_divisions: [],
      system_role: calculateSystemRole(faction_rank),
      avatar_url: null,
      onboarding_completed: true,
      created_at: ago(days[index] * DAY),
      last_promotion_date: ago(Math.min(days[index], 40 + index * 9) * DAY),
      ...extra,
    })),
  ];

  tables.ribbons = [
    {id: "de-ribbon-1", name: "Szolgálati érdemérem", description: "Kiemelkedő szolgálatért.", color_hex: "#eab308", image_url: null},
    {id: "de-ribbon-2", name: "Bátorsági kitüntetés", description: "Életmentésért, veszélyes helyzetben tanúsított bátorságért.", color_hex: "#ef4444", image_url: null},
    {id: "de-ribbon-3", name: "Kiváló oktató", description: "Az akadémián végzett munkáért.", color_hex: "#22d3ee", image_url: null},
  ];
  tables.user_ribbons = [
    {id: world.id(), user_id: person(1), ribbon_id: "de-ribbon-1", awarded_at: ago(300 * DAY)},
    {id: world.id(), user_id: person(4), ribbon_id: "de-ribbon-2", awarded_at: ago(120 * DAY)},
    {id: world.id(), user_id: person(5), ribbon_id: "de-ribbon-3", awarded_at: ago(40 * DAY)},
    {id: world.id(), user_id: me.id, ribbon_id: "de-ribbon-1", awarded_at: ago(20 * DAY)},
  ];

  const record = (user_id: string, kind: string, title: string, details: string | null, status: string, createdBy: string, minutesAgo: number,
    starts_on: string | null = null, ends_on: string | null = null): Row => ({
    id: world.id(), user_id, kind, title, details, starts_on, ends_on, status, created_by: createdBy, created_at: ago(minutesAgo),
    decided_by: status === "pending" ? null : createdBy, decided_at: status === "pending" ? null : ago(minutesAgo),
  });
  tables.hr_records = [
    record(me.id, "commendation", "Példás helytállás egy üldözésnél", "A Downtown-i üldözést szabályosan, sérülés nélkül zárta le.", "active", person(2), 12 * DAY),
    record(person(11), "warning", "Késés az eligazításról", "Harmadik alkalom ebben a hónapban.", "active", person(5), 4 * DAY),
    record(person(6), "commendation", "Gyors nyomozati munka", null, "active", person(4), 30 * DAY),
    record(person(8), "leave", "Nyaralás", "Családi program, telefonon elérhető.", "pending", person(8), 6 * 60, day(3), day(10)),
    record(person(9), "leave", "Vizsgaidőszak", null, "active", person(9), 5 * DAY, day(-2), day(4)),
  ];

  tables.member_events = [
    {id: world.id(), user_id: me.id, actor_id: person(2), kind: "rank", from_value: null, to_value: me.faction_rank, detail: null, created_at: ago(25 * DAY)},
    {id: world.id(), user_id: me.id, actor_id: null, kind: "joined", from_value: null, to_value: null, detail: null, created_at: me.created_at},
    {id: world.id(), user_id: person(6), actor_id: person(4), kind: "rank", from_value: "Staff Deputy Sheriff", to_value: "Corporal", detail: null, created_at: ago(9 * DAY)},
    {id: world.id(), user_id: person(10), actor_id: person(4), kind: "division", from_value: "TSB", to_value: "MCB", detail: null, created_at: ago(14 * DAY)},
    {id: world.id(), user_id: person(7), actor_id: person(1), kind: "qualifications", from_value: "AB", to_value: "AB, MU", detail: null, created_at: ago(21 * DAY)},
    {id: world.id(), user_id: person(12), actor_id: null, kind: "joined", from_value: null, to_value: null, detail: null, created_at: ago(3 * DAY)},
  ];

  const stations = ["Downtown", "Angel Pine", "Fort Carson"];
  const members = tables.profiles.filter((row) => row.system_role !== "pending");
  tables.member_details = members.map((row, index) => ({
    user_id: row.id, station: stations[index % 3], parking_spot: `${(index % 4) + 1}/${index + 3}`, joined_on: String(row.created_at).slice(0, 10),
    join_type: index % 5 === 3 ? "referral" : index % 7 === 4 ? "returned" : "new", recruited_by: index % 5 === 3 ? "Teszt Elek" : null,
    activity_status: index === 10 ? "less_active" : "active", updated_at: ago(30 * DAY), updated_by: person(1),
  }));
  tables.duty_time_entries = members.flatMap((row, index) => [-3, -2, -1, 0].map((offset) => ({
    user_id: row.id, month: month(offset),
    minutes: offset === 0 ? 600 + ((index * 431) % 1500) : 1500 + ((index * 977 + offset * 313) % 3600),
    updated_at: ago(2 * DAY), updated_by: person(5),
  })));
  tables.member_bank_accounts = members.slice(0, 10).map((row, index) => ({
    user_id: row.id, account_number: `117${String(10000 + index * 731).padStart(5, "0")}-${String(40000000 + index * 1234567).slice(0, 8)}-${String(10000000 + index * 7654321).slice(0, 8)}`,
  }));
  tables.former_members = [
    {id: world.id(), profile_id: null, full_name: "Távozott Tódor", badge_number: "9180", faction_rank: "Deputy Sheriff II.", division: "TSB",
      joined_on: day(-300), left_on: day(-40), leave_type: "resigned", reason: "Saját kérésére távozott, más városba költözött.", rehire: "eligible",
      rehire_note: null, recorded_by: person(2), created_at: ago(40 * DAY), updated_at: ago(40 * DAY)},
    {id: world.id(), profile_id: null, full_name: "Kirúgott Kornél", badge_number: "9181", faction_rank: "Deputy Sheriff I.", division: "TSB",
      joined_on: day(-120), left_on: day(-15), leave_type: "dismissed", reason: "Ismételt szabályszegés, három aktív figyelmeztetés.", rehire: "not_eligible",
      rehire_note: "Visszavétele nem javasolt.", recorded_by: person(1), created_at: ago(15 * DAY), updated_at: ago(15 * DAY)},
  ];
}

const visibleTo = (world: World, userId: unknown) => isStaff(world.me) || userId === world.me.id;

export const peopleRpc: Record<string, RpcHandler> = {
  get_active_leaves: (_args, world) => (world.tables.hr_records ?? [])
    .filter((row) => row.kind === "leave" && row.status === "active" && String(row.ends_on) >= world.day())
    .map((row) => ({user_id: row.user_id, starts_on: row.starts_on, ends_on: row.ends_on})),

  get_member_last_seen: (_args, world) => (world.tables.profiles ?? []).map((row, index) => ({
    user_id: row.id, last_seen_at: row.id === world.me.id ? world.stamp() : world.ago(30 + index * 377),
  })),

  get_hr_registry: (args, world) => {
    const since = typeof args._since === "string" ? args._since : world.month(-5);
    const only = typeof args._user_id === "string" ? args._user_id : null;
    const mine = (row: Row) => !only || row.user_id === only;
    const vehicles = (world.tables.fleet_vehicles ?? []).filter((vehicle) => vehicle.is_active).map((vehicle) => ({
      id: vehicle.id, plate: vehicle.plate, model: vehicle.model, category_id: vehicle.category_id, callsign: vehicle.callsign,
      registration_expires_on: vehicle.registration_expires_on, registration_required: vehicle.registration_required,
      is_unmarked: vehicle.is_unmarked, shared_label: vehicle.shared_label,
      holder_ids: (world.tables.fleet_assignments ?? []).filter((key) => key.vehicle_id === vehicle.id).map((key) => key.user_id),
      pending_review: (world.tables.fleet_registration_requests ?? []).some((request) => request.vehicle_id === vehicle.id && request.status === "pending"),
    }));
    return {
      details: (world.tables.member_details ?? []).filter(mine),
      duty: (world.tables.duty_time_entries ?? []).filter((row) => mine(row) && String(row.month) >= since),
      vehicles: only ? vehicles.filter((vehicle) => vehicle.holder_ids.includes(only)) : vehicles,
      vehicle_warnings: (world.tables.vehicle_warnings ?? []).filter((row) => mine(row) && visibleTo(world, row.user_id)),
      bank_accounts: (world.tables.member_bank_accounts ?? []).filter((row) => mine(row) && visibleTo(world, row.user_id)),
    };
  },

  hr_give_award: (args, world) => {
    const row = {id: world.id(), user_id: args._target_user_id, ribbon_id: args._ribbon_id, awarded_at: world.stamp()};
    (world.tables.user_ribbons ??= []).push(row);
    return row.id;
  },

  change_user_name: (args, world) => {
    const name = String(args._new_name ?? "").trim();
    if (name.length < 3) throw new SandboxError("A név túl rövid.");
    const me = world.person(world.me.id);
    if (me) me.full_name = name;
    return null;
  },
};

/** The privileged `api/` functions of HR, answered in the demo world. */
export const peopleApi: Record<string, (body: Row, world: World) => unknown> = {
  "/api/admin/update-role": (body, world) => {
    const target = world.person(String(body.userId));
    if (!target) throw new SandboxError("A tag nem található.");
    const {userId: _ignored, restore_promotion_date: _restore, ...changes} = body;
    Object.assign(target, changes);
    if (typeof changes.faction_rank === "string") {
      target.system_role = target.system_role === "pending" ? "pending" : calculateSystemRole(changes.faction_rank);
      target.last_promotion_date = world.stamp();
    }
    return {profile: target};
  },
  "/api/admin/delete-user": (body, world) => {
    const id = String(body.userId);
    const target = world.person(id);
    world.tables.profiles = (world.tables.profiles ?? []).filter((row) => row.id !== id);
    if (target) {
      (world.tables.former_members ??= []).unshift({
        id: world.id(), profile_id: null, full_name: target.full_name, badge_number: target.badge_number, faction_rank: target.faction_rank,
        division: target.division, joined_on: String(target.created_at).slice(0, 10), left_on: world.day(), leave_type: body.leave_type ?? "other",
        reason: body.reason ?? null, rehire: body.rehire ?? "eligible", rehire_note: body.rehire_note ?? null, recorded_by: world.me.id,
        created_at: world.stamp(), updated_at: world.stamp(),
      });
    }
    return {ok: true};
  },
  "/api/admin/update-password": () => ({ok: true}),
};
