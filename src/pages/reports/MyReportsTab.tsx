import {useCallback, useEffect, useState, type CSSProperties} from "react";
import {toast} from "sonner";
import {ChevronLeft, ChevronRight, ExternalLink, FilePlus2, FileText, Link2, Pencil, Trash2, Wand2} from "lucide-react";
import {Button} from "@/components/ui/button";
import {EmptyState} from "@/components/layout/EmptyState";
import {useAuth} from "@/context/AuthContext";
import {addMonths, formatDate, monthKey} from "@/lib/datetime";
import {monthLabel} from "@/lib/registry";
import {reportLog, reportLogError, type ReportLog} from "@/lib/report-log";
import {cn} from "@/lib/utils";
import {LogReportDialog} from "./LogReportDialog";

/** The member's recorded reports month by month (what the payroll counts). */
export function MyReportsTab({reloadKey}: {reloadKey: number}) {
  const {user} = useAuth();
  const [month, setMonth] = useState(monthKey());
  const [entries, setEntries] = useState<ReportLog[] | null>(null);
  const [editing, setEditing] = useState<ReportLog | "new" | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setEntries(await reportLog.month(month, user.id));
    } catch {
      toast.error("A jelentések betöltése nem sikerült.");
      setEntries([]);
    }
  }, [month, user]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  if (!user) return null;

  const remove = async (entry: ReportLog) => {
    if (!window.confirm(`Törlöd a bejegyzést? (${entry.title})`)) return;
    try {
      await reportLog.remove(entry.id);
      setEntries((current) => current?.filter((item) => item.id !== entry.id) ?? current);
      toast.success("Bejegyzés törölve.");
    } catch (error) {
      toast.error(reportLogError(error));
    }
  };

  const withLink = entries?.filter((entry) => entry.forum_url).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label="Előző hónap" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft/></Button>
          <p className="min-w-40 text-center text-lg font-semibold text-white">{monthLabel(month)}</p>
          <Button size="icon" variant="ghost" aria-label="Következő hónap" disabled={month === monthKey()} onClick={() => setMonth(addMonths(month, 1))}><ChevronRight/></Button>
        </div>
        <Button className="sm:ml-auto" onClick={() => setEditing("new")}><FilePlus2/> Jelentés rögzítése</Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="panel animate-rise p-4">
          <p className="text-3xl font-semibold tabular-nums text-white">{entries?.length ?? "–"}</p>
          <p className="text-xs text-slate-400">jelentés ebben a hónapban</p>
        </div>
        <div className="panel animate-rise p-4" style={{"--i": 1} as CSSProperties}>
          <p className="text-3xl font-semibold tabular-nums text-white">{entries ? withLink : "–"}</p>
          <p className="text-xs text-slate-400">fórum-linkkel ellenőrizhető</p>
        </div>
        <div className="panel animate-rise p-4 text-xs text-slate-400" style={{"--i": 2} as CSSProperties}>
          A havi fizetés ezt a számot használja. Kézzel írt jelentést is rögzíts ide; a linket később is hozzáadhatod.
        </div>
      </div>

      <section className="panel overflow-hidden">
        {entries === null ? (
          <div className="space-y-2 p-4">{Array.from({length: 3}, (_, index) => <div key={index} className="skeleton h-14"/>)}</div>
        ) : entries.length === 0 ? (
          <EmptyState icon={FileText} title="Ebben a hónapban még nincs rögzített jelentésed."
                      description="A generátorban a „Rögzítés” gombbal, vagy itt kézzel veheted fel a fórumra feltöltött jelentéseket."/>
        ) : (
          <ul className="divide-y divide-white/5">
            {entries.map((entry, index) => (
              <li key={entry.id} style={{"--i": Math.min(index, 12)} as CSSProperties}
                  className="animate-fade group flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02]">
                <div className="w-24 shrink-0 font-mono text-xs text-slate-400 tabular-nums">{formatDate(entry.occurred_on)}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white">{entry.title}</p>
                  <p className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span className={cn("inline-flex items-center gap-1", entry.source === "generator" ? "text-sky-300" : "text-slate-400")}>
                      {entry.source === "generator" ? <><Wand2 className="size-3"/> Generátorból</> : "Kézzel rögzítve"}
                    </span>
                    {entry.forum_url
                      ? <a href={entry.forum_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-300 hover:underline"><ExternalLink className="size-3"/> Fórum</a>
                      : <button type="button" onClick={() => setEditing(entry)} className="inline-flex items-center gap-1 text-amber-300 hover:underline"><Link2 className="size-3"/> Link hozzáadása</button>}
                  </p>
                </div>
                <div className="flex gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                  <Button size="icon" variant="ghost" className="size-8" aria-label="Szerkesztés" onClick={() => setEditing(entry)}><Pencil/></Button>
                  <Button size="icon" variant="ghost" className="size-8 text-red-300 hover:bg-red-500/10" aria-label="Törlés" onClick={() => void remove(entry)}><Trash2/></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && (
        <LogReportDialog userId={user.id} entry={editing === "new" ? null : editing}
                         defaultDate={month === monthKey() ? undefined : month}
                         onClose={() => setEditing(null)}
                         onSaved={() => {
                           setEditing(null);
                           void load();
                         }}/>
      )}
    </div>
  );
}
