import {useEffect, useState} from "react";
import {supabase} from "./supabaseClient";
import {createVersionedLoader} from "./versioned-cache";
import {PROFILE_COLUMNS, type DepartmentDivision, type FactionRank, type Qualification, type SystemRole} from "@/types/supabase";

/**
 * The member list used by pickers, mentions, filters and the HR roster (the same columns as the
 * signed-in profile). Kept between visits and downloaded again only when a profile changed.
 */
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
  division_titles: string[] | null;
  avatar_url: string | null;
  system_role: SystemRole;
  onboarding_completed: boolean | null;
  created_at: string;
  last_promotion_date: string | null;
}

const directory = createVersionedLoader("directory", ["profiles"], async () => {
  const {data, error} = await supabase.from("profiles").select(PROFILE_COLUMNS).order("full_name");
  if (error) throw error;
  return (data ?? []) as unknown as DirectoryProfile[];
});

/** Every member (including pending registrations). */
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
