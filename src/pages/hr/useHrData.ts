import {useCallback, useEffect, useMemo, useState} from "react";
import {toast} from "sonner";
import {useAuth} from "@/context/AuthContext";
import {postApi} from "@/lib/api";
import {getProfileDirectory, invalidateProfileDirectory} from "@/lib/profile-directory";
import {supabase as client} from "@/lib/supabaseClient";
import {createVersionedLoader, type VersionedLoader} from "@/lib/versioned-cache";
import {errorMessage, getRankPriority, isStaff} from "@/lib/utils";
import {recentMonths} from "@/lib/registry";
import {
  type ActiveLeave, type DutyTimeEntry, type HrRecord, type HrRegistry, type MemberDetails, type Profile, type RegistryVehicle,
} from "@/types/supabase";
import {addDaysKey, todayKey} from "@/lib/datetime";

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
  /** Sheet-era HR data (station, parking, joining, recruiter, activity). */
  details: MemberDetails | null;
  /** Duty time of the last six months. */
  duty: DutyTimeEntry[];
  /** Duty time of the previous (closed) month, in minutes. */
  dutyLastMonth: number | null;
  /** Vehicles the member holds a key of. */
  vehicles: RegistryVehicle[];
  /** Active vehicle warnings (staff, or the member's own). */
  vehicleWarnings: number;
  /** Bank account number (staff only). */
  bankAccount: string | null;
}

export type DetailsPatch = Partial<Omit<MemberDetails, "user_id" | "updated_at" | "updated_by">>;

export interface MemberChanges {
  faction_rank?: string;
  full_name?: string;
  badge_number?: string;
  division?: string;
  division_rank?: string | null;
  /** Ids of the division's titles (division_titles). */
  division_titles?: string[];
  qualifications?: string[];
  is_bureau_manager?: boolean;
  is_bureau_commander?: boolean;
  commanded_divisions?: string[];
  restore_promotion_date?: string;
}

const today = () => todayKey();

// --- Lists kept between visits (egress): downloaded again only when their tables change ------

interface AwardRow {
  id: string;
  user_id: string;
  ribbon_id: string;
  awarded_at: string | null;
  ribbons: {name: string; color_hex: string | null} | null;
}

const awardsLoader = createVersionedLoader("hr-awards", ["ribbons"], async () => {
  const {data, error} = await client.from("user_ribbons").select("id, user_id, ribbon_id, awarded_at, ribbons(name, color_hex)");
  if (error) throw error;
  return (data ?? []) as unknown as AwardRow[];
});

const leavesLoader = createVersionedLoader("hr-leaves", ["hr_records"], async () => {
  const {data, error} = await client.rpc("get_active_leaves");
  if (error) throw error;
  return (data ?? []) as ActiveLeave[];
});

/** The registry without the bank accounts (those are never stored in the browser). */
type StoredRegistry = Omit<HrRegistry, "bank_accounts">;

const registryLoaders = new Map<string, VersionedLoader<StoredRegistry>>();
const registryLoader = (since: string) => {
  let loader = registryLoaders.get(since);
  if (!loader) {
    loader = createVersionedLoader(`hr-registry:${since}`, ["registry", "fleet"], async () => {
      // Details, six months of duty time, fleet and vehicle warnings in one request.
      const {data, error} = await client.rpc("get_hr_registry", {_since: since});
      if (error) throw error;
      const {bank_accounts: _accounts, ...rest} = (data ?? {}) as HrRegistry;
      return {details: rest.details ?? [], duty: rest.duty ?? [], vehicles: rest.vehicles ?? [], vehicle_warnings: rest.vehicle_warnings ?? []};
    });
    registryLoaders.set(since, loader);
  }
  return loader;
};

/** After a change of the registry (details, duty time, bank account): the next visit loads it again. */
export const invalidateHrRegistry = () => registryLoaders.forEach((loader) => loader.invalidate());

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
  const [registry, setRegistry] = useState<HrRegistry>({details: [], duty: [], vehicles: [], vehicle_warnings: [], bank_accounts: []});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const since = recentMonths(6)[0];
    const [profileResult, awardResult, leaveResult, recordResult, seenResult, registryResult, bankResult] = await Promise.all([
      getProfileDirectory().then((data) => ({data, error: null}), (error: unknown) => ({data: null, error})),
      awardsLoader.get().catch(() => [] as AwardRow[]),
      leavesLoader.get().catch(() => [] as ActiveLeave[]),
      staff
        ? supabase.from("hr_records").select("*").in("status", ["pending", "active"]).in("kind", ["warning", "leave"])
        : Promise.resolve({data: [], error: null}),
      staff ? supabase.rpc("get_member_last_seen") : Promise.resolve({data: [], error: null}),
      registryLoader(since).get().catch(() => null),
      // Bank accounts: staff only, never kept in the browser.
      staff ? supabase.from("member_bank_accounts").select("user_id, account_number") : Promise.resolve({data: [], error: null}),
    ]);
    if (profileResult.error) toast.error("Az állomány betöltése nem sikerült.");
    else setProfiles((profileResult.data ?? []) as unknown as Profile[]);

    const awardMap = new Map<string, AwardSummary[]>();
    awardResult.forEach((row) => {
      const list = awardMap.get(row.user_id) ?? [];
      list.push({id: row.id, ribbon_id: row.ribbon_id, awarded_at: row.awarded_at, name: row.ribbons?.name ?? "Kitüntetés",
        color_hex: row.ribbons?.color_hex ?? null});
      awardMap.set(row.user_id, list);
    });
    setAwards(awardMap);
    setLeaves(leaveResult);
    setOpenRecords((recordResult.data ?? []) as HrRecord[]);
    setLastSeen(new Map(((seenResult.data ?? []) as {user_id: string; last_seen_at: string | null}[])
      .map((row) => [row.user_id, row.last_seen_at])));
    if (registryResult) {
      setRegistry({...registryResult, bank_accounts: (bankResult.data ?? []) as HrRegistry["bank_accounts"]});
    }
    setLoading(false);
  }, [supabase, staff]);

  useEffect(() => {
    void load();
  }, [load]);

  const members = useMemo<HrMember[]>(() => {
    const now = today();
    const soon = addDaysKey(now, 30);
    const lastMonth = recentMonths(2)[0];
    const details = new Map(registry.details.map((row) => [row.user_id, row]));
    const accounts = new Map(registry.bank_accounts.map((row) => [row.user_id, row.account_number]));
    return profiles
      .map((member) => {
        // The stored list holds every approved leave not yet over at the time it was read: the dates
        // are compared here, so it stays right while it is reused.
        const memberLeaves = leaves.filter((leave) => leave.user_id === member.id && leave.ends_on >= now && leave.starts_on <= soon)
          .sort((a, b) => a.starts_on.localeCompare(b.starts_on));
        const current = memberLeaves.find((leave) => leave.starts_on <= now && leave.ends_on >= now) ?? null;
        return {
          ...member,
          awards: awards.get(member.id) ?? [],
          leave: current ?? memberLeaves[0] ?? null,
          onLeaveNow: !!current,
          warnings: openRecords.filter((record) => record.user_id === member.id && record.kind === "warning" && record.status === "active").length,
          lastSeen: lastSeen.get(member.id) ?? null,
          details: details.get(member.id) ?? null,
          duty: registry.duty.filter((entry) => entry.user_id === member.id),
          dutyLastMonth: registry.duty.find((entry) => entry.user_id === member.id && entry.month.slice(0, 10) === lastMonth)?.minutes ?? null,
          vehicles: registry.vehicles.filter((vehicle) => vehicle.holder_ids.includes(member.id)),
          vehicleWarnings: registry.vehicle_warnings.filter((warning) => warning.user_id === member.id
            && !warning.revoked_at && !warning.converted_record_id).length,
          bankAccount: accounts.get(member.id) ?? null,
        };
      })
      .sort((a, b) => getRankPriority(a.faction_rank) - getRankPriority(b.faction_rank)
        || a.badge_number.localeCompare(b.badge_number, "hu", {numeric: true}));
  }, [profiles, awards, leaves, openRecords, lastSeen, registry]);

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

  /** Saves sheet-era details (station, parking, ...): RLS lets staff above the member write. */
  const saveDetails = useCallback(async (memberId: string, patch: DetailsPatch) => {
    const {data, error} = await supabase.from("member_details").upsert({user_id: memberId, ...patch}).select("*").single();
    if (error) throw error;
    invalidateHrRegistry();
    setRegistry((prev) => ({...prev, details: [...prev.details.filter((row) => row.user_id !== memberId), data as MemberDetails]}));
  }, [supabase]);

  const saveBankAccount = useCallback(async (memberId: string, accountNumber: string | null) => {
    const {error} = accountNumber
      ? await supabase.from("member_bank_accounts").upsert({user_id: memberId, account_number: accountNumber})
      : await supabase.from("member_bank_accounts").delete().eq("user_id", memberId);
    if (error) throw error;
    invalidateHrRegistry();
    setRegistry((prev) => ({
      ...prev,
      bank_accounts: [...prev.bank_accounts.filter((row) => row.user_id !== memberId),
        ...(accountNumber ? [{user_id: memberId, account_number: accountNumber}] : [])],
    }));
  }, [supabase]);

  /** Batch save of the duty time sheet: one upsert and at most one delete. */
  const saveDuty = useCallback(async (changes: {user_id: string; month: string; minutes: number | null}[]) => {
    const upserts = changes.filter((change) => change.minutes !== null) as DutyTimeEntry[];
    const removals = changes.filter((change) => change.minutes === null);
    if (upserts.length) {
      const {error} = await supabase.from("duty_time_entries").upsert(upserts.map(({user_id, month, minutes}) => ({user_id, month, minutes})));
      if (error) throw error;
    }
    // Deletions are grouped per month (usually a single month is edited at a time).
    for (const month of [...new Set(removals.map((change) => change.month))]) {
      const ids = removals.filter((change) => change.month === month).map((change) => change.user_id);
      const {error} = await supabase.from("duty_time_entries").delete().eq("month", month).in("user_id", ids);
      if (error) throw error;
    }
    invalidateHrRegistry();
    setRegistry((prev) => {
      const key = (entry: {user_id: string; month: string}) => `${entry.user_id}|${entry.month.slice(0, 10)}`;
      const changed = new Set(changes.map(key));
      return {...prev, duty: [...prev.duty.filter((entry) => !changed.has(key(entry))), ...upserts]};
    });
  }, [supabase]);

  const removeMember = useCallback(async (memberId: string, departure?: Record<string, string | null>) => {
    await postApi("/api/admin/delete-user", {userId: memberId, ...departure});
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
    leavesLoader.invalidate();
    if (approve && record.starts_on && record.ends_on) {
      setLeaves((prev) => [...prev, {user_id: record.user_id, starts_on: record.starts_on!, ends_on: record.ends_on!}]);
    }
    toast.success(approve ? "Szabadság jóváhagyva." : "Kérelem elutasítva.");
    return true;
  }, [supabase]);

  /** Keeps counters in sync after a record was added or changed in the member panel. */
  const recordChanged = useCallback((record: HrRecord) => {
    leavesLoader.invalidate();
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
    awardsLoader.invalidate();
    setAwards((prev) => new Map(prev).set(memberId, list));
  }, []);

  return {
    members, loading, reload: load, updateMember, removeMember, replaceProfile,
    pendingLeaveRequests, decideLeave, recordChanged, setMemberAwards, staff,
    saveDetails, saveBankAccount, saveDuty,
  };
}
