# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

FrakHub is a management hub ("MDT"-style web app) for a roleplay law-enforcement faction (Hungarian-language UI). It covers case management (MCB — investigations), HR, logistics/finance (vehicle and budget requests), a penal code calculator, exams/academy training, suspect records, and notifications. Backend is Supabase (Postgres + Auth + Realtime + Storage); deployment target is Vercel (static site + serverless functions under `api/` + daily cron).

## Hard constraint: free tier only

Supabase, Vercel and Cloudinary all run on their free tiers. Every change must keep requests, egress, function invocations/CPU, storage and Cloudinary credits low: no polling, select only needed columns (never `*` for lists with large columns such as `cases.body` or academy `content`), batch writes, reuse the in-memory caches, compress uploads. Do not propose paid upgrades unless usage data proves them unavoidable. `e2e/request-budget.spec.ts` guards the most important budgets.

## Commands

Bun is the only package manager (`bun.lock`; `packageManager` is pinned in package.json). Node 24.

- `bun run dev` — Vite dev server; also serves `api/` functions locally (`tooling/vite-vercel-api.ts`)
- `bun run build` — `tsc -b` (app + api + tooling) then `vite build`; type errors fail Vercel deploys
- `bun run typecheck` / `bun run lint` / `bun run check` (typecheck + lint + build)
- `bun run test:e2e` — Playwright (run `bun run test:e2e:install` once); single file: `bunx playwright test e2e/auth.spec.ts`
- `bunx supabase start` / `bunx supabase db reset` — local Supabase stack (Docker); reset re-applies `supabase/migrations/` + `supabase/seed.sql`
- `bunx supabase test db` — pgTAP RLS/permission tests in `supabase/tests/database/` (local stack)
- `bun run db:types` — generate `src/types/database.types.ts` from the local database

## Database workflow (production safety)

- The hosted project is the REAL production database, used live. Develop and test on the local stack; never experiment against prod. Apply a change to prod only after it passed locally (`db reset` + `test db` + Playwright). Never delete or rewrite crucial data there (profiles, cases, exam sheets, ...) without the user's explicit approval.
- `bun run dev` uses the local stack through `.env.development.local` (overrides `.env`, dev only). Seed accounts (password `password123`): `admin|supervisor|user|pending|captain|investigator|operator|trainee@frakhub.local`.
- Schema source of truth: `supabase/migrations/` (first file = read-only dump baseline of prod). New change: iterate on the local DB, then `bunx supabase migration new <name>`, verify, then `bunx supabase db push --db-url "<session pooler URL>"` (host `aws-1-eu-west-1.pooler.supabase.com:5432`, user `postgres.<project-ref>`, password in the gitignored `supabase/.env`). Prod migration history is in sync with the folder.
- Prod keeps running the deployed frontend until the next Vercel deploy, so migrations must stay compatible with it: replay its queries locally (e.g. a `git worktree` of the deployed commit against the local stack). Tightening that needs the new frontend goes to `supabase/post-deploy/` and is moved into `migrations/` after the deploy.
- `supabase db pull` against prod writes its migration history table; use `supabase db dump` for read-only snapshots.

## Environment

Documented in `.env.example` (copy to `.env`). Client (`VITE_*`, public, baked in at build time):
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (fallback `VITE_SUPABASE_ANON_KEY`), `VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_UPLOAD_PRESET`, `VITE_CLOUDINARY_AVATAR_UPLOAD_PRESET`, `VITE_CLOUDINARY_ACADEMY_UPLOAD_PRESET` — read in `src/lib/env.ts` only.

Server-only (read in `api/_lib/env.ts` only, legacy names accepted as fallbacks): `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_KEY` / `SUPABASE_SERVICE_ROLE_KEY`; bypasses RLS), `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, optional `CLOUDINARY_CLOUD_NAME`, `CRON_SECRET` (the cron endpoint refuses to run without it).

## Architecture

### Client/server split
- Normal data access goes through the browser Supabase client (`src/lib/supabaseClient.ts`) as the signed-in user, subject to RLS. The client is intentionally untyped (the old hand-written `Database` type had drifted); domain row types live in `src/types/*.ts`.
- `api/` holds Vercel functions that need the service-role key (user creation/deletion, role and password changes, case deletion, Cloudinary deletion, the daily cron). They export Web-standard handlers named after HTTP methods (`export const POST = handle(...)`). Shared helpers are in `api/_lib/` (underscore = not deployed as a route): `env`, `http` (`HttpError`, `json`, `readJsonObject`), `supabase` (`getSupabaseAdmin`, `requireCaller` verifies the bearer token and loads the caller's profile), `cloudinary` (fetch-based destroy, URL parsing). Relative imports in `api/` must use `.js` extensions (NodeNext/ESM on Vercel).
- Every function re-validates permissions because RLS is bypassed. The browser calls them through `postApi()` in `src/lib/api.ts`, which attaches the session token. Add new privileged operations as new `api/` files, never as client calls with elevated keys. Hobby plan limit: 12 functions (7 used).

### Database security
- RLS on every table; policy helpers are `SECURITY DEFINER` functions in the `private` schema (not exposed by PostgREST). A SELECT policy that re-reads the row by id (`private.has_grading_rights(id)`, `private.is_case_participant(id)`) cannot see a row inserted by the same statement, so `.insert().select()` fails unless the policy also has a direct column check (`user_id = auth.uid()`).
- `EXECUTE` on `public` functions is revoked from `anon`/`authenticated`. Postgres grants new functions to `PUBLIC`, so every new function needs `revoke ... from public, anon, authenticated` plus explicit grants. Only the exam attempt RPCs (`get_exam_intro`, `start_exam`, `save_exam_progress`, `finish_exam`) are callable by `anon` (guests take public exams).
- Column privileges: members may update only their own `profiles.avatar_url` (names via `change_user_name()`) and `notifications.is_read`. Rank/role/division changes go through `/api/admin/update-role` -> `hr_apply_member_update()` (`service_role` only). It sets `app.actor_id`, so the profile trigger can attribute the change in `member_events` and notifications; the trigger also erases both when a rank change is undone right away.
- Notifications are created by DB triggers (category, `actor_id`, `dedupe_key`, per-user muted categories in `notification_preferences`); API-originated ones use `notifyMembers()` in `api/_lib/supabase.ts`. Clients never insert notifications. `src/context/NotificationsContext.tsx` owns the single notifications channel and unread counter.
- Exams: attempts live on the server. `start_exam()` creates the sheet (`status = 'in_progress'`, server `deadline`, drawn/shuffled `question_ids`) and returns the questions without the key; `save_exam_progress()` autosaves changed answers + integrity events; `finish_exam()` hands in (`finish_reason` submitted/time_up/expired; required answers checked before the deadline). Guests prove an attempt with a secret (only its hash is stored; the browser keeps it under `frakhub.exam.guest.<exam>`). `private.exam_finalize()` scores choice questions and, with `auto_grade` and no scored text question, decides at once; abandoned attempts are closed lazily (hub, sheet, intro) and by the daily cron (`exam_close_expired_attempts`). Eligibility lives in `private.exam_block()` (code + Hungarian message; the hub hides "not for you" codes). One-call reads: `get_exam_hub()` (catalog with block/open attempt/last result, own sheets, grading queue, live attempts), `get_exam_sheet()` (graders: key, `exam_question_guides`, integrity log; candidates: details only when `feedback_visible`), `get_exam_editor()`, `get_exam_stats()`. Writes: `save_exam()` (settings, questions, options with `order_index`, guides, `exam_pages` titles/pools; answered questions/options are archived via `archived_at`, never deleted) and `grade_exam_submission()` (points + per-question `grader_comment` + decision; total computed server-side). Integrity log = facts (away duration, pasted chars, copy, offline, resume) shown as a timeline, never a warning to the candidate. Trash via `exam_submission_trash/restore/purge()`. Dashboard counters come from one `get_dashboard_summary()` call (guarded by `e2e/request-budget.spec.ts`).
- HR registry (old Google Sheet columns): `member_details`, `member_bank_accounts` (self + staff), `duty_time_entries` (monthly minutes, staff write), `former_members` (staff; the delete-user API archives every dismissed member). Read them through `get_hr_registry(_since, _user_id)`, a `SECURITY INVOKER` function, so RLS scopes the result. Permission rule for details: `canManageMemberDetails` in `shared/ranks.ts` = `private.can_manage_member()`.
- Fleet: stock = `fleet_vehicles` + `fleet_categories` (category `unit`/`min_rank`, vehicle overrides `allowed_units`/`min_rank`, `capacity` null = unlimited, `shared_label` pools); keys = `fleet_assignments` (RLS: `private.can_assign_fleet_vehicle` = staff or the category unit's leaders, `private.fleet_can_hold` = eligibility; capacity in a trigger). Client mirror: `src/lib/fleet.ts`; one cached store `src/lib/fleet-store.ts` (`useFleet`). Approved vehicle requests add a key of the vehicle with that plate (trigger, never blocks the approval). Reminders: `fleet_send_reminders()` (holders; shared vehicles: unit leaders).
- Registration renewals: OCR in the browser (`src/lib/license-ocr`: Tesseract.js, engine and model from jsDelivr, lazy-loaded; `parse.ts` is pure and unit-tested in `e2e/license-parse.spec.ts`). Match → `fleet_registration_apply()` (holder, no image stored); otherwise the screenshot goes to the private `fleet_registrations` bucket (`<uid>_<vehicle id>_<rand>.<ext>`) + `fleet_registration_submit()`; staff decide with `fleet_registration_decide()` and delete the file; the cron removes leftovers via `fleet_registration_cleanup()`. Manual date (staff only): `fleet_renew_registration()`.
- Vehicle warnings: one row per point, rows of one decision share `batch_id` (several people at once); statement triggers notify once per person and decision and turn every three active points into one `hr_records` warning (`private.convert_vehicle_warnings`).
- Hungarian time: the DB stays UTC; the UI formats only through `src/lib/datetime.ts` (Europe/Budapest: `formatDate`, `formatDateTime`, `todayKey`, `monthKey`, ...; never `toLocaleDateString()`/`toISOString().slice(0, 10)` for display or "today"). SQL functions that use `current_date`, `date_trunc`, `to_char` or `::date` need `set timezone = 'Europe/Budapest'` (a `create or replace` must repeat it); `time.test.sql` fails otherwise.
- Payroll (`/finance?tab=payroll`): `private.payroll_rows(month)` computes each member's pay from HR + `duty_time_entries` + `report_logs` + the month's extras in `payroll_entries` (null = automatic; `qual_key ''` = no qualification pay) with `payroll_settings` (Commander/bureau manager: `save_payroll_settings`, partial updates). Rules from the old sheet: rank and duty-tier pay only from `min_duty_hours`; unit (executive staff paid as `executive_unit`, "BM"), first qualification, reports, pictures, trained, TOP places (auto by duty minutes / report count among paid members, ties share) always; trainees not paid by default. Leadership (`private.is_executive_or_manager`): `get_payroll`, `save_payroll_entries` (also writes duty minutes and bank accounts to the HR registry), `set_payroll_paid`, `close_payroll` (snapshot + settings, notifies paid members), `reopen_payroll` (Commander). Members: `get_my_payslips`. `src/lib/payroll.ts` mirrors the SQL for the live sheet (`e2e/payroll-compute.spec.ts` uses the old sheet's rows) — change both together.
- Report log: `report_logs` (own rows; staff all), `forum_post_id` generated from the link makes a forum post count once. The forum (forum.hl-rpg.eu) forbids bots (robots.txt, Cloudflare Turnstile): never scrape or post to it. `src/lib/report-templates.ts` holds the forum's mandatory BBCode templates; `e2e/report-template.spec.ts` compares them character by character, do not change them casually. The calculator hands charges/fine/jail to the report form via router state (`ReportPrefill`).
- Reimbursements: decided with `decide_budget_request()` (direct updates go away in the post-deploy step); the cron calls `finance_proof_cleanup()` (proofs of requests decided 40+ days ago and unreferenced uploads; the rows stay). Overview: `get_finance_overview()`.
- Academy: catalogue from one `get_academy_overview()` call; `academy_courses` has `title/description/category/sort_order`; division pages are readable through `private.can_read_academy_course()` (open + rank, or instructor); page order via `reorder_academy_pages()`. The basic academy's days open for trainees by the active cycle's start in Hungarian time (`isDayOpen`). Editors upload pasted `data:` images to Cloudinary before saving (`src/lib/inline-images.ts`, academy and case editors); the post-deploy step adds a trigger that rejects new `data:image` content.

### Auth and roles
- `src/context/AuthContext.tsx` owns `session`/`user`/`profile`: one `onAuthStateChange` subscription (INITIAL_SESSION replaces `getSession`), profile loaded once per signed-in user and kept live via a Realtime UPDATE subscription; `profileError` + `refreshProfile` for retry.
- Roles: `profiles.system_role` (`admin` | `supervisor` | `user` | `pending`) derived from `faction_rank` by `calculateSystemRole`. **`shared/ranks.ts` is the single source of truth** for ranks and HR permission rules (`getAllowedPromotionRanks`, `canManageUserRank`, ...). It is imported by both `src/` (re-exported from `src/lib/utils.ts`) and `api/`; keep it dependency-free and alias-free.
- `SystemStatusContext` holds the global `system_status` row (alert level, recruitment open); Realtime only for signed-in users.
- `SuspectCacheContext` is mounted by `McbLayout`, so only the MCB area loads suspects.

### Routing and layout
- Single router in `src/App.tsx` (`react-router` v8, declarative mode). Pages are lazy-loaded (`lazyPage`); `LoginPage` and `AppLayout` are eager. Public routes: `/login`, `/register`, `/exam/public/:examId`; everything else is nested under `AppLayout` (which shows `PendingApprovalPage` for pending accounts); `/mcb/*` has its own `McbLayout`.
- Feature pages live under `src/pages/<feature>/`.

### Data and caching helpers
- `src/lib/cache.ts` (`createCachedLoader`, cleared on sign-out) and `src/lib/profile-directory.ts` (cached member list for pickers/mentions; call `invalidateProfileDirectory()` after HR changes).
- Realtime channels must use `uniqueChannelName()` (`src/lib/realtime.ts`); supabase-js reuses a channel with the same topic and re-subscribing throws.
- Supabase query builders are lazy: a query without `await`/`.then()` is never sent.
- Penal code data is static JSON (`src/data/penalcode.json`) processed by `src/lib/penalcode-processor.ts`; item ids are stable (`item:<paragraph>|<abbr>`), legacy sequential ids are migrated. The calculator's pure logic (filtering, ranges, ticket/arrest commands) is in `src/pages/calculator/penal-data.ts`; favourites, templates and history stay in localStorage under the old `sfsd_*` keys.
- Academy material content is loaded per page (`src/pages/academy/useMaterialContent.ts`); `MaterialWorkspace` is the shared reader/editor of a course or a basic-academy day (course/day/page live in the URL: `/academy?course=qual_AB&p=2`, `?course=basic&day=3`). Page looks (`theme`) override BlockNote's colour variables via `.academy-theme-<key>` CSS.
- Finance UI lives in `src/pages/finance/` (reimbursements, payroll sheet, pay table, overview); reports in `src/pages/reports/`.

### Files and images
- Cloudinary (`src/lib/cloudinary.ts`): `uploadToCloudinary(file, kind, scope)` compresses images first; display through `getOptimizedAvatarUrl` / `getOptimizedImageUrl` / `withTransformation`; delete unreferenced assets with `deleteCloudinaryAssets(urls)` (server refuses assets still referenced in the DB). Finance proofs live in Supabase Storage (`finance_proofs`, compressed before upload, pruned by the cron). Legacy evidence may still live in the `case_evidence` bucket.

### UI stack
- Tailwind CSS v4 + shadcn/radix primitives in `src/components/ui/`, BlockNote 0.55 (Mantine 9) for rich text in MCB cases and Academy, `sonner` toasts, `lucide-react` icons. Path aliases: `@/*` -> `src/*`, `@shared/*` -> `shared/*`.
- Look: `AppBackdrop` (glows at the edges in the alert level's colours, a twinkling star field, a calm dark middle behind the content, and the `SheriffStar` watermark engraved in the bottom-right corner with a light running along it) sits behind everything, so page and wrapper elements must stay transparent; never put large moving shapes behind the content; surfaces use the frosted `panel` utility. Utilities in `src/index.css`: `lift` (hover elevation), `animate-rise`/`animate-fade` (stagger with `style={{"--i": index}}`), `glow-border`, `text-gold`, `skeleton`. Route changes fade in (`page-enter`); `prefers-reduced-motion` disables motion.
- Width: pages are capped at 1800 px (`AppLayout`); sparse pages set a narrower centred width themselves (dashboard 1440, profile/vehicle page 1500) instead of stretching apart on large screens.
- Long unbroken text must never widen a box: dialogs use a `minmax(0,1fr)` column, `Textarea` has `wrap-anywhere`, the body breaks long words; give flex/grid children that show user text `min-w-0` and `wrap-anywhere`; a grid that is one column on mobile needs `grid-cols-1` (an implicit column grows with a long word). `e2e/layout.spec.ts` guards this (desktop and mobile).

### Tests
- Playwright E2E in `e2e/`. UI specs run against a production build (`vite preview`, port 4318), `api.spec.ts` against the dev server (port 4317). Supabase is mocked at the network level (`e2e/support/mock-supabase.ts`); all non-local traffic is blocked.

### Localization
- UI copy, error messages and toast text are Hungarian (including API error responses). Match this for new user-facing strings.
