import {useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode} from "react";
import {Link, useLocation, useNavigate, useSearchParams} from "react-router";
import {toast} from "sonner";
import {
  ArrowRight, CalendarDays, CarFront, Check, ClipboardCopy, Code2, Eye, FilePlus2, FolderOpen, Gavel, Hash, ListChecks, Loader2, Lock, RotateCcw,
  Save, Scale, ScanLine, Shield, Timer, TriangleAlert, User, UserRound, Users,
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {BbcodePreview} from "@/components/BbcodePreview";
import {useAuth} from "@/context/AuthContext";
import {formatStandardDate, monthKey} from "@/lib/datetime";
import {normalizeForumUrl, reportCode, reportDateKey, type ReportForm} from "@/lib/report-templates";
import {
  hasReportContent, lastFolder, periodLabel, rememberFolder, reportError, reportForm as formOfReport, reportNumber, reportsApi,
} from "@/lib/reports";
import {cn} from "@/lib/utils";
import {MISSING_MARKER} from "@shared/report-assist";
import {CitizenScanDialog, type ScannedFields} from "./CitizenScanDialog";
import {DescriptionAssistant} from "./DescriptionAssistant";

/** What the penal code calculator hands over ("Jelentés készítése"). */
export interface ReportPrefill {
  charges?: string;
  fine?: string;
  jailTime?: string;
}

const draftKey = (userId: string) => `frakhub.report.draft.${userId}`;

/** A draft comes back only on a visit within this time after the page was left; an older one is wiped. */
const DRAFT_KEEP_MS = 10 * 60_000;

/** The report on the site the form belongs to: its BBCode when it was saved tells whether it changed since. */
interface SavedReport {
  id: string;
  number: number;
  period: string;
  code: string;
  link: string | null;
  /** Its month was paid (or it is someone else's): it can be copied, not saved. */
  locked?: boolean;
}

/**
 * The stored draft: the form, whether its date was typed in (otherwise it is always today), the
 * saved report it belongs to, and when it was last stored (the page stores it once more when left).
 */
type Draft = Partial<ReportForm> & {dateEdited?: boolean; savedAt?: number; report?: SavedReport | null};

const storeDraft = (userId: string, draft: Draft) =>
  localStorage.setItem(draftKey(userId), JSON.stringify({...draft, savedAt: Date.now()} satisfies Draft));

type ProfileFields = {full_name: string; faction_rank: string; badge_number: string} | null;

const emptyForm = (profile: ProfileFields): ReportForm => ({
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

function restoreDraft(userId: string | undefined, profile: ProfileFields): {form: ReportForm; dateEdited: boolean; report: SavedReport | null} {
  const fresh = emptyForm(profile);
  if (!userId) return {form: fresh, dateEdited: false, report: null};
  try {
    const saved = localStorage.getItem(draftKey(userId));
    if (saved) {
      const {dateEdited = false, savedAt, report = null, ...fields} = JSON.parse(saved) as Draft;
      if (typeof savedAt === "number" && Date.now() - savedAt <= DRAFT_KEEP_MS) {
        // A date nobody typed in is the day the draft was saved: it follows today instead.
        return {form: {...fresh, ...fields, ...(dateEdited ? {} : {date: fresh.date})}, dateEdited, report};
      }
      // An earlier report (or a draft without its time): the next visit starts an empty one.
      localStorage.removeItem(draftKey(userId));
    }
  } catch {
    // A broken draft starts a new report.
  }
  return {form: fresh, dateEdited: false, report: null};
}

/**
 * The forum report: a form for the template's fields, the exact BBCode (and a preview of how the
 * forum shows it), and the report saved on the site: copying the code saves it too (later changes
 * update the same report), it counts for its author's payroll month and every member reads it. The
 * draft is kept in this browser for a visit within 10 minutes after the page was left (an older
 * one is wiped); its date is today's unless it was typed in. `?edit=<id>` opens a saved report.
 */
export function ReportGenerator({onSaved}: {onSaved?: () => void}) {
  const {profile, user} = useAuth();
  const userId = user?.id;
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const [draft] = useState(() => restoreDraft(userId, profile));
  const [form, setForm] = useState<ReportForm>(draft.form);
  const [dateEdited, setDateEdited] = useState(draft.dateEdited);
  const [report, setReport] = useState<SavedReport | null>(draft.report);
  // What the page holds, for the save when the page is left.
  const latest = useRef<Draft>({...draft.form, dateEdited: draft.dateEdited, report: draft.report});
  const [view, setView] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState(draft.report?.link ?? "");
  const [linkMonth, setLinkMonth] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [period, setPeriod] = useState<{period: string; mine: number} | null>(null);
  const [scanning, setScanning] = useState(false);

  const code = useMemo(() => reportCode(form), [form]);
  const dateKey = reportDateKey(form.date);
  const changed = !report || report.code !== code;

  // The month the reports count for now, and the member's count in it.
  useEffect(() => {
    if (!user) return;
    let active = true;
    reportsApi.period().then((state) => active && setPeriod(state)).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [user]);

  // The folder link: the same for every report of the month.
  useEffect(() => {
    if (!user) return;
    let active = true;
    lastFolder(user.id).then((folder) => {
      if (!active || !folder) return;
      setLink((current) => current || folder.url);
      setLinkMonth(folder.month);
    }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [user]);

  // A saved report opened for editing (from its page): the form takes its fields.
  useEffect(() => {
    if (!editId) return;
    let active = true;
    reportsApi.get(editId).then((saved) => {
      if (!active) return;
      const fields = formOfReport(saved);
      setForm(fields);
      setDateEdited(true);
      setCopied(false);
      setReport({id: saved.id, number: saved.number, period: saved.period, code: reportCode(fields), link: saved.forum_url, locked: !saved.can_edit});
      if (saved.forum_url) setLink(saved.forum_url);
      if (!saved.can_edit) {
        toast.info(saved.locked ? "Ennek a jelentésnek a hónapja a fizetéskor lezárult: másolni lehet, módosítani nem." : "Csak a saját jelentésedet módosíthatod.");
      }
    }).catch((error) => toast.error(reportError(error))).finally(() => {
      if (active) {
        setSearchParams((current) => {
          const next = new URLSearchParams(current);
          next.delete("edit");
          return next;
        }, {replace: true});
      }
    });
    return () => {
      active = false;
    };
  }, [editId, setSearchParams]);

  // Keep the draft (a long description is not lost when the page is left): shortly after a change,
  // and when the page or the tab is left, which also stamps the time the next visit is measured from.
  useEffect(() => {
    latest.current = {...form, dateEdited, report};
    if (!userId) return;
    const timer = window.setTimeout(() => storeDraft(userId, {...form, dateEdited, report}), 400);
    return () => window.clearTimeout(timer);
  }, [form, dateEdited, report, userId]);

  useEffect(() => {
    if (!userId) return;
    const leave = () => storeDraft(userId, latest.current);
    const hidden = () => {
      if (document.visibilityState === "hidden") leave();
    };
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", hidden);
      leave();
    };
  }, [userId]);

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

  // Data read from a screenshot of the in-game tablet (only what was found or typed in the dialog).
  const applyScanned = (values: Partial<ScannedFields>) => {
    setForm((current) => ({...current, ...values}));
    setCopied(false);
  };

  const linkUrl = link.trim() ? normalizeForumUrl(link) : null;
  const linkInvalid = link.trim() !== "" && linkUrl === null;
  const canSave = hasReportContent(form) && !report?.locked;

  /** Saves the report (new, or the same one again); the result, or null when nothing was saved. */
  const save = async () => {
    if (!user || saving || !canSave) return null;
    if (linkInvalid) {
      toast.error("Csak forum.hl-rpg.eu link adható meg.");
      return null;
    }
    const savedCode = code;
    setSaving(true);
    try {
      const result = await reportsApi.save(report?.id ?? null, form, linkUrl);
      setReport({id: result.id, number: result.number, period: result.period, code: savedCode, link: result.forum_url});
      setPeriod({period: result.period, mine: result.period_count});
      if (linkUrl) {
        rememberFolder(user.id, linkUrl);
        setLinkMonth(monthKey());
      }
      onSaved?.();
      return result;
    } catch (error) {
      toast.error(reportError(error));
      return null;
    } finally {
      setSaving(false);
    }
  };

  // Copying is the moment the report is done: it is saved too (or its changes).
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    const result = canSave && changed ? await save() : null;
    toast.success(result
      ? `BBCode a vágólapon, a jelentés mentve (${reportNumber(result.number)}). Illeszd be a fórumon a mappádba.`
      : "BBCode a vágólapon. Illeszd be a fórumon a mappádba.");
  };

  const saveNow = async () => {
    const result = await save();
    if (result) toast.success(`Jelentés mentve (${reportNumber(result.number)}).`);
  };

  // The forum link of a report already saved (it may be added after the month was paid, too).
  const saveLink = async () => {
    if (!report || linkInvalid) return;
    setSaving(true);
    try {
      const result = await reportsApi.setLink(report.id, linkUrl);
      setReport((current) => current && {...current, link: result.forum_url});
      if (linkUrl && user) rememberFolder(user.id, linkUrl);
      toast.success("Fórum link mentve.");
    } catch (error) {
      toast.error(reportError(error));
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setForm(emptyForm(profile));
    setDateEdited(false);
    setCopied(false);
    setReport(null);
    if (user) localStorage.removeItem(draftKey(user.id));
    toast.info("Új jelentés.");
  };

  const upToDate = !!report && !changed;
  const linkChanged = !!report && (linkUrl ?? null) !== (report.link ?? null);

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
      <CitizenScanDialog open={scanning} onOpenChange={setScanning} onApply={applyScanned}/>
      <div data-tour="report-form" className="space-y-4">
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

        <Section index={1} number="II." title="Előállított személy" icon={UserRound}
                 action={<Button variant="outline" size="sm" onClick={() => setScanning(true)} data-tour="report-scan"><ScanLine/> Kitöltés képről</Button>}>
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
              <Input value={form.date} aria-label="Időpont" onChange={(event) => {
                set("date", event.target.value);
                setDateEdited(true);
              }} className="font-mono"/>
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
                    lang="hu" spellCheck aria-label="Esetleírás"
                    placeholder="Mi történt, milyen sorrendben? Írd le a saját szavaiddal: miért intézkedtél, hol és mikor, mit tettél, hogyan viselkedett a személy, mit találtál, hogyan zárult."/>
          <p className="text-right text-[11px] text-slate-500 tabular-nums">{form.description.length} karakter</p>
          <DescriptionAssistant form={form} onReplace={(text) => set("description", text)}/>
        </Section>
      </div>

      <div data-tour="report-output" className="space-y-4 xl:sticky xl:top-20">
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
          {MISSING_MARKER.test(form.description) && (
            <p className="flex items-center gap-1.5 border-t border-amber-500/20 bg-amber-500/[0.06] px-4 py-2 text-[11px] text-amber-200">
              <TriangleAlert className="size-3.5 shrink-0"/> Az esetleírásban maradt pótolandó rész ([HIÁNYZIK: …]).
            </p>
          )}
          <p className="border-t border-white/5 px-4 py-2 text-[11px] text-slate-500">
            A fórum által előírt sablon: a kódot változtatás nélkül illeszd be. Az előnézet csak tájékoztató.
          </p>
        </section>

        <section data-tour="report-save" className={cn("panel animate-rise p-4", upToDate && !report?.locked && "ring-1 ring-emerald-500/30")}
                 style={{"--i": 2} as CSSProperties}>
          <div className="flex items-start gap-3">
            <div className={cn("grid size-10 shrink-0 place-items-center rounded-xl ring-1",
              report?.locked ? "bg-slate-500/15 text-slate-300 ring-white/10"
                : upToDate ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" : "bg-sky-500/10 text-sky-300 ring-sky-500/25")}>
              {report?.locked ? <Lock className="size-5"/> : upToDate ? <Check className="size-5"/> : <ListChecks className="size-5"/>}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-white">
                {report?.locked ? `Lezárt jelentés: ${reportNumber(report.number)}`
                  : report && !changed ? `Mentve: ${reportNumber(report.number)}`
                  : report ? `Változtattál a mentés óta (${reportNumber(report.number)})` : "Mentés a jelentéseid közé"}
              </h3>
              <p className="text-xs text-slate-400">
                {report?.locked
                  ? "A hónapja a fizetéskor lezárult: a kódot másolhatod, módosítani nem lehet."
                  : report && !changed
                    ? <>A {periodLabel(report.period)}i elszámolásba számít, és mindenki látja a Jelentések között. A fórumra ugyanúgy töltsd fel.</>
                    : "A másolás el is menti: a jelentés a nevedre kerül, beleszámít a havi elszámolásba, és mindenki látja a Jelentések között. A fórumra ugyanúgy fel kell töltened."}
                {period && <> Ebben az elszámolásban ({periodLabel(period.period)}): <span className="font-semibold text-white">{period.mine}</span> jelentésed.</>}
              </p>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <div className="relative">
              <FolderOpen className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
              <Input value={link} onChange={(event) => setLink(event.target.value)} aria-label="Fórum link" aria-invalid={linkInvalid}
                     placeholder="Fórum link: a mappád vagy a hozzászólásod (nem kötelező)"
                     className={cn("pl-9 font-mono text-xs", linkInvalid && "ring-2 ring-red-500/60")}/>
            </div>
            {link && linkMonth && linkMonth !== monthKey() && (
              <p className="text-[11px] text-amber-300">Ez a múlt havi mappád linkje: ha új hónapra új mappát nyitottál, cseréld le.</p>
            )}
            <div className="flex flex-wrap gap-2">
              {!upToDate && !report?.locked && (
                <Button onClick={() => void saveNow()} disabled={saving || !canSave}>
                  {saving ? <Loader2 className="animate-spin"/> : <Save/>} {report ? "Változások mentése" : "Mentés"}
                </Button>
              )}
              {upToDate && linkChanged && (
                <Button variant="outline" onClick={() => void saveLink()} disabled={saving || linkInvalid}>
                  {saving ? <Loader2 className="animate-spin"/> : <FolderOpen/>} Link mentése
                </Button>
              )}
              {report && (
                <Button variant="outline" asChild>
                  <Link to={`/reports/${report.id}`}>Megnyitás <ArrowRight/></Link>
                </Button>
              )}
              {report && (
                <Button variant="ghost" onClick={reset} className="text-slate-300"><FilePlus2/> Új jelentés</Button>
              )}
            </div>
          </div>
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
