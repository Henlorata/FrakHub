-- Reports on the site (20261010154417, 20261010164659): the payroll period, the lock at the payment, every member
-- reads them, only the author changes one, the Supervisory Staff and above void one. Run with: bunx supabase test db
begin;
select plan(31);

create temporary table ids as select
  '00000000-0000-4000-8000-000000000001'::uuid as admin_id,       -- Commander (pays)
  '00000000-0000-4000-8000-000000000002'::uuid as sergeant_id,    -- Sergeant I. (staff, does not pay)
  '00000000-0000-4000-8000-000000000003'::uuid as deputy_id,
  '00000000-0000-4000-8000-000000000004'::uuid as pending_id,
  '00000000-0000-4000-8000-000000000006'::uuid as corporal_id,
  (date_trunc('month', now() at time zone 'Europe/Budapest'))::date as this_month,
  (date_trunc('month', now() at time zone 'Europe/Budapest') - interval '1 month')::date as last_month,
  (date_trunc('month', now() at time zone 'Europe/Budapest') + interval '1 month')::date as next_month;
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

-- The period ------------------------------------------------------------------------------------
select is(private.report_period(now()), (select this_month from ids), 'while no month was paid, a report counts for its calendar month');

-- The month before last was paid early last month, last month is paid on the 5th of this month.
insert into public.payroll_runs (month, status, closed_at, reports_closed_at)
select (last_month - interval '1 month')::date, 'closed', last_month + interval '3 days', last_month + interval '3 days' from ids
on conflict (month) do update set status = 'closed', closed_at = excluded.closed_at, reports_closed_at = excluded.reports_closed_at;
select is(private.report_period((select this_month from ids) + interval '2 days'), (select last_month from ids),
  'until last month is paid, the reports still count for it');
insert into public.payroll_runs (month, status, closed_at, reports_closed_at)
select last_month, 'closed', this_month + interval '4 days', this_month + interval '4 days' from ids
on conflict (month) do update set status = 'closed', closed_at = excluded.closed_at, reports_closed_at = excluded.reports_closed_at;
select is(private.report_period((select this_month from ids) + interval '5 days'), (select this_month from ids),
  'the payment starts the next month');
select is(private.report_period((select this_month from ids) + interval '3 days'), (select last_month from ids),
  'a report written before the payment stays in the paid month');
select is(private.report_period((select this_month from ids) + interval '2 months 1 day'), (select next_month from ids),
  'a payment left out does not pull reports back further than the previous calendar month');
update public.payroll_runs set status = 'open', closed_at = null, reports_closed_at = null;

-- Writing and reading -----------------------------------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
insert into t select 'saved', public.save_report(null, '{"suspect_name": "John Doe", "charges": "Gyorshajtás", "fine": "1500",
  "description": "Megállítottam a járművet.", "officer_name": "Deputy Teszt", "occurred_on": "2000-01-01"}')::text;
select ok((pg_temp.j('saved') ->> 'number') is not null and (pg_temp.j('saved') ->> 'period')::date = (select this_month from ids)
          and pg_temp.j('saved') ->> 'title' = 'John Doe – Gyorshajtás', 'a member saves a report: numbered, titled, counted for the month');
select is((select occurred_on from public.report_logs where id = (pg_temp.j('saved') ->> 'id')::uuid), (now() at time zone 'Europe/Budapest')::date,
  'an impossible date becomes today');
select throws_ok($$select public.save_report(null, '{"fine": "500"}')$$, '22023', null, 'an empty report is not saved');

select pg_temp.act_as((select corporal_id from ids));
select ok((select count(*) from public.report_logs where user_id = (select deputy_id from ids)) > 0, 'every member reads the reports of others');
insert into t select 'list', public.get_reports(null, null, 'john doe', null, 5)::text;
select is(pg_temp.j('list') -> 'items' -> 0 -> 'author' ->> 'full_name', 'Deputy Teszt', 'the list names the author');
select throws_ok(format($$select public.save_report(%L, '{"suspect_name": "Más"}')$$, pg_temp.j('saved') ->> 'id'), '42501', null,
  'only the author changes a report');
select throws_ok(format($$select public.delete_report(%L)$$, pg_temp.j('saved') ->> 'id'), '42501', null, 'or deletes it');
select pg_temp.act_as((select pending_id from ids));
select throws_ok($$select public.get_reports()$$, '42501', null, 'an account waiting for approval reads none');
select pg_temp.reset_role();
set local role anon;
select throws_ok($$select public.get_reports()$$, '42501', null, 'visitors read none');
reset role;

-- The payment locks the month -------------------------------------------------------------------------
select pg_temp.act_as((select admin_id from ids));
insert into t select 'payroll', public.close_payroll((select this_month from ids))::text;
select pg_temp.reset_role();
select ok((select reports_closed_at is not null from public.payroll_runs where month = (select this_month from ids)), 'paying the month locks its reports');
select is((select (r ->> 'reports_logged')::int from jsonb_array_elements(private.payroll_rows((select this_month from ids))) r
           where (r ->> 'user_id')::uuid = (select deputy_id from ids)),
          (select count(*)::int from public.report_logs r, ids where r.user_id = ids.deputy_id and r.period = ids.this_month),
  'the payroll counts the month''s reports');
select pg_temp.act_as((select deputy_id from ids));
select throws_ok(format($$select public.save_report(%L, '{"suspect_name": "John Doe", "charges": "Más vád"}')$$, pg_temp.j('saved') ->> 'id'),
  '42501', null, 'a paid month''s report cannot be changed');
select throws_ok(format($$select public.delete_report(%L)$$, pg_temp.j('saved') ->> 'id'), '42501', null, 'nor deleted');
select throws_ok(format($$update public.report_logs set title = 'Átírva' where id = %L$$, pg_temp.j('saved') ->> 'id'), '42501', null,
  'not even directly');
select is(public.set_report_link((pg_temp.j('saved') ->> 'id')::uuid, 'https://forum.hl-rpg.eu/posts/9101/') ->> 'forum_url',
  'https://forum.hl-rpg.eu/posts/9101/', 'its forum link can still be added');
insert into t select 'next', public.save_report(null, '{"suspect_name": "Jane Roe", "charges": "Lopás"}')::text;
select is((pg_temp.j('next') ->> 'period')::date, (select next_month from ids), 'the next report counts for the next month');
select pg_temp.act_as((select admin_id from ids));
insert into t select 'reopened', public.reopen_payroll((select this_month from ids))::text;
select pg_temp.reset_role();
select ok((select reports_closed_at is not null from public.payroll_runs where month = (select this_month from ids)),
  'reopening the payroll keeps the month locked');

-- Voiding -----------------------------------------------------------------------------------------
select pg_temp.act_as((select corporal_id from ids));
select throws_ok(format($$select public.void_report(%L, 'Nincs a fórumon')$$, pg_temp.j('next') ->> 'id'), '42501', null,
  'below the Supervisory Staff nobody voids a report');
select pg_temp.act_as((select sergeant_id from ids));
select throws_ok(format($$select public.void_report(%L, '')$$, pg_temp.j('next') ->> 'id'), '22023', null, 'with a reason');
select is((public.void_report((pg_temp.j('next') ->> 'id')::uuid, 'Nincs fent a fórumon') ->> 'voided')::boolean, true,
  'the Supervisory Staff voids a report');
select pg_temp.reset_role();
select is(private.month_reports((select deputy_id from ids), (select next_month from ids)), 0, 'a voided report does not count');
select ok(exists (select 1 from public.notifications n, ids where n.user_id = ids.deputy_id and n.dedupe_key = 'report-void:' || (pg_temp.j('next') ->> 'id')),
  'and its author is told why');
select pg_temp.act_as((select sergeant_id from ids));
select is((public.restore_report((pg_temp.j('next') ->> 'id')::uuid) ->> 'voided')::boolean, false, 'a voided report can be restored');
select pg_temp.reset_role();
select is(private.month_reports((select deputy_id from ids), (select next_month from ids)), 1, 'then it counts again');

-- The month's overview and the dashboard ------------------------------------------------------------
select pg_temp.act_as((select corporal_id from ids));
insert into t select 'overview', public.get_report_overview((select this_month from ids))::text;
select ok((pg_temp.j('overview') ->> 'locked')::boolean
          and (select (m ->> 'reports')::int from json_array_elements(pg_temp.j('overview') -> 'members') m
               where (m ->> 'user_id')::uuid = (select deputy_id from ids)) > 0,
  'everyone sees the month''s reports per member and whether it is locked');
select pg_temp.act_as((select deputy_id from ids));
select is((public.get_dashboard_summary() -> 'my_month' ->> 'report_period')::date, (select next_month from ids),
  'the dashboard follows the month the reports count for');

select * from finish();
rollback;
