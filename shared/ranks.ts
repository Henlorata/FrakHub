/**
 * Faction rank hierarchy and the HR permission rules derived from it.
 *
 * Single source of truth for BOTH the browser bundle (`src/`) and the Vercel
 * functions (`api/`). The UI uses these rules to decide what to show; the API
 * enforces the very same rules server-side, because the service-role key used
 * there bypasses Row Level Security.
 *
 * Keep this module dependency-free: it is compiled by Vite and by Vercel's
 * Node.js builder, and must not use path aliases.
 */

export const FACTION_RANKS = [
  "Commander",
  "Deputy Commander", // Executive
  "Captain III.",
  "Captain II.",
  "Captain I.",
  "Lieutenant II.",
  "Lieutenant I.", // Command
  "Sergeant II.",
  "Sergeant I.", // Supervisory
  "Corporal",
  "Staff Deputy Sheriff",
  "Senior Deputy Sheriff",
  "Deputy Sheriff III+.",
  "Deputy Sheriff III.",
  "Deputy Sheriff II.",
  "Deputy Sheriff I.",
  "Deputy Sheriff Trainee", // Field
] as const;

export type FactionRank = (typeof FACTION_RANKS)[number];

export const EXECUTIVE_STAFF: readonly FactionRank[] = ["Commander", "Deputy Commander"];
export const COMMAND_STAFF: readonly FactionRank[] = [
  "Captain III.",
  "Captain II.",
  "Captain I.",
  "Lieutenant II.",
  "Lieutenant I.",
];
export const SUPERVISORY_STAFF: readonly FactionRank[] = ["Sergeant II.", "Sergeant I."];
export const HIGH_COMMAND: readonly FactionRank[] = [...EXECUTIVE_STAFF, ...COMMAND_STAFF];

export const TRAINEE_RANK: FactionRank = "Deputy Sheriff Trainee";

export const DIVISIONS = ["TSB", "SEB", "MCB"] as const;
export type DepartmentDivision = (typeof DIVISIONS)[number];

export const QUALIFICATIONS = ["SAHP", "AB", "MU", "GW", "FAB", "SIB", "TB"] as const;
export type Qualification = (typeof QUALIFICATIONS)[number];

/**
 * The bureau ranks (division_rank) the app shipped with, highest first. Since then each bureau
 * keeps its own list in the database (division_ranks, edited by its Bureau Commander): these are
 * only the defaults the client shows until that list is loaded.
 */
export const INVESTIGATOR_RANKS = ["Investigator III.", "Investigator II.", "Investigator I."] as const;
export const OPERATOR_RANKS = ["Operator III.", "Operator II.", "Operator I."] as const;

export type SystemRole = "admin" | "supervisor" | "user" | "pending";

/** The profile fields the permission rules need. Database rows and client profiles both satisfy it. */
export interface RankSubject {
  id: string;
  faction_rank: string;
  system_role?: string | null;
  division?: string | null;
  qualifications?: readonly string[] | null;
  is_bureau_manager?: boolean | null;
  is_bureau_commander?: boolean | null;
  commanded_divisions?: readonly string[] | null;
}

export const isFactionRank = (value: unknown): value is FactionRank =>
  typeof value === "string" && (FACTION_RANKS as readonly string[]).includes(value);

export const isDivision = (value: unknown): value is DepartmentDivision =>
  typeof value === "string" && (DIVISIONS as readonly string[]).includes(value);

export const isQualification = (value: unknown): value is Qualification =>
  typeof value === "string" && (QUALIFICATIONS as readonly string[]).includes(value);

/** Lower number = higher rank. Unknown ranks sort last. */
export const getRankPriority = (rank: string | null | undefined): number => {
  if (!rank) return 999;
  const index = (FACTION_RANKS as readonly string[]).indexOf(rank);
  return index === -1 ? 999 : index;
};

/**
 * The rank one step above (`up`) or below (`down`) in the hierarchy, or null at either end.
 * Used by the one-click promotion and demotion on the HR page.
 */
export const getAdjacentRank = (rank: string, direction: "up" | "down"): FactionRank | null => {
  const index = (FACTION_RANKS as readonly string[]).indexOf(rank);
  if (index === -1) return null;
  const next = direction === "up" ? index - 1 : index + 1;
  return FACTION_RANKS[next] ?? null;
};

const hasRank = (list: readonly FactionRank[], subject?: RankSubject | null) =>
  !!subject && (list as readonly string[]).includes(subject.faction_rank);

export const isExecutive = (p?: RankSubject | null) => hasRank(EXECUTIVE_STAFF, p);
export const isCommand = (p?: RankSubject | null) => hasRank(COMMAND_STAFF, p);
export const isSupervisory = (p?: RankSubject | null) => hasRank(SUPERVISORY_STAFF, p);
export const isHighCommand = (p?: RankSubject | null) => isExecutive(p) || isCommand(p);

/** Website permission level derived from the faction rank. */
export const calculateSystemRole = (rank: string): Exclude<SystemRole, "pending"> => {
  if ((HIGH_COMMAND as readonly string[]).includes(rank)) return "admin";
  if ((SUPERVISORY_STAFF as readonly string[]).includes(rank)) return "supervisor";
  return "user";
};

// --- HR permissions -----------------------------------------------------------

/** Who may open the HR edit dialog of `target`. */
export const canEditUser = (editor: RankSubject, target: RankSubject): boolean => {
  if (editor.is_bureau_manager) return true;
  if (editor.id === target.id) return false;
  if (editor.commanded_divisions && editor.commanded_divisions.length > 0) return true;
  if (isSupervisory(editor) || isHighCommand(editor)) return !target.is_bureau_manager;
  return !!(editor.qualifications?.includes("TB") && target.faction_rank === TRAINEE_RANK);
};

/** Ranks `editor` may assign (and therefore may manage). */
export const getAllowedPromotionRanks = (editor: RankSubject): FactionRank[] => {
  if (editor.is_bureau_manager || isExecutive(editor)) return [...FACTION_RANKS];
  if (isCommand(editor)) return FACTION_RANKS.slice(getRankPriority("Sergeant II."));
  if (isSupervisory(editor)) return FACTION_RANKS.slice(getRankPriority("Corporal"));
  if (editor.qualifications?.includes("TB")) return ["Deputy Sheriff I.", TRAINEE_RANK];
  return [];
};

/** Whether `editor` may change the faction rank of `target` (judged by the target's current rank). */
export const canManageUserRank = (editor: RankSubject, target: RankSubject): boolean => {
  if (editor.is_bureau_manager) return true;
  if (target.is_bureau_manager) return false;
  if (!isSupervisory(editor) && !isHighCommand(editor) && editor.commanded_divisions?.length) return false;
  return (getAllowedPromotionRanks(editor) as string[]).includes(target.faction_rank);
};

/** Whether `editor` may move `target` to another division. */
export const canManageUserDivision = (editor: RankSubject, target: RankSubject): boolean => {
  if (editor.is_bureau_manager) return true;
  if (target.is_bureau_manager || target.is_bureau_commander) return false;
  if (editor.is_bureau_commander) return target.division === "TSB" || target.division === editor.division;
  return isSupervisory(editor) || isHighCommand(editor);
};

/** Whether `editor` may grant or revoke `qualification` on `target`. */
export const canManageUserQualification = (
  editor: RankSubject,
  target: RankSubject,
  qualification: string,
): boolean => {
  if (editor.is_bureau_manager) return true;
  if (target.is_bureau_manager) return false;
  // Nobody below bureau manager may touch a qualification the target leads.
  if (target.commanded_divisions?.includes(qualification)) return false;
  if (target.is_bureau_commander && target.division === qualification) return false;

  const editorCommands = editor.commanded_divisions ?? [];
  if (editorCommands.length > 0) return editorCommands.includes(qualification);
  return isSupervisory(editor) || isHighCommand(editor);
};

/**
 * Whether `editor` may move `target` to `newRank` (the target's current rank and the new
 * one must both be within the editor's range). Mirrors the API check of a rank change.
 */
export const canAssignRank = (editor: RankSubject, target: RankSubject, newRank: string): boolean =>
  (editor.id !== target.id || !!editor.is_bureau_manager) &&
  canManageUserRank(editor, target) &&
  (!!editor.is_bureau_manager || (getAllowedPromotionRanks(editor) as string[]).includes(newRank));

/** Supervisory staff and above (system_role admin/supervisor) or a bureau manager. */
export const isStaff = (p?: RankSubject | null): boolean =>
  !!p && (p.system_role === "admin" || p.system_role === "supervisor" || !!p.is_bureau_manager);

/**
 * Whether `editor` stands above `target` in the hierarchy (warnings, commendations, notes
 * and leave decisions). Same rule as private.outranks() in the database.
 */
export const outranks = (editor: RankSubject, target: RankSubject): boolean => {
  if (editor.is_bureau_manager) return true;
  if (target.is_bureau_manager) return false;
  if (isExecutive(editor)) return true;
  return getRankPriority(editor.faction_rank) < getRankPriority(target.faction_rank);
};

/** Whether `editor` may add HR records (warning, commendation, note, leave) for `target`. */
export const canManageRecords = (editor: RankSubject, target: RankSubject): boolean =>
  editor.id !== target.id && isStaff(editor) && outranks(editor, target);

/**
 * Sheet-era HR data of a member (station, parking spot, recruiter, activity, bank account):
 * staff above the member; executives and the bureau manager also their own. Same rule as
 * private.can_manage_member() in the database.
 */
export const canManageMemberDetails = (editor: RankSubject, target: RankSubject): boolean =>
  isStaff(editor) && (editor.id === target.id ? isExecutive(editor) || !!editor.is_bureau_manager : outranks(editor, target));

/** Academy instructors may edit course material and its images. */
export const isAcademyInstructor = (p?: RankSubject | null): boolean => {
  if (!p || p.faction_rank === TRAINEE_RANK) return false;
  return !!(p.qualifications?.includes("TB") || p.is_bureau_manager || isSupervisory(p) || isHighCommand(p));
};
