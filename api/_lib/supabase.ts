import {createClient, type SupabaseClient} from "@supabase/supabase-js";
import type {RankSubject, SystemRole} from "../../shared/ranks.js";
import {serverEnv} from "./env.js";
import {getBearerToken, HttpError} from "./http.js";

let adminClient: SupabaseClient | undefined;

/**
 * Service-role client: BYPASSES Row Level Security, so every endpoint must
 * authorize the caller itself (see `requireCaller`). Created lazily and reused
 * across warm invocations of the same function instance.
 */
export function getSupabaseAdmin(): SupabaseClient {
  adminClient ??= createClient(serverEnv.supabaseUrl(), serverEnv.supabaseSecretKey(), {
    auth: {autoRefreshToken: false, persistSession: false, detectSessionInUrl: false},
  });
  return adminClient;
}

/** Profile columns the permission rules (and HR updates) need. */
export const PERMISSION_COLUMNS =
  "id, full_name, badge_number, faction_rank, system_role, division, division_rank, qualifications, " +
  "is_bureau_manager, is_bureau_commander, commanded_divisions";

export interface PermissionProfile extends RankSubject {
  full_name: string;
  badge_number: string;
  division_rank: string | null;
  system_role: SystemRole;
}

/**
 * Verifies the bearer token of the request and loads the caller's profile.
 * Accounts still waiting for approval are rejected.
 */
export async function requireCaller(request: Request): Promise<PermissionProfile> {
  const token = getBearerToken(request);
  if (!token) throw new HttpError(401, "Hiányzó azonosító token. Jelentkezz be újra.");

  const supabase = getSupabaseAdmin();
  const {data, error} = await supabase.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Érvénytelen vagy lejárt munkamenet. Jelentkezz be újra.");

  const profile = await findProfile(data.user.id);
  if (!profile) throw new HttpError(403, "A felhasználói profilod nem található.");
  if (profile.system_role === "pending") throw new HttpError(403, "A fiókod még jóváhagyásra vár.");
  return profile;
}

export async function findProfile(userId: string): Promise<PermissionProfile | null> {
  const {data, error} = await getSupabaseAdmin()
    .from("profiles")
    .select(PERMISSION_COLUMNS)
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as PermissionProfile | null;
}

export const isStaffRole = (profile: PermissionProfile) =>
  profile.system_role === "admin" || profile.system_role === "supervisor" || !!profile.is_bureau_manager;

/**
 * Sends notifications from the API (database triggers cover everything that happens
 * through table changes). Best effort: a failed notification never fails the request.
 */
export async function notifyMembers(
  userIds: readonly (string | null | undefined)[],
  notification: {title: string; message: string; type?: "info" | "success" | "warning" | "alert"; category?: string; link?: string | null},
  actorId: string | null,
) {
  const recipients = [...new Set(userIds.filter((id): id is string => !!id && id !== actorId))];
  if (recipients.length === 0) return;
  const {error} = await getSupabaseAdmin().from("notifications").insert(
    recipients.map((user_id) => ({
      user_id,
      title: notification.title,
      message: notification.message,
      type: notification.type ?? "info",
      category: notification.category ?? "system",
      link: notification.link ?? null,
      actor_id: actorId,
    })),
  );
  if (error) console.error("[api] notification insert failed", error);
}
