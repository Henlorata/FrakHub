import {useCallback, useEffect, useState, type CSSProperties, type ReactNode} from "react";
import {Link, useNavigate, useParams} from "react-router";
import {toast} from "sonner";
import {
  ArrowLeft, Ban, CalendarDays, Check, ClipboardCopy, Code2, ExternalLink, Eye, FileText, FolderOpen, Loader2, Lock, LockOpen, Pencil,
  RotateCcw, Scale, Shield, Trash2, UserRound,
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Dialog, DialogContent, DialogDescription, DialogTitle} from "@/components/ui/dialog";
import {BbcodePreview} from "@/components/BbcodePreview";
import {useConfirm} from "@/components/ConfirmDialog";
import {EmptyState} from "@/components/layout/EmptyState";
import {MemberAvatar} from "@/components/MemberAvatar";
import {formatDate, formatDateTime} from "@/lib/datetime";
import {normalizeForumUrl} from "@/lib/report-templates";
import {isFullReport, periodLabel, reportBbcode, reportError, reportNumber, reportsApi, type ReportDetail} from "@/lib/reports";
import {cn} from "@/lib/utils";
import {PenaltyChips} from "./report-ui";

/**
 * One saved report, for every member: the forum template's parts in a readable layout, its forum
 * link and code, and what the caller may do (the author edits or deletes it while its month is open,
 * the leadership voids it).
 */
export function ReportPage() {
  const {reportId = ""} = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  // The report (or the error) of the id it was asked for: another id shows the skeleton until it arrives.
  const [loaded, setLoaded] = useState<{id: string; report: ReportDetail | null; error: string | null} | null>(null);
  const report = loaded?.id === reportId ? loaded.report : null;
  const failed = loaded?.id === reportId ? loaded.error : null;
  const [view, setView] = useState<"report" | "code">("report");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState("");
  const [copied, setCopied] = useState(false);

  const show = useCallback((next: ReportDetail) => {
    setLoaded({id: next.id, report: next, error: null});
    setLink(next.forum_url ?? "");
  }, []);

  useEffect(() => {
    let active = true;
    reportsApi.get(reportId).then((result) => {
      if (!active) return;
      if (result) show(result);
      else setLoaded({id: reportId, report: null, error: "A jelentés nem található."});
    }).catch((error) => active && setLoaded({id: reportId, report: null, error: reportError(error)}));
    return () => {
      active = false;
    };
  }, [reportId, show]);

  if (failed) {
    return (
      <div className="mx-auto w-full max-w-[1200px] pb-10">
        <BackLink/>
        <section className="panel mt-4"><EmptyState icon={FileText} title="A jelentés nem nyitható meg." description={failed}/></section>
      </div>
    );
  }
  if (!report) {
    return (
      <div className="mx-auto w-full max-w-[1200px] space-y-4 pb-10">
        <BackLink/>
        <div className="skeleton h-28 rounded-2xl"/>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]"><div className="skeleton h-96 rounded-2xl"/><div className="skeleton h-72 rounded-2xl"/></div>
      </div>
    );
  }

  const full = isFullReport(report);
  const code = full ? reportBbcode(report) : "";
  const linkUrl = link.trim() ? normalizeForumUrl(link) : null;
  const linkInvalid = link.trim() !== "" && linkUrl === null;
  const linkChanged = (linkUrl ?? null) !== (report.forum_url ?? null);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("BBCode a vágólapon.");
  };

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
    } catch (error) {
      toast.error(reportError(error));
    } finally {
      setBusy(false);
    }
  };

  const saveLink = () => run(async () => {
    const result = await reportsApi.setLink(report.id, linkUrl);
    show({...report, forum_url: result.forum_url});
    toast.success("Fórum link mentve.");
  });

  const remove = async () => {
    if (!(await confirm({title: "Jelentés törlése", description: `Törlöd a(z) ${reportNumber(report.number)} jelentést? A havi számodból is kikerül.`,
      confirmLabel: "Törlés", destructive: true, kind: "delete"}))) return;
    await run(async () => {
      await reportsApi.remove(report.id);
      toast.success("Jelentés törölve.");
      navigate("/reports?tab=list&mine=1");
    });
  };

  const voidReport = () => run(async () => {
    show(await reportsApi.void(report.id, reason));
    setVoiding(false);
    setReason("");
    toast.success("A jelentés érvénytelen: nem számít bele a havi számba. A szerzője értesítést kapott.");
  });

  const restore = () => run(async () => {
    show(await reportsApi.restore(report.id));
    toast.success("A jelentés újra számít.");
  });

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-4 pb-10">
      <BackLink/>

      <header className="panel animate-rise flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sky-500/10 text-sky-300 ring-1 ring-sky-500/25"><FileText className="size-6"/></div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono text-sm font-semibold text-sky-300">{reportNumber(report.number)}</span>
            <Chip icon={report.locked ? Lock : LockOpen} tone={report.locked ? "slate" : "sky"}>
              {periodLabel(report.period)}i elszámolás{report.locked ? " · lezárva" : ""}
            </Chip>
            <Chip icon={CalendarDays} tone="slate">{formatDate(report.occurred_on)}</Chip>
            {report.voided && <Chip icon={Ban} tone="red">Érvénytelen</Chip>}
            {!full && <Chip icon={FileText} tone="slate">Régi bejegyzés</Chip>}
          </div>
          <h1 className="text-xl font-semibold text-white wrap-anywhere">{report.suspect_name ?? report.title}</h1>
          {report.charges && <p className="text-sm text-slate-300 wrap-anywhere">{report.charges}</p>}
          <PenaltyChips fine={report.fine} jailTime={report.jail_time}/>
        </div>
      </header>

      {report.voided && (
        <section className="animate-rise flex items-start gap-3 rounded-xl bg-red-500/[0.07] px-4 py-3 text-sm text-red-100 ring-1 ring-red-500/25">
          <Ban className="mt-0.5 size-4 shrink-0 text-red-300"/>
          <p className="min-w-0 wrap-anywhere">
            <span className="font-semibold">Nem számít bele a havi számba:</span> {report.void_reason}
            {report.voided_by && <span className="text-red-200/70"> · {report.voided_by.full_name}, {report.voided_at ? formatDateTime(report.voided_at) : ""}</span>}
          </p>
        </section>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          {full ? (
            <>
              <div className="inline-flex rounded-lg bg-white/[0.04] p-1 ring-1 ring-white/10">
                {(["report", "code"] as const).map((mode) => (
                  <button key={mode} type="button" onClick={() => setView(mode)}
                          className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors", view === mode ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200")}>
                    {mode === "report" ? <><Eye className="size-3.5"/> Jelentés</> : <><Code2 className="size-3.5"/> Fórum-kód</>}
                  </button>
                ))}
              </div>
              {view === "report" ? (
                <>
                  <Card index={1} icon={Shield} title="Rendvédelmi személyek">
                    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <Field label="Teljes név" value={report.officer_name}/>
                      <Field label="Rendfokozat" value={report.officer_rank}/>
                      <Field label="Jelvényszám" value={report.badge_number} mono/>
                      <Field label="Jelenlévő kollégák" value={report.colleagues} wide/>
                      <Field label="Kezdeményező egység" value={report.unit_id} mono/>
                    </dl>
                  </Card>
                  <Card index={2} icon={UserRound} title="Előállított személy">
                    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <Field label="Teljes név" value={report.suspect_name} wide/>
                      <Field label="Személyi igazolvány" value={report.suspect_id_card} mono/>
                      <Field label="Jogosítvány" value={report.suspect_license} mono/>
                      <Field label="Egészségügyi kártya" value={report.suspect_medical} mono/>
                    </dl>
                  </Card>
                  <Card index={3} icon={Scale} title="Előállítás részletei">
                    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <Field label="Időpont" value={report.report_date} mono/>
                      <Field label="Vétség / bűncselekmény" value={report.charges} wide/>
                      <Field label="Lefoglalt tárgyak" value={report.confiscated_items} wide/>
                    </dl>
                  </Card>
                  <Card index={4} icon={FileText} title="Esetleírás">
                    {report.description
                      ? <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-200 wrap-anywhere">{report.description}</p>
                      : <p className="text-sm text-slate-500">Nincs esetleírás.</p>}
                  </Card>
                </>
              ) : (
                <section className="panel animate-rise overflow-hidden">
                  <div className="bg-[#141b24]/70 p-4"><BbcodePreview source={code}/></div>
                  <pre className="max-h-80 overflow-y-auto border-t border-white/5 p-4 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-emerald-200/85 wrap-anywhere">{code}</pre>
                </section>
              )}
            </>
          ) : (
            <Card index={1} icon={FileText} title="Régi bejegyzés">
              <p className="text-sm text-slate-300 wrap-anywhere">{report.title}</p>
              <p className="text-xs text-slate-500">
                A Jelentésíró mentése előtt rögzített bejegyzés: csak a címe és a fórum linkje van meg, a jelentés maga a fórumon olvasható.
              </p>
            </Card>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20">
          {report.author && (
            <Card index={1} icon={UserRound} title="Írta">
              <div className="flex min-w-0 items-center gap-3">
                <MemberAvatar name={report.author.full_name} avatarUrl={report.author.avatar_url} size={40}/>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-white">{report.author.full_name}</span>
                  <span className="block truncate text-xs text-slate-400">{report.author.faction_rank} · #{report.author.badge_number}</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Mentve: {formatDateTime(report.created_at)}
                {report.updated_at && <> · módosítva: {formatDateTime(report.updated_at)}</>}
              </p>
            </Card>
          )}

          <Card index={2} icon={FolderOpen} title="A fórumon">
            {report.forum_url
              ? <a href={report.forum_url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1.5 text-sm text-emerald-300 hover:underline">
                  <ExternalLink className="size-3.5 shrink-0"/> <span className="truncate">{report.forum_url.replace("https://", "")}</span>
                </a>
              : <p className="text-xs text-slate-500">Nincs megadva fórum link.</p>}
            {report.can_link && (
              <div className="space-y-2">
                <Input value={link} onChange={(event) => setLink(event.target.value)} aria-label="Fórum link" aria-invalid={linkInvalid}
                       placeholder="A mappád vagy a hozzászólásod linkje" className={cn("font-mono text-xs", linkInvalid && "ring-2 ring-red-500/60")}/>
                {linkChanged && (
                  <Button size="sm" variant="outline" onClick={() => void saveLink()} disabled={busy || linkInvalid}>
                    {busy ? <Loader2 className="animate-spin"/> : <FolderOpen/>} Link mentése
                  </Button>
                )}
              </div>
            )}
          </Card>

          <Card index={3} icon={Pencil} title="Műveletek">
            <div className="flex flex-col gap-2">
              {full && <Button variant="outline" onClick={() => void copy()}>{copied ? <Check/> : <ClipboardCopy/>} Fórum-kód másolása</Button>}
              {report.can_edit && full && (
                <Button variant="outline" asChild><Link to={`/reports?edit=${report.id}`}><Pencil/> Szerkesztés</Link></Button>
              )}
              {report.can_edit && (
                <Button variant="ghost" className="text-red-300 hover:bg-red-500/10" onClick={() => void remove()} disabled={busy}><Trash2/> Törlés</Button>
              )}
              {report.can_void && (report.voided
                ? <Button variant="outline" onClick={() => void restore()} disabled={busy}><RotateCcw/> Újra számítson</Button>
                : <Button variant="ghost" className="text-red-300 hover:bg-red-500/10" onClick={() => setVoiding(true)} disabled={busy}><Ban/> Érvénytelenítés</Button>)}
              {report.locked && <p className="text-[11px] text-slate-500">A hónapja a fizetéskor lezárult{report.locked_at ? ` (${formatDate(report.locked_at)})` : ""}: a szerzője már nem módosíthatja.</p>}
            </div>
          </Card>
        </aside>
      </div>

      <Dialog open={voiding} onOpenChange={(open) => !busy && setVoiding(open)}>
        <DialogContent className="sm:max-w-md">
          <div>
            <DialogTitle className="flex items-center gap-2"><Ban className="size-4 text-red-300"/> Jelentés érvénytelenítése</DialogTitle>
            <DialogDescription className="mt-1">
              Nem számít bele a havi jelentésszámba{report.locked ? " (a már kifizetett hónapot nem változtatja meg)" : ""}. A szerzője megkapja az indoklást.
            </DialogDescription>
          </div>
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} rows={3}
                    placeholder="pl. Nincs fent a fórumon / kétszer mentették" aria-label="Indoklás"/>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setVoiding(false)} disabled={busy}>Mégse</Button>
            <Button variant="destructive" onClick={() => void voidReport()} disabled={busy || reason.trim().length < 3}>
              {busy ? <Loader2 className="animate-spin"/> : <Ban/>} Érvénytelenítés
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/reports?tab=list" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"><ArrowLeft className="size-4"/> Jelentések</Link>
  );
}

const CHIP_TONES = {
  sky: "bg-sky-500/10 text-sky-200 ring-sky-500/25",
  slate: "bg-white/[0.04] text-slate-300 ring-white/10",
  red: "bg-red-500/10 text-red-300 ring-red-500/25",
};

function Chip({icon: Icon, tone, children}: {icon: typeof Lock; tone: keyof typeof CHIP_TONES; children: ReactNode}) {
  return <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 ring-1", CHIP_TONES[tone])}><Icon className="size-3"/> {children}</span>;
}

function Card({index, icon: Icon, title, children}: {index: number; icon: typeof Lock; title: string; children: ReactNode}) {
  return (
    <section className="panel animate-rise space-y-3 p-5" style={{"--i": index} as CSSProperties}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Icon className="size-4 text-sky-300"/> {title}</h2>
      {children}
    </section>
  );
}

function Field({label, value, mono, wide}: {label: string; value: string | null; mono?: boolean; wide?: boolean}) {
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      <dt className="text-[11px] text-slate-500">{label}</dt>
      <dd className={cn("text-sm text-slate-100 wrap-anywhere", mono && "font-mono", !value?.trim() && "text-slate-600")}>{value?.trim() || "–"}</dd>
    </div>
  );
}
