// Domain types for the rows the app reads and writes.
//
// Hand-maintained: keep them in sync with the database. `bun run db:types` generates
// the authoritative schema types (src/types/database.types.ts) for comparison.

export type Json = string | number | boolean | null | {[key: string]: Json | undefined} | Json[];

// --- RANGOK (forrás: shared/ranks.ts, a kliens és az API közös szabályai) ---
export {FACTION_RANKS, DIVISIONS, QUALIFICATIONS} from "@shared/ranks";
export type {FactionRank, DepartmentDivision, Qualification, SystemRole} from "@shared/ranks";
import type {DepartmentDivision, FactionRank, Qualification, SystemRole} from "@shared/ranks";

// Alosztály rangok
export type InvestigatorRank = "Investigator III." | "Investigator II." | "Investigator I.";
export type OperatorRank = "Operator III." | "Operator II." | "Operator I.";
export type DivisionRank = InvestigatorRank | OperatorRank | null; // null, ha csak TSB

// --- PROFIL ---

/**
 * Profile columns the client reads. Never `*`: the e-mail address column is reserved for
 * the account owner (it comes from the auth session instead) and is not readable by others.
 */
export const PROFILE_COLUMNS =
  "id, full_name, badge_number, faction_rank, division, division_rank, qualifications, is_bureau_manager, " +
  "is_bureau_commander, commanded_divisions, system_role, avatar_url, onboarding_completed, created_at, last_promotion_date";

export interface Profile {
  id: string;
  /** Only set for the signed-in user (from the auth session). */
  email?: string;
  full_name: string;
  badge_number: string;
  faction_rank: FactionRank;
  division: DepartmentDivision;
  division_rank?: DivisionRank;
  qualifications?: Qualification[];
  is_bureau_manager?: boolean;
  is_bureau_commander?: boolean;
  commanded_divisions?: Qualification[];
  system_role: SystemRole;
  avatar_url?: string | null;
  onboarding_completed?: boolean;
  created_at: string;
  last_promotion_date?: string | null;
}

/** Embedded author/requester shape returned by `profiles(...)` joins. */
export interface ProfileSummary {
  full_name: string;
  badge_number: string;
  faction_rank: string;
  avatar_url?: string | null;
}

// --- LOGISZTIKA ---
export type RequestStatus = "pending" | "approved" | "rejected";

export interface VehicleRequest {
  id: string;
  user_id: string;
  vehicle_type: string;
  vehicle_plate?: string | null;
  reason: string;
  status: RequestStatus;
  admin_comment?: string | null;
  processed_by?: string | null;
  created_at: string;
  updated_at: string;
  profiles?: Pick<ProfileSummary, "full_name" | "badge_number" | "faction_rank"> | null;
}

// --- PÉNZÜGY ---
export interface BudgetRequest {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  /** Paths in the `finance_proofs` bucket. Legacy rows may hold a JSON string or a single path. */
  proof_image_path: string[] | string | null;
  status: RequestStatus;
  admin_comment?: string | null;
  processed_by?: string | null;
  created_at: string;
  updated_at: string;
  profiles?: Pick<ProfileSummary, "full_name" | "badge_number" | "faction_rank"> | null;
}

// --- ACTION LOG ---
export interface ActionLog {
  id: string;
  user_id: string;
  action_type: "ticket" | "arrest" | "other";
  details: string;
  created_at: string;
  profiles?: Pick<ProfileSummary, "full_name" | "badge_number"> | null;
}

// --- HÍREK ---
export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: "info" | "alert" | "training";
  is_pinned: boolean;
  show_author?: boolean;
  created_by: string;
  created_at: string;
  profiles?: Pick<ProfileSummary, "full_name" | "faction_rank"> | null;
}

// --- MCB / NYOMOZÁS ---
export type CaseStatus = "open" | "closed" | "archived";
export type CasePriority = "low" | "medium" | "high" | "critical";

export interface Case {
  id: string;
  case_number: number | string;
  title: string;
  description: string | null;
  body: Json;
  status: CaseStatus;
  priority: CasePriority;
  owner_id: string;
  created_at: string;
  updated_at: string;
  theme?: string;
  owner?: {full_name: string; badge_number?: string} | null;
}

export interface CaseCollaborator {
  id: string;
  case_id: string;
  user_id: string;
  role: "viewer" | "editor";
  profile?: ProfileSummary | null;
}

export interface CaseEvidence {
  id: string;
  case_id: string;
  file_path: string;
  file_name: string;
  file_type: string;
  uploaded_by: string;
  created_at: string;
}

// --- GYANÚSÍTOTTAK ---
export type SuspectStatus = "free" | "wanted" | "jailed" | "deceased" | "unknown";

export interface Suspect {
  id: string;
  full_name: string;
  alias: string | null;
  gender: string | null;
  gang_affiliation: string | null;
  status: SuspectStatus;
  description: string | null;
  mugshot_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SuspectVehicle {
  id: string;
  suspect_id: string;
  plate_number: string;
  vehicle_type: string;
  color: string | null;
  notes: string | null;
}

export interface SuspectProperty {
  id: string;
  suspect_id: string;
  address: string;
  property_type: "house" | "garage" | "business" | "warehouse" | "other";
  notes: string | null;
}

export interface CaseSuspect {
  id: string;
  case_id: string;
  suspect_id: string;
  involvement_type: string;
  notes: string | null;
  added_at?: string;
  suspect?: Suspect | null;
  case?: Pick<Case, "id" | "case_number" | "title" | "status" | "created_at"> | null;
}

export interface SuspectAssociate {
  id: string;
  suspect_id: string;
  associate_id: string;
  relationship: string;
  notes: string | null;
  associate?: Pick<Suspect, "full_name" | "alias" | "mugshot_url"> | null;
}

export interface CaseNote {
  id: string;
  case_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: {full_name: string; avatar_url?: string | null; faction_rank?: string} | null;
}

export type WarrantType = "arrest" | "search";
export type WarrantStatus = "pending" | "approved" | "rejected" | "executed" | "expired";

export interface CaseWarrant {
  id: string;
  case_id: string;
  suspect_id: string | null;
  property_id: string | null;
  target_name: string | null;
  type: WarrantType;
  status: WarrantStatus;
  reason: string;
  description: string | null;
  requested_by: string;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
  requester?: {full_name: string; badge_number: string} | null;
  approver?: {full_name: string; badge_number: string} | null;
  suspect?: {full_name: string} | null;
  property?: {address: string} | null;
  case?: {title: string; case_number: number | string} | null;
}

export type NotificationType = "info" | "success" | "warning" | "alert";
export type NotificationCategory = "system" | "hr" | "mcb" | "logistics" | "finance" | "exam" | "academy" | "announcement";

export interface Notification {
  id: string;
  user_id?: string;
  title: string;
  message: string;
  type: NotificationType;
  category: NotificationCategory;
  is_read: boolean;
  created_at: string;
  link?: string | null;
  actor_id?: string | null;
}

/** Columns of a notification the client displays. */
export const NOTIFICATION_COLUMNS = "id, title, message, type, category, is_read, created_at, link, actor_id";

// --- HR ---
export type MemberEventKind =
  | "joined" | "rank" | "division" | "division_rank" | "qualifications" | "bureau_role"
  | "name" | "badge" | "award" | "award_revoked";

/** One entry of a member's service history (written by database triggers). */
export interface MemberEvent {
  id: string;
  user_id: string;
  actor_id: string | null;
  kind: MemberEventKind;
  from_value: string | null;
  to_value: string | null;
  detail: string | null;
  created_at: string;
}

export type HrRecordKind = "warning" | "commendation" | "note" | "leave";
export type HrRecordStatus = "pending" | "active" | "rejected" | "revoked";

/** Warnings, commendations, internal notes and leave (requests). */
export interface HrRecord {
  id: string;
  user_id: string;
  kind: HrRecordKind;
  title: string;
  details: string | null;
  starts_on: string | null;
  ends_on: string | null;
  status: HrRecordStatus;
  created_by: string | null;
  created_at: string;
  decided_by: string | null;
  decided_at: string | null;
}

export interface ActiveLeave {
  user_id: string;
  starts_on: string;
  ends_on: string;
}

export interface Ribbon {
  id: string;
  name: string;
  description: string | null;
  color_hex: string | null;
  image_url: string | null;
}

// --- SZEMÉLYÜGYI NYILVÁNTARTÁS ÉS JÁRMŰPARK ---
export type ActivityStatus = "active" | "less_active" | "inactive";
export type JoinType = "new" | "returned" | "referral";

/** Sheet-era HR data of a member (visible to members, edited by staff). */
export interface MemberDetails {
  user_id: string;
  station: string | null;
  parking_spot: string | null;
  joined_on: string | null;
  join_type: JoinType;
  recruited_by: string | null;
  activity_status: ActivityStatus;
  updated_at: string;
  updated_by: string | null;
}

/** Duty time of one member in one calendar month (`month` is the first day). */
export interface DutyTimeEntry {
  user_id: string;
  month: string;
  minutes: number;
  updated_at?: string;
  updated_by?: string | null;
}

export type LeaveType = "resigned" | "dismissed" | "inactivity" | "transferred" | "other";
export type RehireStatus = "eligible" | "conditional" | "not_eligible";

export interface FormerMember {
  id: string;
  profile_id: string | null;
  full_name: string;
  badge_number: string | null;
  faction_rank: string | null;
  division: string | null;
  joined_on: string | null;
  left_on: string;
  leave_type: LeaveType;
  reason: string | null;
  rehire: RehireStatus;
  rehire_note: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FleetVehicle {
  id: string;
  plate: string;
  model: string;
  owner_id: string | null;
  registration_expires_on: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VehicleWarning {
  id: string;
  vehicle_id: string | null;
  plate: string;
  user_id: string | null;
  reason: string;
  issued_by: string | null;
  created_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  converted_record_id: string | null;
}

/** Result of get_hr_registry(): everything the caller may see, in one request. */
export interface HrRegistry {
  details: MemberDetails[];
  duty: DutyTimeEntry[];
  vehicles: FleetVehicle[];
  vehicle_warnings: VehicleWarning[];
  bank_accounts: {user_id: string; account_number: string}[];
}
