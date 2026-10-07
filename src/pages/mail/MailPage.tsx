import {useCallback, useEffect, useMemo, useState, type CSSProperties} from "react";
import {Link, useSearchParams} from "react-router";
import {toast} from "sonner";
import {
  ArrowLeft, Copy, Eye, Inbox, Loader2, Mail, Megaphone, PenSquare, Printer, RefreshCw, Reply, Scale, Search, Send, ShieldAlert, X,
} from "lucide-react";
import {PageHeader} from "@/components/layout/PageHeader";
import {EmptyState} from "@/components/layout/EmptyState";
import {Button} from "@/components/ui/button";
import {Textarea} from "@/components/ui/textarea";
import {useAuth} from "@/context/AuthContext";
import {formatAgo, formatDateTime} from "@/lib/datetime";
import {canSeeIab} from "@/lib/iab";
import {
  MAIL_BOXES, mailApi, replySubject, type MailBox, type MailDirectory, type MailSearchHit, type MailSenderKind, type MailThread, type MailThreadItem,
} from "@/lib/mail";
import {useSignatures} from "@/lib/signature/api";
import {cn, errorMessage} from "@/lib/utils";
import {Letter} from "./Letter";
import {MailComposer, RecipientPicker, SenderSelect, toRecipient, type RecipientChip} from "./MailComposer";
import {LinkToCaseDialog} from "./LinkToCaseDialog";
import {PUBLIC_REPORT_KINDS} from "@/lib/public-reports";
import {Switch} from "@/components/ui/switch";
import {Input} from "@/components/ui/input";
import {ReceiptsDialog} from "./ReceiptsDialog";

const BOX_ICON: Record<MailBox, typeof Inbox> = {inbox: Inbox, sent: Send, all: Megaphone, iab: ShieldAlert};

/**
 * The department's mail: folders, the letters of a folder and a thread read as letters on paper,
 * answered at the bottom. Letters to everyone, to the IAB and the offices are threads that every
 * reader of that address follows.
 */
export function MailPage() {
  const {profile} = useAuth();
  const [params, setParams] = useSearchParams();
  const box = (MAIL_BOXES.some((item) => item.key === params.get("box")) ? params.get("box") : "inbox") as MailBox;
  const threadId = params.get("thread");
  const [items, setItems] = useState<MailThreadItem[] | null>(null);
  const [more, setMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [composing, setComposing] = useState(() => params.get("new") === "1");
  const [refreshing, setRefreshing] = useState(false);
  const [myAddress, setMyAddress] = useState<string | null>(null);
  const boxes = MAIL_BOXES.filter((item) => item.key !== "iab" || !!profile?.iab_title);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{query: string; hits: MailSearchHit[]} | null>(null);
  const searchTerm = query.trim();
  const searching = searchTerm.length >= 2;

  useEffect(() => {
    if (searchTerm.length < 2) return;
    let active = true;
    const timer = window.setTimeout(() => {
      mailApi.search(searchTerm).then((hits) => active && setFound({query: searchTerm, hits}),
        (error) => active && toast.error(errorMessage(error, "A keresés nem sikerült.")));
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [searchTerm]);
  const hits = searching && found?.query === searchTerm ? found.hits : null;

  const load = useCallback(async (target: MailBox) => {
    try {
      const list = await mailApi.mailbox(target);
      setItems(list);
      setMore(list.length >= 40);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    mailApi.mailbox(box).then((list) => {
      if (!active) return;
      setItems(list);
      setMore(list.length >= 40);
      setFailed(false);
    }, () => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [box]);

  useEffect(() => {
    mailApi.directory().then((directory) => setMyAddress(directory.me.address), () => undefined);
  }, []);

  // Back to the tab after a while: look again (no polling).
  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 60_000) void load(box);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [box, load]);

  const refresh = async () => {
    setRefreshing(true);
    await load(box);
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (!items?.length) return;
    try {
      const next = await mailApi.mailbox(box, items[items.length - 1].last_message_at);
      setItems([...items, ...next]);
      setMore(next.length >= 40);
    } catch (error) {
      toast.error(errorMessage(error, "A régebbi levelek nem tölthetők be."));
    }
  };

  const open = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("thread", id);
    else next.delete("thread");
    setParams(next);
  };
  const switchBox = (key: MailBox) => {
    if (key === box) return;
    setItems(null);
    setParams({box: key});
  };

  const markRead = useCallback((id: string) => {
    setItems((current) => current?.map((item) => (item.id === id ? {...item, unread: false} : item)) ?? current);
  }, []);

  const copyAddress = async () => {
    if (!myAddress) return;
    try {
      await navigator.clipboard.writeText(myAddress);
      toast.success("A címed a vágólapra került.");
    } catch {
      toast.error("A másolás nem sikerült.");
    }
  };

  const unread = items?.filter((item) => item.unread).length ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-6 pb-10">
      <PageHeader icon={Mail} tone="indigo" eyebrow="Belső posta · sfsd.org" title="Levelezés"
                  description="Levelek tagoknak és csoportcímeknek: a teljes állománynak, az Internal Affairs Bureaunak, a vezetőségnek, az osztályoknak."
                  actions={<Button onClick={() => setComposing(true)}><PenSquare/> Új levél</Button>}/>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,380px)_minmax(0,1fr)]">
        {/* Folders */}
        <nav data-tour="mail-boxes" className={cn("panel h-fit space-y-1 p-2", threadId && "hidden lg:block")} aria-label="Mappák">
          {boxes.map((item) => {
            const Icon = BOX_ICON[item.key];
            return (
              <button key={item.key} type="button" onClick={() => switchBox(item.key)} aria-current={box === item.key ? "page" : undefined}
                      className={cn("flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                        box === item.key ? "bg-indigo-500/15 text-white ring-1 ring-indigo-400/30" : "text-slate-400 hover:bg-white/5 hover:text-slate-100")}>
                <Icon className="size-4 shrink-0"/>
                <span className="flex-1">{item.label}</span>
                {box === item.key && unread > 0 && (
                  <span className="rounded-full bg-indigo-500 px-1.5 text-[10px] font-semibold text-white">{unread}</span>
                )}
              </button>
            );
          })}
          {myAddress && (
            <div className="mt-2 border-t border-white/5 px-3 pt-3 pb-1">
              <p className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">A címed</p>
              <button type="button" onClick={() => void copyAddress()} className="group mt-0.5 flex w-full min-w-0 items-center gap-1.5 text-left font-mono text-xs text-slate-300 hover:text-white">
                <span className="truncate">{myAddress}</span><Copy className="size-3 shrink-0 opacity-0 group-hover:opacity-100"/>
              </button>
            </div>
          )}
          {canSeeIab(profile) && (
            <Link to="/iab" className="mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-fuchsia-300/90 hover:bg-white/5">
              <Scale className="size-4"/> Belső vizsgálatok
            </Link>
          )}
        </nav>

        {/* Threads */}
        <section className={cn("panel flex min-h-[28rem] min-w-0 flex-col overflow-hidden p-0", threadId && "hidden lg:flex")}>
          <header className="space-y-2 border-b border-white/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <h2 className="flex-1 text-sm font-semibold text-white">
                {searching ? `Keresés${hits ? `: ${hits.length} találat` : "…"}` : MAIL_BOXES.find((item) => item.key === box)?.label}
              </h2>
              <Button size="icon-sm" variant="ghost" aria-label="Frissítés" onClick={() => void refresh()} disabled={refreshing}>
                <RefreshCw className={cn(refreshing && "animate-spin")}/>
              </Button>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Keresés a levelekben" aria-label="Keresés a levelekben"
                     className="h-9 pl-9 text-sm"/>
              {query && (
                <button type="button" aria-label="Keresés törlése" onClick={() => setQuery("")}
                        className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-slate-400 hover:bg-white/10">
                  <X className="size-3.5"/>
                </button>
              )}
            </div>
          </header>
          {searching ? (
            hits === null ? (
              <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-slate-500"/></div>
            ) : hits.length === 0 ? (
              <EmptyState icon={Search} title="Nincs találat" description="A tárgyban, a levelek szövegében, a feladók és a címzettek között keres."/>
            ) : (
              <ul className="min-h-0 flex-1 divide-y divide-white/5 overflow-y-auto">
                {hits.map((item, index) => (
                  <li key={item.id}>
                    <ThreadRow item={item} index={index} active={threadId === item.id} onOpen={() => open(item.id)} match={item.match}/>
                  </li>
                ))}
              </ul>
            )
          ) : failed ? (
            <EmptyState icon={Mail} title="A levelek nem tölthetők be" action={<Button size="sm" variant="outline" onClick={() => void refresh()}>Újra</Button>}/>
          ) : items === null ? (
            <div className="space-y-2 p-3">{[0, 1, 2, 3, 4].map((index) => <div key={index} className="skeleton h-16 rounded-lg"/>)}</div>
          ) : items.length === 0 ? (
            <EmptyState icon={Inbox} title="Nincs levél ebben a mappában"
                        description={box === "inbox" ? "Ha valaki ír neked vagy a csoportcímeidre, itt találod." : undefined}/>
          ) : (
            <ul className="min-h-0 flex-1 divide-y divide-white/5 overflow-y-auto">
              {items.map((item, index) => (
                <li key={item.id}>
                  <ThreadRow item={item} index={index} active={threadId === item.id} onOpen={() => open(item.id)}/>
                </li>
              ))}
              {more && (
                <li className="p-3 text-center">
                  <Button size="sm" variant="ghost" onClick={() => void loadMore()}>Régebbi levelek</Button>
                </li>
              )}
            </ul>
          )}
        </section>

        {/* The thread */}
        <section className={cn("min-w-0", !threadId && "hidden lg:block")}>
          {threadId ? (
            <ThreadView key={threadId} id={threadId} onBack={() => open(null)} onRead={markRead} onReplied={() => void load(box)}/>
          ) : (
            <div className="panel flex h-full min-h-[28rem] items-center justify-center">
              <EmptyState icon={Mail} title="Válassz egy levelet" description="A levél és a válaszok itt jelennek meg, papíron, aláírással."/>
            </div>
          )}
        </section>
      </div>

      <MailComposer open={composing} onOpenChange={(open) => {
        setComposing(open);
        if (!open) {
          setParams((current) => {
            if (!current.has("new")) return current;
            const next = new URLSearchParams(current);
            next.delete("new");
            return next;
          }, {replace: true});
        }
      }} onSent={(id) => {
        if (box === "sent") void load("sent");
        else setItems(null);
        setParams({box: "sent", thread: id});
      }}/>
    </div>
  );
}

/** A thread in the list: sender, time, subject, the last words (or the search match) and its marks. */
function ThreadRow({item, index, active, onOpen, match}: {item: MailThreadItem; index: number; active: boolean; onOpen: () => void; match?: string | null}) {
  return (
    <button type="button" onClick={onOpen} style={{"--i": Math.min(index, 12)} as CSSProperties}
            className={cn("animate-fade relative flex w-full min-w-0 flex-col gap-0.5 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]",
              active && "bg-indigo-500/[0.08]")}>
      {item.unread && <span aria-label="Olvasatlan" className="absolute top-4 left-1.5 size-1.5 rounded-full bg-indigo-400"/>}
      <span className="flex min-w-0 items-center gap-2">
        <span className={cn("min-w-0 flex-1 truncate text-sm", item.unread ? "font-semibold text-white" : "text-slate-200")}>
          {item.last?.sender_name ?? "–"}
        </span>
        <span className="shrink-0 text-[11px] text-slate-500" title={formatDateTime(item.last_message_at)}>{formatAgo(item.last_message_at)}</span>
      </span>
      <span className={cn("truncate text-[13px]", item.unread ? "text-slate-100" : "text-slate-300")}>
        {item.subject}{item.message_count > 1 && <span className="text-slate-500"> ({item.message_count})</span>}
      </span>
      <span className="line-clamp-2 text-xs text-slate-500 wrap-anywhere">{match ? `…${match}…` : item.last?.snippet}</span>
      <span className="mt-1 flex flex-wrap gap-1">
        {item.broadcast && <span className="rounded bg-amber-500/10 px-1.5 text-[10px] font-medium text-amber-200 ring-1 ring-amber-500/25">Körlevél</span>}
        {item.iab && <span className="rounded bg-fuchsia-500/10 px-1.5 text-[10px] font-medium text-fuchsia-200 ring-1 ring-fuchsia-500/25">IAB</span>}
        {item.public_kind && (
          <span className="rounded bg-emerald-500/10 px-1.5 text-[10px] font-medium text-emerald-200 ring-1 ring-emerald-500/25">
            Nyilvános · {PUBLIC_REPORT_KINDS[item.public_kind]?.label ?? "üzenet"}
          </span>
        )}
      </span>
    </button>
  );
}

function ThreadView({id, onBack, onRead, onReplied}: {id: string; onBack: () => void; onRead: (id: string) => void; onReplied: () => void}) {
  const {profile} = useAuth();
  const [thread, setThread] = useState<MailThread | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [directory, setDirectory] = useState<MailDirectory | null>(null);
  const [reply, setReply] = useState("");
  const [sender, setSender] = useState<MailSenderKind>("self");
  const [extra, setExtra] = useState<RecipientChip[]>([]);
  const [sending, setSending] = useState(false);
  const [linking, setLinking] = useState(false);
  const [receiptsOpen, setReceiptsOpen] = useState(false);
  const closeReceipts = useCallback(() => setReceiptsOpen(false), []);
  // A public report: the answer goes to the visitor too unless the writer turns it off (internal note).
  const [toReporter, setToReporter] = useState(true);
  const [statusBusy, setStatusBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await mailApi.thread(id);
      setThread(next);
      onRead(id);
    } catch (error) {
      setFailed(errorMessage(error, "A levél nem tölthető be."));
    }
  }, [id, onRead]);

  useEffect(() => {
    let active = true;
    mailApi.thread(id).then((next) => {
      if (!active) return;
      setThread(next);
      onRead(id);
    }, (error) => active && setFailed(errorMessage(error, "A levél nem tölthető be.")));
    return () => {
      active = false;
    };
  }, [id, onRead]);

  useEffect(() => {
    mailApi.directory().then(setDirectory, () => undefined);
  }, []);

  const authorIds = useMemo(() => thread?.messages.filter((message) => message.sender_kind === "self").map((message) => message.author?.id) ?? [], [thread]);
  const signatureOf = useSignatures(authorIds);

  const send = async () => {
    if (!thread || !reply.trim()) return;
    setSending(true);
    try {
      await mailApi.send({thread: id, body: reply, to: extra.map(toRecipient), as: sender, toReporter: !!thread.public && toReporter});
      setReply("");
      setExtra([]);
      toast.success("Válasz elküldve.");
      await load();
      onReplied();
    } catch (error) {
      toast.error(errorMessage(error, "A válasz nem ment el."));
    } finally {
      setSending(false);
    }
  };

  const setPublicStatus = async (status: "open" | "closed") => {
    setStatusBusy(true);
    try {
      await mailApi.setPublicStatus(id, status);
      toast.success(status === "closed" ? "A bejelentést lezártad." : "A bejelentés újra nyitva.");
      await load();
    } catch (error) {
      toast.error(errorMessage(error, "Nem sikerült."));
    } finally {
      setStatusBusy(false);
    }
  };

  if (failed) return <div className="panel"><EmptyState icon={Mail} title={failed} action={<Button size="sm" variant="outline" onClick={onBack}>Vissza</Button>}/></div>;
  if (!thread) return <div className="panel flex min-h-[28rem] items-center justify-center"><Loader2 className="size-6 animate-spin text-slate-500"/></div>;

  const subject = thread.thread.subject;
  return (
    <div className="space-y-4 print:space-y-6">
      <div className="panel flex flex-wrap items-center gap-2 px-4 py-3 print:hidden">
        <Button size="icon-sm" variant="ghost" className="lg:hidden" aria-label="Vissza" onClick={onBack}><ArrowLeft/></Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-white">{subject}</h2>
          <p className="truncate text-xs text-slate-500">{thread.recipients.map((recipient) => recipient.address).join(", ")}</p>
        </div>
        {thread.receipts && (
          <Button size="sm" variant="outline" onClick={() => setReceiptsOpen(true)} title="Kik nyitották meg a levelet">
            <Eye/> Olvasta: {thread.receipts.read}/{thread.receipts.total}
          </Button>
        )}
        {canSeeIab(profile) && (
          <Button size="sm" variant="outline" onClick={() => setLinking(true)}><Scale/> Vizsgálathoz</Button>
        )}
        <Button size="icon-sm" variant="ghost" aria-label="Nyomtatás" onClick={() => window.print()}><Printer/></Button>
      </div>

      {thread.public && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-emerald-500/[0.06] px-4 py-3 text-xs text-emerald-50 ring-1 ring-emerald-500/20 print:hidden">
          <span className="font-semibold text-emerald-200">Nyilvános {PUBLIC_REPORT_KINDS[thread.public.kind]?.label.toLowerCase() ?? "üzenet"}</span>
          <span className="font-mono text-emerald-100/80">{thread.public.ref}</span>
          {thread.public.contact && <span className="min-w-0 wrap-anywhere">Elérhetőség: <span className="font-medium">{thread.public.contact}</span></span>}
          <span className="text-emerald-100/70">A bejelentő a követőkódjával a nyilvános oldalon olvassa a neki szánt válaszokat; e-mailt nem kap.</span>
          {thread.can_reply && (
            <Button size="sm" variant="outline" className="ml-auto h-7" disabled={statusBusy}
                    onClick={() => void setPublicStatus(thread.public!.status === "closed" ? "open" : "closed")}>
              {thread.public.status === "closed" ? "Újranyitás" : "Lezárás"}
            </Button>
          )}
        </div>
      )}

      {thread.cases.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-fuchsia-500/[0.06] px-4 py-2.5 text-xs text-fuchsia-100 ring-1 ring-fuchsia-500/20 print:hidden">
          <Scale className="size-4 text-fuchsia-300"/> Csatolva:
          {thread.cases.map((item) => (
            <Link key={item.id} to={`/iab/case/${item.id}`} className="rounded-md bg-white/5 px-2 py-0.5 font-mono hover:bg-white/10">{item.case_number}</Link>
          ))}
        </div>
      )}

      {thread.messages.map((message, index) => (
        <Letter key={message.id} message={message} subject={index === 0 ? subject : replySubject(subject)} index={index}
                signature={message.author ? signatureOf(message.author.id) : null} iabStaff={thread.iab_staff}
                reporterSees={!!thread.public && message.sender_kind !== "public" && !!message.visible_to_reporter}/>
      ))}

      {thread.can_reply ? (
        <div className="panel space-y-3 p-4 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <Reply className="size-4 text-indigo-300"/>
            <p className="flex-1 text-sm font-medium text-white">Válasz mindenkinek</p>
            {directory && <SenderSelect directory={directory} value={sender} onChange={(value) => setSender(value === "external" ? "self" : value)}/>}
          </div>
          {directory && (
            <RecipientPicker directory={directory} value={extra} onChange={setExtra} exclude={thread.recipients.map((recipient) => recipient.address)}/>
          )}
          <Textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={6} maxLength={20000}
                    placeholder="Tisztelt …!" className="font-[ui-serif,Georgia,serif] text-[15px] leading-relaxed"/>
          {thread.public && (
            <label className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2 text-sm text-slate-200 ring-1 ring-white/10">
              <Switch checked={toReporter} onCheckedChange={setToReporter}/>
              <span className="min-w-0">
                A bejelentő is olvassa
                <span className="block text-[11px] text-slate-500">
                  {toReporter ? "A válasz megjelenik a nyilvános oldalon a követőkódjánál." : "Belső megjegyzés: csak a levél olvasói látják."}
                </span>
              </span>
            </label>
          )}
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-slate-500">A címzetteket kiegészítheted; a régiek mind megkapják.</p>
            <Button onClick={() => void send()} disabled={sending || !reply.trim()}>{sending ? <Loader2 className="animate-spin"/> : <Send/>} Küldés</Button>
          </div>
        </div>
      ) : (
        <p className="text-center text-xs text-slate-500 print:hidden">Erre a körlevélre csak a feladója és a vezetőség válaszolhat.</p>
      )}

      {linking && <LinkToCaseDialog threadId={id} subject={subject} onOpenChange={setLinking} onLinked={() => void load()}/>}
      {receiptsOpen && <ReceiptsDialog threadId={id} subject={subject} onClose={closeReceipts}/>}
    </div>
  );
}
