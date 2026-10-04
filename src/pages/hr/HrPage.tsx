import {useCallback, useMemo, useState} from "react";
import {useSearchParams} from "react-router";
import {toast} from "sonner";
import {BarChart3, CalendarOff, Download, History, Inbox, Loader2, RefreshCw, UserPlus, Users} from "lucide-react";
import {PageHeader} from "@/components/layout/PageHeader";
import {StatCard} from "@/components/layout/StatCard";
import {Button} from "@/components/ui/button";
import {useAuth} from "@/context/AuthContext";
import {useSystemStatus} from "@/context/SystemStatusContext";
import {cn, errorMessage, getRankPriority, getStaffCategory, isStaff} from "@/lib/utils";
import {CATEGORY_META, daysSince, downloadCsv, formatDate} from "./hr-utils";
import {useHrData, type HrMember} from "./useHrData";
import {RosterTable} from "./components/RosterTable";
import {MemberSheet} from "./components/MemberSheet";
import {RequestsPanel} from "./components/RequestsPanel";
import {HistoryFeed} from "./components/HistoryFeed";
import {StatsPanel} from "./components/StatsPanel";

type Tab = "roster" | "requests" | "history" | "stats";

export function HrPage() {
  const {profile} = useAuth();
  const {recruitmentOpen} = useSystemStatus();
  const {
    members: allMembers, loading, reload, updateMember, removeMember, pendingLeaveRequests, decideLeave,
    recordChanged, setMemberAwards, staff,
  } = useHrData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const tab = (["roster", "requests", "history", "stats"].includes(searchParams.get("tab") ?? "")
    ? searchParams.get("tab") : searchParams.get("tab") === "pending" ? "requests" : "roster") as Tab;
  const openMemberId = searchParams.get("member");

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
            onClick: () => void changeRank({...member, ...updated, awards: member.awards, leave: member.leave,
              onLeaveNow: member.onLeaveNow, warnings: member.warnings, lastSeen: member.lastSeen}, previousRank, {previousDate}),
          },
        });
      }
    } catch (error) {
      toast.error(errorMessage(error, "A rendfokozat módosítása nem sikerült."));
    } finally {
      setBusyId(null);
    }
  }, [busyId, updateMember]);

  const handleRemove = useCallback(async (member: HrMember) => {
    try {
      await removeMember(member.id);
      setParam("member", null);
      toast.success(`${member.full_name} elbocsátva.`);
    } catch (error) {
      toast.error(errorMessage(error, "Az elbocsátás nem sikerült."));
    }
  }, [removeMember, setParam]);

  const exportCsv = () => {
    const header = ["Jelvényszám", "Név", "Rendfokozat", "Szint", "Osztály", "Alosztály rang", "Képesítések",
      "Csatlakozott", "Utolsó előléptetés", "Rangon (nap)", "Szolgálat (nap)", "Kitüntetések", "Szabadság"];
    if (staff) header.push("Aktív figyelmeztetés", "Utoljára aktív");
    const rows = members.map((member) => {
      const row: (string | number)[] = [
        member.badge_number, member.full_name, member.faction_rank, CATEGORY_META[getStaffCategory(member.faction_rank)].label,
        member.division, member.division_rank ?? "", (member.qualifications ?? []).join(", "),
        formatDate(member.created_at), formatDate(member.last_promotion_date),
        daysSince(member.last_promotion_date ?? member.created_at) ?? "", daysSince(member.created_at) ?? "",
        member.awards.map((award) => award.name).join(", "),
        member.leave ? `${formatDate(member.leave.starts_on)} – ${formatDate(member.leave.ends_on)}` : "",
      ];
      if (staff) row.push(member.warnings, member.lastSeen ? formatDate(member.lastSeen) : "");
      return row;
    });
    downloadCsv(`sfsd-allomany-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows]);
  };

  if (!profile) return null;

  const onLeave = members.filter((member) => member.onLeaveNow).length;
  const leaders = members.filter((member) => ["executive", "command", "supervisory"].includes(getStaffCategory(member.faction_rank))).length;

  const tabs: {id: Tab; label: string; icon: typeof Users; count?: number; visible: boolean}[] = [
    {id: "roster", label: "Állomány", icon: Users, visible: true},
    {id: "requests", label: "Kérelmek", icon: Inbox, count: requestCount, visible: isStaff(profile)},
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
        <StatCard icon={Users} tone="gold" label="Aktív állomány" value={loading ? "…" : members.length}
                  hint={`${leaders} vezető beosztásban`}/>
        <StatCard icon={CalendarOff} tone="blue" label="Szabadságon" value={loading ? "…" : onLeave}/>
        <StatCard icon={UserPlus} tone="emerald" label="Jóváhagyásra vár" value={loading ? "…" : pending.length}
                  onClick={isStaff(profile) ? () => setParam("tab", "requests") : undefined}/>
        <StatCard icon={Inbox} tone="violet" label="Szabadságkérelem" value={loading ? "…" : pendingLeaveRequests.length}
                  hint={staff ? undefined : "Csak a vezetőség látja"}
                  onClick={isStaff(profile) ? () => setParam("tab", "requests") : undefined}/>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b">
        {tabs.filter((item) => item.visible).map((item) => (
          <button key={item.id} type="button" onClick={() => setParam("tab", item.id === "roster" ? null : item.id)}
                  className={cn(
                    "relative inline-flex h-10 items-center gap-2 px-3 text-sm font-medium whitespace-nowrap transition-colors",
                    tab === item.id ? "text-white" : "text-slate-400 hover:text-slate-200",
                  )}>
            <item.icon className="size-4"/>
            {item.label}
            {!!item.count && (
              <span className="rounded-full bg-primary/15 px-1.5 text-[11px] font-semibold text-primary tabular-nums">{item.count}</span>
            )}
            {tab === item.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary"/>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><Loader2 className="size-7 animate-spin text-primary/70"/></div>
      ) : tab === "requests" && isStaff(profile) ? (
        <RequestsPanel viewer={profile} pending={pending} members={members} leaveRequests={pendingLeaveRequests}
                       onApprove={updateMember} onReject={(member) => removeMember(member.id)} onDecideLeave={decideLeave}/>
      ) : tab === "history" ? (
        <HistoryFeed members={allMembers} onOpenMember={(member) => setParam("member", member.id)}/>
      ) : tab === "stats" ? (
        <StatsPanel members={members}/>
      ) : (
        <RosterTable members={members} viewer={profile} staff={staff} busyId={busyId}
                     onRankChange={(member, rank) => void changeRank(member, rank)}
                     onOpen={(member) => setParam("member", member.id)}/>
      )}

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
      />
    </div>
  );
}
