import {isAcademyInstructor, isHighCommand} from "../shared/ranks.js";
import {destroyAssets, toOwnAssets} from "./_lib/cloudinary.js";
import {handle, HttpError, json, readJsonObject} from "./_lib/http.js";
import {getSupabaseAdmin, requireCaller} from "./_lib/supabase.js";

const MAX_URLS = 50;

/** Columns pointing at Cloudinary assets. A URL still referenced here is in use. */
const REFERENCES = [
  {table: "profiles", column: "avatar_url"},
  {table: "case_evidence", column: "file_path"},
  {table: "suspects", column: "mugshot_url"},
  {table: "ribbons", column: "image_url"},
  {table: "bolo_alerts", column: "image_url"},
  {table: "crime_organizations", column: "logo_url"},
  {table: "news_posts", column: "cover_url"},
] as const;

/** The front page's pictures (news text, gallery) are referenced from JSON: only their editors delete them. */
const SITE_FOLDERS = ["news/", "site/"];

/**
 * Deletes orphaned Cloudinary assets: replaced avatars, removed case evidence and
 * images dropped from Academy material. Clients send the stored URLs; the server
 * derives public ID and resource type, so raw documents are cleaned up as well.
 *
 * Assets still referenced by a record are never deleted, so this endpoint cannot
 * be abused to wipe someone else's avatar or evidence.
 */
export const POST = handle("delete-image", async (request) => {
  const caller = await requireCaller(request);
  const body = await readJsonObject(request);

  const urls = Array.isArray(body.urls) ? [...new Set(body.urls.filter((url) => typeof url === "string"))] : [];
  if (urls.length === 0) throw new HttpError(400, "Nincs megadva törlendő fájl.");
  if (urls.length > MAX_URLS) throw new HttpError(400, `Egyszerre legfeljebb ${MAX_URLS} fájl törölhető.`);

  const assets = toOwnAssets(urls as string[]);
  const academyAssets = assets.filter((asset) => asset.publicId.startsWith("academy/"));
  const otherAssets = assets.filter((asset) => !asset.publicId.startsWith("academy/"));

  if (academyAssets.length > 0 && !isAcademyInstructor(caller)) {
    throw new HttpError(403, "Tananyag képeit csak oktató törölheti.");
  }
  const siteEditor = !!caller.is_bureau_manager || isHighCommand(caller)
    || !!caller.qualifications?.includes("SIB") || !!caller.commanded_divisions?.includes("SIB");
  if (otherAssets.some((asset) => SITE_FOLDERS.some((folder) => asset.publicId.startsWith(folder))) && !siteEditor) {
    throw new HttpError(403, "A nyilvános oldal képeit csak a SIB és a vezetőség törölheti.");
  }

  const inUse = await findReferencedUrls(otherAssets.map((asset) => asset.url));
  const {deleted, failed} = await destroyAssets([
    ...academyAssets,
    ...otherAssets.filter((asset) => !inUse.has(asset.url)),
  ]);

  return json({success: failed.length === 0, deleted, failed, skipped: [...inUse]});
});

async function findReferencedUrls(urls: string[]): Promise<Set<string>> {
  if (urls.length === 0) return new Set();
  const supabase = getSupabaseAdmin();
  const results = await Promise.all(
    REFERENCES.map(({table, column}) => supabase.from(table).select(column).in(column, urls)),
  );

  const used = new Set<string>();
  results.forEach(({data, error}, index) => {
    // Fail closed: if a reference cannot be verified, nothing gets deleted.
    if (error) throw error;
    const column = REFERENCES[index].column;
    for (const row of (data ?? []) as Record<string, string | null>[]) {
      const value = row[column];
      if (value) used.add(value);
    }
  });
  return used;
}
