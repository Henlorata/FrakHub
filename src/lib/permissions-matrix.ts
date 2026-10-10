import {
  calculateSystemRole, getAllowedPromotionRanks, getRankPriority, isAcademyInstructor, isExecutive, isHighCommand, isStaff, TRAINEE_RANK,
  type FactionRank,
} from "@shared/ranks";
import {canApproveWarrants, isMcbLead, seesAllCases} from "@/lib/mcb";
import {organisableAudiences} from "@/lib/events";
import {canEditSite} from "@/lib/site";
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
  {key: "trainee", label: "Trainee", hint: "Deputy Sheriff Trainee", profile: person(TRAINEE_RANK)},
  {key: "member", label: "Field Staff", hint: "Deputy Sheriff I.–Corporal", profile: person("Deputy Sheriff II.")},
  {key: "instructor", label: "Kiképző", hint: "TB képesítéssel", profile: person("Senior Deputy Sheriff", {qualifications: ["TB"]})},
  {key: "investigator", label: "Investigator", hint: "MCB, Investigator I–II.", profile: person("Deputy Sheriff III.", {division: "MCB", division_rank: "Investigator II."})},
  {key: "unit_lead", label: "Egységvezető", hint: "pl. SAHP vezető", profile: person("Senior Deputy Sheriff", {qualifications: ["SAHP"], commanded_divisions: ["SAHP"]})},
  {key: "supervisor", label: "Supervisory Staff", hint: "Sergeant I–II.", profile: person("Sergeant I.")},
  {key: "command", label: "Command Staff", hint: "Lieutenant–Captain", profile: person("Captain II.")},
  {key: "executive", label: "Executive Staff", hint: "Deputy Commander, Commander", profile: person("Commander")},
  {key: "bureau_commander", label: "Bureau Commander", hint: "Egy osztály parancsnoka", profile: person("Lieutenant I.", {division: "SEB", is_bureau_commander: true})},
  {key: "manager", label: "Bureau Manager", hint: "Az állomány vezetője", profile: person("Lieutenant I.", {is_bureau_manager: true})},
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
  if (audiences.includes("all")) return "a Command Staff kivételével";
  return audiences.length ? "saját egység" : false;
}

const executiveOrManager = (profile: Profile) => isExecutive(profile) || !!profile.is_bureau_manager;
/** private.is_admin(): high command (system role admin) or the bureau manager. */
const adminOrManager = (profile: Profile) => profile.system_role === "admin" || !!profile.is_bureau_manager;
/** Who reads the public page's reports: private.mail_group_member() for iab, mcb and command. */
const publicReports = (profile: Profile): Capability => {
  const kinds = [
    (profile.iab_title || profile.is_bureau_manager) && "panasz",
    profile.division === "MCB" && "bejelentés",
    (isHighCommand(profile) || profile.is_bureau_manager) && "kérdés",
  ].filter((kind): kind is string => !!kind);
  return kinds.length === 3 ? true : kinds.length ? kinds.join(", ") : false;
};

export const MATRIX: MatrixGroup[] = [
  {
    title: "Személyügy",
    rows: [
      {label: "Az állomány, a duty idők és a szervezeti ábra", check: () => true},
      {label: "Regisztrációk és szabadságkérelmek elbírálása", check: isStaff},
      {label: "Rangváltás", hint: "A saját rangod felett senkiét", check: promotionRange},
      {label: "Előléptetési javaslat", check: isStaff},
      {label: "Javaslat elbírálása", hint: "A Command Staff Sergeant II.-ig, az Executive Staff mindig",
        check: (profile) => executiveOrManager(profile) ? true : isHighCommand(profile) ? "Sergeant II.-ig" : false},
      {label: "Figyelmeztetés, dicséret, feljegyzés", hint: "Az alacsonyabb rangúaknak", check: isStaff},
      {label: "Kitüntetési okirat nyomtatása", hint: "A sajátodat mindig", check: (profile) => isStaff(profile) ? true : "a sajátodat"},
      {label: "Teljesítményértékelés írása", hint: "Negyedévente, az alacsonyabb rangúakról; a tag a sajátját olvassa és visszaigazolja",
        check: (profile) => isStaff(profile) ? "alacsonyabb rangúakról" : false},
      {label: "Mentor kijelölése, Trainee jóváhagyása", hint: "A mentor a saját Trainee-jét hagyja jóvá",
        check: (profile) => isStaff(profile) || isAcademyInstructor(profile) ? true : profile.faction_rank === TRAINEE_RANK ? false : "ha mentor vagy"},
      {label: "Aktivitásfigyelő, munkamegosztás, toborzás", check: isStaff},
      {label: "Osztályrangok és címek (pl. Medic)", hint: "A Bureau Commander a saját osztályán",
        check: (profile) => profile.is_bureau_manager ? true : profile.is_bureau_commander ? "saját osztály" : false},
      {label: "Jelszó, kétlépcsős azonosítás visszaállítása", hint: "Elfelejtett jelszó, elveszett telefon; Bureau Managerét csak ő", check: isExecutive},
    ],
  },
  {
    title: "Járőrszolgálat",
    rows: [
      {label: "BOLO kiadása, eligazítás, rendszámkeresés", hint: "A személyeket a rendszámkereső csak az akták olvasóinak mutatja", check: () => true},
      {label: "BOLO lezárása, meghosszabbítása", hint: "A sajátodat mindig", check: (profile) => isStaff(profile) ? true : "a sajátodat"},
      {label: "Statisztika (bírságok, letartóztatások)", check: () => true},
      {label: "Jelentések olvasása", hint: "Mindenki mindenkiét, mint a fórumon", check: () => true},
      {label: "Jelentés javítása, törlése", hint: "A hónap kifizetéséig", check: () => "a sajátodat"},
      {label: "Jelentés érvénytelenítése", hint: "Nem számít bele a havi számba; a szerzője értesítést kap", check: isStaff},
    ],
  },
  {
    title: "Nyomozó Iroda",
    rows: [
      {label: "Az akták listája", check: canViewCaseList},
      {label: "Bármely akta megnyitása", hint: "Máskülönben: a saját és a közös akták", check: (profile) => canViewCaseList(profile) ? (seesAllCases(profile) ? true : "ahol tag vagy") : false},
      {label: "Parancs jóváhagyása és megújítása", hint: "A sajátodat soha", check: canApproveWarrants},
      {label: "Informátorok", check: (profile) => isMcbLead(profile) ? true : profile.division === "MCB" ? "a kezeltjeid" : false},
      {label: "Bűnszervezetek, tagok, hírszerzési napló", hint: "Szervezetet törölni az MCB vezetése tud",
        check: (profile) => canViewCaseList(profile) ? (isMcbLead(profile) ? true : "törlés nélkül") : false},
      {label: "Kapcsolati háló", hint: "Személyek, szervezetek, akták, rendszámok és címek", check: canViewCaseList},
      {label: "Akta lomtárba helyezése, visszaállítása", hint: "30 napig visszaállítható, utána véglegesen törlődik",
        check: (profile) => canViewCaseList(profile) ? (isMcbLead(profile) ? true : "a sajátodat") : false},
      {label: "Aktasablonok, parancsok érvényessége", check: isMcbLead},
    ],
  },
  {
    title: "Levelezés és belső vizsgálatok",
    rows: [
      {label: "Levél tagoknak és csoportcímeknek", hint: "Pl. internal.affairs.bureau@sfsd.org, command.staff@sfsd.org", check: () => true},
      {label: "Körlevél a teljes állománynak, külső levél rögzítése", hint: "Az IAB és a SIB tagjai is",
        check: (profile) => isStaff(profile) ? true : profile.iab_title ? "IAB tagként"
          : profile.qualifications?.includes("SIB") || profile.commanded_divisions?.includes("SIB") ? "SIB tagként" : false},
      {label: "Belső vizsgálatok (IAB)", hint: "Az IAB tagjai és a Bureau Manager; a vizsgált tag a saját ügyét nem látja",
        check: (profile) => !!profile.is_bureau_manager || (profile.iab_title ? "IAB tagként" : false)},
      {label: "Levél olvasottsága", hint: "A levél írói; a teljes állománynak szólóknál a staff, az IAB és a SIB is", check: () => "a saját leveleidnél"},
      {label: "Közös levélsablonok", hint: "Saját sablont mindenki készíthet",
        check: (profile) => isStaff(profile) ? true : profile.iab_title ? "IAB tagként"
          : profile.qualifications?.includes("SIB") || profile.commanded_divisions?.includes("SIB") ? "SIB tagként" : false},
      {label: "Bejelentések a nyilvános oldalról", hint: "Panasz: az IAB (amíg nincs állománya, a Bureau Manager); bejelentés: az MCB; kérdés: a vezetőség",
        check: publicReports},
      {label: "Az IAB állományának kezelése", hint: "Az IAB Sheriffje és Assistant Sheriffje is",
        check: (profile) => !!profile.is_bureau_manager || isExecutive(profile) || profile.iab_title === "sheriff" || profile.iab_title === "assistant_sheriff"},
    ],
  },
  {
    title: "Események és közösség",
    rows: [
      {label: "Esemény és szavazás indítása", check: eventAudiences},
      {label: "Jelenlét rögzítése", hint: "A saját eseményein", check: (profile) => eventAudiences(profile) !== false},
      {label: "Műveleti terv és értékelés", hint: "A saját eseményein; az esemény közönsége olvassa", check: (profile) => eventAudiences(profile) !== false},
      {label: "Szabályzatok szerkesztése és közzététele", check: adminOrManager},
      {label: "Válasz az ötletekre", check: adminOrManager},
      {label: "Névtelen visszajelzések olvasása", hint: "A Bureau Managernek szólókat csak ő", check: (profile) => !!profile.is_bureau_manager || isHighCommand(profile)},
      {label: "Visszaélő beküldő tiltása", hint: "Hogy ki az, ekkor sem derül ki", check: executiveOrManager},
      {label: "Hírek és a nyilvános főoldal (Sajtóiroda)", hint: "A SIB tagjai és vezetője is", check: canEditSite},
    ],
  },
  {
    title: "Pénzügy és logisztika",
    rows: [
      {label: "Költségtérítés és járműigénylés beadása", check: () => true},
      {label: "Költségtérítés elbírálása", check: adminOrManager},
      {label: "Havi bérlap, kifizetés", check: executiveOrManager},
      {label: "Fizetési papír nyomtatása", hint: "A lezárt hónapokból", check: (profile) => executiveOrManager(profile) ? true : "a sajátodat"},
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
