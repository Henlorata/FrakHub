import {useMemo, useState, type CSSProperties, type ReactNode} from "react";
import {Check, Search} from "lucide-react";
import {Input} from "@/components/ui/input";
import {Switch} from "@/components/ui/switch";
import {LicensePlate} from "@/components/fleet/LicensePlate";
import {FeatureBadges} from "@/components/fleet/VehicleFeatures";
import {HolderNames, KeyMeter, PersonAvatar} from "@/components/fleet/Holders";
import {FLEET_TONES, freeKeys} from "@/lib/fleet";
import type {DirectoryProfile} from "@/lib/profile-directory";
import {cn, getRankPriority} from "@/lib/utils";
import type {FleetCategory, FleetVehicle} from "@/types/supabase";

const matches = (term: string, ...values: (string | number | null | undefined)[]) =>
  values.some((value) => value !== null && value !== undefined && String(value).toLowerCase().includes(term));

/**
 * Searchable member list. `blocker` explains why someone cannot be picked (shown instead of
 * a check box); eligible members come first.
 */
export function PersonPicker({people, selected, onToggle, blocker, detail, placeholder = "Név vagy jelvényszám…", autoFocus}: {
  people: DirectoryProfile[];
  selected: string[];
  onToggle: (person: DirectoryProfile) => void;
  blocker?: (person: DirectoryProfile) => string | null;
  detail?: (person: DirectoryProfile) => ReactNode;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [search, setSearch] = useState("");
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return people
      .filter((person) => person.system_role !== "pending" && (!term || matches(term, person.full_name, person.badge_number, person.faction_rank)))
      .map((person) => ({person, blocked: blocker?.(person) ?? null}))
      .sort((a, b) => Number(!!a.blocked) - Number(!!b.blocked)
        || getRankPriority(a.person.faction_rank) - getRankPriority(b.person.faction_rank)
        || a.person.full_name.localeCompare(b.person.full_name, "hu"));
  }, [people, search, blocker]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={placeholder} className="pl-9" autoFocus={autoFocus}/>
      </div>
      <ul className="max-h-72 space-y-1 overflow-y-auto pr-1" role="listbox" aria-multiselectable>
        {rows.length === 0 && <li className="py-6 text-center text-xs text-slate-500">Nincs találat.</li>}
        {rows.map(({person, blocked}, index) => {
          const isSelected = selected.includes(person.id);
          return (
            <li key={person.id} style={{"--i": Math.min(index, 10)} as CSSProperties} className="animate-fade">
              <button type="button" role="option" aria-selected={isSelected} disabled={!!blocked && !isSelected}
                      onClick={() => onToggle(person)}
                      className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ring-1 transition-all",
                        isSelected ? "bg-primary/10 ring-primary/40" : "bg-white/[0.02] ring-white/5 hover:bg-white/[0.05] hover:ring-white/15",
                        blocked && !isSelected && "cursor-not-allowed opacity-55 hover:bg-white/[0.02] hover:ring-white/5")}>
                <PersonAvatar person={person} size="md"/>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-100">{person.full_name}</span>
                  <span className="block truncate text-[11px] text-slate-500">{person.faction_rank} · #{person.badge_number} · {person.division}</span>
                  {detail && <span className="mt-0.5 block text-[11px] text-slate-400">{detail(person)}</span>}
                </span>
                {blocked && !isSelected ? (
                  <span className="max-w-[45%] text-right text-[11px] leading-tight text-amber-300/90">{blocked}</span>
                ) : (
                  <span className={cn("grid size-5 shrink-0 place-items-center rounded-md ring-1 transition-colors",
                    isSelected ? "bg-primary text-primary-foreground ring-primary" : "ring-white/20")}>
                    {isSelected && <Check className="size-3.5"/>}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * The stock grouped by category, with who holds each vehicle, free keys and special
 * features. `blocker` explains why a vehicle cannot be picked for the chosen person.
 */
export function VehiclePicker({vehicles, categories, people, selected, onToggle, blocker, autoFocus, freeOnlyDefault = true}: {
  vehicles: FleetVehicle[];
  categories: FleetCategory[];
  people: Map<string, DirectoryProfile>;
  selected: string[];
  onToggle: (vehicle: FleetVehicle) => void;
  blocker?: (vehicle: FleetVehicle, category: FleetCategory | null) => string | null;
  autoFocus?: boolean;
  freeOnlyDefault?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [freeOnly, setFreeOnly] = useState(freeOnlyDefault);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const visible = vehicles.filter((vehicle) => {
      if (selected.includes(vehicle.id)) return true;
      if (freeOnly && freeKeys(vehicle) === 0) return false;
      if (!term) return true;
      const holders = vehicle.holders.map((holder) => people.get(holder.user_id)?.full_name);
      return matches(term, vehicle.plate, vehicle.model, vehicle.callsign, vehicle.game_id, vehicle.station, ...holders);
    });
    return [...categories, null].map((category) => ({
      category,
      vehicles: visible.filter((vehicle) => (category ? vehicle.category_id === category.id
        : !vehicle.category_id || !categoryById.has(vehicle.category_id))),
    })).filter((group) => group.vehicles.length > 0);
  }, [vehicles, categories, categoryById, people, search, freeOnly, selected]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rendszám, típus, ID vagy kulcsos…"
                 className="pl-9" autoFocus={autoFocus}/>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <Switch checked={freeOnly} onCheckedChange={setFreeOnly}/> Csak szabad kulccsal
        </label>
      </div>
      <div className="max-h-[52vh] space-y-3 overflow-y-auto pr-1">
        {groups.length === 0 && <p className="py-6 text-center text-xs text-slate-500">Nincs a szűrésnek megfelelő jármű.</p>}
        {groups.map(({category, vehicles: list}) => {
          const tone = FLEET_TONES[category?.tone ?? "slate"];
          return (
            <section key={category?.id ?? "none"}>
              <h4 className={cn("sticky top-0 z-10 mb-1 flex items-center gap-2 rounded-lg bg-gradient-to-r to-transparent px-2 py-1 text-[11px] font-semibold uppercase tracking-wide backdrop-blur",
                tone.band, tone.text)}>
                <span className={cn("size-1.5 rounded-full", tone.dot)}/>{category?.name ?? "Kategória nélkül"}
                <span className="ml-auto font-normal normal-case text-slate-400">{list.length}</span>
              </h4>
              <ul className="space-y-1">
                {list.map((vehicle) => {
                  const isSelected = selected.includes(vehicle.id);
                  const blocked = blocker?.(vehicle, category) ?? null;
                  return (
                    <li key={vehicle.id}>
                      <button type="button" disabled={!!blocked && !isSelected} onClick={() => onToggle(vehicle)}
                              className={cn("flex w-full flex-col gap-1.5 rounded-xl px-3 py-2 text-left ring-1 transition-all sm:flex-row sm:items-center sm:gap-3",
                                isSelected ? "bg-primary/10 ring-primary/40" : "bg-white/[0.02] ring-white/5 hover:bg-white/[0.05] hover:ring-white/15",
                                blocked && !isSelected && "cursor-not-allowed opacity-55 hover:bg-white/[0.02] hover:ring-white/5")}>
                        <span className="flex min-w-0 items-center gap-2">
                          <LicensePlate plate={vehicle.plate} size="sm"/>
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-slate-100">{vehicle.model}</span>
                            <span className="block truncate text-[11px] text-slate-500">
                              {[vehicle.callsign, vehicle.game_id ? `#${vehicle.game_id}` : null, vehicle.station].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-1 sm:items-end">
                          <span className="flex w-full min-w-0 items-center gap-2 sm:justify-end">
                            <HolderNames vehicle={vehicle} people={people} max={2} className="min-w-0"/>
                            <KeyMeter vehicle={vehicle} className="shrink-0"/>
                          </span>
                          <FeatureBadges vehicle={vehicle} category={category} limit={3} className="sm:justify-end"/>
                          {blocked && !isSelected && <span className="text-[11px] text-amber-300/90">{blocked}</span>}
                        </span>
                        <span className={cn("hidden size-5 shrink-0 place-items-center rounded-md ring-1 transition-colors sm:grid",
                          isSelected ? "bg-primary text-primary-foreground ring-primary" : "ring-white/20")}>
                          {isSelected && <Check className="size-3.5"/>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
