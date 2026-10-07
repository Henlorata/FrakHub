import type {LucideIcon} from "lucide-react";
import {isPrivilegedRank} from "./bureaus";
import {
  Banknote, Car, CheckCircle2, CircleDot, Crosshair, Eye, FileSearch, FolderArchive, FolderOpen, Gavel, Handshake, HelpCircle,
  Home, Lock, Network, Pill, Scale, ScrollText, ShieldAlert, Siren, Skull, Swords, UserX, XCircle,
} from "lucide-react";
import {todayKey} from "@/lib/datetime";
import {supabase} from "@/lib/supabaseClient";
import {createCachedLoader} from "@/lib/cache";
import {isHighCommand, isSupervisory, type RankSubject} from "@shared/ranks";
import type {
  Case, CaseCategory, CaseCollaborator, CaseEvidence, CasePriority, CaseStatus, CaseSuspect, CaseWarrant, Suspect,
  SuspectProperty, SuspectStatus, SuspectVehicle, WarrantStatus, WarrantType,
} from "@/types/supabase";

/**
 * Evidence stored by URL (Cloudinary; a picture uploaded in practice mode is a blob: URL) rather than
 * as a path in the legacy `case_evidence` bucket.
 */
export const isRemoteFile = (path: string | null | undefined) => !!path && /^(https?:|blob:)/.test(path);

// --- Server replies --------------------------------------------------------------

/** A row of get_case_list(): list fields and counts, never the document. */
export interface CaseListItem {
  id: string;
  case_number: string;
  title: string;
  description: string | null;
  status: CaseStatus;
  priority: CasePriority;
  category: CaseCategory | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  owner_id: string | null;
  owner_name: string | null;
  owner_badge: string | null;
  owner_avatar: string | null;
  evidence: number;
  people: number;
  collaborators: number;
  warrants_pending: number;
  warrants_active: number;
  my_role: "owner" | "editor" | "viewer" | null;
  /** The caller may open the case (participant or MCB leadership). */
  can_open: boolean;
}

export interface CaseOwner {
  id: string;
  full_name: string;
  badge_number: string;
  faction_rank: string;
  division: string | null;
  division_rank: string | null;
  avatar_url: string | null;
}

export interface CaseViewer {
  role: "owner" | "editor" | "viewer" | null;
  /** Owner or editor of an open case. */
  can_edit: boolean;
  /** Owner or MCB leadership: status, hand-over, collaborators. */
  can_manage: boolean;
  /** MCB leadership: archive and restore. */
  is_lead: boolean;
  can_approve: boolean;
}

export interface CaseDetail {
  case: Case & {body: unknown; body_version: number; theme: string};
  owner: CaseOwner | null;
  collaborators: CaseCollaborator[];
  evidence: CaseEvidence[];
  people: CaseSuspect[];
  warrants: CaseWarrant[];
  /** Older practice worlds and cached replies may lack the newer lists. */
  tasks?: CaseTask[];
  items?: CaseItem[];
  suggestions?: CaseSuggestion[];
  viewer: CaseViewer;
}

/** A to-do inside a case (the case's editors assign it; the assignee may tick it off). */
export interface CaseTask {
  id: string;
  case_id: string;
  title: string;
  assignee_id: string | null;
  due_on: string | null;
  done_at: string | null;
  created_at: string;
  created_by: string | null;
  overdue: boolean;
  assignee: {full_name: string; badge_number: string; avatar_url: string | null} | null;
  done_by_name: string | null;
  created_by_name: string | null;
}

/** The caller's open tasks across the cases (MCB dashboard). */
export interface MyCaseTask {
  id: string;
  title: string;
  due_on: string | null;
  created_at: string;
  overdue: boolean;
  case: {id: string; case_number: string; title: string; status: CaseStatus};
}

export type CaseItemStatus = "held" | "checked_out" | "returned" | "destroyed";
export type CaseItemAction = "seized" | "moved" | "checked_out" | "checked_in" | "returned" | "destroyed" | "note";

export interface CaseItemEvent {
  id: number;
  action: CaseItemAction;
  location: string | null;
  note: string | null;
  created_at: string;
  holder_name: string | null;
  actor_name: string | null;
}

/** A seized item with its chain of custody (optional: cases may use the evidence pictures only). */
export interface CaseItem {
  id: string;
  case_id: string;
  label: string;
  description: string | null;
  quantity: string | null;
  evidence_id: string | null;
  status: CaseItemStatus;
  location: string | null;
  holder_id: string | null;
  holder_name: string | null;
  retain_until: string | null;
  retention_over: boolean;
  created_at: string;
  created_by: string | null;
  events: CaseItemEvent[];
}

/** Another case with the same person, plate or address (not linked in the document yet). */
export interface CaseSuggestion {
  id: string;
  case_number: string;
  title: string;
  status: CaseStatus;
  reasons: {kind: "person" | "vehicle" | "address"; label: string}[];
  can_open: boolean;
}

export interface McbSettings {
  arrest_days: number;
  search_days: number;
  reminder_days: number;
  updated_at: string;
}

export type InformantStatus = "active" | "dormant" | "burned" | "closed";

export interface InformantContact {
  id: string;
  met_on: string;
  summary: string;
  value: "none" | "low" | "medium" | "high";
  payment: number | null;
  created_at: string;
  author_name: string | null;
  case: {id: string; case_number: string; title: string} | null;
}

export interface Informant {
  id: string;
  codename: string;
  real_name: string | null;
  suspect_id: string | null;
  handler_id: string | null;
  reliability: number;
  status: InformantStatus;
  contact: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  handler: {full_name: string; badge_number: string; avatar_url: string | null} | null;
  suspect: {full_name: string; alias: string | null; mugshot_url: string | null} | null;
  contacts: InformantContact[];
  can_manage: boolean;
}

export type SaveResult =
  | {ok: true; version: number; updated_at: string}
  | {ok: false; conflict: true; version: number; updated_at: string; updated_by_name: string | null};

export interface CaseSearchHit {
  id: string;
  case_number: string;
  title: string;
  status: CaseStatus;
  priority: CasePriority;
  owner_name: string | null;
  updated_at: string;
  /** "title": title, number or summary; "body": the document text. */
  match: "title" | "body";
  snippet: string | null;
  can_open: boolean;
}

export type CaseEventKind =
  | "created" | "status" | "priority" | "title" | "category" | "owner" | "document"
  | "collaborator_added" | "collaborator_removed" | "collaborator_role"
  | "evidence_added" | "evidence_renamed" | "evidence_removed"
  | "person_linked" | "person_updated" | "person_unlinked"
  | "warrant_requested" | "warrant_status" | "warrant_renewal_requested" | "warrant_renewed"
  | "task_added" | "task_done" | "task_reopened" | "task_removed"
  | "item_added" | "item_custody" | "item_removed"
  | "trashed" | "restored";

export interface CaseEvent {
  id: number;
  case_id: string;
  kind: CaseEventKind;
  details: Record<string, string | number | boolean | null>;
  created_at: string;
  actor_id: string | null;
  actor?: {full_name: string; avatar_url: string | null} | null;
}

export interface DossierLink {
  id: string;
  other_id: string;
  relationship: string;
  notes: string | null;
  created_at: string;
  direction: "out" | "in";
  person: Pick<Suspect, "id" | "full_name" | "alias" | "mugshot_url" | "status">;
}

export interface DossierCase {
  link_id: string;
  case_id: string;
  case_number: string;
  title: string;
  status: CaseStatus;
  priority: CasePriority;
  involvement_type: string;
  notes: string | null;
  added_at: string | null;
  can_open: boolean;
}

export interface SuspectDossier {
  suspect: Suspect;
  creator_name: string | null;
  vehicles: (SuspectVehicle & {created_at: string})[];
  properties: (SuspectProperty & {created_at: string})[];
  associates: DossierLink[];
  linked_by: DossierLink[];
  cases: DossierCase[];
  warrants: CaseWarrant[];
}

export interface McbOverviewMember {
  id: string;
  full_name: string;
  badge_number: string;
  faction_rank: string;
  division: string;
  division_rank: string | null;
  avatar_url: string | null;
  system_role: string;
  is_bureau_commander: boolean;
  is_bureau_manager: boolean;
  open_owned: number;
  critical_owned: number;
  closed_owned: number;
  closed_90d: number;
  collaborations: number;
  evidence_30d: number;
  last_activity: string | null;
}

export interface McbOverview {
  viewer: {is_lead: boolean};
  totals: {
    open: number; closed: number; archived: number; critical: number; opened_30d: number; closed_30d: number;
    avg_close_days: number | null; warrants_pending: number; warrants_active: number; wanted: number; suspects: number;
  };
  monthly: {month: string; opened: number; closed: number}[];
  categories: {category: CaseCategory | "none"; open: number; total: number}[];
  members: McbOverviewMember[];
  unattended: {
    id: string; case_number: string; title: string; priority: CasePriority; updated_at: string; owner_id: string | null;
    owner_name: string | null; owner_division: string | null; reason: "no_owner" | "pending" | "left" | "stale";
  }[];
  recent: {id: number; case_id: string; case_number: string; title: string; kind: CaseEventKind;
    details: CaseEvent["details"]; created_at: string; actor_name: string | null}[];
}

/** A case in the trash (get_case_trash): deleted for good 30 days after it went there. */
export interface TrashedCase {
  id: string;
  case_number: string;
  title: string;
  status: CaseStatus;
  priority: CasePriority;
  owner_id: string | null;
  owner_name: string | null;
  deleted_at: string;
  deleted_by_name: string | null;
  purge_at: string;
  evidence: number;
  people: number;
  warrants: number;
}

// --- API -------------------------------------------------------------------------

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const {data, error} = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
}

/** Warrant columns with the names the cards show (same shape as the server's warrant JSON). */
export const WARRANT_SELECT = "*, requester:requested_by(full_name, badge_number, faction_rank), "
  + "approver:approved_by(full_name, badge_number, faction_rank), closer:closed_by(full_name, badge_number), "
  + "suspect:suspect_id(id, full_name, alias, mugshot_url, status, gang_affiliation), property:property_id(address, property_type), "
  + "case:case_id(id, case_number, title, status)";

const caseList = createCachedLoader(async () => (await rpc<CaseListItem[] | null>("get_case_list", {_include_archived: false})) ?? [], 30_000);

export const mcbApi = {
  /** Non-archived cases, cached briefly (the list page, the editor's case links). */
  list: (force = false) => caseList.get(force),
  invalidateList: () => caseList.invalidate(),
  listArchived: async () => (await rpc<CaseListItem[] | null>("get_case_list", {_include_archived: true})) ?? [],
  /** Into the trash (the owner and the MCB's leadership); restorable for 30 days. */
  trash: (caseId: string) => rpc<{purge_at: string}>("trash_case", {_case_id: caseId}),
  restore: (caseId: string) => rpc<null>("restore_case", {_case_id: caseId}),
  trashList: async () => (await rpc<TrashedCase[] | null>("get_case_trash")) ?? [],
  detail: (caseId: string) => rpc<CaseDetail>("get_case_detail", {_case_id: caseId}),
  search: async (query: string) => (await rpc<CaseSearchHit[] | null>("search_cases", {_query: query})) ?? [],
  saveDocument: (caseId: string, body: unknown, baseVersion: number) =>
    rpc<SaveResult>("save_case_document", {_case_id: caseId, _body: body, _base_version: baseVersion}),
  update: (caseId: string, changes: Partial<Pick<Case, "title" | "description" | "priority" | "category" | "theme">>) =>
    rpc<Pick<Case, "title" | "description" | "priority" | "category" | "theme" | "updated_at">>("update_case",
      {_case_id: caseId, _changes: changes}),
  setStatus: (caseId: string, status: CaseStatus) =>
    rpc<{status: CaseStatus; closed_at: string | null; updated_at: string; expired_warrants: number}>("set_case_status",
      {_case_id: caseId, _status: status}),
  transfer: (caseId: string, newOwnerId: string, keepPrevious = true) =>
    rpc<{owner_id: string; owner_name?: string}>("transfer_case", {_case_id: caseId, _new_owner: newOwnerId, _keep_previous: keepPrevious}),
  decideWarrant: (warrantId: string, status: "approved" | "rejected" | "executed" | "expired", note?: string) =>
    rpc<CaseWarrant>("decide_warrant", {_warrant_id: warrantId, _status: status, _note: note ?? null}),
  dossier: (suspectId: string) => rpc<SuspectDossier>("get_suspect_dossier", {_suspect_id: suspectId}),
  saveTask: (caseId: string, taskId: string | null, title: string, assigneeId: string | null, dueOn: string | null) =>
    rpc<CaseTask>("save_case_task", {_case_id: caseId, _task_id: taskId, _title: title, _assignee_id: assigneeId, _due_on: dueOn}),
  setTaskDone: (taskId: string, done: boolean) => rpc<CaseTask>("set_case_task_done", {_task_id: taskId, _done: done}),
  deleteTask: (taskId: string) => rpc<void>("delete_case_task", {_task_id: taskId}),
  myTasks: async () => (await rpc<MyCaseTask[] | null>("get_my_case_tasks")) ?? [],
  /** The case's tasks again (after a colleague's change; the detail call would bring the document too). */
  tasks: async (caseId: string): Promise<CaseTask[]> => {
    const {data, error} = await supabase.from("case_tasks")
      .select("id, case_id, title, assignee_id, due_on, done_at, created_at, created_by, assignee:assignee_id(full_name, badge_number, avatar_url), "
        + "doer:done_by(full_name), creator:created_by(full_name)")
      .eq("case_id", caseId).order("created_at");
    if (error) throw error;
    const today = todayKey();
    return ((data ?? []) as unknown as (Omit<CaseTask, "overdue" | "done_by_name" | "created_by_name">
      & {doer: {full_name: string} | null; creator: {full_name: string} | null})[])
      .map(({doer, creator, ...task}) => ({...task, overdue: !task.done_at && !!task.due_on && task.due_on < today,
        done_by_name: doer?.full_name ?? null, created_by_name: creator?.full_name ?? null}));
  },
  items: async (caseId: string): Promise<CaseItem[]> => {
    const {data, error} = await supabase.from("case_items")
      .select("id, case_id, label, description, quantity, evidence_id, status, location, holder_id, holder_name, retain_until, created_at, created_by, "
        + "holder:holder_id(full_name), events:case_item_events(id, action, location, note, created_at, holder_name, "
        + "holder:holder_id(full_name), actor:actor_id(full_name))")
      .eq("case_id", caseId).order("created_at");
    if (error) throw error;
    const today = todayKey();
    type Row = Omit<CaseItem, "retention_over" | "events"> & {holder: {full_name: string} | null;
      events: (Omit<CaseItemEvent, "actor_name"> & {holder: {full_name: string} | null; actor: {full_name: string} | null})[]};
    return ((data ?? []) as unknown as Row[]).map(({holder, events, ...item}) => ({
      ...item,
      holder_name: holder?.full_name ?? item.holder_name,
      retention_over: !!item.retain_until && item.retain_until < today && (item.status === "held" || item.status === "checked_out"),
      events: [...events].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id)
        .map(({holder: eventHolder, actor, ...event}) => ({...event, holder_name: eventHolder?.full_name ?? event.holder_name,
          actor_name: actor?.full_name ?? null})),
    }));
  },
  saveItem: (caseId: string, itemId: string | null, item: {label: string; description?: string | null; quantity?: string | null;
    evidence_id?: string | null; location?: string | null; retain_until?: string | null; note?: string | null}) =>
    rpc<CaseItem>("save_case_item", {_case_id: caseId, _item_id: itemId, _item: item}),
  recordItem: (itemId: string, action: Exclude<CaseItemAction, "seized">, step: {location?: string | null; holderId?: string | null;
    holderName?: string | null; note?: string | null}) =>
    rpc<CaseItem>("record_case_item", {_item_id: itemId, _action: action, _location: step.location ?? null, _holder_id: step.holderId ?? null,
      _holder_name: step.holderName ?? null, _note: step.note ?? null}),
  deleteItem: (itemId: string) => rpc<void>("delete_case_item", {_item_id: itemId}),
  settings: async () => {
    const {data, error} = await supabase.from("mcb_settings").select("arrest_days, search_days, reminder_days, updated_at").maybeSingle();
    if (error) throw error;
    return data as McbSettings | null;
  },
  saveSettings: (settings: Pick<McbSettings, "arrest_days" | "search_days" | "reminder_days">) =>
    rpc<McbSettings>("save_mcb_settings", {_arrest_days: settings.arrest_days, _search_days: settings.search_days,
      _reminder_days: settings.reminder_days}),
  requestRenewal: (warrantId: string, note?: string | null) => rpc<CaseWarrant>("request_warrant_renewal", {_warrant_id: warrantId, _note: note ?? null}),
  renewWarrant: (warrantId: string, note?: string | null) => rpc<CaseWarrant>("renew_warrant", {_warrant_id: warrantId, _note: note ?? null}),
  informants: () => rpc<{is_lead: boolean; informants: Informant[]}>("get_informants"),
  saveInformant: (id: string | null, informant: Partial<Pick<Informant, "codename" | "real_name" | "suspect_id" | "handler_id" | "reliability"
    | "status" | "contact" | "notes">>) => rpc<Informant>("save_informant", {_id: id, _informant: informant}),
  addInformantContact: (informantId: string, contact: {met_on: string; summary: string; value: InformantContact["value"]; case_id?: string | null;
    payment?: number | null}) => rpc<Informant>("add_informant_contact", {_informant_id: informantId, _contact: contact}),
  deleteInformant: (id: string) => rpc<void>("delete_informant", {_id: id}),
  overview: () => rpc<McbOverview>("get_mcb_overview"),
  events: async (caseId: string, limit = 150) => {
    const {data, error} = await supabase.from("case_events")
      .select("id, case_id, kind, details, created_at, actor_id, actor:actor_id(full_name, avatar_url)")
      .eq("case_id", caseId).order("created_at", {ascending: false}).order("id", {ascending: false}).limit(limit);
    if (error) throw error;
    return (data ?? []) as unknown as CaseEvent[];
  },
};

// --- Permissions (mirror of the database helpers) ----------------------------------

type Subject = RankSubject & {division_rank?: string | null};

/** private.sees_all_cases(): may open every case. */
export const seesAllCases = (p?: Subject | null) =>
  !!p && (!!p.is_bureau_manager || (p.division === "MCB" && (!!p.is_bureau_commander || isPrivilegedRank(p.division, p.division_rank)))
    || p.system_role === "admin" || isHighCommand(p));

/** private.is_mcb_lead(): bureau manager or the MCB bureau commander. */
export const isMcbLead = (p?: Subject | null) => !!p && (!!p.is_bureau_manager || (p.division === "MCB" && !!p.is_bureau_commander));

/** private.can_view_mcb_overview(). */
export const canViewMcbOverview = (p?: Subject | null) =>
  !!p && (p.system_role === "admin" || p.system_role === "supervisor" || !!p.is_bureau_manager
    || (p.division === "MCB" && (!!p.is_bureau_commander || isPrivilegedRank(p.division, p.division_rank))));

/** private.can_approve_warrants(). */
export const canApproveWarrants = (p?: Subject | null) =>
  !!p && (p.system_role === "admin" || p.system_role === "supervisor" || isSupervisory(p) || isHighCommand(p)
    || !!p.is_bureau_manager || (p.division === "MCB" && isPrivilegedRank(p.division, p.division_rank)));

// --- Labels and looks --------------------------------------------------------------

interface Look {
  label: string;
  /** Chip: background, text and ring. */
  chip: string;
  /** Solid accent (dots, bars). */
  dot: string;
  icon: LucideIcon;
}

export const CASE_STATUS: Record<CaseStatus, Look> = {
  open: {label: "Folyamatban", chip: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30", dot: "bg-emerald-400", icon: FolderOpen},
  closed: {label: "Lezárva", chip: "bg-slate-500/10 text-slate-300 ring-slate-500/30", dot: "bg-slate-400", icon: Lock},
  archived: {label: "Archiválva", chip: "bg-violet-500/10 text-violet-300 ring-violet-500/30", dot: "bg-violet-400", icon: FolderArchive},
};

export const PRIORITY: Record<CasePriority, Look & {order: number}> = {
  critical: {label: "Kritikus", chip: "bg-red-500/15 text-red-300 ring-red-500/40", dot: "bg-red-500", icon: Siren, order: 0},
  high: {label: "Magas", chip: "bg-orange-500/10 text-orange-300 ring-orange-500/30", dot: "bg-orange-400", icon: ShieldAlert, order: 1},
  medium: {label: "Közepes", chip: "bg-sky-500/10 text-sky-300 ring-sky-500/30", dot: "bg-sky-400", icon: CircleDot, order: 2},
  low: {label: "Alacsony", chip: "bg-slate-500/10 text-slate-300 ring-slate-500/25", dot: "bg-slate-500", icon: CircleDot, order: 3},
};
export const PRIORITIES: CasePriority[] = ["critical", "high", "medium", "low"];

export const CATEGORY: Record<CaseCategory, {label: string; icon: LucideIcon}> = {
  homicide: {label: "Emberölés", icon: Skull},
  assault: {label: "Erőszakos bűncselekmény", icon: Swords},
  robbery: {label: "Rablás, betörés", icon: Banknote},
  kidnapping: {label: "Emberrablás", icon: UserX},
  drugs: {label: "Kábítószer", icon: Pill},
  weapons: {label: "Fegyverbűnözés", icon: Crosshair},
  organized: {label: "Szervezett bűnözés", icon: Network},
  vehicle: {label: "Járműbűnözés", icon: Car},
  fraud: {label: "Csalás, gazdasági", icon: ScrollText},
  corruption: {label: "Korrupció", icon: Scale},
  other: {label: "Egyéb", icon: FileSearch},
};
export const CATEGORIES = Object.keys(CATEGORY) as CaseCategory[];

/** Roles of a person in a case (case_suspects.involvement_type). */
export const INVOLVEMENT: Record<string, {label: string; chip: string; bar: string}> = {
  suspect: {label: "Gyanúsított", chip: "bg-orange-500/10 text-orange-300 ring-orange-500/30", bar: "bg-orange-400"},
  perpetrator: {label: "Elkövető", chip: "bg-red-500/10 text-red-300 ring-red-500/30", bar: "bg-red-500"},
  witness: {label: "Tanú", chip: "bg-sky-500/10 text-sky-300 ring-sky-500/30", bar: "bg-sky-400"},
  victim: {label: "Sértett", chip: "bg-amber-500/10 text-amber-200 ring-amber-500/30", bar: "bg-amber-300"},
  informant: {label: "Informátor", chip: "bg-violet-500/10 text-violet-300 ring-violet-500/30", bar: "bg-violet-400"},
  other: {label: "Egyéb érintett", chip: "bg-slate-500/10 text-slate-300 ring-slate-500/25", bar: "bg-slate-400"},
};
export const INVOLVEMENTS = Object.keys(INVOLVEMENT);
export const involvementLook = (value: string | null | undefined) =>
  INVOLVEMENT[value ?? ""] ?? {...INVOLVEMENT.other, label: value || INVOLVEMENT.other.label};

export const SUSPECT_STATUS: Record<SuspectStatus, Look> = {
  wanted: {label: "Körözött", chip: "bg-red-500/15 text-red-300 ring-red-500/40", dot: "bg-red-500", icon: Siren},
  jailed: {label: "Börtönben", chip: "bg-orange-500/10 text-orange-300 ring-orange-500/30", dot: "bg-orange-400", icon: Lock},
  free: {label: "Szabadlábon", chip: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30", dot: "bg-emerald-400", icon: Eye},
  deceased: {label: "Elhunyt", chip: "bg-slate-500/15 text-slate-300 ring-slate-500/30", dot: "bg-slate-500", icon: Skull},
  unknown: {label: "Ismeretlen", chip: "bg-slate-500/10 text-slate-400 ring-slate-500/25", dot: "bg-slate-600", icon: HelpCircle},
};
export const SUSPECT_STATUSES: SuspectStatus[] = ["wanted", "jailed", "free", "deceased", "unknown"];
export const suspectStatusLook = (status: string | null | undefined) =>
  SUSPECT_STATUS[(status ?? "free") as SuspectStatus] ?? SUSPECT_STATUS.unknown;

export const WARRANT_TYPE: Record<WarrantType, {label: string; short: string; icon: LucideIcon; accent: string}> = {
  arrest: {label: "Elfogatóparancs", short: "Elfogató", icon: Handshake, accent: "text-red-300"},
  search: {label: "Házkutatási parancs", short: "Házkutatási", icon: Home, accent: "text-amber-300"},
};

export const WARRANT_STATUS: Record<WarrantStatus, Look> = {
  pending: {label: "Jóváhagyásra vár", chip: "bg-amber-500/10 text-amber-300 ring-amber-500/30", dot: "bg-amber-400", icon: Gavel},
  approved: {label: "Érvényes", chip: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30", dot: "bg-emerald-400", icon: CheckCircle2},
  executed: {label: "Végrehajtva", chip: "bg-sky-500/10 text-sky-300 ring-sky-500/30", dot: "bg-sky-400", icon: CheckCircle2},
  rejected: {label: "Elutasítva", chip: "bg-red-500/10 text-red-300 ring-red-500/30", dot: "bg-red-500", icon: XCircle},
  expired: {label: "Visszavonva", chip: "bg-slate-500/10 text-slate-400 ring-slate-500/25", dot: "bg-slate-500", icon: XCircle},
};

export const PROPERTY_TYPE: Record<string, string> = {
  house: "Ház", apartment: "Lakás", garage: "Garázs", business: "Üzlet", warehouse: "Raktár", other: "Egyéb",
};

export const COLLABORATOR_ROLE: Record<"editor" | "viewer", {label: string; hint: string}> = {
  editor: {label: "Szerkesztő", hint: "Írja a dokumentumot, bizonyítékot és személyt csatol, parancsot kér."},
  viewer: {label: "Megtekintő", hint: "Olvassa az aktát és üzenhet, de nem módosít."},
};

/** Target of a warrant as shown on cards. */
export const warrantTarget = (w: Pick<CaseWarrant, "suspect" | "property" | "target_name">) =>
  w.suspect?.full_name ?? w.property?.address ?? w.target_name ?? "Ismeretlen célpont";

// --- Documents ---------------------------------------------------------------------

interface InlineNode {
  type?: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: unknown;
  text?: string;
}

/** Visits every block and inline node of a BlockNote document (tables and nested blocks too). */
export function walkDocument(document: unknown, visit: (node: InlineNode) => void) {
  const walk = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (value && typeof value === "object") {
      const node = value as InlineNode;
      if (typeof node.type === "string") visit(node);
      Object.values(node).forEach((child) => {
        if (child && typeof child === "object") walk(child);
      });
    }
  };
  walk(document);
}

export interface DocumentReferences {
  officers: Map<string, string>;
  suspects: Map<string, string>;
  cases: Map<string, string>;
  /** evidence id -> number of evidence blocks showing it */
  evidence: Map<string, number>;
  words: number;
}

/** Mentions, evidence blocks and the word count of a case document. */
export function documentReferences(document: unknown): DocumentReferences {
  const refs: DocumentReferences = {officers: new Map(), suspects: new Map(), cases: new Map(), evidence: new Map(), words: 0};
  walkDocument(document, (node) => {
    if (node.type === "mention") {
      const id = String(node.props?.id ?? "");
      const label = String(node.props?.user ?? "");
      if (!id) return;
      const role = node.props?.role;
      (role === "suspect" ? refs.suspects : role === "case" ? refs.cases : refs.officers).set(id, label);
    } else if (node.type === "evidence") {
      const id = String(node.props?.evidenceId ?? "");
      if (id) refs.evidence.set(id, (refs.evidence.get(id) ?? 0) + 1);
    } else if (node.type === "text" && typeof node.text === "string") {
      refs.words += node.text.split(/\s+/).filter(Boolean).length;
    }
  });
  return refs;
}

/** Evidence numbers in upload order (#1 is the first file of the case). */
export function evidenceNumbers(evidence: Pick<CaseEvidence, "id" | "created_at">[]): Map<string, number> {
  const sorted = [...evidence].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  return new Map(sorted.map((item, index) => [item.id, index + 1]));
}

export const isImageEvidence = (file: Pick<CaseEvidence, "file_type">) => file.file_type === "image";
