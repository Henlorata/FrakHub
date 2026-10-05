import {useCallback, useEffect, useMemo, useState} from "react";
import {toast} from "sonner";
import {CalendarPlus, Check, ClipboardCheck, Loader2, Save, Trash2, UserPlus, Users} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Dialog, DialogContent, DialogDescription, DialogTitle} from "@/components/ui/dialog";
import {EmptyState} from "@/components/layout/EmptyState";
import {useAuth} from "@/context/AuthContext";
import {ACADEMY_DAYS} from "@/lib/academy";
import {formatDate, todayKey} from "@/lib/datetime";
import {useProfileDirectory} from "@/lib/profile-directory";
import {cn, errorMessage} from "@/lib/utils";
import {MemberAvatar} from "@/pages/finance/components/MemberAvatar";
import type {AcademyCycle, AcademyStudent} from "@/types/academy";

const STUDENT_STATUS: Record<AcademyStudent["status"], {label: string; pill: string}> = {
  enrolled: {label: "Tanuló", pill: "bg-sky-500/10 text-sky-200 ring-sky-500/30"},
  passed: {label: "Sikeres", pill: "bg-emerald-500/10 text-emerald-200 ring-emerald-500/30"},
  failed: {label: "Sikertelen", pill: "bg-red-500/10 text-red-200 ring-red-500/30"},
  dropped: {label: "Kimaradt", pill: "bg-slate-500/10 text-slate-300 ring-slate-500/30"},
};

interface LogEntry {
  present: boolean;
  note: string;
}

/** Academy cycles, the trainees of a cycle and the daily attendance log (instructors). */
export function InstructorPanel({activeCycle, today = todayKey(), onRefresh}: {activeCycle: Pick<AcademyCycle, "id" | "start_date" | "status"> | null; today?: string; onRefresh: () => void}) {
  const {supabase, user} = useAuth();
  const {profiles} = useProfileDirectory();
  const [cycles, setCycles] = useState<AcademyCycle[]>([]);
  const [cycleId, setCycleId] = useState<string | null>(activeCycle?.id ?? null);
  const [students, setStudents] = useState<AcademyStudent[]>([]);
  const [day, setDay] = useState(1);
  const [logs, setLogs] = useState<Record<string, LogEntry>>({});
  const [savedLogs, setSavedLogs] = useState<Record<string, LogEntry>>({});
  const [saving, setSaving] = useState(false);
  const [newCycle, setNewCycle] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [term, setTerm] = useState("");

  const loadCycles = useCallback(async () => {
    const {data} = await supabase.from("academy_cycles").select("id, start_date, status, created_at").order("start_date", {ascending: false});
    const list = (data ?? []) as AcademyCycle[];
    setCycles(list);
    setCycleId((current) => current ?? list.find((cycle) => cycle.status === "active")?.id ?? list[0]?.id ?? null);
  }, [supabase]);

  useEffect(() => {
    void loadCycles();
  }, [loadCycles]);

  const loadCycle = useCallback(async () => {
    if (!cycleId) return;
    const [studentResult, logResult] = await Promise.all([
      supabase.from("academy_students").select("id, cycle_id, user_id, status").eq("cycle_id", cycleId),
      supabase.from("academy_logs").select("student_id, is_present, note").eq("cycle_id", cycleId).eq("day_number", day),
    ]);
    setStudents((studentResult.data ?? []) as AcademyStudent[]);
    const entries: Record<string, LogEntry> = {};
    (logResult.data ?? []).forEach((log: {student_id: string; is_present: boolean; note: string | null}) => {
      entries[log.student_id] = {present: log.is_present, note: log.note ?? ""};
    });
    setLogs(entries);
    setSavedLogs(entries);
  }, [supabase, cycleId, day]);

  useEffect(() => {
    void loadCycle();
  }, [loadCycle]);

  const byId = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const cycle = cycles.find((item) => item.id === cycleId) ?? null;
  const dirty = JSON.stringify(logs) !== JSON.stringify(savedLogs);
  const candidates = useMemo(() => {
    const enrolled = new Set(students.map((student) => student.user_id));
    const needle = term.trim().toLowerCase();
    return profiles.filter((profile) => profile.faction_rank === "Deputy Sheriff Trainee" && profile.system_role !== "pending" && !enrolled.has(profile.id)
      && (!needle || profile.full_name.toLowerCase().includes(needle) || profile.badge_number.includes(needle)));
  }, [profiles, students, term]);

  const startCycle = async () => {
    if (!newCycle) return;
    const active = cycles.find((item) => item.status === "active");
    if (active) await supabase.from("academy_cycles").update({status: "archived"}).eq("id", active.id);
    const {data, error} = await supabase.from("academy_cycles").insert({start_date: newCycle, status: "active", created_by: user?.id})
      .select("id").single();
    if (error) return toast.error("Az új ciklus indítása nem sikerült: " + errorMessage(error));
    toast.success("Új akadémiai ciklus elindult.");
    setNewCycle(null);
    setCycleId((data as {id: string}).id);
    await loadCycles();
    onRefresh();
  };

  const addStudent = async (userId: string) => {
    if (!cycleId) return;
    const {error} = await supabase.from("academy_students").insert({cycle_id: cycleId, user_id: userId});
    if (error) return toast.error("Hiba: " + errorMessage(error));
    toast.success("Tanuló hozzáadva.");
    void loadCycle();
  };

  const setStatus = async (student: AcademyStudent, status: AcademyStudent["status"]) => {
    setStudents((current) => current.map((item) => item.id === student.id ? {...item, status} : item));
    const {error} = await supabase.from("academy_students").update({status}).eq("id", student.id);
    if (error) {
      toast.error("Nem sikerült menteni.");
      void loadCycle();
    }
  };

  const removeStudent = async (student: AcademyStudent) => {
    if (!window.confirm(`Eltávolítod ${byId.get(student.user_id)?.full_name ?? "a tanulót"} a ciklusból?`)) return;
    const {error} = await supabase.from("academy_students").delete().eq("id", student.id);
    if (error) return toast.error("Hiba: " + errorMessage(error));
    void loadCycle();
  };

  const saveLogs = async () => {
    if (!cycleId || students.length === 0) return;
    setSaving(true);
    const rows = students.map((student) => ({
      cycle_id: cycleId, student_id: student.user_id, day_number: day, instructor_id: user?.id,
      is_present: logs[student.user_id]?.present ?? false, note: logs[student.user_id]?.note ?? "",
    }));
    const {error} = await supabase.from("academy_logs").upsert(rows, {onConflict: "cycle_id,student_id,day_number"});
    setSaving(false);
    if (error) return toast.error("A napló mentése nem sikerült: " + errorMessage(error));
    setSavedLogs(logs);
    toast.success(`${day}. nap naplója mentve.`);
  };

  return (
    <div className="space-y-4">
      <div className="panel flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/25"><ClipboardCheck className="size-5"/></div>
          <div>
            <p className="font-semibold text-white">Akadémiai ciklus</p>
            <p className="text-xs text-slate-400">{cycle ? `${formatDate(cycle.start_date)} – ${cycle.status === "active" ? "aktív" : cycle.status === "planned" ? "tervezett" : "archivált"}` : "Nincs ciklus"}</p>
          </div>
        </div>
        <select value={cycleId ?? ""} onChange={(event) => setCycleId(event.target.value || null)} aria-label="Ciklus"
                className="h-9 rounded-md bg-white/[0.03] px-2 text-sm text-slate-100 ring-1 ring-white/10 outline-none lg:ml-auto">
          {cycles.map((item) => <option key={item.id} value={item.id}>{formatDate(item.start_date)}{item.status === "active" ? " (aktív)" : ""}</option>)}
        </select>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setNewCycle(today)}><CalendarPlus/> Új ciklus</Button>
          {cycle?.status === "active" && <Button onClick={() => setAdding(true)}><UserPlus/> Tanuló</Button>}
        </div>
      </div>

      {!cycle ? (
        <div className="panel"><EmptyState icon={CalendarPlus} title="Még nincs akadémiai ciklus." description="Indíts egyet az első nap dátumával."/></div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/5 p-4">
            <p className="mr-2 text-sm font-medium text-white">Jelenléti napló</p>
            {ACADEMY_DAYS.map((item) => (
              <button key={item} type="button" onClick={() => {
                if (dirty && !window.confirm("Mentetlen napló-bejegyzések vannak. Elveted őket?")) return;
                setDay(item);
              }} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium ring-1 transition-colors",
                day === item ? "bg-cyan-500/15 text-white ring-cyan-400/40" : "text-slate-400 ring-white/10 hover:bg-white/[0.04]")}>
                {item}. nap
              </button>
            ))}
            <Button className="ml-auto" size="sm" disabled={!dirty || saving} onClick={() => void saveLogs()}>
              {saving ? <Loader2 className="animate-spin"/> : <Save/>} Napló mentése
            </Button>
          </div>
          {students.length === 0 ? (
            <EmptyState icon={Users} title="Ebben a ciklusban még nincs tanuló." compact/>
          ) : (
            <ul className="divide-y divide-white/5">
              {students.map((student) => {
                const profile = byId.get(student.user_id);
                const entry = logs[student.user_id] ?? {present: false, note: ""};
                return (
                  <li key={student.id} className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[minmax(0,240px)_auto_minmax(0,1fr)_auto] md:items-center">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <MemberAvatar name={profile?.full_name} avatarUrl={profile?.avatar_url} size={32}/>
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-white">{profile?.full_name ?? "Ismeretlen"}</span>
                        <span className="block truncate text-[11px] text-slate-500">#{profile?.badge_number ?? "–"} · {profile?.faction_rank ?? ""}</span>
                      </span>
                    </div>
                    <button type="button" aria-pressed={entry.present} onClick={() => setLogs((current) => ({...current, [student.user_id]: {...entry, present: !entry.present}}))}
                            className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium ring-1 transition-colors",
                              entry.present ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/40" : "text-slate-400 ring-white/10 hover:bg-white/[0.04]")}>
                      {entry.present && <Check className="size-3.5"/>} {entry.present ? "Jelen volt" : "Hiányzott"}
                    </button>
                    <Input value={entry.note} placeholder="Oktatói megjegyzés…" maxLength={500}
                           onChange={(event) => setLogs((current) => ({...current, [student.user_id]: {...entry, note: event.target.value}}))}/>
                    <div className="flex items-center gap-1.5">
                      <select value={student.status} onChange={(event) => void setStatus(student, event.target.value as AcademyStudent["status"])}
                              aria-label="A tanuló állapota"
                              className={cn("h-8 rounded-full px-2.5 text-xs ring-1 outline-none", STUDENT_STATUS[student.status].pill)}>
                        {Object.entries(STUDENT_STATUS).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
                      </select>
                      <Button size="icon" variant="ghost" className="size-8 text-red-300 hover:bg-red-500/10" aria-label="Eltávolítás"
                              onClick={() => void removeStudent(student)}><Trash2/></Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <Dialog open={newCycle !== null} onOpenChange={(open) => !open && setNewCycle(null)}>
        <DialogContent className="sm:max-w-md">
          <div>
            <DialogTitle className="flex items-center gap-2"><CalendarPlus className="size-4 text-cyan-300"/> Új akadémiai ciklus</DialogTitle>
            <DialogDescription className="mt-1">Az 1. nap dátuma; a napok innen naponta nyílnak meg a trainee-knek. A jelenlegi aktív ciklus archiválódik.</DialogDescription>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cycle-start">Az 1. nap</Label>
            <Input id="cycle-start" type="date" value={newCycle ?? ""} onChange={(event) => setNewCycle(event.target.value)} className="w-48"/>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setNewCycle(null)}>Mégse</Button>
            <Button disabled={!newCycle} onClick={() => void startCycle()}>Indítás</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-md">
          <div>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="size-4 text-cyan-300"/> Tanuló hozzáadása</DialogTitle>
            <DialogDescription className="mt-1">A Deputy Sheriff Trainee rendfokozatú tagok közül.</DialogDescription>
          </div>
          <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Név vagy jelvényszám…" autoFocus/>
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {candidates.map((profile) => (
              <li key={profile.id} className="flex items-center gap-2.5 rounded-lg p-2 hover:bg-white/[0.04]">
                <MemberAvatar name={profile.full_name} avatarUrl={profile.avatar_url} size={28}/>
                <span className="min-w-0 flex-1 truncate text-sm text-white">{profile.full_name} <span className="text-xs text-slate-500">#{profile.badge_number}</span></span>
                <Button size="sm" variant="outline" onClick={() => void addStudent(profile.id)}>Hozzáadás</Button>
              </li>
            ))}
            {candidates.length === 0 && <li className="py-6 text-center text-xs text-slate-500">Nincs felvehető trainee.</li>}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
