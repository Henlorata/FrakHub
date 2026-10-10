-- The AI report helper's daily allowance (take_ai_assist, 20261010122425). Run with: bunx supabase test db
begin;
select plan(8);
-- Requests made with the local dev server would change the counts (rolled back at the end).
delete from private.ai_assist_usage;

create temporary table ids as select
  '00000000-0000-4000-8000-000000000003'::uuid as deputy_id,
  '00000000-0000-4000-8000-000000000006'::uuid as investigator_id;
grant select on ids to anon, authenticated, service_role;

set local role anon;
select throws_ok(
  $$select public.take_ai_assist('00000000-0000-4000-8000-000000000003', 5, 100)$$, '42501', null,
  'visitors cannot call it');
reset role;

set local role authenticated;
select throws_ok(
  $$select public.take_ai_assist('00000000-0000-4000-8000-000000000003', 5, 100)$$, '42501', null,
  'members cannot take requests for themselves');
reset role;

set local role service_role;
select is((public.take_ai_assist((select deputy_id from ids), 2, 3) ->> 'remaining')::int, 1, 'the first request leaves one');
select is((public.take_ai_assist((select deputy_id from ids), 2, 3) ->> 'remaining')::int, 0, 'the second leaves none');
select is(public.take_ai_assist((select deputy_id from ids), 2, 3)::jsonb, '{"ok": false, "reason": "member", "remaining": 0}'::jsonb,
  'a member over their allowance is refused');
select is((public.take_ai_assist((select investigator_id from ids), 2, 3) ->> 'ok')::boolean, true, 'another member still may');
select is(public.take_ai_assist((select investigator_id from ids), 2, 3)::jsonb, '{"ok": false, "reason": "everyone", "remaining": 1}'::jsonb,
  'the shared allowance stops everyone');
reset role;

update private.ai_assist_usage set created_at = now() - interval '3 days';
select public.run_housekeeping();
select is((select count(*)::int from private.ai_assist_usage), 0, 'the housekeeping removes the old counters');

select * from finish();
rollback;
