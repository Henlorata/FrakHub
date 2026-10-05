import {useCallback, useEffect, useMemo, useState} from "react";
import {useNavigate} from "react-router";
import {
  ArrowRight, Car, Check, FileText, FolderOpen, Home, Link2, Loader2, Lock, MapPin, Network, Pencil, Plus, Trash2, X,
} from "lucide-react";
import {toast} from "sonner";
import {Dialog, DialogContent, DialogDescription, DialogTitle} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger} from "@/components/ui/dropdown-menu";
import {LicensePlate} from "@/components/fleet/LicensePlate";
import {useAuth} from "@/context/AuthContext";
import {deleteCloudinaryAssets, uploadToCloudinary} from "@/lib/cloudinary";
import {formatAgo, formatDate} from "@/lib/datetime";
import {PROPERTY_TYPE, SUSPECT_STATUS, SUSPECT_STATUSES, mcbApi, type SuspectDossier} from "@/lib/mcb";
import {canViewCaseList, cn, errorMessage} from "@/lib/utils";
import type {CaseWarrant, Suspect, SuspectStatus} from "@/types/supabase";
import {CaseStatusChip, InvolvementChip, Mugshot, SuspectStatusChip} from "./McbBadges";
import {GENDERS, MugshotPicker} from "./NewSuspectDialog";
import {WarrantCard} from "./WarrantCard";
import {WarrantDocument} from "./WarrantDocument";

type Tab = "profile" | "cases" | "warrants" | "network" | "assets";

const fold = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

interface SuspectDetailDialogProps {
  suspectId: string | null;
  onOpenChange: (open: boolean) => void;
  /** The person's data changed (the register refreshes its cache). */
  onChanged: () => void;
  /** Other registered persons (connection picker). */
  people: Suspect[];
  onOpenPerson: (id: string) => void;
}

/** A person's file: photo, data, cases, warrants, connections, vehicles and properties. */
export function SuspectDetailDialog({suspectId, onOpenChange, onChanged, people, onOpenPerson}: SuspectDetailDialogProps) {
  const {supabase, profile} = useAuth();
  const navigate = useNavigate();
  const [dossier, setDossier] = useState<SuspectDossier | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("profile");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Suspect>>({});
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [warrantDoc, setWarrantDoc] = useState<CaseWarrant | null>(null);
  const canEdit = canViewCaseList(profile);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      setDossier(await mcbApi.dossier(id));
    } catch (error) {
      toast.error("Az adatlap betöltése nem sikerült.", {description: errorMessage(error)});
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }, [onOpenChange]);

  useEffect(() => {
    if (!suspectId) return;
    setDossier(null);
    setTab("profile");
    setEditing(false);
    setPhoto(null);
    void load(suspectId);
  }, [suspectId, load]);

  const person = dossier?.suspect;

  const startEdit = () => {
    if (!person) return;
    setForm({full_name: person.full_name, alias: person.alias, gender: person.gender, status: person.status,
      gang_affiliation: person.gang_affiliation, description: person.description});
    setPhoto(null);
    setEditing(true);
  };

  const save = async (changes: Partial<Suspect>, success = "Adatlap mentve.") => {
    if (!person) return false;
    setBusy(true);
    try {
      let mugshot = person.mugshot_url;
      if (photo) mugshot = await uploadToCloudinary(photo, "mugshot");
      const {error} = await supabase.from("suspects").update({...changes, mugshot_url: mugshot, updated_at: new Date().toISOString()})
        .eq("id", person.id);
      if (error) throw error;
      // The replaced photo is no longer referenced: removed in the background.
      if (photo && person.mugshot_url) void deleteCloudinaryAssets([person.mugshot_url]);
      toast.success(success);
      setEditing(false);
      setPhoto(null);
      await load(person.id);
      onChanged();
      return true;
    } catch (error) {
      toast.error("A mentés nem sikerült.", {description: errorMessage(error)});
      return false;
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!person) return;
    setBusy(true);
    try {
      const {data, error} = await supabase.rpc("delete_suspect_safely", {_suspect_id: person.id});
      if (error) throw error;
      const result = data as {success?: boolean; message?: string} | null;
      if (!result?.success) {
        toast.error(result?.message ?? "Az adatlap nem törölhető.");
        return;
      }
      if (person.mugshot_url) void deleteCloudinaryAssets([person.mugshot_url]);
      toast.success(result.message ?? "Adatlap törölve.");
      onChanged();
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
      setDeleting(false);
    }
  };

  /** Runs a change of a vehicle, property or connection, then reloads the file. */
  const mutate = async (operation: PromiseLike<{error: unknown}>, success?: string) => {
    const {error} = await operation;
    if (error) {
      toast.error("A művelet nem sikerült.", {description: errorMessage(error)});
      return false;
    }
    if (success) toast.success(success);
    if (person) await load(person.id);
    return true;
  };

  const activeWarrants = dossier?.warrants.filter((item) => item.status === "approved").length ?? 0;
  const tabs: {value: Tab; label: string; count?: number}[] = [
    {value: "profile", label: "Adatlap"},
    {value: "cases", label: "Akták", count: dossier?.cases.length},
    {value: "warrants", label: "Parancsok", count: dossier?.warrants.length},
    {value: "network", label: "Kapcsolatok", count: dossier ? dossier.associates.length + dossier.linked_by.length : undefined},
    {value: "assets", label: "Járművek, ingatlanok", count: dossier ? dossier.vehicles.length + dossier.properties.length : undefined},
  ];

  return (
    <Dialog open={!!suspectId} onOpenChange={(open) => !busy && onOpenChange(open)}>
      <DialogContent className="flex h-[min(860px,94dvh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogTitle className="sr-only">{person?.full_name ?? "Személy adatlapja"}</DialogTitle>
        <DialogDescription className="sr-only">Nyilvántartási adatlap</DialogDescription>
        {loading && !dossier ? (
          <div className="flex flex-1 items-center justify-center"><Loader2 className="size-7 animate-spin text-slate-500"/></div>
        ) : person && dossier ? (
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            {/* Identity column */}
            <aside className="relative flex shrink-0 flex-col items-center gap-3 overflow-y-auto border-b border-white/10 bg-gradient-to-b from-slate-900/80 to-[#060a14] p-5 md:w-72 md:border-r md:border-b-0">
              <div aria-hidden className={cn("pointer-events-none absolute -top-16 left-1/2 size-56 -translate-x-1/2 rounded-full opacity-30 blur-3xl",
                SUSPECT_STATUS[person.status]?.dot ?? "bg-slate-500")}/>
              {editing ? (
                <MugshotPicker file={photo} url={person.mugshot_url} onFile={setPhoto} size={150}/>
              ) : (
                <div className="relative">
                  <Mugshot url={person.mugshot_url} name={person.full_name} status={person.status} size={150} rounded="rounded-2xl"
                           className="!h-[188px]"/>
                  {person.status === "wanted" && (
                    <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-black tracking-[0.2em] text-white uppercase shadow-lg">
                      Körözött
                    </span>
                  )}
                </div>
              )}
              <div className="relative text-center">
                <h2 className="text-lg leading-tight font-semibold text-white wrap-anywhere">{person.full_name}</h2>
                {person.alias && <p className="text-sm text-slate-400 italic">„{person.alias}”</p>}
              </div>
              {canEdit && !editing ? (
                <DropdownMenu>
                  <DropdownMenuTrigger className="rounded-full outline-none" aria-label="Státusz módosítása">
                    <SuspectStatusChip status={person.status} className="cursor-pointer hover:brightness-125"/>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuLabel>Státusz</DropdownMenuLabel>
                    {SUSPECT_STATUSES.map((value) => (
                      <DropdownMenuItem key={value} onSelect={() => value !== person.status && void save({status: value}, "Státusz módosítva.")}>
                        <span className={cn("size-2 rounded-full", SUSPECT_STATUS[value].dot)}/>{SUSPECT_STATUS[value].label}
                        {person.status === value && <Check className="ml-auto size-3.5"/>}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : <SuspectStatusChip status={person.status}/>}
              <dl className="relative mt-1 grid w-full grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs">
                <dt className="text-slate-500">Szervezet</dt><dd className="truncate text-right text-slate-200">{person.gang_affiliation || "–"}</dd>
                <dt className="text-slate-500">Nem</dt><dd className="text-right text-slate-200">{GENDERS.find((item) => item.value === person.gender)?.label ?? "–"}</dd>
                <dt className="text-slate-500">Akták</dt><dd className="text-right text-slate-200">{dossier.cases.length}</dd>
                <dt className="text-slate-500">Érvényes parancs</dt>
                <dd className={cn("text-right", activeWarrants > 0 ? "font-semibold text-red-300" : "text-slate-200")}>{activeWarrants}</dd>
                <dt className="text-slate-500">Felvette</dt><dd className="truncate text-right text-slate-200">{dossier.creator_name ?? "–"}</dd>
                <dt className="text-slate-500">Frissítve</dt><dd className="text-right text-slate-200">{formatAgo(person.updated_at ?? person.created_at)}</dd>
              </dl>
              {canEdit && !editing && (
                <div className="relative mt-auto flex w-full flex-col gap-2 pt-3">
                  <Button variant="outline" size="sm" onClick={startEdit}><Pencil className="size-4"/> Adatok szerkesztése</Button>
                  <Button variant="ghost" size="sm" className="text-red-300 hover:bg-red-500/10 hover:text-red-200" onClick={() => setDeleting(true)}>
                    <Trash2 className="size-4"/> Adatlap törlése
                  </Button>
                </div>
              )}
            </aside>

            {/* Tabs */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 px-3 pt-3 pr-12">
                {tabs.map((item) => (
                  <button key={item.value} type="button" onClick={() => setTab(item.value)}
                          className={cn("relative h-9 shrink-0 rounded-t-lg px-3 text-sm transition",
                            tab === item.value ? "bg-white/[0.06] text-white" : "text-slate-400 hover:text-slate-200")}>
                    {item.label}{item.count ? <span className="ml-1.5 text-[11px] text-slate-500">{item.count}</span> : null}
                    {tab === item.value && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-red-400"/>}
                  </button>
                ))}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {tab === "profile" && (editing ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="dossier-name">Teljes név</Label>
                        <Input id="dossier-name" value={form.full_name ?? ""} maxLength={120} onChange={(event) => setForm({...form, full_name: event.target.value})}/>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="dossier-alias">Álnév</Label>
                        <Input id="dossier-alias" value={form.alias ?? ""} maxLength={80} onChange={(event) => setForm({...form, alias: event.target.value})}/>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="dossier-gang">Szervezet / banda</Label>
                        <Input id="dossier-gang" value={form.gang_affiliation ?? ""} maxLength={80}
                               onChange={(event) => setForm({...form, gang_affiliation: event.target.value})}/>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Nem</Label>
                        <select value={form.gender ?? "male"} onChange={(event) => setForm({...form, gender: event.target.value})}
                                className="h-10 w-full rounded-lg border bg-white/[0.03] px-3 text-sm text-slate-200">
                          {GENDERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Státusz</Label>
                        <select value={form.status ?? "free"} onChange={(event) => setForm({...form, status: event.target.value as SuspectStatus})}
                                className="h-10 w-full rounded-lg border bg-white/[0.03] px-3 text-sm text-slate-200">
                          {SUSPECT_STATUSES.map((value) => <option key={value} value={value}>{SUSPECT_STATUS[value].label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="dossier-description">Személyleírás, ismertetőjelek</Label>
                      <Textarea id="dossier-description" value={form.description ?? ""} rows={8} maxLength={4000}
                                onChange={(event) => setForm({...form, description: event.target.value})}/>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => setEditing(false)} disabled={busy}>Mégse</Button>
                      <Button onClick={() => void save({
                        full_name: (form.full_name ?? "").trim() || person.full_name, alias: form.alias?.trim() || null, gender: form.gender ?? null,
                        status: form.status ?? person.status, gang_affiliation: form.gang_affiliation?.trim() || null,
                        description: form.description?.trim() || null,
                      })} disabled={busy} className="bg-red-600 text-white hover:bg-red-500">
                        {busy && <Loader2 className="size-4 animate-spin"/>} Mentés
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <section>
                      <h3 className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Személyleírás</h3>
                      {person.description ? (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-200 wrap-anywhere">{person.description}</p>
                      ) : <p className="text-sm text-slate-500 italic">Nincs személyleírás.</p>}
                    </section>
                    {dossier.cases.length > 0 && (
                      <section>
                        <h3 className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Legutóbbi akták</h3>
                        <ul className="space-y-1.5">
                          {dossier.cases.slice(0, 3).map((item) => (
                            <li key={item.link_id} className="flex items-center gap-2 text-sm text-slate-300">
                              <FolderOpen className="size-4 text-slate-500"/>
                              <span className="font-mono text-xs text-sky-300">{item.case_number}</span>
                              <span className="truncate">{item.title}</span>
                              <InvolvementChip value={item.involvement_type} className="ml-auto"/>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                  </div>
                ))}

                {tab === "cases" && (
                  dossier.cases.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">Egyetlen aktában sem szerepel.</p> : (
                    <ul className="space-y-2">
                      {dossier.cases.map((item) => (
                        <li key={item.link_id}>
                          <button type="button" disabled={!item.can_open} onClick={() => {
                            onOpenChange(false);
                            navigate(`/mcb/case/${item.case_id}`);
                          }} className="lift flex w-full min-w-0 items-center gap-3 rounded-xl bg-white/[0.03] p-3 text-left ring-1 ring-white/10 disabled:cursor-not-allowed disabled:opacity-70">
                            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/5 text-slate-400">
                              {item.can_open ? <FileText className="size-4"/> : <Lock className="size-4"/>}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-white">{item.title}</span>
                              <span className="block text-[11px] text-slate-500">
                                <span className="font-mono text-sky-300/80">{item.case_number}</span> · csatolva {formatDate(item.added_at)}
                                {item.notes ? ` · ${item.notes}` : ""}
                              </span>
                            </span>
                            <InvolvementChip value={item.involvement_type}/>
                            <CaseStatusChip status={item.status}/>
                            {item.can_open && <ArrowRight className="size-4 text-slate-500"/>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )
                )}

                {tab === "warrants" && (
                  dossier.warrants.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">Nincs ismert parancs a személyre.</p> : (
                    <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                      {dossier.warrants.map((warrant) => (
                        <WarrantCard key={warrant.id} warrant={warrant} showCase onOpenDocument={setWarrantDoc} onAction={() => undefined}
                                     perms={{myId: profile?.id, canApprove: false, canEditCase: () => false, canManageCase: () => false}}/>
                      ))}
                    </div>
                  )
                )}

                {tab === "network" && (
                  <NetworkTab dossier={dossier} people={people} canEdit={canEdit} onOpenPerson={onOpenPerson}
                              onAdd={(associateId, relationship) => mutate(supabase.from("suspect_associates").insert({
                                suspect_id: person.id, associate_id: associateId, relationship, notes: null,
                              }), "Kapcsolat rögzítve.")}
                              onRemove={(id) => mutate(supabase.from("suspect_associates").delete().eq("id", id))}/>
                )}

                {tab === "assets" && (
                  <AssetsTab dossier={dossier} canEdit={canEdit}
                             onAddVehicle={(vehicle) => mutate(supabase.from("suspect_vehicles").insert({suspect_id: person.id, ...vehicle}), "Jármű rögzítve.")}
                             onRemoveVehicle={(id) => mutate(supabase.from("suspect_vehicles").delete().eq("id", id))}
                             onAddProperty={(property) => mutate(supabase.from("suspect_properties").insert({suspect_id: person.id, ...property}), "Ingatlan rögzítve.")}
                             onRemoveProperty={(id) => mutate(supabase.from("suspect_properties").delete().eq("id", id))}/>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <AlertDialog open={deleting} onOpenChange={(open) => !busy && setDeleting(open)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Adatlap törlése</AlertDialogTitle>
              <AlertDialogDescription>
                {person?.full_name} adatlapja véglegesen törlődik a járműveivel és ingatlanaival együtt. Aktához csatolt vagy érvényes
                paranccsal érintett személy nem törölhető; a saját felvételű adatlapodat törölheted, másokét az MCB vezetése.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Mégse</AlertDialogCancel>
              <AlertDialogAction disabled={busy} className="bg-red-600 text-white hover:bg-red-500" onClick={(event) => {
                event.preventDefault();
                void remove();
              }}>
                {busy && <Loader2 className="size-4 animate-spin"/>} Törlés
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <WarrantDocument warrant={warrantDoc} onClose={() => setWarrantDoc(null)}/>
      </DialogContent>
    </Dialog>
  );
}

function NetworkTab({dossier, people, canEdit, onOpenPerson, onAdd, onRemove}: {
  dossier: SuspectDossier;
  people: Suspect[];
  canEdit: boolean;
  onOpenPerson: (id: string) => void;
  onAdd: (associateId: string, relationship: string) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Suspect | null>(null);
  const [relationship, setRelationship] = useState("");
  const linked = useMemo(() => new Set([dossier.suspect.id, ...dossier.associates.map((item) => item.other_id)]), [dossier]);
  const matches = useMemo(() => {
    const term = fold(query.trim());
    if (!term) return [];
    return people.filter((item) => !linked.has(item.id) && (fold(item.full_name).includes(term) || fold(item.alias ?? "").includes(term))).slice(0, 8);
  }, [linked, people, query]);
  const links = [...dossier.associates, ...dossier.linked_by];

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-300"><Link2 className="size-3.5"/> Új kapcsolat</p>
          {picked ? (
            <form className="flex flex-wrap items-center gap-2" onSubmit={async (event) => {
              event.preventDefault();
              if (!relationship.trim()) return toast.error("Add meg a kapcsolat jellegét.");
              if (await onAdd(picked.id, relationship.trim())) {
                setPicked(null);
                setRelationship("");
                setQuery("");
              }
            }}>
              <span className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1 text-sm text-white">
                <Mugshot url={picked.mugshot_url} name={picked.full_name} status={picked.status} size={24} rounded="rounded-md"/>{picked.full_name}
                <button type="button" onClick={() => setPicked(null)} className="text-slate-400 hover:text-white" aria-label="Másik személy"><X className="size-3.5"/></button>
              </span>
              <Input value={relationship} autoFocus maxLength={80} onChange={(event) => setRelationship(event.target.value)}
                     placeholder="pl. testvér, üzlettárs, bandatag" className="h-9 min-w-48 flex-1"/>
              <Button type="submit" size="sm" className="h-9"><Plus className="size-4"/> Rögzítés</Button>
            </form>
          ) : (
            <div className="relative">
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Keress egy személyt a nyilvántartásban…" className="h-9"/>
              {matches.length > 0 && (
                <ul className="absolute inset-x-0 top-10 z-10 max-h-64 overflow-y-auto rounded-xl border bg-[#0b1220] p-1 shadow-xl">
                  {matches.map((item) => (
                    <li key={item.id}>
                      <button type="button" onClick={() => setPicked(item)} className="flex w-full items-center gap-2 rounded-lg p-1.5 text-left text-sm hover:bg-white/5">
                        <Mugshot url={item.mugshot_url} name={item.full_name} status={item.status} size={26} rounded="rounded-md"/>
                        <span className="truncate text-white">{item.full_name}</span>
                        {item.alias && <span className="truncate text-xs text-slate-500">„{item.alias}”</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
      {links.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Nincs rögzített kapcsolat.</p> : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {links.map((link) => (
            <li key={`${link.direction}-${link.id}`} className="group flex items-center gap-3 rounded-xl bg-white/[0.03] p-2.5 ring-1 ring-white/10">
              <button type="button" onClick={() => onOpenPerson(link.other_id)} className="shrink-0">
                <Mugshot url={link.person.mugshot_url} name={link.person.full_name} status={link.person.status} size={40}/>
              </button>
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => onOpenPerson(link.other_id)} className="block max-w-full truncate text-left text-sm font-medium text-white hover:text-red-200">
                  {link.person.full_name}
                </button>
                <p className="truncate text-[11px] text-amber-200/80">
                  <Network className="mr-1 inline size-3"/>{link.relationship}{link.direction === "in" && <span className="text-slate-500"> · az ő adatlapjáról</span>}
                </p>
              </div>
              {canEdit && link.direction === "out" && (
                <button type="button" onClick={() => void onRemove(link.id)} aria-label="Kapcsolat törlése"
                        className="rounded-md p-1 text-slate-500 opacity-0 transition group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-300">
                  <Trash2 className="size-3.5"/>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AssetsTab({dossier, canEdit, onAddVehicle, onRemoveVehicle, onAddProperty, onRemoveProperty}: {
  dossier: SuspectDossier;
  canEdit: boolean;
  onAddVehicle: (vehicle: {plate_number: string; vehicle_type: string; color: string | null; notes: string | null}) => Promise<boolean>;
  onRemoveVehicle: (id: string) => Promise<boolean>;
  onAddProperty: (property: {address: string; property_type: string; notes: string | null}) => Promise<boolean>;
  onRemoveProperty: (id: string) => Promise<boolean>;
}) {
  const [vehicle, setVehicle] = useState({plate: "", type: "", color: ""});
  const [property, setProperty] = useState({address: "", type: "house"});

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-400 uppercase"><Car className="size-4"/> Járművek</h3>
        {canEdit && (
          <form className="grid grid-cols-[110px_minmax(0,1fr)] gap-2 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10" onSubmit={async (event) => {
            event.preventDefault();
            if (!vehicle.plate.trim() || !vehicle.type.trim()) return toast.error("Rendszám és típus szükséges.");
            if (await onAddVehicle({plate_number: vehicle.plate.trim().toUpperCase(), vehicle_type: vehicle.type.trim(),
              color: vehicle.color.trim() || null, notes: null})) setVehicle({plate: "", type: "", color: ""});
          }}>
            <Input value={vehicle.plate} maxLength={12} onChange={(event) => setVehicle({...vehicle, plate: event.target.value})} placeholder="Rendszám"
                   className="h-9 font-mono uppercase"/>
            <Input value={vehicle.type} maxLength={60} onChange={(event) => setVehicle({...vehicle, type: event.target.value})} placeholder="Típus" className="h-9"/>
            <Input value={vehicle.color} maxLength={40} onChange={(event) => setVehicle({...vehicle, color: event.target.value})} placeholder="Szín"
                   className="col-span-2 h-9 sm:col-span-1"/>
            <Button type="submit" size="sm" className="h-9"><Plus className="size-4"/> Jármű</Button>
          </form>
        )}
        {dossier.vehicles.length === 0 ? <p className="text-sm text-slate-500">Nincs rögzített jármű.</p> : (
          <ul className="space-y-2">
            {dossier.vehicles.map((item) => (
              <li key={item.id} className="group flex items-center gap-3 rounded-xl bg-white/[0.03] p-2.5 ring-1 ring-white/10">
                <LicensePlate plate={item.plate_number} size="sm"/>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{item.vehicle_type}{item.color ? ` · ${item.color}` : ""}</span>
                {canEdit && (
                  <button type="button" onClick={() => void onRemoveVehicle(item.id)} aria-label="Jármű törlése"
                          className="rounded-md p-1 text-slate-500 opacity-0 transition group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-300">
                    <Trash2 className="size-3.5"/>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-400 uppercase"><Home className="size-4"/> Ingatlanok</h3>
        {canEdit && (
          <form className="flex flex-wrap gap-2 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10" onSubmit={async (event) => {
            event.preventDefault();
            if (!property.address.trim()) return toast.error("Add meg a címet.");
            if (await onAddProperty({address: property.address.trim(), property_type: property.type, notes: null})) setProperty({address: "", type: "house"});
          }}>
            <Input value={property.address} maxLength={160} onChange={(event) => setProperty({...property, address: event.target.value})}
                   placeholder="Cím" className="h-9 min-w-40 flex-1"/>
            <select value={property.type} onChange={(event) => setProperty({...property, type: event.target.value})}
                    className="h-9 rounded-lg border bg-white/[0.03] px-2 text-sm text-slate-200">
              {Object.entries(PROPERTY_TYPE).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <Button type="submit" size="sm" className="h-9"><Plus className="size-4"/> Ingatlan</Button>
          </form>
        )}
        {dossier.properties.length === 0 ? <p className="text-sm text-slate-500">Nincs rögzített ingatlan.</p> : (
          <ul className="space-y-2">
            {dossier.properties.map((item) => (
              <li key={item.id} className="group flex items-center gap-3 rounded-xl bg-white/[0.03] p-2.5 ring-1 ring-white/10">
                <MapPin className="size-4 shrink-0 text-amber-300"/>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-slate-200">{item.address}</span>
                  <span className="block text-[11px] text-slate-500">{PROPERTY_TYPE[item.property_type ?? ""] ?? item.property_type ?? "–"}</span>
                </span>
                {canEdit && (
                  <button type="button" onClick={() => void onRemoveProperty(item.id)} aria-label="Ingatlan törlése"
                          className="rounded-md p-1 text-slate-500 opacity-0 transition group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-300">
                    <Trash2 className="size-3.5"/>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

