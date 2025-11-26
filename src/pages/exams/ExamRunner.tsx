import React, {useState, useEffect, useRef} from 'react';
import {useAuth} from '@/context/AuthContext';
import {toast} from 'sonner';
import type {Exam} from '@/types/exams';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Textarea} from '@/components/ui/textarea';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {RadioGroup, RadioGroupItem} from "@/components/ui/radio-group";
import {Checkbox} from "@/components/ui/checkbox";
import {Progress} from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {AlertTriangle, Clock, Save, Lock, ChevronLeft, ChevronRight} from 'lucide-react';
import {useNavigate} from 'react-router-dom';

// Segédfüggvény a LocalStorage kulcshoz
const getStorageKey = (examId: string, userId: string) => `exam_session_${userId}_${examId}`;

export function ExamRunner({exam}: { exam: Exam }) {
  const {supabase, user} = useAuth();
  const navigate = useNavigate();

  const sessionUserId = user?.id || 'guest';
  const storageKey = getStorageKey(exam.id, sessionUserId);

  // --- STATE ---
  const [answers, setAnswers] = useState<Record<string, any>>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved).answers : {};
  });

  const [tabSwitches, setTabSwitches] = useState<number>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved).tabSwitches : 0;
  });

  const [applicantName, setApplicantName] = useState<string>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved).applicantName : "";
  });

  const [startTime] = useState<number>(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) return JSON.parse(saved).startTime;
    return Date.now();
  });

  const [currentPage, setCurrentPage] = useState<number>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? (JSON.parse(saved).currentPage || 1) : 1;
  });

  const calculateTimeLeft = () => {
    const now = Date.now();
    const endTime = startTime + (exam.time_limit_minutes * 60 * 1000);
    const diff = Math.floor((endTime - now) / 1000);
    return diff > 0 ? diff : 0;
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const hasWarnedRef = useRef(false);

  // --- LOCALSTORAGE SYNC ---
  useEffect(() => {
    const stateToSave = {
      answers,
      tabSwitches,
      applicantName,
      startTime,
      currentPage,
      examTitle: exam.title,
      examId: exam.id
    };
    localStorage.setItem(storageKey, JSON.stringify(stateToSave));
  }, [answers, tabSwitches, applicantName, startTime, currentPage, storageKey, exam.title, exam.id]);


  // --- ANTI-CHEAT ---
  useEffect(() => {
    const handleCheatAttempt = () => {
      setTabSwitches(prev => {
        const newVal = prev + 1;
        if (!hasWarnedRef.current) {
          toast.warning(`Figyelem! Vizsga elhagyása érzékelve. Ez rögzítésre kerül!`);
          hasWarnedRef.current = true;
          setTimeout(() => {
            hasWarnedRef.current = false
          }, 10000);
        }
        return newVal;
      });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) handleCheatAttempt();
    };
    const handleBlur = () => {
      handleCheatAttempt();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  // --- NAVIGATION LOCK ---
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isSubmitting) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isSubmitting]);


  // --- TIMER ---
  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(timer);
        executeSubmit(true);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  // --- KÉRDÉSEK ÉS LAPOZÁS ---
  const allQuestions = React.useMemo(() => {
    return (exam.exam_questions || []).sort((a, b) => {
      if ((a.page_number || 1) !== (b.page_number || 1)) {
        return (a.page_number || 1) - (b.page_number || 1);
      }
      return a.order_index - b.order_index;
    });
  }, [exam.exam_questions]);

  const totalPages = Math.max(...allQuestions.map(q => q.page_number || 1), 1);
  const currentQuestions = allQuestions.filter(q => (q.page_number || 1) === currentPage);

  // --- HANDLERS ---
  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers(prev => ({...prev, [questionId]: value}));
  };

  const handleCheckboxChange = (questionId: string, optionId: string, checked: boolean) => {
    setAnswers(prev => {
      const current = (prev[questionId] || []) as string[];
      if (checked) {
        return {...prev, [questionId]: [...current, optionId]};
      } else {
        const newArr = current.filter((id: string) => id !== optionId);
        return {...prev, [questionId]: newArr};
      }
    });
  };

  const handleNextPage = () => {
    const missingOnPage = currentQuestions.filter(q => {
      if (!q.is_required) return false;
      const val = answers[q.id];
      if (val === undefined || val === null) return true;
      if (typeof val === 'string' && val.trim() === '') return true;
      if (Array.isArray(val) && val.length === 0) return true;
      return false;
    });

    if (missingOnPage.length > 0) {
      toast.error(`Kérlek válaszold meg a kötelező kérdéseket ezen az oldalon!`);
      return;
    }

    if (currentPage < totalPages) {
      setCurrentPage(p => p + 1);
      window.scrollTo({top: 0, behavior: 'smooth'});
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(p => p - 1);
      window.scrollTo({top: 0, behavior: 'smooth'});
    }
  };

  const checkRequiredFields = () => {
    if (exam.is_public && !user && !applicantName.trim()) {
      toast.error("Kérlek add meg a teljes nevedet!");
      window.scrollTo({top: 0, behavior: 'smooth'});
      return false;
    }

    const missing = exam.exam_questions?.filter(q => {
      if (!q.is_required) return false;
      const val = answers[q.id];
      if (val === undefined || val === null) return true;
      if (typeof val === 'string' && val.trim() === '') return true;
      if (Array.isArray(val) && val.length === 0) return true;
      return false;
    });

    if (missing && missing.length > 0) {
      toast.error(`Még ${missing.length} kötelező kérdésre nem válaszoltál!`);
      return false;
    }
    return true;
  };

  const handleManualSubmit = () => {
    if (!checkRequiredFields()) return;
    setIsConfirmOpen(true);
  };

  const executeSubmit = async (forceSubmit = false) => {
    if (forceSubmit) {
      toast.info("Lejárt az idő! A vizsga automatikusan beadásra került.");
    }

    setIsSubmitting(true);
    const toastId = toast.loading("Vizsga beküldése...");

    try {
      const {data: submission, error: subError} = await supabase
        .from('exam_submissions')
        .insert({
          exam_id: exam.id,
          user_id: user?.id || null,
          applicant_name: user?.user_metadata?.full_name || applicantName,
          start_time: new Date(startTime).toISOString(),
          end_time: new Date().toISOString(),
          tab_switch_count: tabSwitches,
          status: 'pending',
          max_score: exam.exam_questions?.reduce((acc, q) => acc + q.points, 0) || 0
        })
        .select()
        .single();

      if (subError) throw subError;

      const answersToInsert = exam.exam_questions?.map(q => {
        const val = answers[q.id];
        let payload: any = {submission_id: submission.id, question_id: q.id};

        if (q.question_type === 'text') {
          payload.answer_text = val || "";
        } else if (q.question_type === 'single_choice') {
          payload.selected_option_ids = val ? [val] : [];
        } else if (q.question_type === 'multiple_choice') {
          payload.selected_option_ids = val || [];
        }
        return payload;
      });

      if (answersToInsert && answersToInsert.length > 0) {
        const {error: ansError} = await supabase.from('exam_answers').insert(answersToInsert);
        if (ansError) throw ansError;
      }

      localStorage.removeItem(storageKey);
      toast.dismiss(toastId);
      toast.success("Sikeres vizsga leadás!");

      if (user) navigate('/exams');
      else navigate('/login');

    } catch (error: any) {
      console.error(error);
      toast.dismiss(toastId);
      toast.error("Hiba történt a beküldéskor: " + error.message);
      setIsSubmitting(false);
      setIsConfirmOpen(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const answeredCount = exam.exam_questions?.reduce((acc, q) => {
    const val = answers[q.id];
    const hasValue =
      (typeof val === 'string' && val.trim().length > 0) ||
      (Array.isArray(val) && val.length > 0) ||
      (val !== undefined && val !== null && !Array.isArray(val) && typeof val !== 'string');
    return acc + (hasValue ? 1 : 0);
  }, 0) || 0;

  const totalQuestions = exam.exam_questions?.length || 0;
  const progress = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  return (
    <div className="relative min-h-screen">
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent className="bg-slate-900 border-slate-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Biztosan leadod a vizsgát?</AlertDialogTitle>
            {/* JAVÍTÁS: Description használata */}
            <AlertDialogDescription className="text-slate-400">
              A "Leadás" gombra kattintva véglegesíted a válaszaidat.
              Ezután már nincs lehetőség módosításra. Ellenőriztél mindent?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="bg-slate-800 text-white hover:bg-slate-700 border-slate-700">Mégsem</AlertDialogCancel>
            <AlertDialogAction onClick={() => executeSubmit(false)}
                               className="bg-yellow-600 text-black hover:bg-yellow-700 font-bold">
              Igen, leadom
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div
        className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-[2px] flex flex-col items-center justify-start pt-10 pointer-events-auto cursor-not-allowed"></div>

      <div className="relative z-50 max-w-4xl mx-auto space-y-8 pb-20 px-4 pt-4">
        <div className="sticky top-4 z-50 space-y-0">
          <Card className="bg-slate-900/95 backdrop-blur border-yellow-600/30 border-t-4 shadow-2xl rounded-b-none">
            <CardContent className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <Lock className="w-5 h-5 text-yellow-500"/> {exam.title}
                </h1>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Vizsga folyamatban • Ne
                  frissíts!</p>
              </div>
              <div className="flex items-center gap-4">
                {tabSwitches > 0 && (
                  <div
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950/50 border border-red-900/50 text-red-400 text-xs font-bold animate-pulse">
                    <AlertTriangle className="w-3 h-3"/> {tabSwitches} hiba
                  </div>
                )}
                <div
                  className={`text-2xl font-mono font-bold flex items-center gap-2 px-4 py-1 rounded-lg bg-slate-950 border border-slate-800 ${timeLeft < 300 ? 'text-red-500 animate-pulse border-red-900/50' : 'text-yellow-500'}`}>
                  <Clock className="w-5 h-5"/> {formatTime(timeLeft)}
                </div>
              </div>
            </CardContent>
          </Card>
          <Progress value={progress}
                    className="h-1.5 w-full rounded-none rounded-b-md bg-slate-800 [&>div]:bg-yellow-500"/>
        </div>

        {currentPage === 1 && (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6 space-y-4">
              <div
                className="prose prose-invert text-sm text-slate-300 max-w-none whitespace-pre-wrap border-l-2 border-slate-700 pl-4 italic">
                {exam.description || "Nincs leírás megadva."}
              </div>

              {exam.is_public && !user && (
                <div className="pt-4 border-t border-slate-800 animate-in fade-in slide-in-from-top-2">
                  <Label className="text-base text-yellow-500 mb-2 block">Jelentkező Teljes Neve (IC) *</Label>
                  <Input
                    value={applicantName}
                    onChange={e => setApplicantName(e.target.value)}
                    className="bg-slate-950 border-slate-700 text-lg h-12 focus-visible:ring-yellow-500/50"
                    placeholder="pl. John Doe"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-between items-center text-sm text-slate-400 px-2">
          <span>{currentPage}. oldal a(z) {totalPages}-ból</span>
          <span>Kitöltöttség: {Math.round(progress)}%</span>
        </div>

        <div className="space-y-6">
          {currentQuestions.map((q, index) => (
            <Card key={q.id}
                  className={`bg-slate-900 border-slate-800 transition-all hover:border-slate-700 hover:shadow-md ${q.is_required ? 'border-l-4 border-l-slate-700' : ''}`}>
              <CardHeader className="pb-2 border-b border-slate-800/50 bg-slate-950/30 px-6 pt-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex gap-3">
                    <div
                      className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 text-xs font-bold text-slate-400 border border-slate-700 mt-0.5">
                      {allQuestions.findIndex(aq => aq.id === q.id) + 1}
                    </div>
                    <CardTitle className="text-base font-medium text-white leading-snug">
                      {q.question_text} {q.is_required && <span className="text-red-500 ml-1" title="Kötelező">*</span>}
                    </CardTitle>
                  </div>
                  <span
                    className="text-xs font-mono text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800 shrink-0">
                                    {q.points} pont
                                </span>
                </div>
              </CardHeader>

              <CardContent className="p-6 pt-4">
                <div className="pl-0 md:pl-9">
                  {q.question_type === 'text' && (
                    <Textarea
                      className="bg-slate-950 border-slate-700 min-h-[100px] focus-visible:ring-yellow-600/50"
                      placeholder="Írd ide a válaszod..."
                      value={answers[q.id] || ''}
                      onChange={e => handleAnswerChange(q.id, e.target.value)}
                    />
                  )}

                  {q.question_type === 'single_choice' && (
                    // JAVÍTÁS: Controlled value={... || ""} az undefined warning elkerülésére
                    <RadioGroup
                      onValueChange={(val) => handleAnswerChange(q.id, val)}
                      value={answers[q.id] || ""}
                      className="space-y-3"
                    >
                      {q.exam_options.map(opt => (
                        <div
                          key={opt.id}
                          onClick={() => handleAnswerChange(q.id, opt.id)}
                          className={`flex items-center space-x-3 p-3 rounded-lg border transition-all cursor-pointer group ${answers[q.id] === opt.id ? 'bg-yellow-500/10 border-yellow-500/50' : 'bg-slate-950 border-slate-800 hover:border-slate-600'}`}
                        >
                          <RadioGroupItem value={opt.id} id={opt.id}
                                          className="border-slate-500 text-yellow-500 group-hover:border-yellow-500 pointer-events-none"/>
                          <Label htmlFor={opt.id}
                                 className={`cursor-pointer flex-1 font-normal pointer-events-none ${answers[q.id] === opt.id ? 'text-yellow-100' : 'text-slate-300'}`}>{opt.option_text}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}

                  {q.question_type === 'multiple_choice' && (
                    <div className="space-y-3">
                      {q.exam_options.map(opt => {
                        const isChecked = (answers[q.id] || []).includes(opt.id);
                        return (
                          <div
                            key={opt.id}
                            onClick={() => handleCheckboxChange(q.id, opt.id, !isChecked)}
                            className={`flex items-center space-x-3 p-3 rounded-lg border transition-all cursor-pointer group ${isChecked ? 'bg-yellow-500/10 border-yellow-500/50' : 'bg-slate-950 border-slate-800 hover:border-slate-600'}`}
                          >
                            <Checkbox
                              id={opt.id}
                              checked={isChecked}
                              className="border-slate-500 data-[state=checked]:bg-yellow-600 data-[state=checked]:text-black group-hover:border-yellow-500 pointer-events-none"
                            />
                            <Label htmlFor={opt.id}
                                   className={`cursor-pointer flex-1 font-normal pointer-events-none ${isChecked ? 'text-yellow-100' : 'text-slate-300'}`}>{opt.option_text}</Label>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-between items-center pt-6 gap-4">
          <Button
            variant="outline"
            onClick={handlePrevPage}
            disabled={currentPage === 1 || isSubmitting}
            className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800 h-12"
          >
            <ChevronLeft className="w-5 h-5 mr-2"/> Előző
          </Button>

          {currentPage === totalPages ? (
            <Button
              onClick={handleManualSubmit}
              disabled={isSubmitting}
              className="flex-[2] h-12 text-lg font-bold bg-yellow-600 hover:bg-yellow-700 text-black shadow-lg shadow-yellow-900/20"
            >
              {isSubmitting ?
                <span className="flex items-center gap-2"><Clock className="animate-spin"/> Beküldés...</span> :
                <span className="flex items-center gap-2"><Save className="w-5 h-5"/> Vizsga Befejezése</span>}
            </Button>
          ) : (
            <Button
              onClick={handleNextPage}
              disabled={isSubmitting}
              className="flex-[2] h-12 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
            >
              Következő <ChevronRight className="w-5 h-5 ml-2"/>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}