import {useEffect, useRef, useState, type CSSProperties} from "react";
import {Link, useLocation, useParams} from "react-router";
import {toast} from "sonner";
import {ArrowLeft, ArrowRight, Clock, Link2, Loader2, Newspaper, PencilLine} from "lucide-react";
import {BlockRenderer} from "@/components/rich/BlockRenderer";
import {SheriffStar} from "@/components/brand/SheriffStar";
import {useAuth} from "@/context/AuthContext";
import {getOptimizedImageUrl} from "@/lib/cloudinary";
import {articleDate, canEditSite, NEWS_CATEGORIES, readingMinutes, siteApi, type ArticlePage, type NewsItem} from "@/lib/site";
import type {ArticlePreviewState} from "./article-transition";
import {Reveal, useScrollProgress} from "./motion";
import {CategoryChip, NewsCard} from "./NewsCard";
import {PublicShell} from "./PublicChrome";

/**
 * One article: the cover with a slow parallax, the text, and the neighbouring and related news.
 * Opened from a card, the header is drawn at once from the card's data (the card morphs into it,
 * see article-transition.ts) and the text follows when it has loaded.
 */
export function NewsArticlePage() {
  const {slug = ""} = useParams<{slug: string}>();
  const {profile} = useAuth();
  const location = useLocation();
  const [loaded, setLoaded] = useState<{slug: string; page: ArticlePage | null} | null>(null);
  const page = loaded?.slug === slug ? loaded.page : undefined;
  const preview = (location.state as ArticlePreviewState | null)?.preview;
  const fromCard = preview?.slug === slug ? preview : null;
  // The alert level's tint comes from the front page when it was just read; a direct visit stays neutral (no extra request).
  const [alertLevel] = useState(() => siteApi.cached()?.alert_level ?? null);
  const article = useRef<HTMLElement>(null);
  const progress = useScrollProgress(article);

  useEffect(() => {
    let active = true;
    siteApi.article(slug).then((data) => active && setLoaded({slug, page: data}), () => active && setLoaded({slug, page: null}));
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    window.scrollTo({top: 0});
  }, [slug]);

  const title = page?.post.title ?? fromCard?.title;
  useEffect(() => {
    if (title) document.title = `${title} – San Fierro Sheriff's Department`;
    return () => {
      document.title = "SFSD Intranet";
    };
  }, [title]);

  // Phones get their own share sheet (Discord, messages); elsewhere the address is copied.
  const canShare = typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches;
  const copyLink = async () => {
    if (canShare) {
      try {
        await navigator.share({title: title ?? "San Fierro Sheriff's Department", url: window.location.href});
        return;
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("A cikk címe a vágólapra került.");
    } catch {
      toast.error("A másolás nem sikerült.");
    }
  };

  if (page === null) {
    return (
      <PublicShell alertLevel={alertLevel}>
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-5 text-center">
          <SheriffStar variant="hologram" className="size-24 opacity-60"/>
          <h1 className="text-2xl font-bold text-white">Ez a hír nem található</h1>
          <p className="text-slate-400">Lehet, hogy visszavonták, vagy elírás van a címben.</p>
          <Link to="/news" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-medium text-white ring-1 ring-white/15"><Newspaper className="size-4"/> Minden hír</Link>
        </div>
      </PublicShell>
    );
  }

  const post: (NewsItem & Partial<Pick<ArticlePage["post"], "body" | "status" | "updated_at">>) | null = page?.post ?? fromCard;
  if (!post) {
    return <PublicShell alertLevel={alertLevel}><div className="flex min-h-[70vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-slate-500"/></div></PublicShell>;
  }
  // Arriving from a card the header must be visible in the morph's first frame (no entrance animation).
  const instant = !!fromCard;
  return (
    <PublicShell alertLevel={alertLevel}>
      {/* Reading progress */}
      <div aria-hidden className="fixed inset-x-0 top-16 z-40 h-0.5 origin-left bg-gradient-to-r from-amber-200 via-amber-400 to-amber-600"
           style={{transform: `scaleX(${progress})`} as CSSProperties}/>
      <header data-article-ready={slug} className="relative isolate overflow-hidden pt-16">
        <div data-morph-target={`cover:${slug}`} className="absolute inset-0 -z-10 h-[78vh] min-h-[440px] overflow-hidden">
          {post.cover_url ? (
            <img src={getOptimizedImageUrl(post.cover_url, 2000) || post.cover_url} alt="" className="size-full object-cover"
                 style={{transform: `translate3d(0, ${progress * 90}px, 0) scale(1.08)`} as CSSProperties}/>
          ) : (
            <div className="relative size-full" style={{background: `radial-gradient(80% 70% at 20% 10%, ${(NEWS_CATEGORIES[post.category] ?? NEWS_CATEGORIES.news).accent}33, transparent 60%), radial-gradient(70% 60% at 90% 30%, #1e3a8a55, transparent 65%), #050a17`} as CSSProperties}>
              <div aria-hidden className="absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.03)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.03)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_50%_30%,#000,transparent_75%)]"/>
              <SheriffStar variant="hologram" spin className="absolute top-[8%] right-[-6%] size-[min(70vw,46rem)] opacity-20"/>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-[#030712]/80 to-[#030712]/30"/>
        </div>
        <div data-morph-target={`head:${slug}`} className="mx-auto flex min-h-[62vh] w-full max-w-4xl flex-col justify-end px-5 pt-24 pb-12 sm:px-8">
          {page?.post.status === "draft" && (
            <p className="mb-5 w-fit rounded-full bg-amber-300 px-3 py-1 text-xs font-bold text-black">Előnézet: még nem jelent meg</p>
          )}
          <Reveal instant={instant} className="flex flex-wrap items-center gap-3">
            <CategoryChip item={post}/>
            <span className="text-sm text-slate-300">{articleDate(post.published_at ?? post.updated_at ?? null)}</span>
            {post.body && (
              <span className="inline-flex items-center gap-1.5 text-sm text-slate-400"><Clock className="size-3.5"/> {readingMinutes(post.body)} perc olvasás</span>
            )}
          </Reveal>
          <Reveal as="h1" instant={instant} delay={100} className="mt-5 text-[clamp(2.1rem,5.4vw,4rem)] leading-[1.04] font-black tracking-[-0.03em] text-white wrap-anywhere">
            <span data-morph-target={`title:${slug}`} className="inline-block">{post.title}</span>
          </Reveal>
          {post.excerpt && <Reveal as="p" instant={instant} delay={180} className="mt-5 text-xl leading-relaxed text-slate-300">{post.excerpt}</Reveal>}
          <Reveal instant={instant} delay={240} className="mt-7 flex flex-wrap items-center gap-3 text-sm text-slate-400">
            <SheriffStar className="size-8"/>
            <span>{post.author_display}</span>
            <button type="button" onClick={() => void copyLink()} className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10">
              <Link2 className="size-3.5"/> {canShare ? "Megosztás" : "Link másolása"}
            </button>
            {canEditSite(profile) && (
              <Link to={`/sib/news/${post.id}`} className="inline-flex items-center gap-1.5 rounded-full bg-amber-300/10 px-3 py-1.5 text-amber-200 ring-1 ring-amber-300/25 hover:bg-amber-300/15">
                <PencilLine className="size-3.5"/> Szerkesztés
              </Link>
            )}
          </Reveal>
        </div>
      </header>

      <article ref={article} data-morph-target={`body:${slug}`} className="mx-auto w-full max-w-3xl px-5 pb-20 sm:px-8">
        {page ? <Reveal instant={instant} delay={instant ? 0 : 120}><BlockRenderer blocks={page.post.body}/></Reveal> : (
          <div className="space-y-4" aria-busy="true">
            {[92, 100, 96, 84, 100, 70].map((width, index) => <div key={index} className="skeleton h-4 rounded" style={{width: `${width}%`}}/>)}
          </div>
        )}
      </article>

      {page && (page.older || page.newer) && (
        <nav className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-4 px-5 pb-16 sm:grid-cols-2 sm:px-8" aria-label="Szomszédos hírek">
          {page.older ? (
            <Link to={`/news/${page.older.slug}`} className="group rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/[0.08] transition hover:bg-white/[0.05]">
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500"><ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-1"/> Korábbi</span>
              <span className="mt-1 line-clamp-2 block font-semibold text-white">{page.older.title}</span>
            </Link>
          ) : <span/>}
          {page.newer && (
            <Link to={`/news/${page.newer.slug}`} className="group rounded-2xl bg-white/[0.03] p-5 text-right ring-1 ring-white/[0.08] transition hover:bg-white/[0.05]">
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">Újabb <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1"/></span>
              <span className="mt-1 line-clamp-2 block font-semibold text-white">{page.newer.title}</span>
            </Link>
          )}
        </nav>
      )}

      {page && page.related.length > 0 && (
        <section className="border-t border-white/[0.06] bg-[#04081a] py-20">
          <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
            <h2 className="text-2xl font-bold tracking-tight text-white">További hírek</h2>
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
              {page.related.map((item, index) => <Reveal key={item.id} delay={index * 90}><NewsCard item={item} className="h-full"/></Reveal>)}
            </div>
          </div>
        </section>
      )}
    </PublicShell>
  );
}
