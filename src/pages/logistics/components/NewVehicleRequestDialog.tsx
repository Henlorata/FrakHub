import {useMemo, useState, type FormEvent} from "react";
import {toast} from "sonner";
import {Car, Check, KeyRound, Loader2, Lock, Search, Send} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {useAuth} from "@/context/AuthContext";
import {FLEET_TONES, freeKeys, holdBlocker, type FleetSubject} from "@/lib/fleet";
import {useFleet} from "@/lib/fleet-store";
import {cn, errorMessage} from "@/lib/utils";
import type {FleetCategory, FleetVehicle} from "@/types/supabase";

const REASON_MAX = 600;
const OTHER = "__other__";

/** One requestable model of a category, as the member sees it. */
interface ModelOption {
  key: string;
  model: string;
  category: FleetCategory | null;
  /** Free keys among the vehicles the member may hold; null: unlimited. */
  free: number | null;
  /** Why the member may not hold any of them (null: they may). */
  blocker: string | null;
  /** The member already holds a key of this model. */
  held: boolean;
}

/**
 * The fleet's vehicles with personal keys, by category and model (shared pools are used without a
 * key, so they are not requested).
 */
function requestOptions(vehicles: FleetVehicle[], categories: FleetCategory[], person: FleetSubject, userId: string) {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const groups = new Map<string, {model: string; category: FleetCategory | null; vehicles: FleetVehicle[]}>();
  for (const vehicle of vehicles) {
    if (!vehicle.is_active || vehicle.shared_label || vehicle.capacity === 0) continue;
    const category = vehicle.category_id ? byId.get(vehicle.category_id) ?? null : null;
    const key = `${category?.id ?? ""}|${vehicle.model.trim().toLowerCase()}`;
    const group = groups.get(key) ?? {model: vehicle.model.trim(), category, vehicles: []};
    group.vehicles.push(vehicle);
    groups.set(key, group);
  }
  const options: ModelOption[] = [...groups.entries()].map(([key, group]) => {
    const holdable = group.vehicles.filter((vehicle) => holdBlocker(person, vehicle, group.category) === null);
    const free = holdable.some((vehicle) => freeKeys(vehicle) === null)
      ? null : holdable.reduce((sum, vehicle) => sum + (freeKeys(vehicle) ?? 0), 0);
    return {
      key, model: group.model, category: group.category, free,
      blocker: holdable.length ? null : holdBlocker(person, group.vehicles[0], group.category),
      held: group.vehicles.some((vehicle) => vehicle.holders.some((holder) => holder.user_id === userId)),
    };
  });
  return options.sort((a, b) => (a.category?.sort_order ?? 9999) - (b.category?.sort_order ?? 9999)
    || (a.category?.name ?? "").localeCompare(b.category?.name ?? "", "hu")
    || a.model.localeCompare(b.model, "hu"));
}

/**
 * A vehicle request: a model from the real fleet (what the member may hold, with the free keys),
 * or another vehicle by name, and the reason. The approver picks the actual vehicle, and its key
 * goes to the member.
 */
export function NewVehicleRequestDialog({open, onOpenChange, onSuccess}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const {supabase, user, profile} = useAuth();
  const {vehicles, categories, error: fleetError} = useFleet({enabled: open});
  const [selected, setSelected] = useState<string | null>(null);
  const [customModel, setCustomModel] = useState("");
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const options = useMemo(
    () => (vehicles && profile && user ? requestOptions(vehicles, categories, profile, user.id) : []),
    [vehicles, categories, profile, user],
  );
  const term = search.trim().toLowerCase();
  const shown = term ? options.filter((option) => `${option.model} ${option.category?.name ?? ""}`.toLowerCase().includes(term)) : options;
  const picked = options.find((option) => option.key === selected) ?? null;
  const model = selected === OTHER ? customModel.trim() : picked?.model ?? "";

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setSelected(null);
      setCustomModel("");
      setReason("");
      setSearch("");
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (!model) return toast.error(selected === OTHER ? "Add meg a jármű típusát." : "Válassz járművet.");
    if (!reason.trim()) return toast.error("Írd le röviden, mire kell a jármű.");
    setSaving(true);
    try {
      const {error} = await supabase.from("vehicle_requests")
        .insert({user_id: user.id, vehicle_type: model.slice(0, 60), reason: reason.trim(), status: "pending"});
      if (error) throw error;
      toast.success("Igénylés benyújtva.");
      onSuccess();
      close(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-white/5 px-5 pt-5 pb-4 text-left">
          <DialogTitle className="flex items-center gap-2"><Car className="size-5 text-orange-400"/> Járműigénylés</DialogTitle>
          <DialogDescription>Válassz a járműparkból. Jóváhagyáskor a vezetőség kiválasztja a járművet, és a kulcsa a tiéd lesz.</DialogDescription>
        </DialogHeader>

        <form id="vehicle-request" onSubmit={(event) => void submit(event)} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label>Igényelhető járművek</Label>
              {vehicles && <span className="text-[11px] text-slate-500">{options.filter((option) => !option.blocker).length} típus igényelhető</span>}
            </div>
            {options.length > 8 && (
              <div className="relative">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Típus vagy kategória…" className="pl-9"
                       aria-label="Jármű keresése"/>
              </div>
            )}
            <div role="radiogroup" aria-label="Igényelhető járművek"
                 className="max-h-[min(20rem,45dvh)] space-y-1 overflow-y-auto rounded-xl bg-black/20 p-1.5 ring-1 ring-white/10">
              {!vehicles && !fleetError && [0, 1, 2, 3].map((index) => <div key={index} className="skeleton h-11"/>)}
              {fleetError && !options.length && <p className="px-3 py-4 text-center text-xs text-slate-500">A járműpark nem tölthető be; add meg a típust lent.</p>}
              {vehicles && !fleetError && !shown.length && (
                <p className="px-3 py-4 text-center text-xs text-slate-500">{term ? "Nincs ilyen jármű a járműparkban." : "A járműparkban nincs igényelhető jármű."}</p>
              )}
              {shown.map((option, index) => {
                const showHeader = index === 0 || (shown[index - 1].category?.id ?? null) !== (option.category?.id ?? null);
                const tone = FLEET_TONES[option.category?.tone ?? "slate"] ?? FLEET_TONES.slate;
                const isSelected = selected === option.key;
                return (
                  <div key={option.key}>
                    {showHeader && (
                      <p className="flex items-center gap-1.5 px-2 pt-2 pb-1 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                        <span className={cn("size-1.5 rounded-full", tone.dot)}/>{option.category?.name ?? "Egyéb"}
                      </p>
                    )}
                    <button type="button" role="radio" aria-checked={isSelected} disabled={!!option.blocker}
                            onClick={() => setSelected(option.key)}
                            className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ring-1 transition-colors",
                              isSelected ? "bg-orange-500/10 ring-orange-400/50" : "ring-transparent hover:bg-white/[0.04]",
                              option.blocker && "cursor-not-allowed opacity-55 hover:bg-transparent")}>
                      <span className={cn("grid size-5 shrink-0 place-items-center rounded-full ring-1",
                        isSelected ? "bg-orange-400 text-black ring-orange-300" : "ring-white/20")}>
                        {isSelected && <Check className="size-3.5"/>}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-100">{option.model}</span>
                      <OptionState option={option}/>
                    </button>
                  </div>
                );
              })}
              <button type="button" role="radio" aria-checked={selected === OTHER} onClick={() => setSelected(OTHER)}
                      className={cn("mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ring-1 transition-colors",
                        selected === OTHER ? "bg-orange-500/10 ring-orange-400/50" : "ring-transparent hover:bg-white/[0.04]")}>
                <span className={cn("grid size-5 shrink-0 place-items-center rounded-full ring-1",
                  selected === OTHER ? "bg-orange-400 text-black ring-orange-300" : "ring-white/20")}>
                  {selected === OTHER && <Check className="size-3.5"/>}
                </span>
                <span className="min-w-0 flex-1 text-sm text-slate-300">Más jármű (nincs a listán)</span>
              </button>
            </div>
          </div>

          {selected === OTHER && (
            <div className="space-y-1.5">
              <Label htmlFor="request-model">A jármű típusa</Label>
              <Input id="request-model" value={customModel} maxLength={60} autoFocus placeholder="pl. Enus Stafford"
                     onChange={(event) => setCustomModel(event.target.value)}/>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <Label htmlFor="request-reason">Indoklás</Label>
              <span className="text-[11px] text-slate-500 tabular-nums">{reason.length}/{REASON_MAX}</span>
            </div>
            <Textarea id="request-reason" value={reason} maxLength={REASON_MAX} rows={3}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Mire kell a jármű: szolgálati cél, egység, gyakoriság…"
                      className="max-h-40 resize-none overflow-y-auto"/>
          </div>
        </form>

        <DialogFooter className="border-t border-white/5 px-5 py-3">
          <Button type="button" variant="ghost" onClick={() => close(false)}>Mégse</Button>
          <Button type="submit" form="vehicle-request" disabled={saving || !model} className="bg-orange-500 text-black hover:bg-orange-400">
            {saving ? <Loader2 className="animate-spin"/> : <Send/>} Benyújtás
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The model's state for the member: why it is locked, the key they hold, or the free keys. */
function OptionState({option}: {option: ModelOption}) {
  if (option.blocker) {
    return (
      <span className="inline-flex max-w-[55%] shrink-0 items-center gap-1 truncate rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] text-red-300 ring-1 ring-red-500/25"
            title={option.blocker}>
        <Lock className="size-3 shrink-0"/><span className="truncate">{option.blocker}</span>
      </span>
    );
  }
  if (option.held) {
    return <span className="shrink-0 rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-300 ring-1 ring-sky-500/25">Már van kulcsod</span>;
  }
  if (option.free === 0) {
    return <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200 ring-1 ring-amber-500/25">Most nincs szabad kulcs</span>;
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300 ring-1 ring-emerald-500/25">
      <KeyRound className="size-3"/>{option.free === null ? "Van szabad kulcs" : `${option.free} szabad kulcs`}
    </span>
  );
}
