import {isExecutive} from "../../shared/ranks.js";
import {handle, HttpError, json, readJsonObject, requireUuid} from "../_lib/http.js";
import {findProfile, getSupabaseAdmin, notifyMembers, requireCaller} from "../_lib/supabase.js";

/** Executive Staff can force a new password on another member's account. */
export const POST = handle("admin/update-password", async (request) => {
  const caller = await requireCaller(request);
  const body = await readJsonObject(request);
  const targetUserId = requireUuid(body.targetUserId, "Hiányzó felhasználó azonosító.");
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (!isExecutive(caller)) throw new HttpError(403, "Csak az Executive Staff változtathat jelszót másoknak!");
  if (targetUserId === caller.id) throw new HttpError(400, "A saját jelszavadat a profil oldalon módosíthatod.");
  if (newPassword.length < 6 || newPassword.length > 72) {
    throw new HttpError(400, "A jelszónak 6 és 72 karakter közötti hosszúnak kell lennie.");
  }

  const target = await findProfile(targetUserId);
  if (!target) throw new HttpError(404, "A felhasználó nem található.");
  if (target.is_bureau_manager && !caller.is_bureau_manager) {
    throw new HttpError(403, "Bureau Manager jelszavát csak Bureau Manager módosíthatja.");
  }

  const {error} = await getSupabaseAdmin().auth.admin.updateUserById(targetUserId, {password: newPassword});
  if (error) {
    if (error.code === "weak_password") throw new HttpError(400, "A jelszó nem felel meg a biztonsági követelményeknek.");
    throw error;
  }

  await notifyMembers([targetUserId], {
    title: "Jelszó módosítva",
    message: `A jelszavadat ${caller.full_name} módosította. Ha nem tudtál róla, jelezd a vezetőségnek.`,
    type: "warning",
    category: "system",
    link: "/profile",
  }, caller.id);

  return json({success: true});
});
