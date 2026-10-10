import {useState, type ReactNode} from "react";
import {toast} from "sonner";
import {CheckCircle2, ListChecks, Loader2, Sparkles, TriangleAlert, Undo2, X} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";
import {postApi} from "@/lib/api";
import type {ReportForm} from "@/lib/report-templates";
import {cn, errorMessage} from "@/lib/utils";
import type {PenalAbbreviation} from "@shared/penal-abbreviations";
import {
  DESCRIPTION_CHECKLIST, descriptionLetters, MIN_DESCRIPTION_LETTERS, type AssistForm, type AssistMode, type AssistResult,
} from "@shared/report-assist";

/** The report's data the description has to match: the writer's name and rank tell "I" from the colleagues (never the badge). */
const assistForm = (form: ReportForm): AssistForm => ({
  officerName: form.officerName, officerRank: form.officerRank, date: form.date, unitId: form.unitId, colleagues: form.colleagues, suspectName: form.suspectName, charges: form.charges,
  fine: form.fine, jailTime: form.jailTime, confiscatedItems: form.confiscatedItems,
});

type CodeLookup = (form: ReportForm) => PenalAbbreviation[];
let codeLookup: Promise<CodeLookup> | null = null;

/**
 * The offences behind the penal code abbreviations of the report ("GV", "GYO/III."): the model gets
 * only these, never the whole code. The code and the lookup load with the first request (the form
 * does not need them otherwise); without them the request goes without abbreviations.
 */
async function penalCodes(form: ReportForm): Promise<PenalAbbreviation[]> {
  codeLookup ??= Promise.all([import("@shared/penal-abbreviations"), import("@/data/penalcode.json")]).then(([module, data]) => {
    const index = module.abbreviationIndex(data.default);
    return (report: ReportForm) => module.reportAbbreviations(index, {charges: report.charges, description: report.description});
  });
  try {
    return (await codeLookup)(form);
  } catch {
    codeLookup = null;
    return [];
  }
}

interface Outcome {
  mode: AssistMode;
  missing: string[];
  /** reword: the check that ran with it (absent from an older server). */
  review?: string[];
  /** reword: what the AI added that the member never wrote (no model gave a clean answer). */
  added?: string[];
  codes: PenalAbbreviation[];
}

const CHECK_HINT = "Átnézi a leírásodat a jelentés adataival együtt, és felsorolja, mi hiányzik belőle vagy mi nem egyezik "
  + "(pl. az intézkedés oka, a helyszín, a személy viselkedése, a lefoglalt tárgyak, a vádpontok). A szövegedet nem írja át. Átfogalmazás után magától is lefut.";
const REWORD_HINT = "Hivatalos nyelvre fogalmazza a leírásodat, és kijavítja a helyesírást; új eseményt vagy részletet nem ír bele. "
  + "Utána magától ellenőrzi is, és megmutatja, mi hiányzik még. A Btk.-rövidítéseket (pl. GV, GYO/III.) a Btk. szerinti névvel írja ki.";

/** A tooltip that also works on a disabled button (the button lets the pointer through to the wrapper). */
function Hint({text, children}: {text: string; children: ReactNode}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild><span className="inline-flex">{children}</span></TooltipTrigger>
      <TooltipContent className="max-w-72 text-left leading-relaxed">{text}</TooltipContent>
    </Tooltip>
  );
}

/**
 * The case description's AI helper (api/report/assist.ts, Google Gemini on its free tier). The member
 * writes the whole description (the owners' rule): "Átfogalmazás" only puts their own text into
 * official Hungarian and adds nothing (a required part they left out is marked), then shows the
 * check of the result in the same answer (members forgot to press "Ellenőrzés" afterwards);
 * "Ellenőrzés" alone lists what the text lacks. Nothing is ever blocked: the member reads, corrects and copies.
 */
export function DescriptionAssistant({form, onReplace}: {form: ReportForm; onReplace: (text: string) => void}) {
  const [busy, setBusy] = useState<AssistMode | null>(null);
  const [result, setResult] = useState<Outcome | null>(null);
  const [previous, setPrevious] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const written = descriptionLetters(form.description) >= MIN_DESCRIPTION_LETTERS;

  const run = async (mode: AssistMode) => {
    setBusy(mode);
    try {
      const codes = await penalCodes(form);
      const answer = await postApi<AssistResult>("/api/report/assist", {mode, form: assistForm(form), codes, description: form.description});
      setRemaining(answer.remaining);
      if (mode === "reword" && answer.text) {
        setPrevious(form.description);
        onReplace(answer.text);
      }
      setResult({mode, missing: answer.missing, review: answer.review, added: answer.added, codes});
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const undo = () => {
    if (previous === null) return;
    onReplace(previous);
    setPrevious(null);
    setResult(null);
  };

  const reworded = result?.mode === "reword";
  const review = result?.review ?? [];
  const added = result?.added ?? [];
  const gaps = result ? result.missing.length + review.length + added.length : 0;
  const title = !result ? "" : reworded
    ? result.missing.length
      ? "Átfogalmaztam. Írd bele, ami hiányzik (a szövegben [HIÁNYZIK: …] jelöli):"
      : result.review === undefined ? "Átfogalmaztam. Olvasd át, és javítsd, ahol rosszul értettem."
        : review.length ? "Átfogalmaztam és ellenőriztem. Olvasd át, és javítsd, ahol rosszul értettem."
          : "Átfogalmaztam és ellenőriztem: nem találtam hiányzó részt. Olvasd át, és javítsd, ahol rosszul értettem."
    : result.missing.length ? "Ezek hiányoznak vagy nem egyértelműek:" : "Nem találtam hiányzó részt.";

  return (
    <div data-tour="report-assist" className="space-y-2.5 rounded-xl bg-violet-500/[0.05] p-3 ring-1 ring-violet-400/20">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 grow basis-56 items-center gap-2">
          <Sparkles className="size-4 shrink-0 text-violet-300"/>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-100">AI segéd</p>
            <p className="text-[11px] text-slate-500">
              Hivatalos nyelvre fogalmazza, amit írtál, és megnézi, mi hiányzik belőle.{remaining !== null && ` Ma még ${remaining} kérés.`}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Hint text={CHECK_HINT}>
            <Button type="button" size="sm" variant="outline" disabled={!!busy || !written} onClick={() => void run("check")}>
              {busy === "check" ? <Loader2 className="animate-spin"/> : <ListChecks/>} Ellenőrzés
            </Button>
          </Hint>
          <Hint text={REWORD_HINT}>
            <Button type="button" size="sm" disabled={!!busy || !written} onClick={() => void run("reword")} className="bg-violet-500 text-white hover:bg-violet-400">
              {busy === "reword" ? <Loader2 className="animate-spin"/> : <Sparkles/>} Átfogalmazás
            </Button>
          </Hint>
        </div>
      </div>

      <p className="text-xs text-slate-300">
        <span className="font-medium text-white">Az esetleírást neked kell megírnod, a saját szavaiddal.</span>{" "}
        Az AI csak átfogalmazza és kijavítja a helyesírást: új eseményt, részletet nem írhat bele, ami kimaradt, azt neked kell pótolnod.
        Átfogalmazás után magától ellenőrzi is, mi hiányzik még.
      </p>
      <p className="text-[11px] text-slate-400"><span className="text-slate-300">Írd bele:</span> {DESCRIPTION_CHECKLIST.join(" · ")}.</p>
      {!written && <p className="text-[11px] text-slate-500">Az AI segéd akkor használható, ha már megírtad az esetleírást (legalább pár mondatot).</p>}
      {busy === "reword" && <p className="text-[11px] text-violet-200/80">Átfogalmazom és ellenőrzöm, ez néhány másodperc…</p>}

      {result && (
        <div className={cn("space-y-1 rounded-lg px-3 py-2 text-xs ring-1",
          gaps ? "bg-amber-500/[0.07] text-amber-100 ring-amber-500/25" : "bg-emerald-500/[0.07] text-emerald-100 ring-emerald-500/25")}>
          <div className="flex items-start gap-2">
            {gaps ? <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-300"/> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300"/>}
            <p className="min-w-0 flex-1 font-medium">{title}</p>
            <div className="-my-1 flex shrink-0 items-center gap-1">
              {reworded && previous !== null && (
                <Button type="button" size="sm" variant="ghost" onClick={undo} aria-label="Visszavonás" className="h-7 px-2 text-xs">
                  <Undo2/><span className="max-sm:hidden">Visszavonás</span>
                </Button>
              )}
              <button type="button" onClick={() => setResult(null)} aria-label="Bezárás" className="rounded p-1 text-slate-400 hover:text-white">
                <X className="size-3.5"/>
              </button>
            </div>
          </div>
          {/* The lists use the whole width under the title (a phone has no room beside the buttons). */}
          <div className="min-w-0 space-y-1 pl-6">
            {added.length > 0 && (
              <p className="rounded-md bg-red-500/10 px-2 py-1.5 font-medium text-red-100 ring-1 ring-red-500/30 wrap-anywhere">
                Az AI olyat is beleírt, ami nincs a leírásodban: {added.map((item) => `„${item}”`).join(", ")}. Töröld a szövegből, vagy vond vissza az átfogalmazást.
              </p>
            )}
            {result.missing.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-4 wrap-anywhere">
                {result.missing.map((item) => <li key={item}>{item}</li>)}
              </ul>
            )}
            {review.length > 0 && (
              <>
                <p className="pt-1 font-medium">Az ellenőrzés szerint még erre figyelj:</p>
                <ul className="list-disc space-y-0.5 pl-4 wrap-anywhere">
                  {review.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </>
            )}
            {result.codes.length > 0 && (
              <p className="pt-1 text-[11px] text-slate-400 wrap-anywhere">
                Rövidítések a Btk. szerint: {result.codes.map((code) => `${code.abbr} = ${code.names.join(" vagy ")}`).join(" · ")}
              </p>
            )}
          </div>
        </div>
      )}

      <p className="text-[11px] text-slate-500">
        Az AI hibázhat: olvasd át, és csak az maradjon benne, ami valóban történt. A leírásod és a jelentés adatai (a neveddel és a rangoddal, de a
        jelvényszámod nélkül) a Google Gemini szolgáltatáshoz kerülnek.
      </p>
    </div>
  );
}
