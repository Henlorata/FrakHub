import {useEffect, useSyncExternalStore} from "react";
import {onClientCachesCleared} from "./cache";
import {supabase} from "./supabaseClient";
import {createVersionedLoader} from "./versioned-cache";
import type {FleetCategory, FleetHolder, FleetTuningPreset, FleetVehicle} from "@/types/supabase";

/**
 * The vehicle stock with its key holders and categories, loaded once and shared by the
 * fleet pages, the vehicle request approval and the HR registry (two requests, refreshed after
 * five minutes). Kept between visits and downloaded again only when the fleet changed
 * (versioned-cache.ts). Changes made in the app update it in place.
 */

export const VEHICLE_COLUMNS =
  "id, plate, model, category_id, game_id, station, callsign, license_name, capacity, shared_label, allowed_units, min_rank, "
  + "is_unmarked, registration_required, registration_expires_on, notes, is_active, created_at, updated_at, "
  + "holders:fleet_assignments(user_id, is_temporary, note, assigned_at)";
const CATEGORY_COLUMNS = "id, name, description, unit, min_rank, tone, sort_order";
const TTL_MS = 5 * 60 * 1000;

interface FleetState {
  vehicles: FleetVehicle[] | null;
  categories: FleetCategory[];
  error: boolean;
}

let state: FleetState = {vehicles: null, categories: [], error: false};

const stock = createVersionedLoader("fleet", ["fleet"], async () => {
  const [vehicleResult, categoryResult] = await Promise.all([
    supabase.from("fleet_vehicles").select(VEHICLE_COLUMNS).eq("is_active", true).order("plate"),
    supabase.from("fleet_categories").select(CATEGORY_COLUMNS).order("sort_order"),
  ]);
  if (vehicleResult.error) throw vehicleResult.error;
  if (categoryResult.error) throw categoryResult.error;
  return {vehicles: (vehicleResult.data ?? []) as unknown as FleetVehicle[], categories: (categoryResult.data ?? []) as FleetCategory[]};
});
let loadedAt = 0;
let pending: Promise<void> | null = null;
/** Bumped when the caches are cleared, so a load already running does not refill the store. */
let generation = 0;
const listeners = new Set<() => void>();

const sortVehicles = (vehicles: FleetVehicle[]) => [...vehicles].sort((a, b) => a.plate.localeCompare(b.plate, "hu", {numeric: true}));

function update(next: Partial<FleetState>) {
  state = {...state, ...next};
  listeners.forEach((listener) => listener());
}

/** Loads the stock (cached; `force` reloads). */
export function loadFleet(force = false): Promise<void> {
  if (!force && state.vehicles && Date.now() - loadedAt < TTL_MS) return Promise.resolve();
  if (pending) return pending;
  const request: Promise<void> = (async () => {
    const started = generation;
    try {
      const loaded = await stock.get(force);
      if (started !== generation) return;
      loadedAt = Date.now();
      update({error: false, vehicles: sortVehicles(loaded.vehicles), categories: loaded.categories});
    } catch {
      if (started === generation) update({error: true, vehicles: state.vehicles ?? []});
    }
  })().finally(() => {
    if (pending === request) pending = null;
  });
  pending = request;
  return request;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The stock; starts loading on first use (`enabled: false` only reads what is loaded already). */
export function useFleet({enabled = true}: {enabled?: boolean} = {}) {
  const snapshot = useSyncExternalStore(subscribe, () => state);
  useEffect(() => {
    if (enabled) void loadFleet();
  }, [enabled]);
  return snapshot;
}

export function upsertFleetVehicle(vehicle: FleetVehicle) {
  const others = (state.vehicles ?? []).filter((item) => item.id !== vehicle.id);
  update({vehicles: sortVehicles(vehicle.is_active ? [...others, vehicle] : others)});
}

export function patchFleetVehicle(id: string, patch: Partial<FleetVehicle>) {
  update({vehicles: (state.vehicles ?? []).map((item) => (item.id === id ? {...item, ...patch} : item))});
}

export function removeFleetVehicle(id: string) {
  update({vehicles: (state.vehicles ?? []).filter((item) => item.id !== id)});
}

export function setFleetHolders(id: string, holders: FleetHolder[]) {
  patchFleetVehicle(id, {holders});
}

export function upsertFleetCategory(category: FleetCategory) {
  update({categories: [...state.categories.filter((item) => item.id !== category.id), category]
    .sort((a, b) => a.sort_order - b.sort_order)});
}

/** One vehicle, fresh from the database (the vehicle page). */
export async function fetchFleetVehicle(id: string): Promise<FleetVehicle | null> {
  const {data, error} = await supabase.from("fleet_vehicles").select(VEHICLE_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  const vehicle = (data ?? null) as unknown as FleetVehicle | null;
  if (vehicle && state.vehicles) upsertFleetVehicle(vehicle);
  return vehicle;
}

// --- Tuning presets: small and rarely changed, cached for the session ---------------------

let presets: FleetTuningPreset[] | null = null;
let presetsPending: Promise<FleetTuningPreset[]> | null = null;

export function loadTuningPresets(force = false): Promise<FleetTuningPreset[]> {
  if (presets && !force) return Promise.resolve(presets);
  if (presetsPending) return presetsPending;
  const request: Promise<FleetTuningPreset[]> = (async () => {
    const started = generation;
    const {data, error} = await supabase.from("fleet_tuning_presets").select("id, model, settings, note, sort_order, updated_at")
      .order("sort_order");
    if (error) throw error;
    const loaded = (data ?? []) as FleetTuningPreset[];
    if (started === generation) presets = loaded;
    return loaded;
  })().finally(() => {
    if (presetsPending === request) presetsPending = null;
  });
  presetsPending = request;
  return request;
}

export function replaceTuningPresets(next: FleetTuningPreset[]) {
  presets = next;
}

onClientCachesCleared(() => {
  generation += 1;
  state = {vehicles: null, categories: [], error: false};
  loadedAt = 0;
  pending = null;
  presets = null;
  presetsPending = null;
  listeners.forEach((listener) => listener());
});
