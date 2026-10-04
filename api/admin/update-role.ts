import {
  calculateSystemRole,
  canManageUserDivision,
  canManageUserQualification,
  canManageUserRank,
  getAllowedPromotionRanks,
  getDivisionRanks,
  isDivision,
  isFactionRank,
  isQualification,
  QUALIFICATIONS,
  type FactionRank,
} from "../../shared/ranks.js";
import {handle, HttpError, json, readJsonObject, requireUuid} from "../_lib/http.js";
import {findProfile, getSupabaseAdmin, isStaffRole, PERMISSION_COLUMNS, requireCaller} from "../_lib/supabase.js";

const MANAGER_ONLY_FIELDS = ["is_bureau_manager", "is_bureau_commander", "commanded_divisions"] as const;

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((value) => b.includes(value));

/**
 * Every HR change of a member: approving a registration, rank changes (system_role
 * always follows the rank), name, badge, division, bureau rank, qualifications and
 * bureau-level appointments.
 *
 * The same rules as the HR page (`shared/ranks.ts`) are enforced here, because the
 * service-role client bypasses Row Level Security. The change is applied through
 * `hr_apply_member_update`, which records the caller as the actor so the database
 * triggers can write the member history and notify the member.
 */
export const POST = handle("admin/update-role", async (request) => {
  const caller = await requireCaller(request);
  const body = await readJsonObject(request);
  const userId = requireUuid(body.userId, "Hiányzó felhasználó azonosító.");

  const target = await findProfile(userId);
  if (!target) throw new HttpError(404, "A felhasználó nem található.");

  const isManager = !!caller.is_bureau_manager;
  if (caller.id === target.id && !isManager) {
    throw new HttpError(403, "A saját rendfokozatodat és jogosultságaidat nem módosíthatod.");
  }
  if ((target.is_bureau_manager || target.is_bureau_commander) && !isManager &&
      Object.keys(body).some((key) => key !== "userId")) {
    throw new HttpError(403, "A Bureau vezetőségét csak a Bureau Manager módosíthatja.");
  }

  const changes: Record<string, unknown> = {};
  const isPending = target.system_role === "pending";
  const allowedRanks: string[] = getAllowedPromotionRanks(caller);
  const canAssign = (rank: string) => isManager || allowedRanks.includes(rank);

  // --- Rank (and approval) ---
  const requestedRank = body.faction_rank;
  if (requestedRank !== undefined && !isFactionRank(requestedRank)) throw new HttpError(400, "Ismeretlen rendfokozat.");
  const nextRank = (requestedRank ?? target.faction_rank) as FactionRank;

  if (isPending) {
    if (!isStaffRole(caller)) throw new HttpError(403, "Nincs jogosultságod fiókot jóváhagyni.");
    if (!canAssign(nextRank)) {
      throw new HttpError(403, `Nincs jogosultságod ${nextRank} rendfokozattal jóváhagyni a fiókot.`);
    }
    changes.system_role = calculateSystemRole(nextRank);
    if (nextRank !== target.faction_rank) changes.faction_rank = nextRank;
    changes.last_promotion_date = new Date().toISOString();
  } else if (requestedRank !== undefined && requestedRank !== target.faction_rank) {
    if (!canManageUserRank(caller, target)) {
      throw new HttpError(403, "Nincs jogosultságod módosítani a felhasználó rendfokozatát.");
    }
    if (!canAssign(nextRank)) throw new HttpError(403, `Nincs jogosultságod kiosztani a(z) ${nextRank} rangot.`);
    changes.faction_rank = nextRank;
    // Undo on the HR page restores the previous promotion date instead of "now".
    const restored = typeof body.restore_promotion_date === "string" ? new Date(body.restore_promotion_date) : null;
    changes.last_promotion_date = restored && !Number.isNaN(restored.getTime()) && restored.getTime() <= Date.now()
      ? restored.toISOString()
      : new Date().toISOString();
  }
  // The website permission level always follows the faction rank.
  if (!isPending && target.system_role !== calculateSystemRole(nextRank)) changes.system_role = calculateSystemRole(nextRank);

  // --- Name and badge (same right as the rank) ---
  const supabase = getSupabaseAdmin();
  if (body.full_name !== undefined || body.badge_number !== undefined) {
    const fullName = typeof body.full_name === "string" ? body.full_name.trim().replace(/\s+/g, " ") : target.full_name;
    const badge = typeof body.badge_number === "string" ? body.badge_number.trim() : target.badge_number;
    if (fullName !== target.full_name || badge !== target.badge_number) {
      if (!isPending && !canManageUserRank(caller, target)) {
        throw new HttpError(403, "Nincs jogosultságod a név vagy a jelvényszám módosításához.");
      }
      if (fullName.length < 3 || fullName.length > 64) throw new HttpError(400, "A név 3 és 64 karakter közötti lehet.");
      if (!/^\d{4}$/.test(badge)) throw new HttpError(400, "A jelvényszám pontosan 4 számjegy.");
      if (badge !== target.badge_number) {
        const {data: taken, error} = await supabase.from("profiles").select("id").eq("badge_number", badge).neq("id", userId).limit(1);
        if (error) throw error;
        if (taken && taken.length > 0) throw new HttpError(409, "Ez a jelvényszám már foglalt.");
        changes.badge_number = badge;
      }
      if (fullName !== target.full_name) changes.full_name = fullName;
    }
  }

  // --- Division and bureau rank ---
  if (body.division !== undefined || body.division_rank !== undefined) {
    const division = body.division ?? target.division;
    if (!isDivision(division)) throw new HttpError(400, "Ismeretlen osztály.");
    let divisionRank = body.division_rank === undefined ? target.division_rank : body.division_rank;
    if (divisionRank === "" || division === "TSB") divisionRank = null;
    if (divisionRank !== null && (typeof divisionRank !== "string" || !getDivisionRanks(division).includes(divisionRank))) {
      throw new HttpError(400, "Érvénytelen alosztály rang.");
    }
    if (division !== target.division || divisionRank !== (target.division_rank ?? null)) {
      if (!canManageUserDivision(caller, target)) throw new HttpError(403, "Nincs jogosultságod az osztály módosításához.");
      if (division !== target.division) changes.division = division;
      changes.division_rank = divisionRank ?? "";
    }
  }

  // --- Qualifications: every added or removed one is checked separately ---
  if (body.qualifications !== undefined) {
    const requested = body.qualifications;
    if (!Array.isArray(requested) || !requested.every(isQualification)) throw new HttpError(400, "Érvénytelen képesítés lista.");
    const current = (target.qualifications ?? []) as string[];
    const next = QUALIFICATIONS.filter((q) => requested.includes(q));
    const changed = QUALIFICATIONS.filter((q) => next.includes(q) !== current.includes(q));
    const forbidden = changed.find((q) => !canManageUserQualification(caller, target, q));
    if (forbidden) throw new HttpError(403, `Nincs jogosultságod a(z) ${forbidden} képesítés módosításához.`);
    if (changed.length > 0) changes.qualifications = next;
  }

  // --- Bureau-level appointments (bureau manager only) ---
  if (MANAGER_ONLY_FIELDS.some((field) => body[field] !== undefined)) {
    if (!isManager) throw new HttpError(403, "Vezetői kinevezéseket csak Bureau Manager módosíthat.");
    for (const flag of ["is_bureau_manager", "is_bureau_commander"] as const) {
      if (body[flag] === undefined) continue;
      if (typeof body[flag] !== "boolean") throw new HttpError(400, "Érvénytelen vezetői kinevezés.");
      if (body[flag] !== !!target[flag]) changes[flag] = body[flag];
    }
    if (body.commanded_divisions !== undefined) {
      const divisions = body.commanded_divisions;
      if (!Array.isArray(divisions) || !divisions.every(isQualification)) {
        throw new HttpError(400, "Érvénytelen alosztály lista.");
      }
      const next = [...new Set(divisions)];
      if (!sameSet(next, (target.commanded_divisions ?? []) as string[])) changes.commanded_divisions = next;
    }
  }

  if (Object.keys(changes).length > 0) {
    const {error} = await supabase.rpc("hr_apply_member_update", {_actor: caller.id, _target: userId, _changes: changes});
    if (error) throw error;
  }

  const {data: updated, error: readError} = await supabase
    .from("profiles")
    .select(`${PERMISSION_COLUMNS}, avatar_url, created_at, last_promotion_date`)
    .eq("id", userId)
    .single();
  if (readError) throw readError;

  return json({success: true, changed: Object.keys(changes), profile: updated});
});
