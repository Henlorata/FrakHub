import {useEffect, useMemo, useState} from "react";
import {Check, Gavel, Loader2, MapPin, UserRound} from "lucide-react";
import {toast} from "sonner";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {useAuth} from "@/context/AuthContext";
import {PROPERTY_TYPE, WARRANT_TYPE} from "@/lib/mcb";
import {cn, errorMessage} from "@/lib/utils";
import type {CaseEvidence, CaseSuspect, CaseWarrant, SuspectProperty, WarrantType} from "@/types/supabase";
import {InvolvementChip, Mugshot} from "./McbBadges";

interface WarrantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  people: CaseSuspect[];
  warrants: CaseWarrant[];
  evidence: CaseEvidence[];
  numbers: Map<string, number>;
  onCreated: () => void;
}

const MANUAL = "manual";

/** Arrest or search warrant request; approvers decide it (never the requester). */
export function WarrantDialog({open, onOpenChange, caseId, people, warrants, evidence, numbers, onCreated}: WarrantDialogProps) {
  const {supabase, user} = useAuth();
  const [type, setType] = useState<WarrantType>("arrest");
  const [personId, setPersonId] = useState<string>("");
  const [properties, setProperties] = useState<SuspectProperty[]>([]);
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [manualTarget, setManualTarget] = useState("");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType("arrest");
    setPersonId(people.find((item) => item.involvement_type === "suspect" || item.involvement_type === "perpetrator")?.suspect_id ?? "");
    setManualTarget("");
    setReason("");
    setDescription("");
    setSelectedProperties([]);
  }, [open, people]);

  // Known addresses of the chosen person (search warrants).
  useEffect(() => {
    if (type !== "search" || !personId || personId === MANUAL) {
      setProperties([]);
      return;
    }
    let active = true;
    supabase.from("suspect_properties").select("id, suspect_id, address, property_type, notes").eq("suspect_id", personId)
      .then(({data}) => {
        if (active) setProperties((data ?? []) as SuspectProperty[]);
      });
    return () => {
      active = false;
    };
  }, [type, personId, supabase]);

  const live = useMemo(() => warrants.filter((item) => item.status === "pending" || item.status === "approved"), [warrants]);
  const needsManual = personId === MANUAL || !personId || (type === "search" && selectedProperties.length === 0);

  const submit = async () => {
    if (!user) return;
    if (!reason.trim()) return toast.error("Az indoklás kötelező.");
    const suspectId = personId && personId !== MANUAL ? personId : null;
    const target = manualTarget.trim();
    if (type === "arrest" && !suspectId && !target) return toast.error("Válassz személyt vagy add meg a nevét.");
    if (type === "search" && selectedProperties.length === 0 && !target) return toast.error("Válassz ingatlant vagy add meg a címet.");

    const base = {case_id: caseId, type, reason: reason.trim(), description: description.trim() || null, requested_by: user.id, status: "pending"};
    const rows: (typeof base & {suspect_id: string | null; property_id: string | null; target_name: string | null})[] =
      type === "search" && selectedProperties.length > 0
      ? selectedProperties.map((propertyId) => ({...base, suspect_id: suspectId, property_id: propertyId, target_name: null}))
      : [{...base, suspect_id: suspectId, property_id: null, target_name: suspectId && type === "arrest" ? null : target || null}];

    const duplicate = rows.some((row) => live.some((item) => item.type === row.type
      && (row.property_id ? item.property_id === row.property_id
        : row.suspect_id && row.type === "arrest" ? item.suspect_id === row.suspect_id
          : (item.target_name ?? "").toLowerCase() === (row.target_name ?? "").toLowerCase() && !item.property_id)));
    if (duplicate) return toast.error("Erre a célpontra már van érvényes vagy elbírálásra váró parancs.");

    setBusy(true);
    const {error} = await supabase.from("case_warrants").insert(rows);
    setBusy(false);
    if (error) return void toast.error("A kérelem beküldése nem sikerült.", {description: errorMessage(error)});
    toast.success(rows.length > 1 ? `${rows.length} parancs kérelmezve.` : "Parancs kérelmezve.", {description: "A jóváhagyók értesítést kaptak."});
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-red-500/10 text-red-300 ring-1 ring-red-500/30"><Gavel className="size-5"/></span>
            <div>
              <DialogTitle>Parancs kérelmezése</DialogTitle>
              <DialogDescription>A Supervisory Staff és felette vagy egy Investigator III. bírálja el; saját kérelmet senki sem hagy jóvá.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          {(["arrest", "search"] as const).map((value) => {
            const look = WARRANT_TYPE[value];
            return (
              <button key={value} type="button" onClick={() => {
                setType(value);
                setSelectedProperties([]);
              }} className={cn("flex items-center gap-3 rounded-xl p-3 text-left ring-1 transition",
                type === value ? (value === "arrest" ? "bg-red-500/10 ring-red-500/40" : "bg-amber-500/10 ring-amber-500/40")
                  : "bg-white/[0.02] ring-white/10 hover:bg-white/[0.05]")}>
                <look.icon className={cn("size-6 shrink-0", type === value ? look.accent : "text-slate-500")}/>
                <span>
                  <span className="block text-sm font-semibold text-white">{look.label}</span>
                  <span className="block text-[11px] text-slate-400">{value === "arrest" ? "Személy őrizetbe vétele" : "Ingatlan, jármű átvizsgálása"}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          <Label>{type === "arrest" ? "Célszemély" : "Kinek az ingatlana? (nem kötelező)"}</Label>
          <div className="grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
            {people.map((item) => item.suspect && (
              <button key={item.suspect_id} type="button" onClick={() => {
                setPersonId(item.suspect_id);
                setSelectedProperties([]);
              }} className={cn("flex min-w-0 items-center gap-2.5 rounded-lg p-2 text-left ring-1 transition",
                personId === item.suspect_id ? "bg-sky-500/10 ring-sky-500/40" : "bg-white/[0.02] ring-white/10 hover:bg-white/[0.05]")}>
                <Mugshot url={item.suspect.mugshot_url} name={item.suspect.full_name} status={item.suspect.status} size={32}/>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-white">{item.suspect.full_name}</span>
                  <InvolvementChip value={item.involvement_type} className="mt-0.5"/>
                </span>
                {personId === item.suspect_id && <Check className="size-4 shrink-0 text-sky-300"/>}
              </button>
            ))}
            <button type="button" onClick={() => setPersonId(MANUAL)}
                    className={cn("flex items-center gap-2.5 rounded-lg p-2 text-left ring-1 transition",
                      personId === MANUAL ? "bg-sky-500/10 ring-sky-500/40" : "bg-white/[0.02] ring-white/10 hover:bg-white/[0.05]")}>
              <span className="grid size-8 place-items-center rounded-xl bg-white/5 text-slate-400"><UserRound className="size-4"/></span>
              <span className="text-sm text-slate-300">{type === "arrest" ? "Nincs az aktában / ismeretlen" : "Nincs személyhez kötve"}</span>
            </button>
          </div>
        </div>

        {type === "search" && personId && personId !== MANUAL && (
          <div className="space-y-2">
            <Label>Ismert ingatlanok</Label>
            {properties.length === 0 ? (
              <p className="rounded-lg bg-white/[0.02] p-3 text-xs text-slate-500 ring-1 ring-white/10">A személyhez nincs rögzített ingatlan; add meg a címet lent.</p>
            ) : (
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {properties.map((property) => {
                  const active = selectedProperties.includes(property.id);
                  return (
                    <button key={property.id} type="button"
                            onClick={() => setSelectedProperties((list) => (active ? list.filter((id) => id !== property.id) : [...list, property.id]))}
                            className={cn("flex min-w-0 items-center gap-2 rounded-lg p-2.5 text-left text-sm ring-1 transition",
                              active ? "bg-amber-500/10 text-amber-100 ring-amber-500/40" : "bg-white/[0.02] text-slate-300 ring-white/10 hover:bg-white/[0.05]")}>
                      <MapPin className={cn("size-4 shrink-0", active ? "text-amber-300" : "text-slate-500")}/>
                      <span className="min-w-0 flex-1 truncate">{property.address}</span>
                      <span className="text-[11px] text-slate-500">{PROPERTY_TYPE[property.property_type ?? ""] ?? property.property_type}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {needsManual && (
          <div className="space-y-1.5">
            <Label htmlFor="warrant-target">{type === "arrest" ? "A személy neve" : "Cím"}</Label>
            <Input id="warrant-target" value={manualTarget} maxLength={160} onChange={(event) => setManualTarget(event.target.value)}
                   placeholder={type === "arrest" ? "Teljes név vagy személyleírás" : "pl. Grove Street 12., garázs"}/>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="warrant-reason">Indoklás</Label>
          <Input id="warrant-reason" value={reason} maxLength={300} onChange={(event) => setReason(event.target.value)}
                 placeholder="pl. Fegyveres rablás megalapozott gyanúja"/>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="warrant-description">Bizonyítékok, hivatkozások</Label>
          <Textarea id="warrant-description" value={description} maxLength={2000} rows={3} onChange={(event) => setDescription(event.target.value)}
                    placeholder="Mire alapozod a kérelmet: vallomások, felvételek, bizonyítékok sorszáma."/>
          {evidence.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {[...evidence].sort((a, b) => (numbers.get(a.id) ?? 0) - (numbers.get(b.id) ?? 0)).slice(0, 16).map((item) => (
                <button key={item.id} type="button" title={item.file_name}
                        onClick={() => setDescription((text) => `${text}${text && !text.endsWith(" ") ? " " : ""}#${numbers.get(item.id)} (${item.file_name})`)}
                        className="rounded-md bg-amber-500/10 px-1.5 py-0.5 font-mono text-[11px] text-amber-300 ring-1 ring-amber-500/25 hover:bg-amber-500/20">
                  #{numbers.get(item.id)}
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Mégse</Button>
          <Button onClick={() => void submit()} disabled={busy || !reason.trim()} className="bg-red-600 text-white hover:bg-red-500">
            {busy ? <Loader2 className="size-4 animate-spin"/> : <Gavel className="size-4"/>} Kérelem beküldése
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
