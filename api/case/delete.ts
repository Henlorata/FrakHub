import {destroyAssets, toOwnAssets} from "../_lib/cloudinary.js";
import {handle, HttpError, json, readJsonObject, requireUuid} from "../_lib/http.js";
import {getSupabaseAdmin, notifyMembers, requireCaller} from "../_lib/supabase.js";

const CHILD_TABLES = ["case_evidence", "case_notes", "case_suspects", "case_collaborators", "case_warrants"] as const;

/** Permanently deletes an MCB case with every attachment and related row. */
export const POST = handle("case/delete", async (request) => {
  const caller = await requireCaller(request);
  const body = await readJsonObject(request);
  const caseId = requireUuid(body.caseId, "Hiányzó akta azonosító.");
  const supabase = getSupabaseAdmin();

  const {data: caseRow, error: caseError} = await supabase
    .from("cases")
    .select("owner_id, case_number, title")
    .eq("id", caseId)
    .maybeSingle();
  if (caseError) throw caseError;
  if (!caseRow) throw new HttpError(404, "Az akta nem található.");

  const isOwner = caseRow.owner_id === caller.id;
  const isMcbCommander = caller.division === "MCB" && !!caller.is_bureau_commander;
  if (!isOwner && !caller.is_bureau_manager && !isMcbCommander) {
    throw new HttpError(403, "Nincs jogosultságod törölni ezt az aktát.");
  }

  // People to tell afterwards (read before the rows are gone).
  const {data: collaborators} = await supabase.from("case_collaborators").select("user_id").eq("case_id", caseId);
  const participants = [caseRow.owner_id as string | null, ...(collaborators ?? []).map((row) => row.user_id as string)];

  // 1. Attachments: Cloudinary assets and legacy Supabase Storage objects.
  const {data: evidence, error: evidenceError} = await supabase
    .from("case_evidence")
    .select("file_path")
    .eq("case_id", caseId);
  if (evidenceError) throw evidenceError;

  const filePaths: string[] = (evidence ?? []).map((row) => row.file_path).filter(Boolean);
  const {failed} = await destroyAssets(toOwnAssets(filePaths.filter((path) => path.startsWith("http"))));
  const storagePaths = filePaths.filter((path) => !path.startsWith("http"));
  if (storagePaths.length > 0) {
    const {error} = await supabase.storage.from("case_evidence").remove(storagePaths);
    if (error) console.error("[api/case/delete] storage clean-up failed", error);
  }

  // 2. Rows: children first, then the case itself.
  const childResults = await Promise.all(CHILD_TABLES.map((table) => supabase.from(table).delete().eq("case_id", caseId)));
  childResults.forEach(({error}, index) => {
    if (error) console.error(`[api/case/delete] deleting ${CHILD_TABLES[index]} failed`, error);
  });

  const {error: deleteError} = await supabase.from("cases").delete().eq("id", caseId);
  if (deleteError) throw deleteError;

  await notifyMembers(participants, {
    title: "Akta törölve",
    message: `${caseRow.case_number} – ${caseRow.title} (törölte: ${caller.full_name})`,
    type: "warning",
    category: "mcb",
    link: "/mcb",
  }, caller.id);

  return json({success: true, message: "Akta és minden adat véglegesen törölve.", failedAssets: failed.length});
});
