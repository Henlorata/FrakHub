import {canManageUserRank} from "../../shared/ranks.js";
import {destroyAssets, toOwnAssets} from "../_lib/cloudinary.js";
import {handle, HttpError, json, readJsonObject, requireUuid} from "../_lib/http.js";
import {getSupabaseAdmin, isStaffRole, PERMISSION_COLUMNS, requireCaller, type PermissionProfile} from "../_lib/supabase.js";

const LEAVE_TYPES = ["resigned", "dismissed", "inactivity", "transferred", "other"] as const;
const REHIRE = ["eligible", "conditional", "not_eligible"] as const;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const text = (value: unknown, max: number) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

/**
 * Rejects a pending registration or removes a member. Members are archived in
 * `former_members` first (when, why, may they come back), so the HR history survives
 * the deletion of the account.
 */
export const POST = handle("admin/delete-user", async (request) => {
  const caller = await requireCaller(request);
  const body = await readJsonObject(request);
  const userId = requireUuid(body.userId, "Hiányzó felhasználó azonosító.");
  if (userId === caller.id) throw new HttpError(400, "A saját fiókodat nem törölheted.");

  const supabase = getSupabaseAdmin();
  const {data, error: fetchError} = await supabase
    .from("profiles")
    .select(`${PERMISSION_COLUMNS}, avatar_url, created_at`)
    .eq("id", userId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!data) throw new HttpError(404, "A felhasználó nem található.");
  const target = data as PermissionProfile & {avatar_url: string | null; created_at: string};

  const isManager = !!caller.is_bureau_manager;
  const isPending = target.system_role === "pending";
  if (isPending) {
    if (!isManager && !isStaffRole(caller)) throw new HttpError(403, "Nincs jogosultságod elutasítani a regisztrációt.");
  } else if (!isManager && !(isStaffRole(caller) && canManageUserRank(caller, target))) {
    throw new HttpError(403, "Nincs jogosultságod elbocsátani ezt a felhasználót.");
  }

  let archiveId: string | null = null;
  if (!isPending) {
    const leaveType = body.leave_type ?? "dismissed";
    const rehire = body.rehire ?? "eligible";
    if (!LEAVE_TYPES.includes(leaveType as never)) throw new HttpError(400, "Ismeretlen távozási mód.");
    if (!REHIRE.includes(rehire as never)) throw new HttpError(400, "Ismeretlen visszavételi státusz.");
    const today = new Date().toISOString().slice(0, 10);
    const leftOn = typeof body.left_on === "string" && DATE_PATTERN.test(body.left_on) && body.left_on <= today
      ? body.left_on : today;

    const {data: details} = await supabase
      .from("member_details").select("joined_on").eq("user_id", userId).maybeSingle();
    const joinedOn = (details as {joined_on: string | null} | null)?.joined_on ?? target.created_at.slice(0, 10);

    const {data: archived, error: archiveError} = await supabase.from("former_members").insert({
      profile_id: userId,
      full_name: target.full_name,
      badge_number: target.badge_number,
      faction_rank: target.faction_rank,
      division: target.division,
      joined_on: joinedOn <= leftOn ? joinedOn : null,
      left_on: leftOn,
      leave_type: leaveType,
      reason: text(body.reason, 1000),
      rehire,
      rehire_note: text(body.rehire_note, 500),
      recorded_by: caller.id,
    }).select("id").single();
    // Never lose the record silently: without the archive entry the member stays.
    if (archiveError) throw archiveError;
    archiveId = (archived as {id: string}).id;
  }

  const {error: deleteError} = await supabase.auth.admin.deleteUser(userId);
  if (deleteError) {
    if (archiveId) await supabase.from("former_members").delete().eq("id", archiveId);
    throw deleteError;
  }

  // Best effort clean-up. The profile row normally cascades with the auth user;
  // the explicit delete covers schemas without that foreign key.
  const {error: profileError} = await supabase.from("profiles").delete().eq("id", userId);
  if (profileError) console.warn("[api/admin/delete-user] profile clean-up failed", profileError);
  if (target.avatar_url) await destroyAssets(toOwnAssets([target.avatar_url]));

  return json({success: true});
});
