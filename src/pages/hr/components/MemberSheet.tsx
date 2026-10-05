import {useCallback, useEffect, useMemo, useState, type ReactNode} from "react";
import {toast} from "sonner";
import {
  AlertTriangle, Award, CalendarOff, Check, ClipboardList, Crown, History, KeyRound, Loader2, Medal, NotebookPen, Plus, Save,
  ShieldCheck, Star, ThumbsUp, Trash2, UserMinus, X,
} from "lucide-react";
import {Sheet, SheetContent, SheetDescription, SheetTitle} from "@/components/ui/sheet";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Switch} from "@/components/ui/switch";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {EmptyState} from "@/components/layout/EmptyState";
import {useAuth} from "@/context/AuthContext";
import {postApi} from "@/lib/api";
import {getOptimizedAvatarUrl} from "@/lib/cloudinary";
import {useProfileDirectory} from "@/lib/profile-directory";
import {getRibbonCatalogue} from "@/lib/ribbons";
import {
  canAssignRank, canAwardRibbon, canEditUser, canManageRecords, canManageUserDivision, canManageUserQualification,
  canManageUserRank, cn, errorMessage, getAllowedPromotionRanks, getDivisionRanks, isExecutive, isStaff,
} from "@/lib/utils";
import {
  DIVISIONS, QUALIFICATIONS, type HrRecord, type HrRecordKind, type MemberEvent, type Profile, type Ribbon,
} from "@/types/supabase";
import {daysSince, DIVISION_META, formatDate, formatSpan} from "../hr-utils";
import {RankStepper} from "./RankControls";
import {DismissDialog, MemberRegistryTab, type Departure} from "./MemberRegistryTab";
import {ACTIVITY_META} from "@/lib/registry";
import type {AwardSummary, DetailsPatch, HrMember, MemberChanges} from "../useHrData";

interface MemberSheetProps {
  member: HrMember | null;
  viewer: Profile;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onRankChange: (member: HrMember, rank: string) => void;
  onUpdate: (memberId: string, changes: MemberChanges) => Promise<Profile>;
  onRemove: (member: HrMember, departure: Departure) => Promise<void>;
  onRecordChanged: (record: HrRecord) => void;
  onAwardsChanged: (memberId: string, awards: AwardSummary[]) => void;
  onSaveDetails: (memberId: string, patch: DetailsPatch) => Promise<void>;
  onSaveBankAccount: (memberId: string, accountNumber: string | null) => Promise<void>;
}

export function MemberSheet(props: MemberSheetProps) {
  const {member, onOpenChange} = props;
  return (
    <Sheet open={!!member} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl" data-tour="member-sheet">
        {member && <MemberSheetBody key={member.id} {...props} member={member}/>}
      </SheetContent>
    </Sheet>
  );
}

function MemberSheetBody({member, viewer, busy, onRankChange, onUpdate, onRemove, onRecordChanged, onAwardsChanged, onSaveDetails,
  onSaveBankAccount}: MemberSheetProps & {member: HrMember}) {
  const [tab, setTab] = useState("profile");
  const division = DIVISION_META[member.division] ?? DIVISION_META.TSB;
  const allowedRanks = useMemo(
    () => getAllowedPromotionRanks(viewer).filter((rank) => rank !== member.faction_rank && canAssignRank(viewer, member, rank)),
    [viewer, member],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b p-5 pr-12">
        <div className="flex items-start gap-4">
          <Avatar className="size-16 ring-2 ring-white/10">
            <AvatarImage src={getOptimizedAvatarUrl(member.avatar_url, 128) || undefined} alt=""/>
            <AvatarFallback className="bg-slate-800 text-lg font-semibold text-slate-200">{member.full_name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <SheetTitle className="flex items-center gap-2 text-xl">
              <span className="truncate">{member.full_name}</span>
              {member.is_bureau_manager && <Crown className="size-4 text-violet-400"/>}
              {member.is_bureau_commander && <Star className="size-4 text-sky-400"/>}
            </SheetTitle>
            <SheetDescription className="mt-0.5 font-mono">#{member.badge_number}</SheetDescription>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className={cn("inline-flex h-6 items-center rounded-md px-2 text-xs font-semibold ring-1", division.pill)}>
                {division.label}{member.division_rank ? ` · ${member.division_rank}` : ""}
              </span>
              {member.onLeaveNow && (
                <span className="inline-flex h-6 items-center gap-1 rounded-md bg-sky-500/10 px-2 text-xs text-sky-300 ring-1 ring-sky-500/30">
                  <CalendarOff className="size-3"/> Szabadságon {formatDate(member.leave?.ends_on)}-ig
                </span>
              )}
              {member.warnings > 0 && (
                <span className="inline-flex h-6 items-center gap-1 rounded-md bg-red-500/10 px-2 text-xs text-red-300 ring-1 ring-red-500/30">
                  <AlertTriangle className="size-3"/> {member.warnings} figyelmeztetés
                </span>
              )}
              {member.details && !member.onLeaveNow && (
                <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-xs ring-1", ACTIVITY_META[member.details.activity_status].pill)}>
                  <span className={cn("size-1.5 rounded-full", ACTIVITY_META[member.details.activity_status].dot)}/>
                  {ACTIVITY_META[member.details.activity_status].label}
                </span>
              )}
              {member.details?.station && (
                <span className="inline-flex h-6 items-center rounded-md bg-white/[0.04] px-2 text-xs text-slate-300 ring-1 ring-white/10">
                  {member.details.station}{member.details.parking_spot ? ` · ${member.details.parking_spot}` : ""}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Rank: one click up or down, or pick any allowed rank */}
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5" data-tour="member-rank">
          <div className="text-xs text-slate-400">Rendfokozat</div>
          <RankStepper member={member} viewer={viewer} busy={busy} onChange={(rank) => onRankChange(member, rank)}/>
          {allowedRanks.length > 0 && (
            <Select value="" onValueChange={(rank) => onRankChange(member, rank)} disabled={busy}>
              <SelectTrigger className="ml-auto h-8 w-[200px] text-xs"><SelectValue placeholder="Másik rang kiválasztása…"/></SelectTrigger>
              <SelectContent className="max-h-80">
                {allowedRanks.map((rank) => <SelectItem key={rank} value={rank}>{rank}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col gap-0">
        <TabsList className="mx-5 mt-4 w-auto justify-start self-start">
          <TabsTrigger value="profile"><ShieldCheck className="size-3.5"/> Adatlap</TabsTrigger>
          <TabsTrigger value="registry"><ClipboardList className="size-3.5"/> Nyilvántartás</TabsTrigger>
          <TabsTrigger value="history"><History className="size-3.5"/> Előzmények</TabsTrigger>
          <TabsTrigger value="records"><NotebookPen className="size-3.5"/> Feljegyzések</TabsTrigger>
          <TabsTrigger value="awards"><Medal className="size-3.5"/> Kitüntetések</TabsTrigger>
        </TabsList>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <TabsContent value="profile" className="mt-0">
            <ProfileTab member={member} viewer={viewer} onUpdate={onUpdate} onRemove={onRemove}/>
          </TabsContent>
          <TabsContent value="registry" className="mt-0">
            <MemberRegistryTab key={`${member.details?.updated_at ?? ""}|${member.bankAccount ?? ""}`} member={member} viewer={viewer}
                               onSaveDetails={onSaveDetails} onSaveBankAccount={onSaveBankAccount}/>
          </TabsContent>
          <TabsContent value="history" className="mt-0">
            {tab === "history" && <MemberHistoryTimeline member={member}/>}
          </TabsContent>
          <TabsContent value="records" className="mt-0">
            {tab === "records" && <RecordsTab member={member} viewer={viewer} onRecordChanged={onRecordChanged}/>}
          </TabsContent>
          <TabsContent value="awards" className="mt-0">
            <AwardsTab member={member} viewer={viewer} onAwardsChanged={onAwardsChanged}/>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// --- Adatlap -----------------------------------------------------------------

function Fact({label, value, hint}: {label: string; value: ReactNode; hint?: string}) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5" title={hint}>
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-slate-100">{value}</div>
    </div>
  );
}

function ProfileTab({member, viewer, onUpdate, onRemove}: {
  member: HrMember; viewer: Profile;
  onUpdate: (memberId: string, changes: MemberChanges) => Promise<Profile>;
  onRemove: (member: HrMember, departure: Departure) => Promise<void>;
}) {
  const isManager = !!viewer.is_bureau_manager;
  const canEdit = canEditUser(viewer, member);
  const rankRight = canManageUserRank(viewer, member) && (viewer.id !== member.id || isManager);
  const divisionRight = canManageUserDivision(viewer, member) && (viewer.id !== member.id || isManager);
  const [form, setForm] = useState(() => toForm(member));
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    setForm(toForm(member));
  }, [member]);

  const changes = useMemo(() => diffForm(member, form), [member, form]);
  const dirty = Object.keys(changes).length > 0;
  const canDismiss = viewer.id !== member.id && (isManager || (isStaff(viewer) && canManageUserRank(viewer, member)));

  const save = async () => {
    setSaving(true);
    try {
      await onUpdate(member.id, changes);
      toast.success("Adatlap mentve.");
    } catch (error) {
      toast.error(errorMessage(error, "A mentés nem sikerült."));
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    setPasswordBusy(true);
    try {
      await postApi("/api/admin/update-password", {targetUserId: member.id, newPassword: password});
      toast.success("Az új jelszó beállítva. A tag értesítést kapott.");
      setPassword("");
    } catch (error) {
      toast.error(errorMessage(error, "A jelszó módosítása nem sikerült."));
    } finally {
      setPasswordBusy(false);
    }
  };

  const toggleQualification = (q: string) => setForm((prev) => ({
    ...prev,
    qualifications: prev.qualifications.includes(q) ? prev.qualifications.filter((x) => x !== q) : [...prev.qualifications, q],
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Fact label="Szolgálati idő" value={formatSpan(daysSince(member.details?.joined_on ?? member.created_at))}
              hint={`Csatlakozott: ${formatDate(member.details?.joined_on ?? member.created_at)}`}/>
        <Fact label="Rangon töltött idő" value={formatSpan(daysSince(member.last_promotion_date ?? member.created_at))}
              hint={`Utolsó előléptetés: ${formatDate(member.last_promotion_date)}`}/>
        <Fact label="Csatlakozott" value={formatDate(member.details?.joined_on ?? member.created_at)}/>
        <Fact label="Utolsó előléptetés" value={formatDate(member.last_promotion_date)}/>
        <Fact label="Kitüntetések" value={member.awards.length}/>
        {isStaff(viewer) && (
          <Fact label="Utoljára aktív" value={member.lastSeen ? formatDate(member.lastSeen) : "–"}/>
        )}
      </div>

      {canEdit ? (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-white">Adatok szerkesztése</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Teljes név</Label>
              <Input value={form.full_name} disabled={!rankRight}
                     onChange={(event) => setForm({...form, full_name: event.target.value})}/>
            </div>
            <div className="space-y-1.5">
              <Label>Jelvényszám</Label>
              <Input value={form.badge_number} disabled={!rankRight} maxLength={4} inputMode="numeric" className="font-mono"
                     onChange={(event) => setForm({...form, badge_number: event.target.value.replace(/\D/g, "")})}/>
            </div>
            <div className="space-y-1.5">
              <Label>Osztály</Label>
              <Select value={form.division} disabled={!divisionRight}
                      onValueChange={(value) => setForm({...form, division: value, division_rank: value === "TSB" ? "" : form.division_rank})}>
                <SelectTrigger className="w-full"><SelectValue/></SelectTrigger>
                <SelectContent>
                  {DIVISIONS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Alosztály rang</Label>
              <Select value={form.division_rank || "none"} disabled={!divisionRight || form.division === "TSB"}
                      onValueChange={(value) => setForm({...form, division_rank: value === "none" ? "" : value})}>
                <SelectTrigger className="w-full"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nincs</SelectItem>
                  {getDivisionRanks(form.division).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Képesítések</Label>
            <div className="flex flex-wrap gap-2">
              {QUALIFICATIONS.map((q) => {
                const active = form.qualifications.includes(q);
                const allowed = canManageUserQualification(viewer, member, q) && (viewer.id !== member.id || isManager);
                return (
                  <button key={q} type="button" disabled={!allowed} onClick={() => toggleQualification(q)}
                          className={cn(
                            "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 font-mono text-xs font-semibold ring-1 transition-colors",
                            active ? "bg-primary/15 text-primary ring-primary/40" : "bg-white/[0.03] text-slate-400 ring-white/10",
                            allowed ? "hover:ring-white/30" : "cursor-not-allowed opacity-50",
                          )}>
                    {active && <Check className="size-3.5"/>}{q}
                  </button>
                );
              })}
            </div>
          </div>

          {isManager && (
            <div className="space-y-3 rounded-xl bg-violet-500/[0.05] p-4 ring-1 ring-violet-500/20">
              <p className="text-xs font-semibold text-violet-300">Vezetői kinevezések (Bureau Manager)</p>
              <label className="flex items-center justify-between gap-3 text-sm text-slate-200">
                <span>Bureau Manager <span className="block text-xs text-slate-500">Teljes körű rendszerhozzáférés.</span></span>
                <Switch checked={form.is_bureau_manager} onCheckedChange={(value) => setForm({...form, is_bureau_manager: value})}/>
              </label>
              <label className="flex items-center justify-between gap-3 text-sm text-slate-200">
                <span>Bureau Commander <span className="block text-xs text-slate-500">A(z) {form.division} osztály parancsnoka.</span></span>
                <Switch checked={form.is_bureau_commander} disabled={form.division === "TSB"}
                        onCheckedChange={(value) => setForm({...form, is_bureau_commander: value})}/>
              </label>
              <div className="space-y-1.5">
                <p className="text-sm text-slate-200">Alosztály vezetés</p>
                <div className="flex flex-wrap gap-2">
                  {QUALIFICATIONS.map((q) => {
                    const active = form.commanded_divisions.includes(q);
                    return (
                      <button key={q} type="button" onClick={() => setForm((prev) => ({
                        ...prev,
                        commanded_divisions: active ? prev.commanded_divisions.filter((x) => x !== q) : [...prev.commanded_divisions, q],
                        qualifications: active || prev.qualifications.includes(q) ? prev.qualifications : [...prev.qualifications, q],
                      }))}
                              className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg px-3 font-mono text-xs font-semibold ring-1",
                                active ? "bg-amber-500/15 text-amber-300 ring-amber-500/40" : "bg-white/[0.03] text-slate-400 ring-white/10 hover:ring-white/30")}>
                        {active && <Crown className="size-3.5"/>}{q}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            {dirty && <Button variant="ghost" onClick={() => setForm(toForm(member))}>Visszaállítás</Button>}
            <Button onClick={() => void save()} disabled={!dirty || saving}>
              {saving ? <Loader2 className="animate-spin"/> : <Save/>} Mentés
            </Button>
          </div>
        </section>
      ) : (
        <p className="rounded-xl bg-white/[0.03] p-4 text-sm text-slate-400 ring-1 ring-white/5">
          A tag adatait a rangod alapján nem módosíthatod.
        </p>
      )}

      {(isExecutive(viewer) && viewer.id !== member.id && (!member.is_bureau_manager || isManager)) || canDismiss ? (
        <section className="space-y-3 rounded-xl bg-red-500/[0.04] p-4 ring-1 ring-red-500/20">
          <p className="text-xs font-semibold text-red-300">Veszélyzóna</p>
          {isExecutive(viewer) && viewer.id !== member.id && (!member.is_bureau_manager || isManager) && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)}
                     placeholder="Új jelszó (min. 6 karakter)" autoComplete="new-password"/>
              <Button variant="outline" disabled={password.length < 6 || passwordBusy} onClick={() => void resetPassword()}>
                {passwordBusy ? <Loader2 className="animate-spin"/> : <KeyRound/>} Jelszó beállítása
              </Button>
            </div>
          )}
          {canDismiss && (
            <Button variant="outline" className="text-red-300 hover:text-red-200" onClick={() => setConfirmRemove(true)}>
              <UserMinus/> Távozás / elbocsátás
            </Button>
          )}
        </section>
      ) : null}

      <DismissDialog member={member} open={confirmRemove} onOpenChange={setConfirmRemove}
                     onConfirm={(departure) => onRemove(member, departure)}/>
    </div>
  );
}

interface FormState {
  full_name: string;
  badge_number: string;
  division: string;
  division_rank: string;
  qualifications: string[];
  is_bureau_manager: boolean;
  is_bureau_commander: boolean;
  commanded_divisions: string[];
}

const toForm = (member: Profile): FormState => ({
  full_name: member.full_name,
  badge_number: member.badge_number,
  division: member.division,
  division_rank: member.division_rank ?? "",
  qualifications: [...(member.qualifications ?? [])],
  is_bureau_manager: !!member.is_bureau_manager,
  is_bureau_commander: !!member.is_bureau_commander,
  commanded_divisions: [...(member.commanded_divisions ?? [])],
});

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((value) => b.includes(value));

function diffForm(member: Profile, form: FormState): MemberChanges {
  const changes: MemberChanges = {};
  if (form.full_name.trim() !== member.full_name) changes.full_name = form.full_name.trim();
  if (form.badge_number !== member.badge_number) changes.badge_number = form.badge_number;
  if (form.division !== member.division) changes.division = form.division;
  if ((form.division_rank || null) !== (member.division_rank ?? null) || form.division !== member.division) {
    changes.division_rank = form.division_rank || null;
  }
  if (!sameSet(form.qualifications, member.qualifications ?? [])) changes.qualifications = form.qualifications;
  if (form.is_bureau_manager !== !!member.is_bureau_manager) changes.is_bureau_manager = form.is_bureau_manager;
  if (form.is_bureau_commander !== !!member.is_bureau_commander) changes.is_bureau_commander = form.is_bureau_commander;
  if (!sameSet(form.commanded_divisions, member.commanded_divisions ?? [])) changes.commanded_divisions = form.commanded_divisions;
  return changes;
}

// --- Előzmények ---------------------------------------------------------------

const EVENT_LABELS: Record<MemberEvent["kind"], string> = {
  joined: "Csatlakozott az állományhoz",
  rank: "Rendfokozat változás",
  division: "Osztályváltás",
  division_rank: "Alosztály rang",
  qualifications: "Képesítések",
  bureau_role: "Vezetői kinevezés",
  name: "Névváltozás",
  badge: "Új jelvényszám",
  award: "Kitüntetés",
  award_revoked: "Kitüntetés visszavonva",
};

export function describeEvent(event: MemberEvent): string {
  switch (event.kind) {
    case "joined":
      return event.to_value ? `Kezdő rang: ${event.to_value}` : "";
    case "rank":
      return `${event.from_value ?? "?"} → ${event.to_value ?? "?"}`;
    case "division":
      return `${event.from_value ?? "?"} → ${event.to_value ?? "?"}`;
    case "division_rank":
      return event.to_value ?? "Nincs alosztály rang";
    case "qualifications":
      return [event.to_value && `+ ${event.to_value}`, event.from_value && `− ${event.from_value}`].filter(Boolean).join("   ");
    case "bureau_role":
      return event.to_value || "Kinevezések visszavonva";
    case "name":
      return `${event.from_value ?? "?"} → ${event.to_value ?? "?"}`;
    case "badge":
      return `#${event.from_value ?? "?"} → #${event.to_value ?? "?"}`;
    case "award":
    case "award_revoked":
      return event.to_value ?? event.from_value ?? "";
    default:
      return "";
  }
}

export const eventTone = (event: MemberEvent) => {
  if (event.kind === "rank") return event.detail === "promotion" ? "bg-emerald-400" : "bg-red-400";
  if (event.kind === "award") return "bg-amber-400";
  if (event.kind === "award_revoked") return "bg-red-400";
  if (event.kind === "joined") return "bg-primary";
  return "bg-sky-400";
};

/** Service history of a member (rank changes, awards, ...), newest first. */
export function MemberHistoryTimeline({member}: {member: Pick<Profile, "id">}) {
  const {supabase} = useAuth();
  const {profiles} = useProfileDirectory();
  const [events, setEvents] = useState<MemberEvent[] | null>(null);

  useEffect(() => {
    let active = true;
    supabase.from("member_events").select("*").eq("user_id", member.id).order("created_at", {ascending: false}).limit(100)
      .then(({data}) => {
        if (active) setEvents((data ?? []) as MemberEvent[]);
      });
    return () => {
      active = false;
    };
  }, [supabase, member.id]);

  const names = useMemo(() => new Map(profiles.map((p) => [p.id, p.full_name])), [profiles]);

  if (!events) return <div className="flex justify-center py-10"><Loader2 className="size-5 animate-spin text-primary/70"/></div>;
  if (events.length === 0) return <EmptyState icon={History} title="Még nincs rögzített esemény." compact/>;

  return (
    <ol className="relative space-y-4 border-l border-white/10 pl-5">
      {events.map((event) => (
        <li key={event.id} className="relative">
          <span className={cn("absolute top-1.5 -left-[25px] size-2.5 rounded-full ring-4 ring-[var(--card)]", eventTone(event))}/>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-slate-100">
              {event.kind === "rank" ? (event.detail === "promotion" ? "Előléptetés" : "Lefokozás") : EVENT_LABELS[event.kind]}
            </p>
            <span className="text-xs text-slate-500">{formatDate(event.created_at)}</span>
          </div>
          <p className="text-sm text-slate-400">{describeEvent(event)}</p>
          {event.actor_id && event.actor_id !== event.user_id && (
            <p className="text-xs text-slate-500">Rögzítette: {names.get(event.actor_id) ?? "ismeretlen"}</p>
          )}
        </li>
      ))}
    </ol>
  );
}

// --- Feljegyzések -------------------------------------------------------------

const RECORD_KINDS: Record<HrRecordKind, {label: string; icon: typeof AlertTriangle; tone: string}> = {
  warning: {label: "Figyelmeztetés", icon: AlertTriangle, tone: "bg-red-500/10 text-red-300 ring-red-500/30"},
  commendation: {label: "Dicséret", icon: ThumbsUp, tone: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"},
  note: {label: "Belső jegyzet", icon: NotebookPen, tone: "bg-slate-500/10 text-slate-300 ring-slate-500/30"},
  leave: {label: "Szabadság", icon: CalendarOff, tone: "bg-sky-500/10 text-sky-300 ring-sky-500/30"},
};

const STATUS_LABELS: Record<HrRecord["status"], string> = {
  pending: "Jóváhagyásra vár", active: "Aktív", rejected: "Elutasítva", revoked: "Visszavonva",
};

function RecordsTab({member, viewer, onRecordChanged}: {member: HrMember; viewer: Profile; onRecordChanged: (record: HrRecord) => void}) {
  const {supabase} = useAuth();
  const {profiles} = useProfileDirectory();
  const [records, setRecords] = useState<HrRecord[] | null>(null);
  const canWrite = canManageRecords(viewer, member);
  const [kind, setKind] = useState<HrRecordKind>("warning");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [saving, setSaving] = useState(false);
  const names = useMemo(() => new Map(profiles.map((p) => [p.id, p.full_name])), [profiles]);

  const load = useCallback(async () => {
    const {data} = await supabase.from("hr_records").select("*").eq("user_id", member.id).order("created_at", {ascending: false});
    setRecords((data ?? []) as HrRecord[]);
  }, [supabase, member.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    if (title.trim().length < 2) return toast.error("Adj meg egy rövid címet.");
    if (kind === "leave" && (!startsOn || !endsOn)) return toast.error("A szabadsághoz kezdő és záró dátum kell.");
    setSaving(true);
    const {data, error} = await supabase.from("hr_records").insert({
      user_id: member.id, kind, title: title.trim(), details: details.trim() || null,
      starts_on: startsOn || null, ends_on: endsOn || null, status: "active", created_by: viewer.id,
    }).select("*").single();
    setSaving(false);
    if (error) return toast.error("Hiba: " + errorMessage(error));
    const record = data as HrRecord;
    setRecords((prev) => [record, ...(prev ?? [])]);
    onRecordChanged(record);
    setTitle("");
    setDetails("");
    setStartsOn("");
    setEndsOn("");
    toast.success(`${RECORD_KINDS[kind].label} rögzítve.`);
  };

  const setStatus = async (record: HrRecord, status: HrRecord["status"]) => {
    const {data, error} = await supabase.from("hr_records").update({status}).eq("id", record.id).select("*").single();
    if (error) return toast.error("Hiba: " + errorMessage(error));
    const updated = data as HrRecord;
    setRecords((prev) => (prev ?? []).map((item) => (item.id === record.id ? updated : item)));
    onRecordChanged(updated);
  };

  return (
    <div className="space-y-5" data-tour="member-records">
      {canWrite && (
        <section className="space-y-3 rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/5">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(RECORD_KINDS) as HrRecordKind[]).map((key) => {
              const meta = RECORD_KINDS[key];
              const Icon = meta.icon;
              return (
                <button key={key} type="button" onClick={() => setKind(key)}
                        className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium ring-1 transition-colors",
                          kind === key ? meta.tone : "text-slate-400 ring-white/10 hover:text-slate-200")}>
                  <Icon className="size-3.5"/>{meta.label}
                </button>
              );
            })}
          </div>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120}
                 placeholder={kind === "leave" ? "Pl. Nyaralás" : kind === "warning" ? "Pl. Szabályzat megsértése" : "Rövid cím"}/>
          <Textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={2000} rows={3}
                    placeholder={kind === "note" ? "Csak a vezetőség látja." : "Részletek (opcionális)"}/>
          {(kind === "leave" || kind === "warning") && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">{kind === "leave" ? "Kezdete" : "Érvényes ettől"}</Label>
                <Input type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)}/>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{kind === "leave" ? "Vége" : "Lejárat (opcionális)"}</Label>
                <Input type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)}/>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              {kind === "note" ? "A belső jegyzetet a tag nem látja." : "A tag értesítést kap a bejegyzésről."}
            </p>
            <Button onClick={() => void add()} disabled={saving}>
              {saving ? <Loader2 className="animate-spin"/> : <Plus/>} Rögzítés
            </Button>
          </div>
        </section>
      )}

      {!records ? (
        <div className="flex justify-center py-10"><Loader2 className="size-5 animate-spin text-primary/70"/></div>
      ) : records.length === 0 ? (
        <EmptyState icon={NotebookPen} title="Nincs feljegyzés." compact
                    description={canWrite ? "Figyelmeztetés, dicséret, belső jegyzet vagy szabadság rögzíthető." : undefined}/>
      ) : (
        <ul className="space-y-2">
          {records.map((record) => {
            const meta = RECORD_KINDS[record.kind];
            const Icon = meta.icon;
            const inactive = record.status === "revoked" || record.status === "rejected";
            return (
              <li key={record.id} className={cn("rounded-xl p-3 ring-1 ring-white/5", inactive ? "bg-white/[0.01] opacity-60" : "bg-white/[0.03]")}>
                <div className="flex items-start gap-3">
                  <div className={cn("grid size-8 shrink-0 place-items-center rounded-lg ring-1", meta.tone)}><Icon className="size-4"/></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-slate-100">{record.title}</p>
                      <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[11px] text-slate-400">{STATUS_LABELS[record.status]}</span>
                    </div>
                    {record.details && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-400">{record.details}</p>}
                    <p className="mt-1 text-xs text-slate-500">
                      {meta.label}
                      {(record.starts_on || record.ends_on) && ` · ${formatDate(record.starts_on)} – ${formatDate(record.ends_on)}`}
                      {` · ${formatDate(record.created_at)}`}
                      {record.created_by && record.created_by !== record.user_id && ` · ${names.get(record.created_by) ?? "ismeretlen"}`}
                    </p>
                  </div>
                  {canWrite && (
                    <div className="flex shrink-0 gap-1">
                      {record.status === "pending" && (
                        <>
                          <Button size="icon-sm" variant="ghost" title="Jóváhagyás" className="text-emerald-400"
                                  onClick={() => void setStatus(record, "active")}><Check className="size-4"/></Button>
                          <Button size="icon-sm" variant="ghost" title="Elutasítás" className="text-red-400"
                                  onClick={() => void setStatus(record, "rejected")}><X className="size-4"/></Button>
                        </>
                      )}
                      {record.status === "active" && record.kind !== "note" && (
                        <Button size="sm" variant="ghost" className="text-xs text-slate-400"
                                onClick={() => void setStatus(record, "revoked")}>Visszavonás</Button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// --- Kitüntetések -------------------------------------------------------------

function AwardsTab({member, viewer, onAwardsChanged}: {
  member: HrMember; viewer: Profile; onAwardsChanged: (memberId: string, awards: AwardSummary[]) => void;
}) {
  const {supabase} = useAuth();
  const canAward = canAwardRibbon(viewer) && viewer.id !== member.id;
  const [catalogue, setCatalogue] = useState<Ribbon[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!canAward) return;
    getRibbonCatalogue().then(setCatalogue).catch(() => setCatalogue([]));
  }, [canAward]);

  const give = async () => {
    if (!selected) return;
    setBusy(true);
    const {error} = await supabase.rpc("hr_give_award", {_target_user_id: member.id, _ribbon_id: selected});
    if (error) {
      setBusy(false);
      return toast.error("Hiba: " + errorMessage(error));
    }
    const {data} = await supabase.from("user_ribbons").select("id, ribbon_id, awarded_at, ribbons(name, color_hex)").eq("user_id", member.id);
    setBusy(false);
    setSelected("");
    onAwardsChanged(member.id, ((data ?? []) as unknown as {id: string; ribbon_id: string; awarded_at: string | null;
      ribbons: {name: string; color_hex: string | null} | null}[]).map((row) => ({
      id: row.id, ribbon_id: row.ribbon_id, awarded_at: row.awarded_at, name: row.ribbons?.name ?? "Kitüntetés", color_hex: row.ribbons?.color_hex ?? null,
    })));
    toast.success("Kitüntetés átadva.");
  };

  const revoke = async (award: AwardSummary) => {
    const {error} = await supabase.from("user_ribbons").delete().eq("id", award.id);
    if (error) return toast.error("Hiba: " + errorMessage(error));
    onAwardsChanged(member.id, member.awards.filter((item) => item.id !== award.id));
    toast.success("Kitüntetés visszavonva.");
  };

  return (
    <div className="space-y-5">
      {canAward && (
        <div className="flex flex-col gap-2 rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/5 sm:flex-row">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Válassz kitüntetést…"/></SelectTrigger>
            <SelectContent>
              {catalogue.map((ribbon) => (
                <SelectItem key={ribbon.id} value={ribbon.id}>
                  <span className="size-2.5 rounded-full" style={{backgroundColor: ribbon.color_hex ?? "#eab308"}}/>{ribbon.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => void give()} disabled={!selected || busy}>
            {busy ? <Loader2 className="animate-spin"/> : <Award/>} Átadás
          </Button>
        </div>
      )}
      {member.awards.length === 0 ? (
        <EmptyState icon={Medal} title="Még nincs kitüntetése." compact/>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {member.awards.map((award) => (
            <li key={award.id} className="group flex items-center gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5">
              <div className="grid size-10 place-items-center rounded-lg ring-1 ring-white/10"
                   style={{backgroundColor: `${award.color_hex ?? "#eab308"}22`, color: award.color_hex ?? "#eab308"}}>
                <Medal className="size-5"/>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-100">{award.name}</p>
                <p className="text-xs text-slate-500">{formatDate(award.awarded_at)}</p>
              </div>
              {canAwardRibbon(viewer) && (
                <Button size="icon-sm" variant="ghost" title="Visszavonás" className="text-slate-500 opacity-0 group-hover:opacity-100 hover:text-red-400"
                        onClick={() => void revoke(award)}><Trash2 className="size-4"/></Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
