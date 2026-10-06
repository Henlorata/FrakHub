import {useCallback, useEffect, useMemo, useState, type CSSProperties} from "react";
import {Link} from "react-router";
import {toast} from "sonner";
import {
  CalendarPlus, Eye, EyeOff, Loader2, Lock, NotebookPen, Pencil, Plus, Search, ShieldQuestion, Star, Trash2, UserRoundSearch, X,
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {EmptyState} from "@/components/layout/EmptyState";
import {useConfirm} from "@/components/ConfirmDialog";
import {PersonPicker} from "@/components/fleet/Pickers";
import {useAuth} from "@/context/AuthContext";
import {useSuspects} from "@/context/SuspectCacheContext";
import {useProfileDirectory} from "@/lib/profile-directory";
import {mcbApi, type CaseListItem, type Informant, type InformantContact, type InformantStatus} from "@/lib/mcb";
import {formatDate, todayKey} from "@/lib/datetime";
import {cn, errorMessage} from "@/lib/utils";
import {MemberAvatar, Mugshot} from "./components/McbBadges";

const STATUS: Record<InformantStatus, {label: string; tone: string}> = {
  active: {label: "Aktív", tone: "bg-emerald-500/10 text-emerald-200 ring-emerald-500/25"},
  dormant: {label: "Szunnyadó", tone: "bg-sky-500/10 text-sky-200 ring-sky-500/25"},
  burned: {label: "Lebukott", tone: "bg-red-500/10 text-red-200 ring-red-500/25"},
  closed: {label: "Lezárva", tone: "bg-white/5 text-slate-400 ring-white/10"},
};

const RELIABILITY = ["", "Megbízhatatlan", "Kétes", "Átlagos", "Megbízható", "Kiváló"];

const VALUE: Record<InformantContact["value"], {label: string; tone: string}> = {
  none: {label: "Semmit sem ért", tone: "bg-white/5 text-slate-400 ring-white/10"},
  low: {label: "Kevés", tone: "bg-slate-500/10 text-slate-200 ring-slate-500/25"},
  medium: {label: "Hasznos", tone: "bg-sky-500/10 text-sky-200 ring-sky-500/25"},
  high: {label: "Kulcsfontosságú", tone: "bg-amber-500/15 text-amber-100 ring-amber-500/30"},
};

const money = new Intl.NumberFormat("hu-HU");

function Stars({value, onChange, size = "sm"}: {value: number; onChange?: (value: number) => void; size?: "sm" | "md"}) {
  const star = (step: number) => (
    <Star className={cn(size === "md" ? "size-5" : "size-3.5", step <= value ? "fill-amber-400 text-amber-400" : "text-slate-600")}/>
  );
  // Read-only stars are plain icons (they also sit inside the list's buttons).
  if (!onChange) {
    return (
      <span className="inline-flex items-center gap-0.5" title={`${value}/5 · ${RELIABILITY[value] ?? ""}`} role="img"
            aria-label={`Megbízhatóság: ${value}/5`}>
        {[1, 2, 3, 4, 5].map((step) => <span key={step}>{star(step)}</span>)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5" title={`${value}/5 · ${RELIABILITY[value] ?? ""}`}>
      {[1, 2, 3, 4, 5].map((step) => (
        <button key={step} type="button" onClick={() => onChange(step)} aria-label={`${step} csillag`} className="transition-transform hover:scale-110">
          {star(step)}
        </button>
      ))}
    </span>
  );
}

/**
 * The informant register: codenames, reliability and the handler, with the log of meetings.
 * Only the MCB leadership and each informant's handler see an informant (the database checks it);
 * the real name stays hidden on screen until asked for.
 */
export function InformantsPage() {
  const {profile} = useAuth();
  const [data, setData] = useState<{is_lead: boolean; informants: Informant[]} | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<InformantStatus | "all">("active");
  const [editing, setEditing] = useState<Informant | "new" | null>(null);
  const [meeting, setMeeting] = useState<Informant | null>(null);
  const [reveal, setReveal] = useState(false);
  const confirm = useConfirm();

  const load = useCallback(async () => {
    try {
      setData(await mcbApi.informants());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const list = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data?.informants ?? []).filter((item) => (statusFilter === "all" || item.status === statusFilter)
      && (!needle || item.codename.toLowerCase().includes(needle) || (item.handler?.full_name ?? "").toLowerCase().includes(needle)));
  }, [data, query, statusFilter]);
  const current = (data?.informants ?? []).find((item) => item.id === selected) ?? list[0] ?? null;

  useEffect(() => {
    setReveal(false);
  }, [current?.id]);

  const replace = (informant: Informant) => setData((prev) => prev && ({
    ...prev, informants: prev.informants.some((item) => item.id === informant.id)
      ? prev.informants.map((item) => (item.id === informant.id ? informant : item)) : [...prev.informants, informant],
  }));

  const remove = async (informant: Informant) => {
    if (!(await confirm({title: "Informátor törlése", description: `„${informant.codename}” és minden találkozója véglegesen törlődik.`,
      confirmLabel: "Törlés", destructive: true, kind: "delete"}))) return;
    try {
      await mcbApi.deleteInformant(informant.id);
      setData((prev) => prev && {...prev, informants: prev.informants.filter((item) => item.id !== informant.id)});
      setSelected(null);
      toast.success("Informátor törölve.");
    } catch (error) {
      toast.error(errorMessage(error, "A törlés nem sikerült."));
    }
  };

  if (failed) return <EmptyState icon={X} title="Az informátorok nem tölthetők be." action={<Button variant="outline" onClick={() => void load()}>Újra</Button>}/>;
  if (!data) return <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]"><div className="skeleton h-96"/><div className="skeleton h-96"/></div>;

  const isLead = data.is_lead;
  return (
    <div className="flex flex-col gap-4" data-tour="mcb-informants">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white"><ShieldQuestion className="size-5 text-sky-300"/> Informátorok</h2>
          <p className="flex items-center gap-1.5 text-xs text-slate-500"><Lock className="size-3"/> Csak az MCB vezetése és az informátor kezelője látja.</p>
        </div>
        {isLead && <Button onClick={() => setEditing("new")}><Plus/> Új informátor</Button>}
      </div>

      {data.informants.length === 0 ? (
        <div className="panel">
          <EmptyState icon={UserRoundSearch} title={isLead ? "Még nincs informátor a nyilvántartásban." : "Nincs általad kezelt informátor."}
                      description={isLead ? "Fedőnév, megbízhatóság és kezelő: a valódi név csak itt szerepel, az aktákban a fedőnév." : undefined}/>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="panel flex min-w-0 flex-col gap-3 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Fedőnév vagy kezelő" className="pl-9"/>
            </div>
            <div className="flex flex-wrap gap-1">
              {(["active", "dormant", "burned", "closed", "all"] as const).map((status) => (
                <button key={status} type="button" onClick={() => setStatusFilter(status)}
                        className={cn("h-7 rounded-md px-2 text-xs font-medium transition-colors",
                          statusFilter === status ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200")}>
                  {status === "all" ? "Mind" : STATUS[status].label}
                </button>
              ))}
            </div>
            <ul className="max-h-[60vh] space-y-1.5 overflow-y-auto pr-1">
              {list.length === 0 && <li className="py-6 text-center text-xs text-slate-500">Nincs találat.</li>}
              {list.map((item, index) => (
                <li key={item.id} style={{"--i": Math.min(index, 10)} as CSSProperties} className="animate-fade">
                  <button type="button" onClick={() => setSelected(item.id)}
                          className={cn("w-full rounded-xl p-3 text-left ring-1 transition-colors",
                            current?.id === item.id ? "bg-sky-500/10 ring-sky-500/30" : "bg-white/[0.02] ring-white/5 hover:bg-white/[0.05]")}>
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-mono text-sm font-semibold tracking-wide text-white">{item.codename}</span>
                      <span className={cn("rounded-full px-1.5 py-px text-[10px] font-semibold ring-1", STATUS[item.status].tone)}>{STATUS[item.status].label}</span>
                      <span className="ml-auto"><Stars value={item.reliability}/></span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                      {item.handler ? <><MemberAvatar url={item.handler.avatar_url} name={item.handler.full_name} size={16}/>{item.handler.full_name}</> : "Nincs kezelő"}
                      <span className="ml-auto">{item.contacts[0] ? `utolsó: ${formatDate(item.contacts[0].met_on)}` : "nincs találkozó"}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {current && (
            <section key={current.id} className="panel animate-fade min-w-0 p-0">
              <header className="flex flex-wrap items-start gap-3 border-b border-white/5 p-5">
                <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sky-500/10 text-sky-200 ring-1 ring-sky-500/25">
                  <ShieldQuestion className="size-6"/>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-mono text-xl font-bold tracking-wider text-white">{current.codename}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className={cn("rounded-full px-2 py-0.5 font-semibold ring-1", STATUS[current.status].tone)}>{STATUS[current.status].label}</span>
                    <Stars value={current.reliability}/><span className="text-slate-400">{RELIABILITY[current.reliability]}</span>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => setMeeting(current)}><CalendarPlus/> Találkozó</Button>
                  <Button size="icon" variant="ghost" className="size-8" title="Szerkesztés" onClick={() => setEditing(current)}><Pencil/></Button>
                  {isLead && <Button size="icon" variant="ghost" className="size-8 hover:text-red-300" title="Törlés" onClick={() => void remove(current)}><Trash2/></Button>}
                </div>
              </header>
              <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
                <Detail label="Valódi név">
                  {current.real_name ? (
                    <span className="inline-flex items-center gap-2">
                      <span className={cn("transition", !reveal && "select-none blur-sm")}>{current.real_name}</span>
                      <button type="button" onClick={() => setReveal((value) => !value)} className="text-slate-400 hover:text-white"
                              title={reveal ? "Elrejtés" : "Megjelenítés"}>{reveal ? <EyeOff className="size-3.5"/> : <Eye className="size-3.5"/>}</button>
                    </span>
                  ) : "–"}
                </Detail>
                <Detail label="Kezelő">
                  {current.handler ? <span className="inline-flex items-center gap-2"><MemberAvatar url={current.handler.avatar_url} name={current.handler.full_name} size={20}/>{current.handler.full_name}</span> : "–"}
                </Detail>
                <Detail label="Elérhetőség">{current.contact ?? "–"}</Detail>
                <Detail label="Kapcsolt személy a nyilvántartásban">
                  {current.suspect ? (
                    <span className="inline-flex items-center gap-2"><Mugshot url={current.suspect.mugshot_url} name={current.suspect.full_name} size={24}/>
                      {current.suspect.full_name}{current.suspect.alias ? ` („${current.suspect.alias}”)` : ""}</span>
                  ) : "–"}
                </Detail>
                {current.notes && (
                  <div className="md:col-span-2">
                    <Detail label="Megjegyzések"><p className="whitespace-pre-wrap wrap-anywhere">{current.notes}</p></Detail>
                  </div>
                )}
              </div>
              <div className="border-t border-white/5 p-5">
                <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><NotebookPen className="size-4 text-slate-400"/> Találkozók · {current.contacts.length}</h4>
                {current.contacts.length === 0 ? (
                  <p className="text-xs text-slate-500">Még nincs rögzített találkozó.</p>
                ) : (
                  <ol className="relative space-y-4 border-l border-white/10 pl-5">
                    {current.contacts.map((contact) => (
                      <li key={contact.id} className="relative">
                        <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full bg-sky-400 ring-4 ring-[#0a1120]"/>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-semibold text-slate-100">{formatDate(contact.met_on)}</span>
                          <span className={cn("rounded-full px-1.5 py-px text-[10px] font-semibold ring-1", VALUE[contact.value].tone)}>{VALUE[contact.value].label}</span>
                          {!!contact.payment && <span className="text-slate-400">{money.format(contact.payment)} $</span>}
                          {contact.case && (
                            <Link to={`/mcb/case/${contact.case.id}`} className="font-mono text-sky-300 hover:underline">{contact.case.case_number}</Link>
                          )}
                        </div>
                        <p className="mt-1 text-sm whitespace-pre-wrap wrap-anywhere text-slate-300">{contact.summary}</p>
                        <p className="mt-0.5 text-[10px] text-slate-500">{contact.author_name ?? "Ismeretlen"}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </section>
          )}
        </div>
      )}

      <InformantDialog informant={editing} isLead={isLead} myId={profile?.id} onOpenChange={(open) => !open && setEditing(null)} onSaved={(saved) => {
        replace(saved);
        setSelected(saved.id);
        setEditing(null);
      }}/>
      <MeetingDialog informant={meeting} onOpenChange={(open) => !open && setMeeting(null)} onSaved={(saved) => {
        replace(saved);
        setMeeting(null);
      }}/>
    </div>
  );
}

function Detail({label, children}: {label: string; children: React.ReactNode}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">{label}</p>
      <div className="mt-0.5 text-sm text-slate-200 wrap-anywhere">{children}</div>
    </div>
  );
}

function InformantDialog({informant, isLead, myId, onOpenChange, onSaved}: {
  informant: Informant | "new" | null;
  isLead: boolean;
  myId: string | undefined;
  onOpenChange: (open: boolean) => void;
  onSaved: (informant: Informant) => void;
}) {
  const {profiles} = useProfileDirectory();
  const {suspects} = useSuspects();
  const creating = informant === "new";
  const existing = informant && informant !== "new" ? informant : null;
  const [form, setForm] = useState({codename: "", real_name: "", contact: "", notes: "", reliability: 3, status: "active" as InformantStatus,
    handler_id: myId ?? null as string | null, suspect_id: null as string | null});
  const [suspectQuery, setSuspectQuery] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!informant) return;
    setSuspectQuery("");
    setForm(existing ? {codename: existing.codename, real_name: existing.real_name ?? "", contact: existing.contact ?? "", notes: existing.notes ?? "",
      reliability: existing.reliability, status: existing.status, handler_id: existing.handler_id, suspect_id: existing.suspect_id}
      : {codename: "", real_name: "", contact: "", notes: "", reliability: 3, status: "active", handler_id: myId ?? null, suspect_id: null});
  }, [informant, existing, myId]);

  const suspectHits = useMemo(() => {
    const needle = suspectQuery.trim().toLowerCase();
    if (needle.length < 2) return [];
    return suspects.filter((suspect) => suspect.full_name.toLowerCase().includes(needle) || (suspect.alias ?? "").toLowerCase().includes(needle)).slice(0, 6);
  }, [suspects, suspectQuery]);
  const linked = suspects.find((suspect) => suspect.id === form.suspect_id);

  const save = async () => {
    setSaving(true);
    try {
      const saved = await mcbApi.saveInformant(existing?.id ?? null, {
        codename: form.codename.trim(), real_name: form.real_name.trim() || null, contact: form.contact.trim() || null, notes: form.notes.trim() || null,
        reliability: form.reliability, status: form.status, handler_id: form.handler_id, suspect_id: form.suspect_id,
      });
      toast.success(creating ? "Informátor felvéve." : "Mentve.");
      onSaved(saved);
    } catch (error) {
      toast.error(errorMessage(error, "A mentés nem sikerült."));
    } finally {
      setSaving(false);
    }
  };

  // A handler (not a lead) edits only the reliability, status, contact and notes.
  const full = isLead;
  return (
    <Dialog open={!!informant} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{creating ? "Új informátor" : `Szerkesztés: ${existing?.codename}`}</DialogTitle>
          <DialogDescription>{full ? "A fedőnév jelenik meg mindenhol; a valódi név csak itt." : "Kezelőként a megbízhatóságot, a státuszt, az elérhetőséget és a megjegyzéseket módosíthatod."}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="informant-codename">Fedőnév</Label>
            <Input id="informant-codename" maxLength={40} disabled={!full} value={form.codename} onChange={(event) => setForm((prev) => ({...prev, codename: event.target.value}))}
                   placeholder="Például: Holló" className="font-mono"/>
          </div>
          <div className="space-y-1">
            <Label htmlFor="informant-real">Valódi név</Label>
            <Input id="informant-real" maxLength={80} disabled={!full} value={form.real_name} onChange={(event) => setForm((prev) => ({...prev, real_name: event.target.value}))}/>
          </div>
          <div className="space-y-1">
            <Label>Megbízhatóság</Label>
            <div className="flex h-9 items-center gap-2"><Stars size="md" value={form.reliability} onChange={(value) => setForm((prev) => ({...prev, reliability: value}))}/>
              <span className="text-xs text-slate-400">{RELIABILITY[form.reliability]}</span></div>
          </div>
          <div className="space-y-1">
            <Label>Státusz</Label>
            <Select value={form.status} onValueChange={(value) => setForm((prev) => ({...prev, status: value as InformantStatus}))}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>{(Object.keys(STATUS) as InformantStatus[]).map((status) => <SelectItem key={status} value={status}>{STATUS[status].label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="informant-contact">Elérhetőség</Label>
            <Input id="informant-contact" maxLength={200} value={form.contact} onChange={(event) => setForm((prev) => ({...prev, contact: event.target.value}))}
                   placeholder="Telefonszám, találkozóhely, időpontok"/>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="informant-notes">Megjegyzések</Label>
            <Textarea id="informant-notes" rows={3} maxLength={2000} value={form.notes} onChange={(event) => setForm((prev) => ({...prev, notes: event.target.value}))}/>
          </div>
        </div>
        {full && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Kezelő</Label>
              <PersonPicker people={profiles.filter((person) => person.division === "MCB" || person.is_bureau_manager)}
                            selected={form.handler_id ? [form.handler_id] : []}
                            onToggle={(person) => setForm((prev) => ({...prev, handler_id: prev.handler_id === person.id ? null : person.id}))}/>
            </div>
            <div className="space-y-1.5">
              <Label>Kapcsolt személy (nem kötelező)</Label>
              {linked ? (
                <div className="flex items-center gap-2 rounded-xl bg-white/[0.03] p-2 ring-1 ring-white/10">
                  <Mugshot url={linked.mugshot_url} name={linked.full_name} size={28}/>
                  <span className="min-w-0 flex-1 truncate text-sm">{linked.full_name}</span>
                  <Button size="icon-sm" variant="ghost" onClick={() => setForm((prev) => ({...prev, suspect_id: null}))}><X/></Button>
                </div>
              ) : (
                <>
                  <Input value={suspectQuery} onChange={(event) => setSuspectQuery(event.target.value)} placeholder="Név vagy becenév a nyilvántartásból"/>
                  <ul className="space-y-1">
                    {suspectHits.map((suspect) => (
                      <li key={suspect.id}>
                        <button type="button" onClick={() => setForm((prev) => ({...prev, suspect_id: suspect.id}))}
                                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5">
                          <Mugshot url={suspect.mugshot_url} name={suspect.full_name} size={24}/>{suspect.full_name}
                          {suspect.alias && <span className="text-xs text-slate-500">„{suspect.alias}”</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button disabled={saving || form.codename.trim().length < 2} onClick={() => void save()}>{saving && <Loader2 className="animate-spin"/>} Mentés</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MeetingDialog({informant, onOpenChange, onSaved}: {informant: Informant | null; onOpenChange: (open: boolean) => void; onSaved: (informant: Informant) => void}) {
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [form, setForm] = useState({met_on: todayKey(), summary: "", value: "medium" as InformantContact["value"], case_id: "none", payment: ""});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!informant) return;
    setForm({met_on: todayKey(), summary: "", value: "medium", case_id: "none", payment: ""});
    mcbApi.list().then((list) => setCases(list.filter((item) => item.can_open && item.status === "open"))).catch(() => undefined);
  }, [informant]);
  const save = async () => {
    if (!informant) return;
    setSaving(true);
    try {
      const saved = await mcbApi.addInformantContact(informant.id, {
        met_on: form.met_on, summary: form.summary.trim(), value: form.value, case_id: form.case_id === "none" ? null : form.case_id,
        payment: form.payment ? Number(form.payment.replace(/\D/g, "")) : null,
      });
      toast.success("Találkozó rögzítve.");
      onSaved(saved);
    } catch (error) {
      toast.error(errorMessage(error, "A mentés nem sikerült."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={!!informant} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Találkozó: {informant?.codename}</DialogTitle>
          <DialogDescription>Mit mondott, mennyit ért, és melyik aktához kapcsolódik.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="meeting-date">Dátum</Label>
            <Input id="meeting-date" type="date" max={todayKey()} value={form.met_on} onChange={(event) => setForm((prev) => ({...prev, met_on: event.target.value}))}/>
          </div>
          <div className="space-y-1">
            <Label>Az információ értéke</Label>
            <Select value={form.value} onValueChange={(value) => setForm((prev) => ({...prev, value: value as InformantContact["value"]}))}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>{(Object.keys(VALUE) as InformantContact["value"][]).map((value) => <SelectItem key={value} value={value}>{VALUE[value].label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="meeting-summary">Összefoglaló</Label>
          <Textarea id="meeting-summary" rows={4} maxLength={1000} value={form.summary} onChange={(event) => setForm((prev) => ({...prev, summary: event.target.value}))}/>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
          <div className="space-y-1">
            <Label>Akta (nem kötelező)</Label>
            <Select value={form.case_id} onValueChange={(value) => setForm((prev) => ({...prev, case_id: value}))}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="none">Nincs</SelectItem>
                {cases.map((item) => <SelectItem key={item.id} value={item.id}>{item.case_number} · {item.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="meeting-payment">Kifizetés ($)</Label>
            <Input id="meeting-payment" inputMode="numeric" value={form.payment} onChange={(event) => setForm((prev) => ({...prev, payment: event.target.value.replace(/[^0-9]/g, "")}))}/>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button disabled={saving || form.summary.trim().length < 5} onClick={() => void save()}>{saving && <Loader2 className="animate-spin"/>} Rögzítés</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
