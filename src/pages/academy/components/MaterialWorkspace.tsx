import {useCallback, useState, type CSSProperties, type ReactNode} from "react";
import {toast} from "sonner";
import {DISCARD_CHANGES, useConfirm} from "@/components/ConfirmDialog";
import {
  ArrowDown, ArrowUp, BookOpenCheck, CheckCircle2, ChevronLeft, ChevronRight, Circle, FilePlus2, Loader2, Lock, Palette, PencilLine, Trash2,
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {EmptyState} from "@/components/layout/EmptyState";
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from "@/components/ui/dropdown-menu";
import {useAuth} from "@/context/AuthContext";
import {academyApi} from "@/lib/academy";
import {deleteCloudinaryAssets} from "@/lib/cloudinary";
import {extractImageUrls} from "@/lib/blocknote-content";
import {cn, errorMessage} from "@/lib/utils";
import {ACADEMY_THEMES, AcademyEditor} from "./AcademyEditor";
import {fetchMaterialContent, forgetMaterialContent, setMaterialContent, useMaterialContent, type MaterialTable} from "../useMaterialContent";

export interface MaterialPage {
  id: string;
  title: string;
  theme: string | null;
  page_order: number;
}

interface MaterialWorkspaceProps {
  table: MaterialTable;
  pages: MaterialPage[];
  onPagesChange: (pages: MaterialPage[]) => void;
  index: number;
  onIndexChange: (index: number) => void;
  canEdit: boolean;
  /** Creates a page (the caller knows the course or day) and returns it. */
  onCreatePage: () => Promise<MaterialPage>;
  /** Pages read and the order rule (courses); the basic academy has none. */
  progress?: {completed: Set<string>; linear: boolean; onComplete: (id: string) => Promise<void>};
  /** Shown above the table of contents (course or day summary). */
  aside?: ReactNode;
  emptyTitle: string;
}

/**
 * A course's (or an academy day's) pages: table of contents, reader and, for instructors, the
 * editor (titles, order, look, content). The content of a page is loaded when it is opened.
 */
export function MaterialWorkspace({table, pages, onPagesChange, index, onIndexChange, canEdit, onCreatePage, progress, aside, emptyTitle}: MaterialWorkspaceProps) {
  const {supabase, user} = useAuth();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const current = pages[Math.min(index, pages.length - 1)];
  const {content, loading} = useMaterialContent(table, current?.id);
  const [, setVersion] = useState(0);

  const locked = useCallback((position: number) => {
    if (!progress?.linear || canEdit || position === 0) return false;
    return !progress.completed.has(pages[position - 1]?.id);
  }, [progress, canEdit, pages]);

  const go = async (position: number) => {
    if (position < 0 || position >= pages.length || locked(position)) return;
    if (dirty && !(await confirm({...DISCARD_CHANGES, description: "Mentetlen változások vannak ezen az oldalon."}))) return;
    setDirty(false);
    onIndexChange(position);
  };

  const patch = async (id: string, values: Partial<MaterialPage>) => {
    const previous = pages;
    onPagesChange(pages.map((page) => page.id === id ? {...page, ...values} : page));
    const {error} = await supabase.from(table).update(values).eq("id", id);
    if (error) {
      onPagesChange(previous);
      toast.error("A mentés nem sikerült: " + errorMessage(error));
    }
  };

  const move = async (position: number, delta: number) => {
    const target = position + delta;
    if (target < 0 || target >= pages.length) return;
    const next = [...pages];
    [next[position], next[target]] = [next[target], next[position]];
    const ordered = next.map((page, order) => ({...page, page_order: order + 1}));
    const previous = pages;
    onPagesChange(ordered);
    if (index === position) onIndexChange(target);
    try {
      await academyApi.reorder(table === "academy_materials" ? "basic" : "course", ordered.map((page) => page.id));
    } catch (error) {
      onPagesChange(previous);
      toast.error("A sorrend mentése nem sikerült: " + errorMessage(error));
    }
  };

  const remove = async (page: MaterialPage) => {
    if (!(await confirm({title: "Oldal törlése", description: `„${page.title}” tartalma és képei végleg elvesznek.`, confirmLabel: "Törlés", destructive: true, kind: "delete"}))) return;
    setBusy(true);
    try {
      const images = extractImageUrls(await fetchMaterialContent(table, page.id));
      const {error} = await supabase.from(table).delete().eq("id", page.id);
      if (error) throw error;
      forgetMaterialContent(table, page.id);
      void deleteCloudinaryAssets(images);
      const remaining = pages.filter((item) => item.id !== page.id).map((item, order) => ({...item, page_order: order + 1}));
      onPagesChange(remaining);
      if (remaining.length) await academyApi.reorder(table === "academy_materials" ? "basic" : "course", remaining.map((item) => item.id));
      onIndexChange(Math.max(0, Math.min(index, remaining.length - 1)));
      toast.success("Oldal törölve.");
    } catch (error) {
      toast.error("A törlés nem sikerült: " + errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    setBusy(true);
    try {
      const page = await onCreatePage();
      setMaterialContent(table, page.id, []);
      onPagesChange([...pages, page]);
      onIndexChange(pages.length);
      setEditing(true);
      toast.success("Új oldal létrehozva.");
    } catch (error) {
      toast.error("Az oldal létrehozása nem sikerült: " + errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const saveContent = async (next: unknown) => {
    if (!current) return;
    const values: Record<string, unknown> = {content: next, updated_at: new Date().toISOString()};
    if (table === "academy_materials" && user) values.last_editor_id = user.id;
    const {error} = await supabase.from(table).update(values).eq("id", current.id);
    if (error) throw error;
    setMaterialContent(table, current.id, next);
    setVersion((version) => version + 1);
  };

  const completed = progress ? pages.filter((page) => progress.completed.has(page.id)).length : 0;
  const currentDone = !!current && !!progress?.completed.has(current.id);
  const position = current ? pages.indexOf(current) : -1;

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-3 lg:sticky lg:top-20">
        {aside}
        <nav className="panel overflow-hidden" aria-label="Tartalomjegyzék" data-tour="material-pages">
          <header className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Tartalom</p>
            {progress && pages.length > 0 && <span className="ml-auto text-[11px] text-slate-400 tabular-nums">{completed}/{pages.length}</span>}
            {canEdit && (
              <Button size="sm" variant={editing ? "default" : "ghost"} className={cn("h-7 px-2 text-xs", !progress && "ml-auto")} data-tour="material-edit"
                      onClick={async () => {
                        if (editing && dirty && !(await confirm({...DISCARD_CHANGES, title: "Kilépsz a szerkesztésből?"}))) return;
                        setEditing(!editing);
                        setDirty(false);
                      }}>
                <PencilLine/> {editing ? "Kész" : "Szerkesztés"}
              </Button>
            )}
          </header>
          {progress && pages.length > 0 && (
            <div className="h-1 bg-white/[0.04]"><div className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all" style={{width: `${(completed / pages.length) * 100}%`}}/></div>
          )}
          <ol className="max-h-[60vh] space-y-1 overflow-y-auto p-2">
            {pages.map((page, order) => {
              const isLocked = locked(order);
              const done = !!progress?.completed.has(page.id);
              const active = page.id === current?.id;
              return (
                <li key={page.id} style={{"--i": Math.min(order, 12)} as CSSProperties} className="animate-fade">
                  <div className={cn("group flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors",
                    active ? "bg-cyan-500/10 ring-1 ring-cyan-500/30" : "hover:bg-white/[0.04]", isLocked && "opacity-50")}>
                    <button type="button" disabled={isLocked} onClick={() => go(order)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left disabled:cursor-not-allowed">
                      <span className="shrink-0">
                        {isLocked ? <Lock className="size-4 text-slate-500"/> : done ? <CheckCircle2 className="size-4 text-emerald-400"/>
                          : <Circle className={cn("size-4", active ? "text-cyan-300" : "text-slate-600")}/>}
                      </span>
                      <span className="min-w-0">
                        <span className={cn("block truncate text-sm", active ? "font-medium text-white" : "text-slate-300")}>{page.title}</span>
                        <span className="block text-[10px] text-slate-500">{order + 1}. oldal</span>
                      </span>
                    </button>
                    {editing && (
                      <span className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <button type="button" aria-label="Feljebb" disabled={order === 0 || busy} onClick={() => void move(order, -1)}
                                className="rounded p-1 text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-30"><ArrowUp className="size-3.5"/></button>
                        <button type="button" aria-label="Lejjebb" disabled={order === pages.length - 1 || busy} onClick={() => void move(order, 1)}
                                className="rounded p-1 text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-30"><ArrowDown className="size-3.5"/></button>
                        <button type="button" aria-label="Törlés" disabled={busy} onClick={() => void remove(page)}
                                className="rounded p-1 text-red-300 hover:bg-red-500/10"><Trash2 className="size-3.5"/></button>
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
            {pages.length === 0 && <li className="px-3 py-6 text-center text-xs text-slate-500">Még nincs oldal.</li>}
          </ol>
          {editing && (
            <div className="border-t border-white/5 p-2">
              <Button variant="ghost" size="sm" className="w-full" disabled={busy} onClick={() => void create()}>
                {busy ? <Loader2 className="animate-spin"/> : <FilePlus2/>} Új oldal
              </Button>
            </div>
          )}
        </nav>
      </aside>

      <section className="min-w-0 space-y-4">
        {!current ? (
          <div className="panel">
            <EmptyState icon={BookOpenCheck} title={emptyTitle}
                        description={canEdit ? "Kezdd el az első oldallal: a Szerkesztés gombbal vagy itt." : "A tananyag feltöltése folyamatban van."}
                        action={canEdit ? <Button onClick={() => void create()} disabled={busy}><FilePlus2/> Első oldal létrehozása</Button> : undefined}/>
          </div>
        ) : locked(position) ? (
          <div className="panel">
            <EmptyState icon={Lock} title="Ez az oldal még zárva van." description="Ebben a tananyagban sorrendben kell haladni: előbb teljesítsd az előző oldalt."/>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">{position + 1}. oldal / {pages.length}</p>
                {editing ? (
                  <Input key={current.id} defaultValue={current.title} maxLength={120} aria-label="Az oldal címe"
                         className="mt-1 h-11 text-xl font-semibold"
                         onBlur={(event) => {
                           const title = event.target.value.trim();
                           if (title && title !== current.title) void patch(current.id, {title});
                         }}/>
                ) : (
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white md:text-3xl wrap-anywhere">{current.title}</h2>
                )}
              </div>
              {editing && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm"><Palette/> {ACADEMY_THEMES[current.theme ?? "default"]?.label ?? "Kinézet"}</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {Object.entries(ACADEMY_THEMES).map(([key, look]) => (
                      <DropdownMenuItem key={key} onClick={() => void patch(current.id, {theme: key})}>{look.label}</DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {loading ? (
              <div className="panel grid h-80 place-items-center"><Loader2 className="size-7 animate-spin text-cyan-400"/></div>
            ) : (
              <AcademyEditor key={`${current.id}:${editing ? "edit" : "read"}`} pageId={current.id} initialContent={content}
                             readOnly={!editing} theme={current.theme ?? "default"} onSave={saveContent} onDirtyChange={setDirty}/>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button variant="outline" onClick={() => go(position - 1)} disabled={position === 0}><ChevronLeft/> Előző</Button>
              <div className="flex-1 text-center">
                {progress && !editing && (
                  currentDone ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/25">
                      <CheckCircle2 className="size-3.5"/> Elolvasva
                    </span>
                  ) : (
                    <Button disabled={busy} className="bg-cyan-500 text-black hover:bg-cyan-400" onClick={async () => {
                      setBusy(true);
                      try {
                        await progress.onComplete(current.id);
                        if (position < pages.length - 1) onIndexChange(position + 1);
                      } finally {
                        setBusy(false);
                      }
                    }}><CheckCircle2/> Elolvastam és megértettem</Button>
                  )
                )}
              </div>
              <Button variant="outline" onClick={() => go(position + 1)} disabled={position >= pages.length - 1 || locked(position + 1)}>
                Következő <ChevronRight/>
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
