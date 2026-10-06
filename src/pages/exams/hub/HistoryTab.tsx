import {useEffect, useState, type CSSProperties} from "react";
import {useNavigate} from "react-router";
import {toast} from "sonner";
import {ChevronLeft, ChevronRight, Database, Search, Trash2} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {EmptyState} from "@/components/layout/EmptyState";
import {TONE_CLASSES} from "@/components/layout/PageHeader";
import {useAuth} from "@/context/AuthContext";
import {formatDateTime, INTEGRITY_LEVEL_META, integrityLevel, STATUS_META} from "@/lib/exams";
import {cn} from "@/lib/utils";
import type {ExamSubmissionView, HubExam} from "@/types/exams";

const PAGE_SIZE = 15;
const COLUMNS = "id, exam_id, exam_title, user_id, user_full_name, user_badge_number, applicant_name, status, total_score, max_score, "
  + "percentage, start_time, end_time, tab_switch_count, integrity, finish_reason";

interface HistoryTabProps {
  exams: HubExam[];
  canTrash: boolean;
  workingId: string | null;
  onTrash: (id: string) => void;
  /** Changes when a sheet was moved to the trash elsewhere. */
  reloadKey: number;
}

/** Every sheet the grader may see, filtered by name, exam and result (one page per request). */
export function HistoryTab({exams, canTrash, workingId, onTrash, reloadKey}: HistoryTabProps) {
  const {supabase} = useAuth();
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [examId, setExamId] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<ExamSubmissionView[] | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(term.replace(/[,()*%\\]/g, " ").trim());
      setPage(0);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    let active = true;
    let query = supabase.from("exam_submissions_view").select(COLUMNS, {count: "exact"})
      .is("deleted_at", null).in("status", ["pending", "passed", "failed"])
      .order("start_time", {ascending: false}).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (examId !== "all") query = query.eq("exam_id", examId);
    if (status !== "all") query = query.eq("status", status);
    if (search) query = query.or(`user_full_name.ilike.%${search}%,applicant_name.ilike.%${search}%`);
    void query.then(({data, count, error}) => {
      if (!active) return;
      if (error) {
        toast.error("Az adatbázis betöltése nem sikerült.");
        setRows([]);
        return;
      }
      setRows((data ?? []) as unknown as ExamSubmissionView[]);
      setTotal(count ?? 0);
    });
    return () => {
      active = false;
    };
  }, [supabase, page, search, examId, status, reloadKey]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-white/5 p-4 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-xs">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
          <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Vizsgázó neve…" className="pl-9"/>
        </div>
        <Select value={examId} onValueChange={(value) => {
          setExamId(value);
          setPage(0);
        }}>
          <SelectTrigger className="w-full lg:w-64"><SelectValue/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Minden vizsga</SelectItem>
            {exams.map((exam) => <SelectItem key={exam.id} value={exam.id}>{exam.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(value) => {
          setStatus(value);
          setPage(0);
        }}>
          <SelectTrigger className="w-full lg:w-44"><SelectValue/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Minden állapot</SelectItem>
            <SelectItem value="pending">Javításra vár</SelectItem>
            <SelectItem value="passed">Sikeres</SelectItem>
            <SelectItem value="failed">Sikertelen</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-slate-500 lg:ml-auto">{total} vizsgalap</span>
      </div>

      {rows === null ? (
        <div className="space-y-2 p-4">{Array.from({length: 5}, (_, index) => <div key={index} className="skeleton h-14"/>)}</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Database} title="Nincs a szűrésnek megfelelő vizsgalap." compact/>
      ) : (
        <ul className="divide-y divide-white/5">
          {rows.map((row, index) => {
            const meta = STATUS_META[row.status] ?? STATUS_META.pending;
            const level = integrityLevel(row.integrity);
            return (
              <li key={row.id} style={{"--i": Math.min(index, 12)} as CSSProperties} className="animate-fade">
                <div className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02]">
                  <button type="button" onClick={() => navigate(`/exams/grading/${row.id}`)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span className={cn("size-2.5 shrink-0 rounded-full", row.status === "passed" ? "bg-emerald-400" : row.status === "failed" ? "bg-red-400" : "bg-amber-300")}/>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-white">{row.exam_title}</span>
                      <span className="block truncate text-xs text-slate-400">
                        {row.user_full_name ?? row.applicant_name ?? "Ismeretlen"}{row.user_badge_number ? ` #${row.user_badge_number}` : row.user_id ? "" : " (vendég)"} · {formatDateTime(row.start_time)}
                      </span>
                    </span>
                    {level !== "clean" && (
                      <span className={cn("hidden rounded-full px-2 py-0.5 text-[11px] ring-1 md:inline", TONE_CLASSES[INTEGRITY_LEVEL_META[level].tone].tile)}>
                        {INTEGRITY_LEVEL_META[level].label}
                      </span>
                    )}
                    {!row.integrity || Object.keys(row.integrity).length === 0 ? (
                      row.tab_switch_count ? <span className="hidden text-[11px] text-slate-500 md:inline">{row.tab_switch_count}× fókuszvesztés</span> : null
                    ) : null}
                    <span className={cn("w-24 shrink-0 text-right text-sm font-semibold tabular-nums", TONE_CLASSES[meta.tone].text)}>
                      {row.status === "pending" ? meta.label : `${row.percentage ?? 0}%`}
                    </span>
                  </button>
                  {canTrash && (
                    <Button variant="ghost" size="icon" aria-label="Lomtárba" title="Hibás / teszt kitöltés: lomtárba"
                            disabled={workingId === row.id} onClick={() => onTrash(row.id)} className="text-slate-500 hover:text-red-300">
                      <Trash2/>
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center justify-center gap-3 border-t border-white/5 p-3">
        <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage((value) => value - 1)}><ChevronLeft/> Előző</Button>
        <span className="text-xs text-slate-500 tabular-nums">{page + 1} / {pages}</span>
        <Button variant="ghost" size="sm" disabled={page + 1 >= pages} onClick={() => setPage((value) => value + 1)}>Következő <ChevronRight/></Button>
      </div>
    </div>
  );
}
