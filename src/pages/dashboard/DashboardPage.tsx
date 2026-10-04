import {useCallback, useEffect, useMemo, useState, type ReactNode} from "react";
import {useNavigate} from "react-router";
import {toast} from "sonner";
import {formatDistanceToNowStrict} from "date-fns";
import {hu} from "date-fns/locale";
import {
  Activity, AlertOctagon, AlertTriangle, ArrowRight, Banknote, Bell, CalendarOff, ClipboardCheck, EyeOff, FileText,
  Fingerprint, Gavel, GraduationCap, Info, Megaphone, Pin, Plus, Receipt, ScrollText, ShieldCheck, Ticket, Trash2,
  TrendingUp, Truck, UserPlus, Users,
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
import {EmptyState} from "@/components/layout/EmptyState";
import {TONE_CLASSES, type Tone} from "@/components/layout/PageHeader";
import {ALERT_LEVELS} from "@/lib/alert-levels";
import {canViewCaseList, cn, errorMessage, getAdjacentRank, isStaff, STAFF_CATEGORY_LABELS, type StaffCategory} from "@/lib/utils";
import type {ActionLog, MemberEvent} from "@/types/supabase";
import {describeEvent} from "@/pages/hr/components/MemberSheet";
import {daysSince, formatSpan} from "@/pages/hr/hr-utils";

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
  info: {label: "Információ", icon: Info, tone: "text-sky-300 bg-sky-500/10 ring-sky-500/30"},
  alert: {label: "Riasztás", icon: AlertTriangle, tone: "text-red-300 bg-red-500/10 ring-red-500/30"},
  training: {label: "Képzés", icon: GraduationCap, tone: "text-emerald-300 bg-emerald-500/10 ring-emerald-500/30"},
} as const;

const ago = (iso: string) => formatDistanceToNowStrict(new Date(iso), {addSuffix: true, locale: hu});

export function DashboardPage() {
  const {profile, supabase} = useAuth();
  const {alertLevel} = useSystemStatus();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [announcements, setAnnouncements] = useState<FeedAnnouncement[] | null>(null);
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([]);
  const [events, setEvents] = useState<(MemberEvent & {member?: {full_name: string} | null})[]>([]);
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadAnnouncements = useCallback(async () => {
    const {data, error} = await supabase.rpc("get_announcements", {_limit: 12});
    if (!error) setAnnouncements((data ?? []) as FeedAnnouncement[]);
  }, [supabase]);

  // Four requests in parallel: the summary (one RPC), announcements, activity and HR changes.
  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.rpc("get_dashboard_summary"),
      supabase.rpc("get_announcements", {_limit: 12}),
      supabase.from("action_logs")
        .select("id, user_id, action_type, details, created_at, profiles!action_logs_user_id_fkey(full_name, badge_number)")
        .order("created_at", {ascending: false}).limit(8),
      supabase.from("member_events")
        .select("id, user_id, actor_id, kind, from_value, to_value, detail, created_at, member:profiles!member_events_user_id_fkey(full_name)")
        .in("kind", ["joined", "rank", "award"]).order("created_at", {ascending: false}).limit(6),
    ]).then(([summaryResult, announcementResult, logResult, eventResult]) => {
      if (!active) return;
      if (!summaryResult.error) setSummary(summaryResult.data as DashboardSummary);
      setAnnouncements((announcementResult.data ?? []) as FeedAnnouncement[]);
      setActionLogs((logResult.data ?? []) as unknown as ActionLog[]);
      setEvents((eventResult.data ?? []) as unknown as (MemberEvent & {member?: {full_name: string} | null})[]);
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 6 ? "Jó éjszakát" : hour < 10 ? "Jó reggelt" : hour < 18 ? "Szép napot" : "Jó estét";
  }, []);

  if (!profile) return null;
  const level = ALERT_LEVELS[alertLevel];
  const canPost = isStaff(profile);
  const nextRank = getAdjacentRank(profile.faction_rank, "up");

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

  const tasks: {label: string; value: number | null | undefined; icon: typeof Bell; tone: Tone; to: string; hint?: string}[] = [
    {label: "Olvasatlan értesítés", value: summary?.unread_notifications, icon: Bell, tone: "gold", to: "/notifications"},
    {label: "Javítandó vizsgalap", value: summary?.pending_exam_sheets, icon: ClipboardCheck, tone: "violet", to: "/exams?tab=grading"},
    {label: "Jóváhagyásra váró parancs", value: summary?.pending_warrants, icon: Gavel, tone: "red", to: "/mcb"},
    {label: "Új regisztráció", value: summary?.pending_registrations, icon: UserPlus, tone: "emerald", to: "/hr?tab=requests"},
    {label: "Szabadságkérelem", value: summary?.pending_leave_requests, icon: CalendarOff, tone: "blue", to: "/hr?tab=requests"},
    {label: "Járműigénylés", value: summary?.pending_vehicle_requests, icon: Truck, tone: "orange", to: "/logistics"},
    {label: "Költségtérítés", value: summary?.pending_budget_requests, icon: Receipt, tone: "emerald", to: "/finance"},
    {label: "Nyitott aktám", value: summary?.my_open_cases, icon: Fingerprint, tone: "blue", to: "/mcb"},
  ];
  const visibleTasks = tasks.filter((task) => task.value !== null);

  return (
    <div className="space-y-6">
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

      {/* Greeting */}
      <section className="panel relative overflow-hidden p-6 md:p-8">
        <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-primary/10 blur-3xl"/>
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">San Fierro Sheriff's Department</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              {greeting}, {profile.full_name.split(" ")[0]}!
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {profile.faction_rank} · <span className="font-mono">#{profile.badge_number}</span> · {profile.division}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[560px]">
            <MiniFact label="Készültség" value={<span className={level.text}>{level.label}</span>}/>
            <MiniFact label="Állomány" value={summary ? `${summary.members_total} fő` : "…"}
                      hint={summary && summary.members_on_leave > 0 ? `${summary.members_on_leave} szabadságon` : undefined}/>
            <MiniFact label="Rangon" value={formatSpan(daysSince(profile.last_promotion_date ?? profile.created_at))}
                      hint={nextRank ? `Következő: ${nextRank}` : undefined}/>
            <MiniFact label="Szolgálatban" value={formatSpan(daysSince(profile.created_at))}/>
          </div>
        </div>
        {!!summary?.my_active_warnings && (
          <button type="button" onClick={() => navigate("/profile")}
                  className="relative mt-5 flex w-full items-center gap-3 rounded-xl bg-red-500/10 px-4 py-3 text-left text-sm text-red-200 ring-1 ring-red-500/25 hover:bg-red-500/15">
            <AlertOctagon className="size-4 shrink-0 text-red-400"/>
            {summary.my_active_warnings} aktív figyelmeztetésed van. Részletek a profilodon.
            <ArrowRight className="ml-auto size-4"/>
          </button>
        )}
      </section>

      {/* To do */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-300">Teendők</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {visibleTasks.map((task) => {
            const tone = TONE_CLASSES[task.tone];
            const count = task.value ?? 0;
            return (
              <button key={task.label} type="button" onClick={() => navigate(task.to)}
                      className={cn("panel group flex items-center gap-4 p-4 text-left transition-colors hover:border-white/20 hover:bg-white/[0.03]",
                        count === 0 && "opacity-60 hover:opacity-100")}>
                <div className={cn("grid size-11 shrink-0 place-items-center rounded-xl ring-1", tone.tile)}><task.icon className="size-5"/></div>
                <div className="min-w-0 flex-1">
                  <div className="text-2xl font-semibold text-white tabular-nums">{summary ? count : "…"}</div>
                  <div className="truncate text-xs text-muted-foreground">{task.label}</div>
                </div>
                <ArrowRight className="size-4 text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-300"/>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Announcements */}
        <section className="panel overflow-hidden">
          <header className="flex items-center gap-3 border-b px-5 py-4">
            <Megaphone className="size-4 text-primary"/>
            <h2 className="text-sm font-semibold text-white">Hirdetmények</h2>
            {canPost && (
              <Button size="sm" className="ml-auto" onClick={() => setIsAnnouncementOpen(true)}><Plus/> Új hirdetmény</Button>
            )}
          </header>
          {announcements === null ? (
            <div className="space-y-3 p-5">
              {[0, 1].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-white/[0.03]"/>)}
            </div>
          ) : announcements.length === 0 ? (
            <EmptyState icon={Megaphone} title="Nincs friss hirdetmény." compact/>
          ) : (
            <ul className="divide-y divide-white/5">
              {announcements.map((item) => {
                const type = ANNOUNCEMENT_TYPES[item.type] ?? ANNOUNCEMENT_TYPES.info;
                return (
                  <li key={item.id} className={cn("group px-5 py-4", item.is_pinned && "bg-primary/[0.03]")}>
                    <div className="flex items-start gap-3">
                      <div className={cn("grid size-9 shrink-0 place-items-center rounded-xl ring-1", type.tone)}><type.icon className="size-4"/></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {item.is_pinned && <Pin className="size-3.5 rotate-45 text-primary"/>}
                          <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                          <span className="text-xs text-slate-500">{ago(item.created_at)}</span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-300">{item.content}</p>
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
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
                        <Button size="icon-sm" variant="ghost" title="Törlés" onClick={() => setDeleteId(item.id)}
                                className="text-slate-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400">
                          <Trash2 className="size-4"/>
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          <Feed title="Állományhírek" icon={TrendingUp} empty="Még nincs változás." onMore={() => navigate("/hr?tab=history")}>
            {events.map((event) => (
              <li key={event.id} className="flex items-start gap-3 px-5 py-3">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full",
                  event.kind === "award" ? "bg-amber-400" : event.kind === "joined" ? "bg-primary"
                    : event.detail === "promotion" ? "bg-emerald-400" : "bg-red-400")}/>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-200">
                    <span className="font-medium text-white">{event.member?.full_name ?? "Tag"}</span>{" "}
                    <span className="text-slate-400">
                      {event.kind === "award" ? "kitüntetést kapott" : event.kind === "joined" ? "csatlakozott"
                        : event.detail === "promotion" ? "előléptetve" : "rendfokozata változott"}
                    </span>
                  </p>
                  <p className="truncate text-xs text-slate-500">{describeEvent(event)}</p>
                </div>
                <span className="shrink-0 text-[11px] text-slate-500">{ago(event.created_at)}</span>
              </li>
            ))}
          </Feed>

          <Feed title="Eseménynapló (24 óra)" icon={Activity} empty="Csendes nap.">
            {actionLogs.map((log) => (
              <li key={log.id} className="flex items-start gap-3 px-5 py-3">
                <div className={cn("grid size-7 shrink-0 place-items-center rounded-lg ring-1",
                  log.action_type === "arrest" ? "bg-red-500/10 text-red-300 ring-red-500/25"
                    : log.action_type === "ticket" ? "bg-orange-500/10 text-orange-300 ring-orange-500/25"
                      : "bg-sky-500/10 text-sky-300 ring-sky-500/25")}>
                  {log.action_type === "arrest" ? <AlertOctagon className="size-3.5"/> : log.action_type === "ticket" ? <Ticket className="size-3.5"/> : <Info className="size-3.5"/>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-200">
                    <span className="font-medium text-white">{log.profiles?.full_name ?? "Ismeretlen"}</span>{" "}
                    <span className="text-slate-400">{log.action_type === "arrest" ? "letartóztatás" : log.action_type === "ticket" ? "bírság" : "bejegyzés"}</span>
                  </p>
                  <p className="line-clamp-2 break-words text-xs text-slate-500">{log.details}</p>
                </div>
                <span className="shrink-0 text-[11px] text-slate-500">
                  {new Date(log.created_at).toLocaleTimeString("hu-HU", {hour: "2-digit", minute: "2-digit"})}
                </span>
              </li>
            ))}
          </Feed>
        </div>
      </div>

      {/* Modules */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-300">Gyors elérés</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-9">
          {[
            {label: "Nyomozó Iroda", icon: Fingerprint, to: "/mcb", tone: "blue" as Tone, show: canViewCaseList(profile)},
            {label: "Logisztika", icon: Truck, to: "/logistics", tone: "orange" as Tone, show: true},
            {label: "Pénzügy", icon: Banknote, to: "/finance", tone: "emerald" as Tone, show: true},
            {label: "Vizsgaközpont", icon: ScrollText, to: "/exams", tone: "violet" as Tone, show: true},
            {label: "Kalkulátor", icon: Gavel, to: "/calculator", tone: "red" as Tone, show: true},
            {label: "Jelentések", icon: FileText, to: "/reports", tone: "cyan" as Tone, show: true},
            {label: "Akadémia", icon: GraduationCap, to: "/academy", tone: "blue" as Tone, show: true},
            {label: "Személyügy", icon: Users, to: "/hr", tone: "gold" as Tone, show: true},
            {label: "Profilom", icon: ShieldCheck, to: "/profile", tone: "slate" as Tone, show: true},
          ].filter((module) => module.show).map((module) => (
            <button key={module.to} type="button" onClick={() => navigate(module.to)}
                    className="panel group flex flex-col items-start gap-3 p-4 text-left transition-colors hover:border-white/20 hover:bg-white/[0.03]">
              <div className={cn("grid size-10 place-items-center rounded-xl ring-1", TONE_CLASSES[module.tone].tile)}><module.icon className="size-5"/></div>
              <span className="text-sm font-medium text-slate-200 group-hover:text-white">{module.label}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function MiniFact({label, value, hint}: {label: string; value: ReactNode; hint?: string}) {
  return (
    <div className="rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/5">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-0.5 truncate text-sm font-semibold text-white">{value}</div>
      {hint && <div className="truncate text-[11px] text-slate-500">{hint}</div>}
    </div>
  );
}

function Feed({title, icon: Icon, empty, onMore, children}: {
  title: string; icon: typeof Activity; empty: string; onMore?: () => void; children: ReactNode[];
}) {
  return (
    <section className="panel overflow-hidden">
      <header className="flex items-center gap-3 border-b px-5 py-3.5">
        <Icon className="size-4 text-primary"/>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {onMore && (
          <button type="button" onClick={onMore} className="ml-auto text-xs text-slate-400 hover:text-white">Mind</button>
        )}
      </header>
      {children.length === 0 ? <EmptyState icon={Icon} title={empty} compact/> : <ul className="divide-y divide-white/5">{children}</ul>}
    </section>
  );
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
            <Textarea value={content} onChange={(event) => setContent(event.target.value)} rows={5} placeholder="Írd ide az üzenetet…"/>
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
