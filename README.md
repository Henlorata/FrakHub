# FrakHub

Management hub ("MDT") for the San Fierro Sheriff's Department roleplay faction: MCB case
management, HR (roster with one-click promotions, monthly duty time sheet, former members,
the old Google Sheet's registry columns), logistics (requests, the vehicle fleet with key
holders, registration renewals read from a screenshot of the in-game licence, vehicle warnings
and tuning) and finance, penal code calculator, report
generator (with the person's data read from an in-game screenshot, in the browser), exams and
academy training, an events calendar with attendance, a radio code book, plus interactive guided
trainings per rank that run on demo data. The user interface is Hungarian.

**Stack:** React 19 · Vite 8 (Rolldown) · TypeScript 6 · Tailwind CSS 4 · shadcn/Radix ·
BlockNote · Supabase (Postgres, Auth, Realtime, Storage) · Cloudinary · Vercel (static
hosting, serverless functions, cron). Every service runs on its **free tier**.

## Requirements

- [Bun](https://bun.sh) 1.4+ (the only supported package manager; `bun.lock` is the lockfile)
- Node.js 24 (`.node-version`; Vercel functions run on `nodejs24.x`)
- Docker Desktop (for the local Supabase stack)

## Getting started

```bash
bun install
cp .env.example .env      # production values (see the comments in the file)
bunx supabase start       # local Postgres/Auth/Storage/Realtime, migrations + seed applied
bun run dev               # http://localhost:5173
```

Development runs against the **local** Supabase stack, never the production project:
create `.env.development.local` (gitignored, loaded only by `bun run dev`) with the local
URL and keys printed by `bunx supabase status`:

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<local publishable key>
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SECRET_KEY=<local secret key>
# Disables Cloudinary deletion locally (the local DB does not know which assets prod uses).
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

`supabase/seed.sql` creates local accounts (password `password123`): `admin`, `supervisor`,
`user`, `pending`, `captain`, `investigator`, `operator` and `trainee` (all `@frakhub.local`),
plus sample cases, exams, duty times, fleet vehicles and former members. Studio runs at
http://127.0.0.1:54323.

`bun run dev` also serves the serverless functions in `api/` (via
`tooling/vite-vercel-api.ts`), so registration and the admin endpoints work locally without
the Vercel CLI.

## Scripts

| Command                    | What it does                                                        |
| -------------------------- | ------------------------------------------------------------------- |
| `bun run dev`              | Vite dev server + local API functions                               |
| `bun run build`            | Type-check every project (`tsc -b`), then production build          |
| `bun run preview`          | Serve the production build                                          |
| `bun run typecheck`        | `tsc -b` (app, API functions, tooling/tests)                        |
| `bun run lint`             | ESLint (errors fail; legacy patterns are reported as warnings)      |
| `bun run format`           | Prettier (see "Formatting" below before the first run)              |
| `bun run check`            | Type-check + lint + build                                           |
| `bun run test:e2e:install` | One-time download of the headless Chromium used by the tests        |
| `bun run test:e2e`         | Playwright end-to-end suite (Supabase is mocked, no credentials)    |
| `bun run db:types`         | Generate `src/types/database.types.ts` from the local Supabase DB   |

## Project layout

```
api/                 Vercel serverless functions (Web standard handlers: export POST/GET)
  _lib/              Shared helpers: env, HTTP, service-role client + caller auth, Cloudinary
shared/ranks.ts      Rank hierarchy and HR permission rules, used by BOTH src/ and api/
src/
  context/           Auth (session + live profile), system status, MCB suspect cache, trainings
  layouts/           App shell (sidebar) and the MCB area shell
  lib/               Supabase client, API wrapper, Cloudinary helpers, caches, utilities
    training/        Training catalogue, tour scripts, progress
    sandbox/         Practice mode: in-memory PostgREST engine and the demo world
  pages/<feature>/   One folder per domain (mcb, hr, logistics, exams, academy, ...)
  components/ui/     shadcn/Radix primitives
e2e/                 Playwright tests and the network-level Supabase mock
supabase/            Supabase CLI project (config, migrations, local seed)
tooling/             Build tooling (dev-server middleware for api/)
```

## Architecture notes

- **Data access** goes through the browser Supabase client as the signed-in user; Row
  Level Security is the real gate.
- **Privileged operations** (creating/deleting users, role changes, deleting files) live in
  `api/` and use the service-role key, which bypasses RLS. Every function verifies the
  caller's token and re-checks permissions with the same rules the UI uses
  (`shared/ranks.ts`). Add new privileged operations there, never with elevated keys in
  the browser.
- **Routes are code-split**: each page (and heavy dependencies such as the BlockNote
  editor) downloads on first visit.
- **Trainings** walk members through the site with a spotlight and short cards: a basic
  training for everyone and further ones for MCB, supervisory staff, instructors, high
  command, the executive staff, division commanders and the bureau manager. A training starts
  by itself once it is unlocked (or on the next visit), can be skipped after a warning and
  replayed from the profile. While it plays, the app runs in **practice mode**: every
  database, API and upload request is answered by an in-memory demo world built in that
  browser tab, so members can grade a demo exam or edit a demo case without touching real
  data, and several people can train at the same time. Only the result is stored
  (`training_progress`, mirrored in localStorage so a steady-state visit sends no request).
- **Events**: meetings, trainings, exam days and joint actions with attendance (going / maybe /
  not coming). Organisers are the supervisory staff and above, and unit leaders for their unit; the
  audience is notified, those who come get a reminder on the day. The dashboard shows the next
  three and the member's monthly requirement (reports and recorded duty time).
- **Screenshots are read in the browser** (Tesseract.js): the vehicle licence for registration
  renewals, the in-game tablet's person page for the report form, and the game control panel's
  member list for the monthly duty time (several screenshots at once, doubtful values marked). The report's picture is
  never uploaded; the member is always told to check the result.
- **New trainees** finish an onboarding page first (link the admission exam with its code,
  first-day rules, a small practice corner) and then get the basic training.
- **Images** are resized and converted to WebP in the browser before upload
  (`src/lib/image-compression.ts`) and delivered through Cloudinary transformations
  (`f_auto,q_auto`, bounded sizes). Files that are no longer referenced are deleted through
  `/api/delete-image`, which refuses to delete anything still in use.

## Deployment (Vercel)

- Set every variable from `.env.example` in Project Settings -> Environment Variables
  (client `VITE_*` variables are baked in at build time: redeploy after changing them).
- `vercel.json` sets the install/build commands, SPA rewrites, long-lived caching for hashed
  assets, security headers, a 30 s cap for functions and the daily cleanup cron
  (`/api/cron/daily-cleanup`, 03:00 UTC, authenticated with `CRON_SECRET`).
- The build runs `tsc -b` first, so type errors fail the deployment.

## Database (Supabase)

`supabase/migrations/` is the source of truth for the schema. The first migration
(`*_remote_schema_baseline.sql`) is a read-only `supabase db dump` of the production
database, which had been built by hand (no migration history existed).

Workflow for schema changes:

1. Change the **local** database (SQL editor in Studio, `psql`, or the MCP/CLI), test the
   feature against it with `bun run dev`.
2. Write the final change as a migration: `bunx supabase migration new <name>`, then
   verify it from scratch with `bunx supabase db reset` (re-applies all migrations + seed).
3. Run the database tests (`bunx supabase test db`, pgTAP files in `supabase/tests/database/`)
   and the Playwright suite.
4. Only then apply it to production. The project is not linked, so pass the session pooler
   URL (the password lives in the gitignored `supabase/.env` as `SUPABASE_DB_PASSWORD`):
   `bunx supabase db push --db-url "postgresql://postgres.<project-ref>:<password>@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"`.
   Each migration runs in one transaction together with its history row.

Production's migration history is in sync with this folder (the baseline was marked as
applied with `supabase migration repair`, it only writes the history table).

Changes that would break the currently deployed frontend go to `supabase/post-deploy/`
instead: deploy the frontend first, then move the file into `supabase/migrations/` and push
it. Before applying a migration, replay the deployed client's queries against it (an
`INSERT ... RETURNING` that the new policies no longer allow is easy to miss).

### Security model

- RLS everywhere. Policy helpers are `SECURITY DEFINER` functions in the `private` schema,
  which PostgREST does not expose. A `SELECT` policy that looks the row up again by id (for
  example `private.has_grading_rights(id)`) cannot see a row inserted by the same statement,
  so keep a direct column check (`user_id = auth.uid()`) where clients insert with
  `.insert().select()`.
- `EXECUTE` on functions in `public` is revoked from `anon`/`authenticated`; every new
  function needs an explicit `revoke ... from public, anon, authenticated` followed by the
  grants it really needs (Postgres grants `EXECUTE` to `PUBLIC` by default).
- Column privileges keep sensitive columns out of reach: members may only update their own
  `avatar_url` directly (names through `change_user_name()`). Ranks, roles and divisions are
  changed through `/api/admin/update-role`, which calls `hr_apply_member_update()`, a
  `service_role`-only function that also records the member history. (The legacy
  `hr_update_user_profile_v2()` RPC stays until the post-deploy step removes it.)
- Notifications are created by database triggers (cases, warrants, requests, exams, HR,
  ribbons, announcements), with categories, actor and de-duplication; clients cannot insert
  them. Users can mute categories (`notification_preferences`).
- MCB cases: the database decides who may open a case (owner, collaborators, the MCB
  leadership and high command); everyone else in the MCB area sees only the list row. Pages
  load with one call each (`get_case_list()`, `get_case_detail()`, `get_suspect_dossier()`,
  `get_mcb_overview()`). Documents are saved with a version check
  (`save_case_document()`), so two investigators cannot overwrite each other unnoticed; the
  editor autosaves and keeps a local draft. Status, hand-over and warrant decisions go through
  `set_case_status()`, `transfer_case()` and `decide_warrant()` (no approval of one's own
  request); `case_events` keeps the history of every case. The direct table updates of the
  old frontend are removed by the post-deploy step.
- Exams run on the server: `start_exam()` creates the attempt with a server-side deadline
  (question pools and shuffling per attempt, no answer key sent), `save_exam_progress()`
  autosaves, `finish_exam()` hands in (claim codes for guests). Choice questions are scored
  on hand-in; `grade_exam_submission()` stores points, per-question comments and the
  decision in one call. Editors use `get_exam_editor()`/`save_exam()` (pages, pools, answer
  guides for graders), graders `get_exam_sheet()` with an integrity timeline (time away,
  pasted text) instead of a warning counter. The exam centre loads with one
  `get_exam_hub()` call. Wrongly submitted sheets go to a trash (`exam_submission_trash/restore/purge`).
- HR registry (the old sheet's columns): `member_details` (station, parking spot, joining,
  recruiter, activity), `member_bank_accounts` (the member and staff only),
  `duty_time_entries` (monthly, staff), `former_members` (filled by `/api/admin/delete-user`).
  The HR page and the profile read all of it with one `get_hr_registry()` call
  (`SECURITY INVOKER`, so RLS decides what each caller gets).
- Fleet (the old "Car Database" sheets): the stock in `fleet_vehicles` grouped by
  `fleet_categories` (managed on the site; deleting one moves its vehicles or deletes them with it) (a bureau/unit category is reserved for its members, a vehicle can
  override it with `allowed_units`/`min_rank`), key holders in `fleet_assignments` (capacity
  per vehicle, null = unlimited; shared pools via `shared_label`). Supervisory staff manage
  every vehicle, a bureau's leaders the vehicles of their bureau. Approving a vehicle request
  hands out a key of the vehicle with that plate.
- Registration renewals: the holder's browser reads a screenshot of the in-game licence
  (`src/lib/license-ocr`, Tesseract.js from jsDelivr, nothing uploaded); a matching reading is
  applied with `fleet_registration_apply()`, anything else goes to supervisory staff with the
  screenshot (`fleet_registration_submit()` → Storage bucket `fleet_registrations` →
  `fleet_registration_decide()`, which releases the file). Staff can set the date by hand
  (`fleet_renew_registration()`). The daily cron sends reminders (`fleet_send_reminders()`)
  and removes leftover screenshots (`fleet_registration_cleanup()`).
- Vehicle warnings (`vehicle_warnings`): one decision may cover several people and several
  points (rows share a `batch_id`); every three active points become one personal warning
  (`hr_records`) in a statement trigger. Official tuning per model: `fleet_tuning_presets`.
- Monthly payroll (the old payroll spreadsheet): `private.payroll_rows()` computes every
  member's pay from HR (rank, division, qualifications), `duty_time_entries`, the report log
  and the month's extras in `payroll_entries` (pictures, trained people, TOP places, other
  pay; `null` = automatic). The amounts live in `payroll_settings`, set by the Commander
  (`save_payroll_settings()`). The leadership uses `get_payroll()` / `save_payroll_entries()`
  (duty time and account numbers are written to the HR registry from there) /
  `set_payroll_paid()` / `close_payroll()` (stores a snapshot with the settings and notifies
  every paid member) / `reopen_payroll()`; members read their closed months with
  `get_my_payslips()`. `src/lib/payroll.ts` mirrors the rules for the live sheet.
- Report log (`report_logs`): members record the reports they posted on the forum (the forum
  forbids automated reading); one forum post counts once (`forum_post_id`). The payroll counts
  them per Hungarian month. The BBCode templates (`src/lib/report-templates.ts`) are the
  forum's required format and are guarded by `e2e/report-template.spec.ts`.
- Reimbursements are decided with `decide_budget_request()`; the cron removes old proof
  images (`finance_proof_cleanup()`) but keeps the requests for the finance history
  (`get_finance_overview()`).
- Academy: the catalogue comes from `get_academy_overview()` (courses with title,
  description, access and the reader's progress, the basic academy's days in Hungarian
  time). Course pages are readable when `private.can_read_academy_course()` allows it (open
  and rank, or instructor). Images pasted into the editors are uploaded to Cloudinary before
  saving (`src/lib/inline-images.ts`), so no `data:` image is stored in the page JSON.
- Events: `events` and `event_responses`; who sees and organises an event is decided by
  `private.can_see_event()` / `private.can_manage_event()` (audience: everyone, supervisory staff,
  command staff, or a division/unit). Answers go through `respond_to_event()`; the calendar loads
  with one `get_events()` call.
- Trainings: `training_progress` holds one row per member and training (completed or
  skipped, with the training's version); members read, insert and update only their own rows.
- Dates: the database stays in UTC; the UI formats in Europe/Budapest (`src/lib/datetime.ts`)
  and SQL functions that use calendar dates carry `set timezone = 'Europe/Budapest'`
  (`supabase/tests/database/time.test.sql` checks it).

```bash
bun run db:types                   # generates src/types/database.types.ts from the local DB
```

`src/lib/supabaseClient.ts` is deliberately untyped because the old hand-written schema type
had drifted from the database; once `database.types.ts` exists, pass its `Database` type to
`createClient<Database>()`.

The **Supabase MCP server** is provided by the official Claude Code plugin
(`supabase@supabase-community-supabase-plugin`). Authorize it once with `/mcp` in an
interactive Claude Code session. For day-to-day work prefer a read-only, project-scoped
connection: `https://mcp.supabase.com/mcp?project_ref=<project-ref>&read_only=true`.

## Testing

`bun run test:e2e` builds the app into `.e2e-dist/`, serves it with `vite preview` and runs the
Playwright suite in headless Chromium. Supabase is mocked at the network level
(`e2e/support/mock-supabase.ts`), so the tests need no credentials and never touch a real
project. Besides behaviour, the suite asserts request budgets (e.g. an idle login page sends
no queries, the case list never downloads document bodies) to catch regressions that would
burn free-tier quota.

## Free-tier guard rails

- Supabase: no polling; Realtime only for signed-in users; list queries select only needed
  columns; member and ribbon lists are cached in memory; pages with several data sources load
  through one RPC (dashboard, exams, payroll, academy); rich text never stores embedded
  images; the daily cron prunes old proofs, closed vehicle requests and old activity logs
  (and keeps the free project from pausing).
- Cloudinary: client-side compression, transformation-based delivery, server-side cleanup of
  replaced and deleted assets. Recommended upload preset settings are in `.env.example`.
- Vercel: hashed assets are cached for a year; the initial page load is about 210 KB of
  gzipped JavaScript (previously 750 KB in one bundle).

## Formatting

`.editorconfig` and `.prettierrc.json` describe the code style (2 spaces, LF, double quotes,
no bracket spacing). The codebase has not been mass-formatted yet: run `bun run format` once,
commit the result on its own, and add that commit to `.git-blame-ignore-revs`.

## License

MIT, see [LICENSE](LICENSE).
