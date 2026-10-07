import {
  AlertTriangle, Car, Eye, HelpCircle, Search, ShieldAlert, Siren, UserRoundSearch, type LucideIcon,
} from "lucide-react";
import {supabase} from "./supabaseClient";

/**
 * Patrol tools: BOLO alerts ("Be On the Lookout": vehicles and persons to watch for), the shift
 * briefing and the plate lookup of the quick search. Database: bolo_alerts, get_bolos(),
 * get_briefing(), lookup_plate(), set_bolo_status(), extend_bolo().
 */

export type BoloKind = "vehicle" | "person";
export type BoloReason = "stolen" | "wanted" | "missing" | "dangerous" | "suspicious" | "other";
export type BoloDanger = "low" | "medium" | "high";
export type BoloStatus = "active" | "resolved" | "cancelled";

export interface Bolo {
  id: string;
  kind: BoloKind;
  reason: BoloReason;
  danger: BoloDanger;
  title: string;
  plate: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  person_name: string | null;
  description: string | null;
  last_seen_location: string | null;
  last_seen_at: string | null;
  image_url: string | null;
  status: BoloStatus;
  expires_at: string;
  resolved_at: string | null;
  resolution: string | null;
  resolved_by_name: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  /** The author or the staff. */
  can_manage: boolean;
  /** Only for those who may see the case area. */
  case: {id: string; case_number: string; title: string} | null;
  suspect: {id: string; full_name: string; mugshot_url: string | null} | null;
}

export interface WantedPerson {
  id: string;
  name: string;
  alias: string | null;
  mugshot_url: string | null;
  suspect_status: string | null;
  decided_at: string | null;
  expires_at: string | null;
  case: {id: string; case_number: string} | null;
}

export interface Briefing {
  generated_at: string;
  bolos: Bolo[];
  resolved: Bolo[];
  wanted: WantedPerson[];
  events: {id: string; title: string; kind: string; starts_at: string; ends_at: string | null; location: string | null}[];
  announcements: {id: string; title: string; content: string; type: string; is_pinned: boolean; created_at: string; author: string | null}[];
  last24h: {tickets: number; arrests: number; reports: number};
}

export interface PlateLookup {
  bolos: {id: string; title: string; plate: string | null; status: BoloStatus; danger: BoloDanger; active: boolean}[];
  fleet: {id: string; plate: string; model: string}[];
  persons: {suspect_id: string; full_name: string; status: string; plate: string; vehicle: string | null}[];
}

export interface BoloDraft {
  kind: BoloKind;
  reason: BoloReason;
  danger: BoloDanger;
  title: string;
  plate: string;
  vehicle_model: string;
  vehicle_color: string;
  person_name: string;
  description: string;
  last_seen_location: string;
  last_seen_at: string | null;
  image_url: string | null;
  /** Hours until it lapses (new alerts only). */
  hours: number;
}

// --- Looks -----------------------------------------------------------------------------------

export const BOLO_REASONS: Record<BoloReason, {label: string; icon: LucideIcon}> = {
  stolen: {label: "Lopott", icon: Car},
  wanted: {label: "Körözött", icon: Siren},
  missing: {label: "Eltűnt", icon: UserRoundSearch},
  dangerous: {label: "Veszélyes", icon: AlertTriangle},
  suspicious: {label: "Gyanús", icon: Eye},
  other: {label: "Egyéb", icon: HelpCircle},
};

export const BOLO_DANGER: Record<BoloDanger, {label: string; chip: string; stripe: string; glow: string}> = {
  high: {label: "Magas veszély", chip: "bg-red-500/15 text-red-200 ring-red-500/40", stripe: "from-red-500 via-rose-500 to-red-700",
    glow: "bolo-glow-high"},
  medium: {label: "Közepes", chip: "bg-amber-500/15 text-amber-200 ring-amber-500/40", stripe: "from-amber-400 via-orange-500 to-amber-600",
    glow: ""},
  low: {label: "Alacsony", chip: "bg-sky-500/10 text-sky-200 ring-sky-500/30", stripe: "from-sky-400 via-sky-500 to-indigo-500", glow: ""},
};

export const BOLO_KINDS: Record<BoloKind, {label: string; icon: LucideIcon}> = {
  vehicle: {label: "Jármű", icon: Car},
  person: {label: "Személy", icon: ShieldAlert},
};

export const BOLO_DURATIONS: {hours: number; label: string}[] = [
  {hours: 12, label: "12 óra"},
  {hours: 24, label: "1 nap"},
  {hours: 72, label: "3 nap"},
  {hours: 168, label: "1 hét"},
  {hours: 336, label: "2 hét"},
];

export const PLATE_SEARCH_ICON = Search;

/** Whether a quick-search term looks like a plate (letters and at least one digit, 3–10 characters). */
export const looksLikePlate = (term: string) => {
  const compact = term.replace(/[\s-]/g, "");
  return /^[A-Za-z0-9]{3,10}$/.test(compact) && /\d/.test(compact);
};

export const emptyBoloDraft = (kind: BoloKind = "vehicle"): BoloDraft => ({
  kind, reason: kind === "vehicle" ? "stolen" : "wanted", danger: "medium", title: "", plate: "", vehicle_model: "", vehicle_color: "",
  person_name: "", description: "", last_seen_location: "", last_seen_at: null, image_url: null, hours: kind === "vehicle" ? 72 : 168,
});

export const boloToDraft = (bolo: Bolo): BoloDraft => ({
  kind: bolo.kind, reason: bolo.reason, danger: bolo.danger, title: bolo.title, plate: bolo.plate ?? "", vehicle_model: bolo.vehicle_model ?? "",
  vehicle_color: bolo.vehicle_color ?? "", person_name: bolo.person_name ?? "", description: bolo.description ?? "",
  last_seen_location: bolo.last_seen_location ?? "", last_seen_at: bolo.last_seen_at, image_url: bolo.image_url, hours: 72,
});

/** What is wrong with a draft (Hungarian), or null. */
export function boloProblem(draft: BoloDraft): string | null {
  if (draft.title.trim().length < 3) return "Adj rövid címet (legalább 3 karakter), pl. „Lopott fekete Sultan”.";
  if (draft.kind === "vehicle" && !draft.plate.trim() && !draft.vehicle_model.trim()) return "Járműnél a rendszám vagy a típus kell.";
  if (draft.kind === "person" && !draft.person_name.trim() && !draft.description.trim()) return "Személynél a név vagy a személyleírás kell.";
  if (draft.description.length > 1500) return "A leírás legfeljebb 1500 karakter lehet.";
  return null;
}

const clean = (value: string) => value.trim() || null;

const fields = (draft: BoloDraft) => ({
  kind: draft.kind, reason: draft.reason, danger: draft.danger, title: draft.title.trim(),
  plate: draft.kind === "vehicle" ? clean(draft.plate.toUpperCase()) : null,
  vehicle_model: draft.kind === "vehicle" ? clean(draft.vehicle_model) : null,
  vehicle_color: draft.kind === "vehicle" ? clean(draft.vehicle_color) : null,
  person_name: draft.kind === "person" ? clean(draft.person_name) : null,
  description: clean(draft.description), last_seen_location: clean(draft.last_seen_location), last_seen_at: draft.last_seen_at,
  image_url: draft.image_url,
});

const rpc = async <T>(name: string, args: Record<string, unknown> = {}): Promise<T> => {
  const {data, error} = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
};

export const patrolApi = {
  briefing: () => rpc<Briefing>("get_briefing"),
  bolos: () => rpc<{active: Bolo[]; closed: Bolo[]}>("get_bolos", {_include_closed: true}),
  lookupPlate: (query: string) => rpc<PlateLookup>("lookup_plate", {_query: query}),
  create: async (draft: BoloDraft) => {
    const {kind: _kind, ...rest} = fields(draft);
    const {data, error} = await supabase.from("bolo_alerts")
      .insert({kind: draft.kind, ...rest, expires_at: new Date(Date.now() + draft.hours * 3_600_000).toISOString()})
      .select("id").single();
    if (error) throw error;
    return (data as {id: string}).id;
  },
  update: async (id: string, draft: BoloDraft) => {
    const {kind: _kind, ...rest} = fields(draft);
    const {error} = await supabase.from("bolo_alerts").update(rest).eq("id", id);
    if (error) throw error;
  },
  setStatus: (id: string, status: BoloStatus, note?: string | null, hours?: number) =>
    rpc<Bolo>("set_bolo_status", {_id: id, _status: status, _note: note ?? null, _hours: hours ?? null}),
  extend: (id: string, hours: number) => rpc<Bolo>("extend_bolo", {_id: id, _hours: hours}),
  remove: async (id: string) => {
    const {data, error} = await supabase.from("bolo_alerts").delete().eq("id", id).select("id");
    if (error) throw error;
    if (!data?.length) throw new Error("Csak a kiadója törölheti az első fél órában, utána a Supervisory Staff.");
  },
};
