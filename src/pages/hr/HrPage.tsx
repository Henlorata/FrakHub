import {useCallback, useMemo, useState} from "react";
import {useSearchParams} from "react-router";
import {toast} from "sonner";
import {BarChart3, CalendarOff, Clock, DoorOpen, Download, GraduationCap, History, Inbox, List, Medal, Network, RefreshCw, UserPlus, Users} from "lucide-react";
import {PageHeader} from "@/components/layout/PageHeader";
import {StatCard} from "@/components/layout/StatCard";
import {Button} from "@/components/ui/button";
import {useAuth} from "@/context/AuthContext";
import {useSystemStatus} from "@/context/SystemStatusContext";
import {ACTIVITY_META, formatDuty, JOIN_TYPE_LABELS, monthLabel, recentMonths} from "@/lib/registry";
import {cn, errorMessage, getRankPriority, getStaffCategory, isStaff} from "@/lib/utils";
import {CATEGORY_META, downloadCsv, formatDate} from "./hr-utils";
import {useHrData, type HrMember} from "./useHrData";
import {RosterTable} from "./components/RosterTable";
import {LeadershipPanel} from "./components/LeadershipPanel";
import {OrgChart} from "./components/OrgChart";
import {MemberSheet} from "./components/MemberSheet";
import {RequestsPanel} from "./components/RequestsPanel";
import {HistoryFeed} from "./components/HistoryFeed";
import {StatsPanel} from "./components/StatsPanel";
import {DutyPanel} from "./components/DutyPanel";
import {FormerMembersPanel} from "./components/FormerMembersPanel";
import {PromotionsPanel} from "./components/PromotionsPanel";
import {TraineesPanel} from "./components/TraineesPanel";
import {ActivityWatchPanel} from "./components/ActivityWatchPanel";
import type {Departure} from "./components/MemberRegistryTab";
import {todayKey} from "@/lib/datetime";

type Tab = "roster" | "duty" | "promotions" | "trainees" | "requests" | "former" | "history" | "stats";
const TABS: Tab[] = ["roster", "duty", "promotions", "trainees", "requests", "former", "history", "stats"];

export function HrPage() {
  const {profile} = useAuth();
  const {recruitmentOpen} = useSystemStatus();
  const {
    members: allMembers, loading, reload, updateMember, removeMember, pendingLeaveRequests, decideLeave,
    recordChanged, setMemberAwards, staff, saveDetails, saveBankAccount, saveDuty,
  } = useHrData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const requested = searchParams.get("tab");
  const tab: Tab = requested === "pending" ? "requests" : TABS.includes(requested as Tab) ? requested as Tab : "roster";
  const openMemberId = searchParams.get("member");
  const rosterView = searchParams.get("view") === "org" ? "org" : "list";

  const members = useMemo(() => allMembers.filter((member) => member.system_role !== "pending"), [allMembers]);
  const pending = useMemo(() => allMembers.filter((member) => member.system_role === "pending"), [allMembers]);
  const openMember = openMemberId ? allMembers.find((member) => member.id === openMemberId) ?? null : null;
  const requestCount = pending.length + pendingLeaveRequests.length;

  const setParam = useCallback((key: string, value: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    }, {replace: key === "member"});
  }, [setSearchParams]);

  /**
   * One-click rank change. The toast offers an undo, which restores the previous rank and
   * promotion date (the database then drops the change from the history as well).
   */
  const changeRank = useCallback(async (member: HrMember, newRank: string, undo?: {previousDate: string | null}) => {
    if (busyId) return;
    const previousRank = member.faction_rank;
    const previousDate = member.last_promotion_date ?? null;
    setBusyId(member.id);
    try {
      const updated = await updateMember(member.id, {
        faction_rank: newRank,
        ...(undo?.previousDate ? {restore_promotion_date: undo.previousDate} : {}),
      });
      if (undo) {
        toast.success(`Visszavonva: ${member.full_name} ismét ${newRank}.`);
      } else {
        const promoted = getRankPriority(newRank) < getRankPriority(previousRank);
        toast.success(`${member.full_name} ${promoted ? "előléptetve" : "lefokozva"}`, {
          description: `${previousRank} → ${newRank}`,
          duration: 8000,
          action: {
            label: "Visszavonás",
            onClick: () => void changeRank({...member, ...updated}, previousRank, {previousDate}),
          },
        });
      }
    } catch (error) {
      toast.error(errorMessage(error, "A rendfokozat módosítása nem sikerült."));
    } finally {
      setBusyId(null);
    }
  }, [busyId, updateMember]);

  const handleRemove = useCallback(async (member: HrMember, departure: Departure) => {
    try {
      await removeMember(member.id, {...departure});
      setParam("member", null);
      toast.success(`${member.full_name} távozása rögzítve.`, {description: "Megtalálod a Kilépettek között."});
    } catch (error) {
      toast.error(errorMessage(error, "A művelet nem sikerült."));
    }
  }, [removeMember, setParam]);

  const exportCsv = () => {
    const months = recentMonths(6);
    const header = ["Jelvényszám", "Név", "Rendfokozat", "Szint", "Osztály", "Alosztály rang", "Képesítések", "Kirendeltség",
      "Parkoló", "Csatlakozott", "Csatlakozás módja", "Felvételiztető", "Utolsó rang lépés", "Aktivitás", "Kitüntetések", "Szabadság"];
    if (staff) header.push("Számlaszám", "Aktív figyelmeztetés", "Jármű-hibapont", "Utoljára aktív");
    header.push(...months.map((month) => `Duty ${monthLabel(month)}`));
    const rows = members.map((member) => {
      const row: (string | number)[] = [
        member.badge_number, member.full_name, member.faction_rank, CATEGORY_META[getStaffCategory(member.faction_rank)].label,
        member.division, member.division_rank ?? "", (member.qualifications ?? []).join(", "),
        member.details?.station ?? "", member.details?.parking_spot ?? "",
        formatDate(member.details?.joined_on ?? member.created_at), JOIN_TYPE_LABELS[member.details?.join_type ?? "new"],
        member.details?.recruited_by ?? "", formatDate(member.last_promotion_date),
        member.onLeaveNow ? "Szabadságon" : ACTIVITY_META[member.details?.activity_status ?? "active"].label,
        member.awards.map((award) => award.name).join(", "),
        member.leave ? `${formatDate(member.leave.starts_on)} – ${formatDate(member.leave.ends_on)}` : "",
      ];
      if (staff) row.push(member.bankAccount ?? "", `${member.warnings}/3`, `${member.vehicleWarnings}/3`, member.lastSeen ? formatDate(member.lastSeen) : "");
      row.push(...months.map((month) => {
        const minutes = member.duty.find((entry) => entry.month.slice(0, 10) === month)?.minutes;
        return minutes === undefined ? "" : formatDuty(minutes);
      }));
      return row;
    });
    downloadCsv(`sfsd-allomany-${todayKey()}.csv`, [header, ...rows]);
  };

  if (!profile) return null;

  const onLeave = members.filter((member) => member.onLeaveNow).length;
  const leaders = members.filter((member) => ["executive", "command", "supervisory"].includes(getStaffCategory(member.faction_rank))).length;
  const withDuty = members.filter((member) => member.dutyLastMonth !== null);
  const dutyTotal = withDuty.reduce((sum, member) => sum + (member.dutyLastMonth ?? 0), 0);

  const tabs: {id: Tab; label: string; icon: typeof Users; count?: number; visible: boolean}[] = [
    {id: "roster", label: "Állomány", icon: Users, visible: true},
    {id: "duty", label: "Szolgálati idő", icon: Clock, visible: true},
    {id: "promotions", label: "Előléptetés", icon: Medal, visible: isStaff(profile)},
    {id: "trainees", label: "Trainee-k", icon: GraduationCap, visible: true},
    {id: "requests", label: "Kérelmek", icon: Inbox, count: requestCount, visible: isStaff(profile)},
    {id: "former", label: "Kilépettek", icon: DoorOpen, visible: isStaff(profile)},
    {id: "history", label: "Változások", icon: History, visible: true},
    {id: "stats", label: "Statisztika", icon: BarChart3, visible: true},
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        eyebrow="Human Resources"
        title="Személyügy"
        description={`${members.length} tag az állományban · tagfelvétel ${recruitmentOpen ? "nyitva" : "zárva"}`}
        actions={(
          <>
            <Button variant="outline" onClick={exportCsv} disabled={loading}><Download/> Exportálás (CSV)</Button>
            <Button variant="ghost" size="icon" title="Frissítés" disabled={refreshing} onClick={async () => {
              setRefreshing(true);
              await reload();
              setRefreshing(false);
            }}>
              <RefreshCw className={cn(refreshing && "animate-spin")}/>
            </Button>
          </>
        )}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} icon={Users} tone="gold" label="Aktív állomány" value={loading ? "…" : members.length}
                  hint={`${leaders} vezető beosztásban`}/>
        <StatCard index={1} icon={CalendarOff} tone="blue" label="Szabadságon" value={loading ? "…" : onLeave}/>
        <StatCard index={2} icon={UserPlus} tone="emerald" label="Kérelmek" value={loading ? "…" : requestCount}
                  hint={`${pending.length} regisztráció · ${pendingLeaveRequests.length} szabadság`}
                  onClick={isStaff(profile) ? () => setParam("tab", "requests") : undefined}/>
        <StatCard index={3} icon={Clock} tone="cyan" label={`Duty idő (${monthLabel(recentMonths(2)[0])})`}
                  value={loading ? "…" : withDuty.length ? formatDuty(dutyTotal) : "–"}
                  hint={withDuty.length ? `átlag ${formatDuty(Math.round(dutyTotal / withDuty.length))} / fő` : "Még nincs rögzítve"}
                  onClick={() => setParam("tab", "duty")}/>
      </div>

      <div className="flex gap-1 overflow-x-auto overflow-y-hidden border-b" data-tour="hr-tabs">
        {tabs.filter((item) => item.visible).map((item) => (
          <button key={item.id} type="button" onClick={() => setParam("tab", item.id === "roster" ? null : item.id)} data-tour={`hr-tab-${item.id}`}
                  className={cn(
                    "relative inline-flex h-10 items-center gap-2 px-3 text-sm font-medium whitespace-nowrap transition-colors",
                    tab === item.id ? "text-white" : "text-slate-400 hover:text-slate-200",
                  )}>
            <item.icon className={cn("size-4 transition-colors", tab === item.id && "text-primary")}/>
            {item.label}
            {!!item.count && (
              <span className="rounded-full bg-primary/15 px-1.5 text-[11px] font-semibold text-primary tabular-nums">{item.count}</span>
            )}
            {tab === item.id && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary shadow-[0_0_10px_rgb(234_179_8/0.8)]"/>}
          </button>
        ))}
      </div>

      <div key={tab} className="animate-fade" data-tour="hr-content">
        {loading ? (
          <div className="space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-14"/>)}</div>
        ) : tab === "requests" && isStaff(profile) ? (
          <RequestsPanel viewer={profile} pending={pending} members={members} leaveRequests={pendingLeaveRequests}
                         onApprove={updateMember} onReject={(member) => removeMember(member.id)} onDecideLeave={decideLeave}
                         onSaveDetails={saveDetails}/>
        ) : tab === "former" && isStaff(profile) ? (
          <FormerMembersPanel viewer={profile}/>
        ) : tab === "promotions" && isStaff(profile) ? (
          <PromotionsPanel viewer={profile} members={members} onPromote={changeRank} onOpenMember={(id) => setParam("member", id)}/>
        ) : tab === "trainees" ? (
          <TraineesPanel viewer={profile} members={members} onPromote={changeRank} onOpenMember={(id) => setParam("member", id)}/>
        ) : tab === "duty" ? (
          <>
            {isStaff(profile) && <ActivityWatchPanel viewer={profile} members={members} onOpenMember={(id) => setParam("member", id)}/>}
            <DutyPanel members={members} editable={isStaff(profile)} onSave={saveDuty}/>
          </>
        ) : tab === "history" ? (
          <HistoryFeed members={allMembers} onOpenMember={(member) => setParam("member", member.id)}/>
        ) : tab === "stats" ? (
          <StatsPanel members={members} staff={isStaff(profile)}/>
        ) : (
          <div className="space-y-4">
            <div className="inline-flex rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/10" role="tablist" aria-label="Nézet" data-tour="hr-view">
              {([["list", "Lista", List], ["org", "Szervezeti ábra", Network]] as const).map(([id, label, Icon]) => (
                <button key={id} type="button" role="tab" aria-selected={rosterView === id} onClick={() => setParam("view", id === "list" ? null : id)}
                        className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
                          rosterView === id ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200")}>
                  <Icon className="size-3.5"/>{label}
                </button>
              ))}
            </div>
            {rosterView === "org" ? (
              <OrgChart members={members} onOpen={(member) => setParam("member", member.id)}/>
            ) : (
              <>
                <LeadershipPanel members={members} onOpen={(member) => setParam("member", member.id)}/>
                <RosterTable members={members} viewer={profile} staff={staff} busyId={busyId}
                             onRankChange={(member, rank) => void changeRank(member, rank)}
                             onOpen={(member) => setParam("member", member.id)}/>
              </>
            )}
          </div>
        )}
      </div>

      <MemberSheet
        member={openMember}
        viewer={profile}
        busy={busyId === openMember?.id}
        onOpenChange={(open) => !open && setParam("member", null)}
        onRankChange={(member, rank) => void changeRank(member, rank)}
        onUpdate={updateMember}
        onRemove={handleRemove}
        onRecordChanged={recordChanged}
        onAwardsChanged={setMemberAwards}
        onSaveDetails={saveDetails}
        onSaveBankAccount={saveBankAccount}
      />
    </div>
  );
}

