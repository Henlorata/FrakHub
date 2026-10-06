import {useCallback, useEffect, useState, type CSSProperties} from "react";
import {toast} from "sonner";
import {Ban, Inbox, Loader2, Lock, MessageSquareLock, Send, ShieldCheck, X} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Input} from "@/components/ui/input";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {EmptyState} from "@/components/layout/EmptyState";
import {
  communityApi, FEEDBACK_CATEGORIES, FEEDBACK_RECIPIENTS, FEEDBACK_STATUS, type FeedbackCategory, type FeedbackRecipient, type FeedbackReport,
  type FeedbackStatus, type MyFeedback,
} from "@/lib/community";
import {formatDate, formatDateTime} from "@/lib/datetime";
import {cn, errorMessage, isExecutive, isHighCommand} from "@/lib/utils";
import type {Profile} from "@/types/supabase";

const WEEKLY_LIMIT = 3;

/** Who reads the inbox (private.feedback_recipient_ids): the bureau manager always, the command for "command". */
export const readsFeedback = (profile: Profile) => isHighCommand(profile) || !!profile.is_bureau_manager;

/**
 * Anonymous feedback to the leadership. Nobody on the site (the leadership included) sees who
 * wrote a report: only an irreversible code is kept for the weekly limit and a temporary block,
 * and the times are rounded to the hour. Answers come back here (with a notification).
 */
export function FeedbackTab({profile, initialView}: {profile: Profile; initialView?: "mine" | "inbox" | null}) {
  const leader = readsFeedback(profile);
  // The readers come here for the inbox (dashboard counter, notifications); "?box=mine" opens their own reports.
  const [view, setView] = useState<"mine" | "inbox">(() => initialView ?? (leader ? "inbox" : "mine"));
  return (
    <div className="space-y-4" data-tour="community-feedback">
      {leader && (
        <div className="inline-flex rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/10" role="tablist" aria-label="Nézet">
          {([["mine", "Saját visszajelzéseim"], ["inbox", "Beérkezett"]] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)}
                    className={cn("h-8 rounded-md px-3 text-xs font-medium transition-colors", view === id ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200")}>
              {label}
            </button>
          ))}
        </div>
      )}
      {view === "inbox" && leader ? <InboxView profile={profile}/> : <MineView/>}
    </div>
  );
}

function MineView() {
  const [data, setData] = useState<MyFeedback | null>(null);
  const [failed, setFailed] = useState(false);
  const [form, setForm] = useState({recipient: "command" as FeedbackRecipient, category: "idea" as FeedbackCategory, body: ""});
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await communityApi.myFeedback());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const send = async () => {
    setSending(true);
    try {
      await communityApi.submitFeedback(form.recipient, form.category, form.body.trim());
      toast.success("Névtelen visszajelzés elküldve.", {description: "Ha válaszolnak, értesítést kapsz."});
      setForm((prev) => ({...prev, body: ""}));
      await load();
    } catch (error) {
      toast.error(errorMessage(error, "Nem sikerült elküldeni."));
    } finally {
      setSending(false);
    }
  };

  if (failed) return <EmptyState icon={X} title="A visszajelzések nem tölthetők be." action={<Button variant="outline" onClick={() => void load()}>Újra</Button>}/>;
  if (!data) return <div className="grid gap-4 lg:grid-cols-2"><div className="skeleton h-80"/><div className="skeleton h-80"/></div>;
  const left = Math.max(0, WEEKLY_LIMIT - data.sent_this_week);
  const blocked = !!data.blocked_until;

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="panel space-y-4 p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-300 ring-1 ring-violet-500/25"><MessageSquareLock className="size-5"/></div>
          <div>
            <h3 className="text-sm font-semibold text-white">Névtelen visszajelzés a vezetőségnek</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
              Az oldalon senki – a vezetőség sem – látja, ki írta. Csak egy visszafejthetetlen azonosítót tárolunk a heti korláthoz, az időpontokat
              órára kerekítjük. A válaszokat itt látod.
            </p>
          </div>
        </div>
        {blocked ? (
          <div className="rounded-xl bg-red-500/10 p-3 text-sm text-red-100 ring-1 ring-red-500/25">
            <Ban className="mr-1.5 inline size-4"/> A vezérkar ideiglenesen letiltotta a beküldést: {formatDate(data.blocked_until)}-ig.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Kinek szól</Label>
                <Select value={form.recipient} onValueChange={(value) => setForm((prev) => ({...prev, recipient: value as FeedbackRecipient}))}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>{(Object.keys(FEEDBACK_RECIPIENTS) as FeedbackRecipient[]).map((key) => <SelectItem key={key} value={key}>{FEEDBACK_RECIPIENTS[key].label}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-[11px] text-slate-500">{FEEDBACK_RECIPIENTS[form.recipient].hint}</p>
              </div>
              <div className="space-y-1">
                <Label>Téma</Label>
                <Select value={form.category} onValueChange={(value) => setForm((prev) => ({...prev, category: value as FeedbackCategory}))}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>{(Object.keys(FEEDBACK_CATEGORIES) as FeedbackCategory[]).map((key) => <SelectItem key={key} value={key}>{FEEDBACK_CATEGORIES[key]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="feedback-body">Üzenet</Label>
              <Textarea id="feedback-body" rows={6} maxLength={3000} value={form.body} onChange={(event) => setForm((prev) => ({...prev, body: event.target.value}))}
                        placeholder="Írd le, mi történt, vagy mit javasolsz. Ne írj bele olyat, amiből kiderül, ki vagy, ha ezt nem szeretnéd."/>
              <p className="flex justify-between text-[11px] text-slate-500"><span>Legalább 20 karakter.</span><span>Ezen a héten még {left} küldhető.</span></p>
            </div>
            <Button disabled={sending || left === 0 || form.body.trim().length < 20} onClick={() => void send()} className="w-full">
              {sending ? <Loader2 className="animate-spin"/> : <Send/>} Névtelen küldés
            </Button>
          </>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 px-1 text-sm font-semibold text-slate-300"><Lock className="size-4 text-slate-500"/> Saját visszajelzéseim</h3>
        {data.reports.length === 0 ? (
          <div className="panel"><EmptyState compact icon={MessageSquareLock} title="Még nem küldtél visszajelzést."/></div>
        ) : data.reports.map((report, index) => (
          <ReportThread key={report.id} report={report} index={index} asReporter onChanged={load}/>
        ))}
      </section>
    </div>
  );
}

function InboxView({profile}: {profile: Profile}) {
  const [reports, setReports] = useState<FeedbackReport[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [blocking, setBlocking] = useState<FeedbackReport | null>(null);
  const canBlock = isExecutive(profile) || !!profile.is_bureau_manager;

  const load = useCallback(async () => {
    try {
      setReports(await communityApi.inbox());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (failed) return <EmptyState icon={X} title="A beérkezett visszajelzések nem tölthetők be." action={<Button variant="outline" onClick={() => void load()}>Újra</Button>}/>;
  if (!reports) return <div className="space-y-3">{[0, 1].map((index) => <div key={index} className="skeleton h-40"/>)}</div>;
  if (reports.length === 0) return <div className="panel"><EmptyState icon={Inbox} title="Nincs beérkezett visszajelzés."/></div>;
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="size-4 text-emerald-400"/> A beküldők névtelenek; a válaszod értesítésként jut el hozzájuk.</p>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {reports.map((report, index) => (
          <ReportThread key={report.id} report={report} index={index} onChanged={load} onBlock={canBlock ? () => setBlocking(report) : undefined}/>
        ))}
      </div>
      <BlockDialog report={blocking} onOpenChange={(open) => !open && setBlocking(null)} onDone={async () => {
        setBlocking(null);
        await load();
      }}/>
    </div>
  );
}

function ReportThread({report, index, asReporter, onChanged, onBlock}: {
  report: FeedbackReport;
  index: number;
  asReporter?: boolean;
  onChanged: () => Promise<void>;
  onBlock?: () => void;
}) {
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const closed = report.status === "closed";
  const send = async () => {
    setBusy(true);
    try {
      await communityApi.reply(report.id, reply.trim());
      setReply("");
      await onChanged();
    } catch (error) {
      toast.error(errorMessage(error, "Nem sikerült elküldeni."));
    } finally {
      setBusy(false);
    }
  };
  const setStatus = async (status: FeedbackStatus) => {
    try {
      await communityApi.setFeedbackStatus(report.id, status);
      await onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  return (
    <article className="panel animate-rise flex min-w-0 flex-col p-4" style={{"--i": Math.min(index, 8)} as CSSProperties}>
      <header className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className={cn("rounded-full px-2 py-0.5 font-semibold ring-1", FEEDBACK_STATUS[report.status].tone)}>{FEEDBACK_STATUS[report.status].label}</span>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-slate-300 ring-1 ring-white/10">{FEEDBACK_CATEGORIES[report.category]}</span>
        <span className="text-slate-500">→ {FEEDBACK_RECIPIENTS[report.recipient].label} · {formatDateTime(report.created_at)}</span>
        {!asReporter && report.reporter_reports !== null && report.reporter_reports > 1 && (
          <span className="text-slate-500" title="Ugyanattól a névtelen beküldőtől">· {report.reporter_reports} visszajelzés ettől a beküldőtől</span>
        )}
        {!asReporter && report.blocked_until && <span className="text-red-300">· tiltva {formatDate(report.blocked_until)}-ig</span>}
        {!asReporter && (
          <div className="ml-auto flex items-center gap-1">
            <Select value={report.status} onValueChange={(value) => void setStatus(value as FeedbackStatus)}>
              <SelectTrigger className="h-7 w-36 text-[11px]"><SelectValue/></SelectTrigger>
              <SelectContent>{(Object.keys(FEEDBACK_STATUS) as FeedbackStatus[]).map((key) => <SelectItem key={key} value={key}>{FEEDBACK_STATUS[key].label}</SelectItem>)}</SelectContent>
            </Select>
            {onBlock && <Button size="icon-sm" variant="ghost" title="Beküldő ideiglenes tiltása" className="hover:text-red-300" onClick={onBlock}><Ban/></Button>}
          </div>
        )}
      </header>
      <p className="mt-3 text-sm whitespace-pre-wrap wrap-anywhere text-slate-100">{report.body}</p>
      {report.messages.length > 0 && (
        <ol className="mt-3 space-y-2 border-t border-white/5 pt-3">
          {report.messages.map((message) => (
            <li key={message.id} className={cn("rounded-xl px-3 py-2 text-sm ring-1", message.from_reporter
              ? "bg-white/[0.03] ring-white/10" : "bg-emerald-500/[0.07] ring-emerald-500/20")}>
              <p className="text-[10px] font-semibold tracking-wide uppercase">
                {message.from_reporter ? <span className="text-slate-400">{asReporter ? "Te" : "Beküldő"}</span>
                  : <span className="text-emerald-300">{message.author_name ?? "Vezetőség"}</span>}
                <span className="ml-2 font-normal normal-case text-slate-500">{formatDateTime(message.created_at)}</span>
              </p>
              <p className="mt-0.5 whitespace-pre-wrap wrap-anywhere text-slate-200">{message.body}</p>
            </li>
          ))}
        </ol>
      )}
      {!closed ? (
        <div className="mt-3 flex items-end gap-2">
          <Textarea rows={1} maxLength={2000} value={reply} onChange={(event) => setReply(event.target.value)}
                    placeholder={asReporter ? "Válasz (továbbra is névtelenül)…" : "Válasz a beküldőnek…"} className="min-h-9 flex-1 resize-none text-sm"/>
          <Button size="icon" className="size-9 shrink-0" title="Küldés" disabled={busy || !reply.trim()} onClick={() => void send()}>
            {busy ? <Loader2 className="animate-spin"/> : <Send/>}
          </Button>
        </div>
      ) : <p className="mt-3 text-[11px] text-slate-500">A beszélgetés lezárult.</p>}
    </article>
  );
}

function BlockDialog({report, onOpenChange, onDone}: {report: FeedbackReport | null; onOpenChange: (open: boolean) => void; onDone: () => Promise<void>}) {
  const [days, setDays] = useState("7");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (report) {
      setDays("7");
      setReason("");
    }
  }, [report]);
  const block = async () => {
    if (!report) return;
    setBusy(true);
    try {
      await communityApi.blockReporter(report.id, Number(days), reason.trim() || null);
      toast.success("A beküldő ideiglenesen nem küldhet visszajelzést.", {description: "Hogy ki az, továbbra sem derül ki."});
      await onDone();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={!!report} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Beküldő ideiglenes tiltása</DialogTitle>
          <DialogDescription>Visszaélés (sértegetés, elárasztás) esetén. A beküldő személye ettől sem derül ki; a beszélgetés lezárul.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3">
          <div className="space-y-1">
            <Label htmlFor="block-days">Napok</Label>
            <Input id="block-days" type="number" min={1} max={90} value={days} onChange={(event) => setDays(event.target.value)}/>
          </div>
          <div className="space-y-1">
            <Label htmlFor="block-reason">Indok (belső)</Label>
            <Input id="block-reason" maxLength={200} value={reason} onChange={(event) => setReason(event.target.value)}/>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button variant="destructive" disabled={busy || !(Number(days) >= 1)} onClick={() => void block()}>{busy ? <Loader2 className="animate-spin"/> : <Ban/>} Tiltás</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
