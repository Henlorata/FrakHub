import {purgeCase} from "../_lib/cases.js";
import {handle, HttpError, json, readJsonObject, requireUuid} from "../_lib/http.js";
import {getSupabaseAdmin, notifyMembers, requireCaller} from "../_lib/supabase.js";

/**
 * Deletes a trashed MCB case for good, with every attachment and related row ("Végleges törlés"
 * in the trash). A case is put into the trash first (trash_case); the daily job deletes what has
 * been there for 30 days.
 */
export const POST = handle("case/delete", async (request) => {
  const caller = await requireCaller(request);
  const body = await readJsonObject(request);
  const caseId = requireUuid(body.caseId, "Hiányzó akta azonosító.");
  const supabase = getSupabaseAdmin();

  const {data: caseRow, error: caseError} = await supabase
    .from("cases")
    .select("owner_id, case_number, title, deleted_at")
    .eq("id", caseId)
    .maybeSingle();
  if (caseError) throw caseError;
  if (!caseRow) throw new HttpError(404, "Az akta nem található.");

  const isOwner = caseRow.owner_id === caller.id;
  const isMcbCommander = caller.division === "MCB" && !!caller.is_bureau_commander;
  if (!isOwner && !caller.is_bureau_manager && !isMcbCommander) {
    throw new HttpError(403, "Nincs jogosultságod törölni ezt az aktát.");
  }
  if (!caseRow.deleted_at) throw new HttpError(409, "Véglegesen csak a lomtárban lévő akta törölhető.");

  // People to tell afterwards (read before the rows are gone).
  const {data: collaborators} = await supabase.from("case_collaborators").select("user_id").eq("case_id", caseId);
  const participants = [caseRow.owner_id as string | null, ...(collaborators ?? []).map((row) => row.user_id as string)];

  const {failedAssets} = await purgeCase(supabase, caseId);

  await notifyMembers(participants, {
    title: "Akta véglegesen törölve",
    message: `${caseRow.case_number} – ${caseRow.title} (törölte: ${caller.full_name})`,
    type: "warning",
    category: "mcb",
    link: "/mcb",
  }, caller.id);

  return json({success: true, message: "Akta és minden adat véglegesen törölve.", failedAssets});
});
