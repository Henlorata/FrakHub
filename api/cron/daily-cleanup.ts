import {createHash, timingSafeEqual} from "node:crypto";
import {serverEnv} from "../_lib/env.js";
import {getBearerToken, handle, HttpError, json} from "../_lib/http.js";
import {getSupabaseAdmin} from "../_lib/supabase.js";
import {PENAL_CODE_RELEASE} from "../../shared/penal-changelog.js";

const RETENTION_DAYS = {closedRequests: 40, actionLogs: 1, readNotifications: 30, notifications: 120};

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const sameSecret = (provided: string, expected: string) => {
  // Hashing first makes the comparison constant-time regardless of input length.
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(provided), digest(expected));
};

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
    financeProofsCleared: 0, financeFilesDeleted: 0, vehicleDeleted: 0, actionsDeleted: 0, notificationsDeleted: 0,
    registrationReminders: 0, registrationFilesDeleted: 0, registrationReviewsExpired: 0, examAttemptsClosed: 0, eventReminders: 0,
    warrantsLapsed: 0, mcbReminders: 0, penalCodeAnnounced: false,
    errors: [] as string[],
  };
  const fail = (step: string, error: unknown) => {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    console.error(`[api/cron/daily-cleanup] ${step}:`, error);
    results.errors.push(`${step}: ${message}`);
  };

  // 1. Reimbursement proofs: images of requests decided more than 40 days ago (the request
  //    stays in the finance history) and uploads no request refers to. The database marks the
  //    requests first; a file that fails to delete today is found again tomorrow as unreferenced.
  try {
    const {data, error} = await supabase.rpc("finance_proof_cleanup");
    if (error) throw error;
    const cleanup = (data ?? {}) as {remove?: string[]; cleared?: number};
    const paths = cleanup.remove ?? [];
    for (let i = 0; i < paths.length; i += 100) {
      const {error: removeError} = await supabase.storage.from("finance_proofs").remove(paths.slice(i, i + 100));
      if (removeError) throw removeError;
    }
    results.financeFilesDeleted = paths.length;
    results.financeProofsCleared = cleanup.cleared ?? 0;
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

  // 6. Fleet renewals: screenshots that are no longer needed (decided reviews, abandoned
  //    uploads), reviews nobody decided within 30 days, old renewal history.
  try {
    const {data, error} = await supabase.rpc("fleet_registration_cleanup");
    if (error) throw error;
    const cleanup = (data ?? {}) as {remove?: string[]; expired?: number};
    const paths = cleanup.remove ?? [];
    for (let i = 0; i < paths.length; i += 100) {
      const {error: removeError} = await supabase.storage.from("fleet_registrations").remove(paths.slice(i, i + 100));
      if (removeError) throw removeError;
    }
    results.registrationFilesDeleted = paths.length;
    results.registrationReviewsExpired = cleanup.expired ?? 0;
  } catch (error) {
    fail("fleet_registrations", error);
  }

  // 7. Exam attempts whose time ran out while nobody had the page open: handed in as they are,
  //    so they reach the graders (the exam centre also closes them when it is opened).
  try {
    const {data, error} = await supabase.rpc("exam_close_expired_attempts");
    if (error) throw error;
    results.examAttemptsClosed = typeof data === "number" ? data : 0;
  } catch (error) {
    fail("exam_attempts", error);
  }

  // 8. Today's events: a reminder to those who said they come (or might). The cron runs early in
  //    the morning (Hungarian time), before any event of the day.
  try {
    const {data, error} = await supabase.rpc("events_send_reminders");
    if (error) throw error;
    results.eventReminders = typeof data === "number" ? data : 0;
  } catch (error) {
    fail("event_reminders", error);
  }

  // 9. MCB: warrants past their validity lapse, reminders before they do, the overdue task digest
  //    (first day, then weekly) and items kept past their retention date.
  try {
    const {data, error} = await supabase.rpc("mcb_daily");
    if (error) throw error;
    const daily = (data ?? {}) as {lapsed?: number; reminded?: number; task_digests?: number; retention?: number};
    results.warrantsLapsed = daily.lapsed ?? 0;
    results.mcbReminders = (daily.reminded ?? 0) + (daily.task_digests ?? 0) + (daily.retention ?? 0);
  } catch (error) {
    fail("mcb_daily", error);
  }

  // 10. A new penal code release (shared/penal-changelog.ts) is announced to every member once;
  //     the database remembers the last announced version (the very first run only records it).
  try {
    if (PENAL_CODE_RELEASE) {
      const {data, error} = await supabase.rpc("announce_penal_code", {
        _version: PENAL_CODE_RELEASE.version, _title: PENAL_CODE_RELEASE.title, _summary: PENAL_CODE_RELEASE.summary,
      });
      if (error) throw error;
      results.penalCodeAnnounced = data === true;
    }
  } catch (error) {
    fail("penal_code", error);
  }

  console.log("[api/cron/daily-cleanup] done", results);
  return json({
    success: results.errors.length === 0,
    message: "Karbantartás lefutott.",
    timestamp: new Date().toISOString(),
    results,
  });
});
