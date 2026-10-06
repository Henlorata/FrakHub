import {useEffect, useMemo, useState} from "react";
import {toast} from "sonner";
import {
  AlertTriangle, ArrowLeft, Check, CircleCheck, Flag, GitBranch, Loader2, Play, Plus, Star, Trash2, X,
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Switch} from "@/components/ui/switch";
import {Textarea} from "@/components/ui/textarea";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {EmptyState} from "@/components/layout/EmptyState";
import {DISCARD_CHANGES, useConfirm} from "@/components/ConfirmDialog";
import {
  practiceApi, SCENARIO_CATEGORIES, type ScenarioCategory, type ScenarioChoice, type ScenarioDraft, type ScenarioNode, type Verdict,
} from "@/lib/practice/api";
import {analyseScenario, flowOrder, MAX_CHOICES, nextStepId} from "@/lib/practice/scenario-graph";
import {cn, errorMessage} from "@/lib/utils";

const ENDS_HERE = "__end__";
const VERDICTS: Record<Verdict, string> = {good: "Jó", ok: "Elfogadható", bad: "Rossz"};

const blankDraft = (): ScenarioDraft => ({
  title: "", summary: null, category: "patrol", difficulty: 1, pass_percent: 70, published: false, sort_order: 100, start_node: "start",
  nodes: {
    start: {text: "", choices: [{id: "a", text: "", next: "vege", points: 2, verdict: "good", feedback: ""}, {id: "b", text: "", next: "vege", points: 0, verdict: "bad", feedback: ""}]},
    vege: {end: {title: "Vége", text: ""}},
  },
});

/**
 * The instructors' editor of a branching scenario: steps (a situation with up to six choices, or an
 * ending), each choice with points, a verdict and feedback, and where it leads. The same checks
 * run here as on the server, so a broken graph is shown before saving.
 */
export function ScenarioEditor({id, onExit, onPlay}: {id: string | null; onExit: () => void; onPlay: (id: string) => void}) {
  const confirm = useConfirm();
  const [draft, setDraft] = useState<ScenarioDraft | null>(id ? null : blankDraft());
  // The steps' order on screen: the flow when loaded, new steps at the end (it does not jump while links change).
  const [order, setOrder] = useState<string[]>(() => (draft ? flowOrder(draft.nodes, draft.start_node) : []));
  const [savedId, setSavedId] = useState<string | null>(id);
  const [failed, setFailed] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    practiceApi.scenario(id).then((scenario) => {
      setDraft({
        title: scenario.title, summary: scenario.summary, category: scenario.category, difficulty: scenario.difficulty, pass_percent: scenario.pass_percent,
        published: scenario.published, sort_order: scenario.sort_order, start_node: scenario.start_node, nodes: scenario.nodes,
      });
      setOrder(flowOrder(scenario.nodes, scenario.start_node));
    }).catch((error) => setFailed(errorMessage(error)));
  }, [id]);

  const analysis = useMemo(() => (draft ? analyseScenario(draft.nodes, draft.start_node) : null), [draft]);
  if (failed) return <EmptyState icon={X} title={failed} action={<Button variant="outline" onClick={onExit}>Vissza</Button>}/>;
  if (!draft || !analysis) return <div className="mx-auto max-w-5xl space-y-4"><div className="skeleton h-40"/><div className="skeleton h-96"/></div>;

  const update = (patch: Partial<ScenarioDraft>) => {
    setDraft((prev) => prev && {...prev, ...patch});
    setDirty(true);
  };
  const updateNode = (key: string, node: ScenarioNode) => update({nodes: {...draft.nodes, [key]: node}});
  const renameNode = (from: string, to: string) => {
    const clean = to.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
    if (!clean || clean === from || draft.nodes[clean]) return;
    const nodes: Record<string, ScenarioNode> = {};
    for (const [key, node] of Object.entries(draft.nodes)) {
      nodes[key === from ? clean : key] = {...node, choices: node.choices?.map((choice) => (choice.next === from ? {...choice, next: clean} : choice))};
    }
    update({nodes, start_node: draft.start_node === from ? clean : draft.start_node});
    setOrder((prev) => prev.map((key) => (key === from ? clean : key)));
  };
  const removeNode = (key: string) => {
    const nodes: Record<string, ScenarioNode> = {};
    for (const [other, node] of Object.entries(draft.nodes)) {
      if (other === key) continue;
      nodes[other] = {...node, choices: node.choices?.map((choice) => (choice.next === key ? {...choice, next: null} : choice))};
    }
    update({nodes});
  };
  const addNode = (ending: boolean) => {
    const key = nextStepId(draft.nodes);
    updateNode(key, ending ? {end: {title: "", text: ""}} : {text: "", choices: [{id: "a", text: "", next: null, points: 1, verdict: "ok", feedback: ""}]});
    setOrder((prev) => [...prev.filter((other) => other !== key), key]);
    requestAnimationFrame(() => document.getElementById(`step-${key}`)?.scrollIntoView({behavior: "smooth", block: "center"}));
  };

  const save = async () => {
    setSaving(true);
    try {
      const result = await practiceApi.saveScenario(savedId, {...draft, title: draft.title.trim(), summary: draft.summary?.trim() || null});
      setSavedId(result.id);
      setDirty(false);
      toast.success("Gyakorlat mentve.", {description: `A legjobb út ${result.max_score} pontot ér.`});
    } catch (error) {
      toast.error(errorMessage(error, "A mentés nem sikerült."));
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!savedId) return;
    if (!(await confirm({title: "Gyakorlat törlése", description: `„${draft.title}” és minden eredménye törlődik (a kiadott oklevelek megmaradnak).`,
      confirmLabel: "Törlés", destructive: true, kind: "delete"}))) return;
    try {
      await practiceApi.deleteScenario(savedId);
      toast.success("Gyakorlat törölve.");
      onExit();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  const exit = async () => {
    if (dirty && !(await confirm(DISCARD_CHANGES))) return;
    onExit();
  };

  const nodeKeys = [...order.filter((key) => key in draft.nodes), ...Object.keys(draft.nodes).filter((key) => !order.includes(key))];
  return (
    <div className="mx-auto w-full max-w-5xl space-y-5" data-tour="scenario-editor">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => void exit()}><ArrowLeft/> Gyakorlás</Button>
        <h2 className="min-w-0 flex-1 truncate text-lg font-semibold text-white">{savedId ? "Gyakorlat szerkesztése" : "Új szituációs gyakorlat"}</h2>
        {savedId && <Button variant="ghost" size="sm" className="hover:text-red-300" onClick={() => void remove()}><Trash2/> Törlés</Button>}
        {savedId && !dirty && <Button variant="outline" size="sm" onClick={() => onPlay(savedId)}><Play/> Kipróbálás</Button>}
        <Button disabled={saving || analysis.problems.length > 0 || draft.title.trim().length < 3} onClick={() => void save()}>
          {saving ? <Loader2 className="animate-spin"/> : <Check/>} Mentés
        </Button>
      </div>

      <section className="panel grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="scenario-title">Cím</Label>
          <Input id="scenario-title" maxLength={120} value={draft.title} onChange={(event) => update({title: event.target.value})} placeholder="Például: Közúti ellenőrzés éjszaka"/>
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="scenario-summary">Rövid leírás</Label>
          <Input id="scenario-summary" maxLength={300} value={draft.summary ?? ""} onChange={(event) => update({summary: event.target.value})}/>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Téma</Label>
            <Select value={draft.category} onValueChange={(value) => update({category: value as ScenarioCategory})}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>{(Object.keys(SCENARIO_CATEGORIES) as ScenarioCategory[]).map((key) => <SelectItem key={key} value={key}>{SCENARIO_CATEGORIES[key]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Nehézség</Label>
            <div className="flex h-9 items-center gap-1">
              {([1, 2, 3] as const).map((level) => (
                <button key={level} type="button" onClick={() => update({difficulty: level})} aria-label={`${level}. szint`}
                        className="p-0.5"><Star className={cn("size-5", level <= draft.difficulty ? "fill-cyan-300 text-cyan-300" : "text-slate-600")}/></button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="scenario-pass">Sikerhez kell (%)</Label>
            <Input id="scenario-pass" type="number" min={1} max={100} value={draft.pass_percent}
                   onChange={(event) => update({pass_percent: Math.max(1, Math.min(100, Number(event.target.value) || 70))})}/>
          </div>
          <div className="space-y-1">
            <Label htmlFor="scenario-order">Sorrend</Label>
            <Input id="scenario-order" type="number" min={0} max={10000} value={draft.sort_order}
                   onChange={(event) => update({sort_order: Math.max(0, Math.min(10000, Number(event.target.value) || 0))})}/>
          </div>
        </div>
        <label className="flex items-start gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10 md:col-span-2">
          <Switch checked={draft.published} onCheckedChange={(value) => update({published: value})}/>
          <span className="text-sm">
            <span className="font-medium text-white">Közzétéve</span>
            <span className="block text-xs text-slate-400">A tagok csak a közzétett gyakorlatot látják; aki teljesíti, oklevelet kap.</span>
          </span>
        </label>
      </section>

      <section className={cn("panel flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm", analysis.problems.length ? "ring-1 ring-amber-500/30" : "ring-1 ring-emerald-500/20")}>
        {analysis.problems.length === 0 ? (
          <span className="inline-flex items-center gap-2 text-emerald-200"><CircleCheck className="size-4"/> A gyakorlat rendben van.</span>
        ) : (
          <ul className="w-full space-y-1 text-amber-100">
            {analysis.problems.map((problem) => <li key={problem} className="flex items-start gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300"/>{problem}</li>)}
          </ul>
        )}
        <span className="text-xs text-slate-400"><GitBranch className="mr-1 inline size-3.5"/>{nodeKeys.length} lépés · leghosszabb út: {analysis.depth} döntés · legjobb út: {analysis.maxScore} pont</span>
        {analysis.unreachable.length > 0 && <span className="text-xs text-slate-500">Nem érhető el: {analysis.unreachable.join(", ")}</span>}
      </section>

      <div className="space-y-3">
        {nodeKeys.map((key) => (
          <StepCard key={key} stepKey={key} node={draft.nodes[key]} isStart={draft.start_node === key} keys={nodeKeys}
                    onChange={(node) => updateNode(key, node)} onRename={(to) => renameNode(key, to)} onRemove={() => removeNode(key)}
                    onMakeStart={() => update({start_node: key})}/>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => addNode(false)}><Plus/> Új helyzet</Button>
        <Button variant="outline" onClick={() => addNode(true)}><Flag/> Új befejezés</Button>
      </div>
    </div>
  );
}

function StepCard({stepKey, node, isStart, keys, onChange, onRename, onRemove, onMakeStart}: {
  stepKey: string;
  node: ScenarioNode;
  isStart: boolean;
  keys: string[];
  onChange: (node: ScenarioNode) => void;
  onRename: (to: string) => void;
  onRemove: () => void;
  onMakeStart: () => void;
}) {
  const ending = !node.choices || node.choices.length === 0;
  const [name, setName] = useState(stepKey);
  useEffect(() => setName(stepKey), [stepKey]);
  const setChoice = (index: number, patch: Partial<ScenarioChoice>) =>
    onChange({...node, choices: (node.choices ?? []).map((choice, at) => (at === index ? {...choice, ...patch} : choice))});
  const addChoice = () => {
    const used = new Set((node.choices ?? []).map((choice) => choice.id));
    const id = "abcdef".split("").find((letter) => !used.has(letter)) ?? `c${used.size + 1}`;
    onChange({...node, choices: [...(node.choices ?? []), {id, text: "", next: null, points: 0, verdict: "ok", feedback: ""}]});
  };

  return (
    <article id={`step-${stepKey}`} className={cn("panel p-4", isStart && "ring-1 ring-cyan-500/30")}>
      <header className="flex flex-wrap items-center gap-2">
        <span className={cn("grid size-8 place-items-center rounded-lg ring-1", ending ? "bg-violet-500/10 text-violet-300 ring-violet-500/25" : "bg-cyan-500/10 text-cyan-300 ring-cyan-500/25")}>
          {ending ? <Flag className="size-4"/> : <GitBranch className="size-4"/>}
        </span>
        <Input value={name} onChange={(event) => setName(event.target.value)} onBlur={() => onRename(name)} aria-label="Lépés azonosítója"
               className="h-8 w-36 font-mono text-xs"/>
        {isStart ? <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[11px] font-semibold text-cyan-200">Kezdő lépés</span>
          : <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onMakeStart}>Legyen ez a kezdő</Button>}
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onChange(ending
            ? {text: node.end?.text ?? "", choices: [{id: "a", text: "", next: null, points: 0, verdict: "ok", feedback: ""}]}
            : {end: {title: "", text: node.text ?? ""}})}>
            {ending ? "Helyzetté alakítás" : "Befejezéssé alakítás"}
          </Button>
          {!isStart && <Button size="icon-sm" variant="ghost" title="Lépés törlése" className="hover:text-red-300" onClick={onRemove}><Trash2/></Button>}
        </div>
      </header>
      {ending ? (
        <div className="mt-3 grid grid-cols-1 gap-2">
          <Input maxLength={120} value={node.end?.title ?? ""} onChange={(event) => onChange({...node, end: {...node.end, title: event.target.value}})} placeholder="A befejezés címe (pl. Szép munka!)"/>
          <Textarea rows={2} maxLength={1500} value={node.end?.text ?? ""} onChange={(event) => onChange({...node, end: {...node.end, text: event.target.value}})}
                    placeholder="Mi lett a vége, mit tanulhat belőle?"/>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <Textarea rows={3} maxLength={1500} value={node.text ?? ""} onChange={(event) => onChange({...node, text: event.target.value})}
                    placeholder="A helyzet leírása: mit lát, mit hall, mi történik?"/>
          <ol className="space-y-2">
            {(node.choices ?? []).map((choice, index) => (
              <li key={choice.id} className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/[0.06]">
                <div className="flex items-start gap-2">
                  <span className="mt-2 font-mono text-xs font-semibold text-slate-500">{String.fromCharCode(65 + index)}</span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <Input maxLength={300} value={choice.text} onChange={(event) => setChoice(index, {text: event.target.value})} placeholder="A döntés"/>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_90px_140px]">
                      <Select value={choice.next ?? ENDS_HERE} onValueChange={(value) => setChoice(index, {next: value === ENDS_HERE ? null : value})}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue/></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ENDS_HERE}>— itt véget ér</SelectItem>
                          {keys.filter((key) => key !== stepKey).map((key) => <SelectItem key={key} value={key}>→ {key}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input type="number" min={0} max={10} value={choice.points} aria-label="Pont"
                             onChange={(event) => setChoice(index, {points: Math.max(0, Math.min(10, Math.round(Number(event.target.value) || 0)))})}
                             className="h-9 text-xs"/>
                      <Select value={choice.verdict} onValueChange={(value) => setChoice(index, {verdict: value as Verdict})}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue/></SelectTrigger>
                        <SelectContent>{(Object.keys(VERDICTS) as Verdict[]).map((verdict) => <SelectItem key={verdict} value={verdict}>{VERDICTS[verdict]}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <Input maxLength={600} value={choice.feedback ?? ""} onChange={(event) => setChoice(index, {feedback: event.target.value})}
                           placeholder="Visszajelzés: miért jó vagy rossz ez a döntés?" className="text-xs"/>
                  </div>
                  {(node.choices ?? []).length > 1 && (
                    <Button size="icon-sm" variant="ghost" title="Válasz törlése" onClick={() => onChange({...node, choices: (node.choices ?? []).filter((_, at) => at !== index)})}><X/></Button>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {(node.choices ?? []).length < MAX_CHOICES && <Button size="sm" variant="ghost" onClick={addChoice}><Plus/> Válasz</Button>}
        </div>
      )}
    </article>
  );
}
