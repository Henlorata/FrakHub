-- Exam overhaul.
--
-- * Attempts live on the server. start_exam() creates the sheet (status 'in_progress') with a
--   server-side deadline and returns the questions without the answer key; the answers are
--   saved while the candidate works (save_exam_progress) and finish_exam() hands the sheet in.
--   A reload or another device continues the same attempt, and the clock is the server's.
-- * Question pools (exam_pages.draw_count) and per-attempt shuffling of questions and options.
-- * Choice questions are scored when the sheet is handed in; grade_exam_submission() stores the
--   grader's points, per-question comments and the decision in one call and computes the total.
-- * Answer guides for the graders (exam_question_guides), never sent to candidates.
-- * Integrity log: facts (time spent away from the page, pasted characters, copying, lost
--   connection), shown to the grader as a timeline instead of a warning counter.
--
-- Compatible with the deployed frontend (main), which still inserts sheets and edits exams
-- through the tables; supabase/post-deploy/ removes those paths once the new frontend is live.

-- ---------------------------------------------------------------------------
-- 1. Exam settings, pages, option order and answer guides
-- ---------------------------------------------------------------------------

alter table public.exams
  add column if not exists shuffle_questions boolean not null default false,
  add column if not exists shuffle_options boolean not null default false,
  add column if not exists block_clipboard boolean not null default false,
  add column if not exists auto_grade boolean not null default false,
  add column if not exists retry_cooldown_hours integer not null default 0;

alter table public.exams
  add constraint exams_time_limit_check check (time_limit_minutes between 1 and 240),
  add constraint exams_passing_percentage_check check (passing_percentage between 1 and 100),
  add constraint exams_min_days_in_rank_check check (min_days_in_rank between 0 and 365),
  add constraint exams_retry_cooldown_check check (retry_cooldown_hours between 0 and 720);

-- Options had no order: the order they were inserted in is kept.
alter table public.exam_options add column if not exists order_index integer;
update public.exam_options o set order_index = r.position
from (select id, row_number() over (partition by question_id order by ctid) - 1 as position from public.exam_options) r
where r.id = o.id;

-- The old editor inserts options without a position: they go to the end.
create or replace function private.exam_option_default_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.order_index is null then
    select coalesce(max(order_index) + 1, 0) into new.order_index
    from public.exam_options where question_id = new.question_id;
  end if;
  return new;
end;
$$;

create trigger exam_option_default_order before insert on public.exam_options
  for each row execute function private.exam_option_default_order();
alter table public.exam_options alter column order_index set not null;

-- Questions and options that sheets already answered are archived instead of deleted when the
-- exam is edited, so a graded sheet never loses its answers. New attempts skip them.
alter table public.exam_questions add column if not exists archived_at timestamptz;
alter table public.exam_options add column if not exists archived_at timestamptz;

-- Optional page title and description, and the question pool: draw_count questions are drawn
-- at random from the page for every attempt (null: all of them).
create table public.exam_pages (
  exam_id uuid not null references public.exams(id) on delete cascade,
  page_number integer not null check (page_number between 1 and 50),
  title text check (char_length(title) <= 120),
  description text check (char_length(description) <= 1000),
  draw_count integer check (draw_count between 1 and 200),
  primary key (exam_id, page_number)
);

-- What a good answer contains: shown to the graders only.
create table public.exam_question_guides (
  question_id uuid primary key references public.exam_questions(id) on delete cascade,
  guide text not null check (char_length(guide) between 1 and 4000)
);

alter table public.exam_pages enable row level security;
alter table public.exam_question_guides enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Attempts on the exam sheet
-- ---------------------------------------------------------------------------

alter table public.exam_submissions
  add column if not exists deadline timestamptz,
  -- The attempt's questions in the order the candidate sees them (null: an old sheet, see
  -- private.exam_sheet_question_ids).
  add column if not exists question_ids uuid[],
  -- Guests prove an attempt is theirs with a random secret; only its hash is stored.
  add column if not exists access_secret_hash text,
  add column if not exists last_seen_at timestamptz,
  add column if not exists finish_reason text,
  add column if not exists integrity_log jsonb not null default '[]'::jsonb,
  add column if not exists integrity jsonb not null default '{}'::jsonb;

alter table public.exam_submissions
  add constraint exam_submissions_status_check check (status in ('in_progress', 'pending', 'grading', 'passed', 'failed')),
  add constraint exam_submissions_finish_reason_check check (finish_reason in ('submitted', 'time_up', 'expired'));

-- One open attempt per member and exam.
create unique index exam_submissions_open_attempt_key on public.exam_submissions (exam_id, user_id)
  where status = 'in_progress' and user_id is not null and deleted_at is null;
create index exam_submissions_open_deadline_idx on public.exam_submissions (deadline) where status = 'in_progress';

alter table public.exam_answers
  add column if not exists grader_comment text,
  -- Characters pasted into the answer (integrity log), the highest count seen.
  add column if not exists pasted_chars integer not null default 0;

alter table public.exam_answers
  alter column submission_id set not null,
  alter column question_id set not null,
  add constraint exam_answers_grader_comment_check check (char_length(grader_comment) <= 2000),
  add constraint exam_answers_pasted_chars_check check (pasted_chars between 0 and 100000),
  add constraint exam_answers_submission_question_key unique (submission_id, question_id);
-- The unique index also serves the lookups by sheet.
drop index if exists public.exam_answers_submission_idx;

-- ---------------------------------------------------------------------------
-- 3. Helpers
-- ---------------------------------------------------------------------------

-- Late requests (slow network, a laptop waking up) are accepted this long after the deadline.
create or replace function private.exam_grace()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '90 seconds' $$;

create or replace function private.secret_hash(_secret text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when char_length(_secret) >= 32 then encode(extensions.digest(_secret, 'sha256'), 'hex') end
$$;

-- A whole number from a JSON value, clamped; null when it is not a number.
create or replace function private.json_int(_value jsonb, _min bigint, _max bigint)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(_value) = 'number'
              then least(greatest(floor((_value #>> '{}')::numeric), _min), _max)::bigint end
$$;

create or replace function private.json_bool(_value jsonb, _default boolean)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(_value) = 'boolean' then (_value #>> '{}')::boolean else _default end
$$;

-- Editors and access managers of an exam: they see the answer key, the guides and the pages.
create or replace function private.can_view_exam_key(_exam_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.exams e
    where e.id = _exam_id
      and (private.can_manage_exam_content(e.type, e.division) or private.can_manage_exam_access(e.type, e.division))
  )
$$;

create policy exam_pages_select on public.exam_pages for select to authenticated
  using (private.can_view_exam_key(exam_id));
create policy exam_question_guides_select on public.exam_question_guides for select to authenticated
  using (exists (select 1 from public.exam_questions q where q.id = question_id and private.can_view_exam_key(q.exam_id)));
-- Written by save_exam() only.
revoke all on public.exam_pages, public.exam_question_guides from anon, authenticated;
grant select on public.exam_pages, public.exam_question_guides to authenticated;

-- Questions per attempt (pools draw fewer than the page holds).
create or replace function private.exam_question_count(_exam_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(case when p.draw_count is null then c.total else least(c.total, p.draw_count) end), 0)::integer
  from (select coalesce(q.page_number, 1) as page_number, count(*) as total
        from public.exam_questions q where q.exam_id = _exam_id and q.archived_at is null group by 1) c
  left join public.exam_pages p on p.exam_id = _exam_id and p.page_number = c.page_number
$$;

-- The sheet's questions in display order. Old sheets (before attempts) list the questions they
-- have answers for, or the exam's current questions when they have none.
create or replace function private.exam_sheet_question_ids(_s public.exam_submissions)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(_s.question_ids, (
    select coalesce(array_agg(q.id order by coalesce(q.page_number, 1), coalesce(q.order_index, 0), q.id), '{}')
    from public.exam_questions q
    where q.exam_id = _s.exam_id
      and (exists (select 1 from public.exam_answers a where a.submission_id = _s.id and a.question_id = q.id)
           or (q.archived_at is null and not exists (select 1 from public.exam_answers a where a.submission_id = _s.id)))))
$$;

-- Points of a choice answer: every correct option and nothing else (null for text questions).
create or replace function private.exam_auto_points(_question_id uuid, _type text, _points integer, _selected uuid[])
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when _type = 'text' then null
    when coalesce(_points, 0) = 0 or coalesce(cardinality(_selected), 0) = 0 then 0
    when (select coalesce(array_agg(o.id order by o.id), '{}') from public.exam_options o
          where o.question_id = _question_id and o.is_correct and o.archived_at is null)
         = (select array_agg(distinct x order by x) from unnest(_selected) x) then _points
    else 0
  end
$$;

-- Why _uid (null: a guest) may not start a new attempt: {"code", "message"[, "until"]}, or null.
-- The rules of the old submit_exam(), plus the minimum days in rank, and a passed exam is not
-- repeated without a new invitation.
create or replace function private.exam_block(_exam public.exams, _uid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _me public.profiles%rowtype;
  _override text;
  _last public.exam_submissions%rowtype;
  _available_from timestamptz;
begin
  if _exam.id is null then
    return jsonb_build_object('code', 'missing', 'message', 'A vizsga nem található.');
  end if;
  if not coalesce(_exam.is_active, false) then
    return jsonb_build_object('code', 'inactive', 'message', 'A vizsga jelenleg nem fogad kitöltéseket.');
  end if;
  if not exists (select 1 from public.exam_questions where exam_id = _exam.id and archived_at is null) then
    return jsonb_build_object('code', 'empty', 'message', 'A vizsgának még nincsenek kérdései.');
  end if;
  if _uid is not null then select * into _me from public.profiles where id = _uid; end if;

  if _me.id is null or _me.system_role = 'pending' then
    if not coalesce(_exam.is_public, false) then
      return jsonb_build_object('code', 'login', 'message', 'Ehhez a vizsgához bejelentkezés szükséges.');
    end if;
  else
    select access_type into _override from public.exam_overrides where exam_id = _exam.id and user_id = _uid;
    if _override = 'deny' then
      return jsonb_build_object('code', 'denied', 'message', 'Ehhez a vizsgához nincs hozzáférésed.');
    end if;
    if coalesce(_exam.is_invitation_only, false) and _override is distinct from 'allow' then
      return jsonb_build_object('code', 'invitation', 'message', 'Meghívásos vizsga: egy oktató adhat hozzáférést.');
    end if;
    if _override is distinct from 'allow' and not private.can_manage_exam_access(_exam.type, _exam.division) then
      if _exam.type = 'trainee' then
        return jsonb_build_object('code', 'recruits', 'message', 'Ez a vizsga a felvételizőknek szól.');
      end if;
      if _exam.type = 'deputy_i' and private.rank_index(_me.faction_rank) <= private.rank_index('Deputy Sheriff I.') then
        return jsonb_build_object('code', 'completed', 'message', 'Ezt a vizsgát már teljesítetted.');
      end if;
      if not coalesce(_exam.is_public, false) then
        if _exam.division in ('TSB', 'SEB', 'MCB') and _me.division <> 'TSB' and _me.division <> _exam.division then
          return jsonb_build_object('code', 'division', 'message', 'Ez a vizsga másik osztály tagjainak szól.');
        end if;
        if _exam.required_rank is not null and private.rank_index(_exam.required_rank) <> 999
           and private.rank_index(_me.faction_rank) > private.rank_index(_exam.required_rank) then
          return jsonb_build_object('code', 'rank',
            'message', format('Ehhez a vizsgához legalább %s rendfokozat szükséges.', _exam.required_rank));
        end if;
        _available_from := _me.last_promotion_date + make_interval(days => coalesce(_exam.min_days_in_rank, 0));
        if coalesce(_exam.min_days_in_rank, 0) > 0 and _available_from > now() then
          return jsonb_build_object('code', 'days', 'until', _available_from,
            'message', format('A vizsgához %s nap kell a jelenlegi rendfokozatban. Elérhető: %s', _exam.min_days_in_rank,
                              to_char(_available_from at time zone 'Europe/Budapest', 'YYYY.MM.DD.')));
        end if;
      end if;
    end if;
  end if;

  if _uid is not null then
    select * into _last from public.exam_submissions
    where exam_id = _exam.id and user_id = _uid and deleted_at is null and status <> 'in_progress'
    order by start_time desc limit 1;
    if _last.status in ('pending', 'grading') then
      return jsonb_build_object('code', 'pending', 'message', 'A legutóbbi kitöltésed javításra vár.');
    end if;
    if _last.status = 'passed' and _override is distinct from 'allow' then
      return jsonb_build_object('code', 'passed', 'message', 'Ezt a vizsgát már sikeresen teljesítetted.');
    end if;
    if _last.status = 'failed' and _last.retry_allowed_at > now() then
      return jsonb_build_object('code', 'cooldown', 'until', _last.retry_allowed_at,
        'message', format('Újra %s után próbálkozhatsz.',
                          to_char(_last.retry_allowed_at at time zone 'Europe/Budapest', 'YYYY.MM.DD. HH24:MI')));
    end if;
  end if;
  return null;
end;
$$;

-- The questions of a new attempt: pools are drawn per page, the order is shuffled within each
-- page when the exam asks for it. _seed (the new sheet's id) makes both repeatable.
create or replace function private.exam_draw(_exam public.exams, _seed uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(t.id order by t.page_number, t.shuffle_key, t.order_index, t.id), '{}')
  from (
    select q.id, coalesce(q.page_number, 1) as page_number, coalesce(q.order_index, 0) as order_index,
           case when _exam.shuffle_questions then md5(_seed::text || q.id::text) end as shuffle_key,
           row_number() over (partition by coalesce(q.page_number, 1) order by md5(_seed::text || ':' || q.id::text)) as draw_rank,
           p.draw_count
    from public.exam_questions q
    left join public.exam_pages p on p.exam_id = q.exam_id and p.page_number = coalesce(q.page_number, 1)
    where q.exam_id = _exam.id and q.archived_at is null
  ) t
  where t.draw_count is null or t.draw_rank <= t.draw_count
$$;

-- The questions of a sheet as JSON, in the candidate's order. Options are shuffled per sheet
-- when the exam asks for it (the same order on every load). The answer key, the guides and the
-- automatic points are only included on request.
create or replace function private.exam_questions_json(_s public.exam_submissions, _shuffle_options boolean,
                                                       _with_key boolean, _for_grader boolean)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'page_number', coalesce(q.page_number, 1),
      'question_text', q.question_text,
      'question_type', q.question_type,
      'points', q.points,
      'is_required', coalesce(q.is_required, true),
      'options', coalesce((
        select jsonb_agg(jsonb_build_object('id', o.id, 'option_text', o.option_text)
                         || case when _with_key then jsonb_build_object('is_correct', coalesce(o.is_correct, false)) else '{}'::jsonb end
                         order by case when _shuffle_options then md5(_s.id::text || o.id::text) end, o.order_index, o.id)
        from public.exam_options o
        -- An archived option only appears where this sheet chose it.
        where o.question_id = q.id
          and (o.archived_at is null or o.id = any(coalesce((select a.selected_option_ids from public.exam_answers a
                                                            where a.submission_id = _s.id and a.question_id = q.id), '{}')))), '[]'::jsonb),
      'answer', (select jsonb_build_object('text', a.answer_text, 'options', coalesce(to_jsonb(a.selected_option_ids), '[]'::jsonb),
                                           'points', a.points_awarded, 'comment', a.grader_comment, 'pasted', a.pasted_chars)
                 from public.exam_answers a where a.submission_id = _s.id and a.question_id = q.id)
    )
    || case when _for_grader then jsonb_build_object(
         'guide', (select g.guide from public.exam_question_guides g where g.question_id = q.id),
         'auto_points', (select private.exam_auto_points(q.id, q.question_type, q.points, a.selected_option_ids)
                         from public.exam_answers a where a.submission_id = _s.id and a.question_id = q.id))
       else '{}'::jsonb end
    order by t.ord), '[]'::jsonb)
  from unnest(private.exam_sheet_question_ids(_s)) with ordinality as t(id, ord)
  join public.exam_questions q on q.id = t.id
$$;

-- Saves answers of an open attempt.
-- _answers: {"<question id>": {"text": "...", "options": ["<option id>", ...], "pasted": <chars>}}
create or replace function private.exam_store_answers(_s public.exam_submissions, _answers jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if _answers is null or jsonb_typeof(_answers) <> 'object' then return; end if;
  insert into public.exam_answers (submission_id, question_id, answer_text, selected_option_ids, pasted_chars)
  select _s.id, q.id,
         case when q.question_type = 'text' then left(coalesce(a.value ->> 'text', ''), 5000) end,
         case when q.question_type = 'single_choice' then sel.ids[1:1] when q.question_type <> 'text' then sel.ids end,
         coalesce(private.json_int(a.value -> 'pasted', 0, 100000), 0)
  from jsonb_each(_answers) a
  join public.exam_questions q on q.id::text = a.key and q.id = any(_s.question_ids)
  cross join lateral (
    select coalesce(array_agg(o.id order by o.order_index, o.id), '{}') as ids
    from public.exam_options o
    where o.question_id = q.id and o.archived_at is null
      and jsonb_typeof(a.value -> 'options') = 'array' and (a.value -> 'options') ? o.id::text
  ) sel
  where jsonb_typeof(a.value) = 'object'
  on conflict (submission_id, question_id) do update set
    answer_text = excluded.answer_text,
    selected_option_ids = excluded.selected_option_ids,
    pasted_chars = greatest(public.exam_answers.pasted_chars, excluded.pasted_chars);
end;
$$;

-- Totals of the integrity log; tab_switch_count keeps the number of times the page was left.
create or replace function private.exam_summarize_integrity(_submission_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.exam_submissions s set
    integrity = summary.value,
    tab_switch_count = (summary.value ->> 'away_count')::integer
  from (
    select jsonb_build_object(
      'away_count', count(*) filter (where e ->> 'k' = 'away'),
      'away_ms', coalesce(sum((e ->> 'd')::bigint) filter (where e ->> 'k' = 'away'), 0),
      'longest_away_ms', coalesce(max((e ->> 'd')::bigint) filter (where e ->> 'k' = 'away'), 0),
      'paste_count', count(*) filter (where e ->> 'k' = 'paste'),
      'paste_chars', coalesce(sum((e ->> 'n')::bigint) filter (where e ->> 'k' = 'paste'), 0),
      'copy_count', count(*) filter (where e ->> 'k' = 'copy'),
      'blocked_count', count(*) filter (where e ->> 'k' = 'blocked'),
      'offline_ms', coalesce(sum((e ->> 'd')::bigint) filter (where e ->> 'k' = 'offline'), 0),
      'resume_count', count(*) filter (where e ->> 'k' = 'resume')
    ) as value
    from public.exam_submissions x
    left join lateral jsonb_array_elements(x.integrity_log) e on true
    where x.id = _submission_id
  ) summary
  where s.id = _submission_id
$$;

-- Appends the browser's integrity events (validated, at most 100 per request, 600 per sheet).
-- {k: away|paste|copy|blocked|offline|page, at: ms since the start, d: duration ms,
--  n: pasted characters, p: page, q: question id, x: what was blocked}
create or replace function private.exam_log_events(_submission_id uuid, _events jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _clean jsonb;
begin
  if _events is null or jsonb_typeof(_events) <> 'array' or jsonb_array_length(_events) = 0 then return; end if;
  select coalesce(jsonb_agg(c.event order by c.position), '[]'::jsonb) into _clean
  from (
    select t.position, jsonb_strip_nulls(jsonb_build_object(
      'k', t.e ->> 'k',
      'at', private.json_int(t.e -> 'at', 0, 86400000),
      'd', private.json_int(t.e -> 'd', 0, 86400000),
      'n', private.json_int(t.e -> 'n', 0, 100000),
      'p', private.json_int(t.e -> 'p', 1, 50),
      'q', case when (t.e ->> 'q') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then t.e ->> 'q' end,
      'x', case when t.e ->> 'x' in ('paste', 'copy', 'drop', 'menu') then t.e ->> 'x' end
    )) as event
    from jsonb_array_elements(_events) with ordinality as t(e, position)
    where jsonb_typeof(t.e) = 'object' and t.e ->> 'k' in ('away', 'paste', 'copy', 'blocked', 'offline', 'page')
    order by t.position
    limit 100
  ) c;
  if jsonb_array_length(_clean) = 0 then return; end if;

  update public.exam_submissions
  set integrity_log = integrity_log || _clean
  where id = _submission_id and jsonb_array_length(integrity_log) < 600;
  perform private.exam_summarize_integrity(_submission_id);
end;
$$;

-- Hands an attempt in: every question gets an answer row, choice questions are scored, and
-- the sheet goes to the graders. With auto_grade, an exam without scored text questions is
-- decided at once. _reason: submitted | time_up | expired.
create or replace function private.exam_finalize(_submission_id uuid, _reason text)
returns public.exam_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  _s public.exam_submissions%rowtype;
  _exam public.exams%rowtype;
  _ids uuid[];
  _max integer;
  _total integer;
  _open_text integer;
  _status text := 'pending';
begin
  select * into _s from public.exam_submissions where id = _submission_id for update;
  if _s.id is null or _s.status <> 'in_progress' then return _s; end if;
  select * into _exam from public.exams where id = _s.exam_id;
  _ids := private.exam_sheet_question_ids(_s);

  insert into public.exam_answers (submission_id, question_id, answer_text, selected_option_ids)
  select _s.id, q.id, case when q.question_type = 'text' then '' end, case when q.question_type <> 'text' then '{}'::uuid[] end
  from public.exam_questions q where q.id = any(_ids)
  on conflict (submission_id, question_id) do nothing;

  update public.exam_answers a
  set points_awarded = private.exam_auto_points(q.id, q.question_type, q.points, a.selected_option_ids)
  from public.exam_questions q
  where a.submission_id = _s.id and q.id = a.question_id and q.question_type <> 'text';

  select coalesce(sum(q.points), 0), count(*) filter (where q.question_type = 'text' and q.points > 0)
  into _max, _open_text
  from public.exam_questions q where q.id = any(_ids);
  select coalesce(sum(a.points_awarded), 0) into _total
  from public.exam_answers a where a.submission_id = _s.id and a.question_id = any(_ids);

  if coalesce(_exam.auto_grade, false) and _open_text = 0 then
    _status := case when _max = 0 or 100.0 * _total / _max >= coalesce(_exam.passing_percentage, 80) then 'passed' else 'failed' end;
  end if;

  update public.exam_submissions set
    status = _status,
    end_time = least(now(), coalesce(deadline, now())),
    finish_reason = _reason,
    max_score = _max,
    total_score = _total,
    graded_at = case when _status <> 'pending' then now() end,
    retry_allowed_at = case when _status = 'failed' and coalesce(_exam.retry_cooldown_hours, 0) > 0
                            then now() + make_interval(hours => _exam.retry_cooldown_hours) end
  where id = _s.id
  returning * into _s;
  return _s;
end;
$$;

-- Attempts whose deadline passed while nobody was there (closed browser): handed in as they are.
create or replace function private.exam_finalize_expired()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  _id uuid;
  _count integer := 0;
begin
  for _id in
    select id from public.exam_submissions
    where status = 'in_progress' and deadline < now() - private.exam_grace()
  loop
    perform private.exam_finalize(_id, 'expired');
    _count := _count + 1;
  end loop;
  return _count;
end;
$$;

-- The caller's attempt, locked: a member's own sheet, or a guest sheet opened by its secret.
create or replace function private.exam_open_attempt(_attempt_id uuid, _secret text)
returns public.exam_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  _s public.exam_submissions%rowtype;
begin
  select * into _s from public.exam_submissions where id = _attempt_id for update;
  if _s.id is null
     or (_s.user_id is not null and _s.user_id is distinct from (select auth.uid()))
     or (_s.user_id is null and (_s.access_secret_hash is null
                                 or _s.access_secret_hash is distinct from private.secret_hash(_secret))) then
    raise exception 'A vizsgalap nem található.' using errcode = '42501';
  end if;
  return _s;
end;
$$;

-- Where an attempt stands (after it was handed in, or removed by a grader).
create or replace function private.exam_attempt_state(_s public.exam_submissions)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'server_now', now(),
    'finished', _s.deleted_at is not null or _s.status <> 'in_progress',
    'attempt', json_build_object(
      'id', _s.id,
      'status', case when _s.deleted_at is not null then 'removed' else _s.status end,
      'started_at', _s.start_time,
      'deadline', _s.deadline,
      'finish_reason', _s.finish_reason,
      'claim_token', case when _s.user_id is null and _s.status <> 'in_progress' then _s.claim_token end,
      'percentage', case when _s.status in ('passed', 'failed') and _s.max_score > 0
                         then round(100.0 * _s.total_score / _s.max_score) end))
$$;

-- What the exam runner needs: the attempt, the pages and the questions with the saved answers.
create or replace function private.exam_attempt_payload(_exam public.exams, _s public.exam_submissions, _secret text)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'server_now', now(),
    'finished', false,
    'secret', _secret,
    'attempt', json_build_object('id', _s.id, 'status', _s.status, 'started_at', _s.start_time, 'deadline', _s.deadline,
                                 'applicant_name', _s.applicant_name),
    'exam', json_build_object('id', _exam.id, 'title', _exam.title, 'description', _exam.description, 'type', _exam.type,
                              'time_limit_minutes', _exam.time_limit_minutes, 'passing_percentage', _exam.passing_percentage,
                              'block_clipboard', _exam.block_clipboard, 'auto_grade', _exam.auto_grade),
    'pages', (select coalesce(json_agg(json_build_object('page_number', p.page_number, 'title', p.title,
                                                         'description', p.description) order by p.page_number), '[]'::json)
              from public.exam_pages p where p.exam_id = _exam.id),
    'questions', private.exam_questions_json(_s, _exam.shuffle_options, false, false)
  )
$$;

-- ---------------------------------------------------------------------------
-- 4. Taking an exam (guests use the public exams)
-- ---------------------------------------------------------------------------

-- The exam's start page: facts, whether the caller may start, the open attempt, the last result.
create or replace function public.get_exam_intro(_exam_id uuid, _attempt_id uuid default null, _secret text default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := (select auth.uid());
  _me public.profiles%rowtype;
  _exam public.exams%rowtype;
  _open public.exam_submissions%rowtype;
  _last public.exam_submissions%rowtype;
  _member boolean;
begin
  select * into _exam from public.exams where id = _exam_id;
  if _exam.id is null then return null; end if;
  if _uid is not null then select * into _me from public.profiles where id = _uid; end if;
  _member := _me.id is not null and _me.system_role <> 'pending';
  if not _member and not coalesce(_exam.is_public, false) then
    return json_build_object('login_required', true);
  end if;

  if _uid is not null then
    select * into _open from public.exam_submissions
    where exam_id = _exam_id and user_id = _uid and status = 'in_progress' and deleted_at is null;
  elsif _attempt_id is not null then
    select * into _open from public.exam_submissions
    where id = _attempt_id and exam_id = _exam_id and user_id is null and access_secret_hash = private.secret_hash(_secret);
  end if;
  if _open.id is not null and _open.deleted_at is null and _open.status = 'in_progress'
     and now() > _open.deadline + private.exam_grace() then
    _open := private.exam_finalize(_open.id, 'expired');
  end if;
  if _uid is not null then
    select * into _last from public.exam_submissions
    where exam_id = _exam_id and user_id = _uid and status <> 'in_progress' and deleted_at is null
    order by start_time desc limit 1;
  end if;

  return json_build_object(
    'server_now', now(),
    'exam', json_build_object(
      'id', _exam.id, 'title', _exam.title, 'description', _exam.description, 'type', _exam.type,
      'division', _exam.division, 'time_limit_minutes', _exam.time_limit_minutes,
      'passing_percentage', _exam.passing_percentage, 'is_public', _exam.is_public, 'is_active', _exam.is_active,
      'block_clipboard', _exam.block_clipboard, 'shuffle_questions', _exam.shuffle_questions,
      'auto_grade', _exam.auto_grade, 'question_count', private.exam_question_count(_exam.id),
      'page_count', (select count(distinct coalesce(q.page_number, 1)) from public.exam_questions q
                     where q.exam_id = _exam.id and q.archived_at is null)),
    'viewer', json_build_object('signed_in', _uid is not null, 'member', _member, 'name', _me.full_name),
    'block', case when _open.id is null or _open.deleted_at is not null or _open.status <> 'in_progress'
                  then private.exam_block(_exam, _uid) end,
    'attempt', case when _open.id is not null then private.exam_attempt_state(_open) -> 'attempt' end,
    'last', case when _last.id is not null then json_build_object(
      'id', _last.id, 'status', _last.status, 'end_time', _last.end_time, 'retry_allowed_at', _last.retry_allowed_at,
      'percentage', case when _last.status in ('passed', 'failed') and _last.max_score > 0
                         then round(100.0 * _last.total_score / _last.max_score) end) end
  );
end;
$$;

-- Starts an attempt, or continues the open one (another tab, a reload, another device).
-- Guests receive a secret once (keep it in the browser); _attempt_id + _secret continue it.
create or replace function public.start_exam(_exam_id uuid, _applicant_name text default null,
                                             _attempt_id uuid default null, _secret text default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := (select auth.uid());
  _exam public.exams%rowtype;
  _s public.exam_submissions%rowtype;
  _block jsonb;
  _name text;
  _id uuid := gen_random_uuid();
  _ids uuid[];
  _new_secret text;
begin
  select * into _exam from public.exams where id = _exam_id;
  if _exam.id is null then raise exception 'A vizsga nem található.'; end if;

  if _uid is not null then
    select * into _s from public.exam_submissions
    where exam_id = _exam_id and user_id = _uid and status = 'in_progress' and deleted_at is null
    for update;
  elsif _attempt_id is not null then
    select * into _s from public.exam_submissions
    where id = _attempt_id and exam_id = _exam_id and user_id is null and access_secret_hash = private.secret_hash(_secret)
    for update;
  end if;

  if _s.id is not null then
    if _s.deleted_at is null and _s.status = 'in_progress' and now() > _s.deadline + private.exam_grace() then
      _s := private.exam_finalize(_s.id, 'expired');
    end if;
    if _s.deleted_at is not null or _s.status <> 'in_progress' then
      return private.exam_attempt_state(_s);
    end if;
    -- The grader sees when (and how often) the exam was reopened.
    update public.exam_submissions
    set integrity_log = case when jsonb_array_length(integrity_log) < 600
                             then integrity_log || jsonb_build_array(jsonb_build_object(
                                    'k', 'resume', 'at', floor(extract(epoch from (now() - start_time)) * 1000)::bigint))
                             else integrity_log end,
        last_seen_at = now()
    where id = _s.id
    returning * into _s;
    perform private.exam_summarize_integrity(_s.id);
    return private.exam_attempt_payload(_exam, _s, null);
  end if;

  _block := private.exam_block(_exam, _uid);
  if _block is not null then raise exception '%', _block ->> 'message' using errcode = '42501'; end if;

  if _uid is null and (select count(*) from public.exam_submissions
                       where exam_id = _exam_id and user_id is null and start_time > now() - interval '10 minutes') >= 15 then
    raise exception 'Túl sok kitöltés indult az elmúlt percekben. Próbáld újra később.';
  end if;

  _name := regexp_replace(trim(coalesce((select full_name from public.profiles where id = _uid), _applicant_name, '')), '\s+', ' ', 'g');
  if char_length(_name) < 3 or char_length(_name) > 64 then
    raise exception 'Add meg a teljes IC neved (3–64 karakter).';
  end if;

  _ids := private.exam_draw(_exam, _id);
  if cardinality(_ids) = 0 then raise exception 'A vizsgának még nincsenek kérdései.'; end if;
  if _uid is null then _new_secret := encode(extensions.gen_random_bytes(24), 'hex'); end if;

  begin
    insert into public.exam_submissions (id, exam_id, user_id, applicant_name, start_time, deadline, status, question_ids,
                                         max_score, total_score, tab_switch_count, claim_token, access_secret_hash, last_seen_at)
    values (_id, _exam_id, _uid, _name, now(), now() + make_interval(mins => coalesce(_exam.time_limit_minutes, 60)),
            'in_progress', _ids, (select coalesce(sum(points), 0) from public.exam_questions where id = any(_ids)), 0, 0,
            case when _uid is null then private.new_claim_token() end, private.secret_hash(_new_secret), now())
    returning * into _s;
  exception when unique_violation then
    -- Started at the same moment in another tab: continue that attempt.
    select * into _s from public.exam_submissions
    where exam_id = _exam_id and user_id = _uid and status = 'in_progress' and deleted_at is null;
    return private.exam_attempt_payload(_exam, _s, null);
  end;
  return private.exam_attempt_payload(_exam, _s, _new_secret);
end;
$$;

-- Autosave: the changed answers and the integrity events since the last save.
create or replace function public.save_exam_progress(_attempt_id uuid, _answers jsonb default '{}'::jsonb,
                                                     _events jsonb default '[]'::jsonb, _secret text default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _s public.exam_submissions%rowtype;
begin
  _s := private.exam_open_attempt(_attempt_id, _secret);
  if _s.deleted_at is not null or _s.status <> 'in_progress' then return private.exam_attempt_state(_s); end if;
  if now() > _s.deadline + private.exam_grace() then
    return private.exam_attempt_state(private.exam_finalize(_s.id, 'expired'));
  end if;
  perform private.exam_store_answers(_s, _answers);
  perform private.exam_log_events(_s.id, _events);
  update public.exam_submissions set last_seen_at = now() where id = _s.id;
  return json_build_object('server_now', now(), 'finished', false, 'saved_at', now(),
                           'attempt', json_build_object('id', _s.id, 'status', _s.status, 'deadline', _s.deadline));
end;
$$;

-- Hands the sheet in. Before the deadline every required question needs an answer (the reply
-- tells how many are missing; the answers are saved anyway); at the deadline it goes as it is.
create or replace function public.finish_exam(_attempt_id uuid, _answers jsonb default '{}'::jsonb,
                                              _events jsonb default '[]'::jsonb, _secret text default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _s public.exam_submissions%rowtype;
  _missing integer;
  _time_up boolean;
begin
  _s := private.exam_open_attempt(_attempt_id, _secret);
  if _s.deleted_at is not null or _s.status <> 'in_progress' then return private.exam_attempt_state(_s); end if;
  if now() > _s.deadline + private.exam_grace() then
    return private.exam_attempt_state(private.exam_finalize(_s.id, 'expired'));
  end if;
  perform private.exam_store_answers(_s, _answers);
  perform private.exam_log_events(_s.id, _events);
  -- A few seconds of clock difference count as the end of the time.
  _time_up := now() >= _s.deadline - interval '15 seconds';

  if not _time_up then
    select count(*) into _missing
    from public.exam_questions q
    left join public.exam_answers a on a.submission_id = _s.id and a.question_id = q.id
    where q.id = any(_s.question_ids) and coalesce(q.is_required, true)
      and not ((q.question_type = 'text' and char_length(trim(coalesce(a.answer_text, ''))) > 0)
               or (q.question_type <> 'text' and coalesce(cardinality(a.selected_option_ids), 0) > 0));
    if _missing > 0 then
      return json_build_object('server_now', now(), 'finished', false, 'missing', _missing,
                               'attempt', json_build_object('id', _s.id, 'status', _s.status, 'deadline', _s.deadline));
    end if;
  end if;
  return private.exam_attempt_state(private.exam_finalize(_s.id, case when _time_up then 'time_up' else 'submitted' end));
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Exam centre, sheets and grading
-- ---------------------------------------------------------------------------

-- Everything the exam centre shows in one request: the exams with the caller's status, their
-- own sheets, and (for graders) the sheets waiting for grading and the attempts in progress.
create or replace function public.get_exam_hub()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := (select auth.uid());
begin
  if not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  perform private.exam_finalize_expired();

  return json_build_object(
    'server_now', now(),
    'exams', (
      select coalesce(json_agg(json_build_object(
        'id', e.id, 'title', e.title, 'description', e.description, 'type', e.type, 'division', e.division,
        'required_rank', e.required_rank, 'min_days_in_rank', e.min_days_in_rank,
        'time_limit_minutes', e.time_limit_minutes, 'passing_percentage', e.passing_percentage,
        'is_public', e.is_public, 'is_active', e.is_active, 'is_invitation_only', e.is_invitation_only,
        'allow_sharing', e.allow_sharing, 'created_by', e.created_by, 'created_at', e.created_at,
        'shuffle_questions', e.shuffle_questions, 'shuffle_options', e.shuffle_options,
        'block_clipboard', e.block_clipboard, 'auto_grade', e.auto_grade, 'retry_cooldown_hours', e.retry_cooldown_hours,
        'question_count', private.exam_question_count(e.id),
        'block', private.exam_block(e, _uid),
        'open_attempt', (select json_build_object('id', s.id, 'deadline', s.deadline)
                         from public.exam_submissions s
                         where s.exam_id = e.id and s.user_id = _uid and s.status = 'in_progress' and s.deleted_at is null),
        'last', (select json_build_object('id', s.id, 'status', s.status, 'end_time', s.end_time,
                                          'retry_allowed_at', s.retry_allowed_at,
                                          'percentage', case when s.status in ('passed', 'failed') and s.max_score > 0
                                                             then round(100.0 * s.total_score / s.max_score) end)
                 from public.exam_submissions s
                 where s.exam_id = e.id and s.user_id = _uid and s.status <> 'in_progress' and s.deleted_at is null
                 order by s.start_time desc limit 1)
      ) order by e.created_at desc), '[]'::json)
      from public.exams e),
    'mine', (
      select coalesce(json_agg(json_build_object(
        'id', s.id, 'exam_id', s.exam_id, 'exam_title', e.title, 'status', s.status,
        'total_score', case when s.status in ('passed', 'failed') then s.total_score end,
        'max_score', s.max_score,
        'percentage', case when s.status in ('passed', 'failed') and s.max_score > 0
                           then round(100.0 * s.total_score / s.max_score) end,
        'passing_percentage', e.passing_percentage,
        'start_time', s.start_time, 'end_time', s.end_time, 'deadline', s.deadline,
        'retry_allowed_at', s.retry_allowed_at, 'feedback_visible', coalesce(s.feedback_visible, false),
        'graded_at', s.graded_at, 'finish_reason', s.finish_reason
      ) order by s.start_time desc), '[]'::json)
      from public.exam_submissions s join public.exams e on e.id = s.exam_id
      where s.user_id = _uid and s.deleted_at is null),
    'queue', (
      select coalesce(json_agg(json_build_object(
        'id', s.id, 'exam_id', s.exam_id, 'exam_title', e.title, 'exam_type', e.type, 'exam_division', e.division,
        'user_id', s.user_id, 'candidate_name', coalesce(p.full_name, s.applicant_name, 'Ismeretlen'),
        'badge_number', p.badge_number, 'avatar_url', p.avatar_url,
        'start_time', s.start_time, 'end_time', s.end_time, 'finish_reason', s.finish_reason,
        'integrity', s.integrity, 'tab_switch_count', s.tab_switch_count,
        'total_score', s.total_score, 'max_score', s.max_score,
        'open_questions', (select count(*) from public.exam_questions q
                           where q.id = any(private.exam_sheet_question_ids(s)) and q.question_type = 'text' and q.points > 0)
      ) order by s.end_time nulls last), '[]'::json)
      from public.exam_submissions s
      join public.exams e on e.id = s.exam_id
      left join public.profiles p on p.id = s.user_id
      where s.status = 'pending' and s.deleted_at is null and s.user_id is distinct from _uid
        and private.has_grading_rights(s.id)),
    'live', (
      select coalesce(json_agg(json_build_object(
        'id', s.id, 'exam_id', s.exam_id, 'exam_title', e.title,
        'candidate_name', coalesce(p.full_name, s.applicant_name, 'Ismeretlen'),
        'badge_number', p.badge_number, 'avatar_url', p.avatar_url,
        'start_time', s.start_time, 'deadline', s.deadline, 'last_seen_at', s.last_seen_at,
        'question_count', coalesce(cardinality(s.question_ids), 0),
        'answered', (select count(*) from public.exam_answers a
                     where a.submission_id = s.id
                       and (char_length(trim(coalesce(a.answer_text, ''))) > 0 or coalesce(cardinality(a.selected_option_ids), 0) > 0)),
        'integrity', s.integrity
      ) order by s.deadline), '[]'::json)
      from public.exam_submissions s
      join public.exams e on e.id = s.exam_id
      left join public.profiles p on p.id = s.user_id
      where s.status = 'in_progress' and s.deleted_at is null and s.user_id is distinct from _uid
        and private.has_grading_rights(s.id))
  );
end;
$$;

-- One exam sheet. Graders get everything (key, guides, integrity log); the candidate gets the
-- result, and the answers with the key and the comments once the grader released them.
create or replace function public.get_exam_sheet(_submission_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := (select auth.uid());
  _s public.exam_submissions%rowtype;
  _exam public.exams%rowtype;
  _candidate public.profiles%rowtype;
  _grader boolean;
  _decided boolean;
  _details boolean;
begin
  select * into _s from public.exam_submissions where id = _submission_id;
  if _s.id is null or _uid is null or not private.has_grading_rights(_s.id) then
    raise exception 'A vizsgalap nem található, vagy nincs jogosultságod megtekinteni.' using errcode = '42501';
  end if;
  _grader := _s.user_id is distinct from _uid;
  if _s.status = 'in_progress' and now() > _s.deadline + private.exam_grace() then
    _s := private.exam_finalize(_s.id, 'expired');
  end if;
  select * into _exam from public.exams where id = _s.exam_id;
  select * into _candidate from public.profiles where id = _s.user_id;
  _decided := _s.status in ('passed', 'failed');
  _details := _grader or (_decided and coalesce(_s.feedback_visible, false));

  return json_build_object(
    'server_now', now(),
    'viewer', json_build_object(
      'grader', _grader,
      'can_grade', _grader and _s.deleted_at is null and _s.status in ('pending', 'passed', 'failed'),
      'can_trash', _grader and private.can_trash_submission(_s.id),
      'can_purge', _grader and private.is_executive_or_manager()),
    'sheet', json_build_object(
      'id', _s.id, 'exam_id', _s.exam_id, 'user_id', _s.user_id,
      'candidate_name', coalesce(_candidate.full_name, _s.applicant_name, 'Ismeretlen'),
      'applicant_name', _s.applicant_name, 'badge_number', _candidate.badge_number, 'avatar_url', _candidate.avatar_url,
      'status', _s.status, 'start_time', _s.start_time, 'end_time', _s.end_time, 'deadline', _s.deadline,
      'finish_reason', _s.finish_reason, 'last_seen_at', _s.last_seen_at,
      'total_score', case when _grader or _decided then _s.total_score end,
      'max_score', _s.max_score,
      'grading_notes', case when _grader or _decided then _s.grading_notes end,
      'graded_at', _s.graded_at,
      'graded_by_name', (select full_name from public.profiles where id = _s.graded_by),
      'feedback_visible', coalesce(_s.feedback_visible, false),
      'retry_allowed_at', _s.retry_allowed_at,
      'deleted_at', _s.deleted_at,
      'tab_switch_count', case when _grader then _s.tab_switch_count end,
      'integrity', case when _grader then _s.integrity end,
      'integrity_log', case when _grader then _s.integrity_log end,
      'claim_token', case when _grader and _s.user_id is null then _s.claim_token end),
    'exam', json_build_object(
      'id', _exam.id, 'title', _exam.title, 'type', _exam.type, 'division', _exam.division,
      'passing_percentage', _exam.passing_percentage, 'time_limit_minutes', _exam.time_limit_minutes,
      'retry_cooldown_hours', _exam.retry_cooldown_hours),
    'pages', case when _details then (
      select coalesce(json_agg(json_build_object('page_number', p.page_number, 'title', p.title, 'description', p.description)
                               order by p.page_number), '[]'::json)
      from public.exam_pages p where p.exam_id = _exam.id) else '[]'::json end,
    'questions', case when _details then private.exam_questions_json(_s, _exam.shuffle_options, true, _grader)
                      else '[]'::jsonb end
  );
end;
$$;

-- Grading in one call: points and comments per question, the decision and its options. The
-- total is computed here. Graded sheets can be corrected the same way.
-- _scores: {"<question id>": {"points": <int>, "comment": "..."}}
-- _retry_hours: waiting time after a fail (null: the exam's default).
create or replace function public.grade_exam_submission(_submission_id uuid, _scores jsonb, _status text,
                                                        _notes text default null, _feedback_visible boolean default false,
                                                        _retry_hours integer default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _s public.exam_submissions%rowtype;
  _exam public.exams%rowtype;
  _ids uuid[];
  _max integer;
  _total integer;
  _hours integer;
begin
  if not private.can_grade_submission(_submission_id) then
    raise exception 'Nincs jogosultságod javítani ezt a vizsgalapot.' using errcode = '42501';
  end if;
  if _status is null or _status not in ('passed', 'failed') then raise exception 'Érvénytelen döntés.'; end if;
  if _scores is not null and jsonb_typeof(_scores) <> 'object' then raise exception 'Érvénytelen pontszámok.'; end if;

  select * into _s from public.exam_submissions where id = _submission_id for update;
  if _s.deleted_at is not null then raise exception 'A lomtárban lévő vizsgalap nem javítható.'; end if;
  if _s.status = 'in_progress' then
    if now() <= _s.deadline + private.exam_grace() then raise exception 'A vizsga még folyamatban van.'; end if;
    _s := private.exam_finalize(_s.id, 'expired');
  end if;
  select * into _exam from public.exams where id = _s.exam_id;
  _ids := private.exam_sheet_question_ids(_s);

  -- Old sheets may lack the row of a question.
  insert into public.exam_answers (submission_id, question_id)
  select _s.id, q.id from public.exam_questions q where q.id = any(_ids)
  on conflict (submission_id, question_id) do nothing;

  update public.exam_answers a set
    points_awarded = coalesce(least(private.json_int(sc.value -> 'points', 0, 1000), q.points)::integer, a.points_awarded),
    grader_comment = case when sc.value ? 'comment'
                          then nullif(left(trim(coalesce(sc.value ->> 'comment', '')), 2000), '')
                          else a.grader_comment end
  from jsonb_each(coalesce(_scores, '{}'::jsonb)) sc, public.exam_questions q
  where a.submission_id = _s.id and q.id = a.question_id and q.id::text = sc.key and q.id = any(_ids)
    and jsonb_typeof(sc.value) = 'object';

  select coalesce(sum(q.points), 0) into _max from public.exam_questions q where q.id = any(_ids);
  select coalesce(sum(a.points_awarded), 0) into _total
  from public.exam_answers a where a.submission_id = _s.id and a.question_id = any(_ids);
  _hours := least(greatest(coalesce(_retry_hours, _exam.retry_cooldown_hours, 0), 0), 720);

  update public.exam_submissions set
    status = _status,
    total_score = _total,
    max_score = _max,
    grading_notes = nullif(left(trim(coalesce(_notes, '')), 4000), ''),
    feedback_visible = coalesce(_feedback_visible, false),
    graded_by = (select auth.uid()),
    graded_at = now(),
    retry_allowed_at = case when _status = 'failed' and _hours > 0 then now() + make_interval(hours => _hours) end
  where id = _s.id
  returning * into _s;

  return json_build_object('id', _s.id, 'status', _s.status, 'total_score', _s.total_score, 'max_score', _s.max_score,
                           'retry_allowed_at', _s.retry_allowed_at);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Editor and statistics
-- ---------------------------------------------------------------------------

create or replace function public.get_exam_editor(_exam_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _exam public.exams%rowtype;
begin
  select * into _exam from public.exams where id = _exam_id;
  if _exam.id is null then raise exception 'A vizsga nem található.'; end if;
  if not private.can_manage_exam_content(_exam.type, _exam.division) then
    raise exception 'Nincs jogosultságod szerkeszteni ezt a vizsgát.' using errcode = '42501';
  end if;

  return json_build_object(
    'exam', to_json(_exam),
    'pages', (select coalesce(json_agg(json_build_object('page_number', p.page_number, 'title', p.title,
                                                         'description', p.description, 'draw_count', p.draw_count)
                                       order by p.page_number), '[]'::json)
              from public.exam_pages p where p.exam_id = _exam_id),
    'questions', (
      select coalesce(json_agg(json_build_object(
        'id', q.id, 'page_number', coalesce(q.page_number, 1), 'order_index', coalesce(q.order_index, 0),
        'question_text', q.question_text, 'question_type', q.question_type, 'points', q.points,
        'is_required', coalesce(q.is_required, true),
        'guide', (select g.guide from public.exam_question_guides g where g.question_id = q.id),
        'options', (select coalesce(json_agg(json_build_object('id', o.id, 'option_text', o.option_text,
                                                               'is_correct', coalesce(o.is_correct, false))
                                             order by o.order_index, o.id), '[]'::json)
                    from public.exam_options o where o.question_id = q.id and o.archived_at is null)
      ) order by coalesce(q.page_number, 1), coalesce(q.order_index, 0), q.id), '[]'::json)
      from public.exam_questions q where q.exam_id = _exam_id and q.archived_at is null),
    'sheet_count', (select count(*) from public.exam_submissions s
                    where s.exam_id = _exam_id and s.deleted_at is null and s.status <> 'in_progress'),
    'open_attempts', (select count(*) from public.exam_submissions s
                      where s.exam_id = _exam_id and s.deleted_at is null and s.status = 'in_progress')
  );
end;
$$;

-- Saves an exam with its questions, options, guides and pages in one transaction (creates it
-- when _exam_id is null). Questions and options missing from the lists are deleted; ids that
-- are not ids of this exam (the editor's temporary ids) become new rows.
-- _exam: {title, description, type, division, required_rank, min_days_in_rank, time_limit_minutes,
--         passing_percentage, is_public, is_active, allow_sharing, is_invitation_only,
--         shuffle_questions, shuffle_options, block_clipboard, auto_grade, retry_cooldown_hours}
-- _pages: [{page_number, title, description, draw_count}]
-- _questions: [{id, question_text, question_type, points, is_required, page_number, guide,
--               options: [{id, option_text, is_correct}]}]   (list order = order_index)
create or replace function public.save_exam(_exam_id uuid, _exam jsonb, _pages jsonb, _questions jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  _old public.exams%rowtype;
  _type text := _exam ->> 'type';
  _division text := nullif(trim(coalesce(_exam ->> 'division', '')), '');
  _rank text := nullif(trim(coalesce(_exam ->> 'required_rank', '')), '');
  _title text := regexp_replace(trim(coalesce(_exam ->> 'title', '')), '\s+', ' ', 'g');
  _description text := nullif(left(trim(coalesce(_exam ->> 'description', '')), 4000), '');
  _time integer := private.json_int(_exam -> 'time_limit_minutes', 1, 240);
  _passing integer := private.json_int(_exam -> 'passing_percentage', 1, 100);
  _min_days integer := coalesce(private.json_int(_exam -> 'min_days_in_rank', 0, 365), 0);
  _cooldown integer := coalesce(private.json_int(_exam -> 'retry_cooldown_hours', 0, 720), 0);
  _question jsonb;
  _option jsonb;
  _question_id uuid;
  _option_id uuid;
  _qtype text;
  _points integer;
  _kept_questions uuid[] := '{}';
  _kept_options uuid[];
  _index integer := 0;
  _option_index integer;
  _guide text;
  _uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if _exam is null or jsonb_typeof(_exam) <> 'object' then raise exception 'Hiányzó vizsgaadatok.'; end if;
  if _exam_id is not null then
    select * into _old from public.exams where id = _exam_id for update;
    if _old.id is null then raise exception 'A vizsga nem található.'; end if;
    if not private.can_manage_exam_content(_old.type, _old.division) then
      raise exception 'Nincs jogosultságod szerkeszteni ezt a vizsgát.' using errcode = '42501';
    end if;
  end if;
  if _type is null or _type not in ('trainee', 'deputy_i', 'division_exam', 'other') then
    raise exception 'Ismeretlen vizsgatípus.';
  end if;
  if not private.can_manage_exam_content(_type, _division) then
    raise exception 'Ilyen típusú vagy osztályú vizsgát nem kezelhetsz.' using errcode = '42501';
  end if;
  if char_length(_title) < 3 or char_length(_title) > 120 then raise exception 'A vizsga címe 3–120 karakter legyen.'; end if;
  if _rank is not null and private.rank_index(_rank) = 999 then raise exception 'Ismeretlen rendfokozat.'; end if;
  if _time is null or _passing is null then raise exception 'Add meg az időkorlátot és a sikeres határt.'; end if;
  if _questions is null or jsonb_typeof(_questions) <> 'array' or jsonb_array_length(_questions) = 0 then
    raise exception 'A vizsgának legalább egy kérdése kell legyen.';
  end if;
  if jsonb_array_length(_questions) > 300 then raise exception 'Egy vizsgában legfeljebb 300 kérdés lehet.'; end if;

  if _exam_id is null then
    insert into public.exams (title, description, type, division, required_rank, min_days_in_rank, time_limit_minutes,
                              passing_percentage, is_public, is_active, allow_sharing, is_invitation_only,
                              shuffle_questions, shuffle_options, block_clipboard, auto_grade, retry_cooldown_hours, created_by)
    values (_title, _description, _type, _division, _rank, _min_days, _time, _passing,
            private.json_bool(_exam -> 'is_public', false), private.json_bool(_exam -> 'is_active', true),
            private.json_bool(_exam -> 'allow_sharing', false), private.json_bool(_exam -> 'is_invitation_only', false),
            private.json_bool(_exam -> 'shuffle_questions', false), private.json_bool(_exam -> 'shuffle_options', false),
            private.json_bool(_exam -> 'block_clipboard', false), private.json_bool(_exam -> 'auto_grade', false),
            _cooldown, (select auth.uid()))
    returning id into _exam_id;
  else
    update public.exams set
      title = _title, description = _description, type = _type, division = _division, required_rank = _rank,
      min_days_in_rank = _min_days, time_limit_minutes = _time, passing_percentage = _passing,
      is_public = private.json_bool(_exam -> 'is_public', is_public),
      is_active = private.json_bool(_exam -> 'is_active', is_active),
      allow_sharing = private.json_bool(_exam -> 'allow_sharing', allow_sharing),
      is_invitation_only = private.json_bool(_exam -> 'is_invitation_only', is_invitation_only),
      shuffle_questions = private.json_bool(_exam -> 'shuffle_questions', shuffle_questions),
      shuffle_options = private.json_bool(_exam -> 'shuffle_options', shuffle_options),
      block_clipboard = private.json_bool(_exam -> 'block_clipboard', block_clipboard),
      auto_grade = private.json_bool(_exam -> 'auto_grade', auto_grade),
      retry_cooldown_hours = _cooldown
    where id = _exam_id;
  end if;

  for _question in select value from jsonb_array_elements(_questions) loop
    _qtype := _question ->> 'question_type';
    if _qtype is null or _qtype not in ('text', 'single_choice', 'multiple_choice') then
      raise exception 'Ismeretlen kérdéstípus (%. kérdés).', _index + 1;
    end if;
    if char_length(trim(coalesce(_question ->> 'question_text', ''))) = 0 then
      raise exception 'Üres kérdés nem menthető (%. kérdés).', _index + 1;
    end if;
    _points := coalesce(private.json_int(_question -> 'points', 0, 1000), 1);

    _question_id := case when (_question ->> 'id') ~* _uuid then (_question ->> 'id')::uuid end;
    if _question_id is not null and not exists (select 1 from public.exam_questions
                                                where id = _question_id and exam_id = _exam_id and archived_at is null) then
      _question_id := null;
    end if;
    if _question_id is null then
      insert into public.exam_questions (exam_id, question_text, question_type, points, order_index, is_required, page_number)
      values (_exam_id, left(trim(_question ->> 'question_text'), 2000), _qtype, _points, _index,
              private.json_bool(_question -> 'is_required', true), coalesce(private.json_int(_question -> 'page_number', 1, 50), 1))
      returning id into _question_id;
    else
      update public.exam_questions set
        question_text = left(trim(_question ->> 'question_text'), 2000),
        question_type = _qtype,
        points = _points,
        order_index = _index,
        is_required = private.json_bool(_question -> 'is_required', true),
        page_number = coalesce(private.json_int(_question -> 'page_number', 1, 50), 1)
      where id = _question_id;
    end if;
    _kept_questions := _kept_questions || _question_id;

    _kept_options := '{}';
    if _qtype <> 'text' then
      if jsonb_typeof(_question -> 'options') is distinct from 'array' or jsonb_array_length(_question -> 'options') < 2 then
        raise exception 'A választós kérdéshez legalább két válaszlehetőség kell (%. kérdés).', _index + 1;
      end if;
      _option_index := 0;
      for _option in select value from jsonb_array_elements(_question -> 'options') loop
        if char_length(trim(coalesce(_option ->> 'option_text', ''))) = 0 then
          raise exception 'Üres válaszlehetőség (%. kérdés).', _index + 1;
        end if;
        _option_id := case when (_option ->> 'id') ~* _uuid then (_option ->> 'id')::uuid end;
        if _option_id is not null and not exists (select 1 from public.exam_options
                                                  where id = _option_id and question_id = _question_id and archived_at is null) then
          _option_id := null;
        end if;
        if _option_id is null then
          insert into public.exam_options (question_id, option_text, is_correct, order_index)
          values (_question_id, left(trim(_option ->> 'option_text'), 1000), private.json_bool(_option -> 'is_correct', false), _option_index)
          returning id into _option_id;
        else
          update public.exam_options set
            option_text = left(trim(_option ->> 'option_text'), 1000),
            is_correct = private.json_bool(_option -> 'is_correct', false),
            order_index = _option_index
          where id = _option_id;
        end if;
        _kept_options := _kept_options || _option_id;
        _option_index := _option_index + 1;
      end loop;
      if _points > 0 and not exists (select 1 from public.exam_options where id = any(_kept_options) and is_correct) then
        raise exception 'Jelöld meg a helyes választ (%. kérdés).', _index + 1;
      end if;
      if _qtype = 'single_choice' and (select count(*) from public.exam_options where id = any(_kept_options) and is_correct) > 1 then
        raise exception 'Az egyválasztós kérdésnek egy helyes válasza lehet (%. kérdés).', _index + 1;
      end if;
    end if;
    -- Removed options that sheets chose stay (archived), the others are deleted.
    update public.exam_options o set archived_at = now()
    where o.question_id = _question_id and not (o.id = any(_kept_options)) and o.archived_at is null
      and exists (select 1 from public.exam_answers a where a.question_id = _question_id and o.id = any(a.selected_option_ids));
    delete from public.exam_options
    where question_id = _question_id and not (id = any(_kept_options)) and archived_at is null;

    _guide := nullif(left(trim(coalesce(_question ->> 'guide', '')), 4000), '');
    if _guide is null then
      delete from public.exam_question_guides where question_id = _question_id;
    else
      insert into public.exam_question_guides (question_id, guide) values (_question_id, _guide)
      on conflict (question_id) do update set guide = excluded.guide;
    end if;
    _index := _index + 1;
  end loop;

  -- Removed questions that sheets answered stay (archived, with their answers), the others are deleted.
  update public.exam_questions q set archived_at = now()
  where q.exam_id = _exam_id and not (q.id = any(_kept_questions)) and q.archived_at is null
    and exists (select 1 from public.exam_answers a where a.question_id = q.id);
  delete from public.exam_questions
  where exam_id = _exam_id and not (id = any(_kept_questions)) and archived_at is null;

  -- A page keeps a row only with a title, a description or a pool smaller than the page.
  delete from public.exam_pages where exam_id = _exam_id;
  if _pages is not null and jsonb_typeof(_pages) = 'array' then
    insert into public.exam_pages (exam_id, page_number, title, description, draw_count)
    select _exam_id, pg.page_number, pg.title, pg.description,
           case when pg.draw_count < c.total then pg.draw_count end
    from (
      select distinct on (private.json_int(value -> 'page_number', 1, 50))
             private.json_int(value -> 'page_number', 1, 50)::integer as page_number,
             nullif(left(trim(coalesce(value ->> 'title', '')), 120), '') as title,
             nullif(left(trim(coalesce(value ->> 'description', '')), 1000), '') as description,
             private.json_int(value -> 'draw_count', 1, 200)::integer as draw_count
      from jsonb_array_elements(_pages)
      where jsonb_typeof(value) = 'object' and private.json_int(value -> 'page_number', 1, 50) is not null
    ) pg
    join (select coalesce(page_number, 1) as page_number, count(*) as total
          from public.exam_questions where exam_id = _exam_id and archived_at is null group by 1) c on c.page_number = pg.page_number
    where pg.title is not null or pg.description is not null or pg.draw_count < c.total;
  end if;

  return _exam_id;
end;
$$;

-- How an exam goes: results, average time, and per question how often it was answered, the
-- share of the points earned and how often each option was picked.
create or replace function public.get_exam_stats(_exam_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_view_exam_key(_exam_id) then
    raise exception 'Nincs jogosultságod a vizsga statisztikáihoz.' using errcode = '42501';
  end if;

  return json_build_object(
    'totals', (
      select json_build_object(
        'sheets', count(*),
        'graded', count(*) filter (where s.status in ('passed', 'failed')),
        'passed', count(*) filter (where s.status = 'passed'),
        'failed', count(*) filter (where s.status = 'failed'),
        'pending', count(*) filter (where s.status = 'pending'),
        'avg_percentage', round(avg(100.0 * s.total_score / nullif(s.max_score, 0)) filter (where s.status in ('passed', 'failed'))),
        'avg_minutes', round(avg(extract(epoch from (s.end_time - s.start_time)) / 60) filter (where s.end_time is not null)),
        'last_at', max(s.end_time))
      from public.exam_submissions s
      where s.exam_id = _exam_id and s.deleted_at is null and s.status <> 'in_progress'),
    'questions', (
      select coalesce(json_agg(json_build_object(
        'id', q.id, 'answered', st.answered, 'graded', st.graded, 'avg_ratio', st.avg_ratio,
        'option_counts', (
          select coalesce(json_object_agg(o.id, (
            select count(*) from public.exam_answers a join public.exam_submissions s on s.id = a.submission_id
            where a.question_id = q.id and s.deleted_at is null and s.status <> 'in_progress'
              and o.id = any(a.selected_option_ids))), '{}'::json)
          from public.exam_options o where o.question_id = q.id and o.archived_at is null)
      ) order by coalesce(q.page_number, 1), coalesce(q.order_index, 0)), '[]'::json)
      from public.exam_questions q
      cross join lateral (
        select count(*) filter (where char_length(trim(coalesce(a.answer_text, ''))) > 0
                                   or coalesce(cardinality(a.selected_option_ids), 0) > 0) as answered,
               count(*) filter (where s.status in ('passed', 'failed')) as graded,
               round(avg(a.points_awarded::numeric / nullif(q.points, 0)) filter (where s.status in ('passed', 'failed')), 3) as avg_ratio
        from public.exam_answers a join public.exam_submissions s on s.id = a.submission_id
        where a.question_id = q.id and s.deleted_at is null and s.status <> 'in_progress'
      ) st
      where q.exam_id = _exam_id and q.archived_at is null)
  );
end;
$$;

-- For the daily cron (service role): attempts nobody handed in.
create or replace function public.exam_close_expired_attempts()
returns integer
language sql
security definer
set search_path = ''
as $$ select private.exam_finalize_expired() $$;

-- ---------------------------------------------------------------------------
-- 7. Notifications and the history view
-- ---------------------------------------------------------------------------

create or replace function private.on_exam_submission_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _exam public.exams%rowtype;
  _percent integer;
begin
  select * into _exam from public.exams where id = new.exam_id;
  if _exam.id is null then return new; end if;

  -- A sheet to grade: an attempt was handed in (or the old frontend inserted it directly).
  if (tg_op = 'INSERT' and new.status = 'pending')
     or (tg_op = 'UPDATE' and old.status = 'in_progress' and new.status = 'pending') then
    perform private.notify(private.exam_grader_ids(new.exam_id), 'Javítandó vizsgalap',
      format('%s – %s', _exam.title, coalesce(nullif(new.applicant_name, ''), private.member_name(new.user_id))),
      'info', 'exam', '/exams?tab=grading', 'exam-grading:' || new.exam_id);
  end if;

  -- The result (also when a correction changes it).
  if tg_op = 'UPDATE' and new.user_id is not null and new.status in ('passed', 'failed')
     and old.status is distinct from new.status then
    _percent := case when coalesce(new.max_score, 0) > 0
                     then round(100.0 * coalesce(new.total_score, 0) / new.max_score) end;
    perform private.notify(array[new.user_id],
      format('Vizsgaeredmény: %s', _exam.title),
      case when new.status = 'passed' then 'Sikeres vizsga' else 'Sikertelen vizsga' end
        || coalesce(format(' (%s%%)', _percent), ''),
      case when new.status = 'passed' then 'success' else 'alert' end, 'exam', '/exams/grading/' || new.id);
  end if;
  return new;
end;
$$;

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
       e.division as exam_division,
       s.deadline,
       s.finish_reason,
       s.integrity
from public.exam_submissions s
join public.exams e on s.exam_id = e.id
left join public.profiles p on s.user_id = p.id;

-- ---------------------------------------------------------------------------
-- 8. Replaced functions and privileges
-- ---------------------------------------------------------------------------

-- Replaced by start_exam/save_exam_progress/finish_exam, save_exam and get_exam_editor/get_exam_sheet
-- (the deployed frontend uses none of them).
drop function if exists public.submit_exam(uuid, jsonb, text, timestamptz, integer, boolean);
drop function if exists public.save_exam_questions(uuid, jsonb);
drop function if exists public.get_exam_answer_key(uuid);

revoke execute on function
  private.exam_option_default_order(), private.exam_grace(), private.secret_hash(text),
  private.json_int(jsonb, bigint, bigint), private.json_bool(jsonb, boolean), private.exam_question_count(uuid),
  private.exam_sheet_question_ids(public.exam_submissions), private.exam_auto_points(uuid, text, integer, uuid[]),
  private.exam_block(public.exams, uuid), private.exam_draw(public.exams, uuid),
  private.exam_questions_json(public.exam_submissions, boolean, boolean, boolean),
  private.exam_store_answers(public.exam_submissions, jsonb), private.exam_summarize_integrity(uuid),
  private.exam_log_events(uuid, jsonb), private.exam_finalize(uuid, text), private.exam_finalize_expired(),
  private.exam_open_attempt(uuid, text), private.exam_attempt_state(public.exam_submissions),
  private.exam_attempt_payload(public.exams, public.exam_submissions, text)
from public, anon, authenticated;
-- Used by RLS policies, evaluated as the signed-in member.
revoke execute on function private.can_view_exam_key(uuid) from public, anon;
grant execute on function private.can_view_exam_key(uuid) to authenticated;

revoke execute on function
  public.get_exam_intro(uuid, uuid, text), public.start_exam(uuid, text, uuid, text),
  public.save_exam_progress(uuid, jsonb, jsonb, text), public.finish_exam(uuid, jsonb, jsonb, text),
  public.get_exam_hub(), public.get_exam_sheet(uuid),
  public.grade_exam_submission(uuid, jsonb, text, text, boolean, integer),
  public.get_exam_editor(uuid), public.save_exam(uuid, jsonb, jsonb, jsonb), public.get_exam_stats(uuid),
  public.exam_close_expired_attempts()
from public, anon, authenticated;
-- Guests take the public exams.
grant execute on function
  public.get_exam_intro(uuid, uuid, text), public.start_exam(uuid, text, uuid, text),
  public.save_exam_progress(uuid, jsonb, jsonb, text), public.finish_exam(uuid, jsonb, jsonb, text)
to anon, authenticated;
grant execute on function
  public.get_exam_hub(), public.get_exam_sheet(uuid),
  public.grade_exam_submission(uuid, jsonb, text, text, boolean, integer),
  public.get_exam_editor(uuid), public.save_exam(uuid, jsonb, jsonb, jsonb), public.get_exam_stats(uuid)
to authenticated;
grant execute on function public.exam_close_expired_attempts() to service_role;
