import {Clock3, KeyRound, UserRound, Users} from "lucide-react";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {getOptimizedAvatarUrl} from "@/lib/cloudinary";
import {freeKeys} from "@/lib/fleet";
import type {DirectoryProfile} from "@/lib/profile-directory";
import {cn} from "@/lib/utils";
import type {FleetVehicle} from "@/types/supabase";

/** Keys handed out / available: filled keys for holders, empty ones for free keys. */
export function KeyMeter({vehicle, className}: {vehicle: Pick<FleetVehicle, "capacity" | "holders" | "shared_label">; className?: string}) {
  const held = vehicle.holders.length;
  if (vehicle.capacity === null) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium text-emerald-300", className)} title="Korlátlan kulcs">
        <KeyRound className="size-3.5"/>{held} / ∞
      </span>
    );
  }
  if (vehicle.capacity === 0) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium text-sky-300", className)} title="Közös jármű">
        <Users className="size-3.5"/>Közös
      </span>
    );
  }
  const free = freeKeys(vehicle) ?? 0;
  return (
    <span className={cn("inline-flex items-center gap-1", className)} title={`${held} / ${vehicle.capacity} kulcs kiadva`}>
      {Array.from({length: Math.max(vehicle.capacity, held)}, (_, index) => (
        <KeyRound key={index} className={cn("size-3.5 transition-colors", index < held ? "text-amber-300 drop-shadow-[0_0_4px_rgb(251_191_36/0.6)]" : "text-slate-600")}/>
      ))}
      <span className={cn("ml-0.5 text-[11px] tabular-nums", free > 0 ? "text-emerald-300" : "text-slate-500")}>
        {free > 0 ? `${free} szabad` : "betelt"}
      </span>
    </span>
  );
}

export function PersonAvatar({person, size = "sm"}: {person: DirectoryProfile | null | undefined; size?: "sm" | "md"}) {
  return (
    <Avatar className={cn("ring-1 ring-white/10", size === "sm" ? "size-6" : "size-8")}>
      <AvatarImage src={getOptimizedAvatarUrl(person?.avatar_url ?? null, size === "sm" ? 48 : 64) || undefined} alt=""/>
      <AvatarFallback className="bg-slate-800 text-[10px] font-semibold text-slate-300">{person?.full_name.charAt(0) ?? "?"}</AvatarFallback>
    </Avatar>
  );
}

/** Who holds a key: names with avatars ("Közös: Medical Unit" for shared pools without holders). */
export function HolderNames({vehicle, people, max = 3, className}: {
  vehicle: Pick<FleetVehicle, "holders" | "shared_label">;
  people: Map<string, DirectoryProfile>;
  max?: number;
  className?: string;
}) {
  if (!vehicle.holders.length) {
    return vehicle.shared_label ? (
      <span className={cn("flex min-w-0 items-center gap-1.5 text-xs text-sky-200", className)}>
        <Users className="size-3.5 shrink-0"/><span className="truncate">{vehicle.shared_label}</span>
      </span>
    ) : (
      <span className={cn("flex items-center gap-1.5 text-xs text-slate-500", className)}><UserRound className="size-3.5"/>Szabad jármű</span>
    );
  }
  const shown = vehicle.holders.slice(0, max);
  return (
    <span className={cn("flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1", className)}>
      {shown.map((holder) => {
        const person = people.get(holder.user_id);
        return (
          <span key={holder.user_id} className="flex min-w-0 items-center gap-1.5">
            <PersonAvatar person={person}/>
            <span className="truncate text-xs text-slate-200">{person?.full_name ?? "Ismeretlen"}</span>
            {holder.is_temporary && <Clock3 className="size-3 shrink-0 text-amber-300" aria-label="Ideiglenes"/>}
          </span>
        );
      })}
      {vehicle.holders.length > max && <span className="text-[11px] text-slate-400">+{vehicle.holders.length - max} fő</span>}
    </span>
  );
}
