import {useMemo, useRef, useState, type CSSProperties} from "react";
import {Fingerprint} from "lucide-react";
import {SheriffStar} from "@/components/brand/SheriffStar";
import {formatDate} from "@/lib/datetime";
import {cn} from "@/lib/utils";

export type CardDivision = "TSB" | "SEB" | "MCB";

export const DIVISION_LOOK: Record<CardDivision, {title: string; short: string; logo: string | null; accent: string; ring: string; glow: string; text: string; bar: string}> = {
  TSB: {title: "Általános állomány", short: "Járőrszolgálat", logo: null, accent: "from-amber-300 via-yellow-500 to-amber-700",
    ring: "ring-amber-400/40", glow: "shadow-[0_30px_80px_-30px_rgb(234_179_8/0.65)]", text: "text-amber-300", bar: "bg-amber-400"},
  SEB: {title: "Special Enforcement Bureau", short: "Különleges egység", logo: "/seb.png", accent: "from-rose-300 via-red-500 to-red-800",
    ring: "ring-red-400/40", glow: "shadow-[0_30px_80px_-30px_rgb(239_68_68/0.7)]", text: "text-red-300", bar: "bg-red-500"},
  MCB: {title: "Major Crimes Bureau", short: "Nyomozó részleg", logo: "/mcb.png", accent: "from-sky-300 via-sky-500 to-indigo-700",
    ring: "ring-sky-400/40", glow: "shadow-[0_30px_80px_-30px_rgb(56_189_248/0.7)]", text: "text-sky-300", bar: "bg-sky-400"},
};

/** Stable id-like code from the typed data (no randomness while rendering). */
const cardIdFor = (seed: string) => {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(36).toUpperCase().padStart(7, "0").slice(0, 7);
};

/** Bars of the barcode from the same seed (widths 1–3). */
const barsFor = (seed: string) => {
  let hash = 5381;
  return Array.from({length: 46}, (_, index) => {
    hash = (Math.imul(hash, 33) ^ (seed.charCodeAt(index % Math.max(seed.length, 1)) || index)) >>> 0;
    return 1 + (hash % 3);
  });
};

const machineLine = (name: string, badge: string, division: string) => {
  const parts = name.trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z ]/g, "").split(/\s+/).filter(Boolean);
  const family = parts.at(-1) ?? "";
  const given = parts.slice(0, -1).join("<");
  return `SFSD<<${family}<<${given}`.padEnd(30, "<").slice(0, 30) + `${badge || "0000"}<${division}`;
};

interface IdCardPreviewProps {
  name: string;
  badge: string;
  rank: string;
  division: CardDivision;
  active: boolean;
  /** Text of the stamp over the photo. */
  stamp?: string;
  /** Tone of the stamp: amber (waiting) or emerald (accepted). */
  stampTone?: "amber" | "emerald";
}

/**
 * The service ID the applicant is about to get, filled in while typing. Tilts towards the
 * pointer (not with reduced motion), a sheen slides over the laminate.
 */
export function IdCardPreview({name, badge, rank, division, active, stamp = "Függőben", stampTone = "amber"}: IdCardPreviewProps) {
  const look = DIVISION_LOOK[division];
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({x: 0, y: 0});
  const seed = `${name}|${badge}|${division}`;
  const bars = useMemo(() => barsFor(seed), [seed]);
  const reducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  return (
    <div className="[perspective:1400px]"
         onMouseMove={(event) => {
           if (reducedMotion || !ref.current) return;
           const box = ref.current.getBoundingClientRect();
           const x = (event.clientX - box.left) / box.width - 0.5;
           const y = (event.clientY - box.top) / box.height - 0.5;
           setTilt({x: -y * 12, y: x * 14});
         }}
         onMouseLeave={() => setTilt({x: 0, y: 0})}>
      <div ref={ref}
           className={cn("relative aspect-[1.586] w-full overflow-hidden rounded-[22px] ring-1 transition-[transform,box-shadow] duration-300 ease-out", look.ring, look.glow)}
           style={{transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`, transformStyle: "preserve-3d"} as CSSProperties}>
        {/* Laminate: dark base, a security pattern and the division colour. */}
        <div className="absolute inset-0 bg-[#070c18]"/>
        <div className={cn("absolute inset-0 bg-gradient-to-br opacity-[0.22] transition-opacity duration-700", look.accent)}/>
        <div className="absolute inset-0 opacity-[0.12]"
             style={{backgroundImage: "repeating-radial-gradient(circle at 78% 40%, transparent 0 6px, rgb(255 255 255 / 0.5) 6px 7px)"}}/>
        <div className="absolute inset-0 opacity-[0.08]"
             style={{backgroundImage: "repeating-linear-gradient(135deg, transparent 0 10px, rgb(255 255 255 / 0.6) 10px 11px)"}}/>
        <SheriffStar variant="watermark" className="absolute -right-[12%] -bottom-[28%] w-[62%] opacity-70"/>
        <div className="holo-sheen pointer-events-none absolute inset-0"/>

        <div className="relative flex h-full flex-col p-[5.5%]">
          <div className="flex items-start gap-3">
            <SheriffStar className="size-12 shrink-0 drop-shadow-[0_0_10px_rgb(234_179_8/0.5)]"/>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[clamp(10px,1.6vw,15px)] font-black tracking-[0.12em] text-white">SAN FIERRO SHERIFF&apos;S DEPARTMENT</p>
              <p className={cn("text-[clamp(8px,1vw,10px)] font-semibold uppercase tracking-[0.3em]", look.text)}>Szolgálati igazolvány</p>
            </div>
            {look.logo && <img src={look.logo} alt="" className="size-12 shrink-0 object-contain drop-shadow-[0_0_8px_rgb(0_0_0/0.6)]"/>}
          </div>

          <div className="mt-[4%] flex flex-1 gap-[4%]">
            <div className="relative aspect-[3/4] h-full max-h-[78%] shrink-0 overflow-hidden rounded-xl bg-black/50 ring-1 ring-white/15">
              <div className="absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.05)_1px,transparent_1px)] bg-[size:9px_9px]"/>
              <Fingerprint className={cn("absolute top-1/2 left-1/2 size-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-500",
                active ? cn(look.text, "scale-110 opacity-100") : "text-slate-600 opacity-60")}/>
              {active && <div aria-hidden className="scan-line pointer-events-none absolute inset-x-0"/>}
              <span className={cn("absolute inset-x-1 bottom-2 rotate-[-10deg] rounded border-2 bg-black/40 py-0.5 text-center text-[clamp(7px,0.8vw,9px)] font-black tracking-[0.2em] uppercase",
                stampTone === "emerald" ? "border-emerald-300/80 text-emerald-300" : "border-amber-300/80 text-amber-300")}>
                {stamp}
              </span>
            </div>
            <dl className="grid min-w-0 flex-1 grid-cols-2 content-start gap-x-4 gap-y-[6%]">
              <div className="col-span-2 min-w-0">
                <dt className="text-[9px] font-semibold uppercase tracking-[0.25em] text-slate-400">Név</dt>
                <dd className="truncate font-mono text-[clamp(14px,2.2vw,22px)] font-bold tracking-tight text-white">{name.trim() || "Ismeretlen"}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[9px] font-semibold uppercase tracking-[0.25em] text-slate-400">Rendfokozat</dt>
                <dd className="truncate text-[clamp(10px,1.2vw,13px)] font-semibold text-white">{rank}</dd>
              </div>
              <div>
                <dt className="text-[9px] font-semibold uppercase tracking-[0.25em] text-slate-400">Jelvény</dt>
                <dd className="font-mono text-[clamp(12px,1.5vw,16px)] font-bold tracking-[0.25em] text-white">{badge.padEnd(4, "·")}</dd>
              </div>
              <div className="col-span-2 min-w-0">
                <dt className="text-[9px] font-semibold uppercase tracking-[0.25em] text-slate-400">Beosztás</dt>
                <dd className={cn("truncate text-[clamp(11px,1.3vw,14px)] font-bold", look.text)}>{division} · {look.title}</dd>
              </div>
            </dl>
          </div>

          <div className="mt-auto flex items-end gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-[clamp(8px,1vw,11px)] tracking-[0.18em] text-slate-300/80">{machineLine(name, badge, division)}</p>
              <p className="mt-0.5 font-mono text-[9px] text-slate-500">ID {cardIdFor(seed)} · Kiállítva: {formatDate(new Date())}</p>
            </div>
            <div className="flex h-7 items-end gap-px opacity-80" aria-hidden>
              {bars.map((width, index) => <span key={index} className="h-full bg-white/80" style={{width}}/>)}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
