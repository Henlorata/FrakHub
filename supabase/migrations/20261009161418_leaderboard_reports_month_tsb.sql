-- =============================================================================
-- The owners' requests of 2026-10-09:
--   1. The reports the leadership records in the payroll sheet count everywhere. They are typed
--      in at the end of the month (payroll_entries.reports; members log almost nothing on the
--      site), and only the payroll used them: the leaderboard, the dashboard's month, the recap,
--      the promotion board, the workload chart and the service record counted report_logs only,
--      so a recorded and closed month still showed no reports there.
--   2. Everyone is on the leaderboard unless they turn it off (it was opt-in); everyone who had it
--      off is put on it once.
--   3. The dashboard's month: the reports as above, whether the leadership recorded them, and last
--      month's recorded result (this month's figures arrive only at the end of the month).
--   4. The TSB has no Bureau Commander (the faction's rule, also on the old site): two SEB
--      commanders moved to the TSB on 2026-10-06 kept the flag, so the front page called them
--      "TSB Bureau Commander". A trigger clears the flag for the TSB, and their flag is cleared.
--   5. Joining happens on the forum: the front page's seeded texts that sent visitors to the
--      site's registration are corrected where the editors have not changed them.
-- Compatible with the deployed frontend (same keys, new ones added).
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

-- 1. A member's reports in a month --------------------------------------------
-- The count the payroll uses (private.payroll_rows): the number the leadership recorded in the
-- payroll sheet, otherwise the reports logged on the site.
create or replace function private.month_reports(_user uuid, _month date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select e.reports from public.payroll_entries e where e.user_id = _user and e.month = _month),
    (select count(*)::integer from public.report_logs r where r.user_id = _user and r.month = _month));
$$;
revoke execute on function private.month_reports(uuid, date) from public, anon, authenticated;

select pg_temp.patch_function('private.promotion_status(public.profiles, public.promotion_criteria, date)', 'private.month_reports',
  $a$select count(*) into _reports from public.report_logs where user_id = _p.id and month >= _from and month < _current;$a$,
  $b$select coalesce(sum(private.month_reports(_p.id, g::date)), 0) into _reports
  from generate_series(_from::timestamp, (_current - interval '1 month')::timestamp, interval '1 month') g;$b$);

select pg_temp.patch_function('public.get_service_record(uuid)', 'private.month_reports',
  $a$from (select month, count(*) as n from public.report_logs where user_id = _p.id and month >= _from group by month) x),$a$,
  $b$from (select g::date as month, private.month_reports(_p.id, g::date) as n
                      from generate_series(_from::timestamp, date_trunc('month', current_date::timestamp), interval '1 month') g) x
                where x.n > 0),$b$);

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
                    from (select g::date as month, private.month_reports(p.id, g::date) as n
                          from generate_series(_first::timestamp, _current::timestamp, interval '1 month') g) r
                    where r.n > 0),
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

-- 2. The leaderboard: everyone unless they turn it off ------------------------
alter table public.member_settings alter column leaderboard_visible set default true;
update public.member_settings set leaderboard_visible = true, updated_at = now() where not leaderboard_visible;

create or replace function public.get_leaderboard(_month date default null)
returns json
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _me uuid := (select auth.uid());
  _m date;
  _next date;
begin
  if not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  _m := (date_trunc('month', coalesce(_month, current_date)::timestamp))::date;
  _next := (_m + interval '1 month')::date;
  return (
    with members as (
      -- Everyone is listed unless they turned it off.
      select p.id, p.full_name, p.badge_number, p.faction_rank, p.avatar_url, coalesce(s.leaderboard_visible, true) as visible
      from public.profiles p left join public.member_settings s on s.user_id = p.id
      where p.system_role <> 'pending'
    ), pool as (
      select * from members where visible or id = _me
    ), scores as (
      select 'duty' as category, m.id,
             coalesce((select e.minutes from public.duty_time_entries e where e.user_id = m.id and e.month = _m), 0)::bigint as value
      from pool m
      union all
      select 'reports', m.id, private.month_reports(m.id, _m)::bigint from pool m
      union all
      select 'events', m.id, (select count(*) from public.event_attendance a join public.events e on e.id = a.event_id
                              where a.user_id = m.id and e.starts_at >= _m and e.starts_at < _next and e.cancelled_at is null)
      from pool m
      union all
      select 'practice', m.id, (select count(*) from public.practice_days d
                                where d.user_id = m.id and d.day >= _m and d.day < _next and d.answered >= 10)
      from pool m
    ), ranked as (
      -- Only the members who appear compete for the places.
      select s.category, s.id, s.value, rank() over (partition by s.category order by s.value desc) as place
      from scores s join members m on m.id = s.id
      where s.value > 0 and m.visible
    )
    select json_build_object(
      'month', _m,
      'visible', coalesce((select visible from members where id = _me), false),
      'participants', (select count(*) from members where visible),
      'categories', (
        select json_agg(json_build_object(
          'key', c.key,
          'entries', (select coalesce(json_agg(json_build_object('user_id', t.id, 'full_name', t.full_name, 'badge_number', t.badge_number,
                                                               'faction_rank', t.faction_rank, 'avatar_url', t.avatar_url,
                                                               'value', t.value, 'place', t.place, 'me', t.id = _me)
                                             order by t.place, t.full_name), '[]'::json)
                      from (select r.place, r.value, m.* from ranked r join members m on m.id = r.id
                            where r.category = c.key order by r.place, m.full_name limit 10) t),
          -- The caller's place among the listed members (counted in, also when they do not appear).
          'me', (select json_build_object('value', s.value,
                                          'place', 1 + (select count(*) from ranked x where x.category = c.key and x.value > s.value),
                                          'of', (select count(*) from ranked x where x.category = c.key)
                                                + case when exists (select 1 from ranked x where x.category = c.key and x.id = _me) then 0 else 1 end)
                 from scores s where s.category = c.key and s.id = _me and s.value > 0)
        ) order by c.ord)
        from (values ('duty', 1), ('reports', 2), ('events', 3), ('practice', 4)) as c(key, ord))
    )
  );
end;
$$;

create or replace function public.get_monthly_recap(_month date default null)
returns json
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _me uuid := (select auth.uid());
  _m date;
  _next date;
  _duty integer;
  _reports integer;
  _snapshot jsonb;
begin
  if not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  _m := (date_trunc('month', coalesce(_month, (current_date - interval '1 month')::date)::timestamp))::date;
  _next := (_m + interval '1 month')::date;
  select minutes into _duty from public.duty_time_entries where user_id = _me and month = _m;
  _reports := private.month_reports(_me, _m);
  select e.snapshot into _snapshot from public.payroll_entries e join public.payroll_runs r on r.month = e.month and r.status = 'closed'
  where e.user_id = _me and e.month = _m;
  return (
    with reports as (select private.month_reports(p.id, _m) as n from public.profiles p where p.system_role <> 'pending')
    select json_build_object(
      'month', _m,
      'duty_minutes', _duty,
      'duty_avg', (select round(avg(minutes)) from public.duty_time_entries where month = _m and minutes > 0),
      'duty_better_than', case when _duty is not null then
        (select round(100.0 * count(*) filter (where minutes < _duty) / nullif(count(*), 0)) from public.duty_time_entries where month = _m) end,
      'reports', _reports,
      'reports_avg', (select round(avg(n), 1) from reports where n > 0),
      'reports_better_than', (select round(100.0 * count(*) filter (where n < _reports) / nullif(count(*), 0)) from reports),
      'events_attended', (select count(*) from public.event_attendance a join public.events e on e.id = a.event_id
                          where a.user_id = _me and e.starts_at >= _m and e.starts_at < _next and e.cancelled_at is null),
      'events_total', (select count(*) from public.events e
                       where e.starts_at >= _m and e.starts_at < _next and e.cancelled_at is null and e.attendance_taken_at is not null
                         and _me = any(private.event_audience_ids(e.audience))),
      'practice_correct', (select coalesce(sum(correct), 0) from public.practice_days where user_id = _me and day >= _m and day < _next),
      'practice_days', (select count(*) from public.practice_days where user_id = _me and day >= _m and day < _next),
      'pay', case when _snapshot is not null then (_snapshot ->> 'total')::bigint end,
      'top_duty', nullif((_snapshot ->> 'top_duty')::int, 0),
      'top_report', nullif((_snapshot ->> 'top_report')::int, 0),
      'promotions', (select coalesce(json_agg(json_build_object('to', to_value, 'at', created_at) order by created_at), '[]'::json)
                     from public.member_events where user_id = _me and kind = 'rank' and detail = 'promotion'
                       and created_at >= _m and created_at < _next),
      'awards', (select coalesce(json_agg(json_build_object('name', r.name, 'color_hex', r.color_hex) order by ur.awarded_at), '[]'::json)
                 from public.user_ribbons ur join public.ribbons r on r.id = ur.ribbon_id
                 where ur.user_id = _me and ur.awarded_at >= _m and ur.awarded_at < _next),
      'certificates', (select count(*) from public.certificates
                       where user_id = _me and issued_at >= _m and issued_at < _next and revoked_at is null),
      'leaderboard_visible', coalesce((select leaderboard_visible from public.member_settings where user_id = _me), true)
    )
  );
end;
$$;

-- 3. The dashboard's month ------------------------------------------------------
select pg_temp.patch_function('public.get_dashboard_summary()', 'reports_recorded',
  $a$      'reports', (select count(*) from report_logs where user_id = _me.id and month = _month),$a$,
  $b$      'reports', private.month_reports(_me.id, _month),
      -- The leadership recorded the month's report count (at the end of the month); otherwise the logged ones.
      'reports_recorded', exists (select 1 from payroll_entries e where e.user_id = _me.id and e.month = _month and e.reports is not null),
      -- Last month as recorded for the member, against the requirement of its closed payroll (null: nothing recorded).
      'previous', (
        select json_build_object('month', _prev, 'duty_minutes', d.minutes, 'reports', private.month_reports(_me.id, _prev),
                                 'min_duty_hours', coalesce((r.settings ->> 'min_duty_hours')::int, s.min_duty_hours),
                                 'min_reports', coalesce((r.settings ->> 'min_reports')::int, s.min_reports),
                                 'closed', coalesce(r.status = 'closed', false))
        from payroll_settings s
        left join payroll_runs r on r.month = _prev
        left join duty_time_entries d on d.user_id = _me.id and d.month = _prev
        where s.id = 'global'
          and (d.minutes is not null or private.month_reports(_me.id, _prev) > 0
               or exists (select 1 from payroll_entries e where e.user_id = _me.id and e.month = _prev and e.snapshot is not null))),$b$);

-- 4. The TSB has no Bureau Commander --------------------------------------------
create or replace function private.no_tsb_bureau_commander()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.division = 'TSB' then new.is_bureau_commander := false; end if;
  return new;
end;
$$;
revoke execute on function private.no_tsb_bureau_commander() from public, anon, authenticated;

create trigger before_profile_tsb_commander
before insert or update of division, is_bureau_commander on public.profiles
for each row execute function private.no_tsb_bureau_commander();

-- Logged in their history like any change of the leadership roles (and they are told).
update public.profiles set is_bureau_commander = false where division = 'TSB' and is_bureau_commander;

-- 5. Joining happens on the forum -----------------------------------------------
update public.site_content
set value = jsonb_set(value, '{steps,0,text}', to_jsonb('Add le a jelentkezésedet a fórum Jelentkezések rovatában; a Személyügy elbírálja.'::text)),
    updated_at = now()
where key = 'recruitment' and value #>> '{steps,0,text}' = 'Regisztrálj az oldalon, a Személyügy elbírálja a kérelmedet.';

update public.site_content c
set value = (select jsonb_agg(case when x.item ->> 'a' = 'A „Csatlakozz hozzánk” gombbal regisztrálhatsz. A Személyügy elbírálja a kérelmedet, és értesít a következő lépésekről.'
                                   then jsonb_set(x.item, '{a}', to_jsonb('A fórum Jelentkezések rovatában: a „Csatlakozz hozzánk” gomb oda visz. A Személyügy elbírálja a jelentkezésedet, és értesít a következő lépésekről.'::text))
                                   else x.item end order by x.ord)
             from jsonb_array_elements(c.value) with ordinality as x(item, ord)),
    updated_at = now()
where c.key = 'faq' and jsonb_typeof(c.value) = 'array'
  and exists (select 1 from jsonb_array_elements(c.value) item
              where item ->> 'a' = 'A „Csatlakozz hozzánk” gombbal regisztrálhatsz. A Személyügy elbírálja a kérelmedet, és értesít a következő lépésekről.');

drop function pg_temp.patch_function(regprocedure, text, text[]);
