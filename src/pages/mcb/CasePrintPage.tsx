import {useEffect, useMemo, useState} from "react";
import {Link, useParams} from "react-router";
import {ArrowLeft, FileText, Loader2, Printer} from "lucide-react";
import {Button} from "@/components/ui/button";
import {SheriffStar} from "@/components/brand/SheriffStar";
import {withTransformation} from "@/lib/cloudinary";
import {formatDate, formatDateTime} from "@/lib/datetime";
import {
  CASE_STATUS, CATEGORY, COLLABORATOR_ROLE, PRIORITY, WARRANT_STATUS, WARRANT_TYPE, evidenceNumbers, involvementLook, isRemoteFile, mcbApi,
  suspectStatusLook, warrantTarget, type CaseDetail,
} from "@/lib/mcb";
import {errorMessage} from "@/lib/utils";
import {CaseDocumentReader} from "./components/CaseEditor";
import {BRAND_IMAGES} from "@/lib/brand";
import {SignatureLine} from "@/components/signature/SignatureLine";
import {useAuth} from "@/context/AuthContext";
import {useSignatures} from "@/lib/signature/api";

/**
 * The whole case as a printable file (browser print or "Save as PDF"): data sheet, people,
 * team, the document, the evidence and the warrants. Archiving or closing a case is a good
 * moment to save one.
 */
export function CasePrintPage() {
  const {caseId = ""} = useParams<{caseId: string}>();
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {profile: viewer} = useAuth();
  const signatureOf = useSignatures([detail?.owner?.id, viewer?.id]);

  useEffect(() => {
    mcbApi.detail(caseId).then(setDetail).catch((reason) => setError(errorMessage(reason)));
  }, [caseId]);

  useEffect(() => {
    if (detail) document.title = `${detail.case.case_number} – ${detail.case.title}`;
    return () => {
      document.title = "SFSD Intranet";
    };
  }, [detail]);

  const numbers = useMemo(() => evidenceNumbers(detail?.evidence ?? []), [detail?.evidence]);
  const evidence = useMemo(() => [...(detail?.evidence ?? [])].sort((a, b) => (numbers.get(a.id) ?? 0) - (numbers.get(b.id) ?? 0)),
    [detail?.evidence, numbers]);

  if (error) return <p className="p-8 text-center text-sm text-red-300">{error}</p>;
  if (!detail) return <div className="flex justify-center py-24"><Loader2 className="size-8 animate-spin text-slate-500"/></div>;

  const item = detail.case;
  return (
    <div className="mx-auto w-full max-w-[920px]">
      <div className="mb-4 flex items-center gap-2 print:hidden">
        <Button variant="ghost" asChild><Link to={`/mcb/case/${caseId}`}><ArrowLeft className="size-4"/> Vissza az aktához</Link></Button>
        <p className="ml-auto hidden text-xs text-slate-400 sm:block">Tipp: a nyomtatási ablakban „Mentés PDF-ként” is választható.</p>
        <Button onClick={() => window.print()} className="bg-white text-slate-900 hover:bg-slate-200"><Printer className="size-4"/> Nyomtatás / PDF</Button>
      </div>

      <article className="rounded-sm bg-white px-10 py-10 text-[#111827] shadow-2xl print:rounded-none print:p-0 print:shadow-none">
        <header className="flex items-center gap-4 border-b-2 border-slate-900 pb-4">
          <SheriffStar className="size-14 shrink-0"/>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-[0.3em] text-slate-500 uppercase">San Fierro Sheriff&apos;s Department · Major Crimes Bureau</p>
            <h1 className="text-2xl font-bold tracking-tight wrap-anywhere">{item.title}</h1>
            <p className="font-mono text-sm text-slate-600">{item.case_number}</p>
          </div>
          <img src={BRAND_IMAGES.mcb} alt="" className="size-14 shrink-0 object-contain"/>
        </header>

        <section className="mt-5 grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm sm:grid-cols-3 print-break-avoid">
          <Field label="Státusz" value={CASE_STATUS[item.status]?.label}/>
          <Field label="Prioritás" value={PRIORITY[item.priority]?.label}/>
          <Field label="Ügytípus" value={item.category ? CATEGORY[item.category]?.label : "–"}/>
          <Field label="Vezető nyomozó" value={detail.owner ? `${detail.owner.full_name} (#${detail.owner.badge_number})` : "–"}/>
          <Field label="Megnyitva" value={formatDate(item.created_at)}/>
          <Field label={item.closed_at ? "Lezárva" : "Utolsó mentés"} value={formatDate(item.closed_at ?? item.updated_at)}/>
        </section>

        {item.description && (
          <section className="mt-5 print-break-avoid">
            <SectionTitle>Összefoglaló</SectionTitle>
            <p className="text-sm leading-relaxed whitespace-pre-wrap wrap-anywhere">{item.description}</p>
          </section>
        )}

        {detail.people.length > 0 && (
          <section className="mt-5 print-break-avoid">
            <SectionTitle>Érintett személyek</SectionTitle>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-300 text-left text-xs text-slate-500"><th className="py-1">Név</th><th>Szerep</th><th>Státusz</th><th>Megjegyzés</th></tr></thead>
              <tbody>
                {detail.people.map((link) => (
                  <tr key={link.id} className="border-b border-slate-100 align-top">
                    <td className="py-1 pr-3 font-medium">{link.suspect?.full_name}{link.suspect?.alias ? ` („${link.suspect.alias}”)` : ""}</td>
                    <td className="pr-3">{involvementLook(link.involvement_type).label}</td>
                    <td className="pr-3">{suspectStatusLook(link.suspect?.status).label}</td>
                    <td className="wrap-anywhere">{link.notes ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {detail.collaborators.length > 0 && (
          <section className="mt-5 print-break-avoid">
            <SectionTitle>Közreműködők</SectionTitle>
            <p className="text-sm">{detail.collaborators.map((collaborator) =>
              `${collaborator.profile?.full_name ?? "?"} (${COLLABORATOR_ROLE[collaborator.role]?.label.toLowerCase() ?? collaborator.role})`).join(", ")}</p>
          </section>
        )}

        <section className="mt-6">
          <SectionTitle>Nyomozati dokumentum</SectionTitle>
          <div className="-mx-3">
            <CaseDocumentReader content={item.body} evidence={detail.evidence} numbers={numbers}/>
          </div>
        </section>

        {evidence.length > 0 && (
          <section className="mt-6">
            <SectionTitle>Bizonyítékok jegyzéke</SectionTitle>
            <ul className="grid grid-cols-3 gap-3">
              {evidence.map((entry) => (
                <li key={entry.id} className="print-break-avoid overflow-hidden rounded border border-slate-200">
                  {entry.file_type === "image" && isRemoteFile(entry.file_path) ? (
                    <img src={withTransformation(entry.file_path, "c_limit,w_600,q_auto,f_auto")} alt="" className="aspect-[4/3] w-full object-cover"/>
                  ) : (
                    <div className="grid aspect-[4/3] place-items-center bg-slate-50 text-slate-400"><FileText className="size-8"/></div>
                  )}
                  <p className="px-2 py-1 text-xs"><span className="font-mono font-bold">#{numbers.get(entry.id)}</span> {entry.file_name}</p>
                  <p className="px-2 pb-1 text-[10px] text-slate-500">{formatDateTime(entry.created_at)}{entry.uploader_name ? ` · ${entry.uploader_name}` : ""}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {detail.warrants.length > 0 && (
          <section className="mt-6 print-break-avoid">
            <SectionTitle>Parancsok</SectionTitle>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-300 text-left text-xs text-slate-500"><th className="py-1">Típus</th><th>Célpont</th><th>Indoklás</th><th>Állapot</th></tr></thead>
              <tbody>
                {detail.warrants.map((warrant) => (
                  <tr key={warrant.id} className="border-b border-slate-100 align-top">
                    <td className="py-1 pr-3">{WARRANT_TYPE[warrant.type].label}</td>
                    <td className="pr-3">{warrantTarget(warrant)}</td>
                    <td className="pr-3 wrap-anywhere">{warrant.reason}</td>
                    <td>{WARRANT_STATUS[warrant.status].label}{warrant.approver ? ` (${warrant.approver.full_name})` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 print-break-avoid">
          <SignatureLine signature={signatureOf(detail.owner?.id)} name={detail.owner?.full_name} role="Vezető nyomozó"
                         detail={detail.owner ? `${detail.owner.faction_rank ?? ""}${detail.owner.badge_number ? ` · #${detail.owner.badge_number}` : ""}` : null}/>
          {viewer && viewer.id !== detail.owner?.id && (
            <SignatureLine signature={signatureOf(viewer.id)} name={viewer.full_name} role="Kinyomtatta"
                           detail={`${viewer.faction_rank} · #${viewer.badge_number}`} date={formatDateTime(new Date())}/>
          )}
        </section>

        <footer className="mt-8 border-t border-slate-300 pt-2 text-[10px] text-slate-500">
          Kinyomtatva: {formatDateTime(new Date())} · San Fierro Sheriff&apos;s Department Intranet · Belső használatra
        </footer>
      </article>
    </div>
  );
}

function Field({label, value}: {label: string; value: string | undefined}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">{label}</p>
      <p className="truncate font-medium">{value ?? "–"}</p>
    </div>
  );
}

function SectionTitle({children}: {children: string}) {
  return <h2 className="mb-2 border-b border-slate-200 pb-1 text-xs font-bold tracking-[0.2em] text-slate-600 uppercase">{children}</h2>;
}
