import {useMemo, useRef, useState, type CSSProperties, type ReactNode} from "react";
import {Link} from "react-router";
import {
  ArrowRight, BadgeCheck, Check, ChevronLeft, ChevronRight, Clock, FolderCheck, Gauge, GraduationCap, HeartPulse, Landmark, Megaphone, Network,
  Newspaper, Plane, ScrollText, ShieldCheck, Siren, Trees, Users, X,
} from "lucide-react";
import {Accordion, AccordionContent, AccordionItem, AccordionTrigger} from "@/components/ui/accordion";
import {Dialog, DialogContent, DialogTitle} from "@/components/ui/dialog";
import {SheriffStar} from "@/components/brand/SheriffStar";
import {BRAND_IMAGES} from "@/lib/brand";
import {getOptimizedAvatarUrl, getOptimizedImageUrl} from "@/lib/cloudinary";
import {NEWS_CATEGORIES, UNIT_ORDER, type LeaderCard, type NewsItem, type PublicSite, type SiteContent, type UnitKey} from "@/lib/site";
import {cn} from "@/lib/utils";
import {Reveal, useCountUp, useInView, useScrollProgress, useTilt} from "./motion";
import {FeaturedNewsCard, NewsCard, WideNewsCard} from "./NewsCard";

const number = new Intl.NumberFormat("hu-HU");

export function SectionHeading({eyebrow, title, text, align = "center", className}: {
  eyebrow: string; title: ReactNode; text?: ReactNode; align?: "center" | "left"; className?: string;
}) {
  return (
    <div className={cn(align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-2xl", className)}>
      <Reveal as="p" className={cn("flex items-center gap-3 text-[11px] font-semibold tracking-[0.35em] text-amber-300 uppercase", align === "center" && "justify-center")}>
        <span aria-hidden className="h-px w-8 bg-gradient-to-r from-transparent to-amber-300/70"/>
        {eyebrow}
        <span aria-hidden className={cn("h-px w-8 bg-gradient-to-l from-transparent to-amber-300/70", align === "left" && "hidden")}/>
      </Reveal>
      <Reveal as="h2" delay={80} className="mt-4 text-[clamp(2rem,4.4vw,3.4rem)] leading-[1.05] font-bold tracking-[-0.025em] text-white">{title}</Reveal>
      {text && <Reveal as="p" delay={160} className="mt-5 text-lg leading-relaxed text-slate-400">{text}</Reveal>}
    </div>
  );
}

// --- News ticker ------------------------------------------------------------------------------

export function NewsTicker({news}: {news: NewsItem[]}) {
  if (news.length === 0) return null;
  const loop: NewsItem[] = [];
  while (loop.length < 6) loop.push(...news);
  const items = [...loop, ...loop];
  return (
    <div className="marquee-host relative border-t border-white/[0.08] bg-[#040814]/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-5 sm:px-8">
        <span className="flex shrink-0 items-center gap-2 py-3 text-[11px] font-bold tracking-[0.3em] text-red-300 uppercase">
          <span className="relative grid size-2 place-items-center">
            <span className="pulse-ring absolute inset-0 rounded-full bg-red-400"/>
            <span className="relative size-1.5 rounded-full bg-red-400"/>
          </span>
          Legfrissebb
        </span>
        <div className="relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]">
          <div className="marquee" style={{"--marquee-duration": `${Math.max(40, loop.length * 8)}s`} as CSSProperties}>
            {items.map((item, index) => {
              const category = NEWS_CATEGORIES[item.category] ?? NEWS_CATEGORIES.news;
              return (
                <Link key={`${item.id}-${index}`} to={`/news/${item.slug}`} tabIndex={index >= loop.length ? -1 : undefined}
                      className="flex items-center gap-2 py-3 pr-12 text-sm whitespace-nowrap text-slate-300 transition-colors hover:text-white">
                  <category.icon className="size-3.5" style={{color: category.accent}}/>
                  {item.title}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Numbers -------------------------------------------------------------------------------

function Stat({icon: Icon, value, label, index}: {icon: typeof Users; value: number; label: string; index: number}) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref);
  const shown = useCountUp(value, seen, 1900 + index * 150);
  return (
    <div ref={ref} className="relative px-6 py-7 text-center sm:text-left">
      <Icon className="mx-auto mb-3 size-5 text-amber-300 sm:mx-0"/>
      <p className="text-[clamp(2rem,3.6vw,2.9rem)] leading-none font-bold tracking-tight text-white tabular-nums">{number.format(shown)}</p>
      <p className="mt-2 text-sm text-slate-400">{label}</p>
    </div>
  );
}

export function StatsBand({stats}: {stats: PublicSite["stats"]}) {
  if (!stats) return null;
  // Only numbers worth showing: a quiet month or a register that has just started shows nothing rather than "0" or "1".
  const items = [
    {icon: Users, value: stats.members, min: 1, label: "aktív tag az állományban"},
    {icon: FolderCheck, value: stats.cases_closed_year, min: 3, label: "lezárt nyomozás idén"},
    {icon: Siren, value: stats.actions_30d, min: 20, label: "intézkedés az elmúlt 30 napban"},
    {icon: Clock, value: stats.duty_hours_month, min: 10, label: "szolgálati óra a múlt hónapban"},
  ].filter((item) => item.value >= item.min);
  if (items.length < 2) return null;
  return (
    <div className={cn("relative z-10 mx-auto mt-14 w-full px-5 sm:px-8", items.length === 4 ? "max-w-6xl" : items.length === 3 ? "max-w-5xl" : "max-w-3xl")}>
      <Reveal variant="scale" className={cn("grid grid-cols-2 divide-white/[0.06] overflow-hidden rounded-3xl bg-[#0a1122]/80 shadow-[0_30px_80px_-30px_rgb(0_0_0/0.9)] ring-1 ring-white/10 backdrop-blur-xl lg:divide-x",
        items.length === 4 ? "lg:grid-cols-4" : items.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
        {items.map((item, index) => <Stat key={item.label} {...item} index={index}/>)}
      </Reveal>
    </div>
  );
}

// --- About ---------------------------------------------------------------------------------

export function About({content}: {content: SiteContent}) {
  const about = content.about ?? {};
  const points = [
    {icon: GraduationCap, title: "Akadémia és mentor", text: "Mindenki képzéssel és egy tapasztalt kolléga mellett kezd."},
    {icon: ScrollText, title: "Fegyelem és szabályok", text: "Világos szabályzatok, ellenőrizhető oklevelek, átlátható előmenetel."},
    {icon: Network, title: "Három osztály, hét egység", text: "Járőrözéstől a nyomozásig: mindenki megtalálja a helyét."},
  ];
  return (
    <section id="rolunk" className="relative mx-auto w-full max-w-7xl scroll-mt-20 px-5 pt-24 pb-20 sm:px-8">
      <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-20">
        <div>
          <SectionHeading align="left" eyebrow={about.title ?? "Rólunk"} title={<>A megye <span className="text-shimmer">rendjének őre</span></>}/>
          <Reveal delay={200} as="p" className="mt-8 text-[clamp(1.25rem,2vw,1.6rem)] leading-snug font-medium text-slate-100">
            {about.lead}
          </Reveal>
          <Reveal delay={260} as="p" className="mt-6 text-lg leading-relaxed text-slate-400">{about.text}</Reveal>
        </div>
        <div className="space-y-4 lg:pt-16">
          {points.map((point, index) => (
            <Reveal key={point.title} variant="right" delay={120 * index}
                    className="group flex gap-4 rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/[0.08] transition hover:bg-white/[0.05] hover:ring-amber-300/25">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-300/20 to-amber-600/10 text-amber-200 ring-1 ring-amber-300/25 transition group-hover:scale-110">
                <point.icon className="size-5"/>
              </span>
              <span>
                <span className="block font-semibold text-white">{point.title}</span>
                <span className="mt-1 block text-sm text-slate-400">{point.text}</span>
              </span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// --- Divisions -----------------------------------------------------------------------------

const DIVISION_LOOK = {
  TSB: {color: "#facc15", glow: "rgb(250 204 21 / 0.35)", ring: "hover:ring-amber-300/40"},
  SEB: {color: "#f87171", glow: "rgb(239 68 68 / 0.38)", ring: "hover:ring-red-400/40"},
  MCB: {color: "#38bdf8", glow: "rgb(56 189 248 / 0.38)", ring: "hover:ring-sky-400/40"},
} as const;

function DivisionCard({code, info, members, leader, index}: {
  code: keyof typeof DIVISION_LOOK; info: {name?: string; subtitle?: string; text?: string}; members: number | null; leader: LeaderCard | null; index: number;
}) {
  const tilt = useTilt<HTMLDivElement>(6);
  const look = DIVISION_LOOK[code];
  return (
    <Reveal delay={index * 130} className="h-full">
      <div ref={tilt} className={cn("tilt-card group relative flex h-full flex-col overflow-hidden rounded-3xl bg-[#0a1122]/80 ring-1 ring-white/10 transition-shadow duration-500", look.ring)}
           style={{boxShadow: `0 30px 70px -40px ${look.glow}`} as CSSProperties}>
        <div aria-hidden className="tilt-glare pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-500 group-hover:opacity-100"/>
        <div className="relative grid h-48 place-items-center overflow-hidden">
          <div aria-hidden className="absolute inset-0" style={{background: `radial-gradient(60% 70% at 50% 60%, ${look.glow}, transparent 70%)`} as CSSProperties}/>
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-px" style={{background: `linear-gradient(90deg, transparent, ${look.color}66, transparent)`} as CSSProperties}/>
          {code === "TSB" ? (
            <SheriffStar className="relative size-28 transition-transform duration-700 group-hover:scale-110 group-hover:rotate-12"/>
          ) : (
            <img src={code === "SEB" ? BRAND_IMAGES.seb : BRAND_IMAGES.mcb} alt="" className="relative h-28 w-auto object-contain transition-transform duration-700 group-hover:scale-110"/>
          )}
        </div>
        <div className="flex flex-1 flex-col p-7">
          <p className="text-[11px] font-semibold tracking-[0.3em] uppercase" style={{color: look.color}}>{code} · {info.subtitle}</p>
          <h3 className="mt-2 text-2xl font-bold tracking-tight text-white">{info.name}</h3>
          <p className="mt-3 flex-1 leading-relaxed text-slate-400">{info.text}</p>
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/5 pt-4 text-sm text-slate-400">
            {members !== null && <span className="inline-flex items-center gap-1.5"><Users className="size-4" style={{color: look.color}}/> {members} tag</span>}
            {leader && <span className="min-w-0 truncate">Parancsnok: <span className="text-slate-200">{leader.full_name}</span></span>}
          </div>
        </div>
      </div>
    </Reveal>
  );
}

export function Divisions({site}: {site: PublicSite | null}) {
  const content = site?.content.divisions ?? {};
  const codes = ["TSB", "SEB", "MCB"] as const;
  return (
    <section id="osztalyok" className="relative scroll-mt-20 py-20">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"/>
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionHeading eyebrow="Osztályaink" title={<>Három osztály, <span className="text-shimmer">egy department</span></>}
                        text="Mindenki a járőrszolgálatban kezd; a különleges egység és a nyomozók közé képzés és tapasztalat vezet."/>
        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {codes.map((code, index) => (
            <DivisionCard key={code} code={code} info={content[code] ?? {}} index={index}
                          members={site?.stats?.divisions?.[code] ?? null}
                          leader={site?.leadership?.find((leader) => leader.bureau_commander && leader.division === code) ?? null}/>
          ))}
        </div>
      </div>
    </section>
  );
}

// --- Units ---------------------------------------------------------------------------------

const UNIT_ICON: Record<UnitKey, typeof Gauge> = {SAHP: Gauge, AB: Plane, MU: HeartPulse, GW: Trees, FAB: Landmark, SIB: Megaphone, TB: GraduationCap};

export function Units({content}: {content: SiteContent}) {
  const units = content.units ?? {};
  return (
    <section className="relative mx-auto w-full max-w-7xl px-5 pb-20 sm:px-8">
      <SectionHeading eyebrow="Egységek és irodák" title="A szakértelem helyei"
                      text="Képesítéssel elérhető egységek: az autópályától a levegőig, a mentéstől a sajtóig."/>
      <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {UNIT_ORDER.map((key, index) => {
          const Icon = UNIT_ICON[key];
          const unit = units[key] ?? {};
          return (
            <Reveal key={key} delay={index * 70}
                    className={cn("group relative overflow-hidden rounded-2xl bg-white/[0.03] p-6 ring-1 ring-white/[0.08] transition duration-500 hover:-translate-y-1 hover:bg-white/[0.05] hover:ring-amber-300/25",
                      index === 0 && "lg:col-span-2")}>
              <div aria-hidden className="absolute -top-16 -right-16 size-40 rounded-full bg-amber-400/0 blur-2xl transition duration-700 group-hover:bg-amber-400/15"/>
              <div className="relative flex items-start gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-slate-300 ring-1 ring-white/10 transition duration-500 group-hover:bg-amber-300/15 group-hover:text-amber-200 group-hover:ring-amber-300/30">
                  <Icon className="size-5"/>
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold tracking-[0.3em] text-slate-500 uppercase">{key}</span>
                  <span className="mt-1 block font-semibold text-white">{unit.name ?? key}</span>
                  {unit.text && <span className="mt-1.5 block text-sm leading-relaxed text-slate-400">{unit.text}</span>}
                </span>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

// --- News ----------------------------------------------------------------------------------

export function NewsSection({news}: {news: NewsItem[]}) {
  const [first, ...rest] = news;
  return (
    <section id="hirek" className="relative scroll-mt-20 py-20">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_80%_20%,rgb(56_189_248/0.06),transparent_70%)]"/>
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading align="left" eyebrow="Hírek és közlemények" title="Mi történik San Fierróban?"/>
          {news.length > 0 && (
            <Reveal delay={200}>
              <Link to="/news" className="group inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-5 py-2.5 text-sm font-medium text-white ring-1 ring-white/10 transition hover:bg-white/10">
                Minden hír <ArrowRight className="size-4 transition-transform group-hover:translate-x-1"/>
              </Link>
            </Reveal>
          )}
        </div>
        {first && first.cover_url ? (
          <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Reveal variant="scale" className="lg:col-span-2 lg:row-span-2"><FeaturedNewsCard item={first} className="h-full"/></Reveal>
            {rest.slice(0, 2).map((item, index) => <Reveal key={item.id} delay={120 * (index + 1)}><NewsCard item={item} className="h-full"/></Reveal>)}
            {rest.slice(2, 5).map((item, index) => <Reveal key={item.id} delay={100 * index}><NewsCard item={item} className="h-full"/></Reveal>)}
          </div>
        ) : first ? (
          // Without a cover the lead story is a wide card, the rest a row below it.
          <div className="mt-12 space-y-6">
            <Reveal variant="scale"><WideNewsCard item={first}/></Reveal>
            {rest.length > 0 && (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {rest.slice(0, 6).map((item, index) => <Reveal key={item.id} delay={100 * index}><NewsCard item={item} className="h-full"/></Reveal>)}
              </div>
            )}
          </div>
        ) : (
          <Reveal className="mt-12 flex flex-col items-center gap-3 rounded-3xl bg-white/[0.03] px-6 py-16 text-center ring-1 ring-white/[0.08]">
            <Newspaper className="size-8 text-amber-300"/>
            <p className="text-lg font-semibold text-white">Hamarosan</p>
            <p className="max-w-md text-slate-400">A Sheriff&apos;s Information Bureau itt osztja meg a department híreit és közleményeit.</p>
          </Reveal>
        )}
      </div>
    </section>
  );
}

// --- Values --------------------------------------------------------------------------------

export function Values({values}: {values: {title: string; text: string}[]}) {
  if (values.length === 0) return null;
  return (
    <section className="relative overflow-hidden border-y border-white/[0.06] bg-[#04081a] py-24">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.025)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.025)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,#000,transparent_75%)]"/>
      <SheriffStar variant="watermark" spin className="pointer-events-none absolute top-1/2 left-1/2 size-[52rem] -translate-x-1/2 -translate-y-1/2 opacity-25"/>
      <div className="relative mx-auto grid w-full max-w-7xl grid-cols-1 gap-12 px-5 sm:px-8 md:grid-cols-3">
        {values.map((value, index) => (
          <Reveal key={value.title} delay={index * 160} variant="blur" className="text-center">
            <p className="font-serif text-[clamp(1.9rem,3vw,2.7rem)] font-bold tracking-[0.05em] whitespace-nowrap uppercase [overflow-wrap:normal]">
              <span className="text-shimmer">{value.title}</span>
            </p>
            <div aria-hidden className="mx-auto mt-4 h-px w-16 bg-gradient-to-r from-transparent via-amber-300/70 to-transparent"/>
            <p className="mx-auto mt-5 max-w-xs leading-relaxed text-slate-400">{value.text}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// --- Leadership ----------------------------------------------------------------------------

const TIER_TITLE = ["Bureau Manager", "Executive Staff", "Command Staff", "Bureau Commander"] as const;

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function Leader({leader, large = false, index}: {leader: LeaderCard; large?: boolean; index: number}) {
  const title = leader.bureau_manager ? "Bureau Manager"
    : leader.tier === 3 || (leader.bureau_commander && leader.tier > 1) ? `${leader.division ?? ""} Bureau Commander`.trim() : TIER_TITLE[leader.tier];
  const avatar = getOptimizedAvatarUrl(leader.avatar_url, large ? 240 : 160);
  return (
    <Reveal delay={index * 70} variant="scale" className={cn("group flex flex-col items-center text-center", large && "md:flex-row md:text-left md:gap-8")}>
      <div className={cn("relative shrink-0", large ? "size-36" : "size-24")}>
        <div aria-hidden className="absolute inset-[-6px] rounded-full bg-[conic-gradient(from_0deg,#fde68a,#b45309,#fde68a,#b45309,#fde68a)] opacity-70 blur-[1px] transition duration-700 group-hover:rotate-180 group-hover:opacity-100"/>
        <div className="relative size-full overflow-hidden rounded-full bg-[#0a1122] ring-4 ring-[#030712]">
          {avatar ? <img src={avatar} alt="" loading="lazy" className="size-full object-cover transition-transform duration-700 group-hover:scale-110"/> : (
            <span className="grid size-full place-items-center bg-gradient-to-br from-slate-700 to-slate-900 text-xl font-bold text-amber-200">{initials(leader.full_name)}</span>
          )}
        </div>
      </div>
      <div className={cn("mt-4 min-w-0", large && "md:mt-0")}>
        <p className={cn("font-semibold text-white wrap-anywhere", large ? "text-2xl" : "text-base")}>{leader.full_name}</p>
        <p className="text-sm text-slate-400">{leader.faction_rank}</p>
        <p className="mt-2 inline-flex rounded-full bg-amber-300/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-amber-200 ring-1 ring-amber-300/25">{title}</p>
      </div>
    </Reveal>
  );
}

export function Leadership({leaders}: {leaders: LeaderCard[] | null}) {
  if (!leaders || leaders.length === 0) return null;
  const manager = leaders.filter((leader) => leader.tier === 0);
  const rest = leaders.filter((leader) => leader.tier !== 0);
  return (
    <section id="vezetes" className="relative scroll-mt-20 py-20">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionHeading eyebrow="A vezetés" title={<>Akik a <span className="text-shimmer">jelvényért</span> felelnek</>}
                        text="A Bureau Manager, az Executive és a Command Staff, valamint az osztályok parancsnokai."/>
        {manager.length > 0 && (
          <div className="mx-auto mt-14 flex max-w-3xl flex-col items-center gap-10 rounded-3xl bg-gradient-to-b from-amber-300/[0.07] to-transparent p-8 ring-1 ring-amber-300/15">
            {manager.map((leader, index) => <Leader key={leader.full_name} leader={leader} large index={index}/>)}
          </div>
        )}
        <div className="mt-12 flex flex-wrap justify-center gap-x-10 gap-y-12">
          {rest.map((leader, index) => <div key={leader.full_name} className="w-40 sm:w-48"><Leader leader={leader} index={index}/></div>)}
        </div>
      </div>
    </section>
  );
}

// --- Recruitment ---------------------------------------------------------------------------

export function Recruitment({content, open}: {content: SiteContent; open: boolean}) {
  const recruitment = content.recruitment ?? {};
  const steps = recruitment.steps ?? [];
  const timeline = useRef<HTMLOListElement>(null);
  const progress = useScrollProgress(timeline);
  // The line fills while the steps pass the middle of the screen.
  const fill = Math.min(1, Math.max(0, (progress - 0.25) / 0.45));
  return (
    <section id="csatlakozz" className="relative scroll-mt-20 px-5 py-16 sm:px-8">
      <div className="relative mx-auto w-full max-w-7xl overflow-hidden rounded-[2rem] bg-[#070d1d] p-8 ring-1 ring-amber-300/15 sm:p-12 lg:p-16">
        <div aria-hidden className="pointer-events-none absolute -top-40 -left-40 size-[34rem] rounded-full bg-amber-500/[0.12] blur-[100px]"/>
        <div aria-hidden className="pointer-events-none absolute -right-40 -bottom-40 size-[30rem] rounded-full bg-sky-500/[0.08] blur-[100px]"/>
        <SheriffStar variant="hologram" className="pointer-events-none absolute top-10 right-10 size-64 opacity-[0.07]" spin/>
        <div className="relative grid grid-cols-1 gap-14 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHeading align="left" eyebrow="Toborzás" title={recruitment.title ?? "Csatlakozz hozzánk"} text={recruitment.text}/>
            <Reveal delay={200} className={cn("mt-7 inline-flex items-center gap-2.5 rounded-full px-4 py-2 text-sm font-semibold ring-1",
              open ? "bg-emerald-500/10 text-emerald-300 ring-emerald-400/30" : "bg-white/5 text-slate-300 ring-white/10")}>
              <span className="relative grid size-2.5 place-items-center">
                {open && <span className="pulse-ring absolute inset-0 rounded-full bg-emerald-400"/>}
                <span className={cn("relative size-2 rounded-full", open ? "bg-emerald-400" : "bg-slate-500")}/>
              </span>
              {open ? "A jelentkezés most nyitva" : "A jelentkezés most szünetel; figyeld a híreket"}
            </Reveal>
            {(recruitment.requirements ?? []).length > 0 && (
              <ul className="mt-9 space-y-3">
                {(recruitment.requirements ?? []).map((requirement, index) => (
                  <Reveal as="li" key={requirement} delay={240 + index * 90} variant="left" className="flex items-start gap-3 text-slate-200">
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-amber-300/15 text-amber-200 ring-1 ring-amber-300/30"><Check className="size-3.5"/></span>
                    {requirement}
                  </Reveal>
                ))}
              </ul>
            )}
            <Reveal delay={420} className="mt-10 flex flex-wrap gap-3">
              <Link to="/register" className="group relative inline-flex h-12 items-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 px-7 text-[15px] font-semibold text-black shadow-[0_18px_40px_-14px_rgb(234_179_8/0.9)] transition hover:brightness-110">
                <span aria-hidden className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent transition-transform duration-700 group-hover:translate-x-full"/>
                Jelentkezés indítása <ArrowRight className="size-4 transition-transform group-hover:translate-x-1"/>
              </Link>
              {recruitment.exam_id && (
                <Link to={`/exam/public/${recruitment.exam_id}`} className="inline-flex h-12 items-center gap-2 rounded-full bg-white/[0.06] px-6 text-[15px] font-medium text-white ring-1 ring-white/15 transition hover:bg-white/10">
                  <BadgeCheck className="size-4 text-amber-200"/> Felvételi vizsga
                </Link>
              )}
            </Reveal>
          </div>
          {steps.length > 0 && (
            <ol ref={timeline} className="relative space-y-9 pl-14">
              <div aria-hidden className="absolute top-2 bottom-2 left-[19px] w-px bg-white/10"/>
              <div aria-hidden className="absolute top-2 left-[19px] w-px origin-top bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 shadow-[0_0_12px_rgb(250_204_21/0.6)]"
                   style={{height: "calc(100% - 1rem)", transform: `scaleY(${fill})`} as CSSProperties}/>
              {steps.map((step, index) => {
                const reached = fill >= (index + 0.4) / steps.length;
                return (
                  <Reveal as="li" key={step.title} delay={index * 100} variant="left" className="relative">
                    <span className={cn("absolute top-0 -left-14 grid size-10 place-items-center rounded-full text-sm font-bold ring-1 transition duration-700",
                      reached ? "bg-amber-300 text-black ring-amber-200 shadow-[0_0_24px_rgb(250_204_21/0.55)]" : "bg-[#0a1122] text-slate-400 ring-white/15")}>
                      {index + 1}
                    </span>
                    <p className="pt-1.5 text-lg font-semibold text-white">{step.title}</p>
                    <p className="mt-1 text-slate-400">{step.text}</p>
                  </Reveal>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}

// --- Gallery -------------------------------------------------------------------------------

export function Gallery({items}: {items: {url: string; caption?: string}[]}) {
  const [open, setOpen] = useState<number | null>(null);
  const usable = useMemo(() => items.filter((item) => /^https:\/\//.test(item.url)), [items]);
  if (usable.length === 0) return null;
  const current = open === null ? null : usable[open];
  const go = (delta: number) => setOpen((value) => (value === null ? null : (value + delta + usable.length) % usable.length));
  return (
    <section className="relative mx-auto w-full max-w-7xl px-5 py-24 sm:px-8">
      <SectionHeading eyebrow="Pillanatok" title="A szolgálat képekben"/>
      <div className="mt-12 columns-1 gap-4 sm:columns-2 lg:columns-3">
        {usable.map((item, index) => (
          <Reveal key={item.url} delay={(index % 6) * 70} className="mb-4 break-inside-avoid">
            <button type="button" onClick={() => setOpen(index)} className="group relative block w-full overflow-hidden rounded-2xl ring-1 ring-white/10">
              <img src={getOptimizedImageUrl(item.url, 900) || item.url} alt={item.caption ?? ""} loading="lazy" decoding="async"
                   className="w-full transition-transform duration-[1.2s] ease-out group-hover:scale-105"/>
              {item.caption && (
                <span className="absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black/80 to-transparent p-4 pt-10 text-left text-sm text-white opacity-0 transition duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                  {item.caption}
                </span>
              )}
            </button>
          </Reveal>
        ))}
      </div>
      <Dialog open={current !== null} onOpenChange={(value) => !value && setOpen(null)}>
        <DialogContent className="max-w-[min(96vw,1400px)] border-none bg-transparent p-0 shadow-none sm:max-w-[min(96vw,1400px)]"
                       onKeyDown={(event) => {
                         if (event.key === "ArrowRight") go(1);
                         if (event.key === "ArrowLeft") go(-1);
                       }}>
          <DialogTitle className="sr-only">{current?.caption ?? "Kép"}</DialogTitle>
          {current && (
            <figure className="relative">
              <img src={getOptimizedImageUrl(current.url, 1800) || current.url} alt={current.caption ?? ""} className="max-h-[85vh] w-full rounded-2xl object-contain"/>
              {current.caption && <figcaption className="mt-3 text-center text-sm text-slate-300">{current.caption}</figcaption>}
              {usable.length > 1 && (
                <>
                  <button type="button" aria-label="Előző" onClick={() => go(-1)} className="absolute top-1/2 left-3 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white ring-1 ring-white/20 hover:bg-black/80"><ChevronLeft/></button>
                  <button type="button" aria-label="Következő" onClick={() => go(1)} className="absolute top-1/2 right-3 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white ring-1 ring-white/20 hover:bg-black/80"><ChevronRight/></button>
                </>
              )}
              <button type="button" aria-label="Bezárás" onClick={() => setOpen(null)} className="absolute top-3 right-3 grid size-10 place-items-center rounded-full bg-black/60 text-white ring-1 ring-white/20"><X className="size-4"/></button>
            </figure>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

// --- FAQ and the last call ------------------------------------------------------------------

export function Faq({items}: {items: {q: string; a: string}[]}) {
  if (items.length === 0) return null;
  return (
    <section className="relative mx-auto w-full max-w-4xl px-5 py-20 sm:px-8">
      <SectionHeading eyebrow="Gyakori kérdések" title="Amit a jelentkezők kérdezni szoktak"/>
      <Reveal delay={150} className="mt-12">
        <Accordion type="single" collapsible className="space-y-3">
          {items.map((item, index) => (
            <AccordionItem key={`${item.q}-${index}`} value={`q-${index}`} className="overflow-hidden rounded-2xl border-none bg-white/[0.03] px-6 ring-1 ring-white/[0.08] data-[state=open]:ring-amber-300/25">
              <AccordionTrigger className="py-5 text-left text-base font-semibold text-white hover:no-underline">{item.q}</AccordionTrigger>
              <AccordionContent className="pb-5 text-base leading-relaxed text-slate-400">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Reveal>
      <Reveal delay={220} className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-400">
        Nem találod a választ, vagy bejelentenél valamit?
        <Link to="/contact" className="inline-flex items-center gap-1.5 font-semibold text-amber-200 hover:text-amber-100">
          Írj nekünk <ArrowRight className="size-4"/>
        </Link>
      </Reveal>
    </section>
  );
}

export function FinalCall({open}: {open: boolean}) {
  return (
    <section className="relative overflow-hidden px-5 pt-10 pb-28 sm:px-8">
      <Reveal variant="scale" className="relative mx-auto flex w-full max-w-5xl flex-col items-center overflow-hidden rounded-[2rem] bg-gradient-to-br from-amber-300/[0.12] via-[#0a1122] to-sky-500/[0.08] px-8 py-16 text-center ring-1 ring-amber-300/20">
        <SheriffStar className="size-20 drop-shadow-[0_10px_22px_rgb(0_0_0/0.55)] animate-float-y"/>
        <h2 className="mt-6 text-[clamp(1.9rem,4vw,3rem)] leading-tight font-bold tracking-tight text-white">Készen állsz a <span className="text-shimmer">jelvényre</span>?</h2>
        <p className="mt-4 max-w-xl text-lg text-slate-400">
          {open ? "A jelentkezés nyitva: néhány perc, és elindulhatsz az akadémia felé." : "A jelentkezés most szünetel, de a következő toborzásról itt és a hírekben is szólunk."}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/register" className="inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 px-7 text-[15px] font-semibold text-black transition hover:brightness-110">
            Jelentkezés <ArrowRight className="size-4"/>
          </Link>
          <Link to="/login" className="inline-flex h-12 items-center gap-2 rounded-full bg-white/[0.06] px-6 text-[15px] font-medium text-white ring-1 ring-white/15 transition hover:bg-white/10">
            <ShieldCheck className="size-4 text-amber-200"/> Belépés tagoknak
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
