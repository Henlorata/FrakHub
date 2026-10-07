import {useState, type ReactNode} from "react";
import {Link} from "react-router";
import {Info, Printer, RotateCcw} from "lucide-react";
import {Dialog, DialogContent, DialogDescription, DialogTitle} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {autoFormatDuty, formatAccountNumber, formatDuty, parseDuty} from "@/lib/registry";
import {formatMoney} from "@/lib/finance";
import {payslipHref} from "@/lib/documents";
import {cn} from "@/lib/utils";
import type {PayrollInput, PayrollRow, PayrollSettings} from "@/types/finance";
import {MemberAvatar} from "../components/MemberAvatar";
import {MoneyField} from "../components/MoneyField";
import {dutyTierLabel, PAY_PARTS, placeLabel, qualificationOptions, unitOptions} from "./payroll-ui";

interface PayrollMemberDialogProps {
  row: PayrollRow;
  input: PayrollInput;
  settings: PayrollSettings;
  editable: boolean;
  /** The month when it is closed: its payslip can be printed. */
  closedMonth?: string | null;
  onInput: (patch: Partial<PayrollInput>) => void;
  onClose: () => void;
}

const selectClass = "h-9 w-full rounded-md bg-white/[0.03] px-2 text-sm text-slate-100 ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-emerald-400/60 disabled:opacity-60";

/**
 * One member's month: how the amount is made up, and every input of the row (the less
 * frequent ones too: unit, qualification, note, account number). Changes go to the sheet's
 * unsaved changes; the sheet's Save button stores them.
 */
export function PayrollMemberDialog({row, input, settings, editable, closedMonth, onInput, onClose}: PayrollMemberDialogProps) {
  const [duty, setDuty] = useState(input.duty_minutes ? formatDuty(input.duty_minutes, true) : "");
  const [account, setAccount] = useState(input.account_number ?? "");
  const dutyInvalid = duty.trim() !== "" && parseDuty(duty) === null;
  const belowMinimum = row.hours < settings.min_duty_hours;
  const autoUnit = row.rank_order <= 1 && settings.executive_unit ? settings.executive_unit : row.division;

  const detail: Record<string, ReactNode> = {
    rank: belowMinimum ? `${row.rank} · ${settings.min_duty_hours} óra alatt nem jár` : row.rank,
    duty: `${formatDuty(row.duty_minutes)} · ${dutyTierLabel(row.hours, settings)}`,
    unit: row.unit ?? "–",
    qualification: row.qualification ?? "nincs",
    reports: `${row.reports} × ${formatMoney(settings.report_pay)}`,
    pictures: `${row.pictures} × ${formatMoney(settings.picture_pay)}`,
    training: `${row.trained} × ${formatMoney(settings.training_pay)}`,
    top_duty: placeLabel(row.top_duty),
    top_report: placeLabel(row.top_report),
    bonus: row.bonus_note ?? "",
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-3xl">
        <div className="flex items-center gap-3 border-b border-white/5 p-5 pr-12">
          <MemberAvatar name={row.name} avatarUrl={row.avatar_url} size={40}/>
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate">{row.name}</DialogTitle>
            <DialogDescription className="truncate">{row.rank} · #{row.badge_number} · {row.division}</DialogDescription>
          </div>
          {closedMonth && (
            <Button size="sm" variant="outline" asChild className="shrink-0">
              <Link to={payslipHref(closedMonth, row.user_id)}><Printer/> Fizetési papír</Link>
            </Button>
          )}
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Összesen</p>
            <p className={cn("font-mono text-2xl font-semibold tabular-nums", row.total > 0 ? "text-emerald-300" : "text-slate-500")}>{formatMoney(row.total)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 divide-y divide-white/5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:divide-x md:divide-y-0">
          <div className="p-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Összetétel</p>
            {!row.eligible && (
              <p className="mb-3 flex items-start gap-2 rounded-lg bg-amber-500/[0.07] p-2.5 text-xs text-amber-200 ring-1 ring-amber-500/20">
                <Info className="mt-0.5 size-3.5 shrink-0"/> Ebben a hónapban nem kap fizetést, ezért az összeg 0.
              </p>
            )}
            <dl className="space-y-1">
              {PAY_PARTS.map((part) => {
                const amount = row.pay[part.key];
                return (
                  <div key={part.key} className={cn("flex items-baseline gap-3 rounded-md px-2 py-1.5", amount ? "bg-white/[0.02]" : "opacity-60")}>
                    <dt className="min-w-0 flex-1">
                      <span className="block text-sm text-slate-200">{part.label}</span>
                      {detail[part.key] && <span className="block truncate text-[11px] text-slate-500">{detail[part.key]}</span>}
                    </dt>
                    <dd className={cn("font-mono text-sm tabular-nums", amount < 0 ? "text-red-300" : amount ? "text-white" : "text-slate-600")}>
                      {formatMoney(amount)}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>

          <div className="space-y-4 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Havi adatok</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fizetést kap">
                <select disabled={!editable} className={selectClass} value={input.eligible === null ? "auto" : String(input.eligible)}
                        onChange={(event) => onInput({eligible: event.target.value === "auto" ? null : event.target.value === "true"})}>
                  <option value="auto">Automatikus ({row.rank === "Deputy Sheriff Trainee" ? "nem" : "igen"})</option>
                  <option value="true">Igen</option>
                  <option value="false">Nem</option>
                </select>
              </Field>
              <Field label="Duty idő" hint="pl. 9548 → 95:48">
                <Input disabled={!editable} value={duty} aria-invalid={dutyInvalid}
                       className={cn("font-mono", dutyInvalid && "ring-2 ring-red-500/60")}
                       onChange={(event) => {
                         const value = autoFormatDuty(event.target.value);
                         setDuty(value);
                         const minutes = value.trim() ? parseDuty(value) : 0;
                         if (minutes !== null) onInput({duty_minutes: minutes});
                       }}/>
              </Field>
              <Field label="Egység">
                <select disabled={!editable} className={selectClass} value={input.unit_key ?? "auto"}
                        onChange={(event) => onInput({unit_key: event.target.value === "auto" ? null : event.target.value})}>
                  <option value="auto">Automatikus ({autoUnit})</option>
                  {unitOptions(settings).map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                </select>
              </Field>
              <Field label="Képesítés">
                <select disabled={!editable} className={selectClass} value={input.qual_key === null ? "auto" : input.qual_key || "none"}
                        onChange={(event) => onInput({qual_key: event.target.value === "auto" ? null : event.target.value === "none" ? "" : event.target.value})}>
                  <option value="auto">Automatikus ({row.qualifications[0] ?? "nincs"})</option>
                  <option value="none">Nincs</option>
                  {qualificationOptions(settings, row).map((key) => <option key={key} value={key}>{key}</option>)}
                </select>
              </Field>
              <Field label="Jelentések" hint={`Naplóban: ${row.reports_logged}`}>
                <div className="flex gap-1.5">
                  <Input disabled={!editable} inputMode="numeric" placeholder={`${row.reports_logged} (napló)`} className="font-mono"
                         value={input.reports === null ? "" : String(input.reports)}
                         onChange={(event) => {
                           const text = event.target.value.replace(/\D/g, "").slice(0, 4);
                           onInput({reports: text ? Math.min(Number(text), 1000) : null});
                         }}/>
                  {input.reports !== null && editable && (
                    <Button type="button" size="icon" variant="ghost" title="Vissza a naplóra" onClick={() => onInput({reports: null})}><RotateCcw/></Button>
                  )}
                </div>
              </Field>
              <Field label="Élményképek">
                <Input disabled={!editable} inputMode="numeric" className="font-mono" value={input.pictures || ""} placeholder="0"
                       onChange={(event) => onInput({pictures: Math.min(Number(event.target.value.replace(/\D/g, "").slice(0, 4) || 0), 1000)})}/>
              </Field>
              <Field label="Kiképzett személyek">
                <Input disabled={!editable} inputMode="numeric" className="font-mono" value={input.trained || ""} placeholder="0"
                       onChange={(event) => onInput({trained: Math.min(Number(event.target.value.replace(/\D/g, "").slice(0, 4) || 0), 1000)})}/>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                {(["top_duty", "top_report"] as const).map((field) => (
                  <Field key={field} label={field === "top_duty" ? "TOP duty" : "TOP jel."}>
                    <select disabled={!editable} className={selectClass} value={input[field] === null ? "auto" : String(input[field])}
                            onChange={(event) => onInput({[field]: event.target.value === "auto" ? null : Number(event.target.value)})}>
                      <option value="auto">Auto{input[field] === null && row[field] ? ` (${placeLabel(row[field])})` : ""}</option>
                      <option value="0">–</option>
                      <option value="1">1.</option>
                      <option value="2">2.</option>
                      <option value="3">3.</option>
                    </select>
                  </Field>
                ))}
              </div>
              <Field label="Egyéb / ajánlás" hint="Levonás: negatív összeg">
                <MoneyField label="Egyéb / ajánlás" allowNegative disabled={!editable} value={input.bonus}
                            onChange={(value) => onInput({bonus: value})}/>
              </Field>
              <Field label="Megjegyzés">
                <Input disabled={!editable} value={input.bonus_note ?? ""} maxLength={300} placeholder="pl. Ajánlás: X"
                       onChange={(event) => onInput({bonus_note: event.target.value || null})}/>
              </Field>
            </div>
            <Field label="Számlaszám" hint="A HR-nyilvántartásba kerül.">
              <Input disabled={!editable} value={account} className="font-mono" placeholder="8-8-8 számjegy"
                     onChange={(event) => {
                       const formatted = formatAccountNumber(event.target.value);
                       setAccount(formatted);
                       onInput({account_number: formatted || null});
                     }}/>
            </Field>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-white/5 p-4">
          <p className="text-xs text-slate-500">{editable ? "A változások a táblázat Mentés gombjával tárolódnak." : "Lezárt hónap: csak megtekinthető."}</p>
          <Button className="ml-auto" onClick={onClose}>Kész</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({label, hint, children}: {label: string; hint?: string; children: ReactNode}) {
  return (
    <div className="min-w-0 space-y-1">
      <Label className="text-xs text-slate-400">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-slate-500">{hint}</p>}
    </div>
  );
}
