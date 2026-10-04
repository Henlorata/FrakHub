import * as React from "react";
import {useNavigate, useSearchParams} from "react-router";
import {useAuth} from "@/context/AuthContext";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {Badge} from "@/components/ui/badge";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {toast} from "sonner";
import {
  AlertTriangle, BellRing, Briefcase, CalendarClock, CalendarOff, CalendarPlus, Camera, Fingerprint, History, Key,
  Loader2, Medal, NotebookPen, QrCode, Save, Shield, ThumbsUp, UploadCloud, UserCog, X,
} from "lucide-react";
import {cn, errorMessage, getDepartmentLabel} from "@/lib/utils";
import {deleteCloudinaryAssets, getOptimizedAvatarUrl, uploadToCloudinary} from "@/lib/cloudinary";
import {PageHeader} from "@/components/layout/PageHeader";
import {StatCard} from "@/components/layout/StatCard";
import {EmptyState} from "@/components/layout/EmptyState";
import {MemberHistoryTimeline} from "@/pages/hr/components/MemberSheet";
import {daysSince, formatDate, formatSpan} from "@/pages/hr/hr-utils";
import type {HrRecord, Profile, Ribbon} from "@/types/supabase";

interface AwardedRibbon extends Ribbon {
  awarded_at: string;
}

interface IdCardTheme {
  bg: string;
  border: string;
  shadow: string;
  text: string;
  scanColor: string;
  logo?: string;
}

// --- 3D TILT CARD ---
const TiltCard = ({children, className}: { children: React.ReactNode, className?: string }) => {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const shineRef = React.useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || !shineRef.current || window.innerWidth < 1024) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -3;
    const rotateY = ((x - centerX) / centerX) * 3;

    cardRef.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.01)`;
    shineRef.current.style.background = `radial-gradient(circle at ${(x / rect.width) * 100}% ${(y / rect.height) * 100}%, rgba(255,255,255,0.1), transparent 60%)`;
  };

  const handleMouseLeave = () => {
    if (!cardRef.current || !shineRef.current) return;
    cardRef.current.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)`;
    shineRef.current.style.background = 'transparent';
  };

  return (
    <div ref={cardRef}
         className={`relative transition-transform duration-300 ease-out will-change-transform ${className}`}
         onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <div ref={shineRef}
           className="absolute inset-0 pointer-events-none z-20 mix-blend-overlay transition-all duration-300 rounded-xl"/>
      {children}
    </div>
  );
};

// --- FINGERPRINT SCANNER ---
const FingerprintScanner = ({colorClass, profile}: { colorClass: string, profile: Profile }) => {
  const avatarSrc = getOptimizedAvatarUrl(profile.avatar_url, 320);

  return (
    <div
      className="w-full h-full bg-black/80 flex flex-col items-center justify-center relative overflow-hidden border border-white/10 rounded-md group cursor-pointer shadow-inner">
      <div
        className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:10px_10px]"></div>

      {/* Default: Ujjlenyomat */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-300 group-hover:opacity-0">
        <Fingerprint className={`w-24 h-24 ${colorClass} opacity-80 z-10 animate-pulse`}/>
        <div
          className="absolute inset-x-0 h-0.5 bg-white/50 shadow-[0_0_15px_rgba(255,255,255,0.8)] z-20 animate-[scan-vertical_2.5s_ease-in-out_infinite]"></div>
        <div
          className="absolute bottom-3 text-[8px] uppercase tracking-widest text-slate-400 font-mono z-10 bg-black/90 px-2 py-0.5 rounded border border-white/10">
          BIOMETRIC ID
        </div>
      </div>

      {/* Hover: Profilkép */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-slate-900">
        <Avatar className="w-full h-full rounded-none">
          <AvatarImage src={avatarSrc || ""} className="object-cover"/>
          <AvatarFallback
            className="bg-slate-800 text-slate-500 font-bold text-4xl">{profile.full_name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="absolute inset-0 bg-green-500/10 mix-blend-overlay pointer-events-none"></div>
        <div className="absolute bottom-0 w-full bg-black/80 text-center py-1 border-t border-green-500/30">
          <span
            className="text-[9px] text-green-400 font-mono font-bold tracking-widest animate-pulse">ACCESS GRANTED</span>
        </div>
      </div>
    </div>
  );
};

const RECORD_META: Record<HrRecord["kind"], {label: string; icon: typeof AlertTriangle; tone: string}> = {
  warning: {label: "Figyelmeztetés", icon: AlertTriangle, tone: "bg-red-500/10 text-red-300 ring-red-500/30"},
  commendation: {label: "Dicséret", icon: ThumbsUp, tone: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"},
  note: {label: "Jegyzet", icon: NotebookPen, tone: "bg-slate-500/10 text-slate-300 ring-slate-500/30"},
  leave: {label: "Szabadság", icon: CalendarOff, tone: "bg-sky-500/10 text-sky-300 ring-sky-500/30"},
};

const RECORD_STATUS: Record<HrRecord["status"], string> = {
  pending: "Elbírálásra vár", active: "Érvényes", rejected: "Elutasítva", revoked: "Visszavonva",
};

const today = () => new Date().toISOString().slice(0, 10);

export function ProfilePage() {
  const {profile, supabase} = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [isUpdating, setIsUpdating] = React.useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = React.useState(false);
  const [closedCases, setClosedCases] = React.useState(0);
  const [ribbons, setRibbons] = React.useState<AwardedRibbon[]>([]);
  const [records, setRecords] = React.useState<HrRecord[] | null>(null);
  const [tab, setTab] = React.useState(searchParams.get("leave") ? "records" : "awards");
  const [leaveOpen, setLeaveOpen] = React.useState(!!searchParams.get("leave"));

  const [newName, setNewName] = React.useState(profile?.full_name || "");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  const profileId = profile?.id;

  // Keyed on the id, not the profile object: Realtime profile updates must not refetch.
  const loadData = React.useCallback(async () => {
    if (!profileId) return;
    const [closedResult, ribbonResult, recordResult] = await Promise.all([
      supabase.from('cases').select('id', {count: 'exact', head: true}).eq('owner_id', profileId).eq('status', 'closed'),
      supabase.from('user_ribbons').select('awarded_at, ribbons (id, name, description, color_hex, image_url)').eq('user_id', profileId),
      supabase.from('hr_records').select('*').eq('user_id', profileId).order('created_at', {ascending: false}),
    ]);
    const awarded = (ribbonResult.data ?? []) as unknown as {awarded_at: string, ribbons: Ribbon | null}[];
    setRibbons(awarded.flatMap(row => row.ribbons ? [{...row.ribbons, awarded_at: row.awarded_at}] : []));
    setClosedCases(closedResult.count || 0);
    setRecords((recordResult.data ?? []) as HrRecord[]);
  }, [profileId, supabase]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  React.useEffect(() => {
    setNewName(profile?.full_name || "");
  }, [profile?.full_name]);

  const closeLeaveDialog = (open: boolean) => {
    setLeaveOpen(open);
    if (!open && searchParams.get("leave")) {
      const next = new URLSearchParams(searchParams);
      next.delete("leave");
      setSearchParams(next, {replace: true});
    }
  };

  const handleNameChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return toast.error("A név nem lehet üres.");
    setIsUpdating(true);
    try {
      const {error} = await supabase.rpc('change_user_name', {_new_name: newName.trim()});
      if (error) throw error;
      toast.success("Név frissítve!");
    } catch (e) {
      toast.error("Hiba: " + errorMessage(e));
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return toast.error("A jelszavak nem egyeznek!");
    if (newPassword.length < 6) return toast.error("A jelszónak legalább 6 karakterből kell állnia!");
    setIsUpdating(true);
    const {error} = await supabase.auth.updateUser({password: newPassword});
    setIsUpdating(false);
    if (error) toast.error("Hiba: " + error.message); else {
      toast.success("Jelszó módosítva!");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("A kép max. 5MB lehet!");

    setIsUploadingAvatar(true);
    const toastId = toast.loading("Profilkép cseréje...");
    try {
      const previousAvatarUrl = profile.avatar_url;
      // 1. Upload the new picture (resized to 512px WebP in the browser first).
      const secureUrl = await uploadToCloudinary(file, 'avatar');
      // 2. Point the profile at it.
      const {error} = await supabase.from('profiles').update({avatar_url: secureUrl}).eq('id', profile.id);
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
      e.target.value = "";
    }
  };

  const cancelLeave = async (record: HrRecord) => {
    const {error} = await supabase.from('hr_records').delete().eq('id', record.id);
    if (error) return toast.error("Hiba: " + errorMessage(error));
    setRecords(prev => (prev ?? []).filter(item => item.id !== record.id));
    toast.success("Szabadságkérelem visszavonva.");
  };

  if (!profile) return null;

  const getTheme = (): IdCardTheme => {
    if (profile.is_bureau_manager) return {
      bg: 'bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#312e81]',
      border: 'border-purple-500/50',
      shadow: 'shadow-purple-900/20',
      text: 'text-purple-400',
      scanColor: 'text-purple-500'
    };
    if (profile.division === 'SEB') return {
      bg: 'bg-gradient-to-br from-[#0f172a] via-[#1a0505] to-black',
      border: 'border-red-600/50',
      shadow: 'shadow-red-900/20',
      text: 'text-red-500',
      scanColor: 'text-red-500',
      logo: '/seb.png'
    };
    if (profile.division === 'MCB') return {
      bg: 'bg-gradient-to-br from-[#0f172a] via-[#050f1a] to-black',
      border: 'border-blue-500/50',
      shadow: 'shadow-blue-900/20',
      text: 'text-blue-400',
      scanColor: 'text-blue-400',
      logo: '/mcb.png'
    };
    return {
      bg: 'bg-gradient-to-br from-[#0f172a] via-[#051a0f] to-black',
      border: 'border-green-600/50',
      shadow: 'shadow-green-900/20',
      text: 'text-green-500',
      scanColor: 'text-green-500'
    };
  };
  const theme = getTheme();
  const activeWarnings = (records ?? []).filter(record => record.kind === 'warning' && record.status === 'active').length;
  const currentLeave = (records ?? []).find(record => record.kind === 'leave' && record.status === 'active'
    && record.starts_on && record.ends_on && record.starts_on <= today() && record.ends_on >= today());

  return (
    <div className="space-y-6">
      <LeaveRequestDialog open={leaveOpen} onOpenChange={closeLeaveDialog} onCreated={(record) => {
        setRecords(prev => [record, ...(prev ?? [])]);
        setTab("records");
      }}/>

      <PageHeader
        icon={UserCog}
        eyebrow="Személyi akta"
        title={profile.full_name}
        description={`${profile.faction_rank} · #${profile.badge_number} · ${getDepartmentLabel(profile.division)}`}
        actions={(
          <>
            <Button variant="outline" onClick={() => navigate('/notifications?view=settings')}><BellRing/> Értesítések</Button>
            <Button onClick={() => setLeaveOpen(true)}><CalendarPlus/> Szabadság igénylése</Button>
          </>
        )}
      />

      {currentLeave && (
        <div className="flex items-center gap-3 rounded-xl bg-sky-500/10 px-4 py-3 text-sm text-sky-200 ring-1 ring-sky-500/25">
          <CalendarOff className="size-4 text-sky-400"/>
          Szabadságon vagy {formatDate(currentLeave.ends_on)}-ig.
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-5">
          {/* ID card */}
          <TiltCard
            className={`relative overflow-hidden rounded-xl border-2 ${theme.border} ${theme.shadow} shadow-2xl ${theme.bg} p-6 md:p-8 w-full min-h-[380px] flex flex-col justify-between group select-none`}>
            <div className="absolute inset-0 tex-carbon opacity-30 mix-blend-overlay pointer-events-none"></div>
            <div className="flex justify-between items-start relative z-10 border-b border-white/10 pb-5 mb-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded border border-white/10 bg-black/40 shadow-inner">
                  <Shield className={`w-10 h-10 ${theme.text}`}/>
                </div>
                <div className="leading-tight">
                  <div className="text-[11px] text-slate-400 uppercase tracking-[0.3em] font-bold">SAN FIERRO</div>
                  <div className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter">SHERIFF'S DEPT</div>
                  <div className={`text-sm font-bold ${theme.text} uppercase tracking-[0.3em] mt-1`}>{getDepartmentLabel(profile.division)}</div>
                </div>
              </div>
              <div className="w-20 h-20 opacity-90 drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]">
                {theme.logo ? <img src={theme.logo} alt="" className="w-full h-full object-contain"/> :
                  <Shield className="w-full h-full text-slate-700 opacity-50"/>}
              </div>
            </div>

            <div className="flex gap-6 relative z-10 items-center flex-1">
              <div className="w-32 md:w-40 aspect-[3/4] shrink-0 relative rounded border border-white/20 overflow-hidden shadow-2xl bg-black">
                <FingerprintScanner colorClass={theme.scanColor} profile={profile}/>
              </div>
              <div className="flex-1 flex flex-col justify-center space-y-5 w-full min-w-0">
                <div>
                  <div className="text-[11px] text-slate-500 uppercase tracking-widest font-bold mb-1">Név</div>
                  <div className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight leading-none drop-shadow-lg break-words">{profile.full_name}</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="min-w-0">
                    <div className="text-[11px] text-slate-500 uppercase tracking-widest font-bold mb-1">Rendfokozat</div>
                    <div className={`text-sm font-bold uppercase ${theme.text} tracking-wide`}>{profile.faction_rank}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500 uppercase tracking-widest font-bold mb-1">Jelvény</div>
                    <div className="text-lg font-mono font-black text-white bg-white/10 px-3 py-0.5 rounded inline-block tracking-[0.2em] shadow-inner">#{profile.badge_number}</div>
                  </div>
                </div>
                <div className="space-y-2 pt-3 border-t border-white/5">
                  <div className="text-[11px] text-slate-500 uppercase tracking-widest font-bold">Képesítések</div>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.is_bureau_manager && <Badge className="bg-purple-600 text-white border-none">MANAGER</Badge>}
                    {profile.is_bureau_commander && <Badge className="bg-blue-600 text-white border-none">COMMANDER</Badge>}
                    {profile.commanded_divisions?.map(d => <Badge key={d} className="bg-yellow-500 text-black font-bold border-none">LEAD: {d}</Badge>)}
                    {(profile.qualifications || []).map(q => (
                      <Badge key={q} variant="outline" className="border-slate-600 text-slate-300 bg-black/20">{q}</Badge>
                    ))}
                    {!profile.is_bureau_manager && !profile.is_bureau_commander && (profile.qualifications || []).length === 0 && (
                      <span className="text-xs text-slate-500">Nincs képesítés</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10 flex justify-between items-end mt-auto pt-5 border-t border-white/10 opacity-70">
              <div className="flex items-center gap-3">
                <QrCode className="w-8 h-8 text-white/80"/>
                <div className="text-[10px] font-mono text-slate-400 leading-tight">
                  Csatlakozott: {formatDate(profile.created_at)}<br/>Előléptetve: {formatDate(profile.last_promotion_date)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className={cn("w-2.5 h-2.5 rounded-full animate-pulse", currentLeave ? "bg-sky-400" : "bg-green-500 shadow-[0_0_8px_#22c55e]")}></div>
                <span className="text-xs font-bold uppercase text-white tracking-[0.15em]">{currentLeave ? "Szabadságon" : "Aktív"}</span>
              </div>
            </div>
          </TiltCard>

          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={CalendarClock} tone="gold" label="Szolgálati idő" value={formatSpan(daysSince(profile.created_at))}/>
            <StatCard icon={Fingerprint} tone="violet" label="Rangon töltött idő" value={formatSpan(daysSince(profile.last_promotion_date ?? profile.created_at))}/>
            <StatCard icon={Briefcase} tone="blue" label="Lezárt akta" value={closedCases}/>
            <StatCard icon={Medal} tone="orange" label="Kitüntetés" value={ribbons.length}/>
          </div>
        </div>

        <div className="xl:col-span-7">
          <Tabs value={tab} onValueChange={setTab} className="gap-0">
            <TabsList className="mb-4 flex-wrap justify-start">
              <TabsTrigger value="awards"><Medal className="size-4"/> Kitüntetések</TabsTrigger>
              <TabsTrigger value="history"><History className="size-4"/> Előzmények</TabsTrigger>
              <TabsTrigger value="records">
                <NotebookPen className="size-4"/> Feljegyzéseim
                {activeWarnings > 0 && <span className="rounded-full bg-red-500/20 px-1.5 text-[11px] text-red-300">{activeWarnings}</span>}
              </TabsTrigger>
              <TabsTrigger value="settings"><UserCog className="size-4"/> Fiók</TabsTrigger>
            </TabsList>

            <TabsContent value="awards" className="mt-0">
              <div className="panel p-5">
                {ribbons.length === 0 ? (
                  <EmptyState icon={Medal} title="Még nincs kitüntetésed." description="A kitüntetéseket a vezetőség adja át." compact/>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {ribbons.map((ribbon, idx) => (
                      <div key={idx} className="flex items-center gap-4 rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/5">
                        {ribbon.image_url
                          ? <img src={ribbon.image_url} alt={ribbon.name} className="h-10 w-16 shrink-0 object-contain"/>
                          : <div className="h-12 w-4 shrink-0 rounded-sm border border-white/10" style={{backgroundColor: ribbon.color_hex ?? undefined}}/>}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{ribbon.name}</p>
                          {ribbon.description && <p className="line-clamp-2 text-xs text-slate-400">{ribbon.description}</p>}
                          <p className="mt-1 text-[11px] text-slate-500">{formatDate(ribbon.awarded_at)}</p>
                        </div>
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
                  <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-primary/70"/></div>
                ) : records.length === 0 ? (
                  <EmptyState icon={NotebookPen} title="Nincs feljegyzésed." compact/>
                ) : (
                  <ul className="divide-y divide-white/5">
                    {records.map(record => {
                      const meta = RECORD_META[record.kind];
                      const Icon = meta.icon;
                      const inactive = record.status === 'revoked' || record.status === 'rejected';
                      return (
                        <li key={record.id} className={cn("flex items-start gap-3 px-5 py-4", inactive && "opacity-60")}>
                          <div className={cn("grid size-9 shrink-0 place-items-center rounded-xl ring-1", meta.tone)}><Icon className="size-4"/></div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium text-white">{record.title}</p>
                              <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[11px] text-slate-400">{RECORD_STATUS[record.status]}</span>
                            </div>
                            {record.details && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-400">{record.details}</p>}
                            <p className="mt-1 text-xs text-slate-500">
                              {meta.label}
                              {(record.starts_on || record.ends_on) && ` · ${formatDate(record.starts_on)} – ${formatDate(record.ends_on)}`}
                              {` · ${formatDate(record.created_at)}`}
                            </p>
                          </div>
                          {record.kind === 'leave' && record.status === 'pending' && (
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

            <TabsContent value="settings" className="mt-0 space-y-4">
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
                        isUploadingAvatar && "pointer-events-none opacity-50")}>
                        {isUploadingAvatar ? <Loader2 className="size-4 animate-spin"/> : <UploadCloud className="size-4 text-sky-400"/>}
                        {isUploadingAvatar ? 'Feltöltés…' : 'Új kép feltöltése'}
                      </span>
                      <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={isUploadingAvatar}/>
                    </label>
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                      <Camera className="size-3.5"/> JPG, PNG vagy WEBP, max. 5 MB. A rendszer automatikusan optimalizálja.
                    </p>
                  </div>
                </div>
              </section>

              <form onSubmit={handleNameChange} className="panel space-y-3 p-5">
                <Label className="text-xs text-muted-foreground">Megjelenített név (IC)</Label>
                <div className="flex gap-3">
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={64}/>
                  <Button type="submit" disabled={isUpdating || newName.trim() === profile.full_name}>
                    {isUpdating ? <Loader2 className="animate-spin"/> : <Save/>} Mentés
                  </Button>
                </div>
                <p className="text-xs text-slate-500">A névváltozás bekerül az előzményeid közé.</p>
              </form>

              <form onSubmit={handlePasswordChange} className="panel space-y-3 p-5">
                <Label className="text-xs text-muted-foreground">Jelszó módosítása</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input type="password" placeholder="Új jelszó" value={newPassword} autoComplete="new-password"
                         onChange={(e) => setNewPassword(e.target.value)}/>
                  <Input type="password" placeholder="Új jelszó még egyszer" value={confirmPassword} autoComplete="new-password"
                         onChange={(e) => setConfirmPassword(e.target.value)}/>
                </div>
                <Button type="submit" disabled={isUpdating || !newPassword}>
                  {isUpdating ? <Loader2 className="animate-spin"/> : <Key/>} Jelszó frissítése
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
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
    const {data, error} = await supabase.from('hr_records').insert({
      user_id: profile.id, created_by: profile.id, kind: 'leave', status: 'pending',
      title: title.trim() || 'Szabadság', details: details.trim() || null, starts_on: startsOn, ends_on: endsOn,
    }).select('*').single();
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
              <Input type="date" value={startsOn} min={today()} onChange={(e) => setStartsOn(e.target.value)}/>
            </div>
            <div className="space-y-1.5">
              <Label>Vége</Label>
              <Input type="date" value={endsOn} min={startsOn || today()} onChange={(e) => setEndsOn(e.target.value)}/>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Megnevezés</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Pl. Nyaralás, vizsgaidőszak"/>
          </div>
          <div className="space-y-1.5">
            <Label>Megjegyzés (opcionális)</Label>
            <Textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={2000}/>
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
