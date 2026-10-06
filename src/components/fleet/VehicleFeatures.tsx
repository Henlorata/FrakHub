import type {LucideIcon} from "lucide-react";
import {EyeOff, Infinity as InfinityIcon, KeyRound, Lock, ShieldCheck, Ship, Users} from "lucide-react";
import {UNIT_LABELS, vehicleMinRank, vehicleUnits} from "@/lib/fleet";
import {cn} from "@/lib/utils";
import type {FleetCategory, FleetVehicle} from "@/types/supabase";

export interface VehicleFeature {
  key: string;
  icon: LucideIcon;
  label: string;
  description: string;
  tone: string;
}

/**
 * What makes a vehicle special: unmarked, unlimited or shared keys, unit and rank limits,
 * exceptions to the category, no registration. Shown on the vehicle page and in every
 * picker, so assigners handle the vehicle accordingly.
 */
export function vehicleFeatures(vehicle: FleetVehicle, category?: FleetCategory | null): VehicleFeature[] {
  const features: VehicleFeature[] = [];
  if (vehicle.is_unmarked) {
    features.push({key: "unmarked", icon: EyeOff, label: "Jelöletlen", tone: "bg-violet-500/10 text-violet-200 ring-violet-500/30",
      description: "Civil kinézetű jármű, megkülönböztető jelzés nélkül."});
  }
  if (vehicle.shared_label) {
    features.push({key: "shared", icon: Users, label: `Közös: ${vehicle.shared_label}`, tone: "bg-sky-500/10 text-sky-200 ring-sky-500/30",
      description: vehicle.capacity
        ? `A(z) ${vehicle.shared_label} közös járműve; emellett ${vehicle.capacity} személyes kulcs adható ki.`
        : `A(z) ${vehicle.shared_label} közös járműve, személyes kulcs nem jár hozzá.`});
  }
  if (vehicle.capacity === null) {
    features.push({key: "unlimited", icon: InfinityIcon, label: "Korlátlan kulcs", tone: "bg-emerald-500/10 text-emerald-200 ring-emerald-500/30",
      description: "Bárhány kulcsos lehet egyszerre."});
  } else if (!vehicle.shared_label && vehicle.capacity !== 2) {
    features.push({key: "capacity", icon: KeyRound, label: `${vehicle.capacity} kulcs`, tone: "bg-slate-500/10 text-slate-200 ring-slate-400/30",
      description: vehicle.capacity === 0 ? "Ehhez a járműhöz nem adható ki kulcs." : `Legfeljebb ${vehicle.capacity} kulcsos lehet.`});
  }
  const units = vehicleUnits(vehicle, category);
  // The vehicle's own list differs from its category's unit ("unless it is specified otherwise").
  const exception = vehicle.allowed_units !== null
    && (vehicle.allowed_units.length !== 1 || vehicle.allowed_units[0] !== category?.unit);
  if (units.length) {
    const names = units.map((unit) => UNIT_LABELS[unit] ?? unit).join(" / ");
    features.push({key: "units", icon: Lock, label: `Csak ${names}`,
      tone: exception ? "bg-amber-500/10 text-amber-200 ring-amber-500/30" : "bg-red-500/10 text-red-200 ring-red-500/30",
      description: exception
        ? `Kivétel a kategória szabálya alól: ${names} tagok kaphatnak kulcsot.`
        : `Csak a(z) ${names} tagjai kaphatnak kulcsot.`});
  } else if (exception && category?.unit) {
    features.push({key: "units", icon: Lock, label: `Kivétel: nem csak ${UNIT_LABELS[category.unit]}`,
      tone: "bg-amber-500/10 text-amber-200 ring-amber-500/30",
      description: `Kivétel a kategória szabálya alól: nem csak a(z) ${UNIT_LABELS[category.unit]} tagjai kaphatják.`});
  }
  const minRank = vehicleMinRank(vehicle, category);
  if (minRank) {
    features.push({key: "rank", icon: ShieldCheck, label: `Min. ${minRank}`, tone: "bg-yellow-500/10 text-yellow-200 ring-yellow-500/30",
      description: `Legalább ${minRank} rang szükséges.`});
  }
  if (!vehicle.registration_required) {
    features.push({key: "registration", icon: Ship, label: "Nem kell forgalmi", tone: "bg-teal-500/10 text-teal-200 ring-teal-500/30",
      description: "Ehhez a járműhöz nem tartozik forgalmi engedély."});
  }
  return features;
}

/** Compact feature chips (lists, pickers). */
export function FeatureBadges({vehicle, category, className, limit}: {
  vehicle: FleetVehicle; category?: FleetCategory | null; className?: string; limit?: number;
}) {
  const features = vehicleFeatures(vehicle, category);
  if (!features.length) return null;
  const shown = limit ? features.slice(0, limit) : features;
  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {shown.map((feature) => (
        <span key={feature.key} title={feature.description}
              className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium ring-1", feature.tone)}>
          <feature.icon className="size-3"/>{feature.label}
        </span>
      ))}
      {limit && features.length > limit && (
        <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10.5px] text-slate-400 ring-1 ring-white/10">+{features.length - limit}</span>
      )}
    </span>
  );
}
