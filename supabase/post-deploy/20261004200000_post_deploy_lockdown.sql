-- Tightening that needs the NEW frontend and API to be live (apply after the Vercel
-- deployment that contains the redesigned exam, HR and dashboard code):
--
--   1. move this file to supabase/migrations/
--   2. bunx supabase db push --db-url "<session pooler URL>"   (or apply it with the MCP)
--
-- The previous migrations kept the old client working; this one removes those
-- compatibility paths.

-- 1. Questions and options are no longer readable before or during an exam: candidates get
--    their questions from start_exam(), editors and graders through get_exam_editor() and
--    get_exam_sheet(). Exams are written by save_exam() and delete_full_exam() only.
drop policy if exists exam_questions_select on public.exam_questions;
create policy exam_questions_select on public.exam_questions for select to authenticated
  using (private.can_view_exam_key(exam_id));
drop policy if exists exam_options_select on public.exam_options;
create policy exam_options_select on public.exam_options for select to authenticated
  using (exists (select 1 from public.exam_questions q where q.id = question_id and private.can_view_exam_key(q.exam_id)));
drop policy if exists exam_questions_insert on public.exam_questions;
drop policy if exists exam_questions_update on public.exam_questions;
drop policy if exists exam_questions_delete on public.exam_questions;
drop policy if exists exam_options_insert on public.exam_options;
drop policy if exists exam_options_update on public.exam_options;
drop policy if exists exam_options_delete on public.exam_options;
drop policy if exists exams_insert on public.exams;
drop policy if exists exams_update on public.exams;
drop policy if exists exams_delete on public.exams;
revoke all on public.exam_questions, public.exam_options from anon;
revoke insert, update, delete on public.exams, public.exam_questions, public.exam_options from anon, authenticated;
-- The answer key stays out of the table API even for editors (they use the RPCs).
revoke select on public.exam_options from authenticated;
grant select (id, question_id, option_text, order_index) on public.exam_options to authenticated;
-- The old frontend's "insert at the end" for options.
drop trigger if exists exam_option_default_order on public.exam_options;
drop function if exists private.exam_option_default_order();

-- 2. Exam sheets are written by the attempt RPCs (start_exam, save_exam_progress,
--    finish_exam), grade_exam_submission() and the trash RPCs only. Guests no longer read
--    recent guest sheets (they held claim codes).
drop policy if exists exam_submissions_select_recent_guest on public.exam_submissions;
drop policy if exists exam_submissions_insert on public.exam_submissions;
drop policy if exists exam_submissions_update on public.exam_submissions;
drop policy if exists exam_answers_insert on public.exam_answers;
drop policy if exists exam_answers_update on public.exam_answers;
revoke insert, update, delete on public.exam_submissions, public.exam_answers from anon, authenticated;
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

-- 7. Reimbursements are decided through decide_budget_request() only (status, comment and
--    decider together; members keep inserting their own pending requests).
drop policy if exists budget_requests_update_admin on public.budget_requests;
revoke update on public.budget_requests from authenticated;

-- 8. No more images embedded in rich text: the editors upload pasted images to Cloudinary
--    before saving, so only a stale client could still store a `data:` image. Checked only when
--    the content changes (renaming a page with old embedded images keeps working).
create or replace function private.reject_inline_images()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  _content jsonb := to_jsonb(new) -> tg_argv[0];
begin
  if _content is not null and _content::text like '%"data:image/%' then
    raise exception 'A beillesztett képeket előbb fel kell tölteni (frissítsd az oldalt, majd mentsd újra).' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke execute on function private.reject_inline_images() from public, anon, authenticated;
create trigger reject_inline_images before insert or update of content on public.academy_materials
  for each row execute function private.reject_inline_images('content');
create trigger reject_inline_images before insert or update of content on public.academy_division_materials
  for each row execute function private.reject_inline_images('content');
create trigger reject_inline_images before insert or update of body on public.cases
  for each row execute function private.reject_inline_images('body');
