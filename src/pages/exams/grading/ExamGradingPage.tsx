import {useEffect, useState, useMemo} from "react";
import {useParams, useNavigate} from "react-router-dom";
import {useAuth} from "@/context/AuthContext";
import {Card, CardContent, CardHeader, CardTitle, CardDescription} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {Textarea} from "@/components/ui/textarea";
import {Switch} from "@/components/ui/switch";
import {Label} from "@/components/ui/label";
import {Input} from "@/components/ui/input";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Separator} from "@/components/ui/separator";
import {toast} from "sonner";
import {
  Loader2, CheckCircle2, XCircle, ArrowLeft, User, Clock, ShieldAlert,
  ChevronLeft, ChevronRight, Eye, Target, Bot, PenLine, EyeOff, Hourglass
} from "lucide-react";
import type {ExamSubmission} from "@/types/exams";
import {formatDistanceToNow} from "date-fns";
import {hu} from "date-fns/locale";
import {canGradeExam, cn} from "@/lib/utils";

// Score Ring Component
const ScoreRing = ({score, max, percent}: { score: number, max: number, percent: number }) => {
  const radius = 36;
  const stroke = 5;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percent / 100) * circumference;
  const color = percent >= 80 ? 'text-green-500' : percent >= 60 ? 'text-yellow-500' : 'text-red-500';

  return (
    <div className="relative flex items-center justify-center">
      <svg height={radius * 2} width={radius * 2} className="rotate-[-90deg]">
        <circle stroke="currentColor" fill="transparent" strokeWidth={stroke} r={normalizedRadius} cx={radius}
                cy={radius} className="text-slate-800"/>
        <circle stroke="currentColor" fill="transparent" strokeWidth={stroke}
                strokeDasharray={circumference + ' ' + circumference} style={{strokeDashoffset}} strokeLinecap="round"
                r={normalizedRadius} cx={radius} cy={radius}
                className={`${color} transition-all duration-1000 ease-out`}/>
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-sm font-bold ${color}`}>{Math.round(percent)}%</span>
        <span className="text-[10px] text-slate-500">{score}/{max}</span>
      </div>
    </div>
  );
};

export function ExamGradingPage() {
  const {submissionId} = useParams();
  const {supabase, profile, user} = useAuth();
  const navigate = useNavigate();

  const [submission, setSubmission] = useState<ExamSubmission | null>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Javítás state-ek
  const [gradingNotes, setGradingNotes] = useState("");
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [banDuration, setBanDuration] = useState("0"); // Stringként tároljuk a Select miatt
  const [isSaving, setIsSaving] = useState(false);

  // Manuális pontozás state
  const [manualPoints, setManualPoints] = useState<Record<string, string | number>>({});

  // Lapozás
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchData = async () => {
      if (!submissionId) return;
      if (!profile) return;

      setLoading(true);
      try {
        const {data: subData, error: subError} = await supabase
          .from('exam_submissions')
          .select(`
            *, 
            exams (
              title, 
              passing_percentage, 
              type,            
              division,        
              required_rank,   
              exam_questions (
                id, 
                question_text, 
                question_type, 
                points, 
                order_index, 
                page_number, 
                exam_options (id, option_text, is_correct)
              )
            )
          `)
          .eq('id', submissionId)
          .single();

        if (subError) throw subError;

        // --- JOGOSULTSÁG ELLENŐRZÉS ---
        const isOwnSubmission = subData.user_id === profile.id;
        const hasRights = canGradeExam(profile, subData.exams as any);

        if (!isOwnSubmission && !hasRights) {
          toast.error("Nincs jogosultságod ezt a vizsgát megtekinteni.");
          navigate('/exams');
          return;
        }
        // ------------------------------

        const {
          data: ansData,
          error: ansError
        } = await supabase.from('exam_answers').select('*').eq('submission_id', submissionId);
        if (ansError) throw ansError;

        setSubmission(subData as any);
        setAnswers(ansData || []);
        setGradingNotes(subData.grading_notes || "");
        setFeedbackVisible(subData.feedback_visible || false);

        // Kérdések rendezése
        const sortedQuestions = (subData.exams as any).exam_questions.sort((a: any, b: any) => a.order_index - b.order_index);
        setQuestions(sortedQuestions);

      } catch (err: any) {
        console.error(err);
        toast.error("Hiba: " + err.message);
        navigate('/exams');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [submissionId, supabase, profile?.id, navigate]);

  // Pontszámítás
  const {score, maxScore, questionStats} = useMemo(() => {
    let currentScore = 0;
    let totalMax = 0;
    const stats: any[] = [];

    questions.forEach((q) => {
      totalMax += q.points;
      const userAns = answers.find(a => a.question_id === q.id);
      let autoPoints = 0;
      let isCorrect = false;

      if (userAns) {
        if (q.question_type === 'single_choice') {
          const correctOpt = q.exam_options.find((o: any) => o.is_correct);
          if (correctOpt && userAns.selected_option_ids?.includes(correctOpt.id)) {
            autoPoints = q.points;
            isCorrect = true;
          }
        } else if (q.question_type === 'multiple_choice') {
          const correctIds = q.exam_options.filter((o: any) => o.is_correct).map((o: any) => o.id);
          const userIds = userAns.selected_option_ids || [];
          const allCorrectSelected = correctIds.every((id: any) => userIds.includes(id));
          const noWrongSelected = userIds.every((id: any) => correctIds.includes(id));
          if (allCorrectSelected && noWrongSelected) {
            autoPoints = q.points;
            isCorrect = true;
          }
        }
      }

      let finalPoints = autoPoints;
      const rawManual = manualPoints[q.id];

      if (rawManual !== undefined) {
        let parsed = parseInt(String(rawManual));
        if (isNaN(parsed)) parsed = 0;
        if (parsed < 0) parsed = 0;
        if (parsed > q.points) parsed = q.points;
        finalPoints = parsed;
      }

      currentScore += finalPoints;

      stats.push({
        id: q.id,
        page: q.page_number || 1,
        isCorrect,
        type: q.question_type,
        autoPoints,
        displayPoints: rawManual !== undefined ? rawManual : autoPoints,
        calcPoints: finalPoints,
        isModified: rawManual !== undefined
      });
    });

    return {score: currentScore, maxScore: totalMax, questionStats: stats};
  }, [questions, answers, manualPoints]);

  const handleManualPointChange = (qId: string, val: string) => {
    if (val === '') {
      setManualPoints(prev => ({...prev, [qId]: ''}));
      return;
    }
    if (/^\d*$/.test(val)) {
      setManualPoints(prev => ({...prev, [qId]: val}));
    }
  };

  const handleManualPointBlur = (qId: string, max: number) => {
    const raw = manualPoints[qId];
    let val = parseInt(String(raw));
    if (isNaN(val)) val = 0;
    if (val < 0) val = 0;
    if (val > max) val = max;
    setManualPoints(prev => ({...prev, [qId]: val}));
  };

  const handleGrade = async (status: 'passed' | 'failed') => {
    if (!submission) return;
    setIsSaving(true);
    try {
      let retryDate = null;
      // Csak bukás esetén számítunk tiltást
      if (status === 'failed') {
        const hours = parseInt(banDuration);
        if (hours > 0) {
          retryDate = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
        }
      }

      const updates: any = {
        status,
        grading_notes: gradingNotes,
        total_score: score,
        graded_at: new Date().toISOString(),
        graded_by: profile?.id,
        feedback_visible: feedbackVisible,
        retry_allowed_at: retryDate
      };

      const {error} = await supabase.from('exam_submissions').update(updates).eq('id', submission.id);
      if (error) throw error;

      toast.success(`Vizsga ${status === 'passed' ? 'elfogadva' : 'elutasítva'}!`);
      navigate('/exams');
    } catch (err: any) {
      toast.error("Hiba: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const pageNumbers = useMemo(() => {
    const pages = new Set(questions.map(q => q.page_number || 1));
    return Array.from(pages).sort((a, b) => a - b);
  }, [questions]);

  const currentQuestions = useMemo(() => questions.filter(q => (q.page_number || 1) === currentPage), [questions, currentPage]);
  const totalPages = pageNumbers.length > 0 ? Math.max(...pageNumbers) : 1;

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2
    className="w-10 h-10 animate-spin text-yellow-500"/></div>;
  if (!submission) return <div className="p-10 text-center text-white">Nem található a beadás.</div>;

  const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const passingPercent = (submission.exams as any).passing_percentage;
  const isPassing = percentage >= passingPercent;

  const isGrader = profile?.id !== submission.user_id && user?.id !== submission.user_id;
  const isPending = submission.status === 'pending';
  const showDetails = isGrader || feedbackVisible;

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      {/* HEADER */}
      <div className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/exams')}
                    className="text-slate-400 hover:text-white hover:bg-slate-800"><ArrowLeft
              className="w-4 h-4 mr-2"/> Kilépés</Button>
            <Separator orientation="vertical" className="h-6 bg-slate-800"/>
            <h1 className="text-lg font-bold text-white hidden md:block">{(submission.exams as any)?.title}</h1>
          </div>
          <div className="flex items-center gap-3">
            {submission.status === 'pending' ? <Badge variant="outline"
                                                      className="text-yellow-500 border-yellow-900/50 bg-yellow-900/10 animate-pulse">Folyamatban</Badge> :
              <Badge variant="outline"
                     className={submission.status === 'passed' ? "text-green-500 border-green-900/50" : "text-red-500 border-red-900/50"}>{submission.status === 'passed' ? 'Sikeres' : 'Sikertelen'}</Badge>}
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start relative">
        {/* BAL OLDAL: KÉRDÉSEK */}
        <div className="lg:col-span-8 space-y-6">
          {showDetails ? (
            <>
              <div
                className="flex items-center justify-between bg-slate-900/80 p-2 rounded-lg border border-slate-800 backdrop-blur-sm sticky top-20 z-20 shadow-lg">
                <Button variant="ghost" size="sm" disabled={currentPage === 1} onClick={() => {
                  setCurrentPage(p => p - 1);
                  window.scrollTo({top: 0, behavior: 'smooth'});
                }}><ChevronLeft className="w-4 h-4 mr-2"/> Előző</Button>
                <div className="flex gap-1">{pageNumbers.map(p => (<div key={p} onClick={() => setCurrentPage(p)}
                                                                        className={`w-2 h-2 rounded-full cursor-pointer transition-all ${currentPage === p ? 'bg-yellow-500 w-6' : 'bg-slate-700 hover:bg-slate-600'}`}/>))}</div>
                <Button variant="ghost" size="sm" disabled={currentPage === totalPages} onClick={() => {
                  setCurrentPage(p => p + 1);
                  window.scrollTo({top: 0, behavior: 'smooth'});
                }}>Következő <ChevronRight className="w-4 h-4 ml-2"/></Button>
              </div>

              <div className="space-y-4">
                {currentQuestions.map((q, idx) => {
                  const globalIndex = questions.indexOf(q) + 1;
                  const answer = answers.find(a => a.question_id === q.id);
                  const stat = questionStats.find(s => s.id === q.id);

                  let statusColor = "border-slate-800";
                  if (q.question_type !== 'text') {
                    if (stat?.autoPoints > 0) statusColor = "border-green-900/30";
                    else statusColor = "border-red-900/30";
                  }

                  return (
                    <Card key={q.id} className={`bg-slate-900 ${statusColor} transition-all duration-300`}>
                      <CardHeader className="pb-2 border-b border-slate-950 bg-slate-950/20">
                        <div className="flex justify-between items-start">
                          <div className="flex gap-3">
                            <div
                              className="flex items-center justify-center w-6 h-6 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-slate-400 mt-0.5">{globalIndex}</div>
                            <CardTitle className="text-base text-slate-200 leading-snug">{q.question_text}</CardTitle>
                          </div>
                          <div className="flex items-center gap-3 pl-4">
                            {isGrader && isPending ? (
                              <div
                                className="flex items-center gap-2 bg-slate-950/50 p-1 rounded border border-slate-800">
                                {stat?.isModified ? (
                                  <Badge variant="secondary"
                                         className="bg-blue-900/20 text-blue-400 text-[10px] h-6"><PenLine
                                    className="w-3 h-3 mr-1"/> Kézi</Badge>
                                ) : (
                                  <Badge variant="secondary"
                                         className="bg-slate-800 text-slate-500 text-[10px] h-6"><Bot
                                    className="w-3 h-3 mr-1"/> Auto</Badge>
                                )}
                                <div className="flex items-center">
                                  <Input type="text"
                                         className="w-12 h-6 text-right p-0 pr-1 bg-transparent border-none text-white font-mono focus-visible:ring-0"
                                         value={stat?.displayPoints}
                                         onChange={(e) => handleManualPointChange(q.id, e.target.value)}
                                         onBlur={() => handleManualPointBlur(q.id, q.points)}
                                  />
                                  <span className="text-slate-500 text-xs">/ {q.points} p</span>
                                </div>
                              </div>
                            ) : (
                              <Badge variant="secondary"
                                     className="bg-slate-950 border border-slate-800 text-slate-400 font-mono text-xs h-7">{stat?.calcPoints} / {q.points} pont</Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-4">
                        {q.question_type === 'text' ? (
                          <div
                            className="bg-slate-950 p-4 rounded-md border border-slate-800 text-slate-300 italic min-h-[60px] whitespace-pre-wrap text-sm">
                            {answer?.answer_text ||
                              <span className="text-slate-600 opacity-50">Nem érkezett válasz.</span>}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {q.exam_options.map((opt: any) => {
                              const isSelected = answer?.selected_option_ids?.includes(opt.id);
                              const isActuallyCorrect = opt.is_correct;
                              let style = "bg-slate-950 border-slate-800 text-slate-400 opacity-70";
                              if (isSelected && isActuallyCorrect) style = "bg-green-900/20 border-green-500/50 text-green-400 font-bold opacity-100 shadow-[0_0_10px_rgba(34,197,94,0.1)]";
                              else if (isSelected && !isActuallyCorrect) style = "bg-red-900/20 border-red-500/50 text-red-400 opacity-100";
                              else if (!isSelected && isActuallyCorrect) style = "bg-green-900/5 border-green-900/30 text-green-600 border-dashed opacity-100";
                              else if (isSelected) style = "bg-slate-800 text-white opacity-100";
                              return (
                                <div key={opt.id}
                                     className={`p-3 rounded-md border text-sm flex justify-between items-center transition-all ${style}`}>
                                  <span>{opt.option_text}</span>
                                  {isSelected && <Badge variant="outline"
                                                        className="text-[10px] border-current h-5 bg-transparent">Választott</Badge>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          ) : (
            <Card className="bg-slate-900 border-slate-800 py-20"><CardContent className="text-center"><EyeOff
              className="w-12 h-12 text-slate-600 mx-auto mb-4"/><h3 className="text-xl font-bold text-white">Részletek
              elrejtve</h3><p className="text-slate-500 text-sm mt-2">A részletes eredmények nem publikusak.</p>
            </CardContent></Card>
          )}

          {!isGrader && gradingNotes && (
            <Card className="bg-slate-900 border-slate-800 mt-8"><CardHeader><CardTitle className="text-lg text-white">Oktatói
              értékelés</CardTitle></CardHeader><CardContent>
              <div
                className="bg-slate-950 p-6 rounded-lg border border-slate-800 text-slate-300 italic whitespace-pre-wrap">"{gradingNotes}"
              </div>
            </CardContent></Card>
          )}
        </div>

        {/* --- JOBB OLDAL: VEZÉRLŐPULT --- */}
        <div className="lg:col-span-4">
          <div className="space-y-6 lg:sticky lg:top-24 h-fit max-h-[calc(100vh-8rem)] overflow-y-auto pr-1">

            <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
              <div
                className={`h-2 w-full transition-colors duration-500 ${isPassing ? 'bg-green-500' : 'bg-red-500'}`}/>
              <CardHeader className="pb-2">
                <CardTitle className="flex justify-between items-center text-white">
                  <span>Eredmény</span>
                  <ScoreRing score={score} max={maxScore} percent={percentage}/>
                </CardTitle>
                <CardDescription>Minimum: <span
                  className="text-white font-bold">{passingPercent}%</span></CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="flex items-center gap-2 text-sm text-slate-400"><User
                    className="w-4 h-4 text-yellow-500"/> <span
                    className="text-white font-medium truncate">{submission.applicant_name || "Ismeretlen"}</span></div>
                  <div className="flex items-center gap-2 text-sm text-slate-400"><Clock
                    className="w-4 h-4 text-blue-500"/>
                    <span>{submission.start_time ? formatDistanceToNow(new Date(submission.start_time), {
                      locale: hu,
                      addSuffix: true
                    }) : '-'}</span></div>
                  {submission.tab_switch_count > 0 && (<div
                    className="flex items-center gap-2 text-sm text-red-400 bg-red-950/20 p-2 rounded border border-red-900/30 animate-pulse">
                    <ShieldAlert className="w-4 h-4"/> <span>{submission.tab_switch_count}x fókuszvesztés</span></div>)}
                </div>
              </CardContent>
            </Card>

            {isGrader && (
              <Card className="bg-slate-900 border-slate-800 shadow-xl">
                <CardHeader className="pb-2 pt-4 px-4"><CardTitle
                  className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><Target
                  className="w-4 h-4"/> Navigátor</CardTitle></CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-5 gap-2">
                    {questionStats.map((stat, i) => (
                      <button key={stat.id} onClick={() => {
                        setCurrentPage(stat.page);
                      }}
                              className={`h-8 rounded text-xs font-bold transition-all border ${stat.type === 'text' ? 'bg-slate-800 border-slate-700 text-slate-400' : stat.calcPoints > 0 ? 'bg-green-900/20 border-green-900/50 text-green-500' : 'bg-red-900/20 border-red-900/50 text-red-500'} ${stat.page === currentPage ? 'ring-2 ring-yellow-500/50 scale-110' : ''}`}
                      >{i + 1}</button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {isGrader && isPending && (
              <Card className="bg-slate-900 border-slate-800 shadow-xl border-l-4 border-l-yellow-600">
                <CardHeader className="pb-2 pt-4"><CardTitle
                  className="text-white text-base">Javítás</CardTitle></CardHeader>
                <CardContent className="space-y-4 p-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-400">Megjegyzés</Label>
                    <Textarea placeholder="Indoklás..." value={gradingNotes}
                              onChange={e => setGradingNotes(e.target.value)}
                              className="bg-slate-950 border-slate-700 text-white min-h-[80px] text-sm resize-none break-all"/>
                  </div>

                  {/* RÉSZLETES VISSZAJELZÉS KAPCSOLÓ */}
                  <div onClick={() => setFeedbackVisible(!feedbackVisible)}
                       className={cn("flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all select-none", feedbackVisible ? "bg-blue-900/20 border-blue-500/50" : "bg-slate-950 border-slate-800 hover:border-slate-600")}>
                    <div className="space-y-0.5">
                      <Label
                        className={cn("text-sm font-bold cursor-pointer", feedbackVisible ? "text-blue-400" : "text-slate-300")}>RÉSZLETES
                        VISSZAJELZÉS</Label>
                      <p className="text-[10px] text-slate-500">Ha aktív, a diák látja a hibáit.</p>
                    </div>
                    <div
                      className={cn("px-3 py-1 rounded text-[10px] font-black uppercase tracking-wider", feedbackVisible ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-500")}>
                      {feedbackVisible ? "LÁTHATÓ" : "REJTETT"}
                    </div>
                  </div>

                  {/* ÚJ: TILTÁS BEÁLLÍTÁS */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-800">
                    <Label className="text-xs text-slate-400 flex items-center gap-2"><Hourglass
                      className="w-3 h-3"/> Újrapróbálkozás Tiltása (Bukás esetén)</Label>
                    <Select value={banDuration} onValueChange={setBanDuration}>
                      <SelectTrigger
                        className="bg-slate-950 border-slate-700 h-9 text-xs"><SelectValue/></SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-white">
                        <SelectItem value="0">Nincs tiltás (Azonnal)</SelectItem>
                        <SelectItem value="1">1 óra</SelectItem>
                        <SelectItem value="12">12 óra</SelectItem>
                        <SelectItem value="24">24 óra (1 nap)</SelectItem>
                        <SelectItem value="72">72 óra (3 nap)</SelectItem>
                        <SelectItem value="168">168 óra (1 hét)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <Button variant="outline"
                            className={`h-12 border-red-900/50 text-red-500 hover:bg-red-900/20 hover:text-red-400 transition-all ${!isPassing ? 'ring-2 ring-red-500/50 bg-red-900/10' : 'opacity-60 grayscale'}`}
                            onClick={() => handleGrade('failed')} disabled={isSaving}>
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> :
                        <XCircle className="w-5 h-5 mr-2"/>} Megbukott
                    </Button>
                    <Button
                      className={`h-12 border-none font-bold shadow-lg transition-all ${isPassing ? 'bg-green-600 hover:bg-green-700 text-white ring-2 ring-green-400/50 scale-105' : 'bg-slate-800 text-slate-400 opacity-60'}`}
                      onClick={() => handleGrade('passed')} disabled={isSaving}>
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> :
                        <CheckCircle2 className="w-5 h-5 mr-2"/>} Átment
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}