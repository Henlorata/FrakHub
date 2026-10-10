-- =============================================================================
-- Reports on the site (the members' request of 2026-10-10)
--   The report generator saves every report it makes here, linked to its author and counted for
--   them; every member reads every report (as on the forum, so there is no rank limit). A report
--   counts for the payroll month it was written in: from one payment (the first close_payroll of a
--   month) to the next. When a month is paid, its reports are locked and the next ones count for the
--   following month. Posting on the forum stays required (the forum's template is unchanged); the
--   forum link is optional here. Later the forum step can be dropped: every field is stored.
--   report_logs keeps its name and its old columns, because the deployed frontend still writes them;
--   the generator's fields, the payroll period, a running number and the leadership's voiding are
--   added. The direct table writes are closed after the deploy (supabase/post-deploy/).
-- =============================================================================

create or replace function pg_temp.patch_function(_fn regprocedure, _done text, variadic _pairs text[])
returns void
language plpgsql
as $f$
declare
  _def text := replace(pg_get_functiondef(_fn), chr(13), '');
  _i integer;
begin
  if _done is not null and position(_done in _def) > 0 then return; end if;
  for _i in 1 .. coalesce(array_length(_pairs, 1), 0) / 2 loop
    if position(_pairs[_i * 2 - 1] in _def) = 0 then
      raise exception '%: anchor not found: %', _fn, left(_pairs[_i * 2 - 1], 160);
    end if;
    _def := replace(_def, _pairs[_i * 2 - 1], _pairs[_i * 2]);
  end loop;
  execute _def;
end;
$f$;

-- 1. The payroll period of a report -----------------------------------------------
-- When a month was first paid (closed): its reports were locked then, and the next ones count for
-- the following month. Reopening the payroll keeps it, so a correction does not move reports.
alter table public.payroll_runs add column if not exists reports_closed_at timestamptz;
update public.payroll_runs set reports_closed_at = closed_at where status = 'closed' and reports_closed_at is null;

-- The month a report written at _at counts for: the month after the last one paid before it (the
-- calendar month while nothing was paid yet), never older than the previous calendar month (a
-- payment the leadership forgot does not pull new reports back).
create or replace function private.report_period(_at timestamptz default now())
returns date
language sql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
  select greatest(
    coalesce((select (max(r.month) + interval '1 month')::date from public.payroll_runs r where r.reports_closed_at <= _at),
             date_trunc('month', _at)::date),
    (date_trunc('month', _at) - interval '1 month')::date)
$$;

create or replace function private.report_period_locked(_period date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.payroll_runs r where r.month = _period and r.reports_closed_at is not null)
$$;

-- 2. The report's fields ------------------------------------------------------------
-- As the generator's form holds them (the forum template's fields, as written), so the BBCode can
-- be made again and the forum step dropped one day.
alter table public.report_logs
  add column if not exists number bigint generated always as identity,
  add column if not exists period date,
  add column if not exists officer_name text check (char_length(officer_name) <= 120),
  add column if not exists officer_rank text check (char_length(officer_rank) <= 60),
  add column if not exists badge_number text check (char_length(badge_number) <= 20),
  add column if not exists colleagues text check (char_length(colleagues) <= 400),
  add column if not exists unit_id text check (char_length(unit_id) <= 40),
  add column if not exists suspect_name text check (char_length(suspect_name) <= 120),
  add column if not exists suspect_id_card text check (char_length(suspect_id_card) <= 40),
  add column if not exists suspect_license text check (char_length(suspect_license) <= 40),
  add column if not exists suspect_medical text check (char_length(suspect_medical) <= 40),
  add column if not exists report_date text check (char_length(report_date) <= 40),
  add column if not exists charges text check (char_length(charges) <= 2000),
  add column if not exists fine text check (char_length(fine) <= 20),
  add column if not exists jail_time text check (char_length(jail_time) <= 20),
  add column if not exists confiscated_items text check (char_length(confiscated_items) <= 1000),
  add column if not exists description text check (char_length(description) <= 8000),
  add column if not exists updated_at timestamptz,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references public.profiles(id) on delete set null,
  add column if not exists void_reason text check (char_length(void_reason) <= 300);

-- 'report': a full report saved by the generator; 'generator'/'manual': the old entries (title and link).
alter table public.report_logs drop constraint if exists report_logs_source_check;
alter table public.report_logs add constraint report_logs_source_check check (source in ('generator', 'manual', 'report'));

update public.report_logs set period = private.report_period(created_at) where period is null;
alter table public.report_logs alter column period set not null;
create unique index if not exists report_logs_number_key on public.report_logs (number);
create index if not exists report_logs_period_idx on public.report_logs (period, number desc);
create index if not exists report_logs_user_period_idx on public.report_logs (user_id, period);

-- The period is set when the report is written and members never change it (the service role and
-- the database owner may, for a correction). A paid month's reports stay as they were paid: only the
-- leadership changes them (voiding), a forum link may still be added, and deleting a member's account
-- (service role, no caller) takes their reports along.
create or replace function private.report_logs_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select auth.uid()) is not null or new.period is null then new.period := private.report_period(now()); end if;
    return new;
  end if;
  if tg_op = 'UPDATE' and (select auth.uid()) is not null then
    new.period := old.period;
  end if;
  if (select auth.uid()) is not null and private.report_period_locked(old.period)
     and not private.is_executive_or_manager()
     and coalesce(current_setting('app.report_link_only', true), '') <> 'on' then
    raise exception 'Ennek a hónapnak a jelentései a fizetéskor lezárultak.' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
drop trigger if exists report_logs_guard on public.report_logs;
create trigger report_logs_guard before insert or update or delete on public.report_logs
  for each row execute function private.report_logs_guard();

-- Every member reads every report (they read them on the forum too).
drop policy if exists report_logs_select on public.report_logs;
create policy report_logs_select on public.report_logs for select to authenticated
  using ((select private.is_member()));

-- 3. Reading and writing ------------------------------------------------------------
create or replace function private.report_text(_value text, _limit integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(left(btrim(replace(coalesce(_value, ''), chr(13), ''), E' \t\n'), _limit), '')
$$;

-- One report for the pages: the list fields, and with _full everything the report page shows.
create or replace function private.report_json(_r public.report_logs, _full boolean)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', _r.id, 'number', _r.number, 'period', _r.period, 'occurred_on', _r.occurred_on, 'created_at', _r.created_at,
    'updated_at', _r.updated_at, 'source', _r.source, 'title', _r.title, 'forum_url', _r.forum_url,
    'suspect_name', _r.suspect_name, 'charges', case when _full then _r.charges else left(_r.charges, 300) end,
    'fine', _r.fine, 'jail_time', _r.jail_time, 'unit_id', _r.unit_id,
    'voided', _r.voided_at is not null, 'void_reason', _r.void_reason,
    'excerpt', case when _full then null else left(regexp_replace(coalesce(_r.description, ''), '\s+', ' ', 'g'), 220) end,
    'author', private.person_json(_r.user_id))
  || case when _full then jsonb_build_object(
    'officer_name', _r.officer_name, 'officer_rank', _r.officer_rank, 'badge_number', _r.badge_number,
    'colleagues', _r.colleagues, 'suspect_id_card', _r.suspect_id_card, 'suspect_license', _r.suspect_license,
    'suspect_medical', _r.suspect_medical, 'report_date', _r.report_date, 'confiscated_items', _r.confiscated_items,
    'description', _r.description, 'voided_at', _r.voided_at, 'voided_by', private.person_json(_r.voided_by),
    'updated_by', private.person_json(_r.updated_by)) else '{}'::jsonb end
$$;

-- The generator's period and the caller's count in it.
create or replace function public.get_report_period()
returns json
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _p date := private.report_period(now());
begin
  if not private.is_member() then
    raise exception 'Csak a frakció tagjai láthatják a jelentéseket.' using errcode = '42501';
  end if;
  return json_build_object('period', _p,
    'mine', (select count(*) from public.report_logs r where r.user_id = (select auth.uid()) and r.period = _p and r.voided_at is null),
    'started_at', (select max(r.reports_closed_at) from public.payroll_runs r where r.month < _p and r.reports_closed_at is not null));
end;
$$;

-- Saves a report of the generator: a new one (_report_id null) or the caller's own while its month
-- is open. _report: the form's fields (officer_name, officer_rank, badge_number, colleagues,
-- unit_id, suspect_name, suspect_id_card, suspect_license, suspect_medical, report_date, charges,
-- fine, jail_time, confiscated_items, description), occurred_on (the report's date, else today)
-- and forum_url (set only when the key is given).
create or replace function public.save_report(_report_id uuid, _report jsonb)
returns json
language plpgsql
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _me uuid := (select auth.uid());
  _f jsonb := coalesce(_report, '{}'::jsonb);
  _r public.report_logs;
  _occurred date;
  _suspect text := private.report_text(_f ->> 'suspect_name', 120);
  _charges text := private.report_text(_f ->> 'charges', 2000);
  _description text := private.report_text(_f ->> 'description', 8000);
  _title text;
  _url text := private.report_text(_f ->> 'forum_url', 500);
begin
  if not private.is_member() then
    raise exception 'Csak a frakció tagjai menthetnek jelentést.' using errcode = '42501';
  end if;
  if _suspect is null and _charges is null and _description is null then
    raise exception 'Üres jelentést nem lehet menteni: add meg a személyt, a vádat vagy a leírást.' using errcode = '22023';
  end if;
  begin
    _occurred := (_f ->> 'occurred_on')::date;
  exception when others then
    _occurred := null;
  end;
  if _occurred is null or _occurred < current_date - 400 or _occurred > current_date + 1 then _occurred := current_date; end if;
  _title := left(coalesce(_suspect, 'Ismeretlen személy') || coalesce(' – ' || _charges, ''), 160);

  if _report_id is null then
    insert into public.report_logs (user_id, occurred_on, title, forum_url, source, created_by, officer_name, officer_rank, badge_number,
                                    colleagues, unit_id, suspect_name, suspect_id_card, suspect_license, suspect_medical, report_date,
                                    charges, fine, jail_time, confiscated_items, description)
    values (_me, _occurred, _title, _url, 'report', _me, private.report_text(_f ->> 'officer_name', 120), private.report_text(_f ->> 'officer_rank', 60),
            private.report_text(_f ->> 'badge_number', 20), private.report_text(_f ->> 'colleagues', 400), private.report_text(_f ->> 'unit_id', 40),
            _suspect, private.report_text(_f ->> 'suspect_id_card', 40), private.report_text(_f ->> 'suspect_license', 40),
            private.report_text(_f ->> 'suspect_medical', 40), private.report_text(_f ->> 'report_date', 40), _charges,
            private.report_text(_f ->> 'fine', 20), private.report_text(_f ->> 'jail_time', 20), private.report_text(_f ->> 'confiscated_items', 1000),
            _description)
    returning * into _r;
  else
    select * into _r from public.report_logs where id = _report_id for update;
    if not found then raise exception 'A jelentés nem található.' using errcode = 'P0002'; end if;
    if _r.user_id <> _me then raise exception 'Csak a saját jelentésedet szerkesztheted.' using errcode = '42501'; end if;
    if private.report_period_locked(_r.period) then
      raise exception 'Ennek a hónapnak a jelentései a fizetéskor lezárultak.' using errcode = '42501';
    end if;
    update public.report_logs set
      occurred_on = _occurred, title = _title, source = 'report',
      forum_url = case when _f ? 'forum_url' then _url else forum_url end,
      officer_name = private.report_text(_f ->> 'officer_name', 120), officer_rank = private.report_text(_f ->> 'officer_rank', 60),
      badge_number = private.report_text(_f ->> 'badge_number', 20), colleagues = private.report_text(_f ->> 'colleagues', 400),
      unit_id = private.report_text(_f ->> 'unit_id', 40), suspect_name = _suspect,
      suspect_id_card = private.report_text(_f ->> 'suspect_id_card', 40), suspect_license = private.report_text(_f ->> 'suspect_license', 40),
      suspect_medical = private.report_text(_f ->> 'suspect_medical', 40), report_date = private.report_text(_f ->> 'report_date', 40),
      charges = _charges, fine = private.report_text(_f ->> 'fine', 20), jail_time = private.report_text(_f ->> 'jail_time', 20),
      confiscated_items = private.report_text(_f ->> 'confiscated_items', 1000), description = _description,
      updated_at = now(), updated_by = _me
    where id = _report_id
    returning * into _r;
  end if;

  return (private.report_json(_r, false) || jsonb_build_object('locked', false,
    'period_count', (select count(*) from public.report_logs r where r.user_id = _me and r.period = _r.period and r.voided_at is null)))::json;
end;
$$;

-- The forum link of a report: its author (also after the month was paid) or the leadership.
create or replace function public.set_report_link(_report_id uuid, _forum_url text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _r public.report_logs;
begin
  if not private.is_member() then
    raise exception 'Csak a frakció tagjai menthetnek jelentést.' using errcode = '42501';
  end if;
  select * into _r from public.report_logs where id = _report_id for update;
  if not found then raise exception 'A jelentés nem található.' using errcode = 'P0002'; end if;
  if _r.user_id <> (select auth.uid()) and not private.is_executive_or_manager() then
    raise exception 'Csak a saját jelentésedhez adhatsz linket.' using errcode = '42501';
  end if;
  perform set_config('app.report_link_only', 'on', true);
  update public.report_logs set forum_url = private.report_text(_forum_url, 500) where id = _report_id returning * into _r;
  perform set_config('app.report_link_only', '', true);
  return json_build_object('id', _r.id, 'forum_url', _r.forum_url);
end;
$$;

-- A mistake is deleted by its author while its month is open; the leadership voids instead.
create or replace function public.delete_report(_report_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _r public.report_logs;
begin
  select * into _r from public.report_logs where id = _report_id for update;
  if not found then raise exception 'A jelentés nem található.' using errcode = 'P0002'; end if;
  if _r.user_id <> (select auth.uid()) then
    raise exception 'Csak a saját jelentésedet törölheted.' using errcode = '42501';
  end if;
  if private.report_period_locked(_r.period) then
    raise exception 'Ennek a hónapnak a jelentései a fizetéskor lezárultak.' using errcode = '42501';
  end if;
  delete from public.report_logs where id = _report_id;
end;
$$;

-- The leadership (who pays) takes a report out of the count, with the reason the author is told.
create or replace function public.void_report(_report_id uuid, _reason text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _r public.report_logs;
  _why text := private.report_text(_reason, 300);
begin
  if not private.is_executive_or_manager() then
    raise exception 'Jelentést az Executive Staff és a Bureau Manager érvényteleníthet.' using errcode = '42501';
  end if;
  if char_length(coalesce(_why, '')) < 3 then
    raise exception 'Írd meg röviden, miért érvénytelen a jelentés.' using errcode = '22023';
  end if;
  update public.report_logs set voided_at = now(), voided_by = (select auth.uid()), void_reason = _why
  where id = _report_id and voided_at is null
  returning * into _r;
  if not found then raise exception 'A jelentés nem található, vagy már érvénytelen.' using errcode = 'P0002'; end if;
  perform private.notify(array[_r.user_id], format('Érvénytelen jelentés: #%s', _r.number), format('%s · %s', _r.title, _why),
    'warning', 'finance', '/reports/' || _r.id, 'report-void:' || _r.id);
  return public.get_report(_r.id);
end;
$$;

create or replace function public.restore_report(_report_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _r public.report_logs;
begin
  if not private.is_executive_or_manager() then
    raise exception 'Jelentést az Executive Staff és a Bureau Manager érvényteleníthet.' using errcode = '42501';
  end if;
  update public.report_logs set voided_at = null, voided_by = null, void_reason = null
  where id = _report_id and voided_at is not null
  returning * into _r;
  if not found then raise exception 'A jelentés nem található, vagy nem érvénytelen.' using errcode = 'P0002'; end if;
  return public.get_report(_r.id);
end;
$$;

-- One report with what the caller may do with it.
create or replace function public.get_report(_report_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _r public.report_logs;
  _me uuid := (select auth.uid());
  _lead boolean := private.is_executive_or_manager();
  _locked boolean;
begin
  if not private.is_member() then
    raise exception 'Csak a frakció tagjai láthatják a jelentéseket.' using errcode = '42501';
  end if;
  select * into _r from public.report_logs where id = _report_id;
  if not found then raise exception 'A jelentés nem található.' using errcode = 'P0002'; end if;
  _locked := private.report_period_locked(_r.period);
  return (private.report_json(_r, true) || jsonb_build_object(
    'locked', _locked,
    'locked_at', (select r.reports_closed_at from public.payroll_runs r where r.month = _r.period),
    'can_edit', _r.user_id = _me and not _locked,
    'can_link', _r.user_id = _me or _lead,
    'can_void', _lead))::json;
end;
$$;

-- Reports, newest first, 40 at a time (_before: the number of the last one shown). _period: the
-- payroll month (null = the one reports count for now), _all_periods: every month; _query: the
-- number, the people, the charges, the unit or the text. With the month's lock, for the page's header.
create or replace function public.get_reports(_period date default null, _user_id uuid default null, _query text default null,
                                              _before bigint default null, _limit integer default 40, _all_periods boolean default false)
returns json
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _current date := private.report_period(now());
  _p date := case when coalesce(_all_periods, false) then null
                  else coalesce((date_trunc('month', _period::timestamp))::date, _current) end;
  _q text := private.report_text(_query, 80);
  _like text;
  _number bigint;
  _n integer := least(greatest(coalesce(_limit, 40), 1), 100);
  _items jsonb;
  _more boolean;
begin
  if not private.is_member() then
    raise exception 'Csak a frakció tagjai láthatják a jelentéseket.' using errcode = '42501';
  end if;
  if _q is not null then
    _like := '%' || replace(replace(replace(_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
    if _q ~ '^#?\d{1,12}$' then _number := ltrim(_q, '#')::bigint; end if;
  end if;
  with page as (
    select r, row_number() over (order by r.number desc) as i
    from public.report_logs r
    where (_p is null or r.period = _p)
      and (_user_id is null or r.user_id = _user_id)
      and (_before is null or r.number < _before)
      and (_q is null or r.number = _number or r.title ilike _like or r.suspect_name ilike _like or r.charges ilike _like
           or r.officer_name ilike _like or r.unit_id ilike _like or r.colleagues ilike _like or r.description ilike _like
           or exists (select 1 from public.profiles p where p.id = r.user_id and (p.full_name ilike _like or p.badge_number = _q)))
    order by r.number desc
    limit _n + 1
  )
  select coalesce(jsonb_agg(private.report_json(page.r, false) order by page.i) filter (where page.i <= _n), '[]'::jsonb), count(*) > _n
  into _items, _more
  from page;
  return json_build_object('items', _items, 'more', _more, 'period', _p, 'current', _current,
    'locked', case when _p is not null then private.report_period_locked(_p) end,
    'locked_at', (select r.reports_closed_at from public.payroll_runs r where r.month = _p),
    'started_at', (select max(r.reports_closed_at) from public.payroll_runs r where r.month < coalesce(_p, _current) and r.reports_closed_at is not null));
end;
$$;

-- A month's reports per member (everyone sees it), the months to choose from and the lock.
create or replace function public.get_report_overview(_period date default null)
returns json
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _current date := private.report_period(now());
  _p date := coalesce((date_trunc('month', _period::timestamp))::date, _current);
  _run public.payroll_runs;
begin
  if not private.is_member() then
    raise exception 'Csak a frakció tagjai láthatják a jelentéseket.' using errcode = '42501';
  end if;
  select * into _run from public.payroll_runs where month = _p;
  return json_build_object(
    'period', _p,
    'current', _current,
    'locked', _run.reports_closed_at is not null,
    'locked_at', _run.reports_closed_at,
    -- The payment that opened the month (the previous month's).
    'started_at', (select max(r.reports_closed_at) from public.payroll_runs r where r.month < _p and r.reports_closed_at is not null),
    'min_reports', coalesce((_run.settings ->> 'min_reports')::int, (select s.min_reports from public.payroll_settings s where s.id = 'global')),
    'total', (select count(*) from public.report_logs r where r.period = _p and r.voided_at is null),
    'voided', (select count(*) from public.report_logs r where r.period = _p and r.voided_at is not null),
    'mine', (select count(*) from public.report_logs r where r.user_id = (select auth.uid()) and r.period = _p and r.voided_at is null),
    'periods', (select json_agg(json_build_object(
                         'period', g::date,
                         'count', (select count(*) from public.report_logs r where r.period = g::date and r.voided_at is null),
                         'locked', private.report_period_locked(g::date)) order by g desc)
                from generate_series((_current - interval '11 months')::timestamp, _current::timestamp, interval '1 month') g),
    'members', (select coalesce(json_agg(json_build_object(
                         'user_id', m.id, 'full_name', m.full_name, 'faction_rank', m.faction_rank, 'badge_number', m.badge_number,
                         'avatar_url', m.avatar_url, 'reports', m.reports, 'voided', m.voided, 'counted', m.counted,
                         'recorded', m.recorded, 'last_on', m.last_on)
                       order by m.counted desc, m.rank_order, m.full_name), '[]'::json)
                from (select p.id, p.full_name, p.faction_rank, p.badge_number, p.avatar_url, private.rank_index(p.faction_rank) as rank_order,
                             (select count(*) from public.report_logs r where r.user_id = p.id and r.period = _p and r.voided_at is null)::int as reports,
                             (select count(*) from public.report_logs r where r.user_id = p.id and r.period = _p and r.voided_at is not null)::int as voided,
                             private.month_reports(p.id, _p) as counted,
                             exists (select 1 from public.payroll_entries e where e.user_id = p.id and e.month = _p and e.reports is not null) as recorded,
                             (select max(r.occurred_on) from public.report_logs r where r.user_id = p.id and r.period = _p and r.voided_at is null) as last_on
                      from public.profiles p where p.system_role <> 'pending') m));
end;
$$;

-- 4. Counting by the payroll period -------------------------------------------------
-- The number the leadership recorded in the payroll sheet, otherwise the reports of the period.
create or replace function private.month_reports(_user uuid, _month date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select e.reports from public.payroll_entries e where e.user_id = _user and e.month = _month),
    (select count(*)::integer from public.report_logs r where r.user_id = _user and r.period = _month and r.voided_at is null));
$$;

select pg_temp.patch_function('private.payroll_rows(date)', 'r.period = _month',
  $a$(select count(*) from public.report_logs r where r.user_id = p.id and r.month = _month)::integer as reports_logged,$a$,
  $b$(select count(*) from public.report_logs r where r.user_id = p.id and r.period = _month and r.voided_at is null)::integer as reports_logged,$b$);

-- The month is paid: its reports are locked from now on (reopening keeps the time).
select pg_temp.patch_function('public.close_payroll(date, bigint, text)', 'reports_closed_at',
  $a$closed_at = now(), closed_by = _uid$a$,
  $b$closed_at = now(), closed_by = _uid, reports_closed_at = coalesce(reports_closed_at, now())$b$);

-- The dashboard: the period the reports count for now (the previous month until it is paid).
select pg_temp.patch_function('public.get_dashboard_summary()', 'period_reports',
  $a$      'reports', private.month_reports(_me.id, _month),$a$,
  $b$      'reports', private.month_reports(_me.id, _month),
      'report_period', private.report_period(now()),
      'period_reports', private.month_reports(_me.id, private.report_period(now())),$b$);

-- Voided reports leave the counts.
select pg_temp.patch_function('public.get_briefing()', 'r.voided_at is null',
  $a$from public.report_logs r where r.created_at > now()$a$,
  $b$from public.report_logs r where r.voided_at is null and r.created_at > now()$b$);
select pg_temp.patch_function('public.get_department_stats(integer)', 'r.voided_at is null',
  $a$from public.report_logs r where r.created_at$a$,
  $b$from public.report_logs r where r.voided_at is null and r.created_at$b$,
  $a$from public.report_logs r where date_trunc(_unit$a$,
  $b$from public.report_logs r where r.voided_at is null and date_trunc(_unit$b$);
select pg_temp.patch_function('public.get_trainees()', 'voided_at is null',
  $a$from public.report_logs where user_id = p.id) r$a$,
  $b$from public.report_logs where user_id = p.id and voided_at is null) r$b$);

-- 5. Privileges -------------------------------------------------------------------
revoke execute on function private.report_period(timestamptz), private.report_period_locked(date), private.report_logs_guard(),
  private.report_text(text, integer), private.report_json(public.report_logs, boolean), private.month_reports(uuid, date)
  from public, anon, authenticated;
revoke execute on function public.get_report_period(), public.save_report(uuid, jsonb), public.set_report_link(uuid, text),
  public.delete_report(uuid), public.void_report(uuid, text), public.restore_report(uuid), public.get_report(uuid),
  public.get_reports(date, uuid, text, bigint, integer, boolean), public.get_report_overview(date)
  from public, anon;
grant execute on function public.get_report_period(), public.save_report(uuid, jsonb), public.set_report_link(uuid, text),
  public.delete_report(uuid), public.void_report(uuid, text), public.restore_report(uuid), public.get_report(uuid),
  public.get_reports(date, uuid, text, bigint, integer, boolean), public.get_report_overview(date)
  to authenticated;

drop function pg_temp.patch_function(regprocedure, text, text[]);
