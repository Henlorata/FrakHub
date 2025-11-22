import {type ClassValue, clsx} from "clsx"
import {twMerge} from "tailwind-merge"
import type {Profile, FactionRank, Case} from "@/types/supabase"

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

// "High Command" = Executive + Command
export const isHighCommand = (p?: Profile | null) => isExecutive(p) || isCommand(p);

// MCB Specifikus
export const isInvestigatorIII = (p?: Profile | null) => p?.division === 'MCB' && p?.division_rank === 'Investigator III.';
export const isMcbMember = (p?: Profile | null) => p?.division === 'MCB';


// --- 1. LISTA NÉZET ---
// "Az Investigatorok lássák az összes akta létezését... Executive, Command, Supervisory szintén."
export const canViewCaseList = (p?: Profile | null) => {
  if (!p) return false;
  return isMcbMember(p) || isSupervisory(p) || isHighCommand(p) || p.system_role === 'admin';
};

// --- 2. RÉSZLETEK NÉZET (OLVASÁS) ---
export const canViewCaseDetails = (p?: Profile | null, caseData?: Case | null, isCollaborator: boolean = false) => {
  if (!p || !caseData) return false;

  // 1. SAJÁT vagy KÖZREMŰKÖDŐ (Mindenki láthatja a sajátját)
  if (caseData.owner_id === p.id || isCollaborator) return true;

  // 2. INVESTIGATOR III (Mindent láthat olvasásra)
  if (isInvestigatorIII(p)) return true;

  // 3. HIGH COMMAND (Executive / Command) (Mindent láthat olvasásra)
  // (Az admin system_role-t is idevehetjük, ha technikai adminról van szó)
  if (isHighCommand(p) || p.system_role === 'admin') return true;

  // 4. INVESTIGATOR I / II (Csak saját/collab - ez már fent lefutott az 1. pontban)
  // Ha ide eljutott és Inv I/II, akkor False.

  // 5. SUPERVISORY (Csak listát lát, részleteket NEM)
  if (isSupervisory(p)) return false;

  return false;
};

// --- 3. SZERKESZTÉS (ÍRÁS) ---
// "Ha nem Investigator, akkor nem módosíthat semmit sem... Inv III is csak saját/collab."
export const canEditCase = (p?: Profile | null, caseData?: Case | null, isCollaboratorEditor: boolean = false) => {
  if (!p || !caseData) return false;

  // Lezárt akta nem szerkeszthető (kivéve státusz váltás, de az külön gomb)
  if (caseData.status !== 'open') return false;

  // 1. TULAJDONOS
  if (caseData.owner_id === p.id) return true;

  // 2. SZERKESZTŐ JOGÚ KÖZREMŰKÖDŐ
  if (isCollaboratorEditor) return true;

  // NINCS "Admin Override"!
  // High Command / Inv III is csak olvasni tudja másét, írni nem.

  return false;
}

export const canApproveWarrant = (p?: Profile | null) => {
  if (!p) return false;
  if (p.system_role === 'admin') return true;

  // Frakció vezetés (Supervisory + Command + Executive)
  if (isSupervisory(p) || isHighCommand(p)) return true;

  // MCB speciális (Investigator III.)
  if (isInvestigatorIII(p)) return true;

  return false;
};

export const getDepartmentLabel = (div: string) => {
  switch (div) {
    case 'TSB':
      return 'Field Staff'; // Átnevezés
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
      return 'bg-green-900/40 text-green-100 border-green-700/50'; // TSB
  }
};