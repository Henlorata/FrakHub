import {useEffect, useMemo, useRef, useState, type ClipboardEvent, type CSSProperties} from "react";
import {toast} from "sonner";
import {Check, CircleHelp, ImagePlus, Lock, PenLine, ScanLine, ShieldAlert, Undo2, X, XCircle} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {ImageDropZone, imageFileProblem, pastedImage} from "@/components/scan/ImageDropZone";
import {ScanProgress} from "@/components/scan/ScanProgress";
import type {DutyScanRow, DutyScanStage} from "@/lib/duty-ocr";
import {judgeDutyScan, MAX_MINUTES, mergeDutyRows, type DutyStatus} from "@/lib/duty-ocr/parse";
import {formatDuty, monthLabel} from "@/lib/registry";
import {cn} from "@/lib/utils";
import type {HrMember} from "../useHrData";

/** What the sheet takes over: a value per member, and how sure the reading is. */
export interface ScannedDuty {
  userId: string;
  minutes: number | null;
  status: DutyStatus;
}

interface Picture {
  id: string;
  file: File;
  url: string;
}

interface Row {
  key: string;
  name: string;
  memberId: string | null;
  fuzzyName: boolean;
  /** As typed in the review (minutes). */
  value: string;
  /** How sure the number is, as read. */
  readingStatus: DutyStatus;
  /** The value was typed or corrected by hand. */
  valueEdited: boolean;
  namePreview: string | null;
  valuePreview: string | null;
}

type Step =
  | {kind: "pick"}
  | {kind: "scanning"; stage: DutyScanStage; picture: number; progress: number}
  | {kind: "result"}
  | {kind: "rejected"; reason: string};

const MAX_PICTURES = 12;
const NONE = "none";

const STATUS_LOOK: Record<DutyStatus, {label: string; ring: string; text: string}> = {
  ok: {label: "Kiolvasva", ring: "ring-white/5", text: "text-emerald-300"},
  doubtful: {label: "Bizonytalan: ellenőrizd", ring: "ring-amber-500/40", text: "text-amber-300"},
  missing: {label: "Nem olvasható: írd be kézzel", ring: "ring-red-500/50", text: "text-red-300"},
};
const ORDER: Record<DutyStatus, number> = {missing: 0, doubtful: 1, ok: 2};

const parseMinutesInput = (value: string) => {
  const trimmed = value.trim();
  if (!/^\d{1,5}$/.test(trimmed)) return null;
  const minutes = Number(trimmed);
  return minutes <= MAX_MINUTES ? minutes : null;
};

/**
 * The members' duty time read from screenshots of the game's control panel (UCP, "Frakció
 * tagok"). Several pictures at once; they stay in the browser and are dropped after reading.
 * Nothing is saved here: the values go into the sheet, where the member saves them.
 */
export function DutyScanDialog({open, onOpenChange, members, months, defaultMonth, storedMinutes, onApply}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: HrMember[];
  months: string[];
  defaultMonth: string;
  storedMinutes: (member: HrMember, month: string) => number | null;
  onApply: (month: string, values: ScannedDuty[]) => void;
}) {
  const [step, setStep] = useState<Step>({kind: "pick"});
  const [pictures, setPictures] = useState<Picture[]>([]);
  const [month, setMonth] = useState(defaultMonth);
  const [rows, setRows] = useState<Row[]>([]);
  const runRef = useRef(0);
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

  useEffect(() => {
    if (open) void import("@/lib/duty-ocr").then((module) => module.warmUpOcr()).catch(() => undefined);
  }, [open]);

  const dropPictures = () => setPictures((current) => {
    current.forEach((picture) => URL.revokeObjectURL(picture.url));
    return [];
  });

  const reset = () => {
    runRef.current += 1;
    dropPictures();
    setRows([]);
    setStep({kind: "pick"});
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const addPicture = (file: File) => {
    const problem = imageFileProblem(file);
    if (problem) return void toast.error(problem);
    setPictures((current) => current.length >= MAX_PICTURES ? current
      : [...current, {id: crypto.randomUUID(), file, url: URL.createObjectURL(file)}]);
  };

  const removePicture = (id: string) => setPictures((current) => {
    const picture = current.find((item) => item.id === id);
    if (picture) URL.revokeObjectURL(picture.url);
    return current.filter((item) => item.id !== id);
  });

  const onPaste = (event: ClipboardEvent) => {
    const pasted = pastedImage(event);
    if (pasted && step.kind === "pick") {
      event.preventDefault();
      addPicture(pasted);
    }
  };

  const scan = async () => {
    if (!pictures.length) return;
    const run = ++runRef.current;
    const files = pictures.map((picture) => picture.file);
    setStep({kind: "scanning", stage: "loading", picture: 0, progress: 0});
    try {
      const {readDutyScreenshots} = await import("@/lib/duty-ocr");
      const pages = await readDutyScreenshots(files, {
        onStage: (stage, picture) => run === runRef.current && setStep({kind: "scanning", stage, picture, progress: 0}),
        onProgress: (progress) => run === runRef.current
          && setStep((prev) => (prev.kind === "scanning" ? {...prev, progress} : prev)),
      });
      if (run !== runRef.current) return;
      const merged = mergeDutyRows<HrMember, DutyScanRow>(pages.flat(), members);
      const verdict = judgeDutyScan(merged);
      if (!verdict.ok) {
        setStep({kind: "rejected", reason: verdict.reason});
        return;
      }
      setRows(merged.map((row, index): Row => {
        const shown = row.readings.find((reading) => reading.minutes === row.minutes) ?? row.readings[0];
        return {
          key: `${index}-${row.name}`, name: row.name, memberId: row.member?.id ?? null, fuzzyName: row.fuzzyName,
          value: row.minutes === null ? "" : String(row.minutes), readingStatus: row.minutes === null ? "missing" : row.certain ? "ok" : "doubtful",
          valueEdited: false,
          namePreview: shown?.namePreview ?? null, valuePreview: shown?.valuePreview ?? null,
        };
      }).sort((a, b) => Number(!a.memberId) - Number(!b.memberId) || ORDER[statusOf(a)] - ORDER[statusOf(b)] || a.name.localeCompare(b.name, "hu")));
      setStep({kind: "result"});
    } catch (error) {
      console.error("Duty OCR failed:", error);
      if (run === runRef.current) setStep({kind: "rejected", reason: "A felismerő nem tölthető be (nincs internetkapcsolat?)."});
    } finally {
      // The pictures are not needed any more.
      if (run === runRef.current) dropPictures();
    }
  };

  const update = (key: string, patch: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.key === key ? {...row, ...patch} : row)));

  const matched = rows.filter((row) => row.memberId);
  const unmatched = rows.filter((row) => !row.memberId);
  const takenIds = new Set(matched.map((row) => row.memberId));
  const notInPictures = members.filter((member) => !takenIds.has(member.id)).length;
  const invalidRows = matched.filter((row) => row.value.trim() && parseMinutesInput(row.value) === null);
  const counts = {
    ok: matched.filter((row) => statusOf(row) === "ok").length,
    doubtful: matched.filter((row) => statusOf(row) === "doubtful").length,
    missing: matched.filter((row) => statusOf(row) === "missing").length,
  };

  const apply = () => {
    if (invalidRows.length) return toast.error("Javítsd a hibás értékeket: perc, egész szám.");
    const values: ScannedDuty[] = matched.map((row) => ({
      userId: row.memberId!, minutes: parseMinutesInput(row.value), status: statusOf(row),
    }));
    onApply(month, values);
    toast.warning("Ellenőrizd az átvett duty időket!", {
      description: `Mentés előtt nézd át a táblázatot: a helyességükért te felelsz.${counts.missing ? ` ${counts.missing} cellát kézzel kell kitöltened (piros).` : ""}`,
      duration: 9000,
    });
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-3xl" onPaste={onPaste}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ScanLine className="size-5 text-primary"/> Duty idő képekből</DialogTitle>
          <DialogDescription>A UCP „Frakció tagok” listájáról készült képernyőképekből: a nevek mellett álló percek.</DialogDescription>
        </DialogHeader>

        {step.kind === "pick" ? (
          <div key="pick" className="animate-fade min-w-0 space-y-3">
            <ImageDropZone multiple title="Tölts fel képernyőképeket a taglistáról" onFile={addPicture}
                           hint="Több kép is jöhet egyszerre (görgetve, átfedéssel is). Kattints, húzd ide, vagy illeszd be (Ctrl+V)."/>
            {pictures.length > 0 && (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {pictures.map((picture, index) => (
                  <li key={picture.id} className="group relative overflow-hidden rounded-lg ring-1 ring-white/10" style={{"--i": index} as CSSProperties}>
                    <img src={picture.url} alt={`${index + 1}. kép`} className="aspect-video w-full bg-black/40 object-cover"/>
                    <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 text-[10px] text-slate-200">{index + 1}.</span>
                    <button type="button" onClick={() => removePicture(picture.id)} aria-label={`${index + 1}. kép eltávolítása`}
                            className="absolute top-1 right-1 grid size-6 place-items-center rounded-md bg-black/70 text-slate-300 hover:text-white">
                      <X className="size-3.5"/>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-slate-300">Melyik hónap duty ideje?</span>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="h-9 w-44"><SelectValue/></SelectTrigger>
                <SelectContent>
                  {[...months].reverse().map((value) => <SelectItem key={value} value={value}>{monthLabel(value)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <p className="flex items-start gap-2 rounded-xl bg-emerald-500/[0.06] px-3 py-2 text-xs text-emerald-200/90 ring-1 ring-emerald-500/20">
              <Lock className="mt-0.5 size-3.5 shrink-0"/>
              A képek nem kerülnek fel sehova: a felismerés a böngésződben fut, és a beolvasás után azonnal eldobjuk őket.
            </p>
            <DialogFooter>
              <Button variant="ghost" onClick={close}>Mégse</Button>
              <Button onClick={() => void scan()} disabled={!pictures.length}><ScanLine/> Beolvasás ({pictures.length} kép)</Button>
            </DialogFooter>
          </div>
        ) : step.kind === "scanning" ? (
          <ScanProgress key="scanning" preview={null} stage={step.stage} progress={step.progress} progressStages={["reading"]}
                        stages={[
                          {stage: "loading", label: "Felismerő betöltése"},
                          {stage: "reading", label: `Képek olvasása (${Math.min(step.picture + 1, pictures.length)}/${pictures.length})`},
                          {stage: "done", label: "Összevetés a taglistával"},
                        ]}/>
        ) : step.kind === "rejected" ? (
          <div key="rejected" className="animate-fade space-y-4">
            <div className="flex items-start gap-3 rounded-2xl bg-red-500/[0.08] p-4 ring-1 ring-red-500/25">
              <XCircle className="mt-0.5 size-5 shrink-0 text-red-300"/>
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold text-red-100">A képeket nem használjuk fel. {step.reason}</p>
                <p className="text-sm text-red-200/80">Valami nem stimmel a képekkel: töltsd ki kézzel a duty időket, vagy próbáld más képekkel.</p>
              </div>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-400">
              <li className="flex gap-2"><CircleHelp className="mt-0.5 size-3.5 shrink-0 text-slate-500"/> A UCP „Frakció tagok” oldalát fotózd: a nevek és a percek egy képen legyenek.</li>
              <li className="flex gap-2"><CircleHelp className="mt-0.5 size-3.5 shrink-0 text-slate-500"/> Eredeti méretű képernyőkép kell; a kicsinyített, homályos képen a számok nem olvashatók.</li>
            </ul>
            <DialogFooter>
              <Button variant="ghost" onClick={close}>Kézzel töltöm ki</Button>
              <Button variant="outline" onClick={reset}><Undo2/> Más képek</Button>
            </DialogFooter>
          </div>
        ) : (
          <div key="result" className="animate-fade min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-white/5 px-2.5 py-1 text-slate-200 ring-1 ring-white/10">{monthLabel(month)}</span>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-200 ring-1 ring-emerald-500/30"><Check className="mr-1 inline size-3"/>{counts.ok} rendben</span>
              {counts.doubtful > 0 && <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-200 ring-1 ring-amber-500/30">{counts.doubtful} bizonytalan</span>}
              {counts.missing > 0 && <span className="rounded-full bg-red-500/10 px-2.5 py-1 font-semibold text-red-200 ring-1 ring-red-500/40">{counts.missing} kézi kitöltés</span>}
              {unmatched.length > 0 && <span className="rounded-full bg-white/5 px-2.5 py-1 text-slate-400 ring-1 ring-white/10">{unmatched.length} név nem tag</span>}
              {notInPictures > 0 && <span className="text-slate-500">· {notInPictures} tag nem szerepelt a képeken (nem változik)</span>}
            </div>

            <ul className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
              {rows.map((row) => {
                const status = statusOf(row);
                const member = row.memberId ? memberById.get(row.memberId) ?? null : null;
                const stored = member ? storedMinutes(member, month) : null;
                const look = STATUS_LOOK[status];
                const parsed = parseMinutesInput(row.value);
                return (
                  <li key={row.key} className={cn("grid min-w-0 grid-cols-1 items-center gap-2 rounded-xl bg-white/[0.03] p-2.5 ring-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8.5rem]",
                    member ? look.ring : "opacity-70 ring-white/5")}>
                    <div className="min-w-0 space-y-1">
                      {row.namePreview && <img src={row.namePreview} alt={`${row.name} a képen`} className="max-h-6 max-w-full rounded bg-black/40 object-contain"/>}
                      <Select value={row.memberId ?? NONE} onValueChange={(value) => update(row.key, {memberId: value === NONE ? null : value, fuzzyName: false})}>
                        <SelectTrigger className="h-8 w-full text-xs"><SelectValue/></SelectTrigger>
                        <SelectContent className="max-h-72">
                          <SelectItem value={NONE}>Nem tag: kihagyom ({row.name})</SelectItem>
                          {members.map((item) => <SelectItem key={item.id} value={item.id}><span className="truncate">{item.full_name} · #{item.badge_number}</span></SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="min-w-0 space-y-1">
                      {row.valuePreview && <img src={row.valuePreview} alt={`${row.name} duty ideje a képen`} className="max-h-6 max-w-full rounded bg-black/40 object-contain"/>}
                      <p className={cn("text-[11px]", member ? look.text : "text-slate-500")}>
                        {member ? (row.fuzzyName ? "A név csak hasonló: ellenőrizd a tagot" : look.label) : "Kimarad"}
                        {member && stored !== null && <span className="text-slate-500"> · eddig {formatDuty(stored, true)}</span>}
                      </p>
                    </div>
                    <div>
                      <div className="relative">
                        <Input value={row.value} inputMode="numeric" aria-label={`${row.name} duty ideje (perc)`} placeholder="Írd be!"
                               disabled={!member}
                               className={cn("h-9 pr-11 text-right font-mono", status === "missing" && member && "ring-1 ring-red-500/60",
                                 row.value.trim() && parsed === null && "text-red-300")}
                               onChange={(event) => update(row.key, {value: event.target.value.replace(/[^\d]/g, "").slice(0, 5), valueEdited: true})}/>
                        <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[11px] text-slate-500">perc</span>
                      </div>
                      {parsed !== null && member && <p className="mt-0.5 text-right text-[10px] text-slate-500">= {formatDuty(parsed, true)}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>

            <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2.5 text-xs text-amber-100 ring-1 ring-amber-500/30">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-300"/>
              <span className="min-w-0">
                <span className="font-semibold">Ellenőrizd az adatokat használat előtt</span>: a gépi felismerés tévedhet, és a feltöltött
                duty időkért te felelsz. A bizonytalan értékek sárgán, a kézzel kitöltendők pirosan jelennek meg a táblázatban is.
              </span>
            </p>

            <DialogFooter>
              <Button variant="ghost" onClick={reset}><ImagePlus/> Más képek</Button>
              <Button onClick={apply} disabled={!matched.length}><PenLine/> Átvétel a táblázatba</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** A row's state after the review: a value typed by hand counts as checked; a name that only resembles a member is doubtful. */
function statusOf(row: Row): DutyStatus {
  if (!row.value.trim()) return "missing";
  if (row.valueEdited) return "ok";
  if (row.fuzzyName) return "doubtful";
  return row.readingStatus === "missing" ? "doubtful" : row.readingStatus;
}
