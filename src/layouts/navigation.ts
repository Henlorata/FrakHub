import {
  Banknote, Bell, Calculator, ClipboardList, FileText, Fingerprint, GraduationCap, LayoutDashboard, Truck, Users,
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
    ],
  },
  {
    label: "Operatív",
    items: [
      {label: "Nyomozó Iroda", path: "/mcb", icon: Fingerprint, keywords: "mcb akta gyanúsított körözés", visible: canViewCaseList},
      {label: "Logisztika", path: "/logistics", icon: Truck, keywords: "jármű igénylés"},
      {label: "Pénzügy", path: "/finance", icon: Banknote, keywords: "költségtérítés pénz"},
    ],
  },
  {
    label: "Oktatás",
    items: [
      {label: "Akadémia", path: "/academy", icon: GraduationCap, keywords: "tananyag képzés"},
      {label: "Vizsgaközpont", path: "/exams", icon: ClipboardList, keywords: "vizsga teszt javítás"},
    ],
  },
  {
    label: "Eszközök",
    items: [
      {label: "Büntető kalkulátor", path: "/calculator", icon: Calculator, keywords: "btk bírság kalkulátor"},
      {label: "Jelentések", path: "/reports", icon: FileText, keywords: "jelentés riport"},
    ],
  },
  {
    label: "Adminisztráció",
    items: [
      {label: "Személyügy", path: "/hr", icon: Users, keywords: "hr állomány előléptetés rang"},
    ],
  },
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
  if (pathname.startsWith("/mcb/suspects")) return "Gyanúsítottak";
  if (pathname.startsWith("/mcb/admin")) return "MCB adminisztráció";
  if (pathname.startsWith("/logistics/fleet/")) return "Jármű";
  const match = NAV_SECTIONS.flatMap((section) => section.items)
    .filter((item) => pathname.startsWith(item.path))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return match?.label ?? "SFSD Intranet";
};
