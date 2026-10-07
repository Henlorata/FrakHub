import {SheriffStar} from "@/components/brand/SheriffStar";

export function LoadingScreen({text = "Rendszer betöltése..."}: { text?: string }) {
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#04070f]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgb(234_179_8/0.16),transparent_55%)]"/>
      <div className="relative z-10 flex flex-col items-center gap-7">
        <div className="relative grid size-32 place-items-center">
          <div className="absolute inset-0 rounded-full border border-dashed border-yellow-500/40 motion-safe:animate-[spin_12s_linear_infinite]"/>
          <div className="absolute inset-3 rounded-full border-2 border-yellow-500/20 border-t-yellow-400/80 motion-safe:animate-[spin_1.6s_linear_infinite]"/>
          <SheriffStar className="size-20 drop-shadow-[0_8px_18px_rgb(0_0_0/0.55)] motion-safe:animate-[float-y_3s_ease-in-out_infinite]"/>
        </div>
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-gold text-2xl font-bold tracking-[0.25em] uppercase">SFSD Intranet</h2>
          <span className="text-sm text-slate-400">{text}</span>
        </div>
      </div>
    </div>
  );
}
