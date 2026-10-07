import {
  Award, Banknote, BarChart3, Bell, BookCheck, BrainCircuit, Calculator, CalendarDays, ClipboardList, FileText, Fingerprint, GraduationCap, KeyRound,
  Globe, LayoutDashboard, Mail, Megaphone, Radar, Radio, Scale, Sparkles, Trophy, Truck, User, Users, UsersRound,
  type LucideIcon,
} from "lucide-react";
import {canViewCaseList} from "@/lib/utils";
import {canSeeIab} from "@/lib/iab";
import {canEditSite} from "@/lib/site";
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
      {label: "Eligazítás", path: "/briefing", icon: Radar, keywords: "eligazítás bolo körözés lopott jármű körözött személy szolgálat járőr"},
      {label: "Értesítések", path: "/notifications", icon: Bell, keywords: "üzenetek értesítés"},
      {label: "Levelezés", path: "/mail", icon: Mail, keywords: "levél levelezés email posta üzenet public mails körlevél iab panasz"},
      {label: "Események", path: "/events", icon: CalendarDays, keywords: "naptár gyűlés képzés esemény jelentkezés program"},
      {label: "Statisztika", path: "/stats", icon: BarChart3, keywords: "statisztika bírság letartóztatás intézkedés grafikon számok trend"},
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
      {label: "Sajtóiroda", path: "/sib", icon: Megaphone, keywords: "sib hírek sajtó közlemény főoldal nyilvános oldal galéria toborzás", visible: canEditSite},
    ],
  },
  {
    label: "Adminisztráció",
    items: [
      {label: "Személyügy", path: "/hr", icon: Users, keywords: "hr állomány előléptetés rang trainee újonc mentor aktivitás"},
      {label: "Belső vizsgálatok", path: "/iab", icon: Scale, keywords: "iab internal affairs belső vizsgálat panasz fegyelmi", visible: canSeeIab},
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
  {label: "Nyilvános főoldal", path: "/home", icon: Globe, keywords: "főoldal nyilvános oldal hírek bemutatkozás toborzás weboldal"},
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
  if (pathname.startsWith("/mcb/organizations")) return "Bűnszervezetek";
  if (pathname.startsWith("/logistics/fleet/")) return "Jármű";
  if (pathname.startsWith("/changelog")) return "Újdonságok";
  if (pathname.startsWith("/hr/record")) return "Szolgálati lap";
  if (pathname.startsWith("/permissions")) return "Ki mit tehet?";
  const match = NAV_SECTIONS.flatMap((section) => section.items)
    .filter((item) => pathname.startsWith(item.path))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return match?.label ?? "SFSD Intranet";
};
