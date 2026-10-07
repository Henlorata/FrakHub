import {useEffect, useState} from "react";
import {useSearchParams} from "react-router";
import {Loader2, Newspaper} from "lucide-react";
import {NEWS_CATEGORIES, siteApi, type NewsCategory, type NewsItem} from "@/lib/site";
import {cn} from "@/lib/utils";
import {Reveal} from "./motion";
import {FeaturedNewsCard, NewsCard} from "./NewsCard";
import {PublicShell} from "./PublicChrome";

/** All published news, newest first, with a category filter. */
export function NewsListPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("category");
  const category = raw && raw in NEWS_CATEGORIES ? (raw as NewsCategory) : null;
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alertLevel] = useState(() => siteApi.cached()?.alert_level ?? null);

  useEffect(() => {
    let active = true;
    siteApi.news(category).then((list) => {
      if (!active) return;
      setItems(list);
      setMore(list.length >= 12);
    }, () => active && setItems([]));
    return () => {
      active = false;
    };
  }, [category]);

  useEffect(() => {
    document.title = "Hírek – San Fierro Sheriff's Department";
    return () => {
      document.title = "SFSD Intranet";
    };
  }, []);

  const loadMore = async () => {
    if (!items?.length) return;
    setLoading(true);
    try {
      const next = await siteApi.news(category, items[items.length - 1].published_at);
      setItems([...items, ...next]);
      setMore(next.length >= 12);
    } finally {
      setLoading(false);
    }
  };

  const [first, ...rest] = items ?? [];
  return (
    <PublicShell alertLevel={alertLevel}>
      <section className="relative overflow-hidden pt-32 pb-12">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(90%_70%_at_50%_0%,#13284f_0%,#030712_70%)]"/>
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
          <Reveal as="p" className="text-[11px] font-semibold tracking-[0.35em] text-amber-300 uppercase">Sheriff&apos;s Information Bureau</Reveal>
          <Reveal as="h1" delay={80} className="mt-3 text-[clamp(2.4rem,6vw,4.4rem)] leading-none font-black tracking-[-0.03em] text-white">
            Hírek és <span className="text-shimmer">közlemények</span>
          </Reveal>
          <Reveal delay={160} className="mt-8 flex flex-wrap gap-2" >
            <button type="button" onClick={() => setParams({})}
                    className={cn("rounded-full px-4 py-2 text-sm ring-1 transition", !category ? "bg-amber-300 font-semibold text-black ring-amber-300" : "text-slate-300 ring-white/15 hover:bg-white/5")}>
              Mind
            </button>
            {(Object.keys(NEWS_CATEGORIES) as NewsCategory[]).map((key) => {
              const meta = NEWS_CATEGORIES[key];
              return (
                <button key={key} type="button" onClick={() => setParams({category: key})}
                        className={cn("inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm ring-1 transition",
                          category === key ? "bg-white font-semibold text-black ring-white" : "text-slate-300 ring-white/15 hover:bg-white/5")}>
                  <meta.icon className="size-3.5"/> {meta.label}
                </button>
              );
            })}
          </Reveal>
        </div>
      </section>
      <section className="mx-auto w-full max-w-7xl px-5 pb-28 sm:px-8">
        {items === null ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((index) => <div key={index} className="skeleton h-80 rounded-2xl"/>)}</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl bg-white/[0.03] px-6 py-20 text-center ring-1 ring-white/[0.08]">
            <Newspaper className="size-8 text-amber-300"/>
            <p className="text-lg font-semibold text-white">{category ? "Ebben a kategóriában még nincs hír" : "Még nincs megjelent hír"}</p>
          </div>
        ) : (
          <>
            {first && !category && <Reveal variant="scale"><FeaturedNewsCard item={first}/></Reveal>}
            <div className={cn("grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3", !category && "mt-6")}>
              {(category ? items : rest).map((item, index) => <Reveal key={item.id} delay={(index % 6) * 70}><NewsCard item={item} className="h-full"/></Reveal>)}
            </div>
            {more && (
              <div className="mt-10 flex justify-center">
                <button type="button" onClick={() => void loadMore()} disabled={loading}
                        className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-6 py-3 text-sm font-medium text-white ring-1 ring-white/15 hover:bg-white/10">
                  {loading && <Loader2 className="size-4 animate-spin"/>} Régebbi hírek
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </PublicShell>
  );
}
