import {useEffect, useState, type ReactNode} from "react";
import {Link, useNavigate, useParams} from "react-router";
import {ArrowLeft, Loader2, Printer} from "lucide-react";
import {Button} from "@/components/ui/button";
import {SheriffStar} from "@/components/brand/SheriffStar";
import {getOptimizedAvatarUrl} from "@/lib/cloudinary";
import {formatDate, formatDateTime} from "@/lib/datetime";
import {formatDuty, monthLabel} from "@/lib/registry";
import {CERTIFICATE_KIND, certificateTitle, recognitionApi, type ServiceRecord} from "@/lib/recognition";
import {UNIT_LABELS} from "@/lib/fleet";
import {errorMessage} from "@/lib/utils";
import {daysSince, formatSpan} from "./hr-utils";

const HISTORY_LABEL: Record<string, string> = {
  joined: "Felvétel",
  rank: "Rendfokozat",
  division: "Osztály",
  division_rank: "Alosztály rang",
  qualifications: "Képesítés",
  bureau_role: "Iroda",
};

/**
 * A member's service record on one page (browser print or "Save as PDF"): ranks, posts,
 * awards, warnings and commendations, the last year's duty time and reports, attendance,
 * exams and certificates. Internal notes never appear on it.
 */
export function ServiceRecordPage() {
  const {userId = ""} = useParams<{userId: string}>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<ServiceRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    recognitionApi.serviceRecord(userId).then(setRecord).catch((reason) => setError(errorMessage(reason, "A szolgálati lap nem tölthető be.")));
  }, [userId]);

  useEffect(() => {
    if (record) document.title = `Szolgálati lap – ${record.member.full_name}`;
    return () => {
      document.title = "SFSD Intranet";
    };
  }, [record]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 p-8 text-center">
        <p className="text-sm text-red-300">{error}</p>
        <Button variant="outline" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/hr"))}><ArrowLeft className="size-4"/> Vissza</Button>
      </div>
    );
  }
  if (!record) return <div className="flex justify-center py-24"><Loader2 className="size-8 animate-spin text-slate-500"/></div>;

  const member = record.member;
  const joined = record.details?.joined_on ?? member.created_at;
  const ranks = record.history.filter((item) => item.kind === "rank" || item.kind === "joined");
  const posts = record.history.filter((item) => item.kind !== "rank" && item.kind !== "joined");
  const dutyMax = Math.max(60, ...record.duty.map((entry) => entry.minutes));
  const reportsByMonth = new Map(record.reports.map((entry) => [entry.month.slice(0, 10), entry.count]));
  const months = record.duty.length ? record.duty.map((entry) => entry.month.slice(0, 10))
    : record.reports.map((entry) => entry.month.slice(0, 10));
  const roles = [
    member.is_bureau_manager && "Bureau Manager",
    member.is_bureau_commander && `${member.division} parancsnok`,
    ...(member.commanded_divisions ?? []).map((unit) => `${UNIT_LABELS[unit as keyof typeof UNIT_LABELS] ?? unit} vezető`),
  ].filter(Boolean) as string[];

  return (
    <div className="mx-auto w-full max-w-[920px]">
      <div className="mb-4 flex items-center gap-2 print:hidden">
        <Button variant="ghost" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/hr"))}><ArrowLeft className="size-4"/> Vissza</Button>
        <p className="ml-auto hidden text-xs text-slate-400 sm:block">Tipp: a nyomtatási ablakban „Mentés PDF-ként” is választható.</p>
        <Button onClick={() => window.print()} className="bg-white text-slate-900 hover:bg-slate-200"><Printer className="size-4"/> Nyomtatás / PDF</Button>
      </div>

      <article className="rounded-sm bg-white px-10 py-10 text-[#111827] shadow-2xl print:rounded-none print:p-0 print:shadow-none">
        <header className="flex items-center gap-4 border-b-2 border-slate-900 pb-4">
          <SheriffStar className="size-14 shrink-0"/>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-[0.3em] text-slate-500 uppercase">San Fierro Sheriff&apos;s Department</p>
            <h1 className="text-2xl font-bold tracking-tight">Szolgálati lap</h1>
            <p className="text-xs text-slate-500">Készült: {formatDateTime(record.generated_at)}{record.generated_by ? ` · ${record.generated_by}` : ""}</p>
          </div>
        </header>

        <section className="mt-6 flex items-start gap-5 print-break-avoid">
          <div className="size-24 shrink-0 overflow-hidden rounded-md bg-slate-100 ring-1 ring-slate-300">
            {member.avatar_url
              ? <img src={getOptimizedAvatarUrl(member.avatar_url, 192) || undefined} alt="" className="size-full object-cover"/>
              : <div className="grid size-full place-items-center text-3xl font-bold text-slate-400">{member.full_name.charAt(0)}</div>}
          </div>
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
            <Field label="Név" value={member.full_name}/>
            <Field label="Jelvényszám" value={`#${member.badge_number}`}/>
            <Field label="Rendfokozat" value={member.faction_rank}/>
            <Field label="Osztály" value={[member.division, member.division_rank].filter(Boolean).join(" · ")}/>
            <Field label="Csatlakozott" value={`${formatDate(joined)} (${formatSpan(daysSince(joined))})`}/>
            <Field label="Utolsó rangváltás" value={member.last_promotion_date ? formatDate(member.last_promotion_date) : "–"}/>
            <Field label="Képesítések" value={(member.qualifications ?? []).map((unit) => UNIT_LABELS[unit as keyof typeof UNIT_LABELS] ?? unit).join(", ") || "–"}/>
            {record.details?.station && <Field label="Kirendeltség" value={record.details.station}/>}
            {roles.length > 0 && <Field label="Vezetői feladat" value={roles.join(", ")}/>}
          </div>
        </section>

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Section title="Rendfokozatok">
            {ranks.length === 0 ? <Empty/> : (
              <ol className="relative space-y-2 border-l border-slate-300 pl-4">
                {ranks.map((item, index) => (
                  <li key={`${item.created_at}-${index}`} className="relative text-sm">
                    <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-white bg-slate-800"/>
                    <span className="font-semibold">{item.to_value ?? "–"}</span>
                    <span className="text-slate-500"> · {formatDate(item.created_at)}</span>
                    <span className="block text-xs text-slate-500">
                      {item.kind === "joined" ? "Felvétel az állományba" : item.detail === "demotion" ? `Lefokozás (${item.from_value})` : `Előléptetés (${item.from_value ?? "–"} után)`}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Section>
          <Section title="Beosztás és képesítések">
            {posts.length === 0 ? <Empty/> : (
              <ul className="space-y-1.5 text-sm">
                {posts.map((item, index) => (
                  <li key={`${item.created_at}-${index}`}>
                    <span className="text-xs font-semibold text-slate-500 uppercase">{HISTORY_LABEL[item.kind] ?? item.kind}</span>
                    <span className="text-slate-500"> · {formatDate(item.created_at)}</span>
                    <span className="block wrap-anywhere">
                      {item.kind === "qualifications"
                        ? [item.to_value && `+ ${item.to_value}`, item.from_value && `− ${item.from_value}`].filter(Boolean).join(" · ")
                        : `${item.from_value ?? "–"} → ${item.to_value ?? "–"}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Section title="Kitüntetések">
            {record.awards.length === 0 ? <Empty/> : (
              <ul className="space-y-1.5 text-sm">
                {record.awards.map((award, index) => (
                  <li key={`${award.name}-${index}`} className="flex items-center gap-2">
                    <span className="h-3 w-6 shrink-0 rounded-sm ring-1 ring-slate-300" style={{background: award.color_hex ?? "#94a3b8"}}/>
                    <span className="min-w-0 flex-1 wrap-anywhere">{award.name}</span>
                    <span className="text-xs text-slate-500">{formatDate(award.awarded_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Figyelmeztetések és dicséretek (aktív)">
            {record.records.length === 0 ? <Empty text="Nincs aktív bejegyzés."/> : (
              <ul className="space-y-1.5 text-sm">
                {record.records.map((item, index) => (
                  <li key={`${item.created_at}-${index}`} className="flex items-start gap-2">
                    <span className={item.kind === "warning" ? "font-semibold text-red-700" : "font-semibold text-emerald-700"}>
                      {item.kind === "warning" ? "Figyelmeztetés" : "Dicséret"}
                    </span>
                    <span className="min-w-0 flex-1 wrap-anywhere">{item.title}</span>
                    <span className="text-xs text-slate-500">{formatDate(item.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <Section title="Az utolsó 12 hónap" className="mt-6">
          {months.length === 0 ? <Empty/> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] tracking-wider text-slate-500 uppercase">
                  <th className="py-1 font-semibold">Hónap</th>
                  <th className="py-1 font-semibold">Duty idő</th>
                  <th className="w-1/2 py-1"><span className="sr-only">Arány</span></th>
                  <th className="py-1 text-right font-semibold">Jelentés</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {months.map((month) => {
                  const minutes = record.duty.find((entry) => entry.month.slice(0, 10) === month)?.minutes ?? null;
                  return (
                    <tr key={month}>
                      <td className="py-1">{monthLabel(month)}</td>
                      <td className="py-1 font-mono tabular-nums">{minutes === null ? "–" : formatDuty(minutes, true)}</td>
                      <td className="py-1">
                        <div className="h-2 rounded-r-sm bg-slate-800" style={{width: `${minutes === null ? 0 : Math.max(1, (minutes / dutyMax) * 100)}%`}}/>
                      </td>
                      <td className="py-1 text-right tabular-nums">{reportsByMonth.get(month) ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="mt-2 text-xs text-slate-500">
            Eseményrészvétel (180 nap): {record.attendance.total ? `${record.attendance.attended} / ${record.attendance.total} rögzített esemény` : "nincs rögzített esemény"}
          </p>
        </Section>

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Section title="Sikeres vizsgák">
            {record.exams.length === 0 ? <Empty/> : (
              <ul className="space-y-1 text-sm">
                {record.exams.map((exam, index) => (
                  <li key={`${exam.title}-${index}`} className="flex gap-2">
                    <span className="min-w-0 flex-1 wrap-anywhere">{exam.title}</span>
                    {exam.percentage !== null && <span className="tabular-nums text-slate-600">{exam.percentage}%</span>}
                    <span className="text-xs text-slate-500">{exam.graded_at ? formatDate(exam.graded_at) : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Oklevelek">
            {record.certificates.length === 0 ? <Empty/> : (
              <ul className="space-y-1 text-sm">
                {record.certificates.map((certificate) => (
                  <li key={certificate.code} className="flex gap-2">
                    <span className="min-w-0 flex-1 wrap-anywhere">{certificateTitle(certificate)}
                      <span className="text-xs text-slate-500"> · {CERTIFICATE_KIND[certificate.kind].label}</span></span>
                    <span className="font-mono text-xs text-slate-600">{certificate.code}</span>
                  </li>
                ))}
              </ul>
            )}
            {record.certificates.length > 0 && (
              <p className="mt-2 text-[11px] text-slate-500">Az oklevelek hitelessége a kóddal ellenőrizhető: {window.location.origin}/certificates</p>
            )}
          </Section>
        </div>

        <footer className="mt-10 flex items-end justify-between gap-6 border-t border-slate-300 pt-4 text-xs text-slate-500 print-break-avoid">
          <span>A szolgálati lap a FrakHub adataiból készült; a belső feljegyzéseket nem tartalmazza.</span>
          <span className="w-48 border-t border-slate-400 pt-1 text-center">Aláírás</span>
        </footer>
      </article>
      <p className="mt-4 text-center text-xs text-slate-500 print:hidden">
        <Link to={`/hr?member=${member.id}`} className="hover:text-white">Megnyitás a Személyügyben</Link>
      </p>
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

function Section({title, children, className}: {title: string; children: ReactNode; className?: string}) {
  return (
    <section className={`print-break-avoid ${className ?? ""}`}>
      <h2 className="mb-2 border-b border-slate-200 pb-1 text-xs font-bold tracking-[0.2em] text-slate-600 uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Empty({text = "Nincs adat."}: {text?: string}) {
  return <p className="text-sm text-slate-400">{text}</p>;
}
