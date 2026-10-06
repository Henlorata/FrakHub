import {useCallback, useEffect, useMemo, useState, type CSSProperties} from "react";
import {Link, useNavigate} from "react-router";
import {toast} from "sonner";
import {formatDistanceToNowStrict} from "date-fns";
import {hu} from "date-fns/locale";
import {
  Activity, AlertOctagon, AlertTriangle, ArrowRight, Banknote, CalendarDays, CalendarOff, CalendarPlus, Car, Check, CheckCircle2,
  ChevronDown, ChevronRight, ClipboardCheck, Clock, EyeOff, FileSearch, FileText, Fingerprint, Gavel, GraduationCap, Handshake,
  HelpCircle, Info, MapPin, Megaphone, Pin, Plus, Radio, Receipt, RefreshCw, ScrollText, Shield, Target, Ticket, Trash2, Truck,
  UserPlus, Users, X,
} from "lucide-react";
import {useAuth} from "@/context/AuthContext";
import {useSystemStatus} from "@/context/SystemStatusContext";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Switch} from "@/components/ui/switch";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {useConfirm} from "@/components/ConfirmDialog";
import {SheriffStar} from "@/components/brand/SheriffStar";
import {EmptyState} from "@/components/layout/EmptyState";
import {TONE_CLASSES, type Tone} from "@/components/layout/PageHeader";
import {ALERT_LEVELS} from "@/lib/alert-levels";
import {EVENT_KINDS, organisableAudiences, type UpcomingEvent} from "@/lib/events";
import {canViewCaseList, cn, errorMessage, isStaff, STAFF_CATEGORY_LABELS, type StaffCategory} from "@/lib/utils";
import {daysSince, formatSpan, rankPillClass} from "@/pages/hr/hr-utils";
import {
  daysBetween, formatDate, formatDayLabel, formatLongDate, formatTime, hungarianHour, hungarianParts, todayKey,
} from "@/lib/datetime";
import {WhatsNewStrip} from "./WhatsNewStrip";

interface DashboardSummary {
  unread_notifications: number;
  pending_exam_sheets: number;
  pending_registrations: number | null;
  pending_leave_requests: number | null;
  pending_vehicle_requests: number | null;
  pending_budget_requests: number | null;
  pending_warrants: number | null;
  my_open_cases: number | null;
  my_pending_requests: number;
  my_active_warnings: number;
  my_vehicle_warnings?: number;
  my_vehicles_due?: number;
  fleet_registration_due?: number | null;
  fleet_registration_reviews?: number | null;
  members_total: number;
  members_on_leave: number;
  my_month?: MonthProgress;
  upcoming_events?: UpcomingEvent[];
}

/** The member's month against the requirements (duty time is recorded by staff at the meetings). */
interface MonthProgress {
  month: string;
  reports: number;
  duty_minutes: number | null;
  duty_updated_at: string | null;
  min_reports: number | null;
  min_duty_hours: number | null;
}

interface FeedAnnouncement {
  id: string;
  title: string;
  content: string;
  type: "info" | "alert" | "training";
  is_pinned: boolean;
  show_author: boolean;
  created_at: string;
  created_by: string | null;
  author_name: string | null;
  author_rank: string | null;
  author_category: StaffCategory;
  can_delete: boolean;
}

const ANNOUNCEMENT_TYPES = {
  info: {label: "Információ", icon: Info, tone: "text-sky-300 bg-sky-500/10 ring-sky-500/30", bar: "from-sky-400 to-indigo-500"},
  alert: {label: "Riasztás", icon: AlertTriangle, tone: "text-red-300 bg-red-500/10 ring-red-500/30", bar: "from-red-400 to-rose-600"},
  training: {label: "Képzés", icon: GraduationCap, tone: "text-emerald-300 bg-emerald-500/10 ring-emerald-500/30", bar: "from-emerald-300 to-teal-600"},
} as const;

const ago = (iso: string) => formatDistanceToNowStrict(new Date(iso), {addSuffix: true, locale: hu});

export function DashboardPage() {
  const {profile, supabase} = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryLoaded, setSummaryLoaded] = useState(false);
  const [announcements, setAnnouncements] = useState<FeedAnnouncement[] | null>(null);
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false);

  const loadAnnouncements = useCallback(async () => {
    const {data, error} = await supabase.rpc("get_announcements", {_limit: 12});
    if (!error) setAnnouncements((data ?? []) as FeedAnnouncement[]);
  }, [supabase]);

  // Two requests: every counter, the member's month and the next events come from one RPC, plus the announcements.
  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.rpc("get_dashboard_summary"),
      supabase.rpc("get_announcements", {_limit: 12}),
    ]).then(([summaryResult, announcementResult]) => {
      if (!active) return;
      if (!summaryResult.error) setSummary(summaryResult.data as DashboardSummary);
      setSummaryLoaded(true);
      setAnnouncements((announcementResult.data ?? []) as FeedAnnouncement[]);
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  if (!profile) return null;
  const canPost = isStaff(profile);

  const deleteAnnouncement = async (item: FeedAnnouncement) => {
    if (!(await confirm({title: "Hirdetmény törlése", description: `Törlöd: „${item.title}”? A művelet nem vonható vissza.`,
      confirmLabel: "Törlés", destructive: true, kind: "delete"}))) return;
    const {error} = await supabase.from("announcements").delete().eq("id", item.id);
    if (error) toast.error("A hirdetmény törlése nem sikerült.");
    else {
      setAnnouncements((prev) => (prev ?? []).filter((entry) => entry.id !== item.id));
      toast.success("Hirdetmény törölve.");
    }
  };

  // Only what needs attention right now; zero counters stay hidden.
  const tasks: {label: string; value: number | null | undefined; icon: typeof Info; tone: Tone; to: string}[] = [
    {label: "Javítandó vizsgalap", value: summary?.pending_exam_sheets, icon: ClipboardCheck, tone: "violet", to: "/exams?tab=grading"},
    {label: "Jóváhagyásra váró parancs", value: summary?.pending_warrants, icon: Gavel, tone: "red", to: "/mcb"},
    {label: "Új regisztráció", value: summary?.pending_registrations, icon: UserPlus, tone: "emerald", to: "/hr?tab=requests"},
    {label: "Szabadságkérelem", value: summary?.pending_leave_requests, icon: CalendarOff, tone: "blue", to: "/hr?tab=requests"},
    {label: "Járműigénylés", value: summary?.pending_vehicle_requests, icon: Truck, tone: "orange", to: "/logistics"},
    {label: "Költségtérítés", value: summary?.pending_budget_requests, icon: Receipt, tone: "emerald", to: "/finance"},
    {label: "Forgalmi ellenőrzésre vár", value: summary?.fleet_registration_reviews, icon: FileSearch, tone: "orange", to: "/logistics?tab=fleet&view=reviews"},
    {label: "Lejáró forgalmi a flottában", value: summary?.fleet_registration_due, icon: Car, tone: "orange", to: "/logistics?tab=fleet"},
    {label: "Nyitott aktám", value: summary?.my_open_cases, icon: Fingerprint, tone: "blue", to: "/mcb"},
    {label: "Járművem forgalmija", value: summary?.my_vehicles_due, icon: Car, tone: "gold", to: "/logistics?tab=fleet"},
  ];
  const openTasks = tasks.filter((task) => (task.value ?? 0) > 0);

  return (
    // Few blocks: kept to a readable width on large screens instead of being stretched apart.
    <div className="mx-auto w-full max-w-[1440px] space-y-6">
      <NewAnnouncementDialog open={isAnnouncementOpen} onOpenChange={setIsAnnouncementOpen} onCreated={loadAnnouncements}/>

      <Hero summary={summary} openTasks={openTasks.length}/>

      <WhatsNewStrip/>

      {openTasks.length > 0 && (
        <section aria-label="Teendők" data-tour="dashboard-tasks" className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,230px),1fr))] gap-3">
          {openTasks.map((task, index) => {
            const tone = TONE_CLASSES[task.tone];
            return (
              <button key={task.label} type="button" onClick={() => navigate(task.to)} style={{"--i": index} as CSSProperties}
                      className="panel lift animate-rise group flex min-w-0 items-center gap-3 px-4 py-3 text-left">
                <div className={cn("grid size-10 shrink-0 place-items-center rounded-xl ring-1", tone.tile)}><task.icon className="size-5"/></div>
                <div className="min-w-0 flex-1">
                  <div className="text-xl font-semibold leading-tight text-white tabular-nums">{task.value}</div>
                  <div className="truncate text-xs text-muted-foreground">{task.label}</div>
                </div>
                <ArrowRight className="size-4 text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-200"/>
              </button>
            );
          })}
        </section>
      )}

      {/* The wide column holds what is always full (shortcuts, the activity of the day); announcements are rare, so they
          share the side column with the member's month and the next events instead of leaving a gap in the middle. */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <ModuleGrid/>
          <ActivityLog/>
        </div>
        <div className="order-first flex min-w-0 flex-col gap-6 xl:order-none">
          <Announcements items={announcements} canPost={canPost} onNew={() => setIsAnnouncementOpen(true)}
                         onDelete={(item) => void deleteAnnouncement(item)}/>
          <MyMonth month={summary?.my_month} loading={!summaryLoaded}/>
          <UpcomingEvents events={summary?.upcoming_events} loading={!summaryLoaded} canOrganise={organisableAudiences(profile).length > 0}/>
        </div>
      </div>
    </div>
  );
}

/** Greeting with the department star, live clock, alert level and personal facts. */
function Hero({summary, openTasks}: {summary: DashboardSummary | null; openTasks: number}) {
  const {profile} = useAuth();
  const {alertLevel} = useSystemStatus();
  const navigate = useNavigate();
  const now = useClock();
  const greeting = useMemo(() => {
    const hour = hungarianHour(now);
    return hour < 6 ? "Jó éjszakát" : hour < 10 ? "Jó reggelt" : hour < 18 ? "Szép napot" : "Jó estét";
  }, [now]);
  if (!profile) return null;
  const level = ALERT_LEVELS[alertLevel];

  return (
    <section data-tour="dashboard-hero" className="panel glow-border animate-rise relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgb(234_179_8/0.18),transparent_45%),radial-gradient(circle_at_10%_100%,rgb(56_189_248/0.12),transparent_50%)]"/>
      <div className="tex-grid pointer-events-none absolute inset-0 opacity-[0.03] [mask-image:linear-gradient(to_left,#000,transparent_70%)]"/>

      <div className="relative flex flex-col gap-8 p-6 md:p-8 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-yellow-500/85">
            <Shield className="size-5"/>
            <span className="text-xs font-bold uppercase tracking-[0.3em]">San Fierro Sheriff&apos;s Dept.</span>
          </p>
          <h1 className="mt-3 text-4xl leading-[0.95] font-black tracking-tighter text-white uppercase drop-shadow-lg md:text-5xl xl:text-6xl">
            {greeting},<br/>
            <span className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">{profile.full_name.split(" ")[0]}.</span>
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className={cn("rounded-full px-2.5 py-1 font-medium ring-1", rankPillClass(profile.faction_rank))}>{profile.faction_rank}</span>
            <span className="rounded-full bg-white/5 px-2.5 py-1 font-mono text-slate-200 ring-1 ring-white/10">#{profile.badge_number}</span>
            <span className="rounded-full bg-white/5 px-2.5 py-1 text-slate-300 ring-1 ring-white/10">{profile.division}</span>
            <span className="rounded-full bg-white/5 px-2.5 py-1 text-slate-400 ring-1 ring-white/10">
              {formatSpan(daysSince(profile.created_at))} szolgálatban
            </span>
          </div>

          <div className="mt-6 flex flex-wrap items-end gap-x-8 gap-y-4">
            <div>
              <div className="font-mono text-3xl font-semibold tabular-nums tracking-tight text-white">{formatTime(now)}
                <span className="text-lg text-slate-500">:{hungarianParts(now).second}</span>
              </div>
              <div className="text-xs capitalize text-slate-400">{formatLongDate(now)}</div>
            </div>
            <div className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ring-1", level.badge)}>
              <span className={cn("relative flex size-2.5", level.text)}>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60"/>
                <span className="relative inline-flex size-2.5 rounded-full bg-current"/>
              </span>
              Készültség: {level.label}
            </div>
            {summary && (
              <div className="text-xs text-slate-400">
                <span className="font-semibold text-white tabular-nums">{summary.members_total}</span> fő az állományban
                {summary.members_on_leave > 0 && <> · <span className="text-sky-300">{summary.members_on_leave} szabadságon</span></>}
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {!!summary?.my_active_warnings && (
              <button type="button" onClick={() => navigate("/profile")}
                      className="flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-200 ring-1 ring-red-500/30 transition-colors hover:bg-red-500/15">
                <AlertOctagon className="size-4 text-red-400"/> {summary.my_active_warnings} aktív figyelmeztetés
              </button>
            )}
            {!!summary?.my_vehicle_warnings && (
              <button type="button" onClick={() => navigate("/profile")}
                      className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-200 ring-1 ring-amber-500/30 transition-colors hover:bg-amber-500/15">
                <Car className="size-4 text-amber-400"/> {summary.my_vehicle_warnings}/3 jármű-hibapont
              </button>
            )}
            {summary && openTasks === 0 && !summary.my_active_warnings && (
              <span className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 ring-1 ring-emerald-500/25">
                <CheckCircle2 className="size-4 text-emerald-400"/> Nincs függő teendőd
              </span>
            )}
          </div>
        </div>

        <div className="relative mx-auto grid size-36 shrink-0 place-items-center sm:size-48 md:size-56 lg:mx-0">
          <div className="absolute inset-0 rounded-full border border-dashed border-yellow-500/30 motion-safe:animate-[spin_60s_linear_infinite]"/>
          <div className="absolute inset-4 rounded-full border-2 border-yellow-500/15 border-t-yellow-400/60 border-b-transparent motion-safe:animate-[spin_14s_linear_infinite_reverse]"/>
          <div className="absolute inset-10 rounded-full bg-yellow-500/15 blur-2xl motion-safe:animate-[backdrop-breathe_6s_ease-in-out_infinite]"/>
          <SheriffStar className="relative size-28 drop-shadow-[0_8px_30px_rgb(234_179_8/0.45)] motion-safe:animate-[float-y_7s_ease-in-out_infinite] sm:size-36 md:size-40"/>
        </div>
      </div>
    </section>
  );
}

/** Announcements: rare, so a compact list in the side column (pinned first, newest first). */
function Announcements({items, canPost, onNew, onDelete}: {
  items: FeedAnnouncement[] | null;
  canPost: boolean;
  onNew: () => void;
  onDelete: (item: FeedAnnouncement) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const shown = items && !showAll ? items.slice(0, 3) : items;
  return (
    <section data-tour="dashboard-announcements" className="panel animate-rise overflow-hidden p-0" style={{"--i": 2} as CSSProperties}>
      <header className="flex items-center gap-3 px-4 py-3.5">
        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 ring-1 ring-primary/25"><Megaphone className="size-4 text-primary"/></div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-white">Hirdetmények</h2>
          <p className="truncate text-xs text-slate-500">A vezetőség közleményei</p>
        </div>
        {canPost && (
          <Button size="sm" variant="outline" onClick={onNew} data-tour="announcement-new"><Plus/> Új hirdetmény</Button>
        )}
      </header>
      {items === null ? (
        <div className="space-y-2 px-4 pb-4">{[0, 1].map((index) => <div key={index} className="skeleton h-16"/>)}</div>
      ) : items.length === 0 ? (
        <p className="flex items-center gap-2 border-t border-white/5 px-4 py-3 text-xs text-slate-500">
          <CheckCircle2 className="size-3.5 text-slate-600"/> Nincs friss hirdetmény.
        </p>
      ) : (
        <>
          <ul className="space-y-2 border-t border-white/5 p-3">
            {(shown ?? []).map((item, index) => <AnnouncementCard key={item.id} item={item} index={index} onDelete={() => onDelete(item)}/>)}
          </ul>
          {items.length > 3 && (
            <button type="button" onClick={() => setShowAll((value) => !value)}
                    className="flex w-full items-center justify-center gap-1 border-t border-white/5 py-2 text-xs font-medium text-slate-400 transition-colors hover:bg-white/[0.03] hover:text-white">
              {showAll ? "Kevesebb" : `Mind a ${items.length} hirdetmény`} <ChevronDown className={cn("size-3.5 transition-transform", showAll && "rotate-180")}/>
            </button>
          )}
        </>
      )}
    </section>
  );
}

function AnnouncementCard({item, index, onDelete}: {item: FeedAnnouncement; index: number; onDelete: () => void}) {
  const type = ANNOUNCEMENT_TYPES[item.type] ?? ANNOUNCEMENT_TYPES.info;
  const [expanded, setExpanded] = useState(false);
  const long = item.content.length > 160 || item.content.split("\n").length > 3;

  return (
    <li style={{"--i": Math.min(index, 8)} as CSSProperties}
        className={cn("animate-rise group relative overflow-hidden rounded-xl bg-white/[0.025] p-3 pl-4 ring-1 ring-white/[0.06] transition-colors hover:bg-white/[0.04]",
          item.is_pinned && "bg-primary/[0.05] ring-primary/25")}>
      <span className={cn("absolute inset-y-0 left-0 w-1 bg-gradient-to-b", type.bar)}/>
      <div className="flex items-start gap-2.5">
        <div className={cn("grid size-7 shrink-0 place-items-center rounded-lg ring-1", type.tone)}><type.icon className="size-3.5"/></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            {item.is_pinned && <Pin className="mt-0.5 size-3.5 shrink-0 rotate-45 text-primary"/>}
            <h3 className="min-w-0 flex-1 text-sm leading-snug font-semibold text-white wrap-anywhere">{item.title}</h3>
            {item.can_delete && (
              <button type="button" title="Törlés" aria-label="Hirdetmény törlése" onClick={onDelete}
                      className="-mt-0.5 rounded-md p-1 text-slate-500 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-red-400">
                <Trash2 className="size-3.5"/>
              </button>
            )}
          </div>
          <p className={cn("mt-1 text-[13px] leading-relaxed whitespace-pre-wrap text-slate-300 wrap-anywhere", long && !expanded && "line-clamp-3")}>
            {item.content}
          </p>
          {long && (
            <button type="button" onClick={() => setExpanded((value) => !value)}
                    className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-primary/90 hover:text-primary">
              {expanded ? "Kevesebb" : "Tovább olvasom"} <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")}/>
            </button>
          )}
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
            <span>{ago(item.created_at)}</span>·
            {item.author_name ? (
              <>
                {item.author_name}
                {!item.show_author && <span className="inline-flex items-center gap-1 text-amber-300/80" title="Mások csak a beosztást látják"><EyeOff className="size-3"/> rejtett</span>}
              </>
            ) : (
              <>{STAFF_CATEGORY_LABELS[item.author_category]}</>
            )}
          </p>
        </div>
      </div>
    </li>
  );
}

const durationLabel = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} ó ${rest} p` : `${hours} óra`;
};

/** The member's month against the requirements: reports (live) and duty time (recorded at the meetings). */
function MyMonth({month, loading}: {month: MonthProgress | undefined; loading: boolean}) {
  if (!month) return loading ? <div className="skeleton h-44"/> : null;
  const [year, monthIndex] = month.month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  const daysLeft = daysBetween(todayKey(), `${month.month.slice(0, 8)}${String(lastDay).padStart(2, "0")}`);
  const monthName = new Intl.DateTimeFormat("hu-HU", {timeZone: "UTC", month: "long"}).format(new Date(Date.UTC(year, monthIndex - 1, 1)));
  const minReports = month.min_reports ?? 0;
  const minMinutes = (month.min_duty_hours ?? 0) * 60;
  const rows = [
    {
      label: "Jelentések", icon: FileText, done: month.reports, goal: minReports, to: "/reports?tab=mine",
      value: `${month.reports} / ${minReports}`, hint: month.reports >= minReports ? "Teljesítve" : `Még ${minReports - month.reports} kell`,
    },
    {
      label: "Duty idő", icon: Clock, done: month.duty_minutes ?? 0, goal: minMinutes, to: "/profile",
      value: `${durationLabel(month.duty_minutes ?? 0)} / ${month.min_duty_hours ?? 0} óra`,
      hint: (month.duty_minutes ?? 0) >= minMinutes ? "Teljesítve"
        : month.duty_updated_at ? `Utoljára rögzítve: ${formatDate(month.duty_updated_at)}` : "A gyűlésen rögzítik",
    },
  ];
  const complete = rows.every((row) => row.done >= row.goal);

  return (
    <section data-tour="dashboard-month" className="panel animate-rise p-4" style={{"--i": 3} as CSSProperties}>
      <header className="mb-3 flex items-center gap-3">
        <div className={cn("grid size-8 shrink-0 place-items-center rounded-lg ring-1",
          complete ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30" : "bg-sky-500/10 text-sky-300 ring-sky-500/25")}>
          {complete ? <Check className="size-4"/> : <Target className="size-4"/>}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-white">Havi követelmény</h2>
          <p className="text-xs text-slate-500">{monthName} · {daysLeft > 0 ? `még ${daysLeft} nap` : "a hónap utolsó napja"}</p>
        </div>
        {complete && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-200 ring-1 ring-emerald-500/30">Teljesítve</span>}
      </header>
      <ul className="space-y-2.5">
        {rows.map((row) => {
          const ratio = row.goal > 0 ? Math.min(1, row.done / row.goal) : 1;
          const met = row.done >= row.goal;
          return (
            <li key={row.label}>
              <Link to={row.to} className="-mx-1.5 block rounded-lg px-1.5 py-1 transition-colors hover:bg-white/[0.03]">
                <div className="flex items-center gap-2 text-xs">
                  <row.icon className="size-3.5 text-slate-500"/>
                  <span className="font-medium text-slate-200">{row.label}</span>
                  <span className="ml-auto font-mono text-slate-100 tabular-nums">{row.value}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div className={cn("h-full rounded-full bg-gradient-to-r transition-[width] duration-700",
                    met ? "from-emerald-400 to-teal-500" : ratio >= 0.5 ? "from-sky-400 to-indigo-500" : "from-amber-400 to-orange-500")}
                       style={{width: `${Math.max(3, ratio * 100)}%`}}/>
                </div>
                <p className={cn("mt-1 text-[11px]", met ? "text-emerald-300/80" : "text-slate-500")}>{row.hint}</p>
              </Link>
            </li>
          );
        })}
      </ul>
      {!complete && (
        <p className="mt-2.5 border-t border-white/5 pt-2.5 text-[11px] text-slate-500">
          A duty-minimum alatt nem jár alapfizetés és rangfelvétel.
        </p>
      )}
    </section>
  );
}

const STATUS_CHIP = {
  going: {label: "Ott leszel", icon: Check, tone: "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30"},
  maybe: {label: "Talán", icon: HelpCircle, tone: "bg-amber-500/15 text-amber-200 ring-amber-500/30"},
  absent: {label: "Nem mész", icon: X, tone: "bg-white/5 text-slate-400 ring-white/10"},
} as const;

const weekdayShort = new Intl.DateTimeFormat("hu-HU", {timeZone: "Europe/Budapest", weekday: "short"});

/** The next events (two weeks) the member sees, with their answer. */
function UpcomingEvents({events, loading, canOrganise}: {events: UpcomingEvent[] | undefined; loading: boolean; canOrganise: boolean}) {
  if (!events) return loading ? <div className="skeleton h-40"/> : null;
  return (
    <section data-tour="dashboard-events" className="panel animate-rise overflow-hidden p-0" style={{"--i": 4} as CSSProperties}>
      <header className="flex items-center gap-3 px-4 py-3.5">
        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/25"><CalendarDays className="size-4"/></div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-white">Közelgő események</h2>
          <p className="text-xs text-slate-500">A következő két hét</p>
        </div>
        <Link to="/events" className="inline-flex items-center gap-0.5 text-xs font-medium text-slate-400 hover:text-white">Naptár <ChevronRight className="size-3.5"/></Link>
      </header>
      {events.length === 0 ? (
        <div className="flex items-center gap-2 border-t border-white/5 px-4 py-3 text-xs text-slate-500">
          <CalendarDays className="size-3.5 text-slate-600"/> Nincs esemény a következő két hétben.
          {canOrganise && <Link to="/events" className="ml-auto inline-flex items-center gap-1 font-medium text-primary/90 hover:text-primary"><CalendarPlus className="size-3.5"/> Új</Link>}
        </div>
      ) : (
        <ul className="divide-y divide-white/5 border-t border-white/5">
          {events.map((event) => {
            const kind = EVENT_KINDS[event.kind] ?? EVENT_KINDS.other;
            const day = todayKey(event.starts_at);
            const relative = formatDayLabel(day);
            const chip = event.my_status ? STATUS_CHIP[event.my_status] : null;
            return (
              <li key={event.id}>
                <Link to={`/events?id=${event.id}`} className="flex min-w-0 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.03]">
                  <div className={cn("grid w-11 shrink-0 place-items-center rounded-lg py-1 ring-1", kind.tile)}>
                    <span className="text-base leading-none font-bold tabular-nums">{Number(day.slice(8))}</span>
                    <span className="text-[10px] leading-tight uppercase opacity-80">{weekdayShort.format(new Date(event.starts_at)).replace(".", "")}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-100">{event.title}</p>
                    <p className="flex min-w-0 items-center gap-2 text-[11px] text-slate-500">
                      <span className="shrink-0 font-mono text-slate-300">{relative.length <= 7 ? `${relative} ` : ""}{formatTime(event.starts_at)}</span>
                      {event.location && <span className="flex min-w-0 items-center gap-1 truncate"><MapPin className="size-3 shrink-0"/>{event.location}</span>}
                    </p>
                  </div>
                  {chip ? (
                    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ring-1", chip.tone)}><chip.icon className="size-3"/>{chip.label}</span>
                  ) : event.rsvp ? (
                    <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-200 ring-1 ring-amber-500/30">Válaszolj</span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ModuleGrid() {
  const {profile} = useAuth();
  const navigate = useNavigate();
  if (!profile) return null;
  const modules = [
    {label: "Nyomozó Iroda", hint: "Akták, körözések", icon: Fingerprint, to: "/mcb", tone: "blue" as Tone, show: canViewCaseList(profile)},
    {label: "Logisztika", hint: "Járművek, flotta", icon: Truck, to: "/logistics", tone: "orange" as Tone, show: true},
    {label: "Pénzügy", hint: "Költségtérítés, fizetés", icon: Banknote, to: "/finance", tone: "emerald" as Tone, show: true},
    {label: "Vizsgaközpont", hint: "Vizsgák, javítás", icon: ScrollText, to: "/exams", tone: "violet" as Tone, show: true},
    {label: "Akadémia", hint: "Tananyagok", icon: GraduationCap, to: "/academy", tone: "cyan" as Tone, show: true},
    {label: "Kalkulátor", hint: "Büntető törvénykönyv", icon: Gavel, to: "/calculator", tone: "red" as Tone, show: true},
    {label: "Jelentések", hint: "Fórum-jelentés, napló", icon: FileText, to: "/reports", tone: "slate" as Tone, show: true},
    {label: "Események", hint: "Gyűlések, képzések", icon: CalendarDays, to: "/events", tone: "gold" as Tone, show: true},
    {label: "Kódtár", hint: "Rádiókódok, hívójel", icon: Radio, to: "/codes", tone: "cyan" as Tone, show: true},
    {label: "Személyügy", hint: "Állomány, duty idő", icon: Users, to: "/hr", tone: "gold" as Tone, show: true},
  ].filter((module) => module.show);

  return (
    <section data-tour="dashboard-modules" className="animate-rise" style={{"--i": 3} as CSSProperties}>
      <h2 className="mb-3 px-1 text-sm font-semibold text-slate-300">Gyors elérés</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {modules.map((module, index) => {
          const tone = TONE_CLASSES[module.tone];
          return (
            <button key={module.to} type="button" onClick={() => navigate(module.to)} style={{"--i": index + 4} as CSSProperties}
                    className="panel lift animate-rise group relative flex min-w-0 flex-col items-start gap-3 overflow-hidden p-4 text-left">
              <div className={cn("pointer-events-none absolute -right-8 -bottom-8 size-24 rounded-full bg-gradient-to-br opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-40", tone.gradient)}/>
              <div className={cn("relative grid size-10 place-items-center rounded-xl bg-gradient-to-br p-px transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3", tone.gradient)}>
                <div className="grid size-full place-items-center rounded-[11px] bg-[#0a1120]/85">
                  <module.icon className={cn("size-5", tone.text)}/>
                </div>
              </div>
              <div className="relative w-full min-w-0">
                <div className="truncate text-sm font-semibold text-slate-100 group-hover:text-white">{module.label}</div>
                <div className="truncate text-xs text-slate-500">{module.hint}</div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

interface ActionLogRow {
  id: string;
  action_type: "ticket" | "arrest" | "other";
  details: string;
  created_at: string;
  profiles: {full_name: string; badge_number: string; avatar_url: string | null} | null;
}

const ACTION_LOOK = {
  ticket: {label: "Bírság", icon: Ticket, text: "text-orange-300", tile: "bg-orange-500/10 text-orange-300 ring-orange-500/30"},
  arrest: {label: "Letartóztatás", icon: Handshake, text: "text-red-300", tile: "bg-red-500/10 text-red-300 ring-red-500/30"},
  other: {label: "Napló", icon: Info, text: "text-sky-300", tile: "bg-sky-500/10 text-sky-300 ring-sky-500/30"},
} as const;

/** The calculator's copies: "Bírság: $500 000 - Indok: A, B" and "120 perc - Indokok: A, B". */
function parseAction(type: ActionLogRow["action_type"], details: string) {
  const ticket = type === "ticket" ? details.match(/^Bírság:\s*(.+?)\s+-\s+Indok:\s*([\s\S]*)$/) : null;
  const arrest = type === "arrest" ? details.match(/^(\d+)\s*perc\s+-\s+Indokok:\s*([\s\S]*)$/) : null;
  const match = ticket ?? arrest;
  if (!match) return {amount: null, reasons: details.trim() ? [details.trim()] : []};
  return {amount: arrest ? `${match[1]} perc` : match[1], reasons: match[2].split(/,\s*/).map((reason) => reason.trim()).filter(Boolean)};
}

const sameDay = (a: ReturnType<typeof hungarianParts>, b: ReturnType<typeof hungarianParts>) =>
  a.year === b.year && a.month === b.month && a.day === b.day;

const timeLabel = (iso: string) => {
  const day = hungarianParts(iso);
  return sameDay(day, hungarianParts(new Date())) ? formatTime(iso) : `${day.month}.${day.day}. ${formatTime(iso)}`;
};

/** Fines and arrests issued from the calculator (no polling: refreshed when the tab is shown again). */
function ActivityLog() {
  const {supabase} = useAuth();
  const [logs, setLogs] = useState<ActionLogRow[] | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);

  const load = useCallback(async () => {
    const {data} = await supabase.from("action_logs")
      .select("id, action_type, details, created_at, profiles!action_logs_user_id_fkey(full_name, badge_number, avatar_url)")
      .order("created_at", {ascending: false}).limit(15);
    setLogs((data ?? []) as unknown as ActionLogRow[]);
    setLoadedAt(Date.now());
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - loadedAt > 60_000) void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load, loadedAt]);

  const today = hungarianParts(new Date());
  const todays = (logs ?? []).filter((log) => sameDay(hungarianParts(log.created_at), today));
  const fresh = !!logs?.[0] && loadedAt - Date.parse(logs[0].created_at) < 15 * 60_000;

  return (
    <section data-tour="dashboard-log" className="panel animate-rise overflow-hidden p-0" style={{"--i": 5} as CSSProperties}>
      <header className="flex items-center gap-3 border-b px-5 py-4">
        <div className="grid size-9 place-items-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/25"><Activity className="size-4 text-emerald-400"/></div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-black tracking-[0.18em] text-slate-200 uppercase">Eseménynapló</h2>
          <p className="truncate text-xs text-slate-500">
            {todays.length === 0 ? "Ma még nem volt intézkedés"
              : `Ma: ${todays.filter((log) => log.action_type === "ticket").length} bírság · ${todays.filter((log) => log.action_type === "arrest").length} letartóztatás${todays.length === 15 ? " vagy több" : ""}`}
          </p>
        </div>
        <span className={cn("flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-widest",
          fresh ? "bg-emerald-500/10 text-emerald-300" : "bg-white/5 text-slate-500")} title="Friss intézkedés az elmúlt negyedórában">
          <span className={cn("size-1.5 rounded-full", fresh ? "animate-pulse bg-emerald-400" : "bg-slate-600")}/>ÉLŐ
        </span>
        <button type="button" onClick={() => void load()} aria-label="Eseménynapló frissítése"
                className="grid size-8 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-200">
          <RefreshCw className="size-3.5"/>
        </button>
      </header>
      {logs === null ? (
        <div className="space-y-3 p-4">{[0, 1, 2].map((index) => <div key={index} className="skeleton h-16"/>)}</div>
      ) : logs.length === 0 ? (
        <EmptyState icon={Activity} title="Csendes üzemmód" description="A kalkulátorból kiadott bírságok és letartóztatások itt jelennek meg." compact/>
      ) : (
        <ol className="max-h-[440px] divide-y divide-white/5 overflow-y-auto">
          {logs.map((log, index) => {
            const look = ACTION_LOOK[log.action_type] ?? ACTION_LOOK.other;
            const {amount, reasons} = parseAction(log.action_type, log.details);
            return (
              <li key={log.id} className="animate-fade flex gap-3 px-5 py-3.5 transition-colors hover:bg-white/[0.02]"
                  style={{"--i": Math.min(index, 8)} as CSSProperties}>
                <div className={cn("grid size-9 shrink-0 place-items-center rounded-xl ring-1", look.tile)}><look.icon className="size-4"/></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className={cn("text-sm font-black tracking-wide uppercase", look.text)}>{look.label}</span>
                    {amount && <span className="rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-xs font-semibold text-white tabular-nums">{amount}</span>}
                    <span className="ml-auto shrink-0 font-mono text-[11px] text-slate-500">{timeLabel(log.created_at)}</span>
                  </div>
                  <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs">
                    <span className="truncate font-semibold text-slate-200">{log.profiles?.full_name ?? "Ismeretlen"}</span>
                    {log.profiles?.badge_number && <span className="font-mono text-slate-500">#{log.profiles.badge_number}</span>}
                  </p>
                  {reasons.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {reasons.slice(0, 8).map((reason, reasonIndex) => (
                        <span key={reasonIndex} className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-slate-300 ring-1 ring-white/10 wrap-anywhere">
                          {reason}
                        </span>
                      ))}
                      {reasons.length > 8 && <span className="px-1 text-[10px] text-slate-500">+{reasons.length - 8}</span>}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/** Current time, refreshed every second (only while the dashboard is open). */
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function NewAnnouncementDialog({open, onOpenChange, onCreated}: {open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void}) {
  const {supabase, user} = useAuth();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<FeedAnnouncement["type"]>("info");
  const [isPinned, setIsPinned] = useState(false);
  const [showAuthor, setShowAuthor] = useState(true);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!title.trim() || !content.trim()) return toast.error("A cím és az üzenet kötelező.");
    setLoading(true);
    const {error} = await supabase.from("announcements").insert({
      title: title.trim(), content: content.trim(), type, created_by: user?.id, is_pinned: isPinned, show_author: showAuthor,
    });
    setLoading(false);
    if (error) return toast.error("Hiba: " + errorMessage(error));
    toast.success("Hirdetmény közzétéve. Mindenki értesítést kapott.");
    setTitle("");
    setContent("");
    setIsPinned(false);
    setShowAuthor(true);
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Új hirdetmény</DialogTitle>
          <DialogDescription>Az állomány minden tagja értesítést kap róla.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(ANNOUNCEMENT_TYPES) as FeedAnnouncement["type"][]).map((key) => {
              const meta = ANNOUNCEMENT_TYPES[key];
              return (
                <button key={key} type="button" onClick={() => setType(key)}
                        className={cn("flex flex-col items-center gap-1.5 rounded-xl px-3 py-3 text-xs font-medium ring-1 transition-colors",
                          type === key ? meta.tone : "text-slate-400 ring-white/10 hover:text-slate-200")}>
                  <meta.icon className="size-5"/>{meta.label}
                </button>
              );
            })}
          </div>
          <div className="space-y-1.5">
            <Label>Cím</Label>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Rövid, beszédes cím"/>
          </div>
          <div className="space-y-1.5">
            <Label>Üzenet</Label>
            <Textarea value={content} onChange={(event) => setContent(event.target.value)} rows={5} maxLength={4000}
                      className="max-h-[40vh]" placeholder="Írd ide az üzenetet…"/>
          </div>
          <label className="flex items-center justify-between gap-3 text-sm text-slate-200">
            <span>Kiemelés <span className="block text-xs text-slate-500">A lista tetején marad.</span></span>
            <Switch checked={isPinned} onCheckedChange={setIsPinned}/>
          </label>
          <label className="flex items-center justify-between gap-3 text-sm text-slate-200">
            <span>Név megjelenítése <span className="block text-xs text-slate-500">Kikapcsolva csak a beosztásod látszik.</span></span>
            <Switch checked={showAuthor} onCheckedChange={setShowAuthor}/>
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button onClick={() => void submit()} disabled={loading}><Megaphone/> Közzététel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
