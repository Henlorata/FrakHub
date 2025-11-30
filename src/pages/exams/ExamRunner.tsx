import React, {useState, useEffect, useRef, useMemo, useCallback} from 'react';
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
import {
  AlertTriangle, Clock, Save, Lock, ChevronLeft, ChevronRight,
  Play, CheckCircle2, Copy, AlertCircle, Terminal, Shield, ShieldAlert, Cpu, Activity
} from 'lucide-react';
import {useNavigate} from 'react-router-dom';
import {cn} from '@/lib/utils';

const getStorageKey = (examId: string, userId: string) => `exam_session_${userId}_${examId}`;

const generateClaimToken = () => {
  const part = () => Math.random().toString(36).substr(2, 4).toUpperCase();
  return `TR-${part()}-${part()}`;
};

// --- STÍLUS KONSTANSOK (Tech UI) ---
const TERMINAL_BG = "bg-[#0b1221] border-slate-800";
const HUD_HEADER = "sticky top-0 z-50 bg-[#0b1221]/95 backdrop-blur border-b border-slate-800 shadow-2xl";
const QUESTION_CARD = "bg-slate-900/50 border border-slate-800 relative overflow-hidden transition-all hover:border-slate-700";
const OPTION_ITEM = "flex items-center space-x-3 p-4 rounded border transition-all cursor-pointer group bg-slate-950/50 hover:bg-slate-900";
const INPUT_STYLE = "bg-slate-950 border-slate-800 focus-visible:ring-yellow-500/30 focus-visible:border-yellow-500/50 font-mono text-sm text-white placeholder:text-slate-600";

// KÜLÖN KOMPONENS A KÉRDÉSLISTÁNAK (Optimalizáció + Tech Dizájn)
const QuestionList = React.memo(({
                                   questions,
                                   answers,
                                   onAnswerChange,
                                   onCheckboxChange
                                 }: {
  questions: any[],
  answers: Record<string, any>,
  onAnswerChange: (qid: string, val: any) => void,
  onCheckboxChange: (qid: string, oid: string, checked: boolean) => void
}) => {
  return (
    <div className="space-y-8">
      {questions.map((q, index) => (
        <Card key={q.id} className={QUESTION_CARD}>
          {/* Bal oldali dekorációs csík */}
          <div className={cn("absolute top-0 left-0 w-1 h-full", q.is_required ? "bg-yellow-600" : "bg-slate-700")}/>

          <CardHeader className="pb-4 border-b border-slate-800/50 bg-slate-950/30 px-6 pt-5">
            <div className="flex justify-between items-start gap-4">
              <div className="flex gap-4">
                <div
                  className="flex items-center justify-center w-8 h-8 rounded bg-slate-900 border border-slate-700 text-sm font-bold text-slate-400 font-mono shadow-lg">
                  {q.globalIndex < 10 ? `0${q.globalIndex}` : q.globalIndex}
                </div>
                <div>
                  <CardTitle className="text-lg font-medium text-white leading-snug">
                    {q.question_text} {q.is_required &&
                    <span className="text-red-500 ml-1 text-lg" title="Kötelező">*</span>}
                  </CardTitle>
                  <div className="flex items-center gap-3 mt-1.5">
                     <span
                       className="text-[10px] font-mono text-slate-500 uppercase tracking-wider bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        {q.question_type === 'text' ? 'SZÖVEGES' : q.question_type === 'single_choice' ? 'EGY VÁLASZ' : 'TÖBB VÁLASZ'}
                     </span>
                    <span className="text-[10px] font-mono text-yellow-500/80 uppercase tracking-wider">
                        {q.points} PTS
                     </span>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            <div className="pl-0 md:pl-12">
              {q.question_type === 'text' && (
                <div className="relative">
                  <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-slate-600"></div>
                  <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-slate-600"></div>
                  <Textarea
                    className={cn(INPUT_STYLE, "min-h-[120px] resize-none text-base p-4 leading-relaxed break-all")}
                    placeholder="Írd ide a válaszod..."
                    value={answers[q.id] || ''}
                    onChange={e => onAnswerChange(q.id, e.target.value)}
                  />
                </div>
              )}

              {q.question_type === 'single_choice' && (
                <RadioGroup
                  onValueChange={(val) => onAnswerChange(q.id, val)}
                  value={answers[q.id] || ""}
                  className="space-y-3"
                >
                  {q.exam_options.map((opt: any) => (
                    <div
                      key={opt.id}
                      onClick={() => onAnswerChange(q.id, opt.id)}
                      className={cn(OPTION_ITEM, answers[q.id] === opt.id ? 'border-yellow-500/50 bg-yellow-900/10 shadow-[0_0_15px_rgba(234,179,8,0.1)]' : 'border-slate-800')}
                    >
                      <RadioGroupItem value={opt.id} id={opt.id}
                                      className="border-slate-500 text-yellow-500 border-2 data-[state=checked]:border-yellow-500"/>
                      <Label htmlFor={opt.id}
                             className={cn("cursor-pointer flex-1 font-normal text-sm select-none", answers[q.id] === opt.id ? 'text-yellow-100 font-bold' : 'text-slate-300')}>
                        {opt.option_text}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}

              {q.question_type === 'multiple_choice' && (
                <div className="space-y-3">
                  {q.exam_options.map((opt: any) => {
                    const isChecked = (answers[q.id] || []).includes(opt.id);
                    return (
                      <div
                        key={opt.id}
                        onClick={() => onCheckboxChange(q.id, opt.id, !isChecked)}
                        className={cn(OPTION_ITEM, isChecked ? 'border-yellow-500/50 bg-yellow-900/10 shadow-[0_0_15px_rgba(234,179,8,0.1)]' : 'border-slate-800')}
                      >
                        <Checkbox
                          id={opt.id}
                          checked={isChecked}
                          className="border-slate-500 border-2 data-[state=checked]:bg-yellow-500 data-[state=checked]:text-black data-[state=checked]:border-yellow-500"
                        />
                        <Label htmlFor={opt.id}
                               className={cn("cursor-pointer flex-1 font-normal text-sm select-none", isChecked ? 'text-yellow-100 font-bold' : 'text-slate-300')}>
                          {opt.option_text}
                        </Label>
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
  );
}, (prev, next) => prev.questions === next.questions && prev.answers === next.answers);

export function ExamRunner({exam}: { exam: Exam }) {
  const {supabase, user} = useAuth();
  const navigate = useNavigate();

  const sessionUserId = user?.id || 'guest';
  const storageKey = getStorageKey(exam.id, sessionUserId);

  // --- STATE (EREDETI LOGIKA) ---
  const [isStarted, setIsStarted] = useState(() => {
    // Ha van mentett session, akkor indítottnak tekintjük
    return !!localStorage.getItem(storageKey);
  });

  const [successToken, setSuccessToken] = useState<string | null>(null);

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

  const [startTime, setStartTime] = useState<number>(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) return JSON.parse(saved).startTime;
    return Date.now(); // Ez frissül, ha megnyomja a Start gombot
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

  const [timeLeft, setTimeLeft] = useState(exam.time_limit_minutes * 60); // Kezdeti érték
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const hasWarnedRef = useRef(false);

  // --- LOCALSTORAGE SYNC (EREDETI LOGIKA) ---
  useEffect(() => {
    if (!isStarted || successToken) return;

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
  }, [answers, tabSwitches, applicantName, startTime, currentPage, storageKey, exam.title, exam.id, isStarted, successToken]);


  // --- ANTI-CHEAT (EREDETI LOGIKA) ---
  useEffect(() => {
    if (!isStarted || successToken) return;

    const handleCheatAttempt = () => {
      setTabSwitches(prev => {
        const newVal = prev + 1;
        if (!hasWarnedRef.current) {
          toast.warning(`FIGYELEM! Fókuszvesztés érzékelve. Ez rögzítésre kerül!`);
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
  }, [isStarted, successToken]);

  // --- NAVIGATION LOCK (EREDETI LOGIKA) ---
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isStarted && !isSubmitting && !successToken) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isSubmitting, isStarted, successToken]);


  // --- TIMER (EREDETI LOGIKA) ---
  useEffect(() => {
    if (!isStarted || successToken) return;

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(timer);
        executeSubmit(true);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime, isStarted, successToken]);

  // --- KÉRDÉSEK ÉS LAPOZÁS (EREDETI LOGIKA) ---
  const allQuestions = useMemo(() => {
    const sorted = (exam.exam_questions || []).sort((a, b) => {
      if ((a.page_number || 1) !== (b.page_number || 1)) {
        return (a.page_number || 1) - (b.page_number || 1);
      }
      return a.order_index - b.order_index;
    });
    return sorted.map((q, idx) => ({...q, globalIndex: idx + 1}));
  }, [exam.exam_questions]);

  const totalPages = Math.max(...allQuestions.map(q => q.page_number || 1), 1);
  const currentQuestions = useMemo(() =>
      allQuestions.filter(q => (q.page_number || 1) === currentPage),
    [allQuestions, currentPage]);

  // --- HANDLERS (EREDETI LOGIKA) ---
  const handleAnswerChange = useCallback((questionId: string, value: any) => {
    setAnswers(prev => ({...prev, [questionId]: value}));
  }, []);

  const handleCheckboxChange = useCallback((questionId: string, optionId: string, checked: boolean) => {
    setAnswers(prev => {
      const current = (prev[questionId] || []) as string[];
      if (checked) {
        return {...prev, [questionId]: [...current, optionId]};
      } else {
        const newArr = current.filter((id: string) => id !== optionId);
        return {...prev, [questionId]: newArr};
      }
    });
  }, []);

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

  const handleStartExam = () => {
    if (exam.is_public && !user && !applicantName.trim()) {
      toast.error("Kérlek add meg a neved a kezdéshez!");
      return;
    }
    setStartTime(Date.now());
    setIsStarted(true);
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
      const token = !user ? generateClaimToken() : null;

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
          max_score: exam.exam_questions?.reduce((acc, q) => acc + q.points, 0) || 0,
          claim_token: token
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

      if (!user && token) {
        setSuccessToken(token);
        setIsSubmitting(false);
        return;
      }

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

  // --- LOBBY KÉPERNYŐ (TECH DIZÁJN) ---
  if (!isStarted && !successToken) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background Grid */}
        <div
          className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 to-slate-950 z-0"></div>

        <Card
          className="max-w-2xl w-full relative z-10 bg-[#0b1221] border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in duration-300">
          {/* Header Strip */}
          <div className="h-1.5 w-full bg-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.5)]"></div>

          <CardContent className="p-8 md:p-10">
            <div className="text-center mb-10">
              <div
                className="w-24 h-24 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto border border-yellow-500/20 shadow-[0_0_40px_rgba(234,179,8,0.15)] mb-6 animate-pulse-slow">
                <Terminal className="w-12 h-12 text-yellow-500"/>
              </div>
              <h1 className="text-4xl font-black text-white uppercase tracking-tighter mb-3">{exam.title}</h1>
              <p
                className="text-slate-400 max-w-lg mx-auto text-sm leading-relaxed font-medium border-t border-b border-slate-800 py-4 bg-slate-900/30">
                {exam.description || "TRAINING SIMULATION MODULE INITIALIZED."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-8">
              <div
                className="bg-slate-900/80 p-5 rounded-lg border border-slate-800 flex flex-col items-center justify-center hover:border-blue-500/30 transition-colors group">
                <Clock className="w-8 h-8 text-blue-500 mb-2 group-hover:scale-110 transition-transform"/>
                <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">IDŐKERET</span>
                <span className="text-2xl font-mono text-white font-bold">{exam.time_limit_minutes} MIN</span>
              </div>
              <div
                className="bg-slate-900/80 p-5 rounded-lg border border-slate-800 flex flex-col items-center justify-center hover:border-red-500/30 transition-colors group">
                <ShieldAlert className="w-8 h-8 text-red-500 mb-2 group-hover:scale-110 transition-transform"/>
                <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">ANTI-CHEAT</span>
                <span className="text-2xl font-mono text-white font-bold">AKTÍV</span>
              </div>
            </div>

            {exam.is_public && !user && (
              <div className="mb-8 bg-slate-950/50 p-4 rounded-lg border border-slate-800">
                <Label className="text-xs text-yellow-500 uppercase font-bold mb-2 block tracking-widest">JELENTKEZŐ
                  NEVE</Label>
                <Input value={applicantName} onChange={e => setApplicantName(e.target.value)}
                       placeholder="TELJES IC NÉV..." className={cn(INPUT_STYLE, "h-12 text-lg font-bold")}/>
              </div>
            )}

            <Button onClick={handleStartExam}
                    className="w-full h-16 text-xl font-black bg-yellow-600 hover:bg-yellow-500 text-black shadow-[0_0_30px_rgba(234,179,8,0.25)] uppercase tracking-[0.1em] transition-all hover:scale-[1.01]">
              SZIMULÁCIÓ INDÍTÁSA <Play className="w-6 h-6 ml-3 fill-current"/>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- TOKEN SIKER KÉPERNYŐ (TECH DIZÁJN) ---
  if (successToken) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
        <div
          className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-5 pointer-events-none"></div>

        <Card
          className="max-w-md w-full bg-[#0b1221] border border-green-500/30 shadow-[0_0_60px_rgba(34,197,94,0.15)] animate-in zoom-in duration-300">
          <div className="h-1 w-full bg-green-500"></div>
          <CardContent className="p-10 text-center space-y-8">
            <div
              className="w-24 h-24 bg-green-900/10 rounded-full flex items-center justify-center mx-auto border border-green-500/20 shadow-[0_0_30px_rgba(34,197,94,0.2)]">
              <CheckCircle2 className="w-12 h-12 text-green-500"/>
            </div>

            <div>
              <h1 className="text-3xl font-black text-white uppercase tracking-tight mb-2">SIKERES BEKÜLDÉS</h1>
              <p className="text-slate-400 text-sm font-medium">Az eredményt a rendszer rögzítette.</p>
            </div>

            <div
              className="bg-slate-900/80 p-6 rounded-xl border border-slate-800 text-left space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-bl-full -mr-12 -mt-12"/>
              <div>
                <p
                  className="text-[10px] text-green-500 font-black uppercase tracking-widest mb-1 flex items-center gap-2">
                  <Shield className="w-3 h-3"/> AZONOSÍTÓ KÓD
                </p>
                <p className="text-xs text-slate-500 leading-snug">Mentsd el ezt a kódot a későbbi hivatkozáshoz.</p>
              </div>
              <div className="flex items-center gap-2">
                <code
                  className="flex-1 bg-black/40 p-3 rounded border border-green-900/50 font-mono text-2xl text-green-400 font-bold tracking-widest text-center select-all">
                  {successToken}
                </code>
                <Button size="icon" variant="outline"
                        className="h-14 w-14 border-slate-700 hover:bg-slate-800 hover:text-white"
                        onClick={() => {
                          navigator.clipboard.writeText(successToken);
                          toast.success("Másolva!");
                        }}>
                  <Copy className="w-6 h-6"/>
                </Button>
              </div>
            </div>

            <Button
              className="w-full bg-green-700 hover:bg-green-600 text-white h-12 font-bold shadow-lg uppercase tracking-wider"
              onClick={() => user ? navigate('/exams') : navigate('/login')}>
              RENDBEN, KILÉPÉS
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- VIZSGA FOLYAMATBAN (HUD INTERFACE) ---
  return (
    <div className="relative min-h-screen bg-slate-950 pb-20 selection:bg-yellow-500/30">
      {/* CONFIRM DIALOG */}
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent className="bg-[#0b1221] border-slate-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black uppercase tracking-tight">VIZSGA
              BEFEJEZÉSE?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              A "LEADÁS" gombra kattintva véglegesíted a válaszaidat. <br/>Ellenőriztél mindent?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="bg-slate-800 text-white hover:bg-slate-700 border-slate-700">MÉGSEM</AlertDialogCancel>
            <AlertDialogAction onClick={() => executeSubmit(false)}
                               className="bg-yellow-600 text-black hover:bg-yellow-700 font-bold uppercase tracking-wider">
              IGEN, LEADÁS
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- HUD HEADER (Sticky) --- */}
      <div className={HUD_HEADER}>
        <div className="max-w-[1600px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-slate-900 border border-slate-700 rounded flex items-center justify-center">
              <Terminal className="w-5 h-5 text-slate-400"/>
            </div>
            <div>
              <h1 className="text-lg font-black text-white uppercase tracking-tight leading-none">{exam.title}</h1>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                  <span
                    className="text-[9px] font-mono text-slate-500 uppercase tracking-widest font-bold">LIVE SESSION</span>
                </div>
                <span className="text-slate-700">|</span>
                <span className="text-[9px] font-mono text-slate-400">PAGE {currentPage}/{totalPages}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {tabSwitches > 0 && (
              <div
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded bg-red-950/30 border border-red-900/50 text-red-500 text-[10px] font-bold uppercase tracking-wider animate-pulse">
                <AlertTriangle className="w-3 h-3"/> {tabSwitches} WARNINGS
              </div>
            )}
            <div
              className={cn("flex items-center gap-3 px-5 py-2 rounded border bg-slate-900/80", timeLeft < 300 ? 'border-red-500/50 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-pulse' : 'border-slate-700 text-yellow-500')}>
              <Clock className="w-5 h-5"/>
              <span className="text-2xl font-mono font-bold tracking-widest">{formatTime(timeLeft)}</span>
            </div>
          </div>
        </div>
        <Progress value={progress}
                  className="h-1 w-full rounded-none bg-slate-900 [&>div]:bg-yellow-500 transition-all duration-500"/>
      </div>

      {/* --- CONTENT --- */}
      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Info Box (Csak az első oldalon) */}
        {currentPage === 1 && (
          <div
            className="mb-10 p-6 bg-blue-900/5 border border-blue-500/10 rounded-lg flex gap-4 animate-in slide-in-from-top-4">
            <Activity className="w-5 h-5 text-blue-500 shrink-0 mt-1"/>
            <div className="text-sm text-slate-300 italic leading-relaxed max-w-none whitespace-pre-wrap">
              {exam.description || "Nincs leírás."}
            </div>
          </div>
        )}

        {/* KÉRDÉSEK */}
        <QuestionList
          questions={currentQuestions}
          answers={answers}
          onAnswerChange={handleAnswerChange}
          onCheckboxChange={handleCheckboxChange}
        />

        {/* NAVIGÁCIÓ */}
        <div className="flex justify-between items-center pt-10 gap-4 mt-8 border-t border-slate-800">
          <Button variant="outline" onClick={handlePrevPage} disabled={currentPage === 1 || isSubmitting}
                  className="h-12 px-8 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 bg-slate-900 uppercase font-bold tracking-wider text-xs">
            <ChevronLeft className="w-4 h-4 mr-2"/> ELŐZŐ OLDAL
          </Button>

          {currentPage === totalPages ? (
            <Button onClick={handleManualSubmit} disabled={isSubmitting}
                    className="h-14 px-10 text-sm font-black bg-yellow-600 hover:bg-yellow-500 text-black shadow-[0_0_20px_rgba(234,179,8,0.2)] uppercase tracking-widest transition-all hover:scale-105">
              {isSubmitting ?
                <span className="flex items-center gap-2"><Clock className="animate-spin"/> FELDOLGOZÁS...</span> :
                <span className="flex items-center gap-2"><Save className="w-5 h-5"/> VIZSGA BEFEJEZÉSE</span>}
            </Button>
          ) : (
            <Button onClick={handleNextPage} disabled={isSubmitting}
                    className="h-12 px-8 bg-slate-100 hover:bg-white text-slate-900 font-bold uppercase tracking-wider text-xs">
              KÖVETKEZŐ <ChevronRight className="w-4 h-4 ml-2"/>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}