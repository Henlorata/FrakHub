-- The reports the leadership records in the payroll count everywhere (leaderboard, recap, dashboard,
-- workload, service record, promotion board), everyone is on the leaderboard unless they turn it
-- off, the dashboard's last month, the TSB without a Bureau Commander and the front page's join
-- texts (20261009161418). Run with: bunx supabase test db
begin;
select plan(26);

create temporary table ids as select
  '00000000-0000-4000-8000-000000000001'::uuid as admin_id,        -- Commander, TSB, Bureau Manager
  '00000000-0000-4000-8000-000000000003'::uuid as deputy_id,       -- Deputy Sheriff II., TSB
  '00000000-0000-4000-8000-000000000005'::uuid as captain_id,      -- Captain II., TSB (no member_settings row)
  '00000000-0000-4000-8000-000000000007'::uuid as operator_id,     -- Senior Deputy Sheriff, SEB
  '00000000-0000-4000-8000-000000000008'::uuid as trainee_id,      -- Trainee, nothing recorded last month
  (date_trunc('month', now() at time zone 'Europe/Budapest'))::date as this_month,
  (date_trunc('month', now() at time zone 'Europe/Budapest') - interval '1 month')::date as last_month;
grant select on ids to anon, authenticated, service_role;
create temporary table t (key text primary key, value text);
grant all on t to anon, authenticated, service_role;

create function pg_temp.act_as(_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', _id, 'role', 'authenticated')::text, true);
end $$;
create function pg_temp.reset_role() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.j(_key text) returns json language sql as $$ select value::json from t where key = _key $$;
grant execute on function pg_temp.j(text) to anon, authenticated, service_role;
create function pg_temp.entry(_board json, _category text, _user uuid) returns json language sql as $$
  select e from json_array_elements(_board -> 'categories') c, json_array_elements(c -> 'entries') e
  where c ->> 'key' = _category and (e ->> 'user_id')::uuid = _user
$$;
grant execute on function pg_temp.entry(json, text, uuid) to anon, authenticated, service_role;

-- The month's reports -----------------------------------------------------------------------
select is(private.month_reports((select deputy_id from ids), (select this_month from ids)),
  (select count(*)::int from public.report_logs r, ids where r.user_id = ids.deputy_id and r.period = ids.this_month),
  'without a recorded number the month''s reports count');
insert into public.payroll_entries (month, user_id, reports)
select last_month, deputy_id, 17 from ids;
insert into public.payroll_entries (month, user_id, reports)
select last_month, operator_id, null from ids;
select is(private.month_reports((select deputy_id from ids), (select last_month from ids)), 17,
  'the number the leadership recorded in the payroll wins');
select is(private.month_reports((select operator_id from ids), (select last_month from ids)),
  (select count(*)::int from public.report_logs r, ids where r.user_id = ids.operator_id and r.period = ids.last_month),
  'an automatic payroll row keeps the month''s reports');

-- Leaderboard: everyone unless they turn it off ------------------------------------------------
select pg_temp.act_as((select captain_id from ids));
insert into t select 'board', public.get_leaderboard((select last_month from ids))::text;
select is((pg_temp.j('board') ->> 'visible')::boolean, true, 'a member without a setting is on the leaderboard');
select ok(pg_temp.entry(pg_temp.j('board'), 'duty', (select captain_id from ids)) is not null, 'and listed');
select is((pg_temp.entry(pg_temp.j('board'), 'reports', (select deputy_id from ids)) ->> 'value')::int, 17,
  'the leaderboard counts the reports recorded in the payroll');
select is((public.set_leaderboard_visibility(false) ->> 'visible')::boolean, false, 'a member turns it off');
insert into t select 'hidden', public.get_leaderboard((select last_month from ids))::text;
select ok(pg_temp.entry(pg_temp.j('hidden'), 'duty', (select captain_id from ids)) is null, 'then they are not listed');
select ok((select c -> 'me' from json_array_elements(pg_temp.j('hidden') -> 'categories') c where c ->> 'key' = 'duty') is not null,
  'but still see their own place');
select is((public.set_leaderboard_visibility(true) ->> 'visible')::boolean, true, 'and can turn it on again');
select pg_temp.reset_role();
select is((select column_default from information_schema.columns
           where table_schema = 'public' and table_name = 'member_settings' and column_name = 'leaderboard_visible'), 'true',
  'a new setting row is visible by default');

-- Recap, workload, service record, promotion board ------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
select is((public.get_monthly_recap((select last_month from ids)) ->> 'reports')::int, 17, 'the recap counts the recorded reports');
select is((select (r ->> 'count')::int from json_array_elements(public.get_service_record((select deputy_id from ids)) -> 'reports') r
           where (r ->> 'month')::date = (select last_month from ids)), 17, 'the service record counts the recorded reports');
select pg_temp.act_as((select admin_id from ids));
select is((select (m -> 'reports' ->> (select last_month from ids)::text)::int from json_array_elements(public.get_workload() -> 'members') m
           where (m ->> 'user_id')::uuid = (select deputy_id from ids)), 17, 'the workload chart counts the recorded reports');
select pg_temp.reset_role();
select is((select (c ->> 'value')::int
           from public.profiles p,
                jsonb_array_elements(private.promotion_status(p, jsonb_populate_record(null::public.promotion_criteria,
                  '{"rank": "Deputy Sheriff III.", "min_reports": 10, "window_months": 1}'), (select this_month from ids)) -> 'checks') c
           where p.id = (select deputy_id from ids) and c ->> 'key' = 'reports'), 17, 'the promotion board counts the recorded reports');

-- The dashboard's month -----------------------------------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
insert into t select 'month', (public.get_dashboard_summary() -> 'my_month')::text;
select is((pg_temp.j('month') ->> 'reports_recorded')::boolean, false, 'nothing recorded for this month yet');
select is((pg_temp.j('month') -> 'previous' ->> 'reports')::int, 17, 'last month shows the recorded reports');
select is((pg_temp.j('month') -> 'previous' ->> 'duty_minutes')::int,
  (select minutes from public.duty_time_entries d, ids where d.user_id = ids.deputy_id and d.month = ids.last_month), 'and the recorded duty time');
select pg_temp.reset_role();
insert into public.payroll_entries (month, user_id, reports) select this_month, deputy_id, 3 from ids;
update public.payroll_runs set status = 'closed', settings = '{"min_duty_hours": 12, "min_reports": 4}' where month = (select last_month from ids);
select pg_temp.act_as((select deputy_id from ids));
insert into t select 'month2', (public.get_dashboard_summary() -> 'my_month')::text;
select ok((pg_temp.j('month2') ->> 'reports')::int = 3 and (pg_temp.j('month2') ->> 'reports_recorded')::boolean,
  'once the leadership records the month, the dashboard shows their number');
select ok((pg_temp.j('month2') -> 'previous' ->> 'closed')::boolean and (pg_temp.j('month2') -> 'previous' ->> 'min_duty_hours')::int = 12
          and (pg_temp.j('month2') -> 'previous' ->> 'min_reports')::int = 4, 'a closed month is measured by the requirement it was closed with');
select pg_temp.act_as((select trainee_id from ids));
select is(public.get_dashboard_summary() -> 'my_month' ->> 'previous', null, 'no last month for someone with nothing recorded');

-- The TSB has no Bureau Commander -------------------------------------------------------------------
select pg_temp.reset_role();
update public.profiles set is_bureau_commander = true where id = (select operator_id from ids);
select is((select is_bureau_commander from public.profiles where id = (select operator_id from ids)), true, 'a SEB member can lead the SEB');
update public.profiles set division = 'TSB', division_rank = null where id = (select operator_id from ids);
select is((select is_bureau_commander from public.profiles where id = (select operator_id from ids)), false,
  'moving to the TSB ends the Bureau Commander role');
select ok(exists (select 1 from public.member_events e, ids where e.user_id = ids.operator_id and e.kind = 'bureau_role'
                  and e.from_value = 'Bureau Commander, MU'), 'and it is logged in the member''s history');
update public.profiles set is_bureau_commander = true where id = (select deputy_id from ids);
select is((select is_bureau_commander from public.profiles where id = (select deputy_id from ids)), false, 'a TSB member cannot become one');

-- Joining happens on the forum ---------------------------------------------------------------------
select ok((select value #>> '{steps,0,text}' from public.site_content where key = 'recruitment') like '%fórum Jelentkezések rovatában%'
          and not exists (select 1 from public.site_content c, jsonb_array_elements(c.value) item
                          where c.key = 'faq' and item ->> 'a' like '%gombbal regisztrálhatsz%'),
  'the seeded front page texts send visitors to the forum');

select * from finish();
rollback;
