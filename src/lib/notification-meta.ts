import {
  AlertTriangle, Banknote, Bell, CalendarDays, CheckCircle2, ClipboardList, Fingerprint, GraduationCap, Info,
  Megaphone, ShieldCheck, Siren, Truck, Users, type LucideIcon,
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
  system: {label: "Rendszer", icon: ShieldCheck, tone: "bg-slate-500/10 text-slate-300 ring-slate-500/20", mutable: false},
};

export const CATEGORY_ORDER: NotificationCategory[] = [
  "hr", "mcb", "exam", "academy", "logistics", "finance", "announcement", "event", "system",
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
