import {CalendarPlus, FilePlus2, Receipt, Truck, type LucideIcon} from "lucide-react";
import {canViewCaseList} from "@/lib/utils";
import type {Profile} from "@/types/supabase";

export interface QuickAction {
  label: string;
  /** Page with a query flag that opens the right dialog. */
  path: string;
  icon: LucideIcon;
  keywords?: string;
  visible?: (profile: Profile) => boolean;
}

export const QUICK_ACTIONS: QuickAction[] = [
  {label: "Új akta nyitása", path: "/mcb?new=case", icon: FilePlus2, keywords: "akta ügy mcb", visible: canViewCaseList},
  {label: "Járműigénylés", path: "/logistics?new=1", icon: Truck, keywords: "jármű autó igénylés"},
  {label: "Költségtérítési kérelem", path: "/finance?new=1", icon: Receipt, keywords: "pénz számla költség"},
  {label: "Szabadság igénylése", path: "/profile?leave=1", icon: CalendarPlus, keywords: "szabadság távollét inaktív"},
];
