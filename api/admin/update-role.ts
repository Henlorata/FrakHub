import {
  calculateSystemRole,
  canManageUserDivision,
  canManageUserQualification,
  canManageUserRank,
  getAllowedPromotionRanks,
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
  // The bureau manager is changed by bureau managers only. A bureau commander's rank, name and
  // badge follow the normal rank rules; their division, the units they lead and the leadership
  // flags stay with the bureau manager (checked per field below).
  if (target.is_bureau_manager && !isManager && Object.keys(body).some((key) => key !== "userId")) {
    throw new HttpError(403, "A Bureau Managert csak Bureau Manager módosíthatja.");
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

  // --- Division, bureau rank and titles (the bureau's own lists: division_ranks, division_titles) ---
  if (body.division !== undefined || body.division_rank !== undefined || body.division_titles !== undefined) {
    const division = body.division ?? target.division;
    if (!isDivision(division)) throw new HttpError(400, "Ismeretlen osztály.");
    const [ranks, titles] = await Promise.all([
      supabase.from("division_ranks").select("name").eq("division", division),
      supabase.from("division_titles").select("id").eq("division", division),
    ]);
    if (ranks.error) throw ranks.error;
    if (titles.error) throw titles.error;
    const rankNames = (ranks.data ?? []).map((row: {name: string}) => row.name);
    const titleIds = (titles.data ?? []).map((row: {id: string}) => row.id);
    const movesDivision = division !== target.division;

    const requestedRank: unknown = body.division_rank === undefined ? target.division_rank : body.division_rank;
    if (requestedRank !== null && requestedRank !== "" && typeof requestedRank !== "string") throw new HttpError(400, "Érvénytelen alosztály rang.");
    let divisionRank: string | null = requestedRank ? (requestedRank as string) : null;
    // Moving to another division without a new rank: a rank that does not exist there is dropped.
    if (movesDivision && body.division_rank === undefined && divisionRank && !rankNames.includes(divisionRank)) divisionRank = null;
    if (divisionRank !== null && !rankNames.includes(divisionRank)) throw new HttpError(400, "Érvénytelen alosztály rang.");

    const currentTitles = target.division_titles ?? [];
    let nextTitles: string[];
    if (body.division_titles === undefined) {
      nextTitles = currentTitles.filter((id) => titleIds.includes(id));
    } else {
      const requested = body.division_titles;
      if (!Array.isArray(requested) || !requested.every((id) => typeof id === "string" && titleIds.includes(id))) {
        throw new HttpError(400, "Érvénytelen cím: csak az osztály saját címei adhatók.");
      }
      nextTitles = [...new Set(requested as string[])];
    }

    const rankChanged = movesDivision || divisionRank !== (target.division_rank ?? null);
    const titlesChanged = !sameSet(nextTitles, currentTitles);
    if (rankChanged || titlesChanged) {
      if (!canManageUserDivision(caller, target)) throw new HttpError(403, "Nincs jogosultságod az osztály módosításához.");
      if (movesDivision) changes.division = division;
      if (rankChanged) changes.division_rank = divisionRank ?? "";
      if (titlesChanged) changes.division_titles = nextTitles;
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
