-- Payroll, report log, reimbursements and the academy catalogue. Run with: bunx supabase test db
-- Uses the accounts from supabase/seed.sql. The expected amounts follow the leadership's old
-- payroll sheet (rank pay and duty pay only from 30 hours, unit and qualification pay always).
begin;
select plan(58);

create temporary table ids as select
  '00000000-0000-4000-8000-000000000001'::uuid as admin_id,        -- Commander, TSB, TB (paid as BM)
  '00000000-0000-4000-8000-000000000002'::uuid as sergeant_id,     -- Sergeant I., MCB, SAHP
  '00000000-0000-4000-8000-000000000003'::uuid as deputy_id,       -- Deputy Sheriff II., TSB
  '00000000-0000-4000-8000-000000000005'::uuid as captain_id,      -- Captain II., TSB, FAB (admin, not Commander)
  '00000000-0000-4000-8000-000000000006'::uuid as corporal_id,     -- Corporal, MCB, GW
  '00000000-0000-4000-8000-000000000007'::uuid as operator_id,     -- Senior Deputy Sheriff, SEB, MU + AB
  '00000000-0000-4000-8000-000000000008'::uuid as trainee_id,
  (date_trunc('month', (now() at time zone 'Europe/Budapest')) - interval '2 months')::date as month;
grant select on ids to anon, authenticated, service_role;

create temporary table t (key text primary key, value text);
grant all on t to anon, authenticated, service_role;

create function pg_temp.act_as(_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', _id, 'role', 'authenticated')::text, true);
end $$;
create function pg_temp.act_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.j(_key text) returns json language sql as $$ select value::json from t where key = _key $$;
-- The row of one member in a payroll reply.
create function pg_temp.row_of(_key text, _user uuid) returns json language sql as $$
  select r from t, json_array_elements(t.value::json -> 'rows') r where t.key = _key and (r ->> 'user_id')::uuid = _user
$$;
grant execute on function pg_temp.j(text), pg_temp.row_of(text, uuid) to authenticated, service_role;

-- --- Report log ----------------------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
insert into public.report_logs (user_id, occurred_on, title, forum_url, source)
select deputy_id, month + 3, 'Gyorshajtás – John Doe', 'https://forum.hl-rpg.eu/threads/deputy-teszt-jelentesi-mappaja.100/post-5001', 'generator'
from ids;
insert into public.report_logs (user_id, occurred_on, title, forum_url)
select deputy_id, month + 4, 'Rablás – Jane Roe', 'https://forum.hl-rpg.eu/posts/5002/' from ids;
select is((select count(*)::int from public.report_logs r, ids where r.month = ids.month), 2, 'members log their own reports');
select is((select created_by from public.report_logs r, ids where r.month = ids.month limit 1), (select deputy_id from ids), 'the author is recorded');
select throws_ok(format($$insert into public.report_logs (user_id, occurred_on, title, forum_url) values (%L, %L, 'Másolat', 'https://forum.hl-rpg.eu/posts/5001/')$$,
                        (select deputy_id from ids), (select month + 5 from ids)),
  '23505', null, 'the same forum post counts once, whatever the link form');
select throws_ok(format($$insert into public.report_logs (user_id, occurred_on, title) values (%L, current_date, 'Más nevében')$$,
                        (select corporal_id from ids)),
  '42501', null, 'members cannot log reports for others');
select throws_ok($$insert into public.report_logs (user_id, occurred_on, title, forum_url)
                  values ('00000000-0000-4000-8000-000000000003', current_date, 'Rossz link', 'https://example.com/x')$$,
  '23514', null, 'only forum links are accepted');
update public.report_logs set forum_url = 'https://forum.hl-rpg.eu/posts/5003/' where forum_url like '%5002%';
select is((select forum_post_id from public.report_logs where title like 'Rablás%' and month = (select month from ids)), 5003::bigint, 'the link can be added later');

select pg_temp.act_as((select corporal_id from ids));
select is((select count(*)::int from public.report_logs where user_id <> (select corporal_id from ids)), 0,
  'members do not see the reports of others');
select pg_temp.act_as((select sergeant_id from ids));
select is((select count(*)::int from public.report_logs r, ids where r.user_id = ids.deputy_id and r.month = ids.month), 2,
  'staff see every report');

-- --- Payroll: access -------------------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
select throws_ok(format('select public.get_payroll(%L)', (select month from ids)), '42501', null, 'members cannot open the payroll');
select throws_ok(format($$select public.save_payroll_entries(%L, '[]')$$, (select month from ids)), '42501', null,
  'members cannot edit the payroll');
select throws_ok($$select public.save_payroll_settings('{}')$$, '42501', null, 'members cannot change the pay table');
select pg_temp.act_as((select captain_id from ids));
select throws_ok($$select public.save_payroll_settings('{}')$$, '42501', null, 'only the Commander changes the pay table');
select throws_ok(format('select public.get_payroll(%L)', (select month from ids)), '42501', null,
  'command staff below the executives cannot open the payroll');

-- --- Payroll: computing a month ----------------------------------------------------
select pg_temp.act_as((select admin_id from ids));
insert into t select 'empty', public.get_payroll((select month from ids))::text;
select is(pg_temp.j('empty') ->> 'status', 'open', 'a month starts open');
select is(json_array_length(pg_temp.j('empty') -> 'rows'), 7, 'every member except pending accounts is on the sheet');
select is(pg_temp.j('empty') ->> 'can_edit_settings', 'true', 'the Commander may change the pay table');

insert into t select 'saved', public.save_payroll_entries((select month from ids), jsonb_build_array(
  jsonb_build_object('user_id', admin_id, 'duty_minutes', 7000),
  jsonb_build_object('user_id', sergeant_id, 'duty_minutes', 6000, 'reports', 19, 'trained', 1, 'bonus', 10000000,
                     'bonus_note', 'Ajánlás', 'top_duty', 0, 'top_report', 1),
  jsonb_build_object('user_id', deputy_id, 'duty_minutes', 1700),
  jsonb_build_object('user_id', captain_id, 'duty_minutes', 1200, 'account_number', '11712345-67891234-00099999'),
  jsonb_build_object('user_id', corporal_id, 'duty_minutes', 3000),
  jsonb_build_object('user_id', operator_id, 'duty_minutes', null, 'reports', 5, 'qual_key', ''),
  jsonb_build_object('user_id', '00000000-0000-4000-8000-000000000004', 'pictures', 3)
))::text from ids;

-- Commander: 15M rank + 3M executive unit (BM) + 0.5M TB + 10M for 100+ hours + 6M first in duty time.
select is((pg_temp.row_of('saved', (select admin_id from ids)) ->> 'total')::bigint, 34500000::bigint,
  'the Commander is paid as the executive unit with the top duty bonus');
select is(pg_temp.row_of('saved', (select admin_id from ids)) ->> 'unit', 'BM', 'executive staff are paid as BM');
select is(pg_temp.row_of('saved', (select admin_id from ids)) ->> 'top_duty', '1', 'the most duty time is first automatically');
-- Sergeant: 13M + 0.5M MCB + 0.45M SAHP + 10M + 19 reports + 1 trained + 6M first in reports + 10M bonus.
select is((pg_temp.row_of('saved', (select sergeant_id from ids)) ->> 'total')::bigint, 50450000::bigint,
  'every part of the pay adds up like on the old sheet');
select is(pg_temp.row_of('saved', (select sergeant_id from ids)) ->> 'top_duty', '0', 'a TOP place set by hand wins');
-- Corporal: 12M + 0.5M MCB + 0.4M GW (first qualification) + 5M for 50+ hours + 4M third in duty time.
select is((pg_temp.row_of('saved', (select corporal_id from ids)) ->> 'total')::bigint, 21900000::bigint,
  'the first qualification is paid by default');
-- Deputy: under 30 hours, so only the two logged reports and third place in reports.
select is((pg_temp.row_of('saved', (select deputy_id from ids)) ->> 'reports')::int, 2, 'logged reports are counted');
select is((pg_temp.row_of('saved', (select deputy_id from ids)) ->> 'total')::bigint, 5000000::bigint,
  'under the minimum duty time there is no rank or duty pay');
-- Captain: under 30 hours, FAB pay only (the sheet's Roger Wothsmer row).
select is((pg_temp.row_of('saved', (select captain_id from ids)) ->> 'total')::bigint, 400000::bigint,
  'the qualification is paid regardless of duty time');
-- Operator: no duty, SEB 0.5M, qualification switched off, 5 reports and second place in reports.
select is((pg_temp.row_of('saved', (select operator_id from ids)) ->> 'total')::bigint, 8000000::bigint,
  'a qualification can be switched off for the month');
select is((pg_temp.row_of('saved', (select trainee_id from ids)) ->> 'total')::bigint, 0::bigint, 'trainees are not paid by default');
select is((pg_temp.j('saved') ->> 'total')::bigint, 120250000::bigint, 'the month total is the sum of the rows');
select is((pg_temp.j('saved') ->> 'tax')::bigint, 3607500::bigint, 'the tax is computed from the total');

select pg_temp.act_postgres();
select is((select minutes from public.duty_time_entries d, ids where d.user_id = sergeant_id and d.month = ids.month), 6000,
  'duty time entered on the payroll lands in the HR registry');
select is((select count(*)::int from public.duty_time_entries d, ids where d.user_id = operator_id and d.month = ids.month), 0,
  'clearing the duty time removes the registry entry');
select is((select account_number from public.member_bank_accounts b, ids where b.user_id = captain_id),
  '11712345-67891234-00099999', 'the account number is stored in the HR registry');
select is((select count(*)::int from public.payroll_entries where user_id = '00000000-0000-4000-8000-000000000004'), 0,
  'pending accounts are ignored');

-- --- Payroll: paying out and closing ---------------------------------------------------
select pg_temp.act_as((select admin_id from ids));
insert into t select 'paid', public.set_payroll_paid(month, array[sergeant_id, captain_id], true)::text from ids;
select is((pg_temp.j('paid') ->> 'paid_total')::bigint, 50850000::bigint, 'paid members are summed');
select is((public.set_payroll_balance((select month from ids), 250000000) ->> 'balance')::bigint, 250000000::bigint,
  'the leadership records the treasury balance');
select pg_temp.act_as((select deputy_id from ids));
select throws_ok(format('select public.set_payroll_balance(%L, 1000)', (select month from ids)), '42501', null,
  'members cannot set the treasury balance');
select pg_temp.act_as((select admin_id from ids));

insert into t select 'closed', public.close_payroll(month, 120000000, 'Megbeszélés után')::text from ids;
select is(pg_temp.j('closed') ->> 'status', 'closed', 'the month is closed');
select is((pg_temp.j('closed') ->> 'withdrawn')::bigint, 120000000::bigint, 'the withdrawn amount is kept');
select throws_ok(format($$select public.save_payroll_entries(%L, '[]')$$, (select month from ids)), 'P0001', null,
  'a closed month cannot be edited');

select pg_temp.act_postgres();
select is((select count(*)::int from public.notifications where dedupe_key = 'payroll:' || (select month from ids)), 6,
  'every paid member is notified, the Commander too');
select is((select count(*)::int from public.notifications n, ids where n.user_id = trainee_id and n.category = 'finance'), 0,
  'members without pay get no notification');

select pg_temp.act_as((select admin_id from ids));
select lives_ok($$select public.save_payroll_settings('{"rank_pay": {"Commander": 15000000}, "report_pay": 600000, "tax_percent": 3}')$$,
  'the Commander changes the pay table');
select is((public.get_payroll((select month from ids)) ->> 'total')::bigint, 120250000::bigint,
  'a closed month keeps the amounts it was closed with');

select pg_temp.act_as((select deputy_id from ids));
select is(json_array_length(public.get_my_payslips()), 1, 'members see their closed months');
select is((public.get_my_payslips() -> 0 -> 'row' ->> 'total')::bigint, 5000000::bigint, 'with their own amount');

select pg_temp.act_as((select captain_id from ids));
select throws_ok(format('select public.reopen_payroll(%L)', (select month from ids)), '42501', null,
  'only the Commander reopens a closed month');
select pg_temp.act_as((select admin_id from ids));
insert into t select 'reopened', public.reopen_payroll(month)::text from ids;
select is(pg_temp.j('reopened') ->> 'status', 'open', 'the Commander reopens the month');
-- The new table: only the Commander's rank keeps its pay; reports are worth 0.6M now.
select is((pg_temp.row_of('reopened', (select sergeant_id from ids)) ->> 'total')::bigint, 39350000::bigint,
  'a reopened month is computed with the current table, the extras are kept');
select is(pg_temp.row_of('reopened', (select sergeant_id from ids)) ->> 'paid', 'true', 'payments stay marked');

-- --- Reimbursements --------------------------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
insert into public.budget_requests (user_id, amount, reason, proof_image_path)
select deputy_id, 25000, 'Üzemanyag', '["deputy/proof.webp"]' from ids;
select throws_ok(format('select public.decide_budget_request(%L, true)', (select id from public.budget_requests limit 1)),
  '42501', null, 'members cannot decide requests');
select pg_temp.act_as((select captain_id from ids));
select throws_ok(format('select public.decide_budget_request(%L, false)', (select id from public.budget_requests limit 1)),
  'P0001', null, 'a rejection needs a reason');
select is(public.decide_budget_request((select id from public.budget_requests limit 1), true) ->> 'status', 'approved',
  'the high command approves a request');
insert into public.budget_requests (user_id, amount, reason) select captain_id, 5000, 'Saját' from ids;
select throws_ok(format('select public.decide_budget_request(%L, true)', (select id from public.budget_requests where reason = 'Saját')),
  '42501', null, 'nobody below the executives approves their own request');

select pg_temp.act_postgres();
update public.budget_requests set updated_at = now() - interval '50 days' where reason = 'Üzemanyag';
set local role service_role;
select is(public.finance_proof_cleanup() -> 'remove' ->> 0, 'deputy/proof.webp', 'old proofs are handed to the cron for removal');
select pg_temp.act_postgres();
select ok((select proofs_removed_at is not null and proof_image_path = '[]' from public.budget_requests where reason = 'Üzemanyag'),
  'the request stays in the history without its proofs');

-- --- Academy catalogue ------------------------------------------------------------------
insert into public.academy_division_materials (course_id, title, content) values ('mcb', 'Zárt oldal', '[]');
select pg_temp.act_as((select deputy_id from ids));
select is((select count(*)::int from public.academy_division_materials where course_id = 'mcb'), 0, 'pages of a closed course are hidden from members');
select is((select c ->> 'readable' from json_array_elements(public.get_academy_overview() -> 'courses') c where c ->> 'id' = 'mcb'),
  'false', 'the overview marks a closed course');
select pg_temp.act_as((select admin_id from ids));
select ok((select count(*) from public.academy_division_materials where course_id = 'mcb') >= 1, 'instructors see the pages of a closed course');

select * from finish();
rollback;
