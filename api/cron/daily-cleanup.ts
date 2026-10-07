import {createHash, timingSafeEqual} from "node:crypto";
import {serverEnv} from "../_lib/env.js";
import {purgeCase} from "../_lib/cases.js";
import {getBearerToken, handle, HttpError, json} from "../_lib/http.js";
import {getSupabaseAdmin} from "../_lib/supabase.js";
import {PENAL_CODE_RELEASE} from "../../shared/penal-changelog.js";

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
    financeProofsCleared: 0, financeFilesDeleted: 0, vehicleDeleted: 0, actionsDeleted: 0, notificationsDeleted: 0, bolosDeleted: 0,
    databaseMb: null as number | null,
    registrationReminders: 0, registrationFilesDeleted: 0, registrationReviewsExpired: 0, examAttemptsClosed: 0, eventReminders: 0,
    warrantsLapsed: 0, mcbReminders: 0, casesPurged: 0, penalCodeAnnounced: false,
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

  // 2-4. Housekeeping in one database call (run_housekeeping): read notifications after a month and
  //      everything after four, the calculator's log after 400 days (the statistics look a year back),
  //      decided vehicle requests after 120 days (the fleet's 90-day view), closed BOLOs after a year,
  //      the public form's rate-limit rows; it also records the database's size for the leadership.
  try {
    const {data, error} = await supabase.rpc("run_housekeeping");
    if (error) throw error;
    const done = (data ?? {}) as {
      notifications_read?: number; notifications_old?: number; action_logs?: number; vehicle_requests?: number; bolos?: number;
      health?: {bytes?: number};
    };
    results.notificationsDeleted = (done.notifications_read ?? 0) + (done.notifications_old ?? 0);
    results.actionsDeleted = done.action_logs ?? 0;
    results.vehicleDeleted = done.vehicle_requests ?? 0;
    results.bolosDeleted = done.bolos ?? 0;
    results.databaseMb = done.health?.bytes ? Math.round(done.health.bytes / 1024 / 1024) : null;
  } catch (error) {
    fail("housekeeping", error);
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

  // 9b. MCB trash: cases trashed more than 30 days ago are deleted for good, with their files.
  try {
    const {data, error} = await supabase.rpc("expired_trashed_cases", {_limit: 25});
    if (error) throw error;
    for (const caseId of (data ?? []) as string[]) {
      try {
        await purgeCase(supabase, caseId);
        results.casesPurged += 1;
      } catch (purgeError) {
        fail(`case_purge ${caseId}`, purgeError);
      }
    }
  } catch (error) {
    fail("case_trash", error);
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
