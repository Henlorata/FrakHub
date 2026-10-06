import {
  calculateSystemRole, getAllowedPromotionRanks, getRankPriority, isAcademyInstructor, isExecutive, isHighCommand, isStaff, TRAINEE_RANK,
  type FactionRank,
} from "@shared/ranks";
import {canApproveWarrants, isMcbLead, seesAllCases} from "@/lib/mcb";
import {organisableAudiences} from "@/lib/events";
import {canCreateAnyExam, canViewCaseList} from "@/lib/utils";
import type {Profile} from "@/types/supabase";

/**
 * "Who can do what" on the site, computed from the same permission helpers the pages use (and the
 * database mirrors), so the table never drifts from the real rules.
 */

/** A cell: allowed, not allowed, or a short qualifier ("Corporal-ig", "saját egység"). */
export type Capability = boolean | string;

export interface MatrixRow {
  label: string;
  hint?: string;
  check: (profile: Profile) => Capability;
}

export interface MatrixGroup {
  title: string;
  rows: MatrixRow[];
}

export interface MatrixRole {
  key: string;
  label: string;
  hint: string;
  profile: Profile;
}

const person = (rank: FactionRank, extra: Partial<Profile> = {}): Profile => ({
  id: `sample-${rank}`, full_name: rank, badge_number: "0000", faction_rank: rank, division: "TSB", system_role: calculateSystemRole(rank),
  created_at: "2026-01-01T00:00:00Z", qualifications: [], commanded_divisions: [], ...extra,
});

export const MATRIX_ROLES: MatrixRole[] = [
  {key: "trainee", label: "Újonc", hint: "Deputy Sheriff Trainee", profile: person(TRAINEE_RANK)},
  {key: "member", label: "Tag", hint: "Deputy Sheriff I.–Corporal", profile: person("Deputy Sheriff II.")},
  {key: "instructor", label: "Kiképző", hint: "TB képesítéssel", profile: person("Senior Deputy Sheriff", {qualifications: ["TB"]})},
  {key: "investigator", label: "Nyomozó", hint: "MCB, Investigator I–II.", profile: person("Deputy Sheriff III.", {division: "MCB", division_rank: "Investigator II."})},
  {key: "unit_lead", label: "Egységvezető", hint: "pl. SAHP vezető", profile: person("Senior Deputy Sheriff", {qualifications: ["SAHP"], commanded_divisions: ["SAHP"]})},
  {key: "supervisor", label: "Felügyelő", hint: "Sergeant I–II.", profile: person("Sergeant I.")},
  {key: "command", label: "Parancsnokság", hint: "Lieutenant–Captain", profile: person("Captain II.")},
  {key: "executive", label: "Vezérkar", hint: "Deputy Commander, Commander", profile: person("Commander")},
  {key: "manager", label: "Irodavezető", hint: "Bureau Manager", profile: person("Lieutenant I.", {is_bureau_manager: true})},
];

/** The highest rank `profile` may give ("Corporal-ig"), or false. */
function promotionRange(profile: Profile): Capability {
  const ranks = getAllowedPromotionRanks(profile);
  if (ranks.length === 0) return false;
  const top = [...ranks].sort((a, b) => getRankPriority(a) - getRankPriority(b))[0];
  if (top === "Commander") return "bármely rang";
  return `${top}-ig`;
}

function eventAudiences(profile: Profile): Capability {
  const audiences = organisableAudiences(profile);
  if (audiences.includes("command")) return true;
  if (audiences.includes("all")) return "parancsnokságon kívül";
  return audiences.length ? "saját egység" : false;
}

const executiveOrManager = (profile: Profile) => isExecutive(profile) || !!profile.is_bureau_manager;
/** private.is_admin(): high command (system role admin) or the bureau manager. */
const adminOrManager = (profile: Profile) => profile.system_role === "admin" || !!profile.is_bureau_manager;

export const MATRIX: MatrixGroup[] = [
  {
    title: "Személyügy",
    rows: [
      {label: "Az állomány, a duty idők és a szervezeti ábra", check: () => true},
      {label: "Regisztrációk és szabadságkérelmek elbírálása", check: isStaff},
      {label: "Rangváltás", hint: "A saját rangod felett senkiét", check: promotionRange},
      {label: "Előléptetési javaslat", check: isStaff},
      {label: "Javaslat elbírálása", hint: "A parancsnokság Sergeant II.-ig, a vezérkar mindig",
        check: (profile) => executiveOrManager(profile) ? true : isHighCommand(profile) ? "Sergeant II.-ig" : false},
      {label: "Figyelmeztetés, dicséret, feljegyzés", hint: "Az alacsonyabb rangúaknak", check: isStaff},
      {label: "Mentor kijelölése, újonc jóváhagyása", hint: "A mentor a saját újoncát hagyja jóvá",
        check: (profile) => isStaff(profile) || isAcademyInstructor(profile) ? true : profile.faction_rank === TRAINEE_RANK ? false : "ha mentor vagy"},
      {label: "Aktivitásfigyelő, munkamegosztás, toborzás", check: isStaff},
    ],
  },
  {
    title: "Nyomozó Iroda",
    rows: [
      {label: "Az akták listája", check: canViewCaseList},
      {label: "Bármely akta megnyitása", hint: "Máskülönben: a saját és a közös akták", check: (profile) => canViewCaseList(profile) ? (seesAllCases(profile) ? true : "ahol tag vagy") : false},
      {label: "Parancs jóváhagyása és megújítása", hint: "A sajátodat soha", check: canApproveWarrants},
      {label: "Informátorok", check: (profile) => isMcbLead(profile) ? true : profile.division === "MCB" ? "a kezeltjeid" : false},
      {label: "Aktasablonok, parancsok érvényessége", check: isMcbLead},
    ],
  },
  {
    title: "Események és közösség",
    rows: [
      {label: "Esemény és szavazás indítása", check: eventAudiences},
      {label: "Jelenlét rögzítése", hint: "A saját eseményein", check: (profile) => eventAudiences(profile) !== false},
      {label: "Szabályzatok szerkesztése és közzététele", check: adminOrManager},
      {label: "Válasz az ötletekre", check: adminOrManager},
      {label: "Névtelen visszajelzések olvasása", hint: "Az irodavezetőnek szólókat csak ő", check: (profile) => !!profile.is_bureau_manager || isHighCommand(profile)},
      {label: "Visszaélő beküldő tiltása", hint: "Hogy ki az, ekkor sem derül ki", check: executiveOrManager},
    ],
  },
  {
    title: "Pénzügy és logisztika",
    rows: [
      {label: "Költségtérítés és járműigénylés beadása", check: () => true},
      {label: "Költségtérítés elbírálása", check: adminOrManager},
      {label: "Havi bérlap, kifizetés", check: executiveOrManager},
      {label: "Fizetési táblázat", check: (profile) => profile.faction_rank === "Commander" || !!profile.is_bureau_manager},
      {label: "Járműkulcsok kiosztása", hint: "Egységvezető: a saját egysége kategóriáiban",
        check: (profile) => isStaff(profile) ? true : profile.commanded_divisions?.length ? "saját egység" : false},
    ],
  },
  {
    title: "Oktatás",
    rows: [
      {label: "Tananyag és szituációs gyakorlat szerkesztése", check: isAcademyInstructor},
      {label: "Vizsga készítése", check: canCreateAnyExam},
      {label: "Gyakorlás, oklevelek, ranglista", check: () => true},
    ],
  },
];
