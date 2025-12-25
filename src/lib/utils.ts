import {type ClassValue, clsx} from "clsx"
import {twMerge} from "tailwind-merge"
import {type Case, FACTION_RANKS, type FactionRank, type Profile} from "@/types/supabase"
import type {Exam} from "@/types/exams"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// --- RANG DEFINÍCIÓK ÉS HIERARCHIA ---
export const EXECUTIVE_STAFF: FactionRank[] = ['Commander', 'Deputy Commander'];
export const COMMAND_STAFF: FactionRank[] = ['Captain III.', 'Captain II.', 'Captain I.', 'Lieutenant II.', 'Lieutenant I.'];
export const SUPERVISORY_STAFF: FactionRank[] = ['Sergeant II.', 'Sergeant I.'];

export const isExecutive = (p?: Profile | null) => p ? EXECUTIVE_STAFF.includes(p.faction_rank) : false;
export const isCommand = (p?: Profile | null) => p ? COMMAND_STAFF.includes(p.faction_rank) : false;
export const isSupervisory = (p?: Profile | null) => p ? SUPERVISORY_STAFF.includes(p.faction_rank) : false;
export const isHighCommand = (p?: Profile | null) => isExecutive(p) || isCommand(p);

export const isInvestigatorIII = (p?: Profile | null) => p?.division === 'MCB' && p?.division_rank === 'Investigator III.';
export const isMcbMember = (p?: Profile | null) => p?.division === 'MCB';

export const getRankPriority = (rank: FactionRank | string | null | undefined): number => {
  if (!rank) return 999;
  const index = FACTION_RANKS.indexOf(rank as FactionRank);
  return index === -1 ? 999 : index;
}

// --- JOGOSULTSÁG LOGIKA (HR) ---

// 1. Profil Megnyitása
export const canEditUser = (editor: Profile, target: Profile): boolean => {
  if (editor.is_bureau_manager) return true;
  if (editor.id === target.id) return false;

  if (editor.commanded_divisions && editor.commanded_divisions.length > 0) return true;

  if (isSupervisory(editor) || isHighCommand(editor)) {
    return !target.is_bureau_manager;
  }

  return !!(editor.qualifications?.includes('TB') && target.faction_rank === 'Deputy Sheriff Trainee');
};

// 2. Kiosztható Rangok Listája
export const getAllowedPromotionRanks = (editor: Profile): FactionRank[] => {
  if (editor.is_bureau_manager) return [...FACTION_RANKS];
  if (isExecutive(editor)) return [...FACTION_RANKS];

  if (isCommand(editor)) {
    const startIdx = getRankPriority('Sergeant II.');
    return FACTION_RANKS.slice(startIdx);
  }

  if (isSupervisory(editor)) {
    const startIdx = getRankPriority('Corporal');
    return FACTION_RANKS.slice(startIdx);
  }

  if (editor.qualifications?.includes('TB')) {
    return ['Deputy Sheriff I.', 'Deputy Sheriff Trainee'];
  }

  return [];
};

// 3. RANG MÓDOSÍTÁSI JOG
export const canManageUserRank = (editor: Profile, target: Profile): boolean => {
  if (editor.is_bureau_manager) return true;
  if (target.is_bureau_manager) return false;

  if ((!isSupervisory(editor) && !isHighCommand(editor)) && editor.commanded_divisions?.length) {
    return false;
  }

  const allowedRanks = getAllowedPromotionRanks(editor);
  return allowedRanks.includes(target.faction_rank);
};

// 4. ALOSZTÁLY MÓDOSÍTÁSA
export const canManageUserDivision = (editor: Profile, target: Profile): boolean => {
  if (editor.is_bureau_manager) return true;

  if (target.is_bureau_manager) return false;
  if (target.is_bureau_commander) return false;

  if (editor.is_bureau_commander) {
    return target.division === 'TSB' || target.division === editor.division;
  }

  return isSupervisory(editor) || isHighCommand(editor);
};

// 5. KÉPESÍTÉSEK MÓDOSÍTÁSA
export const canManageUserQualification = (editor: Profile, target: Profile, qualification: string): boolean => {
  if (editor.is_bureau_manager) return true;
  if (target.is_bureau_manager) return false;

  // CÉLPONT VÉDELEM
  const targetCommands = target.commanded_divisions || [];
  if (targetCommands.includes(qualification as any)) return false;
  if (target.is_bureau_commander && target.division === qualification) return false;

  // SZERKESZTŐ KORLÁTOZÁS:
  const editorCommands = editor.commanded_divisions || [];
  if (editorCommands.length > 0) {
    return editorCommands.includes(qualification as any);
  }

  return isSupervisory(editor) || isHighCommand(editor);
};

// --- EGYÉB FUNKCIÓK ---

export const canAwardRibbon = (editor: Profile) => editor.is_bureau_manager || isExecutive(editor);
export const canManageCommanders = (editor: Profile) => !!editor.is_bureau_manager;

export const canManageExamContent = (user: Profile, exam: Exam) => {
  if (user.is_bureau_manager) return true;
  if (exam.type === 'trainee' || exam.type === 'deputy_i') return false;
  if (exam.required_rank === 'Deputy Sheriff Trainee' || exam.required_rank === 'Deputy Sheriff I.') return false;

  if (exam.division && user.commanded_divisions?.includes(exam.division)) return true;
  if (user.is_bureau_commander && user.division === exam.division) return true;

  return false;
}

export const canCreateAnyExam = (user: Profile) => {
  return user.is_bureau_manager || user.is_bureau_commander || (user.commanded_divisions && user.commanded_divisions.length > 0);
}

export const canManageExamAccess = (p: Profile, exam: Exam) => {
  if (exam.type === 'trainee' || exam.type === 'deputy_i') {
    if (p.qualifications?.includes('TB')) return true;
    if (isSupervisory(p) || isHighCommand(p)) return true;
    return !!p.is_bureau_manager;
  }
  return canManageExamContent(p, exam);
};

export const canGradeExam = (p: Profile, exam: Exam) => canManageExamAccess(p, exam);

export const canDeleteExam = (user: Profile, exam: Exam) => {
  if (user.is_bureau_manager) return true;
  if (exam.division) {
    if (user.is_bureau_commander) return true;
    if (user.commanded_divisions?.includes(exam.division)) return true;
  }
  return false;
}

export const canViewCaseList = (p?: Profile | null) => {
  if (!p) return false;
  return isMcbMember(p) || isSupervisory(p) || isHighCommand(p) || p.system_role === 'admin';
};

export const canViewCaseDetails = (p?: Profile | null, caseData?: Case | null, isCollaborator: boolean = false) => {
  if (!p || !caseData) return false;
  if (caseData.owner_id === p.id || isCollaborator) return true;
  if (p.is_bureau_manager) return true;
  if (isInvestigatorIII(p)) return true;
  if (p.is_bureau_commander && p.division === 'MCB') return true;
  if (isHighCommand(p) || p.system_role === 'admin') return true;
  return false;
};

export const canEditCase = (p?: Profile | null, caseData?: Case | null, isCollaboratorEditor: boolean = false) => {
  if (!p || !caseData) return false;
  if (caseData.status !== 'open') return false;
  if (caseData.owner_id === p.id) return true;
  if (isCollaboratorEditor) return true;
  return false;
}

export const canApproveWarrant = (p?: Profile | null) => {
  if (!p) return false;
  if (p.system_role === 'admin') return true;
  if (isSupervisory(p) || isHighCommand(p)) return true;
  if (isInvestigatorIII(p)) return true;
  return false;
};

export const getDepartmentLabel = (div: string) => {
  switch (div) {
    case 'TSB':
      return 'Field Staff';
    case 'SEB':
      return 'Special Enforcement Bureau';
    case 'MCB':
      return 'Major Crimes Bureau';
    default:
      return div;
  }
};