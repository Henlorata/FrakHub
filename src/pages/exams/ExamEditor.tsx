import React, {useState, useEffect, useCallback, memo} from "react";
import {useNavigate, useParams} from "react-router-dom";
import {useAuth} from "@/context/AuthContext";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Card, CardContent, CardHeader} from "@/components/ui/card";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Switch} from "@/components/ui/switch";
import {Tabs, TabsList, TabsTrigger, TabsContent} from "@/components/ui/tabs";
import {
  Trash2,
  Plus,
  Save,
  ArrowLeft,
  GripVertical,
  CheckCircle2,
  AlertCircle,
  Type,
  List,
  CheckSquare,
  FilePlus,
  FileX,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import {toast} from "sonner";
import {FACTION_RANKS} from "@/types/supabase";
import type {Exam} from "@/types/exams";
import {canManageExam, canCreateAnyExam} from "@/lib/utils";
import {Badge} from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";

const tempId = () => `temp-${Math.random().toString(36).substr(2, 9)}`;

const arePropsEqual = (prevProps: any, nextProps: any) => {
  return (
    prevProps.q.question_text === nextProps.q.question_text &&
    prevProps.q.question_type === nextProps.q.question_type &&
    prevProps.q.points === nextProps.q.points &&
    prevProps.q.is_required === nextProps.q.is_required &&
    prevProps.q.page_number === nextProps.q.page_number &&
    prevProps.q.exam_options === nextProps.q.exam_options
  );
};


const QuestionCard = memo(({q, index, onUpdate, onRemove, onAddOption, onRemoveOption, onUpdateOption}: any) => {
  // Lokális statek az inputokhoz, hogy ne akadjon a gépelés
  const [localText, setLocalText] = useState(q.question_text);
  const [localPoints, setLocalPoints] = useState(q.points);

  // Ha kívülről változik (pl. betöltéskor), frissítjük a lokálist
  useEffect(() => {
    setLocalText(q.question_text);
  }, [q.question_text]);

  useEffect(() => {
    setLocalPoints(q.points);
  }, [q.points]);

  const handleTextBlur = () => {
    if (localText !== q.question_text) {
      onUpdate(q.id, 'question_text', localText);
    }
  };

  const handlePointsBlur = () => {
    const p = parseInt(localPoints) || 0;
    if (p !== q.points) {
      onUpdate(q.id, 'points', p);
    }
  };

  const getTypeIcon = () => {
    switch (q.question_type) {
      case 'single_choice':
        return <CheckCircle2 className="w-4 h-4 mr-1"/>;
      case 'multiple_choice':
        return <CheckSquare className="w-4 h-4 mr-1"/>;
      default:
        return <Type className="w-4 h-4 mr-1"/>;
    }
  };

  return (
    <Card
      className="bg-slate-950 border-slate-800 relative group transition-all hover:border-slate-700 hover:shadow-md mb-4">
      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <Button variant="ghost" size="icon" className="text-slate-500 hover:text-red-500 hover:bg-red-950/20"
                onClick={() => onRemove(q.id)}>
          <Trash2 className="w-4 h-4"/>
        </Button>
      </div>
      <CardHeader
        className="pb-2 border-b border-slate-800/50 bg-slate-900/30 px-6 pt-4 flex flex-row items-center gap-3">
        <div className="mt-1 cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400"><GripVertical
          className="w-5 h-5"/></div>
        <div className="flex items-center gap-2">
          <Badge className="bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center">{getTypeIcon()}</Badge>
          {q.is_required &&
            <Badge className="bg-red-900/30 text-red-400 border-red-900/50 border hover:bg-red-900/40">Kötelező</Badge>}
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1 space-y-2">
            <Label className="text-slate-300">Kérdés Szövege <span className="text-red-500">*</span></Label>
            <Textarea
              value={localText}
              onChange={e => setLocalText(e.target.value)}
              onBlur={handleTextBlur}
              className={`bg-slate-900 border-slate-700 min-h-[80px] ...`}
              placeholder="Írd be a kérdést..."
            />
          </div>
          <div className="flex flex-col gap-4 min-w-[200px]">
            <div className="space-y-2">
              <Label className="text-slate-300">Típus</Label>
              <Select value={q.question_type} onValueChange={val => onUpdate(q.id, 'question_type', val)}>
                <SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue/></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  <SelectItem value="text">Szöveges kifejtős</SelectItem>
                  <SelectItem value="single_choice">Egy választható (Radio)</SelectItem>
                  <SelectItem value="multiple_choice">Több választható (Checkbox)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-4">
              <div className="space-y-2 flex-1">
                <Label className="text-slate-300">Pontérték</Label>
                <Input
                  type="number"
                  min={1}
                  value={localPoints}
                  onChange={e => setLocalPoints(e.target.value)}
                  onBlur={handlePointsBlur}
                  className="bg-slate-900 border-slate-700"
                />
              </div>
              <div className="space-y-2 flex flex-col justify-end pb-2">
                <div className="flex items-center gap-2">
                  <Switch checked={q.is_required} onCheckedChange={(checked) => onUpdate(q.id, 'is_required', checked)}
                          id={`req-${q.id}`}/>
                  <Label htmlFor={`req-${q.id}`}
                         className="cursor-pointer text-slate-400 text-xs font-bold uppercase select-none">Kötelező</Label>
                </div>
              </div>
            </div>
          </div>
        </div>
        {q.question_type !== 'text' && (
          <div
            className="pl-0 md:pl-4 md:border-l-2 md:border-slate-800 space-y-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs text-slate-500 uppercase font-bold flex items-center gap-2"><List
                className="w-3 h-3"/> Válaszlehetőségek (Min. 2)</Label>
              {q.exam_options.length < 2 && <span
                className="text-red-500 text-xs font-bold flex items-center bg-red-950/30 px-2 py-1 rounded"><AlertCircle
                className="w-3 h-3 mr-1"/> Kell még {2 - q.exam_options.length} opció!</span>}
            </div>
            <div className="space-y-3">
              {q.exam_options.map((opt: any, oIndex: number) => (
                <div key={opt.id} className="flex items-center gap-3 group/opt">
                  <div className="relative">
                    <button
                      className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all ${opt.is_correct ? 'bg-green-600 border-green-500 text-white shadow-[0_0_10px_rgba(22,163,74,0.3)]' : 'bg-slate-950 border-slate-700 text-slate-600 hover:border-slate-500 hover:text-slate-400'}`}
                      onClick={() => {
                        if (q.question_type === 'single_choice') {
                          onUpdateOption(q.id, oIndex, 'set_correct_unique', true);
                        } else {
                          onUpdateOption(q.id, oIndex, 'is_correct', !opt.is_correct);
                        }
                      }} title={opt.is_correct ? "Ez a helyes válasz" : "Jelöld meg helyesként"}><CheckCircle2
                      className="w-5 h-5"/></button>
                  </div>
                  <Input value={opt.option_text}
                         onChange={e => onUpdateOption(q.id, oIndex, 'option_text', e.target.value)}
                         className={`h-10 bg-slate-900 border-slate-700 flex-1 transition-all focus-visible:ring-yellow-500/50 ${!opt.option_text ? 'border-red-900/30 bg-red-950/10' : ''}`}
                         placeholder={`Válaszopció ${oIndex + 1}...`}/>
                  <Button variant="ghost" size="icon"
                          className="h-8 w-8 text-slate-600 hover:text-red-500 hover:bg-red-950/20 opacity-0 group-hover/opt:opacity-100 transition-opacity"
                          onClick={() => onRemoveOption(q.id, oIndex)}><Trash2 className="w-4 h-4"/></Button>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center pt-2">
              <Button size="sm" variant="outline"
                      className="border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 hover:border-slate-600"
                      onClick={() => onAddOption(q.id)}><Plus className="w-3 h-3 mr-1"/> Opció hozzáadása</Button>
              {q.exam_options.length >= 2 && !q.exam_options.some((o: any) => o.is_correct) &&
                <p className="text-red-400 text-xs font-bold animate-pulse flex items-center"><AlertCircle
                  className="w-3 h-3 mr-1"/> Legalább egy helyes választ jelölj meg!</p>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}, arePropsEqual);

export function ExamEditor() {
  const {supabase, profile} = useAuth();
  const navigate = useNavigate();
  const {examId} = useParams();

  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("settings");
  const [pageToDelete, setPageToDelete] = useState<number | null>(null);
  // ÚJ STATE: Jelenlegi oldal szerkesztése
  const [currentEditorPage, setCurrentEditorPage] = useState(1);

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
  });
  const [questions, setQuestions] = useState<any[]>([]);

  // ... (useEffectek és betöltés marad ugyanaz, mint az előző verzióban) ...
  useEffect(() => {
    if (!profile) return;
    if (!examId && !canCreateAnyExam(profile)) {
      toast.error("Nincs jogosultságod vizsgát létrehozni.");
      navigate('/exams');
    }
  }, [profile, examId, navigate]);
  useEffect(() => {
    if (examId && profile) {
      const fetchExam = async () => {
        setIsLoading(true);
        const {
          data,
          error
        } = await supabase.from('exams').select(`*, exam_questions(*, exam_options(*))`).eq('id', examId).single();
        if (error) {
          toast.error("Hiba a vizsga betöltésekor");
          navigate('/exams');
        } else {
          if (!canManageExam(profile, data as any)) {
            toast.error("Nincs jogosultságod ezt a vizsgát szerkeszteni.");
            navigate('/exams');
            return;
          }
          const {exam_questions, ...cleanData} = data;
          setExamData(cleanData);
          const sortedQuestions = (data.exam_questions || []).sort((a: any, b: any) => a.order_index - b.order_index);
          setQuestions(sortedQuestions.map((q: any) => ({
            ...q,
            is_required: q.is_required ?? true,
            page_number: q.page_number ?? 1
          })));
        }
        setIsLoading(false);
      };
      fetchExam();
    }
  }, [examId, profile, navigate, supabase]);

  // ... (Szűrési logika, Handlerek ugyanazok - addQuestion, updateQuestion, removeQuestion, option handlers, stb.) ...
  // ... (Ezeket másold át az előző válaszomból, csak a return rész változik) ...

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
      const quals = ['SAHP', 'AB', 'MU', 'GW', 'FAB', 'SIB', 'TB'].map(q => ({value: q, label: q}));
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
      if (!currentValid) {
        setExamData(prev => ({...prev, division: allowedDivisions[0].value}));
      }
    }
  }, [allowedDivisions, isLoading, examId]);

  const addPage = () => {
    const maxPage = questions.reduce((max, q) => Math.max(max, q.page_number || 1), 0);
    const newPage = maxPage + 1;
    addQuestionToPage(newPage);
    setCurrentEditorPage(newPage); // Odaugrunk az új oldalra
    toast.success(`${newPage}. oldal létrehozva!`);
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
      return remaining;
    });
    setPageToDelete(null);
    toast.success("Oldal törölve.");
    setCurrentEditorPage(p => Math.max(1, p - 1));
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
      if (field === 'set_correct_unique') {
        newOpts.forEach((opt: any, idx: number) => opt.is_correct = (idx === oIndex));
      } else {
        newOpts[oIndex] = {...newOpts[oIndex], [field]: value};
      }
      return {...q, exam_options: newOpts};
    }));
  }, []);
  const handleTimeBlur = () => {
    let val = examData.time_limit_minutes || 60;
    if (val < 1) val = 1;
    if (val > 60) val = 60;
    setExamData(prev => ({...prev, time_limit_minutes: val}));
  };
  const handleSave = async () => {
    if (!examData.title) {
      toast.error("Cím kötelező!");
      return;
    }
    if (questions.length === 0) {
      toast.error("Nincs kérdés!");
      return;
    }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text?.trim()) {
        toast.error(`${q.page_number}. oldalon van üres kérdés szöveg!`);
        setActiveTab("questions");
        setCurrentEditorPage(q.page_number);
        return;
      }
      if (q.question_type !== 'text') {
        if (q.exam_options.length < 2) {
          toast.error("Kevés válaszopció egy kérdésnél!");
          setActiveTab("questions");
          setCurrentEditorPage(q.page_number);
          return;
        }
        if (q.exam_options.some((o: any) => !o.option_text?.trim())) {
          toast.error("Üres válaszopció valahol!");
          setActiveTab("questions");
          setCurrentEditorPage(q.page_number);
          return;
        }
        if (!q.exam_options.some((o: any) => o.is_correct)) {
          toast.error("Nincs helyes válasz jelölve!");
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
        } else {
          await supabase.from('exam_questions').update(qPayload).eq('id', qId);
        }
        if (q.question_type !== 'text' && q.exam_options) {
          for (const opt of q.exam_options) {
            const oPayload = {question_id: qId, option_text: opt.option_text, is_correct: opt.is_correct};
            if (opt.id.startsWith('temp-')) await supabase.from('exam_options').insert(oPayload); else await supabase.from('exam_options').update(oPayload).eq('id', opt.id);
          }
        }
      }
      toast.success("Mentve!");
      navigate('/exams');
    } catch (error: any) {
      console.error(error);
      toast.error("Hiba: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!profile) return null;

  // OLDALSZÁMOK KISZÁMÍTÁSA
  const pageNumbers = [...new Set(questions.map(q => q.page_number || 1))].sort((a, b) => a - b);
  if (pageNumbers.length === 0) pageNumbers.push(1);
  // CSAK AZ AKTUÁLIS OLDAL KÉRDÉSEI
  const currentQuestions = questions.filter(q => (q.page_number || 1) === currentEditorPage);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <AlertDialog open={pageToDelete !== null} onOpenChange={(open) => !open && setPageToDelete(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-800 text-white">
          <AlertDialogHeader><AlertDialogTitle>Oldal törlése</AlertDialogTitle><AlertDialogDescription>Minden kérdés
            törlődik erről az oldalról.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel
            className="bg-slate-800 border-slate-700">Mégsem</AlertDialogCancel><AlertDialogAction
            onClick={confirmDeletePage} className="bg-red-600">Törlés</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/exams')}><ArrowLeft
            className="w-5 h-5"/></Button>
          <div><h1 className="text-3xl font-bold text-white">{examId ? "Szerkesztés" : "Új Vizsga"}</h1><p
            className="text-slate-400">Kérdések és beállítások kezelése.</p></div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={isLoading}
                  className="bg-green-600 hover:bg-green-700 font-bold shadow-lg">
            {isLoading ? 'Mentés...' : 'Vizsga Mentése'} <Save className="ml-2 w-4 h-4"/>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-slate-900 border border-slate-800 mb-6">
          <TabsTrigger value="settings"
                       className="data-[state=active]:bg-yellow-600 data-[state=active]:text-black font-bold">Beállítások</TabsTrigger>
          <TabsTrigger value="questions"
                       className="data-[state=active]:bg-yellow-600 data-[state=active]:text-black font-bold">
            Kérdések <Badge className="ml-2 bg-slate-800 text-white">{questions.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          {/* --- BEÁLLÍTÁSOK FORM (Ugyanaz mint eddig, csak rövidebben írom, de másold be a teljeset) --- */}
          <Card className="bg-slate-900 border-slate-800"><CardContent className="p-6 space-y-6">
            <div className="space-y-2"><Label>Cím</Label><Input value={examData.title} onChange={e => setExamData({
              ...examData,
              title: e.target.value
            })} className="bg-slate-950 border-slate-700"/></div>
            <div className="space-y-2"><Label>Leírás</Label><Textarea value={examData.description || ""}
                                                                      onChange={e => setExamData({
                                                                        ...examData,
                                                                        description: e.target.value
                                                                      })}
                                                                      className="bg-slate-950 border-slate-700 h-32"/>
            </div>
            {/* ... Többi mező (Típus, Osztály, Rang, Idő) ... */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2"><Label>Típus</Label><Select value={examData.type}
                                                                     onValueChange={(val: any) => setExamData({
                                                                       ...examData,
                                                                       type: val
                                                                     })}><SelectTrigger
                className="bg-slate-950 border-slate-700"><SelectValue/></SelectTrigger><SelectContent
                className="bg-slate-900 border-slate-800">{allowedTypes.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Osztály</Label><Select value={examData.division || "none"}
                                                                       onValueChange={(val: any) => setExamData({
                                                                         ...examData,
                                                                         division: val === 'none' ? null : val
                                                                       })}><SelectTrigger
                className="bg-slate-950 border-slate-700"><SelectValue
                placeholder="Válassz..."/></SelectTrigger><SelectContent
                className="bg-slate-900 border-slate-800">{allowedDivisions.map(d => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>))}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Rang</Label><Select value={examData.required_rank || "none"}
                                                                    onValueChange={(val) => setExamData({
                                                                      ...examData,
                                                                      required_rank: val === "none" ? null : val
                                                                    })}><SelectTrigger
                className="bg-slate-950 border-slate-700"><SelectValue
                placeholder="Nincs"/></SelectTrigger><SelectContent
                className="bg-slate-900 border-slate-800"><SelectItem
                value="none">Nincs</SelectItem>{FACTION_RANKS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent></Select></div>
              <div className="space-y-2"><Label>Idő (perc)</Label><Input type="number" min={1} max={60}
                                                                         value={examData.time_limit_minutes}
                                                                         onChange={e => setExamData({
                                                                           ...examData,
                                                                           time_limit_minutes: parseInt(e.target.value)
                                                                         })} onBlur={handleTimeBlur}
                                                                         className="bg-slate-950 border-slate-700"/>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-800">
              <div className="flex justify-between p-4 bg-slate-950 rounded-lg border border-slate-800">
                <div className="space-y-0.5"><Label>Publikus</Label><p
                  className="text-xs text-slate-400">Külsősöknek.</p></div>
                <Switch checked={examData.is_public} onCheckedChange={c => setExamData({...examData, is_public: c})}
                        disabled={!profile.is_bureau_manager}/></div>
              <div className="flex justify-between p-4 bg-slate-950 rounded-lg border border-slate-800">
                <div className="space-y-0.5"><Label>Aktív</Label><p className="text-xs text-slate-400">Kitölthető.</p>
                </div>
                <Switch checked={examData.is_active} onCheckedChange={c => setExamData({...examData, is_active: c})}/>
              </div>
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* --- KÉRDÉSEK LAPOZÓVAL --- */}
        <TabsContent value="questions" className="space-y-6">
          {/* OLDAL VÁLASZTÓ SÁV */}
          <div className="flex items-center justify-between bg-slate-900 p-2 rounded-lg border border-slate-800">
            <Button variant="ghost" disabled={currentEditorPage === 1} onClick={() => setCurrentEditorPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4 mr-2"/> Előző
            </Button>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {pageNumbers.map(pageNum => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentEditorPage(pageNum)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${currentEditorPage === pageNum ? 'bg-yellow-600 text-black' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                  {pageNum}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" disabled={pageNumbers.length === 1}
                      onClick={() => setPageToDelete(currentEditorPage)} className="h-9">
                <FileX className="w-4 h-4"/>
              </Button>
              <Button size="sm" onClick={addPage}
                      className="h-9 bg-slate-800 hover:bg-slate-700 border border-slate-700">
                <FilePlus className="w-4 h-4 mr-2"/> Új Oldal
              </Button>
              <Button variant="ghost" disabled={currentEditorPage === pageNumbers.length}
                      onClick={() => setCurrentEditorPage(p => p + 1)}>
                Következő <ChevronRight className="w-4 h-4 ml-2"/>
              </Button>
            </div>
          </div>

          {/* AKTUÁLIS OLDAL KÉRDÉSEI */}
          <div className="space-y-6 min-h-[400px]">
            {currentQuestions.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-xl bg-slate-950/50">
                <p className="text-slate-500 mb-4">Ezen az oldalon még nincs kérdés.</p>
                <Button onClick={() => addQuestionToPage(currentEditorPage)}
                        className="bg-yellow-600 hover:bg-yellow-700 text-black">
                  <Plus className="w-4 h-4 mr-2"/> Kérdés hozzáadása
                </Button>
              </div>
            ) : (
              <>
                {currentQuestions.map((q) => (
                  <QuestionCard
                    key={q.id}
                    q={q}
                    onUpdate={updateQuestion}
                    onRemove={() => removeQuestion(q.id)}
                    onAddOption={addOption}
                    onRemoveOption={removeOption}
                    onUpdateOption={updateOption}
                  />
                ))}
                <Button onClick={() => addQuestionToPage(currentEditorPage)}
                        className="w-full border-dashed border-2 border-slate-700 bg-transparent hover:bg-slate-900 text-slate-400 hover:text-white h-16">
                  <Plus className="w-5 h-5 mr-2"/> Kérdés hozzáadása a(z) {currentEditorPage}. oldalhoz
                </Button>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}