import type {Profile} from "@/types/supabase";
import type {Exam} from "@/types/exams";

export const canManageExam = (user: Profile, exam?: Exam): boolean => {
  // 1. Bureau Manager: Mindenhez hozzáfér
  if (user.is_bureau_manager) return true;

  // Új vizsga létrehozásánál (ha nincs exam átadva)
  if (!exam) {
    return user.is_bureau_commander || !!user.division_rank; // Div Cmdr is
  }

  // 2. Bureau Commander: Saját osztályához tartozó vizsgák
  if (user.is_bureau_commander && user.division === exam.division) return true;

  // 3. Division Commander: Saját képesítéséhez tartozó vizsgák
  // Feltételezzük, hogy az exam.division mezőben tároljuk a képesítést (pl. 'SEB', 'MCB')
  if (user.commanded_divisions?.includes(exam.division as any)) return true;

  return false;
};

export const canGradeExam = (user: Profile, exam: Exam): boolean => {
  // Managerek és Commanderek a saját területükön
  if (canManageExam(user, exam)) return true;

  // 4. TB és Supervisory Staff: Csak Trainee és Deputy I vizsgák
  const isTrainingStaff = user.qualifications?.includes('TB') ||
    ['Sergeant I.', 'Sergeant II.'].includes(user.faction_rank);

  if (isTrainingStaff && (exam.type === 'trainee' || exam.type === 'deputy_i')) {
    return true;
  }

  return false;
};