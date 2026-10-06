import {useCallback, useDeferredValue, useEffect, useMemo, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {useNavigate} from "react-router";
import {toast} from "sonner";
import {ClipboardCheck, ClipboardList, Gavel, History, ListTree, PanelLeftClose, PanelLeftOpen, Search, Star, X} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Drawer, DrawerContent, DrawerTitle} from "@/components/ui/drawer";
import {PageHeader} from "@/components/layout/PageHeader";
import {useAuth} from "@/context/AuthContext";
import {useLocalStorage} from "@/hooks/use-local-storage";
import {useMediaQuery} from "@/hooks/use-media-query";
import {formatCurrency} from "@/lib/penalcode-processor";
import {cn} from "@/lib/utils";
import type {ReportPrefill} from "@/pages/reports/ReportGenerator";
import {
  arrestCommand, CATEGORIES, chargesText, clamp, filterCategories, hasLegacyIds, itemCount, ITEMS, migrateIds, refreshCart, summarize,
  ticketReasons, type CartItem, type HistorySnapshot, type Template,
} from "./penal-data";
import {categoryAnchor, ItemList} from "./ItemList";
import {SentencePanel} from "./SentencePanel";
import {HistoryDialog, SaveTemplateDialog, TemplatesDialog} from "./CalculatorDialogs";
import {PenalChangesBanner} from "./PenalChangesBanner";

const MAX_HISTORY = 10;
/** The same copy within this time is logged to the activity feed only once. */
const LOG_DEDUPE_MS = 75_000;

type CopyTarget = "fine" | "reasons" | "arrest" | "ticket";

/**
 * Penal code calculator: pick offences, set the sentence within the ranges, copy the in-game
 * ticket/arrest commands, or hand the result to the report generator. Favourites, templates and
 * history stay in the browser (same keys as before, so saved data carries over).
 */
export function CalculatorPage() {
  const {user, supabase} = useAuth();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const searchRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sidebar, setSidebar] = useLocalStorage<boolean>("sfsd_cat_sidebar_v4", true);
  const [favoriteIds, setFavoriteIds] = useLocalStorage<string[]>("sfsd_favorites", []);
  const [history, setHistory] = useLocalStorage<HistorySnapshot[]>("sfsd_history", []);
  const [templates, setTemplates] = useLocalStorage<Template[]>("sfsd_templates", []);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const [cart, setCart] = useState<CartItem[]>([]);
  // null: follow the maximum of the range (the previous default).
  const [fineChoice, setFineChoice] = useState<number | null>(null);
  const [jailChoice, setJailChoice] = useState<number | null>(null);
  const [targetId, setTargetId] = useState("");
  const [copied, setCopied] = useState<CopyTarget | null>(null);
  const [dialog, setDialog] = useState<"save" | "history" | "templates" | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const lastLog = useRef<{key: string; time: number} | null>(null);

  // Favourites saved with the old sequential ids.
  const favorites = useMemo(() => hasLegacyIds(favoriteIds) ? migrateIds(favoriteIds) : favoriteIds, [favoriteIds]);
  useEffect(() => {
    if (favorites !== favoriteIds) setFavoriteIds(favorites);
  }, [favorites, favoriteIds, setFavoriteIds]);
  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);

  // "/" jumps to the search.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== "/" || target?.closest("input, textarea, [contenteditable=true]")) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const categories = useMemo(() => filterCategories(deferredSearch, favoritesOnly ? favorites : null), [deferredSearch, favoritesOnly, favorites]);
  const summary = useMemo(() => summarize(cart), [cart]);
  const fine = cart.length ? clamp(fineChoice ?? summary.maxFine, summary.minFine, summary.maxFine) : 0;
  const jail = cart.length ? clamp(jailChoice ?? summary.maxJail, summary.minJail, summary.maxJail) : 0;
  const reasons = useMemo(() => ticketReasons(cart), [cart]);
  const arrest = useMemo(() => arrestCommand(cart, targetId, jail), [cart, targetId, jail]);
  const quantities = useMemo(() => new Map(cart.map((entry) => [entry.item.id, entry.quantity])), [cart]);
  const count = cart.reduce((sum, entry) => sum + entry.quantity, 0);

  const add = useCallback((id: string) => {
    const item = ITEMS.get(id);
    if (!item) return;
    setCart((current) => current.some((entry) => entry.item.id === id)
      ? current.map((entry) => entry.item.id === id ? {...entry, quantity: entry.quantity + 1} : entry)
      : [...current, {item, quantity: 1}]);
  }, []);
  const change = useCallback((id: string, delta: number) => {
    setCart((current) => current
      .map((entry) => entry.item.id === id ? {...entry, quantity: entry.quantity + delta} : entry)
      .filter((entry) => entry.quantity > 0));
  }, []);
  const toggleFavorite = useCallback((id: string) => {
    setFavoriteIds((current) => current.includes(id) ? current.filter((other) => other !== id) : [...current, id]);
  }, [setFavoriteIds]);
  const toggle = useCallback((key: string) => {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const clear = () => {
    setCart([]);
    setFineChoice(null);
    setJailChoice(null);
    setTargetId("");
  };

  const jumpTo = (name: string) => {
    setSearch("");
    setFavoritesOnly(false);
    setOpen((current) => new Set(current).add(name));
    window.setTimeout(() => document.getElementById(categoryAnchor(name))?.scrollIntoView({behavior: "smooth", block: "start"}), 60);
  };

  // The dashboard's activity feed (deduplicated: the same copy is logged once per 75 s).
  const logAction = (type: "ticket" | "arrest", details: string) => {
    if (!user) return;
    const key = `${type}|${details}`;
    const now = Date.now();
    if (lastLog.current && lastLog.current.key === key && now - lastLog.current.time < LOG_DEDUPE_MS) return;
    lastLog.current = {key, time: now};
    void supabase.from("action_logs").insert({user_id: user.id, action_type: type, details}).then(({error}) => {
      if (error) console.error("Log error:", error);
    });
  };

  const remember = () => {
    if (!cart.length) return;
    const snapshot: HistorySnapshot = {cart: structuredClone(cart), finalFine: fine, finalJail: jail, reasons, timestamp: new Date().toISOString()};
    setHistory((current) => {
      const latest = current[0];
      if (latest && latest.reasons === snapshot.reasons && latest.finalFine === snapshot.finalFine && latest.finalJail === snapshot.finalJail) return current;
      return [snapshot, ...current].slice(0, MAX_HISTORY);
    });
  };

  const copy = async (what: CopyTarget) => {
    const text = what === "fine" ? String(fine) : what === "reasons" ? reasons : what === "arrest" ? arrest : "/ticket";
    if (!text) return toast.error("Nincs mit másolni.");
    await navigator.clipboard.writeText(text);
    setCopied(what);
    window.setTimeout(() => setCopied((current) => current === what ? null : current), 2000);
    if (what === "ticket") return toast.success("/ticket másolva.");
    remember();
    if (what === "arrest") {
      logAction("arrest", `${jail} perc - Indokok: ${reasons}`);
      toast.success("arrest parancs másolva.");
    } else {
      logAction("ticket", `Bírság: ${formatCurrency(fine)} - Indok: ${reasons}`);
      toast.success(what === "fine" ? "Bírság összege másolva." : "Indokok másolva.");
    }
  };

  const toReport = () => {
    const prefill: ReportPrefill = {charges: chargesText(cart), fine: fine > 0 ? String(fine) : "-", jailTime: jail > 0 ? String(jail) : "-"};
    remember();
    navigate("/reports", {state: {prefill}});
  };

  const loadHistory = (snapshot: HistorySnapshot) => {
    setCart(refreshCart(snapshot.cart));
    setFineChoice(snapshot.finalFine);
    setJailChoice(snapshot.finalJail);
    setDialog(null);
    setDrawerOpen(false);
    toast.info("Előzmény betöltve.");
  };

  const loadTemplate = (template: Template) => {
    setCart((current) => {
      const next = [...current];
      refreshCart(template.cart).forEach((entry) => {
        const index = next.findIndex((existing) => existing.item.id === entry.item.id);
        if (index >= 0) next[index] = {...next[index], quantity: next[index].quantity + entry.quantity};
        else next.push(entry);
      });
      return next;
    });
    if (template.savedFine > 0) setFineChoice(template.savedFine);
    if (template.savedJail > 0) setJailChoice(template.savedJail);
    setDialog(null);
    setDrawerOpen(false);
    toast.info("Sablon hozzáadva.");
  };

  const panel = (
    <SentencePanel cart={cart} summary={summary} fine={fine} jail={jail} onFine={setFineChoice} onJail={setJailChoice} onChange={change}
                   onClear={clear} onSaveTemplate={() => setDialog("save")} reasons={reasons} arrest={arrest} targetId={targetId}
                   onTargetId={setTargetId} copied={copied} onCopy={(what) => void copy(what)} onReport={toReport}/>
  );

  return (
    <div className="mx-auto w-full max-w-[1700px] space-y-6 pb-24 lg:pb-10">
      <PageHeader icon={Gavel} tone="red" eyebrow="Eszközök" title="Büntető kalkulátor"
                  description="Válaszd ki a tételeket: a bírság, a fegyház és a játékbeli parancsok azonnal összeállnak."
                  actions={(
                    <>
                      <Button variant="outline" onClick={() => setDialog("history")}><History/> Előzmények</Button>
                      <Button variant="outline" onClick={() => setDialog("templates")}><ClipboardCheck/> Sablonok</Button>
                    </>
                  )}/>

      <PenalChangesBanner/>

      <div className={cn("grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]",
        sidebar ? "2xl:grid-cols-[240px_minmax(0,1fr)_420px]" : "2xl:grid-cols-[minmax(0,1fr)_440px]")}>
        {sidebar && (
          <nav className="panel sticky top-20 hidden max-h-[calc(100dvh-6rem)] overflow-y-auto p-2 2xl:block" aria-label="Kategóriák">
            <p className="flex items-center gap-1.5 px-2 pt-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500"><ListTree className="size-3.5"/> Kategóriák</p>
            {CATEGORIES.map((category) => (
              <button key={category.kategoria_nev} type="button" onClick={() => jumpTo(category.kategoria_nev)}
                      className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                        open.has(category.kategoria_nev) ? "bg-white/[0.07] text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200")}>
                <span className="min-w-0 flex-1 leading-snug wrap-anywhere">{category.kategoria_nev}</span>
                <span className="text-[11px] text-slate-600 tabular-nums">{itemCount(category)}</span>
              </button>
            ))}
          </nav>
        )}

        <div className="min-w-0 space-y-4">
          <div data-tour="calc-search" className="panel sticky top-[4.25rem] z-20 flex items-center gap-2 p-2">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
              <input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)}
                     placeholder="Keresés: név, rövidítés, paragrafus…  ( / )" aria-label="Keresés a tételek között"
                     className="h-10 w-full bg-transparent pr-8 pl-10 text-sm text-slate-100 outline-none placeholder:text-slate-500"/>
              {search && (
                <button type="button" onClick={() => setSearch("")} aria-label="Keresés törlése"
                        className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-300"><X className="size-4"/></button>
              )}
            </div>
            <Button variant="ghost" size="sm" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly((value) => !value)}
                    className={cn(favoritesOnly && "bg-amber-500/10 text-amber-300 hover:bg-amber-500/15")}>
              <Star className={cn(favoritesOnly && "fill-amber-300")}/> Kedvencek{favorites.length ? ` (${favorites.length})` : ""}
            </Button>
            <Button variant="ghost" size="icon" className="hidden 2xl:inline-flex" onClick={() => setSidebar(!sidebar)}
                    title={sidebar ? "Kategóriák elrejtése" : "Kategóriák megjelenítése"}>
              {sidebar ? <PanelLeftClose/> : <PanelLeftOpen/>}
            </Button>
          </div>

          <ItemList categories={categories} search={deferredSearch} filtering={!!deferredSearch.trim() || favoritesOnly} open={open} onToggle={toggle}
                    quantities={quantities} favorites={favoriteSet} onAdd={add} onChange={change} onFavorite={toggleFavorite}/>

          <p className="pt-2 text-center text-[11px] text-slate-600">
            Adatok: <span className="text-slate-500">Tetsu</span> · Fejlesztés: <span className="text-slate-500">Martin Lothbrok</span>
          </p>
        </div>

        {isDesktop && <aside className="sticky top-20 hidden max-h-[calc(100dvh-6rem)] overflow-y-auto pr-1 lg:block">{panel}</aside>}
      </div>

      {!isDesktop && (
        <>
          {/* Portalled: the page wrapper animates with a transform, which would pin "fixed" to it. */}
          {createPortal(<button type="button" onClick={() => setDrawerOpen(true)} data-tour="calc-drawer" data-cart={count}
                  className="fixed right-5 bottom-5 z-40 flex h-14 items-center gap-2 rounded-full bg-amber-400 px-5 font-semibold text-black shadow-2xl ring-4 ring-[#0a1120] transition-transform active:scale-95">
            <ClipboardList className="size-5"/>
            {count > 0 ? <>{count} tétel · {formatCurrency(fine)}</> : "Jegyzőkönyv"}
          </button>, document.body)}
          <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DrawerContent className="max-h-[90dvh]">
              <DrawerTitle className="sr-only">Jegyzőkönyv és kiszabás</DrawerTitle>
              <div className="overflow-y-auto px-4 pt-2 pb-8">{panel}</div>
            </DrawerContent>
          </Drawer>
        </>
      )}

      <SaveTemplateDialog open={dialog === "save"} onOpenChange={(value) => setDialog(value ? "save" : null)} onSave={(name) => {
        setTemplates((current) => [...current, {id: `template-${Date.now()}`, name, cart: structuredClone(cart), savedFine: fine, savedJail: jail}]);
        toast.success("Sablon mentve.");
      }}/>
      <HistoryDialog open={dialog === "history"} onOpenChange={(value) => setDialog(value ? "history" : null)} history={history} onLoad={loadHistory}/>
      <TemplatesDialog open={dialog === "templates"} onOpenChange={(value) => setDialog(value ? "templates" : null)} templates={templates}
                       onLoad={loadTemplate} onDelete={(id) => {
                         setTemplates((current) => current.filter((template) => template.id !== id));
                         toast.success("Sablon törölve.");
                       }}/>
    </div>
  );
}
