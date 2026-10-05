import {useMemo, useState, type CSSProperties} from "react";
import {Radio, Scale, Search, Sparkles} from "lucide-react";
import {Input} from "@/components/ui/input";
import {CallSignBuilder, RadioQuiz} from "@/components/radio/RadioPractice";
import {ITEMS} from "@/pages/calculator/penal-data";
import {formatCurrency, formatJailTime} from "@/lib/penalcode-processor";
import {cn} from "@/lib/utils";

type Tab = "quiz" | "callsign" | "penal";

/**
 * The trainee's practice corner while waiting for access: radio codes, call signs and the penal
 * code. Static data only (no access to the site's data yet), best score kept in the browser.
 */
export function PracticeCorner() {
  const [tab, setTab] = useState<Tab>("quiz");
  const tabs: {value: Tab; label: string; icon: typeof Radio}[] = [
    {value: "quiz", label: "Rádiókód-kvíz", icon: Radio},
    {value: "callsign", label: "Hívójel és rádiózás", icon: Sparkles},
    {value: "penal", label: "Btk. kereső", icon: Scale},
  ];
  return (
    <section className="panel animate-rise overflow-hidden p-0" style={{"--i": 4} as CSSProperties}>
      <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-5 py-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.25em] text-amber-300 uppercase">Gyakorlótér</p>
          <h2 className="text-lg font-semibold text-white">Készülj, amíg vársz</h2>
        </div>
        <div className="ml-auto flex w-full gap-1 overflow-x-auto rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/10 sm:w-auto">
          {tabs.map((item) => (
            <button key={item.value} type="button" onClick={() => setTab(item.value)}
                    className={cn("flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors",
                      tab === item.value ? "bg-amber-500/15 text-amber-100 ring-1 ring-amber-500/30" : "text-slate-400 hover:text-white")}>
              <item.icon className="size-3.5"/>{item.label}
            </button>
          ))}
        </div>
      </header>
      <div className="p-5">
        {tab === "quiz" && <RadioQuiz/>}
        {tab === "callsign" && <CallSignBuilder/>}
        {tab === "penal" && <PenalLookup/>}
      </div>
    </section>
  );
}

// --- Penal code lookup -----------------------------------------------------------------

const ALL_ITEMS = [...ITEMS.values()];
const fold = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function PenalLookup() {
  const [query, setQuery] = useState("");
  const term = fold(query.trim());
  const results = useMemo(() => (term.length < 2 ? [] : ALL_ITEMS.filter((item) =>
    [item.megnevezes, item.rovidites, item.paragrafus, item.kategoria_nev].some((value) => value && fold(value).includes(term))).slice(0, 25)),
  [term]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
        <Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 pl-9"
               placeholder="Pl. gyorshajtás, ENV, fegyver… (legalább 2 betű)"/>
      </div>
      {term.length < 2 ? (
        <p className="py-6 text-center text-sm text-slate-500">
          A Büntető Törvénykönyv {ALL_ITEMS.length} tétele kereshető. A szolgálatban a Kalkulátor ugyanebből számol bírságot és börtönidőt.
        </p>
      ) : results.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">Nincs találat.</p>
      ) : (
        <ul className="max-h-[360px] space-y-1.5 overflow-y-auto pr-1">
          {results.map((item) => (
            <li key={item.id} className="flex min-w-0 items-start gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10">
              <span className="shrink-0 rounded-md bg-amber-500/10 px-1.5 py-0.5 font-mono text-[11px] text-amber-200 ring-1 ring-amber-500/25">{item.rovidites}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white wrap-anywhere">{item.megnevezes}</p>
                <p className="text-[11px] text-slate-500">{item.paragrafus} · {item.kategoria_nev}</p>
              </div>
              <div className="shrink-0 text-right text-[11px] text-slate-300 tabular-nums">
                <p>{formatCurrency(item.min_birsag)}{item.max_birsag !== item.min_birsag ? ` – ${formatCurrency(item.max_birsag)}` : ""}</p>
                {(item.min_fegyhaz || item.max_fegyhaz) ? <p className="text-slate-500">{formatJailTime(item.min_fegyhaz)} – {formatJailTime(item.max_fegyhaz)}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
