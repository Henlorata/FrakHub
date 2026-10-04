-- HR registry tests: bank accounts, member details, duty time and former members (the fleet
-- has its own file). Run with: bunx supabase test db
begin;
select plan(23);

create temporary table ids as select
  '00000000-0000-4000-8000-000000000001'::uuid as admin_id,
  '00000000-0000-4000-8000-000000000002'::uuid as sergeant_id,
  '00000000-0000-4000-8000-000000000003'::uuid as deputy_id,
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

-- Start from empty registry tables (the seed fills them for local development).
select pg_temp.act_postgres();
delete from public.duty_time_entries;
delete from public.member_details;
delete from public.member_bank_accounts;
delete from public.former_members;
delete from public.notifications where user_id = (select deputy_id from ids);

-- --- Anonymous visitors -----------------------------------------------------
select pg_temp.act_anon();
select throws_ok($$select count(*) from public.member_details$$, '42501', null, 'anon cannot read member details');
select throws_ok($$select count(*) from public.fleet_vehicles$$, '42501', null, 'anon cannot read the fleet');
select throws_ok($$select public.fleet_renew_registration(gen_random_uuid(), current_date + 30)$$, '42501', null,
  'anon cannot renew registrations');

-- --- Bank accounts ----------------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
select lives_ok($$insert into public.member_bank_accounts (user_id, account_number)
                  values ((select deputy_id from ids), '11712345-67891234-00000003')$$,
  'members record their own bank account');
select throws_ok($$insert into public.member_bank_accounts (user_id, account_number)
                   values ((select sergeant_id from ids), '11712345-67891234-00000002')$$,
  '42501', null, 'members cannot set the bank account of others');
select pg_temp.act_as((select operator_id from ids));
select is((select count(*) from public.member_bank_accounts), 0::bigint, 'members do not see the bank accounts of others');
select pg_temp.act_as((select sergeant_id from ids));
select is((select account_number from public.member_bank_accounts where user_id = (select deputy_id from ids)),
  '11712345-67891234-00000003', 'staff see bank accounts');

-- --- Member details ---------------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
select throws_ok($$insert into public.member_details (user_id, station) values ((select deputy_id from ids), 'Downtown')$$,
  '42501', null, 'members cannot edit their own HR details');
select pg_temp.act_as((select sergeant_id from ids));
select lives_ok($$insert into public.member_details (user_id, station, parking_spot, activity_status)
                  values ((select deputy_id from ids), 'Downtown', '1/3', 'less_active')$$,
  'staff edit the details of lower ranks');
select throws_ok($$insert into public.member_details (user_id, station) values ((select admin_id from ids), 'Downtown')$$,
  '42501', null, 'staff cannot edit the details of higher ranks');
select is((select updated_by from public.member_details where user_id = (select deputy_id from ids)),
  (select sergeant_id from ids), 'details record who changed them');
select pg_temp.act_as((select operator_id from ids));
select is((select station from public.member_details where user_id = (select deputy_id from ids)), 'Downtown',
  'members read the details of others');

-- --- Duty time --------------------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
select throws_ok($$insert into public.duty_time_entries (user_id, month, minutes)
                   values ((select deputy_id from ids), date_trunc('month', current_date)::date, 6000)$$,
  '42501', null, 'members cannot record duty time');
select pg_temp.act_as((select sergeant_id from ids));
select lives_ok($$insert into public.duty_time_entries (user_id, month, minutes)
                  values ((select deputy_id from ids), date_trunc('month', current_date)::date, 5748)
                  on conflict (user_id, month) do update set minutes = excluded.minutes$$,
  'staff record duty time');
select lives_ok($$insert into public.duty_time_entries (user_id, month, minutes)
                  values ((select deputy_id from ids), date_trunc('month', current_date)::date, 6000)
                  on conflict (user_id, month) do update set minutes = excluded.minutes$$,
  'staff correct duty time with an upsert');
select throws_ok($$insert into public.duty_time_entries (user_id, month, minutes)
                   values ((select deputy_id from ids), '2026-01-15', 10)$$,
  '23514', null, 'duty time is stored per calendar month');
select pg_temp.act_as((select deputy_id from ids));
select is((select minutes from public.duty_time_entries where user_id = (select deputy_id from ids)), 6000,
  'members read duty time');

-- --- Former members ---------------------------------------------------------
select pg_temp.act_as((select sergeant_id from ids));
select lives_ok($$insert into public.former_members (full_name, badge_number, faction_rank, left_on, leave_type,
                                                       reason, rehire, recorded_by)
                  values ('Régi Rudolf', '0999', 'Corporal', current_date - 30, 'resigned', 'Költözés', 'eligible',
                          (select sergeant_id from ids))$$,
  'staff record former members');
select pg_temp.act_as((select deputy_id from ids));
select is((select count(*) from public.former_members), 0::bigint, 'members cannot see former members');
select throws_ok($$insert into public.former_members (full_name, recorded_by) values ('Hamis Henrik', (select deputy_id from ids))$$,
  '42501', null, 'members cannot record former members');

-- --- One-request registry (RLS scoped) ------------------------------------------
select pg_temp.act_as((select operator_id from ids));
select is(json_array_length(public.get_hr_registry() -> 'bank_accounts'), 0,
  'the registry hides the bank accounts of others from members');
select pg_temp.act_as((select sergeant_id from ids));
select ok(json_array_length(public.get_hr_registry() -> 'bank_accounts') >= 1, 'staff get bank accounts in the registry');
select pg_temp.act_anon();
select throws_ok($$select public.get_hr_registry()$$, '42501', null, 'anon cannot read the registry');

select * from finish();
rollback;
