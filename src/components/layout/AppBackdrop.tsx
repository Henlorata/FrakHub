import type {CSSProperties} from "react";
import {SheriffStar} from "@/components/brand/SheriffStar";
import {useSystemStatus, type AlertLevelId} from "@/context/SystemStatusContext";

/** Aurora colours per alert level (gold/sky by default, police red/blue on alarms). */
const PALETTES: Record<AlertLevelId, [string, string, string]> = {
  normal: ["rgb(234 179 8 / 0.34)", "rgb(14 165 233 / 0.30)", "rgb(124 58 237 / 0.28)"],
  traffic: ["rgb(250 204 21 / 0.36)", "rgb(14 165 233 / 0.26)", "rgb(245 158 11 / 0.26)"],
  border: ["rgb(249 115 22 / 0.36)", "rgb(14 165 233 / 0.24)", "rgb(234 179 8 / 0.26)"],
  tactical: ["rgb(239 68 68 / 0.38)", "rgb(37 99 235 / 0.34)", "rgb(220 38 38 / 0.24)"],
};

/**
 * The app-wide animated background: drifting aurora lights in the alert level's colours,
 * a fading grid, a slowly turning sheriff star hologram, grain and a vignette.
 * Pure CSS animations on transforms (GPU friendly); still for reduced motion.
 */
export function AppBackdrop() {
  const {alertLevel} = useSystemStatus();
  const [first, second, third] = PALETTES[alertLevel] ?? PALETTES.normal;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#04070f]"
         style={{"--aurora-1": first, "--aurora-2": second, "--aurora-3": third} as CSSProperties}>
      <div className="aurora-blob aurora-a"/>
      <div className="aurora-blob aurora-b"/>
      <div className="aurora-blob aurora-c"/>
      <div className="backdrop-grid absolute inset-0"/>

      {/* Star hologram with counter-rotating rings, bottom right. */}
      <div className="absolute -right-[14vmax] -bottom-[20vmax] grid size-[80vmax] place-items-center opacity-[0.26]">
        <div className="absolute inset-[4%] rounded-full border border-dashed border-yellow-500/30 motion-safe:animate-[spin_200s_linear_infinite]"/>
        <div className="absolute inset-[13%] rounded-full border-2 border-yellow-500/15 border-t-transparent border-b-transparent motion-safe:animate-[spin_120s_linear_infinite_reverse]"/>
        <div className="absolute size-[38%] rounded-full bg-yellow-500/10 blur-3xl motion-safe:animate-[backdrop-breathe_9s_ease-in-out_infinite]"/>
        <SheriffStar variant="hologram" spin className="relative size-[62%] drop-shadow-[0_0_24px_rgb(234_179_8/0.45)]"/>
      </div>

      <div className="tex-noise absolute inset-0 opacity-[0.035] mix-blend-overlay"/>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgb(2_4_10/0.6)_100%)]"/>
    </div>
  );
}
