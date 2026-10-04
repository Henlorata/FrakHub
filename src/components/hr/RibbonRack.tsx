import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";
import {cn} from "@/lib/utils";

interface RibbonLike {
  id?: string;
  name: string;
  color_hex: string | null;
}

/** Service ribbons as a uniform-style rack (colour bars with a sheen). */
export function RibbonRack({ribbons, max = 12, className}: {ribbons: RibbonLike[]; max?: number; className?: string}) {
  if (ribbons.length === 0) return null;
  const shown = ribbons.slice(0, max);
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {shown.map((ribbon, index) => (
        <Tooltip key={ribbon.id ?? `${ribbon.name}-${index}`}>
          <TooltipTrigger asChild>
            <span
              className="relative h-3.5 w-9 overflow-hidden rounded-[3px] shadow-[0_1px_2px_rgb(0_0_0/0.6)] ring-1 ring-black/40 transition-transform hover:-translate-y-0.5"
              style={{background: ribbon.color_hex
                ? `linear-gradient(90deg, ${ribbon.color_hex} 0 30%, rgb(255 255 255 / 0.85) 30% 36%, ${ribbon.color_hex} 36% 64%, rgb(255 255 255 / 0.85) 64% 70%, ${ribbon.color_hex} 70%)`
                : "linear-gradient(90deg, #64748b, #94a3b8)"}}
            >
              <span className="absolute inset-0 bg-gradient-to-b from-white/35 via-transparent to-black/25"/>
            </span>
          </TooltipTrigger>
          <TooltipContent>{ribbon.name}</TooltipContent>
        </Tooltip>
      ))}
      {ribbons.length > max && <span className="ml-1 text-[11px] text-slate-400">+{ribbons.length - max}</span>}
    </div>
  );
}
