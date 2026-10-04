import {canManageUserRank} from "../../shared/ranks.js";
import {destroyAssets, toOwnAssets} from "../_lib/cloudinary.js";
import {handle, HttpError, json, readJsonObject, requireUuid} from "../_lib/http.js";
import {getSupabaseAdmin, isStaffRole, PERMISSION_COLUMNS, requireCaller, type PermissionProfile} from "../_lib/supabase.js";

/** Rejects a pending registration or dismisses (deletes) a member. */
export const POST = handle("admin/delete-user", async (request) => {
  const caller = await requireCaller(request);
  const body = await readJsonObject(request);
  const userId = requireUuid(body.userId, "Hiányzó felhasználó azonosító.");
  if (userId === caller.id) throw new HttpError(400, "A saját fiókodat nem törölheted.");

  const supabase = getSupabaseAdmin();
  const {data, error: fetchError} = await supabase
    .from("profiles")
    .select(`${PERMISSION_COLUMNS}, avatar_url`)
    .eq("id", userId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!data) throw new HttpError(404, "A felhasználó nem található.");
  const target = data as PermissionProfile & {avatar_url: string | null};

  const isManager = !!caller.is_bureau_manager;
  if (target.system_role === "pending") {
    if (!isManager && !isStaffRole(caller)) throw new HttpError(403, "Nincs jogosultságod elutasítani a regisztrációt.");
  } else if (!isManager && !(isStaffRole(caller) && canManageUserRank(caller, target))) {
    throw new HttpError(403, "Nincs jogosultságod elbocsátani ezt a felhasználót.");
  }

  const {error: deleteError} = await supabase.auth.admin.deleteUser(userId);
  if (deleteError) throw deleteError;

  // Best effort clean-up. The profile row normally cascades with the auth user;
  // the explicit delete covers schemas without that foreign key.
  const {error: profileError} = await supabase.from("profiles").delete().eq("id", userId);
  if (profileError) console.warn("[api/admin/delete-user] profile clean-up failed", profileError);
  if (target.avatar_url) await destroyAssets(toOwnAssets([target.avatar_url]));

  return json({success: true});
});
