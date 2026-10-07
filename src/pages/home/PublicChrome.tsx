import {useEffect, useRef, useState, type MouseEvent, type ReactNode} from "react";
import {Link, useLocation} from "react-router";
import {ArrowRight, BadgeCheck, LogIn, Menu, MessageSquareText, Newspaper, ShieldHalf, X} from "lucide-react";
import {SheriffStar} from "@/components/brand/SheriffStar";
import {useAuth} from "@/context/AuthContext";
import {ALERT_LEVELS} from "@/lib/alert-levels";
import {cn} from "@/lib/utils";

export const HOME_SECTIONS = [
  {id: "rolunk", label: "Rólunk"},
  {id: "osztalyok", label: "Osztályok"},
  {id: "hirek", label: "Hírek"},
  {id: "vezetes", label: "Vezetés"},
  {id: "csatlakozz", label: "Csatlakozz"},
] as const;

/** Scrolls smoothly to a section of the front page (and keeps the address bar tidy). */
export function scrollToSection(id: string, event?: MouseEvent) {
  const target = document.getElementById(id);
  if (!target) return;
  event?.preventDefault();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({top: target.getBoundingClientRect().top + window.scrollY - 72, behavior: reduced ? "auto" : "smooth"});
  history.replaceState(null, "", `#${id}`);
}

/**
 * The public pages' top bar: see-through over the hero, frosted once the page scrolls. Links to
 * the front page's sections, the news and the sign-in (or back to the intranet when signed in).
 */
export function PublicHeader({onHome = false, alertLevel}: {onHome?: boolean; alertLevel?: string | null}) {
  const {session} = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const location = useLocation();
  const level = alertLevel ? ALERT_LEVELS[alertLevel as keyof typeof ALERT_LEVELS] : null;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, {passive: true});
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // The section in view lights up in the menu.
  useEffect(() => {
    if (!onHome || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActive(visible.target.id);
    }, {rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.2, 0.5]});
    const timer = window.setTimeout(() => {
      HOME_SECTIONS.forEach((section) => {
        const element = document.getElementById(section.id);
        if (element) observer.observe(element);
      });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [onHome]);

  const homeHref = onHome ? "" : "/home";
  const sectionLink = (id: string, label: string, className?: string) => (
    <a key={id} href={`${homeHref}#${id}`} className={className}
       onClick={(event) => {
         setOpen(false);
         if (onHome) scrollToSection(id, event);
       }}>{label}</a>
  );

  return (
    <header className={cn("public-header fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-500",
      scrolled || open ? "bg-[#030712]/75 shadow-[0_10px_40px_-20px_rgb(0_0_0/0.8)] backdrop-blur-xl" : "bg-transparent")}>
      <div className={cn("pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-300/30 to-transparent transition-opacity duration-500",
        scrolled ? "opacity-100" : "opacity-0")}/>
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-5 sm:px-8">
        <Link to={onHome ? "#" : "/home"} onClick={(event) => {
          if (onHome) {
            event.preventDefault();
            window.scrollTo({top: 0, behavior: "smooth"});
          }
        }} className="group flex items-center gap-3">
          <SheriffStar className="size-9 drop-shadow-[0_2px_4px_rgb(0_0_0/0.55)] transition-transform duration-500 group-hover:rotate-[25deg]"/>
          <span className="leading-tight">
            <span className="block text-sm font-bold tracking-[0.18em] text-white">SFSD</span>
            <span className="hidden text-[10px] tracking-[0.12em] text-slate-400 uppercase sm:block">San Fierro Sheriff&apos;s Department</span>
          </span>
        </Link>

        <nav className="ml-6 hidden items-center gap-1 lg:flex" aria-label="Főoldal részei">
          {HOME_SECTIONS.map((section) => sectionLink(section.id, section.label, cn(
            "relative rounded-full px-3.5 py-1.5 text-sm transition-colors after:absolute after:bottom-0 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-amber-300 after:transition after:duration-300",
            active === section.id ? "text-white after:opacity-100" : "text-slate-300 after:scale-0 after:opacity-0 hover:text-white",
          )))}
          <Link to="/news" className={cn("rounded-full px-3.5 py-1.5 text-sm transition-colors",
            location.pathname.startsWith("/news") ? "text-amber-200" : "text-slate-300 hover:text-white")}>Minden hír</Link>
          <Link to="/contact" className={cn("rounded-full px-3.5 py-1.5 text-sm transition-colors",
            location.pathname.startsWith("/contact") ? "text-amber-200" : "text-slate-300 hover:text-white")}>Kapcsolat</Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {level && (
            <span className={cn("hidden items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 md:inline-flex", level.badge)}
                  title={level.description}>
              <level.icon className="size-3.5"/> Készültség: {level.label}
            </span>
          )}
          {session ? (
            <Link to="/dashboard" className="inline-flex h-9 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-medium text-white ring-1 ring-white/15 transition hover:bg-white/15">
              <ShieldHalf className="size-4 text-amber-300"/> Intranet
            </Link>
          ) : (
            <Link to="/login" className="group inline-flex h-9 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-medium text-white ring-1 ring-white/15 transition hover:bg-white/15">
              <LogIn className="size-4 text-amber-300"/> Belépés
            </Link>
          )}
          <button type="button" className="grid size-9 place-items-center rounded-full text-slate-200 ring-1 ring-white/15 lg:hidden"
                  aria-label={open ? "Menü bezárása" : "Menü"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            {open ? <X className="size-4"/> : <Menu className="size-4"/>}
          </button>
        </div>
      </div>
      {open && (
        <nav className="animate-fade border-t border-white/5 px-5 pt-2 pb-5 lg:hidden" aria-label="Menü">
          {HOME_SECTIONS.map((section) => sectionLink(section.id, section.label, "block rounded-lg px-3 py-3 text-base text-slate-200 hover:bg-white/5"))}
          <Link to="/news" className="block rounded-lg px-3 py-3 text-base text-slate-200 hover:bg-white/5">Minden hír</Link>
          <Link to="/contact" className="block rounded-lg px-3 py-3 text-base text-slate-200 hover:bg-white/5">Kapcsolat</Link>
        </nav>
      )}
    </header>
  );
}

/** The bottom of the public pages. */
export function PublicFooter({links = []}: {links?: {label: string; url: string}[]}) {
  const year = new Date().getFullYear();
  return (
    <footer className="relative overflow-hidden border-t border-white/5 bg-[#020510]">
      <SheriffStar variant="watermark" className="pointer-events-none absolute -right-24 -bottom-32 size-[30rem] opacity-60"/>
      <div className="relative mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 px-5 py-14 sm:px-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <SheriffStar className="size-12"/>
            <div>
              <p className="font-semibold tracking-wide text-white">San Fierro Sheriff&apos;s Department</p>
              <p className="text-xs tracking-[0.3em] text-amber-300/80 uppercase">Integrity · Service · Protection</p>
            </div>
          </div>
          <p className="max-w-md text-sm text-slate-400">A megye szolgálatában: járőrszolgálat, nyomozás és különleges egységek San Fierro megyében.</p>
        </div>
        <div className="space-y-3 text-sm">
          <p className="text-xs font-semibold tracking-[0.25em] text-slate-500 uppercase">Oldalak</p>
          <Link to="/news" className="flex items-center gap-2 text-slate-300 hover:text-white"><Newspaper className="size-4 text-slate-500"/> Hírek és közlemények</Link>
          <Link to="/register" className="flex items-center gap-2 text-slate-300 hover:text-white"><ArrowRight className="size-4 text-slate-500"/> Jelentkezés</Link>
          <Link to="/contact" className="flex items-center gap-2 text-slate-300 hover:text-white"><MessageSquareText className="size-4 text-slate-500"/> Panasz, bejelentés, kérdés</Link>
          <Link to="/certificates" className="flex items-center gap-2 text-slate-300 hover:text-white"><BadgeCheck className="size-4 text-slate-500"/> Oklevél ellenőrzése</Link>
          <Link to="/login" className="flex items-center gap-2 text-slate-300 hover:text-white"><LogIn className="size-4 text-slate-500"/> Belépés az intranetre</Link>
        </div>
        <div className="space-y-3 text-sm">
          <p className="text-xs font-semibold tracking-[0.25em] text-slate-500 uppercase">Elérhetőség</p>
          {links.length === 0 ? <p className="text-slate-500">San Fierro, Downtown</p> : links.map((link) => (
            <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="block text-slate-300 hover:text-white">{link.label}</a>
          ))}
        </div>
      </div>
      <div className="relative border-t border-white/5">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-5 py-5 text-[11px] text-slate-500 sm:px-8">
          <span>© {year} San Fierro Sheriff&apos;s Department · San Fierro Sheriff&apos;s Department Intranet</span>
          <span>Szerepjátékhoz készült oldal · hl-rpg.eu</span>
        </div>
      </div>
    </footer>
  );
}

/** A faint light follows the pointer across the page (mouse only, not for reduced motion). */
function PointerLight() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia("(hover: none), (prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    const apply = () => {
      frame = 0;
      element.style.setProperty("--px", `${x}px`);
      element.style.setProperty("--py", `${y}px`);
    };
    const move = (event: PointerEvent) => {
      x = event.clientX;
      y = event.clientY;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    window.addEventListener("pointermove", move, {passive: true});
    return () => {
      window.removeEventListener("pointermove", move);
      cancelAnimationFrame(frame);
    };
  }, []);
  return <div ref={ref} aria-hidden className="pointer-light pointer-events-none fixed inset-0 z-[1]"/>;
}

/** The frame of the public pages: header, page, footer on the night background. */
export function PublicShell({children, onHome, alertLevel, links}: {children: ReactNode; onHome?: boolean; alertLevel?: string | null; links?: {label: string; url: string}[]}) {
  return (
    <div className="relative min-h-dvh overflow-x-clip bg-[#030712] text-slate-200 antialiased selection:bg-amber-300/30 selection:text-white">
      <PointerLight/>
      <PublicHeader onHome={onHome} alertLevel={alertLevel}/>
      <main>{children}</main>
      <PublicFooter links={links}/>
    </div>
  );
}
