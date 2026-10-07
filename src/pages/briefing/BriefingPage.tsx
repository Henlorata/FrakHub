import {useCallback, useEffect, useMemo, useState, type CSSProperties} from "react";
import {Link, useSearchParams} from "react-router";
import {toast} from "sonner";
import {
  CalendarDays, ChevronDown, FileText, Gavel, Handshake, Loader2, Megaphone, Plus, Radar, RefreshCw, Siren, Ticket, UserRoundX,
} from "lucide-react";
import {PageHeader} from "@/components/layout/PageHeader";
import {StatCard} from "@/components/layout/StatCard";
import {EmptyState} from "@/components/layout/EmptyState";
import {Button} from "@/components/ui/button";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {useConfirm} from "@/components/ConfirmDialog";
import {useSystemStatus} from "@/context/SystemStatusContext";
import {ALERT_LEVELS} from "@/lib/alert-levels";
import {getOptimizedAvatarUrl} from "@/lib/cloudinary";
import {formatAgo, formatLongDate, formatTime, formatUntil} from "@/lib/datetime";
import {EVENT_KINDS} from "@/lib/events";
import {boloToDraft, patrolApi, type Bolo, type BoloDraft, type Briefing} from "@/lib/patrol";
import {cn, errorMessage} from "@/lib/utils";
import {BoloCard} from "./BoloCard";
import {BoloDialog} from "./BoloDialog";

/**
 * The shift briefing ("Eligazítás"): what a deputy should know before going on duty, in one call
 * (get_briefing): the BOLO board, the persons with an approved arrest warrant, today's events, the
 * latest announcements and the last 24 hours in numbers. Every member adds BOLOs; anyone may mark
 * one found.
 */
export function BriefingPage() {
  const {alertLevel} = useSystemStatus();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<Briefing | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [closed, setClosed] = useState<Bolo[] | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [editing, setEditing] = useState<{id: string; draft: BoloDraft} | null>(null);
  const [resolving, setResolving] = useState<Bolo | null>(null);
  const dialogOpen = params.get("new") === "bolo" || !!editing;
  const focused = params.get("bolo");
  const level = ALERT_LEVELS[alertLevel];

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setData(await patrolApi.briefing());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const loadClosed = useCallback(async () => {
    try {
      setClosed((await patrolApi.bolos()).closed);
    } catch {
      setClosed([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (showClosed && closed === null) void loadClosed();
  }, [showClosed, closed, loadClosed]);

  // A link to one alert (notification): scroll to it once the board is there.
  useEffect(() => {
    if (!focused || !data) return;
    const inBoard = data.bolos.some((bolo) => bolo.id === focused) || data.resolved.some((bolo) => bolo.id === focused);
    if (!inBoard) setShowClosed(true);
    requestAnimationFrame(() => document.getElementById(`bolo-${focused}`)?.scrollIntoView({behavior: "smooth", block: "center"}));
  }, [focused, data, closed]);

  const refresh = () => {
    void load();
    if (closed !== null) void loadClosed();
  };

  const closeDialog = () => {
    setEditing(null);
    if (params.get("new")) {
      const next = new URLSearchParams(params);
      next.delete("new");
      setParams(next, {replace: true});
    }
  };

  const act = async (work: () => Promise<unknown>, done: string) => {
    try {
      await work();
      toast.success(done);
      refresh();
    } catch (error) {
      toast.error(errorMessage(error, "A művelet nem sikerült."));
    }
  };

  const handlers = {
    onResolve: (bolo: Bolo) => setResolving(bolo),
    onEdit: (bolo: Bolo) => setEditing({id: bolo.id, draft: boloToDraft(bolo)}),
    onExtend: (bolo: Bolo, hours: number) => void act(() => patrolApi.extend(bolo.id, hours), `Meghosszabbítva ${hours / 24} nappal.`),
    onCancel: async (bolo: Bolo) => {
      if (!(await confirm({title: "BOLO visszavonása", description: `„${bolo.title}” lekerül a tábláról. Később újranyitható.`,
        confirmLabel: "Visszavonás", kind: "question"}))) return;
      void act(() => patrolApi.setStatus(bolo.id, "cancelled"), "BOLO visszavonva.");
    },
    onReopen: (bolo: Bolo) => void act(() => patrolApi.setStatus(bolo.id, "active", null, 72), "BOLO újranyitva 3 napra."),
    onDelete: async (bolo: Bolo) => {
      if (!(await confirm({title: "BOLO törlése", description: "Csak tévedésből kiadott BOLO-t törölj; a többit vond vissza vagy jelöld megoldottnak.",
        confirmLabel: "Törlés", destructive: true, kind: "delete"}))) return;
      void act(() => patrolApi.remove(bolo.id), "BOLO törölve.");
    },
  };

  const vehicles = useMemo(() => data?.bolos.filter((bolo) => bolo.kind === "vehicle") ?? [], [data]);
  const persons = useMemo(() => data?.bolos.filter((bolo) => bolo.kind === "person") ?? [], [data]);

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 pb-10">
      <PageHeader icon={Radar} tone="red" eyebrow={formatLongDate()} title="Eligazítás"
                  description="Szolgálatkezdés előtt: BOLO, körözött személyek, a nap eseményei és közleményei."
                  actions={(
                    <>
                      <Button variant="ghost" size="icon" title="Frissítés" disabled={refreshing} onClick={refresh}>
                        <RefreshCw className={cn(refreshing && "animate-spin")}/>
                      </Button>
                      <Button className="bg-red-600 text-white hover:bg-red-500" onClick={() => setParams({new: "bolo"})} data-tour="briefing-new">
                        <Plus/> Új BOLO
                      </Button>
                    </>
                  )}/>

      <div className="panel animate-rise flex flex-wrap items-center gap-3 px-4 py-3" style={{"--i": 1} as CSSProperties}>
        <span className="relative grid size-9 place-items-center rounded-xl ring-1" style={{color: level.color, boxShadow: `0 0 24px ${level.color}33`}}>
          <level.icon className="size-5"/>
          {alertLevel !== "normal" && <span className="absolute inset-0 animate-ping rounded-xl ring-1 motion-reduce:hidden" style={{color: level.color}}/>}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Készültség: <span className={level.text}>{level.label}</span></p>
          <p className="text-xs text-slate-400">{level.description}</p>
        </div>
        {data && <span className="text-[11px] text-slate-500">Frissítve {formatTime(data.generated_at)}</span>}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard index={0} icon={Radar} tone="red" label="Aktív BOLO" value={data ? data.bolos.length : "…"}
                  hint={data ? `${vehicles.length} jármű · ${persons.length} személy` : undefined}/>
        <StatCard index={1} icon={UserRoundX} tone="orange" label="Körözött személy" value={data ? data.wanted.length : "…"} hint="Jóváhagyott elfogatóparancs"/>
        <StatCard index={2} icon={Ticket} tone="gold" label="Bírság (24 óra)" value={data ? data.last24h.tickets : "…"}/>
        <StatCard index={3} icon={Handshake} tone="violet" label="Letartóztatás (24 óra)" value={data ? data.last24h.arrests : "…"}
                  hint={data ? `${data.last24h.reports} rögzített jelentés` : undefined}/>
      </div>

      {failed && !data ? (
        <div className="panel"><EmptyState icon={Radar} title="Az eligazítás nem tölthető be"
                                            action={<Button variant="outline" size="sm" onClick={refresh}>Újra</Button>}/></div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="min-w-0 space-y-4" data-tour="briefing-bolos">
            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-300 uppercase">
              <Siren className="size-4 text-red-400"/> BOLO-tábla
            </h2>
            {data === null ? (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{[0, 1, 2, 3].map((index) => <div key={index} className="skeleton h-40 rounded-2xl"/>)}</div>
            ) : data.bolos.length === 0 ? (
              <div className="panel"><EmptyState icon={Radar} title="Nincs aktív BOLO"
                                                  description="Lopott jármű, eltűnt vagy veszélyes személy? Add ki, és minden járőr látja."/></div>
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {data.bolos.map((bolo, index) => (
                  <BoloCard key={bolo.id} bolo={bolo} index={index} highlighted={focused === bolo.id} {...handlers}/>
                ))}
              </div>
            )}

            {data && data.resolved.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Előkerült az elmúlt két napban</h3>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {data.resolved.map((bolo, index) => <BoloCard key={bolo.id} bolo={bolo} index={index} highlighted={focused === bolo.id} {...handlers}/>)}
                </div>
              </div>
            )}

            <button type="button" onClick={() => setShowClosed((value) => !value)}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200">
              <ChevronDown className={cn("size-3.5 transition-transform", showClosed && "rotate-180")}/> Lezárt és lejárt BOLO-k (7 nap)
            </button>
            {showClosed && (
              closed === null ? <Loader2 className="size-4 animate-spin text-slate-500"/> : closed.length === 0
                ? <p className="text-xs text-slate-500">Az elmúlt héten nem zárult le BOLO.</p>
                : (
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {closed.map((bolo, index) => <BoloCard key={bolo.id} bolo={bolo} index={index} highlighted={focused === bolo.id} {...handlers}/>)}
                  </div>
                )
            )}
          </section>

          <aside className="space-y-4">
            <section className="panel animate-rise p-4" style={{"--i": 2} as CSSProperties} data-tour="briefing-wanted">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><Gavel className="size-4 text-orange-300"/> Körözött személyek</h2>
              {data === null ? <div className="skeleton h-24 rounded-xl"/> : data.wanted.length === 0 ? (
                <p className="text-xs text-slate-500">Nincs érvényes elfogatóparancs.</p>
              ) : (
                <ul className="space-y-2">
                  {data.wanted.map((person) => (
                    <li key={person.id} className="flex min-w-0 items-center gap-3 rounded-xl bg-white/[0.03] p-2 ring-1 ring-white/5">
                      <div className="size-11 shrink-0 overflow-hidden rounded-lg bg-white/[0.04] ring-1 ring-white/10">
                        {person.mugshot_url
                          ? <img src={getOptimizedAvatarUrl(person.mugshot_url, 96) ?? undefined} alt="" className="size-full object-cover"/>
                          : <div className="grid size-full place-items-center text-slate-500"><UserRoundX className="size-5"/></div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">{person.name}</p>
                        <p className="truncate text-[11px] text-slate-400">
                          {person.alias ? `„${person.alias}” · ` : ""}{person.expires_at ? `lejár ${formatUntil(person.expires_at)}` : "határidő nélkül"}
                        </p>
                      </div>
                      {person.case && (
                        <Link to={`/mcb/case/${person.case.id}`} className="shrink-0 font-mono text-[11px] text-sky-300 hover:text-sky-200">{person.case.case_number}</Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel animate-rise p-4" style={{"--i": 3} as CSSProperties}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><CalendarDays className="size-4 text-amber-300"/> Ma</h2>
              {data === null ? <div className="skeleton h-16 rounded-xl"/> : data.events.length === 0 ? (
                <p className="text-xs text-slate-500">Mára nincs esemény.</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.events.map((event) => {
                    const look = EVENT_KINDS[event.kind as keyof typeof EVENT_KINDS] ?? EVENT_KINDS.other;
                    return (
                      <li key={event.id}>
                        <Link to={`/events?id=${event.id}`} className="flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/[0.04]">
                          <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg ring-1", look.tile)}><look.icon className="size-4"/></span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-slate-100">{event.title}</span>
                            <span className="block truncate text-[11px] text-slate-500">{formatTime(event.starts_at)}{event.location ? ` · ${event.location}` : ""}</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="panel animate-rise p-4" style={{"--i": 4} as CSSProperties}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><Megaphone className="size-4 text-yellow-300"/> Közlemények</h2>
              {data === null ? <div className="skeleton h-16 rounded-xl"/> : data.announcements.length === 0 ? (
                <p className="text-xs text-slate-500">Nincs közlemény.</p>
              ) : (
                <ul className="space-y-3">
                  {data.announcements.map((item) => (
                    <li key={item.id} className="min-w-0">
                      <p className="text-sm font-medium text-slate-100 wrap-anywhere">{item.title}</p>
                      <p className="line-clamp-3 text-xs text-slate-400 whitespace-pre-wrap wrap-anywhere">{item.content}</p>
                      <p className="mt-0.5 text-[11px] text-slate-600">{item.author ? `${item.author} · ` : ""}{formatAgo(item.created_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
              <Link to="/reports" className="mt-3 inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200">
                <FileText className="size-3"/> Jelentés írása
              </Link>
            </section>
          </aside>
        </div>
      )}

      <BoloDialog open={dialogOpen} editing={editing} onOpenChange={(open) => !open && closeDialog()}
                  onSaved={(id) => {
                    refresh();
                    setParams({bolo: id}, {replace: true});
                  }}/>
      <ResolveDialog bolo={resolving} onOpenChange={(open) => !open && setResolving(null)}
                     onResolve={async (note) => {
                       const bolo = resolving;
                       if (!bolo) return;
                       await act(() => patrolApi.setStatus(bolo.id, "resolved", note), "Megtalálva: köszönjük!");
                       setResolving(null);
                     }}/>
    </div>
  );
}

function ResolveDialog({bolo, onOpenChange, onResolve}: {bolo: Bolo | null; onOpenChange: (open: boolean) => void; onResolve: (note: string) => Promise<void>}) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open={!!bolo} onOpenChange={(open) => { if (!saving) { onOpenChange(open); setNote(""); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Megtaláltam: {bolo?.title}</DialogTitle>
          <DialogDescription>Hol és hogyan került elő? A kiadója értesítést kap, a BOLO lekerül a tábláról.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="bolo-resolution">Megjegyzés</Label>
          <Textarea id="bolo-resolution" value={note} maxLength={500} rows={3} placeholder="pl. A Doherty garázsban állt, a tulajdonos átvette."
                    onChange={(event) => setNote(event.target.value)}/>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Mégse</Button>
          <Button disabled={saving || note.trim().length < 3} className="bg-emerald-600 text-white hover:bg-emerald-500" onClick={async () => {
            setSaving(true);
            try {
              await onResolve(note.trim());
              setNote("");
            } finally {
              setSaving(false);
            }
          }}>
            {saving ? <Loader2 className="animate-spin"/> : null} Megtalálva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
