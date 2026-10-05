import {Fragment, useCallback, useEffect, useMemo, useState} from "react";
import {Link as RouterLink} from "react-router";
import {toast} from "sonner";
import {ChevronDown, ChevronLeft, ChevronRight, Download, ExternalLink, FilePlus2, Medal, Search, Trash2, Wallet} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {useAuth} from "@/context/AuthContext";
import {addMonths, formatDate, monthKey, todayKey} from "@/lib/datetime";
import {useProfileDirectory} from "@/lib/profile-directory";
import {monthLabel} from "@/lib/registry";
import {reportLog, reportLogError, type ReportLog} from "@/lib/report-log";
import {downloadCsv} from "@/lib/csv";
import {cn, getRankPriority} from "@/lib/utils";
import {MemberAvatar} from "@/pages/finance/components/MemberAvatar";
import {LogReportDialog} from "./LogReportDialog";

const MEDAL = ["text-amber-300", "text-slate-200", "text-orange-400"];

/**
 * The month's reports per member for the leadership: the count the payroll uses, with the
 * forum links to check them. Members with no report are listed too.
 */
export function MonthlySummaryTab({canPayroll}: {canPayroll: boolean}) {
  const {user} = useAuth();
  const {profiles} = useProfileDirectory();
  const [month, setMonth] = useState(monthKey());
  const [entries, setEntries] = useState<ReportLog[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [term, setTerm] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      setEntries(await reportLog.month(month));
    } catch {
      toast.error("Az összesítő betöltése nem sikerült.");
      setEntries([]);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const byUser = new Map<string, ReportLog[]>();
    (entries ?? []).forEach((entry) => byUser.set(entry.user_id, [...(byUser.get(entry.user_id) ?? []), entry]));
    const needle = term.trim().toLowerCase();
    const list = profiles
      .filter((profile) => profile.system_role !== "pending" || byUser.has(profile.id))
      .map((profile) => ({profile, logs: byUser.get(profile.id) ?? []}))
      .filter((row) => !needle || row.profile.full_name.toLowerCase().includes(needle) || row.profile.badge_number.includes(needle))
      .sort((a, b) => b.logs.length - a.logs.length || getRankPriority(a.profile.faction_rank) - getRankPriority(b.profile.faction_rank)
        || a.profile.full_name.localeCompare(b.profile.full_name, "hu"));
    const counts = list.map((row) => row.logs.length);
    return list.map((row) => ({...row, place: row.logs.length ? 1 + counts.filter((count) => count > row.logs.length).length : null}));
  }, [entries, profiles, term]);

  const total = entries?.length ?? 0;
  const linked = entries?.filter((entry) => entry.forum_url).length ?? 0;
  const reporting = rows.filter((row) => row.logs.length > 0).length;

  const remove = async (entry: ReportLog) => {
    if (!window.confirm(`Törlöd a bejegyzést? (${entry.title})`)) return;
    try {
      await reportLog.remove(entry.id);
      setEntries((current) => current?.filter((item) => item.id !== entry.id) ?? current);
    } catch (error) {
      toast.error(reportLogError(error));
    }
  };

  const exportCsv = () => downloadCsv(`sfsd-jelentesek-${month.slice(0, 7)}-${todayKey()}.csv`, [
    ["Név", "Jelvényszám", "Rendfokozat", "Jelentések", "Fórum-linkkel", "Helyezés"],
    ...rows.map((row) => [row.profile.full_name, row.profile.badge_number, row.profile.faction_rank, row.logs.length,
      row.logs.filter((log) => log.forum_url).length, row.place ?? ""]),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label="Előző hónap" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft/></Button>
          <p className="min-w-40 text-center text-lg font-semibold text-white">{monthLabel(month)}</p>
          <Button size="icon" variant="ghost" aria-label="Következő hónap" disabled={month === monthKey()} onClick={() => setMonth(addMonths(month, 1))}><ChevronRight/></Button>
        </div>
        <p className="text-sm text-slate-400">
          <span className="font-semibold text-white">{total}</span> jelentés · <span className="font-semibold text-white">{reporting}</span> tagtól ·{" "}
          <span className="text-emerald-300">{linked}</span> fórum-linkkel
        </p>
        <div className="flex flex-wrap gap-2 lg:ml-auto">
          {canPayroll && <Button variant="outline" asChild><RouterLink to="/finance?tab=payroll"><Wallet/> Havi fizetés</RouterLink></Button>}
          <Button variant="outline" onClick={exportCsv}><Download/> CSV</Button>
          <Button onClick={() => setAdding(true)}><FilePlus2/> Rögzítés tag nevében</Button>
        </div>
      </div>

      <section className="panel overflow-hidden">
        <div className="border-b border-white/5 p-4">
          <div className="relative max-w-xs">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
            <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Név vagy jelvényszám…" className="pl-9"/>
          </div>
        </div>
        {entries === null ? (
          <div className="space-y-2 p-4">{Array.from({length: 5}, (_, index) => <div key={index} className="skeleton h-12"/>)}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="w-14 px-4 py-2.5 text-center">Hely</th>
                <th className="px-3 py-2.5">Tag</th>
                <th className="px-3 py-2.5 text-center">Jelentés</th>
                <th className="hidden px-3 py-2.5 text-center sm:table-cell">Fórum-linkkel</th>
                <th className="hidden px-3 py-2.5 md:table-cell">Utolsó</th>
                <th className="w-10 px-4 py-2.5"/>
              </tr>
            </thead>
            <tbody>
              {rows.map(({profile, logs, place}) => {
                const expanded = open === profile.id;
                return (
                  <Fragment key={profile.id}>
                    <tr className={cn("border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]", logs.length > 0 && "cursor-pointer", !logs.length && "opacity-60")}
                        onClick={() => logs.length > 0 && setOpen(expanded ? null : profile.id)}>
                      <td className="px-4 py-2 text-center">
                        {place && place <= 3 ? <Medal className={cn("mx-auto size-4", MEDAL[place - 1])}/> : <span className="font-mono text-xs text-slate-500">{place ?? "–"}</span>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <MemberAvatar name={profile.full_name} avatarUrl={profile.avatar_url} size={28}/>
                          <span className="min-w-0">
                            <span className="block truncate text-white">{profile.full_name}</span>
                            <span className="block truncate text-[11px] text-slate-500">{profile.faction_rank} · #{profile.badge_number}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-base font-semibold tabular-nums text-white">{logs.length}</td>
                      <td className="hidden px-3 py-2 text-center font-mono tabular-nums text-slate-300 sm:table-cell">{logs.filter((log) => log.forum_url).length}</td>
                      <td className="hidden px-3 py-2 text-xs text-slate-400 md:table-cell">{logs[0] ? formatDate(logs[0].occurred_on) : "–"}</td>
                      <td className="px-4 py-2">{logs.length > 0 && <ChevronDown className={cn("size-4 text-slate-500 transition-transform", expanded && "rotate-180")}/>}</td>
                    </tr>
                    {expanded && (
                      <tr className="border-b border-white/[0.04] bg-white/[0.015]">
                        <td/>
                        <td colSpan={5} className="px-3 pt-1 pb-3">
                          <ul className="animate-fade space-y-1">
                            {logs.map((log) => (
                              <li key={log.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 text-xs hover:bg-white/[0.03]">
                                <span className="w-20 shrink-0 font-mono text-slate-400">{formatDate(log.occurred_on)}</span>
                                <span className="min-w-0 flex-1 truncate text-slate-200">{log.title}</span>
                                {log.forum_url
                                  ? <a href={log.forum_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-300 hover:underline"><ExternalLink className="size-3"/> Fórum</a>
                                  : <span className="text-slate-600">nincs link</span>}
                                <button type="button" onClick={() => void remove(log)} aria-label="Törlés" className="rounded p-1 text-slate-500 hover:bg-red-500/10 hover:text-red-300">
                                  <Trash2 className="size-3.5"/>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {adding && user && (
        <LogReportDialog userId={user.id} pickMember defaultDate={month === monthKey() ? undefined : month}
                         onClose={() => setAdding(false)}
                         onSaved={() => {
                           setAdding(false);
                           void load();
                         }}/>
      )}
    </div>
  );
}
