import {useId} from "react";
import {cn} from "@/lib/utils";

const POINTS = 7;
const CENTER = 100;

type Point = readonly [number, number];

const polar = (radius: number, step: number, steps: number) => {
  const angle = ((-90 + (step * 360) / steps) * Math.PI) / 180;
  return [CENTER + radius * Math.cos(angle), CENTER + radius * Math.sin(angle)] as const;
};

/** Seven-pointed sheriff star outline (outer tips, inner valleys). */
const starPath = (outer: number, inner: number) =>
  "M" + Array.from({length: POINTS * 2}, (_, i) => polar(i % 2 === 0 ? outer : inner, i, POINTS * 2))
    .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join("L") + "Z";

// The background engraving and the hologram outline (unchanged drawings).
const OUTER = starPath(84, 44);
const INNER = starPath(72, 38);
const TIPS = Array.from({length: POINTS}, (_, i) => polar(88, i, POINTS));
const RAYS = Array.from({length: POINTS}, (_, i) => polar(70, i, POINTS));

// --- The badge ---------------------------------------------------------------------------------

const at = (radius: number, degrees: number, cx = CENTER, cy = CENTER): Point => {
  const angle = (degrees * Math.PI) / 180;
  return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
};
const pointsPath = (points: Point[]) => `M${points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join("L")}Z`;

/** Light falls from the upper left, like on a pinned metal badge. */
const LIGHT = -125;

interface Facet {
  d: string;
  /** Positive: lit (white overlay), negative: shaded (dark overlay). */
  light: number;
}

/** A star cut into two bevelled facets per point: one side catches the light, the other is in shade. */
function facetedStar(points: number, outer: number, inner: number, cx = CENTER, cy = CENTER) {
  const step = 360 / points;
  const outline: Point[] = [];
  const facets: Facet[] = [];
  for (let i = 0; i < points; i++) {
    const tipAngle = -90 + i * step;
    const tip = at(outer, tipAngle, cx, cy);
    const left = at(inner, tipAngle - step / 2, cx, cy);
    const right = at(inner, tipAngle + step / 2, cx, cy);
    outline.push(tip, right);
    const shade = (normal: number) => Math.cos(((normal - LIGHT) * Math.PI) / 180);
    facets.push({d: pointsPath([[cx, cy], left, tip]), light: shade(tipAngle - 90)});
    facets.push({d: pointsPath([[cx, cy], tip, right]), light: shade(tipAngle + 90)});
  }
  return {outline: pointsPath(outline), facets, tips: Array.from({length: points}, (_, i) => at(outer, -90 + i * step, cx, cy))};
}

const BADGE = facetedStar(POINTS, 82, 48);
const BADGE_RIM = facetedStar(POINTS, 71.5, 42).outline;
// Each point ends in a ball that covers its tip.
const BALLS = Array.from({length: POINTS}, (_, i) => at(81, -90 + (i * 360) / POINTS));
const CENTER_STAR = facetedStar(5, 11, 4.6);
const SEAL_STAR = facetedStar(5, 9.5, 4);

/** The badge's outline in its 200×200 box (for effects drawn around the emblem). */
export const SHERIFF_STAR_OUTLINE = BADGE.outline;

const facetFill = (light: number) =>
  light >= 0 ? `rgb(255 250 235 / ${(0.05 + 0.3 * light).toFixed(3)})` : `rgb(40 26 4 / ${(0.06 + 0.34 * -light).toFixed(3)})`;

interface SheriffStarProps {
  className?: string;
  /**
   * "emblem": the department's metal badge. "hologram": glowing outline (hero cards).
   * "watermark": the app background's faint engraved outline with a light running along it.
   */
  variant?: "emblem" | "hologram" | "watermark";
  /**
   * The emblem's detail: "mark" (small sizes: a five-pointed star in the centre) or "seal"
   * (large sizes and documents: the department's name engraved around the centre).
   */
  detail?: "mark" | "seal";
  /** Slow rotation (disabled automatically for reduced motion). */
  spin?: boolean;
  /** The lower line of the seal. */
  label?: string;
}

/** The department's seven-pointed star, drawn in SVG (no image request). */
export function SheriffStar({className, variant = "emblem", detail = "mark", spin = false, label = "SHERIFF"}: SheriffStarProps) {
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

  const metal = `star-metal-${id}`;
  const ball = `star-ball-${id}`;
  const enamel = `star-enamel-${id}`;
  const ring = `star-ring-${id}`;
  const top = `star-top-${id}`;
  const bottom = `star-bottom-${id}`;
  const seal = detail === "seal";
  // The centre: a brass ring around dark blue enamel; on the seal the ring carries the name.
  const ringRadius = seal ? 37 : 30;
  const fieldRadius = seal ? 34 : 25.5;
  const centre = seal ? SEAL_STAR : CENTER_STAR;

  return (
    <svg viewBox="0 0 200 200" aria-hidden className={cn(spin && "motion-safe:animate-[spin_90s_linear_infinite]", className)}>
      <defs>
        <linearGradient id={metal} x1="0.2" y1="0.05" x2="0.8" y2="0.95">
          <stop offset="0%" stopColor="#f7ebc4"/>
          <stop offset="28%" stopColor="#dcc17c"/>
          <stop offset="58%" stopColor="#b8913f"/>
          <stop offset="82%" stopColor="#8c6826"/>
          <stop offset="100%" stopColor="#5f4616"/>
        </linearGradient>
        <radialGradient id={ball} cx="0.36" cy="0.32" r="0.75">
          <stop offset="0%" stopColor="#fff7dc"/>
          <stop offset="45%" stopColor="#d6b565"/>
          <stop offset="100%" stopColor="#6f521b"/>
        </radialGradient>
        <radialGradient id={enamel} cx="0.42" cy="0.36" r="0.75">
          <stop offset="0%" stopColor="#1d2c4a"/>
          <stop offset="100%" stopColor="#080f1e"/>
        </radialGradient>
        <linearGradient id={ring} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#efdca2"/>
          <stop offset="50%" stopColor="#b38c3c"/>
          <stop offset="100%" stopColor="#5f4616"/>
        </linearGradient>
        {seal && (
          <>
            {/* Upper text sits on the outside of its arc, the lower on the inside: both centred in the ring. */}
            <path id={top} d={`M${CENTER - 26.2},${CENTER} A26.2,26.2 0 0 1 ${CENTER + 26.2},${CENTER}`}/>
            <path id={bottom} d={`M${CENTER - 31.4},${CENTER} A31.4,31.4 0 0 0 ${CENTER + 31.4},${CENTER}`}/>
          </>
        )}
      </defs>

      {/* Body, bevels and the ball tips. */}
      <path d={BADGE.outline} fill={`url(#${metal})`}/>
      {BADGE.facets.map((facet, index) => <path key={index} d={facet.d} fill={facetFill(facet.light)}/>)}
      <path d={BADGE.outline} fill="none" stroke="#3f2d0b" strokeOpacity="0.85" strokeWidth="1.1" strokeLinejoin="round"/>
      <path d={BADGE_RIM} fill="none" stroke="#fff4d2" strokeOpacity="0.32" strokeWidth="0.7" strokeLinejoin="round"/>
      {BALLS.map(([x, y], index) => (
        <circle key={index} cx={x} cy={y} r="7.6" fill={`url(#${ball})`} stroke="#3f2d0b" strokeOpacity="0.85" strokeWidth="0.9"/>
      ))}

      {/* The centre piece. */}
      <circle cx={CENTER} cy={CENTER} r={ringRadius} fill={`url(#${ring})`} stroke="#3f2d0b" strokeOpacity="0.85" strokeWidth="1"/>
      <circle cx={CENTER} cy={CENTER} r={fieldRadius} fill={`url(#${enamel})`} stroke="#f2dfa5" strokeOpacity="0.55" strokeWidth="0.6"/>
      {seal ? (
        <>
          <circle cx={CENTER} cy={CENTER} r="22.6" fill="none" stroke="#e9d38f" strokeOpacity="0.55" strokeWidth="0.5"/>
          <g fill="#ecd697" fontFamily="Georgia, 'Times New Roman', serif" fontSize="7" letterSpacing="1.1">
            <text><textPath href={`#${top}`} startOffset="50%" textAnchor="middle">SAN FIERRO</textPath></text>
            <text><textPath href={`#${bottom}`} startOffset="50%" textAnchor="middle">{label}</textPath></text>
          </g>
          {[180, 0].map((angle) => {
            const [x, y] = at(28.6, angle);
            return <circle key={angle} cx={x} cy={y} r="1" fill="#ecd697"/>;
          })}
        </>
      ) : (
        <circle cx={CENTER} cy={CENTER} r={fieldRadius - 3.2} fill="none" stroke="#e9d38f" strokeOpacity="0.35" strokeWidth="0.5" strokeDasharray="0.8 1.6"/>
      )}
      <path d={centre.outline} fill={`url(#${metal})`}/>
      {centre.facets.map((facet, index) => <path key={index} d={facet.d} fill={facetFill(facet.light)}/>)}
      <path d={centre.outline} fill="none" stroke="#3f2d0b" strokeOpacity="0.7" strokeWidth="0.5" strokeLinejoin="round"/>
    </svg>
  );
}
