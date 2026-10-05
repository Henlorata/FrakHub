-- Finance and training systems.
--
-- * Monthly payroll: computed from the HR data (rank, division, qualifications, duty time,
--   bank account) and the report log; only the extras (pictures, trained people, TOP places,
--   bonuses) are entered per month. The Commander maintains the amounts (payroll_settings);
--   a closed month keeps a snapshot, so later changes never rewrite a paid month.
-- * Report log: members record their forum reports (the forum cannot be read by programs:
--   robots.txt forbids it and it sits behind a browser check), the payroll counts them.
-- * Reimbursements are decided through decide_budget_request(); closed requests keep their row
--   when the cron removes the proof images (the finance history stays complete).
-- * Academy courses get a title, description and order (the catalogue is data-driven), and
--   the pages of a closed course are readable by instructors only.

-- ---------------------------------------------------------------------------
-- 1. Helpers
-- ---------------------------------------------------------------------------

create or replace function private.is_commander_or_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.system_role <> 'pending'
      and (p.faction_rank = 'Commander' or coalesce(p.is_bureau_manager, false))
  )
$$;

-- "2026. október"
create or replace function private.hu_month(_month date)
returns text
language sql
immutable
set search_path = ''
as $$
  select extract(year from _month)::int || '. ' || (array['január', 'február', 'március', 'április', 'május', 'június', 'július',
    'augusztus', 'szeptember', 'október', 'november', 'december'])[extract(month from _month)::int]
$$;

-- 12 500 000
create or replace function private.hu_amount(_value bigint)
returns text
language sql
immutable
set search_path = ''
as $$ select regexp_replace(coalesce(_value, 0)::text, '(\d)(?=(\d{3})+$)', '\1 ', 'g') $$;

-- ---------------------------------------------------------------------------
-- 2. Report log
-- ---------------------------------------------------------------------------

create table public.report_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  occurred_on date not null,
  month date generated always as ((date_trunc('month', occurred_on::timestamp))::date) stored,
  title text not null check (char_length(title) between 1 and 160),
  -- Link of the forum post (optional, lets the leaders check the report).
  forum_url text check (char_length(forum_url) <= 500 and forum_url ~ '^https://forum\.hl-rpg\.eu/'),
  -- The post id from either link form (/posts/123/ or /threads/x.1/post-123).
  forum_post_id bigint generated always as ((substring(forum_url from '(?:/posts/|post-)(\d{1,18})'))::bigint) stored,
  source text not null default 'manual' check (source in ('generator', 'manual')),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null
);
create index report_logs_month_idx on public.report_logs (month, user_id);
create index report_logs_user_idx on public.report_logs (user_id, occurred_on desc);
-- The same forum post is counted once.
create unique index report_logs_forum_post_key on public.report_logs (forum_post_id) where forum_post_id is not null;

alter table public.report_logs enable row level security;
create policy report_logs_select on public.report_logs for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));
-- Members log their own reports; staff may log for others (counted from the forum).
create policy report_logs_insert on public.report_logs for insert to authenticated
  with check (((user_id = (select auth.uid()) and (select private.is_member())) or (select private.is_staff()))
              and created_by = (select auth.uid())
              and occurred_on between (now() at time zone 'Europe/Budapest')::date - 400 and (now() at time zone 'Europe/Budapest')::date + 1);
-- The link can be added once the report is on the forum (and a typo fixed).
create policy report_logs_update on public.report_logs for update to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()))
  with check ((user_id = (select auth.uid()) or (select private.is_staff()))
              and occurred_on between (now() at time zone 'Europe/Budapest')::date - 400 and (now() at time zone 'Europe/Budapest')::date + 1);
create policy report_logs_delete on public.report_logs for delete to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));
revoke all on public.report_logs from anon;
revoke update, truncate, references, trigger on public.report_logs from authenticated;
grant update (title, forum_url, occurred_on) on public.report_logs to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Payroll
-- ---------------------------------------------------------------------------

-- The amounts of the monthly pay (one row). Starting values: the leadership's old sheet
-- (rank, unit, duty and TOP tables); per report, per trained person and the tax are read from
-- its formulas, per "élménykép" was not in it.
create table public.payroll_settings (
  id text primary key default 'global' check (id = 'global'),
  rank_pay jsonb not null default '{}'::jsonb,
  unit_pay jsonb not null default '{}'::jsonb,
  duty_tiers jsonb not null default '[]'::jsonb,
  min_duty_hours integer not null default 30 check (min_duty_hours between 0 and 744),
  top_duty_pay jsonb not null default '[0, 0, 0]'::jsonb,
  top_report_pay jsonb not null default '[0, 0, 0]'::jsonb,
  report_pay bigint not null default 0 check (report_pay between 0 and 10000000000),
  picture_pay bigint not null default 0 check (picture_pay between 0 and 10000000000),
  training_pay bigint not null default 0 check (training_pay between 0 and 10000000000),
  tax_percent numeric(5, 2) not null default 0 check (tax_percent between 0 and 100),
  -- Executive staff are paid as this unit (the old sheet's "BM"); null: their division.
  executive_unit text check (char_length(executive_unit) <= 20),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

insert into public.payroll_settings (id, rank_pay, unit_pay, duty_tiers, min_duty_hours, top_duty_pay, top_report_pay,
                                     report_pay, picture_pay, training_pay, tax_percent, executive_unit)
values ('global',
  '{"Commander": 15000000, "Deputy Commander": 15000000, "Captain III.": 14000000, "Captain II.": 14000000,
    "Captain I.": 14000000, "Lieutenant II.": 14000000, "Lieutenant I.": 14000000, "Sergeant II.": 13000000,
    "Sergeant I.": 13000000, "Corporal": 12000000, "Staff Deputy Sheriff": 10000000, "Senior Deputy Sheriff": 10000000,
    "Deputy Sheriff III+.": 9000000, "Deputy Sheriff III.": 8000000, "Deputy Sheriff II.": 7000000,
    "Deputy Sheriff I.": 6000000, "Deputy Sheriff Trainee": 5000000}',
  '{"BM": 3000000, "SEB": 500000, "MCB": 500000, "TSB": 0, "SAHP": 450000, "GW": 400000, "AB": 400000,
    "FAB": 400000, "TB": 500000, "MU": 400000, "SIB": 0}',
  '[{"hours": 30, "pay": 3000000}, {"hours": 40, "pay": 4000000}, {"hours": 50, "pay": 5000000},
    {"hours": 60, "pay": 6000000}, {"hours": 70, "pay": 7000000}, {"hours": 80, "pay": 8000000},
    {"hours": 90, "pay": 9000000}, {"hours": 100, "pay": 10000000}]',
  30, '[6000000, 5000000, 4000000]', '[6000000, 5000000, 4000000]', 500000, 0, 1000000, 3, 'BM');

create table public.payroll_runs (
  month date primary key check (month = (date_trunc('month', month::timestamp))::date),
  status text not null default 'open' check (status in ('open', 'closed')),
  -- What was actually taken out of the faction account ("Összes kivétel").
  withdrawn bigint check (withdrawn between 0 and 100000000000),
  note text check (char_length(note) <= 2000),
  -- The settings the closed month was computed with.
  settings jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  closed_at timestamptz,
  closed_by uuid references public.profiles(id) on delete set null
);

-- Only the monthly extras and overrides; everything else comes from HR. Null means "automatic".
create table public.payroll_entries (
  id uuid primary key default gen_random_uuid(),
  month date not null references public.payroll_runs(month) on delete cascade,
  -- Kept (as null) when the member is deleted, so a closed month keeps its rows.
  user_id uuid references public.profiles(id) on delete set null,
  eligible boolean,
  reports integer check (reports between 0 and 1000),
  pictures integer not null default 0 check (pictures between 0 and 1000),
  trained integer not null default 0 check (trained between 0 and 1000),
  top_duty smallint check (top_duty between 0 and 3),
  top_report smallint check (top_report between 0 and 3),
  bonus bigint not null default 0 check (bonus between -10000000000 and 10000000000),
  bonus_note text check (char_length(bonus_note) <= 300),
  unit_key text check (char_length(unit_key) <= 20),
  qual_key text check (char_length(qual_key) <= 20),
  paid boolean not null default false,
  paid_at timestamptz,
  paid_by uuid references public.profiles(id) on delete set null,
  snapshot jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  unique (month, user_id)
);

alter table public.payroll_settings enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payroll_entries enable row level security;
-- Read and written through the payroll RPCs; the policies only let the leadership look.
create policy payroll_settings_select on public.payroll_settings for select to authenticated
  using ((select private.is_executive_or_manager()));
create policy payroll_runs_select on public.payroll_runs for select to authenticated
  using ((select private.is_executive_or_manager()));
create policy payroll_entries_select on public.payroll_entries for select to authenticated
  using ((select private.is_executive_or_manager()) or (user_id = (select auth.uid()) and snapshot is not null));
revoke all on public.payroll_settings, public.payroll_runs, public.payroll_entries from anon, authenticated;
grant select on public.payroll_settings, public.payroll_runs, public.payroll_entries to authenticated;

-- Every member's pay for an open month, computed from HR, duty time, the report log, the
-- month's extras and the settings. TOP places are given automatically by duty time and by
-- report count among the eligible members (ties share the place) unless set by hand.
create or replace function private.payroll_rows(_month date)
returns jsonb
language sql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
  with s as (select * from public.payroll_settings where id = 'global'),
  base as (
    select p.id, p.full_name, p.badge_number, p.faction_rank, p.division, p.qualifications, p.avatar_url,
           private.rank_index(p.faction_rank) as rank_order,
           e.eligible as eligible_set, coalesce(e.eligible, p.faction_rank <> 'Deputy Sheriff Trainee') as eligible,
           e.reports as reports_set, e.pictures, e.trained, e.top_duty as top_duty_set, e.top_report as top_report_set,
           e.bonus, e.bonus_note, e.unit_key, e.qual_key,
           coalesce(d.minutes, 0) as duty_minutes,
           (select count(*) from public.report_logs r where r.user_id = p.id and r.month = _month)::integer as reports_logged,
           b.account_number
    from public.profiles p
    left join public.payroll_entries e on e.month = _month and e.user_id = p.id
    left join public.duty_time_entries d on d.user_id = p.id and d.month = _month
    left join public.member_bank_accounts b on b.user_id = p.id
    where p.system_role <> 'pending'
  ),
  ranked as (
    select b.*, coalesce(b.reports_set, b.reports_logged) as reports,
           case when b.eligible and b.duty_minutes > 0
                then rank() over (partition by b.eligible, b.duty_minutes > 0 order by b.duty_minutes desc) end as duty_place,
           case when b.eligible and coalesce(b.reports_set, b.reports_logged) > 0
                then rank() over (partition by b.eligible, coalesce(b.reports_set, b.reports_logged) > 0
                                  order by coalesce(b.reports_set, b.reports_logged) desc) end as report_place
    from base b
  ),
  resolved as (
    select r.*,
           coalesce(r.top_duty_set, case when r.duty_place <= 3 then r.duty_place::smallint else 0::smallint end) as top_duty,
           coalesce(r.top_report_set, case when r.report_place <= 3 then r.report_place::smallint else 0::smallint end) as top_report,
           coalesce(r.unit_key, case when r.rank_order <= 1 and s.executive_unit is not null then s.executive_unit else r.division end) as unit,
           case when r.qual_key is null then r.qualifications[1] else nullif(r.qual_key, '') end as qualification,
           round(r.duty_minutes / 60.0, 2) as hours
    from ranked r cross join s
  ),
  priced as (
    select x.*,
           case when x.hours >= s.min_duty_hours then coalesce((s.rank_pay ->> x.faction_rank)::bigint, 0) else 0 end as pay_rank,
           case when x.hours >= s.min_duty_hours
                then coalesce((select max((t ->> 'pay')::bigint) from jsonb_array_elements(s.duty_tiers) t
                               where x.hours >= (t ->> 'hours')::numeric), 0) else 0 end as pay_duty,
           coalesce((s.unit_pay ->> x.unit)::bigint, 0) as pay_unit,
           coalesce((s.unit_pay ->> x.qualification)::bigint, 0) as pay_qualification,
           x.reports * s.report_pay as pay_reports,
           coalesce(x.pictures, 0) * s.picture_pay as pay_pictures,
           coalesce(x.trained, 0) * s.training_pay as pay_training,
           case when x.top_duty between 1 and 3 then coalesce((s.top_duty_pay ->> (x.top_duty - 1)::int)::bigint, 0) else 0 end as pay_top_duty,
           case when x.top_report between 1 and 3 then coalesce((s.top_report_pay ->> (x.top_report - 1)::int)::bigint, 0) else 0 end as pay_top_report
    from resolved x cross join s
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', p.id, 'name', p.full_name, 'badge_number', p.badge_number, 'rank', p.faction_rank, 'rank_order', p.rank_order,
    'division', p.division, 'qualifications', coalesce(to_jsonb(p.qualifications), '[]'::jsonb), 'avatar_url', p.avatar_url,
    'account_number', p.account_number,
    'eligible', p.eligible, 'eligible_auto', p.eligible_set is null,
    'duty_minutes', p.duty_minutes, 'hours', p.hours,
    'reports', p.reports, 'reports_logged', p.reports_logged, 'reports_auto', p.reports_set is null,
    'pictures', coalesce(p.pictures, 0), 'trained', coalesce(p.trained, 0),
    'top_duty', p.top_duty, 'top_duty_auto', p.top_duty_set is null,
    'top_report', p.top_report, 'top_report_auto', p.top_report_set is null,
    'unit', p.unit, 'unit_auto', p.unit_key is null, 'qualification', p.qualification, 'qualification_auto', p.qual_key is null,
    'bonus', coalesce(p.bonus, 0), 'bonus_note', p.bonus_note,
    'pay', jsonb_build_object('rank', p.pay_rank, 'duty', p.pay_duty, 'unit', p.pay_unit, 'qualification', p.pay_qualification,
                              'reports', p.pay_reports, 'pictures', p.pay_pictures, 'training', p.pay_training,
                              'top_duty', p.pay_top_duty, 'top_report', p.pay_top_report, 'bonus', coalesce(p.bonus, 0)),
    'total', case when p.eligible then p.pay_rank + p.pay_duty + p.pay_unit + p.pay_qualification + p.pay_reports + p.pay_pictures
                                        + p.pay_training + p.pay_top_duty + p.pay_top_report + coalesce(p.bonus, 0) else 0 end
  ) order by p.rank_order, p.full_name), '[]'::jsonb)
  from priced p
$$;

-- The payroll of a month for the leadership: live while open, the snapshot once closed.
create or replace function public.get_payroll(_month date)
returns json
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _m date := (date_trunc('month', coalesce(_month, current_date)::timestamp))::date;
  _run public.payroll_runs%rowtype;
  _rows jsonb;
  _settings jsonb;
  _total bigint;
begin
  if not private.is_executive_or_manager() then
    raise exception 'A havi fizetést a vezérkar kezeli.' using errcode = '42501';
  end if;
  select * into _run from public.payroll_runs where month = _m;
  if _run.status = 'closed' then
    select coalesce(jsonb_agg(e.snapshot || jsonb_build_object('paid', e.paid, 'paid_at', e.paid_at)
                              order by (e.snapshot ->> 'rank_order')::int, e.snapshot ->> 'name'), '[]'::jsonb)
    into _rows from public.payroll_entries e where e.month = _m and e.snapshot is not null;
    _settings := _run.settings;
  else
    _rows := private.payroll_rows(_m);
    -- Paid flags of an open month (payment can be marked before closing too).
    select coalesce(jsonb_agg(r || jsonb_build_object('paid', coalesce(e.paid, false), 'paid_at', e.paid_at)
                              order by (r ->> 'rank_order')::int, r ->> 'name'), '[]'::jsonb)
    into _rows
    from jsonb_array_elements(_rows) r
    left join public.payroll_entries e on e.month = _m and e.user_id = (r ->> 'user_id')::uuid;
    select to_jsonb(s) - 'id' into _settings from public.payroll_settings s where s.id = 'global';
  end if;
  select coalesce(sum((r ->> 'total')::bigint), 0) into _total from jsonb_array_elements(_rows) r;

  return json_build_object(
    'month', _m,
    'status', coalesce(_run.status, 'open'),
    'saved', _run.month is not null,
    'withdrawn', _run.withdrawn,
    'note', _run.note,
    'closed_at', _run.closed_at,
    'closed_by_name', (select full_name from public.profiles where id = _run.closed_by),
    'settings', _settings,
    'rows', _rows,
    'total', _total,
    'tax', round(_total * coalesce((_settings ->> 'tax_percent')::numeric, 0) / 100),
    'paid_total', (select coalesce(sum((r ->> 'total')::bigint), 0) from jsonb_array_elements(_rows) r where (r ->> 'paid')::boolean),
    'can_edit_settings', private.is_commander_or_manager(),
    'months', (select coalesce(json_agg(json_build_object('month', r.month, 'status', r.status) order by r.month desc), '[]'::json)
               from public.payroll_runs r)
  );
end;
$$;

-- Saves the extras and overrides of an open month (only the given fields change; null resets a
-- field to automatic). duty_minutes and account_number write the HR registry itself, so they
-- are entered once for both places.
-- _entries: [{user_id, eligible, reports, pictures, trained, top_duty, top_report, bonus, bonus_note,
--             unit_key, qual_key, duty_minutes, account_number}]
create or replace function public.save_payroll_entries(_month date, _entries jsonb)
returns json
language plpgsql
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _m date := (date_trunc('month', _month::timestamp))::date;
  _uid uuid := (select auth.uid());
  _e jsonb;
  _user uuid;
  _account text;
  _uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if not private.is_executive_or_manager() then
    raise exception 'A havi fizetést a vezérkar kezeli.' using errcode = '42501';
  end if;
  if _m is null or _m > (date_trunc('month', current_date::timestamp))::date then raise exception 'Érvénytelen hónap.'; end if;
  if exists (select 1 from public.payroll_runs where month = _m and status = 'closed') then
    raise exception 'A hónap le van zárva. Módosításhoz előbb nyisd újra.';
  end if;
  if _entries is null or jsonb_typeof(_entries) <> 'array' then raise exception 'Érvénytelen adatok.'; end if;
  insert into public.payroll_runs (month, created_by) values (_m, _uid) on conflict (month) do nothing;

  for _e in select value from jsonb_array_elements(_entries) loop
    continue when jsonb_typeof(_e) <> 'object' or coalesce(_e ->> 'user_id', '') !~* _uuid;
    _user := (_e ->> 'user_id')::uuid;
    continue when not exists (select 1 from public.profiles where id = _user and system_role <> 'pending');

    insert into public.payroll_entries (month, user_id, updated_by) values (_m, _user, _uid)
    on conflict (month, user_id) do nothing;
    update public.payroll_entries set
      eligible = case when _e ? 'eligible' then (case when jsonb_typeof(_e -> 'eligible') = 'boolean' then (_e ->> 'eligible')::boolean end) else eligible end,
      reports = case when _e ? 'reports' then private.json_int(_e -> 'reports', 0, 1000) else reports end,
      pictures = case when _e ? 'pictures' then coalesce(private.json_int(_e -> 'pictures', 0, 1000), 0) else pictures end,
      trained = case when _e ? 'trained' then coalesce(private.json_int(_e -> 'trained', 0, 1000), 0) else trained end,
      top_duty = case when _e ? 'top_duty' then private.json_int(_e -> 'top_duty', 0, 3) else top_duty end,
      top_report = case when _e ? 'top_report' then private.json_int(_e -> 'top_report', 0, 3) else top_report end,
      bonus = case when _e ? 'bonus' then coalesce(private.json_int(_e -> 'bonus', -10000000000, 10000000000), 0) else bonus end,
      bonus_note = case when _e ? 'bonus_note' then nullif(left(trim(coalesce(_e ->> 'bonus_note', '')), 300), '') else bonus_note end,
      unit_key = case when _e ? 'unit_key' then left(nullif(trim(coalesce(_e ->> 'unit_key', '')), ''), 20) else unit_key end,
      qual_key = case when _e ? 'qual_key' then (case when jsonb_typeof(_e -> 'qual_key') = 'string' then left(trim(_e ->> 'qual_key'), 20) end) else qual_key end,
      updated_at = now(),
      updated_by = _uid
    where month = _m and user_id = _user;

    if _e ? 'duty_minutes' then
      if jsonb_typeof(_e -> 'duty_minutes') = 'number' then
        insert into public.duty_time_entries (user_id, month, minutes, updated_by)
        values (_user, _m, private.json_int(_e -> 'duty_minutes', 0, 44640), _uid)
        on conflict (user_id, month) do update set minutes = excluded.minutes, updated_by = excluded.updated_by, updated_at = now();
      else
        delete from public.duty_time_entries where user_id = _user and month = _m;
      end if;
    end if;

    if _e ? 'account_number' then
      _account := trim(coalesce(_e ->> 'account_number', ''));
      if _account = '' then
        delete from public.member_bank_accounts where user_id = _user;
      elsif char_length(_account) between 3 and 40 then
        insert into public.member_bank_accounts (user_id, account_number, updated_by) values (_user, _account, _uid)
        on conflict (user_id) do update set account_number = excluded.account_number, updated_by = excluded.updated_by;
      else
        raise exception 'Érvénytelen számlaszám.';
      end if;
    end if;
  end loop;

  return public.get_payroll(_m);
end;
$$;

-- Closes a month: every row is stored as computed now (with the settings), and each paid
-- member gets a notification with the amount.
create or replace function public.close_payroll(_month date, _withdrawn bigint default null, _note text default null)
returns json
language plpgsql
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _m date := (date_trunc('month', _month::timestamp))::date;
  _uid uuid := (select auth.uid());
  _rows jsonb;
  _row jsonb;
begin
  if not private.is_executive_or_manager() then
    raise exception 'A havi fizetést a vezérkar kezeli.' using errcode = '42501';
  end if;
  if exists (select 1 from public.payroll_runs where month = _m and status = 'closed') then
    raise exception 'A hónap már le van zárva.';
  end if;
  if _withdrawn is not null and (_withdrawn < 0 or _withdrawn > 100000000000) then raise exception 'Érvénytelen összeg.'; end if;

  insert into public.payroll_runs (month, created_by) values (_m, _uid) on conflict (month) do nothing;
  _rows := private.payroll_rows(_m);
  insert into public.payroll_entries (month, user_id, snapshot, updated_by)
  select _m, (r ->> 'user_id')::uuid, r, _uid from jsonb_array_elements(_rows) r
  on conflict (month, user_id) do update set snapshot = excluded.snapshot, updated_at = now(), updated_by = excluded.updated_by;
  update public.payroll_runs set
    status = 'closed', withdrawn = _withdrawn, note = nullif(left(trim(coalesce(_note, '')), 2000), ''),
    settings = (select to_jsonb(s) - 'id' from public.payroll_settings s where s.id = 'global'),
    closed_at = now(), closed_by = _uid
  where month = _m;

  for _row in select value from jsonb_array_elements(_rows) where (value ->> 'total')::bigint > 0 loop
    perform private.notify(array[(_row ->> 'user_id')::uuid], format('Havi fizetés: %s', private.hu_month(_m)),
      format('%s $ (a részletek a Pénzügy oldalon)', private.hu_amount((_row ->> 'total')::bigint)),
      'success', 'finance', '/finance?tab=payroll', 'payroll:' || _m, true);
  end loop;
  return public.get_payroll(_m);
end;
$$;

-- Reopens a closed month (the Commander): the rows are computed live again.
create or replace function public.reopen_payroll(_month date)
returns json
language plpgsql
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _m date := (date_trunc('month', _month::timestamp))::date;
begin
  if not private.is_commander_or_manager() then
    raise exception 'Lezárt hónapot csak a Commander nyithat újra.' using errcode = '42501';
  end if;
  update public.payroll_runs set status = 'open', closed_at = null, closed_by = null, settings = null where month = _m;
  update public.payroll_entries set snapshot = null where month = _m;
  delete from public.payroll_entries
  where month = _m and eligible is null and reports is null and pictures = 0 and trained = 0 and top_duty is null
    and top_report is null and bonus = 0 and bonus_note is null and unit_key is null and qual_key is null and not paid;
  return public.get_payroll(_m);
end;
$$;

-- Marks members as paid (or not) after the payout.
create or replace function public.set_payroll_paid(_month date, _user_ids uuid[], _paid boolean)
returns json
language plpgsql
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _m date := (date_trunc('month', _month::timestamp))::date;
  _uid uuid := (select auth.uid());
begin
  if not private.is_executive_or_manager() then
    raise exception 'A havi fizetést a vezérkar kezeli.' using errcode = '42501';
  end if;
  if _user_ids is null or cardinality(_user_ids) = 0 then return public.get_payroll(_m); end if;
  insert into public.payroll_runs (month, created_by) values (_m, _uid) on conflict (month) do nothing;
  insert into public.payroll_entries (month, user_id, updated_by)
  select _m, p.id, _uid from public.profiles p where p.id = any(_user_ids) and p.system_role <> 'pending'
  on conflict (month, user_id) do nothing;
  update public.payroll_entries set
    paid = coalesce(_paid, false),
    paid_at = case when coalesce(_paid, false) then now() end,
    paid_by = case when coalesce(_paid, false) then _uid end
  where month = _m and user_id = any(_user_ids);
  return public.get_payroll(_m);
end;
$$;

-- The Commander's pay table. Every amount is validated; unknown keys are dropped.
create or replace function public.save_payroll_settings(_settings jsonb)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _rank jsonb;
  _unit jsonb;
  _tiers jsonb;
  _top_duty jsonb;
  _top_report jsonb;
  _limit constant bigint := 10000000000;
begin
  if not private.is_commander_or_manager() then
    raise exception 'A fizetési táblát a Commander állítja be.' using errcode = '42501';
  end if;
  if _settings is null or jsonb_typeof(_settings) <> 'object' then raise exception 'Érvénytelen beállítások.'; end if;

  select coalesce(jsonb_object_agg(key, private.json_int(value, 0, _limit)), '{}'::jsonb) into _rank
  from jsonb_each(case when jsonb_typeof(_settings -> 'rank_pay') = 'object' then _settings -> 'rank_pay' else '{}'::jsonb end)
  where private.json_int(value, 0, _limit) is not null and char_length(key) <= 40;
  select coalesce(jsonb_object_agg(upper(trim(key)), private.json_int(value, 0, _limit)), '{}'::jsonb) into _unit
  from jsonb_each(case when jsonb_typeof(_settings -> 'unit_pay') = 'object' then _settings -> 'unit_pay' else '{}'::jsonb end)
  where private.json_int(value, 0, _limit) is not null and char_length(trim(key)) between 1 and 20;
  select coalesce(jsonb_agg(jsonb_build_object('hours', private.json_int(t -> 'hours', 0, 744), 'pay', private.json_int(t -> 'pay', 0, _limit))
                            order by private.json_int(t -> 'hours', 0, 744)), '[]'::jsonb) into _tiers
  from jsonb_array_elements(case when jsonb_typeof(_settings -> 'duty_tiers') = 'array' then _settings -> 'duty_tiers' else '[]'::jsonb end) t
  where private.json_int(t -> 'hours', 0, 744) is not null and private.json_int(t -> 'pay', 0, _limit) is not null;
  select jsonb_build_array(coalesce(private.json_int(_settings -> 'top_duty_pay' -> 0, 0, _limit), 0),
                           coalesce(private.json_int(_settings -> 'top_duty_pay' -> 1, 0, _limit), 0),
                           coalesce(private.json_int(_settings -> 'top_duty_pay' -> 2, 0, _limit), 0)) into _top_duty;
  select jsonb_build_array(coalesce(private.json_int(_settings -> 'top_report_pay' -> 0, 0, _limit), 0),
                           coalesce(private.json_int(_settings -> 'top_report_pay' -> 1, 0, _limit), 0),
                           coalesce(private.json_int(_settings -> 'top_report_pay' -> 2, 0, _limit), 0)) into _top_report;

  -- Only the given parts change.
  update public.payroll_settings set
    rank_pay = case when _settings ? 'rank_pay' then _rank else rank_pay end,
    unit_pay = case when _settings ? 'unit_pay' then _unit else unit_pay end,
    duty_tiers = case when _settings ? 'duty_tiers' then _tiers else duty_tiers end,
    top_duty_pay = case when _settings ? 'top_duty_pay' then _top_duty else top_duty_pay end,
    top_report_pay = case when _settings ? 'top_report_pay' then _top_report else top_report_pay end,
    min_duty_hours = coalesce(private.json_int(_settings -> 'min_duty_hours', 0, 744), min_duty_hours),
    report_pay = coalesce(private.json_int(_settings -> 'report_pay', 0, _limit), report_pay),
    picture_pay = coalesce(private.json_int(_settings -> 'picture_pay', 0, _limit), picture_pay),
    training_pay = coalesce(private.json_int(_settings -> 'training_pay', 0, _limit), training_pay),
    tax_percent = case when jsonb_typeof(_settings -> 'tax_percent') = 'number'
                       then least(greatest((_settings ->> 'tax_percent')::numeric, 0), 100) else tax_percent end,
    executive_unit = case when _settings ? 'executive_unit'
                          then left(nullif(upper(trim(coalesce(_settings ->> 'executive_unit', ''))), ''), 20) else executive_unit end,
    updated_at = now(),
    updated_by = (select auth.uid())
  where id = 'global';
  return (select to_json(s) from public.payroll_settings s where s.id = 'global');
end;
$$;

-- A member's own pay of the closed months.
create or replace function public.get_my_payslips()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(json_agg(json_build_object('month', e.month, 'row', e.snapshot, 'paid', e.paid, 'paid_at', e.paid_at)
                           order by e.month desc), '[]'::json)
  from public.payroll_entries e
  join public.payroll_runs r on r.month = e.month and r.status = 'closed'
  where e.user_id = (select auth.uid()) and e.snapshot is not null
$$;

-- ---------------------------------------------------------------------------
-- 4. Reimbursements
-- ---------------------------------------------------------------------------

alter table public.budget_requests add column if not exists proofs_removed_at timestamptz;

-- Deleting a member who once decided a request (or awarded a ribbon, renamed someone) failed on
-- these references; the history keeps the row without the name.
alter table public.budget_requests drop constraint budget_requests_processed_by_fkey,
  add constraint budget_requests_processed_by_fkey foreign key (processed_by) references public.profiles(id) on delete set null;
alter table public.vehicle_requests drop constraint vehicle_requests_processed_by_fkey,
  add constraint vehicle_requests_processed_by_fkey foreign key (processed_by) references public.profiles(id) on delete set null;
alter table public.user_ribbons drop constraint user_ribbons_awarded_by_fkey,
  add constraint user_ribbons_awarded_by_fkey foreign key (awarded_by) references public.profiles(id) on delete set null;
alter table public.name_change_logs drop constraint name_change_logs_changed_by_fkey,
  add constraint name_change_logs_changed_by_fkey foreign key (changed_by) references public.profiles(id) on delete set null;

-- `proof_image_path` holds a JSON array, (legacy) a single path or '{}'.
create or replace function private.proof_paths(_raw text)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
begin
  if _raw is null or _raw in ('', '{}', '[]') then return '{}'; end if;
  if left(_raw, 1) = '[' then
    return coalesce((select array_agg(p) from jsonb_array_elements_text(_raw::jsonb) p where p <> ''), '{}');
  end if;
  return array[_raw];
exception when others then
  return array[_raw];
end;
$$;

-- Daily cron: proof images of requests decided more than 40 days ago (the request itself stays
-- in the history) and uploads no request refers to (left by the old cleanup or an abandoned
-- form). Returns the storage paths for the cron to remove.
create or replace function public.finance_proof_cleanup()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _paths text[];
  _cleared integer;
begin
  with closed as (
    update public.budget_requests b set proof_image_path = '[]', proofs_removed_at = now()
    from (select id, private.proof_paths(proof_image_path) as paths from public.budget_requests
          where status <> 'pending' and proofs_removed_at is null and updated_at < now() - interval '40 days'
          limit 500) old
    where b.id = old.id
    returning b.id, old.paths)
  select coalesce((select array_agg(distinct p) from closed, unnest(closed.paths) p), '{}'), (select count(*) from closed)
  into _paths, _cleared;

  select _paths || coalesce(array_agg(o.name), '{}') into _paths
  from (select o.name from storage.objects o
        where o.bucket_id = 'finance_proofs' and o.created_at < now() - interval '1 day'
          and not (o.name = any(_paths))
          and not exists (select 1 from public.budget_requests b where o.name = any(private.proof_paths(b.proof_image_path)))
        limit 500) o;
  return json_build_object('remove', _paths, 'cleared', _cleared);
end;
$$;

-- Approve or reject a pending request (the high command): only the decision fields change.
create or replace function public.decide_budget_request(_request_id uuid, _approve boolean, _comment text default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _request public.budget_requests%rowtype;
  _note text := nullif(left(trim(coalesce(_comment, '')), 1000), '');
begin
  if not private.is_admin() then
    raise exception 'A költségtérítést a parancsnokság bírálja el.' using errcode = '42501';
  end if;
  select * into _request from public.budget_requests where id = _request_id for update;
  if _request.id is null then raise exception 'A kérelem nem található.'; end if;
  if _request.status <> 'pending' then raise exception 'Ezt a kérelmet már elbírálták.'; end if;
  if _request.user_id = (select auth.uid()) and not private.is_executive_or_manager() then
    raise exception 'A saját kérelmedet más bírálja el.' using errcode = '42501';
  end if;
  if not coalesce(_approve, false) and _note is null then raise exception 'Az elutasításhoz indoklás kell.'; end if;

  update public.budget_requests set
    status = case when coalesce(_approve, false) then 'approved' else 'rejected' end::public.request_status,
    admin_comment = _note,
    processed_by = (select auth.uid()),
    updated_at = now()
  where id = _request_id
  returning * into _request;
  return json_build_object('id', _request.id, 'status', _request.status);
end;
$$;

-- Monthly overview for the high command: payroll and reimbursements per Hungarian month.
create or replace function public.get_finance_overview(_months integer default 6)
returns json
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _count integer := least(greatest(coalesce(_months, 6), 1), 24);
  _first date := (date_trunc('month', current_date::timestamp) - make_interval(months => _count - 1))::date;
begin
  if not private.is_admin() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  return json_build_object(
    'pending', (select json_build_object('count', count(*), 'amount', coalesce(sum(amount), 0))
                from public.budget_requests where status = 'pending'),
    'months', (
      select coalesce(json_agg(json_build_object(
        'month', m.month,
        'reimbursed', (select coalesce(sum(b.amount), 0) from public.budget_requests b
                       where b.status = 'approved' and (date_trunc('month', b.updated_at))::date = m.month),
        'reimbursements', (select count(*) from public.budget_requests b
                           where b.status = 'approved' and (date_trunc('month', b.updated_at))::date = m.month),
        'payroll_status', r.status,
        'payroll_total', case when r.status = 'closed' then
          (select coalesce(sum((e.snapshot ->> 'total')::bigint), 0) from public.payroll_entries e where e.month = m.month) end,
        'payroll_withdrawn', r.withdrawn,
        'payroll_tax_percent', (r.settings ->> 'tax_percent')::numeric
      ) order by m.month desc), '[]'::json)
      from (select (date_trunc('month', g))::date as month
            from generate_series(_first::timestamp, current_date::timestamp, interval '1 month') g) m
      left join public.payroll_runs r on r.month = m.month)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Academy catalogue
-- ---------------------------------------------------------------------------

alter table public.academy_courses
  add column if not exists title text check (char_length(title) <= 80),
  add column if not exists description text check (char_length(description) <= 500),
  add column if not exists category text not null default 'qualification' check (category in ('division', 'qualification', 'other')),
  add column if not exists sort_order integer not null default 100;

insert into public.academy_courses (id, is_open, linear_progression) values
  ('mcb', false, false), ('seb', false, false), ('qual_SAHP', false, true), ('qual_AB', false, true), ('qual_MU', false, true),
  ('qual_GW', false, true), ('qual_FAB', false, true), ('qual_SIB', false, true), ('qual_TB', false, true)
on conflict (id) do nothing;

update public.academy_courses c set
  title = coalesce(c.title, v.title), description = coalesce(c.description, v.description), category = v.category,
  sort_order = v.sort_order
from (values
  ('mcb', 'MCB nyomozói képzés', 'Major Crimes Bureau: nyomozás, akták, kihallgatás.', 'division', 10),
  ('seb', 'SEB taktikai képzés', 'Special Enforcement Bureau: taktika, behatolás, túszhelyzet.', 'division', 20),
  ('qual_SAHP', 'SAHP képesítés', 'Highway Patrol: forgalomirányítás és üldözés.', 'qualification', 30),
  ('qual_AB', 'AB képesítés', 'Aero Bureau: helikopteres járőrözés.', 'qualification', 40),
  ('qual_MU', 'MU képesítés', 'Medical Unit: elsősegély és mentés.', 'qualification', 50),
  ('qual_GW', 'GW képesítés', 'Game Warden: vadvédelem, vízi és terepi szolgálat.', 'qualification', 60),
  ('qual_FAB', 'FAB képesítés', 'Financial Administration Bureau: pénzügyi adminisztráció.', 'qualification', 70),
  ('qual_SIB', 'SIB képesítés', 'Sheriff''s Information Bureau: kommunikáció és sajtó.', 'qualification', 80),
  ('qual_TB', 'TB képesítés', 'Training Bureau: oktatás és vizsgáztatás.', 'qualification', 90)
) as v(id, title, description, category, sort_order)
where c.id = v.id;

-- Members read an open course their rank allows; instructors read everything.
create or replace function private.can_read_academy_course(_course_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_academy_instructor() or exists (
    select 1 from public.academy_courses c, public.profiles p
    where c.id = _course_id and p.id = (select auth.uid()) and p.system_role <> 'pending' and coalesce(c.is_open, false)
      and (c.required_rank is null or private.rank_index(c.required_rank) = 999
           or private.rank_index(p.faction_rank) <= private.rank_index(c.required_rank))
  )
$$;

drop policy if exists academy_division_materials_select on public.academy_division_materials;
create policy academy_division_materials_select on public.academy_division_materials for select to authenticated
  using (private.can_read_academy_course(course_id));

-- The academy's start page in one request: every course with its state and the caller's
-- progress, and the basic academy's days.
create or replace function public.get_academy_overview()
returns json
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _uid uuid := (select auth.uid());
  _me public.profiles%rowtype;
  _instructor boolean := private.is_academy_instructor();
begin
  select * into _me from public.profiles where id = _uid and system_role <> 'pending';
  if _me.id is null then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  return json_build_object(
    'viewer', json_build_object('instructor', _instructor, 'trainee', _me.faction_rank = 'Deputy Sheriff Trainee'),
    'today', current_date,
    'cycle', (select json_build_object('id', c.id, 'start_date', c.start_date, 'status', c.status)
              from public.academy_cycles c where c.status = 'active' order by c.start_date desc limit 1),
    'basic', (select coalesce(json_agg(json_build_object('day', d.day, 'pages', d.pages) order by d.day), '[]'::json)
              from (select g as day, (select count(*) from public.academy_materials m where m.category = 'basic' and m.day_number = g) as pages
                    from generate_series(1, 5) g) d),
    'courses', (
      select coalesce(json_agg(json_build_object(
        'id', c.id, 'title', coalesce(c.title, c.id), 'description', c.description, 'category', c.category,
        'is_open', coalesce(c.is_open, false), 'required_rank', c.required_rank,
        'linear_progression', coalesce(c.linear_progression, true),
        'pages', (select count(*) from public.academy_division_materials m where m.course_id = c.id),
        'completed', (select count(*) from public.academy_progress pr join public.academy_division_materials m on m.id = pr.material_id
                      where pr.user_id = _uid and m.course_id = c.id),
        'readable', private.can_read_academy_course(c.id),
        'rank_ok', c.required_rank is null or private.rank_index(c.required_rank) = 999
                   or private.rank_index(_me.faction_rank) <= private.rank_index(c.required_rank)
      ) order by c.sort_order, c.id), '[]'::json)
      from public.academy_courses c)
  );
end;
$$;

-- Page order in one request (instructors): the ids in their new order.
create or replace function public.reorder_academy_pages(_kind text, _ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_academy_instructor() then
    raise exception 'Az oldalak sorrendjét az oktatók állítják.' using errcode = '42501';
  end if;
  if _kind = 'basic' then
    update public.academy_materials m set page_order = t.position from unnest(_ids) with ordinality as t(id, position) where m.id = t.id;
  elsif _kind = 'course' then
    update public.academy_division_materials m set page_order = t.position from unnest(_ids) with ordinality as t(id, position) where m.id = t.id;
  else
    raise exception 'Ismeretlen tananyag.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Privileges
-- ---------------------------------------------------------------------------

revoke execute on function private.is_commander_or_manager(), private.hu_month(date), private.hu_amount(bigint),
  private.payroll_rows(date), private.proof_paths(text) from public, anon, authenticated;
revoke execute on function public.finance_proof_cleanup() from public, anon, authenticated;
grant execute on function public.finance_proof_cleanup() to service_role;
revoke execute on function private.can_read_academy_course(text) from public, anon;
grant execute on function private.can_read_academy_course(text) to authenticated;

revoke execute on function public.get_payroll(date), public.save_payroll_entries(date, jsonb), public.close_payroll(date, bigint, text),
  public.reopen_payroll(date), public.set_payroll_paid(date, uuid[], boolean), public.save_payroll_settings(jsonb),
  public.get_my_payslips(), public.decide_budget_request(uuid, boolean, text), public.get_finance_overview(integer),
  public.get_academy_overview(), public.reorder_academy_pages(text, uuid[])
from public, anon, authenticated;
grant execute on function public.get_payroll(date), public.save_payroll_entries(date, jsonb), public.close_payroll(date, bigint, text),
  public.reopen_payroll(date), public.set_payroll_paid(date, uuid[], boolean), public.save_payroll_settings(jsonb),
  public.get_my_payslips(), public.decide_budget_request(uuid, boolean, text), public.get_finance_overview(integer),
  public.get_academy_overview(), public.reorder_academy_pages(text, uuid[])
to authenticated;
