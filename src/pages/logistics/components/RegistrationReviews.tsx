import {useCallback, useEffect, useMemo, useState, type CSSProperties} from "react";
import {Link} from "react-router";
import {toast} from "sonner";
import {Check, Expand, FileSearch, ImageOff, Loader2, X} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Checkbox} from "@/components/ui/checkbox";
import {Dialog, DialogContent, DialogTitle} from "@/components/ui/dialog";
import {EmptyState} from "@/components/layout/EmptyState";
import {LicensePlate} from "@/components/fleet/LicensePlate";
import {RegistrationBadge} from "@/components/fleet/RegistrationBadge";
import {PersonAvatar} from "@/components/fleet/Holders";
import {useAuth} from "@/context/AuthContext";
import {modelMatches, plateMatches} from "@/lib/license-ocr/parse";
import {patchFleetVehicle} from "@/lib/fleet-store";
import type {DirectoryProfile} from "@/lib/profile-directory";
import {cn, errorMessage} from "@/lib/utils";
import {formatDate} from "@/pages/hr/hr-utils";
import type {FleetVehicle, RegistrationRequest} from "@/types/supabase";

const SOURCE_META: Record<string, {label: string; pill: string}> = {
  not_detected: {label: "Nem olvasható", pill: "bg-slate-500/10 text-slate-300 ring-slate-400/30"},
  mismatch: {label: "Eltérés", pill: "bg-amber-500/10 text-amber-200 ring-amber-500/30"},
  disputed: {label: "A tag szerint hibás", pill: "bg-violet-500/10 text-violet-200 ring-violet-500/30"},
};

const dotted = (iso: string | null) => (iso ? `${iso.replaceAll("-", ".")}.` : "–");

/**
 * Supervisory staff check the screenshots the browser could not confirm and set the expiry
 * by hand. Every screenshot is deleted as soon as it is decided.
 */
export function RegistrationReviews({vehicles, people, onCountChange}: {
  vehicles: FleetVehicle[];
  people: Map<string, DirectoryProfile>;
  onCountChange?: (count: number) => void;
}) {
  const {supabase} = useAuth();
  const [requests, setRequests] = useState<RegistrationRequest[] | null>(null);
  const [images, setImages] = useState<Map<string, string>>(new Map());
  const [zoom, setZoom] = useState<string | null>(null);
  const vehicleById = useMemo(() => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])), [vehicles]);

  const load = useCallback(async () => {
    const {data, error} = await supabase.from("fleet_registration_requests").select("*").eq("status", "pending")
      .order("created_at", {ascending: true});
    if (error) {
      toast.error("Az ellenőrzésre váró forgalmik betöltése nem sikerült.");
      setRequests([]);
      return;
    }
    const list = (data ?? []) as RegistrationRequest[];
    setRequests(list);
    // One request for every screenshot (signed for ten minutes).
    const paths = list.map((request) => request.image_path).filter((path): path is string => !!path);
    if (paths.length) {
      const signed = await supabase.storage.from("fleet_registrations").createSignedUrls(paths, 600);
      setImages(new Map((signed.data ?? []).flatMap((item) => (item.path && item.signedUrl ? [[item.path, item.signedUrl] as [string, string]] : []))));
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (requests) onCountChange?.(requests.length);
  }, [requests, onCountChange]);

  const decided = (request: RegistrationRequest) => setRequests((prev) => (prev ?? []).filter((item) => item.id !== request.id));

  if (requests === null) return <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{[0, 1].map((i) => <div key={i} className="skeleton h-72"/>)}</div>;
  if (requests.length === 0) {
    return (
      <div className="panel">
        <EmptyState icon={FileSearch} title="Nincs ellenőrzésre váró forgalmi."
                    description="Amit a rendszer nem tudott automatikusan elfogadni, itt jelenik meg." compact/>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {requests.map((request, index) => (
          <ReviewCard key={request.id} index={index} request={request} vehicle={vehicleById.get(request.vehicle_id) ?? null}
                      submitter={request.submitted_by ? people.get(request.submitted_by) ?? null : null}
                      image={request.image_path ? images.get(request.image_path) ?? null : null}
                      onZoom={setZoom} onDecided={decided}/>
        ))}
      </div>
      <Dialog open={!!zoom} onOpenChange={(open) => !open && setZoom(null)}>
        <DialogContent className="max-w-[min(96vw,1400px)] p-2 sm:max-w-[min(96vw,1400px)]">
          <DialogTitle className="sr-only">Forgalmi engedély</DialogTitle>
          {zoom && <img src={zoom} alt="Forgalmi engedély" className="max-h-[85vh] w-full rounded-lg object-contain"/>}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReviewCard({request, vehicle, submitter, image, index, onZoom, onDecided}: {
  request: RegistrationRequest;
  vehicle: FleetVehicle | null;
  submitter: DirectoryProfile | null;
  image: string | null;
  index: number;
  onZoom: (url: string) => void;
  onDecided: (request: RegistrationRequest) => void;
}) {
  const {supabase} = useAuth();
  const [date, setDate] = useState(request.proposed_expires_on ?? request.detected_expires_on ?? "");
  const [note, setNote] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rememberName, setRememberName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const meta = SOURCE_META[request.source] ?? SOURCE_META.not_detected;
  const reading = {plate: request.detected_plate, plates: [], text: request.detected_plate ?? ""};
  const plateOk = vehicle && request.detected_plate ? plateMatches(reading, vehicle.plate) : null;
  const modelOk = vehicle && request.detected_model ? modelMatches(request.detected_model, vehicle.model)
    || (!!vehicle.license_name && modelMatches(request.detected_model, vehicle.license_name)) : null;

  const decide = async (approve: boolean) => {
    if (approve && !date) return toast.error("Add meg a lejárati dátumot.");
    if (!approve && note.trim().length < 3) return toast.error("Írd meg az elutasítás okát.");
    setBusy(true);
    const {data, error} = await supabase.rpc("fleet_registration_decide", {
      _request_id: request.id, _approve: approve, _expires_on: approve ? date : null, _note: note.trim() || null,
      _remember_name: approve && rememberName,
    });
    setBusy(false);
    if (error) return toast.error(errorMessage(error, "A döntés mentése nem sikerült."));
    const result = data as {image_path: string | null; vehicle: FleetVehicle};
    // The screenshot is not needed any more (the daily cron removes anything left over).
    if (result.image_path) void supabase.storage.from("fleet_registrations").remove([result.image_path]);
    if (result.vehicle) {
      patchFleetVehicle(result.vehicle.id, {registration_expires_on: result.vehicle.registration_expires_on,
        license_name: result.vehicle.license_name});
    }
    toast.success(approve ? `${vehicle?.plate ?? "Jármű"}: forgalmi elfogadva.` : "Forgalmi elutasítva.");
    setLeaving(true);
    window.setTimeout(() => onDecided(request), 280);
  };

  return (
    <article style={{"--i": Math.min(index, 8)} as CSSProperties}
             className={cn("panel animate-rise flex flex-col overflow-hidden transition-all duration-300", leaving && "scale-95 opacity-0")}>
      <div className="relative bg-black/40">
        {image ? (
          <button type="button" onClick={() => onZoom(image)} className="group block w-full" title="Nagyítás">
            <img src={image} alt="Beküldött forgalmi" className="h-48 w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"/>
            <span className="absolute right-2 bottom-2 grid size-8 place-items-center rounded-lg bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100">
              <Expand className="size-4"/>
            </span>
          </button>
        ) : (
          <div className="grid h-48 place-items-center text-slate-500"><ImageOff className="size-8"/></div>
        )}
        <span className={cn("absolute top-2 left-2 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 backdrop-blur", meta.pill)}>{meta.label}</span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {vehicle ? (
            <Link to={`/logistics/fleet/${vehicle.id}`} className="flex items-center gap-2 hover:opacity-90">
              <LicensePlate plate={vehicle.plate} size="sm"/>
              <span className="text-sm font-medium text-white">{vehicle.model}</span>
            </Link>
          ) : <span className="text-sm text-slate-400">Ismeretlen jármű</span>}
          {vehicle && <RegistrationBadge expiresOn={vehicle.registration_expires_on} className="ml-auto"/>}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <PersonAvatar person={submitter}/> {submitter?.full_name ?? "Ismeretlen"} · {formatDate(request.created_at)}
        </div>

        <dl className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-xl bg-white/[0.03] px-3 py-2 text-xs ring-1 ring-white/5">
          <Reading label="Név" value={request.detected_model} ok={modelOk}/>
          <Reading label="Rendszám" value={request.detected_plate} ok={plateOk}/>
          <Reading label="Lejár" value={request.detected_expires_on ? dotted(request.detected_expires_on) : null} ok={null}/>
          {request.proposed_expires_on && <Reading label="Tag szerint" value={dotted(request.proposed_expires_on)} ok={null}/>}
        </dl>
        {request.note && <p className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-slate-300 ring-1 ring-white/5 wrap-anywhere">„{request.note}”</p>}

        <div className="mt-auto space-y-2">
          {rejecting ? (
            <div className="animate-fade space-y-2">
              <Label className="text-xs text-slate-400">Elutasítás oka</Label>
              <Input value={note} maxLength={300} autoFocus onChange={(event) => setNote(event.target.value)} placeholder="Pl. nem a forgalmi látszik a képen"/>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>Mégse</Button>
                <Button size="sm" className="bg-red-600 text-white hover:bg-red-500" disabled={busy} onClick={() => void decide(false)}>
                  {busy ? <Loader2 className="animate-spin"/> : <X/>} Elutasítás
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <Label className="text-xs text-slate-400">Érvényes eddig</Label>
                  <Input type="date" value={date} onChange={(event) => setDate(event.target.value)}/>
                </div>
                <Button variant="ghost" className="text-slate-300 hover:text-red-300" onClick={() => setRejecting(true)}><X/> Elutasítás</Button>
                <Button className="bg-emerald-600 text-white hover:bg-emerald-500" disabled={busy || !date} onClick={() => void decide(true)}>
                  {busy ? <Loader2 className="animate-spin"/> : <Check/>} Jóváhagyás
                </Button>
              </div>
              {request.detected_model && modelOk === false && (
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <Checkbox checked={rememberName} onCheckedChange={(value) => setRememberName(value === true)}/>
                  A forgalmin szereplő név („{request.detected_model}”) mentése ehhez a járműhöz
                </label>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function Reading({label, value, ok}: {label: string; value: string | null; ok: boolean | null}) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className="truncate font-mono text-slate-200">{value ?? "–"}</dd>
      <dd>{ok === null ? null : ok ? <Check className="size-3.5 text-emerald-300"/> : <X className="size-3.5 text-red-300"/>}</dd>
    </>
  );
}
