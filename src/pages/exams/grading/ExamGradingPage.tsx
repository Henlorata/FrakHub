import {useEffect, useState} from "react";
import {useNavigate, useParams} from "react-router-dom";
import {useAuth} from "@/context/AuthContext";
import {Card, CardContent, CardHeader} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Badge} from "@/components/ui/badge";
import {toast} from "sonner";
import {ArrowLeft, Save, CheckSquare, Type, AlertTriangle, CalendarClock} from "lucide-react";
import {canGradeExam} from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function ExamGradingPage() {
  const {supabase, profile} = useAuth();
  const navigate = useNavigate();
  const {submissionId} = useParams();

  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState<any>(null);
  const [exam, setExam] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [studentAnswers, setStudentAnswers] = useState<any[]>([]);
  const [grades, setGrades] = useState<Record<string, number>>({});

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [retryDate, setRetryDate] = useState<string>("");

  useEffect(() => {
    if (!profile || !submissionId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const {data: sub, error: subError} = await supabase
          .from('exam_submissions')
          .select(`*, exams (*), profiles:user_id (full_name, badge_number)`)
          .eq('id', submissionId)
          .single();

        if (subError) throw subError;

        if (!canGradeExam(profile, sub.exams)) {
          toast.error("Nincs jogosultságod javítani ezt a vizsgát.");
          navigate('/exams');
          return;
        }

        setSubmission(sub);
        setExam(sub.exams);

        const {data: qs, error: qError} = await supabase
          .from('exam_questions')
          .select(`*, exam_options (*)`)
          .eq('exam_id', sub.exam_id)
          .order('page_number', {ascending: true})
          .order('order_index', {ascending: true});

        if (qError) throw qError;
        setQuestions(qs);

        const {data: ans, error: ansError} = await supabase
          .from('exam_answers')
          .select('*')
          .eq('submission_id', submissionId);

        if (ansError) throw ansError;
        setStudentAnswers(ans);

        // Auto-Grading
        const initialGrades: Record<string, number> = {};
        qs.forEach((q: any) => {
          const studentAns = ans.find((a: any) => a.question_id === q.id);
          if (studentAns?.points_awarded !== null && studentAns?.points_awarded !== undefined) {
            initialGrades[q.id] = studentAns.points_awarded;
          } else {
            if (q.question_type === 'single_choice') {
              const selectedOptId = studentAns?.selected_option_ids?.[0];
              const correctOpt = q.exam_options.find((o: any) => o.is_correct);
              initialGrades[q.id] = (selectedOptId === correctOpt?.id) ? q.points : 0;
            } else if (q.question_type === 'multiple_choice') {
              const selectedIds = studentAns?.selected_option_ids || [];
              const correctIds = q.exam_options.filter((o: any) => o.is_correct).map((o: any) => o.id);
              const isPerfect = selectedIds.length === correctIds.length && selectedIds.every((id: string) => correctIds.includes(id));
              initialGrades[q.id] = isPerfect ? q.points : 0;
            } else {
              initialGrades[q.id] = 0;
            }
          }
        });
        setGrades(initialGrades);

      } catch (error: any) {
        console.error(error);
        toast.error("Hiba: " + error.message);
        navigate('/exams');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [submissionId, profile, navigate, supabase]);

  const handleScoreChange = (questionId: string, points: number) => {
    setGrades(prev => ({...prev, [questionId]: points}));
  };

  const calculateTotal = () => Object.values(grades).reduce((a, b) => a + b, 0);
  const getMaxScore = () => questions.reduce((acc, q) => acc + q.points, 0);

  const handleSaveGrading = async () => {
    const totalScore = calculateTotal();
    const maxScore = getMaxScore();
    const percentage = Math.round((totalScore / maxScore) * 100);
    const isPassed = percentage >= (exam.passing_percentage || 80);

    setLoading(true);
    try {
      for (const q of questions) {
        const points = grades[q.id] || 0;
        await supabase
          .from('exam_answers')
          .update({points_awarded: points})
          .eq('submission_id', submissionId)
          .eq('question_id', q.id);
      }

      const updatePayload: any = {
        status: isPassed ? 'passed' : 'failed',
        total_score: totalScore,
        graded_by: profile?.id
      };

      if (!isPassed && retryDate) {
        updatePayload.retry_allowed_at = new Date(retryDate).toISOString();
      } else {
        updatePayload.retry_allowed_at = null;
      }

      const {error} = await supabase.from('exam_submissions').update(updatePayload).eq('id', submissionId);
      if (error) throw error;

      if (submission.user_id) {
        let msg = `Az eredményed: ${percentage}% (${isPassed ? 'SIKERES' : 'SIKERTELEN'}).`;
        if (!isPassed && retryDate) {
          msg += ` Újrapróbálkozhatsz ekkor: ${new Date(retryDate).toLocaleString('hu-HU')}`;
        }
        await supabase.from('notifications').insert({
          user_id: submission.user_id,
          title: `Vizsga Értékelve: ${exam.title}`,
          message: msg,
          type: isPassed ? 'success' : 'alert',
          link: '/exams'
        });
      }

      toast.success("Értékelés sikeresen mentve!");
      navigate('/exams');

    } catch (error: any) {
      console.error(error);
      toast.error("Hiba a mentéskor: " + error.message);
    } finally {
      setLoading(false);
      setIsConfirmOpen(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen text-slate-500">Betöltés...</div>;

  const totalScore = calculateTotal();
  const maxScore = getMaxScore();
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  const isPassed = percentage >= (exam.passing_percentage || 80);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent className="bg-slate-900 border-slate-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Értékelés Véglegesítése</AlertDialogTitle>
            {/* JAVÍTÁS: asChild vagy div használata, hogy ne legyen <p> a <p>-ben */}
            <div className="text-slate-400 text-sm space-y-4 pt-2">
              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <p>Pontszám: <span className="text-white font-bold">{totalScore} / {maxScore}</span> ({percentage}%)</p>
                <p>Eredmény: <span
                  className={`font-bold ${isPassed ? 'text-green-500' : 'text-red-500'}`}>{isPassed ? 'SIKERES' : 'SIKERTELEN'}</span>
                </p>
              </div>

              {!isPassed && (
                <div className="space-y-2 border-t border-slate-800 pt-2">
                  <Label className="text-white flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-yellow-500"/> Újrapróbálkozás lehetséges ekkor:
                  </Label>
                  <Input
                    type="datetime-local"
                    className="bg-slate-950 border-slate-700"
                    value={retryDate}
                    onChange={e => setRetryDate(e.target.value)}
                  />
                  <p className="text-xs text-slate-500">Ha üresen hagyod, azonnal újrapróbálhatja.</p>
                </div>
              )}

              <p>Biztosan véglegesíted az eredményt? A diák értesítést kap róla.</p>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="bg-slate-800 text-white hover:bg-slate-700 border-slate-700">Mégsem</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveGrading}
                               className={`font-bold text-white ${isPassed ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
              Véglegesítés
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/exams')}>
          <ArrowLeft className="w-5 h-5"/>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-white">Vizsga Javítása</h1>
          <p className="text-slate-400 flex items-center gap-2">
            {exam.title} <span className="text-slate-600">•</span>
            <span
              className="text-slate-200 font-medium">{submission.applicant_name || (submission.profiles ? `${submission.profiles.badge_number} ${submission.profiles.full_name}` : 'Ismeretlen')}</span>
          </p>
        </div>
      </div>

      {/* INFO SÁV */}
      <Card
        className={`bg-slate-900 border-t-4 sticky top-4 z-30 shadow-xl ${isPassed ? 'border-t-green-500 border-slate-800' : 'border-t-red-500 border-slate-800'}`}>
        <CardContent className="p-4 flex justify-between items-center">
          <div className="flex gap-6 items-center">
            <div><p className="text-[10px] text-slate-500 uppercase tracking-wider">Pontszám</p><p
              className="text-2xl font-mono font-bold text-white">{totalScore} <span
              className="text-slate-600 text-base">/ {maxScore}</span></p></div>
            <div className="h-8 w-px bg-slate-800"></div>
            <div><p className="text-[10px] text-slate-500 uppercase tracking-wider">Százalék</p><p
              className={`text-2xl font-mono font-bold ${isPassed ? 'text-green-500' : 'text-red-500'}`}>{percentage}%</p>
            </div>
            <div className="h-8 w-px bg-slate-800"></div>
            <div><p className="text-[10px] text-slate-500 uppercase tracking-wider">Minimum</p><p
              className="text-2xl font-mono font-bold text-slate-400">{exam.passing_percentage}%</p></div>
          </div>
          <Button onClick={() => setIsConfirmOpen(true)}
                  className={`font-bold ${isPassed ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white shadow-lg`}>
            <Save className="w-4 h-4 mr-2"/> Mentés
          </Button>
        </CardContent>
      </Card>

      {/* KÉRDÉSEK */}
      <div className="space-y-6">
        {questions.map((q, index) => {
          const answer = studentAnswers.find(a => a.question_id === q.id);
          const score = grades[q.id] || 0;
          const isFullScore = score === q.points;
          const hasAnswer = answer && ((answer.answer_text && answer.answer_text.trim() !== "") || (answer.selected_option_ids && answer.selected_option_ids.length > 0));

          return (
            <Card key={q.id}
                  className={`bg-slate-900 border-slate-800 overflow-hidden ${isFullScore ? 'border-l-4 border-l-green-500' : score > 0 ? 'border-l-4 border-l-yellow-500' : 'border-l-4 border-l-red-500'}`}>
              <CardHeader className="pb-2 border-b border-slate-800/50 bg-slate-950/30 px-6 pt-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex gap-2">
                      <Badge variant="outline" className="bg-slate-950 text-slate-400 border-slate-700">{index + 1}.
                        Kérdés</Badge>
                      <Badge className="bg-slate-800 text-slate-300 border-slate-700 flex items-center">
                        {q.question_type === 'text' ? <Type className="w-3 h-3 mr-1"/> :
                          <CheckSquare className="w-3 h-3 mr-1"/>}
                        {q.question_type === 'text' ? 'Szöveges' : 'Választós'}
                      </Badge>
                    </div>
                    <h3 className="text-lg font-medium text-white max-w-3xl">{q.question_text}</h3>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-lg border border-slate-700">
                    <Label className="text-xs text-slate-400 ml-1">Pont:</Label>
                    <Input type="number"
                           className={`w-16 h-8 border-slate-600 text-center font-bold ${isFullScore ? 'bg-green-900/20 text-green-500 border-green-500/50' : 'bg-slate-900 text-white'}`}
                           value={score} onChange={e => {
                      let val = parseInt(e.target.value) || 0;
                      if (val > q.points) val = q.points;
                      if (val < 0) val = 0;
                      handleScoreChange(q.id, val);
                    }} max={q.points} min={0}/>
                    <span className="text-slate-500 text-sm font-mono pr-1">/ {q.points}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {q.question_type === 'text' && (
                  <div className="space-y-2">
                    <Label className="text-slate-400 text-xs uppercase font-bold tracking-wide">Diák Válasza:</Label>
                    <div
                      className={`p-4 rounded-lg border text-sm leading-relaxed whitespace-pre-wrap ${hasAnswer ? 'bg-slate-950/50 border-slate-700 text-slate-200' : 'bg-red-950/10 border-red-900/30 text-red-400 italic'}`}>
                      {answer?.answer_text || "A diák nem adott meg választ."}
                    </div>
                  </div>
                )}
                {q.question_type !== 'text' && (
                  <div className="space-y-2">
                    {q.exam_options.map((opt: any) => {
                      const isSelected = answer?.selected_option_ids?.includes(opt.id);
                      const isCorrect = opt.is_correct;
                      let itemClass = "flex items-center gap-3 p-3 rounded-lg border transition-all ";
                      if (isSelected && isCorrect) itemClass += "bg-green-900/20 border-green-500/50";
                      else if (isSelected && !isCorrect) itemClass += "bg-red-900/20 border-red-500/50";
                      else if (!isSelected && isCorrect) itemClass += "bg-yellow-900/10 border-yellow-500/30 opacity-60";
                      else itemClass += "bg-slate-950 border-slate-800 opacity-40";

                      return (
                        <div key={opt.id} className={itemClass}>
                          {q.question_type === 'single_choice' ? (
                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'border-white bg-white' : 'border-slate-500'}`}>{isSelected &&
                              <div className="w-2 h-2 rounded-full bg-black"/>}</div>
                          ) : (
                            <div
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-white text-black' : 'border-slate-500'}`}>{isSelected &&
                              <CheckSquare className="w-3 h-3"/>}</div>
                          )}
                          <span
                            className={`flex-1 text-sm ${isSelected ? 'text-white font-medium' : 'text-slate-400'}`}>{opt.option_text}</span>
                          {isCorrect && <Badge
                            className="bg-green-600 text-white hover:bg-green-600 ml-2 text-[10px]">Helyes</Badge>}
                          {isSelected && !isCorrect &&
                            <Badge variant="destructive" className="ml-2 text-[10px]">Rossz válasz</Badge>}
                          {!isSelected && isCorrect && <Badge variant="outline"
                                                              className="ml-2 text-[10px] text-yellow-500 border-yellow-500">Hiányzó</Badge>}
                        </div>
                      );
                    })}
                  </div>
                )}
                {!hasAnswer && q.question_type !== 'text' &&
                  <div className="mt-4 flex items-center text-red-400 text-xs"><AlertTriangle
                    className="w-4 h-4 mr-2"/> A diák nem jelölt meg semmit ennél a kérdésnél.</div>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}