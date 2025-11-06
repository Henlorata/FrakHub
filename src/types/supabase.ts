export type UserRole = "pending" | "detective" | "lead_detective";
export type CaseStatus = "open" | "closed" | "archived";
export type CollaboratorStatus = "pending" | "approved";

export interface Profile {
  id: string; // uuid
  created_at: string; // timestamptz
  full_name: string; // text
  role: UserRole; // user_role_enum
}

// --- ÚJ TÍPUSOK ---

export interface Case {
  id: string; // uuid
  created_at: string; // timestamptz
  case_number: number; // int8 (az adatbázis generálja)
  title: string; // text
  owner_id: string; // uuid (foreign key to profiles.id)
  short_description: string | null; // text
  body: any; // jsonb (később lehet specifikálni, pl. egy editor formátumára)
  status: CaseStatus; // case_status_enum
}

export interface CaseCollaborator {
  case_id: string; // uuid (foreign key to cases.id)
  user_id: string; // uuid (foreign key to profiles.id)
  added_at: string; // timestampz
  status: CollaboratorStatus; // collaborator_status_enum
}

// Ezt a típust fogja visszaadni az új adatbázis-függvényünk
export interface CaseRow {
  id: string;
  case_number: number;
  title: string;
  status: CaseStatus;
  owner_full_name: string; // (A 'profiles' táblából joinolva)
}