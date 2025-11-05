export type UserRole = "pending" | "detective" | "lead_detective";

export interface Profile {
  id: string; // uuid
  created_at: string; // timestamptz
  full_name: string; // text
  role: UserRole; // user_role_enum
}
