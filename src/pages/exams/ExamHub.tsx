import {useEffect, useState, useCallback, useRef} from "react";
import {useAuth} from "@/context/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area"
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {
  FileText, History, Plus, AlertCircle, Search, ChevronRight, GraduationCap, PenTool,
  Link as LinkIcon, Lock, X, UserPlus, Clock, Users, Trophy, LayoutGrid, Timer
} from "lucide-react";
import {useNavigate} from "react-router-dom";
import {FACTION_RANKS} from "@/types/supabase";
import type {Exam, ExamSubmission} from "@/types/exams";
import {toast} from "sonner";
import {
  canCreateAnyExam,
  canManageExamContent,
  canManageExamAccess,
  canGradeExam,
  isSupervisory,
  isCommand,
  isExecutive
} from "@/lib/utils";
import {formatDistanceToNow} from "date-fns";
import {hu} from "date-fns/locale";
import {Input} from "@/components/ui/input";
import {ExamAccessDialog} from "./components/ExamAccessDialog";
import {AdminExamAssignDialog} from "./components/AdminExamAssignDialog";
import {cn} from "@/lib/utils";

const MAIN_DIVISIONS = ['TSB', 'SEB', 'MCB'];

// --- STÍLUS KONSTANSOK ---
const TERMINAL_CARD = "bg-[#0b1221] border border-slate-800 shadow-xl overflow-hidden relative group transition-all hover:border-yellow-500/30 flex flex-col h-full";

export function ExamHub() {
  const {supabase, profile} = useAuth();
  const navigate = useNavigate();

  // --- STATEK ---
  const [availableExams, setAvailableExams] = useState<Exam[]>([]);
  const [mySubmissions, setMySubmissions] = useState<ExamSubmission[]>([]);
  const [pendingGrading, setPendingGrading] = useState<ExamSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog state-ek
  const [accessExam, setAccessExam] = useState<Exam | null>(null);
  const [isAdminAssignOpen, setIsAdminAssignOpen] = useState(false);

  // Admin History State
  const [historyUsers, setHistoryUsers] = useState<any[]>([]);
  const [selectedHistoryUser, setSelectedHistoryUser] = useState<string>("all");
  const [historyPage, setHistoryPage] = useState(0);
  const [historyItems, setHistoryItems] = useState<ExamSubmission[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const ITEMS_PER_PAGE = 10;

  const [isUserListOpen, setIsUserListOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Jogosultságok
  const hasGradingRights = (profile && (pendingGrading.length > 0 || canCreateAnyExam(profile) || profile.qualifications?.includes('TB') || ['Sergeant I.', 'Sergeant II.'].includes(profile.faction_rank)));
  const canAssignExams = profile && (isSupervisory(profile) || isCommand(profile) || isExecutive(profile) || profile.is_bureau_manager);

  const fetchHistory = useCallback(async (page: number, userIdFilter: string) => {
    let query = supabase.from('exam_submissions_view')
      .select('*', {count: 'exact'})
      .neq('status', 'pending')
      .order('created_at', {ascending: false})
      .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1);

    if (userIdFilter !== "all") {
      query = query.eq('user_id', userIdFilter);
    }

    const {data, count, error} = await query;
    if (!error) {
      setHistoryItems(data as any || []);
      setHistoryTotal(count || 0);
      setHistoryPage(page);
    } else {
      console.error("History fetch error", error);
    }
  }, [supabase]);

  // --- ADATLEKÉRÉS ---
  const fetchData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      // 1. Vizsgák + Override
      const {data: exams} = await supabase.from('exams').select('*').order('created_at', {ascending: false});
      const {data: myOverrides} = await supabase.from('exam_overrides').select('exam_id, access_type').eq('user_id', profile.id);

      const filteredExams = (exams as unknown as Exam[] || []).filter(exam => {
        const override = myOverrides?.find(o => o.exam_id === exam.id);
        if (override) return override.access_type === 'allow';
        if (canManageExamAccess(profile, exam)) return true;
        if (!exam.is_active) return false;
        if (profile.is_bureau_manager) return true;
        if (exam.is_public) return true;

        if (exam.type === 'trainee') return false;
        if (exam.type === 'deputy_i') return profile.faction_rank === 'Deputy Sheriff Trainee';

        if (exam.division) {
          const isMainDivisionExam = MAIN_DIVISIONS.includes(exam.division);
          if (isMainDivisionExam) {
            if (profile.division === 'TSB') {
            } else if (profile.division !== exam.division) return false;
          }
        }

        if (exam.required_rank) {
          const userRankIndex = FACTION_RANKS.indexOf(profile.faction_rank);
          const reqRankIndex = FACTION_RANKS.indexOf(exam.required_rank as any);
          if (reqRankIndex !== -1 && userRankIndex > reqRankIndex) return false;
        }
        return true;
      });
      setAvailableExams(filteredExams);

      // 2. Saját kitöltések
      const {data: subs} = await supabase.from('exam_submissions').select('*, exams(title)').eq('user_id', profile.id).order('start_time', {ascending: false});
      setMySubmissions(subs as any || []);

      // 3. Javításra váró
      if (hasGradingRights) {
        const {
          data: pendingRaw,
          error
        } = await supabase.from('exam_submissions').select('*, exams(*)').eq('status', 'pending').order('end_time', {ascending: true});
        if (!error && pendingRaw) {
          const userIds = [...new Set(pendingRaw.map(p => p.user_id))];
          let profilesMap: Record<string, any> = {};
          if (userIds.length > 0) {
            const {data: profiles} = await supabase.from('profiles').select('id, full_name, badge_number').in('id', userIds);
            profiles?.forEach(p => profilesMap[p.id] = p);
          }
          const finalPending = pendingRaw.filter((sub: any) => sub.exams && canGradeExam(profile, sub.exams)).map((sub: any) => ({
            ...sub, exam_title: sub.exams?.title,
            user_full_name: profilesMap[sub.user_id]?.full_name || sub.applicant_name || 'Ismeretlen',
            user_badge_number: profilesMap[sub.user_id]?.badge_number || '?',
          }));
          setPendingGrading(finalPending);
        }
        const {data: users} = await supabase.from('profiles').select('id, full_name').order('full_name');
        setHistoryUsers(users || []);
        fetchHistory(0, "all");
      }
    } catch (err: any) {
      toast.error("Adatlekérési hiba");
    } finally {
      setLoading(false);
    }
  }, [profile, supabase, fetchHistory, hasGradingRights]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsUserListOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCopyLink = (examId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/exam/public/${examId}`);
    toast.success("Link másolva!");
  }

  const filteredAvailable = availableExams.filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredHistoryUsers = historyUsers.filter(u => u.full_name.toLowerCase().includes(userSearch.toLowerCase()));

  // --- KÁRTYA KOMPONENS ---
  const ExamCard = ({exam}: { exam: Exam }) => {
    const lastSubmission = mySubmissions.find(s => s.exam_id === exam.id);
    const isBlocked = lastSubmission?.status === 'failed' && lastSubmission.retry_allowed_at && new Date(lastSubmission.retry_allowed_at) > new Date();
    const isPending = lastSubmission?.status === 'pending';
    const canEditContent = profile && canManageExamContent(profile, exam);
    const canAccessManage = profile && canManageExamAccess(profile, exam);
    const canShare = profile && canGradeExam(profile, exam) && exam.allow_sharing;

    const canTake = (() => {
      if (exam.type === 'trainee') return false;
      if (exam.type === 'deputy_i') return profile?.faction_rank === 'Deputy Sheriff Trainee';
      if (canEditContent) return false;
      return true;
    })();

    return (
      <div className={TERMINAL_CARD}>
        <div
          className={cn("absolute top-0 left-0 w-1 h-full transition-colors", !exam.is_active ? "bg-red-900" : "bg-yellow-500 group-hover:bg-yellow-400")}/>

        {/* Header Section */}
        <div className="p-5 pb-0 flex-none">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline"
                     className="bg-slate-900/50 border-slate-700 text-slate-400 font-mono text-[9px] uppercase tracking-wider">{exam.division || 'CORE'}</Badge>
              {exam.is_public &&
                <Badge className="bg-blue-900/20 text-blue-400 border-blue-900/50 text-[9px]">PUBLIC</Badge>}
            </div>
            {!exam.is_active && <div
              className="px-2 py-0.5 bg-red-950/50 text-red-500 text-[10px] font-bold border border-red-900 rounded uppercase">INAKTÍV</div>}
          </div>

          {/* FIX MAGASSÁGÚ CÍM (3 sornyi hely) */}
          <div className="h-[4.5rem] flex items-center">
            <h3
              className="text-lg font-black text-white group-hover:text-yellow-500 transition-colors uppercase leading-tight line-clamp-3 w-full"
              title={exam.title}>{exam.title}</h3>
          </div>
        </div>

        {/* Info Grid */}
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

        {/* Actions Footer */}
        <div className="mt-auto border-t border-slate-800/50 bg-slate-950/30 p-3 flex-none">
          <div className="flex gap-2">
            {canEditContent && (
              <Button size="sm" variant="ghost" onClick={() => navigate(`/exams/editor/${exam.id}`)}
                      className="h-8 flex-1 text-[10px] uppercase font-bold bg-slate-900 border border-slate-700 hover:border-yellow-500/50 hover:text-yellow-500">
                <PenTool className="w-3 h-3 mr-1"/> SZERK.
              </Button>
            )}
            {canAccessManage && (
              <Button size="icon" variant="ghost" onClick={() => setAccessExam(exam)}
                      className="h-8 w-8 bg-slate-900 border border-slate-700 hover:text-blue-400 hover:border-blue-500/50">
                <Lock className="w-3 h-3"/>
              </Button>
            )}
            {canShare && (
              <Button size="icon" variant="ghost" onClick={() => handleCopyLink(exam.id)}
                      className="h-8 w-8 bg-slate-900 border border-slate-700 hover:text-green-400 hover:border-green-500/50">
                <LinkIcon className="w-3 h-3"/>
              </Button>
            )}
          </div>

          {canTake && (
            <div className="mt-2">
              {isBlocked ? (
                <Button disabled
                        className="w-full h-9 bg-red-950/10 text-red-500 border border-red-900/50 text-xs uppercase font-bold">
                  <Clock
                    className="w-3 h-3 mr-2"/> {formatDistanceToNow(new Date(lastSubmission!.retry_allowed_at!), {locale: hu})}
                </Button>
              ) : isPending ? (
                <Button disabled
                        className="w-full h-9 bg-yellow-900/10 text-yellow-500 border border-yellow-900/50 text-xs uppercase font-bold animate-pulse">FOLYAMATBAN...</Button>
              ) : (
                <Button
                  className="w-full h-9 bg-yellow-600 hover:bg-yellow-500 text-black font-black uppercase tracking-wider text-xs shadow-[0_0_15px_rgba(234,179,8,0.2)]"
                  onClick={() => navigate(`/exam/public/${exam.id}`)}>
                  VIZSGA INDÍTÁSA <ChevronRight className="w-3 h-3 ml-1"/>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading && !profile) return <div className="flex h-screen items-center justify-center bg-slate-950"><Loader2
    className="w-12 h-12 text-yellow-500 animate-spin"/></div>;

  return (
    <div className="min-h-screen bg-[#050a14] pb-20 flex flex-col font-sans">
      {/* Dialogs */}
      {accessExam &&
        <ExamAccessDialog open={!!accessExam} onOpenChange={(o) => !o && setAccessExam(null)} exam={accessExam}
                          onUpdate={fetchData}/>}
      <AdminExamAssignDialog open={isAdminAssignOpen} onOpenChange={setIsAdminAssignOpen}/>

      {/* --- HEADER --- */}
      <div className="border-b-2 border-yellow-600/20 bg-[#0a0f1c] relative overflow-hidden shadow-2xl shrink-0">
        <div className="absolute inset-0 bg-yellow-500/5 pointer-events-none"
             style={{clipPath: 'polygon(0 0, 100% 0, 80% 100%, 0% 100%)'}}></div>
        <div
          className="max-w-[1800px] mx-auto px-6 py-6 flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-center justify-center text-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.1)]">
              <GraduationCap className="w-8 h-8"/>
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tighter uppercase font-mono">VIZSGAKÖZPONT</h1>
              <p className="text-xs text-yellow-500/60 font-bold uppercase tracking-[0.3em]">Training Bureau & Education
                System</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {canAssignExams && (
              <Button variant="outline" className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
                      onClick={() => setIsAdminAssignOpen(true)}>
                <UserPlus className="w-4 h-4 mr-2"/> KÉZI KIOSZTÁS
              </Button>
            )}
            {profile && canCreateAnyExam(profile) && (
              <Button
                className="bg-yellow-600 hover:bg-yellow-500 text-black font-black uppercase tracking-wider px-6 shadow-lg shadow-yellow-900/20"
                onClick={() => navigate('/exams/editor')}>
                <Plus className="w-4 h-4 mr-2"/> ÚJ KURZUS
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* --- TABS & CONTENT --- */}
      <div className="max-w-[1800px] mx-auto px-6 py-8 flex-1 flex flex-col w-full min-h-0">
        <Tabs defaultValue="available" className="flex-1 flex flex-col min-h-0">

          {/* Filter Bar */}
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-6 shrink-0">
            <TabsList className="bg-[#0b1221] border border-slate-800 p-1 h-auto flex-wrap gap-1 shadow-lg">
              <TabsTrigger value="available"
                           className="data-[state=active]:bg-yellow-600 data-[state=active]:text-black text-slate-400 uppercase font-bold tracking-wider text-xs px-6 py-2.5 h-10 transition-all clip-path-slant"><LayoutGrid
                className="w-4 h-4 mr-2"/> KURZUSOK</TabsTrigger>
              <TabsTrigger value="history"
                           className="data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400 uppercase font-bold tracking-wider text-xs px-6 py-2.5 h-10 transition-all"><History
                className="w-4 h-4 mr-2"/> ELŐZMÉNYEK</TabsTrigger>
              {hasGradingRights && (
                <>
                  <div className="w-px h-6 bg-slate-800 mx-2 self-center"></div>
                  <TabsTrigger value="grading"
                               className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-slate-400 uppercase font-bold tracking-wider text-xs px-6 py-2.5 h-10 transition-all border border-transparent data-[state=active]:border-red-500">
                    JAVÍTÁS {pendingGrading.length > 0 && <span
                    className="ml-2 bg-white text-red-600 px-1.5 rounded text-[10px] font-black">{pendingGrading.length}</span>}
                  </TabsTrigger>
                  <TabsTrigger value="all_history"
                               className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 uppercase font-bold tracking-wider text-xs px-6 py-2.5 h-10 transition-all">
                    <Users className="w-4 h-4 mr-2"/> ADATBÁZIS
                  </TabsTrigger>
                </>
              )}
            </TabsList>

            <div className="relative w-full xl:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>
              <Input placeholder="KERESÉS..."
                     className="pl-10 bg-[#0b1221] border-slate-800 focus-visible:ring-yellow-500/50 h-11 font-mono text-sm shadow-inner"
                     value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
            </div>
          </div>

          {/* 1. KURZUSOK (Catalog) */}
          <TabsContent value="available" className="flex-1 min-h-0 mt-0">
            {availableExams.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-32 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/20 text-slate-500">
                <FileText className="w-16 h-16 mb-4 opacity-20"/>
                <p className="font-mono text-sm uppercase tracking-widest">NINCS ELÉRHETŐ KÉPZÉS</p>
              </div>
            ) : (
              <ScrollArea className="h-full pr-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6 pb-10">
                  {filteredAvailable.map(exam => <ExamCard key={exam.id} exam={exam}/>)}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          {/* 2. JAVÍTÁS (Instructor) */}
          {hasGradingRights && (
            <TabsContent value="grading" className="flex-1 min-h-0 mt-0">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-4 pb-10 max-w-4xl mx-auto">
                  {pendingGrading.length === 0 ? (
                    <div
                      className="text-center py-20 text-slate-500 font-mono text-sm uppercase tracking-widest bg-slate-900/30 rounded-xl border border-slate-800">
                      NINCS JAVÍTÁSRA VÁRÓ VIZSGA
                    </div>
                  ) : pendingGrading.map(sub => (
                    <div key={sub.id}
                         className="flex items-center justify-between p-6 rounded-lg bg-[#0b1221] border border-slate-800 hover:border-red-500/30 transition-all shadow-lg group">
                      <div className="flex items-center gap-5">
                        <div
                          className="w-12 h-12 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-300 font-mono font-bold text-lg shadow-inner">
                          {(sub as any).user_badge_number}
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-1">JAVÍTÁSRA
                            VÁR
                          </div>
                          <h4 className="font-bold text-white text-lg">{(sub as any).exam_title}</h4>
                          <p className="text-xs text-slate-400 font-mono uppercase mt-1">
                            JELÖLT: <span className="text-white">{(sub as any).user_full_name}</span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-500 font-mono uppercase mb-2">BENYÚJTVA</div>
                        <div
                          className="text-xs text-slate-300 mb-3">{formatDistanceToNow(new Date(sub.end_time || ''), {
                          locale: hu,
                          addSuffix: true
                        })}</div>
                        <Button onClick={() => navigate(`/exams/grading/${sub.id}`)}
                                className="bg-red-600 hover:bg-red-500 text-white font-bold uppercase tracking-wider h-8 text-xs shadow-[0_0_10px_rgba(220,38,38,0.3)]">
                          MEGNYITÁS <ChevronRight className="w-3 h-3 ml-1"/>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          )}

          {/* 3. MINDEN ELŐZMÉNY (Admin DB View) - TELJES VERZIÓ */}
          {hasGradingRights && (
            <TabsContent value="all_history" className="flex-1 min-h-0 mt-0 flex flex-col">
              <div className="flex items-center gap-4 bg-[#0b1221] p-4 rounded-t-xl border border-slate-800 shrink-0">
                <Users className="w-5 h-5 text-slate-400 shrink-0"/>
                <div className="relative w-[300px]" ref={dropdownRef}>
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
                      fetchHistory(0, 'all');
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
                          fetchHistory(0, 'all');
                        }}>-- MINDENKI --
                      </div>
                      {filteredHistoryUsers.map(u => (
                        <div key={u.id}
                             className="p-2 hover:bg-slate-800 cursor-pointer text-slate-300 hover:text-white text-xs font-mono"
                             onClick={() => {
                               setSelectedHistoryUser(u.id);
                               setUserSearch(u.full_name);
                               setIsUserListOpen(false);
                               fetchHistory(0, u.id);
                             }}>{u.full_name}</div>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-xs font-mono text-slate-500">REKORDOK: <span
                  className="text-white">{historyTotal}</span></span>
              </div>

              <div
                className="flex-1 bg-[#050a14] border-x border-b border-slate-800 rounded-b-xl overflow-hidden flex flex-col relative">
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
                              className="text-sm font-bold text-white font-mono uppercase">{(item as any).exam_title}</div>
                            <div
                              className="text-[10px] text-slate-500 font-mono mt-0.5">{(item as any).user_full_name} • {item.created_at ? new Date(item.created_at).toLocaleDateString() : '-'}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className={cn("text-lg font-mono font-bold", item.status === 'passed' ? 'text-green-500' : 'text-red-500')}>{item.total_score} PONT
                          </div>
                          {item.tab_switch_count > 0 &&
                            <div className="text-[9px] text-red-400 font-bold flex items-center justify-end gap-1">
                              <AlertCircle className="w-3 h-3"/> {item.tab_switch_count} TAB VÁLTÁS</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="p-3 border-t border-slate-800 bg-slate-900 flex justify-center gap-4">
                  <Button variant="ghost" size="sm" disabled={historyPage === 0}
                          onClick={() => fetchHistory(historyPage - 1, selectedHistoryUser)}
                          className="text-xs">ELŐZŐ</Button>
                  <span className="text-xs font-mono text-slate-500 self-center">{historyPage + 1}. OLDAL</span>
                  <Button variant="ghost" size="sm" disabled={(historyPage + 1) * ITEMS_PER_PAGE >= historyTotal}
                          onClick={() => fetchHistory(historyPage + 1, selectedHistoryUser)}
                          className="text-xs">KÖVETKEZŐ</Button>
                </div>
              </div>
            </TabsContent>
          )}

          {/* 4. SAJÁT ELŐZMÉNYEK */}
          <TabsContent value="history" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full pr-4">
              <div className="space-y-3 pb-10">
                {mySubmissions.map(sub => (
                  <div key={sub.id}
                       className="flex items-center justify-between p-4 rounded-lg bg-[#0b1221] border border-slate-800 group hover:border-slate-600 transition-all cursor-pointer"
                       onClick={() => sub.status !== 'pending' && navigate(`/exams/grading/${sub.id}`)}>
                    <div className="flex items-center gap-4">
                      <div
                        className={cn("p-2 rounded border", sub.status === 'passed' ? 'bg-green-900/20 border-green-900 text-green-500' : sub.status === 'failed' ? 'bg-red-900/20 border-red-900 text-red-500' : 'bg-yellow-900/20 border-yellow-900 text-yellow-500')}>
                        <FileText className="w-5 h-5"/></div>
                      <div>
                        <h4
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
                      {sub.feedback_visible &&
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-white transition-colors"/>}
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