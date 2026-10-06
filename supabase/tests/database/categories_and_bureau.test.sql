-- Fleet categories managed on the site, and the rank rule for bureau commanders.
-- Run with: bunx supabase test db
begin;
select plan(15);

create temporary table ids as select
  '00000000-0000-4000-8000-000000000001'::uuid as admin_id,        -- Commander, bureau manager
  '00000000-0000-4000-8000-000000000002'::uuid as supervisor_id,   -- Sergeant I.
  '00000000-0000-4000-8000-000000000003'::uuid as deputy_id,       -- Deputy Sheriff II.
  '00000000-0000-4000-8000-000000000005'::uuid as captain_id,      -- Captain II.
  '00000000-0000-4000-8000-000000000006'::uuid as investigator_id; -- Corporal, MCB
grant select on ids to anon, authenticated, service_role;

create function pg_temp.act_as(_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', _id, 'role', 'authenticated')::text, true);
end $$;
create function pg_temp.act_db() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Two categories with vehicles (written as the database owner).
insert into public.fleet_categories (id, name, tone, sort_order) values ('test-a', 'Teszt A', 'teal', 900), ('test-b', 'Teszt B', 'rose', 910);
insert into public.fleet_vehicles (plate, model, category_id) values ('TST-001', 'Teszt kocsi', 'test-a'), ('TST-002', 'Teszt kocsi', 'test-a'),
  ('TST-003', 'Teszt kocsi', 'test-b');

-- Categories ---------------------------------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
select throws_ok($$select public.fleet_delete_category('test-a', 'other')$$, '42501', null, 'members cannot delete categories');

select pg_temp.act_as((select supervisor_id from ids));
select lives_ok($$insert into public.fleet_categories (id, name, tone, sort_order) values ('test-c', 'Új kategória', 'sky', 920)$$,
  'staff add categories');
select lives_ok($$update public.fleet_categories set name = 'Átnevezett' where id = 'test-c'$$, 'staff rename categories');
select is((select name from public.fleet_categories where id = 'test-c'), 'Átnevezett', 'the new name is stored');
select throws_ok($$delete from public.fleet_categories where id = 'test-c'$$, '42501', null,
  'categories are deleted through fleet_delete_category() only');
select throws_ok($$select public.fleet_delete_category('test-a', 'test-a')$$, '22023', null, 'vehicles cannot move into the deleted category');
select throws_ok($$select public.fleet_delete_category('test-a', 'nincs-ilyen')$$, 'P0002', null, 'the target category must exist');
select is(public.fleet_delete_category('test-a', 'test-b') ->> 'moved', '2', 'the vehicles move to the chosen category');
select is((select count(*) from public.fleet_vehicles where plate in ('TST-001', 'TST-002') and category_id = 'test-b'), 2::bigint,
  'the moved vehicles are in their new category');
select is(public.fleet_delete_category('test-b') ->> 'deleted', '3', 'without a target the vehicles are deleted with the category');
select is((select count(*) from public.fleet_vehicles where plate like 'TST-%'), 0::bigint, 'the deleted vehicles are gone');
select is((select count(*) from public.fleet_categories where id in ('test-a', 'test-b')), 0::bigint, 'the categories are gone');

-- Bureau commanders ------------------------------------------------------------------------
-- Their rank rules live in /api/admin/update-role (shared/ranks.ts); the legacy RPC that also had them is gone.
select hasnt_function('public', 'hr_update_user_profile_v2', 'the legacy HR RPC is gone (HR changes go through the API)');

-- Duty time notifications ----------------------------------------------------------------
select pg_temp.act_as((select supervisor_id from ids));
insert into public.duty_time_entries (user_id, month, minutes) values ((select deputy_id from ids), '2030-01-01', 600)
  on conflict (user_id, month) do update set minutes = excluded.minutes;
update public.duty_time_entries set minutes = 720 where user_id = (select deputy_id from ids) and month = '2030-01-01';
select pg_temp.act_as((select deputy_id from ids));
select is((select count(*) from public.notifications where dedupe_key = 'duty:2030-01' and not is_read), 1::bigint,
  'one notification per member and month');
select ok((select message from public.notifications where dedupe_key = 'duty:2030-01') like '%12 óra 00 perc.',
  'the notification shows the latest value');

select * from finish();
rollback;
