import {useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode} from "react";
import {useSearchParams} from "react-router";
import {toast} from "sonner";
import {ArrowRight, Check, Copy, KeyRound, Loader2, Lock, Mail, Send, ShieldCheck, Trash2} from "lucide-react";
import {formatDateTime} from "@/lib/datetime";
import {
  forgetReport, isCompleteCode, normalizeCode, PUBLIC_REPORT_KINDS, publicReportsApi, rememberReport, savedReports,
  type PublicReport, type PublicReportKind, type SavedReport,
} from "@/lib/public-reports";
import {siteApi} from "@/lib/site";
import {cn, errorMessage} from "@/lib/utils";
import {Reveal} from "./motion";
import {PublicShell} from "./PublicChrome";

type View = "new" | "track";

/**
 * Writing to the department from the public page: a complaint (IAB), a tip (MCB) or a question
 * (Command Staff). Nobody gives an e-mail address and the site sends none: after sending, the
 * visitor gets a tracking code, and with it reads the answers here (the codes are also kept on
 * this device).
 */
export function ContactPage() {
  const [params, setParams] = useSearchParams();
  const view: View = params.get("view") === "track" ? "track" : "new";
  const [alertLevel] = useState(() => siteApi.cached()?.alert_level ?? null);
  const [opened, setOpened] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Kapcsolat – San Fierro Sheriff's Department";
    return () => {
      document.title = "SFSD Intranet";
    };
  }, []);

  const switchView = (next: View) => setParams(next === "new" ? {} : {view: next}, {replace: true});

  return (
    <PublicShell alertLevel={alertLevel}>
      <section className="relative overflow-hidden pt-32 pb-10">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(90%_70%_at_50%_0%,#13284f_0%,#030712_70%)]"/>
        <div className="mx-auto w-full max-w-5xl px-5 sm:px-8">
          <Reveal as="p" className="text-[11px] font-semibold tracking-[0.35em] text-amber-300 uppercase">Kapcsolat</Reveal>
          <Reveal as="h1" delay={80} className="mt-3 text-[clamp(2.2rem,5.6vw,4rem)] leading-none font-black tracking-[-0.03em] text-white">
            Írj a <span className="text-shimmer">Sheriff&apos;s Departmentnek</span>
          </Reveal>
          <Reveal as="p" delay={160} className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-400">
            Panasz, bejelentés vagy kérdés: az üzenet egyenesen az illetékes irodához kerül. E-mail címet nem kérünk;
            a beküldés után kapsz egy követőkódot, azzal itt olvashatod a válaszokat.
          </Reveal>
          <Reveal delay={220} className="mt-8 inline-flex rounded-full bg-white/[0.05] p-1 ring-1 ring-white/10">
            {([["new", "Új üzenet", Send], ["track", "Bejelentésem követése", KeyRound]] as const).map(([key, label, Icon]) => (
              <button key={key} type="button" onClick={() => switchView(key)} aria-pressed={view === key}
                      className={cn("inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition",
                        view === key ? "bg-amber-300 font-semibold text-black" : "text-slate-300 hover:text-white")}>
                <Icon className="size-4"/> {label}
              </button>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-5 pb-24 sm:px-8">
        {view === "new"
          ? <NewReport onTrack={(code) => {
            setOpened(code);
            switchView("track");
          }}/>
          : <TrackReport initial={opened}/>}
      </section>
    </PublicShell>
  );
}

// --- A new report -------------------------------------------------------------------------------

function NewReport({onTrack}: {onTrack: (code: string) => void}) {
  const [kind, setKind] = useState<PublicReportKind>("tip");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [trap, setTrap] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{code: string; subject: string} | null>(null);
  const openedAt = useRef(0);

  useEffect(() => {
    openedAt.current = Date.now();
  }, []);

  const meta = PUBLIC_REPORT_KINDS[kind];
  const problem = subject.trim().length < 4 ? "Adj meg egy tárgyat (legalább 4 karakter)."
    : body.trim().length < 20 ? "Írd le részletesebben (legalább 20 karakter)." : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (problem) return toast.error(problem);
    setSending(true);
    try {
      const result = await publicReportsApi.submit({kind, subject: subject.trim(), body: body.trim(), name: name.trim(), contact: contact.trim(), trap,
        elapsed: Date.now() - openedAt.current});
      rememberReport({code: result.code, subject: subject.trim(), kind, at: new Date().toISOString()});
      setSent({code: result.code, subject: subject.trim()});
      window.scrollTo({top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"});
    } catch (error) {
      toast.error(errorMessage(error, "Az üzenet nem ment el. Próbáld újra később."));
    } finally {
      setSending(false);
    }
  };

  if (sent) return <SentCard code={sent.code} subject={sent.subject} onTrack={() => onTrack(sent.code)} onAnother={() => {
    setSent(null);
    setSubject("");
    setBody("");
    openedAt.current = Date.now();
  }}/>;

  return (
    <form onSubmit={(event) => void submit(event)} className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
      <div className="space-y-3">
        <p className="text-xs font-semibold tracking-[0.25em] text-slate-500 uppercase">Kinek szól?</p>
        {(Object.keys(PUBLIC_REPORT_KINDS) as PublicReportKind[]).map((key, index) => {
          const item = PUBLIC_REPORT_KINDS[key];
          const active = key === kind;
          return (
            <Reveal key={key} variant="left" delay={index * 80}>
              <button type="button" onClick={() => setKind(key)} aria-pressed={active}
                      className={cn("group flex w-full min-w-0 items-start gap-4 rounded-2xl p-4 text-left ring-1 transition duration-300",
                        active ? "bg-white/[0.07] ring-white/25" : "bg-white/[0.02] ring-white/10 hover:bg-white/[0.04]")}
                      style={{"--accent": item.accent} as CSSProperties}>
                <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl ring-1 transition-transform duration-300 group-hover:scale-105", item.tone)}>
                  <item.icon className="size-5"/>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-semibold text-white">{item.label}</span>
                    {active && <Check className="size-4 text-amber-300"/>}
                  </span>
                  <span className="mt-0.5 block text-sm text-slate-400">{item.hint}</span>
                  <span className="mt-2 block truncate font-mono text-[11px] text-slate-500">→ {item.address}</span>
                </span>
              </button>
            </Reveal>
          );
        })}
        <Reveal delay={260} className="flex items-start gap-3 rounded-2xl bg-emerald-500/[0.05] p-4 text-sm text-emerald-100/90 ring-1 ring-emerald-500/20">
          <Lock className="mt-0.5 size-4 shrink-0 text-emerald-300"/>
          <span>Nem kérünk e-mail címet, és nem küldünk e-mailt. Aki ismeri a követőkódodat, látja az üzenetváltást: tartsd meg magadnak.</span>
        </Reveal>
      </div>

      <Reveal delay={120} className="rounded-3xl bg-white/[0.03] p-6 ring-1 ring-white/10 sm:p-8">
        <div className="flex items-center gap-3">
          <span className={cn("grid size-10 place-items-center rounded-xl ring-1", meta.tone)}><meta.icon className="size-5"/></span>
          <div className="min-w-0">
            <p className="font-semibold text-white">{meta.label} · {meta.office}</p>
            <p className="truncate font-mono text-xs text-slate-500">{meta.address}</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Neved (nem kötelező)" hint="A játékbeli neved, vagy maradj névtelen.">
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="pl. John Smith"
                   className="h-11 w-full rounded-xl bg-black/30 px-3.5 text-sm text-white ring-1 ring-white/10 outline-none placeholder:text-slate-600 focus:ring-amber-300/50"/>
          </Field>
          <Field label="Elérhetőség a játékban (nem kötelező)" hint="pl. telefonszám, ha visszahívást kérsz.">
            <input value={contact} onChange={(event) => setContact(event.target.value)} maxLength={80} placeholder="pl. 555-0142"
                   className="h-11 w-full rounded-xl bg-black/30 px-3.5 text-sm text-white ring-1 ring-white/10 outline-none placeholder:text-slate-600 focus:ring-amber-300/50"/>
          </Field>
        </div>
        <Field label="Tárgy" className="mt-4">
          <input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={120} required
                 placeholder={kind === "complaint" ? "pl. Panasz egy igazoltatás miatt" : kind === "tip" ? "pl. Gyanús jármű a kikötőben" : "pl. Kérdés a jelentkezésről"}
                 className="h-11 w-full rounded-xl bg-black/30 px-3.5 text-sm text-white ring-1 ring-white/10 outline-none placeholder:text-slate-600 focus:ring-amber-300/50"/>
        </Field>
        <Field label="Üzenet" className="mt-4" counter={`${body.trim().length} / 4000`}>
          <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={4000} rows={8} required
                    placeholder="Mi történt, mikor és hol? Minél pontosabb, annál könnyebb utánajárni."
                    className="w-full resize-y rounded-xl bg-black/30 px-3.5 py-3 text-sm leading-relaxed wrap-anywhere text-white ring-1 ring-white/10 outline-none placeholder:text-slate-600 focus:ring-amber-300/50"/>
        </Field>
        {/* Left empty by people; bots fill it in. */}
        <label aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          Weboldal <input tabIndex={-1} autoComplete="off" value={trap} onChange={(event) => setTrap(event.target.value)}/>
        </label>
        <button type="submit" disabled={sending}
                className="group relative mt-6 inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 px-7 text-[15px] font-semibold text-black shadow-[0_18px_40px_-14px_rgb(234_179_8/0.9)] transition hover:brightness-110 disabled:opacity-70 sm:w-auto">
          <span aria-hidden className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent transition-transform duration-700 group-hover:translate-x-full"/>
          {sending ? <Loader2 className="size-4 animate-spin"/> : <Send className="size-4"/>} Küldés
        </button>
      </Reveal>
    </form>
  );
}

function SentCard({code, subject, onTrack, onAnother}: {code: string; subject: string; onTrack: () => void; onAnother: () => void}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("A követőkód a vágólapra került.");
    } catch {
      toast.error("A másolás nem sikerült; írd fel a kódot.");
    }
  };
  return (
    <Reveal variant="scale" className="mx-auto max-w-2xl overflow-hidden rounded-3xl bg-white/[0.03] p-8 text-center ring-1 ring-emerald-400/25">
      <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-400/30">
        <ShieldCheck className="size-8"/>
      </span>
      <h2 className="mt-5 text-2xl font-bold text-white">Megkaptuk az üzenetedet</h2>
      <p className="mt-2 text-slate-400">„{subject}” – az illetékes iroda hamarosan foglalkozik vele.</p>
      <p className="mt-6 text-xs font-semibold tracking-[0.25em] text-slate-500 uppercase">A követőkódod</p>
      <button type="button" onClick={() => void copy()}
              className="mt-2 inline-flex items-center gap-3 rounded-2xl bg-black/40 px-5 py-3 font-mono text-xl tracking-wider text-amber-200 ring-1 ring-amber-300/30 transition hover:ring-amber-300/60 sm:text-2xl">
        {code} {copied ? <Check className="size-5 text-emerald-300"/> : <Copy className="size-5 text-slate-400"/>}
      </button>
      <p className="mx-auto mt-3 max-w-md text-xs text-slate-500">
        Ezen az eszközön megjegyezzük. Másik gépről vagy telefonról ezzel a kóddal nyithatod meg a válaszokat; aki ismeri, látja az üzenetváltást.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={onTrack} className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-black transition hover:bg-slate-200">
          Bejelentés megnyitása <ArrowRight className="size-4"/>
        </button>
        <button type="button" onClick={onAnother} className="inline-flex h-11 items-center gap-2 rounded-full bg-white/[0.06] px-6 text-sm text-white ring-1 ring-white/15 transition hover:bg-white/10">
          Új üzenet
        </button>
      </div>
    </Reveal>
  );
}

// --- Following a report ---------------------------------------------------------------------------

function TrackReport({initial}: {initial: string | null}) {
  const [saved, setSaved] = useState<SavedReport[]>(() => savedReports());
  const [input, setInput] = useState(initial ?? "");
  const [code, setCode] = useState<string | null>(initial);
  const [report, setReport] = useState<PublicReport | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [trap, setTrap] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!code) return;
    let active = true;
    publicReportsApi.get(code).then((data) => {
      if (!active) return;
      setReport(data);
      setLoading(false);
    }, (error) => {
      if (!active) return;
      toast.error(errorMessage(error, "A bejelentés nem tölthető be."));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [code]);

  const open = (value: string) => {
    const next = normalizeCode(value);
    if (!isCompleteCode(next)) return toast.error("A követőkód így néz ki: SF-XXXX-XXXX-XXXX-XXXX.");
    setInput(next);
    setReport(undefined);
    setLoading(true);
    setCode(next);
  };

  const send = async () => {
    if (!code || reply.trim().length < 2) return;
    setSending(true);
    try {
      await publicReportsApi.reply(code, reply.trim(), trap);
      setReply("");
      setReport(await publicReportsApi.get(code));
      toast.success("Üzenet elküldve.");
    } catch (error) {
      toast.error(errorMessage(error, "Az üzenet nem ment el."));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)]">
      <div className="space-y-4">
        <form onSubmit={(event) => {
          event.preventDefault();
          open(input);
        }} className="rounded-3xl bg-white/[0.03] p-5 ring-1 ring-white/10">
          <label className="text-xs font-semibold tracking-[0.25em] text-slate-500 uppercase" htmlFor="report-code">Követőkód</label>
          <input id="report-code" value={input} onChange={(event) => setInput(event.target.value)} placeholder="SF-XXXX-XXXX-XXXX-XXXX" autoComplete="off"
                 spellCheck={false} className="mt-2 h-12 w-full rounded-xl bg-black/30 px-3.5 font-mono text-base tracking-wider text-white uppercase ring-1 ring-white/10 outline-none placeholder:text-slate-600 placeholder:normal-case focus:ring-amber-300/50"/>
          <button type="submit" className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold text-black transition hover:bg-slate-200">
            <KeyRound className="size-4"/> Megnyitás
          </button>
        </form>
        {saved.length > 0 && (
          <div className="rounded-3xl bg-white/[0.02] p-5 ring-1 ring-white/10">
            <p className="text-xs font-semibold tracking-[0.25em] text-slate-500 uppercase">Ezen az eszközön</p>
            <ul className="mt-3 space-y-1">
              {saved.map((item) => {
                const meta = PUBLIC_REPORT_KINDS[item.kind] ?? PUBLIC_REPORT_KINDS.question;
                return (
                  <li key={item.code} className="group flex min-w-0 items-center gap-2">
                    <button type="button" onClick={() => open(item.code)}
                            className={cn("flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/5", code === item.code && "bg-white/5")}>
                      <meta.icon className="size-4 shrink-0 text-slate-400"/>
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-slate-100">{item.subject}</span>
                        <span className="block font-mono text-[11px] text-slate-500">{item.code.slice(0, 12)}… · {formatDateTime(item.at)}</span>
                      </span>
                    </button>
                    <button type="button" aria-label="Eltávolítás erről az eszközről" title="Eltávolítás erről az eszközről"
                            onClick={() => {
                              forgetReport(item.code);
                              setSaved(savedReports());
                            }}
                            className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-500 opacity-0 transition group-hover:opacity-100 hover:bg-white/5 hover:text-red-300 focus:opacity-100">
                      <Trash2 className="size-4"/>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div className="min-w-0">
        {loading ? (
          <div className="flex min-h-[18rem] items-center justify-center rounded-3xl bg-white/[0.02] ring-1 ring-white/10"><Loader2 className="size-7 animate-spin text-slate-500"/></div>
        ) : report === null ? (
          <div className="rounded-3xl bg-white/[0.02] p-10 text-center ring-1 ring-white/10">
            <p className="text-lg font-semibold text-white">Ehhez a kódhoz nem tartozik bejelentés</p>
            <p className="mt-2 text-sm text-slate-400">Ellenőrizd a kódot: kötőjelekkel együtt 22 karakter.</p>
          </div>
        ) : report === undefined ? (
          <div className="flex min-h-[18rem] flex-col items-center justify-center gap-3 rounded-3xl bg-white/[0.02] p-10 text-center ring-1 ring-white/10">
            <Mail className="size-8 text-slate-600"/>
            <p className="text-sm text-slate-400">Add meg a követőkódot, vagy válaszd ki az ezen az eszközön elküldöttek közül.</p>
          </div>
        ) : (
          <ReportThread report={report} reply={reply} onReply={setReply} trap={trap} onTrap={setTrap} sending={sending} onSend={() => void send()}/>
        )}
      </div>
    </div>
  );
}

function ReportThread({report, reply, onReply, trap, onTrap, sending, onSend}: {
  report: PublicReport; reply: string; onReply: (value: string) => void; trap: string; onTrap: (value: string) => void;
  sending: boolean; onSend: () => void;
}) {
  const meta = PUBLIC_REPORT_KINDS[report.kind] ?? PUBLIC_REPORT_KINDS.question;
  const answered = report.messages.some((message) => !message.mine);
  return (
    <div className="animate-fade overflow-hidden rounded-3xl bg-white/[0.03] ring-1 ring-white/10">
      <header className="flex flex-wrap items-center gap-3 border-b border-white/5 p-5">
        <span className={cn("grid size-10 place-items-center rounded-xl ring-1", meta.tone)}><meta.icon className="size-5"/></span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-white">{report.subject}</p>
          <p className="text-xs text-slate-500">{meta.label} · {meta.office} · {formatDateTime(report.created_at)}</p>
        </div>
        <span className={cn("rounded-full px-3 py-1 text-xs font-semibold ring-1",
          report.status === "closed" ? "bg-white/5 text-slate-300 ring-white/15"
            : answered ? "bg-emerald-500/10 text-emerald-200 ring-emerald-400/30" : "bg-amber-500/10 text-amber-100 ring-amber-400/30")}>
          {report.status === "closed" ? "Lezárva" : answered ? "Válaszoltak" : "Feldolgozás alatt"}
        </span>
      </header>
      <ol className="space-y-4 p-5">
        {report.messages.map((message, index) => (
          <li key={message.id} style={{"--i": index} as CSSProperties} className={cn("animate-rise flex", message.mine ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%] rounded-2xl px-4 py-3 ring-1",
              message.mine ? "rounded-br-md bg-amber-300/10 ring-amber-300/20" : "rounded-bl-md bg-white/[0.05] ring-white/10")}>
              <p className="text-[11px] font-semibold text-slate-400">
                {message.mine ? "Te" : message.from} · {formatDateTime(message.created_at)}
              </p>
              <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap wrap-anywhere text-slate-100">{message.body}</p>
            </div>
          </li>
        ))}
      </ol>
      {report.status === "open" ? (
        <div className="border-t border-white/5 p-5">
          <textarea value={reply} onChange={(event) => onReply(event.target.value)} rows={3} maxLength={4000} placeholder="Kiegészítés vagy válasz…"
                    className="w-full resize-y rounded-xl bg-black/30 px-3.5 py-3 text-sm wrap-anywhere text-white ring-1 ring-white/10 outline-none placeholder:text-slate-600 focus:ring-amber-300/50"/>
          <label aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            Weboldal <input tabIndex={-1} autoComplete="off" value={trap} onChange={(event) => onTrap(event.target.value)}/>
          </label>
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={onSend} disabled={sending || reply.trim().length < 2}
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:bg-slate-200 disabled:opacity-50">
              {sending ? <Loader2 className="size-4 animate-spin"/> : <Send className="size-4"/>} Küldés
            </button>
          </div>
        </div>
      ) : (
        <p className="border-t border-white/5 p-5 text-center text-sm text-slate-500">Az ügyet lezárták. Új ügyben új üzenetet küldhetsz.</p>
      )}
    </div>
  );
}

function Field({label, hint, counter, className, children}: {label: string; hint?: string; counter?: string; className?: string; children: ReactNode}) {
  return (
    <label className={cn("block", className)}>
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-slate-300">{label}</span>
        {counter && <span className="text-[11px] text-slate-500 tabular-nums">{counter}</span>}
      </span>
      <span className="mt-1.5 block">{children}</span>
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}
