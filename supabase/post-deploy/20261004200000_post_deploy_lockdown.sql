-- Tightening that needs the NEW frontend and API to be live (apply after the Vercel
-- deployment that contains the redesigned exam, HR and dashboard code):
--
--   1. move this file to supabase/migrations/
--   2. bunx supabase db push --db-url "<session pooler URL>"   (or apply it with the MCP)
--
-- The previous migrations kept the old client working; this one removes those
-- compatibility paths.

-- 1. The answer key is no longer readable through the table: editors and graders use
--    get_exam_answer_key(), candidates never need it.
revoke select on public.exam_options from anon, authenticated;
grant select (id, question_id, option_text) on public.exam_options to anon, authenticated;

-- 2. Exam sheets are submitted through submit_exam() only (server-side validation,
--    maximum score, claim code). Guests no longer read recent guest sheets.
drop policy if exists exam_submissions_select_recent_guest on public.exam_submissions;
drop policy if exists exam_submissions_insert on public.exam_submissions;
drop policy if exists exam_answers_insert on public.exam_answers;
-- Graders save points with an upsert, which needs an INSERT policy.
create policy exam_answers_insert_graders on public.exam_answers for insert to authenticated
  with check (private.can_grade_submission(submission_id));
revoke insert on public.exam_submissions from anon, authenticated;
revoke all on public.exam_answers from anon;
revoke all on public.exam_submissions from anon;

-- 3. HR changes go through /api/admin/update-role (shared/ranks.ts rules) only.
drop function if exists public.hr_update_user_profile_v2(uuid, text, text, text, text, text, text[]);

-- 4. Hidden announcement authors stay hidden: the feed comes from get_announcements(),
--    the table no longer exposes created_by.
revoke select on public.announcements from anon, authenticated;
grant select (id, title, content, type, is_pinned, show_author, created_at) on public.announcements to authenticated;

-- 5. Login e-mail addresses live in auth.users only (members can read each other's
--    profile rows). The client takes the own address from the session.
update public.profiles set email = null where email is not null;

-- 6. The deployed API no longer sends duplicate approval / rank notifications.
drop trigger if exists skip_legacy_duplicate_notification on public.notifications;
drop function if exists private.skip_legacy_duplicate_notification();
