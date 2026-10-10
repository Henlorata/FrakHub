-- Practice decks and scenarios, certificates and their public check, the leaderboard,
-- the monthly recap, the service record, the penal code announcement and the new dashboard and
-- payslip keys. Run with: bunx supabase test db
begin;
select plan(48);

create temporary table ids as select
  '00000000-0000-4000-8000-000000000001'::uuid as admin_id,        -- Commander (academy instructor)
  '00000000-0000-4000-8000-000000000002'::uuid as supervisor_id,   -- Sergeant I. (staff)
  '00000000-0000-4000-8000-000000000003'::uuid as deputy_id,       -- Deputy Sheriff II. (four-day practice streak)
  '00000000-0000-4000-8000-000000000005'::uuid as captain_id,      -- Captain II. (turns the leaderboard off)
  '00000000-0000-4000-8000-000000000006'::uuid as investigator_id, -- Corporal, GW
  '20000000-0000-4000-8000-000000000002'::uuid as exam_id;         -- the seeded SEB exam
grant select on ids to anon, authenticated, service_role;
create temporary table t (key text primary key, value text);
grant all on t to anon, authenticated, service_role;

create function pg_temp.act_as(_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', _id, 'role', 'authenticated')::text, true);
end $$;
create function pg_temp.act_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
end $$;
create function pg_temp.reset_role() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.j(_key text) returns json language sql as $$ select value::json from t where key = _key $$;
grant execute on function pg_temp.j(text) to anon, authenticated, service_role;

insert into t select 's1', id::text from public.practice_scenarios where title = 'Minta: Közúti ellenőrzés';

-- Practice decks (the captain practised on the two days before today) -------------------------
insert into public.practice_days (user_id, day, answered, correct)
select captain_id, (now() at time zone 'Europe/Budapest')::date - g, 15, 12 from ids, generate_series(1, 2) g;
select pg_temp.act_as((select captain_id from ids));
select throws_ok($$select public.save_practice_session('Rossz pakli!', '{}', 1, 1)$$, '22023', null, 'unknown deck names are refused');
insert into t select 'session', public.save_practice_session('radio', '{"10-4": {"b": 2, "d": "2026-10-08", "l": 0}}', 20, 18)::text;
select is((pg_temp.j('session') ->> 'streak')::int, 3, 'the streak counts the consecutive days');
select lives_ok($$select public.save_practice_session('radio', '{}', 500, 500), public.save_practice_session('radio', '{}', 500, 500)$$,
  'long sessions are accepted');
select ok((public.get_practice_overview() -> 'days' -> -1 ->> 'answered')::int <= 1000, 'the daily total is capped');
select is((public.get_practice_overview() -> 'decks' -> 'radio' ->> 'sessions')::int, 3, 'the deck keeps its sessions');
select ok((public.get_monthly_recap((date_trunc('month', now() at time zone 'Europe/Budapest'))::date) ->> 'practice_days')::int >= 1,
  'the recap counts the practice days');

-- Scenarios ----------------------------------------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
select throws_ok($$select public.save_scenario(null, '{"title": "Saját", "start_node": "a", "nodes": {"a": {"end": {}}}}')$$, '42501', null,
  'members cannot write scenarios');
select pg_temp.act_as((select admin_id from ids));
select throws_ok($$select public.save_scenario(null, '{"title": "Kör", "start_node": "a", "nodes": {
    "a": {"text": "x", "choices": [{"id": "1", "text": "tovább", "next": "b", "points": 1}]},
    "b": {"text": "y", "choices": [{"id": "1", "text": "vissza", "next": "a", "points": 1}]},
    "c": {"end": {"title": "Vége"}}}}')$$, '22023', null, 'scenarios with a loop are refused');
insert into t select 'draft', public.save_scenario(null, '{"title": "Rejtett gyakorlat", "start_node": "a", "nodes": {
    "a": {"text": "Mit teszel?", "choices": [{"id": "1", "text": "Jót", "next": "b", "points": 3}, {"id": "2", "text": "Rosszat", "next": "b", "points": 0}]},
    "b": {"text": "És most?", "choices": [{"id": "1", "text": "Befejezem", "points": 2}]}}}')::text;
select is((pg_temp.j('draft') ->> 'max_score')::int, 5, 'the best path is computed on the server');
select pg_temp.act_as((select deputy_id from ids));
select throws_ok(format('select public.get_scenario(%L)', pg_temp.j('draft') ->> 'id'), 'P0002', null,
  'unpublished scenarios are hidden from members');

-- An instructor tries the hidden scenario: the certificate comes when it is published.
select pg_temp.act_as((select admin_id from ids));
select ok((public.submit_scenario_run((pg_temp.j('draft') ->> 'id')::uuid, array['1', '1']) ->> 'certificate') is null,
  'passing a hidden scenario gives no certificate yet');
select pg_temp.reset_role();
update public.practice_scenarios set published = true where id = (pg_temp.j('draft') ->> 'id')::uuid;
select ok(exists (select 1 from public.certificates c where c.user_id = (select admin_id from ids) and c.kind = 'scenario'
                  and c.ref = pg_temp.j('draft') ->> 'id' and c.revoked_at is null),
  'publishing it issues the certificate to those who passed');
select is((select count(*)::int from public.notifications n where n.user_id = (select admin_id from ids)
           and n.dedupe_key = 'certificate:scenario:' || (pg_temp.j('draft') ->> 'id')), 1, 'and tells them');
update public.practice_scenarios set published = false where id = (pg_temp.j('draft') ->> 'id')::uuid;
update public.practice_scenarios set published = true where id = (pg_temp.j('draft') ->> 'id')::uuid;
select is((select count(*)::int from public.notifications n where n.user_id = (select admin_id from ids)
           and n.dedupe_key = 'certificate:scenario:' || (pg_temp.j('draft') ->> 'id')), 1, 'publishing it again sends nothing new');
select pg_temp.act_as((select deputy_id from ids));
select throws_ok(format('select public.submit_scenario_run(%L, array[%L])', (select value from t where key = 's1'), 'a'), '22023', null,
  'a run must reach an ending');
-- The best path of the sample (its answers are shuffled since 20261008041150).
insert into t select 'run', public.submit_scenario_run((select value::uuid from t where key = 's1'), array['b', 'b', 'c', 'b'])::text;
select is((pg_temp.j('run') ->> 'percent')::int, 100, 'the server scores the chosen path');
select ok(pg_temp.j('run') ->> 'certificate' like 'SFSD-____-____', 'passing a published scenario issues a certificate');
select is((public.submit_scenario_run((select value::uuid from t where key = 's1'), array['c']) -> 'best' ->> 'best_percent')::int, 100,
  'a weaker run keeps the best result');

-- Certificates -------------------------------------------------------------------------------
select ok(exists (select 1 from json_array_elements(public.get_my_certificates()) c where c ->> 'code' = pg_temp.j('run') ->> 'certificate'),
  'members list their certificates');
select pg_temp.act_anon();
select is((public.verify_certificate(lower(pg_temp.j('run') ->> 'certificate')) -> 'holder' ->> 'full_name'), 'Deputy Teszt',
  'anyone can check a code');
select ok(public.verify_certificate('SFSD-0000-0000') is null, 'an unknown code finds nothing');
select throws_ok($$select public.get_my_certificates()$$, '42501', null, 'guests have no certificates to list');
select pg_temp.reset_role();
update public.profiles set qualifications = array['GW', 'SEB'] where id = (select investigator_id from ids);
insert into t select 'seb', code from public.certificates c, ids where c.user_id = ids.investigator_id and c.kind = 'qualification' and c.ref = 'SEB';
select ok((select value from t where key = 'seb') is not null, 'a new qualification issues a certificate');
update public.profiles set qualifications = array['GW'] where id = (select investigator_id from ids);
select is((public.verify_certificate((select value from t where key = 'seb')) ->> 'valid')::boolean, false,
  'a qualification taken away revokes its certificate');
insert into public.exam_submissions (id, exam_id, user_id, applicant_name, start_time, end_time, status, max_score)
select '23000000-0000-4000-8000-000000000099', exam_id, deputy_id, 'Deputy Teszt', now() - interval '1 hour', now() - interval '30 minutes', 'pending', 10
from ids;
update public.exam_submissions set status = 'passed', total_score = 9, graded_at = now() where id = '23000000-0000-4000-8000-000000000099';
select is((select count(*)::int from public.certificates c, ids where c.user_id = ids.deputy_id and c.kind = 'exam' and c.ref = ids.exam_id::text
           and c.revoked_at is null), 1, 'a passed exam issues a certificate');
update public.exam_submissions set status = 'failed' where id = '23000000-0000-4000-8000-000000000099';
select is((select count(*)::int from public.certificates c, ids where c.user_id = ids.deputy_id and c.kind = 'exam' and c.revoked_at is not null), 1,
  'a regrade to failed revokes it');
update public.profiles set faction_rank = 'Deputy Sheriff III.' where id = (select deputy_id from ids);
select is((select count(*)::int from public.certificates c, ids where c.user_id = ids.deputy_id and c.kind = 'rank' and c.ref = 'Deputy Sheriff III.'), 1,
  'a promotion issues an appointment certificate');
update public.profiles set faction_rank = 'Deputy Sheriff II.' where id = (select deputy_id from ids);
select is((select count(*)::int from public.certificates c, ids where c.user_id = ids.deputy_id and c.kind = 'rank'), 0,
  'undoing the promotion right away removes it');

-- Leaderboard --------------------------------------------------------------------------------
select pg_temp.act_as((select captain_id from ids));
select is((public.set_leaderboard_visibility(false) ->> 'visible')::boolean, false, 'a member turns the leaderboard off');
insert into t select 'board', public.get_leaderboard(null)::text;
select ok(not exists (select 1 from json_array_elements(pg_temp.j('board') -> 'categories') c, json_array_elements(c -> 'entries') e
                      where (e ->> 'user_id')::uuid = (select captain_id from ids)), 'members who turned it off are not listed');
select ok((select c -> 'me' ->> 'value' from json_array_elements(pg_temp.j('board') -> 'categories') c where c ->> 'key' = 'duty') is not null,
  'they still see their own place');
select is((public.set_leaderboard_visibility(true) ->> 'visible')::boolean, true, 'a member turns it on again');
select ok(exists (select 1 from json_array_elements(public.get_leaderboard(null) -> 'categories') c, json_array_elements(c -> 'entries') e
                  where (e ->> 'user_id')::uuid = (select captain_id from ids) and (e ->> 'me')::boolean), 'then they are listed');

-- Recap and service record -------------------------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
insert into t select 'recap', public.get_monthly_recap((date_trunc('month', now() at time zone 'Europe/Budapest'))::date)::text;
select is((pg_temp.j('recap') ->> 'reports')::int,
  (select count(*)::int from public.report_logs r, ids where r.user_id = ids.deputy_id
     and r.month = (date_trunc('month', now() at time zone 'Europe/Budapest'))::date), 'the recap counts the month''s reports');
select ok(public.get_service_record((select deputy_id from ids)) -> 'member' ->> 'full_name' = 'Deputy Teszt', 'members print their own record');
select throws_ok(format('select public.get_service_record(%L)', (select supervisor_id from ids)), '42501', null,
  'members cannot print the records of others');
select pg_temp.act_as((select supervisor_id from ids));
insert into t select 'record', public.get_service_record((select deputy_id from ids))::text;
select is(json_array_length(pg_temp.j('record') -> 'records'), 1, 'the staff prints a member''s record with the active warning');
select ok(pg_temp.j('record') -> 'records' -> 0 -> 'details' is null and position('Harmadik alkalom' in pg_temp.j('record')::text) = 0,
  'internal notes stay out of the record');

-- Penal code announcement --------------------------------------------------------------------
select pg_temp.act_as((select admin_id from ids));
select throws_ok($$select public.announce_penal_code('v1-abcdef', 'Btk.', null)$$, '42501', null, 'only the daily job announces changes');
select pg_temp.reset_role();
set local role service_role;
select is(public.announce_penal_code('2026-10-01-aaaa', 'Változott a Btk.', null), false, 'the first version is only recorded');
select is(public.announce_penal_code('2026-10-01-aaaa', 'Változott a Btk.', null), false, 'the same version is not announced again');
select is(public.announce_penal_code('2026-10-06-bbbb', 'Változott a Btk.', '3 tétel változott.'), true, 'a new version is announced');
reset role;
select is((select count(*)::int from public.notifications n, ids where n.user_id = ids.deputy_id and n.dedupe_key = 'penal-code'), 1,
  'members get one notification');

-- Dashboard and payslips ---------------------------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
insert into t select 'dash', public.get_dashboard_summary()::text;
select is((pg_temp.j('dash') ->> 'open_polls')::int, 2, 'the dashboard counts the polls still to answer');
select ok(pg_temp.j('dash') ->> 'nominations_pending' is null and pg_temp.j('dash') ->> 'feedback_new' is null,
  'leadership counters stay empty for members');
select ok(pg_temp.j('dash') -> 'my_month' -> 'next_tier' ->> 'hours' is not null or (pg_temp.j('dash') -> 'my_month' ->> 'duty_minutes')::int >= 6000,
  'the next duty tier is offered');
select pg_temp.act_as((select admin_id from ids));
select lives_ok(format('select public.close_payroll(%L, null, null)', (date_trunc('month', now() at time zone 'Europe/Budapest') - interval '3 months')::date),
  'a month is closed');
select pg_temp.act_as((select deputy_id from ids));
select ok(json_array_length(public.get_my_payslips() -> 0 -> 'duty_tiers') > 0, 'the payslip carries the duty tiers of its month');

select * from finish();
rollback;
