import {useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode, type RefObject} from "react";
import {cn} from "@/lib/utils";

/**
 * The front page's motion kit: things appear as they scroll into view, numbers count up, cards
 * tilt towards the pointer, timelines fill with the scroll. Everything is transform/opacity only
 * (cheap for the GPU) and switches off for `prefers-reduced-motion`.
 */

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** True once the element has come into view (or at once without IntersectionObserver). */
export function useInView<T extends Element>(ref: RefObject<T | null>, {once = true, rootMargin = "0px 0px -12% 0px"} = {}) {
  // Without IntersectionObserver (very old browsers) everything shows at once.
  const [inView, setInView] = useState(() => typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        if (once) observer.disconnect();
      } else if (!once) {
        setInView(false);
      }
    }, {rootMargin, threshold: 0.08});
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, once, rootMargin]);
  return inView;
}

export type RevealVariant = "up" | "fade" | "scale" | "left" | "right" | "blur";

/** Wraps content that rises into view; `delay` in ms staggers neighbours; `instant` shows it at once. */
export function Reveal({as: Tag = "div", variant = "up", delay = 0, instant = false, className, style, children, id}: {
  as?: ElementType;
  variant?: RevealVariant;
  delay?: number;
  instant?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  id?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const shown = useInView(ref) || instant;
  return (
    <Tag ref={ref} id={id} data-shown={shown ? "" : undefined} className={cn("reveal", `reveal-${variant}`, className)}
         style={{...style, "--reveal-delay": `${delay}ms`} as CSSProperties}>
      {children}
    </Tag>
  );
}

/** Counts up to `target` once `start` turns true (ease-out over `duration` ms). */
export function useCountUp(target: number, start: boolean, duration = 1800) {
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    if (reduced || target <= 0) {
      const frame = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(frame);
    }
    let frame = 0;
    const began = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      setValue(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, start, duration, reduced]);
  return value;
}

/** 0 → 1 as the element passes through the viewport (top enters the bottom → bottom leaves the top). */
export function useScrollProgress<T extends Element>(ref: RefObject<T | null>) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const element = ref.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const total = rect.height + window.innerHeight;
      setProgress(Math.min(1, Math.max(0, (window.innerHeight - rect.top) / total)));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, {passive: true});
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, [ref]);
  return progress;
}

/**
 * Tilts a card towards the pointer and moves a glare with it (CSS variables --rx, --ry, --mx, --my
 * on the element; see .tilt-card in index.css). Off for touch and reduced motion.
 */
export function useTilt<T extends HTMLElement>(max = 8) {
  const ref = useRef<T>(null);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    const element = ref.current;
    if (!element || reduced || window.matchMedia("(hover: none)").matches) return;
    let frame = 0;
    let last: PointerEvent | null = null;
    const apply = () => {
      frame = 0;
      if (!last) return;
      const rect = element.getBoundingClientRect();
      const x = (last.clientX - rect.left) / rect.width;
      const y = (last.clientY - rect.top) / rect.height;
      element.style.setProperty("--rx", `${((0.5 - y) * max * 2).toFixed(2)}deg`);
      element.style.setProperty("--ry", `${((x - 0.5) * max * 2).toFixed(2)}deg`);
      element.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
      element.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
    };
    const move = (event: PointerEvent) => {
      last = event;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const leave = () => {
      last = null;
      element.style.setProperty("--rx", "0deg");
      element.style.setProperty("--ry", "0deg");
    };
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerleave", leave);
    return () => {
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerleave", leave);
      cancelAnimationFrame(frame);
    };
  }, [max, reduced]);
  return ref;
}

/** Deterministic pseudo-random numbers (the same sky and skyline on every render). */
export function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
