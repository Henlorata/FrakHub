-- =============================================================================
-- HR progression: promotion criteria and the eligibility board, promotion
-- nominations (supervisors nominate, command decides), the trainee week with a
-- mentor, the activity watch (recorded duty time only, staff-facing), the
-- workload spread and the recruitment funnel.
--
-- Compatible with the deployed frontend: new tables and functions only; the new
-- trigger on profiles only touches the new tables.
-- =============================================================================

-- The rank of an index (0 = Commander ... 16 = Trainee), the inverse of private.rank_index().
create or replace function private.rank_name(_index integer)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select (array[
    'Commander', 'Deputy Commander',
    'Captain III.', 'Captain II.', 'Captain I.', 'Lieutenant II.', 'Lieutenant I.',
    'Sergeant II.', 'Sergeant I.',
    'Corporal', 'Staff Deputy Sheriff', 'Senior Deputy Sheriff',
    'Deputy Sheriff III+.', 'Deputy Sheriff III.', 'Deputy Sheriff II.', 'Deputy Sheriff I.',
    'Deputy Sheriff Trainee'
  ]::text[])[_index + 1]
$$;

-- ---------------------------------------------------------------------------
-- 1. Promotion criteria (per target rank; null = no requirement)
-- ---------------------------------------------------------------------------

create table public.promotion_criteria (
  -- The rank a member is promoted to (Deputy Sheriff II. ... Commander; trainees have their own week).
  rank text primary key check (private.rank_index(rank) between 0 and 14),
  min_days_in_rank integer check (min_days_in_rank between 0 and 365),
  -- Average recorded duty time of the last closed months (window_months).
  min_duty_hours integer check (min_duty_hours between 0 and 744),
  window_months integer not null default 1 check (window_months between 1 and 3),
  -- Logged reports in the same months, together.
  min_reports integer check (min_reports between 0 and 300),
  max_warnings integer check (max_warnings between 0 and 3),
  -- Exams to have passed (any time).
  exam_ids uuid[] not null default '{}' check (cardinality(exam_ids) <= 5),
  note text check (char_length(note) <= 300),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
alter table public.promotion_criteria enable row level security;
-- Members see what the next rank needs (their profile shows it); the leadership sets it.
create policy promotion_criteria_select on public.promotion_criteria for select to authenticated
  using ((select private.is_member()));
revoke all on public.promotion_criteria from anon, authenticated;
grant select on public.promotion_criteria to authenticated;

-- Starting values from the faction's monthly minimums (payroll settings); the executive staff
-- adjusts them on the HR page.
insert into public.promotion_criteria (rank, min_days_in_rank, min_duty_hours, window_months, min_reports, max_warnings)
select private.rank_name(i),
       case when i >= 10 then 14 when i = 9 then 21 else 30 end,
       s.min_duty_hours,
       1,
       case when i <= 6 then null else s.min_reports end,
       0
from generate_series(0, 14) i
cross join (select min_duty_hours, min_reports from public.payroll_settings where id = 'global') s
on conflict (rank) do nothing;

create or replace function public.save_promotion_criteria(_rank text, _criteria jsonb)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _exams uuid[];
  _row public.promotion_criteria%rowtype;
  _window integer := coalesce(private.json_int(_criteria -> 'window_months', 1, 3), 1);
begin
  if not private.is_executive_or_manager() then
    raise exception 'Az előléptetési feltételeket a vezérkar állítja be.' using errcode = '42501';
  end if;
  if _rank is null or private.rank_index(_rank) not between 0 and 14 then
    raise exception 'Ismeretlen rendfokozat.' using errcode = '22023';
  end if;
  if _criteria is null or jsonb_typeof(_criteria) <> 'object' then raise exception 'Érvénytelen feltételek.' using errcode = '22023'; end if;

  select coalesce(array_agg(distinct e.id), '{}') into _exams
  from jsonb_array_elements_text(case when jsonb_typeof(_criteria -> 'exam_ids') = 'array' then _criteria -> 'exam_ids' else '[]'::jsonb end) x(id)
  join public.exams e on e.id::text = x.id;
  if cardinality(_exams) > 5 then raise exception 'Legfeljebb öt vizsga köthető ki.' using errcode = '22023'; end if;

  insert into public.promotion_criteria (rank, min_days_in_rank, min_duty_hours, window_months, min_reports, max_warnings, exam_ids, note,
                                         updated_at, updated_by)
  values (_rank, private.json_int(_criteria -> 'min_days_in_rank', 0, 365), private.json_int(_criteria -> 'min_duty_hours', 0, 744), _window,
          private.json_int(_criteria -> 'min_reports', 0, 300), private.json_int(_criteria -> 'max_warnings', 0, 3), _exams,
          nullif(left(btrim(coalesce(_criteria ->> 'note', '')), 300), ''), now(), (select auth.uid()))
  on conflict (rank) do update set
    min_days_in_rank = excluded.min_days_in_rank, min_duty_hours = excluded.min_duty_hours, window_months = excluded.window_months,
    min_reports = excluded.min_reports, max_warnings = excluded.max_warnings, exam_ids = excluded.exam_ids, note = excluded.note,
    updated_at = now(), updated_by = (select auth.uid())
  returning * into _row;
  return row_to_json(_row);
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Promotion nominations
-- ---------------------------------------------------------------------------

create table public.promotion_nominations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  from_rank text not null,
  to_rank text not null,
  reason text not null check (char_length(btrim(reason)) between 10 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  nominated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  decision_note text check (char_length(decision_note) <= 500)
);
create unique index promotion_nominations_open_key on public.promotion_nominations (user_id) where status = 'pending';
create index promotion_nominations_created_idx on public.promotion_nominations (created_at desc);
alter table public.promotion_nominations enable row level security;
-- Staff only: a nominee learns about it from the promotion itself.
create policy promotion_nominations_select on public.promotion_nominations for select to authenticated
  using ((select private.is_staff()));
revoke all on public.promotion_nominations from anon, authenticated;
grant select on public.promotion_nominations to authenticated;

-- Who decides a nomination to this rank (shared/ranks.ts getAllowedPromotionRanks, command and up):
-- the bureau manager and the executive staff any, the command staff up to Sergeant II.
create or replace function private.can_decide_promotion(_to_rank text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.system_role <> 'pending'
      and (coalesce(p.is_bureau_manager, false) or private.rank_index(p.faction_rank) <= 1
           or (private.rank_index(p.faction_rank) <= 6 and private.rank_index(_to_rank) >= 7))
  )
$$;

create or replace function private.promotion_approver_ids(_to_rank text)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(p.id), '{}') from public.profiles p
  where p.system_role <> 'pending'
    and (coalesce(p.is_bureau_manager, false) or private.rank_index(p.faction_rank) <= 1
         or (private.rank_index(p.faction_rank) <= 6 and private.rank_index(_to_rank) >= 7))
$$;

create or replace function private.nomination_json(_n public.promotion_nominations)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'id', _n.id, 'user_id', _n.user_id, 'from_rank', _n.from_rank, 'to_rank', _n.to_rank, 'reason', _n.reason, 'status', _n.status,
    'created_at', _n.created_at, 'decided_at', _n.decided_at, 'decision_note', _n.decision_note,
    'nominated_by', _n.nominated_by, 'nominated_by_name', (select full_name from public.profiles where id = _n.nominated_by),
    'decided_by_name', (select full_name from public.profiles where id = _n.decided_by),
    'member', (select json_build_object('full_name', p.full_name, 'badge_number', p.badge_number, 'faction_rank', p.faction_rank,
                                        'avatar_url', p.avatar_url, 'division', p.division)
               from public.profiles p where p.id = _n.user_id),
    'can_decide', _n.status = 'pending' and _n.user_id <> (select auth.uid()) and private.can_decide_promotion(_n.to_rank),
    'can_withdraw', _n.status = 'pending' and (_n.nominated_by = (select auth.uid()) or private.can_decide_promotion(_n.to_rank))
  )
$$;

create or replace function public.nominate_for_promotion(_user_id uuid, _reason text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _me public.profiles%rowtype := private.me();
  _target public.profiles%rowtype;
  _text text := btrim(coalesce(_reason, ''));
  _row public.promotion_nominations%rowtype;
begin
  if _me.id is null or not private.is_staff() then
    raise exception 'Előléptetést a felügyelő állomány javasolhat.' using errcode = '42501';
  end if;
  select * into _target from public.profiles where id = _user_id;
  if _target.id is null or _target.system_role = 'pending' then raise exception 'A tag nem található.' using errcode = 'P0002'; end if;
  if _target.id = _me.id then raise exception 'Saját magadat nem javasolhatod.' using errcode = '22023'; end if;
  if private.rank_index(_target.faction_rank) = 0 then raise exception 'A tag a legmagasabb rendfokozatban van.' using errcode = '22023'; end if;
  if private.rank_index(_target.faction_rank) >= 16 then
    raise exception 'Az újoncok előléptetését az Újoncok lapon követheted.' using errcode = '22023';
  end if;
  if not (coalesce(_me.is_bureau_manager, false) or private.rank_index(_me.faction_rank) < private.rank_index(_target.faction_rank)) then
    raise exception 'Csak nálad alacsonyabb rangú tagot javasolhatsz.' using errcode = '42501';
  end if;
  if char_length(_text) < 10 then raise exception 'Írd le röviden, miért javaslod (legalább 10 karakter).' using errcode = '22023'; end if;

  begin
    insert into public.promotion_nominations (user_id, from_rank, to_rank, reason, nominated_by)
    values (_target.id, _target.faction_rank, private.rank_name(private.rank_index(_target.faction_rank) - 1), left(_text, 1000), _me.id)
    returning * into _row;
  exception when unique_violation then
    raise exception 'Ennek a tagnak már van függő javaslata.' using errcode = '23505';
  end;

  perform private.notify(private.promotion_approver_ids(_row.to_rank), 'Előléptetési javaslat',
    format('%s: %s → %s (javasolta: %s)', _target.full_name, _row.from_rank, _row.to_rank, _me.full_name),
    'info', 'hr', '/hr?tab=promotions', 'promotion-nominations');
  return private.nomination_json(_row);
end;
$$;

-- Rejecting or withdrawing. Approval is the promotion itself: when the member reaches the
-- nominated rank (HR page, API), the trigger below closes the nomination as approved.
create or replace function public.decide_promotion_nomination(_id uuid, _decision text, _note text default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _me uuid := (select auth.uid());
  _row public.promotion_nominations%rowtype;
  _text text := nullif(btrim(coalesce(_note, '')), '');
begin
  select * into _row from public.promotion_nominations where id = _id for update;
  if _row.id is null or not private.is_staff() then raise exception 'A javaslat nem található.' using errcode = 'P0002'; end if;
  if _row.status <> 'pending' then raise exception 'Ezt a javaslatot már lezárták.' using errcode = '22023'; end if;
  if char_length(_text) > 500 then raise exception 'A megjegyzés legfeljebb 500 karakter lehet.' using errcode = '22023'; end if;

  if _decision = 'rejected' then
    if not private.can_decide_promotion(_row.to_rank) or _row.user_id = _me then
      raise exception 'Erről a javaslatról a parancsnokság dönt.' using errcode = '42501';
    end if;
    if _text is null then raise exception 'Az elutasításhoz írj indoklást.' using errcode = '22023'; end if;
  elsif _decision = 'withdrawn' then
    if not (_row.nominated_by = _me or private.can_decide_promotion(_row.to_rank)) then
      raise exception 'A javaslatot a javasló vagy a parancsnokság vonhatja vissza.' using errcode = '42501';
    end if;
  elsif _decision = 'approved' then
    raise exception 'A jóváhagyáshoz léptesd elő a tagot: a javaslat ekkor magától lezárul.' using errcode = '22023';
  else
    raise exception 'Ismeretlen döntés.' using errcode = '22023';
  end if;

  update public.promotion_nominations set status = _decision, decided_by = _me, decided_at = now(), decision_note = _text
  where id = _id returning * into _row;
  if _decision = 'rejected' and _row.nominated_by is not null and _row.nominated_by <> _me then
    perform private.notify(array[_row.nominated_by], 'Előléptetési javaslat elutasítva',
      format('%s → %s: %s', private.member_name(_row.user_id), _row.to_rank, _text), 'warning', 'hr', '/hr?tab=promotions');
  end if;
  return private.nomination_json(_row);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. The eligibility board
-- ---------------------------------------------------------------------------

-- One member against the criteria of the next rank (checks with value, target and result).
create or replace function private.promotion_status(_p public.profiles, _c public.promotion_criteria, _current date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _since date;
  _days integer;
  _window integer := coalesce(_c.window_months, 1);
  _from date := (_current - make_interval(months => coalesce(_c.window_months, 1)))::date;
  _duty_months integer;
  _duty_avg numeric;
  _reports integer;
  _warnings integer;
  _checks jsonb := '[]'::jsonb;
  _exam uuid;
  _missing integer;
begin
  select coalesce(_p.last_promotion_date::date, d.joined_on, _p.created_at::date) into _since
  from (select 1) x left join public.member_details d on d.user_id = _p.id;
  _days := greatest(0, current_date - _since);
  select count(*), avg(minutes) into _duty_months, _duty_avg from public.duty_time_entries
  where user_id = _p.id and month >= _from and month < _current;
  select count(*) into _reports from public.report_logs where user_id = _p.id and month >= _from and month < _current;
  select count(*) into _warnings from public.hr_records where user_id = _p.id and kind = 'warning' and status = 'active';

  if _c.rank is not null then
    if _c.min_days_in_rank is not null then
      _checks := _checks || jsonb_build_object('key', 'days', 'label', 'Idő a jelenlegi rangban', 'value', _days,
        'target', _c.min_days_in_rank, 'unit', 'nap', 'ok', _days >= _c.min_days_in_rank);
    end if;
    if _c.min_duty_hours is not null then
      _checks := _checks || jsonb_build_object('key', 'duty',
        'label', case when _window = 1 then 'Duty idő (előző hónap)' else format('Duty idő (%s hónap átlaga)', _window) end,
        'value', case when _duty_months > 0 then round(_duty_avg / 60.0, 1) end, 'target', _c.min_duty_hours, 'unit', 'óra',
        'ok', _duty_months > 0 and _duty_avg >= _c.min_duty_hours * 60);
    end if;
    if _c.min_reports is not null then
      _checks := _checks || jsonb_build_object('key', 'reports',
        'label', case when _window = 1 then 'Jelentések (előző hónap)' else format('Jelentések (%s hónap)', _window) end,
        'value', _reports, 'target', _c.min_reports, 'unit', 'db', 'ok', _reports >= _c.min_reports);
    end if;
    if _c.max_warnings is not null then
      _checks := _checks || jsonb_build_object('key', 'warnings', 'label', 'Aktív figyelmeztetés', 'value', _warnings,
        'target', _c.max_warnings, 'unit', 'db', 'max', true, 'ok', _warnings <= _c.max_warnings);
    end if;
    foreach _exam in array coalesce(_c.exam_ids, '{}') loop
      _checks := _checks || jsonb_build_object('key', 'exam:' || _exam,
        'label', coalesce((select title from public.exams where id = _exam), 'Vizsga'), 'unit', 'vizsga',
        'ok', exists (select 1 from public.exam_submissions s where s.exam_id = _exam and s.user_id = _p.id
                      and s.status = 'passed' and s.deleted_at is null));
    end loop;
  end if;
  select count(*) filter (where not (x ->> 'ok')::boolean) into _missing from jsonb_array_elements(_checks) x;

  return jsonb_build_object(
    'user_id', _p.id, 'full_name', _p.full_name, 'badge_number', _p.badge_number, 'faction_rank', _p.faction_rank,
    'rank_order', private.rank_index(_p.faction_rank), 'division', _p.division, 'avatar_url', _p.avatar_url,
    'next_rank', private.rank_name(private.rank_index(_p.faction_rank) - 1), 'configured', _c.rank is not null,
    'since', _since, 'days_in_rank', _days, 'checks', _checks, 'missing', _missing,
    'eligible', jsonb_array_length(_checks) > 0 and _missing = 0,
    'on_leave', exists (select 1 from public.hr_records r where r.user_id = _p.id and r.kind = 'leave' and r.status = 'active'
                          and current_date between r.starts_on and r.ends_on),
    'activity_status', (select activity_status from public.member_details where user_id = _p.id),
    'nomination', (select to_jsonb(private.nomination_json(n)) from public.promotion_nominations n
                   where n.user_id = _p.id and n.status = 'pending'));
end;
$$;

create or replace function public.get_promotion_board()
returns json
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _current date := (date_trunc('month', current_date::timestamp))::date;
begin
  if not private.is_staff() then
    raise exception 'Az előléptetési táblát a felügyelő állomány látja.' using errcode = '42501';
  end if;
  return json_build_object(
    'criteria', (select coalesce(json_agg(row_to_json(c) order by private.rank_index(c.rank) desc), '[]'::json)
                 from public.promotion_criteria c),
    'exams', (select coalesce(json_agg(json_build_object('id', e.id, 'title', e.title, 'type', e.type) order by e.title), '[]'::json)
              from public.exams e where coalesce(e.is_active, true)),
    'can_edit_criteria', private.is_executive_or_manager(),
    'members', (
      select coalesce(jsonb_agg(m.item order by (m.item ->> 'eligible')::boolean desc, (m.item ->> 'missing')::int,
                                                (m.item ->> 'rank_order')::int, m.item ->> 'full_name'), '[]'::jsonb)
      from (
        select private.promotion_status(p, c, _current) as item
        from public.profiles p
        left join public.promotion_criteria c on c.rank = private.rank_name(private.rank_index(p.faction_rank) - 1)
        where p.system_role <> 'pending' and private.rank_index(p.faction_rank) between 1 and 15
      ) m),
    'nominations', (
      select coalesce(json_agg(private.nomination_json(n) order by n.status = 'pending' desc, n.created_at desc), '[]'::json)
      from (select * from public.promotion_nominations
            where status = 'pending' or decided_at > now() - interval '60 days'
            order by created_at desc limit 60) n)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. The trainee week: checklist and mentor
-- ---------------------------------------------------------------------------

-- A trainee is one for about a week: the mentor follows that week only (the row stays as history).
create table public.trainee_mentors (
  trainee_id uuid primary key references public.profiles(id) on delete cascade,
  mentor_id uuid references public.profiles(id) on delete set null,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  signed_off_at timestamptz,
  signed_off_by uuid references public.profiles(id) on delete set null,
  sign_off_note text check (char_length(sign_off_note) <= 400),
  -- Set when the trainee is promoted.
  completed_at timestamptz
);
create index trainee_mentors_mentor_idx on public.trainee_mentors (mentor_id) where completed_at is null;

create table public.trainee_notes (
  id uuid primary key default gen_random_uuid(),
  trainee_id uuid not null references public.profiles(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null check (char_length(btrim(body)) between 2 and 400),
  created_at timestamptz not null default now()
);
create index trainee_notes_trainee_idx on public.trainee_notes (trainee_id, created_at desc);

alter table public.trainee_mentors enable row level security;
alter table public.trainee_notes enable row level security;
create policy trainee_mentors_select on public.trainee_mentors for select to authenticated
  using (trainee_id = (select auth.uid()) or mentor_id = (select auth.uid())
         or (select private.is_staff()) or (select private.is_academy_instructor()));
-- Notes are internal: the mentor, the instructors and the staff (not the trainee).
create policy trainee_notes_select on public.trainee_notes for select to authenticated
  using ((select private.is_staff()) or (select private.is_academy_instructor())
         or exists (select 1 from public.trainee_mentors m where m.trainee_id = trainee_notes.trainee_id and m.mentor_id = (select auth.uid())));
revoke all on public.trainee_mentors, public.trainee_notes from anon, authenticated;
grant select on public.trainee_mentors, public.trainee_notes to authenticated;

create or replace function private.can_coach_trainees()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_staff() or private.is_academy_instructor()
$$;

-- The trainees the caller may follow (coaches: everyone; a mentor: the mentee; a trainee:
-- themselves) with the week's checklist.
create or replace function public.get_trainees()
returns json
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _me uuid := (select auth.uid());
  _coach boolean := private.can_coach_trainees();
  _deputy_exam boolean := exists (select 1 from public.exams where type = 'deputy_i' and coalesce(is_active, true));
begin
  if not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  return (
    select coalesce(json_agg(x.item order by (x.item ->> 'joined_on')), '[]'::json)
    from (
      select jsonb_build_object(
        'user_id', p.id, 'full_name', p.full_name, 'badge_number', p.badge_number, 'avatar_url', p.avatar_url,
        'joined_on', coalesce(d.joined_on, p.created_at::date), 'days', current_date - coalesce(d.joined_on, p.created_at::date),
        'mentor', case when tm.mentor_id is not null then jsonb_build_object('id', mp.id, 'full_name', mp.full_name,
                                                                            'faction_rank', mp.faction_rank, 'avatar_url', mp.avatar_url) end,
        'assigned_at', tm.assigned_at, 'signed_off_at', tm.signed_off_at, 'sign_off_note', tm.sign_off_note,
        'signed_off_by_name', (select full_name from public.profiles where id = tm.signed_off_by),
        'is_mentor', coalesce(tm.mentor_id = _me, false),
        'checks', c.checks,
        'ready', not exists (select 1 from jsonb_array_elements(c.checks) e where not (e ->> 'ok')::boolean),
        'notes', case when _coach or tm.mentor_id = _me then (
          select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'body', n.body, 'created_at', n.created_at,
                                                      'author_name', (select full_name from public.profiles where id = n.author_id))
                                    order by n.created_at desc), '[]'::jsonb)
          from (select * from public.trainee_notes where trainee_id = p.id order by created_at desc limit 8) n) end
      ) as item
      from public.profiles p
      left join public.member_details d on d.user_id = p.id
      left join public.trainee_mentors tm on tm.trainee_id = p.id
      left join public.profiles mp on mp.id = tm.mentor_id
      cross join lateral (
        select jsonb_build_array(
          jsonb_build_object('key', 'exam', 'label', 'Felvételi vizsga', 'ok', exists (
            select 1 from public.exam_submissions s join public.exams e on e.id = s.exam_id
            where s.user_id = p.id and e.type = 'trainee' and s.status = 'passed' and s.deleted_at is null)),
          jsonb_build_object('key', 'onboarding', 'label', 'Első lépések', 'ok', coalesce(p.onboarding_completed, false)),
          (select jsonb_build_object('key', 'academy', 'label', 'Alapképzés napjai', 'value', a.days, 'target', 5,
                                     'ok', a.days >= 5 or a.passed)
           from (select (select count(distinct l.day_number) from public.academy_logs l where l.student_id = p.id and l.is_present) as days,
                        exists (select 1 from public.academy_students st where st.user_id = p.id and st.status = 'passed') as passed) a),
          (select jsonb_build_object('key', 'reports', 'label', 'Első jelentés', 'value', r.n, 'target', 1, 'ok', r.n >= 1)
           from (select count(*)::int as n from public.report_logs where user_id = p.id) r),
          jsonb_build_object('key', 'mentor', 'label', 'Mentor jóváhagyása', 'ok', tm.signed_off_at is not null)
        ) || case when _deputy_exam then jsonb_build_array(jsonb_build_object('key', 'deputy_exam', 'label', 'Deputy I. vizsga', 'ok', exists (
            select 1 from public.exam_submissions s join public.exams e on e.id = s.exam_id
            where s.user_id = p.id and e.type = 'deputy_i' and s.status = 'passed' and s.deleted_at is null))) else '[]'::jsonb end as checks
      ) c
      where p.system_role <> 'pending' and p.faction_rank = 'Deputy Sheriff Trainee'
        and (_coach or p.id = _me or tm.mentor_id = _me)
    ) x);
end;
$$;

create or replace function public.assign_trainee_mentor(_trainee_id uuid, _mentor_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _me uuid := (select auth.uid());
  _trainee public.profiles%rowtype;
  _mentor public.profiles%rowtype;
begin
  if not private.can_coach_trainees() then raise exception 'Mentort az oktatók és a felügyelő állomány jelöl ki.' using errcode = '42501'; end if;
  select * into _trainee from public.profiles where id = _trainee_id;
  if _trainee.id is null or _trainee.faction_rank <> 'Deputy Sheriff Trainee' or _trainee.system_role = 'pending' then
    raise exception 'Az újonc nem található.' using errcode = 'P0002';
  end if;
  if _mentor_id is null then
    update public.trainee_mentors set mentor_id = null, signed_off_at = null, signed_off_by = null, sign_off_note = null
    where trainee_id = _trainee_id;
    return json_build_object('mentor', null);
  end if;
  select * into _mentor from public.profiles where id = _mentor_id;
  if _mentor.id is null or _mentor.system_role = 'pending' or _mentor.faction_rank = 'Deputy Sheriff Trainee' or _mentor.id = _trainee.id then
    raise exception 'Mentor csak felavatott tag lehet.' using errcode = '22023';
  end if;
  insert into public.trainee_mentors (trainee_id, mentor_id, assigned_by, assigned_at)
  values (_trainee_id, _mentor_id, _me, now())
  on conflict (trainee_id) do update set mentor_id = excluded.mentor_id, assigned_by = excluded.assigned_by, assigned_at = now(),
    signed_off_at = case when public.trainee_mentors.mentor_id is distinct from excluded.mentor_id then null else public.trainee_mentors.signed_off_at end,
    signed_off_by = case when public.trainee_mentors.mentor_id is distinct from excluded.mentor_id then null else public.trainee_mentors.signed_off_by end;

  perform private.notify(array[_mentor_id], 'Mentorálandó újonc',
    format('%s mentora lettél az újonchetére. A hét végén jelezd, hogy kész-e a Deputy Sheriff I. rangra.', _trainee.full_name),
    'info', 'hr', '/hr?tab=trainees', 'trainee-mentor:' || _trainee_id);
  perform private.notify(array[_trainee_id], 'Mentort kaptál',
    format('%s segít az első hetedben: fordulj hozzá bátran.', _mentor.full_name), 'success', 'hr', '/dashboard',
    'trainee-mentor:' || _trainee_id);
  return json_build_object('mentor', json_build_object('id', _mentor.id, 'full_name', _mentor.full_name, 'faction_rank', _mentor.faction_rank,
                                                       'avatar_url', _mentor.avatar_url));
end;
$$;

create or replace function public.add_trainee_note(_trainee_id uuid, _body text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _row public.trainee_notes%rowtype;
begin
  if not (private.can_coach_trainees()
          or exists (select 1 from public.trainee_mentors where trainee_id = _trainee_id and mentor_id = (select auth.uid()))) then
    raise exception 'Jegyzetet a mentor és az oktatók írhatnak.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = _trainee_id and faction_rank = 'Deputy Sheriff Trainee') then
    raise exception 'Az újonc nem található.' using errcode = 'P0002';
  end if;
  insert into public.trainee_notes (trainee_id, author_id, body) values (_trainee_id, (select auth.uid()), left(btrim(coalesce(_body, '')), 400))
  returning * into _row;
  return json_build_object('id', _row.id, 'body', _row.body, 'created_at', _row.created_at,
                           'author_name', (select full_name from public.profiles where id = _row.author_id));
end;
$$;

-- The mentor (or an instructor) says the trainee is ready (or takes it back).
create or replace function public.sign_off_trainee(_trainee_id uuid, _ready boolean, _note text default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _me uuid := (select auth.uid());
  _row public.trainee_mentors%rowtype;
  _name text;
begin
  select * into _row from public.trainee_mentors where trainee_id = _trainee_id for update;
  if not (private.can_coach_trainees() or _row.mentor_id = _me) then
    raise exception 'Az újoncot a mentora vagy egy oktató hagyhatja jóvá.' using errcode = '42501';
  end if;
  select full_name into _name from public.profiles where id = _trainee_id and faction_rank = 'Deputy Sheriff Trainee';
  if _name is null then raise exception 'Az újonc nem található.' using errcode = 'P0002'; end if;
  if _row.trainee_id is null then
    insert into public.trainee_mentors (trainee_id, assigned_by) values (_trainee_id, _me) returning * into _row;
  end if;
  update public.trainee_mentors set
    signed_off_at = case when coalesce(_ready, true) then now() end,
    signed_off_by = case when coalesce(_ready, true) then _me end,
    sign_off_note = case when coalesce(_ready, true) then nullif(left(btrim(coalesce(_note, '')), 400), '') end
  where trainee_id = _trainee_id returning * into _row;

  if coalesce(_ready, true) then
    perform private.notify(
      array_remove(array_cat(array[_row.assigned_by],
        (select coalesce(array_agg(p.id), '{}') from public.profiles p
         where p.system_role <> 'pending' and 'TB' = any(coalesce(p.commanded_divisions, '{}')))), null),
      'Újonc jóváhagyva', format('%s mentora szerint kész a Deputy Sheriff I. rangra.', _name),
      'success', 'hr', '/hr?tab=trainees', 'trainee-ready:' || _trainee_id);
  end if;
  return json_build_object('signed_off_at', _row.signed_off_at, 'sign_off_note', _row.sign_off_note);
end;
$$;

-- Rank changes close nominations and the trainee week.
create or replace function private.on_rank_change_progression()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _actor uuid := private.actor_id();
  _n record;
begin
  if new.faction_rank is not distinct from old.faction_rank or new.system_role = 'pending' then return new; end if;

  -- "Undo" right after a promotion puts the nomination back on the list.
  update public.promotion_nominations set status = 'pending', decided_by = null, decided_at = null
  where user_id = new.id and status = 'approved' and to_rank = old.faction_rank and from_rank = new.faction_rank
    and decided_at > now() - interval '10 minutes';

  for _n in
    update public.promotion_nominations set status = 'approved', decided_by = _actor, decided_at = now()
    where user_id = new.id and status = 'pending' and to_rank = new.faction_rank
    returning nominated_by, to_rank
  loop
    if _n.nominated_by is not null and _n.nominated_by is distinct from _actor then
      perform private.notify(array[_n.nominated_by], 'Elfogadták a javaslatodat',
        format('%s előléptetve: %s.', new.full_name, _n.to_rank), 'success', 'hr', '/hr?tab=promotions');
    end if;
  end loop;

  update public.promotion_nominations set status = 'withdrawn', decided_at = now(), decision_note = 'A rendfokozat közben megváltozott.'
  where user_id = new.id and status = 'pending' and from_rank <> new.faction_rank and to_rank <> new.faction_rank;

  if old.faction_rank = 'Deputy Sheriff Trainee' then
    update public.trainee_mentors set completed_at = now() where trainee_id = new.id and completed_at is null;
  elsif new.faction_rank = 'Deputy Sheriff Trainee' then
    update public.trainee_mentors set completed_at = null where trainee_id = new.id;
  end if;
  return new;
end;
$$;
create trigger on_rank_change_progression after update of faction_rank on public.profiles
  for each row execute function private.on_rank_change_progression();

-- ---------------------------------------------------------------------------
-- 5. Activity watch (recorded duty time only; reminders are sent by hand)
-- ---------------------------------------------------------------------------

-- What the staff did about a flagged month: a reminder sent or "we know about it".
create table public.activity_reviews (
  user_id uuid not null references public.profiles(id) on delete cascade,
  month date not null,
  action text not null check (action in ('reminded', 'dismissed')),
  note text check (char_length(note) <= 200),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, month)
);
alter table public.activity_reviews enable row level security;
create policy activity_reviews_select on public.activity_reviews for select to authenticated using ((select private.is_staff()));
revoke all on public.activity_reviews from anon, authenticated;
grant select on public.activity_reviews to authenticated;

-- Members whose recorded duty time of the last closed months stayed under the monthly minimum.
-- Only months the staff has recorded count (most members have a value), approved leave in a month
-- excuses it, trainees and members who joined during the window are left out, and so are those
-- marked inactive in the registry already.
create or replace function public.get_activity_watch()
returns json
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _current date := (date_trunc('month', current_date::timestamp))::date;
  _m1 date := ((date_trunc('month', current_date::timestamp)) - interval '1 month')::date;
  _m2 date := ((date_trunc('month', current_date::timestamp)) - interval '2 months')::date;
  _min integer := coalesce((select min_duty_hours from public.payroll_settings where id = 'global'), 0) * 60;
  _members integer := (select count(*) from public.profiles where system_role <> 'pending');
  _rec1 boolean;
  _rec2 boolean;
begin
  if not private.is_staff() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  _rec1 := (select count(*) from public.duty_time_entries where month = _m1) * 10 >= _members * 4;
  _rec2 := (select count(*) from public.duty_time_entries where month = _m2) * 10 >= _members * 4;

  return json_build_object(
    'months', json_build_array(_m1, _m2), 'recorded', json_build_array(_rec1, _rec2), 'min_minutes', _min,
    'members', (
      select coalesce(json_agg(row_to_json(x) order by x.level desc, x.m1_minutes nulls first, x.full_name), '[]'::json)
      from (
        select p.id as user_id, p.full_name, p.badge_number, p.faction_rank, p.avatar_url, d.activity_status,
               e1.minutes as m1_minutes, e2.minutes as m2_minutes, l1.excused as m1_leave, l2.excused as m2_leave,
               case when _rec2 and not l1.excused and not l2.excused and coalesce(e1.minutes, 0) < _min and coalesce(e2.minutes, 0) < _min
                         and coalesce(d.joined_on, p.created_at::date) < _m2 then 2 else 1 end as level,
               r.action as review, r.created_at as reviewed_at, (select full_name from public.profiles where id = r.created_by) as reviewed_by
        from public.profiles p
        left join public.member_details d on d.user_id = p.id
        left join public.duty_time_entries e1 on e1.user_id = p.id and e1.month = _m1
        left join public.duty_time_entries e2 on e2.user_id = p.id and e2.month = _m2
        left join public.activity_reviews r on r.user_id = p.id and r.month = _m1
        cross join lateral (select exists (select 1 from public.hr_records h where h.user_id = p.id and h.kind = 'leave' and h.status = 'active'
                                           and h.starts_on < _current and h.ends_on >= _m1) as excused) l1
        cross join lateral (select exists (select 1 from public.hr_records h where h.user_id = p.id and h.kind = 'leave' and h.status = 'active'
                                           and h.starts_on < _m1 and h.ends_on >= _m2) as excused) l2
        where _rec1 and _min > 0
          and p.system_role <> 'pending' and p.faction_rank <> 'Deputy Sheriff Trainee'
          and coalesce(d.activity_status, 'active') <> 'inactive'
          and coalesce(d.joined_on, p.created_at::date) < _m1
          and not l1.excused
          and coalesce(e1.minutes, 0) < _min
      ) x)
  );
end;
$$;

-- A friendly reminder to the member (once per month), with the way to ask for leave.
create or replace function public.send_activity_reminder(_user_id uuid, _note text default null)
returns json
language plpgsql
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _m1 date := ((date_trunc('month', current_date::timestamp)) - interval '1 month')::date;
  _minutes integer;
  _min integer := coalesce((select min_duty_hours from public.payroll_settings where id = 'global'), 0);
begin
  if not (private.is_staff() and private.can_manage_member(_user_id)) then
    raise exception 'Emlékeztetőt a tag felettesei küldhetnek.' using errcode = '42501';
  end if;
  if exists (select 1 from public.activity_reviews where user_id = _user_id and month = _m1 and action = 'reminded') then
    raise exception 'Erre a hónapra már ment emlékeztető.' using errcode = '22023';
  end if;
  select minutes into _minutes from public.duty_time_entries where user_id = _user_id and month = _m1;
  insert into public.activity_reviews (user_id, month, action, note, created_by)
  values (_user_id, _m1, 'reminded', nullif(left(btrim(coalesce(_note, '')), 200), ''), (select auth.uid()))
  on conflict (user_id, month) do update set action = 'reminded', note = excluded.note, created_by = excluded.created_by, created_at = now();
  perform private.notify(array[_user_id], 'Hiányzunk egymásnak',
    format('%s havi rögzített duty időd %s óra (a minimum %s óra). Ha most nem tudsz szolgálatot vállalni, jelezz szabadságot a profilodon; ha bármi gond van, szólj a feletteseidnek.',
           to_char(_m1, 'YYYY.MM.'), round(coalesce(_minutes, 0) / 60.0, 1), _min),
    'info', 'hr', '/profile?leave=1', 'activity-reminder');
  return json_build_object('review', 'reminded');
end;
$$;

create or replace function public.dismiss_activity_flag(_user_id uuid, _note text default null)
returns json
language plpgsql
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _m1 date := ((date_trunc('month', current_date::timestamp)) - interval '1 month')::date;
begin
  if not private.is_staff() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  insert into public.activity_reviews (user_id, month, action, note, created_by)
  values (_user_id, _m1, 'dismissed', nullif(left(btrim(coalesce(_note, '')), 200), ''), (select auth.uid()))
  on conflict (user_id, month) do update set action = case when public.activity_reviews.action = 'reminded' then 'reminded' else 'dismissed' end,
    note = coalesce(excluded.note, public.activity_reviews.note);
  return json_build_object('review', (select action from public.activity_reviews where user_id = _user_id and month = _m1));
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Workload spread and the recruitment funnel (staff)
-- ---------------------------------------------------------------------------

-- Per member and month (the last six, this one included): reports, duty time and events attended.
create or replace function public.get_workload()
returns json
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _current date := (date_trunc('month', current_date::timestamp))::date;
  _first date := ((date_trunc('month', current_date::timestamp)) - interval '5 months')::date;
begin
  if not private.is_staff() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  return json_build_object(
    'months', (select json_agg((g)::date order by g desc) from generate_series(_first::timestamp, _current::timestamp, interval '1 month') g),
    'members', (
      select coalesce(json_agg(json_build_object(
        'user_id', p.id, 'full_name', p.full_name, 'badge_number', p.badge_number, 'faction_rank', p.faction_rank,
        'avatar_url', p.avatar_url, 'division', p.division,
        'reports', (select coalesce(json_object_agg(r.month, r.n), '{}'::json)
                    from (select month, count(*) as n from public.report_logs where user_id = p.id and month >= _first group by month) r),
        'duty', (select coalesce(json_object_agg(e.month, e.minutes), '{}'::json)
                 from public.duty_time_entries e where e.user_id = p.id and e.month >= _first),
        'events', (select coalesce(json_object_agg(a.month, a.n), '{}'::json)
                   from (select (date_trunc('month', ev.starts_at))::date as month, count(*) as n
                         from public.event_attendance at join public.events ev on ev.id = at.event_id
                         where at.user_id = p.id and ev.starts_at >= _first and ev.cancelled_at is null
                         group by 1) a)
      ) order by private.rank_index(p.faction_rank), p.full_name), '[]'::json)
      from public.profiles p where p.system_role <> 'pending')
  );
end;
$$;

-- Applicants of the last months: admission exams written and passed, members who joined, reached
-- Deputy Sheriff I. and stayed 30 / 90 days (null while a cohort is too young to tell).
create or replace function public.get_recruitment_funnel(_months integer default 6)
returns json
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _count integer := least(greatest(coalesce(_months, 6), 1), 12);
  _first date := ((date_trunc('month', current_date::timestamp)) - make_interval(months => least(greatest(coalesce(_months, 6), 1), 12) - 1))::date;
begin
  if not private.is_staff() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  return (
    with months as (
      select (g)::date as month from generate_series(_first::timestamp, current_date::timestamp, interval '1 month') g
    ), exams as (
      select (date_trunc('month', s.start_time))::date as month, s.status
      from public.exam_submissions s join public.exams e on e.id = s.exam_id
      where e.type = 'trainee' and s.deleted_at is null and s.status <> 'in_progress' and s.start_time >= _first
    ), joined as (
      select (date_trunc('month', coalesce(d.joined_on, p.created_at::date)))::date as month,
             coalesce(d.joined_on, p.created_at::date) as joined_on, null::date as left_on,
             p.faction_rank <> 'Deputy Sheriff Trainee' as deputy
      from public.profiles p left join public.member_details d on d.user_id = p.id
      where p.system_role <> 'pending' and coalesce(d.joined_on, p.created_at::date) >= _first
      union all
      select (date_trunc('month', f.joined_on))::date, f.joined_on, f.left_on, coalesce(f.faction_rank, '') <> 'Deputy Sheriff Trainee'
      from public.former_members f where f.joined_on >= _first
    )
    select coalesce(json_agg(json_build_object(
      'month', m.month,
      'exam_takers', (select count(*) from exams x where x.month = m.month),
      'exam_passed', (select count(*) from exams x where x.month = m.month and x.status = 'passed'),
      'joined', (select count(*) from joined j where j.month = m.month),
      'deputy', (select count(*) from joined j where j.month = m.month and j.deputy),
      'stayed_30', case when (m.month + interval '1 month' + interval '30 days')::date <= current_date then
        (select count(*) from joined j where j.month = m.month and coalesce(j.left_on, current_date) - j.joined_on >= 30) end,
      'stayed_90', case when (m.month + interval '1 month' + interval '90 days')::date <= current_date then
        (select count(*) from joined j where j.month = m.month and coalesce(j.left_on, current_date) - j.joined_on >= 90) end
    ) order by m.month desc), '[]'::json)
    from months m
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Privileges
-- ---------------------------------------------------------------------------

revoke execute on function
  public.save_promotion_criteria(text, jsonb), public.nominate_for_promotion(uuid, text),
  public.decide_promotion_nomination(uuid, text, text), public.get_promotion_board(), public.get_trainees(),
  public.assign_trainee_mentor(uuid, uuid), public.add_trainee_note(uuid, text), public.sign_off_trainee(uuid, boolean, text),
  public.get_activity_watch(), public.send_activity_reminder(uuid, text), public.dismiss_activity_flag(uuid, text),
  public.get_workload(), public.get_recruitment_funnel(integer)
from public, anon, authenticated;
grant execute on function
  public.save_promotion_criteria(text, jsonb), public.nominate_for_promotion(uuid, text),
  public.decide_promotion_nomination(uuid, text, text), public.get_promotion_board(), public.get_trainees(),
  public.assign_trainee_mentor(uuid, uuid), public.add_trainee_note(uuid, text), public.sign_off_trainee(uuid, boolean, text),
  public.get_activity_watch(), public.send_activity_reminder(uuid, text), public.dismiss_activity_flag(uuid, text),
  public.get_workload(), public.get_recruitment_funnel(integer)
to authenticated;
