import {useCallback, useEffect, useRef, useState, type ClipboardEvent, type CSSProperties, type DragEvent, type ReactNode} from "react";
import {Link} from "react-router";
import {toast} from "sonner";
import {
  CalendarCheck, CalendarClock, Check, ClipboardPaste, FileImage, Hourglass, ImageUp, Loader2, PenLine, ScanLine, Send, ShieldCheck,
  Undo2, X, XCircle,
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {LicensePlate} from "@/components/fleet/LicensePlate";
import {RegistrationBadge} from "@/components/fleet/RegistrationBadge";
import {useAuth} from "@/context/AuthContext";
import {compressImage} from "@/lib/image-compression";
import {checkLicense, findPlate, type LicenseCheck, type LicenseReading} from "@/lib/license-ocr/parse";
import type {ScanStage} from "@/lib/license-ocr";
import {patchFleetVehicle} from "@/lib/fleet-store";
import {cn, errorMessage, isStaff} from "@/lib/utils";
import {formatDate} from "@/pages/hr/hr-utils";
import type {FleetVehicle, RegistrationRequest} from "@/types/supabase";

type Step =
  | {kind: "pick"}
  | {kind: "scanning"; stage: ScanStage; progress: number}
  | {kind: "result"; reading: LicenseReading; check: LicenseCheck; crop: Blob | null; ocrFailed: boolean}
  | {kind: "review"; source: "not_detected" | "mismatch" | "disputed"; check: LicenseCheck | null; crop: Blob | null}
  | {kind: "sending"}
  | {kind: "done"; title: string; message: string};

const STAGES: {stage: ScanStage; label: string}[] = [
  {stage: "loading", label: "Felismerő betöltése"},
  {stage: "locating", label: "Forgalmi keresése a képen"},
  {stage: "reading", label: "Adatok kiolvasása"},
  {stage: "done", label: "Összevetés a nyilvántartással"},
];

const MAX_FILE = 15 * 1024 * 1024;
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const dotted = (iso: string | null) => (iso ? `${iso.replaceAll("-", ".")}.` : "–");
/** "2026.11.20-ig" (a suffix replaces the date's closing dot). */
const until = (iso: string | null) => (iso ? `${iso.replaceAll("-", ".")}-ig` : "–");

/**
 * Renewing a registration. The holder uploads (or pastes) a screenshot of the in-game
 * licence; the browser finds the card and reads name, plate and expiry. A matching reading
 * is offered for one-click acceptance; anything else goes to supervisory staff with the
 * screenshot, who decide by hand (the screenshot is deleted afterwards). Staff can also set
 * the date directly.
 */
export function RegistrationDialog({vehicle, open, onOpenChange, onChanged}: {
  vehicle: FleetVehicle;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: (vehicle: FleetVehicle) => void;
}) {
  const {supabase, profile, user} = useAuth();
  const staff = isStaff(profile);
  const [step, setStep] = useState<Step>({kind: "pick"});
  const [mode, setMode] = useState<"image" | "manual">("image");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cropPreview, setCropPreview] = useState<string | null>(null);
  const [pending, setPending] = useState<RegistrationRequest | null | undefined>(undefined);
  const [proposed, setProposed] = useState("");
  const [note, setNote] = useState("");
  const [manualDate, setManualDate] = useState(vehicle.registration_expires_on ?? "");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const runRef = useRef(0);

  // Pending review of this vehicle (one per vehicle), and an early start of the OCR engine.
  useEffect(() => {
    if (!open) return;
    let active = true;
    supabase.from("fleet_registration_requests").select("*").eq("vehicle_id", vehicle.id).eq("status", "pending").maybeSingle()
      .then(({data}) => {
        if (active) setPending((data ?? null) as RegistrationRequest | null);
      });
    void import("@/lib/license-ocr").then((module) => module.warmUpOcr()).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [open, supabase, vehicle.id]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);
  useEffect(() => () => {
    if (cropPreview) URL.revokeObjectURL(cropPreview);
  }, [cropPreview]);

  const reset = () => {
    runRef.current += 1;
    setStep({kind: "pick"});
    setFile(null);
    setPreview(null);
    setCropPreview(null);
    setProposed("");
    setNote("");
  };

  const scan = useCallback(async (picked: File) => {
    if (!picked.type.startsWith("image/")) return toast.error("Képfájlt válassz (PNG, JPG vagy WEBP).");
    if (picked.size > MAX_FILE) return toast.error("A kép legfeljebb 15 MB lehet.");
    const run = ++runRef.current;
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
    setCropPreview(null);
    setStep({kind: "scanning", stage: "loading", progress: 0});
    try {
      const {readLicense} = await import("@/lib/license-ocr");
      const result = await readLicense(picked, {
        onStage: (stage) => run === runRef.current && setStep({kind: "scanning", stage, progress: 0}),
        onProgress: (progress) => run === runRef.current
          && setStep((prev) => (prev.kind === "scanning" ? {...prev, progress} : prev)),
      });
      if (run !== runRef.current) return;
      if (result.crop) setCropPreview(URL.createObjectURL(result.crop));
      const check = checkLicense(result.reading, vehicle, today());
      setStep({kind: "result", reading: result.reading, check, crop: result.crop, ocrFailed: false});
      if (check.expiresOn && check.verdict !== "match") setManualDate(check.expiresOn);
    } catch (error) {
      console.error("License OCR failed:", error);
      if (run !== runRef.current) return;
      const reading: LicenseReading = {model: null, plate: null, expiresOn: null, labels: 0, text: ""};
      setStep({kind: "result", reading, check: checkLicense(reading, vehicle, today()), crop: null, ocrFailed: true});
    }
  }, [vehicle]);

  const onFiles = (files: FileList | null) => {
    const picked = files?.[0];
    if (picked) void scan(picked);
  };

  const onPaste = (event: ClipboardEvent) => {
    const item = [...event.clipboardData.items].find((entry) => entry.type.startsWith("image/"));
    const pasted = item?.getAsFile();
    if (pasted && (step.kind === "pick" || step.kind === "result")) {
      event.preventDefault();
      void scan(new File([pasted], pasted.name || "kepernyokep.png", {type: pasted.type}));
    }
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    onFiles(event.dataTransfer.files);
  };

  const finish = (updated: FleetVehicle, title: string, message: string) => {
    patchFleetVehicle(updated.id, {registration_expires_on: updated.registration_expires_on});
    onChanged?.({...vehicle, registration_expires_on: updated.registration_expires_on});
    setStep({kind: "done", title, message});
  };

  const apply = async (reading: LicenseReading, check: LicenseCheck) => {
    setBusy(true);
    const {data, error} = await supabase.rpc("fleet_registration_apply", {
      _vehicle_id: vehicle.id, _expires_on: check.expiresOn, _detected_model: check.model ?? "",
      // The text the plate was recognised in: the server compares it with the stock again.
      _detected_plate: findPlate(reading, vehicle.plate) ?? "",
    });
    setBusy(false);
    if (error) return toast.error(errorMessage(error, "A frissítés nem sikerült."));
    finish(data as FleetVehicle, "Forgalmi frissítve", `${vehicle.plate}: érvényes ${until(check.expiresOn)}.`);
  };

  const saveManual = async () => {
    setBusy(true);
    const {data, error} = await supabase.rpc("fleet_renew_registration", {_vehicle_id: vehicle.id, _expires_on: manualDate || null});
    setBusy(false);
    if (error) return toast.error(errorMessage(error, "A mentés nem sikerült."));
    finish(data as FleetVehicle, "Lejárat beállítva", manualDate ? `${vehicle.plate}: érvényes ${until(manualDate)}.` : `${vehicle.plate}: lejárat törölve.`);
  };

  const submitReview = async (source: "not_detected" | "mismatch" | "disputed", check: LicenseCheck | null, crop: Blob | null) => {
    if (!file || !user) return;
    setStep({kind: "sending"});
    try {
      // The card alone when it was found (small and sharp), otherwise the whole screenshot, compressed.
      const image = crop ?? await compressImage(file, {maxDimension: 1600, quality: 0.8});
      const extension = image.type === "image/webp" ? "webp" : image.type === "image/png" ? "png" : "jpg";
      const path = `${user.id}_${vehicle.id}_${crypto.randomUUID().slice(0, 8)}.${extension}`;
      const upload = await supabase.storage.from("fleet_registrations").upload(path, image, {contentType: image.type || "image/webp"});
      if (upload.error) throw upload.error;
      const {data, error} = await supabase.rpc("fleet_registration_submit", {
        _vehicle_id: vehicle.id, _image_path: path, _source: source,
        _detected_model: check?.model ?? null, _detected_plate: check?.plate ?? null,
        _detected_expires_on: check?.expiresOn ?? null, _proposed_expires_on: proposed || null, _note: note.trim() || null,
      });
      if (error) {
        void supabase.storage.from("fleet_registrations").remove([path]);
        throw error;
      }
      setPending(data as RegistrationRequest);
      setStep({kind: "done", title: "Elküldve ellenőrzésre", message: "A vezetőség hamarosan ellenőrzi; a döntésről értesítést kapsz."});
    } catch (error) {
      toast.error(errorMessage(error, "A beküldés nem sikerült."));
      setStep({kind: "review", source, check, crop});
    }
  };

  const cancelPending = async () => {
    if (!pending) return;
    setBusy(true);
    const {data, error} = await supabase.rpc("fleet_registration_cancel", {_request_id: pending.id});
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    if (typeof data === "string" && data) void supabase.storage.from("fleet_registrations").remove([data]);
    setPending(null);
    toast.success("Kérelem visszavonva.");
  };

  const ownPending = pending && pending.submitted_by === user?.id;

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (!next) reset();
      onOpenChange(next);
    }}>
      <DialogContent className="sm:max-w-xl" onPaste={onPaste}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CalendarClock className="size-5 text-primary"/> Forgalmi frissítése</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <LicensePlate plate={vehicle.plate} size="sm"/> {vehicle.model}
            <RegistrationBadge expiresOn={vehicle.registration_expires_on}/>
          </DialogDescription>
        </DialogHeader>

        {pending === undefined ? (
          <div className="skeleton h-40"/>
        ) : pending && step.kind !== "done" ? (
          <PendingNotice request={pending} own={!!ownPending} staff={staff} busy={busy} onCancel={() => void cancelPending()}/>
        ) : (
          <>
            {staff && step.kind !== "done" && step.kind !== "sending" && (
              <div className="inline-flex rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/10">
                {([["image", "Kép alapján", ScanLine], ["manual", "Kézi megadás", PenLine]] as const).map(([value, label, Icon]) => (
                  <button key={value} type="button" onClick={() => setMode(value)}
                          className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
                            mode === value ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200")}>
                    <Icon className="size-3.5"/>{label}
                  </button>
                ))}
              </div>
            )}

            {staff && mode === "manual" && step.kind !== "done" ? (
              <div key="manual" className="animate-fade space-y-3">
                <p className="text-sm text-slate-400">Supervisory staff és magasabb rang esetén kép nélkül is beállíthatod a lejáratot.</p>
                <div className="space-y-1.5">
                  <Label>Érvényes eddig</Label>
                  <Input type="date" value={manualDate} onChange={(event) => setManualDate(event.target.value)}/>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => onOpenChange(false)}>Mégse</Button>
                  <Button onClick={() => void saveManual()} disabled={busy}>{busy ? <Loader2 className="animate-spin"/> : <CalendarCheck/>} Mentés</Button>
                </div>
              </div>
            ) : step.kind === "pick" ? (
              <div key="pick" className="animate-fade space-y-3">
                <button type="button" onClick={() => inputRef.current?.click()}
                        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)} onDrop={onDrop}
                        className={cn("group relative flex w-full flex-col items-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all",
                          dragging ? "scale-[1.01] border-primary bg-primary/10 shadow-[0_0_40px_-10px_rgb(234_179_8/0.6)]"
                            : "border-white/15 bg-white/[0.02] hover:border-primary/50 hover:bg-white/[0.04]")}>
                  <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgb(234_179_8/0.12),transparent_60%)] opacity-0 transition-opacity group-hover:opacity-100"/>
                  <span className="relative grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/25 motion-safe:animate-[float-y_4s_ease-in-out_infinite]">
                    <ImageUp className="size-7"/>
                  </span>
                  <span className="relative">
                    <span className="block text-sm font-semibold text-white">Töltsd fel a forgalmi engedély képét</span>
                    <span className="mt-1 block text-xs text-slate-400">Kattints, húzd ide, vagy illeszd be (Ctrl+V) a képernyőképet.</span>
                  </span>
                  <span className="relative flex flex-wrap justify-center gap-2 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 ring-1 ring-white/10"><FileImage className="size-3"/> PNG, JPG, WEBP</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 ring-1 ring-white/10"><ClipboardPaste className="size-3"/> Beillesztés</span>
                  </span>
                </button>
                <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                       onChange={(event) => { onFiles(event.target.files); event.target.value = ""; }}/>
                <p className="flex items-start gap-2 rounded-xl bg-sky-500/[0.06] px-3 py-2 text-xs text-sky-200/90 ring-1 ring-sky-500/20">
                  <ScanLine className="mt-0.5 size-3.5 shrink-0"/>
                  Nem kell kivágnod: a teljes képernyőképen is megkeressük a forgalmit, és kiolvassuk a nevet, a rendszámot és a lejáratot.
                </p>
              </div>
            ) : step.kind === "scanning" ? (
              <Scanning key="scanning" preview={preview} stage={step.stage} progress={step.progress}/>
            ) : step.kind === "result" ? (
              <Result key="result" vehicle={vehicle} step={step} cropPreview={cropPreview ?? preview} staff={staff} busy={busy}
                      onAccept={() => void apply(step.reading, step.check)}
                      onDispute={() => setStep({kind: "review", source: "disputed", check: step.check, crop: step.crop})}
                      onReview={() => setStep({kind: "review", source: step.check.verdict === "unreadable" ? "not_detected" : "mismatch",
                        check: step.ocrFailed ? null : step.check, crop: step.crop})}
                      onManual={() => setMode("manual")} onRetry={reset} onClose={() => onOpenChange(false)}/>
            ) : step.kind === "review" ? (
              <div key="review" className="animate-fade space-y-4">
                <p className="text-sm text-slate-300">
                  {step.source === "disputed" ? "Rendben, a vezetőség nézi meg a képet, és kézzel állítja be a lejáratot."
                    : "A képet a vezetőség ellenőrzi, és kézzel állítja be a lejáratot."} A kép csak az elbírálásig marad meg.
                </p>
                {(cropPreview ?? preview) && (
                  <img src={cropPreview ?? preview ?? undefined} alt="A feltöltött forgalmi"
                       className="max-h-44 w-full rounded-xl object-contain ring-1 ring-white/10"/>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Szerinted meddig érvényes? (opcionális)</Label>
                    <Input type="date" value={proposed} onChange={(event) => setProposed(event.target.value)}/>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Megjegyzés (opcionális)</Label>
                    <Textarea rows={2} maxLength={300} value={note} onChange={(event) => setNote(event.target.value)}
                              placeholder="Pl. a dátum 2026.11.03., csak rosszul olvasta"/>
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="ghost" onClick={reset}><Undo2/> Másik kép</Button>
                  <Button onClick={() => void submitReview(step.source, step.check, step.crop)}><Send/> Ellenőrzésre küldöm</Button>
                </div>
              </div>
            ) : step.kind === "sending" ? (
              <div key="sending" className="animate-fade flex flex-col items-center gap-3 py-10 text-center">
                <Loader2 className="size-8 animate-spin text-primary"/>
                <p className="text-sm text-slate-300">Kép feltöltése és beküldése…</p>
              </div>
            ) : (
              <Done key="done" title={step.title} message={step.message} onClose={() => onOpenChange(false)}/>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PendingNotice({request, own, staff, busy, onCancel}: {
  request: RegistrationRequest; own: boolean; staff: boolean; busy: boolean; onCancel: () => void;
}) {
  return (
    <div className="animate-fade space-y-3 rounded-2xl bg-amber-500/[0.07] p-5 ring-1 ring-amber-500/25">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30">
          <Hourglass className="size-5 motion-safe:animate-[spin_6s_linear_infinite]"/>
        </span>
        <div>
          <p className="text-sm font-semibold text-amber-100">Ellenőrzésre vár</p>
          <p className="text-xs text-amber-200/70">Beküldve: {formatDate(request.created_at)}{request.proposed_expires_on ? ` · javasolt lejárat: ${dotted(request.proposed_expires_on)}` : ""}</p>
        </div>
      </div>
      <p className="text-xs text-slate-300">Amíg a vezetőség el nem bírálja, nem küldhető be új forgalmi ehhez a járműhöz.</p>
      <div className="flex flex-wrap justify-end gap-2">
        {staff && <Button size="sm" variant="outline" asChild><Link to="/logistics?tab=fleet&view=reviews">Elbírálás</Link></Button>}
        {own && <Button size="sm" variant="ghost" className="text-slate-300" disabled={busy} onClick={onCancel}><X/> Visszavonom</Button>}
      </div>
    </div>
  );
}

function Scanning({preview, stage, progress}: {preview: string | null; stage: ScanStage; progress: number}) {
  const current = STAGES.findIndex((item) => item.stage === stage);
  return (
    <div className="animate-fade space-y-4">
      <div className="scan-frame relative overflow-hidden rounded-2xl bg-black/40 ring-1 ring-white/10">
        {preview && <img src={preview} alt="" className="max-h-60 w-full object-contain opacity-80"/>}
        <span className="scan-grid pointer-events-none absolute inset-0"/>
        <span className="scan-line pointer-events-none absolute inset-x-0"/>
        {(["top-2 left-2 border-t-2 border-l-2", "top-2 right-2 border-t-2 border-r-2", "bottom-2 left-2 border-b-2 border-l-2",
          "bottom-2 right-2 border-b-2 border-r-2"] as const).map((corner) => (
          <span key={corner} className={cn("pointer-events-none absolute size-6 rounded-sm border-primary/80", corner)}/>
        ))}
      </div>
      <ol className="space-y-1.5">
        {STAGES.map((item, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li key={item.stage} className={cn("flex items-center gap-2.5 text-sm transition-colors", done ? "text-emerald-300" : active ? "text-white" : "text-slate-500")}>
              <span className={cn("grid size-5 place-items-center rounded-full ring-1 transition-all",
                done ? "bg-emerald-500/20 ring-emerald-400/50" : active ? "ring-primary/60" : "ring-white/15")}>
                {done ? <Check className="animate-pop size-3"/> : active ? <Loader2 className="size-3 animate-spin text-primary"/> : null}
              </span>
              {item.label}
              {active && (item.stage === "locating" || item.stage === "reading") && progress > 0 && (
                <span className="ml-auto text-xs tabular-nums text-slate-400">{Math.round(progress * 100)}%</span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function FieldRow({index, label, value, ok, hint}: {index: number; label: string; value: ReactNode; ok: boolean | null; hint?: string}) {
  return (
    <li style={{"--i": index} as CSSProperties} className="animate-rise flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-white/5">
      <span className="w-20 shrink-0 text-xs text-slate-500">{label}</span>
      <span className="min-w-0 flex-1 truncate font-mono text-sm text-slate-100">{value}</span>
      {hint && <span className="hidden text-[11px] text-slate-500 sm:inline">{hint}</span>}
      {ok === null ? null : ok ? (
        <span className="animate-pop grid size-6 place-items-center rounded-full bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/40"><Check className="size-3.5"/></span>
      ) : (
        <span className="animate-pop grid size-6 place-items-center rounded-full bg-red-500/15 text-red-300 ring-1 ring-red-400/40"><X className="size-3.5"/></span>
      )}
    </li>
  );
}

function Result({vehicle, step, cropPreview, staff, busy, onAccept, onDispute, onReview, onManual, onRetry, onClose}: {
  vehicle: FleetVehicle;
  step: Extract<Step, {kind: "result"}>;
  cropPreview: string | null;
  staff: boolean;
  busy: boolean;
  onAccept: () => void;
  onDispute: () => void;
  onReview: () => void;
  onManual: () => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  const {check, ocrFailed} = step;
  const match = check.verdict === "match";
  return (
    <div className="animate-fade space-y-4">
      {cropPreview && (
        <img src={cropPreview} alt="A felismert forgalmi" className="animate-rise max-h-48 w-full rounded-xl object-contain ring-1 ring-white/10"/>
      )}
      {ocrFailed ? (
        <p className="flex items-start gap-2 rounded-xl bg-slate-500/10 px-3 py-2 text-sm text-slate-300 ring-1 ring-white/10">
          <XCircle className="mt-0.5 size-4 shrink-0 text-slate-400"/> Az automatikus felismerés most nem érhető el; a képet a vezetőség ellenőrzi.
        </p>
      ) : (
        <ul className="space-y-1.5">
          <FieldRow index={0} label="Név" value={check.model ?? "–"} ok={check.modelMatches}
                    hint={check.modelMatches && check.model !== vehicle.model ? vehicle.model : undefined}/>
          <FieldRow index={1} label="Rendszám" value={check.plate ?? "–"} ok={check.plateMatches}/>
          <FieldRow index={2} label="Lejár" value={dotted(check.expiresOn)} ok={check.dateOk || check.verdict === "unchanged"}/>
        </ul>
      )}

      {match ? (
        <div className="animate-rise space-y-3 rounded-2xl bg-emerald-500/[0.07] p-4 text-center ring-1 ring-emerald-500/25" style={{"--i": 3} as CSSProperties}>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300/80">Új lejárat</p>
          <p className="animate-pop font-mono text-3xl font-semibold tracking-tight text-white">{dotted(check.expiresOn)}</p>
          <p className="text-xs text-slate-400">
            Jelenleg nyilvántartott: {dotted(vehicle.registration_expires_on)}<br/>
            Ha a kiolvasott érték jó, fogadd el; ha nem, a vezetőség ellenőrzi.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={onDispute} disabled={busy}><X/> Nem stimmel</Button>
            <Button className="bg-emerald-600 text-white hover:bg-emerald-500" onClick={onAccept} disabled={busy}>
              {busy ? <Loader2 className="animate-spin"/> : <Check/>} Elfogadom
            </Button>
          </div>
        </div>
      ) : (
        <div className="animate-rise space-y-3" style={{"--i": 3} as CSSProperties}>
          {!ocrFailed && (
            <ul className="space-y-1 rounded-xl bg-amber-500/[0.07] px-4 py-3 text-sm text-amber-100 ring-1 ring-amber-500/25">
              {check.problems.map((problem) => <li key={problem} className="flex gap-2"><span className="text-amber-400">•</span>{problem}</li>)}
            </ul>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={onRetry}><Undo2/> Másik kép</Button>
            {check.verdict === "unchanged" ? (
              <Button onClick={onClose}><Check/> Rendben</Button>
            ) : staff ? (
              <Button onClick={onManual}><PenLine/> Dátum beállítása kézzel</Button>
            ) : (
              <Button onClick={onReview}><ShieldCheck/> Ellenőrzésre küldöm</Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Done({title, message, onClose}: {title: string; message: string; onClose: () => void}) {
  return (
    <div className="animate-fade flex flex-col items-center gap-4 py-6 text-center">
      <span className="relative grid size-20 place-items-center">
        <span className="ring-burst absolute inset-0 rounded-full bg-emerald-400/30"/>
        <span className="ring-burst absolute inset-0 rounded-full bg-emerald-400/20 [animation-delay:200ms]"/>
        <span className="relative grid size-16 place-items-center rounded-full bg-emerald-500/20 ring-1 ring-emerald-400/50">
          <svg viewBox="0 0 24 24" className="size-9 text-emerald-300" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" className="draw-check"/>
          </svg>
        </span>
      </span>
      <div>
        <p className="text-lg font-semibold text-white">{title}</p>
        <p className="mt-1 text-sm text-slate-400">{message}</p>
      </div>
      <Button onClick={onClose}>Bezárás</Button>
    </div>
  );
}
