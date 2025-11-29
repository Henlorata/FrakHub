import {useEffect, useState, useCallback, useRef} from "react";
import {useAuth} from "@/context/AuthContext";
import {Card, CardContent} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {
  FileText, History, Plus, AlertCircle, Search, ChevronRight, GraduationCap, PenTool,
  Link as LinkIcon, Lock, X, UserPlus, Clock, Users
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

const MAIN_DIVISIONS = ['TSB', 'SEB', 'MCB'];

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
      // 1. Elérhető vizsgák lekérése
      const {data: exams} = await supabase.from('exams').select('*').order('created_at', {ascending: false});
      // Lekérjük a felhasználóra vonatkozó kivételeket (overrides)
      const {data: myOverrides} = await supabase.from('exam_overrides').select('exam_id, access_type').eq('user_id', profile.id);

      const filteredExams = (exams as unknown as Exam[] || []).filter(exam => {
        // 1. JOGOSULTSÁG KIVÉTEL (Override) - Ez az ABSZOLÚT szabály
        const override = myOverrides?.find(o => o.exam_id === exam.id);
        if (override) {
          return override.access_type === 'allow';
        }

        // 2. MENEDZSMENT JOG (Szerkesztő/Javító mindent lát)
        if (canManageExamAccess(profile, exam)) return true;

        // 3. INAKTÍV VIZSGA (Ha nem menedzser/override, rejtve)
        if (!exam.is_active) return false;

        // 4. BUREAU MANAGER (Mindent lát)
        if (profile.is_bureau_manager) return true;

        // 5. PUBLIKUS VIZSGÁK (Vendég vizsgák)
        if (exam.is_public) return true;

        // --- SPECIFIKUS SZABÁLYOK ---

        // "Trainee vizsgát csak külsősök tehetnek." -> Bejelentkezve rejtve
        // KIVÉVE: Ha menedzsment joga van (fentebb), akkor látja, hogy kezelhesse.
        if (exam.type === 'trainee') return false;

        // "DPI. vizsgát csak trainee tehet."
        // De a menedzsereknek látniuk kell, hogy kezeljék.
        // Ha nem Trainee és nem Menedzser, akkor nem látja.
        // (A menedzsment jogot már a 2-es pont lekezelte, tehát itt már csak a sima user van)
        if (exam.type === 'deputy_i') {
          return profile.faction_rank === 'Deputy Sheriff Trainee';
        }

        // 6. OSZTÁLY vs KÉPESÍTÉS LOGIKA
        if (exam.division) {
          const isMainDivisionExam = MAIN_DIVISIONS.includes(exam.division);

          if (isMainDivisionExam) {
            // Ha a felhasználó TSB-s (Field Staff), akkor LÁTHATJA a többi osztály vizsgáit is
            if (profile.division === 'TSB') {
              // Mehet tovább
            }
            // Ha viszont már speciális osztály tagja -> CSAK SAJÁT
            else if (profile.division !== exam.division) {
              return false;
            }
          } else {
            // Képesítés vizsga: Nincs divízió korlát
          }
        }

        // 7. RANG KÖVETELMÉNY
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

      // 3. Javításra váró vizsgák
      if (hasGradingRights) {
        const {data: pendingRaw, error} = await supabase
          .from('exam_submissions')
          .select('*, exams(*)')
          .eq('status', 'pending')
          .order('end_time', {ascending: true});

        if (!error && pendingRaw) {
          const userIds = [...new Set(pendingRaw.map(p => p.user_id))];
          let profilesMap: Record<string, any> = {};
          if (userIds.length > 0) {
            const {data: profiles} = await supabase.from('profiles').select('id, full_name, badge_number').in('id', userIds);
            profiles?.forEach(p => profilesMap[p.id] = p);
          }

          const finalPending = pendingRaw
            .filter((sub: any) => sub.exams && canGradeExam(profile, sub.exams))
            .map((sub: any) => ({
              ...sub,
              exam_title: sub.exams?.title,
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
      console.error(err);
      toast.error("Hiba az adatok betöltésekor");
    } finally {
      setLoading(false);
    }
  }, [profile, supabase, fetchHistory, hasGradingRights]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsUserListOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleCopyLink = (examId: string) => {
    const url = `${window.location.origin}/exam/public/${examId}`;
    navigator.clipboard.writeText(url);
    toast.success("Link másolva vágólapra!");
  }

  const filteredAvailable = availableExams.filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredHistoryUsers = historyUsers.filter(u => u.full_name.toLowerCase().includes(userSearch.toLowerCase()));

  const ExamCard = ({exam}: { exam: Exam }) => {
    const lastSubmission = mySubmissions.find(s => s.exam_id === exam.id);
    const isBlocked = lastSubmission?.status === 'failed' && lastSubmission.retry_allowed_at && new Date(lastSubmission.retry_allowed_at) > new Date();
    const isPending = lastSubmission?.status === 'pending';

    const canEditContent = profile && canManageExamContent(profile, exam);
    const canAccessManage = profile && canManageExamAccess(profile, exam);
    const canShare = profile && canGradeExam(profile, exam) && exam.allow_sharing;

    // --- KITÖLTÉSI JOGOSULTSÁG LOGIKA ---
    const canTake = (() => {
      // 1. Trainee vizsgát bejelentkezve SENKI nem tölthet ki (csak a külső linken)
      if (exam.type === 'trainee') return false;

      // 2. DPI vizsgát CSAK a Deputy Sheriff Trainee rangúak tölthetik ki
      if (exam.type === 'deputy_i') {
        return profile?.faction_rank === 'Deputy Sheriff Trainee';
      }

      // 3. Ha valaki szerkesztő (pl. Bureau Manager), akkor NE töltse ki (csak szerkessze/menedzselje)
      if (canEditContent) return false;

      // Minden egyéb esetben, ha már látja a kártyát, akkor ki is töltheti
      return true;
    })();

    return (
      <div
        className={`group relative overflow-hidden rounded-xl border bg-slate-900/50 p-6 transition-all hover:bg-slate-900 hover:shadow-lg hover:border-slate-700 ${!exam.is_active ? 'opacity-80 border-red-900/30' : 'border-slate-800'}`}>
        {!exam.is_active && <div
          className="absolute top-0 right-0 bg-red-600 text-white text-[10px] px-2 py-1 rounded-bl font-bold">INAKTÍV</div>}

        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline"
                     className="bg-slate-950/50 text-slate-400 border-slate-700 text-[10px] uppercase tracking-wider">{exam.division || 'Általános'}</Badge>
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-yellow-500 transition-colors">{exam.title}</h3>
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-slate-800/50">
          <div className="flex justify-between items-center text-xs text-slate-500 mb-2">
            <span className="font-mono">{exam.time_limit_minutes} perc</span>
            {exam.is_public && <span className="text-green-500">Publikus</span>}
          </div>

          <div className="flex gap-2 flex-wrap">
            {canEditContent && (
              <Button size="sm" variant="ghost" onClick={() => navigate(`/exams/editor/${exam.id}`)}
                      className="h-8 px-2 hover:bg-yellow-500/10 hover:text-yellow-500 flex-1"><PenTool
                className="w-3 h-3 mr-1"/> Szerk.</Button>
            )}
            {canAccessManage && (
              <Button size="sm" variant="ghost" onClick={() => setAccessExam(exam)}
                      className="h-8 px-2 hover:bg-blue-500/10 hover:text-blue-500 flex-1"><Lock
                className="w-3 h-3 mr-1"/> Jog.</Button>
            )}
            {canShare && (
              <Button size="sm" variant="ghost" onClick={() => handleCopyLink(exam.id)}
                      className="h-8 px-2 hover:bg-green-500/10 hover:text-green-500 flex-1"><LinkIcon
                className="w-3 h-3 mr-1"/> Link</Button>
            )}
          </div>

          {/* CSAK AKKOR JELENIK MEG, HA KITÖLTHETI (canTake) */}
          {canTake && (
            <div className="mt-2">
              {isBlocked ? (
                <Button size="sm" disabled
                        className="w-full h-9 bg-red-950/20 text-red-500 border border-red-900/50 cursor-not-allowed">
                  <Clock
                    className="w-3 h-3 mr-2"/> {formatDistanceToNow(new Date(lastSubmission!.retry_allowed_at!), {locale: hu})}
                </Button>
              ) : isPending ? (
                <Button size="sm" disabled
                        className="w-full h-9 bg-yellow-900/20 text-yellow-500 border border-yellow-900/50">Folyamatban...</Button>
              ) : (
                <Button size="sm" className="w-full h-9 bg-yellow-600 hover:bg-yellow-700 text-black font-bold"
                        onClick={() => navigate(`/exam/public/${exam.id}`)}>
                  Kitöltés <ChevronRight className="w-3 h-3 ml-1"/>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      {accessExam &&
        <ExamAccessDialog open={!!accessExam} onOpenChange={(o) => !o && setAccessExam(null)} exam={accessExam}/>}
      <AdminExamAssignDialog open={isAdminAssignOpen} onOpenChange={setIsAdminAssignOpen}/>

      <div className="border-b border-slate-900 bg-slate-950/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 bg-yellow-600/20 rounded-xl flex items-center justify-center border border-yellow-600/30 text-yellow-500">
              <GraduationCap className="w-6 h-6"/></div>
            <div><h1 className="text-xl font-bold text-white tracking-tight">Vizsgaközpont</h1><p
              className="text-xs text-slate-500">Képzési és minősítési rendszer</p></div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>
              <Input placeholder="Vizsga keresése..."
                     className="pl-9 bg-slate-900 border-slate-800 focus-visible:ring-yellow-600/50" value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}/>
            </div>

            {canAssignExams && (
              <Button variant="outline" className="border-slate-700 text-slate-300 hover:text-white"
                      onClick={() => setIsAdminAssignOpen(true)}>
                <UserPlus className="w-4 h-4 mr-2"/> Hozzárendelés
              </Button>
            )}

            {profile && canCreateAnyExam(profile) && (
              <Button className="bg-yellow-600 hover:bg-yellow-700 text-black font-bold shadow-lg shadow-yellow-900/20"
                      onClick={() => navigate('/exams/editor')}><Plus className="w-4 h-4 mr-2"/> Új Vizsga</Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-900/50 border-slate-800"><CardContent
            className="p-6 flex items-center justify-between">
            <div><p className="text-sm text-slate-500">Elérhető Vizsgák</p><p
              className="text-3xl font-bold text-white">{availableExams.length}</p></div>
            <FileText className="w-8 h-8 text-slate-700"/></CardContent></Card>
          <Card className="bg-slate-900/50 border-slate-800"><CardContent
            className="p-6 flex items-center justify-between">
            <div><p className="text-sm text-slate-500">Kitöltött Vizsgáim</p><p
              className="text-3xl font-bold text-white">{mySubmissions.length}</p></div>
            <History className="w-8 h-8 text-slate-700"/></CardContent></Card>
          {hasGradingRights && <Card className="bg-slate-900/50 border-slate-800 relative overflow-hidden">
            <div
              className="absolute right-0 top-0 w-20 h-full bg-gradient-to-l from-yellow-600/10 to-transparent pointer-events-none"/>
            <CardContent className="p-6 flex items-center justify-between">
              <div><p className="text-sm text-slate-500">Javításra Vár</p><p
                className="text-3xl font-bold text-yellow-500">{pendingGrading.length}</p></div>
              <AlertCircle className="w-8 h-8 text-yellow-600/50"/></CardContent></Card>}
        </div>

        <Tabs defaultValue="available" className="w-full">
          <TabsList
            className="bg-transparent border-b border-slate-800 w-full justify-start rounded-none p-0 h-auto mb-6 gap-6">
            <TabsTrigger value="available"
                         className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-yellow-500 data-[state=active]:text-yellow-500 rounded-none px-0 py-3 text-slate-400 hover:text-slate-200 transition-all">Elérhető
              Vizsgák</TabsTrigger>
            {hasGradingRights && (<><TabsTrigger value="grading"
                                                 className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-yellow-500 data-[state=active]:text-yellow-500 rounded-none px-0 py-3 text-slate-400 hover:text-slate-200 transition-all group">Javítandó {pendingGrading.length > 0 &&
              <span
                className="ml-2 bg-red-500 text-white text-[10px] px-1.5 rounded-full">{pendingGrading.length}</span>}</TabsTrigger><TabsTrigger
              value="all_history"
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-yellow-500 data-[state=active]:text-yellow-500 rounded-none px-0 py-3 text-slate-400 hover:text-slate-200 transition-all"><Users
              className="w-4 h-4 mr-2 inline"/>Vezetői Áttekintés</TabsTrigger></>)}
            <TabsTrigger value="history"
                         className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-yellow-500 data-[state=active]:text-yellow-500 rounded-none px-0 py-3 text-slate-400 hover:text-slate-200 transition-all">Saját
              Előzmények</TabsTrigger>
          </TabsList>

          <TabsContent value="available" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {loading ? ([1, 2, 3].map(i => <div key={i}
                                                  className="h-48 rounded-xl bg-slate-900/50 animate-pulse"/>)) : filteredAvailable.length === 0 ? (
                <div
                  className="col-span-full text-center py-20 border border-dashed border-slate-800 rounded-xl bg-slate-900/20">
                  <p className="text-slate-500">Nincs megjeleníthető vizsga.</p></div>) : (filteredAvailable.map(exam =>
                <ExamCard key={exam.id} exam={exam}/>))}
            </div>
          </TabsContent>

          {hasGradingRights && (
            <TabsContent value="grading" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-4">
                {pendingGrading.length === 0 ? <div className="text-center py-20 text-slate-500">Nincs javításra váró
                  vizsga.</div> : pendingGrading.map(sub => (
                  <div key={sub.id}
                       className="flex items-center justify-between p-6 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-slate-700 transition-all group">
                    <div className="flex items-start gap-4">
                      <div
                        className="w-12 h-12 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400 font-bold">{sub.user_badge_number || "?"}</div>
                      <div><h4 className="font-bold text-white text-lg">{(sub as any).exam_title}</h4><p
                        className="text-sm text-slate-400">Kitöltő: <span
                        className="text-white">{(sub as any).user_full_name}</span> •
                        Beadva: {formatDistanceToNow(new Date(sub.end_time || ''), {locale: hu, addSuffix: true})}</p>
                      </div>
                    </div>
                    <Button onClick={() => navigate(`/exams/grading/${sub.id}`)}
                            className="bg-yellow-600 hover:bg-yellow-700 text-black">Javítás <ChevronRight
                      className="w-4 h-4 ml-1"/></Button>
                  </div>
                ))}
              </div>
            </TabsContent>
          )}

          {hasGradingRights && (
            <TabsContent value="all_history"
                         className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
              <div className="flex items-center gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                <Users className="w-5 h-5 text-slate-400 shrink-0"/>
                <div className="relative w-[300px]" ref={dropdownRef}>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500"/>
                    <Input placeholder="Felhasználó keresése..." value={userSearch} onChange={(e) => {
                      setUserSearch(e.target.value);
                      setIsUserListOpen(true);
                    }} onFocus={() => setIsUserListOpen(true)} className="pl-9 bg-slate-950 border-slate-700"/>
                    {selectedHistoryUser !== 'all' && (<button onClick={() => {
                      setSelectedHistoryUser('all');
                      setUserSearch("");
                      fetchHistory(0, 'all');
                    }} className="absolute right-3 top-2.5 text-slate-500 hover:text-white" title="Törlés"><X
                      className="w-4 h-4"/></button>)}
                  </div>
                  {isUserListOpen && (
                    <div
                      className="absolute top-full left-0 w-full mt-1 bg-slate-900 border border-slate-800 rounded-md shadow-xl z-50 max-h-[300px] overflow-y-auto">
                      <div
                        className="p-2 hover:bg-slate-800 cursor-pointer text-slate-300 hover:text-white border-b border-slate-800/50"
                        onClick={() => {
                          setSelectedHistoryUser('all');
                          setUserSearch("");
                          setIsUserListOpen(false);
                          fetchHistory(0, 'all');
                        }}>Mindenki
                      </div>
                      {filteredHistoryUsers.map(u => (<div key={u.id}
                                                           className="p-2 hover:bg-slate-800 cursor-pointer text-slate-300 hover:text-white"
                                                           onClick={() => {
                                                             setSelectedHistoryUser(u.id);
                                                             setUserSearch(u.full_name);
                                                             setIsUserListOpen(false);
                                                             fetchHistory(0, u.id);
                                                           }}>{u.full_name}</div>))}
                      {filteredHistoryUsers.length === 0 &&
                        <div className="p-2 text-slate-500 text-xs text-center">Nincs találat</div>}
                    </div>
                  )}
                </div>
                <span className="text-sm text-slate-500">Összesen: {historyTotal} találat</span>
              </div>
              <div className="space-y-3">
                {historyItems.map(item => (
                  <div key={item.id}
                       className="flex items-center justify-between p-4 bg-slate-900/30 border border-slate-800 rounded-lg hover:border-slate-700 cursor-pointer transition-colors"
                       onClick={() => navigate(`/exams/grading/${item.id}`)}>
                    <div className="flex gap-4 items-center">
                      <Badge variant={item.status === 'passed' ? 'default' : 'destructive'}
                             className={item.status === 'passed' ? 'bg-green-900/30 text-green-400 border-green-900' : 'bg-red-900/30 text-red-400 border-red-900'}>{item.status === 'passed' ? 'SIKERES' : 'SIKERTELEN'}</Badge>
                      <div><p className="font-bold text-white">{(item as any).exam_title}</p><p
                        className="text-xs text-slate-400">Kitöltő: <span
                        className="text-slate-300">{(item as any).user_full_name}</span> • {item.created_at ? new Date(item.created_at).toLocaleDateString('hu-HU') : 'Ismeretlen dátum'}
                      </p></div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-lg font-bold">{item.total_score} pont</p>
                      {item.tab_switch_count > 0 &&
                        <p className="text-[10px] text-red-500 font-bold flex items-center justify-end gap-1">
                          <AlertCircle className="w-3 h-3"/> {item.tab_switch_count} Tab váltás</p>}
                    </div>
                  </div>
                ))}
                {historyItems.length === 0 && <p className="text-center text-slate-500 py-10">Nincs találat.</p>}
              </div>
              <div className="flex justify-center gap-2 pt-4">
                <Button variant="outline" size="sm" disabled={historyPage === 0}
                        onClick={() => fetchHistory(historyPage - 1, selectedHistoryUser)}>Előző</Button>
                <span className="flex items-center text-sm text-slate-500 px-4">{historyPage + 1}. oldal</span>
                <Button variant="outline" size="sm" disabled={(historyPage + 1) * ITEMS_PER_PAGE >= historyTotal}
                        onClick={() => fetchHistory(historyPage + 1, selectedHistoryUser)}>Következő</Button>
              </div>
            </TabsContent>
          )}

          <TabsContent value="history" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-4">
              {mySubmissions.map(sub => (
                <div key={sub.id}
                     className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/30"
                     onClick={() => sub.status !== 'pending' && navigate(`/exams/grading/${sub.id}`)}>
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-2 h-12 rounded-full ${sub.status === 'passed' ? 'bg-green-500' : sub.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'}`}/>
                    <div><h4 className="font-bold text-white">{(sub as any).exams?.title}</h4><p
                      className="text-xs text-slate-500">{new Date(sub.start_time).toLocaleDateString('hu-HU')}</p>
                    </div>
                  </div>
                  <Badge variant="outline"
                         className={`${sub.status === 'passed' ? 'border-green-500/50 text-green-500' : sub.status === 'failed' ? 'border-red-500/50 text-red-500' : 'border-yellow-500/50 text-yellow-500'}`}>{sub.status === 'passed' ? 'SIKERES' : sub.status === 'failed' ? 'SIKERTELEN' : 'FÜGGŐBEN'}</Badge>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}