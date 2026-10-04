import {createHash, timingSafeEqual} from "node:crypto";
import {serverEnv} from "../_lib/env.js";
import {getBearerToken, handle, HttpError, json} from "../_lib/http.js";
import {getSupabaseAdmin} from "../_lib/supabase.js";

const RETENTION_DAYS = {closedRequests: 40, actionLogs: 1, readNotifications: 30, notifications: 120};
const BATCH_LIMIT = 500;

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const sameSecret = (provided: string, expected: string) => {
  // Hashing first makes the comparison constant-time regardless of input length.
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(provided), digest(expected));
};

/** `proof_image_path` holds an array, a JSON-encoded array or (legacy) a single path. */
function toStoragePaths(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((path): path is string => typeof path === "string" && path.length > 0);
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return toStoragePaths(parsed);
  } catch {
    // Not JSON: a plain storage path.
  }
  return [raw];
}

/**
 * Daily maintenance, invoked by Vercel Cron (see vercel.json) with
 * `Authorization: Bearer <CRON_SECRET>`. Keeps the database and the Storage bucket
 * small enough for the free tier, and its daily activity keeps the free Supabase
 * project from being paused for inactivity.
 */
export const GET = handle("cron/daily-cleanup", async (request) => {
  const secret = serverEnv.cronSecret();
  if (!secret) {
    console.error("[api/cron/daily-cleanup] CRON_SECRET is not set; refusing to run.");
    throw new HttpError(503, "A karbantartás nincs konfigurálva.");
  }
  if (!sameSecret(getBearerToken(request) ?? "", secret)) throw new HttpError(401, "Unauthorized");

  const supabase = getSupabaseAdmin();
  const results = {
    financeDeleted: 0, financeFilesDeleted: 0, vehicleDeleted: 0, actionsDeleted: 0, notificationsDeleted: 0,
    registrationReminders: 0, errors: [] as string[],
  };
  const fail = (step: string, error: unknown) => {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    console.error(`[api/cron/daily-cleanup] ${step}:`, error);
    results.errors.push(`${step}: ${message}`);
  };

  // 1. Closed budget requests older than the retention period, with their proof images.
  try {
    const {data: oldRequests, error} = await supabase
      .from("budget_requests")
      .select("id, proof_image_path")
      .neq("status", "pending")
      .lt("created_at", daysAgo(RETENTION_DAYS.closedRequests))
      .limit(BATCH_LIMIT);
    if (error) throw error;

    if (oldRequests && oldRequests.length > 0) {
      const paths = oldRequests.flatMap((row) => toStoragePaths(row.proof_image_path));
      for (let i = 0; i < paths.length; i += 100) {
        const {error: removeError} = await supabase.storage.from("finance_proofs").remove(paths.slice(i, i + 100));
        // Keep the rows when the files could not be removed, so they are retried tomorrow
        // instead of leaving orphaned files behind.
        if (removeError) throw removeError;
      }
      results.financeFilesDeleted = paths.length;

      const {error: deleteError, count} = await supabase
        .from("budget_requests")
        .delete({count: "exact"})
        .in("id", oldRequests.map((row) => row.id));
      if (deleteError) throw deleteError;
      results.financeDeleted = count ?? 0;
    }
  } catch (error) {
    fail("finance", error);
  }

  // 2. Closed vehicle requests older than the retention period.
  try {
    const {error, count} = await supabase
      .from("vehicle_requests")
      .delete({count: "exact"})
      .neq("status", "pending")
      .lt("created_at", daysAgo(RETENTION_DAYS.closedRequests));
    if (error) throw error;
    results.vehicleDeleted = count ?? 0;
  } catch (error) {
    fail("vehicle", error);
  }

  // 3. Dashboard activity feed entries older than a day.
  try {
    const {error, count} = await supabase
      .from("action_logs")
      .delete({count: "exact"})
      .lt("created_at", daysAgo(RETENTION_DAYS.actionLogs));
    if (error) throw error;
    results.actionsDeleted = count ?? 0;
  } catch (error) {
    fail("action_logs", error);
  }

  // 4. Notifications: read ones after a month, everything after four months.
  try {
    const [read, old] = await Promise.all([
      supabase.from("notifications").delete({count: "exact"})
        .eq("is_read", true).lt("created_at", daysAgo(RETENTION_DAYS.readNotifications)),
      supabase.from("notifications").delete({count: "exact"})
        .lt("created_at", daysAgo(RETENTION_DAYS.notifications)),
    ]);
    if (read.error) throw read.error;
    if (old.error) throw old.error;
    results.notificationsDeleted = (read.count ?? 0) + (old.count ?? 0);
  } catch (error) {
    fail("notifications", error);
  }

  // 5. Fleet: "expires soon" / "expired" registration reminders (once per stage).
  try {
    const {data, error} = await supabase.rpc("fleet_send_reminders");
    if (error) throw error;
    results.registrationReminders = typeof data === "number" ? data : 0;
  } catch (error) {
    fail("fleet_reminders", error);
  }

  console.log("[api/cron/daily-cleanup] done", results);
  return json({
    success: results.errors.length === 0,
    message: "Karbantartás lefutott.",
    timestamp: new Date().toISOString(),
    results,
  });
});
