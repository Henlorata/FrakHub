-- Housekeeping, the payslip and award documents, reports from the public page (no e-mail: a
-- tracking code) and the MCB's relationship graph.
-- Run with: bunx supabase test db
begin;
select plan(37);

create temporary table ids as select
  '00000000-0000-4000-8000-000000000001'::uuid as admin_id,        -- Commander, Bureau Manager
  '00000000-0000-4000-8000-000000000002'::uuid as supervisor_id,   -- Sergeant I., MCB
  '00000000-0000-4000-8000-000000000003'::uuid as deputy_id,       -- Deputy Sheriff II., TSB
  '00000000-0000-4000-8000-000000000006'::uuid as investigator_id; -- Corporal, MCB
grant select on ids to anon, authenticated, service_role;
create temporary table state (key text primary key, value text);
grant all on state to anon, authenticated, service_role;

create function pg_temp.act_as(_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', _id, 'role', 'authenticated')::text, true);
end $$;
create function pg_temp.act_anon(_ip text) returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('request.headers', json_build_object('x-forwarded-for', _ip)::text, true);
end $$;

-- ---------------------------------------------------------------------------------------------
-- Housekeeping
-- ---------------------------------------------------------------------------------------------
insert into public.notifications (user_id, title, message, type, category, is_read, created_at) values
  ((select deputy_id from ids), 'Régi olvasott', 'x', 'info', 'system', true, now() - interval '35 days'),
  ((select deputy_id from ids), 'Friss olvasott', 'x', 'info', 'system', true, now() - interval '5 days');
insert into public.action_logs (user_id, action_type, details, created_at) values
  ((select deputy_id from ids), 'ticket', 'Bírság: $500', now() - interval '30 days'),
  ((select deputy_id from ids), 'ticket', 'Bírság: $700', now() - interval '500 days');

select pg_temp.act_as((select admin_id from ids));
select throws_ok('select public.run_housekeeping()', '42501', null, 'members cannot run the housekeeping');
set local role service_role;
select lives_ok('select public.run_housekeeping()', 'the daily job runs it');
set local role postgres;
select ok(not exists (select 1 from public.notifications where title = 'Régi olvasott'), 'read notifications go after a month');
select ok(exists (select 1 from public.notifications where title = 'Friss olvasott'), 'newer ones stay');
select ok(exists (select 1 from public.action_logs where details = 'Bírság: $500'), 'the calculator''s log stays for the statistics (a month old)');
select ok(not exists (select 1 from public.action_logs where details = 'Bírság: $700'), 'and goes after 400 days');
select pg_temp.act_as((select admin_id from ids));
select ok((public.get_dashboard_summary() -> 'db_health' ->> 'bytes')::bigint > 0, 'the Bureau Manager sees the database''s size');
select ok(public.get_db_health() is not null, 'also on the statistics page');
select pg_temp.act_as((select deputy_id from ids));
select ok((public.get_dashboard_summary() ->> 'db_health') is null, 'a member does not');
select throws_ok('select public.get_db_health()', '42501', null, 'and cannot read it');

-- ---------------------------------------------------------------------------------------------
-- Payslips
-- ---------------------------------------------------------------------------------------------
set local role postgres;
insert into public.payroll_runs (month, status, settings, closed_at, closed_by)
values ('2025-07-01', 'closed', '{"tax_percent": 3}'::jsonb, now(), (select admin_id from ids));
insert into public.payroll_entries (month, user_id, snapshot, paid) values
  ('2025-07-01', (select deputy_id from ids), jsonb_build_object('name', 'Deputy Teszt', 'total', 1000000, 'pay', '{}'::jsonb), true);
insert into public.payroll_runs (month, status) values ('2025-08-01', 'open');

select pg_temp.act_as((select deputy_id from ids));
select is(public.get_payslip_document('2025-07-15', null) -> 'closed_by' ->> 'full_name', 'Admin Teszt', 'a member prints their payslip, signed by whoever closed the month');
select ok(public.get_payslip_document('2025-08-01', null) is null, 'an open month has no payslip');
select pg_temp.act_as((select supervisor_id from ids));
select throws_ok(format('select public.get_payslip_document(%L, %L)', '2025-07-01', (select deputy_id from ids)), '42501', null,
  'another member''s payslip is for the leadership only');
select pg_temp.act_as((select admin_id from ids));
select is((public.get_payslip_document('2025-07-01', (select deputy_id from ids)) -> 'member' ->> 'full_name'), 'Deputy Teszt',
  'the leadership prints anyone''s');

-- ---------------------------------------------------------------------------------------------
-- Award certificates
-- ---------------------------------------------------------------------------------------------
set local role postgres;
insert into state select 'ribbon', ur.id::text from public.user_ribbons ur where ur.user_id = (select supervisor_id from ids) limit 1;
insert into public.hr_records (user_id, kind, title, status, created_by) values
  ((select deputy_id from ids), 'commendation', 'Kiemelkedő helytállás', 'revoked', (select admin_id from ids));
insert into state select 'revoked', h.id::text from public.hr_records h where h.title = 'Kiemelkedő helytállás';

select pg_temp.act_as((select supervisor_id from ids));
select ok((public.get_award_document('ribbon', (select value::uuid from state where key = 'ribbon')) -> 'head' ->> 'full_name') is not null,
  'a member prints their ribbon''s certificate, signed by the department head');
select pg_temp.act_as((select deputy_id from ids));
select throws_ok(format('select public.get_award_document(%L, %L)', 'ribbon', (select value from state where key = 'ribbon')), '42501', null,
  'but not someone else''s');
select ok(public.get_award_document('commendation', (select value::uuid from state where key = 'revoked')) is null, 'a revoked commendation has no certificate');

-- ---------------------------------------------------------------------------------------------
-- Reports from the public page
-- ---------------------------------------------------------------------------------------------
select pg_temp.act_anon('203.0.113.5');
insert into state select 'code', public.submit_public_report('complaint', 'Durva igazoltatás', 'Tegnap este egy deputy indokolatlanul durván igazoltatott.',
  'Carl Johnson', '555-0199', null, 4000) ->> 'code';
select matches((select value from state where key = 'code'), '^SF-[2-9A-HJKMNP-Z]{4}(-[2-9A-HJKMNP-Z]{4}){3}$', 'the visitor gets a tracking code (no e-mail)');
select is(json_array_length(public.get_public_report((select value from state where key = 'code')) -> 'messages'), 1, 'and reads the report with it');
select ok(public.get_public_report(left((select value from state where key = 'code'), 13) || 'AAAA-AAAA') is null, 'a wrong secret reads nothing');
select throws_ok($$select public.submit_public_report('tip', 'Gyanús autó', 'Egy fekete Sultan áll a kikötőben napok óta.', null, null, 'http://spam', 4000)$$,
  '54000', null, 'the hidden field stops bots');
select throws_ok($$select public.submit_public_report('tip', 'Gyanús autó', 'Egy fekete Sultan áll a kikötőben napok óta.', null, null, null, 300)$$,
  '54000', null, 'so does sending at once');
select lives_ok(format('select public.reply_public_report(%L, %L)', (select value from state where key = 'code'), 'Kiegészítés: a jelvényszáma 1234 volt.'),
  'the visitor adds to it');

set local role postgres;
insert into state select 'thread', t.id::text from public.mail_threads t where t.public_ref = left((select value from state where key = 'code'), 12);
select ok(private.can_read_mail((select value::uuid from state where key = 'thread'), (select admin_id from ids)),
  'while the IAB has no staff, the Bureau Manager reads the complaints');
select ok(exists (select 1 from public.notifications n where n.user_id = (select admin_id from ids) and n.category = 'iab'
                  and n.dedupe_key = 'mail:' || (select value from state where key = 'thread')), 'and is notified');

select pg_temp.act_as((select admin_id from ids));
select lives_ok(format($$select public.send_mail(null, 'Tisztelt Uram! Kivizsgáljuk.', '[]'::jsonb, %L, 'self', null, null, true)$$, (select value from state where key = 'thread')),
  'the answer for the visitor');
select lives_ok(format($$select public.send_mail(null, 'Belső: nézzük meg a bodycamet.', '[]'::jsonb, %L, 'self', null, null, false)$$, (select value from state where key = 'thread')),
  'and an internal note');
select ok((public.get_mail_thread((select value::uuid from state where key = 'thread')) -> 'public' ->> 'ref') is not null, 'the staff see where it came from');
select pg_temp.act_anon('203.0.113.5');
select is(json_array_length(public.get_public_report((select value from state where key = 'code')) -> 'messages'), 3,
  'the visitor reads the answer meant for them, not the internal note');
select pg_temp.act_as((select admin_id from ids));
select lives_ok(format('select public.set_public_report_status(%L, %L)', (select value from state where key = 'thread'), 'closed'), 'the staff close it');
select pg_temp.act_anon('203.0.113.5');
select throws_ok(format('select public.reply_public_report(%L, %L)', (select value from state where key = 'code'), 'Még egy dolog'), 'P0001', null,
  'a closed report takes no more messages');
select lives_ok($$select public.submit_public_report('question', 'Jelentkezés', 'Mikor lesz a következő felvételi vizsga a tagoknak?', null, null, null, 4000);
                  select public.submit_public_report('question', 'Jelentkezés 2', 'Mikor lesz a következő felvételi vizsga a tagoknak?', null, null, null, 4000)$$,
  'three reports a day from one place');
select throws_ok($$select public.submit_public_report('question', 'Jelentkezés 3', 'Mikor lesz a következő felvételi vizsga a tagoknak?', null, null, null, 4000)$$,
  '54000', null, 'not a fourth');

-- ---------------------------------------------------------------------------------------------
-- The relationship graph
-- ---------------------------------------------------------------------------------------------
set local role postgres;
insert into public.suspects (id, full_name, status) values
  ('3a000000-0000-4000-8000-000000000001', 'Graf Alfa', 'wanted'),
  ('3a000000-0000-4000-8000-000000000002', 'Graf Béta', 'free'),
  ('3a000000-0000-4000-8000-000000000003', 'Graf Gamma', 'free');
insert into public.suspect_vehicles (suspect_id, plate_number, vehicle_type) values
  ('3a000000-0000-4000-8000-000000000001', 'GR-0101', 'Sultan'),
  ('3a000000-0000-4000-8000-000000000002', 'gr 0101', 'Sultan');
insert into public.suspect_properties (suspect_id, address, property_type) values
  ('3a000000-0000-4000-8000-000000000002', 'Graf utca 1.', 'house'),
  ('3a000000-0000-4000-8000-000000000003', ' graf utca 1. ', 'house');

select pg_temp.act_as((select deputy_id from ids));
select throws_ok($$select public.get_relationship_graph('person:3a000000-0000-4000-8000-000000000001', 2)$$, '42501', null,
  'the graph is for the MCB and the staff');
select pg_temp.act_as((select investigator_id from ids));
select is((select count(*)::int from json_array_elements(public.get_relationship_graph('person:3a000000-0000-4000-8000-000000000002', 2) -> 'nodes') n
           where n ->> 'kind' = 'person'), 3, 'a shared plate and a shared address link three persons');
select is((select count(*)::int from json_array_elements(public.get_relationship_graph('person:3a000000-0000-4000-8000-000000000002', 2) -> 'nodes') n
           where n ->> 'kind' = 'plate'), 1, 'the two spellings of the plate are one vehicle');
select ok(exists (select 1 from json_array_elements(public.search_graph_nodes('gr 01')) hit where hit ->> 'kind' = 'plate'), 'a plate is found however it is typed');

select * from finish();
rollback;
