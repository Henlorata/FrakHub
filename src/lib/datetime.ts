import {formatDistanceToNow} from "date-fns";
import {hu} from "date-fns/locale";

/**
 * Dates and times are always shown in Hungarian time (Europe/Budapest, CET/CEST), whatever
 * the browser's own time zone is: privacy modes and misconfigured machines report UTC, which
 * would show every time two hours early in summer. The database stores UTC timestamps;
 * date-only values ("2026-11-20") are calendar dates and are never shifted.
 */
export const HUNGARIAN_TIME_ZONE = "Europe/Budapest";

type DateInput = string | number | Date | null | undefined;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const numeric = new Intl.DateTimeFormat("hu-HU", {
  timeZone: HUNGARIAN_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
const longDate = new Intl.DateTimeFormat("hu-HU", {timeZone: HUNGARIAN_TIME_ZONE, year: "numeric", month: "long", day: "numeric", weekday: "long"});
const standardDate = new Intl.DateTimeFormat("hu-HU", {timeZone: HUNGARIAN_TIME_ZONE});

const toDate = (value: DateInput): Date | null => {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** Calendar and clock parts of an instant in Hungary. */
export function hungarianParts(value: DateInput = new Date()) {
  const date = toDate(value) ?? new Date();
  const parts: Record<string, string> = {};
  numeric.formatToParts(date).forEach((part) => {
    parts[part.type] = part.value;
  });
  return {year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute, second: parts.second};
}

/** 2026.10.05. */
export function formatDate(value: DateInput): string {
  if (typeof value === "string" && DATE_ONLY.test(value)) return `${value.replaceAll("-", ".")}.`;
  if (!toDate(value)) return "–";
  const {year, month, day} = hungarianParts(value);
  return `${year}.${month}.${day}.`;
}

/** 2026.10.05. 14:32 */
export function formatDateTime(value: DateInput): string {
  if (!toDate(value)) return "–";
  const {year, month, day, hour, minute} = hungarianParts(value);
  return `${year}.${month}.${day}. ${hour}:${minute}`;
}

/** 14:32 (or 14:32:05). */
export function formatTime(value: DateInput, withSeconds = false): string {
  if (!toDate(value)) return "–";
  const {hour, minute, second} = hungarianParts(value);
  return withSeconds ? `${hour}:${minute}:${second}` : `${hour}:${minute}`;
}

/** "2026. október 5., hétfő" */
export function formatLongDate(value: DateInput = new Date()): string {
  const date = toDate(value);
  return date ? longDate.format(date) : "–";
}

/** The standard Hungarian short form, "2026. 10. 05." (used in texts copied to the forum). */
export function formatStandardDate(value: DateInput = new Date()): string {
  const date = toDate(value);
  return date ? standardDate.format(date) : "–";
}

/** "3 perce", "2 napja" (relative times do not depend on the time zone). */
export function formatRelative(value: DateInput): string {
  const date = toDate(value);
  return date ? formatDistanceToNow(date, {locale: hu, addSuffix: true}) : "–";
}

/** Today in Hungary as a date value ("2026-10-05"), for date inputs and date columns. */
export function todayKey(now: DateInput = new Date()): string {
  const {year, month, day} = hungarianParts(now);
  return `${year}-${month}-${day}`;
}

/** First day of the Hungarian month ("2026-10-01"). */
export function monthKey(now: DateInput = new Date()): string {
  const {year, month} = hungarianParts(now);
  return `${year}-${month}-01`;
}

/** Shifts a month value ("2026-10-01") by whole months. */
export function addMonths(month: string, count: number): string {
  const [year, monthIndex] = month.split("-").map(Number);
  const total = year * 12 + (monthIndex - 1) + count;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

/** Shifts a calendar date ("2026-10-05") by whole days. */
export function addDaysKey(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Whole days from one calendar date to another ("2026-10-05" → "2026-10-08" = 3). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * The instant of a Hungarian wall-clock time ("2026-10-09", "20:00" -> "2026-10-09T18:00:00.000Z"),
 * for date and time inputs. Two rounds settle the summer-time change.
 */
export function fromHungarian(date: string, time: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  let instant = wall;
  for (let round = 0; round < 2; round += 1) {
    const parts = hungarianParts(new Date(instant));
    instant += wall - Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  }
  return new Date(instant).toISOString();
}

const dayHeading = new Intl.DateTimeFormat("hu-HU", {timeZone: "UTC", month: "long", day: "numeric", weekday: "long"});
const dayHeadingWithYear = new Intl.DateTimeFormat("hu-HU", {timeZone: "UTC", year: "numeric", month: "long", day: "numeric", weekday: "long"});

/** "október 9., csütörtök" (with the year when it is not this year). */
export function formatCalendarDay(date: string, today: string = todayKey()): string {
  const value = new Date(`${date}T00:00:00Z`);
  return (date.slice(0, 4) === today.slice(0, 4) ? dayHeading : dayHeadingWithYear).format(value);
}

/** "Ma", "Holnap", "Tegnap", otherwise the calendar day ("október 9., csütörtök"). */
export function formatDayLabel(date: string, today: string = todayKey()): string {
  const offset = daysBetween(today, date);
  if (offset === 0) return "Ma";
  if (offset === 1) return "Holnap";
  if (offset === -1) return "Tegnap";
  return formatCalendarDay(date, today);
}

/** The hour in Hungary (0–23), e.g. for greetings. */
export const hungarianHour = (now: DateInput = new Date()) => Number(hungarianParts(now).hour);

/** Compact relative time for tight rows: "most", "5 perce", "3 órája", "2 napja", "4 hónapja", "1 éve". */
export function formatAgo(value: DateInput, now: Date = new Date()): string {
  const date = toDate(value);
  if (!date) return "–";
  const minutes = Math.max(0, Math.round((now.getTime() - date.getTime()) / 60_000));
  if (minutes < 1) return "most";
  if (minutes < 60) return `${minutes} perce`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} órája`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days} napja`;
  const months = Math.round(days / 30.4);
  if (months < 12) return `${months} hónapja`;
  return `${Math.round(days / 365)} éve`;
}
