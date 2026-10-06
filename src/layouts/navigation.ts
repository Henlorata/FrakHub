import {
  Award, Banknote, Bell, BookCheck, BrainCircuit, Calculator, CalendarDays, ClipboardList, FileText, Fingerprint, GraduationCap, KeyRound,
  LayoutDashboard, Radio, Sparkles, Trophy, Truck, User, Users, UsersRound,
  type LucideIcon,
} from "lucide-react";
import {canViewCaseList} from "@/lib/utils";
import type {Profile} from "@/types/supabase";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  /** Extra words the command palette matches. */
  keywords?: string;
  visible?: (profile: Profile) => boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Áttekintés",
    items: [
      {label: "Irányítópult", path: "/dashboard", icon: LayoutDashboard, keywords: "dashboard főoldal kezdőlap"},
      {label: "Értesítések", path: "/notifications", icon: Bell, keywords: "üzenetek értesítés"},
      {label: "Események", path: "/events", icon: CalendarDays, keywords: "naptár gyűlés képzés esemény jelentkezés program"},
    ],
  },
  {
    label: "Operatív",
    items: [
      {label: "Nyomozó Iroda", path: "/mcb", icon: Fingerprint, keywords: "mcb akta gyanúsított körözés nyilvántartás parancs elfogató házkutatás", visible: canViewCaseList},
      {label: "Logisztika", path: "/logistics", icon: Truck, keywords: "jármű igénylés"},
      {label: "Pénzügy", path: "/finance", icon: Banknote, keywords: "költségtérítés pénz fizetés havi fizetés bér"},
    ],
  },
  {
    label: "Oktatás",
    items: [
      {label: "Akadémia", path: "/academy", icon: GraduationCap, keywords: "tananyag képzés"},
      {label: "Vizsgaközpont", path: "/exams", icon: ClipboardList, keywords: "vizsga teszt javítás"},
      {label: "Gyakorlás", path: "/practice", icon: BrainCircuit, keywords: "gyakorlás kártya rádiókód btk szituáció sorozat ismétlés kvíz"},
    ],
  },
  {
    label: "Eszközök",
    items: [
      {label: "Büntető kalkulátor", path: "/calculator", icon: Calculator, keywords: "btk bírság kalkulátor"},
      {label: "Jelentések", path: "/reports", icon: FileText, keywords: "jelentés riport fórum napló bbcode"},
      {label: "Kódtár", path: "/codes", icon: Radio, keywords: "rádió kód 10-es kódok fónia hívójel egységjel"},
    ],
  },
  {
    label: "Közösség",
    items: [
      {label: "Szabályzatok", path: "/policies", icon: BookCheck, keywords: "szabályzat szabály sop elolvastam kötelező"},
      {label: "Közösség", path: "/community", icon: UsersRound, keywords: "szavazás ötlet ötletláda javaslat névtelen visszajelzés panasz"},
      {label: "Ranglista", path: "/leaderboard", icon: Trophy, keywords: "ranglista toplista verseny legjobbak"},
    ],
  },
  {
    label: "Adminisztráció",
    items: [
      {label: "Személyügy", path: "/hr", icon: Users, keywords: "hr állomány előléptetés rang trainee újonc mentor aktivitás"},
      {label: "Ki mit tehet?", path: "/permissions", icon: KeyRound, keywords: "jogosultság jog engedély szerepkör"},
    ],
  },
];

/** Pages the quick search finds that are not in the sidebar (account menu, dashboard strip). */
export const EXTRA_PAGES: NavItem[] = [
  {label: "Profilom", path: "/profile", icon: User, keywords: "profil adataim szabadság képzések jelszó"},
  {label: "Újdonságok", path: "/changelog", icon: Sparkles, keywords: "újdonság változás frissítés hírek változásnapló"},
  {label: "Okleveleim", path: "/profile?tab=certificates", icon: Award, keywords: "oklevél bizonyítvány képesítés igazolás"},
  {label: "Oklevél ellenőrzése", path: "/certificates", icon: Award, keywords: "oklevél ellenőrzés kód hiteles"},
];

export const visibleSections = (profile: Profile): NavSection[] =>
  NAV_SECTIONS
    .map((section) => ({...section, items: section.items.filter((item) => !item.visible || item.visible(profile))}))
    .filter((section) => section.items.length > 0);

/** Page title for the header, from the longest matching path. */
export const pageTitleFor = (pathname: string): string => {
  if (pathname.startsWith("/profile")) return "Profilom";
  if (pathname.startsWith("/exams/editor")) return "Vizsgaszerkesztő";
  if (pathname.startsWith("/exams/grading")) return "Vizsgalap";
  if (pathname.startsWith("/mcb/case")) return "Akta";
  if (pathname.startsWith("/mcb/suspects")) return "Bűnügyi nyilvántartás";
  if (pathname.startsWith("/mcb/warrants")) return "Parancsok";
  if (pathname.startsWith("/mcb/admin")) return "Az iroda vezetése";
  if (pathname.startsWith("/mcb/templates")) return "Aktasablonok";
  if (pathname.startsWith("/mcb/informants")) return "Informátorok";
  if (pathname.startsWith("/logistics/fleet/")) return "Jármű";
  if (pathname.startsWith("/changelog")) return "Újdonságok";
  if (pathname.startsWith("/hr/record")) return "Szolgálati lap";
  if (pathname.startsWith("/permissions")) return "Ki mit tehet?";
  const match = NAV_SECTIONS.flatMap((section) => section.items)
    .filter((item) => pathname.startsWith(item.path))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return match?.label ?? "SFSD Intranet";
};
