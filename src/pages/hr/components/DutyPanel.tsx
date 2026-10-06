import {Fragment, useMemo, useState, type KeyboardEvent} from "react";
import {toast} from "sonner";
import {Clock, Eraser, Info, Loader2, Save, ScanLine, Search, Undo2, Users} from "lucide-react";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {EmptyState} from "@/components/layout/EmptyState";
import {getOptimizedAvatarUrl} from "@/lib/cloudinary";
import {autoFormatDuty, formatDuty, monthLabel, parseDuty, recentMonths} from "@/lib/registry";
import {cn, errorMessage, getStaffCategory, type StaffCategory} from "@/lib/utils";
import {CATEGORY_META} from "../hr-utils";
import type {HrMember} from "../useHrData";
import {DutyScanDialog, type ScannedDuty} from "./DutyScanDialog";

const CATEGORY_ORDER: StaffCategory[] = ["executive", "command", "supervisory", "field"];
/** Less than this in a closed month is highlighted. */
const LOW_DUTY_MINUTES = 10 * 60;

export interface DutyChange {
  user_id: string;
  month: string;
  minutes: number | null;
}

interface DutyPanelProps {
  members: HrMember[];
  editable: boolean;
  onSave: (changes: DutyChange[]) => Promise<void>;
}

const cellKey = (userId: string, month: string) => `${userId}|${month}`;
const storedMinutes = (member: HrMember, month: string) =>
  member.duty.find((entry) => entry.month.slice(0, 10) === month)?.minutes ?? null;

/**
 * Monthly duty time like the old sheet: one row per member, the last six months as
 * columns. Staff type the game's counter into the cells ("95:48", "95 óra 48 perc"),
 * Enter jumps to the next member, one button saves everything in one request.
 */
export function DutyPanel({members, editable, onSave}: DutyPanelProps) {
  const months = useMemo(() => recentMonths(6), []);
  const currentMonth = months[months.length - 1];
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  // Cells filled from screenshots: "doubtful" readings to check, "missing" ones to type by hand.
  const [flags, setFlags] = useState<Record<string, ScannedDuty["status"]>>({});

  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

  const {changes, invalid} = useMemo(() => {
    const list: DutyChange[] = [];
    const bad = new Set<string>();
    for (const [key, text] of Object.entries(drafts)) {
      const [userId, month] = key.split("|");
      const member = memberById.get(userId);
      if (!member) continue;
      const stored = storedMinutes(member, month);
      if (!text.trim()) {
        if (stored !== null) list.push({user_id: userId, month, minutes: null});
        continue;
      }
      const minutes = parseDuty(text);
      if (minutes === null) bad.add(key);
      else if (minutes !== stored) list.push({user_id: userId, month, minutes});
    }
    return {changes: list, invalid: bad};
  }, [drafts, memberById]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? members.filter((member) => member.full_name.toLowerCase().includes(term) || member.badge_number.includes(term)) : members;
  }, [members, search]);

  const sections = useMemo(() => CATEGORY_ORDER
    .map((category) => ({category, members: filtered.filter((member) => getStaffCategory(member.faction_rank) === category)}))
    .filter((section) => section.members.length > 0), [filtered]);
  const rowOrder = useMemo(() => sections.flatMap((section) => section.members), [sections]);

  const totals = months.map((month) => filtered.reduce((sum, member) => sum + (storedMinutes(member, month) ?? 0), 0));

  // Enter, Tab and the arrows move down/up the month column (filled member by member).
  const moveFocus = (event: KeyboardEvent<HTMLInputElement>, row: number, column: number) => {
    const step = event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey) ? -1
      : event.key === "Enter" || event.key === "ArrowDown" || event.key === "Tab" ? 1 : 0;
    if (!step) return;
    const target = document.querySelector<HTMLInputElement>(`[data-duty-cell="${row + step}:${column}"]`);
    // At the end of the column Tab leaves the table as usual.
    if (!target && event.key === "Tab") return;
    event.preventDefault();
    target?.focus();
    target?.select();
  };

  const missingFlags = Object.values(flags).filter((flag) => flag === "missing").length;
  const doubtfulFlags = Object.values(flags).filter((flag) => flag === "doubtful").length;

  const editCell = (key: string, value: string) => {
    setDrafts((prev) => ({...prev, [key]: autoFormatDuty(value)}));
    // A value typed by hand is checked.
    setFlags((prev) => {
      if (!(key in prev)) return prev;
      const next = {...prev};
      delete next[key];
      return next;
    });
  };

  const applyScan = (month: string, values: ScannedDuty[]) => {
    const nextDrafts: Record<string, string> = {};
    const nextFlags: Record<string, ScannedDuty["status"]> = {};
    for (const value of values) {
      const key = cellKey(value.userId, month);
      if (value.minutes !== null) nextDrafts[key] = formatDuty(value.minutes, true);
      if (value.status !== "ok") nextFlags[key] = value.status;
    }
    setDrafts((prev) => ({...prev, ...nextDrafts}));
    setFlags((prev) => ({...prev, ...nextFlags}));
  };

  const save = async () => {
    if (invalid.size > 0) return toast.error("Javítsd a pirossal jelölt cellákat (pl. 95:48).");
    if (missingFlags > 0) return toast.error(`${missingFlags} cellát kézzel kell kitöltened (pirossal jelölve), vagy töröld a jelölést.`);
    if (changes.length === 0) return;
    setSaving(true);
    try {
      await onSave(changes);
      setDrafts({});
      setFlags({});
      toast.success(`${changes.length} duty idő mentve.`);
    } catch (error) {
      toast.error(errorMessage(error, "A mentés nem sikerült."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel relative overflow-hidden">
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
        <div className="relative lg:w-72">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Név vagy jelvényszám…" className="pl-9"/>
        </div>
        {editable && (
          <Button variant="outline" size="sm" onClick={() => setScanning(true)} data-tour="duty-scan" className="lg:order-last">
            <ScanLine/> Képekből
          </Button>
        )}
        <p className="flex items-center gap-2 text-xs text-slate-400 lg:ml-auto">
          <Info className="size-3.5 shrink-0 text-primary"/>
          {editable
            ? <>A játék számlálóját írd be: <span className="font-mono text-slate-200">9548</span> (→ 95:48), <span className="font-mono text-slate-200">95 óra 48 perc</span> vagy <span className="font-mono text-slate-200">95,5</span>. Tab / Enter: következő tag.</>
            : <>A duty időket a vezetőség rögzíti a havi gyűlésen.</>}
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="Nincs találat." compact/>
      ) : (
        <div className="max-h-[calc(100dvh-20rem)] overflow-auto">
          <table className="w-full min-w-[860px] border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-20">
              <tr className="bg-[#0b1324]/95 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 backdrop-blur">
                <th className="sticky left-0 z-10 border-b bg-[#0b1324]/95 py-2.5 pr-3 pl-4">Tag</th>
                {months.map((month) => (
                  <th key={month} className={cn("border-b px-2 py-2.5 text-center", month === currentMonth && "text-primary")}>
                    {monthLabel(month, "short")}
                    <span className="block text-[10px] font-normal normal-case tracking-normal text-slate-600">{month.slice(0, 4)}</span>
                  </th>
                ))}
                <th className="border-b py-2.5 pr-4 pl-2 text-right">Összesen</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((section) => (
                <Fragment key={section.category}>
                  <tr>
                    <td colSpan={months.length + 2} className="sticky left-0 border-b bg-white/[0.02] py-2 pl-4 text-xs font-semibold text-slate-300">
                      {CATEGORY_META[section.category].label}
                      <span className="ml-1 font-normal text-slate-500">· {section.members.length} fő</span>
                    </td>
                  </tr>
                  {section.members.map((member) => {
                    const row = rowOrder.indexOf(member);
                    const sum = months.reduce((acc, month) => acc + (storedMinutes(member, month) ?? 0), 0);
                    return (
                      <tr key={member.id} className="group">
                        <td className="sticky left-0 z-10 border-b border-white/[0.04] bg-[#0a1120]/95 py-2 pr-3 pl-4 backdrop-blur group-hover:bg-[#0e172a]">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="size-7 ring-1 ring-white/10">
                              <AvatarImage src={getOptimizedAvatarUrl(member.avatar_url, 56) || undefined} alt=""/>
                              <AvatarFallback className="bg-slate-800 text-[10px] font-semibold text-slate-300">{member.full_name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="max-w-[180px] truncate text-sm font-medium text-white">{member.full_name}</p>
                              <p className="font-mono text-[11px] text-slate-500">#{member.badge_number}</p>
                            </div>
                          </div>
                        </td>
                        {months.map((month, column) => {
                          const key = cellKey(member.id, month);
                          const stored = storedMinutes(member, month);
                          const draft = drafts[key];
                          const changed = draft !== undefined && changes.some((change) => cellKey(change.user_id, change.month) === key);
                          const low = month !== currentMonth && stored !== null && stored < LOW_DUTY_MINUTES;
                          const flag = flags[key];
                          return (
                            <td key={month} className={cn("border-b border-white/[0.04] px-1.5 py-1.5 text-center group-hover:bg-white/[0.02]",
                              month === currentMonth && "bg-primary/[0.03]")}>
                              {editable ? (
                                <input
                                  data-duty-cell={`${row}:${column}`}
                                  value={draft ?? (stored === null ? "" : formatDuty(stored, true))}
                                  placeholder={flag === "missing" ? "Írd be!" : "–"}
                                  title={flag === "missing" ? "Képről nem olvasható: írd be kézzel" : flag === "doubtful" ? "Képről beolvasva, bizonytalan: ellenőrizd" : undefined}
                                  onChange={(event) => editCell(key, event.target.value)}
                                  onKeyDown={(event) => moveFocus(event, row, column)}
                                  onFocus={(event) => event.target.select()}
                                  aria-label={`${member.full_name} – ${monthLabel(month)}`}
                                  className={cn(
                                    "h-8 w-[78px] rounded-md bg-white/[0.03] text-center font-mono text-[13px] tabular-nums text-slate-100 ring-1 ring-white/10 outline-none transition-colors placeholder:text-slate-600 focus:bg-white/[0.06] focus:ring-2 focus:ring-primary/60",
                                    low && !changed && "text-amber-300",
                                    changed && "bg-primary/10 ring-primary/50",
                                    flag === "doubtful" && "bg-amber-500/10 ring-2 ring-amber-400/70",
                                    flag === "missing" && "bg-red-500/15 ring-2 ring-red-500/80 placeholder:text-red-300",
                                    invalid.has(key) && "bg-red-500/10 text-red-200 ring-red-500/60",
                                  )}
                                />
                              ) : (
                                <span className={cn("font-mono text-[13px] tabular-nums", stored === null ? "text-slate-600" : low ? "text-amber-300" : "text-slate-200")}>
                                  {stored === null ? "–" : formatDuty(stored, true)}
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td className="border-b border-white/[0.04] py-2 pr-4 pl-2 text-right font-mono text-[13px] tabular-nums text-slate-300 group-hover:bg-white/[0.02]">
                          {sum > 0 ? formatDuty(sum, true) : "–"}
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 z-20">
              <tr className="bg-[#0b1324]/95 text-xs font-semibold text-slate-300 backdrop-blur">
                <td className="sticky left-0 z-10 border-t bg-[#0b1324]/95 py-2.5 pr-3 pl-4"><Clock className="mr-1.5 inline size-3.5 text-primary"/>Állomány összesen</td>
                {totals.map((total, index) => (
                  <td key={months[index]} className="border-t px-1.5 py-2.5 text-center font-mono tabular-nums">{total > 0 ? formatDuty(total, true) : "–"}</td>
                ))}
                <td className="border-t py-2.5 pr-4 pl-2 text-right font-mono tabular-nums">
                  {formatDuty(totals.reduce((a, b) => a + b, 0), true)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {editable && (changes.length > 0 || invalid.size > 0 || missingFlags + doubtfulFlags > 0) && (
        <div className="animate-rise flex flex-wrap items-center gap-3 border-t bg-primary/[0.06] px-4 py-3">
          <p className="text-sm text-slate-200">
            <span className="font-semibold text-white">{changes.length}</span> módosítás
            {invalid.size > 0 && <span className="ml-2 text-red-300">· {invalid.size} hibás cella</span>}
            {doubtfulFlags > 0 && <span className="ml-2 text-amber-300">· {doubtfulFlags} ellenőrizendő (sárga)</span>}
            {missingFlags > 0 && <span className="ml-2 font-semibold text-red-300">· {missingFlags} kézzel kitöltendő (piros)</span>}
          </p>
          <div className="ml-auto flex gap-2">
            {missingFlags + doubtfulFlags > 0 && (
              <Button variant="ghost" onClick={() => setFlags({})} disabled={saving} title="A jelölt cellák értéke marad"><Eraser/> Jelölések törlése</Button>
            )}
            <Button variant="ghost" onClick={() => {
              setDrafts({});
              setFlags({});
            }} disabled={saving}><Undo2/> Elvetés</Button>
            <Button onClick={() => void save()} disabled={saving || changes.length === 0}>
              {saving ? <Loader2 className="animate-spin"/> : <Save/>} Mentés
            </Button>
          </div>
        </div>
      )}
      {scanning && (
        <DutyScanDialog open onOpenChange={setScanning} members={members} months={months} defaultMonth={currentMonth}
                        storedMinutes={storedMinutes} onApply={applyScan}/>
      )}
    </div>
  );
}
