import type {CSSProperties, MouseEvent} from "react";
import {Link, useNavigate} from "react-router";
import {ArrowUpRight} from "lucide-react";
import {SheriffStar} from "@/components/brand/SheriffStar";
import {getOptimizedImageUrl} from "@/lib/cloudinary";
import {articleDate, NEWS_CATEGORIES, type NewsItem} from "@/lib/site";
import {cn} from "@/lib/utils";
import {loadArticlePage, openArticle} from "./article-transition";

/** A card's link: preloads the article page when pointed at, and opens it with the morph. */
function useArticleLink(item: NewsItem) {
  const navigate = useNavigate();
  const preload = () => void loadArticlePage();
  return {
    to: `/news/${item.slug}`,
    state: {preview: item},
    onClick: (event: MouseEvent<HTMLAnchorElement>) => openArticle(event, item, navigate),
    onPointerEnter: preload,
    onFocus: preload,
  };
}

/** The cover picture, or a drawn stand-in in the category's colour. */
export function NewsCover({item, width, className}: {item: NewsItem; width: number; className?: string}) {
  const category = NEWS_CATEGORIES[item.category] ?? NEWS_CATEGORIES.news;
  if (item.cover_url) {
    return (
      <img src={getOptimizedImageUrl(item.cover_url, width) || item.cover_url} alt="" loading="lazy" decoding="async"
           className={cn("size-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.06]", className)}/>
    );
  }
  return (
    <div className={cn("@container relative size-full overflow-hidden transition-transform duration-[1.2s] ease-out group-hover:scale-[1.06]", className)}
         style={{background: `radial-gradient(120% 90% at 15% 0%, ${category.accent}40, transparent 55%), radial-gradient(90% 80% at 100% 100%, #1e3a8a66, transparent 60%), #070d1c`} as CSSProperties}>
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.035)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.035)_1px,transparent_1px)] bg-[size:28px_28px] [mask-image:radial-gradient(ellipse_at_30%_30%,#000,transparent_75%)]"/>
      <SheriffStar variant="hologram" className="absolute -right-[12%] -bottom-[25%] size-[85%] opacity-25"/>
      <span aria-hidden className="absolute bottom-[6%] left-[6%] text-[clamp(1.6rem,14cqw,7rem)] leading-none font-black tracking-tight text-white/[0.06] uppercase">
        {category.label}
      </span>
      <span className="absolute top-[12%] left-[7%] grid size-12 place-items-center rounded-2xl backdrop-blur"
            style={{color: category.accent, background: `${category.accent}1a`, boxShadow: `inset 0 0 0 1px ${category.accent}55`} as CSSProperties}>
        <category.icon className="size-6"/>
      </span>
    </div>
  );
}

export function CategoryChip({item, className}: {item: NewsItem; className?: string}) {
  const category = NEWS_CATEGORIES[item.category] ?? NEWS_CATEGORIES.news;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 backdrop-blur", category.chip, className)}>
      <category.icon className="size-3"/> {category.label}
    </span>
  );
}

/** A large card with the picture behind the title (the featured article). */
export function FeaturedNewsCard({item, className}: {item: NewsItem; className?: string}) {
  const link = useArticleLink(item);
  return (
    <Link {...link} className={cn("group relative isolate flex min-h-[26rem] flex-col justify-end overflow-hidden rounded-3xl ring-1 ring-white/10", className)}>
      <div data-morph="cover" className="absolute inset-0 -z-10 overflow-hidden"><NewsCover item={item} width={1400}/></div>
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-[#030712] via-[#030712]/70 to-transparent"/>
      <div className="p-7 sm:p-9">
        <div className="flex flex-wrap items-center gap-3">
          <CategoryChip item={item}/>
          {item.featured && <span className="rounded-full bg-amber-300 px-2.5 py-1 text-[11px] font-bold text-black">Kiemelt</span>}
          <span className="text-xs text-slate-300">{articleDate(item.published_at)}</span>
        </div>
        <h3 data-morph="title" className="mt-4 w-fit max-w-2xl text-[clamp(1.6rem,3vw,2.4rem)] leading-tight font-bold tracking-tight text-white wrap-anywhere">{item.title}</h3>
        {item.excerpt && <p className="mt-3 line-clamp-3 max-w-2xl text-slate-300">{item.excerpt}</p>}
        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-200">
          Tovább a cikkhez <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"/>
        </span>
      </div>
    </Link>
  );
}

/** A wide card: the picture on the left, the story on the right (the lead story without a cover). */
export function WideNewsCard({item}: {item: NewsItem}) {
  const link = useArticleLink(item);
  return (
    <Link {...link} className="group grid min-w-0 grid-cols-1 overflow-hidden rounded-3xl bg-white/[0.03] ring-1 ring-white/10 transition duration-500 hover:bg-white/[0.05] hover:ring-amber-300/30 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div data-morph="cover" className="relative aspect-[16/9] overflow-hidden md:aspect-auto md:min-h-[18rem]"><NewsCover item={item} width={1000}/></div>
      <div className="flex flex-col justify-center gap-3 p-7 sm:p-10">
        <div className="flex flex-wrap items-center gap-3">
          <CategoryChip item={item}/>
          {item.featured && <span className="rounded-full bg-amber-300 px-2.5 py-1 text-[11px] font-bold text-black">Kiemelt</span>}
          <span className="text-xs text-slate-400">{articleDate(item.published_at)}</span>
        </div>
        <h3 data-morph="title" className="w-fit text-[clamp(1.5rem,2.6vw,2.2rem)] leading-tight font-bold tracking-tight text-white wrap-anywhere transition-colors group-hover:text-amber-100">{item.title}</h3>
        {item.excerpt && <p className="line-clamp-3 text-slate-400">{item.excerpt}</p>}
        <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-200">
          Tovább a cikkhez <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"/>
        </span>
      </div>
    </Link>
  );
}

/** A compact card: picture on top, then the title. */
export function NewsCard({item, index = 0, className}: {item: NewsItem; index?: number; className?: string}) {
  const link = useArticleLink(item);
  return (
    <Link {...link} style={{"--i": index} as CSSProperties}
          className={cn("group flex min-w-0 flex-col overflow-hidden rounded-2xl bg-white/[0.03] ring-1 ring-white/10 transition duration-500 hover:-translate-y-1 hover:bg-white/[0.05] hover:ring-amber-300/30",
            className)}>
      <div data-morph="cover" className="relative aspect-[16/9] overflow-hidden"><NewsCover item={item} width={720}/></div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryChip item={item}/>
          <span className="text-xs text-slate-500">{articleDate(item.published_at)}</span>
        </div>
        <h3 data-morph="title" className="line-clamp-2 text-lg leading-snug font-semibold text-white wrap-anywhere transition-colors group-hover:text-amber-100">{item.title}</h3>
        {item.excerpt && <p className="line-clamp-2 text-sm text-slate-400">{item.excerpt}</p>}
      </div>
    </Link>
  );
}
