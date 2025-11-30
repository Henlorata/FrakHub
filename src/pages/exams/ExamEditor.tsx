import React, {useState, useEffect, useCallback, memo, useRef} from "react";
import {useNavigate, useParams} from "react-router-dom";
import {useAuth} from "@/context/AuthContext";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Card, CardContent, CardHeader} from "@/components/ui/card";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Tabs, TabsList, TabsTrigger, TabsContent} from "@/components/ui/tabs";
import {
  Trash2, Plus, Save, ArrowLeft, GripVertical, CheckCircle2, AlertCircle, Type,
  List, CheckSquare, FilePlus, FileX, ChevronLeft, ChevronRight, Share2, Globe,
  AlertTriangle, Percent, Settings, Layers, Check, X
} from "lucide-react";
import {toast} from "sonner";
import {FACTION_RANKS} from "@/types/supabase";
import type {Exam} from "@/types/exams";
import {canManageExamContent, canCreateAnyExam, canDeleteExam, cn} from "@/lib/utils";
import {Badge} from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";

const tempId = () => `temp-${Math.random().toString(36).substr(2, 9)}`;

// --- STÍLUS KONSTANSOK ---
const EDITOR_INPUT = "bg-[#0f172a] border-slate-800 focus-visible:ring-yellow-500/30 focus-visible:border-yellow-500/50 font-mono text-sm text-white";
const QUESTION_CARD = "bg-[#0b1221] border border-slate-800 relative group transition-all hover:border-slate-600 shadow-lg overflow-hidden";

// --- SEGÉDFÜGGVÉNY: SZÁM BEVITEL SZŰRÉS ---
const preventInvalidNumberInput = (e: React.KeyboardEvent) => {
  if (['e', 'E', '+', '-'].includes(e.key)) {
    e.preventDefault();
  }
};

// --- OPTION ITEM COMPONENT ---
const OptionItem = memo(({opt, index, qId, qType, onUpdate, onRemove}: any) => {
  const [localText, setLocalText] = useState(opt.option_text);

  useEffect(() => {
    setLocalText(opt.option_text);
  }, [opt.option_text]);

  const handleBlur = () => {
    if (localText !== opt.option_text) onUpdate(qId, index, 'option_text', localText);
  };

  return (
    <div className="flex items-center gap-3 group/opt animate-in fade-in slide-in-from-left-2 duration-300">
      <div className="relative">
        <button
          className={cn(
            "w-9 h-9 rounded-md border-2 flex items-center justify-center transition-all",
            opt.is_correct
              ? "bg-green-500/10 border-green-500 text-green-500 shadow-[0_0_10px_rgba(34,197,94,0.2)]"
              : "bg-slate-900 border-slate-700 text-slate-600 hover:border-slate-500 hover:text-slate-400"
          )}
          onClick={() => qType === 'single_choice' ? onUpdate(qId, index, 'set_correct_unique', true) : onUpdate(qId, index, 'is_correct', !opt.is_correct)}
          title={opt.is_correct ? "Helyes válasz" : "Jelöld meg helyesként"}
        >
          <CheckCircle2 className="w-5 h-5"/>
        </button>
      </div>
      <Input
        value={localText}
        onChange={e => setLocalText(e.target.value)}
        onBlur={handleBlur}
        className={cn(EDITOR_INPUT, "h-10 flex-1", !localText && "border-red-900/40 bg-red-950/10 placeholder:text-red-500/50")}
        placeholder={`Opció ${index + 1}...`}
      />
      <Button variant="ghost" size="icon"
              className="h-9 w-9 text-slate-600 hover:text-red-500 hover:bg-red-950/20 opacity-0 group-hover/opt:opacity-100 transition-opacity"
              onClick={() => onRemove(qId, index)}>
        <Trash2 className="w-4 h-4"/>
      </Button>
    </div>
  );
});

// --- QUESTION CARD COMPONENT ---
const QuestionCard = memo(({q, index, onUpdate, onRemove, onAddOption, onRemoveOption, onUpdateOption}: any) => {
  const [localText, setLocalText] = useState(q.question_text);
  const [localPoints, setLocalPoints] = useState(q.points);

  useEffect(() => {
    setLocalText(q.question_text);
  }, [q.question_text]);
  useEffect(() => {
    setLocalPoints(q.points);
  }, [q.points]);

  const handleTextBlur = () => {
    if (localText !== q.question_text) onUpdate(q.id, 'question_text', localText);
  };

  // Pontszám validáció (csak pozitív egész)
  const handlePointsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '' || /^[0-9]+$/.test(val)) {
      setLocalPoints(val);
    }
  };

  const handlePointsBlur = () => {
    let p = parseInt(String(localPoints)) || 0;
    if (p < 1) p = 1; // Minimum 1 pont
    onUpdate(q.id, 'points', p);
    setLocalPoints(p);
  };

  const getTypeIcon = () => {
    switch (q.question_type) {
      case 'single_choice':
        return <CheckCircle2 className="w-3 h-3 mr-1"/>;
      case 'multiple_choice':
        return <CheckSquare className="w-3 h-3 mr-1"/>;
      default:
        return <Type className="w-3 h-3 mr-1"/>;
    }
  };

  return (
    <Card className={QUESTION_CARD}>
      <div className="absolute top-0 left-0 w-1 h-full bg-slate-800 group-hover:bg-blue-500 transition-colors"/>

      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <Button variant="ghost" size="icon" className="text-slate-500 hover:text-red-500 hover:bg-red-950/20 h-8 w-8"
                onClick={() => onRemove(q.id)}>
          <Trash2 className="w-4 h-4"/>
        </Button>
      </div>

      <CardHeader
        className="pb-3 border-b border-slate-800/50 bg-slate-950/50 px-5 pt-4 flex flex-row items-center gap-3">
        <div
          className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 bg-slate-900 p-1 rounded border border-slate-800">
          <GripVertical className="w-4 h-4"/></div>
        <div className="flex items-center gap-2">
          <Badge variant="outline"
                 className="bg-slate-900 text-slate-400 border-slate-700 flex items-center h-6 text-[10px] uppercase tracking-wider">{getTypeIcon()} {q.question_type === 'text' ? 'KIFEJTŐS' : q.question_type === 'single_choice' ? 'EGY VÁLASZ' : 'TÖBB VÁLASZ'}</Badge>
          {q.is_required && <Badge
            className="bg-red-900/20 text-red-400 border-red-900/50 border hover:bg-red-900/30 text-[10px]">KÖTELEZŐ</Badge>}
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-6">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1 space-y-2">
            <Label className="text-xs text-slate-500 uppercase font-bold tracking-wider">Kérdés Szövege</Label>
            <Textarea
              value={localText}
              onChange={e => setLocalText(e.target.value)}
              onBlur={handleTextBlur}
              className={cn(EDITOR_INPUT, "min-h-[80px] resize-none text-base", !localText && "border-red-900/40")}
              placeholder="Írd be a kérdést..."
            />
          </div>
          <div className="flex flex-col gap-4 min-w-[220px]">
            <div className="space-y-2">
              <Label className="text-xs text-slate-500 uppercase font-bold tracking-wider">Típus</Label>
              <Select value={q.question_type} onValueChange={val => onUpdate(q.id, 'question_type', val)}>
                <SelectTrigger className={EDITOR_INPUT}><SelectValue/></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="text">Szöveges (Kifejtős)</SelectItem>
                  <SelectItem value="single_choice">Egy választható (Radio)</SelectItem>
                  <SelectItem value="multiple_choice">Több választható (Checkbox)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3">
              <div className="space-y-2 flex-1">
                <Label className="text-xs text-slate-500 uppercase font-bold tracking-wider">Pont</Label>
                <Input
                  type="number"
                  min={1}
                  value={localPoints}
                  onChange={handlePointsChange}
                  onBlur={handlePointsBlur}
                  onKeyDown={preventInvalidNumberInput}
                  className={EDITOR_INPUT}
                />
              </div>
              <div className="space-y-2 flex flex-col justify-end pb-1">
                {/* REQ GOMB (Switch helyett) */}
                <div
                  onClick={() => onUpdate(q.id, 'is_required', !q.is_required)}
                  className={cn(
                    "h-10 px-3 rounded-md border flex items-center justify-center cursor-pointer select-none transition-all font-bold text-xs",
                    q.is_required
                      ? "bg-red-900/20 border-red-500 text-red-500 hover:bg-red-900/30"
                      : "bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500"
                  )}
                >
                  REQ
                </div>
              </div>
            </div>
          </div>
        </div>

        {q.question_type !== 'text' && (
          <div className="pl-0 md:pl-4 md:border-l-2 md:border-slate-800/50 space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest flex items-center gap-2"><List
                className="w-3 h-3"/> VÁLASZLEHETŐSÉGEK</Label>
              {q.exam_options.length < 2 && <span
                className="text-red-400 text-[10px] font-bold flex items-center bg-red-950/20 px-2 py-0.5 rounded border border-red-900/30"><AlertCircle
                className="w-3 h-3 mr-1"/> MIN 2 OPCIÓ</span>}
            </div>
            <div className="space-y-2">
              {q.exam_options.map((opt: any, oIndex: number) => (
                <OptionItem key={opt.id} opt={opt} index={oIndex} qId={q.id} qType={q.question_type}
                            onUpdate={onUpdateOption} onRemove={onRemoveOption}/>
              ))}
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-800/50 mt-2">
              <Button size="sm" variant="ghost"
                      className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 text-xs font-bold uppercase tracking-wider"
                      onClick={() => onAddOption(q.id)}>
                <Plus className="w-3 h-3 mr-2"/> Opció Hozzáadása
              </Button>
              {q.exam_options.length >= 2 && !q.exam_options.some((o: any) => o.is_correct) &&
                <p className="text-yellow-500 text-[10px] font-bold animate-pulse flex items-center"><AlertTriangle
                  className="w-3 h-3 mr-1"/> Jelöld ki a helyes választ!</p>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}, (prev, next) => prev.q === next.q);

// --- SEGÉD: Toggle Card a beállításokhoz ---
const SettingToggle = ({title, description, active, onChange, icon: Icon, activeColorClass}: any) => (
  <div
    onClick={() => onChange(!active)}
    className={cn(
      "flex items-center justify-between p-4 rounded-lg border transition-all cursor-pointer select-none group hover:border-slate-600",
      active
        ? cn("bg-slate-900/80", activeColorClass || "border-blue-500/50")
        : "bg-slate-950 border-slate-800"
    )}
  >
    <div className="flex items-center gap-3">
      <div
        className={cn("p-2 rounded-md transition-colors", active ? "bg-white/10 text-white" : "bg-slate-900 text-slate-500")}>
        <Icon className="w-5 h-5"/>
      </div>
      <div>
        <div
          className={cn("text-sm font-bold uppercase tracking-wide transition-colors", active ? "text-white" : "text-slate-400")}>{title}</div>
        <div className="text-[10px] text-slate-500">{description}</div>
      </div>
    </div>
    <div
      className={cn("px-3 py-1 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all",
        active ? "bg-white text-black" : "bg-slate-800 text-slate-600")}>
      {active ? <><Check className="w-3 h-3"/> BE</> : <><X className="w-3 h-3"/> KI</>}
    </div>
  </div>
);

// --- MAIN EXAM EDITOR ---
export function ExamEditor() {
  const {supabase, profile} = useAuth();
  const navigate = useNavigate();
  const {examId} = useParams();

  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("settings");
  const [pageToDelete, setPageToDelete] = useState<number | null>(null);
  const [currentEditorPage, setCurrentEditorPage] = useState(1);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [submissionCount, setSubmissionCount] = useState(0);
  const loadedExamIdRef = useRef<string | null>(null);

  const [examData, setExamData] = useState<Partial<Exam>>({
    title: "",
    description: "",
    type: "division_exam",
    division: "SEB",
    required_rank: "Deputy Sheriff Trainee",
    min_days_in_rank: 0,
    time_limit_minutes: 60,
    passing_percentage: 80,
    is_public: false,
    is_active: true,
    allow_sharing: false,
  });
  const [questions, setQuestions] = useState<any[]>([]);

  // LOGIKA: Eredeti jogosultság és betöltés
  useEffect(() => {
    if (!profile) return;
    if (!examId && !canCreateAnyExam(profile)) {
      toast.error("Nincs jogosultságod.");
      navigate('/exams');
    }
  }, [profile, examId, navigate]);

  useEffect(() => {
    if (examId && profile && loadedExamIdRef.current !== examId) {
      const fetchExam = async () => {
        setIsLoading(true);
        const {
          data,
          error
        } = await supabase.from('exams').select(`*, exam_questions(*, exam_options(*))`).eq('id', examId).single();
        if (error) {
          toast.error("Hiba a betöltéskor");
          navigate('/exams');
        } else {
          if (!canManageExamContent(profile, data as any)) {
            toast.error("Nincs jogosultságod.");
            navigate('/exams');
            return;
          }
          const {count} = await supabase.from('exam_submissions').select('*', {
            count: 'exact',
            head: true
          }).eq('exam_id', examId);
          setSubmissionCount(count || 0);
          const {exam_questions, ...cleanData} = data;
          setExamData(cleanData);
          const sorted = (data.exam_questions || []).sort((a: any, b: any) => a.order_index - b.order_index);
          setQuestions(sorted.map((q: any) => ({
            ...q,
            is_required: q.is_required ?? true,
            page_number: q.page_number ?? 1
          })));
          loadedExamIdRef.current = examId;
        }
        setIsLoading(false);
      };
      fetchExam();
    }
  }, [examId, profile, navigate, supabase]);

  const allowedTypes = React.useMemo(() => {
    if (!profile) return [];
    if (profile.is_bureau_manager) return [{value: "trainee", label: "TGF / Trainee"}, {
      value: "deputy_i",
      label: "Deputy Sheriff I."
    }, {value: "division_exam", label: "Osztály Vizsga"}, {value: "other", label: "Egyéb"}];
    return [{value: "division_exam", label: "Osztály Vizsga"}, {value: "other", label: "Egyéb"}];
  }, [profile]);

  const allowedDivisions = React.useMemo(() => {
    if (!profile) return [];
    if (profile.is_bureau_manager) {
      const all = [{value: "SEB", label: "SEB"}, {value: "MCB", label: "MCB"}];
      const quals = ['SAHP', 'AB', 'MU', 'GW', 'FAB', 'SIB', 'TSB'].map(q => ({value: q, label: q}));
      return [...all, ...quals];
    }
    const options = [];
    if (profile.is_bureau_commander) options.push({value: profile.division, label: profile.division});
    if (profile.commanded_divisions) profile.commanded_divisions.forEach(div => {
      if (!options.find(o => o.value === div)) options.push({value: div, label: div});
    });
    return options;
  }, [profile]);

  useEffect(() => {
    if (!isLoading && allowedDivisions.length > 0 && !examId) {
      const currentValid = allowedDivisions.find(o => o.value === examData.division);
      if (!currentValid) setExamData(prev => ({...prev, division: allowedDivisions[0].value}));
    }
  }, [allowedDivisions, isLoading, examId]);

  const addPage = () => {
    const maxPage = questions.reduce((max, q) => Math.max(max, q.page_number || 1), 0);
    const newPage = maxPage + 1;
    addQuestionToPage(newPage);
    setCurrentEditorPage(newPage);
    toast.success("Oldal létrehozva.");
  };

  const addQuestionToPage = useCallback((pageNum: number) => {
    setQuestions(prev => [...prev, {
      id: tempId(),
      question_text: "",
      question_type: "text",
      points: 1,
      order_index: prev.length,
      is_required: true,
      page_number: pageNum,
      exam_options: []
    }]);
  }, []);

  const removeQuestion = useCallback((id: string) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
  }, []);

  const confirmDeletePage = () => {
    if (pageToDelete === null) return;
    setQuestions(prev => {
      const remaining = prev.filter(q => q.page_number !== pageToDelete);
      return remaining.map(q => {
        if (q.page_number > pageToDelete) return {...q, page_number: q.page_number - 1};
        return q;
      });
    });
    if (pageToDelete <= currentEditorPage) setCurrentEditorPage(p => Math.max(1, p - 1));
    setPageToDelete(null);
    toast.success("Oldal törölve.");
  };

  const updateQuestion = useCallback((id: string, field: string, value: any) => {
    setQuestions(prev => prev.map(q => q.id === id ? {...q, [field]: value} : q));
  }, []);

  const addOption = useCallback((questionId: string) => {
    setQuestions(prev => prev.map(q => {
      if (q.id !== questionId) return q;
      return {...q, exam_options: [...q.exam_options, {id: tempId(), option_text: "", is_correct: false}]};
    }));
  }, []);

  const removeOption = useCallback((questionId: string, oIndex: number) => {
    setQuestions(prev => prev.map(q => {
      if (q.id !== questionId) return q;
      const newOpts = [...q.exam_options];
      newOpts.splice(oIndex, 1);
      return {...q, exam_options: newOpts};
    }));
  }, []);

  const updateOption = useCallback((questionId: string, oIndex: number, field: string, value: any) => {
    setQuestions(prev => prev.map(q => {
      if (q.id !== questionId) return q;
      const newOpts = q.exam_options.map((opt: any) => ({...opt}));
      if (field === 'set_correct_unique') newOpts.forEach((opt: any, idx: number) => opt.is_correct = (idx === oIndex));
      else newOpts[oIndex] = {...newOpts[oIndex], [field]: value};
      return {...q, exam_options: newOpts};
    }));
  }, []);

  // --- PONT ÉS SZÁZALÉK INPUT KEZELÉS (Validáció) ---
  const handleNumberInput = (
    value: string,
    field: 'time_limit_minutes' | 'passing_percentage',
    min: number,
    max: number
  ) => {
    let num = parseInt(value);
    if (isNaN(num)) return; // Vagy set 0, ízlés szerint

    // Itt csak a state-et állítjuk, a clamp (korlátozás) blur-nál történik
    // De a gépelést engedjük
    setExamData(prev => ({...prev, [field]: num}));
  };

  const handleNumberBlur = (
    field: 'time_limit_minutes' | 'passing_percentage',
    min: number,
    max: number
  ) => {
    let num = examData[field] || min;
    if (num < min) num = min;
    if (num > max) num = max;
    setExamData(prev => ({...prev, [field]: num}));
  };

  const handleSave = async () => {
    if (!examData.title) return toast.error("Cím kötelező!");
    if (questions.length === 0) return toast.error("Nincs kérdés!");

    for (const q of questions) {
      if (!q.question_text?.trim()) {
        toast.error(`${q.page_number}. oldalon hiányos kérdés!`);
        setActiveTab("questions");
        setCurrentEditorPage(q.page_number);
        return;
      }
      if (q.question_type !== 'text') {
        if (q.exam_options.length < 2) {
          toast.error("Kevés válaszopció!");
          setActiveTab("questions");
          setCurrentEditorPage(q.page_number);
          return;
        }
        if (q.exam_options.some((o: any) => !o.option_text?.trim())) {
          toast.error("Üres válaszopció!");
          setActiveTab("questions");
          setCurrentEditorPage(q.page_number);
          return;
        }
        if (!q.exam_options.some((o: any) => o.is_correct)) {
          toast.error("Nincs helyes válasz!");
          setActiveTab("questions");
          setCurrentEditorPage(q.page_number);
          return;
        }
      }
    }

    setIsLoading(true);
    try {
      const {id: _id, created_at: _c, exam_questions: _eq, ...cleanExamData} = examData as any;
      const examPayload = {...cleanExamData, created_by: profile?.id};
      let savedExamId = examId;

      if (!examId) {
        const {data, error} = await supabase.from('exams').insert(examPayload).select().single();
        if (error) throw error;
        savedExamId = data.id;
      } else {
        const {error} = await supabase.from('exams').update(examPayload).eq('id', examId);
        if (error) throw error;
      }

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const qPayload = {
          exam_id: savedExamId,
          question_text: q.question_text,
          question_type: q.question_type,
          points: q.points,
          order_index: i,
          is_required: q.is_required,
          page_number: q.page_number || 1
        };
        let qId = q.id;

        if (q.id.startsWith('temp-')) {
          const {data: newQ, error} = await supabase.from('exam_questions').insert(qPayload).select().single();
          if (error) throw error;
          qId = newQ.id;
        } else await supabase.from('exam_questions').update(qPayload).eq('id', qId);

        if (q.question_type !== 'text' && q.exam_options) {
          for (const opt of q.exam_options) {
            const oPayload = {question_id: qId, option_text: opt.option_text, is_correct: opt.is_correct};
            if (opt.id.startsWith('temp-')) await supabase.from('exam_options').insert(oPayload);
            else await supabase.from('exam_options').update(oPayload).eq('id', opt.id);
          }
        }
      }
      toast.success("Vizsga mentve!");
      navigate('/exams');
    } catch (error: any) {
      console.error(error);
      toast.error("Hiba: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteExam = async () => {
    if (!examId) return;
    try {
      const {error} = await supabase.rpc('delete_full_exam', {_exam_id: examId});
      if (error) throw error;
      toast.success("Törölve.");
      navigate('/exams');
    } catch (e: any) {
      toast.error("Hiba: " + e.message);
    }
  };

  if (!profile) return null;

  const pageNumbers = [...new Set(questions.map(q => q.page_number || 1))].sort((a, b) => a - b);
  if (pageNumbers.length === 0) pageNumbers.push(1);
  const currentQuestions = questions.filter(q => (q.page_number || 1) === currentEditorPage);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent className="bg-slate-900 border-slate-800 text-white">
          <AlertDialogHeader><AlertDialogTitle className="text-red-500">Vizsga
            Törlése</AlertDialogTitle><AlertDialogDescription className="text-slate-300">Végleges törlés. Minden adat
            elvész.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel
            className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-white">Mégsem</AlertDialogCancel><AlertDialogAction
            onClick={handleDeleteExam}
            className="bg-red-600 hover:bg-red-700 border-none">Törlés</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pageToDelete !== null} onOpenChange={(open) => !open && setPageToDelete(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-800 text-white">
          <AlertDialogHeader><AlertDialogTitle>Oldal Törlése</AlertDialogTitle><AlertDialogDescription>Az oldal összes
            kérdése törlődik.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel
            className="bg-slate-800 border-slate-700">Mégsem</AlertDialogCancel><AlertDialogAction
            onClick={confirmDeletePage} className="bg-red-600">Törlés</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- HEADER --- */}
      <div
        className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[#0b1221] border border-slate-800 p-6 rounded-xl shadow-2xl">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/exams')}
                  className="border-slate-700 text-slate-400 hover:text-white bg-slate-900"><ArrowLeft
            className="w-5 h-5"/></Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge
                className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-[10px] uppercase tracking-wider">CONFIGURATION</Badge>
              <span className="text-[10px] text-slate-500 font-mono uppercase">MODE: EDITOR</span>
            </div>
            <h1
              className="text-2xl font-black text-white tracking-tight uppercase">{examId ? "VIZSGA SZERKESZTÉSE" : "ÚJ VIZSGA LÉTREHOZÁSA"}</h1>
          </div>
        </div>
        <Button onClick={handleSave} disabled={isLoading}
                className="bg-green-600 hover:bg-green-500 text-white font-bold uppercase tracking-wider shadow-lg shadow-green-900/20 px-8 h-12">
          {isLoading ? "MENTÉS..." : "VIZSGA MENTÉSE"} <Save className="ml-2 w-5 h-5"/>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start h-14 bg-[#0b1221] border border-slate-800 rounded-xl p-1 mb-6 gap-2">
          <TabsTrigger value="settings"
                       className="h-full px-6 text-xs font-bold uppercase tracking-wider data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-500"><Settings
            className="w-4 h-4 mr-2"/> BEÁLLÍTÁSOK</TabsTrigger>
          <TabsTrigger value="questions"
                       className="h-full px-6 text-xs font-bold uppercase tracking-wider data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-500">
            KÉRDÉSEK <Badge className="ml-2 bg-yellow-500 text-black hover:bg-yellow-400">{questions.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <Card className="bg-slate-900 border-slate-800"><CardContent className="p-6 space-y-6">
            <div className="space-y-2"><Label>Cím</Label><Input value={examData.title} onChange={e => setExamData({
              ...examData,
              title: e.target.value
            })} className={cn(EDITOR_INPUT, "h-12 text-lg font-bold text-white")}
                                                                placeholder="PL. ALAPKIKÉPZÉS VIZSGA"/></div>
            <div className="space-y-2"><Label>Leírás</Label><Textarea value={examData.description || ""}
                                                                      onChange={e => setExamData({
                                                                        ...examData,
                                                                        description: e.target.value
                                                                      })}
                                                                      className={cn(EDITOR_INPUT, "min-h-[150px] resize-none")}
                                                                      placeholder="Rövid leírás a vizsgázók számára..."/>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2"><Label>Típus</Label><Select value={examData.type}
                                                                     onValueChange={(val: any) => setExamData({
                                                                       ...examData,
                                                                       type: val
                                                                     })}><SelectTrigger
                className={EDITOR_INPUT}><SelectValue/></SelectTrigger><SelectContent
                className="bg-slate-900 border-slate-800 text-white">{allowedTypes.map(t => <SelectItem key={t.value}
                                                                                                        value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-2"><Label>Osztály</Label><Select value={examData.division || "none"}
                                                                       onValueChange={(val: any) => setExamData({
                                                                         ...examData,
                                                                         division: val === 'none' ? null : val
                                                                       })}><SelectTrigger
                className={EDITOR_INPUT}><SelectValue placeholder="Válassz..."/></SelectTrigger><SelectContent
                className="bg-slate-900 border-slate-800 text-white">{allowedDivisions.map(d => <SelectItem
                key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Rang</Label><Select value={examData.required_rank || "none"}
                                                                    onValueChange={(val) => setExamData({
                                                                      ...examData,
                                                                      required_rank: val === "none" ? null : val
                                                                    })}><SelectTrigger
                className={EDITOR_INPUT}><SelectValue placeholder="Nincs"/></SelectTrigger><SelectContent
                className="bg-slate-900 border-slate-800 text-white"><SelectItem
                value="none">Nincs</SelectItem>{FACTION_RANKS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent></Select></div>

              <div className="col-span-2 border-t border-slate-800 pt-4 grid grid-cols-2 gap-4 mt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500 uppercase font-bold tracking-wider">Időkorlát (Perc)</Label>
                  <Input
                    type="number" min={1} max={60}
                    value={examData.time_limit_minutes}
                    onChange={e => handleNumberInput(e.target.value, 'time_limit_minutes', 1, 60)}
                    onBlur={() => handleNumberBlur('time_limit_minutes', 1, 60)}
                    onKeyDown={preventInvalidNumberInput}
                    className={EDITOR_INPUT}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    className="text-xs text-slate-500 uppercase font-bold tracking-wider flex items-center gap-2"><Percent
                    className="w-3 h-3"/> Sikeres határ (%)</Label>
                  <Input
                    type="number" min={1} max={100}
                    value={examData.passing_percentage}
                    onChange={e => handleNumberInput(e.target.value, 'passing_percentage', 1, 100)}
                    onBlur={() => handleNumberBlur('passing_percentage', 1, 100)}
                    onKeyDown={preventInvalidNumberInput}
                    className={EDITOR_INPUT}
                  />
                </div>
              </div>
            </div>

            {/* TOGGLE BUTTONS (SWITCH HELYETT) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-slate-800">
              <SettingToggle
                title="Publikus"
                description="Vendég hozzáférés engedélyezése"
                active={examData.is_public}
                onChange={(v: boolean) => setExamData({...examData, is_public: v})}
                icon={Globe}
                activeColorClass="border-green-500/50 text-green-200"
              />
              <SettingToggle
                title="Megosztás"
                description="Link másolásának engedélyezése"
                active={examData.allow_sharing}
                onChange={(v: boolean) => setExamData({...examData, allow_sharing: v})}
                icon={Share2}
                activeColorClass="border-blue-500/50 text-blue-200"
              />
              <SettingToggle
                title="Aktív"
                description="A vizsga kitölthető"
                active={examData.is_active}
                onChange={(v: boolean) => setExamData({...examData, is_active: v})}
                icon={CheckCircle2}
                activeColorClass="border-yellow-500/50 text-yellow-200"
              />
            </div>

            {examId && canDeleteExam(profile, examData as any) && (
              <div className="pt-6 border-t border-red-900/30 mt-6 flex justify-end">
                <Button variant="destructive" onClick={() => setIsDeleteAlertOpen(true)}
                        className="bg-red-950/30 hover:bg-red-900/50 text-red-500 border border-red-900/50 uppercase font-bold text-xs tracking-wider">
                  <Trash2 className="w-4 h-4 mr-2"/> Vizsga Törlése
                </Button>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="questions" className="mt-0 space-y-6">
          {/* ... (Kérdések tab tartalma változatlan maradt, csak a QuestionCard lett frissítve fent) ... */}
          {/* ISMÉTLÉS ELKERÜLÉSE VÉGETT ITT A STANDARD KÓD JÖN, AMIT FENT MÁR DEFINIÁLTUNK */}
          {submissionCount > 0 && (
            <div
              className="bg-orange-950/20 border border-orange-900/50 p-4 rounded-lg flex items-start gap-4 animate-in slide-in-from-top-2">
              <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5"/>
              <div>
                <h4 className="text-orange-500 font-bold text-sm uppercase tracking-wider">Figyelem: Aktív kitöltések
                  ({submissionCount} db)</h4>
                <p className="text-slate-400 text-xs mt-1 leading-relaxed">A kérdések módosítása befolyásolhatja a
                  meglévő eredményeket.</p>
              </div>
            </div>
          )}

          {/* Pagination Bar */}
          <div
            className="flex items-center justify-between bg-[#0b1221] p-2 rounded-xl border border-slate-800 shadow-lg sticky top-4 z-20">
            <Button variant="ghost" disabled={currentEditorPage === 1} onClick={() => setCurrentEditorPage(p => p - 1)}
                    className="text-slate-400 hover:text-white hover:bg-slate-800"><ChevronLeft
              className="w-4 h-4 mr-2"/> ELŐZŐ</Button>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4">
              {pageNumbers.map(pageNum => (
                <button key={pageNum} onClick={() => setCurrentEditorPage(pageNum)}
                        className={cn("w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold transition-all border", currentEditorPage === pageNum ? "bg-yellow-500 text-black border-yellow-600 shadow-lg shadow-yellow-500/20" : "bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-600 hover:text-slate-300")}>
                  {pageNum}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" disabled={pageNumbers.length === 1}
                      onClick={() => setPageToDelete(currentEditorPage)}
                      className="h-9 w-9 text-red-500 hover:bg-red-950/20"><FileX className="w-4 h-4"/></Button>
              <div className="w-px h-6 bg-slate-800 mx-1 self-center"></div>
              <Button size="sm" onClick={addPage}
                      className="h-9 bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase text-xs tracking-wider"><FilePlus
                className="w-4 h-4 mr-2"/> ÚJ OLDAL</Button>
              <Button variant="ghost" disabled={currentEditorPage === pageNumbers.length}
                      onClick={() => setCurrentEditorPage(p => p + 1)}
                      className="ml-2 text-slate-400 hover:text-white hover:bg-slate-800">KÖVETKEZŐ <ChevronRight
                className="w-4 h-4 ml-2"/></Button>
            </div>
          </div>

          <div className="space-y-6 min-h-[400px]">
            {currentQuestions.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/20 text-slate-500">
                <Layers className="w-16 h-16 mb-4 opacity-20"/>
                <p className="text-sm font-mono uppercase tracking-widest mb-6">EZ AZ OLDAL MÉG ÜRES</p>
                <Button onClick={() => addQuestionToPage(currentEditorPage)}
                        className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold uppercase tracking-wider"><Plus
                  className="w-4 h-4 mr-2"/> ELSŐ KÉRDÉS HOZZÁADÁSA</Button>
              </div>
            ) : (
              <>
                {currentQuestions.map((q) => (
                  <QuestionCard key={q.id} q={q} onUpdate={updateQuestion} onRemove={() => removeQuestion(q.id)}
                                onAddOption={addOption} onRemoveOption={removeOption} onUpdateOption={updateOption}/>
                ))}
                <Button onClick={() => addQuestionToPage(currentEditorPage)}
                        className="w-full border-dashed border-2 border-slate-800 bg-slate-900/20 hover:bg-slate-900 hover:border-slate-600 text-slate-500 hover:text-white h-20 uppercase font-bold tracking-widest transition-all">
                  <Plus className="w-5 h-5 mr-2"/> ÚJ KÉRDÉS HOZZÁADÁSA A(Z) {currentEditorPage}. OLDALHOZ
                </Button>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}