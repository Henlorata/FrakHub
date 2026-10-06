import {useState} from "react";
import {useSearchParams} from "react-router";
import {ArrowRight, Check, Minus, Plus, ScrollText, Sparkles} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {formatDate, todayKey, daysBetween} from "@/lib/datetime";
import {cn} from "@/lib/utils";
import {PENAL_RELEASES, type PenalRelease} from "@shared/penal-changelog";
import type {PenalChange, PenalField} from "@shared/penal-diff";

const SEEN_KEY = "frakhub.penal.seen";
/** Items changed in this many days get a badge in the list. */
const BADGE_DAYS = 30;

const RELEASES = PENAL_RELEASES.filter((release) => release.changes.length > 0);

const FIELD_LABEL: Record<PenalField, string> = {name: "Megnevezés", fine: "Bírság", jail: "Fegyház", note: "Megjegyzés"};
const KIND: Record<PenalChange["kind"], {label: string; tone: string; icon: typeof Plus}> = {
  added: {label: "Új", tone: "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30", icon: Plus},
  changed: {label: "Módosult", tone: "bg-amber-500/15 text-amber-200 ring-amber-500/30", icon: ArrowRight},
  removed: {label: "Törölve", tone: "bg-red-500/15 text-red-200 ring-red-500/30", icon: Minus},
};

/** Item id -> what happened to it in the releases of the last month (the list marks them). */
export function recentPenalChanges(): Map<string, PenalChange["kind"]> {
  const today = todayKey();
  const marks = new Map<string, PenalChange["kind"]>();
  for (const release of [...RELEASES].reverse()) {
    if (daysBetween(release.date, today) > BADGE_DAYS) continue;
    for (const change of release.changes) if (change.kind !== "removed") marks.set(change.id, change.kind);
  }
  return marks;
}

export const PENAL_CHANGE_BADGE = KIND;

/**
 * "The penal code changed" strip on the calculator: shown until the member has looked at the
 * newest release (or opened from its notification), with the list of changes in a dialog.
 */
export function PenalChangesBanner() {
  const [params, setParams] = useSearchParams();
  const latest = RELEASES[0];
  const [seen, setSeen] = useState(() => localStorage.getItem(SEEN_KEY));
  const [open, setOpen] = useState(params.get("changes") === "1");

  if (!latest) return null;
  const fresh = seen !== latest.version && daysBetween(latest.date, todayKey()) <= 60;

  const acknowledge = () => {
    localStorage.setItem(SEEN_KEY, latest.version);
    setSeen(latest.version);
  };
  const close = (value: boolean) => {
    setOpen(value);
    if (!value) {
      acknowledge();
      if (params.has("changes")) {
        const next = new URLSearchParams(params);
        next.delete("changes");
        setParams(next, {replace: true});
      }
    }
  };

  return (
    <>
      {fresh ? (
        <div className="panel animate-rise flex flex-col gap-3 border border-amber-500/25 bg-amber-500/[0.06] p-4 sm:flex-row sm:items-center" data-tour="calc-changes">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30"><Sparkles className="size-5"/></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-50">{latest.title} <span className="font-normal text-amber-200/70">· {formatDate(latest.date)}</span></p>
            <p className="text-xs text-amber-100/80">{latest.summary}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={acknowledge}><Check/> Rendben</Button>
            <Button size="sm" onClick={() => setOpen(true)}><ScrollText/> Mi változott?</Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300">
            <ScrollText className="size-3.5"/> Btk. változásnapló
          </button>
        </div>
      )}
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>A Btk. változásai</DialogTitle>
            <DialogDescription>A kalkulátor mindig a legfrissebb változatot használja.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] space-y-6 overflow-y-auto pr-1">
            {RELEASES.slice(0, 6).map((release) => <ReleaseBlock key={release.version} release={release}/>)}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReleaseBlock({release}: {release: PenalRelease}) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-white">{release.title} <span className="font-normal text-slate-500">· {formatDate(release.date)}</span></h3>
      <p className="text-xs text-slate-400">{release.summary}</p>
      <ul className="mt-3 space-y-2">
        {release.changes.map((change) => {
          const look = KIND[change.kind];
          return (
            <li key={`${change.kind}-${change.id}`} className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/[0.06]">
              <div className="flex min-w-0 items-center gap-2">
                <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-semibold ring-1", look.tone)}>
                  <look.icon className="size-3"/>{look.label}
                </span>
                <span className="font-mono text-[11px] text-slate-500">{change.paragraph}</span>
                <span className={cn("min-w-0 text-sm wrap-anywhere text-slate-100", change.kind === "removed" && "line-through decoration-slate-500")}>{change.name}</span>
              </div>
              {change.fields && (
                <dl className="mt-2 space-y-1 text-xs">
                  {change.fields.map((field) => (
                    <div key={field.field} className="grid grid-cols-[80px_minmax(0,1fr)] gap-2">
                      <dt className="text-slate-500">{FIELD_LABEL[field.field]}</dt>
                      <dd className="min-w-0 wrap-anywhere text-slate-300">
                        <span className="text-slate-500 line-through decoration-slate-600">{field.from}</span>
                        <ArrowRight className="mx-1 inline size-3 text-slate-500"/>
                        <span className="font-medium text-white">{field.to}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
