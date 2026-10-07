import {useCallback, useEffect, useMemo, useState, type CSSProperties} from "react";
import {Link, useParams} from "react-router";
import {toast} from "sonner";
import {
  ArrowLeft, FileSignature, Gavel, Loader2, Lock, LockOpen, Mail, MessageSquareText, Mic, NotebookPen, Pencil, Printer, Save, Trash2, Unlink, UserPlus, X,
} from "lucide-react";
import {EmptyState} from "@/components/layout/EmptyState";
import {Button} from "@/components/ui/button";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Textarea} from "@/components/ui/textarea";
import {useConfirm} from "@/components/ConfirmDialog";
import {useAuth} from "@/context/AuthContext";
import {formatAgo, formatDate, formatDateTime} from "@/lib/datetime";
import {
  IAB_ENTRY_KINDS, IAB_OUTCOMES, IAB_PRIORITY, IAB_ROLES, IAB_TITLES, iabApi, type IabCaseDetail, type IabEntry, type IabEntryKind, type IabOutcome,
  type IabPerson, type IabRole,
} from "@/lib/iab";
import {useProfileDirectory} from "@/lib/profile-directory";
import {cn, errorMessage} from "@/lib/utils";
import {CaseDialog} from "./components/CaseDialog";

const KIND_ICON: Record<IabEntryKind, typeof NotebookPen> = {memo: FileSignature, interview: Mic, note: MessageSquareText};

/**
 * One investigation: the members it concerns, the memos, interviews and internal notes in time
 * order, the linked letters and the IAB's closure.
 */
export function IabCasePage() {
  const {caseId = ""} = useParams<{caseId: string}>();
  const [data, setData] = useState<IabCaseDetail | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [members, setMembers] = useState<IabPerson[]>([]);
  const [editing, setEditing] = useState(false);
  const [closing, setClosing] = useState(false);
  const confirm = useConfirm();

  const load = useCallback(() => iabApi.detail(caseId).then((next) => {
    setData(next);
    setFailed(null);
  }, (error) => setFailed(errorMessage(error, "A vizsgálat nem tölthető be."))), [caseId]);

  useEffect(() => {
    let active = true;
    iabApi.detail(caseId).then((next) => active && setData(next), (error) => active && setFailed(errorMessage(error, "A vizsgálat nem tölthető be.")));
    iabApi.overview().then((overview) => active && setMembers(overview.members), () => undefined);
    return () => {
      active = false;
    };
  }, [caseId]);

  if (failed) return <div className="mx-auto max-w-3xl pt-10"><div className="panel"><EmptyState icon={Gavel} title={failed}/></div></div>;
  if (!data) return <div className="flex justify-center py-24"><Loader2 className="size-8 animate-spin text-slate-500"/></div>;

  const item = data.case;
  const outcome = item.outcome ? IAB_OUTCOMES[item.outcome] : null;

  const reopen = async () => {
    if (!(await confirm({title: "Újranyitod a vizsgálatot?", description: "A lezárás (eredmény és indoklás) törlődik.", confirmLabel: "Újranyitás"}))) return;
    try {
      await iabApi.reopen(item.id);
      toast.success("A vizsgálat újra nyitott.");
      await load();
    } catch (error) {
      toast.error(errorMessage(error, "Az újranyitás nem sikerült."));
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" asChild><Link to="/iab"><ArrowLeft/> Belső vizsgálatok</Link></Button>
        <div className="ml-auto flex flex-wrap gap-2">
          {data.can_edit && <Button variant="outline" onClick={() => setEditing(true)}><Pencil/> Szerkesztés</Button>}
          <Button variant="outline" asChild><Link to={`/iab/case/${item.id}/print`}><Printer/> Nyomtatás</Link></Button>
          {data.can_close && item.status === "open" && (
            <Button className="bg-fuchsia-600 text-white hover:bg-fuchsia-500" onClick={() => setClosing(true)}><Lock/> Lezárás</Button>
          )}
          {data.can_close && item.status === "closed" && <Button variant="outline" onClick={() => void reopen()}><LockOpen/> Újranyitás</Button>}
        </div>
      </div>

      <header className="panel relative overflow-hidden p-6">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-fuchsia-500/10 blur-3xl"/>
        <div className="relative flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-fuchsia-300">{item.case_number}</span>
          <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1", IAB_PRIORITY[item.priority].chip)}>{IAB_PRIORITY[item.priority].label}</span>
          {outcome ? (
            <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1", outcome.tone)}><outcome.icon className="size-3"/> {outcome.label}</span>
          ) : <span className="rounded-md bg-fuchsia-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-fuchsia-200 ring-1 ring-fuchsia-500/30">Folyamatban</span>}
        </div>
        <h1 className="relative mt-2 text-2xl font-semibold tracking-tight wrap-anywhere text-white">{item.title}</h1>
        {item.summary && <p className="relative mt-2 max-w-3xl text-sm whitespace-pre-wrap wrap-anywhere text-slate-300">{item.summary}</p>}
        <p className="relative mt-3 text-xs text-slate-500">
          Megnyitotta {item.opened_by?.full_name ?? "–"}, {formatDate(item.opened_at)} · Vezeti: {item.lead ? `${item.lead.full_name}${item.lead.iab_title ? ` (${IAB_TITLES[item.lead.iab_title]})` : ""}` : "nincs kijelölve"}
        </p>
      </header>

      {item.status === "closed" && outcome && (
        <section className={cn("panel relative overflow-hidden p-5 ring-1", outcome.tone.split(" ").find((token) => token.startsWith("ring-")))}>
          <p className="flex items-center gap-2 text-sm font-semibold text-white"><outcome.icon className="size-4"/> Lezárva: {outcome.label}</p>
          <p className="text-xs text-slate-500">{outcome.text} · {item.closed_by?.full_name ?? "–"}, {item.closed_at ? formatDateTime(item.closed_at) : ""}</p>
          <p className="mt-3 text-sm whitespace-pre-wrap wrap-anywhere text-slate-200">{item.closure}</p>
        </section>
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0 space-y-4">
          <h2 className="text-sm font-semibold tracking-wide text-slate-300 uppercase">Iratok</h2>
          {data.entries.length === 0 ? (
            <div className="panel"><EmptyState icon={NotebookPen} title="Még nincs bejegyzés" description="Feljegyzés, meghallgatás vagy belső megjegyzés."/></div>
          ) : (
            <ol className="relative space-y-3 before:absolute before:inset-y-2 before:left-[19px] before:w-px before:bg-white/10">
              {data.entries.map((entry, index) => <EntryCard key={entry.id} entry={entry} index={index} caseId={item.id} canEdit={data.can_edit} onChanged={load}/>)}
            </ol>
          )}
          {data.can_edit && <EntryComposer caseId={item.id} onSaved={load}/>}
        </section>

        <aside className="space-y-4">
          <PeoplePanel data={data} onChanged={load}/>
          <MailPanel data={data} onChanged={load}/>
        </aside>
      </div>

      {editing && (
        <CaseDialog members={members} editing={{id: item.id, title: item.title, summary: item.summary, priority: item.priority, lead: item.lead}}
                    onOpenChange={setEditing} onSaved={() => void load()}/>
      )}
      {closing && <CloseDialog caseId={item.id} onOpenChange={setClosing} onClosed={() => void load()}/>}
    </div>
  );
}

function EntryCard({entry, index, caseId, canEdit, onChanged}: {entry: IabEntry; index: number; caseId: string; canEdit: boolean; onChanged: () => Promise<void>}) {
  const Icon = KIND_ICON[entry.kind];
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(entry.body);
  const [title, setTitle] = useState(entry.title ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await iabApi.saveEntry(caseId, {id: entry.id, kind: entry.kind, title: title.trim() || null, body});
      setEditing(false);
      await onChanged();
    } catch (error) {
      toast.error(errorMessage(error, "A mentés nem sikerült."));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!(await confirm({title: "Törlöd a bejegyzést?", confirmLabel: "Törlés", destructive: true, kind: "delete"}))) return;
    try {
      await iabApi.deleteEntry(entry.id);
      await onChanged();
    } catch (error) {
      toast.error(errorMessage(error, "A törlés nem sikerült."));
    }
  };

  return (
    <li style={{"--i": index} as CSSProperties} className="animate-rise relative flex gap-3">
      <span className={cn("relative z-10 grid size-10 shrink-0 place-items-center rounded-xl ring-1",
        entry.kind === "note" ? "bg-slate-800 text-slate-300 ring-white/10" : entry.kind === "interview" ? "bg-sky-950 text-sky-300 ring-sky-500/30" : "bg-fuchsia-950 text-fuchsia-300 ring-fuchsia-500/30")}>
        <Icon className="size-4"/>
      </span>
      <div className={cn("panel min-w-0 flex-1 p-4", entry.kind === "note" && "border-dashed")}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{IAB_ENTRY_KINDS[entry.kind].label}</span>
          <span className="min-w-0 text-[11px] wrap-anywhere text-slate-500" title={formatDateTime(entry.created_at)}>
            {entry.author?.full_name ?? "–"} · {formatAgo(entry.created_at)}{entry.updated_at !== entry.created_at ? " · szerkesztve" : ""}
          </span>
          {canEdit && entry.can_edit && !editing && (
            <span className="ml-auto flex gap-1">
              <Button size="icon-sm" variant="ghost" aria-label="Szerkesztés" onClick={() => setEditing(true)}><Pencil/></Button>
              <Button size="icon-sm" variant="ghost" aria-label="Törlés" onClick={() => void remove()}><Trash2/></Button>
            </span>
          )}
        </div>
        {editing ? (
          <div className="mt-2 space-y-2">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} placeholder="Cím (nem kötelező)"/>
            <Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={8} maxLength={20000}/>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}><X/> Mégse</Button>
              <Button size="sm" onClick={() => void save()} disabled={busy || !body.trim()}>{busy ? <Loader2 className="animate-spin"/> : <Save/>} Mentés</Button>
            </div>
          </div>
        ) : (
          <>
            {entry.title && <h3 className="mt-1 text-sm font-semibold wrap-anywhere text-white">{entry.title}</h3>}
            <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap wrap-anywhere text-slate-200">{entry.body}</p>
          </>
        )}
      </div>
    </li>
  );
}

function EntryComposer({caseId, onSaved}: {caseId: string; onSaved: () => Promise<void>}) {
  const [kind, setKind] = useState<IabEntryKind>("memo");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await iabApi.saveEntry(caseId, {id: null, kind, title: title.trim() || null, body});
      setTitle("");
      setBody("");
      await onSaved();
    } catch (error) {
      toast.error(errorMessage(error, "A bejegyzés nem menthető."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel space-y-3 p-4">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Bejegyzés típusa">
        {(Object.keys(IAB_ENTRY_KINDS) as IabEntryKind[]).map((key) => {
          const Icon = KIND_ICON[key];
          return (
            <button key={key} type="button" role="radio" aria-checked={kind === key} onClick={() => setKind(key)}
                    className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ring-1 transition",
                      kind === key ? "bg-fuchsia-500/15 text-white ring-fuchsia-400/40" : "text-slate-400 ring-white/10 hover:text-slate-100")}>
              <Icon className="size-3.5"/> {IAB_ENTRY_KINDS[key].label}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-500">{IAB_ENTRY_KINDS[kind].hint}</p>
      <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} placeholder="Cím (nem kötelező), pl. „Tájékoztatás a vizsgálat megkezdéséről”"/>
      <Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={7} maxLength={20000}
                placeholder={kind === "interview" ? "Időpont, jelenlévők, elhangzottak…" : "Tisztelt …!"}/>
      <div className="flex justify-end">
        <Button onClick={() => void save()} disabled={busy || !body.trim()}>{busy ? <Loader2 className="animate-spin"/> : <Save/>} Hozzáadás</Button>
      </div>
    </div>
  );
}

function PeoplePanel({data, onChanged}: {data: IabCaseDetail; onChanged: () => Promise<void>}) {
  const {profile} = useAuth();
  const {profiles} = useProfileDirectory();
  const [user, setUser] = useState("");
  const [role, setRole] = useState<IabRole>("subject");
  const [busy, setBusy] = useState(false);
  const candidates = useMemo(() => profiles.filter((member) => !data.people.some((person) => person.user_id === member.id)), [profiles, data.people]);

  const add = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await iabApi.setPerson(data.case.id, user, role);
      setUser("");
      await onChanged();
    } catch (error) {
      toast.error(errorMessage(error, "Nem sikerült hozzáadni."));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (userId: string) => {
    try {
      await iabApi.setPerson(data.case.id, userId, null);
      await onChanged();
    } catch (error) {
      toast.error(errorMessage(error, "Nem sikerült eltávolítani."));
    }
  };

  return (
    <section className="panel space-y-3 p-5">
      <h2 className="text-sm font-semibold text-white">Érintett tagok</h2>
      {data.people.length === 0 ? <p className="text-sm text-slate-500">Még senki.</p> : (
        <ul className="space-y-2">
          {data.people.map((person) => (
            <li key={person.user_id} className="flex min-w-0 items-center gap-2">
              <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1", IAB_ROLES[person.role].chip)}>{IAB_ROLES[person.role].label}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-slate-100">{person.person.full_name}
                <span className="text-xs text-slate-500"> · {person.person.faction_rank} #{person.person.badge_number}</span></span>
              {data.can_edit && (
                <Button size="icon-sm" variant="ghost" aria-label={`${person.person.full_name} eltávolítása`} onClick={() => void remove(person.user_id)}><X/></Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {data.can_edit && (
        <div className="space-y-2 border-t border-white/5 pt-3">
          <Select value={user} onValueChange={setUser}>
            <SelectTrigger className="h-9 w-full"><SelectValue placeholder="Tag hozzáadása…"/></SelectTrigger>
            <SelectContent>
              {candidates.filter((member) => member.id !== profile?.id || role !== "subject").map((member) => (
                <SelectItem key={member.id} value={member.id}>{member.full_name} · {member.faction_rank}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Select value={role} onValueChange={(value) => setRole(value as IabRole)}>
              <SelectTrigger className="h-9 min-w-0 flex-1"><SelectValue/></SelectTrigger>
              <SelectContent>{(Object.keys(IAB_ROLES) as IabRole[]).map((key) => <SelectItem key={key} value={key}>{IAB_ROLES[key].label}</SelectItem>)}</SelectContent>
            </Select>
            <Button disabled={!user || busy} onClick={() => void add()}>{busy ? <Loader2 className="animate-spin"/> : <UserPlus/>} Hozzáadás</Button>
          </div>
          <p className="text-[11px] text-slate-500">A vizsgált tag ezt a vizsgálatot nem látja, és nem kap róla értesítést.</p>
        </div>
      )}
    </section>
  );
}

function MailPanel({data, onChanged}: {data: IabCaseDetail; onChanged: () => Promise<void>}) {
  const unlink = async (threadId: string) => {
    try {
      await iabApi.linkMail(data.case.id, threadId, false);
      await onChanged();
    } catch (error) {
      toast.error(errorMessage(error, "Nem sikerült leválasztani."));
    }
  };
  return (
    <section className="panel space-y-3 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Mail className="size-4 text-indigo-300"/> Levelezés</h2>
      {data.mail.length === 0 ? (
        <p className="text-sm text-slate-500">Nincs csatolt levél. A Levelezésben a levél fölötti „Vizsgálathoz” gombbal csatolhatsz.</p>
      ) : (
        <ul className="space-y-1.5">
          {data.mail.map((thread) => (
            <li key={thread.thread_id} className="flex min-w-0 items-center gap-2">
              <Link to={`/mail?box=iab&thread=${thread.thread_id}`} className="min-w-0 flex-1 rounded-lg bg-white/[0.03] px-3 py-2 ring-1 ring-white/5 hover:bg-white/[0.06]">
                <p className="truncate text-sm text-slate-100">{thread.subject}</p>
                <p className="text-[11px] text-slate-500">{thread.message_count} levél · {formatAgo(thread.last_message_at)}</p>
              </Link>
              {data.can_edit && <Button size="icon-sm" variant="ghost" aria-label="Leválasztás" onClick={() => void unlink(thread.thread_id)}><Unlink/></Button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CloseDialog({caseId, onOpenChange, onClosed}: {caseId: string; onOpenChange: (open: boolean) => void; onClosed: () => void}) {
  const [outcome, setOutcome] = useState<IabOutcome>("not_sustained");
  const [closure, setClosure] = useState("");
  const [busy, setBusy] = useState(false);

  const close = async () => {
    if (closure.trim().length < 10) return toast.error("Írd le a lezárás indoklását (legalább 10 karakter).");
    setBusy(true);
    try {
      await iabApi.close(caseId, outcome, closure.trim());
      toast.success("A vizsgálat lezárva.");
      onClosed();
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error, "A lezárás nem sikerült."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>A vizsgálat lezárása</DialogTitle>
          <DialogDescription>Az IAB saját megállapítása; a nyomtatott iraton a lezáró aláírásával jelenik meg.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(Object.keys(IAB_OUTCOMES) as IabOutcome[]).map((key) => {
            const meta = IAB_OUTCOMES[key];
            return (
              <button key={key} type="button" onClick={() => setOutcome(key)} aria-pressed={outcome === key}
                      className={cn("flex min-w-0 items-start gap-2.5 rounded-xl p-3 text-left ring-1 transition",
                        outcome === key ? cn(meta.tone, "ring-2") : "bg-white/[0.02] ring-white/10 hover:bg-white/[0.05]")}>
                <meta.icon className="mt-0.5 size-4 shrink-0"/>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white">{meta.label}</span>
                  <span className="block text-[11px] text-slate-400">{meta.text}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="iab-closure">Indoklás, megállapítások, javasolt intézkedések</Label>
          <Textarea id="iab-closure" value={closure} onChange={(event) => setClosure(event.target.value)} rows={7} maxLength={8000}/>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Mégse</Button>
          <Button className="bg-fuchsia-600 text-white hover:bg-fuchsia-500" onClick={() => void close()} disabled={busy}>
            {busy ? <Loader2 className="animate-spin"/> : <Lock/>} Lezárás
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
