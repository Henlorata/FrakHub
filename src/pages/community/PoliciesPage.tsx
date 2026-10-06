import {useCallback, useEffect, useMemo, useState, type CSSProperties} from "react";
import {useSearchParams} from "react-router";
import {toast} from "sonner";
import {
  Archive, ArchiveRestore, BookCheck, Check, CheckCheck, ChevronRight, Diff, FilePen, History, Loader2, Plus, ScrollText, Search, Send, Trash2,
  Users, X,
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Switch} from "@/components/ui/switch";
import {Textarea} from "@/components/ui/textarea";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {PageHeader} from "@/components/layout/PageHeader";
import {EmptyState} from "@/components/layout/EmptyState";
import {MemberAvatar} from "@/components/MemberAvatar";
import {DISCARD_CHANGES, useConfirm} from "@/components/ConfirmDialog";
import {TextDocumentEditor, TextDocumentReader} from "@/components/rich/TextDocument";
import {
  communityApi, diffLines, documentLines, POLICY_CATEGORIES, type PolicyCategory, type PolicyDetail, type PolicyDraft, type PolicyList,
  type PolicySummary,
} from "@/lib/community";
import {formatDate, formatDateTime} from "@/lib/datetime";
import {cn, errorMessage} from "@/lib/utils";

const fold = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const needsAck = (policy: Pick<PolicySummary, "requires_ack" | "status" | "version" | "my_ack_version">) =>
  policy.requires_ack && policy.status === "published" && policy.version > 0 && (policy.my_ack_version ?? 0) < policy.version;

/**
 * The faction's rules: published versions everyone reads, a "must read" flag with acknowledgement
 * tracking (who read the current version), the version history with a comparison, and a text-only
 * editor for the command (drafts are published as new versions).
 */
export function PoliciesPage() {
  const [params, setParams] = useSearchParams();
  const [list, setList] = useState<PolicyList | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const selectedId = params.get("id");
  const editing = params.get("edit") === "1" || params.get("new") === "1";
  const version = params.get("v") ? Number(params.get("v")) : null;

  const load = useCallback(async () => {
    try {
      setList(await communityApi.policies());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const select = (id: string | null, extra: Record<string, string> = {}) => {
    const next = new URLSearchParams();
    if (id) next.set("id", id);
    for (const [key, value] of Object.entries(extra)) next.set(key, value);
    setParams(next);
  };

  const policies = useMemo(() => {
    const term = fold(query.trim());
    return (list?.policies ?? []).filter((policy) => !term || fold(`${policy.title} ${policy.summary ?? ""}`).includes(term));
  }, [list, query]);
  const groups = useMemo(() => (Object.keys(POLICY_CATEGORIES) as PolicyCategory[])
    .map((category) => ({category, items: policies.filter((policy) => policy.category === category)}))
    .filter((group) => group.items.length > 0), [policies]);
  const toRead = (list?.policies ?? []).filter(needsAck);
  const current = selectedId ?? toRead[0]?.id ?? list?.policies.find((policy) => policy.status === "published")?.id ?? null;

  if (failed) return <EmptyState icon={X} title="A szabályzatok nem tölthetők be." action={<Button variant="outline" onClick={() => void load()}>Újra</Button>}/>;

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6">
      <PageHeader icon={ScrollText} tone="emerald" eyebrow="Közösség" title="Szabályzatok"
                  description="A frakció szabályai egy helyen. A kötelezőket olvasd el, és jelezd, hogy megismerted."
                  actions={list?.can_edit ? <Button onClick={() => select(null, {new: "1"})} data-tour="policy-new"><Plus/> Új szabályzat</Button> : undefined}/>

      {toRead.length > 0 && !editing && (
        <div className="panel animate-rise flex flex-wrap items-center gap-3 border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3">
          <BookCheck className="size-5 text-amber-300"/>
          <p className="min-w-0 flex-1 text-sm text-amber-50">
            <b>{toRead.length}</b> kötelező szabályzat vár rád: {toRead.slice(0, 3).map((policy) => policy.title).join(", ")}{toRead.length > 3 ? "…" : ""}
          </p>
          <Button size="sm" onClick={() => select(toRead[0].id)}>Elolvasom</Button>
        </div>
      )}

      {!list ? (
        <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]"><div className="skeleton h-96"/><div className="skeleton h-[32rem]"/></div>
      ) : list.policies.length === 0 && !editing ? (
        <div className="panel"><EmptyState icon={ScrollText} title="Még nincs szabályzat." description={list.can_edit ? "Az első szabályzatot az „Új szabályzat” gombbal írhatod meg." : undefined}/></div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="panel min-w-0 space-y-3 p-3 lg:sticky lg:top-20" data-tour="policy-list">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Keresés a szabályzatokban" className="pl-9"/>
            </div>
            <div className="max-h-[calc(100dvh-16rem)] space-y-4 overflow-y-auto pr-1">
              {groups.map((group) => (
                <section key={group.category}>
                  <h3 className="px-1 pb-1.5 text-[11px] font-semibold tracking-[0.16em] text-slate-500 uppercase">{POLICY_CATEGORIES[group.category]}</h3>
                  <ul className="space-y-1">
                    {group.items.map((policy, index) => (
                      <PolicyRow key={policy.id} policy={policy} index={index} active={policy.id === current && !params.get("new")} members={list.members}
                                 canEdit={list.can_edit} onOpen={() => select(policy.id)}/>
                    ))}
                  </ul>
                </section>
              ))}
              {groups.length === 0 && <p className="py-6 text-center text-xs text-slate-500">Nincs találat.</p>}
            </div>
          </aside>
          <div className="min-w-0">
            {params.get("new") === "1" && list.can_edit ? (
              <PolicyEditor key="new" policy={null} onCancel={() => select(null)} onSaved={async (id) => {
                await load();
                select(id);
              }}/>
            ) : current ? (
              <PolicyView key={`${current}-${version ?? "latest"}-${editing}`} id={current} version={version} canEdit={list.can_edit} editing={editing}
                          members={list.members}
                          onEdit={() => select(current, {edit: "1"})} onClose={() => select(current)} onVersion={(value) => select(current, value ? {v: String(value)} : {})}
                          onChanged={load} onDeleted={async () => {
                            await load();
                            select(null);
                          }}/>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function PolicyRow({policy, index, active, members, canEdit, onOpen}: {
  policy: PolicySummary;
  index: number;
  active: boolean;
  members: number;
  canEdit: boolean;
  onOpen: () => void;
}) {
  const unread = needsAck(policy);
  const read = policy.requires_ack && policy.version > 0 && (policy.my_ack_version ?? 0) >= policy.version;
  return (
    <li style={{"--i": Math.min(index, 8)} as CSSProperties} className="animate-fade">
      <button type="button" onClick={onOpen}
              className={cn("w-full rounded-xl px-3 py-2.5 text-left ring-1 transition-colors",
                active ? "bg-emerald-500/10 ring-emerald-500/30" : "bg-white/[0.02] ring-white/5 hover:bg-white/[0.05]")}>
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("min-w-0 flex-1 truncate text-sm font-medium", policy.status === "archived" ? "text-slate-500 line-through" : "text-slate-100")}>
            {policy.title}
          </span>
          {unread && <span className="size-2 shrink-0 rounded-full bg-amber-400 shadow-[0_0_8px_rgb(251_191_36/0.8)]" aria-label="Elolvasandó"/>}
          {read && <Check className="size-3.5 shrink-0 text-emerald-400" aria-label="Elolvastad"/>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
          {policy.status === "draft" ? <span className="text-sky-300">Piszkozat</span> : <span>v{policy.version}</span>}
          {policy.requires_ack && <span>· kötelező</span>}
          {canEdit && policy.draft_changes && policy.version > 0 && <span className="text-sky-300">· nem közzétett módosítás</span>}
          {canEdit && policy.requires_ack && policy.acknowledged !== null && policy.version > 0 && (
            <span>· {policy.acknowledged}/{members} elolvasta</span>
          )}
        </div>
      </button>
    </li>
  );
}

function PolicyView({id, version, canEdit, editing, members, onEdit, onClose, onVersion, onChanged, onDeleted}: {
  id: string;
  version: number | null;
  canEdit: boolean;
  editing: boolean;
  members: number;
  onEdit: () => void;
  onClose: () => void;
  onVersion: (version: number | null) => void;
  onChanged: () => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const [detail, setDetail] = useState<PolicyDetail | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [acking, setAcking] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [diffWith, setDiffWith] = useState<number | null>(null);
  const confirm = useConfirm();

  const load = useCallback(async () => {
    try {
      setDetail(await communityApi.policy(id, version));
    } catch (error) {
      setFailed(errorMessage(error, "A szabályzat nem tölthető be."));
    }
  }, [id, version]);

  useEffect(() => {
    void load();
  }, [load]);

  if (failed) return <div className="panel"><EmptyState icon={X} title={failed}/></div>;
  if (!detail) return <div className="skeleton h-[32rem]"/>;

  if (editing && canEdit) {
    return <PolicyEditor policy={detail} onCancel={onClose} onSaved={async () => {
      await onChanged();
      onClose();
    }}/>;
  }

  const latest = detail.shown_version === null || detail.shown_version === detail.version;
  const mustRead = detail.requires_ack && detail.status === "published" && detail.version > 0 && latest;
  const acknowledged = (detail.my_ack_version ?? 0) >= detail.version;
  // The working copy differs from the published version (compared on the latest version only).
  const hasDraft = canEdit && !!detail.draft && latest && (detail.version === 0 || detail.draft.title !== detail.title
    || (detail.draft.summary ?? "") !== (detail.summary ?? "") || detail.draft.requires_ack !== detail.requires_ack
    || JSON.stringify(detail.draft.body) !== JSON.stringify(detail.body));

  const acknowledge = async () => {
    setAcking(true);
    try {
      const result = await communityApi.acknowledge(detail.id);
      setDetail((prev) => prev && {...prev, my_ack_version: result.version});
      toast.success("Köszönjük! Rögzítettük, hogy elolvastad.");
      void onChanged();
    } catch (error) {
      toast.error(errorMessage(error, "Nem sikerült rögzíteni."));
    } finally {
      setAcking(false);
    }
  };

  const archive = async (archived: boolean) => {
    try {
      await communityApi.archivePolicy(detail.id, archived);
      toast.success(archived ? "Archiválva: a tagok nem látják." : "Visszaállítva.");
      await load();
      await onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const remove = async () => {
    if (!(await confirm({title: "Piszkozat törlése", description: `„${detail.title}”`, confirmLabel: "Törlés", destructive: true, kind: "delete"}))) return;
    try {
      await communityApi.deletePolicy(detail.id);
      toast.success("Piszkozat törölve.");
      await onDeleted();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <article className="panel animate-fade min-w-0 overflow-hidden p-0" data-tour="policy-reader">
      <header className="border-b border-white/5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-200 ring-1 ring-emerald-500/25">{POLICY_CATEGORIES[detail.category]}</span>
          {detail.status === "draft" && <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-sky-200 ring-1 ring-sky-500/25">Piszkozat</span>}
          {detail.status === "archived" && <span className="rounded-full bg-white/5 px-2 py-0.5 text-slate-400 ring-1 ring-white/10">Archivált</span>}
          {detail.requires_ack && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-200 ring-1 ring-amber-500/25">Kötelező elolvasni</span>}
        </div>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight wrap-anywhere text-white">{detail.title}</h2>
        {detail.summary && <p className="mt-1 text-sm wrap-anywhere text-slate-400">{detail.summary}</p>}
        <p className="mt-2 text-xs text-slate-500">
          {detail.shown_version ? <>v{detail.shown_version} · közzétéve {formatDate(detail.published_at)}{detail.published_by_name ? ` · ${detail.published_by_name}` : ""}</> : "Még nincs közzétéve"}
          {!latest && <> · <button type="button" onClick={() => onVersion(null)} className="text-emerald-300 hover:underline">a legújabb a v{detail.version}</button></>}
        </p>
        {canEdit && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onEdit}><FilePen/> Szerkesztés</Button>
            {hasDraft && <Button size="sm" onClick={() => setPublishing(true)}><Send/> Közzététel{detail.version > 0 ? ` (v${detail.version + 1})` : ""}</Button>}
            {detail.version > 0 && (detail.status === "archived"
              ? <Button size="sm" variant="ghost" onClick={() => void archive(false)}><ArchiveRestore/> Visszaállítás</Button>
              : <Button size="sm" variant="ghost" onClick={() => void archive(true)}><Archive/> Archiválás</Button>)}
            {detail.version === 0 && <Button size="sm" variant="ghost" className="hover:text-red-300" onClick={() => void remove()}><Trash2/> Törlés</Button>}
          </div>
        )}
      </header>

      {mustRead && (
        acknowledged ? (
          <div className="flex items-center gap-2 border-b border-white/5 bg-emerald-500/[0.06] px-5 py-3 text-sm text-emerald-100 sm:px-6">
            <CheckCheck className="size-4 text-emerald-300"/> Elolvastad és megértetted (v{detail.my_ack_version}).
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 border-b border-amber-500/20 bg-amber-500/[0.07] px-5 py-3 sm:px-6">
            <BookCheck className="size-5 text-amber-300"/>
            <p className="min-w-0 flex-1 text-sm text-amber-50">
              {detail.my_ack_version ? `Egy korábbi változatot (v${detail.my_ack_version}) már elolvastál; a v${detail.version} újra kéri.`
                : "Ezt a szabályzatot mindenkinek el kell olvasnia."}
              {detail.my_ack_version && (
                <button type="button" onClick={() => setDiffWith(detail.my_ack_version)} className="ml-1 text-amber-200 underline-offset-2 hover:underline">Mi változott?</button>
              )}
            </p>
            <Button size="sm" disabled={acking} onClick={() => void acknowledge()}>{acking ? <Loader2 className="animate-spin"/> : <Check/>} Elolvastam és megértettem</Button>
          </div>
        )
      )}

      <div className="px-2 py-4 sm:px-4">
        {detail.body.length > 0 ? <TextDocumentReader key={`${detail.id}-${detail.shown_version}`} content={detail.body}/>
          : <p className="px-4 py-10 text-center text-sm text-slate-500">Üres szabályzat.</p>}
      </div>

      {(detail.versions.length > 0 || (canEdit && detail.missing)) && (
        <footer className="grid grid-cols-1 gap-0 border-t border-white/5 md:grid-cols-2">
          {detail.versions.length > 0 && (
            <section className="p-5">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white"><History className="size-4 text-slate-400"/> Változatok</h3>
              <ol className="space-y-1.5">
                {detail.versions.map((entry) => (
                  <li key={entry.version} className="flex flex-wrap items-center gap-2 text-xs">
                    <button type="button" onClick={() => onVersion(entry.version === detail.version ? null : entry.version)}
                            className={cn("font-mono font-semibold hover:underline", entry.version === (detail.shown_version ?? detail.version) ? "text-emerald-300" : "text-slate-200")}>
                      v{entry.version}
                    </button>
                    <span className="min-w-0 wrap-anywhere text-slate-500">{formatDateTime(entry.published_at)}{entry.published_by_name ? ` · ${entry.published_by_name}` : ""}</span>
                    {entry.change_note && <span className="w-full wrap-anywhere text-slate-400">„{entry.change_note}”</span>}
                    {entry.version > 1 && (
                      <button type="button" onClick={() => setDiffWith(entry.version - 1)} className="inline-flex items-center gap-1 text-slate-400 hover:text-white">
                        <Diff className="size-3"/> eltérés a v{entry.version - 1}-hez
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}
          {canEdit && detail.missing && detail.requires_ack && detail.version > 0 && (
            <MissingReaders missing={detail.missing} members={members}/>
          )}
        </footer>
      )}

      <PublishDialog open={publishing} policy={detail} onOpenChange={setPublishing} onPublished={async () => {
        setPublishing(false);
        await load();
        await onChanged();
        onVersion(null);
      }}/>
      <VersionDiffDialog policy={detail} from={diffWith} onOpenChange={(open) => !open && setDiffWith(null)}/>
    </article>
  );
}

function MissingReaders({missing, members}: {missing: NonNullable<PolicyDetail["missing"]>; members: number}) {
  const [open, setOpen] = useState(false);
  const read = members - missing.length;
  const ratio = members ? read / members : 0;
  return (
    <section className="border-t border-white/5 p-5 md:border-t-0 md:border-l">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white"><Users className="size-4 text-slate-400"/> Ki olvasta el?</h3>
      <p className="text-xs text-slate-400"><b className="text-white tabular-nums">{read}</b> / {members} tag olvasta el a jelenlegi változatot.</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-[width] duration-700" style={{width: `${ratio * 100}%`}}/>
      </div>
      {missing.length > 0 && (
        <>
          <button type="button" onClick={() => setOpen((value) => !value)} className="mt-3 flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-white">
            <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")}/> Még nem olvasta: {missing.length}
          </button>
          {open && (
            <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
              {missing.map((member) => (
                <li key={member.user_id} className="flex items-center gap-2 text-xs text-slate-300">
                  <MemberAvatar name={member.full_name} avatarUrl={member.avatar_url} size={20}/>
                  <span className="min-w-0 flex-1 truncate">{member.full_name}</span>
                  <span className="text-slate-500">{member.faction_rank}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function PublishDialog({open, policy, onOpenChange, onPublished}: {
  open: boolean;
  policy: PolicyDetail;
  onOpenChange: (open: boolean) => void;
  onPublished: () => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setNote("");
  }, [open]);
  const draft = policy.draft ?? {requires_ack: policy.requires_ack};
  const publish = async () => {
    setBusy(true);
    try {
      const result = await communityApi.publishPolicy(policy.id, note.trim() || null);
      toast.success(`Közzétéve: v${result.version}.`, {description: draft.requires_ack ? "Mindenki értesítést kapott, hogy olvassa el." : undefined});
      await onPublished();
    } catch (error) {
      toast.error(errorMessage(error, "A közzététel nem sikerült."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Közzététel: v{policy.version + 1}</DialogTitle>
          <DialogDescription>
            {draft.requires_ack ? "Kötelező szabályzat: mindenki értesítést kap, és újra jeleznie kell, hogy elolvasta."
              : policy.version === 0 ? "Új szabályzat: mindenki értesítést kap." : "A tagok csendben a legújabb változatot látják."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="publish-note">Mi változott? (nem kötelező)</Label>
          <Input id="publish-note" maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Például: új szabály az üldözésekről"/>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button disabled={busy} onClick={() => void publish()}>{busy ? <Loader2 className="animate-spin"/> : <Send/>} Közzététel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VersionDiffDialog({policy, from, onOpenChange}: {policy: PolicyDetail; from: number | null; onOpenChange: (open: boolean) => void}) {
  const [lines, setLines] = useState<ReturnType<typeof diffLines> | null>(null);
  const to = from === null ? null : policy.versions.find((entry) => entry.version > from)?.version ?? policy.version;
  useEffect(() => {
    if (from === null || to === null) return;
    let active = true;
    setLines(null);
    // The version on screen is loaded already: only the other one is read.
    const load = (version: number) => (policy.shown_version === version ? Promise.resolve(policy) : communityApi.policy(policy.id, version));
    Promise.all([load(from), load(to)])
      .then(([before, after]) => active && setLines(diffLines(documentLines(before.body), documentLines(after.body))))
      .catch(() => active && setLines([]));
    return () => {
      active = false;
    };
  }, [policy, from, to]);
  const added = (lines ?? []).filter((line) => line.kind === "added").length;
  const removed = (lines ?? []).filter((line) => line.kind === "removed").length;
  const changes = [added > 0 && `${added} új`, removed > 0 && `${removed} törölt`].filter(Boolean).join(", ");
  return (
    <Dialog open={from !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Eltérések: v{from} → v{to}</DialogTitle>
          <DialogDescription>{lines === null ? "Összevetés…" : changes ? `Sorok: ${changes} (a módosított sor régi és új alakja is látszik).` : "A szöveg nem változott."}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto rounded-xl bg-black/20 p-3 font-mono text-xs leading-relaxed ring-1 ring-white/10">
          {lines === null ? <Loader2 className="mx-auto size-5 animate-spin text-slate-500"/> : lines.map((line, index) => (
            <p key={index} className={cn("px-2 whitespace-pre-wrap wrap-anywhere", line.kind === "added" ? "bg-emerald-500/10 text-emerald-200"
              : line.kind === "removed" ? "bg-red-500/10 text-red-200 line-through decoration-red-400/60" : "text-slate-500")}>
              <span className="mr-2 select-none text-slate-600">{line.kind === "added" ? "+" : line.kind === "removed" ? "−" : " "}</span>{line.text}
            </p>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PolicyEditor({policy, onCancel, onSaved}: {policy: PolicyDetail | null; onCancel: () => void; onSaved: (id: string) => Promise<void>}) {
  const confirm = useConfirm();
  const source = policy?.draft ?? (policy ? {title: policy.title, summary: policy.summary, body: policy.body, requires_ack: policy.requires_ack, category: policy.category}
    : null);
  const [form, setForm] = useState<PolicyDraft>({
    title: source?.title ?? "", category: source?.category ?? "general", summary: source?.summary ?? "", requires_ack: source?.requires_ack ?? false,
    body: source?.body ?? [],
  });
  // The editor only reads its initial content once (it is remounted for another policy).
  const [initialBody] = useState(() => source?.body ?? []);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const update = (patch: Partial<PolicyDraft>) => {
    setForm((prev) => ({...prev, ...patch}));
    setDirty(true);
  };
  const onBody = useCallback((body: unknown[]) => {
    setForm((prev) => ({...prev, body}));
    setDirty(true);
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const result = await communityApi.savePolicy(policy?.id ?? null, {...form, title: form.title.trim(), summary: form.summary?.trim() || null});
      toast.success(policy ? "Piszkozat mentve." : "Szabályzat létrehozva (piszkozat).", {description: "A tagok a közzététel után látják."});
      setDirty(false);
      await onSaved(result.id);
    } catch (error) {
      toast.error(errorMessage(error, "A mentés nem sikerült."));
    } finally {
      setSaving(false);
    }
  };
  const cancel = async () => {
    if (dirty && !(await confirm(DISCARD_CHANGES))) return;
    onCancel();
  };

  return (
    <div className="panel animate-fade min-w-0 space-y-4 p-5 sm:p-6" data-tour="policy-editor">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="min-w-0 flex-1 text-lg font-semibold text-white">{policy ? `Szerkesztés: ${policy.title}` : "Új szabályzat"}</h2>
        <Button variant="ghost" onClick={() => void cancel()}>Mégse</Button>
        <Button disabled={saving || form.title.trim().length < 3} onClick={() => void save()}>{saving ? <Loader2 className="animate-spin"/> : <Check/>} Mentés piszkozatként</Button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_200px]">
        <div className="space-y-1">
          <Label htmlFor="policy-title">Cím</Label>
          <Input id="policy-title" maxLength={120} value={form.title} onChange={(event) => update({title: event.target.value})} placeholder="Például: Járműhasználati szabályzat"/>
        </div>
        <div className="space-y-1">
          <Label>Témakör</Label>
          <Select value={form.category} onValueChange={(value) => update({category: value as PolicyCategory})}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>{(Object.keys(POLICY_CATEGORIES) as PolicyCategory[]).map((key) => <SelectItem key={key} value={key}>{POLICY_CATEGORIES[key]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="policy-summary">Rövid összefoglaló</Label>
        <Textarea id="policy-summary" rows={2} maxLength={300} value={form.summary ?? ""} onChange={(event) => update({summary: event.target.value})}
                  placeholder="Egy-két mondat: miről szól, kire vonatkozik."/>
      </div>
      <label className="flex items-start gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10">
        <Switch checked={form.requires_ack} onCheckedChange={(value) => update({requires_ack: value})}/>
        <span className="text-sm">
          <span className="font-medium text-white">Kötelező elolvasni</span>
          <span className="block text-xs text-slate-400">Közzétételkor mindenki értesítést kap, és jeleznie kell, hogy elolvasta. A vezetőség látja, ki nem olvasta még.</span>
        </span>
      </label>
      <TextDocumentEditor initial={initialBody} onChange={onBody}/>
      <p className="text-[11px] text-slate-500">Csak szöveg: címsorok, listák, táblázatok, idézetek. Kép nem tehető a szabályzatba.</p>
    </div>
  );
}
