import {Fragment, type KeyboardEvent, type ReactNode} from "react";
import {toast} from "sonner";
import {Check, CircleDollarSign, Copy, Loader2, PencilLine, Sparkles} from "lucide-react";
import {autoFormatDuty, formatDuty} from "@/lib/registry";
import {formatMoney} from "@/lib/finance";
import {cn, getStaffCategory, STAFF_CATEGORY_LABELS, type StaffCategory} from "@/lib/utils";
import type {PayrollInput, PayrollRow, PayrollSettings} from "@/types/finance";
import {MemberAvatar} from "../components/MemberAvatar";
import {dutyTierLabel, dutyTone, placeLabel} from "./payroll-ui";

export type TextField = "duty" | "reports" | "pictures" | "trained" | "bonus";
export const cellKey = (userId: string, field: TextField) => `${userId}:${field}`;

const CATEGORY_ORDER: StaffCategory[] = ["executive", "command", "supervisory", "field"];
const money = new Intl.NumberFormat("hu-HU");

/** What a text cell shows when it is not being edited. */
export function cellText(input: PayrollInput, field: TextField): string {
  switch (field) {
    case "duty": return input.duty_minutes > 0 ? formatDuty(input.duty_minutes, true) : "";
    case "reports": return input.reports === null ? "" : String(input.reports);
    case "pictures": return input.pictures ? String(input.pictures) : "";
    case "trained": return input.trained ? String(input.trained) : "";
    case "bonus": return input.bonus ? money.format(input.bonus) : "";
  }
}

interface PayrollTableProps {
  rows: PayrollRow[];
  inputs: (userId: string) => PayrollInput;
  settings: PayrollSettings;
  editable: boolean;
  texts: Record<string, string>;
  invalid: Set<string>;
  changed: Set<string>;
  selected: Set<string>;
  paidBusy: Set<string>;
  onText: (userId: string, field: TextField, value: string) => void;
  onBlurText: (userId: string, field: TextField) => void;
  onInput: (userId: string, patch: Partial<PayrollInput>) => void;
  onSelect: (userIds: string[], selected: boolean) => void;
  onPaid: (row: PayrollRow) => void;
  onDetails: (userId: string) => void;
}

/**
 * The month's sheet: one row per member like the leadership's old spreadsheet. Inputs are
 * typed in place (Enter / arrows move between members); the totals follow at once.
 */
export function PayrollTable(props: PayrollTableProps) {
  const {rows, settings, editable, selected, onSelect} = props;
  const sections = CATEGORY_ORDER
    .map((category) => ({category, rows: rows.filter((row) => getStaffCategory(row.rank) === category)}))
    .filter((section) => section.rows.length > 0);
  const order = sections.flatMap((section) => section.rows);
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.user_id));

  const totals = rows.reduce((sum, row) => ({
    minutes: sum.minutes + row.duty_minutes, reports: sum.reports + row.reports, pictures: sum.pictures + row.pictures,
    trained: sum.trained + row.trained, bonus: sum.bonus + (row.eligible ? row.bonus : 0), total: sum.total + row.total,
  }), {minutes: 0, reports: 0, pictures: 0, trained: 0, bonus: 0, total: 0});

  return (
    <div className="max-h-[calc(100dvh-17rem)] min-h-64 overflow-auto">
      <table className="w-full min-w-[1280px] border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 z-20">
          <tr className="bg-[#0b1324]/95 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 backdrop-blur">
            <th className="sticky left-0 z-10 border-b bg-[#0b1324]/95 py-2.5 pr-2 pl-4">
              <input type="checkbox" aria-label="Mindenki kijelölése" checked={allSelected}
                     onChange={(event) => onSelect(rows.map((row) => row.user_id), event.target.checked)}
                     className="size-4 accent-emerald-500 align-middle"/>
            </th>
            <th className="sticky left-10 z-10 border-b bg-[#0b1324]/95 py-2.5 pr-3">Tag</th>
            <Head title="Kap-e fizetést ebben a hónapban">Fizet</Head>
            <Head className="text-center">Duty idő</Head>
            <Head className="text-center" title="Üresen: a jelentésnaplóból számolva">Jelentés</Head>
            <Head className="text-center">Élménykép</Head>
            <Head className="text-center" title="Kiképzett személyek száma">Kiképzett</Head>
            <Head className="text-center">TOP duty</Head>
            <Head className="text-center">TOP jel.</Head>
            <Head className="text-right" title="Ajánlás, jutalom vagy levonás (negatív)">Egyéb</Head>
            <Head className="text-right">Összesen</Head>
            <Head>Számlaszám</Head>
            <Head className="pr-4 text-center">Kifizetve</Head>
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => (
            <Fragment key={section.category}>
              <tr>
                <td colSpan={13} className="border-b bg-white/[0.02] py-1.5 pl-4 text-xs font-semibold text-slate-300">
                  <span className="sticky left-4 inline-block">{STAFF_CATEGORY_LABELS[section.category]}
                    <span className="ml-1 font-normal text-slate-500">· {section.rows.length} fő</span></span>
                </td>
              </tr>
              {section.rows.map((row) => <SheetRow key={row.user_id} row={row} index={order.indexOf(row)} {...props}/>)}
            </Fragment>
          ))}
        </tbody>
        <tfoot className="sticky bottom-0 z-20">
          <tr className="bg-[#0b1324]/95 text-xs font-semibold text-slate-300 backdrop-blur">
            <td className="sticky left-0 z-10 border-t bg-[#0b1324]/95 py-2.5 pl-4" colSpan={2}>
              <CircleDollarSign className="mr-1.5 inline size-3.5 text-emerald-400"/>{rows.length} tag összesen
            </td>
            <td className="border-t"/>
            <td className="border-t text-center font-mono tabular-nums">{formatDuty(totals.minutes, true)}</td>
            <td className="border-t text-center font-mono tabular-nums">{totals.reports}</td>
            <td className="border-t text-center font-mono tabular-nums">{totals.pictures || "–"}</td>
            <td className="border-t text-center font-mono tabular-nums">{totals.trained || "–"}</td>
            <td className="border-t" colSpan={2}/>
            <td className="border-t px-2 text-right font-mono tabular-nums">{totals.bonus ? money.format(totals.bonus) : "–"}</td>
            <td className="border-t px-2 text-right font-mono text-sm text-emerald-300 tabular-nums">{formatMoney(totals.total)}</td>
            <td className="border-t" colSpan={2}/>
          </tr>
        </tfoot>
      </table>
      {!editable && rows.length > 0 && (
        <p className="sticky left-0 px-4 py-2 text-[11px] text-slate-500">
          Lezárt hónap: az összegek a lezáráskori állapotot mutatják ({settings.min_duty_hours} óra alatt nincs rang- és duty-fizetés).
        </p>
      )}
    </div>
  );
}

function Head({children, className, title}: {children: ReactNode; className?: string; title?: string}) {
  return <th title={title} className={cn("border-b px-2 py-2.5 whitespace-nowrap", className)}>{children}</th>;
}

function SheetRow({row, index, inputs, settings, editable, texts, invalid, changed, selected, paidBusy, onText, onBlurText,
                    onInput, onSelect, onPaid, onDetails}: PayrollTableProps & {row: PayrollRow; index: number}) {
  const input = inputs(row.user_id);
  const isChanged = changed.has(row.user_id);
  const dim = !row.eligible;

  const textCell = (field: TextField, column: number, options: {width?: string; placeholder?: string; align?: string} = {}) => {
    const key = cellKey(row.user_id, field);
    const value = texts[key] ?? cellText(input, field);
    if (!editable) {
      return <span className="font-mono text-[13px] tabular-nums text-slate-200">{value || <span className="text-slate-600">{options.placeholder ?? "–"}</span>}</span>;
    }
    return (
      <input
        data-pay-cell={`${index}:${column}`}
        value={value}
        placeholder={options.placeholder ?? "–"}
        inputMode={field === "duty" ? "text" : "numeric"}
        onChange={(event) => onText(row.user_id, field, field === "duty" ? autoFormatDuty(event.target.value) : event.target.value)}
        onBlur={() => onBlurText(row.user_id, field)}
        onFocus={(event) => event.target.select()}
        onKeyDown={(event) => moveFocus(event, index, column)}
        aria-label={`${row.name} – ${field}`}
        className={cn(
          "h-8 rounded-md bg-white/[0.03] px-2 font-mono text-[13px] tabular-nums text-slate-100 ring-1 ring-white/10 outline-none transition-colors placeholder:text-slate-600 focus:bg-white/[0.06] focus:ring-2 focus:ring-emerald-400/60",
          options.width ?? "w-16", options.align ?? "text-center",
          invalid.has(key) && "bg-red-500/10 text-red-200 ring-red-500/60",
        )}
      />
    );
  };

  const placeSelect = (field: "top_duty" | "top_report") => {
    const explicit = input[field];
    const label = placeLabel(row[field]);
    if (!editable) {
      return <span className={cn("font-mono text-[13px]", row[field] ? "text-amber-300" : "text-slate-600")}>{label}</span>;
    }
    return (
      <select
        value={explicit === null ? "auto" : String(explicit)}
        onChange={(event) => onInput(row.user_id, {[field]: event.target.value === "auto" ? null : Number(event.target.value)})}
        aria-label={`${row.name} – ${field === "top_duty" ? "TOP duty" : "TOP jelentés"}`}
        className={cn("h-8 w-[74px] rounded-md bg-white/[0.03] px-1.5 text-[13px] ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-emerald-400/60",
          row[field] ? "text-amber-300" : "text-slate-400")}>
        <option value="auto">{explicit === null && row[field] ? `${label} ✦` : "Auto"}</option>
        <option value="0">–</option>
        <option value="1">1.</option>
        <option value="2">2.</option>
        <option value="3">3.</option>
      </select>
    );
  };

  return (
    <tr className={cn("group", isChanged && "[&>td]:bg-emerald-500/[0.035]")}>
      <td className="sticky left-0 z-10 border-b border-white/[0.04] bg-[#0a1120]/95 py-2 pr-2 pl-4 backdrop-blur group-hover:bg-[#0e172a]">
        <input type="checkbox" aria-label={`${row.name} kijelölése`} checked={selected.has(row.user_id)}
               onChange={(event) => onSelect([row.user_id], event.target.checked)} className="size-4 accent-emerald-500 align-middle"/>
      </td>
      <td className="sticky left-10 z-10 border-b border-white/[0.04] bg-[#0a1120]/95 py-2 pr-3 backdrop-blur group-hover:bg-[#0e172a]">
        <button type="button" onClick={() => onDetails(row.user_id)} className="flex min-w-0 items-center gap-2.5 text-left" data-tour="payroll-member">
          <MemberAvatar name={row.name} avatarUrl={row.avatar_url} size={28}/>
          <span className="min-w-0">
            <span className={cn("block max-w-[190px] truncate text-sm font-medium", dim ? "text-slate-400" : "text-white")}>{row.name}</span>
            <span className="flex max-w-[210px] items-center gap-1 truncate text-[11px] text-slate-500">
              {row.rank}
              <span className="text-slate-600">·</span>
              <span className={cn(!row.unit_auto && "text-sky-300")}>{row.unit ?? "–"}</span>
              {row.qualification && <><span className="text-slate-600">·</span><span className={cn(!row.qualification_auto && "text-sky-300")}>{row.qualification}</span></>}
            </span>
          </span>
        </button>
      </td>
      <td className="border-b border-white/[0.04] px-2 py-1.5 group-hover:bg-white/[0.02]">
        <button type="button" disabled={!editable} onClick={() => {
          const next = !row.eligible;
          const byDefault = row.rank !== "Deputy Sheriff Trainee";
          onInput(row.user_id, {eligible: next === byDefault ? null : next});
        }} aria-pressed={row.eligible} aria-label={`${row.name} fizetést kap`}
                className={cn("grid size-7 place-items-center rounded-md ring-1 transition-colors disabled:cursor-default",
                  row.eligible ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40" : "bg-white/[0.02] text-slate-600 ring-white/10",
                  editable && "hover:ring-emerald-400/60")}>
          {row.eligible && <Check className="size-4"/>}
        </button>
      </td>
      <td className="border-b border-white/[0.04] px-2 py-1.5 text-center group-hover:bg-white/[0.02]">
        <div className="flex flex-col items-center gap-0.5">
          {textCell("duty", 0, {width: "w-[78px]"})}
          <span className={cn("text-[10px] tabular-nums", dutyTone(row.hours, settings))}>{dutyTierLabel(row.hours, settings)}</span>
        </div>
      </td>
      <td className="border-b border-white/[0.04] px-2 py-1.5 text-center group-hover:bg-white/[0.02]">
        <div className="flex flex-col items-center gap-0.5">
          {textCell("reports", 1, {placeholder: String(row.reports_logged)})}
          <span className="text-[10px] text-slate-500">{row.reports_auto ? "naplóból" : `napló: ${row.reports_logged}`}</span>
        </div>
      </td>
      <td className="border-b border-white/[0.04] px-2 py-1.5 text-center group-hover:bg-white/[0.02]">{textCell("pictures", 2)}</td>
      <td className="border-b border-white/[0.04] px-2 py-1.5 text-center group-hover:bg-white/[0.02]">{textCell("trained", 3)}</td>
      <td className="border-b border-white/[0.04] px-2 py-1.5 text-center group-hover:bg-white/[0.02]">{placeSelect("top_duty")}</td>
      <td className="border-b border-white/[0.04] px-2 py-1.5 text-center group-hover:bg-white/[0.02]">{placeSelect("top_report")}</td>
      <td className="border-b border-white/[0.04] px-2 py-1.5 text-right group-hover:bg-white/[0.02]">
        <div className="flex items-center justify-end gap-1">
          {row.bonus_note && <span title={row.bonus_note}><Sparkles className="size-3.5 text-amber-300"/></span>}
          {textCell("bonus", 4, {width: "w-24", align: "text-right"})}
        </div>
      </td>
      <td className="border-b border-white/[0.04] px-2 py-1.5 text-right group-hover:bg-white/[0.02]">
        <button type="button" onClick={() => onDetails(row.user_id)} title="Részletek"
                className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 font-mono text-sm font-semibold tabular-nums transition-colors hover:bg-white/[0.06]",
                  row.total > 0 ? "text-emerald-300" : "text-slate-600")}>
          {formatMoney(row.total)}
          <PencilLine className="size-3 opacity-0 transition-opacity group-hover:opacity-60"/>
        </button>
      </td>
      <td className="border-b border-white/[0.04] px-2 py-1.5 group-hover:bg-white/[0.02]">
        {row.account_number ? (
          <button type="button" title={`${row.account_number} – másolás`} onClick={() => {
            void navigator.clipboard.writeText(row.account_number ?? "");
            toast.success(`${row.name} számlaszáma másolva.`);
          }} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 py-1 font-mono text-[12px] text-slate-300 tabular-nums hover:bg-white/[0.06] hover:text-white">
            {row.account_number.length > 12 ? `…${row.account_number.slice(-8)}` : row.account_number}<Copy className="size-3 text-slate-500"/>
          </button>
        ) : <span className="text-xs text-slate-600">nincs megadva</span>}
      </td>
      <td className="border-b border-white/[0.04] px-2 py-1.5 pr-4 text-center group-hover:bg-white/[0.02]">
        <button type="button" disabled={paidBusy.has(row.user_id) || (!row.paid && row.total <= 0)} onClick={() => onPaid(row)}
                aria-pressed={row.paid} aria-label={`${row.name} kifizetve`}
                className={cn("inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-medium ring-1 transition-colors disabled:opacity-40",
                  row.paid ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40" : "text-slate-400 ring-white/10 hover:bg-white/[0.05] hover:text-slate-200")}>
          {paidBusy.has(row.user_id) ? <Loader2 className="size-3 animate-spin"/> : row.paid && <Check className="size-3"/>}
          {row.paid ? "Kifizetve" : "Fizetendő"}
        </button>
      </td>
    </tr>
  );
}

/** Enter, Tab and the arrows move down/up the column (the sheet is filled member by member). */
function moveFocus(event: KeyboardEvent<HTMLInputElement>, row: number, column: number) {
  const step = event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey) ? -1
    : event.key === "Enter" || event.key === "ArrowDown" || event.key === "Tab" ? 1 : 0;
  if (!step) return;
  const target = document.querySelector<HTMLInputElement>(`[data-pay-cell="${row + step}:${column}"]`);
  // At the end of the column Tab leaves the sheet as usual.
  if (!target && event.key === "Tab") return;
  event.preventDefault();
  target?.focus();
  target?.select();
}
