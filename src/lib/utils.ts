import {type ClassValue, clsx} from "clsx";
import {twMerge} from "tailwind-merge";
import {
  COMMAND_STAFF,
  EXECUTIVE_STAFF,
  isHighCommand,
  isSupervisory,
  SUPERVISORY_STAFF,
  type RankSubject,
} from "@shared/ranks";
import type {Case, Profile} from "@/types/supabase";
import type {Exam} from "@/types/exams";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- RANG DEFINÍCIÓK ÉS HR JOGOSULTSÁGOK ---
// Egyetlen forrás a kliensnek és az API-nak: shared/ranks.ts
export {
  EXECUTIVE_STAFF,
  COMMAND_STAFF,
  SUPERVISORY_STAFF,
  HIGH_COMMAND,
  getRankPriority,
  isExecutive,
  isCommand,
  isSupervisory,
  isHighCommand,
  canEditUser,
  getAllowedPromotionRanks,
  canManageUserRank,
  canManageUserDivision,
  canManageUserQualification,
  isAcademyInstructor,
  getAdjacentRank,
  canAssignRank,
  isStaff,
  outranks,
  canManageRecords,
  canManageMemberDetails,
  getDivisionRanks,
} from "@shared/ranks";

export type StaffCategory = "executive" | "command" | "supervisory" | "field";

export const getStaffCategory = (rank: string | null | undefined): StaffCategory => {
  if (!rank) return "field";
  if ((EXECUTIVE_STAFF as readonly string[]).includes(rank)) return "executive";
  if ((COMMAND_STAFF as readonly string[]).includes(rank)) return "command";
  if ((SUPERVISORY_STAFF as readonly string[]).includes(rank)) return "supervisory";
  return "field";
};

export const STAFF_CATEGORY_LABELS: Record<StaffCategory, string> = {
  executive: "Executive Staff",
  command: "Command Staff",
  supervisory: "Supervisory Staff",
  field: "Field Staff",
};

export const isInvestigatorIII = (p?: Profile | null) => p?.division === "MCB" && p?.division_rank === "Investigator III.";
export const isMcbMember = (p?: Profile | null) => p?.division === "MCB";

// --- EGYÉB JOGOSULTSÁGOK ---

export const canAwardRibbon = (editor: Profile) =>
  !!editor.is_bureau_manager || (EXECUTIVE_STAFF as readonly string[]).includes(editor.faction_rank);
export const canManageCommanders = (editor: Profile) => !!editor.is_bureau_manager;

export const canManageExamContent = (user: RankSubject, exam: Pick<Exam, "type" | "division">) => {
  if (user.is_bureau_manager) return true;
  if (exam.type === "trainee" || exam.type === "deputy_i") return false;
  if (exam.division && user.commanded_divisions?.includes(exam.division)) return true;
  return !!user.is_bureau_commander && user.division === exam.division;
};

export const canCreateAnyExam = (user: RankSubject) =>
  !!user.is_bureau_manager || !!user.is_bureau_commander || (user.commanded_divisions?.length ?? 0) > 0;

export const canManageExamAccess = (p: RankSubject, exam: Pick<Exam, "type" | "division">) => {
  if (exam.type === "trainee" || exam.type === "deputy_i") {
    if (p.qualifications?.includes("TB")) return true;
    if (isSupervisory(p) || isHighCommand(p)) return true;
    return !!p.is_bureau_manager;
  }
  return canManageExamContent(p, exam);
};

export const canGradeExam = (p: RankSubject, exam: Pick<Exam, "type" | "division">) => canManageExamAccess(p, exam);

export const canDeleteExam = (user: RankSubject, exam: Pick<Exam, "division">) => {
  if (user.is_bureau_manager) return true;
  if (!exam.division) return false;
  return !!user.is_bureau_commander || !!user.commanded_divisions?.includes(exam.division);
};

export const canViewCaseList = (p?: Profile | null) => {
  if (!p) return false;
  return isMcbMember(p) || isSupervisory(p) || isHighCommand(p) || p.system_role === "admin";
};

export const canViewCaseDetails = (p?: Profile | null, caseData?: Case | null, isCollaborator = false) => {
  if (!p || !caseData) return false;
  if (caseData.owner_id === p.id || isCollaborator) return true;
  if (p.is_bureau_manager) return true;
  if (isInvestigatorIII(p)) return true;
  if (p.is_bureau_commander && p.division === "MCB") return true;
  return isHighCommand(p) || p.system_role === "admin";
};

export const canEditCase = (p?: Profile | null, caseData?: Case | null, isCollaboratorEditor = false) => {
  if (!p || !caseData) return false;
  if (caseData.status !== "open") return false;
  return caseData.owner_id === p.id || isCollaboratorEditor;
};

export const canApproveWarrant = (p?: Profile | null) => {
  if (!p) return false;
  if (p.system_role === "admin") return true;
  if (isSupervisory(p) || isHighCommand(p)) return true;
  return isInvestigatorIII(p);
};

export const getDepartmentLabel = (div: string) => {
  switch (div) {
    case "TSB":
      return "Field Staff";
    case "SEB":
      return "Special Enforcement Bureau";
    case "MCB":
      return "Major Crimes Bureau";
    default:
      return div;
  }
};

/** Message of an unknown thrown value (Error, Supabase error object or string), for toasts. */
export const errorMessage = (error: unknown, fallback = "Ismeretlen hiba történt."): string => {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
};
