import {cn} from "@/lib/utils";

/** A San Fierro style number plate. */
export function LicensePlate({plate, size = "md", className}: {plate: string; size?: "sm" | "md" | "lg"; className?: string}) {
  return (
    <span className={cn(
      "inline-flex items-stretch overflow-hidden rounded-md bg-gradient-to-b from-white to-slate-300 font-mono font-bold tracking-[0.18em] text-slate-900 shadow-[0_2px_6px_rgb(0_0_0/0.5)] ring-1 ring-black/40",
      size === "sm" ? "text-[11px]" : size === "lg" ? "text-xl" : "text-sm", className)}>
      <span className={cn("flex items-center bg-gradient-to-b from-sky-600 to-blue-800 font-sans font-black tracking-normal text-white",
        size === "sm" ? "px-1 text-[8px]" : size === "lg" ? "px-2 text-xs" : "px-1.5 text-[9px]")}>SF</span>
      <span className={cn(size === "sm" ? "px-1.5 py-0.5" : size === "lg" ? "px-3 py-1" : "px-2.5 py-0.5")}>{plate}</span>
    </span>
  );
}
