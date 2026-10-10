import * as React from "react";
import {Link, useNavigate, useSearchParams} from "react-router";
import {toast} from "sonner";
import {
  AlertTriangle, Award, BellRing, Briefcase, CalendarClock, CalendarOff, CalendarPlus, Camera, Car, CheckCircle2, ClipboardCheck, Clock, FlaskConical, History,
  Hourglass, Key, Landmark, Loader2, Medal, NotebookPen, Printer, RefreshCw, Save, ShieldCheck, Sparkles, ThumbsUp, TrendingUp, UploadCloud, UserCog, X,
} from "lucide-react";
import {useAuth} from "@/context/AuthContext";
import {Button} from "@/components/ui/button";
import {DivisionTitleBadges} from "@/components/hr/DivisionTitleBadges";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {SheriffStar} from "@/components/brand/SheriffStar";
import {StatCard} from "@/components/layout/StatCard";
import {EmptyState} from "@/components/layout/EmptyState";
import {DutyChart} from "@/components/hr/DutyChart";
import {RibbonRack} from "@/components/hr/RibbonRack";
import {RegistrationBadge} from "@/components/fleet/RegistrationBadge";
import {MemberHistoryTimeline} from "@/pages/hr/components/MemberSheet";
import {daysSince, DIVISION_META, formatDate, formatSpan, rankPillClass} from "@/pages/hr/hr-utils";
import {deleteCloudinaryAssets, getOptimizedAvatarUrl, uploadToCloudinary} from "@/lib/cloudinary";
import {
  ACTIVITY_META, formatAccountNumber, formatDuty, isValidAccountNumber, JOIN_TYPE_LABELS, monthStart, recentMonths,
} from "@/lib/registry";
import {cn, errorMessage} from "@/lib/utils";
import type {
  DutyTimeEntry, FleetVehicle, HrRecord, HrRegistry, MemberDetails, Profile, RegistryVehicle, Ribbon, VehicleWarning,
} from "@/types/supabase";
import {IdCard} from "./IdCard";
import {TrainingCenter} from "./TrainingCenter";
import {CertificatesTab} from "./CertificatesTab";
import {ReviewList} from "@/components/reviews/ReviewList";
import {TwoFactorCard} from "./TwoFactorCard";
import {SignatureCard} from "./SignatureCard";
import {SessionsCard} from "./SessionsCard";
import {DisplayCard} from "./DisplayCard";
import {awardHref} from "@/lib/documents";
import {MonthlyRecapDialog} from "@/components/recap/MonthlyRecapDialog";
import {StrikeDots} from "@/components/hr/StrikeDots";
import {RegistrationDialog} from "@/components/fleet/RegistrationDialog";
import {LicensePlate} from "@/components/fleet/LicensePlate";
import {fetchFleetVehicle} from "@/lib/fleet-store";
import {addMonths, monthKey, todayKey} from "@/lib/datetime";

interface AwardedRibbon extends Ribbon {
  awarded_at: string;
  /** The user_ribbons row (the certificate's address). */
  award_id: string;
}

const RECORD_META: Record<HrRecord["kind"], {label: string; icon: typeof AlertTriangle; tone: string}> = {
  warning: {label: "Figyelmeztetés", icon: AlertTriangle, tone: "bg-red-500/10 text-red-300 ring-red-500/30"},
  commendation: {label: "Dicséret", icon: ThumbsUp, tone: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"},
  note: {label: "Jegyzet", icon: NotebookPen, tone: "bg-slate-500/10 text-slate-300 ring-slate-500/30"},
  leave: {label: "Szabadság", icon: CalendarOff, tone: "bg-sky-500/10 text-sky-300 ring-sky-500/30"},
};

const RECORD_STATUS: Record<HrRecord["status"], string> = {
  pending: "Elbírálásra vár", active: "Érvényes", rejected: "Elutasítva", revoked: "Visszavonva",
};

/** Hero colours per division (bureau managers get their own). */
const HERO_THEMES = {
  manager: {glow: "rgb(139 92 246 / 0.38)", glow2: "rgb(234 179 8 / 0.2)", ring: "from-violet-400 via-fuchsia-500 to-amber-400"},
  SEB: {glow: "rgb(239 68 68 / 0.34)", glow2: "rgb(234 179 8 / 0.16)", ring: "from-red-400 via-rose-500 to-amber-400"},
  MCB: {glow: "rgb(56 189 248 / 0.34)", glow2: "rgb(99 102 241 / 0.24)", ring: "from-sky-300 via-blue-500 to-indigo-500"},
  TSB: {glow: "rgb(16 185 129 / 0.3)", glow2: "rgb(234 179 8 / 0.22)", ring: "from-emerald-300 via-emerald-500 to-yellow-400"},
} as const;

const today = () => todayKey();

export function ProfilePage() {
  const {profile, supabase} = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [closedCases, setClosedCases] = React.useState(0);
  const [ribbons, setRibbons] = React.useState<AwardedRibbon[]>([]);
  const [records, setRecords] = React.useState<HrRecord[] | null>(null);
  const [details, setDetails] = React.useState<MemberDetails | null>(null);
  const [duty, setDuty] = React.useState<DutyTimeEntry[]>([]);
  const [vehicles, setVehicles] = React.useState<RegistryVehicle[] | null>(null);
  const [vehicleWarnings, setVehicleWarnings] = React.useState<VehicleWarning[]>([]);
  const [bankAccount, setBankAccount] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState(searchParams.get("leave") ? "records" : searchParams.get("tab") ?? "overview");
  // A link (or a training step) to another tab of the open page switches to it.
  const tabParam = searchParams.get("tab");
  const [shownParam, setShownParam] = React.useState(tabParam);
  if (tabParam !== shownParam) {
    setShownParam(tabParam);
    if (tabParam) setTab(tabParam);
  }
  const [leaveOpen, setLeaveOpen] = React.useState(!!searchParams.get("leave"));
  const [recapOpen, setRecapOpen] = React.useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = React.useState(false);

  const profileId = profile?.id;

  // Keyed on the id, not the profile object: Realtime profile updates must not refetch.
  const loadData = React.useCallback(async () => {
    if (!profileId) return;
    const since = addMonths(monthStart(), -11);
    // Four requests: the registry RPC bundles details, duty time, vehicles, warnings and bank account.
    const [closed, ribbonResult, recordResult, registryResult] = await Promise.all([
      supabase.from("cases").select("id", {count: "exact", head: true}).eq("owner_id", profileId).eq("status", "closed"),
      supabase.from("user_ribbons").select("id, awarded_at, ribbons (id, name, description, color_hex, image_url)").eq("user_id", profileId),
      supabase.from("hr_records").select("*").eq("user_id", profileId).order("created_at", {ascending: false}),
      supabase.rpc("get_hr_registry", {_since: since, _user_id: profileId}),
    ]);
    const registry = (registryResult.data ?? null) as HrRegistry | null;
    const awarded = (ribbonResult.data ?? []) as unknown as {id: string; awarded_at: string; ribbons: Ribbon | null}[];
    setRibbons(awarded.flatMap((row) => (row.ribbons ? [{...row.ribbons, awarded_at: row.awarded_at, award_id: row.id}] : []))
      .sort((a, b) => a.awarded_at.localeCompare(b.awarded_at)));
    setClosedCases(closed.count || 0);
    setRecords((recordResult.data ?? []) as HrRecord[]);
    setDetails(registry?.details[0] ?? null);
    setDuty(registry?.duty ?? []);
    setVehicles(registry?.vehicles ?? []);
    setVehicleWarnings(registry?.vehicle_warnings ?? []);
    setBankAccount(registry?.bank_accounts[0]?.account_number ?? null);
  }, [profileId, supabase]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const changeTab = (value: string) => {
    setTab(value);
    const next = new URLSearchParams(searchParams);
    if (value === "overview") next.delete("tab"); else next.set("tab", value);
    setSearchParams(next, {replace: true});
  };

  const closeLeaveDialog = (open: boolean) => {
    setLeaveOpen(open);
    if (!open && searchParams.get("leave")) {
      const next = new URLSearchParams(searchParams);
      next.delete("leave");
      setSearchParams(next, {replace: true});
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profile) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("A kép max. 5MB lehet!");
    setIsUploadingAvatar(true);
    const toastId = toast.loading("Profilkép cseréje...");
    try {
      const previousAvatarUrl = profile.avatar_url;
      // 1. Upload the new picture (resized to 512px WebP in the browser first).
      const secureUrl = await uploadToCloudinary(file, "avatar");
      // 2. Point the profile at it.
      const {error} = await supabase.from("profiles").update({avatar_url: secureUrl}).eq("id", profile.id);
      if (error) {
        // Do not leave the fresh upload behind as an orphan.
        void deleteCloudinaryAssets([secureUrl]);
        throw error;
      }
      toast.success("Profilkép sikeresen cserélve!", {id: toastId});
      // 3. Only now remove the old picture: if anything above failed, it stays in use.
      void deleteCloudinaryAssets([previousAvatarUrl]);
    } catch (error) {
      console.error(error);
      toast.error("Hiba történt", {id: toastId, description: errorMessage(error)});
    } finally {
      setIsUploadingAvatar(false);
      event.target.value = "";
    }
  };

  const cancelLeave = async (record: HrRecord) => {
    const {error} = await supabase.from("hr_records").delete().eq("id", record.id);
    if (error) return toast.error("Hiba: " + errorMessage(error));
    setRecords((prev) => (prev ?? []).filter((item) => item.id !== record.id));
    toast.success("Szabadságkérelem visszavonva.");
  };

  if (!profile) return null;

  const theme = profile.is_bureau_manager ? HERO_THEMES.manager : HERO_THEMES[profile.division as keyof typeof HERO_THEMES] ?? HERO_THEMES.TSB;
  const activeWarnings = (records ?? []).filter((record) => record.kind === "warning" && record.status === "active");
  const currentLeave = (records ?? []).find((record) => record.kind === "leave" && record.status === "active"
    && record.starts_on && record.ends_on && record.starts_on <= today() && record.ends_on >= today());
  const joinedOn = details?.joined_on ?? null;
  const lastMonth = recentMonths(2)[0];
  const lastMonthDuty = duty.find((entry) => entry.month.slice(0, 10) === lastMonth)?.minutes ?? null;
  const activity = ACTIVITY_META[details?.activity_status ?? "active"];
  const activeVehicleWarnings = vehicleWarnings.filter((warning) => !warning.revoked_at && !warning.converted_record_id);

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6">
      <MonthlyRecapDialog month={addMonths(monthKey(), -1)} open={recapOpen} onOpenChange={setRecapOpen}/>
      <LeaveRequestDialog open={leaveOpen} onOpenChange={closeLeaveDialog} onCreated={(record) => {
        setRecords((prev) => [record, ...(prev ?? [])]);
        changeTab("records");
      }}/>

      {/* Hero */}
      <section className="panel glow-border animate-rise relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0"
             style={{background: `radial-gradient(circle at 12% 0%, ${theme.glow}, transparent 55%), radial-gradient(circle at 95% 110%, ${theme.glow2}, transparent 50%)`}}/>
        <div className="tex-grid pointer-events-none absolute inset-0 opacity-[0.035] [mask-image:linear-gradient(to_right,transparent,#000_40%,transparent)]"/>
        <SheriffStar variant="hologram" spin className="pointer-events-none absolute -top-24 -right-20 size-[420px] opacity-25"/>

        <div className="relative flex flex-col gap-6 p-6 md:flex-row md:items-center md:p-8">
          <label className={cn("group relative mx-auto block size-32 shrink-0 cursor-pointer md:mx-0", isUploadingAvatar && "pointer-events-none")}
                 title="Profilkép cseréje">
            <span className={cn("absolute -inset-1.5 rounded-full bg-gradient-to-br opacity-80 blur-md motion-safe:animate-[spin_8s_linear_infinite]", theme.ring)}/>
            <span className={cn("absolute -inset-1 rounded-full bg-gradient-to-br motion-safe:animate-[spin_8s_linear_infinite]", theme.ring)}/>
            <Avatar className="relative size-32 ring-4 ring-[#0a1120]">
              <AvatarImage src={getOptimizedAvatarUrl(profile.avatar_url, 256) || undefined} className="object-cover"/>
              <AvatarFallback className="bg-slate-900 text-4xl font-bold text-slate-300">{profile.full_name.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/55 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
              {isUploadingAvatar ? <Loader2 className="size-6 animate-spin"/> : <span className="flex flex-col items-center gap-1"><Camera className="size-5"/>Csere</span>}
            </span>
            <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={isUploadingAvatar}/>
          </label>

          <div className="min-w-0 flex-1 text-center md:text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary/80">Személyi akta</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white wrap-anywhere md:text-4xl">{profile.full_name}</h1>
            <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs md:justify-start">
              <span className={cn("rounded-full px-2.5 py-1 font-medium ring-1", rankPillClass(profile.faction_rank))}>{profile.faction_rank}</span>
              <span className="rounded-full bg-white/5 px-2.5 py-1 font-mono text-slate-200 ring-1 ring-white/10">#{profile.badge_number}</span>
              <span className={cn("rounded-full px-2.5 py-1 ring-1", DIVISION_META[profile.division]?.pill)}>
                {profile.division}{profile.division_rank ? ` · ${profile.division_rank}` : ""}
              </span>
              <DivisionTitleBadges ids={profile.division_titles} size="md"/>
              {currentLeave ? (
                <span className="rounded-full bg-sky-500/10 px-2.5 py-1 text-sky-300 ring-1 ring-sky-500/30">Szabadságon {formatDate(currentLeave.ends_on)}-ig</span>
              ) : (
                <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1", activity.pill)}>
                  <span className={cn("size-1.5 rounded-full", activity.dot)}/>{activity.label}
                </span>
              )}
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Csatlakozott: <span className="text-slate-200">{formatDate(joinedOn ?? profile.created_at)}</span>
              {details?.join_type && details.join_type !== "new" && <> ({JOIN_TYPE_LABELS[details.join_type].toLowerCase()})</>}
              {details?.recruited_by && <> · Felvételiztette: <span className="text-slate-200">{details.recruited_by}</span></>}
              {details?.station && <> · Kirendeltség: <span className="text-slate-200">{details.station}</span></>}
              {details?.parking_spot && <> · Parkoló: <span className="font-mono text-slate-200">{details.parking_spot}</span></>}
            </p>
            <RibbonRack ribbons={ribbons} className="mt-3 justify-center md:justify-start"/>
          </div>

          <div className="flex shrink-0 flex-wrap justify-center gap-2 md:flex-col">
            <Button onClick={() => setLeaveOpen(true)}><CalendarPlus/> Szabadság igénylése</Button>
            <Button variant="outline" onClick={() => navigate("/notifications?view=settings")}><BellRing/> Értesítések</Button>
            <Button variant="outline" onClick={() => navigate(`/hr/record/${profile.id}`)}><Printer/> Szolgálati lapom</Button>
            {/* Last month's recap, for those who were members then (like the dashboard's offer). */}
            {(joinedOn ?? profile.created_at).slice(0, 10) < monthKey() && (
              <Button variant="ghost" onClick={() => setRecapOpen(true)}><Sparkles/> Havi összefoglaló</Button>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <StatCard index={0} icon={CalendarClock} tone="gold" label="Szolgálati idő" value={formatSpan(daysSince(joinedOn ?? profile.created_at))}/>
        <StatCard index={1} icon={TrendingUp} tone="violet" label="Rangon töltött idő" value={formatSpan(daysSince(profile.last_promotion_date ?? profile.created_at))}/>
        <StatCard index={2} icon={Clock} tone="cyan" label="Duty (előző hónap)" value={lastMonthDuty === null ? "–" : formatDuty(lastMonthDuty)}/>
        <StatCard index={3} icon={Medal} tone="orange" label="Kitüntetés" value={ribbons.length}/>
        <StatCard index={4} icon={Briefcase} tone="blue" label="Lezárt akta" value={closedCases}/>
      </div>

      <Tabs value={tab} onValueChange={changeTab} className="gap-0">
        <TabsList className="mb-4 flex-wrap justify-start">
          <TabsTrigger value="overview"><ShieldCheck className="size-4"/> Áttekintés</TabsTrigger>
          <TabsTrigger value="awards"><Medal className="size-4"/> Kitüntetések</TabsTrigger>
          <TabsTrigger value="history"><History className="size-4"/> Előzmények</TabsTrigger>
          <TabsTrigger value="records">
            <NotebookPen className="size-4"/> Feljegyzéseim
            {activeWarnings.length > 0 && <span className="rounded-full bg-red-500/20 px-1.5 text-[11px] text-red-300">{activeWarnings.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="reviews"><ClipboardCheck className="size-4"/> Értékeléseim</TabsTrigger>
          <TabsTrigger value="trainings"><FlaskConical className="size-4"/> Képzések</TabsTrigger>
          <TabsTrigger value="certificates"><Award className="size-4"/> Okleveleim</TabsTrigger>
          <TabsTrigger value="settings"><UserCog className="size-4"/> Fiók</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
            <div className="space-y-6">
              <section className="panel animate-rise p-5">
                <SectionTitle icon={Clock} title="Szolgálati idő" hint="Havonta, a vezetőség rögzíti a gyűlésen."/>
                <DutyChart entries={duty} months={6}/>
              </section>

              <section className="panel animate-rise overflow-hidden" style={{"--i": 1} as React.CSSProperties}>
                <div className="px-5 pt-5"><SectionTitle icon={Car} title="Járműveim" hint="A forgalmi lejárta előtt értesítést kapsz; a megújítást a forgalmi képével rögzítheted."/></div>
                <MyVehicles vehicles={vehicles} onRenewed={(vehicle) => setVehicles((prev) => (prev ?? []).map((item) => item.id === vehicle.id
                  ? {...item, registration_expires_on: vehicle.registration_expires_on} : item))} onReviewChange={() => void loadData()}/>
                {vehicleWarnings.length > 0 && (
                  <div className="border-t px-5 py-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-xs font-medium text-slate-300">Jármű-hibapontok</p>
                      <StrikeDots count={activeVehicleWarnings.length}/>
                    </div>
                    <ul className="space-y-1.5">
                      {vehicleWarnings.slice(0, 6).map((warning) => (
                        <li key={warning.id} className={cn("flex items-start gap-2 text-xs", (warning.revoked_at || warning.converted_record_id) && "opacity-50")}>
                          <span className="font-mono text-slate-300">{warning.plate}</span>
                          <span className="min-w-0 flex-1 text-slate-400 wrap-anywhere">{warning.reason}</span>
                          <span className="shrink-0 text-slate-500">
                            {warning.revoked_at ? "visszavonva" : warning.converted_record_id ? "figyelmeztetés lett" : formatDate(warning.created_at)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            </div>

            <div className="space-y-6">
              <div className="animate-rise" style={{"--i": 1} as React.CSSProperties} data-tour="profile-card">
                <IdCard profile={profile} joinedOn={joinedOn} onLeave={!!currentLeave}/>
              </div>
              <section className="panel animate-rise p-5" style={{"--i": 2} as React.CSSProperties}>
                <SectionTitle icon={AlertTriangle} title="Fegyelmi" hint="Három aktív figyelmeztetés után a vezetőség dönt."/>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/5">
                  <span className="text-sm text-slate-300">Figyelmeztetések</span>
                  <StrikeDots count={activeWarnings.length}/>
                </div>
                {activeWarnings.length === 0 ? (
                  <p className="mt-3 flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 className="size-4"/> Tiszta lap.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {activeWarnings.map((record) => (
                      <li key={record.id} className="rounded-lg bg-red-500/[0.06] px-3 py-2 text-sm ring-1 ring-red-500/15">
                        <p className="font-medium text-red-200 wrap-anywhere">{record.title}</p>
                        <p className="text-xs text-slate-500">{formatDate(record.created_at)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="reviews" className="mt-0">
          {tab === "reviews" && <ReviewList/>}
        </TabsContent>

        <TabsContent value="trainings" className="mt-0">
          <TrainingCenter/>
        </TabsContent>

        <TabsContent value="certificates" className="mt-0">
          {tab === "certificates" && <CertificatesTab/>}
        </TabsContent>

        <TabsContent value="awards" className="mt-0">
          <div className="panel p-5">
            {ribbons.length === 0 ? (
              <EmptyState icon={Medal} title="Még nincs kitüntetésed." description="A kitüntetéseket a vezetőség adja át." compact/>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {ribbons.map((ribbon, index) => (
                  <div key={`${ribbon.id}-${index}`} style={{"--i": index} as React.CSSProperties}
                       className="lift animate-rise flex items-center gap-4 rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/5">
                    {ribbon.image_url
                      ? <img src={ribbon.image_url} alt={ribbon.name} className="h-10 w-16 shrink-0 object-contain"/>
                      : <RibbonRack ribbons={[ribbon]} className="shrink-0 scale-150"/>}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{ribbon.name}</p>
                      {ribbon.description && <p className="line-clamp-2 text-xs text-slate-400">{ribbon.description}</p>}
                      <p className="mt-1 text-[11px] text-slate-500">{formatDate(ribbon.awarded_at)}</p>
                    </div>
                    <Button size="icon-sm" variant="ghost" asChild className="shrink-0 text-slate-400 hover:text-white">
                      <Link to={awardHref("ribbon", ribbon.award_id)} aria-label={`${ribbon.name}: okirat nyomtatása`} title="Okirat nyomtatása"><Printer/></Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <div className="panel p-5">
            {tab === "history" && <MemberHistoryTimeline member={profile}/>}
          </div>
        </TabsContent>

        <TabsContent value="records" className="mt-0">
          <div className="panel overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
              <p className="text-sm text-muted-foreground">Figyelmeztetéseid, dicséreteid és szabadságkérelmeid.</p>
              <Button size="sm" variant="outline" onClick={() => setLeaveOpen(true)}><CalendarPlus/> Szabadság</Button>
            </div>
            {records === null ? (
              <div className="space-y-3 p-5">{[0, 1].map((i) => <div key={i} className="skeleton h-16"/>)}</div>
            ) : records.length === 0 ? (
              <EmptyState icon={NotebookPen} title="Nincs feljegyzésed." compact/>
            ) : (
              <ul className="divide-y divide-white/5">
                {records.map((record) => {
                  const meta = RECORD_META[record.kind];
                  const Icon = meta.icon;
                  const inactive = record.status === "revoked" || record.status === "rejected";
                  return (
                    <li key={record.id} className={cn("flex items-start gap-3 px-5 py-4", inactive && "opacity-60")}>
                      <div className={cn("grid size-9 shrink-0 place-items-center rounded-xl ring-1", meta.tone)}><Icon className="size-4"/></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="min-w-0 text-sm font-medium text-white wrap-anywhere">{record.title}</p>
                          <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[11px] text-slate-400">{RECORD_STATUS[record.status]}</span>
                        </div>
                        {record.details && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-400 wrap-anywhere">{record.details}</p>}
                        <p className="mt-1 text-xs text-slate-500">
                          {meta.label}
                          {(record.starts_on || record.ends_on) && ` · ${formatDate(record.starts_on)} – ${formatDate(record.ends_on)}`}
                          {` · ${formatDate(record.created_at)}`}
                        </p>
                      </div>
                      {record.kind === "commendation" && record.status === "active" && (
                        <Button size="sm" variant="ghost" className="text-slate-400" asChild>
                          <Link to={awardHref("commendation", record.id)}><Printer/> Oklevél</Link>
                        </Button>
                      )}
                      {record.kind === "leave" && record.status === "pending" && (
                        <Button size="sm" variant="ghost" className="text-slate-400" onClick={() => void cancelLeave(record)}>
                          <X/> Visszavonás
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-0">
          <AccountSettings key={`${profile.full_name}|${bankAccount}`} profile={profile} bankAccount={bankAccount} onBankAccountChange={setBankAccount}
                           uploading={isUploadingAvatar} onAvatarUpload={handleAvatarUpload}/>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SectionTitle({icon: Icon, title, hint}: {icon: typeof Clock; title: string; hint?: string}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 ring-1 ring-primary/20"><Icon className="size-4 text-primary"/></div>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}

function MyVehicles({vehicles, onRenewed, onReviewChange}: {
  vehicles: RegistryVehicle[] | null;
  onRenewed: (vehicle: FleetVehicle) => void;
  onReviewChange: () => void;
}) {
  const [renewing, setRenewing] = React.useState<FleetVehicle | null>(null);
  const [opening, setOpening] = React.useState<string | null>(null);
  if (vehicles === null) return <div className="space-y-2 p-5">{[0, 1].map((i) => <div key={i} className="skeleton h-14"/>)}</div>;
  if (vehicles.length === 0) {
    return <EmptyState icon={Car} title="Nincs hozzád rendelt jármű." description="A kiosztott járműveid és a jóváhagyott igényléseid ide kerülnek." compact/>;
  }

  // The full vehicle (keys, rules) is loaded only when a renewal is started.
  const open = async (vehicle: RegistryVehicle) => {
    setOpening(vehicle.id);
    try {
      const full = await fetchFleetVehicle(vehicle.id);
      if (full) setRenewing(full);
    } catch (error) {
      toast.error(errorMessage(error, "A jármű betöltése nem sikerült."));
    } finally {
      setOpening(null);
    }
  };

  return (
    <>
      <ul className="divide-y divide-white/5">
        {vehicles.map((vehicle) => (
          <li key={vehicle.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <Link to={`/logistics/fleet/${vehicle.id}`} className="transition-opacity hover:opacity-85"><LicensePlate plate={vehicle.plate}/></Link>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{vehicle.model}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {vehicle.registration_required
                  ? <RegistrationBadge expiresOn={vehicle.registration_expires_on}/>
                  : <span className="text-[11px] text-teal-200">Nem kell forgalmi</span>}
                {vehicle.pending_review && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200 ring-1 ring-amber-500/30">
                    <Hourglass className="size-3"/> Ellenőrzésre vár
                  </span>
                )}
              </div>
            </div>
            {vehicle.registration_required && (
              <Button size="sm" variant="outline" disabled={opening === vehicle.id} onClick={() => void open(vehicle)}>
                {opening === vehicle.id ? <Loader2 className="animate-spin"/> : <RefreshCw/>} Forgalmi frissítése
              </Button>
            )}
          </li>
        ))}
      </ul>
      {renewing && (
        <RegistrationDialog open vehicle={renewing} onChanged={onRenewed} onOpenChange={(next) => {
          if (!next) {
            setRenewing(null);
            onReviewChange();
          }
        }}/>
      )}
    </>
  );
}

function AccountSettings({profile, bankAccount, onBankAccountChange, uploading, onAvatarUpload}: {
  profile: Profile;
  bankAccount: string | null;
  onBankAccountChange: (value: string | null) => void;
  uploading: boolean;
  onAvatarUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const {supabase} = useAuth();
  const [newName, setNewName] = React.useState(profile.full_name);
  const [account, setAccount] = React.useState(bankAccount ?? "");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [busy, setBusy] = React.useState<"name" | "bank" | "password" | null>(null);


  const saveName = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) return toast.error("A név nem lehet üres.");
    setBusy("name");
    const {error} = await supabase.rpc("change_user_name", {_new_name: newName.trim()});
    setBusy(null);
    if (error) toast.error("Hiba: " + errorMessage(error)); else toast.success("Név frissítve!");
  };

  const saveBank = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = account.trim();
    if (value && !isValidAccountNumber(value)) return toast.error("A számlaszám formátuma: 12345678-12345678-12345678.");
    setBusy("bank");
    const {error} = value
      ? await supabase.from("member_bank_accounts").upsert({user_id: profile.id, account_number: value})
      : await supabase.from("member_bank_accounts").delete().eq("user_id", profile.id);
    setBusy(null);
    if (error) return toast.error("Hiba: " + errorMessage(error));
    onBankAccountChange(value || null);
    toast.success(value ? "Számlaszám mentve." : "Számlaszám törölve.");
  };

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) return toast.error("A jelszavak nem egyeznek!");
    if (newPassword.length < 6) return toast.error("A jelszónak legalább 6 karakterből kell állnia!");
    setBusy("password");
    const {error} = await supabase.auth.updateUser({password: newPassword});
    setBusy(null);
    if (error) return toast.error("Hiba: " + error.message);
    toast.success("Jelszó módosítva!");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="panel space-y-3 p-5">
        <Label className="text-xs text-muted-foreground">Profilkép</Label>
        <div className="flex items-center gap-4">
          <Avatar className="size-16 ring-2 ring-white/10">
            <AvatarImage src={getOptimizedAvatarUrl(profile.avatar_url, 150) || ""} className="object-cover"/>
            <AvatarFallback className="bg-slate-900 font-bold text-slate-400">{profile.full_name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <label className="inline-block cursor-pointer">
              <span className={cn("inline-flex h-9 items-center gap-2 rounded-md border px-4 text-sm font-medium text-slate-200 transition-colors hover:bg-white/5",
                uploading && "pointer-events-none opacity-50")}>
                {uploading ? <Loader2 className="size-4 animate-spin"/> : <UploadCloud className="size-4 text-sky-400"/>}
                {uploading ? "Feltöltés…" : "Új kép feltöltése"}
              </span>
              <input type="file" className="hidden" accept="image/*" onChange={onAvatarUpload} disabled={uploading}/>
            </label>
            <p className="mt-2 text-xs text-slate-500">JPG, PNG vagy WEBP, max. 5 MB. A rendszer automatikusan optimalizálja.</p>
          </div>
        </div>
      </section>

      <form onSubmit={saveName} className="panel space-y-3 p-5">
        <Label className="text-xs text-muted-foreground">Megjelenített név (IC)</Label>
        <div className="flex gap-3">
          <Input value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={64}/>
          <Button type="submit" disabled={busy === "name" || newName.trim() === profile.full_name}>
            {busy === "name" ? <Loader2 className="animate-spin"/> : <Save/>} Mentés
          </Button>
        </div>
        <p className="text-xs text-slate-500">A névváltozás bekerül az előzményeid közé.</p>
      </form>

      <form onSubmit={saveBank} className="panel space-y-3 p-5">
        <Label className="flex items-center gap-2 text-xs text-muted-foreground"><Landmark className="size-3.5"/> Bankszámlaszám (fizetéshez)</Label>
        <div className="flex gap-3">
          <Input value={account} inputMode="numeric" placeholder="12345678-12345678-12345678" className="font-mono"
                 onChange={(event) => setAccount(formatAccountNumber(event.target.value))}/>
          <Button type="submit" disabled={busy === "bank" || account === (bankAccount ?? "")}>
            {busy === "bank" ? <Loader2 className="animate-spin"/> : <Save/>} Mentés
          </Button>
        </div>
        <p className="text-xs text-slate-500">Csak te és a vezetőség látja.</p>
      </form>

      <form onSubmit={savePassword} className="panel space-y-3 p-5">
        <Label className="text-xs text-muted-foreground">Jelszó módosítása</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input type="password" placeholder="Új jelszó" value={newPassword} autoComplete="new-password"
                 onChange={(event) => setNewPassword(event.target.value)}/>
          <Input type="password" placeholder="Új jelszó még egyszer" value={confirmPassword} autoComplete="new-password"
                 onChange={(event) => setConfirmPassword(event.target.value)}/>
        </div>
        <Button type="submit" disabled={busy === "password" || !newPassword}>
          {busy === "password" ? <Loader2 className="animate-spin"/> : <Key/>} Jelszó frissítése
        </Button>
      </form>

      <SignatureCard profile={profile}/>
      <TwoFactorCard profile={profile}/>
      <DisplayCard/>
      <SessionsCard/>
    </div>
  );
}

function LeaveRequestDialog({open, onOpenChange, onCreated}: {
  open: boolean; onOpenChange: (open: boolean) => void; onCreated: (record: HrRecord) => void;
}) {
  const {supabase, profile} = useAuth();
  const [startsOn, setStartsOn] = React.useState(today());
  const [endsOn, setEndsOn] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [details, setDetails] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const submit = async () => {
    if (!profile) return;
    if (!startsOn || !endsOn) return toast.error("Add meg a szabadság kezdetét és végét.");
    if (endsOn < startsOn) return toast.error("A vége nem lehet a kezdete előtt.");
    setSaving(true);
    const {data, error} = await supabase.from("hr_records").insert({
      user_id: profile.id, created_by: profile.id, kind: "leave", status: "pending",
      title: title.trim() || "Szabadság", details: details.trim() || null, starts_on: startsOn, ends_on: endsOn,
    }).select("*").single();
    setSaving(false);
    if (error) return toast.error("Hiba: " + errorMessage(error));
    toast.success("Kérelem elküldve. A vezetőség értesítést kapott.");
    onCreated(data as HrRecord);
    setEndsOn("");
    setTitle("");
    setDetails("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Szabadság igénylése</DialogTitle>
          <DialogDescription>A kérelmet a vezetőség bírálja el; a döntésről értesítést kapsz.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kezdete</Label>
              <Input type="date" value={startsOn} min={today()} onChange={(event) => setStartsOn(event.target.value)}/>
            </div>
            <div className="space-y-1.5">
              <Label>Vége</Label>
              <Input type="date" value={endsOn} min={startsOn || today()} onChange={(event) => setEndsOn(event.target.value)}/>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Megnevezés</Label>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Pl. Nyaralás, vizsgaidőszak"/>
          </div>
          <div className="space-y-1.5">
            <Label>Megjegyzés (opcionális)</Label>
            <Textarea value={details} onChange={(event) => setDetails(event.target.value)} rows={3} maxLength={2000}/>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? <Loader2 className="animate-spin"/> : <CalendarPlus/>} Kérelem küldése
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
