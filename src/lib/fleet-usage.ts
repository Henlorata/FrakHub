
/**
 * Fleet utilisation for stock decisions, from what the logistics page has loaded already (the
 * cached stock and the vehicle requests): which categories and vehicles stand unused, which are
 * full, and which models are asked for without a free key. Shared pools are counted apart: their
 * use does not show in personal keys.
 *
 * Pure (unit-tested in e2e/fleet-usage.spec.ts): only the fields it reads are typed here, so the
 * stock rows (FleetVehicle, FleetCategory, VehicleRequest) fit as they are.
 */

export interface UsageVehicle {
  id: string;
  model: string;
  license_name: string | null;
  category_id: string | null;
  capacity: number | null;
  shared_label: string | null;
  created_at: string;
  holders: {is_temporary: boolean}[];
}

export interface UsageCategory {
  id: string;
}

export interface UsageRequest {
  vehicle_type: string;
  status: string;
  created_at: string;
}

export interface CategoryUsage<C extends UsageCategory = UsageCategory> {
  category: C | null;
  vehicles: number;
  /** Personal keys handed out. */
  keys: number;
  /** Keys of the vehicles with a limit (the utilisation's base). */
  capacity: number;
  limitedKeys: number;
  /** keys / capacity of the limited vehicles (null: none limited). */
  utilisation: number | null;
  /** Vehicles without any key (shared pools left out). */
  unused: number;
  /** Vehicles whose every key is out. */
  full: number;
  shared: number;
}

export type DemandStatus = "missing" | "full" | "available";

export interface ModelDemand {
  model: string;
  requests: number;
  pending: number;
  approved: number;
  rejected: number;
  /** Vehicles of this model in the stock. */
  stock: number;
  /** Free personal keys of those (null: unlimited). */
  freeKeys: number | null;
  status: DemandStatus;
}

export interface FleetUsage<V extends UsageVehicle = UsageVehicle, C extends UsageCategory = UsageCategory> {
  totals: {vehicles: number; keys: number; temporary: number; capacity: number; limitedKeys: number; utilisation: number | null;
    unused: number; full: number; shared: number};
  categories: CategoryUsage<C>[];
  /** Vehicles without a key, the longest in stock first. */
  idle: V[];
  /** Vehicles with every key out. */
  saturated: V[];
  /** Models asked for in the period, the most wanted first. */
  demand: ModelDemand[];
  requestCount: number;
}

/** Comparable model name: "Ford  Crown Victoria " -> "ford crown victoria" (accents folded). */
export const modelKey = (value: string) =>
  value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const isFull = (vehicle: UsageVehicle) => vehicle.capacity !== null && vehicle.holders.length >= vehicle.capacity;
const isIdle = (vehicle: UsageVehicle) => !vehicle.shared_label && vehicle.holders.length === 0;

/** The stock vehicles a requested model means: the same model, or one name containing the other. */
function matchingStock<V extends UsageVehicle>(model: string, vehicles: V[]): V[] {
  const key = modelKey(model);
  if (!key) return [];
  const exact = vehicles.filter((vehicle) => modelKey(vehicle.model) === key || modelKey(vehicle.license_name ?? "") === key);
  if (exact.length || key.length < 6) return exact;
  return vehicles.filter((vehicle) => {
    const other = modelKey(vehicle.model);
    return other.length >= 6 && (other.includes(key) || key.includes(other));
  });
}

function summarise<C extends UsageCategory>(category: C | null, vehicles: UsageVehicle[]): CategoryUsage<C> {
  const personal = vehicles.filter((vehicle) => !vehicle.shared_label);
  const limited = personal.filter((vehicle) => vehicle.capacity !== null);
  const capacity = limited.reduce((sum, vehicle) => sum + (vehicle.capacity ?? 0), 0);
  const limitedKeys = limited.reduce((sum, vehicle) => sum + Math.min(vehicle.holders.length, vehicle.capacity ?? 0), 0);
  return {
    category,
    vehicles: vehicles.length,
    keys: personal.reduce((sum, vehicle) => sum + vehicle.holders.length, 0),
    capacity,
    limitedKeys,
    utilisation: capacity > 0 ? limitedKeys / capacity : null,
    unused: personal.filter(isIdle).length,
    full: personal.filter(isFull).length,
    shared: vehicles.length - personal.length,
  };
}

export function fleetUsage<V extends UsageVehicle, C extends UsageCategory>(vehicles: V[], categories: C[], requests: UsageRequest[],
                                                                          {now = Date.now(), days = 90}: {now?: number; days?: number} = {}): FleetUsage<V, C> {
  const known = new Set(categories.map((category) => category.id));
  const groups = [...categories, null].map((category) => summarise(category,
    vehicles.filter((vehicle) => (category ? vehicle.category_id === category.id : !vehicle.category_id || !known.has(vehicle.category_id)))))
    .filter((group) => group.vehicles > 0);
  const all = summarise(null, vehicles);

  const since = now - days * 86_400_000;
  const recent = requests.filter((request) => Date.parse(request.created_at) >= since);
  const byModel = new Map<string, {model: string; requests: UsageRequest[]}>();
  for (const request of recent) {
    const key = modelKey(request.vehicle_type);
    if (!key) continue;
    const entry = byModel.get(key) ?? {model: request.vehicle_type.trim(), requests: []};
    entry.requests.push(request);
    byModel.set(key, entry);
  }
  const demand = [...byModel.values()].map(({model, requests: list}): ModelDemand => {
    const stock = matchingStock(model, vehicles).filter((vehicle) => !vehicle.shared_label);
    const unlimited = stock.some((vehicle) => vehicle.capacity === null);
    const free = unlimited ? null : stock.reduce((sum, vehicle) => sum + Math.max(0, (vehicle.capacity ?? 0) - vehicle.holders.length), 0);
    return {
      model,
      requests: list.length,
      pending: list.filter((request) => request.status === "pending").length,
      approved: list.filter((request) => request.status === "approved").length,
      rejected: list.filter((request) => request.status === "rejected").length,
      stock: stock.length,
      freeKeys: free,
      status: stock.length === 0 ? "missing" : free === 0 ? "full" : "available",
    };
  }).sort((a, b) => b.pending - a.pending || b.requests - a.requests || a.model.localeCompare(b.model, "hu"));

  return {
    totals: {
      vehicles: vehicles.length, keys: all.keys, temporary: vehicles.reduce((sum, vehicle) => sum + vehicle.holders.filter((holder) => holder.is_temporary).length, 0),
      capacity: all.capacity, limitedKeys: all.limitedKeys, utilisation: all.utilisation, unused: all.unused, full: all.full, shared: all.shared,
    },
    categories: groups,
    idle: vehicles.filter(isIdle).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    saturated: vehicles.filter((vehicle) => !vehicle.shared_label && isFull(vehicle)),
    demand,
    requestCount: recent.length,
  };
}
