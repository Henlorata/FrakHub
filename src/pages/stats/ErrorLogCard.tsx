import {useCallback, useEffect, useState, type ReactNode} from "react";
import {toast} from "sonner";
import {Bug, Check, ChevronDown, Loader2, RotateCcw} from "lucide-react";
import {Button} from "@/components/ui/button";
import {formatDateTime} from "@/lib/datetime";
import {ERROR_KIND_LABELS, errorLogApi, type ClientError} from "@/lib/system";
import {cn, errorMessage} from "@/lib/utils";

const KIND_TONES: Record<ClientError["kind"], string> = {
  crash: "bg-rose-500/15 text-rose-200 ring-rose-500/25",
  error: "bg-orange-500/15 text-orange-200 ring-orange-500/25",
  upload: "bg-amber-500/15 text-amber-200 ring-amber-500/25",
  api: "bg-violet-500/15 text-violet-200 ring-violet-500/25",
  database: "bg-sky-500/15 text-sky-200 ring-sky-500/25",
};

type Log = {open: number; items: ClientError[]};

/**
 * What broke in the browsers (report_client_error): one row per kind of error with its repeats, the
 * pages, builds and browsers it came from and who met it. Read once when the page opens. Mark a row
 * handled once the fix is out: a report from an old tab of a build that had it leaves it handled,
 * a newer build opens it again. For the Executive Staff and the Bureau Manager.
 */
export function ErrorLogCard() {
  const [log, setLog] = useState<Log | null | undefined>(undefined);
  const [showHandled, setShowHandled] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => errorLogApi.load().then(setLog, () => setLog(null)), []);
  useEffect(() => {
    void load();
  }, [load]);

  const mark = async (ids: string[], resolved: boolean, key: string) => {
    setBusy(key);
    try {
      await errorLogApi.resolve(ids, resolved);
      toast.success(resolved ? "Elintézettnek jelölve." : "Újra nyitva.");
      await load();
    } catch (error) {
      toast.error(errorMessage(error, "Nem sikerült."));
    } finally {
      setBusy(null);
    }
  };

  const open = log?.items.filter((item) => !item.resolved_at) ?? [];
  const handled = log?.items.filter((item) => item.resolved_at) ?? [];

  return (
    <section id="hibak" className="panel scroll-mt-24 overflow-hidden p-0">
      <header className="flex flex-wrap items-center gap-3 p-5">
        <span className="grid size-10 place-items-center rounded-xl bg-white/[0.04] text-slate-300 ring-1 ring-white/10"><Bug className="size-5"/></span>
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            Rendszer: hibanapló
            {!!log?.open && <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-200 tabular-nums ring-1 ring-rose-500/25">{log.open} nyitott</span>}
          </h2>
          <p className="text-xs text-slate-500">
            Amit a böngészők jelentettek: összeomlott oldal, sikertelen feltöltés, szerver- és adatbázishiba. Egy sor egy fajta hiba, az ismétlésekkel együtt.
          </p>
        </div>
        {open.length > 1 && (
          <Button size="sm" variant="outline" className="h-8 text-xs" disabled={busy !== null}
                  onClick={() => void mark(open.map((item) => item.id), true, "all")}>
            {busy === "all" ? <Loader2 className="animate-spin"/> : <Check/>} Mind elintézve
          </Button>
        )}
      </header>
      {log === undefined ? (
        <div className="skeleton mx-5 mb-5 h-16 rounded-xl"/>
      ) : log === null ? (
        <p className="px-5 pb-5 text-sm text-slate-500">A hibanapló nem tölthető be.</p>
      ) : open.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-slate-500">Nincs nyitott hiba.</p>
      ) : (
        <ul className="divide-y divide-white/5 border-t border-white/5">
          {open.map((item) => <ErrorRow key={item.id} item={item} busy={busy} onMark={mark}/>)}
        </ul>
      )}
      {handled.length > 0 && (
        <div className="border-t border-white/5">
          <button type="button" aria-expanded={showHandled} onClick={() => setShowHandled((value) => !value)}
                  className="flex w-full items-center gap-2 px-5 py-3 text-left text-xs text-slate-400 hover:text-slate-200">
            <ChevronDown className={cn("size-4 transition-transform", showHandled && "rotate-180")}/> Elintézett hibák ({handled.length})
          </button>
          {showHandled && (
            <ul className="divide-y divide-white/5 border-t border-white/5 opacity-80">
              {handled.map((item) => <ErrorRow key={item.id} item={item} busy={busy} onMark={mark}/>)}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function ErrorRow({item, busy, onMark}: {item: ClientError; busy: string | null; onMark: (ids: string[], resolved: boolean, key: string) => Promise<void>}) {
  const others = item.members - item.users.length;
  return (
    <li className="space-y-2 px-5 py-3">
      <div className="flex flex-wrap items-start gap-2">
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1", KIND_TONES[item.kind])}>{ERROR_KIND_LABELS[item.kind]}</span>
        <p className="min-w-0 flex-1 basis-60 font-mono text-xs text-slate-200 wrap-anywhere">{item.message}</p>
        <Button size="sm" variant="outline" className="h-7 shrink-0 text-xs" disabled={busy !== null}
                onClick={() => void onMark([item.id], !item.resolved_at, item.id)}>
          {busy === item.id ? <Loader2 className="animate-spin"/> : item.resolved_at ? <RotateCcw/> : <Check/>}
          {item.resolved_at ? "Újranyitás" : "Elintézve"}
        </Button>
      </div>
      <p className="text-[11px] text-slate-400 tabular-nums">
        {[
          `${item.occurrences}×`,
          item.members > 0 && `${item.members} tag`,
          item.guests > 0 && `${item.guests} látogató`,
          `utoljára ${formatDateTime(item.last_seen)}`,
          `először ${formatDateTime(item.first_seen)}`,
          item.resolved_at && `elintézte: ${item.resolved_by ?? "ismeretlen"}, ${formatDateTime(item.resolved_at)}`,
        ].filter(Boolean).join(" · ")}
      </p>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-[auto_minmax(0,1fr)]">
        {item.routes.length > 0 && <Fact label="Oldal">{item.routes.map((route) => <code key={route} className="mr-1.5 text-slate-300">{route}</code>)}</Fact>}
        {item.users.length > 0 && (
          <Fact label="Érintett">
            {item.users.map((user) => `${user.full_name}${user.badge_number ? ` (#${user.badge_number})` : ""}`).join(", ")}
            {others > 0 && ` és még ${others}`}
          </Fact>
        )}
        {item.browsers.length > 0 && <Fact label="Böngésző">{item.browsers.join(", ")}</Fact>}
        {item.builds.length > 0 && (
          <Fact label="Verzió">
            {item.builds.map((build) => (build === __APP_BUILD__ ? `${build} (a mostani)` : build)).join(", ")}
          </Fact>
        )}
      </dl>
      {item.detail && (
        <details className="group">
          <summary className="cursor-pointer text-[11px] text-slate-500 select-none hover:text-slate-300">Részletek</summary>
          <pre className="mt-1.5 max-h-56 overflow-auto rounded-lg bg-black/40 p-2.5 text-[11px] whitespace-pre-wrap text-slate-400 wrap-anywhere">{item.detail}</pre>
        </details>
      )}
    </li>
  );
}

function Fact({label, children}: {label: string; children: ReactNode}) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className="min-w-0 text-slate-300 wrap-anywhere">{children}</dd>
    </>
  );
}
