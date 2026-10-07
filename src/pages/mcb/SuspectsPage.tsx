import {useEffect, useMemo, useState, type CSSProperties} from "react";
import {useSearchParams} from "react-router";
import {FolderOpen, Search, Siren, UserPlus, Users, X} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {EmptyState} from "@/components/layout/EmptyState";
import {PageHeader} from "@/components/layout/PageHeader";
import {useAuth} from "@/context/AuthContext";
import {useSuspects} from "@/context/SuspectCacheContext";
import {getOptimizedAvatarUrl} from "@/lib/cloudinary";
import {formatDate} from "@/lib/datetime";
import {SUSPECT_STATUS, SUSPECT_STATUSES} from "@/lib/mcb";
import {cn} from "@/lib/utils";
import type {Suspect, SuspectStatus} from "@/types/supabase";
import {Mugshot, SuspectStatusChip} from "./components/McbBadges";
import {NewSuspectDialog} from "./components/NewSuspectDialog";

type SortKey = "name" | "recent" | "cases";

const fold = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

interface WantedNotice {
  suspect_id: string;
  reason: string;
  created_at: string;
  case: {case_number: string} | null;
}

export function SuspectsPage() {
  const {supabase} = useAuth();
  const {suspects, caseMap, creators, loading, refreshSuspects, openSuspectId, activeSuspectId} = useSuspects();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SuspectStatus | null>(() => {
    const value = params.get("status");
    return value && value in SUSPECT_STATUS ? (value as SuspectStatus) : null;
  });
  const [gang, setGang] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [creating, setCreating] = useState(false);
  const [notices, setNotices] = useState<WantedNotice[]>([]);

  // A person's file can be linked: /mcb/suspects?person=<id>.
  const personParam = params.get("person");
  useEffect(() => {
    if (personParam) openSuspectId(personParam);
  }, [openSuspectId, personParam]);
  useEffect(() => {
    if (!activeSuspectId && personParam) {
      setParams((current) => {
        const next = new URLSearchParams(current);
        next.delete("person");
        return next;
      }, {replace: true});
    }
  }, [activeSuspectId, personParam, setParams]);

  // Reasons on the wanted posters: the approved arrest warrants the reader may see.
  useEffect(() => {
    let active = true;
    supabase.from("case_warrants").select("suspect_id, reason, created_at, case:case_id(case_number)")
      .eq("type", "arrest").eq("status", "approved").not("suspect_id", "is", null).order("created_at", {ascending: false}).limit(50)
      .then(({data}) => {
        if (active) setNotices((data ?? []) as unknown as WantedNotice[]);
      });
    return () => {
      active = false;
    };
  }, [supabase]);

  const counts = useMemo(() => {
    const result = Object.fromEntries(SUSPECT_STATUSES.map((value) => [value, 0])) as Record<SuspectStatus, number>;
    suspects.forEach((suspect) => {
      result[(suspect.status ?? "free") as SuspectStatus] = (result[(suspect.status ?? "free") as SuspectStatus] ?? 0) + 1;
    });
    return result;
  }, [suspects]);

  const gangs = useMemo(() => [...new Set(suspects.map((suspect) => suspect.gang_affiliation?.trim()).filter(Boolean) as string[])]
    .sort((a, b) => a.localeCompare(b, "hu")), [suspects]);

  const visible = useMemo(() => {
    const term = fold(query.trim());
    const rows = suspects.filter((suspect) => (!status || suspect.status === status)
      && (!gang || suspect.gang_affiliation?.trim() === gang)
      && (!term || [suspect.full_name, suspect.alias ?? "", suspect.gang_affiliation ?? ""].some((value) => fold(value).includes(term))));
    return rows.sort((a, b) => sort === "name" ? a.full_name.localeCompare(b.full_name, "hu")
      : sort === "cases" ? (caseMap[b.id]?.length ?? 0) - (caseMap[a.id]?.length ?? 0) || a.full_name.localeCompare(b.full_name, "hu")
        : (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at));
  }, [caseMap, gang, query, sort, status, suspects]);

  const wanted = suspects.filter((suspect) => suspect.status === "wanted");
  const noticeFor = (id: string) => notices.find((notice) => notice.suspect_id === id);
  const filtered = !!status || !!gang || !!query.trim();

  return (
    <div className="flex flex-col gap-6">
      <NewSuspectDialog open={creating} onOpenChange={setCreating} onCreated={(suspect) => {
        void refreshSuspects(true);
        openSuspectId(suspect.id);
      }}/>

      <PageHeader icon={Users} tone="red" eyebrow="Személyek, kapcsolatok, vagyon" title="Bűnügyi nyilvántartás"
                  description={`${suspects.length} nyilvántartott személy · gyanúsítottak, tanúk, sértettek közös adatbázisa`}
                  actions={<Button onClick={() => setCreating(true)} className="bg-red-600 text-white hover:bg-red-500"><UserPlus className="size-4"/> Új személy</Button>}/>

      {wanted.length > 0 && (
        <section className="animate-rise" style={{"--i": 1} as CSSProperties} data-tour="suspects-wanted">
          <header className="mb-3 flex items-center gap-2">
            <Siren className="size-4 animate-pulse text-red-400"/>
            <h2 className="text-sm font-semibold tracking-wide text-red-200 uppercase">Körözési lista</h2>
            <span className="rounded-full bg-red-500/15 px-2 text-xs text-red-200">{wanted.length}</span>
          </header>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {wanted.map((suspect, index) => {
              const notice = noticeFor(suspect.id);
              return (
                <button key={suspect.id} type="button" onClick={() => openSuspectId(suspect.id)} style={{"--i": index} as CSSProperties}
                        className="wanted-poster animate-rise group relative w-52 shrink-0 rotate-[-0.6deg] rounded-sm p-3 pt-6 text-left text-[#2b2116] shadow-[0_18px_40px_-18px_rgb(0_0_0/0.9)] transition hover:rotate-0 hover:-translate-y-1 even:rotate-[0.8deg]">
                  <span className="absolute top-1.5 left-1/2 size-3 -translate-x-1/2 rounded-full bg-red-700 shadow-[0_2px_3px_rgb(0_0_0/0.5)]"/>
                  <p className="mt-2 text-center font-serif text-2xl leading-none font-black tracking-[0.2em] text-[#7f1d1d]">KÖRÖZÉS</p>
                  <p className="mb-2 text-center text-[9px] font-semibold tracking-[0.25em] text-[#5b4630] uppercase">San Fierro Sheriff&apos;s Dept.</p>
                  <div className="aspect-[4/5] overflow-hidden rounded-sm bg-[#cbb995] ring-1 ring-[#5b4630]/40">
                    {suspect.mugshot_url ? (
                      <img src={getOptimizedAvatarUrl(suspect.mugshot_url, 320)} alt="" className="size-full object-cover sepia-[0.45] contrast-110"/>
                    ) : (
                      <span className="grid size-full place-items-center font-serif text-5xl font-black text-[#5b4630]/50">?</span>
                    )}
                  </div>
                  <p className="mt-2 truncate text-center font-serif text-base font-bold uppercase">{suspect.full_name}</p>
                  {suspect.alias && <p className="truncate text-center text-xs italic">„{suspect.alias}”</p>}
                  <p className="mt-1 line-clamp-2 min-h-8 text-center text-[11px] leading-snug text-[#3f3021]">{notice?.reason ?? suspect.gang_affiliation ?? "Elfogatóparancs van érvényben."}</p>
                  {notice?.case && <p className="mt-1 text-center font-mono text-[10px] text-[#7f1d1d]">{notice.case.case_number}</p>}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3" data-tour="suspects-list">
        <div className="flex flex-col gap-3">
          <div className="flex w-full items-center gap-1 overflow-x-auto rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/10 lg:w-fit">
            <button type="button" onClick={() => setStatus(null)}
                    className={cn("flex h-8 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
                      !status ? "bg-white/10 text-white" : "text-slate-400 hover:text-white")}>
              Mind <span className="rounded-md bg-white/10 px-1.5 text-[11px] tabular-nums">{suspects.length}</span>
            </button>
            {SUSPECT_STATUSES.map((value) => (
              <button key={value} type="button" onClick={() => setStatus(status === value ? null : value)}
                      className={cn("flex h-8 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
                        status === value ? "bg-white/10 text-white" : "text-slate-400 hover:text-white")}>
                <span className={cn("size-2 rounded-full", SUSPECT_STATUS[value].dot)}/>{SUSPECT_STATUS[value].label}
                <span className="rounded-md bg-white/10 px-1.5 text-[11px] tabular-nums">{counts[value] ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
            <Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 pl-9" placeholder="Név, álnév vagy szervezet…"/>
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Keresés törlése"
                      className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-slate-400 hover:bg-white/10">
                <X className="size-3.5"/>
              </button>
            )}
          </div>
          {/* On a phone the two lists share the row; a long organisation name must not push it wider. */}
          <div className="flex min-w-0 gap-2">
            <select value={gang} onChange={(event) => setGang(event.target.value)} aria-label="Szervezet"
                    className="h-10 min-w-0 flex-1 rounded-lg border bg-white/[0.03] px-3 text-sm text-slate-200 sm:max-w-52 sm:flex-none">
              <option value="">Minden szervezet</option>
              {gangs.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} aria-label="Rendezés"
                    className="h-10 min-w-0 flex-1 rounded-lg border bg-white/[0.03] px-3 text-sm text-slate-200 sm:flex-none">
              <option value="recent">Legutóbb frissített</option>
              <option value="name">Név szerint</option>
              <option value="cases">Legtöbb akta</option>
            </select>
          </div>
          </div>
        </div>

        {loading && suspects.length === 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
            {Array.from({length: 12}, (_, index) => <div key={index} className="skeleton aspect-[3/4] rounded-2xl"/>)}
          </div>
        ) : visible.length === 0 ? (
          <div className="panel">
            <EmptyState icon={FolderOpen} title={filtered ? "Nincs a szűrésnek megfelelő személy" : "A nyilvántartás üres"}
                        description={filtered ? "Próbálj más keresést vagy szűrőt." : "Az „Új személy” gombbal vehetsz fel adatlapot."}/>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
            {visible.map((suspect, index) => (
              <PersonCard key={suspect.id} suspect={suspect} index={index} cases={caseMap[suspect.id]?.length ?? 0}
                          creator={suspect.created_by ? creators[suspect.created_by] : undefined} onOpen={() => openSuspectId(suspect.id)}/>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PersonCard({suspect, index, cases, creator, onOpen}: {suspect: Suspect; index: number; cases: number; creator?: string; onOpen: () => void}) {
  return (
    <button type="button" onClick={onOpen} style={{"--i": Math.min(index, 18)} as CSSProperties}
            className="panel lift animate-rise group flex min-w-0 flex-col overflow-hidden p-0 text-left">
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-b from-slate-800 to-slate-950">
        {suspect.mugshot_url ? (
          <img src={getOptimizedAvatarUrl(suspect.mugshot_url, 360)} alt="" loading="lazy"
               className={cn("size-full object-cover transition duration-500 group-hover:scale-105", suspect.status === "deceased" && "grayscale")}/>
        ) : (
          <span className="grid size-full place-items-center">
            <Mugshot url={null} name={suspect.full_name} size={72} className="ring-0"/>
          </span>
        )}
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(transparent_calc(100%-1px),rgb(255_255_255/0.06)_1px)] bg-[size:100%_12px]"/>
        <span className="absolute top-2 left-2"><SuspectStatusChip status={suspect.status} className="bg-black/60 backdrop-blur"/></span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 p-3">
        <p className="truncate text-sm font-semibold text-white group-hover:text-red-100">{suspect.full_name}</p>
        <p className="truncate text-xs text-slate-400">{suspect.alias ? `„${suspect.alias}”` : suspect.gang_affiliation || "Nincs álnév"}</p>
        <p className="mt-auto flex items-center gap-2 pt-2 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1"><FolderOpen className="size-3"/>{cases}</span>
          <span className="truncate">{creator ? `· ${creator}` : ""}</span>
          <span className="ml-auto shrink-0">{formatDate(suspect.created_at)}</span>
        </p>
      </div>
    </button>
  );
}
