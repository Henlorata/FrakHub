import type {SupabaseClient} from "@supabase/supabase-js";
import {destroyAssets, toOwnAssets} from "./cloudinary.js";

const CHILD_TABLES = ["case_evidence", "case_notes", "case_suspects", "case_collaborators", "case_warrants"] as const;

/**
 * Deletes an MCB case for good: its Cloudinary files and legacy Storage objects, then its rows
 * (the remaining child tables cascade). Used for "delete now" from the trash and by the daily job
 * for cases that have been in the trash for 30 days.
 */
export async function purgeCase(supabase: SupabaseClient, caseId: string): Promise<{failedAssets: number}> {
  const {data: evidence, error: evidenceError} = await supabase.from("case_evidence").select("file_path").eq("case_id", caseId);
  if (evidenceError) throw evidenceError;

  const filePaths: string[] = (evidence ?? []).map((row) => row.file_path as string).filter(Boolean);
  const {failed} = await destroyAssets(toOwnAssets(filePaths.filter((path) => path.startsWith("http"))));
  const storagePaths = filePaths.filter((path) => !path.startsWith("http"));
  if (storagePaths.length > 0) {
    const {error} = await supabase.storage.from("case_evidence").remove(storagePaths);
    if (error) console.error("[case purge] storage clean-up failed", error);
  }

  const childResults = await Promise.all(CHILD_TABLES.map((table) => supabase.from(table).delete().eq("case_id", caseId)));
  childResults.forEach(({error}, index) => {
    if (error) console.error(`[case purge] deleting ${CHILD_TABLES[index]} failed`, error);
  });

  const {error: deleteError} = await supabase.from("cases").delete().eq("id", caseId);
  if (deleteError) throw deleteError;
  return {failedAssets: failed.length};
}
