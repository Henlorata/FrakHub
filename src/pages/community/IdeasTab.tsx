import {useCallback, useEffect, useMemo, useState, type CSSProperties} from "react";
import {toast} from "sonner";
import {ChevronUp, Lightbulb, Loader2, MessageSquareReply, Plus, Trash2, X} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {EmptyState} from "@/components/layout/EmptyState";
import {MemberAvatar} from "@/components/MemberAvatar";
import {useConfirm} from "@/components/ConfirmDialog";
import {
  communityApi, SUGGESTION_CATEGORIES, SUGGESTION_STATUS, type Suggestion, type SuggestionCategory, type SuggestionStatus,
} from "@/lib/community";
import {formatAgo, formatDate} from "@/lib/datetime";
import {cn, errorMessage} from "@/lib/utils";
import type {Profile} from "@/types/supabase";

type Sort = "top" | "new";

/**
 * The suggestion board: anyone posts an idea (five a week), the others upvote it, the command
 * answers with a status (reviewing, planned, done, declined) and a short reply.
 */
export function IdeasTab({profile}: {profile: Profile}) {
  const [data, setData] = useState<{can_respond: boolean; suggestions: Suggestion[]} | null>(null);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState<SuggestionStatus | "open" | "all">("open");
  const [sort, setSort] = useState<Sort>("top");
  const [creating, setCreating] = useState(false);
  const [responding, setResponding] = useState<Suggestion | null>(null);
  const confirm = useConfirm();

  const load = useCallback(async () => {
    try {
      setData(await communityApi.suggestions());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => (data?.suggestions ?? [])
    .filter((item) => status === "all" || (status === "open" ? !["done", "declined"].includes(item.status) : item.status === status))
    .sort((a, b) => sort === "top" ? b.votes - a.votes || b.created_at.localeCompare(a.created_at) : b.created_at.localeCompare(a.created_at)),
  [data, status, sort]);

  const vote = async (item: Suggestion) => {
    // Optimistic: the arrow answers at once, the reply corrects it.
    setData((prev) => prev && {...prev, suggestions: prev.suggestions.map((entry) => entry.id === item.id
      ? {...entry, voted: !entry.voted, votes: entry.votes + (entry.voted ? -1 : 1)} : entry)});
    try {
      const result = await communityApi.toggleVote(item.id);
      setData((prev) => prev && {...prev, suggestions: prev.suggestions.map((entry) => entry.id === item.id ? {...entry, ...result} : entry)});
    } catch (error) {
      toast.error(errorMessage(error, "Nem sikerült."));
      void load();
    }
  };

  const remove = async (item: Suggestion) => {
    if (!(await confirm({title: "Ötlet törlése", description: `„${item.title}”`, confirmLabel: "Törlés", destructive: true, kind: "delete"}))) return;
    try {
      await communityApi.deleteSuggestion(item.id);
      await load();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  if (failed) return <EmptyState icon={X} title="Az ötletláda nem tölthető be." action={<Button variant="outline" onClick={() => void load()}>Újra</Button>}/>;
  if (!data) return <div className="space-y-3">{[0, 1, 2].map((index) => <div key={index} className="skeleton h-28"/>)}</div>;

  return (
    <div className="space-y-4" data-tour="community-ideas">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/10" role="tablist" aria-label="Szűrés">
          {([["open", "Nyitott"], ["planned", "Tervben"], ["done", "Megvalósult"], ["declined", "Elvetett"], ["all", "Mind"]] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={status === id} onClick={() => setStatus(id)}
                    className={cn("h-8 rounded-md px-3 text-xs font-medium transition-colors", status === id ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200")}>
              {label}
            </button>
          ))}
        </div>
        <Select value={sort} onValueChange={(value) => setSort(value as Sort)}>
          <SelectTrigger className="h-9 w-40 text-xs"><SelectValue/></SelectTrigger>
          <SelectContent><SelectItem value="top">Legtöbb szavazat</SelectItem><SelectItem value="new">Legújabb</SelectItem></SelectContent>
        </Select>
        <Button className="ml-auto" onClick={() => setCreating(true)}><Plus/> Új ötlet</Button>
      </div>

      {shown.length === 0 ? (
        <div className="panel"><EmptyState icon={Lightbulb} title="Ebben a nézetben nincs ötlet." description="Van egy ötleted, amitől jobb lenne a frakció? Írd meg!"/></div>
      ) : (
        <ul className="space-y-3">
          {shown.map((item, index) => {
            const own = item.author_id === profile.id;
            const canDelete = data.can_respond || (own && item.status === "new" && !item.responded_at);
            return (
              <li key={item.id} style={{"--i": Math.min(index, 10)} as CSSProperties} className="panel animate-rise flex gap-4 p-4">
                <button type="button" disabled={own} onClick={() => void vote(item)} aria-pressed={item.voted}
                        title={own ? "A saját ötletedre nem szavazhatsz" : item.voted ? "Szavazat visszavonása" : "Támogatom"}
                        aria-label={`${own ? "A saját ötletedre nem szavazhatsz" : item.voted ? "Szavazat visszavonása" : "Támogatom"} (${item.votes} szavazat)`}
                        className={cn("flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-xl ring-1 transition-all disabled:cursor-default",
                          item.voted ? "bg-primary/15 text-primary ring-primary/40" : "bg-white/[0.03] text-slate-300 ring-white/10 enabled:hover:bg-white/[0.07] enabled:hover:text-white")}>
                  <ChevronUp className={cn("size-5 transition-transform", item.voted && "-translate-y-0.5")}/>
                  <span className="text-base font-semibold tabular-nums">{item.votes}</span>
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="min-w-0 text-sm font-semibold wrap-anywhere text-white">{item.title}</h3>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1", SUGGESTION_STATUS[item.status].tone)}>{SUGGESTION_STATUS[item.status].label}</span>
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400 ring-1 ring-white/10">{SUGGESTION_CATEGORIES[item.category]}</span>
                  </div>
                  <p className="mt-1.5 text-sm whitespace-pre-wrap wrap-anywhere text-slate-300">{item.body}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    {item.author && (
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <MemberAvatar name={item.author.full_name} avatarUrl={item.author.avatar_url} size={18}/><span className="min-w-0 wrap-anywhere">{item.author.full_name}</span>
                      </span>
                    )}
                    <span>· {formatAgo(item.created_at)}</span>
                    {data.can_respond && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setResponding(item)}><MessageSquareReply/> Válasz</Button>}
                    {canDelete && <Button size="icon-sm" variant="ghost" title="Törlés" className="hover:text-red-300" onClick={() => void remove(item)}><Trash2/></Button>}
                  </div>
                  {item.response && (
                    <div className="mt-3 rounded-xl bg-emerald-500/[0.06] p-3 text-sm ring-1 ring-emerald-500/20">
                      <p className="text-[11px] font-semibold tracking-wide text-emerald-300 uppercase">A vezetőség válasza</p>
                      <p className="mt-1 whitespace-pre-wrap wrap-anywhere text-slate-200">{item.response}</p>
                      <p className="mt-1 text-[11px] wrap-anywhere text-slate-500">{item.responded_by_name ?? ""}{item.responded_at ? ` · ${formatDate(item.responded_at)}` : ""}</p>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <NewIdeaDialog open={creating} onOpenChange={setCreating} onCreated={async () => {
        setCreating(false);
        await load();
      }}/>
      <RespondDialog item={responding} onOpenChange={(open) => !open && setResponding(null)} onDone={async () => {
        setResponding(null);
        await load();
      }}/>
    </div>
  );
}

function NewIdeaDialog({open, onOpenChange, onCreated}: {open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => Promise<void>}) {
  const [form, setForm] = useState({title: "", body: "", category: "general" as SuggestionCategory});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setForm({title: "", body: "", category: "general"});
  }, [open]);
  const save = async () => {
    setSaving(true);
    try {
      await communityApi.suggest(form.title.trim(), form.body.trim(), form.category);
      toast.success("Ötlet beküldve.", {description: "A tagok szavazhatnak rá, a vezetőség válaszol."});
      await onCreated();
    } catch (error) {
      toast.error(errorMessage(error, "Nem sikerült beküldeni."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Új ötlet</DialogTitle>
          <DialogDescription>Hetente legfeljebb öt ötletet küldhetsz be. A neved látszik mellette.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_170px]">
          <div className="space-y-1">
            <Label htmlFor="idea-title">Cím</Label>
            <Input id="idea-title" maxLength={120} value={form.title} onChange={(event) => setForm((prev) => ({...prev, title: event.target.value}))}
                   placeholder="Például: Havi közös lőtéri edzés"/>
          </div>
          <div className="space-y-1">
            <Label>Téma</Label>
            <Select value={form.category} onValueChange={(value) => setForm((prev) => ({...prev, category: value as SuggestionCategory}))}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>{(Object.keys(SUGGESTION_CATEGORIES) as SuggestionCategory[]).map((key) => <SelectItem key={key} value={key}>{SUGGESTION_CATEGORIES[key]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="idea-body">Leírás</Label>
          <Textarea id="idea-body" rows={5} maxLength={2000} value={form.body} onChange={(event) => setForm((prev) => ({...prev, body: event.target.value}))}
                    placeholder="Mi a gond most, és mitől lenne jobb?"/>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button disabled={saving || form.title.trim().length < 5 || form.body.trim().length < 10} onClick={() => void save()}>
            {saving ? <Loader2 className="animate-spin"/> : <Lightbulb/>} Beküldés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RespondDialog({item, onOpenChange, onDone}: {item: Suggestion | null; onOpenChange: (open: boolean) => void; onDone: () => Promise<void>}) {
  const [status, setStatus] = useState<SuggestionStatus>("reviewing");
  const [response, setResponse] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!item) return;
    setStatus(item.status === "new" ? "reviewing" : item.status);
    setResponse(item.response ?? "");
  }, [item]);
  const save = async () => {
    if (!item) return;
    setSaving(true);
    try {
      await communityApi.respond(item.id, status, response.trim() || null);
      toast.success("Válasz elküldve.", {description: "A beküldő értesítést kapott."});
      await onDone();
    } catch (error) {
      toast.error(errorMessage(error, "Nem sikerült."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Válasz az ötletre</DialogTitle>
          <DialogDescription className="wrap-anywhere">{item?.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label>Állapot</Label>
          <Select value={status} onValueChange={(value) => setStatus(value as SuggestionStatus)}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>{(Object.keys(SUGGESTION_STATUS) as SuggestionStatus[]).map((key) => <SelectItem key={key} value={key}>{SUGGESTION_STATUS[key].label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="idea-response">Válasz</Label>
          <Textarea id="idea-response" rows={4} maxLength={1000} value={response} onChange={(event) => setResponse(event.target.value)}
                    placeholder="Például: novembertől havonta lesz, az első időpont a naptárban."/>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button disabled={saving} onClick={() => void save()}>{saving ? <Loader2 className="animate-spin"/> : <MessageSquareReply/>} Küldés</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
