import {type ClassValue, clsx} from "clsx"
import {twMerge} from "tailwind-merge"
import {FACTION_RANKS, type FactionRank, type Profile} from "@/types/supabase"
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


// 1. Ki szerkesztheti a másikat? (Név, Jelvény, Adatlap megnyitása)
export const canEditUser = (editor: Profile, target: Profile): boolean => {
  // Bureau Manager mindent vihet
  if (editor.is_bureau_manager) return true;

  // Saját magát senki ne szerkessze itt (arra ott a profil) - vagy ha igen, akkor return true
  if (editor.id === target.id) return false;

  const editorRankIdx = getRankPriority(editor.faction_rank);
  const targetRankIdx = getRankPriority(target.faction_rank);

  // Executive Staff: Bárkit szerkeszthet (kivéve Bureau Managert, ha ők nem azok)
  if (isExecutive(editor)) {
    return !target.is_bureau_manager;
  }

  // Command Staff: Csak Command Staff ALATT (Supervisory és lefelé)
  // Tehát target index > Lieutenant I. indexe
  if (isCommand(editor)) {
    const lowestCommandIdx = getRankPriority('Lieutenant I.');
    return targetRankIdx > lowestCommandIdx;
  }

  // Supervisory Staff: Csak Corporalig (Corporal és lefelé)
  if (isSupervisory(editor)) {
    const corporalIdx = getRankPriority('Corporal');
    return targetRankIdx >= corporalIdx;
  }

  // TB Staff (Training Bureau): Csak Trainee-t szerkeszthet (és csak előléptetésre, de itt az edit jogot nézzük)
  if (editor.qualifications?.includes('TB') && target.faction_rank === 'Deputy Sheriff Trainee') {
    return true;
  }

  return false;
};

// 2. Milyen rangra léptethet elő a felhasználó?
// Visszaadja az engedélyezett rangokat a legördülőhöz
export const getAllowedPromotionRanks = (editor: Profile): FactionRank[] => {
  if (editor.is_bureau_manager) return [...FACTION_RANKS];

  if (isExecutive(editor)) {
    // Executive mindent adhat, kivéve Bureau Manager specifikus dolgokat (de rangot igen)
    return [...FACTION_RANKS];
  }

  if (isCommand(editor)) {
    // Command Staff alattig (Supervisory-tól lefelé)
    const sergeantII_Idx = getRankPriority('Sergeant II.');
    return FACTION_RANKS.slice(sergeantII_Idx);
  }

  if (isSupervisory(editor)) {
    // Corporalig (Corporal-tól lefelé)
    const corporalIdx = getRankPriority('Corporal');
    return FACTION_RANKS.slice(corporalIdx);
  }

  if (editor.qualifications?.includes('TB')) {
    // TB Staff: Csak Deputy Sheriff I. és Trainee
    return ['Deputy Sheriff I.', 'Deputy Sheriff Trainee'];
  }

  return [];
};

// 3. Ki adhat kitüntetést?
export const canAwardRibbon = (editor: Profile) => {
  return editor.is_bureau_manager || isExecutive(editor);
}

// 4. Ki jelölhet ki parancsnokokat? (Division Commander, Bureau Commander)
export const canManageCommanders = (editor: Profile) => {
  return !!editor.is_bureau_manager;
}

// --- VIZSGA JOGOSULTSÁGOK ---

// Rang segéd: Minél kisebb a szám, annál magasabb a rang (0 = Commander)
export const getRankPriority = (rank: FactionRank | string | null | undefined): number => {
  if (!rank) return 999;
  const index = FACTION_RANKS.indexOf(rank as FactionRank);
  return index === -1 ? 999 : index;
}

// Vizsga TARTALMI szerkesztése (Editor)
export const canManageExamContent = (user: Profile, exam: Exam) => {
  if (user.is_bureau_manager) return true;

  // Trainee és Deputy I vizsgát csak a Bureau Manager szerkesztheti (a kérésed alapján)
  if (exam.type === 'trainee' || exam.type === 'deputy_i') return false;
  if (exam.required_rank === 'Deputy Sheriff Trainee' || exam.required_rank === 'Deputy Sheriff I.') return false;

  // Egyébként Division Commander vagy Bureau Commander
  if (user.is_bureau_commander) return true;
  return !!(exam.division && user.commanded_divisions?.includes(exam.division));
}

// Vizsga létrehozása (Új gomb)
export const canCreateAnyExam = (user: Profile) => {
  return user.is_bureau_manager || user.is_bureau_commander || (user.commanded_divisions && user.commanded_divisions.length > 0);
}

export const canManageExamAccess = (p: Profile, exam: Exam) => {
  if (exam.type === 'trainee') {
    if (p.qualifications?.includes('TB')) return true;
    if (isSupervisory(p)) return true;
    if (p.is_bureau_manager) return true;
    if (p.is_bureau_commander) return true;
    return false;
  }

  return canManageExamContent(p, exam);
};

export const canGradeExam = (p: Profile, exam: Exam) => {
  if (canManageExamAccess(p, exam)) return true;

  if (exam.type === 'trainee') {
    if (p.qualifications?.includes('TB')) return true;
  }

  return false;
};

export const canManageExam = canManageExamContent;

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
  if (isInvestigatorIII(p)) return true;
  if (isHighCommand(p) || p.system_role === 'admin') return true;
  if (isSupervisory(p)) return false;
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

export const getDivisionColor = (div: string) => {
  switch (div) {
    case 'SEB':
      return 'bg-red-900/40 text-red-100 border-red-700/50';
    case 'MCB':
      return 'bg-blue-900/40 text-blue-100 border-blue-700/50';
    default:
      return 'bg-green-900/40 text-green-100 border-green-700/50';
  }
};