import {useEffect, useState, useCallback, useRef} from "react";
import {useAuth} from "@/context/AuthContext";
import {ScrollArea} from "@/components/ui/scroll-area"
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {
  FileText, History, Plus, AlertCircle, Search, ChevronRight, GraduationCap, PenTool,
  Link as LinkIcon, Lock, X, UserPlus, Clock, Users, Trophy, LayoutGrid, Timer, Loader2, Filter, Trash2, RotateCcw
} from "lucide-react";
import {PageHeader} from "@/components/layout/PageHeader";
import {EmptyState} from "@/components/layout/EmptyState";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {useNavigate, useSearchParams} from "react-router";
import type {Exam, ExamSubmission, ExamSubmissionView} from "@/types/exams";
import type {Profile} from "@/types/supabase";
import {getProfileDirectory, type DirectoryProfile} from "@/lib/profile-directory";
import {toast} from "sonner";
import {
  canCreateAnyExam,
  canManageExamContent,
  canManageExamAccess,
  canGradeExam,
  isSupervisory,
  getRankPriority, isHighCommand, isStaff, isExecutive, errorMessage
} from "@/lib/utils";
import {formatDistanceToNow} from "date-fns";
import {hu} from "date-fns/locale";
import {Input} from "@/components/ui/input";
import {ExamAccessDialog} from "./components/ExamAccessDialog";
import {AdminExamAssignDialog} from "./components/AdminExamAssignDialog";
import {cn} from "@/lib/utils";

const MAIN_DIVISIONS = ['TSB', 'SEB', 'MCB'];
const TERMINAL_CARD = "bg-[#0b1221]/75 backdrop-blur-xl border border-slate-800 shadow-xl overflow-hidden relative group transition-all hover:border-yellow-500/30 flex flex-col h-full";

type PendingSubmission = ExamSubmission & {
  exam_title?: string;
  user_full_name: string;
  user_badge_number: string;
};

/** Whether the exam is offered to this member (overrides first, then the exam's own rules). */
function isExamAvailable(profile: Profile, exam: Exam, override: string | undefined) {
  if (override === 'allow') return true;
  if (override === 'deny') return false;
  if (canManageExamAccess(profile, exam)) return true;
  if (!exam.is_active) return false;
  if (exam.type === 'trainee') return false;
  if (exam.type === 'deputy_i' && getRankPriority(profile.faction_rank) <= getRankPriority('Deputy Sheriff I.')) return false;
  if (exam.is_public) return true;

  // Main-division exams are for that division (TSB members may take any of them).
  if (exam.division && MAIN_DIVISIONS.includes(exam.division) && profile.division !== 'TSB' && profile.division !== exam.division) {
    return false;
  }
  if (exam.required_rank) {
    const required = getRankPriority(exam.required_rank);
    if (required !== 999 && getRankPriority(profile.faction_rank) > required) return false;
  }
  return true;
}

interface ExamCardProps {
  exam: Exam;
  profile: Profile;
  lastSubmission?: ExamSubmission;
  overrideType?: string;
  onEdit: (examId: string) => void;
  onManageAccess: (exam: Exam) => void;
  onCopyLink: (examId: string) => void;
  onStart: (examId: string) => void;
}

function ExamCard({exam, profile, lastSubmission, overrideType, onEdit, onManageAccess, onCopyLink, onStart}: ExamCardProps) {
    const isBlocked = lastSubmission?.status === 'failed' && !!lastSubmission.retry_allowed_at && new Date(lastSubmission.retry_allowed_at) > new Date();
    const isPending = lastSubmission?.status === 'pending';
    const canEditContent = canManageExamContent(profile, exam);
    const canAccessManage = canManageExamAccess(profile, exam);
    const canShare = canGradeExam(profile, exam) && exam.allow_sharing;

    const isInvitationRequired = !!exam.is_invitation_only;

    const hasPermission = overrideType === 'allow' || (!isInvitationRequired && overrideType !== 'deny');
    const canTake = !canEditContent && hasPermission;

    return (
      <div className={TERMINAL_CARD}>
        <div
          className={cn("absolute top-0 left-0 w-1 h-full transition-colors", !exam.is_active ? "bg-red-900" : "bg-yellow-500 group-hover:bg-yellow-400")}/>
        <div className="p-5 pb-0 flex-none">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline"
                     className="bg-slate-900/50 border-slate-700 text-slate-400 font-mono text-[9px] uppercase tracking-wider">{exam.division || 'CORE'}</Badge>
              {exam.is_public &&
                <Badge className="bg-blue-900/20 text-blue-400 border-blue-900/50 text-[9px]">PUBLIC</Badge>}
              {isInvitationRequired && <Badge
                className="bg-purple-900/20 text-purple-400 border-purple-900/50 text-[9px] flex items-center gap-1"><Lock
                className="w-3 h-3"/> MEGHÍVÁSOS</Badge>}
            </div>
            {!exam.is_active && <div
              className="px-2 py-0.5 bg-red-950/50 text-red-500 text-[10px] font-bold border border-red-900 rounded uppercase">INAKTÍV</div>}
          </div>
          <div className="h-[4.5rem] flex items-center">
            <h3
              className="text-lg font-black text-white group-hover:text-yellow-500 transition-colors uppercase leading-tight line-clamp-3 w-full"
              title={exam.title}>{exam.title}</h3>
          </div>
        </div>

        <div className="p-5 pt-2 flex-none">
          <div className="grid grid-cols-2 gap-px bg-slate-800 border border-slate-800 rounded overflow-hidden">
            <div className="bg-[#0f172a] p-3 text-center group-hover:bg-[#131b2e] transition-colors">
              <div
                className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1 flex items-center justify-center gap-1">
                <Timer className="w-3 h-3"/> IDŐ
              </div>
              <div className="text-white font-mono text-sm font-bold">{exam.time_limit_minutes}p</div>
            </div>
            <div className="bg-[#0f172a] p-3 text-center group-hover:bg-[#131b2e] transition-colors">
              <div
                className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1 flex items-center justify-center gap-1">
                <Trophy className="w-3 h-3"/> MIN
              </div>
              <div className="text-yellow-500 font-mono text-sm font-bold">{exam.passing_percentage}%</div>
            </div>
          </div>
        </div>

        <div className="flex-1"></div>

        <div className="mt-auto border-t border-slate-800/50 bg-slate-950/30 p-3 flex-none">
          <div className="flex gap-2">
            {canEditContent && (
              <Button size="sm" variant="ghost" onClick={() => onEdit(exam.id)}
                      className="h-8 flex-1 text-[10px] uppercase font-bold bg-slate-900 border border-slate-700 hover:border-yellow-500/50 hover:text-yellow-500">
                <PenTool className="w-3 h-3 mr-1"/> SZERK.
              </Button>
            )}
            {canAccessManage && (
              <Button size="icon" variant="ghost" onClick={() => onManageAccess(exam)}
                      className="h-8 w-8 bg-slate-900 border border-slate-700 hover:text-blue-400 hover:border-blue-500/50">
                <Lock className="w-3 h-3"/>
              </Button>
            )}
            {canShare && (
              <Button size="icon" variant="ghost" onClick={() => onCopyLink(exam.id)}
                      className="h-8 w-8 bg-slate-900 border border-slate-700 hover:text-green-400 hover:border-green-500/50">
                <LinkIcon className="w-3 h-3"/>
              </Button>
            )}
          </div>

          <div className="mt-2">
            {canTake ? (
              isBlocked ? (
                <Button disabled
                        className="w-full h-9 bg-red-950/10 text-red-500 border border-red-900/50 text-xs uppercase font-bold"><Clock
                  className="w-3 h-3 mr-2"/> {formatDistanceToNow(new Date(lastSubmission!.retry_allowed_at!), {locale: hu})}
                </Button>
              ) : isPending ? (
                <Button disabled
                        className="w-full h-9 bg-yellow-900/10 text-yellow-500 border border-yellow-900/50 text-xs uppercase font-bold animate-pulse">FOLYAMATBAN...</Button>
              ) : (
                <Button
                  className="w-full h-9 bg-yellow-600 hover:bg-yellow-500 text-black font-black uppercase tracking-wider text-xs shadow-[0_0_15px_rgba(234,179,8,0.2)]"
                  onClick={() => onStart(exam.id)}>VIZSGA INDÍTÁSA <ChevronRight
                  className="w-3 h-3 ml-1"/></Button>
              )
            ) : (
              !canEditContent && (
                <Button disabled
                        className="w-full h-9 bg-slate-800 text-slate-500 border border-slate-700 text-xs uppercase font-bold cursor-not-allowed">
                  <Lock className="w-3 h-3 mr-2"/>
                  {isInvitationRequired ? "MEGHÍVÁS SZÜKSÉGES" : "JOGOSULTSÁG HIÁNYZIK"}
                </Button>
              )
            )}
          </div>
        </div>
      </div>
    );
}

const TABS = ["available", "history", "grading", "all_history", "trash"] as const;
type HubTab = typeof TABS[number];

export function ExamHub() {
  const {supabase, profile} = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab") as HubTab | null;
  const activeTab: HubTab = requestedTab && TABS.includes(requestedTab) ? requestedTab : "available";
  const setActiveTab = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    if (tab === "available") next.delete("tab");
    else next.set("tab", tab);
    setSearchParams(next, {replace: true});
  };
  const [trashItems, setTrashItems] = useState<ExamSubmissionView[] | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<ExamSubmissionView | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const [availableExams, setAvailableExams] = useState<Exam[]>([]);
  // ÚJ STATE: Minden vizsga tárolása a szűrőhöz (szűrés nélkül)
  const [allExamsList, setAllExamsList] = useState<Exam[]>([]);

  const [mySubmissions, setMySubmissions] = useState<ExamSubmission[]>([]);
  const [pendingGrading, setPendingGrading] = useState<PendingSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  const [accessExam, setAccessExam] = useState<Exam | null>(null);
  const [isAdminAssignOpen, setIsAdminAssignOpen] = useState(false);

  // Admin History State
  const [historyUsers, setHistoryUsers] = useState<DirectoryProfile[]>([]);

  // Szűrő State-ek
  const [selectedHistoryUser, setSelectedHistoryUser] = useState<string>("all");
  const [selectedHistoryExam, setSelectedHistoryExam] = useState<string>("all"); // ÚJ

  const [historyPage, setHistoryPage] = useState(0);
  const [historyItems, setHistoryItems] = useState<ExamSubmissionView[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const ITEMS_PER_PAGE = 10;

  // Dropdown UI State
  const [isUserListOpen, setIsUserListOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [isExamListOpen, setIsExamListOpen] = useState(false); // ÚJ
  const [examSearch, setExamSearch] = useState(""); // ÚJ
  const examDropdownRef = useRef<HTMLDivElement>(null); // ÚJ

  const [myOverrides, setMyOverrides] = useState<Record<string, string>>({});

  const hasGradingRights = !!profile && (canCreateAnyExam(profile) || !!profile.qualifications?.includes('TB') || isSupervisory(profile) || isHighCommand(profile));
  const canAssignExams = profile && (isSupervisory(profile) || isHighCommand(profile) || profile.is_bureau_manager);

  // JAVÍTVA: examIdFilter hozzáadva
  const fetchHistory = useCallback(async (page: number, userIdFilter: string, examIdFilter: string) => {
    let query = supabase.from('exam_submissions_view')
      .select('*', {count: 'exact'})
      .neq('status', 'pending')
      .is('deleted_at', null)
      .order('created_at', {ascending: false})
      .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1);

    if (userIdFilter !== "all") query = query.eq('user_id', userIdFilter);
    if (examIdFilter !== "all") query = query.eq('exam_id', examIdFilter); // ÚJ SZŰRÉS

    const {data, count, error} = await query;
    if (!error) {
      setHistoryItems((data ?? []) as ExamSubmissionView[]);
      setHistoryTotal(count || 0);
      setHistoryPage(page);
    }
  }, [supabase]);

  const fetchData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      // Independent queries run in parallel.
      const [examResult, overrideResult, submissionResult] = await Promise.all([
        supabase.from('exams').select('*').order('created_at', {ascending: false}),
        supabase.from('exam_overrides').select('exam_id, access_type').eq('user_id', profile.id),
        supabase.from('exam_submissions').select('*, exams(title)').eq('user_id', profile.id).is('deleted_at', null)
          .order('start_time', {ascending: false}),
      ]);
      const exams = (examResult.data ?? []) as Exam[];
      setAllExamsList(exams);

      const overridesMap: Record<string, string> = {};
      (overrideResult.data ?? []).forEach((o: {exam_id: string, access_type: string}) => overridesMap[o.exam_id] = o.access_type);
      setMyOverrides(overridesMap);

      setAvailableExams(exams.filter(exam => isExamAvailable(profile, exam, overridesMap[exam.id])));
      setMySubmissions((submissionResult.data ?? []) as ExamSubmission[]);

      if (hasGradingRights) {
        const [{data: pendingRaw, error}, directory] = await Promise.all([
          supabase.from('exam_submissions')
            .select('*, exams(id, title, type, division, passing_percentage)')
            .eq('status', 'pending').is('deleted_at', null).order('end_time', {ascending: true}),
          getProfileDirectory(),
        ]);
        const members = new Map(directory.map(member => [member.id, member]));
        if (!error && pendingRaw) {
          const finalPending = (pendingRaw as (ExamSubmission & {exams: Exam | null})[])
            .filter(sub => sub.exams && canGradeExam(profile, sub.exams))
            .map(sub => ({
              ...sub,
              exam_title: sub.exams?.title,
              user_full_name: (sub.user_id && members.get(sub.user_id)?.full_name) || sub.applicant_name || 'Ismeretlen',
              user_badge_number: (sub.user_id && members.get(sub.user_id)?.badge_number) || '?',
            }));
          setPendingGrading(finalPending);
        }
        setHistoryUsers(directory.filter(member => member.system_role !== 'pending'));
        void fetchHistory(0, "all", "all");
      }
    } catch {
      toast.error("Adatlekérési hiba");
    } finally {
      setLoading(false);
    }
  }, [profile, supabase, fetchHistory, hasGradingRights]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Click outside handlers
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsUserListOpen(false);
      if (examDropdownRef.current && !examDropdownRef.current.contains(event.target as Node)) setIsExamListOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const canTrash = !!profile && isStaff(profile) && hasGradingRights;
  const canPurge = !!profile && (isExecutive(profile) || !!profile.is_bureau_manager);

  const fetchTrash = useCallback(async () => {
    const {data, error} = await supabase.from('exam_submissions_view').select('*')
      .not('deleted_at', 'is', null).order('deleted_at', {ascending: false}).limit(100);
    if (error) {
      toast.error("A lomtár betöltése nem sikerült.");
      return;
    }
    setTrashItems((data ?? []) as ExamSubmissionView[]);
  }, [supabase]);

  useEffect(() => {
    if (activeTab === "trash" && canTrash) void fetchTrash();
  }, [activeTab, canTrash, fetchTrash]);

  const restoreSubmission = async (id: string) => {
    setWorkingId(id);
    const {error} = await supabase.rpc('exam_submission_restore', {_submission_id: id});
    setWorkingId(null);
    if (error) {
      toast.error("Hiba: " + errorMessage(error));
      return;
    }
    setTrashItems(prev => prev ? prev.filter(item => item.id !== id) : prev);
    toast.success("Vizsgalap visszaállítva.");
    void fetchData();
  };

  /** Moves a wrongly or test-filled sheet to the trash (supervisors and above; restorable). */
  const trashSubmission = async (id: string) => {
    setWorkingId(id);
    const {error} = await supabase.rpc('exam_submission_trash', {_submission_id: id});
    setWorkingId(null);
    if (error) {
      toast.error("Hiba: " + errorMessage(error));
      return;
    }
    setPendingGrading(prev => prev.filter(item => item.id !== id));
    setHistoryItems(prev => prev.filter(item => item.id !== id));
    setHistoryTotal(prev => Math.max(0, prev - 1));
    setTrashItems(null);
    toast.success("Vizsgalap a lomtárba helyezve.", {
      action: {label: "Visszavonás", onClick: () => void restoreSubmission(id)},
    });
  };

  const purgeSubmission = async () => {
    if (!purgeTarget) return;
    const id = purgeTarget.id;
    setPurgeTarget(null);
    setWorkingId(id);
    const {error} = await supabase.rpc('exam_submission_purge', {_submission_id: id});
    setWorkingId(null);
    if (error) {
      toast.error("Hiba: " + errorMessage(error));
      return;
    }
    setTrashItems(prev => prev ? prev.filter(item => item.id !== id) : prev);
    toast.success("Vizsgalap véglegesen törölve.");
  };

  const handleCopyLink = (examId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/exam/public/${examId}`);
    toast.success("Link másolva!");
  }

  const filteredHistoryUsers = historyUsers.filter(u => u.full_name.toLowerCase().includes(userSearch.toLowerCase()));
  const filteredHistoryExams = allExamsList.filter(e => e.title.toLowerCase().includes(examSearch.toLowerCase()));

  if (loading && !profile) return <div className="flex h-screen items-center justify-center bg-slate-950"><Loader2
    className="w-12 h-12 text-yellow-500 animate-spin"/></div>;
  if (!profile) return null;

  const latestSubmissionByExam = new Map<string, ExamSubmission>();
  // Submissions arrive newest first: keep the first one per exam.
  mySubmissions.forEach(sub => {
    if (!latestSubmissionByExam.has(sub.exam_id)) latestSubmissionByExam.set(sub.exam_id, sub);
  });

  return (
    <div className="pb-10 flex flex-col">
      {accessExam &&
        <ExamAccessDialog open={!!accessExam} onOpenChange={(o) => !o && setAccessExam(null)} exam={accessExam}
                          onUpdate={fetchData}/>}
      <AdminExamAssignDialog open={isAdminAssignOpen} onOpenChange={setIsAdminAssignOpen}/>

      <AlertDialog open={!!purgeTarget} onOpenChange={(open) => !open && setPurgeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Végleges törlés</AlertDialogTitle>
            <AlertDialogDescription>
              {purgeTarget?.user_full_name || purgeTarget?.applicant_name || "A kitöltő"} „{purgeTarget?.exam_title}” vizsgalapja
              minden válasszal együtt véglegesen törlődik. Ez nem vonható vissza.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mégse</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-500" onClick={() => void purgeSubmission()}>
              Végleges törlés
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PageHeader
        icon={GraduationCap}
        eyebrow="Oktatás"
        title="Vizsgaközpont"
        description="Képzések, vizsgák, javítás és eredmények."
        className="mb-6"
        actions={(
          <>
            {canAssignExams && (
              <Button variant="outline" onClick={() => setIsAdminAssignOpen(true)}><UserPlus/> Kézi kiosztás</Button>
            )}
            {profile && canCreateAnyExam(profile) && (
              <Button onClick={() => navigate('/exams/editor')}><Plus/> Új vizsga</Button>
            )}
          </>
        )}
      />

      <div className="flex-1 flex flex-col w-full min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mb-6 w-fit max-w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="available"
                         className="h-9 px-4"><LayoutGrid
              className="w-4 h-4"/> Vizsgák</TabsTrigger>
            <TabsTrigger value="history"
                         className="h-9 px-4"><History
              className="w-4 h-4"/> Saját eredmények</TabsTrigger>
            {hasGradingRights && (
              <>
                <div className="w-px h-6 bg-slate-800 mx-2 self-center"></div>
                <TabsTrigger value="grading"
                             className="h-9 px-4">
                  Javítás {pendingGrading.length > 0 && <span
                  className="ml-1 rounded-full bg-primary/15 px-1.5 text-[11px] font-semibold text-primary">{pendingGrading.length}</span>}
                </TabsTrigger>
                <TabsTrigger value="all_history"
                             className="h-9 px-4"><Users
                  className="w-4 h-4"/> Adatbázis</TabsTrigger>
                {canTrash && (
                  <TabsTrigger value="trash"
                               className="h-9 px-4"><Trash2
                    className="w-4 h-4"/> Lomtár</TabsTrigger>
                )}
              </>
            )}
          </TabsList>

          <TabsContent value="available" className="flex-1 min-h-0 mt-0">
            {availableExams.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-32 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/20 text-slate-500">
                <FileText className="w-16 h-16 mb-4 opacity-20"/><p
                className="font-mono text-sm uppercase tracking-widest">NINCS ELÉRHETŐ KÉPZÉS</p></div>
            ) : (
              <ScrollArea className="h-full pr-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6 pb-10">
                  {availableExams.map(exam => (
                    <ExamCard key={exam.id} exam={exam} profile={profile}
                              lastSubmission={latestSubmissionByExam.get(exam.id)}
                              overrideType={myOverrides[exam.id]}
                              onEdit={(examId) => navigate(`/exams/editor/${examId}`)}
                              onManageAccess={setAccessExam}
                              onCopyLink={handleCopyLink}
                              onStart={(examId) => navigate(`/exam/public/${examId}`)}/>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          {hasGradingRights && (
            <TabsContent value="grading" className="flex-1 min-h-0 mt-0">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-4 pb-10 max-w-4xl mx-auto">
                  {pendingGrading.length === 0 ? (
                    <div
                      className="text-center py-20 text-slate-500 font-mono text-sm uppercase tracking-widest bg-slate-900/30 rounded-xl border border-slate-800">NINCS
                      JAVÍTÁSRA VÁRÓ VIZSGA</div>
                  ) : pendingGrading.map(sub => (
                    <div key={sub.id}
                         className="flex items-center justify-between p-6 rounded-lg bg-[#0b1221]/75 backdrop-blur-xl border border-slate-800 hover:border-red-500/30 transition-all shadow-lg group">
                      <div className="flex items-center gap-5">
                        <div
                          className="w-12 h-12 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-300 font-mono font-bold text-lg shadow-inner">{(sub as any).user_badge_number}</div>
                        <div>
                          <div className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-1">JAVÍTÁSRA
                            VÁR
                          </div>
                          <h4 className="font-bold text-white text-lg">{(sub as any).exam_title}</h4><p
                          className="text-xs text-slate-400 font-mono uppercase mt-1">JELÖLT: <span
                          className="text-white">{(sub as any).user_full_name}</span></p></div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-500 font-mono uppercase mb-2">BENYÚJTVA</div>
                        <div
                          className="text-xs text-slate-300 mb-3">{formatDistanceToNow(new Date(sub.end_time || ''), {
                          locale: hu,
                          addSuffix: true
                        })}</div>
                        <div className="flex items-center justify-end gap-2">
                          {canTrash && (
                            <Button variant="ghost" size="icon" title="Hibás / teszt kitöltés törlése (lomtárba)"
                                    disabled={workingId === sub.id} onClick={() => void trashSubmission(sub.id)}
                                    className="h-8 w-8 text-slate-500 hover:text-red-400"><Trash2 className="w-4 h-4"/></Button>
                          )}
                          <Button onClick={() => navigate(`/exams/grading/${sub.id}`)}
                                  className="bg-red-600 hover:bg-red-500 text-white font-bold uppercase tracking-wider h-8 text-xs shadow-[0_0_10px_rgba(220,38,38,0.3)]">MEGNYITÁS <ChevronRight
                            className="w-3 h-3 ml-1"/></Button>
                        </div></div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          )}

          {hasGradingRights && (
            <TabsContent value="all_history" className="flex-1 min-h-0 mt-0 flex flex-col">
              <div
                className="flex flex-col lg:flex-row items-center gap-4 bg-[#0b1221]/75 backdrop-blur-xl p-4 rounded-t-xl border border-slate-800 shrink-0">
                <Users className="w-5 h-5 text-slate-400 shrink-0 hidden lg:block"/>

                {/* USER FILTER DROPDOWN */}
                <div className="relative w-full lg:w-[300px]" ref={dropdownRef}>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500"/>
                    <Input placeholder="FELHASZNÁLÓ SZŰRÉS..." value={userSearch} onChange={(e) => {
                      setUserSearch(e.target.value);
                      setIsUserListOpen(true);
                    }} onFocus={() => setIsUserListOpen(true)}
                           className="pl-9 bg-slate-900 border-slate-700 h-9 text-xs font-mono"/>
                    {selectedHistoryUser !== 'all' && (<button onClick={() => {
                      setSelectedHistoryUser('all');
                      setUserSearch("");
                      fetchHistory(0, 'all', selectedHistoryExam);
                    }} className="absolute right-3 top-2.5 text-slate-500 hover:text-white"><X className="w-4 h-4"/>
                    </button>)}
                  </div>
                  {isUserListOpen && (
                    <div
                      className="absolute top-full left-0 w-full mt-1 bg-slate-900 border border-slate-700 rounded-md shadow-2xl z-50 max-h-[300px] overflow-y-auto">
                      <div
                        className="p-2 hover:bg-slate-800 cursor-pointer text-slate-300 hover:text-white border-b border-slate-800 text-xs font-mono"
                        onClick={() => {
                          setSelectedHistoryUser('all');
                          setUserSearch("");
                          setIsUserListOpen(false);
                          fetchHistory(0, 'all', selectedHistoryExam);
                        }}>-- MINDENKI --
                      </div>
                      {filteredHistoryUsers.map(u => (
                        <div key={u.id}
                             className="p-2 hover:bg-slate-800 cursor-pointer text-slate-300 hover:text-white text-xs font-mono"
                             onClick={() => {
                               setSelectedHistoryUser(u.id);
                               setUserSearch(u.full_name);
                               setIsUserListOpen(false);
                               fetchHistory(0, u.id, selectedHistoryExam);
                             }}>{u.full_name}</div>
                      ))}
                    </div>
                  )}
                </div>

                {/* EXAM FILTER DROPDOWN */}
                <div className="relative w-full lg:w-[300px]" ref={examDropdownRef}>
                  <div className="relative">
                    <Filter className="absolute left-3 top-2.5 h-4 w-4 text-slate-500"/>
                    <Input placeholder="VIZSGA SZŰRÉS..." value={examSearch} onChange={(e) => {
                      setExamSearch(e.target.value);
                      setIsExamListOpen(true);
                    }} onFocus={() => setIsExamListOpen(true)}
                           className="pl-9 bg-slate-900 border-slate-700 h-9 text-xs font-mono"/>
                    {selectedHistoryExam !== 'all' && (<button onClick={() => {
                      setSelectedHistoryExam('all');
                      setExamSearch("");
                      fetchHistory(0, selectedHistoryUser, 'all');
                    }} className="absolute right-3 top-2.5 text-slate-500 hover:text-white"><X className="w-4 h-4"/>
                    </button>)}
                  </div>
                  {isExamListOpen && (
                    <div
                      className="absolute top-full left-0 w-full mt-1 bg-slate-900 border border-slate-700 rounded-md shadow-2xl z-50 max-h-[300px] overflow-y-auto">
                      <div
                        className="p-2 hover:bg-slate-800 cursor-pointer text-slate-300 hover:text-white border-b border-slate-800 text-xs font-mono"
                        onClick={() => {
                          setSelectedHistoryExam('all');
                          setExamSearch("");
                          setIsExamListOpen(false);
                          fetchHistory(0, selectedHistoryUser, 'all');
                        }}>-- MINDEN VIZSGA --
                      </div>
                      {filteredHistoryExams.map(e => (
                        <div key={e.id}
                             className="p-2 hover:bg-slate-800 cursor-pointer text-slate-300 hover:text-white text-xs font-mono"
                             onClick={() => {
                               setSelectedHistoryExam(e.id);
                               setExamSearch(e.title);
                               setIsExamListOpen(false);
                               fetchHistory(0, selectedHistoryUser, e.id);
                             }}>{e.title}</div>
                      ))}
                    </div>
                  )}
                </div>

                <span className="text-xs font-mono text-slate-500 ml-auto hidden lg:inline">REKORDOK: <span
                  className="text-white">{historyTotal}</span></span>
              </div>

              <div
                className="flex-1 bg-[#050a14]/55 backdrop-blur-xl border-x border-b border-slate-800 rounded-b-xl overflow-hidden flex flex-col relative">
                <div className="absolute inset-0 pointer-events-none opacity-[0.02]" style={{
                  backgroundImage: 'linear-gradient(to right, #3b82f6 1px, transparent 1px)',
                  backgroundSize: '40px 100%'
                }}></div>
                <ScrollArea className="flex-1">
                  <div className="divide-y divide-slate-800/50">
                    {historyItems.map(item => (
                      <div key={item.id} onClick={() => navigate(`/exams/grading/${item.id}`)}
                           className="flex items-center justify-between p-4 hover:bg-slate-900/50 cursor-pointer transition-colors group">
                        <div className="flex items-center gap-4">
                          <div
                            className={cn("w-2 h-2 rounded-full shadow-[0_0_5px_currentColor]", item.status === 'passed' ? 'bg-green-500 text-green-500' : 'bg-red-500 text-red-500')}></div>
                          <div>
                            <div
                              className="text-sm font-bold text-white font-mono uppercase">{item.exam_title}</div>
                            <div
                              className="text-[10px] text-slate-500 font-mono mt-0.5">{item.user_full_name} • {item.created_at ? new Date(item.created_at).toLocaleDateString('hu-HU') : '-'}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                        <div className="text-right">
                          {/* JAVÍTÁS: Százalék kijelzése */}
                          <div
                            className={cn("text-lg font-mono font-bold", item.status === 'passed' ? 'text-green-500' : 'text-red-500')}>
                            {item.total_score} PONT <span
                            className="text-sm opacity-70 ml-1">({item.percentage ?? 0}%)</span>
                          </div>
                          {item.tab_switch_count > 0 &&
                            <div className="text-[9px] text-red-400 font-bold flex items-center justify-end gap-1">
                              <AlertCircle className="w-3 h-3"/> {item.tab_switch_count} TAB VÁLTÁS</div>}
                        </div>
                        {canTrash && (
                          <Button variant="ghost" size="icon" title="Hibás / teszt kitöltés törlése (lomtárba)"
                                  disabled={workingId === item.id}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void trashSubmission(item.id);
                                  }}
                                  className="h-8 w-8 text-slate-500 hover:text-red-400"><Trash2 className="w-4 h-4"/></Button>
                        )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="p-3 border-t border-slate-800 bg-slate-900 flex justify-center gap-4">
                  <Button variant="ghost" size="sm" disabled={historyPage === 0}
                          onClick={() => fetchHistory(historyPage - 1, selectedHistoryUser, selectedHistoryExam)}
                          className="text-xs">ELŐZŐ</Button>
                  <span className="text-xs font-mono text-slate-500 self-center">{historyPage + 1}. OLDAL</span>
                  <Button variant="ghost" size="sm" disabled={(historyPage + 1) * ITEMS_PER_PAGE >= historyTotal}
                          onClick={() => fetchHistory(historyPage + 1, selectedHistoryUser, selectedHistoryExam)}
                          className="text-xs">KÖVETKEZŐ</Button>
                </div>
              </div>
            </TabsContent>
          )}

          {canTrash && (
            <TabsContent value="trash" className="flex-1 min-h-0 mt-0">
              <div className="panel overflow-hidden">
                <div className="border-b px-5 py-4">
                  <p className="text-sm font-semibold text-white">Törölt vizsgalapok</p>
                  <p className="text-xs text-muted-foreground">
                    A hibás vagy tesztként kitöltött lapok ide kerülnek. A vizsgázó nem látja őket, és bármikor visszaállíthatók.
                  </p>
                </div>
                {trashItems === null ? (
                  <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary/70"/></div>
                ) : trashItems.length === 0 ? (
                  <EmptyState icon={Trash2} title="A lomtár üres." compact/>
                ) : (
                  <ul className="divide-y divide-white/5">
                    {trashItems.map(item => (
                      <li key={item.id} className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white">{item.exam_title}</p>
                          <p className="text-xs text-slate-500">
                            {item.user_full_name || item.applicant_name || "Ismeretlen"} · kitöltve: {new Date(item.start_time).toLocaleString('hu-HU')}
                            {item.deleted_at ? ` · törölve: ${new Date(item.deleted_at).toLocaleString('hu-HU')}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="ghost" onClick={() => navigate(`/exams/grading/${item.id}`)}>Megtekintés</Button>
                          <Button size="sm" variant="outline" disabled={workingId === item.id} onClick={() => void restoreSubmission(item.id)}>
                            <RotateCcw/> Visszaállítás
                          </Button>
                          {canPurge && (
                            <Button size="icon" variant="ghost" title="Végleges törlés" disabled={workingId === item.id}
                                    className="text-slate-500 hover:text-red-400" onClick={() => setPurgeTarget(item)}>
                              <Trash2 className="w-4 h-4"/>
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </TabsContent>
          )}

          <TabsContent value="history" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full pr-4">
              <div className="space-y-3 pb-10">
                {mySubmissions.map(sub => (
                  <div key={sub.id}
                       className="flex items-center justify-between p-4 rounded-lg bg-[#0b1221]/75 backdrop-blur-xl border border-slate-800 group hover:border-slate-600 transition-all cursor-pointer"
                       onClick={() => sub.status !== 'pending' && navigate(`/exams/grading/${sub.id}`)}>
                    <div className="flex items-center gap-4">
                      <div
                        className={cn("p-2 rounded border", sub.status === 'passed' ? 'bg-green-900/20 border-green-900 text-green-500' : sub.status === 'failed' ? 'bg-red-900/20 border-red-900 text-red-500' : 'bg-yellow-900/20 border-yellow-900 text-yellow-500')}>
                        <FileText className="w-5 h-5"/></div>
                      <div><h4
                        className="font-bold text-white text-sm uppercase tracking-wide">{(sub as any).exams?.title}</h4>
                        <div
                          className="text-[10px] text-slate-500 font-mono mt-1">{new Date(sub.start_time).toLocaleDateString('hu-HU')}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-[10px] text-slate-500 uppercase font-bold">EREDMÉNY</div>
                        <div
                          className={cn("text-sm font-mono font-bold", sub.status === 'passed' ? 'text-green-500' : sub.status === 'failed' ? 'text-red-500' : 'text-yellow-500')}>{sub.status === 'passed' ? 'SIKERES' : sub.status === 'failed' ? 'SIKERTELEN' : 'FOLYAMATBAN'}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-white transition-colors"/>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}