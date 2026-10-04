import {useCallback, useEffect, useMemo, useState, type CSSProperties} from "react";
import {useNavigate} from "react-router";
import {toast} from "sonner";
import {format, formatDistanceToNowStrict} from "date-fns";
import {hu} from "date-fns/locale";
import {
  AlertOctagon, AlertTriangle, ArrowRight, Banknote, CalendarOff, Car, CheckCircle2, ChevronDown, ClipboardCheck,
  EyeOff, FileSearch, FileText, Fingerprint, Gavel, GraduationCap, Info, Megaphone, Pin, Plus, Receipt, ScrollText, Trash2,
  Truck, UserPlus, Users,
} from "lucide-react";
import {useAuth} from "@/context/AuthContext";
import {useSystemStatus} from "@/context/SystemStatusContext";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Switch} from "@/components/ui/switch";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {SheriffStar} from "@/components/brand/SheriffStar";
import {EmptyState} from "@/components/layout/EmptyState";
import {TONE_CLASSES, type Tone} from "@/components/layout/PageHeader";
import {ALERT_LEVELS} from "@/lib/alert-levels";
import {canViewCaseList, cn, errorMessage, isStaff, STAFF_CATEGORY_LABELS, type StaffCategory} from "@/lib/utils";
import {daysSince, formatSpan, rankPillClass} from "@/pages/hr/hr-utils";

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
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [announcements, setAnnouncements] = useState<FeedAnnouncement[] | null>(null);
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadAnnouncements = useCallback(async () => {
    const {data, error} = await supabase.rpc("get_announcements", {_limit: 12});
    if (!error) setAnnouncements((data ?? []) as FeedAnnouncement[]);
  }, [supabase]);

  // Two requests: every counter comes from one RPC, plus the announcement feed.
  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.rpc("get_dashboard_summary"),
      supabase.rpc("get_announcements", {_limit: 12}),
    ]).then(([summaryResult, announcementResult]) => {
      if (!active) return;
      if (!summaryResult.error) setSummary(summaryResult.data as DashboardSummary);
      setAnnouncements((announcementResult.data ?? []) as FeedAnnouncement[]);
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  if (!profile) return null;
  const canPost = isStaff(profile);

  const confirmDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    const {error} = await supabase.from("announcements").delete().eq("id", id);
    if (error) toast.error("A hirdetmény törlése nem sikerült.");
    else {
      setAnnouncements((prev) => (prev ?? []).filter((item) => item.id !== id));
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
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hirdetmény törlése</AlertDialogTitle>
            <AlertDialogDescription>Biztosan törlöd ezt a hirdetményt? A művelet nem vonható vissza.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mégse</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-500" onClick={() => void confirmDelete()}>Törlés</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Hero summary={summary} openTasks={openTasks.length}/>

      {openTasks.length > 0 && (
        <section aria-label="Teendők" className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,230px),1fr))] gap-3">
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="panel animate-rise self-start overflow-hidden" style={{"--i": 2} as CSSProperties}>
          <header className="flex items-center gap-3 border-b px-5 py-4">
            <div className="grid size-9 place-items-center rounded-xl bg-primary/10 ring-1 ring-primary/25"><Megaphone className="size-4 text-primary"/></div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white">Hirdetmények</h2>
              <p className="text-xs text-slate-500">A vezetőség közleményei</p>
            </div>
            {canPost && (
              <Button size="sm" className="ml-auto" onClick={() => setIsAnnouncementOpen(true)}><Plus/> Új hirdetmény</Button>
            )}
          </header>
          {announcements === null ? (
            <div className="space-y-3 p-5">
              {[0, 1, 2].map((i) => <div key={i} className="skeleton h-24"/>)}
            </div>
          ) : announcements.length === 0 ? (
            <EmptyState icon={Megaphone} title="Nincs friss hirdetmény." compact/>
          ) : (
            <ul className="space-y-3 p-4">
              {announcements.map((item, index) => (
                <AnnouncementCard key={item.id} item={item} index={index} onDelete={() => setDeleteId(item.id)}/>
              ))}
            </ul>
          )}
        </section>

        <ModuleGrid/>
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
    const hour = now.getHours();
    return hour < 6 ? "Jó éjszakát" : hour < 10 ? "Jó reggelt" : hour < 18 ? "Szép napot" : "Jó estét";
  }, [now]);
  if (!profile) return null;
  const level = ALERT_LEVELS[alertLevel];

  return (
    <section className="panel glow-border animate-rise relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgb(234_179_8/0.18),transparent_45%),radial-gradient(circle_at_10%_100%,rgb(56_189_248/0.12),transparent_50%)]"/>
      <div className="tex-grid pointer-events-none absolute inset-0 opacity-[0.03] [mask-image:linear-gradient(to_left,#000,transparent_70%)]"/>

      <div className="relative flex flex-col gap-8 p-6 md:p-8 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary/80">San Fierro Sheriff's Department</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-5xl">
            {greeting}, <span className="text-gold animate-shine">{profile.full_name.split(" ")[0]}</span>!
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
              <div className="font-mono text-3xl font-semibold tabular-nums tracking-tight text-white">{format(now, "HH:mm")}
                <span className="text-lg text-slate-500">:{format(now, "ss")}</span>
              </div>
              <div className="text-xs capitalize text-slate-400">{format(now, "yyyy. MMMM d., EEEE", {locale: hu})}</div>
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

function AnnouncementCard({item, index, onDelete}: {item: FeedAnnouncement; index: number; onDelete: () => void}) {
  const type = ANNOUNCEMENT_TYPES[item.type] ?? ANNOUNCEMENT_TYPES.info;
  const [expanded, setExpanded] = useState(false);
  const long = item.content.length > 360 || item.content.split("\n").length > 6;

  return (
    <li style={{"--i": Math.min(index, 8)} as CSSProperties}
        className={cn("animate-rise group relative overflow-hidden rounded-xl bg-white/[0.025] p-4 pl-5 ring-1 ring-white/[0.06] transition-colors hover:bg-white/[0.04]",
          item.is_pinned && "bg-primary/[0.05] ring-primary/25")}>
      <span className={cn("absolute inset-y-0 left-0 w-1 bg-gradient-to-b", type.bar)}/>
      <div className="flex items-start gap-3">
        <div className={cn("grid size-9 shrink-0 place-items-center rounded-xl ring-1", type.tone)}><type.icon className="size-4"/></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {item.is_pinned && <Pin className="size-3.5 rotate-45 text-primary"/>}
            <h3 className="min-w-0 text-sm font-semibold text-white wrap-anywhere">{item.title}</h3>
            <span className="text-xs text-slate-500">{ago(item.created_at)}</span>
          </div>
          <p className={cn("mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-300 wrap-anywhere", long && !expanded && "line-clamp-5")}>
            {item.content}
          </p>
          {long && (
            <button type="button" onClick={() => setExpanded((value) => !value)}
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary/90 hover:text-primary">
              {expanded ? "Kevesebb" : "Tovább olvasom"} <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")}/>
            </button>
          )}
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            {item.author_name ? (
              <>
                {item.author_name} · {item.author_rank}
                {!item.show_author && <span className="inline-flex items-center gap-1 text-amber-300/80" title="Mások csak a beosztást látják"><EyeOff className="size-3"/> rejtett</span>}
              </>
            ) : (
              <>{STAFF_CATEGORY_LABELS[item.author_category]}</>
            )}
          </p>
        </div>
        {item.can_delete && (
          <Button size="icon-sm" variant="ghost" title="Törlés" onClick={onDelete}
                  className="text-slate-500 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-red-400">
            <Trash2 className="size-4"/>
          </Button>
        )}
      </div>
    </li>
  );
}

function ModuleGrid() {
  const {profile} = useAuth();
  const navigate = useNavigate();
  if (!profile) return null;
  const modules = [
    {label: "Nyomozó Iroda", hint: "Akták, körözések", icon: Fingerprint, to: "/mcb", tone: "blue" as Tone, show: canViewCaseList(profile)},
    {label: "Logisztika", hint: "Járművek, flotta", icon: Truck, to: "/logistics", tone: "orange" as Tone, show: true},
    {label: "Pénzügy", hint: "Költségtérítés", icon: Banknote, to: "/finance", tone: "emerald" as Tone, show: true},
    {label: "Vizsgaközpont", hint: "Vizsgák, javítás", icon: ScrollText, to: "/exams", tone: "violet" as Tone, show: true},
    {label: "Akadémia", hint: "Tananyagok", icon: GraduationCap, to: "/academy", tone: "cyan" as Tone, show: true},
    {label: "Kalkulátor", hint: "Büntető törvénykönyv", icon: Gavel, to: "/calculator", tone: "red" as Tone, show: true},
    {label: "Jelentések", hint: "Jelentésgenerátor", icon: FileText, to: "/reports", tone: "slate" as Tone, show: true},
    {label: "Személyügy", hint: "Állomány, duty idő", icon: Users, to: "/hr", tone: "gold" as Tone, show: true},
  ].filter((module) => module.show);

  return (
    <section className="animate-rise" style={{"--i": 3} as CSSProperties}>
      <h2 className="mb-3 px-1 text-sm font-semibold text-slate-300">Gyors elérés</h2>
      <div className="grid grid-cols-2 gap-3">
        {modules.map((module, index) => {
          const tone = TONE_CLASSES[module.tone];
          return (
            <button key={module.to} type="button" onClick={() => navigate(module.to)} style={{"--i": index + 4} as CSSProperties}
                    className="panel lift animate-rise group relative flex flex-col items-start gap-3 overflow-hidden p-4 text-left">
              <div className={cn("pointer-events-none absolute -right-8 -bottom-8 size-24 rounded-full bg-gradient-to-br opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-40", tone.gradient)}/>
              <div className={cn("relative grid size-11 place-items-center rounded-xl bg-gradient-to-br p-px transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3", tone.gradient)}>
                <div className="grid size-full place-items-center rounded-[11px] bg-[#0a1120]/85">
                  <module.icon className={cn("size-5", tone.text)}/>
                </div>
              </div>
              <div className="relative min-w-0">
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
