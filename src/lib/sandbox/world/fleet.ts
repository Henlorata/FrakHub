import type {Row} from "../postgrest";
import {DAY, DEMO, SandboxError, type RpcHandler, type World} from "./context";
import {person} from "./people";

export function seedFleet(world: World) {
  const {tables, me, ago, day} = world;
  tables.fleet_categories = [
    {id: "de-cat-patrol", name: "Járőrautók", description: "Általános járőrszolgálat.", unit: null, min_rank: null, tone: "sky", sort_order: 10},
    {id: "de-cat-sahp", name: "Autópálya-rendészet", description: "SAHP képesítéssel.", unit: "SAHP", min_rank: null, tone: "orange", sort_order: 20},
    {id: "de-cat-seb", name: "SEB járművek", description: "Különleges egység.", unit: "SEB", min_rank: null, tone: "red", sort_order: 30},
    {id: "de-cat-air", name: "Légi egység", description: "AB képesítéssel.", unit: "AB", min_rank: null, tone: "cyan", sort_order: 40},
  ];
  const vehicle = (n: number, plate: string, model: string, category: string, expiresIn: number | null, extra: Row = {}): Row => ({
    id: DEMO.vehicle(n), plate, model, category_id: category, game_id: 400 + n, station: ["Downtown", "Angel Pine", "Fort Carson"][n % 3],
    callsign: null, license_name: null, capacity: 2, shared_label: null, allowed_units: null, min_rank: null, is_unmarked: false,
    registration_required: true, registration_expires_on: expiresIn === null ? null : day(expiresIn), notes: null, is_active: true,
    created_at: ago(200 * DAY), updated_at: ago(10 * DAY), ...extra,
  });
  tables.fleet_vehicles = [
    vehicle(1, "SD-101", "Buffalo STX", "de-cat-patrol", 24),
    vehicle(2, "SD-102", "Police Cruiser", "de-cat-patrol", 3),
    vehicle(3, "SD-103", "Granger", "de-cat-patrol", 40),
    vehicle(4, "SD-104", "Buffalo STX", "de-cat-patrol", 5),
    vehicle(5, "SD-201", "Interceptor", "de-cat-sahp", 18),
    vehicle(6, "SD-301", "Enforcer", "de-cat-seb", 60, {capacity: null, shared_label: "SEB készlet"}),
    vehicle(7, "AIR-01", "Maverick", "de-cat-air", 12, {callsign: "AIR-001", capacity: 4}),
    vehicle(8, "SD-105", "Washington", "de-cat-patrol", -2, {is_unmarked: true}),
  ];
  const key = (vehicleId: string, userId: string, daysAgo: number, temporary = false): Row =>
    ({id: world.id(), vehicle_id: vehicleId, user_id: userId, is_temporary: temporary, note: null, assigned_at: ago(daysAgo * DAY)});
  tables.fleet_assignments = [
    key(DEMO.vehicle(4), me.id, 35),
    key(DEMO.vehicle(1), person(9), 60),
    key(DEMO.vehicle(2), person(11), 20),
    key(DEMO.vehicle(3), person(5), 90),
    key(DEMO.vehicle(5), person(2), 120),
    key(DEMO.vehicle(7), person(7), 80),
    key(DEMO.vehicle(8), person(4), 30),
    key(DEMO.vehicle(1), person(12), 2, true),
  ];

  const request = (userId: string, type: string, status: string, reason: string, minutesAgo: number, extra: Row = {}): Row => ({
    id: world.id(), user_id: userId, vehicle_type: type, vehicle_plate: null, reason, status, admin_comment: null, processed_by: null,
    created_at: ago(minutesAgo), updated_at: ago(minutesAgo), ...extra,
  });
  tables.vehicle_requests = [
    request(person(12), "Buffalo STX", "pending", "Akadémiai gyakorlathoz, az oktató kísérésével.", 50),
    request(person(10), "Washington (civil)", "pending", "Megfigyeléshez az MCB aktához.", 3 * 60),
    request(me.id, "Granger", "pending", "Terepjáró a Fort Carson-i járőrözéshez.", 26 * 60),
    request(me.id, "Buffalo STX", "approved", "Saját szolgálati jármű.", 35 * DAY, {vehicle_plate: "SD-104", processed_by: person(5)}),
    request(person(11), "Maverick", "rejected", "Szeretnék repülni.", 9 * DAY, {admin_comment: "Ehhez AB képesítés kell.", processed_by: person(5)}),
  ];

  tables.fleet_registration_requests = [
    {id: world.id(), vehicle_id: DEMO.vehicle(2), submitted_by: person(11), status: "pending", source: "not_detected", image_path: null,
      detected_model: null, detected_plate: null, detected_expires_on: null, proposed_expires_on: day(30), note: "Homályos lett a kép.",
      previous_expires_on: day(3), decided_by: null, decided_at: null, decided_expires_on: null, decision_note: null, created_at: ago(5 * 60)},
  ];
  const batch = world.id();
  tables.vehicle_warnings = [
    {id: world.id(), vehicle_id: DEMO.vehicle(2), plate: "SD-102", user_id: person(11), reason: "Tankolás nélkül leadott jármű.", issued_by: person(5),
      batch_id: batch, created_at: ago(6 * DAY), revoked_at: null, revoked_by: null, converted_record_id: null},
  ];
  tables.fleet_tuning_presets = [
    {id: world.id(), model: "Buffalo STX", settings: {Motor: "3. szint", Fék: "2. szint", Felfüggesztés: "Sport"}, note: null, sort_order: 10, updated_at: ago(30 * DAY)},
    {id: world.id(), model: "Interceptor", settings: {Motor: "4. szint", Turbó: "Igen"}, note: "Csak SAHP.", sort_order: 20, updated_at: ago(30 * DAY)},
  ];
}

export function vehicleJson(world: World, vehicle: Row) {
  return {
    ...vehicle,
    holders: (world.tables.fleet_assignments ?? []).filter((key) => key.vehicle_id === vehicle.id)
      .map((key) => ({user_id: key.user_id, is_temporary: key.is_temporary, note: key.note, assigned_at: key.assigned_at})),
  };
}

const findVehicle = (world: World, id: unknown) => {
  const vehicle = (world.tables.fleet_vehicles ?? []).find((row) => row.id === id);
  if (!vehicle) throw new SandboxError("A jármű nem található.");
  return vehicle;
};

export const fleetRpc: Record<string, RpcHandler> = {
  fleet_registration_apply: (args, world) => {
    const vehicle = findVehicle(world, args._vehicle_id);
    vehicle.registration_expires_on = args._expires_on;
    vehicle.updated_at = world.stamp();
    return vehicleJson(world, vehicle);
  },
  fleet_renew_registration: (args, world) => {
    const vehicle = findVehicle(world, args._vehicle_id);
    vehicle.registration_expires_on = args._expires_on ?? null;
    vehicle.updated_at = world.stamp();
    return vehicleJson(world, vehicle);
  },
  fleet_registration_submit: (args, world) => {
    const vehicle = findVehicle(world, args._vehicle_id);
    const row: Row = {
      id: world.id(), vehicle_id: vehicle.id, submitted_by: world.me.id, status: "pending", source: args._source, image_path: args._image_path,
      detected_model: args._detected_model, detected_plate: args._detected_plate, detected_expires_on: args._detected_expires_on,
      proposed_expires_on: args._proposed_expires_on, note: args._note, previous_expires_on: vehicle.registration_expires_on, decided_by: null,
      decided_at: null, decided_expires_on: null, decision_note: null, created_at: world.stamp(),
    };
    (world.tables.fleet_registration_requests ??= []).push(row);
    return row;
  },
  fleet_registration_cancel: (args, world) => {
    const row = (world.tables.fleet_registration_requests ?? []).find((item) => item.id === args._request_id);
    if (row) row.status = "cancelled";
    return row?.image_path ?? null;
  },
  fleet_registration_decide: (args, world) => {
    const row = (world.tables.fleet_registration_requests ?? []).find((item) => item.id === args._request_id);
    if (!row) throw new SandboxError("A kérelem nem található.");
    const vehicle = findVehicle(world, row.vehicle_id);
    Object.assign(row, {status: args._approve ? "approved" : "rejected", decided_by: world.me.id, decided_at: world.stamp(),
      decided_expires_on: args._expires_on ?? null, decision_note: args._note ?? null});
    if (args._approve) vehicle.registration_expires_on = args._expires_on;
    return {image_path: row.image_path, vehicle: vehicleJson(world, vehicle)};
  },
};

/** The trigger of an approved vehicle request: the requester gets the key of the vehicle with that plate. */
export function afterVehicleRequestUpdate(world: World, rows: Row[]) {
  for (const row of rows) {
    if (row.status !== "approved" || !row.vehicle_plate) continue;
    const vehicle = (world.tables.fleet_vehicles ?? []).find((item) => item.plate === row.vehicle_plate);
    const keys = (world.tables.fleet_assignments ??= []);
    if (vehicle && !keys.some((key) => key.vehicle_id === vehicle.id && key.user_id === row.user_id)) {
      keys.push({id: world.id(), vehicle_id: vehicle.id, user_id: row.user_id, is_temporary: false, note: null, assigned_at: world.stamp()});
    }
  }
}
