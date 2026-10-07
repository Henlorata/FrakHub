import {isExecutive} from "../../shared/ranks.js";
import {handle, HttpError, json, readJsonObject, requireUuid} from "../_lib/http.js";
import {findProfile, getSupabaseAdmin, notifyMembers, requireCaller} from "../_lib/supabase.js";

/**
 * Executive Staff can force a new password on another member's account, or (`resetMfa`) switch off
 * the member's two-factor sign-in when the phone with the authenticator app is lost.
 */
export const POST = handle("admin/update-password", async (request) => {
  const caller = await requireCaller(request);
  const body = await readJsonObject(request);
  const targetUserId = requireUuid(body.targetUserId, "Hiányzó felhasználó azonosító.");
  const resetMfa = body.resetMfa === true;
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (!isExecutive(caller)) {
    throw new HttpError(403, resetMfa
      ? "Csak az Executive Staff kapcsolhatja ki mások kétlépcsős azonosítását!"
      : "Csak az Executive Staff változtathat jelszót másoknak!");
  }
  if (targetUserId === caller.id) {
    throw new HttpError(400, resetMfa
      ? "A saját kétlépcsős azonosításodat a profil oldalon kapcsolhatod ki."
      : "A saját jelszavadat a profil oldalon módosíthatod.");
  }
  if (!resetMfa && (newPassword.length < 6 || newPassword.length > 72)) {
    throw new HttpError(400, "A jelszónak 6 és 72 karakter közötti hosszúnak kell lennie.");
  }

  const target = await findProfile(targetUserId);
  if (!target) throw new HttpError(404, "A felhasználó nem található.");
  if (target.is_bureau_manager && !caller.is_bureau_manager) {
    throw new HttpError(403, resetMfa
      ? "Bureau Manager belépési beállításait csak Bureau Manager módosíthatja."
      : "Bureau Manager jelszavát csak Bureau Manager módosíthatja.");
  }

  const admin = getSupabaseAdmin();
  if (resetMfa) {
    const {data, error} = await admin.auth.admin.mfa.listFactors({userId: targetUserId});
    if (error) throw error;
    for (const factor of data.factors) {
      const {error: deleteError} = await admin.auth.admin.mfa.deleteFactor({id: factor.id, userId: targetUserId});
      if (deleteError) throw deleteError;
    }
    const removed = data.factors.filter((factor) => factor.status === "verified").length;
    if (removed > 0) {
      await notifyMembers([targetUserId], {
        title: "Kétlépcsős azonosítás kikapcsolva",
        message: `A kétlépcsős azonosításodat ${caller.full_name} kikapcsolta. A profilod Fiók lapján újra bekapcsolhatod; ha nem te kérted, jelezd a vezetőségnek.`,
        type: "warning",
        category: "system",
        link: "/profile?tab=settings",
      }, caller.id);
    }
    return json({success: true, removed});
  }

  const {error} = await admin.auth.admin.updateUserById(targetUserId, {password: newPassword});
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
