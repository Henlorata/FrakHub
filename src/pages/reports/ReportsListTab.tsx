import {useEffect, useMemo, useState, type CSSProperties} from "react";
import {Link, useSearchParams} from "react-router";
import {toast} from "sonner";
import {Ban, FilePlus2, FileText, Loader2, MessageSquareText, Search, X} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Switch} from "@/components/ui/switch";
import {EmptyState} from "@/components/layout/EmptyState";
import {MemberAvatar} from "@/components/MemberAvatar";
import {useAuth} from "@/context/AuthContext";
import {addMonths, formatDate} from "@/lib/datetime";
import {useProfileDirectory} from "@/lib/profile-directory";
import {isFullReport, reportError, reportNumber, reportsApi, type ReportListItem, type ReportPage} from "@/lib/reports";
import {cn} from "@/lib/utils";
import {PenaltyChips, PeriodBanner, PeriodSelect} from "./report-ui";

/**
 * Every member's saved reports, newest first, month by month (the payroll month they count for).
 * The URL keeps the filters: `period` (a month or "all"), `user`, `mine=1`, `q`.
 */
export function ReportsListTab({reloadKey}: {reloadKey: number}) {
  const {user} = useAuth();
  const {profiles} = useProfileDirectory();
  const [searchParams, setSearchParams] = useSearchParams();
  const periodParam = searchParams.get("period");
  const userParam = searchParams.get("user");
  const mine = searchParams.get("mine") === "1";
  const [term, setTerm] = useState(searchParams.get("q") ?? "");
  const [query, setQuery] = useState(term.trim());
  // The page with the filter it was asked for: another filter shows the skeleton until it arrives.
  const [loaded, setLoaded] = useState<{key: string; page: ReportPage} | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const setParam = (key: string, value: string | null) => setSearchParams((params) => {
    const next = new URLSearchParams(params);
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    return next;
  }, {replace: true});

  // Searching waits for a pause in typing; the URL is written only for a new search (a late write
  // after the page was left would bring it back).
  useEffect(() => {
    const next = term.trim();
    if (next === query) return;
    const timer = window.setTimeout(() => {
      setQuery(next);
      setParam("q", next || null);
    }, 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setParam only writes the URL
  }, [term]);

  const filter = useMemo(() => ({
    period: periodParam && periodParam !== "all" ? periodParam : null,
    allPeriods: periodParam === "all",
    userId: mine ? user?.id ?? null : userParam,
    query,
  }), [periodParam, mine, userParam, query, user]);

  const key = `${JSON.stringify(filter)}|${reloadKey}`;
  const page = loaded?.key === key ? loaded.page : null;

  useEffect(() => {
    let active = true;
    const empty: ReportPage = {items: [], more: false, period: null, current: "", locked: null, locked_at: null, started_at: null};
    reportsApi.list(filter).then((result) => {
      if (!active) return;
      setLoaded({key, page: result ?? empty});
      if (result?.current) setCurrent(result.current);
    }).catch((error) => {
      if (!active) return;
      toast.error(reportError(error));
      setLoaded({key, page: empty});
    });
    return () => {
      active = false;
    };
  }, [filter, key]);

  const loadMore = async () => {
    const last = page?.items.at(-1);
    if (!page || !last) return;
    setLoadingMore(true);
    try {
      const next = await reportsApi.list({...filter, before: last.number});
      setLoaded((state) => state && {...state, page: {...state.page, items: [...state.page.items, ...next.items], more: next.more}});
    } catch (error) {
      toast.error(reportError(error));
    } finally {
      setLoadingMore(false);
    }
  };

  const periods = current ? Array.from({length: 12}, (_, index) => addMonths(current, -index)) : [];
  const selected = periodParam === "all" ? null : periodParam ?? current;
  const author = userParam && !mine ? profiles.find((profile) => profile.id === userParam) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <PeriodSelect value={selected} periods={periods} allowAll onChange={(period) => setParam("period", period === null ? "all" : period === current ? null : period)}/>
        <div className="relative min-w-0 flex-1 lg:max-w-md">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
          <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Keresés: név, vád, egység, #szám…" className="pl-9"
                 aria-label="Keresés a jelentések között"/>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <Switch checked={mine} onCheckedChange={(value) => setParam("mine", value ? "1" : null)}/> Csak a sajátjaim
        </label>
        <Button asChild className="lg:ml-auto"><Link to="/reports"><FilePlus2/> Új jelentés</Link></Button>
      </div>

      {userParam && !mine && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
          Csak {author ? <span className="font-medium text-white">{author.full_name}</span> : "egy tag"} jelentései
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setParam("user", null)}><X/> Mindenkié</Button>
        </div>
      )}

      {page?.period && <PeriodBanner period={page.period} current={page.current} locked={page.locked} lockedAt={page.locked_at} startedAt={page.started_at}/>}

      {page === null ? (
        <div className="space-y-2">{Array.from({length: 4}, (_, index) => <div key={index} className="skeleton h-24 rounded-xl"/>)}</div>
      ) : page.items.length === 0 ? (
        <section className="panel">
          <EmptyState icon={FileText} title={query ? "Nincs a keresésnek megfelelő jelentés." : "Ebben a hónapban még nincs jelentés."}
                      description="A Jelentésíróban megírt jelentések a másolással ide kerülnek."
                      action={<Button asChild variant="outline" size="sm"><Link to="/reports"><FilePlus2/> Új jelentés</Link></Button>}/>
        </section>
      ) : (
        <ul className="space-y-2" data-tour="reports-list">
          {page.items.map((item, index) => <ReportRow key={item.id} item={item} index={index}/>)}
        </ul>
      )}

      {page?.more && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => void loadMore()} disabled={loadingMore}>
            {loadingMore && <Loader2 className="animate-spin"/>} Továbbiak
          </Button>
        </div>
      )}
    </div>
  );
}

function ReportRow({item, index}: {item: ReportListItem; index: number}) {
  return (
    <li className="animate-rise" style={{"--i": Math.min(index, 10)} as CSSProperties}>
      <Link to={`/reports/${item.id}`}
            className={cn("panel lift flex flex-col gap-3 p-4 transition-colors hover:bg-white/[0.03] sm:flex-row sm:items-start", item.voided && "opacity-70")}>
        <div className="flex shrink-0 items-center gap-3 sm:w-24 sm:flex-col sm:items-start sm:gap-0.5">
          <span className="font-mono text-sm font-semibold text-sky-300">{reportNumber(item.number)}</span>
          <span className="text-xs text-slate-400 tabular-nums">{formatDate(item.occurred_on)}</span>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium text-white wrap-anywhere">{item.suspect_name ?? item.title}</p>
          {item.charges && <p className="line-clamp-2 text-sm text-slate-300 wrap-anywhere">{item.charges}</p>}
          {item.excerpt && <p className="line-clamp-2 text-xs text-slate-500 wrap-anywhere">{item.excerpt}</p>}
          {!isFullReport(item) && <p className="text-[11px] text-slate-500">Régi bejegyzés: csak a címe és a fórum linkje van meg.</p>}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <PenaltyChips fine={item.fine} jailTime={item.jail_time}/>
            {item.unit_id && <span className="rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-slate-300 ring-1 ring-white/10">{item.unit_id}</span>}
            {item.forum_url && (
              <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.04] px-2 py-0.5 text-[11px] text-slate-300 ring-1 ring-white/10">
                <MessageSquareText className="size-3"/> Fórumon
              </span>
            )}
            {item.voided && (
              <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-0.5 text-[11px] text-red-300 ring-1 ring-red-500/25">
                <Ban className="size-3"/> Érvénytelen
              </span>
            )}
          </div>
        </div>
        {item.author && (
          <div className="flex min-w-0 shrink-0 items-center gap-2.5 sm:w-52">
            <MemberAvatar name={item.author.full_name} avatarUrl={item.author.avatar_url} size={32}/>
            <span className="min-w-0">
              <span className="block truncate text-sm text-slate-200">{item.author.full_name}</span>
              <span className="block truncate text-[11px] text-slate-500">{item.author.faction_rank} · #{item.author.badge_number}</span>
            </span>
          </div>
        )}
      </Link>
    </li>
  );
}
