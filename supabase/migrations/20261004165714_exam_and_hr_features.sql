-- Exam features (unscored questions, deletable/restorable exam sheets, server-side
-- submission) and the RPCs behind the redesigned HR page, dashboard and case editor.

-- ---------------------------------------------------------------------------
-- 1. Unscored questions: 0 points means "not part of the result"
-- ---------------------------------------------------------------------------

update public.exam_questions set points = 1 where points is null;
update public.exam_questions set points = 0 where points < 0;
alter table public.exam_questions
  alter column points set default 1,
  alter column points set not null,
  add constraint exam_questions_points_check check (points between 0 and 1000);

-- ---------------------------------------------------------------------------
-- 2. Exam sheets can be moved to the trash (supervisors and above) and restored
-- ---------------------------------------------------------------------------

alter table public.exam_submissions
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

create index if not exists exam_submissions_exam_idx on public.exam_submissions (exam_id, start_time desc);
create index if not exists exam_submissions_user_idx on public.exam_submissions (user_id, start_time desc);
create index if not exists exam_submissions_pending_idx on public.exam_submissions (status) where deleted_at is null;
create index if not exists exam_answers_submission_idx on public.exam_answers (submission_id);
create index if not exists exam_questions_exam_idx on public.exam_questions (exam_id);
create index if not exists exam_options_question_idx on public.exam_options (question_id);

-- Candidates no longer see their sheets once they are in the trash; graders still do.
create or replace function private.has_grading_rights(_submission_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _viewer public.profiles%rowtype;
  _submission public.exam_submissions%rowtype;
  _exam public.exams%rowtype;
  _applicant public.profiles%rowtype;
  _viewer_rank integer;
begin
  select * into _submission from public.exam_submissions where id = _submission_id;
  if _submission.id is null then return false; end if;

  select * into _viewer from public.profiles where id = (select auth.uid()) and system_role <> 'pending';

  if _submission.user_id is not null and _submission.user_id = (select auth.uid()) then
    if _submission.deleted_at is null then return true; end if;
    if _viewer.id is null then return false; end if;
  end if;

  if _viewer.id is null then return false; end if;
  if coalesce(_viewer.is_bureau_manager, false) then return true; end if;

  select * into _exam from public.exams where id = _submission.exam_id;
  if _exam.id is null then return false; end if;
  _viewer_rank := private.rank_index(_viewer.faction_rank);

  if coalesce(_exam.division, '') <> '' then
    if coalesce(_viewer.is_bureau_commander, false) then return true; end if;
    if _exam.division = any(coalesce(_viewer.commanded_divisions, '{}')) then return true; end if;
  end if;

  if coalesce(_exam.division, '') = '' or _exam.type in ('trainee', 'deputy_i') then
    if _viewer_rank <= 6 then return true; end if;
    if _viewer_rank <= 8 then
      select * into _applicant from public.profiles where id = _submission.user_id;
      if _applicant.id is null or private.rank_index(_applicant.faction_rank) >= private.rank_index('Corporal') then
        return true;
      end if;
    end if;
    if 'TB' = any(coalesce(_viewer.qualifications, '{}')) then return true; end if;
  end if;

  return false;
end;
$$;

-- Same rule for the direct own-row check (kept for INSERT ... RETURNING, see the
-- security hardening migration): trashed sheets disappear for the candidate.
drop policy if exists exam_submissions_select on public.exam_submissions;
create policy exam_submissions_select on public.exam_submissions for select to authenticated
  using ((user_id = (select auth.uid()) and deleted_at is null) or private.has_grading_rights(id));

-- Supervisory staff and above, for sheets they may grade (never their own).
create or replace function private.can_trash_submission(_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_staff() and private.can_grade_submission(_submission_id)
$$;

create or replace function public.exam_submission_trash(_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not private.can_trash_submission(_submission_id) then
    raise exception 'Nincs jogosultságod törölni ezt a vizsgalapot.' using errcode = '42501';
  end if;
  update exam_submissions set deleted_at = now(), deleted_by = auth.uid()
  where id = _submission_id and deleted_at is null;
end;
$$;

create or replace function public.exam_submission_restore(_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not private.can_trash_submission(_submission_id) then
    raise exception 'Nincs jogosultságod visszaállítani ezt a vizsgalapot.' using errcode = '42501';
  end if;
  update exam_submissions set deleted_at = null, deleted_by = null
  where id = _submission_id and deleted_at is not null;
end;
$$;

-- Permanent deletion from the trash: executive staff and bureau managers only.
create or replace function public.exam_submission_purge(_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not (private.is_executive_or_manager() and private.can_grade_submission(_submission_id)) then
    raise exception 'Véglegesen csak az Executive Staff törölhet vizsgalapot.' using errcode = '42501';
  end if;
  if not exists (select 1 from exam_submissions where id = _submission_id and deleted_at is not null) then
    raise exception 'Csak a lomtárban lévő vizsgalap törölhető véglegesen.';
  end if;
  delete from exam_submissions where id = _submission_id;
end;
$$;

-- The history view: percentage was shown by the client but never provided.
create or replace view public.exam_submissions_view with (security_invoker = true) as
select s.id,
       s.start_time as created_at,
       s.exam_id,
       s.user_id,
       s.status,
       s.total_score,
       s.max_score,
       s.start_time,
       s.end_time,
       s.tab_switch_count,
       s.grading_notes,
       s.graded_at,
       s.graded_by,
       s.feedback_visible,
       e.title as exam_title,
       p.full_name as user_full_name,
       p.badge_number as user_badge_number,
       s.applicant_name,
       case when coalesce(s.max_score, 0) > 0
            then round(100.0 * coalesce(s.total_score, 0) / s.max_score)::integer end as percentage,
       s.deleted_at,
       s.deleted_by,
       e.type as exam_type,
       e.division as exam_division
from public.exam_submissions s
join public.exams e on s.exam_id = e.id
left join public.profiles p on s.user_id = p.id;

-- ---------------------------------------------------------------------------
-- 3. Server-side exam submission
-- ---------------------------------------------------------------------------

-- Guest claim code: TR-XXXX-XXXX from 32 unambiguous characters.
create or replace function private.new_claim_token()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  _alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  _bytes bytea := extensions.gen_random_bytes(8);
  _chars text := '';
begin
  for i in 0..7 loop
    _chars := _chars || substr(_alphabet, (get_byte(_bytes, i) % 32) + 1, 1);
  end loop;
  return 'TR-' || substr(_chars, 1, 4) || '-' || substr(_chars, 5, 4);
end;
$$;

-- Validates access and stores the sheet with its answers in one transaction. The
-- maximum score is computed here, and the candidate never needs the answer key.
-- _answers: {"<question id>": {"text": "..."} | {"options": ["<option id>", ...]}}
create or replace function public.submit_exam(
  _exam_id uuid,
  _answers jsonb,
  _applicant_name text default null,
  _started_at timestamptz default null,
  _tab_switch_count integer default 0,
  -- When the time is up the sheet is handed in as it is.
  _allow_incomplete boolean default false
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _uid uuid := auth.uid();
  _me profiles%rowtype;
  _exam exams%rowtype;
  _override text;
  _last exam_submissions%rowtype;
  _is_member boolean;
  _name text;
  _token text;
  _started timestamptz;
  _max integer;
  _submission_id uuid;
  _missing integer;
  _answer jsonb := coalesce(_answers, '{}'::jsonb);
begin
  select * into _exam from exams where id = _exam_id;
  if _exam.id is null then raise exception 'A vizsga nem található.'; end if;
  if not coalesce(_exam.is_active, false) then raise exception 'A vizsga jelenleg nem fogad kitöltéseket.'; end if;
  if jsonb_typeof(_answer) <> 'object' then raise exception 'Érvénytelen válaszok.'; end if;

  if _uid is not null then select * into _me from profiles where id = _uid; end if;
  _is_member := _me.id is not null and _me.system_role <> 'pending';

  if not _is_member then
    if not coalesce(_exam.is_public, false) then
      raise exception 'Ehhez a vizsgához bejelentkezés szükséges.' using errcode = '42501';
    end if;
    -- Flood protection for the public (guest) form.
    if (select count(*) from exam_submissions
        where exam_id = _exam_id and user_id is null and start_time > now() - interval '10 minutes') >= 15 then
      raise exception 'Túl sok kitöltés érkezett. Próbáld újra néhány perc múlva.';
    end if;
  else
    select access_type into _override from exam_overrides where exam_id = _exam_id and user_id = _uid;
    if _override = 'deny' then raise exception 'Ehhez a vizsgához nincs hozzáférésed.' using errcode = '42501'; end if;
    if coalesce(_exam.is_invitation_only, false) and _override is distinct from 'allow' then
      raise exception 'Ez a vizsga meghívásos.' using errcode = '42501';
    end if;
    if _override is distinct from 'allow' and not private.can_manage_exam_access(_exam.type, _exam.division) then
      if _exam.type = 'trainee' then raise exception 'Ez a vizsga a felvételizőknek szól.' using errcode = '42501'; end if;
      if _exam.type = 'deputy_i' and private.rank_index(_me.faction_rank) <= private.rank_index('Deputy Sheriff I.') then
        raise exception 'Ezt a vizsgát már teljesítetted.' using errcode = '42501';
      end if;
      if not coalesce(_exam.is_public, false) then
        if _exam.division in ('TSB', 'SEB', 'MCB') and _me.division <> 'TSB' and _me.division <> _exam.division then
          raise exception 'Ez a vizsga másik osztály tagjainak szól.' using errcode = '42501';
        end if;
        if _exam.required_rank is not null and private.rank_index(_exam.required_rank) <> 999
           and private.rank_index(_me.faction_rank) > private.rank_index(_exam.required_rank) then
          raise exception 'Ehhez a vizsgához legalább % rendfokozat szükséges.', _exam.required_rank using errcode = '42501';
        end if;
      end if;
    end if;

    select * into _last from exam_submissions
    where exam_id = _exam_id and user_id = _uid and deleted_at is null
    order by start_time desc limit 1;
    if _last.id is not null and _last.status = 'pending' then
      raise exception 'A vizsga egy korábbi kitöltése még javításra vár.';
    end if;
    if _last.id is not null and _last.status = 'failed' and _last.retry_allowed_at > now() then
      raise exception 'Újrapróbálkozás csak % után lehetséges.',
        to_char(_last.retry_allowed_at at time zone 'Europe/Budapest', 'YYYY.MM.DD. HH24:MI');
    end if;
  end if;

  _name := regexp_replace(trim(coalesce(case when _me.id is not null then _me.full_name end, _applicant_name, '')), '\s+', ' ', 'g');
  if char_length(_name) < 3 or char_length(_name) > 64 then
    raise exception 'Add meg a teljes neved (3–64 karakter).';
  end if;

  -- Required questions.
  select count(*) into _missing
  from exam_questions q
  where q.exam_id = _exam_id and coalesce(q.is_required, true)
    and not (
      (q.question_type = 'text' and char_length(trim(coalesce(_answer -> q.id::text ->> 'text', ''))) > 0)
      or (q.question_type <> 'text' and jsonb_array_length(coalesce(_answer -> q.id::text -> 'options', '[]'::jsonb)) > 0)
    );
  if _missing > 0 and not coalesce(_allow_incomplete, false) then
    raise exception 'Még % kötelező kérdésre nem válaszoltál.', _missing;
  end if;

  _started := least(coalesce(_started_at, now()), now());
  _started := greatest(_started, now() - make_interval(mins => coalesce(_exam.time_limit_minutes, 60) + 10));
  select coalesce(sum(points), 0) into _max from exam_questions where exam_id = _exam_id;
  if _me.id is null then _token := private.new_claim_token(); end if;

  insert into exam_submissions (exam_id, user_id, applicant_name, start_time, end_time, tab_switch_count,
                                status, max_score, total_score, claim_token)
  values (_exam_id, _me.id, _name, _started, now(), greatest(coalesce(_tab_switch_count, 0), 0),
          'pending', _max, 0, _token)
  returning id into _submission_id;

  insert into exam_answers (submission_id, question_id, answer_text, selected_option_ids, points_awarded)
  select _submission_id, q.id,
         case when q.question_type = 'text' then left(coalesce(_answer -> q.id::text ->> 'text', ''), 5000) end,
         case when q.question_type <> 'text' then (
           select coalesce(array_agg(o.id order by o.id), '{}')
           from exam_options o
           where o.question_id = q.id
             and o.id::text in (select jsonb_array_elements_text(
               case when jsonb_typeof(_answer -> q.id::text -> 'options') = 'array'
                    then _answer -> q.id::text -> 'options' else '[]'::jsonb end))
         ) end,
         0
  from exam_questions q
  where q.exam_id = _exam_id;

  -- A single-choice question keeps one option at most.
  update exam_answers a set selected_option_ids = a.selected_option_ids[1:1]
  from exam_questions q
  where a.submission_id = _submission_id and q.id = a.question_id
    and q.question_type = 'single_choice' and cardinality(a.selected_option_ids) > 1;

  return json_build_object('id', _submission_id, 'claim_token', _token);
end;
$$;

-- Saves every question and option of an exam in one transaction (the editor used to
-- send a handful of requests, and an upsert of exam_options would need read access to
-- the answer key). Rows missing from the list are deleted; ids that are not uuids of
-- this exam (the editor's temporary ids) become new rows.
-- _questions: [{id, question_text, question_type, points, is_required, page_number,
--               options: [{id, option_text, is_correct}]}]  (order = order_index)
create or replace function public.save_exam_questions(_exam_id uuid, _questions jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _exam exams%rowtype;
  _question jsonb;
  _option jsonb;
  _question_id uuid;
  _option_id uuid;
  _type text;
  _kept_questions uuid[] := '{}';
  _kept_options uuid[];
  _index integer := 0;
  _uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  select * into _exam from exams where id = _exam_id;
  if _exam.id is null then raise exception 'A vizsga nem található.'; end if;
  if not private.can_manage_exam_content(_exam.type, _exam.division) then
    raise exception 'Nincs jogosultságod szerkeszteni ezt a vizsgát.' using errcode = '42501';
  end if;
  if jsonb_typeof(_questions) <> 'array' or jsonb_array_length(_questions) = 0 then
    raise exception 'A vizsgának legalább egy kérdése kell legyen.';
  end if;

  for _question in select value from jsonb_array_elements(_questions) loop
    _type := _question ->> 'question_type';
    if _type not in ('text', 'single_choice', 'multiple_choice') then raise exception 'Ismeretlen kérdéstípus.'; end if;
    if char_length(trim(coalesce(_question ->> 'question_text', ''))) = 0 then raise exception 'Üres kérdés nem menthető.'; end if;

    _question_id := case when (_question ->> 'id') ~* _uuid then (_question ->> 'id')::uuid end;
    if _question_id is not null and not exists (select 1 from exam_questions where id = _question_id and exam_id = _exam_id) then
      _question_id := null;
    end if;

    if _question_id is null then
      insert into exam_questions (exam_id, question_text, question_type, points, order_index, is_required, page_number)
      values (_exam_id, left(_question ->> 'question_text', 2000), _type,
              least(greatest(coalesce((_question ->> 'points')::integer, 1), 0), 1000), _index,
              coalesce((_question ->> 'is_required')::boolean, true), greatest(coalesce((_question ->> 'page_number')::integer, 1), 1))
      returning id into _question_id;
    else
      update exam_questions set
        question_text = left(_question ->> 'question_text', 2000),
        question_type = _type,
        points = least(greatest(coalesce((_question ->> 'points')::integer, 1), 0), 1000),
        order_index = _index,
        is_required = coalesce((_question ->> 'is_required')::boolean, true),
        page_number = greatest(coalesce((_question ->> 'page_number')::integer, 1), 1)
      where id = _question_id;
    end if;
    _kept_questions := _kept_questions || _question_id;

    _kept_options := '{}';
    if _type <> 'text' then
      for _option in select value from jsonb_array_elements(coalesce(_question -> 'options', '[]'::jsonb)) loop
        _option_id := case when (_option ->> 'id') ~* _uuid then (_option ->> 'id')::uuid end;
        if _option_id is not null and not exists (select 1 from exam_options where id = _option_id and question_id = _question_id) then
          _option_id := null;
        end if;
        if _option_id is null then
          insert into exam_options (question_id, option_text, is_correct)
          values (_question_id, left(coalesce(_option ->> 'option_text', ''), 1000), coalesce((_option ->> 'is_correct')::boolean, false))
          returning id into _option_id;
        else
          update exam_options set option_text = left(coalesce(_option ->> 'option_text', ''), 1000),
                                  is_correct = coalesce((_option ->> 'is_correct')::boolean, false)
          where id = _option_id;
        end if;
        _kept_options := _kept_options || _option_id;
      end loop;
    end if;
    delete from exam_options where question_id = _question_id and not (id = any(_kept_options));
    _index := _index + 1;
  end loop;

  delete from exam_questions where exam_id = _exam_id and not (id = any(_kept_questions));
end;
$$;

-- Correct options of an exam: for its editors and graders, and for a candidate whose
-- graded sheet has detailed feedback enabled.
create or replace function public.get_exam_answer_key(_exam_id uuid)
returns table (option_id uuid, is_correct boolean)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  _exam exams%rowtype;
begin
  select * into _exam from exams where id = _exam_id;
  if _exam.id is null then return; end if;
  if not (private.can_manage_exam_content(_exam.type, _exam.division)
          or private.can_manage_exam_access(_exam.type, _exam.division)
          or exists (select 1 from exam_submissions s
                     where s.exam_id = _exam_id and s.user_id = auth.uid() and s.deleted_at is null
                       and s.status in ('passed', 'failed') and coalesce(s.feedback_visible, false))) then
    raise exception 'Nincs jogosultságod a megoldókulcshoz.' using errcode = '42501';
  end if;
  return query
    select o.id, coalesce(o.is_correct, false)
    from exam_options o join exam_questions q on q.id = o.question_id
    where q.exam_id = _exam_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. HR: profile changes made by the API (service role) with the acting member
-- ---------------------------------------------------------------------------

-- The API validates every change with shared/ranks.ts first; this function only
-- applies it, so the triggers can record who made the change.
create or replace function public.hr_apply_member_update(_actor uuid, _target uuid, _changes jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _old_name text;
begin
  perform set_config('app.actor_id', coalesce(_actor::text, ''), true);
  select full_name into _old_name from profiles where id = _target;
  if not found then raise exception 'A felhasználó nem található.'; end if;

  update profiles set
    full_name = coalesce(_changes ->> 'full_name', full_name),
    badge_number = coalesce(_changes ->> 'badge_number', badge_number),
    faction_rank = coalesce(_changes ->> 'faction_rank', faction_rank),
    system_role = coalesce(_changes ->> 'system_role', system_role),
    division = coalesce(_changes ->> 'division', division),
    division_rank = case when _changes ? 'division_rank' then nullif(_changes ->> 'division_rank', '') else division_rank end,
    qualifications = case when _changes ? 'qualifications'
      then array(select jsonb_array_elements_text(_changes -> 'qualifications')) else qualifications end,
    is_bureau_manager = coalesce((_changes ->> 'is_bureau_manager')::boolean, is_bureau_manager),
    is_bureau_commander = coalesce((_changes ->> 'is_bureau_commander')::boolean, is_bureau_commander),
    commanded_divisions = case when _changes ? 'commanded_divisions'
      then array(select jsonb_array_elements_text(_changes -> 'commanded_divisions')) else commanded_divisions end,
    last_promotion_date = case when _changes ? 'last_promotion_date'
      then (_changes ->> 'last_promotion_date')::timestamptz else last_promotion_date end
  where id = _target;

  if _changes ? 'full_name' and (_changes ->> 'full_name') is distinct from _old_name then
    insert into name_change_logs (user_id, old_name, new_name, changed_by)
    values (_target, _old_name, _changes ->> 'full_name', _actor);
  end if;
end;
$$;

-- Current and upcoming approved leave (dates only), for the roster of every member.
create or replace function public.get_active_leaves()
returns table (user_id uuid, starts_on date, ends_on date)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.user_id, r.starts_on, r.ends_on
  from hr_records r
  where private.is_member() and r.kind = 'leave' and r.status = 'active'
    and r.ends_on >= current_date and r.starts_on <= current_date + 30
$$;

-- When members were last active (sign-in or session refresh), for HR staff only.
create or replace function public.get_member_last_seen()
returns table (user_id uuid, last_seen_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id,
         greatest(u.last_sign_in_at,
                  (select max(greatest(s.updated_at, s.refreshed_at at time zone 'UTC'))
                   from auth.sessions s where s.user_id = u.id))
  from auth.users u
  join profiles p on p.id = u.id
  where private.is_staff()
$$;

-- ---------------------------------------------------------------------------
-- 5. Dashboard and case editor
-- ---------------------------------------------------------------------------

-- Announcements without leaking hidden authors (only executives and the author see them).
create or replace function public.get_announcements(_limit integer default 20)
returns table (
  id uuid, title text, content text, type text, is_pinned boolean, show_author boolean,
  created_at timestamptz, created_by uuid, author_name text, author_rank text,
  author_category text, can_delete boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with viewer as (select private.me() as p)
  select a.id, a.title, a.content, a.type, coalesce(a.is_pinned, false), coalesce(a.show_author, true), a.created_at,
         case when revealed then a.created_by end,
         case when revealed then pr.full_name end,
         case when revealed then pr.faction_rank end,
         case when private.rank_index(pr.faction_rank) <= 1 then 'executive'
              when private.rank_index(pr.faction_rank) <= 6 then 'command'
              when private.rank_index(pr.faction_rank) <= 8 then 'supervisory'
              else 'field' end,
         (a.created_by = (v.p).id or (v.p).system_role = 'admin' or coalesce((v.p).is_bureau_manager, false))
  from announcements a
  cross join viewer v
  left join profiles pr on pr.id = a.created_by
  cross join lateral (select coalesce(a.show_author, true)
                          or a.created_by = (v.p).id
                          or private.rank_index((v.p).faction_rank) <= 1
                          or coalesce((v.p).is_bureau_manager, false) as revealed) r
  where (v.p).id is not null
  order by coalesce(a.is_pinned, false) desc, a.created_at desc
  limit least(greatest(coalesce(_limit, 20), 1), 50)
$$;

-- Everything the dashboard's "to do" cards need, in one request instead of eight.
-- Counts the caller is not allowed to act on come back as null.
create or replace function public.get_dashboard_summary()
returns json
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  _me profiles%rowtype := private.me();
  _staff boolean;
  _admin boolean;
begin
  if _me.id is null then
    raise exception 'Nincs jogosultságod.' using errcode = '42501';
  end if;
  _staff := private.is_staff();
  _admin := private.is_admin();

  return json_build_object(
    'unread_notifications', (select count(*) from notifications where user_id = _me.id and not is_read),
    'pending_exam_sheets', (select count(*) from exam_submissions s
                            where s.status = 'pending' and s.deleted_at is null
                              and s.user_id is distinct from _me.id and private.has_grading_rights(s.id)),
    'pending_registrations', case when _staff then (select count(*) from profiles where system_role = 'pending') end,
    'pending_leave_requests', case when _staff then
      (select count(*) from hr_records where kind = 'leave' and status = 'pending' and user_id <> _me.id) end,
    'pending_vehicle_requests', case when _staff then (select count(*) from vehicle_requests where status = 'pending') end,
    'pending_budget_requests', case when _admin then (select count(*) from budget_requests where status = 'pending') end,
    'pending_warrants', case when private.can_approve_warrants() then
      (select count(*) from case_warrants where status = 'pending') end,
    'my_open_cases', case when private.can_view_cases() or exists (select 1 from case_collaborators where user_id = _me.id) then
      (select count(*) from cases c where c.status = 'open'
         and (c.owner_id = _me.id or exists (select 1 from case_collaborators cc where cc.case_id = c.id and cc.user_id = _me.id))) end,
    'my_pending_requests', (select count(*) from vehicle_requests where user_id = _me.id and status = 'pending')
                           + (select count(*) from budget_requests where user_id = _me.id and status = 'pending'),
    'my_active_warnings', (select count(*) from hr_records where user_id = _me.id and kind = 'warning' and status = 'active'),
    'members_total', (select count(*) from profiles where system_role <> 'pending'),
    'members_on_leave', (select count(*) from hr_records where kind = 'leave' and status = 'active'
                           and current_date between starts_on and ends_on)
  );
end;
$$;

-- @mentions in the case editor: the editor saves, then notifies the newly mentioned
-- members who can open the case.
create or replace function public.notify_case_mentions(_case_id uuid, _user_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _case cases%rowtype;
  _recipients uuid[];
begin
  if not private.can_edit_case(_case_id) then
    raise exception 'Nincs jogosultságod ehhez az aktához.' using errcode = '42501';
  end if;
  select * into _case from cases where id = _case_id;

  select coalesce(array_agg(p.id), '{}') into _recipients
  from profiles p
  where p.id = any(coalesce(_user_ids[1:50], '{}')) and p.system_role <> 'pending'
    and (p.division = 'MCB' or p.system_role in ('admin', 'supervisor') or coalesce(p.is_bureau_manager, false)
         or p.id = _case.owner_id
         or exists (select 1 from case_collaborators cc where cc.case_id = _case_id and cc.user_id = p.id));

  return private.notify(_recipients, 'Megemlítettek egy aktában',
    format('%s – %s (%s)', _case.case_number, _case.title, private.member_name(auth.uid())),
    'info', 'mcb', '/mcb/case/' || _case_id, 'case-mention:' || _case_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Privileges
-- ---------------------------------------------------------------------------

revoke execute on function
  public.exam_submission_trash(uuid), public.exam_submission_restore(uuid), public.exam_submission_purge(uuid),
  public.submit_exam(uuid, jsonb, text, timestamptz, integer, boolean), public.get_exam_answer_key(uuid),
  public.save_exam_questions(uuid, jsonb),
  public.hr_apply_member_update(uuid, uuid, jsonb), public.get_active_leaves(), public.get_member_last_seen(),
  public.get_announcements(integer), public.notify_case_mentions(uuid, uuid[]), public.get_dashboard_summary()
from public, anon, authenticated;

grant execute on function public.submit_exam(uuid, jsonb, text, timestamptz, integer, boolean) to anon, authenticated;
grant execute on function
  public.exam_submission_trash(uuid), public.exam_submission_restore(uuid), public.exam_submission_purge(uuid),
  public.get_exam_answer_key(uuid), public.get_active_leaves(), public.get_member_last_seen(),
  public.get_announcements(integer), public.notify_case_mentions(uuid, uuid[]), public.get_dashboard_summary(),
  public.save_exam_questions(uuid, jsonb)
to authenticated;
grant execute on function public.hr_apply_member_update(uuid, uuid, jsonb) to service_role;

revoke execute on function private.new_claim_token(), private.can_trash_submission(uuid) from public, anon, authenticated;
grant execute on function private.can_trash_submission(uuid) to authenticated;
