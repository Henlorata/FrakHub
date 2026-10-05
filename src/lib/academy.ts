import type {LucideIcon} from "lucide-react";
import {BookOpen, Crosshair, HeartPulse, Landmark, Megaphone, Plane, School, Siren, Target, TreePine, Truck} from "lucide-react";
import type {Tone} from "@/components/layout/PageHeader";
import {supabase} from "@/lib/supabaseClient";
import {daysBetween, todayKey} from "@/lib/datetime";

export type CourseCategory = "division" | "qualification" | "other";

export interface CourseSummary {
  id: string;
  title: string;
  description: string | null;
  category: CourseCategory;
  is_open: boolean;
  required_rank: string | null;
  linear_progression: boolean;
  pages: number;
  completed: number;
  /** The caller may read the pages (open and rank allows, or instructor). */
  readable: boolean;
  rank_ok: boolean;
}

export interface AcademyOverview {
  viewer: {instructor: boolean; trainee: boolean};
  /** Today in Hungary (the server's calendar). */
  today: string;
  cycle: {id: string; start_date: string; status: "planned" | "active" | "archived"} | null;
  basic: {day: number; pages: number}[];
  courses: CourseSummary[];
}

export const academyApi = {
  overview: async () => {
    const {data, error} = await supabase.rpc("get_academy_overview");
    if (error) throw error;
    return data as AcademyOverview;
  },
  reorder: async (kind: "basic" | "course", ids: string[]) => {
    const {error} = await supabase.rpc("reorder_academy_pages", {_kind: kind, _ids: ids});
    if (error) throw error;
  },
};

export const ACADEMY_DAYS = [1, 2, 3, 4, 5] as const;

/**
 * Whether a day of the basic academy is open for a trainee: day N opens on the (N-1)th
 * calendar day after the cycle's start, in Hungarian time.
 */
export function isDayOpen(day: number, cycleStart: string | null | undefined, today = todayKey()): boolean {
  if (!cycleStart) return false;
  return daysBetween(cycleStart, today) >= day - 1;
}

/** The day of the cycle today (1–5), 0 before the start, 6 after the end. */
export function cycleDay(cycleStart: string | null | undefined, today = todayKey()): number {
  if (!cycleStart) return 0;
  const days = daysBetween(cycleStart, today);
  return days < 0 ? 0 : Math.min(days + 1, 6);
}

const COURSE_LOOK: Record<string, {icon: LucideIcon; tone: Tone}> = {
  mcb: {icon: Siren, tone: "blue"},
  seb: {icon: Crosshair, tone: "red"},
  qual_SAHP: {icon: Truck, tone: "orange"},
  qual_AB: {icon: Plane, tone: "cyan"},
  qual_MU: {icon: HeartPulse, tone: "red"},
  qual_GW: {icon: TreePine, tone: "emerald"},
  qual_FAB: {icon: Landmark, tone: "gold"},
  qual_SIB: {icon: Megaphone, tone: "violet"},
  qual_TB: {icon: School, tone: "gold"},
};

export function courseLook(course: Pick<CourseSummary, "id" | "category">): {icon: LucideIcon; tone: Tone} {
  return COURSE_LOOK[course.id] ?? (course.category === "qualification" ? {icon: Target, tone: "gold"} : {icon: BookOpen, tone: "slate"});
}

export const CATEGORY_LABELS: Record<CourseCategory, string> = {
  division: "Osztályok",
  qualification: "Képesítések",
  other: "Egyéb tananyagok",
};
