import {useMemo, useState, type CSSProperties} from "react";
import {useSearchParams} from "react-router";
import {toast} from "sonner";
import {BookOpen, Copy, Radio, Search, Sparkles, Target, X} from "lucide-react";
import {Input} from "@/components/ui/input";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {PageHeader} from "@/components/layout/PageHeader";
import {CallSignBuilder, RadioQuiz} from "@/components/radio/RadioPractice";
import {BASIC_CODES, DIVISION_NUMBERS, TEN_CODES, UNIT_TYPES, type RadioTerm} from "@/data/radio-codes";
import {cn} from "@/lib/utils";

const TABS = ["codes", "callsign", "quiz"] as const;
type CodesTab = typeof TABS[number];

const fold = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** `chip`: a fixed width per list, so the meanings start in one column. */
const SECTIONS: {id: string; title: string; hint: string; tone: string; chip: string; terms: RadioTerm[]}[] = [
  {id: "ten", title: "10-es kódok", hint: "Állapot és kérés a rádióban.", tone: "text-sky-300 bg-sky-500/10 ring-sky-500/25", chip: "w-14", terms: TEN_CODES},
  {id: "codes", title: "Alapkódok", hint: "Riasztás, erősítés, megérkezés.", tone: "text-amber-200 bg-amber-500/10 ring-amber-500/25", chip: "w-32", terms: BASIC_CODES},
  {id: "units", title: "Egységjelek", hint: "A hívójel betűje (fonetikus ABC).", tone: "text-emerald-300 bg-emerald-500/10 ring-emerald-500/25", chip: "w-36",
    terms: UNIT_TYPES.map((unit) => ({code: `${unit.short} · ${unit.code}`, meaning: unit.meaning}))},
  {id: "divisions", title: "Divízió számok", hint: "A hívójel első száma.", tone: "text-violet-300 bg-violet-500/10 ring-violet-500/25", chip: "w-10",
    terms: DIVISION_NUMBERS.map((item) => ({code: item.code, meaning: item.meaning}))},
];

/**
 * The code book of radio use: every code with search and copy, the call sign builder and a quiz.
 * Static data (the basic academy's day 1): no request at all.
 */
export function CodesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("tab") as CodesTab | null;
  const tab: CodesTab = requested && TABS.includes(requested) ? requested : "codes";
  const setTab = (next: string) => {
    const params = new URLSearchParams(searchParams);
    if (next === "codes") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, {replace: true});
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 pb-10">
      <PageHeader icon={Radio} tone="cyan" eyebrow="Rádiózás" title="Kódtár"
                  description="10-es kódok, alapkódok, egységjelek és hívójelek egy helyen: kereséssel, másolással és gyakorlással."/>
      <Tabs value={tab} onValueChange={setTab} className="space-y-5">
        <TabsList className="w-fit max-w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="codes" className="h-9 px-4"><BookOpen/> Kódok</TabsTrigger>
          <TabsTrigger value="callsign" className="h-9 px-4" data-tour="codes-callsign"><Sparkles/> Hívójel és rádiózás</TabsTrigger>
          <TabsTrigger value="quiz" className="h-9 px-4" data-tour="codes-quiz"><Target/> Gyakorlás</TabsTrigger>
        </TabsList>
        <TabsContent value="codes" className="mt-0"><CodeBook/></TabsContent>
        <TabsContent value="callsign" className="mt-0">
          {tab === "callsign" && <section className="panel animate-rise p-5"><CallSignBuilder/></section>}
        </TabsContent>
        <TabsContent value="quiz" className="mt-0">
          {tab === "quiz" && <section className="panel animate-rise mx-auto max-w-3xl p-5"><RadioQuiz/></section>}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CodeBook() {
  const [query, setQuery] = useState("");
  const term = fold(query.trim());
  const sections = useMemo(() => SECTIONS.map((section) => ({
    ...section,
    terms: term ? section.terms.filter((item) => fold(item.code).includes(term) || fold(item.meaning).includes(term)) : section.terms,
  })), [term]);
  const found = sections.reduce((sum, section) => sum + section.terms.length, 0);

  const copy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    toast.success(`${code} a vágólapon.`);
  };

  return (
    <div className="space-y-5">
      <div data-tour="codes-search" className="relative max-w-xl">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
        <Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 pr-10 pl-9"
               placeholder="Kód vagy jelentés, pl. 10-20, erősítés, fegyház…" aria-label="Keresés a kódok között"/>
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="Keresés törlése"
                  className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-slate-500 hover:bg-white/10 hover:text-white">
            <X className="size-4"/>
          </button>
        )}
      </div>
      {found === 0 ? (
        <p className="panel py-10 text-center text-sm text-slate-500">Nincs ilyen kód. Próbáld a jelentését: pl. „erősítés”.</p>
      ) : (
        <div data-tour="codes-list" className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
          {sections.filter((section) => section.terms.length).map((section, index) => (
            <section key={section.id} className="panel animate-rise overflow-hidden p-0" style={{"--i": index} as CSSProperties}>
              <header className="flex items-baseline gap-2 border-b border-white/5 px-5 py-3.5">
                <h2 className="text-sm font-semibold text-white">{section.title}</h2>
                <p className="min-w-0 truncate text-xs text-slate-500">{section.hint}</p>
                <span className="ml-auto text-xs text-slate-500 tabular-nums">{section.terms.length}</span>
              </header>
              <ul className="divide-y divide-white/5">
                {section.terms.map((item) => (
                  <li key={item.code} className="group flex min-w-0 items-center gap-3 px-5 py-2.5 transition-colors hover:bg-white/[0.02]">
                    <span className={cn("inline-flex shrink-0 justify-center rounded-md px-2 py-0.5 font-mono text-xs font-semibold ring-1", section.tone, section.chip)}>{item.code}</span>
                    <span className="min-w-0 flex-1 text-sm text-slate-300 wrap-anywhere">{item.meaning}</span>
                    <button type="button" onClick={() => void copy(item.code.split(" · ")[0])} aria-label={`${item.code} másolása`}
                            className="rounded-md p-1.5 text-slate-500 opacity-0 transition group-hover:opacity-100 hover:bg-white/10 hover:text-white focus:opacity-100">
                      <Copy className="size-4"/>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-500">Forrás: az Akadémia alapképzésének 1. napja (Rádió fóniák, Helyes rádiózás).</p>
    </div>
  );
}
