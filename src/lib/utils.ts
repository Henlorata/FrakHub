import {type ClassValue, clsx} from "clsx"
import {twMerge} from "tailwind-merge"
import type {Profile, FactionRank, Case} from "@/types/supabase"
import type {Exam} from "@/types/exams";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// --- RANG LISTÁK ---
const EXECUTIVE_STAFF: FactionRank[] = ['Commander', 'Deputy Commander'];
const COMMAND_STAFF: FactionRank[] = ['Captain III.', 'Captain II.', 'Captain I.', 'Lieutenant II.', 'Lieutenant I.'];
const SUPERVISORY_STAFF: FactionRank[] = ['Sergeant II.', 'Sergeant I.'];

// --- ALAP JOGOSULTSÁG ELLENŐRZŐK ---
export const isExecutive = (p?: Profile | null) => p ? EXECUTIVE_STAFF.includes(p.faction_rank) : false;
export const isCommand = (p?: Profile | null) => p ? COMMAND_STAFF.includes(p.faction_rank) : false;
export const isSupervisory = (p?: Profile | null) => p ? SUPERVISORY_STAFF.includes(p.faction_rank) : false;
export const isHighCommand = (p?: Profile | null) => isExecutive(p) || isCommand(p);

// MCB Specifikus
export const isInvestigatorIII = (p?: Profile | null) => p?.division === 'MCB' && p?.division_rank === 'Investigator III.';
export const isMcbMember = (p?: Profile | null) => p?.division === 'MCB';


// --- VIZSGA JOGOSULTSÁGOK ---

// 1. Ki hozhat létre vizsgát? (Általános gomb)
export const canCreateAnyExam = (p?: Profile | null) => {
  if (!p) return false;
  return p.is_bureau_manager || p.is_bureau_commander || (p.commanded_divisions && p.commanded_divisions.length > 0);
};

// 2. Ki SZERKESZTHET/TÖRÖLHET egy KONKRÉT vizsgát?
export const canManageExam = (p: Profile, exam: Exam) => {
  // Bureau Manager: Mindenhez hozzáfér
  if (p.is_bureau_manager) return true;

  // Speciális vizsgák (TGF, Deputy I): CSAK Bureau Manager szerkesztheti!
  if (exam.type === 'trainee' || exam.type === 'deputy_i') return false;

  // Osztály specifikus:
  // Bureau Commander: Csak a saját osztálya
  if (p.is_bureau_commander && p.division === exam.division) return true;

  // Division Commander: Csak a vezetett képesítések
  if (p.commanded_divisions?.includes(exam.division as any)) return true;

  return false;
};

// 3. Ki ÉRTÉKELHET egy beadott vizsgát?
export const canGradeExam = (p: Profile, exam: Exam) => {
  // Aki szerkesztheti, az értékelheti is
  if (canManageExam(p, exam)) return true;

  // KIVÉTELEK: Trainee és Deputy I vizsgáknál bővebb a javítók köre
  if (exam.type === 'trainee' || exam.type === 'deputy_i') {
    // TB tagok
    if (p.qualifications?.includes('TB')) return true;
    // Supervisory Staff (Sgt I, Sgt II)
    if (isSupervisory(p)) return true;
    // Executive / Command Staff
    if (isHighCommand(p)) return true;
  }

  // Divízió specifikusnál a Bureau Commander akkor is javíthat, ha nem ő hozta létre
  // (Bár a canManageExam ezt már lefedi, de a biztonság kedvéért)
  if (p.is_bureau_commander && p.division === exam.division) return true;

  return false;
};

// --- EGYÉB JOGOSULTSÁGOK (MCB, stb.) ---

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