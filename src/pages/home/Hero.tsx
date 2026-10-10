import {Fragment, memo, type CSSProperties, type ReactNode} from "react";
import {ArrowDown, ArrowUpRight, CalendarClock, Newspaper, Users} from "lucide-react";
import {SheriffStar, SHERIFF_STAR_OUTLINE} from "@/components/brand/SheriffStar";
import {FORUM_APPLICATIONS_URL} from "@/lib/forum";
import type {PublicSite, SiteContent} from "@/lib/site";
import {cn} from "@/lib/utils";
import {seeded, useTilt} from "./motion";
import {scrollToSection} from "./PublicChrome";
import {Skyline} from "./Skyline";

const DEFAULT_HERO: Required<NonNullable<SiteContent["hero"]>> = {
  eyebrow: "San Fierro Sheriff's Department",
  title: "A megye szolgálatában.",
  highlight: "Egy jelvény. Egy csapat.",
  subtitle: "Járőrszolgálat, nyomozás és különleges egységek San Fierro megyében. Fegyelem, szakértelem és összetartás: csatlakozz a megye legszervezettebb rendvédelmi szervéhez.",
  primary: "Csatlakozz hozzánk",
  secondary: "Legfrissebb hírek",
};

/** A twinkling sky (fixed seed: the same stars on every visit). */
const Stars = memo(function Stars() {
  const random = seeded(7);
  const stars = Array.from({length: 120}, () => ({
    left: random() * 100, top: random() * 62, size: random() < 0.15 ? 2 : 1 + random() * 0.6,
    gold: random() < 0.18, duration: 3 + random() * 6, delay: -random() * 8,
  }));
  return (
    <div aria-hidden className="hero-depth-stars absolute inset-0 -z-10">
      {stars.map((star, index) => (
        <span key={index} className={cn("absolute rounded-full", star.gold ? "bg-amber-200" : "bg-white")}
              style={{left: `${star.left}%`, top: `${star.top}%`, width: star.size, height: star.size,
                animation: `twinkle ${star.duration}s ease-in-out ${star.delay}s infinite alternate`} as CSSProperties}/>
      ))}
    </div>
  );
});

/** Words rising one after the other from behind a mask. */
function Words({text, offset = 0, wordClass}: {text: string; offset?: number; wordClass?: string}) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <>
      {words.map((word, index) => (
        <Fragment key={`${word}-${index}`}>
          <span className="hero-word">
            <span className={wordClass} style={{"--i": index + offset} as CSSProperties}>{word}</span>
          </span>
          {index < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </>
  );
}

function Emblem() {
  const tilt = useTilt<HTMLDivElement>(9);
  return (
    <div className="hero-emblem-in relative mx-auto aspect-square w-[min(72vw,25rem)] lg:w-[min(34vw,30rem,56vh)]">
      <div aria-hidden className="emblem-breathe absolute inset-[-22%] rounded-full bg-[radial-gradient(circle,rgb(250_204_21/0.28),transparent_62%)] blur-2xl"/>
      {/* Rings turning against each other, a light orbiting them */}
      <svg aria-hidden viewBox="0 0 200 200" className="orbit absolute inset-[-14%]" style={{"--orbit": "90s"} as CSSProperties}>
        <circle cx="100" cy="100" r="98" fill="none" stroke="rgb(253 230 138 / 0.22)" strokeWidth="0.35" strokeDasharray="1 3.2"/>
        <circle cx="100" cy="100" r="93" fill="none" stroke="rgb(253 230 138 / 0.12)" strokeWidth="0.8" strokeDasharray="26 12"/>
      </svg>
      <svg aria-hidden viewBox="0 0 200 200" className="orbit orbit-reverse absolute inset-[-5%]" style={{"--orbit": "140s"} as CSSProperties}>
        <circle cx="100" cy="100" r="99" fill="none" stroke="rgb(253 230 138 / 0.18)" strokeWidth="0.4" strokeDasharray="60 8 2 8"/>
      </svg>
      <div aria-hidden className="orbit absolute inset-[-14%]" style={{"--orbit": "16s"} as CSSProperties}>
        <span className="absolute top-[1%] left-1/2 size-2 -translate-x-1/2 rounded-full bg-amber-200 shadow-[0_0_14px_4px_rgb(253_230_138/0.6)]"/>
      </div>
      <div aria-hidden className="orbit orbit-reverse absolute inset-[-5%]" style={{"--orbit": "26s"} as CSSProperties}>
        <span className="absolute bottom-[0.5%] left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-sky-200 shadow-[0_0_12px_3px_rgb(186_230_253/0.55)]"/>
      </div>
      <div ref={tilt} className="tilt-card relative size-full">
        <SheriffStar variant="hologram" className="absolute inset-[-7%] opacity-40" spin/>
        <SheriffStar detail="seal" className="relative size-full drop-shadow-[0_30px_50px_rgb(0_0_0/0.55)]"/>
        <svg aria-hidden viewBox="0 0 200 200" className="pointer-events-none absolute inset-0">
          <path d={SHERIFF_STAR_OUTLINE} pathLength={1000} fill="none" stroke="#fffbeb" strokeOpacity="0.85" strokeWidth="1" strokeLinecap="round"
                strokeLinejoin="round" strokeDasharray="110 890" className="star-glint" style={{filter: "drop-shadow(0 0 3px #fde68a)"}}/>
        </svg>
      </div>
    </div>
  );
}

export function Hero({site, ticker}: {site: PublicSite | null; ticker?: ReactNode}) {
  const hero = {...DEFAULT_HERO, ...(site?.content.hero ?? {})};
  const titleWords = hero.title.split(/\s+/).filter(Boolean).length;
  // Each sentence of the gold line on its own line ("Egy jelvény." / "Egy csapat.").
  const highlight = hero.highlight.split(/(?<=[.!?])\s+/).filter(Boolean);
  const open = site?.recruitment.open ?? false;
  return (
    <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden" aria-label={hero.eyebrow}>
      <div aria-hidden className="absolute inset-0 -z-20 bg-[radial-gradient(130%_90%_at_72%_0%,#16305e_0%,#0a1630_34%,#040915_68%,#030712_100%)]"/>
      <Stars/>
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="searchlight left-[4%]"/>
        <div className="searchlight searchlight-b right-[2%]"/>
      </div>
      <div aria-hidden className="pointer-events-none absolute top-[-18rem] left-[30%] -z-10 h-[36rem] w-[56rem] rounded-full bg-amber-500/[0.08] blur-[110px]"/>
      <div aria-hidden className="pointer-events-none absolute top-[10%] right-[-12rem] -z-10 h-[30rem] w-[30rem] rounded-full bg-sky-500/[0.07] blur-[110px]"/>
      <Skyline className="hero-depth-skyline pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[29vh] min-h-[200px] w-full"/>
      <div aria-hidden className="film-grain pointer-events-none absolute inset-0 -z-10"/>

      <div className="hero-grid mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 items-center gap-12 px-5 pt-24 pb-[32vh] sm:px-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-6 lg:pb-[26vh]">
        <div className="hero-depth-copy relative text-center lg:text-left">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.16em] text-amber-200 uppercase ring-1 ring-amber-300/25 backdrop-blur sm:tracking-[0.28em]"
             style={{animation: "fade-in-soft 1s ease-out both"}}>
            <span className="relative grid size-2 place-items-center">
              <span className="pulse-ring absolute inset-0 rounded-full bg-amber-300"/>
              <span className="relative size-1.5 rounded-full bg-amber-300"/>
            </span>
            {hero.eyebrow}
          </p>
          <h1 className="mt-6 text-[clamp(2.6rem,min(6.2vw,8.6vh),5.4rem)] leading-[0.98] font-black tracking-[-0.035em] text-white">
            <Words text={hero.title}/>
            <br/>
            {highlight.map((sentence, index) => (
              <Fragment key={`${sentence}-${index}`}>
                {index > 0 && <br/>}
                <Words text={sentence} offset={titleWords + highlight.slice(0, index).join(" ").split(/\s+/).filter(Boolean).length} wordClass="text-shimmer"/>
              </Fragment>
            ))}
          </h1>
          <p className="hero-gap mx-auto mt-7 max-w-xl text-[17px] leading-relaxed text-slate-300 lg:mx-0" style={{animation: "fade-in-soft 1.2s ease-out 0.9s both"}}>
            {hero.subtitle}
          </p>
          <div className="hero-gap mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start" style={{animation: "fade-in-soft 1.2s ease-out 1.1s both"}}>
            {/* Joining happens on the forum's application board. */}
            <a href={FORUM_APPLICATIONS_URL} target="_blank" rel="noopener noreferrer"
               className="group relative inline-flex h-12 items-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 px-7 text-[15px] font-semibold text-black shadow-[0_18px_40px_-14px_rgb(234_179_8/0.9)] transition hover:brightness-110">
              <span aria-hidden className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent transition-transform duration-700 group-hover:translate-x-full"/>
              {hero.primary} <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"/>
            </a>
            <a href="#hirek" onClick={(event) => scrollToSection("hirek", event)}
               className="inline-flex h-12 items-center gap-2 rounded-full bg-white/[0.06] px-6 text-[15px] font-medium text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-white/10">
              <Newspaper className="size-4 text-amber-200"/> {hero.secondary}
            </a>
          </div>
          <div className="hero-gap mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-400 lg:justify-start"
               style={{animation: "fade-in-soft 1.2s ease-out 1.3s both"}}>
            <span className={cn("inline-flex items-center gap-2", open ? "text-emerald-300" : "text-slate-400")}>
              <span className="relative grid size-2.5 place-items-center">
                {open && <span className="pulse-ring absolute inset-0 rounded-full bg-emerald-400"/>}
                <span className={cn("relative size-2 rounded-full", open ? "bg-emerald-400" : "bg-slate-500")}/>
              </span>
              {open ? "A toborzás nyitva" : "A toborzás most szünetel"}
            </span>
            {site?.stats && <span className="inline-flex items-center gap-2"><Users className="size-4 text-slate-500"/> {site.stats.members} aktív tag</span>}
            {site?.stats?.since && <span className="inline-flex items-center gap-2"><CalendarClock className="size-4 text-slate-500"/> {site.stats.since} óta szolgálatban</span>}
          </div>
        </div>
        <div className="hero-depth-emblem"><Emblem/></div>
      </div>

      {/* Like a news channel's bar: the latest headlines run along the bottom of the first screen. */}
      {ticker && <div className="absolute inset-x-0 bottom-0 z-10">{ticker}</div>}
      <a href="#rolunk" onClick={(event) => scrollToSection("rolunk", event)} aria-label="Tovább"
         className={cn("hero-depth-cue absolute left-1/2 hidden -translate-x-1/2 flex-col items-center gap-1.5 rounded-full bg-[#030712]/55 px-2.5 pt-2.5 pb-2 text-slate-400 ring-1 ring-white/10 backdrop-blur-md transition-colors hover:text-white sm:flex",
           ticker ? "bottom-20" : "bottom-6")}>
        <span className="scroll-cue relative block h-8 w-5 rounded-full border border-current"/>
        <ArrowDown className="size-3 opacity-60"/>
      </a>
    </section>
  );
}
