import {useCallback, useEffect, useMemo, useState} from "react";
import {toast} from "sonner";
import {useAuth} from "@/context/AuthContext";
import {postApi} from "@/lib/api";
import {invalidateProfileDirectory} from "@/lib/profile-directory";
import {errorMessage, getRankPriority, isStaff} from "@/lib/utils";
import {PROFILE_COLUMNS, type ActiveLeave, type HrRecord, type Profile} from "@/types/supabase";

export interface AwardSummary {
  id: string;
  ribbon_id: string;
  awarded_at: string | null;
  name: string;
  color_hex: string | null;
}

export interface HrMember extends Profile {
  awards: AwardSummary[];
  /** Current approved leave, or the next one within 30 days. */
  leave: ActiveLeave | null;
  onLeaveNow: boolean;
  /** Active warnings (staff only; 0 for others). */
  warnings: number;
  /** Last sign-in or session refresh (staff only). */
  lastSeen: string | null;
}

export interface MemberChanges {
  faction_rank?: string;
  full_name?: string;
  badge_number?: string;
  division?: string;
  division_rank?: string | null;
  qualifications?: string[];
  is_bureau_manager?: boolean;
  is_bureau_commander?: boolean;
  commanded_divisions?: string[];
  restore_promotion_date?: string;
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Everything the HR page needs, in parallel: the roster, awards, current leave, and for
 * staff the open records (warnings, leave requests) and last activity. One round of
 * requests per visit; changes update the local state instead of reloading.
 */
export function useHrData() {
  const {supabase, profile} = useAuth();
  const staff = isStaff(profile);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [awards, setAwards] = useState<Map<string, AwardSummary[]>>(new Map());
  const [leaves, setLeaves] = useState<ActiveLeave[]>([]);
  const [openRecords, setOpenRecords] = useState<HrRecord[]>([]);
  const [lastSeen, setLastSeen] = useState<Map<string, string | null>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [profileResult, awardResult, leaveResult, recordResult, seenResult] = await Promise.all([
      supabase.from("profiles").select(PROFILE_COLUMNS),
      supabase.from("user_ribbons").select("id, user_id, ribbon_id, awarded_at, ribbons(name, color_hex)"),
      supabase.rpc("get_active_leaves"),
      staff
        ? supabase.from("hr_records").select("*").in("status", ["pending", "active"]).in("kind", ["warning", "leave"])
        : Promise.resolve({data: [], error: null}),
      staff ? supabase.rpc("get_member_last_seen") : Promise.resolve({data: [], error: null}),
    ]);
    if (profileResult.error) toast.error("Az állomány betöltése nem sikerült.");
    else setProfiles((profileResult.data ?? []) as unknown as Profile[]);

    const awardMap = new Map<string, AwardSummary[]>();
    ((awardResult.data ?? []) as unknown as {id: string; user_id: string; ribbon_id: string; awarded_at: string | null;
      ribbons: {name: string; color_hex: string | null} | null}[]).forEach((row) => {
      const list = awardMap.get(row.user_id) ?? [];
      list.push({id: row.id, ribbon_id: row.ribbon_id, awarded_at: row.awarded_at, name: row.ribbons?.name ?? "Kitüntetés",
        color_hex: row.ribbons?.color_hex ?? null});
      awardMap.set(row.user_id, list);
    });
    setAwards(awardMap);
    setLeaves((leaveResult.data ?? []) as ActiveLeave[]);
    setOpenRecords((recordResult.data ?? []) as HrRecord[]);
    setLastSeen(new Map(((seenResult.data ?? []) as {user_id: string; last_seen_at: string | null}[])
      .map((row) => [row.user_id, row.last_seen_at])));
    setLoading(false);
  }, [supabase, staff]);

  useEffect(() => {
    void load();
  }, [load]);

  const members = useMemo<HrMember[]>(() => {
    const now = today();
    return profiles
      .map((member) => {
        const memberLeaves = leaves.filter((leave) => leave.user_id === member.id)
          .sort((a, b) => a.starts_on.localeCompare(b.starts_on));
        const current = memberLeaves.find((leave) => leave.starts_on <= now && leave.ends_on >= now) ?? null;
        return {
          ...member,
          awards: awards.get(member.id) ?? [],
          leave: current ?? memberLeaves[0] ?? null,
          onLeaveNow: !!current,
          warnings: openRecords.filter((record) => record.user_id === member.id && record.kind === "warning" && record.status === "active").length,
          lastSeen: lastSeen.get(member.id) ?? null,
        };
      })
      .sort((a, b) => getRankPriority(a.faction_rank) - getRankPriority(b.faction_rank)
        || a.badge_number.localeCompare(b.badge_number, "hu", {numeric: true}));
  }, [profiles, awards, leaves, openRecords, lastSeen]);

  const replaceProfile = useCallback((updated: Partial<Profile> & {id: string}) => {
    setProfiles((prev) => prev.map((member) => (member.id === updated.id ? {...member, ...updated} : member)));
    invalidateProfileDirectory();
  }, []);

  /** Applies HR changes through the API (which enforces shared/ranks.ts). */
  const updateMember = useCallback(async (memberId: string, changes: MemberChanges) => {
    const result = await postApi<{profile: Profile}>("/api/admin/update-role", {userId: memberId, ...changes});
    replaceProfile(result.profile);
    return result.profile;
  }, [replaceProfile]);

  const removeMember = useCallback(async (memberId: string) => {
    await postApi("/api/admin/delete-user", {userId: memberId});
    setProfiles((prev) => prev.filter((member) => member.id !== memberId));
    invalidateProfileDirectory();
  }, []);

  const pendingLeaveRequests = useMemo(
    () => openRecords.filter((record) => record.kind === "leave" && record.status === "pending"),
    [openRecords],
  );

  const decideLeave = useCallback(async (record: HrRecord, approve: boolean) => {
    const {error} = await supabase.from("hr_records").update({status: approve ? "active" : "rejected"}).eq("id", record.id);
    if (error) {
      toast.error("Hiba: " + errorMessage(error));
      return false;
    }
    setOpenRecords((prev) => approve
      ? prev.map((item) => (item.id === record.id ? {...item, status: "active"} : item))
      : prev.filter((item) => item.id !== record.id));
    if (approve && record.starts_on && record.ends_on) {
      setLeaves((prev) => [...prev, {user_id: record.user_id, starts_on: record.starts_on!, ends_on: record.ends_on!}]);
    }
    toast.success(approve ? "Szabadság jóváhagyva." : "Kérelem elutasítva.");
    return true;
  }, [supabase]);

  /** Keeps counters in sync after a record was added or changed in the member panel. */
  const recordChanged = useCallback((record: HrRecord) => {
    setOpenRecords((prev) => {
      const rest = prev.filter((item) => item.id !== record.id);
      const isOpen = ["pending", "active"].includes(record.status) && ["warning", "leave"].includes(record.kind);
      return isOpen ? [...rest, record] : rest;
    });
    if (record.kind === "leave" && record.status === "active" && record.starts_on && record.ends_on) {
      setLeaves((prev) => [...prev.filter((leave) => !(leave.user_id === record.user_id && leave.starts_on === record.starts_on)),
        {user_id: record.user_id, starts_on: record.starts_on!, ends_on: record.ends_on!}]);
    }
  }, []);

  const setMemberAwards = useCallback((memberId: string, list: AwardSummary[]) => {
    setAwards((prev) => new Map(prev).set(memberId, list));
  }, []);

  return {
    members, loading, reload: load, updateMember, removeMember, replaceProfile,
    pendingLeaveRequests, decideLeave, recordChanged, setMemberAwards, staff,
  };
}
