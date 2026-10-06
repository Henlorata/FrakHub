import {Car, Link2, Lock, MapPin, User} from "lucide-react";
import type {CaseSuggestion} from "@/lib/mcb";
import {CaseStatusChip} from "./McbBadges";

const REASON_ICON = {person: User, vehicle: Car, address: MapPin} as const;

/**
 * Other cases with the same person, plate or address that the document does not mention yet:
 * a nudge to look at them (and link them with @ if they belong together).
 */
export function SuggestionsCard({suggestions, onOpen}: {suggestions: CaseSuggestion[]; onOpen: (suggestion: CaseSuggestion) => void}) {
  if (suggestions.length === 0) return null;
  return (
    <section className="panel p-4" data-tour="case-suggestions">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Link2 className="size-4 text-sky-300"/> Kapcsolódhat</h3>
      <p className="mt-0.5 text-[11px] text-slate-500">Ugyanaz a személy, rendszám vagy cím egy másik aktában is szerepel.</p>
      <ul className="mt-3 space-y-2">
        {suggestions.map((suggestion) => (
          <li key={suggestion.id}>
            <button type="button" onClick={() => onOpen(suggestion)}
                    className="w-full rounded-xl bg-white/[0.03] p-2.5 text-left ring-1 ring-white/[0.06] transition-colors hover:bg-white/[0.06] hover:ring-white/15">
              <div className="flex min-w-0 items-center gap-2">
                <span className="font-mono text-[11px] text-sky-300/90">{suggestion.case_number}</span>
                <CaseStatusChip status={suggestion.status}/>
                {!suggestion.can_open && <Lock className="ml-auto size-3 text-slate-500" aria-label="Nincs hozzáférésed"/>}
              </div>
              <p className="mt-1 truncate text-xs font-medium text-slate-100">{suggestion.title}</p>
              <ul className="mt-1.5 flex flex-wrap gap-1">
                {suggestion.reasons.map((reason) => {
                  const Icon = REASON_ICON[reason.kind] ?? User;
                  return (
                    <li key={`${reason.kind}-${reason.label}`}
                        className="inline-flex max-w-full items-center gap-1 rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-200 ring-1 ring-sky-500/20">
                      <Icon className="size-3 shrink-0"/><span className="truncate">{reason.label}</span>
                    </li>
                  );
                })}
              </ul>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
