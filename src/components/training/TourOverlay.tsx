import {useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type SyntheticEvent} from "react";
import {createPortal} from "react-dom";
import {
  AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Clock, FlaskConical, Hand, Loader2, MousePointerClick, RotateCcw, ShieldCheck, X,
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {useTourControls, type TourPhase} from "@/context/TrainingContext";
import {TONE_STYLES, type TrainingInfo} from "@/lib/training/catalog";
import {findTarget, popupOpenedFrom} from "@/lib/training/dom";
import type {TourStep} from "@/lib/training/types";
import {cn} from "@/lib/utils";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** After this long without the highlighted element the card shows in the middle instead. */
const MISSING_AFTER_MS = 6000;
const GAP = 14;
const MARGIN = 12;

/** Clicks on the tour never reach the page (and never close the dialog a step is showing). */
const swallow = (event: SyntheticEvent) => event.stopPropagation();
const blockerProps = {onPointerDown: swallow, onMouseDown: swallow, onClick: swallow, onTouchStart: swallow};

export default function TourOverlay() {
  const {phase} = useTourControls();
  return createPortal(
    <div className="tour-root pointer-events-none fixed inset-0 z-[300]" data-tour-overlay="">
      {phase.kind === "intro" && <IntroCard training={phase.training} auto={phase.auto}/>}
      {phase.kind === "loading" && <LoadingCard training={phase.training}/>}
      {phase.kind === "running" && <RunningTour phase={phase}/>}
      {phase.kind === "done" && <DoneCard training={phase.training} next={phase.next}/>}
    </div>,
    document.body,
  );
}

// --- Shared pieces -----------------------------------------------------------------------

function Backdrop() {
  return <div {...blockerProps} className="animate-fade pointer-events-auto absolute inset-0 bg-[#020617]/75 backdrop-blur-[3px]"/>;
}

function CenterCard({children, tone, wide}: {children: ReactNode; tone: TrainingInfo["tone"]; wide?: boolean}) {
  return (
    <div className="absolute inset-0 grid place-items-center overflow-y-auto p-4">
      <div {...blockerProps} role="dialog" aria-modal="true"
           className={cn("panel animate-rise pointer-events-auto relative w-full overflow-hidden shadow-[0_30px_80px_-20px_rgb(0_0_0/0.8)]",
             wide ? "max-w-[480px]" : "max-w-[420px]")}>
        <div className={cn("h-1 bg-gradient-to-r", TONE_STYLES[tone].bar)}/>
        {children}
      </div>
    </div>
  );
}

function TrainingBadge({training, size = "md"}: {training: TrainingInfo; size?: "md" | "lg"}) {
  const tone = TONE_STYLES[training.tone];
  return (
    <div className={cn("relative grid shrink-0 place-items-center rounded-2xl ring-1", tone.tile, size === "lg" ? "size-16" : "size-9 rounded-xl")}>
      {size === "lg" && <div className={cn("absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br opacity-40 blur-xl", tone.bar)}/>}
      <training.icon className={size === "lg" ? "size-8" : "size-4"}/>
    </div>
  );
}

/** `**bold**` in step texts. */
function RichText({text}: {text: string}) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith("**") && part.endsWith("**")
        ? <strong key={index} className="font-semibold text-white">{part.slice(2, -2)}</strong>
        : <span key={index}>{part}</span>)}
    </>
  );
}

// --- Intro, loading and finish cards ------------------------------------------------------

function IntroCard({training, auto}: {training: TrainingInfo; auto: boolean}) {
  const {begin, later, skip, close} = useTourControls();
  const [confirmSkip, setConfirmSkip] = useState(false);
  const tone = TONE_STYLES[training.tone];

  return (
    <>
      <Backdrop/>
      <CenterCard tone={training.tone} wide>
        {confirmSkip ? (
          <div className="space-y-4 p-6">
            <div className="flex items-center gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30">
                <AlertTriangle className="size-5"/>
              </div>
              <h2 className="text-lg font-semibold text-white">Biztosan kihagyod?</h2>
            </div>
            <p className="text-sm leading-relaxed text-slate-300">
              <strong className="text-amber-200">Nem javasoljuk.</strong> A képzés csak pár perc, és megmutatja, hol mit találsz és mire
              figyelj. Ha most kihagyod, a <strong className="text-white">Profilom → Képzések</strong> alatt bármikor lejátszhatod.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" className="text-amber-200 hover:bg-amber-500/10 hover:text-amber-100" onClick={skip}>Mégis kihagyom</Button>
              <Button onClick={() => setConfirmSkip(false)}>Inkább megnézem</Button>
            </div>
          </div>
        ) : (
          <div className="p-6 sm:p-7">
            <div className="flex items-start gap-4">
              <TrainingBadge training={training} size="lg"/>
              <div className="min-w-0 pt-1">
                <p className={cn("text-[11px] font-bold uppercase tracking-[0.2em]", tone.text)}>
                  {auto ? "Új képzés érhető el" : "Képzés"}
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-white wrap-anywhere">{training.title}</h2>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400"><Clock className="size-3.5"/> kb. {training.minutes} perc</p>
              </div>
            </div>
            <p className="mt-5 text-sm leading-relaxed text-slate-300">{training.summary}</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              <li className="flex gap-2.5"><FlaskConical className="mt-0.5 size-4 shrink-0 text-emerald-300"/>
                <span><strong className="text-white">Gyakorló mód:</strong> bemutató adatokkal dolgozol, semmit nem rontasz el, semmi sem mentődik.</span></li>
              <li className="flex gap-2.5"><Hand className="mt-0.5 size-4 shrink-0 text-sky-300"/>
                <span>Rövid lépések: ahol kell, te kattintasz. A kiemelt részen kívül semmi sem nyomható.</span></li>
              <li className="flex gap-2.5"><RotateCcw className="mt-0.5 size-4 shrink-0 text-violet-300"/>
                <span>Bármikor kiléphetsz, és a Profilom oldalon újrajátszhatod.</span></li>
            </ul>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button size="lg" className="sm:flex-1" onClick={begin} autoFocus>Kezdjük <ArrowRight/></Button>
              {auto
                ? <Button size="lg" variant="outline" onClick={later}>Később</Button>
                : <Button size="lg" variant="outline" onClick={close}>Mégse</Button>}
            </div>
            {auto && (
              <button type="button" onClick={() => setConfirmSkip(true)}
                      className="mt-3 w-full text-center text-xs text-slate-500 underline-offset-4 transition-colors hover:text-slate-300 hover:underline">
                Kihagyom ezt a képzést
              </button>
            )}
          </div>
        )}
      </CenterCard>
    </>
  );
}

function LoadingCard({training}: {training: TrainingInfo}) {
  return (
    <>
      <Backdrop/>
      <CenterCard tone={training.tone}>
        <div className="flex items-center gap-4 p-6">
          <Loader2 className={cn("size-6 animate-spin", TONE_STYLES[training.tone].text)}/>
          <div>
            <p className="text-sm font-semibold text-white">Gyakorló környezet előkészítése…</p>
            <p className="text-xs text-slate-400">Bemutató adatok, csak a te böngésződben.</p>
          </div>
        </div>
      </CenterCard>
    </>
  );
}

function DoneCard({training, next}: {training: TrainingInfo; next: TrainingInfo | null}) {
  const {startNext, later, close} = useTourControls();
  const tone = TONE_STYLES[training.tone];
  return (
    <>
      <Backdrop/>
      <CenterCard tone={training.tone} wide>
        <div className="p-6 text-center sm:p-8">
          <div className="relative mx-auto grid size-20 place-items-center">
            <span className={cn("ring-burst absolute inset-0 rounded-full ring-2", tone.ring)}/>
            <div className={cn("animate-pop grid size-20 place-items-center rounded-full ring-1", tone.tile)}>
              <CheckCircle2 className="size-10"/>
            </div>
          </div>
          <p className={cn("mt-5 text-[11px] font-bold uppercase tracking-[0.2em]", tone.text)}>Képzés teljesítve</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-white">{training.title}</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-400">
            Visszakerültél az igazi adatokhoz. A <strong className="text-slate-200">Profilom → Képzések</strong> alatt bármikor újrajátszhatod.
          </p>
          {next ? (
            <div className="mt-6 rounded-xl bg-white/[0.03] p-4 text-left ring-1 ring-white/[0.07]">
              <div className="flex items-center gap-3">
                <TrainingBadge training={next}/>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-500">Következő képzésed</p>
                  <p className="truncate text-sm font-semibold text-white">{next.title} <span className="font-normal text-slate-500">· kb. {next.minutes} perc</span></p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button className="sm:flex-1" onClick={startNext} autoFocus>Folytatom <ArrowRight/></Button>
                <Button variant="outline" onClick={later}>Később</Button>
              </div>
            </div>
          ) : (
            <Button size="lg" className="mt-6" onClick={close} autoFocus><ShieldCheck/> Kezdjük a munkát</Button>
          )}
        </div>
      </CenterCard>
    </>
  );
}

// --- The running tour ---------------------------------------------------------------------

type Running = Extract<TourPhase, {kind: "running"}>;

function RunningTour({phase}: {phase: Running}) {
  const {next, back, complete, later, skip} = useTourControls();
  const step = phase.steps[phase.index];
  const last = phase.index === phase.steps.length - 1;
  const [exitOpen, setExitOpen] = useState(false);
  const {rect, element, missing, glide, popup} = useTarget(step, phase.index);
  const waitingForTarget = !!step.target && !rect && !missing;
  const action = rect && step.action ? step.action : null;
  const goNext = last ? complete : next;

  useStepAction(step, element, phase.index, goNext);

  // Arrows move between explanation steps (not while typing or when the page needs an action).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (exitOpen || (event.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable=true]")) return;
      if (event.key === "ArrowRight" && !action) goNext();
      if (event.key === "ArrowLeft" && phase.index > 0) back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exitOpen, action, goNext, back, phase.index]);

  const padding = step.padding ?? 8;
  const hole = rect ? clipHole(rect, padding, !!element?.closest("[data-shell-header]")) : null;
  const passThrough = !!hole && (!!step.action || !!step.interactive) && !exitOpen;
  // A pop-up opened from the highlighted area (e.g. a confirmation) stays usable.
  const free = passThrough && popup;
  const tone = TONE_STYLES[phase.training.tone];

  return (
    <>
      <PracticeBanner/>
      {free ? null : hole && !exitOpen ? (
        <>
          <div aria-hidden className={cn("tour-hole pointer-events-none absolute rounded-[14px]", glide && "tour-hole-glide", action && "tour-hole-action")}
               style={{top: hole.top, left: hole.left, width: hole.width, height: hole.height, "--tour-ring": tone.rgb} as CSSProperties}/>
          {passThrough ? <Blockers hole={hole}/> : <div {...blockerProps} className="pointer-events-auto absolute inset-0"/>}
        </>
      ) : (
        <Backdrop/>
      )}

      {free && !exitOpen ? (
        // The member works in a pop-up of the page: the tour steps aside until it closes.
        <div {...blockerProps} className="animate-fade pointer-events-auto absolute right-3 bottom-3 flex max-w-[calc(100vw-1.5rem)] items-center gap-3 rounded-full bg-[#0b1324]/95 py-1.5 pr-1.5 pl-4 shadow-2xl ring-1 ring-white/10 backdrop-blur">
          <span className={cn("size-2 shrink-0 animate-pulse rounded-full bg-gradient-to-r", tone.bar)}/>
          <span className="min-w-0 truncate text-xs text-slate-300">{phase.training.title} · {step.title}</span>
          <Button size="sm" className="h-8 rounded-full" onClick={goNext}>{last ? "Befejezés" : "Tovább"} <ArrowRight/></Button>
        </div>
      ) : exitOpen ? (
        <CenterCard tone={phase.training.tone}>
          <div className="space-y-4 p-6">
            <h2 className="text-lg font-semibold text-white">Kilépsz a képzésből?</h2>
            <p className="text-sm leading-relaxed text-slate-300">
              Ha később folytatod, a következő látogatásodkor újra felajánljuk. A kihagyás <strong className="text-amber-200">nem javasolt</strong>,
              de a Profilom oldalon bármikor lejátszhatod.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => setExitOpen(false)} autoFocus>Folytatom a képzést</Button>
              <Button variant="outline" onClick={later}>Később folytatom</Button>
              <Button variant="ghost" className="text-amber-200 hover:bg-amber-500/10 hover:text-amber-100" onClick={skip}>Kihagyom a képzést</Button>
            </div>
          </div>
        </CenterCard>
      ) : (
        <StepCard key={phase.index} phase={phase} step={step} hole={hole} toneBar={tone.bar} toneText={tone.text}
                  waiting={waitingForTarget} missing={missing && !!step.target} action={action}
                  onNext={goNext} onBack={back} onExit={() => setExitOpen(true)} last={last}/>
      )}
    </>
  );
}

function PracticeBanner() {
  return (
    <div className="absolute top-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-200 shadow-lg ring-1 ring-emerald-400/40 backdrop-blur-md sm:text-xs">
      <FlaskConical className="size-3.5"/>
      <span className="uppercase tracking-[0.14em]">Gyakorló mód</span>
      <span className="hidden font-normal text-emerald-100/70 sm:inline">· bemutató adatok, semmi sem mentődik</span>
    </div>
  );
}

/** Four panes around the highlighted element: the element itself stays usable. */
function Blockers({hole}: {hole: Rect}) {
  const right = hole.left + hole.width;
  const bottom = hole.top + hole.height;
  const panes: CSSProperties[] = [
    {top: 0, left: 0, right: 0, height: Math.max(hole.top, 0)},
    {top: bottom, left: 0, right: 0, bottom: 0},
    {top: hole.top, left: 0, width: Math.max(hole.left, 0), height: hole.height},
    {top: hole.top, left: right, right: 0, height: hole.height},
  ];
  return <>{panes.map((style, index) => <div key={index} {...blockerProps} className="pointer-events-auto absolute" style={style}/>)}</>;
}

interface StepCardProps {
  phase: Running;
  step: TourStep;
  hole: Rect | null;
  toneBar: string;
  toneText: string;
  waiting: boolean;
  missing: boolean;
  action: TourStep["action"] | null;
  last: boolean;
  onNext: () => void;
  onBack: () => void;
  onExit: () => void;
}

function StepCard({phase, step, hole, toneBar, toneText, waiting, missing, action, last, onNext, onBack, onExit}: StepCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{top: number; left: number; width: number} | null>(null);
  const progress = ((phase.index + 1) / phase.steps.length) * 100;

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const place = () => setPosition(placeCard(hole, card.offsetHeight, step.placement));
    place();
    const observer = new ResizeObserver(place);
    observer.observe(card);
    window.addEventListener("resize", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [hole, step.placement]);

  return (
    <div ref={cardRef} {...blockerProps} role="dialog" aria-live="polite" aria-label={step.title}
         className={cn("panel pointer-events-auto absolute overflow-hidden shadow-[0_24px_70px_-18px_rgb(0_0_0/0.85)]",
           position ? "animate-fade" : "invisible")}
         style={position ? {top: position.top, left: position.left, width: position.width} : {top: 0, left: 0, width: cardWidth()}}>
      <div className="h-1 bg-white/5">
        <div className={cn("h-full bg-gradient-to-r transition-[width] duration-500", toneBar)} style={{width: `${progress}%`}}/>
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <p className={cn("min-w-0 flex-1 truncate text-[10px] font-bold uppercase tracking-[0.18em]", toneText)}>
            {phase.training.title} · {step.chapter}
          </p>
          <span className="text-[11px] text-slate-500 tabular-nums">{phase.index + 1}/{phase.steps.length}</span>
          <button type="button" onClick={onExit} aria-label="Kilépés a képzésből"
                  className="-mr-1 grid size-7 place-items-center rounded-md text-slate-500 transition-colors hover:bg-white/5 hover:text-white">
            <X className="size-4"/>
          </button>
        </div>
        <h3 className="mt-2 text-base font-semibold text-white wrap-anywhere">{step.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-300 wrap-anywhere"><RichText text={step.body}/></p>
        {waiting && (
          <p className="mt-3 flex items-center gap-2 text-xs text-slate-400"><Loader2 className="size-3.5 animate-spin"/> Betöltés…</p>
        )}
        {missing && (
          <p className="mt-3 text-xs text-slate-500">Ez a rész most nem látszik ezen a képernyőn; lépj tovább nyugodtan.</p>
        )}
        {action && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 ring-1 ring-white/10">
            <MousePointerClick className={cn("size-4 shrink-0 animate-pulse", toneText)}/>
            {action.type === "click" ? action.hint ?? "Kattints a kiemelt elemre." : action.hint}
          </p>
        )}
        <div className="mt-4 flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} disabled={phase.index === 0} className="text-slate-400">
            <ArrowLeft/> Vissza
          </Button>
          {action ? (
            <button type="button" onClick={onNext} className="ml-auto text-xs text-slate-500 underline-offset-4 hover:text-slate-300 hover:underline">
              Lépés átugrása
            </button>
          ) : (
            <Button size="sm" className="ml-auto" onClick={onNext} autoFocus={!step.interactive}>
              {last ? <>Befejezés <CheckCircle2/></> : <>Tovább <ArrowRight/></>}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

const cardWidth = () => Math.min(360, window.innerWidth - MARGIN * 2);

/** The highlighted area within the screen (below the sticky header, unless the element is in it). */
function clipHole(rect: Rect, padding: number, inHeader: boolean): Rect {
  const header = inHeader ? 0 : document.querySelector("[data-shell-header]")?.getBoundingClientRect().bottom ?? 0;
  const top = Math.max(rect.top - padding, header);
  const bottom = Math.min(rect.top + rect.height + padding, window.innerHeight);
  return {top, left: rect.left - padding, width: rect.width + padding * 2, height: Math.max(bottom - top, 0)};
}

/** Next to the highlighted element where it fits; docked at the top or bottom on phones. */
function placeCard(hole: Rect | null, height: number, preferred?: TourStep["placement"]) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = cardWidth();
  const clampLeft = (left: number) => Math.min(Math.max(left, MARGIN), vw - width - MARGIN);
  const clampTop = (top: number) => Math.min(Math.max(top, MARGIN), Math.max(vh - height - MARGIN, MARGIN));
  if (!hole) return {top: clampTop((vh - height) / 2), left: clampLeft((vw - width) / 2), width};
  if (vw < 640) {
    const lowerHalf = hole.top + hole.height / 2 > vh / 2;
    return {top: lowerHalf ? 44 : vh - height - MARGIN, left: MARGIN, width};
  }
  const centerX = hole.left + hole.width / 2;
  const centerY = hole.top + hole.height / 2;
  const options = {
    bottom: {fits: hole.top + hole.height + GAP + height <= vh - MARGIN, top: hole.top + hole.height + GAP, left: clampLeft(centerX - width / 2)},
    top: {fits: hole.top - GAP - height >= MARGIN, top: hole.top - GAP - height, left: clampLeft(centerX - width / 2)},
    right: {fits: hole.left + hole.width + GAP + width <= vw - MARGIN, top: clampTop(centerY - height / 2), left: hole.left + hole.width + GAP},
    left: {fits: hole.left - GAP - width >= MARGIN, top: clampTop(centerY - height / 2), left: hole.left - GAP - width},
  };
  const order = [preferred, "bottom", "right", "left", "top"].filter((side, index, list): side is keyof typeof options =>
    !!side && list.indexOf(side) === index);
  const side = order.find((name) => options[name].fits);
  if (side) return {top: options[side].top, left: options[side].left, width};
  return {top: vh - height - MARGIN, left: vw - width - MARGIN, width};
}

// --- Finding the element and waiting for the user -------------------------------------------

const sameRect = (a: Rect | null, b: Rect) =>
  !!a && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;

function scrollIntoViewIfNeeded(element: Element) {
  const rect = element.getBoundingClientRect();
  const header = 64;
  if (rect.top >= header && rect.bottom <= window.innerHeight - 16) return;
  element.scrollIntoView({block: rect.height > window.innerHeight - header - 40 ? "start" : "center", behavior: "smooth"});
}

/** How long the spotlight glides to a new element; afterwards it follows scrolling without delay. */
const GLIDE_MS = 450;

/** Follows the step's element every frame (it may move, appear late or open in a dialog). */
function useTarget(step: TourStep, stepIndex: number) {
  const [state, setState] = useState<{index: number; rect: Rect | null; element: Element | null; missing: boolean; glide: boolean; popup: boolean}>(
    {index: stepIndex, rect: null, element: null, missing: false, glide: true, popup: false});

  useEffect(() => {
    if (!step.target) return;
    const started = performance.now();
    let frame = 0;
    let lastRect: Rect | null = null;
    let lastElement: Element | null = null;
    let lastMissing = false;
    let lastGlide = true;
    let lastPopup = false;
    const watchPopups = !!step.action || !!step.interactive;
    let foundAt = 0;
    let scrolled = false;
    const tick = () => {
      const element = findTarget(step.target);
      if (element) {
        if (!scrolled) {
          scrolled = true;
          foundAt = performance.now();
          scrollIntoViewIfNeeded(element);
        }
        const box = element.getBoundingClientRect();
        const rect = {top: box.top, left: box.left, width: box.width, height: box.height};
        const glide = performance.now() - foundAt < GLIDE_MS;
        const popup = watchPopups && popupOpenedFrom(element);
        if (element !== lastElement || !sameRect(lastRect, rect) || glide !== lastGlide || popup !== lastPopup) {
          lastElement = element;
          lastRect = rect;
          lastMissing = false;
          lastGlide = glide;
          lastPopup = popup;
          setState({index: stepIndex, rect, element, missing: false, glide, popup});
        }
      } else {
        const missing = performance.now() - started > MISSING_AFTER_MS;
        if (lastElement || missing !== lastMissing) {
          lastElement = null;
          lastRect = null;
          lastMissing = missing;
          setState({index: stepIndex, rect: null, element: null, missing, glide: true, popup: false});
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [step, stepIndex]);

  return step.target && state.index === stepIndex ? state : {rect: null, element: null, missing: false, glide: true, popup: false};
}

/**
 * Moves on when the user did what the step asked (clicked the element, or the condition holds). The
 * click often navigates and removes the element, so the advance is not tied to the element's life.
 */
function useStepAction(step: TourStep, element: Element | null, stepIndex: number, onDone: () => void) {
  const done = useRef(onDone);
  const current = useRef(stepIndex);
  const fired = useRef<number | null>(null);
  useEffect(() => {
    done.current = onDone;
    current.current = stepIndex;
  });
  useEffect(() => {
    fired.current = null;
  }, [stepIndex]);

  useEffect(() => {
    const action = step.action;
    if (!action) return;
    const finish = () => {
      if (fired.current === stepIndex) return;
      fired.current = stepIndex;
      window.setTimeout(() => {
        if (current.current === stepIndex) done.current();
      }, 380);
    };

    if (action.type === "click") {
      if (!element) return;
      const onPointer = (event: Event) => {
        if (event.target instanceof Node && element.contains(event.target)) finish();
      };
      const onKey = (event: KeyboardEvent) => {
        if ((event.key === "Enter" || event.key === " ") && document.activeElement && element.contains(document.activeElement)) finish();
      };
      document.addEventListener("pointerdown", onPointer, true);
      document.addEventListener("keydown", onKey, true);
      return () => {
        document.removeEventListener("pointerdown", onPointer, true);
        document.removeEventListener("keydown", onKey, true);
      };
    }

    let frame = 0;
    const tick = () => {
      if (action.done()) finish();
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [step, element, stepIndex]);
}
