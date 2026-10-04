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
- `EXECUTE` on `public` functions is revoked from `anon`/`authenticated`. Postgres grants new functions to `PUBLIC`, so every new function needs `revoke ... from public, anon, authenticated` plus explicit grants. Only `submit_exam` is callable by `anon`.
- Column privileges: members may update only their own `profiles.avatar_url` (names via `change_user_name()`) and `notifications.is_read`. Rank/role/division changes go through `/api/admin/update-role` -> `hr_apply_member_update()` (`service_role` only). It sets `app.actor_id`, so the profile trigger can attribute the change in `member_events` and notifications; the trigger also erases both when a rank change is undone right away.
- Notifications are created by DB triggers (category, `actor_id`, `dedupe_key`, per-user muted categories in `notification_preferences`); API-originated ones use `notifyMembers()` in `api/_lib/supabase.ts`. Clients never insert notifications. `src/context/NotificationsContext.tsx` owns the single notifications channel and unread counter.
- Exams: `submit_exam()` (server-side scoring, guest claim codes), `save_exam_questions()`, `get_exam_answer_key()`, trash via `exam_submission_trash/restore/purge()`. Dashboard counters come from one `get_dashboard_summary()` call (guarded by `e2e/request-budget.spec.ts`).

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
- Penal code data is static JSON (`src/data/penalcode.json`) processed by `src/lib/penalcode-processor.ts`; item ids are stable (`item:<paragraph>|<abbr>`), legacy sequential ids are migrated.
- Academy material content is loaded per page (`src/pages/academy/useMaterialContent.ts`).

### Files and images
- Cloudinary (`src/lib/cloudinary.ts`): `uploadToCloudinary(file, kind, scope)` compresses images first; display through `getOptimizedAvatarUrl` / `getOptimizedImageUrl` / `withTransformation`; delete unreferenced assets with `deleteCloudinaryAssets(urls)` (server refuses assets still referenced in the DB). Finance proofs live in Supabase Storage (`finance_proofs`, compressed before upload, pruned by the cron). Legacy evidence may still live in the `case_evidence` bucket.

### UI stack
- Tailwind CSS v4 + shadcn/radix primitives in `src/components/ui/`, BlockNote 0.55 (Mantine 9) for rich text in MCB cases and Academy, `sonner` toasts, `lucide-react` icons. Path aliases: `@/*` -> `src/*`, `@shared/*` -> `shared/*`.

### Tests
- Playwright E2E in `e2e/`. UI specs run against a production build (`vite preview`, port 4318), `api.spec.ts` against the dev server (port 4317). Supabase is mocked at the network level (`e2e/support/mock-supabase.ts`); all non-local traffic is blocked.

### Localization
- UI copy, error messages and toast text are Hungarian (including API error responses). Match this for new user-facing strings.
