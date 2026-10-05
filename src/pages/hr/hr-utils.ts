import {daysBetween, todayKey} from "@/lib/datetime";
import {getStaffCategory, type StaffCategory} from "@/lib/utils";

/** Calendar days in Hungary since a timestamp or date. */
export const daysSince = (iso?: string | null): number | null =>
  iso ? Math.max(0, daysBetween(todayKey(iso), todayKey())) : null;

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

export {formatDate} from "@/lib/datetime";

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

export {downloadCsv} from "@/lib/csv";
