/**
 * Counts the app's own writes, so the version check of the stored lists (versioned-cache.ts)
 * asks the database again right after a change instead of trusting its short memo. Kept free of
 * imports: the Supabase client reports its requests here.
 */

let epoch = 0;

export const cacheEpoch = () => epoch;

/** After a write: the next cache check fetches fresh versions. */
export function bumpCacheEpoch() {
  epoch += 1;
}

/** Reads: plain GET/HEAD requests and the read RPCs (get_*, search_*, verify_*). */
const READ_RPC = /\/rest\/v1\/rpc\/(get_|search_|verify_)/;

/** Called by the Supabase client's fetch for every request it sends. */
export function noteRequest(url: string, method: string | undefined) {
  const verb = (method ?? "GET").toUpperCase();
  if (verb === "GET" || verb === "HEAD" || verb === "OPTIONS") return;
  if (!url.includes("/rest/v1/") || READ_RPC.test(url)) return;
  bumpCacheEpoch();
}
