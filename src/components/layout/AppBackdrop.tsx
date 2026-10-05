import type {CSSProperties} from "react";
import {SheriffStar} from "@/components/brand/SheriffStar";
import {useSystemStatus, type AlertLevelId} from "@/context/SystemStatusContext";
import {cn} from "@/lib/utils";

/** Glow colours per alert level (gold/sky by default, police red/blue on alarms). */
const PALETTES: Record<AlertLevelId, [string, string, string]> = {
  normal: ["rgb(234 179 8 / 0.36)", "rgb(14 165 233 / 0.34)", "rgb(124 58 237 / 0.32)"],
  traffic: ["rgb(250 204 21 / 0.38)", "rgb(14 165 233 / 0.3)", "rgb(245 158 11 / 0.3)"],
  border: ["rgb(249 115 22 / 0.38)", "rgb(14 165 233 / 0.3)", "rgb(234 179 8 / 0.3)"],
  tactical: ["rgb(239 68 68 / 0.42)", "rgb(37 99 235 / 0.42)", "rgb(220 38 38 / 0.26)"],
};

/**
 * The app-wide background. Colour lives at the edges (slowly breathing glows in the alert
 * level's colours, a twinkling star field) while the middle, where the data is, stays calm
 * and dark. The department star turns slowly in the bottom-right corner, a faint engraving
 * with a light running along its outline (never a large shape behind the content).
 * Pure CSS animations on opacity/transform; still for reduced motion.
 */
export function AppBackdrop() {
  const {alertLevel} = useSystemStatus();
  const [first, second, third] = PALETTES[alertLevel] ?? PALETTES.normal;

  return (
    <div aria-hidden className={cn("app-backdrop pointer-events-none fixed inset-0 -z-10 overflow-hidden", alertLevel === "tactical" && "is-siren")}
         style={{"--aurora-1": first, "--aurora-2": second, "--aurora-3": third} as CSSProperties}>
      <div className="backdrop-glow glow-top-right"/>
      <div className="backdrop-glow glow-top-left"/>
      <div className="backdrop-glow glow-bottom"/>
      <div className="backdrop-horizon"/>
      <div className="backdrop-stars stars-near"/>
      <div className="backdrop-stars stars-far"/>
      <div className="backdrop-grid absolute inset-0"/>
      <div className="backdrop-emblem">
        <SheriffStar variant="watermark" spin className="size-full"/>
      </div>
      <div className="backdrop-calm absolute inset-0"/>
      <div className="tex-noise absolute inset-0 opacity-[0.03] mix-blend-overlay"/>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgb(2_4_10/0.55)_100%)]"/>
    </div>
  );
}
