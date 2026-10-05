-- Row Level Security and RPC permission tests. Run with: bunx supabase test db
-- Uses the accounts from supabase/seed.sql.
begin;
select plan(34);

-- Seed accounts.
create temporary table ids as select
  '00000000-0000-4000-8000-000000000001'::uuid as admin_id,
  '00000000-0000-4000-8000-000000000002'::uuid as sergeant_id,
  '00000000-0000-4000-8000-000000000003'::uuid as deputy_id,
  '00000000-0000-4000-8000-000000000004'::uuid as pending_id,
  '00000000-0000-4000-8000-000000000006'::uuid as investigator_id,
  '00000000-0000-4000-8000-000000000007'::uuid as operator_id;
grant select on ids to anon, authenticated, service_role;

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
create function pg_temp.act_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- --- Anonymous visitors -----------------------------------------------------
select pg_temp.act_anon();
select is((select count(*) from public.profiles), 0::bigint, 'anon cannot read profiles');
select is((select count(*) from public.action_logs), 0::bigint, 'anon cannot read action logs');
select throws_ok($$insert into public.academy_courses (id) values ('HACK')$$, '42501', null, 'anon cannot write academy courses');
select throws_ok($$select public.delete_full_exam('20000000-0000-4000-8000-000000000001')$$, '42501', null,
  'anon cannot call delete_full_exam');
select throws_ok($$select public.admin_assign_exam('23000000-0000-4000-8000-000000000001', (select deputy_id from ids))$$,
  '42501', null, 'anon cannot call admin_assign_exam');
select is((select count(*) from public.system_status), 1::bigint, 'anon still reads the system status');
select isnt((public.start_exam('20000000-0000-4000-8000-000000000001', 'Vendég Valéria') ->> 'secret'),
  null, 'guests start a public exam and receive the secret of the attempt');
select throws_ok($$select public.start_exam('20000000-0000-4000-8000-000000000002', 'Valaki')$$,
  '42501', null, 'guests cannot start a members-only exam');

-- --- Pending registration ---------------------------------------------------
select pg_temp.act_as((select pending_id from ids));
select is((select count(*) from public.profiles), 1::bigint, 'pending accounts only see themselves');
select is((select count(*) from public.cases), 0::bigint, 'pending accounts see no cases');
select is((select count(*) from public.suspects), 0::bigint, 'pending accounts see no suspects');

-- --- Regular deputy ----------------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
select throws_ok($$update public.profiles set system_role = 'admin' where id = (select deputy_id from ids)$$,
  '42501', null, 'members cannot change their own role');
select throws_ok($$update public.profiles set faction_rank = 'Commander' where id = (select deputy_id from ids)$$,
  '42501', null, 'members cannot change their own rank');
select lives_ok($$update public.profiles set avatar_url = 'https://res.cloudinary.com/x/a.png' where id = (select deputy_id from ids)$$,
  'members can change their own avatar');
select throws_ok($$insert into public.notifications (user_id, title, message) values ((select admin_id from ids), 'x', 'y')$$,
  '42501', null, 'members cannot send notifications directly');
select is((select count(*) from public.cases), 0::bigint, 'field deputies see no MCB cases');
select throws_ok($$insert into public.exam_submissions (exam_id, user_id, status, total_score)
  values ('20000000-0000-4000-8000-000000000002', (select deputy_id from ids), 'passed', 100)$$,
  '42501', null, 'a submission cannot be inserted as passed');
select throws_ok($$select public.exam_submission_trash('23000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'deputies cannot trash exam sheets');
select throws_ok($$select public.get_exam_editor('20000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'deputies cannot open the exam editor (answer key)');
select throws_ok($$insert into public.hr_records (user_id, kind, title, created_by)
  values ((select operator_id from ids), 'warning', 'Hamis', (select deputy_id from ids))$$,
  '42501', null, 'deputies cannot issue warnings');
select is((select count(*) from public.hr_records where kind = 'warning'), 1::bigint, 'members see their own warning');
select ok((select count(*) from public.get_announcements(10)) >= 1, 'members read the announcement feed');

-- Muted categories are respected.
insert into public.notification_preferences (user_id, muted_categories) values ((select deputy_id from ids), array['announcement']);

-- --- Sergeant (supervisory staff) -------------------------------------------
select pg_temp.act_as((select sergeant_id from ids));
select throws_ok($$select public.hr_apply_member_update((select sergeant_id from ids), (select deputy_id from ids), '{"faction_rank": "Commander"}')$$,
  '42501', null, 'members cannot call the API-only HR function');
select lives_ok($$select public.exam_submission_trash('23000000-0000-4000-8000-000000000001')$$,
  'supervisors can trash exam sheets they may grade');
select lives_ok($$insert into public.hr_records (user_id, kind, title, created_by)
  values ((select deputy_id from ids), 'commendation', 'Kiváló járőrözés', (select sergeant_id from ids))$$,
  'supervisors can commend lower ranks');
select lives_ok($$insert into public.announcements (title, content, type, created_by)
  values ('Teszt', 'Teszt hirdetmény', 'info', (select sergeant_id from ids))$$, 'staff can post announcements');

-- --- The API applies a rank change (service role) on behalf of the sergeant --------
select pg_temp.act_postgres();
set local role service_role;
select lives_ok($$select public.hr_apply_member_update((select sergeant_id from ids), (select deputy_id from ids),
  '{"faction_rank": "Deputy Sheriff III.", "system_role": "user"}')$$, 'the API can apply a rank change');
reset role;

-- --- Investigator III. approves warrants ------------------------------------
select pg_temp.act_as((select investigator_id from ids));
select is((select count(*) from public.cases), 1::bigint, 'MCB investigators see the cases');
with updated as (
  update public.case_warrants set status = 'approved', approved_by = (select investigator_id from ids)
  where status = 'pending' returning 1)
select is((select count(*) from updated), 1::bigint, 'Investigator III. can approve warrants');

-- --- Results, checked as the database owner -----------------------------------
select pg_temp.act_postgres();
select is((select faction_rank from public.profiles where id = (select deputy_id from ids)), 'Deputy Sheriff III.',
  'the promotion was applied');
select is((select system_role from public.profiles where id = (select deputy_id from ids)), 'user',
  'system_role follows the rank');
select ok(exists (select 1 from public.notifications where user_id = (select deputy_id from ids) and title = 'Előléptetés'),
  'the promoted member is notified');
select ok(not exists (select 1 from public.notifications where user_id = (select deputy_id from ids) and title = 'Hirdetmény: Teszt'),
  'muted categories are not delivered');
select ok(exists (select 1 from public.member_events where user_id = (select deputy_id from ids) and kind = 'rank'
                  and actor_id = (select sergeant_id from ids)), 'the rank change is in the member history with its actor');

select * from finish();
rollback;
