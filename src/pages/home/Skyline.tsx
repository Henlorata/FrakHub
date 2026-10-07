import {memo, type CSSProperties} from "react";
import {seeded} from "./motion";

/**
 * San Fierro at night, in SVG (no image to download): far hills, the downtown towers with lit
 * windows (a few flicker), the bridge on the right with blinking beacons, and police lights
 * reflected low on the horizon. Generated from a fixed seed, so it is the same on every visit.
 */

const WIDTH = 1600;
const HEIGHT = 340;
const GROUND = 318;

interface Building {
  x: number;
  w: number;
  h: number;
  windows: {x: number; y: number; lit: boolean; flicker: boolean; color: string; d: number; delay: number}[];
  antenna: boolean;
}

function buildings(): Building[] {
  const random = seeded(2026);
  const list: Building[] = [];
  let x = -10;
  while (x < 1180) {
    const w = 26 + Math.round(random() * 54);
    // Downtown, a little right of the middle, is the tallest (the text on the left stays over a low skyline).
    const centre = 1 - Math.min(1, Math.abs(x - 820) / 560);
    const h = Math.round(46 + random() * 70 + centre * centre * 170 * (0.55 + random() * 0.6));
    const windows: Building["windows"] = [];
    const cols = Math.max(1, Math.floor((w - 8) / 9));
    const rows = Math.max(1, Math.floor((h - 14) / 12));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = random() < 0.32;
        if (!lit) continue;
        windows.push({
          x: x + 5 + c * 9, y: GROUND - h + 9 + r * 12, lit,
          flicker: random() < 0.12,
          color: random() < 0.78 ? "#fcd34d" : "#bfdbfe",
          d: 4 + random() * 9, delay: -random() * 10,
        });
      }
    }
    list.push({x, w, h, windows, antenna: h > 190 && random() < 0.6});
    x += w + Math.round(random() * 6);
  }
  return list;
}

const BUILDINGS = buildings();

export const Skyline = memo(function Skyline({className}: {className?: string}) {
  // The bridge (Gant Bridge): two towers, the deck and the main cables.
  const deckY = GROUND - 60;
  const towers = [1300, 1500];
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMax slice" aria-hidden className={className}>
      <defs>
        <linearGradient id="sky-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0b1733" stopOpacity="0"/>
          <stop offset="100%" stopColor="#0b1733" stopOpacity="0.85"/>
        </linearGradient>
        <linearGradient id="city" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a1328"/>
          <stop offset="100%" stopColor="#030712"/>
        </linearGradient>
        <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0b1a36"/>
          <stop offset="100%" stopColor="#030712"/>
        </linearGradient>
        <radialGradient id="glow-red" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.9"/>
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="glow-blue" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.9"/>
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/>
        </radialGradient>
      </defs>

      {/* Far hills */}
      <path d={`M0 ${GROUND - 70} C 180 ${GROUND - 120}, 320 ${GROUND - 90}, 460 ${GROUND - 110} S 760 ${GROUND - 140}, 980 ${GROUND - 96} S 1260 ${GROUND - 120}, 1600 ${GROUND - 84} L1600 ${HEIGHT} L0 ${HEIGHT}Z`}
            fill="#0a1530" opacity="0.9"/>
      <rect x="0" y={GROUND - 150} width={WIDTH} height="150" fill="url(#sky-fade)"/>

      {/* Police lights reflected on the haze above the streets */}
      <ellipse cx="610" cy={GROUND - 6} rx="220" ry="40" fill="url(#glow-red)" className="lightbar-red"/>
      <ellipse cx="780" cy={GROUND - 6} rx="220" ry="40" fill="url(#glow-blue)" className="lightbar-blue"/>

      {/* Downtown */}
      <g>
        {BUILDINGS.map((building, index) => (
          <g key={index}>
            <rect x={building.x} y={GROUND - building.h} width={building.w} height={building.h} fill="url(#city)"/>
            <rect x={building.x} y={GROUND - building.h} width={building.w} height="1.2" fill="#1e3a8a" opacity="0.6"/>
            {building.antenna && (
              <>
                <rect x={building.x + building.w / 2 - 0.8} y={GROUND - building.h - 26} width="1.6" height="26" fill="#0a1328"/>
                <circle cx={building.x + building.w / 2} cy={GROUND - building.h - 27} r="2.2" fill="#ef4444" className="beacon"
                        style={{animationDelay: `${-index * 0.37}s`} as CSSProperties}/>
              </>
            )}
            {building.windows.map((light, lightIndex) => (
              <rect key={lightIndex} x={light.x} y={light.y} width="4" height="5" rx="0.6" fill={light.color}
                    className={light.flicker ? "window-light" : undefined}
                    opacity={light.flicker ? undefined : 0.55}
                    style={light.flicker ? {"--d": `${light.d}s`, "--delay": `${light.delay}s`} as CSSProperties : undefined}/>
            ))}
          </g>
        ))}
      </g>

      {/* The bay */}
      <rect x="1160" y={GROUND - 4} width="440" height={HEIGHT - GROUND + 4} fill="url(#water)"/>

      {/* The bridge */}
      <g fill="none" stroke="#7f1d1d" strokeLinecap="round">
        <path d={`M1160 ${deckY} L1600 ${deckY}`} strokeWidth="5" stroke="#3f0d0d"/>
        <path d={`M1160 ${deckY - 70} Q ${towers[0] - 70} ${deckY - 30}, ${towers[0]} ${deckY - 150}`} strokeWidth="1.6" stroke="#991b1b" opacity="0.85"/>
        <path d={`M${towers[0]} ${deckY - 150} Q ${(towers[0] + towers[1]) / 2} ${deckY - 10}, ${towers[1]} ${deckY - 150}`} strokeWidth="1.6" stroke="#991b1b" opacity="0.85"/>
        <path d={`M${towers[1]} ${deckY - 150} Q ${towers[1] + 60} ${deckY - 40}, 1600 ${deckY - 70}`} strokeWidth="1.6" stroke="#991b1b" opacity="0.85"/>
        {Array.from({length: 22}, (_, i) => {
          const x = towers[0] + 8 + i * ((towers[1] - towers[0] - 16) / 21);
          const t = (x - towers[0]) / (towers[1] - towers[0]);
          const cableY = (1 - t) * (1 - t) * (deckY - 150) + 2 * (1 - t) * t * (deckY - 10) + t * t * (deckY - 150);
          return <path key={i} d={`M${x} ${cableY} L${x} ${deckY}`} strokeWidth="0.6" stroke="#7f1d1d" opacity="0.7"/>;
        })}
      </g>
      {towers.map((x) => (
        <g key={x}>
          <rect x={x - 6} y={deckY - 156} width="12" height={GROUND - deckY + 156} fill="#5b1414"/>
          <rect x={x - 6} y={deckY - 120} width="12" height="3" fill="#2b0707"/>
          <rect x={x - 6} y={deckY - 80} width="12" height="3" fill="#2b0707"/>
          <circle cx={x} cy={deckY - 160} r="2.6" fill="#f87171" className="beacon" style={{animationDelay: x === towers[0] ? "0s" : "-1.1s"} as CSSProperties}/>
        </g>
      ))}
      {/* Deck lights */}
      {Array.from({length: 28}, (_, i) => (
        <circle key={i} cx={1170 + i * 15.5} cy={deckY - 3} r="1" fill="#fde68a" opacity="0.8"/>
      ))}

      <rect x="0" y={GROUND} width={WIDTH} height={HEIGHT - GROUND} fill="#030712"/>
    </svg>
  );
});
