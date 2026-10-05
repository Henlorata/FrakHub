import {useId} from "react";
import {cn} from "@/lib/utils";

const POINTS = 7;
const CENTER = 100;

const polar = (radius: number, step: number, steps: number) => {
  const angle = ((-90 + (step * 360) / steps) * Math.PI) / 180;
  return [CENTER + radius * Math.cos(angle), CENTER + radius * Math.sin(angle)] as const;
};

/** Seven-pointed sheriff star outline (outer tips, inner valleys). */
const starPath = (outer: number, inner: number) =>
  "M" + Array.from({length: POINTS * 2}, (_, i) => polar(i % 2 === 0 ? outer : inner, i, POINTS * 2))
    .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join("L") + "Z";

const OUTER = starPath(84, 44);
const INNER = starPath(72, 38);
const TIPS = Array.from({length: POINTS}, (_, i) => polar(88, i, POINTS));
const RAYS = Array.from({length: POINTS}, (_, i) => polar(70, i, POINTS));

interface SheriffStarProps {
  className?: string;
  /**
   * "emblem": solid gold badge. "hologram": glowing outline (hero cards). "watermark": the
   * app background's faint engraved outline with a light running along it.
   */
  variant?: "emblem" | "hologram" | "watermark";
  /** Slow rotation (disabled automatically for reduced motion). */
  spin?: boolean;
  /** Text in the centre seal of the emblem. */
  label?: string;
}

/** The department's seven-pointed star, drawn in SVG (no image request). */
export function SheriffStar({className, variant = "emblem", spin = false, label = "SFSD"}: SheriffStarProps) {
  const id = useId().replace(/:/g, "");
  const gold = `star-gold-${id}`;
  const shine = `star-shine-${id}`;

  if (variant === "watermark") {
    return (
      <svg viewBox="0 0 200 200" fill="none" aria-hidden className={className}>
        <defs>
          <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fde68a"/>
            <stop offset="60%" stopColor="#eab308"/>
            <stop offset="100%" stopColor="#92400e"/>
          </linearGradient>
          <radialGradient id={shine} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#facc15" stopOpacity="0.16"/>
            <stop offset="100%" stopColor="#facc15" stopOpacity="0"/>
          </radialGradient>
        </defs>
        <circle cx={CENTER} cy={CENTER} r="96" fill={`url(#${shine})`} className="emblem-breathe"/>
        {/* The outer ring turns against the star. */}
        <g className={spin ? "emblem-turn emblem-turn-reverse" : undefined}>
          <circle cx={CENTER} cy={CENTER} r="97" stroke={`url(#${gold})`} strokeOpacity="0.2" strokeWidth="0.45" strokeDasharray="1 3"/>
          <circle cx={CENTER} cy={CENTER} r="91" stroke={`url(#${gold})`} strokeOpacity="0.12" strokeWidth="0.8" strokeDasharray="22 14"/>
        </g>
        <g className={spin ? "emblem-turn" : undefined}>
        <path d={OUTER} stroke={`url(#${gold})`} strokeOpacity="0.32" strokeWidth="0.7" strokeLinejoin="round" fill="rgb(234 179 8 / 0.025)"/>
        <path d={INNER} stroke={`url(#${gold})`} strokeOpacity="0.18" strokeWidth="0.35" strokeDasharray="2 3"/>
        {TIPS.map(([x, y], index) => <circle key={index} cx={x} cy={y} r="4.5" stroke={`url(#${gold})`} strokeOpacity="0.3" strokeWidth="0.6"/>)}
        <circle cx={CENTER} cy={CENTER} r="27" stroke={`url(#${gold})`} strokeOpacity="0.28" strokeWidth="0.6"/>
        <circle cx={CENTER} cy={CENTER} r="21" stroke={`url(#${gold})`} strokeOpacity="0.16" strokeWidth="0.35" strokeDasharray="1.5 2.5"/>
        {/* A short bright segment travelling around the outline and the seal. */}
        <path d={OUTER} pathLength={1000} stroke="#fde68a" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray="70 930" className="emblem-glint"/>
        </g>
        <circle cx={CENTER} cy={CENTER} r="27" pathLength={1000} stroke="#fde68a" strokeWidth="0.8" strokeLinecap="round"
                strokeDasharray="90 910" className="emblem-glint emblem-glint-slow"/>
      </svg>
    );
  }

  if (variant === "hologram") {
    return (
      <svg viewBox="0 0 200 200" fill="none" aria-hidden className={cn(spin && "motion-safe:animate-[spin_160s_linear_infinite]", className)}>
        <defs>
          <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fde68a"/>
            <stop offset="55%" stopColor="#eab308"/>
            <stop offset="100%" stopColor="#b45309"/>
          </linearGradient>
        </defs>
        <path d={OUTER} stroke={`url(#${gold})`} strokeWidth="0.9" fill="rgb(234 179 8 / 0.04)"/>
        <path d={INNER} stroke={`url(#${gold})`} strokeWidth="0.4" strokeDasharray="2 3" opacity="0.8"/>
        {TIPS.map(([x, y], index) => <circle key={index} cx={x} cy={y} r="4.5" stroke={`url(#${gold})`} strokeWidth="0.8"/>)}
        {RAYS.map(([x, y], index) => (
          <line key={index} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke={`url(#${gold})`} strokeWidth="0.3" opacity="0.6"/>
        ))}
        <circle cx={CENTER} cy={CENTER} r="27" stroke={`url(#${gold})`} strokeWidth="0.8"/>
        <circle cx={CENTER} cy={CENTER} r="21" stroke={`url(#${gold})`} strokeWidth="0.4" strokeDasharray="1.5 2.5"/>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 200 200" aria-hidden className={cn(spin && "motion-safe:animate-[spin_90s_linear_infinite]", className)}>
      <defs>
        <linearGradient id={gold} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#fff3c4"/>
          <stop offset="35%" stopColor="#facc15"/>
          <stop offset="70%" stopColor="#ca8a04"/>
          <stop offset="100%" stopColor="#854d0e"/>
        </linearGradient>
        <radialGradient id={shine} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55"/>
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <path d={OUTER} fill={`url(#${gold})`} stroke="#713f12" strokeWidth="1.2" strokeLinejoin="round"/>
      <path d={INNER} fill="none" stroke="#fef3c7" strokeOpacity="0.45" strokeWidth="0.8" strokeLinejoin="round"/>
      {TIPS.map(([x, y], index) => (
        <circle key={index} cx={x} cy={y} r="6.5" fill={`url(#${gold})`} stroke="#713f12" strokeWidth="1"/>
      ))}
      <path d={OUTER} fill={`url(#${shine})`}/>
      <circle cx={CENTER} cy={CENTER} r="30" fill="#0b1220" stroke="#facc15" strokeWidth="2"/>
      <circle cx={CENTER} cy={CENTER} r="24.5" fill="none" stroke="#facc15" strokeOpacity="0.55" strokeWidth="0.8" strokeDasharray="2 2.2"/>
      <text x={CENTER} y={CENTER + 5} textAnchor="middle" fontFamily="Inter Variable, ui-sans-serif, sans-serif"
            fontSize="14" fontWeight="800" letterSpacing="1.5" fill="#fde68a">{label}</text>
    </svg>
  );
}
