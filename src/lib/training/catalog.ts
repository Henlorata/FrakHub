import {
  Briefcase, Crown, Fingerprint, GraduationCap, Landmark, Compass, ShieldCheck, Star, type LucideIcon,
} from "lucide-react";
import {isAcademyInstructor, isExecutive, isHighCommand, isStaff} from "@shared/ranks";
import {canViewCaseList} from "@/lib/utils";
import type {Profile} from "@/types/supabase";

export type TrainingId =
  | "basic" | "mcb" | "supervisor" | "instructor" | "command" | "executive" | "bureau_commander" | "bureau_manager";

export interface TrainingInfo {
  id: TrainingId;
  title: string;
  /** One sentence for the profile page and the intro card. */
  summary: string;
  /** Who gets it (shown on locked trainings). */
  requirement: string;
  icon: LucideIcon;
  /** Tailwind colour family of the training's look. */
  tone: "gold" | "blue" | "violet" | "cyan" | "red" | "amber" | "emerald" | "rose";
  minutes: number;
  /** Raise when the content changes enough that everyone should see it again. */
  version: number;
  eligible: (profile: Profile) => boolean;
}

const leadsDivision = (profile: Profile) => !!profile.is_bureau_commander || (profile.commanded_divisions?.length ?? 0) > 0;

/** In the order they play: a new Commander gets them one after the other. */
export const TRAININGS: readonly TrainingInfo[] = [
  {
    id: "basic", title: "Alapképzés", icon: Compass, tone: "gold", minutes: 7, version: 1,
    summary: "Körbevezet az oldalon: menü, kereső, értesítések, kalkulátor, jelentések, járművek, pénzügy, akadémia, vizsgák, gyakorlás, események, kódtár, szabályzatok, levelezés és az aláírásod.",
    requirement: "Minden tagnak", eligible: () => true,
  },
  {
    id: "mcb", title: "Nyomozó Iroda", icon: Fingerprint, tone: "blue", minutes: 5, version: 1,
    summary: "Akták, dokumentumszerkesztő, bizonyítékok, személyek, körözések, parancsok és teendők az MCB felületén.",
    requirement: "MCB-tagoknak, valamint Supervisory Staff és felette", eligible: (profile) => canViewCaseList(profile),
  },
  {
    id: "supervisor", title: "Supervisory Staff képzés", icon: ShieldCheck, tone: "violet", minutes: 5, version: 1,
    summary: "Állomány kezelése, előléptetés, Trainee-k, figyelmeztetések, kérelmek, vizsgajavítás és a havi összesítők.",
    requirement: "Supervisory Staff (Sergeant I. rangtól)", eligible: (profile) => isStaff(profile),
  },
  {
    id: "instructor", title: "Oktatói képzés", icon: GraduationCap, tone: "cyan", minutes: 3, version: 1,
    summary: "Tananyagok szerkesztése az Akadémián, az alapképzés turnusai és a vizsgák javítása.",
    requirement: "TB képesítéssel vagy Supervisory Staff és felette", eligible: (profile) => isAcademyInstructor(profile),
  },
  {
    id: "command", title: "Command Staff képzés", icon: Star, tone: "red", minutes: 4, version: 1,
    summary: "Készültségi szint, hirdetmények, előléptetések és elbocsátás, a flotta, a pénzügyek, az akták és a nyilvános főoldal hírei.",
    requirement: "Command Staff (Lieutenant I. rangtól)", eligible: (profile) => isHighCommand(profile),
  },
  {
    id: "executive", title: "Executive Staff képzés", icon: Crown, tone: "amber", minutes: 4, version: 1,
    summary: "Havi fizetés, kassza, pénzügyi áttekintés és a kitüntetések.",
    requirement: "Executive Staff (Deputy Commander és Commander)", eligible: (profile) => isExecutive(profile),
  },
  {
    id: "bureau_commander", title: "Bureau Commander képzés", icon: Briefcase, tone: "emerald", minutes: 3, version: 1,
    summary: "A vezetett divízió vagy alegység tagjai, képesítései, járművei, tananyagai és vizsgái.",
    requirement: "Bureau Commandereknek és az alegységek vezetőinek", eligible: leadsDivision,
  },
  {
    id: "bureau_manager", title: "Bureau Manager képzés", icon: Landmark, tone: "rose", minutes: 3, version: 1,
    summary: "A Bureau Manager teljes jogkörei: Bureau Commanderek kinevezése, fizetés, belső vizsgálatok és minden beállítás.",
    requirement: "A Bureau Managernek", eligible: (profile) => !!profile.is_bureau_manager,
  },
];

export const trainingById = (id: string) => TRAININGS.find((training) => training.id === id);

/** Trainings a member may play: active members after the onboarding of trainees. */
export const eligibleTrainings = (profile: Profile | null | undefined): TrainingInfo[] => {
  if (!profile || profile.system_role === "pending") return [];
  if (profile.faction_rank === "Deputy Sheriff Trainee" && !profile.onboarding_completed) return [];
  return TRAININGS.filter((training) => training.eligible(profile));
};

export const TONE_STYLES: Record<TrainingInfo["tone"], {text: string; tile: string; bar: string; ring: string; rgb: string}> = {
  gold: {text: "text-yellow-300", tile: "bg-yellow-500/10 text-yellow-300 ring-yellow-500/30", bar: "from-yellow-300 to-amber-500", ring: "ring-yellow-400/60", rgb: "250 204 21"},
  blue: {text: "text-sky-300", tile: "bg-sky-500/10 text-sky-300 ring-sky-500/30", bar: "from-sky-300 to-blue-600", ring: "ring-sky-400/60", rgb: "56 189 248"},
  violet: {text: "text-violet-300", tile: "bg-violet-500/10 text-violet-300 ring-violet-500/30", bar: "from-violet-300 to-purple-600", ring: "ring-violet-400/60", rgb: "167 139 250"},
  cyan: {text: "text-cyan-300", tile: "bg-cyan-500/10 text-cyan-300 ring-cyan-500/30", bar: "from-cyan-300 to-teal-600", ring: "ring-cyan-400/60", rgb: "34 211 238"},
  red: {text: "text-red-300", tile: "bg-red-500/10 text-red-300 ring-red-500/30", bar: "from-red-300 to-rose-600", ring: "ring-red-400/60", rgb: "248 113 113"},
  amber: {text: "text-amber-300", tile: "bg-amber-500/10 text-amber-300 ring-amber-500/30", bar: "from-amber-200 to-orange-500", ring: "ring-amber-400/60", rgb: "251 191 36"},
  emerald: {text: "text-emerald-300", tile: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30", bar: "from-emerald-300 to-teal-600", ring: "ring-emerald-400/60", rgb: "52 211 153"},
  rose: {text: "text-rose-300", tile: "bg-rose-500/10 text-rose-300 ring-rose-500/30", bar: "from-rose-300 to-pink-600", ring: "ring-rose-400/60", rgb: "251 113 133"},
};
