import {useEffect, useState, type CSSProperties, type ReactNode} from "react";
import {Link} from "react-router";
import {AppBackdrop} from "@/components/layout/AppBackdrop";
import {SheriffStar} from "@/components/brand/SheriffStar";
import {useSystemStatus} from "@/context/SystemStatusContext";
import {ALERT_LEVELS} from "@/lib/alert-levels";
import {formatLongDate, formatTime} from "@/lib/datetime";
import {cn} from "@/lib/utils";

export type AuthTone = "gold" | "red" | "blue";

/** The extra light behind the auth pages (follows the chosen division on the registration). */
const TONE_GLOW: Record<AuthTone, string> = {
  gold: "rgb(234 179 8 / 0.16)",
  red: "rgb(239 68 68 / 0.18)",
  blue: "rgb(56 189 248 / 0.18)",
};

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="hidden text-right sm:block">
      <p className="font-mono text-sm font-semibold tabular-nums text-slate-100">{formatTime(now, true)}</p>
      <p className="text-[11px] text-slate-500">{formatLongDate(now)}</p>
    </div>
  );
}

/**
 * The frame of the public pages (login, registration): the app's backdrop with an extra glow,
 * the brand, the time in Hungary and the faction's alert level (public, already loaded).
 */
export function AuthShell({children, tone = "gold", aside, asideLast = false, embedded = false}: {
  children: ReactNode;
  tone?: AuthTone;
  aside?: ReactNode;
  /** The side panel after the main content (on wide screens: on the right). */
  asideLast?: boolean;
  /** Inside the app frame (onboarding): the app already draws the backdrop. */
  embedded?: boolean;
}) {
  const {alertLevel} = useSystemStatus();
  const level = ALERT_LEVELS[alertLevel] ?? ALERT_LEVELS.normal;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden text-slate-200">
      {!embedded && <AppBackdrop/>}
      <div aria-hidden className={cn("pointer-events-none inset-0 -z-10 transition-[background] duration-1000", embedded ? "absolute" : "fixed")}
           style={{background: `radial-gradient(60% 55% at 70% 45%, ${TONE_GLOW[tone]}, transparent 70%)`} as CSSProperties}/>

      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center gap-4 px-5 pt-5 sm:px-8">
        <Link to="/login" className="flex items-center gap-3">
          <SheriffStar className="size-10 drop-shadow-[0_0_14px_rgb(234_179_8/0.45)]"/>
          <span>
            <span className="block text-sm font-semibold tracking-wide text-white">SFSD Intranet</span>
            <span className="hidden text-[11px] text-slate-500 sm:block">San Fierro Sheriff&apos;s Department</span>
          </span>
        </Link>
        <span className={cn("ml-auto inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium ring-1", level.badge)}
              title={level.description}>
          <level.icon className="size-3.5"/> <span className="hidden sm:inline">Készültség:</span> {level.label}
        </span>
        <Clock/>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 items-center px-5 py-8 sm:px-8 lg:py-12">
        {aside ? (
          <div className="grid w-full grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:gap-16">
            {asideLast ? <>{children}{aside}</> : <>{aside}{children}</>}
          </div>
        ) : children}
      </main>

      <footer className="relative z-10 mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-5 pb-5 text-[11px] text-slate-500 sm:px-8">
        <span className="tracking-[0.25em] uppercase">Integrity · Service · Protection</span>
        <span>Szerepjátékhoz készült belső rendszer · hl-rpg.eu</span>
      </footer>
    </div>
  );
}
