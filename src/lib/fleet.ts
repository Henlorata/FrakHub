import {getRankPriority, isStaff, type RankSubject} from "@shared/ranks";
import type {FleetCategory, FleetTone, FleetUnit, FleetVehicle} from "@/types/supabase";

/**
 * Fleet rules on the client. The database enforces the same (private.fleet_can_hold,
 * private.can_assign_fleet_vehicle, private.can_submit_fleet_registration); these decide
 * what the UI offers and explains.
 */

/** Stations of the stock ("Station" column of the sheet; Hubert is the SEB base). */
export const FLEET_STATIONS = ["Downtown", "Angel Pine", "Fort Carson", "Hubert"] as const;

export const UNIT_LABELS: Record<FleetUnit, string> = {
  TSB: "TSB", SEB: "SEB", MCB: "MCB", SAHP: "SAHP", AB: "Aero Bureau", MU: "Medical Unit", GW: "Game Warden", FAB: "FAB",
  SIB: "SIB", TB: "Kiképzők",
};

export const FLEET_UNITS = Object.keys(UNIT_LABELS) as FleetUnit[];

/** Category colours (the coloured bands of the sheet). */
export const FLEET_TONES: Record<FleetTone, {band: string; text: string; chip: string; glow: string; dot: string}> = {
  orange: {band: "from-orange-500/25 via-orange-500/10", text: "text-orange-300", chip: "bg-orange-500/10 text-orange-200 ring-orange-500/30", glow: "bg-orange-500/20", dot: "bg-orange-400"},
  amber: {band: "from-amber-500/25 via-amber-500/10", text: "text-amber-300", chip: "bg-amber-500/10 text-amber-200 ring-amber-500/30", glow: "bg-amber-500/20", dot: "bg-amber-400"},
  yellow: {band: "from-yellow-500/25 via-yellow-500/10", text: "text-yellow-300", chip: "bg-yellow-500/10 text-yellow-200 ring-yellow-500/30", glow: "bg-yellow-500/20", dot: "bg-yellow-400"},
  lime: {band: "from-lime-500/25 via-lime-500/10", text: "text-lime-300", chip: "bg-lime-500/10 text-lime-200 ring-lime-500/30", glow: "bg-lime-500/20", dot: "bg-lime-400"},
  green: {band: "from-green-500/25 via-green-500/10", text: "text-green-300", chip: "bg-green-500/10 text-green-200 ring-green-500/30", glow: "bg-green-500/20", dot: "bg-green-400"},
  emerald: {band: "from-emerald-500/25 via-emerald-500/10", text: "text-emerald-300", chip: "bg-emerald-500/10 text-emerald-200 ring-emerald-500/30", glow: "bg-emerald-500/20", dot: "bg-emerald-400"},
  teal: {band: "from-teal-500/25 via-teal-500/10", text: "text-teal-300", chip: "bg-teal-500/10 text-teal-200 ring-teal-500/30", glow: "bg-teal-500/20", dot: "bg-teal-400"},
  cyan: {band: "from-cyan-500/25 via-cyan-500/10", text: "text-cyan-300", chip: "bg-cyan-500/10 text-cyan-200 ring-cyan-500/30", glow: "bg-cyan-500/20", dot: "bg-cyan-400"},
  sky: {band: "from-sky-500/25 via-sky-500/10", text: "text-sky-300", chip: "bg-sky-500/10 text-sky-200 ring-sky-500/30", glow: "bg-sky-500/20", dot: "bg-sky-400"},
  blue: {band: "from-blue-500/25 via-blue-500/10", text: "text-blue-300", chip: "bg-blue-500/10 text-blue-200 ring-blue-500/30", glow: "bg-blue-500/20", dot: "bg-blue-400"},
  indigo: {band: "from-indigo-500/25 via-indigo-500/10", text: "text-indigo-300", chip: "bg-indigo-500/10 text-indigo-200 ring-indigo-500/30", glow: "bg-indigo-500/20", dot: "bg-indigo-400"},
  violet: {band: "from-violet-500/25 via-violet-500/10", text: "text-violet-300", chip: "bg-violet-500/10 text-violet-200 ring-violet-500/30", glow: "bg-violet-500/20", dot: "bg-violet-400"},
  rose: {band: "from-rose-500/25 via-rose-500/10", text: "text-rose-300", chip: "bg-rose-500/10 text-rose-200 ring-rose-500/30", glow: "bg-rose-500/20", dot: "bg-rose-400"},
  red: {band: "from-red-500/25 via-red-500/10", text: "text-red-300", chip: "bg-red-500/10 text-red-200 ring-red-500/30", glow: "bg-red-500/20", dot: "bg-red-400"},
  slate: {band: "from-slate-400/25 via-slate-400/10", text: "text-slate-200", chip: "bg-slate-500/10 text-slate-200 ring-slate-400/30", glow: "bg-slate-400/20", dot: "bg-slate-300"},
};

/** The profile fields the fleet rules need (DirectoryProfile and Profile both satisfy it). */
export interface FleetSubject extends RankSubject {
  division_rank?: string | null;
}

/** Member of a bureau (TSB/SEB/MCB: the division) or of a unit (qualification or led unit). */
export const isUnitMember = (person: FleetSubject, unit: string): boolean =>
  unit === "TSB" || unit === "SEB" || unit === "MCB"
    ? person.division === unit
    : !!person.qualifications?.includes(unit) || !!person.commanded_divisions?.includes(unit);

/** Leader of a bureau (SEB/MCB bureau commander) or unit (commanded_divisions), or a bureau manager. */
export const leadsUnit = (person: FleetSubject, unit: string | null | undefined): boolean =>
  !!unit && person.system_role !== "pending" && (
    !!person.is_bureau_manager
    || ((unit === "SEB" || unit === "MCB") && !!person.is_bureau_commander && person.division === unit)
    || !!person.commanded_divisions?.includes(unit));

/** The units allowed to hold a vehicle (its own list, otherwise the category's unit). */
export const vehicleUnits = (vehicle: Pick<FleetVehicle, "allowed_units">, category?: FleetCategory | null): FleetUnit[] =>
  vehicle.allowed_units ?? (category?.unit ? [category.unit] : []);

export const vehicleMinRank = (vehicle: Pick<FleetVehicle, "min_rank">, category?: FleetCategory | null) =>
  vehicle.min_rank ?? category?.min_rank ?? null;

/** Why a member may not hold a key of the vehicle (null: they may). */
export function holdBlocker(person: FleetSubject, vehicle: FleetVehicle, category?: FleetCategory | null): string | null {
  if (person.system_role === "pending") return "Jóváhagyásra váró fiók.";
  if (!vehicle.is_active) return "A jármű ki van vezetve.";
  const units = vehicleUnits(vehicle, category);
  if (units.length && !units.some((unit) => isUnitMember(person, unit))) {
    return `Csak ${units.map((unit) => UNIT_LABELS[unit] ?? unit).join(" / ")} tagoknak.`;
  }
  const minRank = vehicleMinRank(vehicle, category);
  if (minRank && getRankPriority(person.faction_rank) > getRankPriority(minRank)) return `Legalább ${minRank} rang kell.`;
  return null;
}

/** Free keys: null when unlimited. */
export const freeKeys = (vehicle: Pick<FleetVehicle, "capacity" | "holders">) =>
  vehicle.capacity === null ? null : Math.max(0, vehicle.capacity - vehicle.holders.length);

/** Supervisory staff and above for every vehicle; a bureau's leaders for their bureau's vehicles. */
export const canAssignVehicle = (viewer: FleetSubject | null | undefined, category?: FleetCategory | null): boolean =>
  !!viewer && (isStaff(viewer) || leadsUnit(viewer, category?.unit));

/** Whether the viewer may hand out or take back any key at all (shows the assignment tools). */
export const canAssignAnyVehicle = (viewer: FleetSubject | null | undefined, categories: FleetCategory[]): boolean =>
  !!viewer && (isStaff(viewer) || categories.some((category) => leadsUnit(viewer, category.unit)));

/** Key holders, and for shared vehicles everyone allowed to use them, report renewals. */
export const canSubmitRegistration = (viewer: FleetSubject | null | undefined, vehicle: FleetVehicle,
                                      category?: FleetCategory | null): boolean =>
  !!viewer && vehicle.is_active && vehicle.registration_required
  && (vehicle.holders.some((holder) => holder.user_id === viewer.id)
    || (!!vehicle.shared_label && holdBlocker(viewer, vehicle, category) === null));

// --- Tuning ---------------------------------------------------------------------------

/** Parameters of the tuning sheet, in the sheet's two columns. */
export const TUNING_PARAMS = [
  ["top_speed", "Végsebesség"],
  ["acceleration", "Gyorsulás"],
  ["traction", "Általános tapadás"],
  ["cornering_grip", "Kanyartapadás / csúszás"],
  ["braking", "Fékhatás"],
  ["spring", "Rugóerő"],
  ["damping", "Lengéscsillapítás"],
  ["engine_inertia", "Motor tehetetlenség"],
  ["mass", "Tömeg"],
  ["cornering_mass", "Kanyarodási tömeg"],
  ["brake_bias", "Fékerő elosztás"],
  ["suspension_ratio", "Felfüggesztés arány"],
  ["grip_bias", "Tapadás elosztás"],
  ["drag", "Légellenállás"],
] as const;

const normalizeModel = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** The tuning preset of a vehicle: the longest preset name contained in its model. */
export function tuningFor<T extends {model: string}>(model: string, presets: T[]): T | null {
  const name = ` ${normalizeModel(model)} `;
  return presets
    .filter((preset) => name.includes(` ${normalizeModel(preset.model)} `))
    .sort((a, b) => b.model.length - a.model.length)[0] ?? null;
}
