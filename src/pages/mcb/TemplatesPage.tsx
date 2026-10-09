import {Suspense, useCallback, useEffect, useMemo, useState, type CSSProperties} from "react";
import {Navigate} from "react-router";
import {toast} from "sonner";
import {
  AlertTriangle, ArrowDown, ArrowUp, FilePlus2, LayoutTemplate, Loader2, Plus, RotateCcw, Save, ScrollText, Trash2, X,
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {PageHeader} from "@/components/layout/PageHeader";
import {EmptyState} from "@/components/layout/EmptyState";
import {DISCARD_CHANGES, useConfirm} from "@/components/ConfirmDialog";
import {useAuth} from "@/context/AuthContext";
import {
  caseTemplatesApi, loadCaseTemplates, parseAliases, TEMPLATE_ICONS, TEMPLATE_LIMITS, TEMPLATE_TOKENS, templateIcon, templateProblem,
  type CaseTemplate, type TemplateBlock, type TemplateDraft, type TemplateKind,
} from "@/lib/case-templates";
import {BUILTIN_TEMPLATES} from "@/lib/case-templates-builtin";
import {formatDateTime} from "@/lib/datetime";
import {lazyComponent} from "@/lib/lazy";
import {isMcbLead} from "@/lib/mcb";
import {cn, errorMessage} from "@/lib/utils";

const TemplateEditor = lazyComponent(() => import("./components/TemplateEditor"), "TemplateEditor");

const KINDS: {kind: TemplateKind; title: string; hint: string; add: string}[] = [
  {kind: "document", title: "Kiinduló dokumentumok", hint: "Új akta nyitásakor választható.", add: "Új dokumentum"},
  {kind: "snippet", title: "Beszúrható blokkok", hint: "A dokumentumban a „/” menüből.", add: "Új blokk"},
];

const byOrder = (a: CaseTemplate, b: CaseTemplate) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, "hu");
const emptyDraft = (kind: TemplateKind): TemplateDraft => ({kind, label: "", description: "", icon: kind === "snippet" ? "scroll" : "file", aliases: [], blocks: []});
const toDraft = (template: CaseTemplate): TemplateDraft => ({
  kind: template.kind, label: template.label, description: template.description ?? "", icon: template.icon, aliases: template.aliases,
  blocks: template.blocks,
});

/**
 * The MCB leadership's template library: the starting documents of new cases and the ready-made
 * blocks of the editor's "/" menu. Cases already opened keep their own copy.
 */
export function TemplatesPage() {
  const {profile} = useAuth();
  const confirm = useConfirm();
  const allowed = isMcbLead(profile);
  const [templates, setTemplates] = useState<CaseTemplate[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [baseline, setBaseline] = useState("");
  const [aliasText, setAliasText] = useState("");
  // The body the editor starts from (the editor keeps its own state afterwards).
  const [initialBlocks, setInitialBlocks] = useState<TemplateBlock[]>([]);
  const [editorKey, setEditorKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const isNew = !!selectedId?.startsWith("new-");
  const dirty = !!draft && JSON.stringify(draft) !== baseline;
  const selected = templates?.find((template) => template.id === selectedId) ?? null;

  // Fresh from the database on every visit (the cache serves the other pages); bumping reloads.
  const [loads, setLoads] = useState(0);
  const load = useCallback(() => setLoads((value) => value + 1), []);

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    loadCaseTemplates(true).then((result) => {
      if (!active) return;
      setFailed(result.fallback);
      if (!result.fallback) setTemplates(result.templates);
    });
    return () => {
      active = false;
    };
  }, [allowed, loads]);

  // Closing the page with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirty]);

  const groups = useMemo(() => KINDS.map((group) => ({
    ...group, items: (templates ?? []).filter((template) => template.kind === group.kind).sort(byOrder),
  })), [templates]);

  const onBlocks = useCallback((blocks: TemplateBlock[]) => setDraft((current) => (current ? {...current, blocks} : current)), []);

  if (profile && !allowed) return <Navigate to="/mcb" replace/>;

  const open = async (template: CaseTemplate | null, kind: TemplateKind) => {
    if (dirty && !(await confirm(DISCARD_CHANGES))) return;
    const next = template ? toDraft(template) : emptyDraft(kind);
    setSelectedId(template?.id ?? `new-${kind}`);
    setDraft(next);
    setBaseline(JSON.stringify(next));
    setAliasText(next.aliases.join(", "));
    setInitialBlocks(next.blocks);
    setEditorKey((key) => key + 1);
  };

  const close = () => {
    setSelectedId(null);
    setDraft(null);
    setBaseline("");
  };

  const patch = (change: Partial<TemplateDraft>) => setDraft((current) => (current ? {...current, ...change} : current));

  const save = async () => {
    if (!draft || !selectedId) return;
    const problem = templateProblem(draft);
    if (problem) return toast.error(problem);
    setSaving(true);
    try {
      if (isNew) {
        const order = Math.max(0, ...(templates ?? []).filter((item) => item.kind === draft.kind).map((item) => item.sort_order)) + 10;
        const created = await caseTemplatesApi.create(draft, order);
        setTemplates((list) => [...(list ?? []), created]);
        setSelectedId(created.id);
      } else {
        const updated = await caseTemplatesApi.update(selectedId, draft);
        setTemplates((list) => (list ?? []).map((item) => (item.id === updated.id ? updated : item)));
      }
      setBaseline(JSON.stringify(draft));
      toast.success("Sablon mentve.", {description: draft.kind === "document" ? "Az új aktáknál már ez választható." : "A „/” menüben már ez jelenik meg."});
    } catch (error) {
      toast.error(errorMessage(error, "A mentés nem sikerült."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!draft || !selectedId) return;
    if (isNew) {
      if (!dirty || await confirm(DISCARD_CHANGES)) close();
      return;
    }
    if (!(await confirm({
      title: "Sablon törlése", confirmLabel: "Törlés", destructive: true, kind: "delete",
      description: `„${selected?.label ?? draft.label}” törlődik. A vele már megnyitott akták nem változnak.`,
    }))) return;
    try {
      await caseTemplatesApi.remove(selectedId);
      setTemplates((list) => (list ?? []).filter((item) => item.id !== selectedId));
      close();
      toast.success("Sablon törölve.");
    } catch (error) {
      toast.error(errorMessage(error, "A törlés nem sikerült."));
    }
  };

  const move = async (template: CaseTemplate, step: -1 | 1) => {
    const list = groups.find((group) => group.kind === template.kind)?.items ?? [];
    const index = list.findIndex((item) => item.id === template.id);
    const target = index + step;
    if (index < 0 || target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    const ids = next.map((item) => item.id);
    setTemplates((all) => (all ?? []).map((item) => (item.kind === template.kind ? {...item, sort_order: (ids.indexOf(item.id) + 1) * 10} : item)));
    try {
      await caseTemplatesApi.reorder(ids);
    } catch (error) {
      toast.error(errorMessage(error, "A sorrend mentése nem sikerült."));
      void load();
    }
  };

  const restore = async () => {
    const existing = new Set((templates ?? []).map((item) => `${item.kind}:${item.label.trim().toLowerCase()}`));
    const missing = BUILTIN_TEMPLATES.filter((item) => !existing.has(`${item.kind}:${item.label.trim().toLowerCase()}`));
    if (!missing.length) return toast.info("Minden alapsablon megvan.");
    if (!(await confirm({
      title: "Alapsablonok visszaállítása", confirmLabel: "Visszaállítás", kind: "question",
      description: `A hiányzó alapsablonok (${missing.map((item) => item.label).join(", ")}) a listák végére kerülnek. A meglévők nem változnak.`,
    }))) return;
    const next: Record<TemplateKind, number> = {
      document: Math.max(0, ...(templates ?? []).filter((item) => item.kind === "document").map((item) => item.sort_order)),
      snippet: Math.max(0, ...(templates ?? []).filter((item) => item.kind === "snippet").map((item) => item.sort_order)),
    };
    try {
      await caseTemplatesApi.createMany(missing.map((item) => ({...structuredClone(item), sort_order: (next[item.kind] += 10)})));
      toast.success(`${missing.length} alapsablon visszaállítva.`);
      void load();
    } catch (error) {
      toast.error(errorMessage(error, "A visszaállítás nem sikerült."));
    }
  };

  const preview = TEMPLATE_ICONS.find((option) => option.key === draft?.icon) ?? TEMPLATE_ICONS[0];

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 pb-10">
      <PageHeader icon={LayoutTemplate} tone="blue" eyebrow="MCB vezetés" title="Aktasablonok"
                  description="Az új akták kiinduló dokumentumai és a szerkesztő „/” menüjének kész blokkjai. A már megnyitott akták nem változnak."
                  actions={templates && <Button variant="outline" onClick={() => void restore()}><RotateCcw/> Alapsablonok visszaállítása</Button>}/>

      {failed ? (
        <div className="panel"><EmptyState icon={AlertTriangle} title="A sablonok nem tölthetők be"
                                            action={<Button variant="outline" size="sm" onClick={() => void load()}>Újra</Button>}/></div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-4 xl:sticky xl:top-20" data-tour="templates-list">
            {groups.map((group, groupIndex) => (
              <section key={group.kind} className="panel animate-rise p-3" style={{"--i": groupIndex} as CSSProperties}>
                <header className="mb-2 flex items-center gap-2 px-1">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold text-white">{group.title}</h2>
                    <p className="text-[11px] text-slate-500">{group.hint}</p>
                  </div>
                  <Button size="sm" variant="ghost" className="h-8 text-sky-300 hover:text-sky-200" onClick={() => void open(null, group.kind)}>
                    <Plus className="size-3.5"/> {group.add}
                  </Button>
                </header>
                {templates === null ? (
                  <div className="space-y-1.5">{[0, 1, 2].map((index) => <div key={index} className="skeleton h-12 rounded-lg"/>)}</div>
                ) : (
                  <ul className="space-y-1">
                    {group.items.map((item, index) => {
                      const Icon = templateIcon(item.icon);
                      const active = item.id === selectedId;
                      return (
                        <li key={item.id} className={cn("group flex min-w-0 items-center gap-1 rounded-lg ring-1 transition-colors",
                          active ? "bg-sky-500/10 ring-sky-500/40" : "ring-transparent hover:bg-white/[0.04]")}>
                          <button type="button" onClick={() => void open(item, item.kind)} aria-current={active || undefined}
                                  className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-2 text-left">
                            <Icon className={cn("size-4 shrink-0", active ? "text-sky-300" : "text-slate-500")}/>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-slate-100">{item.label}</span>
                              {item.description && <span className="block truncate text-[11px] text-slate-500">{item.description}</span>}
                            </span>
                          </button>
                          <span className="flex shrink-0 pr-1 opacity-60 transition-opacity group-hover:opacity-100">
                            <Button size="icon-sm" variant="ghost" aria-label={`${item.label} feljebb`} disabled={index === 0}
                                    onClick={() => void move(item, -1)}><ArrowUp/></Button>
                            <Button size="icon-sm" variant="ghost" aria-label={`${item.label} lejjebb`} disabled={index === group.items.length - 1}
                                    onClick={() => void move(item, 1)}><ArrowDown/></Button>
                          </span>
                        </li>
                      );
                    })}
                    {group.items.length === 0 && <li className="px-2 py-2 text-xs text-slate-500">Nincs ilyen sablon.</li>}
                    {group.kind === "document" && (
                      <li className="flex items-center gap-2.5 px-2 py-2 text-slate-500" title="Mindig választható, nem szerkeszthető.">
                        <FilePlus2 className="size-4 shrink-0"/>
                        <span className="min-w-0 text-sm">Üres akta <span className="text-[11px]">· mindig elérhető</span></span>
                      </li>
                    )}
                  </ul>
                )}
              </section>
            ))}
          </aside>

          <section className="min-w-0" data-tour="templates-editor">
            {!draft ? (
              <div className="panel">
                <EmptyState icon={ScrollText} title="Válassz sablont a bal oldalon, vagy hozz létre újat."
                            description="A kitöltendő részeket érdemes dőlt, szürke betűvel írni: az aktában így látszik, mit kell átírni."/>
              </div>
            ) : (
              <div className="panel animate-fade space-y-5 p-5">
                {/* Stays in view while scrolling a long template (saving is always one click away). */}
                <header className="sticky top-14 z-20 -mx-5 -mt-5 flex flex-wrap items-start gap-3 rounded-t-[inherit] border-b border-white/5 bg-[#0a1120]/90 px-5 pt-5 pb-4 backdrop-blur-md">
                  <div className="flex min-w-0 flex-1 items-start gap-3 rounded-xl bg-amber-500/10 p-3 ring-1 ring-amber-500/40" aria-label="Előnézet">
                    <preview.icon className="mt-0.5 size-5 shrink-0 text-amber-300"/>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-white wrap-anywhere">{draft.label.trim() || "Névtelen sablon"}</span>
                      {draft.description?.trim() && <span className="block text-xs text-slate-400 wrap-anywhere">{draft.description}</span>}
                      <span className="mt-1 block text-[11px] text-slate-500">
                        {draft.kind === "document" ? "Kiinduló dokumentum" : "Beszúrható blokk"}
                        {selected?.updated_at ? ` · módosítva ${formatDateTime(selected.updated_at)}` : isNew ? " · még nincs mentve" : ""}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {dirty && <span className="text-xs text-amber-300">Mentetlen módosítások</span>}
                    <Button variant="ghost" onClick={() => void remove()} className="text-red-300 hover:bg-red-500/10 hover:text-red-200">
                      {isNew ? <><X/> Elvetés</> : <><Trash2/> Törlés</>}
                    </Button>
                    <Button onClick={() => void save()} disabled={saving || (!dirty && !isNew)} className="bg-sky-600 text-white hover:bg-sky-500">
                      {saving ? <Loader2 className="animate-spin"/> : <Save/>} Mentés
                    </Button>
                  </div>
                </header>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="template-label">Név</Label>
                    <Input id="template-label" value={draft.label} maxLength={TEMPLATE_LIMITS.label} placeholder="pl. Körözési adatlap"
                           onChange={(event) => patch({label: event.target.value})}/>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="template-description">Rövid leírás</Label>
                    <Input id="template-description" value={draft.description ?? ""} maxLength={TEMPLATE_LIMITS.description}
                           placeholder={draft.kind === "document" ? "Mit tartalmaz, mikor érdemes választani" : "A „/” menüben a név alatt látszik"}
                           onChange={(event) => patch({description: event.target.value})}/>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Ikon</Label>
                  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Ikon">
                    {TEMPLATE_ICONS.map((option) => (
                      <button key={option.key} type="button" role="radio" aria-checked={draft.icon === option.key} title={option.label}
                              aria-label={option.label} onClick={() => patch({icon: option.key})}
                              className={cn("grid size-9 place-items-center rounded-lg ring-1 transition-colors",
                                draft.icon === option.key ? "bg-amber-500/15 text-amber-200 ring-amber-500/50" : "text-slate-400 ring-white/10 hover:bg-white/5 hover:text-slate-200")}>
                        <option.icon className="size-4"/>
                      </button>
                    ))}
                  </div>
                </div>

                {draft.kind === "snippet" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="template-aliases">Keresőszavak a „/” menühöz</Label>
                    <Input id="template-aliases" value={aliasText} placeholder="pl. vallomas, tanu"
                           onChange={(event) => {
                             setAliasText(event.target.value);
                             patch({aliases: parseAliases(event.target.value)});
                           }}/>
                    <p className="text-[11px] text-slate-500">Vesszővel elválasztva; ékezet nélkül is megtalálja.</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Tartalom</Label>
                  <p className="text-[11px] text-slate-500">
                    Címsorok, listák, táblázatok, idézetek és a hivatalos fejléc („/fejléc”). Feltöltött kép nem kerülhet a sablonba:
                    a bizonyítékokat az aktába töltik fel.
                  </p>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    <span>Kitöltődik:</span>
                    {TEMPLATE_TOKENS.map((item) => (
                      <span key={item.token}><code className="rounded bg-white/5 px-1 py-0.5 font-mono text-sky-200">{item.token}</code> {item.label}</span>
                    ))}
                  </p>
                  <Suspense fallback={<div className="skeleton h-[420px] rounded-xl"/>}>
                    <TemplateEditor key={editorKey} initial={initialBlocks} onChange={onBlocks}/>
                  </Suspense>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
