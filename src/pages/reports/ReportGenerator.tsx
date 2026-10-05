import {useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode} from "react";
import {useLocation, useNavigate} from "react-router";
import {toast} from "sonner";
import {
  CalendarDays, CarFront, Check, ClipboardCopy, Code2, Eye, Gavel, Hash, Link2, ListChecks, Loader2, Lock, RotateCcw, Scale, Shield,
  Timer, User, UserRound, Users,
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {BbcodePreview} from "@/components/BbcodePreview";
import {useAuth} from "@/context/AuthContext";
import {formatStandardDate, monthKey, todayKey} from "@/lib/datetime";
import {normalizeForumUrl, reportCode, reportDateKey, type ReportForm} from "@/lib/report-templates";
import {reportLog, reportLogError} from "@/lib/report-log";
import {cn} from "@/lib/utils";

/** What the penal code calculator hands over ("Jelentés készítése"). */
export interface ReportPrefill {
  charges?: string;
  fine?: string;
  jailTime?: string;
}

const draftKey = (userId: string) => `frakhub.report.draft.${userId}`;

const emptyForm = (profile: {full_name: string; faction_rank: string; badge_number: string} | null): ReportForm => ({
  officerName: profile?.full_name ?? "",
  officerRank: profile?.faction_rank ?? "",
  badgeNumber: profile?.badge_number ?? "",
  colleagues: "",
  unitId: "",
  suspectName: "",
  suspectIdCard: "",
  suspectLicense: "",
  suspectMedical: "",
  date: formatStandardDate(),
  charges: "",
  fine: "",
  jailTime: "",
  confiscatedItems: "-",
  description: "",
});

/**
 * The forum report: a form for the template's fields, the exact BBCode (and a preview of how the
 * forum shows it), and recording the posted report for the monthly count. The draft is kept in
 * this browser until a new report is started.
 */
export function ReportGenerator({onLogged}: {onLogged?: () => void}) {
  const {profile, user} = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState<ReportForm>(() => {
    if (!user) return emptyForm(profile);
    try {
      const saved = localStorage.getItem(draftKey(user.id));
      if (saved) return {...emptyForm(profile), ...JSON.parse(saved) as Partial<ReportForm>};
    } catch {
      // A broken draft starts a new report.
    }
    return emptyForm(profile);
  });
  const [view, setView] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState("");
  const [logging, setLogging] = useState(false);
  const [loggedFor, setLoggedFor] = useState<string | null>(null);
  const [monthCount, setMonthCount] = useState<number | null>(null);

  const code = useMemo(() => reportCode(form), [form]);
  const dateKey = reportDateKey(form.date);

  const refreshCount = useCallback(() => {
    if (!user) return;
    reportLog.count(monthKey(), user.id).then(setMonthCount).catch(() => undefined);
  }, [user]);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  // Keep the draft (a long description is not lost when the page is left).
  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => localStorage.setItem(draftKey(user.id), JSON.stringify(form)), 400);
    return () => window.clearTimeout(timer);
  }, [form, user]);

  // Data handed over by the penal code calculator.
  useEffect(() => {
    const prefill = (location.state as {prefill?: ReportPrefill} | null)?.prefill;
    if (!prefill) return;
    setForm((current) => ({...current, ...Object.fromEntries(Object.entries(prefill).filter(([, value]) => value !== undefined))}));
    toast.success("A kalkulátor adatai bekerültek a jelentésbe.");
    navigate(location.pathname + location.search, {replace: true, state: null});
  }, [location, navigate]);

  const set = (field: keyof ReportForm, value: string) => {
    setForm((current) => ({...current, [field]: value}));
    setCopied(false);
  };
  const setNumberOrDash = (field: "fine" | "jailTime", value: string) => {
    if (/^$|^-?$|^\d+$/.test(value)) set(field, value);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("BBCode a vágólapon. Illeszd be a fórumon a mappádba.");
  };

  const reset = () => {
    setForm(emptyForm(profile));
    setLink("");
    setCopied(false);
    setLoggedFor(null);
    if (user) localStorage.removeItem(draftKey(user.id));
    toast.info("Új jelentés.");
  };

  const record = async () => {
    if (!user) return;
    const occurredOn = dateKey ?? todayKey();
    const url = link.trim() ? normalizeForumUrl(link) : null;
    if (link.trim() && !url) return toast.error("Csak forum.hl-rpg.eu link adható meg.");
    const title = [form.suspectName.trim() || "Ismeretlen személy", form.charges.trim()].filter(Boolean).join(" – ").slice(0, 160);
    setLogging(true);
    try {
      await reportLog.add([{user_id: user.id, occurred_on: occurredOn, title, forum_url: url, source: "generator"}]);
      setLoggedFor(code);
      toast.success("Jelentés rögzítve a havi számodba.");
      refreshCount();
      onLogged?.();
    } catch (error) {
      toast.error(reportLogError(error));
    } finally {
      setLogging(false);
    }
  };

  const alreadyLogged = loggedFor === code;

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
      <div className="space-y-4">
        <Section index={0} number="I." title="Rendvédelmi személyek" icon={Shield}
                 action={<Button variant="ghost" size="sm" onClick={reset} className="text-slate-400 hover:text-red-300"><RotateCcw/> Űrlap ürítése</Button>}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.6fr)]">
            <Field label="Teljes név" icon={User}><Input value={form.officerName} onChange={(event) => set("officerName", event.target.value)}/></Field>
            <Field label="Rendfokozat" icon={Shield}><Input value={form.officerRank} onChange={(event) => set("officerRank", event.target.value)}/></Field>
            <Field label="Jelvényszám" icon={Hash}><Input value={form.badgeNumber} onChange={(event) => set("badgeNumber", event.target.value)} className="font-mono"/></Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Field label="Jelenlévő kollégák, rendfokozataik" icon={Users}>
              <Input value={form.colleagues} placeholder="pl. John Smith, Corporal" onChange={(event) => set("colleagues", event.target.value)}/>
            </Field>
            <Field label="Kezdeményező egység" icon={CarFront}>
              <Input value={form.unitId} placeholder="pl. 6-L-005" onChange={(event) => set("unitId", event.target.value)} className="font-mono"/>
            </Field>
          </div>
        </Section>

        <Section index={1} number="II." title="Előállított személy" icon={UserRound}>
          <Field label="Teljes név" icon={UserRound}><Input value={form.suspectName} onChange={(event) => set("suspectName", event.target.value)}/></Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Személyi igazolvány"><Input value={form.suspectIdCard} onChange={(event) => set("suspectIdCard", event.target.value)} className="font-mono"/></Field>
            <Field label="Jogosítvány"><Input value={form.suspectLicense} onChange={(event) => set("suspectLicense", event.target.value)} className="font-mono"/></Field>
            <Field label="Egészségügyi kártya"><Input value={form.suspectMedical} onChange={(event) => set("suspectMedical", event.target.value)} className="font-mono"/></Field>
          </div>
        </Section>

        <Section index={2} number="III." title="Előállítás részletei" icon={Scale}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Időpont (nap/hónap/év)" icon={CalendarDays} hint={dateKey ? undefined : "Nem olvasható dátum: a rögzítés a mai napra kerül."}>
              <Input value={form.date} onChange={(event) => set("date", event.target.value)} className="font-mono"/>
            </Field>
            <Field label="Bírság" icon={Gavel} hint="Csak a szám, vagy „-”">
              <Input value={form.fine} inputMode="numeric" placeholder="pl. 15000" onChange={(event) => setNumberOrDash("fine", event.target.value)}
                     className="font-mono text-emerald-300"/>
            </Field>
            <Field label="Szabadságvesztés (hónap)" icon={Timer} hint="Csak a szám, vagy „-”">
              <Input value={form.jailTime} inputMode="numeric" placeholder="pl. 30" onChange={(event) => setNumberOrDash("jailTime", event.target.value)}
                     className="font-mono text-red-300"/>
            </Field>
          </div>
          <Field label="Vétség / bűncselekmény" icon={Scale}>
            <Input value={form.charges} placeholder="pl. Gyorshajtás, rendőri utasítás megtagadása" onChange={(event) => set("charges", event.target.value)}/>
          </Field>
          <Field label="Lefoglalt tárgyak (megnevezés, darabszám)" icon={Lock}>
            <Input value={form.confiscatedItems} onChange={(event) => set("confiscatedItems", event.target.value)}/>
          </Field>
        </Section>

        <Section index={3} number="IV." title="Esetleírás" icon={ListChecks}>
          <Textarea value={form.description} onChange={(event) => set("description", event.target.value)} className="min-h-56 leading-relaxed"
                    placeholder="Mi történt, milyen sorrendben: a megállítás oka, az intézkedés menete, a gyanúsított viselkedése…"/>
          <p className="text-right text-[11px] text-slate-500 tabular-nums">{form.description.length} karakter</p>
        </Section>
      </div>

      <div className="space-y-4 xl:sticky xl:top-20">
        <section className="panel animate-rise overflow-hidden" style={{"--i": 1} as CSSProperties}>
          <header className="flex flex-wrap items-center gap-2 border-b border-white/5 px-4 py-3">
            <div className="inline-flex rounded-lg bg-white/[0.04] p-1 ring-1 ring-white/10">
              <button type="button" onClick={() => setView("preview")}
                      className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors", view === "preview" ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200")}>
                <Eye className="size-3.5"/> Előnézet
              </button>
              <button type="button" onClick={() => setView("code")}
                      className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors", view === "code" ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200")}>
                <Code2 className="size-3.5"/> BBCode
              </button>
            </div>
            <Button className="ml-auto" onClick={() => void copy()}>
              {copied ? <Check/> : <ClipboardCopy/>} {copied ? "Másolva" : "Másolás"}
            </Button>
          </header>
          <div className="max-h-[calc(100dvh-24rem)] min-h-80 overflow-y-auto bg-[#141b24]/70 p-4">
            {view === "preview" ? (
              <BbcodePreview source={code}/>
            ) : (
              <pre className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-emerald-200/85 wrap-anywhere">{code}</pre>
            )}
          </div>
          <p className="border-t border-white/5 px-4 py-2 text-[11px] text-slate-500">
            A fórum által előírt sablon: a kódot változtatás nélkül illeszd be. Az előnézet csak tájékoztató.
          </p>
        </section>

        <section className={cn("panel animate-rise p-4", alreadyLogged && "ring-1 ring-emerald-500/30")} style={{"--i": 2} as CSSProperties}>
          <div className="flex items-start gap-3">
            <div className={cn("grid size-10 shrink-0 place-items-center rounded-xl ring-1",
              alreadyLogged ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" : "bg-sky-500/10 text-sky-300 ring-sky-500/25")}>
              {alreadyLogged ? <Check className="size-5"/> : <ListChecks className="size-5"/>}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-white">{alreadyLogged ? "Rögzítve a havi számodba" : "Feltöltötted a fórumra?"}</h3>
              <p className="text-xs text-slate-400">
                {alreadyLogged
                  ? "A linket később is megadhatod a Jelentéseim fülön."
                  : "Rögzítsd, és beleszámít a havi jelentésszámodba (ebből számol a havi fizetés)."}
                {monthCount !== null && <> Ebben a hónapban: <span className="font-semibold text-white">{monthCount}</span> jelentés.</>}
              </p>
            </div>
          </div>
          {!alreadyLogged && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Link2 className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
                <Input value={link} onChange={(event) => setLink(event.target.value)} placeholder="Fórum-link (nem kötelező)" className="pl-9 font-mono text-xs"/>
              </div>
              <Button variant="outline" onClick={() => void record()} disabled={logging || !form.suspectName.trim() && !form.charges.trim()}>
                {logging ? <Loader2 className="animate-spin"/> : <ListChecks/>} Rögzítés
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Section({index, number, title, icon: Icon, action, children}: {
  index: number;
  number: string;
  title: string;
  icon: typeof Shield;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel animate-rise space-y-3 p-5" style={{"--i": index} as CSSProperties}>
      <header className="flex items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-300 ring-1 ring-sky-500/25"><Icon className="size-4"/></div>
        <h3 className="font-semibold text-white"><span className="mr-1.5 font-mono text-sky-300">{number}</span>{title}</h3>
        {action && <div className="ml-auto">{action}</div>}
      </header>
      {children}
    </section>
  );
}

function Field({label, icon: Icon, hint, children}: {label: string; icon?: typeof Shield; hint?: string; children: ReactNode}) {
  return (
    <div className="min-w-0 space-y-1">
      <Label className="flex items-center gap-1.5 text-xs text-slate-400">{Icon && <Icon className="size-3.5"/>}{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-slate-500">{hint}</p>}
    </div>
  );
}
