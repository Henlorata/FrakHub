import {cn} from "@/lib/utils";

/** Three slots, like the "Hibapont" columns of the old sheet. */
export function StrikeDots({count, max = 3}: {count: number; max?: number}) {
  return (
    <span className="flex items-center gap-1.5" title={`${count}/${max}`}>
      {Array.from({length: max}, (_, index) => (
        <span key={index} className={cn("size-2.5 rounded-full ring-1 transition-colors",
          index < count ? "bg-red-500 shadow-[0_0_8px_rgb(239_68_68/0.7)] ring-red-400/60" : "bg-white/5 ring-white/15")}/>
      ))}
      <span className="ml-1 text-xs tabular-nums text-slate-400">{count}/{max}</span>
    </span>
  );
}
