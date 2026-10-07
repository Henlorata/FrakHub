import {useCallback, useEffect, useMemo, useState, type CSSProperties} from "react";
import {Link, useNavigate} from "react-router";
import {
  ArrowDownWideNarrow, CalendarClock, Check, ChevronRight, FilePlus2, FileText, FolderLock, FolderOpen, Fingerprint, Gavel, LayoutGrid, ListTodo, Lock,
  Paperclip, Rows3, Search, Siren, Sparkles, Trash2, Users, X,
} from "lucide-react";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {StatCard} from "@/components/layout/StatCard";
import {EmptyState} from "@/components/layout/EmptyState";
import {useAuth} from "@/context/AuthContext";
import {useSuspects} from "@/context/SuspectCacheContext";
import {useDialogParam} from "@/lib/use-dialog-param";
import {formatAgo, formatDate} from "@/lib/datetime";
import {
  CATEGORIES, CATEGORY, PRIORITIES, PRIORITY, WARRANT_SELECT, WARRANT_TYPE, canApproveWarrants, mcbApi, warrantTarget,
  type CaseListItem, type CaseSearchHit, type MyCaseTask,
} from "@/lib/mcb";
import {cn, errorMessage} from "@/lib/utils";
import type {CaseCategory, CasePriority, CaseWarrant} from "@/types/supabase";
import {NewCaseDialog} from "./components/NewCaseDialog";
import {CaseStatusChip, CategoryChip, MemberAvatar, PriorityChip} from "./components/McbBadges";

type StatusFilter = "open" | "closed" | "archived" | "all";
type SortKey = "updated" | "created" | "priority" | "number";

const VIEW_KEY = "frakhub.mcb.view";

const fold = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function McbDashboard() {
  const {supabase, profile} = useAuth();
  const navigate = useNavigate();
  const {suspects} = useSuspects();
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [archived, setArchived] = useState<CaseListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<CaseWarrant[]>([]);
  const [myTasks, setMyTasks] = useState<MyCaseTask[]>([]);
  const [status, setStatus] = useState<StatusFilter>("open");
  const [priority, setPriority] = useState<CasePriority | null>(null);
  const [category, setCategory] = useState<CaseCategory | "">("");
  const [mine, setMine] = useState(false);
  const [sort, setSort] = useState<SortKey>("updated");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CaseSearchHit[]>([]);
  const [view, setView] = useState<"cards" | "table">(() => (localStorage.getItem(VIEW_KEY) === "table" ? "table" : "cards"));
  const [newOpen, setNewOpen] = useDialogParam("new");
  const canApprove = canApproveWarrants(profile);

  const load = useCallback(async (force = false) => {
    try {
      setCases(await mcbApi.list(force));
    } catch (error) {
      toast.error("Az akták betöltése nem sikerült.", {description: errorMessage(error)});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  // The approval queue (approvers only; one query with the names the cards show).
  const loadPending = useCallback(async () => {
    if (!canApprove) return;
    const {data} = await supabase.from("case_warrants").select(WARRANT_SELECT).eq("status", "pending")
      .order("created_at", {ascending: true}).limit(30);
    setPending((data ?? []) as unknown as CaseWarrant[]);
  }, [canApprove, supabase]);

  useEffect(() => {
    void loadPending();
  }, [loadPending]);

  // The caller's open tasks across the cases (one small call).
  useEffect(() => {
    let active = true;
    mcbApi.myTasks().then((list) => active && setMyTasks(list)).catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  // Archived cases only when asked for.
  useEffect(() => {
    if ((status !== "archived" && status !== "all") || archived) return;
    mcbApi.listArchived().then((list) => setArchived(list.filter((item) => item.status === "archived")))
      .catch((error) => toast.error("Az archívum betöltése nem sikerült.", {description: errorMessage(error)}));
  }, [status, archived]);

  // Search in the documents (3+ characters, debounced).
  const term = query.trim();
  useEffect(() => {
    if (term.length < 3) {
      setHits([]);
      return;
    }
    const timer = setTimeout(() => {
      mcbApi.search(term).then((result) => setHits(result.filter((hit) => hit.match === "body"))).catch(() => setHits([]));
    }, 400);
    return () => clearTimeout(timer);
  }, [term]);

  const all = useMemo(() => [...cases, ...(archived ?? [])], [cases, archived]);
  const counts = useMemo(() => ({
    open: cases.filter((item) => item.status === "open").length,
    closed: cases.filter((item) => item.status === "closed").length,
    archived: archived?.length ?? null,
  }), [cases, archived]);

  const visible = useMemo(() => {
    const needle = fold(term);
    const rows = all.filter((item) => (status === "all" || item.status === status)
      && (!priority || item.priority === priority)
      && (!category || item.category === category)
      && (!mine || item.my_role !== null)
      && (!needle || [item.title, item.case_number, item.owner_name ?? "", item.description ?? ""].some((value) => fold(value).includes(needle))));
    const byPriority = (item: CaseListItem) => PRIORITY[item.priority]?.order ?? 9;
    return rows.sort((a, b) => sort === "priority" ? byPriority(a) - byPriority(b) || b.updated_at.localeCompare(a.updated_at)
      : sort === "created" ? b.created_at.localeCompare(a.created_at)
        : sort === "number" ? b.case_number.localeCompare(a.case_number, "hu", {numeric: true})
          : b.updated_at.localeCompare(a.updated_at));
  }, [all, status, priority, category, mine, term, sort]);

  const myOpen = useMemo(() => cases.filter((item) => item.status === "open" && item.my_role !== null)
    .sort((a, b) => (PRIORITY[a.priority].order - PRIORITY[b.priority].order) || b.updated_at.localeCompare(a.updated_at)), [cases]);
  const urgent = cases.filter((item) => item.status === "open" && (item.priority === "critical" || item.priority === "high")).length;
  const activeWarrants = cases.reduce((sum, item) => sum + item.warrants_active, 0);
  const wanted = suspects.filter((suspect) => suspect.status === "wanted").length;

  const open = (item: Pick<CaseListItem, "id" | "can_open">) => {
    if (!item.can_open) {
      toast.info("Ezt az aktát csak a tulajdonosa, a közreműködői és az MCB vezetése nyithatja meg.");
      return;
    }
    navigate(`/mcb/case/${item.id}`);
  };

  const decide = async (warrant: CaseWarrant, decision: "approved" | "rejected") => {
    try {
      await mcbApi.decideWarrant(warrant.id, decision);
      toast.success(decision === "approved" ? "Parancs jóváhagyva." : "Kérelem elutasítva.");
      setPending((list) => list.filter((item) => item.id !== warrant.id));
      mcbApi.invalidateList();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const resetFilters = () => {
    setPriority(null);
    setCategory("");
    setMine(false);
    setQuery("");
  };
  const filtered = !!priority || !!category || mine || !!term;

  return (
    <div className="flex flex-col gap-6">
      <NewCaseDialog open={newOpen} onOpenChange={setNewOpen} onCreated={() => mcbApi.invalidateList()}/>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard index={0} label="Saját nyitott aktáim" value={myOpen.length} icon={FolderOpen} tone="blue"
                  onClick={() => {
                    setStatus("open");
                    setMine(true);
                  }}/>
        <StatCard index={1} label="Nyitott akták" value={counts.open} icon={FileText} tone="emerald" onClick={() => {
          resetFilters();
          setStatus("open");
        }}/>
        <StatCard index={2} label="Kritikus / magas prioritás" value={urgent} icon={Siren} tone="red"
                  onClick={() => {
                    setStatus("open");
                    setSort("priority");
                  }}/>
        {canApprove ? (
          <StatCard index={3} label="Jóváhagyásra váró parancs" value={pending.length} icon={Gavel} tone="orange"
                    onClick={() => navigate("/mcb/warrants")}/>
        ) : (
          <StatCard index={3} label="Érvényes parancsok" value={activeWarrants} icon={Gavel} tone="orange"
                    onClick={() => navigate("/mcb/warrants")}/>
        )}
        <StatCard index={4} label="Körözött személyek" value={wanted} icon={Fingerprint} tone="violet" className="col-span-2 lg:col-span-1"
                  onClick={() => navigate("/mcb/suspects?status=wanted")}/>
      </div>

      {myTasks.length > 0 && (
        <section className="panel animate-rise p-4" style={{"--i": 1} as CSSProperties} data-tour="mcb-my-tasks">
          <header className="mb-3 flex items-center gap-2">
            <ListTodo className="size-4 text-emerald-300"/>
            <h2 className="text-sm font-semibold text-white">Saját teendőim</h2>
            <span className="text-xs text-slate-500">
              · {myTasks.length} nyitott{myTasks.some((task) => task.overdue) ? `, ${myTasks.filter((task) => task.overdue).length} lejárt` : ""}
            </span>
          </header>
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-3">
            {myTasks.slice(0, 9).map((task) => (
              <li key={task.id}>
                <Link to={`/mcb/case/${task.case.id}`}
                      className="flex min-w-0 items-start gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10 transition-colors hover:bg-white/[0.06]">
                  <CalendarClock className={cn("mt-0.5 size-4 shrink-0", task.overdue ? "text-red-300" : "text-slate-500")}/>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm wrap-anywhere text-slate-100">{task.title}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                      <span className="font-mono text-sky-300/80">{task.case.case_number}</span> · {task.case.title}
                      {task.due_on && <span className={cn(task.overdue && "text-red-300")}> · {task.overdue ? "lejárt: " : "határidő: "}{formatDate(task.due_on)}</span>}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(myOpen.length > 0 || (canApprove && pending.length > 0)) && (
        <div className={cn("grid grid-cols-1 gap-4", canApprove && pending.length > 0 && myOpen.length > 0 && "xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]")}>
          {myOpen.length > 0 && (
            <section className="panel animate-rise p-4" style={{"--i": 2} as CSSProperties} data-tour="mcb-desk">
              <header className="mb-3 flex items-center gap-2">
                <Sparkles className="size-4 text-sky-300"/>
                <h2 className="text-sm font-semibold text-white">Az asztalomon</h2>
                <span className="text-xs text-slate-500">· nyitott akták, ahol tulajdonos vagy közreműködő vagy</span>
              </header>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {myOpen.slice(0, 6).map((item, index) => (
                  <button key={item.id} type="button" onClick={() => open(item)} style={{"--i": index} as CSSProperties} data-tour="mcb-case" data-case-id={item.id}
                          className="lift animate-rise group flex min-w-0 items-start gap-3 rounded-xl bg-white/[0.03] p-3 text-left ring-1 ring-white/10">
                    <span className={cn("mt-1 h-10 w-1 shrink-0 rounded-full", PRIORITY[item.priority].dot)}/>
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-[11px] text-sky-300/80">{item.case_number}</span>
                      <span className="block truncate text-sm font-semibold text-white group-hover:text-sky-200">{item.title}</span>
                      <span className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                        <span>{item.my_role === "owner" ? "Vezető nyomozó" : item.my_role === "editor" ? "Szerkesztő" : "Megtekintő"}</span>
                        <span>·</span>
                        <span>{formatAgo(item.updated_at)}</span>
                      </span>
                    </span>
                    <ChevronRight className="mt-3 size-4 shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-sky-300"/>
                  </button>
                ))}
              </div>
            </section>
          )}

          {canApprove && pending.length > 0 && (
            <section className="panel animate-rise overflow-hidden p-0 ring-1 ring-amber-500/20" style={{"--i": 3} as CSSProperties}>
              <header className="flex items-center gap-2 border-b border-amber-500/15 bg-amber-500/[0.06] px-4 py-3">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-60"/>
                  <span className="relative inline-flex size-2.5 rounded-full bg-amber-400"/>
                </span>
                <h2 className="text-sm font-semibold text-amber-100">Jóváhagyásra vár</h2>
                <span className="rounded-full bg-amber-500/15 px-2 text-xs text-amber-200">{pending.length}</span>
                <Link to="/mcb/warrants" className="ml-auto text-xs text-amber-200/80 hover:text-amber-100">Mind <ChevronRight className="inline size-3"/></Link>
              </header>
              <ul className="max-h-[260px] divide-y divide-white/5 overflow-y-auto">
                {pending.slice(0, 8).map((warrant) => {
                  const type = WARRANT_TYPE[warrant.type];
                  const own = warrant.requested_by === profile?.id;
                  return (
                    <li key={warrant.id} className="flex items-center gap-3 px-4 py-2.5">
                      <type.icon className={cn("size-4 shrink-0", type.accent)}/>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-100">{warrantTarget(warrant)}</p>
                        <p className="truncate text-[11px] text-slate-500">{type.short} · {warrant.case?.case_number} · {warrant.reason}</p>
                      </div>
                      <Button size="icon" variant="ghost" disabled={own} title={own ? "Saját kérelmet nem bírálhatsz el." : "Elutasítás"}
                              className="size-8 text-red-300 hover:bg-red-500/15" onClick={() => void decide(warrant, "rejected")}>
                        <X className="size-4"/>
                      </Button>
                      <Button size="sm" disabled={own} title={own ? "Saját kérelmet nem bírálhatsz el." : undefined}
                              className="h-8 bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => void decide(warrant, "approved")}>
                        <Check className="size-4"/> Jóváhagyás
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      )}

      <section className="flex flex-col gap-3" data-tour="mcb-cases">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="flex w-full items-center gap-1 overflow-x-auto rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/10 xl:w-auto">
            {([
              ["open", "Folyamatban", counts.open],
              ["closed", "Lezárva", counts.closed],
              ["archived", "Archívum", counts.archived],
              ["all", "Összes", null],
            ] as const).map(([value, label, count]) => (
              <button key={value} type="button" onClick={() => setStatus(value)}
                      className={cn("flex h-8 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
                        status === value ? "bg-white/10 text-white" : "text-slate-400 hover:text-white")}>
                {label}
                {count !== null && <span className="rounded-md bg-white/10 px-1.5 text-[11px] tabular-nums text-slate-300">{count}</span>}
              </button>
            ))}
          </div>

          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
            <Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 pl-9"
                   placeholder="Keresés: cím, ügyszám, nyomozó, az akták szövege"/>
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Keresés törlése"
                      className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-slate-400 hover:bg-white/10">
                <X className="size-3.5"/>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} aria-label="Rendezés"
                    className="h-10 rounded-lg border bg-white/[0.03] px-3 text-sm text-slate-200">
              <option value="updated">Legutóbb módosított</option>
              <option value="created">Legújabb</option>
              <option value="priority">Prioritás szerint</option>
              <option value="number">Ügyszám szerint</option>
            </select>
            <div className="flex rounded-lg bg-white/[0.04] p-1 ring-1 ring-white/10">
              <button type="button" aria-label="Kártyák" onClick={() => {
                setView("cards");
                localStorage.setItem(VIEW_KEY, "cards");
              }} className={cn("grid size-8 place-items-center rounded-md", view === "cards" ? "bg-white/10 text-white" : "text-slate-500")}>
                <LayoutGrid className="size-4"/>
              </button>
              <button type="button" aria-label="Táblázat" onClick={() => {
                setView("table");
                localStorage.setItem(VIEW_KEY, "table");
              }} className={cn("grid size-8 place-items-center rounded-md", view === "table" ? "bg-white/10 text-white" : "text-slate-500")}>
                <Rows3 className="size-4"/>
              </button>
            </div>
            <Button asChild size="icon" variant="ghost" className="size-10" title="Lomtár" aria-label="Lomtár">
              <Link to="/mcb/trash"><Trash2 className="size-4"/></Link>
            </Button>
            <Button onClick={() => setNewOpen(true)} data-tour="mcb-new-case" className="h-10 bg-sky-600 text-white shadow-[0_0_24px_-6px_rgb(14_165_233/0.8)] hover:bg-sky-500">
              <FilePlus2 className="size-4"/> Új akta
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PRIORITIES.map((value) => (
            <button key={value} type="button" onClick={() => setPriority(priority === value ? null : value)}
                    className={cn("inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs ring-1 transition",
                      priority === value ? PRIORITY[value].chip : "text-slate-400 ring-white/10 hover:text-white")}>
              <span className={cn("size-1.5 rounded-full", PRIORITY[value].dot)}/>{PRIORITY[value].label}
            </button>
          ))}
          <select value={category} onChange={(event) => setCategory(event.target.value as CaseCategory | "")} aria-label="Ügytípus"
                  className="h-7 rounded-full border bg-white/[0.03] px-3 text-xs text-slate-300">
            <option value="">Minden ügytípus</option>
            {CATEGORIES.map((value) => <option key={value} value={value}>{CATEGORY[value].label}</option>)}
          </select>
          <button type="button" onClick={() => setMine(!mine)}
                  className={cn("inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs ring-1 transition",
                    mine ? "bg-sky-500/15 text-sky-200 ring-sky-500/30" : "text-slate-400 ring-white/10 hover:text-white")}>
            <Users className="size-3.5"/> Csak az enyémek
          </button>
          {filtered && (
            <button type="button" onClick={resetFilters} className="text-xs text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline">
              Szűrők törlése
            </button>
          )}
          <span className="ml-auto text-xs text-slate-500">{visible.length} akta</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({length: 8}, (_, index) => <div key={index} className="skeleton h-44 rounded-2xl"/>)}
          </div>
        ) : visible.length === 0 && hits.length > 0 ? (
          <p className="panel px-4 py-3 text-sm text-slate-400">A címek és összefoglalók között nincs találat, a dokumentumok szövegében viszont igen (lent).</p>
        ) : visible.length === 0 ? (
          <div className="panel">
            <EmptyState icon={FolderOpen} title={filtered ? "Nincs a szűrésnek megfelelő akta" : "Ebben a nézetben nincs akta"}
                        description={filtered ? "Próbálj más szűrőt vagy keresést." : "Új nyomozást az „Új akta” gombbal indíthatsz."}
                        action={filtered ? <Button variant="outline" size="sm" onClick={resetFilters}>Szűrők törlése</Button> : undefined}/>
          </div>
        ) : view === "cards" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visible.map((item, index) => <CaseCard key={item.id} item={item} index={index} onOpen={() => open(item)}/>)}
          </div>
        ) : (
          <CaseTable rows={visible} onOpen={open}/>
        )}

        {hits.length > 0 && (
          <section className="panel animate-rise p-4">
            <header className="mb-3 flex items-center gap-2">
              <FileText className="size-4 text-amber-300"/>
              <h2 className="text-sm font-semibold text-white">Találatok az akták szövegében</h2>
              <span className="text-xs text-slate-500">· „{term}”</span>
            </header>
            <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              {hits.map((hit) => (
                <li key={hit.id}>
                  <button type="button" onClick={() => open(hit)}
                          className="lift flex w-full min-w-0 flex-col gap-1 rounded-xl bg-white/[0.03] p-3 text-left ring-1 ring-white/10">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="font-mono text-[11px] text-sky-300/80">{hit.case_number}</span>
                      <span className="truncate text-sm font-medium text-white">{hit.title}</span>
                    </span>
                    {hit.snippet && <Snippet text={hit.snippet} term={term}/>}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </section>
    </div>
  );
}

function Snippet({text, term}: {text: string; term: string}) {
  const index = text.toLowerCase().indexOf(term.toLowerCase());
  if (index < 0) return <p className="line-clamp-2 text-xs text-slate-400 wrap-anywhere">…{text}…</p>;
  return (
    <p className="line-clamp-2 text-xs text-slate-400 wrap-anywhere">
      …{text.slice(0, index)}
      <mark className="rounded bg-amber-400/25 px-0.5 text-amber-100">{text.slice(index, index + term.length)}</mark>
      {text.slice(index + term.length)}…
    </p>
  );
}

function CaseCard({item, index, onOpen}: {item: CaseListItem; index: number; onOpen: () => void}) {
  const priority = PRIORITY[item.priority] ?? PRIORITY.medium;
  return (
    <button type="button" onClick={onOpen} style={{"--i": Math.min(index, 12)} as CSSProperties} data-tour="mcb-case" data-case-id={item.id}
            className={cn("panel lift animate-rise group relative flex min-w-0 flex-col overflow-hidden p-0 text-left",
              item.status !== "open" && "opacity-80 hover:opacity-100", !item.can_open && "cursor-not-allowed")}>
      <span className={cn("absolute inset-x-0 top-0 h-0.5", priority.dot, item.priority === "critical" && "shadow-[0_0_12px_rgb(239_68_68)]")}/>
      <div className="flex items-center gap-2 px-4 pt-4">
        <span className="case-tab bg-sky-500/10 py-0.5 pr-5 pl-2 font-mono text-[11px] font-semibold text-sky-300">{item.case_number}</span>
        <span className="ml-auto flex items-center gap-1.5">
          {!item.can_open && <Lock className="size-3.5 text-slate-500"/>}
          <CaseStatusChip status={item.status}/>
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col px-4 pt-3 pb-3">
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-white wrap-anywhere group-hover:text-sky-100">{item.title}</h3>
        {item.description && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400 wrap-anywhere">{item.description}</p>}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <PriorityChip priority={item.priority}/>
          <CategoryChip category={item.category}/>
          {item.warrants_pending > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300 ring-1 ring-amber-500/30">
              <Gavel className="size-3"/> {item.warrants_pending} kérelem
            </span>
          )}
        </div>
      </div>
      <div className="mt-auto flex items-center gap-3 border-t border-white/5 bg-white/[0.02] px-4 py-2.5 text-[11px] text-slate-500">
        <MemberAvatar url={item.owner_avatar} name={item.owner_name} size={22}/>
        <span className="min-w-0 flex-1 truncate text-slate-300">{item.owner_name ?? "Nincs tulajdonos"}</span>
        <span className="flex items-center gap-1" title="Bizonyítékok"><Paperclip className="size-3"/>{item.evidence}</span>
        <span className="flex items-center gap-1" title="Érintett személyek"><Fingerprint className="size-3"/>{item.people}</span>
        <span title={formatDate(item.updated_at)}>{formatAgo(item.updated_at)}</span>
      </div>
    </button>
  );
}

function CaseTable({rows, onOpen}: {rows: CaseListItem[]; onOpen: (item: CaseListItem) => void}) {
  return (
    <div className="panel overflow-x-auto p-0">
      <table className="w-full min-w-[920px] text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-[11px] tracking-wider text-slate-500 uppercase">
            <th className="px-4 py-3 font-medium">Ügyszám</th>
            <th className="px-4 py-3 font-medium">Megnevezés</th>
            <th className="px-4 py-3 font-medium">Státusz</th>
            <th className="px-4 py-3 font-medium">Prioritás</th>
            <th className="px-4 py-3 font-medium">Vezető nyomozó</th>
            <th className="px-4 py-3 font-medium"><span className="sr-only">Számok</span></th>
            <th className="px-4 py-3 text-right font-medium"><ArrowDownWideNarrow className="ml-auto size-3.5"/></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((item) => (
            <tr key={item.id} onClick={() => onOpen(item)} data-tour="mcb-case" data-case-id={item.id}
                className={cn("cursor-pointer transition-colors hover:bg-sky-500/[0.05]", item.status !== "open" && "opacity-75")}>
              <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-sky-300">{item.case_number}</td>
              <td className="max-w-[420px] px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  {!item.can_open && <FolderLock className="size-3.5 shrink-0 text-slate-500"/>}
                  <span className="truncate font-medium text-white">{item.title}</span>
                </div>
                {item.category && <span className="text-[11px] text-slate-500">{CATEGORY[item.category]?.label}</span>}
              </td>
              <td className="px-4 py-3"><CaseStatusChip status={item.status}/></td>
              <td className="px-4 py-3"><PriorityChip priority={item.priority}/></td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <MemberAvatar url={item.owner_avatar} name={item.owner_name} size={22}/>
                  <span className="truncate text-xs text-slate-300">{item.owner_name ?? "–"}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-xs whitespace-nowrap text-slate-500">
                <span className="mr-3 inline-flex items-center gap-1"><Paperclip className="size-3"/>{item.evidence}</span>
                <span className="inline-flex items-center gap-1"><Fingerprint className="size-3"/>{item.people}</span>
              </td>
              <td className="px-4 py-3 text-right text-xs whitespace-nowrap text-slate-500">{formatAgo(item.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
