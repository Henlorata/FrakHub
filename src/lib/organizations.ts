import {Bike, Building2, Crown, Gem, HelpCircle, Skull, Users, type LucideIcon} from "lucide-react";
import {supabase} from "./supabaseClient";

/**
 * Crime organisations of the MCB ("Bűnszervezetek"): gangs, crews and cartels with their logo,
 * colour, territory, threat level and members (registered persons with a role), and a dated
 * intelligence log. Cases, warrants, vehicles and properties come from the members. The case area
 * reads and edits them; the MCB leadership deletes one. Database: crime_organizations,
 * organization_members, organization_notes, get_organizations(), get_organization(),
 * get_person_organizations().
 */

export type OrgKind = "gang" | "crew" | "cartel" | "mafia" | "biker" | "other";
export type OrgStatus = "active" | "dormant" | "dismantled";
export type OrgThreat = "low" | "medium" | "high" | "critical";
export type OrgRole = "leader" | "lieutenant" | "member" | "associate";

export interface OrganizationListItem {
  id: string;
  name: string;
  kind: OrgKind;
  status: OrgStatus;
  threat: OrgThreat;
  color: string | null;
  logo_url: string | null;
  territory: string | null;
  updated_at: string;
  members: number;
  leaders: string[];
  wanted: number;
  open_cases: number;
  last_note_at: string | null;
}

export interface OrganizationDetail {
  organization: {
    id: string; name: string; kind: OrgKind; status: OrgStatus; threat: OrgThreat; color: string | null; logo_url: string | null;
    territory: string | null; description: string | null; created_at: string; updated_at: string; created_by_name: string | null;
    updated_by_name: string | null; can_delete: boolean;
  };
  members: {suspect_id: string; full_name: string; alias: string | null; status: string; mugshot_url: string | null; role: OrgRole;
    note: string | null; added_at: string; wanted: boolean}[];
  notes: {id: string; body: string; source: string | null; created_at: string; created_by: string | null; created_by_name: string | null;
    can_delete: boolean}[];
  cases: {id: string; case_number: string; title: string; status: string; priority: string; updated_at: string; can_open: boolean;
    members_in_case: number}[];
  vehicles: {plate: string; vehicle: string | null; color: string | null; owner: string; suspect_id: string}[];
  properties: {address: string; type: string | null; owner: string; suspect_id: string}[];
  warrants: {id: string; type: "arrest" | "search"; status: string; target: string; expires_at: string | null; case_id: string; decided_at: string | null}[];
}

export interface OrganizationDraft {
  name: string;
  kind: OrgKind;
  status: OrgStatus;
  threat: OrgThreat;
  color: string;
  logo_url: string | null;
  territory: string;
  description: string;
}

export const ORG_KINDS: Record<OrgKind, {label: string; icon: LucideIcon}> = {
  gang: {label: "Utcai banda", icon: Users},
  crew: {label: "Bűnbanda", icon: Skull},
  cartel: {label: "Kartell", icon: Gem},
  mafia: {label: "Maffia", icon: Crown},
  biker: {label: "Motoros klub", icon: Bike},
  other: {label: "Egyéb szervezet", icon: Building2},
};

export const ORG_STATUS: Record<OrgStatus, {label: string; chip: string}> = {
  active: {label: "Aktív", chip: "bg-red-500/10 text-red-200 ring-red-500/30"},
  dormant: {label: "Szunnyadó", chip: "bg-amber-500/10 text-amber-200 ring-amber-500/30"},
  dismantled: {label: "Felszámolva", chip: "bg-emerald-500/10 text-emerald-200 ring-emerald-500/30"},
};

export const ORG_THREAT: Record<OrgThreat, {label: string; chip: string; level: number}> = {
  low: {label: "Alacsony", chip: "bg-sky-500/10 text-sky-200 ring-sky-500/30", level: 1},
  medium: {label: "Közepes", chip: "bg-amber-500/10 text-amber-200 ring-amber-500/30", level: 2},
  high: {label: "Magas", chip: "bg-orange-500/15 text-orange-200 ring-orange-500/35", level: 3},
  critical: {label: "Kritikus", chip: "bg-red-500/15 text-red-200 ring-red-500/40", level: 4},
};

export const ORG_ROLES: Record<OrgRole, string> = {
  leader: "Vezető",
  lieutenant: "Helyettes",
  member: "Tag",
  associate: "Kapcsolat",
};

/** Colours offered for an organisation (the gang colours of San Andreas and a few more). */
export const ORG_COLORS = ["#22c55e", "#a855f7", "#eab308", "#ef4444", "#3b82f6", "#f97316", "#14b8a6", "#ec4899", "#64748b", "#f8fafc"];

export const OrgFallbackIcon = HelpCircle;

export const emptyOrganization = (): OrganizationDraft => ({
  name: "", kind: "gang", status: "active", threat: "medium", color: ORG_COLORS[0], logo_url: null, territory: "", description: "",
});

const clean = (draft: OrganizationDraft) => ({
  name: draft.name.trim(), kind: draft.kind, status: draft.status, threat: draft.threat, color: draft.color || null, logo_url: draft.logo_url,
  territory: draft.territory.trim() || null, description: draft.description.trim() || null,
});

const rpc = async <T>(name: string, args: Record<string, unknown> = {}): Promise<T> => {
  const {data, error} = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
};

export const organizationsApi = {
  list: () => rpc<OrganizationListItem[]>("get_organizations"),
  detail: (id: string) => rpc<OrganizationDetail>("get_organization", {_id: id}),
  ofPerson: (suspectId: string) => rpc<{id: string; name: string; color: string | null; logo_url: string | null; threat: OrgThreat; role: OrgRole}[]>(
    "get_person_organizations", {_suspect_id: suspectId}),
  create: async (draft: OrganizationDraft) => {
    const {data, error} = await supabase.from("crime_organizations").insert(clean(draft)).select("id").single();
    if (error) throw error;
    return (data as {id: string}).id;
  },
  update: async (id: string, draft: OrganizationDraft) => {
    const {error} = await supabase.from("crime_organizations").update(clean(draft)).eq("id", id);
    if (error) throw error;
  },
  remove: async (id: string) => {
    const {data, error} = await supabase.from("crime_organizations").delete().eq("id", id).select("id");
    if (error) throw error;
    if (!data?.length) throw new Error("Szervezetet az MCB vezetése törölhet.");
  },
  addMember: async (organizationId: string, suspectId: string, role: OrgRole) => {
    const {error} = await supabase.from("organization_members").insert({organization_id: organizationId, suspect_id: suspectId, role});
    if (error) throw error;
  },
  setMember: async (organizationId: string, suspectId: string, patch: {role?: OrgRole; note?: string | null}) => {
    const {error} = await supabase.from("organization_members").update(patch).eq("organization_id", organizationId).eq("suspect_id", suspectId);
    if (error) throw error;
  },
  removeMember: async (organizationId: string, suspectId: string) => {
    const {error} = await supabase.from("organization_members").delete().eq("organization_id", organizationId).eq("suspect_id", suspectId);
    if (error) throw error;
  },
  addNote: async (organizationId: string, body: string, source: string | null) => {
    const {error} = await supabase.from("organization_notes").insert({organization_id: organizationId, body: body.trim(), source: source?.trim() || null});
    if (error) throw error;
  },
  removeNote: async (id: string) => {
    const {data, error} = await supabase.from("organization_notes").delete().eq("id", id).select("id");
    if (error) throw error;
    if (!data?.length) throw new Error("A bejegyzést a szerzője vagy az MCB vezetése törölheti.");
  },
};

/** Readable text colour on an organisation's colour. */
export function inkOn(hex: string | null): string {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return "#f8fafc";
  const [r, g, b] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.6 ? "#0f172a" : "#f8fafc";
}
