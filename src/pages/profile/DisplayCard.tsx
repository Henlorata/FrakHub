import {Check, Gauge} from "lucide-react";
import {setDisplayMode, useDisplayMode, type DisplayMode} from "@/lib/display-mode";
import {cn} from "@/lib/utils";

const OPTIONS: {mode: DisplayMode; label: string; hint: string}[] = [
  {mode: "auto", label: "Automatikus", hint: "Telefonon és tableten kímélő, számítógépen teljes."},
  {mode: "full", label: "Teljes", hint: "Mozgó háttér, üveghatás és minden effekt."},
  {mode: "lite", label: "Kímélő", hint: "Gyorsabb és akkumulátorkímélő: álló háttér, üveghatás nélkül."},
];

/** The light rendering of this device (src/lib/display-mode.ts): automatic, always full or always light. */
export function DisplayCard() {
  const {mode, lite} = useDisplayMode();
  return (
    <section data-tour="display-mode" className="panel p-5 lg:col-span-2">
      <div className="flex items-start gap-4">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/[0.04] text-slate-300 ring-1 ring-white/10">
          <Gauge className="size-6"/>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="text-sm font-semibold text-white">Megjelenítés ezen az eszközön</h3>
          <p className="text-xs text-slate-400">
            Ha az oldal lassú vagy akadozik (főleg telefonon), a kímélő megjelenítés sokat segít. Csak ebben a böngészőben érvényes.
          </p>
          <p className="text-xs text-slate-500">Most: <span className="font-medium text-slate-200">{lite ? "kímélő" : "teljes"}</span></p>
        </div>
      </div>
      <div role="radiogroup" aria-label="Megjelenítés" className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {OPTIONS.map((option) => {
          const selected = mode === option.mode;
          return (
            <button key={option.mode} type="button" role="radio" aria-checked={selected} onClick={() => setDisplayMode(option.mode)}
                    className={cn("flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-left ring-1 transition-colors",
                      selected ? "bg-sky-500/10 ring-sky-400/50" : "bg-white/[0.02] ring-white/10 hover:bg-white/[0.05]")}>
              <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full ring-1",
                selected ? "bg-sky-400 text-black ring-sky-300" : "ring-white/25")}>
                {selected && <Check className="size-3"/>}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-100">{option.label}</span>
                <span className="block text-[11px] text-slate-500">{option.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
