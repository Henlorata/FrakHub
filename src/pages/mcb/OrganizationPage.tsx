import {useCallback, useEffect, useMemo, useState, type CSSProperties} from "react";
import {Link, useNavigate, useParams} from "react-router";
import {toast} from "sonner";
import {
  ArrowLeft, Building2, Car, FolderLock, FolderOpen, Gavel, Loader2, MapPin, Network, NotebookPen, Pencil, Plus, Search, Send, Trash2, UserPlus, Users, Waypoints, X,
} from "lucide-react";
import {EmptyState} from "@/components/layout/EmptyState";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {useConfirm} from "@/components/ConfirmDialog";
import {useSuspects} from "@/context/SuspectCacheContext";
import {graphHref} from "@/lib/graph";
import {getOptimizedAvatarUrl} from "@/lib/cloudinary";
import {formatAgo, formatDateTime, formatUntil} from "@/lib/datetime";
import {
  ORG_KINDS, ORG_ROLES, ORG_STATUS, ORG_THREAT, organizationsApi, type OrganizationDetail, type OrganizationDraft, type OrgRole,
} from "@/lib/organizations";
import {cn, errorMessage} from "@/lib/utils";
import {PlateBadge} from "@/pages/briefing/BoloCard";
import {OrganizationDialog} from "./components/OrganizationDialog";
import {OrgEmblem} from "./components/OrgEmblem";

const fold = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * One crime organisation: its members (registered persons with a role), the intelligence log,
 * and what comes from the members: cases (opened only with the case's own rights), warrants,
 * vehicles and properties.
 */
export function OrganizationPage() {
  const {orgId = ""} = useParams<{orgId: string}>();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const {openSuspectId} = useSuspects();
  const [data, setData] = useState<OrganizationDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState("");
  const [source, setSource] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await organizationsApi.detail(orgId));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (work: () => Promise<unknown>, done?: string) => {
    try {
      await work();
      if (done) toast.success(done);
      await load();
    } catch (error) {
      toast.error(errorMessage(error, "A művelet nem sikerült."));
    }
  };

  if (failed && !data) {
    return <div className="panel"><EmptyState icon={Network} title="A szervezet nem tölthető be"
                                              action={<Button variant="outline" size="sm" onClick={() => navigate("/mcb/organizations")}>Vissza</Button>}/></div>;
  }
  if (!data) return <div className="space-y-4"><div className="skeleton h-40 rounded-2xl"/><div className="skeleton h-72 rounded-2xl"/></div>;

  const org = data.organization;
  const Kind = ORG_KINDS[org.kind].icon;
  const draft: OrganizationDraft = {name: org.name, kind: org.kind, status: org.status, threat: org.threat, color: org.color ?? "", logo_url: org.logo_url,
    territory: org.territory ?? "", description: org.description ?? ""};

  const sendNote = async () => {
    if (note.trim().length < 2) return;
    setSending(true);
    try {
      await organizationsApi.addNote(org.id, note, source);
      setNote("");
      setSource("");
      toast.success("Bejegyzés rögzítve.");
      await load();
    } catch (error) {
      toast.error(errorMessage(error, "A bejegyzés nem ment el."));
    } finally {
      setSending(false);
    }
  };

  const remove = async () => {
    if (!(await confirm({title: "Szervezet törlése", destructive: true, kind: "delete", confirmLabel: "Törlés",
      description: `„${org.name}” a taglistájával és a hírszerzési naplójával együtt törlődik. A személyek és az akták megmaradnak.`}))) return;
    try {
      await organizationsApi.remove(org.id);
      toast.success("Szervezet törölve.");
      navigate("/mcb/organizations");
    } catch (error) {
      toast.error(errorMessage(error, "A törlés nem sikerült."));
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 pb-10">
      <Link to="/mcb/organizations" className="inline-flex w-fit items-center gap-1.5 text-xs text-slate-400 hover:text-white">
        <ArrowLeft className="size-3.5"/> Bűnszervezetek
      </Link>

      <header className="panel animate-rise relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 opacity-25" style={{background: `radial-gradient(120% 140% at 0% 0%, ${org.color ?? "#475569"} 0%, transparent 55%)`}}/>
        <div className="relative flex flex-col gap-5 p-6 md:flex-row md:items-center">
          <OrgEmblem name={org.name} color={org.color} logoUrl={org.logo_url} kind={org.kind} size={88}/>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.2em] text-slate-400 uppercase"><Kind className="size-3.5"/>{ORG_KINDS[org.kind].label}</p>
            <h1 className="text-2xl font-semibold text-white wrap-anywhere md:text-3xl">{org.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className={cn("inline-flex h-6 items-center rounded-md px-2 text-xs font-semibold ring-1", ORG_THREAT[org.threat].chip)}>{ORG_THREAT[org.threat].label} veszély</span>
              <span className={cn("inline-flex h-6 items-center rounded-md px-2 text-xs font-semibold ring-1", ORG_STATUS[org.status].chip)}>{ORG_STATUS[org.status].label}</span>
              {org.territory && <span className="inline-flex items-center gap-1 text-xs text-slate-300"><MapPin className="size-3.5"/>{org.territory}</span>}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" asChild><Link to={graphHref(`org:${org.id}`)}><Waypoints/> Kapcsolati háló</Link></Button>
            <Button variant="outline" onClick={() => setEditing(true)}><Pencil/> Szerkesztés</Button>
            {org.can_delete && <Button variant="ghost" className="text-red-300 hover:bg-red-500/10" onClick={() => void remove()}><Trash2/></Button>}
          </div>
        </div>
        <div className="relative grid grid-cols-2 border-t border-white/5 sm:grid-cols-5">
          {([[Users, data.members.length, "tag"], [FolderOpen, data.cases.filter((item) => item.status === "open").length, "nyitott akta"],
            [Gavel, data.members.filter((member) => member.wanted).length, "körözött tag"], [Car, data.vehicles.length, "jármű"],
            [Building2, data.properties.length, "ingatlan"]] as const).map(([icon, value, label]) => <Figure key={label} icon={icon} value={value} label={label}/>)}
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          {org.description && (
            <section className="panel animate-rise p-5" style={{"--i": 1} as CSSProperties}>
              <h2 className="mb-2 text-sm font-semibold text-white">Leírás</h2>
              <p className="text-sm leading-relaxed text-slate-300 whitespace-pre-wrap wrap-anywhere">{org.description}</p>
              <p className="mt-3 text-[11px] text-slate-500">Módosítva {formatDateTime(org.updated_at)}{org.updated_by_name ? ` · ${org.updated_by_name}` : ""}</p>
            </section>
          )}

          <section className="panel animate-rise p-5" style={{"--i": 2} as CSSProperties}>
            <header className="mb-3 flex items-center gap-2">
              <h2 className="flex-1 text-sm font-semibold text-white">Tagok</h2>
              <Button size="sm" variant="outline" onClick={() => setAdding(true)}><UserPlus/> Tag hozzáadása</Button>
            </header>
            {data.members.length === 0 ? (
              <p className="rounded-lg bg-white/[0.02] px-3 py-6 text-center text-xs text-slate-500 ring-1 ring-white/5">Még nincs tag. A nyilvántartásból veheted fel őket.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {data.members.map((member) => (
                  <li key={member.suspect_id} className="flex min-w-0 items-center gap-3 py-2.5">
                    <button type="button" onClick={() => openSuspectId(member.suspect_id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <span className="size-11 shrink-0 overflow-hidden rounded-lg bg-white/[0.04] ring-1 ring-white/10">
                        {member.mugshot_url
                          ? <img src={getOptimizedAvatarUrl(member.mugshot_url, 96) ?? undefined} alt="" className="size-full object-cover"/>
                          : <span className="grid size-full place-items-center text-slate-500"><Users className="size-5"/></span>}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium text-white">{member.full_name}</span>
                          {member.wanted && <span className="rounded bg-red-500/15 px-1.5 text-[10px] font-semibold text-red-200 ring-1 ring-red-500/30">körözött</span>}
                        </span>
                        <span className="block truncate text-[11px] text-slate-400">{member.alias ? `„${member.alias}”` : ""}{member.note ? ` · ${member.note}` : ""}</span>
                      </span>
                    </button>
                    <select value={member.role} aria-label={`${member.full_name} szerepe`}
                            onChange={(event) => void act(() => organizationsApi.setMember(org.id, member.suspect_id, {role: event.target.value as OrgRole}))}
                            className="h-8 rounded-md border border-white/10 bg-[#0b1220] px-2 text-xs text-slate-200">
                      {(Object.keys(ORG_ROLES) as OrgRole[]).map((role) => <option key={role} value={role}>{ORG_ROLES[role]}</option>)}
                    </select>
                    <Button size="icon-sm" variant="ghost" aria-label={`${member.full_name} eltávolítása`} className="hover:text-red-300"
                            onClick={() => void act(() => organizationsApi.removeMember(org.id, member.suspect_id), "Tag eltávolítva.")}><X/></Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel animate-rise p-5" style={{"--i": 3} as CSSProperties}>
            <h2 className="mb-3 text-sm font-semibold text-white">Akták a tagokkal</h2>
            {data.cases.length === 0 ? <p className="text-xs text-slate-500">Egyik tag sem szerepel aktában.</p> : (
              <ul className="space-y-1.5">
                {data.cases.map((item) => (
                  <li key={item.id}>
                    {item.can_open ? (
                      <Link to={`/mcb/case/${item.id}`} className="flex min-w-0 items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/[0.04]">
                        <FolderOpen className="size-4 shrink-0 text-sky-300"/>
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-100">{item.title}</span>
                        <span className="shrink-0 font-mono text-[11px] text-slate-500">{item.case_number}</span>
                      </Link>
                    ) : (
                      <span className="flex min-w-0 items-center gap-3 rounded-lg px-2 py-2 text-slate-500" title="Ezt az aktát csak a tulajdonosa, a közreműködői és az MCB vezetése nyithatja meg.">
                        <FolderLock className="size-4 shrink-0"/>
                        <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
                        <span className="shrink-0 font-mono text-[11px]">{item.case_number}</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section className="panel animate-rise p-5" style={{"--i": 4} as CSSProperties}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><Car className="size-4 text-slate-400"/> Járművek</h2>
              {data.vehicles.length === 0 ? <p className="text-xs text-slate-500">Nincs rögzített jármű.</p> : (
                <ul className="space-y-2">
                  {data.vehicles.map((vehicle) => (
                    <li key={`${vehicle.suspect_id}-${vehicle.plate}`} className="flex min-w-0 items-center gap-2 text-xs text-slate-300">
                      <PlateBadge plate={vehicle.plate} size="sm"/>
                      <span className="min-w-0 truncate">{[vehicle.color, vehicle.vehicle].filter(Boolean).join(" ")}</span>
                      <button type="button" onClick={() => openSuspectId(vehicle.suspect_id)} className="ml-auto shrink-0 text-[11px] text-slate-500 hover:text-slate-200">{vehicle.owner}</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="panel animate-rise p-5" style={{"--i": 5} as CSSProperties}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><Building2 className="size-4 text-slate-400"/> Ingatlanok</h2>
              {data.properties.length === 0 ? <p className="text-xs text-slate-500">Nincs rögzített ingatlan.</p> : (
                <ul className="space-y-2">
                  {data.properties.map((property) => (
                    <li key={`${property.suspect_id}-${property.address}`} className="flex min-w-0 items-center gap-2 text-xs text-slate-300">
                      <MapPin className="size-3.5 shrink-0 text-slate-500"/>
                      <span className="min-w-0 truncate">{property.address}{property.type ? ` · ${property.type}` : ""}</span>
                      <button type="button" onClick={() => openSuspectId(property.suspect_id)} className="ml-auto shrink-0 text-[11px] text-slate-500 hover:text-slate-200">{property.owner}</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>

        <aside className="min-w-0 space-y-5">
          <section className="panel animate-rise p-5" style={{"--i": 2} as CSSProperties}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><NotebookPen className="size-4 text-violet-300"/> Hírszerzési napló</h2>
            <div className="space-y-2 rounded-xl bg-white/[0.02] p-3 ring-1 ring-white/5">
              <Textarea value={note} maxLength={2000} rows={3} placeholder="Mit tudtunk meg? pl. új fegyverszállítmány pénteken a dokkoknál."
                        onChange={(event) => setNote(event.target.value)}/>
              <div className="flex items-center gap-2">
                <Input value={source} maxLength={120} placeholder="Forrás (nem kötelező): megfigyelés, informátor…" className="h-8 text-xs"
                       onChange={(event) => setSource(event.target.value)}/>
                <Button size="sm" disabled={sending || note.trim().length < 2} onClick={() => void sendNote()} className="bg-violet-600 text-white hover:bg-violet-500">
                  {sending ? <Loader2 className="animate-spin"/> : <Send/>} Rögzítés
                </Button>
              </div>
            </div>
            {data.notes.length === 0 ? <p className="mt-3 text-xs text-slate-500">Még nincs bejegyzés.</p> : (
              <ol className="relative mt-4 space-y-4 border-l border-white/10 pl-4">
                {data.notes.map((item) => (
                  <li key={item.id} className="relative">
                    <span aria-hidden className="absolute top-1.5 -left-[21px] size-2.5 rounded-full ring-2 ring-[#0b1220]" style={{background: org.color ?? "#a78bfa"}}/>
                    <p className="text-sm text-slate-200 whitespace-pre-wrap wrap-anywhere">{item.body}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
                      <span title={formatDateTime(item.created_at)}>{formatAgo(item.created_at)}</span>
                      {item.created_by_name && <span>· {item.created_by_name}</span>}
                      {item.source && <span className="rounded bg-white/[0.05] px-1.5 text-slate-400 ring-1 ring-white/10">{item.source}</span>}
                      {item.can_delete && (
                        <button type="button" className="ml-auto text-slate-600 hover:text-red-300" aria-label="Bejegyzés törlése"
                                onClick={() => void act(() => organizationsApi.removeNote(item.id), "Bejegyzés törölve.")}><Trash2 className="size-3.5"/></button>
                      )}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="panel animate-rise p-5" style={{"--i": 3} as CSSProperties}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><Gavel className="size-4 text-orange-300"/> Parancsok a tagokra</h2>
            {data.warrants.length === 0 ? <p className="text-xs text-slate-500">Nincs függő vagy érvényes parancs.</p> : (
              <ul className="space-y-1.5">
                {data.warrants.map((warrant) => (
                  <li key={warrant.id} className="flex min-w-0 items-center gap-2 rounded-lg bg-white/[0.02] px-2.5 py-2 text-xs ring-1 ring-white/5">
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1",
                      warrant.status === "approved" ? "bg-red-500/15 text-red-200 ring-red-500/30" : "bg-amber-500/10 text-amber-200 ring-amber-500/30")}>
                      {warrant.type === "arrest" ? "Elfogató" : "Házkutatási"} · {warrant.status === "approved" ? "érvényes" : "elbírálásra vár"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-slate-200">{warrant.target}</span>
                    {warrant.expires_at && <span className="shrink-0 text-[11px] text-slate-500">lejár {formatUntil(warrant.expires_at)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      <OrganizationDialog open={editing} editing={editing ? {id: org.id, draft} : null} onOpenChange={setEditing} onSaved={() => void load()}/>
      <AddMemberDialog open={adding} onOpenChange={setAdding} taken={new Set(data.members.map((member) => member.suspect_id))}
                       onAdd={(suspectId, role) => act(() => organizationsApi.addMember(org.id, suspectId, role), "Tag hozzáadva.")}/>
    </div>
  );
}

function Figure({icon: Icon, value, label}: {icon: typeof Users; value: number; label: string}) {
  return (
    <div className="px-4 py-3 text-center">
      <p className="text-xl font-semibold text-white">{value}</p>
      <p className="flex items-center justify-center gap-1 text-[11px] text-slate-500"><Icon className="size-3.5"/>{label}</p>
    </div>
  );
}

function AddMemberDialog({open, onOpenChange, taken, onAdd}: {
  open: boolean; onOpenChange: (open: boolean) => void; taken: Set<string>; onAdd: (suspectId: string, role: OrgRole) => Promise<void>;
}) {
  const {suspects} = useSuspects();
  const [term, setTerm] = useState("");
  const [role, setRole] = useState<OrgRole>("member");
  const [busy, setBusy] = useState<string | null>(null);
  const shown = useMemo(() => {
    const needle = fold(term.trim());
    return suspects.filter((suspect) => !taken.has(suspect.id)
      && (!needle || fold(`${suspect.full_name} ${suspect.alias ?? ""} ${suspect.gang_affiliation ?? ""}`).includes(needle))).slice(0, 40);
  }, [suspects, taken, term]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tag hozzáadása</DialogTitle>
          <DialogDescription>A nyilvántartott személyek közül; újat a Nyilvántartás oldalon vehetsz fel.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
            <Input autoFocus value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Név, becenév…" className="pl-9"/>
          </div>
          <select value={role} onChange={(event) => setRole(event.target.value as OrgRole)} aria-label="Szerep"
                  className="h-9 rounded-md border border-white/10 bg-[#0b1220] px-2 text-sm text-slate-200">
            {(Object.keys(ORG_ROLES) as OrgRole[]).map((value) => <option key={value} value={value}>{ORG_ROLES[value]}</option>)}
          </select>
        </div>
        <ul className="max-h-80 space-y-1 overflow-y-auto">
          {shown.length === 0 && <li className="px-2 py-6 text-center text-xs text-slate-500">Nincs találat.</li>}
          {shown.map((suspect) => (
            <li key={suspect.id}>
              <button type="button" disabled={!!busy} onClick={async () => {
                setBusy(suspect.id);
                try {
                  await onAdd(suspect.id, role);
                } finally {
                  setBusy(null);
                }
              }} className="flex w-full min-w-0 items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-white/[0.05] disabled:opacity-60">
                <span className="size-9 shrink-0 overflow-hidden rounded-lg bg-white/[0.04] ring-1 ring-white/10">
                  {suspect.mugshot_url
                    ? <img src={getOptimizedAvatarUrl(suspect.mugshot_url, 72) ?? undefined} alt="" className="size-full object-cover"/>
                    : <span className="grid size-full place-items-center text-slate-500"><Users className="size-4"/></span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-slate-100">{suspect.full_name}</span>
                  <span className="block truncate text-[11px] text-slate-500">{[suspect.alias && `„${suspect.alias}”`, suspect.gang_affiliation].filter(Boolean).join(" · ")}</span>
                </span>
                {busy === suspect.id ? <Loader2 className="size-4 animate-spin text-slate-400"/> : <Plus className="size-4 text-slate-500"/>}
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
