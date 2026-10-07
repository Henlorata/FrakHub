import {useMemo, useState, type ReactNode} from "react";
import {Link} from "react-router";
import {toast} from "sonner";
import {Car, Clock, KeyRound, Landmark, Loader2, Save, UserMinus} from "lucide-react";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Button} from "@/components/ui/button";
import {Textarea} from "@/components/ui/textarea";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {DutyChart} from "@/components/hr/DutyChart";
import {StrikeDots} from "@/components/hr/StrikeDots";
import {RegistrationBadge} from "@/components/fleet/RegistrationBadge";
import {LicensePlate} from "@/components/fleet/LicensePlate";
import {AssignVehiclesDialog} from "@/components/fleet/AssignDialogs";
import {canAssignAnyVehicle} from "@/lib/fleet";
import {useFleet} from "@/lib/fleet-store";
import {useProfileDirectory} from "@/lib/profile-directory";
import {
  ACTIVITY_META, formatAccountNumber, isValidAccountNumber, JOIN_TYPE_LABELS, LEAVE_TYPE_META, REHIRE_META, STATIONS,
} from "@/lib/registry";
import {canManageMemberDetails, cn, errorMessage, isStaff} from "@/lib/utils";
import type {ActivityStatus, JoinType, LeaveType, Profile, RehireStatus} from "@/types/supabase";
import {formatDate} from "../hr-utils";
import type {DetailsPatch, HrMember} from "../useHrData";
import {todayKey} from "@/lib/datetime";

interface RegistryForm {
  station: string;
  parking_spot: string;
  joined_on: string;
  join_type: JoinType;
  recruited_by: string;
  activity_status: ActivityStatus;
  bank: string;
}

const toForm = (member: HrMember): RegistryForm => ({
  station: member.details?.station ?? "",
  parking_spot: member.details?.parking_spot ?? "",
  joined_on: member.details?.joined_on ?? "",
  join_type: member.details?.join_type ?? "new",
  recruited_by: member.details?.recruited_by ?? "",
  activity_status: member.details?.activity_status ?? "active",
  bank: member.bankAccount ?? "",
});

/** The old sheet's columns for one member: station, parking, joining, activity, bank account, duty time and vehicles. */
export function MemberRegistryTab({member, viewer, onSaveDetails, onSaveBankAccount}: {
  member: HrMember;
  viewer: Profile;
  onSaveDetails: (memberId: string, patch: DetailsPatch) => Promise<void>;
  onSaveBankAccount: (memberId: string, accountNumber: string | null) => Promise<void>;
}) {
  const editable = canManageMemberDetails(viewer, member);
  const staff = isStaff(viewer);
  const {vehicles: stock, categories} = useFleet();
  const {profiles} = useProfileDirectory();
  const [assigning, setAssigning] = useState(false);
  const canAssign = canAssignAnyVehicle(viewer, categories);
  // The live stock once loaded (keys handed out here show up at once), the registry until then.
  const vehicles = useMemo(() => stock
    ? stock.filter((vehicle) => vehicle.holders.some((holder) => holder.user_id === member.id))
    : member.vehicles, [stock, member]);
  const [form, setForm] = useState(() => toForm(member));
  const [saving, setSaving] = useState(false);
  const initial = toForm(member);
  const detailsDirty = (["station", "parking_spot", "joined_on", "join_type", "recruited_by", "activity_status"] as const)
    .some((key) => form[key] !== initial[key]);
  const bankDirty = form.bank !== initial.bank;

  const save = async () => {
    if (form.bank && !isValidAccountNumber(form.bank)) return toast.error("A számlaszám formátuma: 12345678-12345678-12345678.");
    setSaving(true);
    try {
      if (detailsDirty) {
        await onSaveDetails(member.id, {
          station: form.station || null,
          parking_spot: form.parking_spot.trim() || null,
          joined_on: form.joined_on || null,
          join_type: form.join_type,
          recruited_by: form.recruited_by.trim() || null,
          activity_status: form.activity_status,
        });
      }
      if (bankDirty) await onSaveBankAccount(member.id, form.bank || null);
      toast.success("Nyilvántartás mentve.");
    } catch (error) {
      toast.error(errorMessage(error, "A mentés nem sikerült."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {editable ? (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-white">Nyilvántartási adatok</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Kirendeltség</Label>
              <Select value={form.station || "none"} onValueChange={(value) => setForm({...form, station: value === "none" ? "" : value})}>
                <SelectTrigger className="w-full"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nincs megadva</SelectItem>
                  {STATIONS.map((station) => <SelectItem key={station} value={station}>{station}</SelectItem>)}
                  {form.station && !STATIONS.includes(form.station as never) && <SelectItem value={form.station}>{form.station}</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Parkolóhely</Label>
              <Input value={form.parking_spot} maxLength={20} placeholder="Pl. 1/7" className="font-mono"
                     onChange={(event) => setForm({...form, parking_spot: event.target.value})}/>
            </div>
            <div className="space-y-1.5">
              <Label>Csatlakozott / visszatért</Label>
              <Input type="date" value={form.joined_on} onChange={(event) => setForm({...form, joined_on: event.target.value})}/>
            </div>
            <div className="space-y-1.5">
              <Label>Csatlakozás módja</Label>
              <Select value={form.join_type} onValueChange={(value) => setForm({...form, join_type: value as JoinType})}>
                <SelectTrigger className="w-full"><SelectValue/></SelectTrigger>
                <SelectContent>
                  {(Object.keys(JOIN_TYPE_LABELS) as JoinType[]).map((type) => <SelectItem key={type} value={type}>{JOIN_TYPE_LABELS[type]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Felvételiztető</Label>
              <Input value={form.recruited_by} maxLength={80} placeholder="Pl. Erik/Gyula"
                     onChange={(event) => setForm({...form, recruited_by: event.target.value})}/>
            </div>
            {staff && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Landmark className="size-3.5"/> Bankszámlaszám</Label>
                <Input value={form.bank} inputMode="numeric" placeholder="12345678-12345678-12345678" className="font-mono"
                       onChange={(event) => setForm({...form, bank: formatAccountNumber(event.target.value)})}/>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Aktivitás</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(ACTIVITY_META) as ActivityStatus[]).map((status) => (
                <button key={status} type="button" onClick={() => setForm({...form, activity_status: status})}
                        className={cn("flex h-9 items-center justify-center gap-2 rounded-lg text-xs font-medium ring-1 transition-colors",
                          form.activity_status === status ? ACTIVITY_META[status].pill : "text-slate-400 ring-white/10 hover:text-slate-200")}>
                  <span className={cn("size-2 rounded-full", ACTIVITY_META[status].dot)}/>{ACTIVITY_META[status].label}
                </button>
              ))}
            </div>
            {member.onLeaveNow && member.leave && (
              <p className="text-[11px] text-sky-300/90">
                Szabadságon {formatDate(member.leave.ends_on)}-ig: addig mindenhol így látszik, a beállított aktivitás a szabadság után érvényes.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            {(detailsDirty || bankDirty) && <Button variant="ghost" onClick={() => setForm(toForm(member))}>Visszaállítás</Button>}
            <Button onClick={() => void save()} disabled={saving || (!detailsDirty && !bankDirty)}>
              {saving ? <Loader2 className="animate-spin"/> : <Save/>} Mentés
            </Button>
          </div>
        </section>
      ) : (
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Fact label="Kirendeltség" value={member.details?.station ?? "–"}/>
          <Fact label="Parkolóhely" value={member.details?.parking_spot ?? "–"}/>
          <Fact label="Csatlakozott" value={formatDate(member.details?.joined_on ?? member.created_at)}/>
          <Fact label="Csatlakozás módja" value={JOIN_TYPE_LABELS[member.details?.join_type ?? "new"]}/>
          <Fact label="Felvételiztető" value={member.details?.recruited_by ?? "–"}/>
          <Fact label="Aktivitás" value={member.onLeaveNow && member.leave ? (
            <span className="text-sky-300">
              Szabadságon {formatDate(member.leave.ends_on)}-ig
              <span className="block text-[11px] font-normal text-slate-500">utána: {ACTIVITY_META[member.details?.activity_status ?? "active"].label}</span>
            </span>
          ) : ACTIVITY_META[member.details?.activity_status ?? "active"].label}/>
          {staff && <Fact label="Bankszámlaszám" value={<span className="font-mono text-xs">{member.bankAccount ?? "–"}</span>}/>}
        </section>
      )}

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Clock className="size-4 text-primary"/> Duty idő</h3>
        <DutyChart entries={member.duty} months={6}/>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Car className="size-4 text-primary"/> Járművek</h3>
          <div className="flex items-center gap-3">
            {staff && <span className="flex items-center gap-2 text-xs text-slate-400">Jármű-hibapont <StrikeDots count={member.vehicleWarnings}/></span>}
            {canAssign && member.system_role !== "pending" && (
              <Button size="sm" variant="outline" onClick={() => setAssigning(true)}><KeyRound/> Jármű kiosztása</Button>
            )}
          </div>
        </div>
        {vehicles.length === 0 ? (
          <p className="text-sm text-slate-500">Nincs hozzárendelt jármű.</p>
        ) : (
          <ul className="space-y-2">
            {vehicles.map((vehicle) => (
              <li key={vehicle.id}>
                <Link to={`/logistics/fleet/${vehicle.id}`}
                      className="flex flex-wrap items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-white/5 transition-colors hover:bg-white/[0.06]">
                  <LicensePlate plate={vehicle.plate} size="sm"/>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{vehicle.model}</span>
                  {vehicle.registration_required
                    ? <RegistrationBadge expiresOn={vehicle.registration_expires_on}/>
                    : <span className="text-[11px] text-teal-200">Nem kell forgalmi</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {assigning && (
          <AssignVehiclesDialog open person={profiles.find((person) => person.id === member.id) ?? null} vehicles={stock ?? []}
                                categories={categories} people={profiles} viewer={profiles.find((person) => person.id === viewer.id) ?? null}
                                onOpenChange={setAssigning}/>
        )}
      </section>
    </div>
  );
}

function Fact({label, value}: {label: string; value: ReactNode}) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-slate-100">{value}</div>
    </div>
  );
}

export interface Departure {
  leave_type: LeaveType;
  left_on: string;
  reason: string | null;
  rehire: RehireStatus;
  rehire_note: string | null;
}

/** Removing a member archives them in "Kilépettek" first (when, why, may they return). */
export function DismissDialog({member, open, onOpenChange, onConfirm}: {
  member: HrMember; open: boolean; onOpenChange: (open: boolean) => void; onConfirm: (departure: Departure) => Promise<void>;
}) {
  const [leaveType, setLeaveType] = useState<LeaveType>("dismissed");
  const [leftOn, setLeftOn] = useState(() => todayKey());
  const [reason, setReason] = useState("");
  const [rehire, setRehire] = useState<RehireStatus>("eligible");
  const [rehireNote, setRehireNote] = useState("");
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (reason.trim().length < 3) return toast.error("Add meg a távozás okát.");
    setBusy(true);
    try {
      await onConfirm({leave_type: leaveType, left_on: leftOn, reason: reason.trim(), rehire, rehire_note: rehireNote.trim() || null});
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-300"><UserMinus className="size-5"/>{member.full_name} távozása</DialogTitle>
          <DialogDescription>
            A fiók törlődik, a tag a „Kilépettek” nyilvántartásba kerül. Az értesítései, feljegyzései és vizsgái nem állíthatók vissza.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Távozás módja</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(LEAVE_TYPE_META) as LeaveType[]).map((type) => (
                <button key={type} type="button" onClick={() => setLeaveType(type)}
                        className={cn("h-8 rounded-lg px-3 text-xs font-medium ring-1 transition-colors",
                          leaveType === type ? LEAVE_TYPE_META[type].pill : "text-slate-400 ring-white/10 hover:text-slate-200")}>
                  {LEAVE_TYPE_META[type].label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
            <div className="space-y-1.5">
              <Label>Dátum</Label>
              <Input type="date" value={leftOn} max={todayKey()} onChange={(event) => setLeftOn(event.target.value)}/>
            </div>
            <div className="space-y-1.5">
              <Label>Visszatérhet?</Label>
              <Select value={rehire} onValueChange={(value) => setRehire(value as RehireStatus)}>
                <SelectTrigger className="w-full"><SelectValue/></SelectTrigger>
                <SelectContent>
                  {(Object.keys(REHIRE_META) as RehireStatus[]).map((value) => <SelectItem key={value} value={value}>{REHIRE_META[value].label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Indok</Label>
            <Textarea value={reason} rows={3} maxLength={1000} onChange={(event) => setReason(event.target.value)}
                      placeholder="Pl. saját kérésre kilépett / ismételt szabályszegés"/>
          </div>
          {rehire !== "eligible" && (
            <div className="space-y-1.5">
              <Label>Feltétel / megjegyzés</Label>
              <Input value={rehireNote} maxLength={500} onChange={(event) => setRehireNote(event.target.value)}/>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Mégse</Button>
          <Button className="bg-red-600 text-white hover:bg-red-500" onClick={() => void confirm()} disabled={busy}>
            {busy ? <Loader2 className="animate-spin"/> : <UserMinus/>} Távozás rögzítése
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
