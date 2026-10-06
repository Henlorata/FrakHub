import {DIVISIONS, QUALIFICATIONS} from "@shared/ranks";
import {formatMoneyShort} from "@/lib/finance";
import {dutyTierPay} from "@/lib/payroll";
import type {PayrollPay, PayrollRow, PayrollSettings} from "@/types/finance";

/** The parts of the pay in the order of the old sheet. */
export const PAY_PARTS: {key: keyof PayrollPay; label: string}[] = [
  {key: "rank", label: "Rendfokozat"},
  {key: "duty", label: "Duty idő"},
  {key: "unit", label: "Egység"},
  {key: "qualification", label: "Képesítés"},
  {key: "reports", label: "Jelentések"},
  {key: "pictures", label: "Élményképek"},
  {key: "training", label: "Kiképzés"},
  {key: "top_duty", label: "TOP duty"},
  {key: "top_report", label: "TOP jelentés"},
  {key: "bonus", label: "Egyéb / ajánlás"},
];

/** Units a member can be paid as: the executive unit, the divisions and any other key of the table. */
export function unitOptions(settings: PayrollSettings): string[] {
  const keys = [settings.executive_unit, ...DIVISIONS, ...Object.keys(settings.unit_pay)]
    .filter((key): key is string => !!key && !(QUALIFICATIONS as readonly string[]).includes(key));
  return [...new Set(keys)];
}

/** Qualifications that have a pay (and the member's own ones). */
export function qualificationOptions(settings: PayrollSettings, row: PayrollRow): string[] {
  return [...new Set([...row.qualifications, ...QUALIFICATIONS.filter((key) => key in settings.unit_pay)])];
}

/** "100+ · 10M", "30 óra alatt" */
export function dutyTierLabel(hours: number, settings: PayrollSettings): string {
  if (hours < settings.min_duty_hours) return `${settings.min_duty_hours} óra alatt`;
  const tier = [...settings.duty_tiers].filter((item) => hours >= item.hours).sort((a, b) => b.hours - a.hours)[0];
  return tier ? `${tier.hours}+ · ${formatMoneyShort(dutyTierPay(hours, settings))}` : "Nincs sáv";
}

/** Tailwind classes of the duty cell, like the colours of the old sheet. */
export function dutyTone(hours: number, settings: PayrollSettings): string {
  if (hours < settings.min_duty_hours) return "text-red-300";
  if (hours >= 100) return "text-sky-300";
  if (hours >= 80) return "text-emerald-300";
  if (hours >= 60) return "text-lime-300";
  if (hours >= 40) return "text-amber-200";
  return "text-orange-300";
}

export const placeLabel = (place: number) => place >= 1 && place <= 3 ? `${place}.` : "–";
