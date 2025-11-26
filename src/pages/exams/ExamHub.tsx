import {useEffect, useState, useCallback} from "react";
import {useAuth} from "@/context/AuthContext";
import {Card, CardContent} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {
  FileText,
  Clock,
  Plus,
  CheckCircle2,
  AlertCircle,
  Search,
  ChevronRight,
  History,
  GraduationCap,
  PenTool
} from "lucide-react";
import {useNavigate} from "react-router-dom";
import {FACTION_RANKS} from "@/types/supabase";
import type {Exam, ExamSubmission} from "@/types/exams";
import {toast} from "sonner";
import {canCreateAnyExam, canManageExam, canGradeExam} from "@/lib/utils";
import {formatDistanceToNow} from "date-fns";
import {hu} from "date-fns/locale";
import {Input} from "@/components/ui/input";

export function ExamHub() {
  const {supabase, profile} = useAuth();
  const navigate = useNavigate();

  const [availableExams, setAvailableExams] = useState<Exam[]>([]);
  const [mySubmissions, setMySubmissions] = useState<ExamSubmission[]>([]);
  const [pendingGrading, setPendingGrading] = useState<ExamSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // useCallback a fetch függvényre, hogy stabil maradjon
  const fetchData = useCallback(async () => {
    if (!profile) return;

    setLoading(true);
    try {
      // 1. ELÉRHETŐ VIZSGÁK
      let query = supabase
        .from('exams')
        .select('*')
        .order('created_at', {ascending: false});

      if (!canCreateAnyExam(profile)) {
        query = query.eq('is_active', true);
      }

      const {data: exams, error: examError} = await query;
      if (examError) throw examError;

      const filteredExams = (exams as unknown as Exam[]).filter(exam => {
        if (canManageExam(profile, exam)) return true;
        if (!exam.is_active) return false;
        if (profile.is_bureau_manager) return true;
        if (exam.is_public) return true;
        if (exam.required_rank) {
          const userRankIndex = FACTION_RANKS.indexOf(profile.faction_rank);
          const reqRankIndex = FACTION_RANKS.indexOf(exam.required_rank as any);
          if (reqRankIndex !== -1 && userRankIndex > reqRankIndex) return false;
        }
        if (exam.division && exam.division !== profile.division) return false;
        return true;
      });
      setAvailableExams(filteredExams);

      // 2. SAJÁT KITÖLTÉSEK
      const {data: subs, error: subError} = await supabase
        .from('exam_submissions')
        .select('*, exams(title, passing_percentage)')
        .eq('user_id', profile.id)
        .order('start_time', {ascending: false});

      if (subError) throw subError;
      setMySubmissions(subs as any);

      // 3. JAVÍTÁSRA VÁRÓ VIZSGÁK
      // Ellenőrizzük, hogy van-e egyáltalán esélye javítani (optimalizálás)
      if (canCreateAnyExam(profile) || profile.qualifications?.includes('TB') || ['Sergeant I.', 'Sergeant II.'].includes(profile.faction_rank)) {
        const {data: pending, error: pendingError} = await supabase
          .from('exam_submissions')
          .select(`
                  *,
                  exams (*),
                  profiles:user_id (full_name, badge_number, faction_rank)
              `)
          .eq('status', 'pending')
          .order('end_time', {ascending: true});

        if (pendingError) throw pendingError;

        const gradeable = (pending as any[]).filter(sub => {
          if (!sub.exams) return false;
          return canGradeExam(profile, sub.exams);
        });

        setPendingGrading(gradeable);
      }

    } catch (err: any) {
      console.error(err);
      toast.error("Hiba az adatok betöltésekor");
    } finally {
      setLoading(false);
    }
  }, [profile?.id]); // CSAK az ID változására reagálunk, nem a teljes profil objektumra!

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const hasGradingRights = pendingGrading.length > 0 || canCreateAnyExam(profile);

  const filteredAvailable = availableExams.filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase()));

  // --- UI SEGÉDEK ---
  const ExamCard = ({exam}: { exam: Exam }) => {
    const lastSubmission = mySubmissions.find(s => s.exam_id === exam.id);
    const isBlocked = lastSubmission?.status === 'failed' && lastSubmission.retry_allowed_at && new Date(lastSubmission.retry_allowed_at) > new Date();
    const isPending = lastSubmission?.status === 'pending';
    const canEdit = profile && canManageExam(profile, exam);

    return (
      <div
        className={`group relative overflow-hidden rounded-xl border bg-slate-900/50 p-6 transition-all hover:bg-slate-900 hover:shadow-lg hover:border-slate-700 ${!exam.is_active ? 'opacity-60 grayscale' : 'border-slate-800'}`}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline"
                     className="bg-slate-950/50 text-slate-400 border-slate-700 text-[10px] uppercase tracking-wider">
                {exam.division || 'Általános'}
              </Badge>
              {!exam.is_active && <Badge variant="destructive" className="text-[10px]">INAKTÍV</Badge>}
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-yellow-500 transition-colors">{exam.title}</h3>
          </div>
          <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800/50">
            <Clock className="w-5 h-5 text-slate-500"/>
          </div>
        </div>

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800/50">
          <span className="text-xs text-slate-500 font-mono">{exam.time_limit_minutes} perc</span>

          {canEdit ? (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => navigate(`/exams/editor/${exam.id}`)}
                      className="h-8 px-3 hover:bg-yellow-500/10 hover:text-yellow-500">
                <PenTool className="w-3 h-3 mr-2"/> Szerk.
              </Button>
              <Button size="sm" className="h-8 bg-slate-800 hover:bg-slate-700"
                      onClick={() => navigate(`/exam/public/${exam.id}`)}>
                <FileText className="w-3 h-3 mr-2"/> Megnyitás
              </Button>
            </div>
          ) : (
            <>
              {isBlocked ? (
                <Button size="sm" disabled
                        className="h-8 bg-red-950/20 text-red-500 border border-red-900/50 cursor-not-allowed">
                  <Clock
                    className="w-3 h-3 mr-2"/> {formatDistanceToNow(new Date(lastSubmission!.retry_allowed_at!), {locale: hu})}
                </Button>
              ) : isPending ? (
                <Button size="sm" disabled className="h-8 bg-yellow-900/20 text-yellow-500 border border-yellow-900/50">
                  Folyamatban...
                </Button>
              ) : (
                <Button size="sm" className="h-8 bg-yellow-600 hover:bg-yellow-700 text-black font-bold"
                        onClick={() => navigate(`/exam/public/${exam.id}`)}>
                  Kitöltés <ChevronRight className="w-3 h-3 ml-1"/>
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      {/* HEADER SECTION */}
      <div className="border-b border-slate-900 bg-slate-950/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 bg-yellow-600/20 rounded-xl flex items-center justify-center border border-yellow-600/30 text-yellow-500">
              <GraduationCap className="w-6 h-6"/>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Vizsgaközpont</h1>
              <p className="text-xs text-slate-500">Képzési és minősítési rendszer</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>
              <Input
                placeholder="Vizsga keresése..."
                className="pl-9 bg-slate-900 border-slate-800 focus-visible:ring-yellow-600/50"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {profile && canCreateAnyExam(profile) && (
              <Button className="bg-yellow-600 hover:bg-yellow-700 text-black font-bold shadow-lg shadow-yellow-900/20"
                      onClick={() => navigate('/exams/editor')}>
                <Plus className="w-4 h-4 mr-2"/> Új Vizsga
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* STATS ROW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Elérhető Vizsgák</p>
                <p className="text-3xl font-bold text-white">{availableExams.length}</p>
              </div>
              <FileText className="w-8 h-8 text-slate-700"/>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Kitöltött Vizsgáim</p>
                <p className="text-3xl font-bold text-white">{mySubmissions.length}</p>
              </div>
              <History className="w-8 h-8 text-slate-700"/>
            </CardContent>
          </Card>
          {hasGradingRights && (
            <Card className="bg-slate-900/50 border-slate-800 relative overflow-hidden">
              <div
                className="absolute right-0 top-0 w-20 h-full bg-gradient-to-l from-yellow-600/10 to-transparent pointer-events-none"/>
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Javításra Vár</p>
                  <p className="text-3xl font-bold text-yellow-500">{pendingGrading.length}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-yellow-600/50"/>
              </CardContent>
            </Card>
          )}
        </div>

        {/* TABS & CONTENT */}
        <Tabs defaultValue={hasGradingRights && pendingGrading.length > 0 ? "grading" : "available"} className="w-full">
          <TabsList
            className="bg-transparent border-b border-slate-800 w-full justify-start rounded-none p-0 h-auto mb-6 gap-6">
            <TabsTrigger value="available"
                         className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-yellow-500 data-[state=active]:text-yellow-500 rounded-none px-0 py-3 text-slate-400 hover:text-slate-200 transition-all">
              Elérhető Vizsgák
            </TabsTrigger>
            {hasGradingRights && (
              <TabsTrigger value="grading"
                           className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-yellow-500 data-[state=active]:text-yellow-500 rounded-none px-0 py-3 text-slate-400 hover:text-slate-200 transition-all group">
                Javítandó
                {pendingGrading.length > 0 && <span
                  className="ml-2 bg-red-500 text-white text-[10px] px-1.5 rounded-full group-data-[state=active]:bg-yellow-500 group-data-[state=active]:text-black">{pendingGrading.length}</span>}
              </TabsTrigger>
            )}
            <TabsTrigger value="history"
                         className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-yellow-500 data-[state=active]:text-yellow-500 rounded-none px-0 py-3 text-slate-400 hover:text-slate-200 transition-all">
              Előzmények
            </TabsTrigger>
          </TabsList>

          <TabsContent value="available" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {loading ? (
                [1, 2, 3].map(i => <div key={i} className="h-48 rounded-xl bg-slate-900/50 animate-pulse"/>)
              ) : filteredAvailable.length === 0 ? (
                <div
                  className="col-span-full text-center py-20 border border-dashed border-slate-800 rounded-xl bg-slate-900/20">
                  <p className="text-slate-500">Nincs megjeleníthető vizsga.</p>
                </div>
              ) : (
                filteredAvailable.map(exam => <ExamCard key={exam.id} exam={exam}/>)
              )}
            </div>
          </TabsContent>

          {hasGradingRights && (
            <TabsContent value="grading" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-4">
                {pendingGrading.length === 0 ? (
                  <div className="text-center py-20 border border-dashed border-slate-800 rounded-xl bg-slate-900/20">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500 opacity-50"/>
                    <p className="text-slate-400">Nincs javításra váró vizsga. Szép munka!</p>
                  </div>
                ) : pendingGrading.map(sub => (
                  <div key={sub.id}
                       className="flex items-center justify-between p-6 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-slate-700 transition-all group">
                    <div className="flex items-start gap-4">
                      <div
                        className="w-12 h-12 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400 font-bold">
                        {(sub as any).profiles?.badge_number || "?"}
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-lg">{(sub as any).exams?.title}</h4>
                        <p className="text-sm text-slate-400">
                          Kitöltő: <span
                          className="text-white">{(sub as any).profiles?.full_name || sub.applicant_name}</span>
                          <span className="mx-2">•</span>
                          Beadva: {formatDistanceToNow(new Date(sub.end_time || ''), {locale: hu, addSuffix: true})}
                        </p>
                      </div>
                    </div>
                    <Button onClick={() => navigate(`/exams/grading/${sub.id}`)}
                            className="bg-yellow-600 hover:bg-yellow-700 text-black font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                      Javítás <ChevronRight className="w-4 h-4 ml-1"/>
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>
          )}

          <TabsContent value="history" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-4">
              {mySubmissions.map(sub => (
                <div key={sub.id}
                     className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/30 hover:bg-slate-900 transition-colors">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-2 h-12 rounded-full ${sub.status === 'passed' ? 'bg-green-500' : sub.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'}`}/>
                    <div>
                      <h4 className="font-bold text-white">{(sub as any).exams?.title}</h4>
                      <p
                        className="text-xs text-slate-500">{new Date(sub.start_time).toLocaleDateString('hu-HU')} • {new Date(sub.start_time).toLocaleTimeString('hu-HU')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs text-slate-500 uppercase">Eredmény</p>
                      <p
                        className={`font-mono font-bold ${sub.status === 'passed' ? 'text-green-400' : sub.status === 'failed' ? 'text-red-400' : 'text-yellow-400'}`}>
                        {sub.total_score !== null ? `${sub.total_score} pont` : '---'}
                      </p>
                    </div>
                    <Badge variant="outline"
                           className={`${sub.status === 'passed' ? 'border-green-500/50 text-green-500' : sub.status === 'failed' ? 'border-red-500/50 text-red-500' : 'border-yellow-500/50 text-yellow-500'}`}>
                      {sub.status === 'passed' ? 'SIKERES' : sub.status === 'failed' ? 'SIKERTELEN' : 'FÜGGŐBEN'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}