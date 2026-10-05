import {format, parseISO} from "date-fns";
import {hu} from "date-fns/locale";
import {addMonths, daysBetween, formatDate, monthKey, todayKey} from "@/lib/datetime";
import type {ActivityStatus, JoinType, LeaveType, RehireStatus} from "@/types/supabase";

/** Stations of the department (the "Kirendeltség" column of the old sheet). */
export const STATIONS = ["Downtown", "Angel Pine", "Fort Carson"] as const;

export const ACTIVITY_META: Record<ActivityStatus, {label: string; dot: string; pill: string}> = {
  active: {label: "Aktív", dot: "bg-emerald-400", pill: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"},
  less_active: {label: "Kevésbé aktív", dot: "bg-amber-400", pill: "bg-amber-500/10 text-amber-300 ring-amber-500/30"},
  inactive: {label: "Inaktív", dot: "bg-red-400", pill: "bg-red-500/10 text-red-300 ring-red-500/30"},
};

export const JOIN_TYPE_LABELS: Record<JoinType, string> = {
  new: "Új felvétel",
  returned: "Visszatérő",
  referral: "Beajánlás",
};

export const LEAVE_TYPE_META: Record<LeaveType, {label: string; pill: string}> = {
  resigned: {label: "Kilépett", pill: "bg-slate-500/10 text-slate-300 ring-slate-500/30"},
  dismissed: {label: "Elbocsátva", pill: "bg-red-500/10 text-red-300 ring-red-500/30"},
  inactivity: {label: "Inaktivitás", pill: "bg-amber-500/10 text-amber-300 ring-amber-500/30"},
  transferred: {label: "Áthelyezés", pill: "bg-sky-500/10 text-sky-300 ring-sky-500/30"},
  other: {label: "Egyéb", pill: "bg-slate-500/10 text-slate-300 ring-slate-500/30"},
};

export const REHIRE_META: Record<RehireStatus, {label: string; pill: string}> = {
  eligible: {label: "Visszatérhet", pill: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"},
  conditional: {label: "Feltételesen", pill: "bg-amber-500/10 text-amber-300 ring-amber-500/30"},
  not_eligible: {label: "Nem térhet vissza", pill: "bg-red-500/10 text-red-300 ring-red-500/30"},
};

// --- Duty time -----------------------------------------------------------------

/** 5748 -> "95 ó 48 p" (compact: "95:48"). */
export function formatDuty(minutes: number | null | undefined, compact = false): string {
  if (minutes === null || minutes === undefined) return "–";
  const hours = Math.floor(minutes / 60);
  const rest = String(minutes % 60).padStart(2, "0");
  return compact ? `${hours}:${rest}` : `${hours} ó ${rest} p`;
}

const MAX_MONTH_MINUTES = 31 * 24 * 60;

/**
 * While typing: four or five digits become hours and minutes ("1235" -> "12:35",
 * "11457" -> "114:57"); shorter numbers are ambiguous and stay as typed.
 */
export function autoFormatDuty(input: string): string {
  if (!/^\d{1,3}:?\d{0,3}$/.test(input)) return input;
  const digits = input.replace(":", "");
  return digits.length === 4 || digits.length === 5 ? `${digits.slice(0, -2)}:${digits.slice(-2)}` : input;
}

/**
 * Reads what staff type from the game's counter: "95:48", "9548", "95 óra 48 perc", "95ó 48p",
 * "95h 48m", "48 perc", "95" (hours) or "95,5" (decimal hours). Returns null if invalid.
 */
export function parseDuty(input: string): number | null {
  const value = input.trim().toLowerCase().replace(/\s+/g, " ");
  if (!value) return null;
  let minutes: number | null = null;
  let match = value.match(/^(\d{1,3}):([0-5]?\d)$/) ?? value.match(/^(\d{2,3})([0-5]\d)$/);
  if (match) minutes = Number(match[1]) * 60 + Number(match[2]);
  if (minutes === null) {
    match = value.match(/^(\d{1,3}) ?(?:ó|óra|h|hr)\.?(?: ?(\d{1,2}) ?(?:p|perc|m|min)\.?)?$/);
    if (match) minutes = Number(match[1]) * 60 + Number(match[2] ?? 0);
  }
  if (minutes === null) {
    match = value.match(/^(\d{1,4}) ?(?:p|perc|m|min)\.?$/);
    if (match) minutes = Number(match[1]);
  }
  if (minutes === null) {
    match = value.match(/^(\d{1,3})(?:[.,](\d{1,2}))?$/);
    if (match) minutes = Math.round(Number(`${match[1]}.${match[2] ?? 0}`) * 60);
  }
  return minutes !== null && minutes <= MAX_MONTH_MINUTES ? minutes : null;
}

/** First day of the (Hungarian) month, as stored in duty_time_entries.month. */
export const monthStart = (date = new Date()) => monthKey(date);

/** The last `count` months, oldest first. */
export const recentMonths = (count: number, from = new Date()) =>
  Array.from({length: count}, (_, index) => addMonths(monthKey(from), index - (count - 1)));

/** "2026. szeptember" or "szept." */
export const monthLabel = (month: string, style: "long" | "short" = "long") =>
  format(parseISO(month), style === "long" ? "yyyy. LLLL" : "LLL", {locale: hu});

// --- Vehicle registration ------------------------------------------------------

export type RegistrationState = "missing" | "ok" | "soon" | "expired";

/** Days before expiry when the fleet starts showing a warning. */
export const REGISTRATION_SOON_DAYS = 7;

export function registrationStatus(expiresOn: string | null): {state: RegistrationState; days: number | null; label: string} {
  if (!expiresOn) return {state: "missing", days: null, label: "Nincs megadva"};
  const days = daysBetween(todayKey(), expiresOn);
  if (days < 0) return {state: "expired", days, label: `Lejárt (${-days} napja)`};
  if (days === 0) return {state: "soon", days, label: "Ma lejár"};
  if (days <= REGISTRATION_SOON_DAYS) return {state: "soon", days, label: `${days} nap múlva lejár`};
  return {state: "ok", days, label: `Érvényes: ${formatDate(expiresOn)}`};
}

export const REGISTRATION_PILL: Record<RegistrationState, string> = {
  ok: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
  soon: "bg-amber-500/10 text-amber-300 ring-amber-500/40",
  expired: "bg-red-500/15 text-red-300 ring-red-500/40",
  missing: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
};

// --- Bank account --------------------------------------------------------------

/** Groups digits as 8-8-8 (Hungarian account format) while typing. */
export function formatAccountNumber(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 24);
  return digits.match(/.{1,8}/g)?.join("-") ?? "";
}

export const isValidAccountNumber = (value: string) => /^\d{8}-\d{8}(-\d{8})?$/.test(value);
