-- Training progress: members store only their own rows. Run with: bunx supabase test db
begin;
select plan(10);

create temporary table ids as select
  '00000000-0000-4000-8000-000000000001'::uuid as admin_id,
  '00000000-0000-4000-8000-000000000003'::uuid as deputy_id,
  '00000000-0000-4000-8000-000000000004'::uuid as pending_id;
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

select pg_temp.act_anon();
select throws_ok($$select count(*) from public.training_progress$$, '42501', null, 'anon cannot read training progress');

select pg_temp.act_as((select deputy_id from ids));
select lives_ok($$insert into public.training_progress (user_id, training_id, status, version)
                  values ((select deputy_id from ids), 'basic', 'skipped', 1)$$,
  'members record their own training');
select lives_ok($$insert into public.training_progress (user_id, training_id, status, version)
                  values ((select deputy_id from ids), 'basic', 'completed', 2)
                  on conflict (user_id, training_id) do update
                  set status = excluded.status, version = excluded.version, updated_at = now()$$,
  'a replay updates the row (upsert)');
select is((select status || ':' || version from public.training_progress where training_id = 'basic'), 'completed:2',
  'the replay is stored');
select throws_ok($$insert into public.training_progress (user_id, training_id, status)
                   values ((select admin_id from ids), 'basic', 'completed')$$,
  '42501', null, 'members cannot record trainings of others');
select throws_ok($$insert into public.training_progress (user_id, training_id, status)
                   values ((select deputy_id from ids), 'basic', 'started')$$,
  '23514', null, 'only completed and skipped are valid states');
select throws_ok($$delete from public.training_progress where user_id = (select deputy_id from ids)$$,
  '42501', null, 'progress cannot be deleted by members');

select pg_temp.act_as((select admin_id from ids));
select is((select count(*) from public.training_progress), 0::bigint, 'members only see their own progress');
update public.training_progress set status = 'skipped' where user_id = (select deputy_id from ids);
select pg_temp.act_as((select deputy_id from ids));
select is((select status from public.training_progress where training_id = 'basic'), 'completed',
  'others cannot change a member''s progress');

select pg_temp.act_as((select pending_id from ids));
select throws_ok($$insert into public.training_progress (user_id, training_id, status)
                   values ((select pending_id from ids), 'basic', 'completed')$$,
  '42501', null, 'pending registrations have no trainings');

select * from finish();
rollback;
