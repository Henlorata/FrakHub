import {differenceInCalendarDays, format} from "date-fns";
import {getStaffCategory, type StaffCategory} from "@/lib/utils";

export const daysSince = (iso?: string | null): number | null =>
  iso ? Math.max(0, differenceInCalendarDays(new Date(), new Date(iso))) : null;

/** "12 nap", "4 hónap", "1 év 3 hónap". */
export const formatSpan = (days: number | null): string => {
  if (days === null) return "–";
  if (days < 1) return "ma";
  if (days < 60) return `${days} nap`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return `${months} hónap`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest > 0 ? `${years} év ${rest} hó` : `${years} év`;
};

export const formatDate = (iso?: string | null) => (iso ? format(new Date(iso), "yyyy.MM.dd.") : "–");

export const CATEGORY_META: Record<StaffCategory, {label: string; short: string; pill: string; dot: string}> = {
  executive: {label: "Executive Staff", short: "Vezérkar", pill: "bg-violet-500/10 text-violet-300 ring-violet-500/30", dot: "bg-violet-400"},
  command: {label: "Command Staff", short: "Parancsnokság", pill: "bg-amber-500/10 text-amber-300 ring-amber-500/30", dot: "bg-amber-400"},
  supervisory: {label: "Supervisory Staff", short: "Vezetőség", pill: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30", dot: "bg-emerald-400"},
  field: {label: "Field Staff", short: "Állomány", pill: "bg-slate-500/10 text-slate-300 ring-slate-500/25", dot: "bg-slate-400"},
};

export const rankPillClass = (rank: string) => CATEGORY_META[getStaffCategory(rank)].pill;

export const DIVISION_META: Record<string, {label: string; pill: string}> = {
  TSB: {label: "TSB", pill: "bg-slate-500/10 text-slate-300 ring-slate-500/25"},
  SEB: {label: "SEB", pill: "bg-red-500/10 text-red-300 ring-red-500/30"},
  MCB: {label: "MCB", pill: "bg-sky-500/10 text-sky-300 ring-sky-500/30"},
};

/** Excel-friendly CSV (UTF-8 BOM, semicolon separated, as Hungarian Excel expects). */
export function downloadCsv(fileName: string, rows: (string | number | null | undefined)[][]) {
  const escape = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = "﻿" + rows.map((row) => row.map(escape).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], {type: "text/csv;charset=utf-8"}));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
