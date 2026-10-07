import {useEffect, useState, type ReactNode} from "react";
import {useNavigate, useParams, useSearchParams} from "react-router";
import {ArrowLeft, Loader2, Printer} from "lucide-react";
import {Button} from "@/components/ui/button";
import {SheriffStar} from "@/components/brand/SheriffStar";
import {SignatureLine} from "@/components/signature/SignatureLine";
import {formatDate, formatDateTime} from "@/lib/datetime";
import {documentsApi, type PayslipDocument} from "@/lib/documents";
import {formatMoney} from "@/lib/finance";
import {formatDuty, monthLabel} from "@/lib/registry";
import {useSignatures} from "@/lib/signature/api";
import {cn, errorMessage} from "@/lib/utils";
import {PAY_PARTS, placeLabel} from "./payroll/payroll-ui";

/**
 * A closed month's payslip on paper: the member, every pay item, the total and whether it was
 * paid; signed by whoever closed the month ("Kiállította") and by the member ("Átvette").
 * The member prints their own; the leadership who pays may print anyone's (?user=).
 */
export function PayslipPrintPage() {
  const {month = ""} = useParams<{month: string}>();
  const [params] = useSearchParams();
  const userId = params.get("user");
  const navigate = useNavigate();
  const [slip, setSlip] = useState<PayslipDocument | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const signatureOf = useSignatures([slip?.closed_by?.id, slip?.member.id]);
  const validMonth = /^\d{4}-\d{2}$/.test(month);
  const error = validMonth ? loadError : "Érvénytelen hónap.";

  useEffect(() => {
    if (!validMonth) return;
    let active = true;
    documentsApi.payslip(month, userId).then((data) => active && setSlip(data),
      (reason) => active && setLoadError(errorMessage(reason, "A fizetési papír nem tölthető be.")));
    return () => {
      active = false;
    };
  }, [month, userId, validMonth]);

  useEffect(() => {
    if (slip) document.title = `Fizetési papír – ${slip.member.full_name} – ${monthLabel(slip.month)}`;
    return () => {
      document.title = "SFSD Intranet";
    };
  }, [slip]);

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate("/finance?tab=payroll"));

  if (error || slip === null) {
    return (
      <div className="flex flex-col items-center gap-3 p-8 text-center">
        <p className="text-sm text-red-300">{error ?? "Erre a hónapra nincs lezárt fizetési papír."}</p>
        <Button variant="outline" onClick={back}><ArrowLeft className="size-4"/> Vissza</Button>
      </div>
    );
  }
  if (slip === undefined) return <div className="flex justify-center py-24"><Loader2 className="size-8 animate-spin text-slate-500"/></div>;

  const row = slip.row;
  return (
    <div className="mx-auto w-full max-w-[860px]">
      <div className="mb-4 flex items-center gap-2 print:hidden">
        <Button variant="ghost" onClick={back}><ArrowLeft className="size-4"/> Vissza</Button>
        <p className="ml-auto hidden text-xs text-slate-400 sm:block">Tipp: a nyomtatási ablakban „Mentés PDF-ként” is választható.</p>
        <Button onClick={() => window.print()} className="bg-white text-slate-900 hover:bg-slate-200"><Printer className="size-4"/> Nyomtatás / PDF</Button>
      </div>

      <article className="relative overflow-hidden rounded-sm bg-white px-10 py-10 text-[#111827] shadow-2xl print:rounded-none print:p-0 print:shadow-none">
        <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.04]">
          <SheriffStar detail="seal" className="size-[26rem]"/>
        </div>
        <header className="relative flex items-center gap-4 border-b-2 border-slate-900 pb-4">
          <SheriffStar className="size-14 shrink-0"/>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-[0.3em] text-slate-500 uppercase">San Fierro Sheriff&apos;s Department</p>
            <h1 className="text-2xl font-bold tracking-tight">Fizetési papír</h1>
            <p className="text-sm text-slate-600">{monthLabel(slip.month)}</p>
          </div>
          <div className={cn("shrink-0 rounded-md border-2 px-3 py-1.5 text-center text-xs font-bold tracking-wider uppercase",
            slip.paid ? "border-emerald-700 text-emerald-800" : "border-amber-700 text-amber-800")}>
            {slip.paid ? "Kifizetve" : "Kifizetésre vár"}
            {slip.paid && slip.paid_at && <span className="block text-[10px] font-medium tracking-normal normal-case">{formatDate(slip.paid_at)}</span>}
          </div>
        </header>

        <section className="relative mt-6 grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-3 print-break-avoid">
          <Field label="Név" value={slip.member.full_name}/>
          <Field label="Jelvényszám" value={`#${slip.member.badge_number}`}/>
          <Field label="Rendfokozat" value={row.rank}/>
          <Field label="Osztály" value={row.division}/>
          <Field label="Egység" value={row.unit ?? "–"}/>
          <Field label="Képesítés" value={row.qualification ?? "–"}/>
          <Field label="Duty idő" value={formatDuty(row.duty_minutes)}/>
          <Field label="Jelentések" value={`${row.reports} db`}/>
          {row.account_number && <Field label="Számlaszám" value={row.account_number}/>}
        </section>

        <section className="relative mt-6 print-break-avoid">
          <h2 className="mb-2 border-b border-slate-200 pb-1 text-xs font-bold tracking-[0.2em] text-slate-600 uppercase">Tételek</h2>
          <table className="w-full text-sm">
            <tbody>
              {PAY_PARTS.map((part) => (
                <tr key={part.key} className={cn("border-b border-slate-100", !row.pay[part.key] && "text-slate-400")}>
                  <td className="py-1.5 pr-3">
                    {part.label}
                    <Note>
                      {part.key === "reports" && `${row.reports} db`}
                      {part.key === "pictures" && row.pictures > 0 && `${row.pictures} db`}
                      {part.key === "training" && row.trained > 0 && `${row.trained} fő`}
                      {part.key === "top_duty" && row.top_duty > 0 && `${placeLabel(row.top_duty)} hely`}
                      {part.key === "top_report" && row.top_report > 0 && `${placeLabel(row.top_report)} hely`}
                      {part.key === "bonus" && row.bonus_note}
                    </Note>
                  </td>
                  <td className="py-1.5 text-right font-mono tabular-nums">{formatMoney(row.pay[part.key])}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-900">
                <td className="pt-2 text-base font-bold">Összesen</td>
                <td className="pt-2 text-right font-mono text-lg font-bold tabular-nums">{formatMoney(row.total)}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        <section className="relative mt-10 grid grid-cols-2 gap-10 print-break-avoid">
          <SignatureLine signature={signatureOf(slip.closed_by?.id)} name={slip.closed_by?.full_name} role="Kiállította"
                         detail={slip.closed_by?.faction_rank} date={slip.closed_at ? formatDate(slip.closed_at) : null}/>
          <SignatureLine signature={signatureOf(slip.member.id)} name={slip.member.full_name} role="Átvette"
                         detail={slip.member.faction_rank} date={slip.paid && slip.paid_at ? formatDate(slip.paid_at) : null}/>
        </section>

        <footer className="relative mt-8 border-t border-slate-200 pt-2 text-[10px] text-slate-500">
          A fizetési papír a San Fierro Sheriff&apos;s Department Intranet lezárt havi elszámolásából készült ({formatDateTime(new Date().toISOString())}).
        </footer>
      </article>
    </div>
  );
}

function Field({label, value}: {label: string; value: string | undefined}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">{label}</p>
      <p className="font-medium wrap-anywhere">{value || "–"}</p>
    </div>
  );
}

function Note({children}: {children: ReactNode}) {
  const content = [children].flat().filter((item) => item !== false && item !== null && item !== undefined && item !== "");
  if (!content.length) return null;
  return <span className="ml-2 text-xs text-slate-500">({content})</span>;
}
