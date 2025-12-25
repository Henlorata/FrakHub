export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// --- RANGOK ---
export const FACTION_RANKS = [
  'Commander', 'Deputy Commander', // Executive
  'Captain III.', 'Captain II.', 'Captain I.', 'Lieutenant II.', 'Lieutenant I.', // Command
  'Sergeant II.', 'Sergeant I.', // Supervisory
  'Corporal', 'Staff Deputy Sheriff', 'Senior Deputy Sheriff',
  'Deputy Sheriff III+.', 'Deputy Sheriff III.', 'Deputy Sheriff II.', 'Deputy Sheriff I.', 'Deputy Sheriff Trainee' // Field
] as const;

export type FactionRank = typeof FACTION_RANKS[number];

// Alosztály Rangok
export type InvestigatorRank = 'Investigator III.' | 'Investigator II.' | 'Investigator I.';
export type OperatorRank = 'Operator III.' | 'Operator II.' | 'Operator I.';
export type DivisionRank = InvestigatorRank | OperatorRank | null; // Null, ha csak TSB

export type DepartmentDivision = 'TSB' | 'SEB' | 'MCB';

// Képesítések
export type Qualification = 'SAHP' | 'AB' | 'MU' | 'GW' | 'FAB' | 'SIB' | 'TB';

// Rendszer jogosultság (Weboldal adminisztráció)
export type SystemRole = 'admin' | 'supervisor' | 'user' | 'pending';

// --- PROFIL ---
export interface Profile {
  id: string;
  email: string;
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
  avatar_url?: string;
  created_at: string;
  last_promotion_date?: string | null;
}

// --- LOGISZTIKA ---
export type RequestStatus = 'pending' | 'approved' | 'rejected';

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
  profiles?: {
    full_name: string;
    badge_number: string;
    faction_rank: string;
  } | null;
}

// --- PÉNZÜGY ---
export interface BudgetRequest {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  proof_images: string[];
  status: RequestStatus;
  admin_comment?: string | null;
  processed_by?: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string;
    badge_number: string;
    faction_rank: string;
  } | null;
}

// --- ACTION LOG ---
export interface ActionLog {
  id: string;
  user_id: string;
  action_type: 'ticket' | 'arrest' | 'other';
  details: string;
  created_at: string;
  profiles?: {
    full_name: string;
    badge_number: string;
  } | null;
}

// --- HÍREK ---
export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'alert' | 'training';
  is_pinned: boolean;
  created_by: string;
  created_at: string;
}

// --- MCB / NYOMOZÁS ---

export interface Case {
  id: string;
  case_number: string;
  title: string;
  description: string | null;
  body: Json;
  status: 'open' | 'closed' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'critical';
  owner_id: string;
  created_at: string;
  updated_at: string;
  theme?: string;
  owner?: { full_name: string; badge_number: string; };
}

export interface CaseCollaborator {
  id: string;
  case_id: string;
  user_id: string;
  role: 'viewer' | 'editor';
  profile?: Profile;
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
export type SuspectStatus = 'free' | 'wanted' | 'jailed' | 'deceased' | 'unknown';

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
  property_type: 'house' | 'garage' | 'business' | 'warehouse' | 'other';
  notes: string | null;
}

export interface CaseSuspect {
  id: string;
  case_id: string;
  suspect_id: string;
  involvement_type: string;
  notes: string | null;
  suspect?: Suspect;
}

export interface SuspectAssociate {
  id: string;
  suspect_id: string;
  associate_id: string;
  relationship: string;
  notes: string | null;
  associate?: Suspect;
}

export interface CaseNote {
  id: string;
  case_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: { full_name: string; avatar_url?: string; };
}

export type WarrantType = 'arrest' | 'search';
export type WarrantStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'expired';

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
  requester?: { full_name: string; badge_number: string; };
  approver?: { full_name: string; badge_number: string; };
  suspect?: { full_name: string; };
  property?: { address: string; type: string; };
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'alert';
  is_read: boolean;
  created_at: string;
  link?: string;
}

// --- ADATBÁZIS DEFINÍCIÓ ---
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at'>;
        Update: Partial<Profile>;
      };
      vehicle_requests: {
        Row: VehicleRequest;
        Insert: Omit<VehicleRequest, 'id' | 'created_at' | 'updated_at' | 'profiles' | 'status' | 'vehicle_plate' | 'admin_comment' | 'processed_by'> & {
          status?: RequestStatus;
        };
        Update: Partial<VehicleRequest>;
      };
      budget_requests: {
        Row: BudgetRequest;
        Insert: Omit<BudgetRequest, 'id' | 'created_at' | 'updated_at' | 'profiles' | 'status' | 'admin_comment' | 'processed_by'> & {
          status?: RequestStatus;
        };
        Update: Partial<BudgetRequest>;
      };
      system_status: {
        Row: {
          id: string;
          alert_level: string;
          recruitment_open: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          alert_level?: string;
          recruitment_open?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          alert_level?: string;
          recruitment_open?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
      };
      exam_overrides: {
        Row: {
          id: string;
          exam_id: string;
          user_id: string;
          access_type: 'allow' | 'deny';
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          exam_id: string;
          user_id: string;
          access_type: 'allow' | 'deny';
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          id: string;
          exam_id: string;
          user_id: string;
          access_type: 'allow' | 'deny';
          created_by: string | null;
          created_at: string;
        }>;
      };
      cases: {
        Row: Case;
        Insert: Omit<Case, 'id' | 'case_number' | 'created_at' | 'updated_at' | 'owner'>;
        Update: Partial<Case>;
      };
      case_collaborators: {
        Row: CaseCollaborator;
        Insert: Omit<CaseCollaborator, 'id' | 'created_at' | 'profile'>;
        Update: Partial<CaseCollaborator>;
      };
      case_evidence: {
        Row: CaseEvidence;
        Insert: Omit<CaseEvidence, 'id' | 'created_at'>;
        Update: Partial<CaseEvidence>;
      };
      suspects: {
        Row: Suspect;
        Insert: Omit<Suspect, 'id' | 'created_at' | 'updated_at' | 'created_by'>;
        Update: Partial<Suspect>;
      };
      suspect_vehicles: {
        Row: SuspectVehicle;
        Insert: Omit<SuspectVehicle, 'id' | 'created_at'>;
        Update: Partial<SuspectVehicle>;
      };
      suspect_properties: {
        Row: SuspectProperty;
        Insert: Omit<SuspectProperty, 'id' | 'created_at'>;
        Update: Partial<SuspectProperty>;
      };
      case_suspects: {
        Row: CaseSuspect;
        Insert: Omit<CaseSuspect, 'id' | 'added_at' | 'suspect'>;
        Update: Partial<CaseSuspect>;
      };
      action_logs: {
        Row: ActionLog;
        Insert: Omit<ActionLog, 'id' | 'created_at' | 'profiles'>;
        Update: never;
      };
      announcements: {
        Row: Announcement;
        Insert: Omit<Announcement, 'id' | 'created_at'>;
        Update: Partial<Announcement>;
      };
      suspect_associates: {
        Row: SuspectAssociate;
        Insert: Omit<SuspectAssociate, 'id' | 'created_at' | 'associate'>;
        Update: Partial<SuspectAssociate>;
      };
      case_notes: {
        Row: CaseNote;
        Insert: Omit<CaseNote, 'id' | 'created_at' | 'profile'>;
        Update: Partial<CaseNote>;
      };
      case_warrants: {
        Row: CaseWarrant;
        Insert: Omit<CaseWarrant, 'id' | 'created_at' | 'updated_at' | 'approved_by' | 'requester' | 'approver' | 'suspect' | 'property'>;
        Update: Partial<CaseWarrant>;
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, 'id' | 'created_at' | 'is_read'>;
        Update: Partial<Notification>;
      };
    };
  };
}