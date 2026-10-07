import {
  AlertTriangle, Banknote, Bell, CalendarDays, CheckCircle2, ClipboardList, Fingerprint, GraduationCap, Info, Mail,
  Megaphone, Radar, Scale, ShieldCheck, Siren, Truck, Users, UsersRound, type LucideIcon,
} from "lucide-react";
import type {NotificationCategory, NotificationType} from "@/types/supabase";

export interface CategoryMeta {
  label: string;
  icon: LucideIcon;
  /** Tailwind classes for the icon tile. */
  tone: string;
  /** Whether members may mute the category. */
  mutable: boolean;
}

export const NOTIFICATION_CATEGORIES: Record<NotificationCategory, CategoryMeta> = {
  hr: {label: "Személyügy", icon: Users, tone: "bg-amber-500/10 text-amber-400 ring-amber-500/20", mutable: true},
  mcb: {label: "Nyomozó Iroda", icon: Fingerprint, tone: "bg-sky-500/10 text-sky-400 ring-sky-500/20", mutable: true},
  exam: {label: "Vizsgák", icon: ClipboardList, tone: "bg-violet-500/10 text-violet-400 ring-violet-500/20", mutable: true},
  academy: {label: "Akadémia", icon: GraduationCap, tone: "bg-cyan-500/10 text-cyan-400 ring-cyan-500/20", mutable: true},
  logistics: {label: "Logisztika", icon: Truck, tone: "bg-orange-500/10 text-orange-400 ring-orange-500/20", mutable: true},
  finance: {label: "Pénzügy", icon: Banknote, tone: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20", mutable: true},
  announcement: {label: "Hirdetmények", icon: Megaphone, tone: "bg-yellow-500/10 text-yellow-400 ring-yellow-500/20", mutable: true},
  event: {label: "Események", icon: CalendarDays, tone: "bg-rose-500/10 text-rose-300 ring-rose-500/20", mutable: true},
  patrol: {label: "BOLO, körözések", icon: Radar, tone: "bg-red-500/10 text-red-300 ring-red-500/20", mutable: true},
  community: {label: "Közösség", icon: UsersRound, tone: "bg-violet-500/10 text-violet-300 ring-violet-500/20", mutable: true},
  mail: {label: "Levelezés", icon: Mail, tone: "bg-indigo-500/10 text-indigo-300 ring-indigo-500/20", mutable: true},
  iab: {label: "Belső vizsgálatok", icon: Scale, tone: "bg-fuchsia-500/10 text-fuchsia-300 ring-fuchsia-500/20", mutable: true},
  system: {label: "Rendszer", icon: ShieldCheck, tone: "bg-slate-500/10 text-slate-300 ring-slate-500/20", mutable: false},
};

export const CATEGORY_ORDER: NotificationCategory[] = [
  "mail", "hr", "mcb", "patrol", "iab", "exam", "academy", "logistics", "finance", "announcement", "event", "community", "system",
];

export const NOTIFICATION_TYPES: Record<NotificationType, {label: string; icon: LucideIcon; accent: string; dot: string}> = {
  info: {label: "Információ", icon: Info, accent: "text-sky-400", dot: "bg-sky-400"},
  success: {label: "Sikeres", icon: CheckCircle2, accent: "text-emerald-400", dot: "bg-emerald-400"},
  warning: {label: "Figyelem", icon: AlertTriangle, accent: "text-amber-400", dot: "bg-amber-400"},
  alert: {label: "Riasztás", icon: Siren, accent: "text-red-400", dot: "bg-red-400"},
};

export const categoryMeta = (category: string | null | undefined): CategoryMeta =>
  NOTIFICATION_CATEGORIES[(category ?? "system") as NotificationCategory] ?? {
    label: "Egyéb", icon: Bell, tone: "bg-slate-500/10 text-slate-300 ring-slate-500/20", mutable: false,
  };
