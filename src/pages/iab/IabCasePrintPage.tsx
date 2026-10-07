import {useEffect, useMemo, useState, type ReactNode} from "react";
import {Link, useParams} from "react-router";
import {ArrowLeft, Loader2, Printer} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Switch} from "@/components/ui/switch";
import {SheriffStar} from "@/components/brand/SheriffStar";
import {SignatureLine} from "@/components/signature/SignatureLine";
import {useAuth} from "@/context/AuthContext";
import {formatDate, formatDateTime} from "@/lib/datetime";
import {IAB_ENTRY_KINDS, IAB_OUTCOMES, IAB_PRIORITY, IAB_ROLES, IAB_TITLES, iabApi, type IabCaseDetail, type IabPerson} from "@/lib/iab";
import {useSignatures} from "@/lib/signature/api";
import {errorMessage} from "@/lib/utils";

const rankLine = (person: IabPerson | null) =>
  person ? [person.iab_title ? IAB_TITLES[person.iab_title] : null, person.faction_rank, `#${person.badge_number}`].filter(Boolean).join(" · ") : null;

/**
 * An investigation on paper (browser print or "Save as PDF"): the file's data, the members it
 * concerns, the memos and interviews with their writers' signatures, the closure signed by the one
 * who closed it. Internal notes only when asked for.
 */
export function IabCasePrintPage() {
  const {caseId = ""} = useParams<{caseId: string}>();
  const {profile: viewer} = useAuth();
  const [data, setData] = useState<IabCaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState(false);

  useEffect(() => {
    iabApi.detail(caseId).then(setData).catch((reason) => setError(errorMessage(reason, "A vizsgálat nem tölthető be.")));
  }, [caseId]);

  useEffect(() => {
    if (data) document.title = `${data.case.case_number} – ${data.case.title}`;
    return () => {
      document.title = "SFSD Intranet";
    };
  }, [data]);

  const entries = useMemo(() => data?.entries.filter((entry) => notes || IAB_ENTRY_KINDS[entry.kind].printed) ?? [], [data, notes]);
  const signatureOf = useSignatures([...entries.map((entry) => entry.author?.id), data?.case.closed_by?.id, data?.case.lead?.id, viewer?.id]);

  if (error) return <p className="p-8 text-center text-sm text-red-300">{error}</p>;
  if (!data) return <div className="flex justify-center py-24"><Loader2 className="size-8 animate-spin text-slate-500"/></div>;

  const item = data.case;
  const outcome = item.outcome ? IAB_OUTCOMES[item.outcome] : null;

  return (
    <div className="mx-auto w-full max-w-[920px]">
      <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
        <Button variant="ghost" asChild><Link to={`/iab/case/${caseId}`}><ArrowLeft className="size-4"/> Vissza a vizsgálathoz</Link></Button>
        <label className="ml-auto flex items-center gap-2 text-xs text-slate-300"><Switch checked={notes} onCheckedChange={setNotes}/> Belső megjegyzésekkel</label>
        <Button onClick={() => window.print()} className="bg-white text-slate-900 hover:bg-slate-200"><Printer className="size-4"/> Nyomtatás / PDF</Button>
      </div>

      <article className="relative overflow-hidden rounded-sm bg-white px-10 py-10 text-[#111827] shadow-2xl print:rounded-none print:p-0 print:shadow-none">
        <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[24deg] text-[110px] font-black tracking-[0.2em] text-slate-900/[0.035] select-none">
          BIZALMAS
        </div>
        <header className="relative flex items-center gap-4 border-b-2 border-slate-900 pb-4">
          <SheriffStar className="size-14 shrink-0"/>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-[0.3em] text-slate-500 uppercase">San Fierro Sheriff&apos;s Department · Internal Affairs Bureau</p>
            <h1 className="text-2xl font-bold tracking-tight wrap-anywhere">{item.title}</h1>
            <p className="font-mono text-sm text-slate-600">{item.case_number}</p>
          </div>
          <div className="grid size-14 shrink-0 place-items-center rounded-full border-2 border-slate-900 text-center text-[10px] leading-tight font-black tracking-widest">
            IAB
          </div>
        </header>

        <section className="relative mt-5 grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm sm:grid-cols-3 print-break-avoid">
          <Field label="Állapot" value={outcome ? `Lezárva – ${outcome.label}` : "Folyamatban"}/>
          <Field label="Sürgősség" value={IAB_PRIORITY[item.priority].label}/>
          <Field label="Vizsgálatvezető" value={item.lead ? `${item.lead.full_name}${item.lead.iab_title ? ` (${IAB_TITLES[item.lead.iab_title]})` : ""}` : "–"}/>
          <Field label="Megnyitva" value={`${formatDate(item.opened_at)} · ${item.opened_by?.full_name ?? "–"}`}/>
          <Field label="Lezárva" value={item.closed_at ? `${formatDate(item.closed_at)} · ${item.closed_by?.full_name ?? "–"}` : "–"}/>
        </section>

        {item.summary && (
          <section className="relative mt-5 print-break-avoid">
            <SectionTitle>Összefoglaló</SectionTitle>
            <p className="text-sm leading-relaxed whitespace-pre-wrap wrap-anywhere">{item.summary}</p>
          </section>
        )}

        {data.people.length > 0 && (
          <section className="relative mt-5 print-break-avoid">
            <SectionTitle>Érintett tagok</SectionTitle>
            <table className="w-full text-sm">
              <tbody>
                {data.people.map((person) => (
                  <tr key={person.user_id} className="border-b border-slate-100">
                    <td className="py-1 pr-3 font-medium">{IAB_ROLES[person.role].label}</td>
                    <td className="pr-3">{person.person.full_name}</td>
                    <td className="pr-3 text-slate-600">{person.person.faction_rank} · #{person.person.badge_number}</td>
                    <td className="text-slate-600 wrap-anywhere">{person.note ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {entries.length > 0 && (
          <section className="relative mt-6">
            <SectionTitle>Iratok</SectionTitle>
            <div className="space-y-6">
              {entries.map((entry) => (
                <div key={entry.id} className="print-break-avoid">
                  <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                    {IAB_ENTRY_KINDS[entry.kind].label} · {formatDateTime(entry.created_at)}
                  </p>
                  {entry.title && <h3 className="mt-0.5 font-semibold wrap-anywhere">{entry.title}</h3>}
                  <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap wrap-anywhere">{entry.body}</p>
                  {entry.kind !== "note" && (
                    <SignatureLine signature={signatureOf(entry.author?.id)} name={entry.author?.full_name} role="Internal Affairs Bureau"
                                   detail={rankLine(entry.author)} align="left" className="mt-2 max-w-xs"/>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {data.mail.length > 0 && (
          <section className="relative mt-6 print-break-avoid">
            <SectionTitle>Csatolt levelezés</SectionTitle>
            <ul className="space-y-0.5 text-sm">
              {data.mail.map((thread) => <li key={thread.thread_id}>{thread.subject} <span className="text-slate-500">({thread.message_count} levél, utolsó: {formatDate(thread.last_message_at)})</span></li>)}
            </ul>
          </section>
        )}

        {item.status === "closed" && outcome && (
          <section className="relative mt-8 rounded-sm border-2 border-slate-900 p-4 print-break-avoid">
            <p className="text-[11px] font-semibold tracking-[0.25em] text-slate-500 uppercase">Az Internal Affairs Bureau megállapítása</p>
            <p className="mt-1 text-lg font-bold">{outcome.label}</p>
            <p className="text-xs text-slate-600">{outcome.text}</p>
            <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap wrap-anywhere">{item.closure}</p>
            <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-2">
              <SignatureLine signature={signatureOf(item.closed_by?.id)} name={item.closed_by?.full_name} role="Lezárta"
                             detail={rankLine(item.closed_by)} date={item.closed_at ? formatDate(item.closed_at) : null}/>
              {item.lead && item.lead.id !== item.closed_by?.id && (
                <SignatureLine signature={signatureOf(item.lead.id)} name={item.lead.full_name} role="Vizsgálatvezető" detail={rankLine(item.lead)}/>
              )}
            </div>
          </section>
        )}

        <footer className="relative mt-8 border-t border-slate-300 pt-2 text-[10px] text-slate-500">
          BIZALMAS · Belső vizsgálati irat · Kinyomtatta: {viewer?.full_name ?? "–"}, {formatDateTime(new Date())} · San Fierro Sheriff&apos;s Department Intranet
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

function SectionTitle({children}: {children: ReactNode}) {
  return <h2 className="mb-2 border-b border-slate-300 pb-1 text-xs font-bold tracking-[0.2em] text-slate-700 uppercase">{children}</h2>;
}
