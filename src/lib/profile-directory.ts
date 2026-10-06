import {useEffect, useState} from "react";
import {createCachedLoader} from "./cache";
import {supabase} from "./supabaseClient";
import type {DepartmentDivision, FactionRank, Qualification, SystemRole} from "@/types/supabase";

/** The lightweight member list used by pickers, mentions and filters. */
export interface DirectoryProfile {
  id: string;
  full_name: string;
  badge_number: string;
  faction_rank: FactionRank;
  division: DepartmentDivision;
  division_rank: string | null;
  qualifications: Qualification[] | null;
  commanded_divisions: Qualification[] | null;
  is_bureau_commander: boolean | null;
  is_bureau_manager: boolean | null;
  avatar_url: string | null;
  system_role: SystemRole;
}

const directory = createCachedLoader(async () => {
  const {data, error} = await supabase
    .from("profiles")
    .select("id, full_name, badge_number, faction_rank, division, division_rank, qualifications, commanded_divisions, "
      + "is_bureau_commander, is_bureau_manager, avatar_url, system_role")
    .order("full_name");
  if (error) throw error;
  return (data ?? []) as unknown as DirectoryProfile[];
}, 5 * 60 * 1000);

/** Every member (including pending registrations), cached for five minutes. */
export const getProfileDirectory = (force = false) => directory.get(force);

/** Call after HR changes so pickers pick up the new data immediately. */
export const invalidateProfileDirectory = () => directory.invalidate();

export function useProfileDirectory() {
  const [profiles, setProfiles] = useState<DirectoryProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getProfileDirectory()
      .then((list) => {
        if (active) setProfiles(list);
      })
      .catch((error) => console.error("Profile directory error:", error))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return {profiles, loading};
}
