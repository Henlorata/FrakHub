import {isDivision, isFactionRank} from "../shared/ranks.js";
import {handle, HttpError, json, readJsonObject} from "./_lib/http.js";
import {getSupabaseAdmin} from "./_lib/supabase.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGISTRATIONS_PER_HOUR = 20;

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/**
 * Public self-registration. Creates the auth user (pre-confirmed) and a `pending`
 * profile that HR has to approve before the account can use the hub.
 */
export const POST = handle("register", async (request) => {
  const body = await readJsonObject(request);
  const email = text(body.email).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const fullName = text(body.full_name).replace(/\s+/g, " ");
  const badgeNumber = text(body.badge_number);
  const factionRank = body.faction_rank;
  const division = body.division ?? "TSB";

  if (!email || !password || !fullName || !badgeNumber || !factionRank) {
    throw new HttpError(400, "Minden mező kitöltése kötelező (Név, Jelvény, Rang)!");
  }
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) throw new HttpError(400, "Érvénytelen email cím.");
  if (password.length < 6 || password.length > 72) {
    throw new HttpError(400, "A jelszónak 6 és 72 karakter közötti hosszúnak kell lennie.");
  }
  if (fullName.length < 3 || fullName.length > 64) throw new HttpError(400, "A név 3 és 64 karakter közötti lehet.");
  if (!/^\d{4}$/.test(badgeNumber)) {
    throw new HttpError(400, "A jelvényszámnak pontosan 4 számjegyűnek kell lennie (pl. 1192).");
  }
  if (!isFactionRank(factionRank)) throw new HttpError(400, "Ismeretlen rendfokozat.");
  if (!isDivision(division)) throw new HttpError(400, "Ismeretlen osztály.");

  const supabase = getSupabaseAdmin();

  // Flood protection: HR approves every account by hand, so a burst of registrations is
  // never legitimate. One cheap count instead of per-IP state the free tier cannot keep.
  const {count: recent, error: recentError} = await supabase
    .from("profiles")
    .select("id", {count: "exact", head: true})
    .eq("system_role", "pending")
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
  if (recentError) throw recentError;
  if ((recent ?? 0) >= REGISTRATIONS_PER_HOUR) {
    throw new HttpError(429, "Túl sok regisztráció érkezett az elmúlt órában. Próbáld újra később.");
  }

  const {data: existingBadge, error: badgeError} = await supabase
    .from("profiles")
    .select("id")
    .eq("badge_number", badgeNumber)
    .maybeSingle();
  if (badgeError) throw badgeError;
  if (existingBadge) throw new HttpError(409, "Ez a jelvényszám már regisztrálva van.");

  const {data: created, error: createError} = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {full_name: fullName},
  });
  if (createError) {
    if (createError.code === "email_exists" || /already (been )?registered|exists/i.test(createError.message)) {
      throw new HttpError(409, "Ez az email cím már regisztrálva van.");
    }
    if (createError.code === "weak_password") {
      throw new HttpError(400, "A jelszó nem felel meg a biztonsági követelményeknek.");
    }
    throw createError;
  }

  // The login e-mail lives in auth.users only; profiles are readable by every member.
  const {error: profileError} = await supabase.from("profiles").insert({
    id: created.user.id,
    full_name: fullName,
    badge_number: badgeNumber,
    faction_rank: factionRank,
    division,
    system_role: "pending",
  });
  if (profileError) {
    // Roll back, otherwise the email stays taken by an account without a profile.
    await supabase.auth.admin.deleteUser(created.user.id);
    if (profileError.code === "23505") throw new HttpError(409, "Ez a jelvényszám már regisztrálva van.");
    throw profileError;
  }

  return json({success: true, message: "Sikeres regisztráció! Várj a jóváhagyásra."}, 201);
});
