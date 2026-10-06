import {useEffect, useState} from "react";
import {useCountUp} from "@/lib/use-count-up";

interface ScoreRingProps {
  percent: number;
  /** The exam's passing percentage, marked on the ring. */
  passing: number;
  size?: number;
  caption?: string;
}

/** Result ring: fills up to the score, coloured by the passing threshold (marked with a tick). */
export function ScoreRing({percent, passing, size = 120, caption}: ScoreRingProps) {
  const stroke = size >= 100 ? 8 : 6;
  const radius = (size - stroke) / 2 - 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const [drawn, setDrawn] = useState(0);
  const shown = useCountUp(Math.round(percent));

  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(Math.max(0, Math.min(100, percent))));
    return () => cancelAnimationFrame(frame);
  }, [percent]);

  const passed = percent >= passing;
  const color = passed ? "#34d399" : percent >= passing - 15 ? "#fbbf24" : "#f87171";
  const angle = (Math.max(0, Math.min(100, passing)) / 100) * 2 * Math.PI;
  const tick = (offset: number) => [center + (radius + offset) * Math.cos(angle), center + (radius + offset) * Math.sin(angle)];
  const [x1, y1] = tick(-stroke);
  const [x2, y2] = tick(stroke);

  return (
    <div className="relative grid place-items-center" style={{width: size, height: size}}>
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth={stroke}/>
        <circle cx={center} cy={center} r={radius} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
                strokeDasharray={circumference} strokeDashoffset={circumference * (1 - drawn / 100)}
                style={{transition: "stroke-dashoffset 1.1s cubic-bezier(0.2, 0.7, 0.2, 1), stroke 0.4s", filter: `drop-shadow(0 0 6px ${color}66)`}}/>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e2e8f0" strokeWidth={2} strokeLinecap="round" opacity={0.7}/>
      </svg>
      <div className="relative text-center leading-none">
        <span className="text-2xl font-semibold tabular-nums text-white" style={size < 100 ? {fontSize: 18} : undefined}>{shown}%</span>
        {caption && <span className="mt-1 block text-[10px] text-slate-400">{caption}</span>}
      </div>
    </div>
  );
}
