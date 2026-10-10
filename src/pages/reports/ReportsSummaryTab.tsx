import {useEffect, useMemo, useState, type CSSProperties} from "react";
import {Link as RouterLink, useNavigate, useSearchParams} from "react-router";
import {toast} from "sonner";
import {CheckCircle2, CircleDashed, Download, FileText, Medal, Search, Users, Wallet} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {MemberAvatar} from "@/components/MemberAvatar";
import {useAuth} from "@/context/AuthContext";
import {downloadCsv} from "@/lib/csv";
import {formatDate, todayKey} from "@/lib/datetime";
import {periodLabel, reportError, reportsApi, type ReportOverview} from "@/lib/reports";
import {cn, isExecutive} from "@/lib/utils";
import {PeriodBanner, PeriodSelect} from "./report-ui";

const MEDAL = ["text-amber-300", "text-slate-200", "text-orange-400"];

/**
 * A payroll month's reports per member (everyone sees it, as every report): the count the payroll
 * uses, whether the requirement is met, and the lock of the month. A row opens the member's reports.
 */
export function ReportsSummaryTab() {
  const {profile} = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const periodParam = searchParams.get("period");
  // The overview with the month it was asked for: another month shows the skeleton until it arrives.
  const [loaded, setLoaded] = useState<{period: string | null; data: ReportOverview} | null>(null);
  const data = loaded && loaded.period === periodParam ? loaded.data : null;
  const [term, setTerm] = useState("");
  const canPayroll = !!profile && (isExecutive(profile) || !!profile.is_bureau_manager);

  useEffect(() => {
    let active = true;
    reportsApi.overview(periodParam).then((result) => active && setLoaded({period: periodParam, data: result})).catch((error) => {
      if (active) toast.error(reportError(error));
    });
    return () => {
      active = false;
    };
  }, [periodParam]);

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = term.trim().toLowerCase();
    const counts = data.members.map((member) => member.counted);
    return data.members
      .map((member) => ({...member, place: member.counted > 0 ? 1 + counts.filter((count) => count > member.counted).length : null}))
      .filter((member) => !needle || member.full_name.toLowerCase().includes(needle) || member.badge_number.includes(needle));
  }, [data, term]);

  const setPeriod = (period: string | null) => setSearchParams((params) => {
    const next = new URLSearchParams(params);
    if (!period || period === data?.current) next.delete("period");
    else next.set("period", period);
    return next;
  }, {replace: true});

  const minReports = data?.min_reports ?? 0;
  const reporting = data?.members.filter((member) => member.counted > 0).length ?? 0;
  const done = minReports > 0 ? data?.members.filter((member) => member.counted >= minReports).length ?? 0 : null;

  const exportCsv = () => data && downloadCsv(`sfsd-jelentesek-${data.period.slice(0, 7)}-${todayKey()}.csv`, [
    ["Név", "Jelvényszám", "Rendfokozat", "Jelentések (az oldalon)", "Érvénytelen", "A fizetés számolja", "Vezetőség rögzítette", "Utolsó"],
    ...data.members.map((member) => [member.full_name, member.badge_number, member.faction_rank, member.reports, member.voided, member.counted,
      member.recorded ? "igen" : "", member.last_on ?? ""]),
  ]);

  return (
    <div data-tour="reports-summary" className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <PeriodSelect value={data?.period ?? periodParam} periods={data?.periods.map((item) => item.period) ?? []} onChange={setPeriod}/>
        <div className="relative min-w-0 flex-1 lg:max-w-xs">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
          <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Név vagy jelvényszám…" className="pl-9"/>
        </div>
        {canPayroll && (
          <div className="flex flex-wrap gap-2 lg:ml-auto">
            <Button variant="outline" asChild><RouterLink to="/finance?tab=payroll"><Wallet/> Havi fizetés</RouterLink></Button>
            <Button variant="outline" onClick={exportCsv} disabled={!data}><Download/> CSV</Button>
          </div>
        )}
      </div>

      {data && <PeriodBanner period={data.period} current={data.current} locked={data.locked} lockedAt={data.locked_at} startedAt={data.started_at}/>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat index={0} icon={FileText} value={data?.total} label={data ? `jelentés: ${periodLabel(data.period)}` : "jelentés"}
              hint={data?.voided ? `${data.voided} érvénytelen nem számít` : undefined}/>
        <Stat index={1} icon={Users} value={data ? reporting : undefined} label="tag írt jelentést"/>
        <Stat index={2} icon={CheckCircle2} value={done ?? undefined} label={minReports ? `tag teljesítette a ${minReports} jelentést` : "nincs havi követelmény"}/>
      </div>

      <section className="panel overflow-hidden">
        {data === null ? (
          <div className="space-y-2 p-4">{Array.from({length: 5}, (_, index) => <div key={index} className="skeleton h-12"/>)}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="w-14 px-4 py-2.5 text-center">Hely</th>
                <th className="px-3 py-2.5">Tag</th>
                <th className="px-3 py-2.5 text-center">Jelentés</th>
                <th className="hidden px-3 py-2.5 text-center sm:table-cell">Követelmény</th>
                <th className="hidden px-3 py-2.5 md:table-cell">Utolsó</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((member) => (
                <tr key={member.user_id} tabIndex={0} role="link" aria-label={`${member.full_name} jelentései`}
                    onClick={() => navigate(`/reports?tab=list&period=${data.period}&user=${member.user_id}`)}
                    onKeyDown={(event) => event.key === "Enter" && navigate(`/reports?tab=list&period=${data.period}&user=${member.user_id}`)}
                    className={cn("cursor-pointer border-b border-white/[0.04] transition-colors hover:bg-white/[0.03]", member.counted === 0 && "opacity-60")}>
                  <td className="px-4 py-2 text-center">
                    {member.place && member.place <= 3 ? <Medal className={cn("mx-auto size-4", MEDAL[member.place - 1])}/>
                      : <span className="font-mono text-xs text-slate-500">{member.place ?? "–"}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <MemberAvatar name={member.full_name} avatarUrl={member.avatar_url} size={28}/>
                      <span className="min-w-0">
                        <span className="block truncate text-white">{member.full_name}</span>
                        <span className="block truncate text-[11px] text-slate-500">{member.faction_rank} · #{member.badge_number}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="font-mono text-base font-semibold tabular-nums text-white">{member.counted}</span>
                    {member.recorded && member.counted !== member.reports && (
                      <span className="block text-[10px] text-slate-500" title="A vezetőség a fizetésnél ezt a számot rögzítette">rögzítve · oldalon {member.reports}</span>
                    )}
                    {member.voided > 0 && <span className="block text-[10px] text-red-300/80">+{member.voided} érvénytelen</span>}
                  </td>
                  <td className="hidden px-3 py-2 text-center sm:table-cell">
                    {minReports > 0 && (member.counted >= minReports
                      ? <CheckCircle2 className="mx-auto size-4 text-emerald-400" aria-label="Teljesítve"/>
                      : <span className="inline-flex items-center gap-1 text-[11px] text-slate-400"><CircleDashed className="size-3.5"/> még {minReports - member.counted}</span>)}
                  </td>
                  <td className="hidden px-3 py-2 text-xs text-slate-400 md:table-cell">{member.last_on ? formatDate(member.last_on) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Stat({index, icon: Icon, value, label, hint}: {index: number; icon: typeof FileText; value: number | undefined; label: string; hint?: string}) {
  return (
    <div className="panel animate-rise flex items-center gap-3 p-4" style={{"--i": index} as CSSProperties}>
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-300 ring-1 ring-sky-500/25"><Icon className="size-5"/></div>
      <div className="min-w-0">
        <p className="text-2xl font-semibold tabular-nums text-white">{value ?? "–"}</p>
        <p className="truncate text-xs text-slate-400">{label}</p>
        {hint && <p className="truncate text-[11px] text-red-300/80">{hint}</p>}
      </div>
    </div>
  );
}
