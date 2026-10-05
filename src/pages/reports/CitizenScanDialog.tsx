import {useCallback, useEffect, useRef, useState, type ClipboardEvent, type CSSProperties} from "react";
import {toast} from "sonner";
import {AlertTriangle, Check, CircleHelp, Lock, PenLine, ScanLine, ShieldAlert, Undo2, XCircle} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {ImageDropZone, imageFileProblem, pastedImage} from "@/components/scan/ImageDropZone";
import {ScanProgress} from "@/components/scan/ScanProgress";
import type {CitizenScan, CitizenScanStage} from "@/lib/citizen-ocr";
import {fullName} from "@/lib/citizen-ocr/parse";
import type {ReportForm} from "@/lib/report-templates";
import {cn} from "@/lib/utils";

export type ScannedFields = Pick<ReportForm, "suspectName" | "suspectIdCard" | "suspectLicense" | "suspectMedical">;
type ReportField = keyof ScannedFields;

type Step =
  | {kind: "pick"}
  | {kind: "scanning"; stage: CitizenScanStage; progress: number}
  | {kind: "result"}
  | {kind: "failed"};

const STAGES: {stage: CitizenScanStage; label: string}[] = [
  {stage: "loading", label: "Felismerő betöltése"},
  {stage: "locating", label: "Az adatlap keresése a képen"},
  {stage: "reading", label: "Adatok kiolvasása"},
  {stage: "done", label: "Kész"},
];

const ROWS: {field: ReportField; label: string; source: string}[] = [
  {field: "suspectName", label: "Teljes név", source: "Keresztnév + Vezetéknév"},
  {field: "suspectIdCard", label: "Személyi igazolvány", source: "Személyi"},
  {field: "suspectLicense", label: "Jogosítvány", source: "Jogosítvány"},
  {field: "suspectMedical", label: "Egészségügyi kártya", source: "Egészségügyi sorszáma"},
];

interface RowState {
  value: string;
  /** Read from the picture (false: nothing found, type it in). */
  found: boolean;
  /** The readings disagreed, or only part of the name was found. */
  doubtful: boolean;
  previews: string[];
}

function rowsOf(scan: CitizenScan): Record<ReportField, RowState> {
  const {firstName, lastName, idCard, license, medical} = scan;
  const single = (result: CitizenScan["idCard"]): RowState => ({
    value: result.value ?? "", found: !!result.value, doubtful: !!result.value && !result.certain, previews: result.preview ? [result.preview] : [],
  });
  const name = fullName(firstName.value, lastName.value);
  return {
    suspectName: {
      value: name,
      found: !!name,
      doubtful: !!name && (!firstName.value || !lastName.value || !firstName.certain || !lastName.certain),
      previews: [firstName.preview, lastName.preview].filter((preview): preview is string => !!preview),
    },
    suspectIdCard: single(idCard),
    suspectLicense: single(license),
    suspectMedical: single(medical),
  };
}

/**
 * The "Polgárok" page of the in-game tablet read from a screenshot, for the report's person
 * data. The picture stays in the browser: it is read locally and dropped right after (only the
 * cut-out value boxes are shown until the dialog closes, to compare with the reading).
 */
export function CitizenScanDialog({open, onOpenChange, onApply}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (values: Partial<ScannedFields>) => void;
}) {
  const [step, setStep] = useState<Step>({kind: "pick"});
  const [preview, setPreview] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<ReportField, RowState> | null>(null);
  const runRef = useRef(0);

  // An early start of the OCR engine while the screenshot is being chosen.
  useEffect(() => {
    if (open) void import("@/lib/citizen-ocr").then((module) => module.warmUpOcr()).catch(() => undefined);
  }, [open]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const reset = () => {
    runRef.current += 1;
    setStep({kind: "pick"});
    setPreview(null);
    setRows(null);
  };

  const scan = useCallback(async (picked: File) => {
    const problem = imageFileProblem(picked);
    if (problem) return toast.error(problem);
    const run = ++runRef.current;
    setRows(null);
    setPreview(URL.createObjectURL(picked));
    setStep({kind: "scanning", stage: "loading", progress: 0});
    try {
      const {readCitizen} = await import("@/lib/citizen-ocr");
      const result = await readCitizen(picked, {
        onStage: (stage) => run === runRef.current && setStep({kind: "scanning", stage, progress: 0}),
        onProgress: (progress) => run === runRef.current
          && setStep((prev) => (prev.kind === "scanning" ? {...prev, progress} : prev)),
      });
      if (run !== runRef.current) return;
      const next = rowsOf(result);
      setRows(next);
      setStep(Object.values(next).some((row) => row.found) ? {kind: "result"} : {kind: "failed"});
    } catch (error) {
      console.error("Citizen OCR failed:", error);
      if (run === runRef.current) setStep({kind: "failed"});
    } finally {
      // The screenshot is not needed any more.
      if (run === runRef.current) setPreview(null);
    }
  }, []);

  const onPaste = (event: ClipboardEvent) => {
    const pasted = pastedImage(event);
    if (pasted && step.kind !== "scanning") {
      event.preventDefault();
      void scan(pasted);
    }
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const apply = () => {
    if (!rows) return;
    const values = Object.fromEntries(ROWS.map(({field}) => [field, rows[field].value.trim()]).filter(([, value]) => value)) as Partial<ScannedFields>;
    if (!Object.keys(values).length) return toast.error("Nincs beírható adat: töltsd ki kézzel az űrlapot.");
    onApply(values);
    const missing = ROWS.filter(({field}) => !rows[field].value.trim()).map((row) => row.label);
    toast.warning("Ellenőrizd az átvett adatokat!", {
      description: `A jelentés helyességéért te felelsz.${missing.length ? ` Kézzel írd be: ${missing.join(", ")}.` : ""}`,
      duration: 8000,
    });
    close();
  };

  const missing = rows ? ROWS.filter(({field}) => !rows[field].found) : [];
  const doubtful = rows ? ROWS.filter(({field}) => rows[field].doubtful) : [];

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-xl" onPaste={onPaste}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ScanLine className="size-5 text-primary"/> Kitöltés képről</DialogTitle>
          <DialogDescription>A rendőrségi tablet „Polgárok” oldaláról: név, személyi, jogosítvány és egészségügyi sorszám.</DialogDescription>
        </DialogHeader>

        {step.kind === "pick" ? (
          <div key="pick" className="animate-fade space-y-3">
            <ImageDropZone title="Tölts fel képernyőképet a személy adatlapjáról" onFile={(file) => void scan(file)}
                           hint="Kattints, húzd ide, vagy illeszd be (Ctrl+V). Kivágott kép is jó, ha a feliratok látszanak."/>
            <p className="flex items-start gap-2 rounded-xl bg-emerald-500/[0.06] px-3 py-2 text-xs text-emerald-200/90 ring-1 ring-emerald-500/20">
              <Lock className="mt-0.5 size-3.5 shrink-0"/>
              A kép nem kerül fel sehova: a felismerés a böngésződben fut, és a képet a beolvasás után azonnal eldobjuk.
            </p>
          </div>
        ) : step.kind === "scanning" ? (
          <ScanProgress key="scanning" preview={preview} stages={STAGES} stage={step.stage} progress={step.progress}
                        progressStages={["locating", "reading"]}/>
        ) : step.kind === "failed" || !rows ? (
          <div key="failed" className="animate-fade space-y-4">
            <div className="flex items-start gap-3 rounded-2xl bg-red-500/[0.08] p-4 ring-1 ring-red-500/25">
              <XCircle className="mt-0.5 size-5 shrink-0 text-red-300"/>
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold text-red-100">Nem sikerült adatot kiolvasni a képből.</p>
                <p className="text-sm text-red-200/80">Írd be kézzel az adatokat az űrlapba.</p>
              </div>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-400">
              <li className="flex gap-2"><CircleHelp className="mt-0.5 size-3.5 shrink-0 text-slate-500"/> A kép a tablet „Polgárok” oldalát mutassa, a feliratokkal együtt (Keresztnév, Személyi, …).</li>
              <li className="flex gap-2"><CircleHelp className="mt-0.5 size-3.5 shrink-0 text-slate-500"/> Eredeti méretű képernyőképet használj: a kicsinyített, elmosódott képen a betűk nem olvashatók.</li>
            </ul>
            <DialogFooter>
              <Button variant="ghost" onClick={close}>Kézzel írom be</Button>
              <Button variant="outline" onClick={reset}><Undo2/> Másik kép</Button>
            </DialogFooter>
          </div>
        ) : (
          <div key="result" className="animate-fade min-w-0 space-y-4">
            {missing.length > 0 ? (
              <p className="flex items-start gap-2 rounded-xl bg-amber-500/[0.08] px-3 py-2.5 text-sm text-amber-100 ring-1 ring-amber-500/25">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300"/>
                <span className="min-w-0">
                  Nem minden adatot sikerült kiolvasni. <span className="font-semibold">Kézzel írd be:</span> {missing.map((row) => row.label).join(", ")}.
                </span>
              </p>
            ) : (
              <p className="flex items-center gap-2 rounded-xl bg-emerald-500/[0.08] px-3 py-2.5 text-sm text-emerald-100 ring-1 ring-emerald-500/25">
                <Check className="size-4 shrink-0 text-emerald-300"/> Minden adatot kiolvastunk.
              </p>
            )}

            <ul className="space-y-2">
              {ROWS.map((row, index) => {
                const state = rows[row.field];
                return (
                  <li key={row.field} style={{"--i": index} as CSSProperties}
                      className={cn("animate-rise min-w-0 space-y-2 rounded-xl bg-white/[0.03] p-3 ring-1",
                        !state.found ? "ring-red-500/25" : state.doubtful ? "ring-amber-500/35" : "ring-white/5")}>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-sm font-medium text-slate-200">{row.label}</span>
                      <span className="text-[11px] text-slate-500">a képen: {row.source}</span>
                      <span className="ml-auto text-[11px]">
                        {!state.found ? <span className="text-red-300">Nem olvasható: írd be kézzel</span>
                          : state.doubtful ? <span className="text-amber-300">Bizonytalan: nézd meg alaposan</span>
                            : <span className="text-emerald-300">Kiolvasva</span>}
                      </span>
                    </div>
                    {state.previews.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {state.previews.map((source, previewIndex) => (
                          <img key={previewIndex} src={source} alt={`${row.label} a képen`}
                               className="max-h-9 max-w-full rounded-md bg-black/40 object-contain ring-1 ring-white/10"/>
                        ))}
                      </div>
                    )}
                    <Input value={state.value} aria-label={row.label} placeholder="Írd be kézzel"
                           className={cn(row.field !== "suspectName" && "font-mono")}
                           onChange={(event) => setRows((prev) => prev && ({...prev, [row.field]: {...prev[row.field], value: event.target.value}}))}/>
                  </li>
                );
              })}
            </ul>

            <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2.5 text-xs text-amber-100 ring-1 ring-amber-500/30">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-300"/>
              <span className="min-w-0">
                <span className="font-semibold">Mindig ellenőrizd az adatokat</span> a játékban látottakkal: a gépi felismerés tévedhet
                (pl. 8 és B, 0 és D), és a jelentés helyességéért te felelsz.
                {doubtful.length > 0 && <> Különösen: {doubtful.map((row) => row.label).join(", ")}.</>}
              </span>
            </p>

            <DialogFooter>
              <Button variant="ghost" onClick={reset}><Undo2/> Másik kép</Button>
              <Button onClick={apply}><PenLine/> Beírás az űrlapba</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
