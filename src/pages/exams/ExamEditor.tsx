import {useCallback, useEffect, useMemo, useState, type CSSProperties} from "react";
import {Link, useNavigate, useParams, useSearchParams} from "react-router";
import {toast} from "sonner";
import {
  AlertTriangle, ArrowLeft, BarChart3, CheckSquare, CircleDot, Eye, FilePlus2, Layers, ListChecks, Loader2, Save, Settings,
  Trash2, Type,
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Switch} from "@/components/ui/switch";
import {Textarea} from "@/components/ui/textarea";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {EmptyState} from "@/components/layout/EmptyState";
import {useAuth} from "@/context/AuthContext";
import {examApi} from "@/lib/exams";
import {canCreateAnyExam, canDeleteExam, cn, errorMessage} from "@/lib/utils";
import type {QuestionType} from "@/types/exams";
import {
  EMPTY_PAGE, emptyDraft, fromEditorData, newKey, newQuestion, orderedQuestions, pageNumbers, toPayload, validate,
  type Draft, type DraftPage, type DraftQuestion, type DraftSettings,
} from "./editor/editor-model";
import {PreviewDialog} from "./editor/PreviewDialog";
import {QuestionEditorCard} from "./editor/QuestionEditorCard";
import {SettingsTab} from "./editor/SettingsTab";
import {StatsTab} from "./editor/StatsTab";

type EditorTab = "settings" | "questions" | "stats";

/** Exam editor: settings, pages with optional question pools, questions with answer keys and guides, preview, statistics. */
export function ExamEditor() {
  const {examId} = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {supabase, profile} = useAuth();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [meta, setMeta] = useState({sheetCount: 0, openAttempts: 0, division: null as string | null});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<EditorTab>(() => (searchParams.get("tab") === "stats" && examId ? "stats" : examId ? "questions" : "settings"));
  const [page, setPage] = useState(1);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pageToDelete, setPageToDelete] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!examId) return;
    try {
      const data = await examApi.editor(examId);
      setDraft(fromEditorData(data));
      setMeta({sheetCount: data.sheet_count, openAttempts: data.open_attempts, division: data.exam.division ?? null});
      setDirty(false);
    } catch (error) {
      toast.error(errorMessage(error, "A vizsga nem nyitható meg szerkesztésre."));
      navigate("/exams");
    }
  }, [examId, navigate]);

  useEffect(() => {
    if (!profile) return;
    if (examId) {
      void load();
    } else if (!canCreateAnyExam(profile)) {
      toast.error("Nincs jogosultságod vizsgát létrehozni.");
      navigate("/exams");
    } else {
      setDraft(emptyDraft(profile));
    }
  }, [examId, profile, load, navigate]);

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const edit = useCallback((change: (current: Draft) => Draft) => {
    setDraft((current) => (current ? change(current) : current));
    setDirty(true);
  }, []);

  const updateQuestion = useCallback((key: string, patch: Partial<DraftQuestion>) => edit((current) => ({
    ...current, questions: current.questions.map((question) => (question.key === key ? {...question, ...patch} : question)),
  })), [edit]);

  const moveQuestion = useCallback((key: string, direction: -1 | 1) => edit((current) => {
    const target = current.questions.find((question) => question.key === key);
    if (!target) return current;
    const samePage = current.questions.filter((question) => question.page === target.page);
    const swapWith = samePage[samePage.indexOf(target) + direction];
    if (!swapWith) return current;
    const questions = [...current.questions];
    const a = questions.indexOf(target);
    const b = questions.indexOf(swapWith);
    [questions[a], questions[b]] = [questions[b], questions[a]];
    return {...current, questions};
  }), [edit]);

  const duplicateQuestion = useCallback((key: string) => edit((current) => {
    const index = current.questions.findIndex((question) => question.key === key);
    if (index < 0) return current;
    const source = current.questions[index];
    const copy: DraftQuestion = {
      ...source, key: newKey(), id: null,
      options: source.options.map((option) => ({...option, key: newKey(), id: null})),
    };
    const questions = [...current.questions];
    questions.splice(index + 1, 0, copy);
    return {...current, questions};
  }), [edit]);

  const removeQuestion = useCallback((key: string) => edit((current) => ({
    ...current, questions: current.questions.filter((question) => question.key !== key),
  })), [edit]);

  const pages = useMemo(() => (draft ? pageNumbers(draft) : [1]), [draft]);
  const numbers = useMemo(() => new Map((draft ? orderedQuestions(draft) : []).map((question, index) => [question.key, index + 1])), [draft]);

  if (!profile || !draft) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <div className="skeleton h-28"/>
        <div className="skeleton h-96"/>
      </div>
    );
  }

  const currentPage = pages.includes(page) ? page : pages[0];
  const onPage = draft.questions.filter((question) => question.page === currentPage);
  const pageMeta = draft.pages[currentPage] ?? EMPTY_PAGE;
  const canDelete = !!examId && canDeleteExam(profile, {division: meta.division});

  const setSettings = (patch: Partial<DraftSettings>) => edit((current) => ({...current, settings: {...current.settings, ...patch}}));
  const setPageMeta = (patch: Partial<DraftPage>) => edit((current) => ({
    ...current, pages: {...current.pages, [currentPage]: {...(current.pages[currentPage] ?? EMPTY_PAGE), ...patch}},
  }));
  const addQuestion = (type: QuestionType) => {
    const question = newQuestion(currentPage, type);
    edit((current) => ({...current, questions: [...current.questions, question]}));
    window.setTimeout(() => document.getElementById(`edit-question-${question.key}`)?.scrollIntoView({behavior: "smooth", block: "center"}), 50);
  };
  const addPage = () => {
    const next = Math.max(...pages) + 1;
    edit((current) => ({...current, pages: {...current.pages, [next]: {...EMPTY_PAGE}}, questions: [...current.questions, newQuestion(next, "text")]}));
    setPage(next);
  };
  const deletePage = (target: number) => {
    edit((current) => {
      const questions = current.questions.filter((question) => question.page !== target)
        .map((question) => (question.page > target ? {...question, page: question.page - 1} : question));
      const shifted: Record<number, DraftPage> = {};
      Object.entries(current.pages).forEach(([key, value]) => {
        const number = Number(key);
        if (number < target) shifted[number] = value;
        if (number > target) shifted[number - 1] = value;
      });
      return {...current, questions, pages: shifted};
    });
    setPage(Math.max(1, target - 1));
    setPageToDelete(null);
  };

  const save = async () => {
    const problem = validate(draft);
    if (problem) {
      toast.error(problem.message);
      setTab(problem.tab);
      if (problem.questionKey) {
        const question = draft.questions.find((item) => item.key === problem.questionKey);
        if (question) setPage(question.page);
        setHighlight(problem.questionKey);
        window.setTimeout(() => document.getElementById(`edit-question-${problem.questionKey}`)?.scrollIntoView({behavior: "smooth", block: "center"}), 80);
        window.setTimeout(() => setHighlight(null), 2500);
      }
      return;
    }
    setSaving(true);
    try {
      const savedId = await examApi.saveExam(examId ?? null, toPayload(draft));
      toast.success("Vizsga mentve.");
      setDirty(false);
      if (!examId) navigate(`/exams/editor/${savedId}`, {replace: true});
      // Reload: new questions get their real ids (a second save must not create them again).
      else await load();
    } catch (error) {
      toast.error("A mentés nem sikerült: " + errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const removeExam = async () => {
    if (!examId) return;
    const {error} = await supabase.rpc("delete_full_exam", {_exam_id: examId});
    if (error) {
      toast.error("Hiba: " + errorMessage(error));
      return;
    }
    toast.success("A vizsga törölve.");
    setDirty(false);
    navigate("/exams");
  };

  const poolSize = onPage.length;
  const drawOn = pageMeta.draw_count !== null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-16">
      <Link to="/exams" className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-white"><ArrowLeft className="size-4"/> Vizsgaközpont</Link>

      <header className="panel glow-border animate-rise sticky top-16 z-20 flex flex-col gap-4 p-5 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-400">{examId ? "Vizsga szerkesztése" : "Új vizsga"}</p>
          <h1 className="truncate text-xl font-semibold text-white">{draft.settings.title || "Névtelen vizsga"}</h1>
          <p className="text-xs text-slate-400">
            {draft.questions.length} kérdés · {pages.length} oldal · {draft.settings.time_limit_minutes} perc
            {dirty && <span className="ml-2 text-amber-300">· Nem mentett változások</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setPreviewOpen(true)}><Eye/> Előnézet</Button>
          <Button onClick={() => void save()} disabled={saving || (!dirty && !!examId)}>
            {saving ? <Loader2 className="animate-spin"/> : <Save/>} {saving ? "Mentés…" : "Mentés"}
          </Button>
        </div>
      </header>

      {(meta.sheetCount > 0 || meta.openAttempts > 0) && (
        <div className="animate-rise flex items-start gap-3 rounded-2xl bg-amber-500/[0.07] p-4 text-sm text-amber-100 ring-1 ring-amber-400/25">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300"/>
          <p>
            {meta.openAttempts > 0 && `Most ${meta.openAttempts} vizsgázó tölti ki ezt a vizsgát; az ő lapjuk a régi kérdésekkel fut tovább. `}
            {meta.sheetCount > 0 && `${meta.sheetCount} leadott lap tartozik hozzá. A törölt kérdések a régi lapokon megmaradnak (archiválva), de a szövegmódosítás azokon is látszik.`}
          </p>
        </div>
      )}

      <Tabs value={tab} onValueChange={(value) => setTab(value as EditorTab)} className="space-y-5">
        <TabsList className="w-fit">
          <TabsTrigger value="settings" className="h-9 px-4"><Settings/> Beállítások</TabsTrigger>
          <TabsTrigger value="questions" className="h-9 px-4"><ListChecks/> Kérdések <span className="ml-1 rounded-full bg-primary/15 px-1.5 text-[11px] text-primary">{draft.questions.length}</span></TabsTrigger>
          {examId && <TabsTrigger value="stats" className="h-9 px-4"><BarChart3/> Statisztika</TabsTrigger>}
        </TabsList>

        <TabsContent value="settings" className="mt-0">
          <SettingsTab settings={draft.settings} profile={profile} onChange={setSettings} canDelete={canDelete} onDelete={() => setDeleteOpen(true)}/>
        </TabsContent>

        <TabsContent value="questions" className="mt-0 space-y-4">
          <div className="panel flex flex-wrap items-center gap-2 p-2">
            {pages.map((number, index) => {
              const count = draft.questions.filter((question) => question.page === number).length;
              return (
                <button key={number} type="button" onClick={() => setPage(number)}
                        className={cn("flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm transition-colors",
                          number === currentPage ? "bg-primary text-primary-foreground" : "text-slate-300 hover:bg-white/5")}>
                  {index + 1}. oldal <span className={cn("rounded-full px-1.5 text-[11px]", number === currentPage ? "bg-black/15" : "bg-white/5 text-slate-400")}>{count}</span>
                </button>
              );
            })}
            <Button variant="ghost" size="sm" onClick={addPage}><FilePlus2/> Új oldal</Button>
            {pages.length > 1 && (
              <Button variant="ghost" size="sm" className="ml-auto text-slate-400 hover:text-red-300" onClick={() => setPageToDelete(currentPage)}>
                <Trash2/> Oldal törlése
              </Button>
            )}
          </div>

          <section className="panel animate-fade grid grid-cols-1 gap-4 p-5 md:grid-cols-[minmax(0,1fr)_17rem]">
            <div className="space-y-3">
              <Input value={pageMeta.title} maxLength={120} onChange={(event) => setPageMeta({title: event.target.value})}
                     placeholder={`${pages.indexOf(currentPage) + 1}. oldal címe (nem kötelező)`}/>
              <Textarea value={pageMeta.description} maxLength={1000} onChange={(event) => setPageMeta({description: event.target.value})}
                        placeholder="Rövid bevezető az oldal kérdéseihez (nem kötelező)" className="min-h-16"/>
            </div>
            <div className="space-y-2 rounded-xl bg-white/[0.02] p-3 ring-1 ring-white/5">
              <label className="flex items-center justify-between gap-2 text-sm text-slate-200">
                <span className="flex items-center gap-2"><Layers className="size-4 text-yellow-400"/> Kérdésbank</span>
                <Switch checked={drawOn} disabled={poolSize < 2}
                        onCheckedChange={(checked) => setPageMeta({draw_count: checked ? Math.max(1, poolSize - 1) : null})}/>
              </label>
              {drawOn ? (
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Input type="number" min={1} max={Math.max(1, poolSize - 1)} value={pageMeta.draw_count ?? 1} className="h-8 w-16 text-center"
                         onChange={(event) => {
                           const value = Number.parseInt(event.target.value, 10);
                           setPageMeta({draw_count: Number.isNaN(value) ? 1 : Math.max(1, Math.min(Math.max(1, poolSize - 1), value))});
                         }}/>
                  kérdést kap a {poolSize}-ből
                </div>
              ) : (
                <p className="text-xs text-slate-500">{poolSize < 2 ? "Legalább két kérdés kell az oldalon." : "Minden vizsgázó az oldal összes kérdését kapja."}</p>
              )}
            </div>
          </section>

          {onPage.length === 0 ? (
            <div className="panel"><EmptyState icon={ListChecks} title="Ez az oldal még üres." description="Adj hozzá egy kérdést lent."/></div>
          ) : onPage.map((question, index) => (
            <QuestionEditorCard key={question.key} question={question} number={numbers.get(question.key) ?? index + 1} index={index}
                                pages={pages} isFirst={index === 0} isLast={index === onPage.length - 1} highlighted={highlight === question.key}
                                onChange={updateQuestion} onMove={moveQuestion} onDuplicate={duplicateQuestion} onRemove={removeQuestion}/>
          ))}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {([["text", "Kifejtős kérdés", Type], ["single_choice", "Egy helyes válasz", CircleDot], ["multiple_choice", "Több helyes válasz", CheckSquare]] as const)
              .map(([type, label, Icon], index) => (
                <button key={type} type="button" onClick={() => addQuestion(type)} style={{"--i": index} as CSSProperties}
                        className="animate-rise flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 py-4 text-sm text-slate-300 transition-colors hover:border-primary/50 hover:bg-primary/[0.04] hover:text-white">
                  <Icon className="size-4"/> {label}
                </button>
              ))}
          </div>
        </TabsContent>

        {examId && (
          <TabsContent value="stats" className="mt-0">
            {tab === "stats" && <StatsTab examId={examId} draft={draft}/>}
          </TabsContent>
        )}
      </Tabs>

      <PreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} draft={draft}/>

      <AlertDialog open={pageToDelete !== null} onOpenChange={(open) => !open && setPageToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Törlöd az oldalt?</AlertDialogTitle>
            <AlertDialogDescription>Az oldal minden kérdése törlődik (mentéskor). A következő oldalak eggyel előrébb kerülnek.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mégse</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-500" onClick={() => pageToDelete !== null && deletePage(pageToDelete)}>Oldal törlése</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Törlöd a vizsgát?</AlertDialogTitle>
            <AlertDialogDescription>
              A vizsga minden kérdéssel{meta.sheetCount > 0 ? ` és ${meta.sheetCount} leadott vizsgalappal` : ""} együtt véglegesen törlődik. Ez nem vonható vissza.
              Ha csak szüneteltetnéd, kapcsold ki az „Aktív” beállítást.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mégse</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-500" onClick={() => void removeExam()}>Végleges törlés</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
