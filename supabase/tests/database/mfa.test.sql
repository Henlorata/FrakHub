-- Two-factor sign-in: a member with an authenticator app reaches the data (API, live changes,
-- files) only after the second step; members without one and guests are not affected.
-- Run with: bunx supabase test db
begin;
select plan(17);

create temporary table ids as select
  '00000000-0000-4000-8000-000000000003'::uuid as deputy_id,     -- gets an authenticator here
  '00000000-0000-4000-8000-000000000002'::uuid as supervisor_id; -- has none
grant select on ids to anon, authenticated, service_role;

create function pg_temp.act_as(_id uuid, _aal text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', _id, 'role', 'authenticated', 'aal', _aal)::text, true);
end $$;
create function pg_temp.act_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
end $$;
create function pg_temp.act_db() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
values (gen_random_uuid(), (select deputy_id from ids), 'teszt', 'totp', 'verified', now(), now(), 'JBSWY3DPEHPK3PXP');
insert into public.notifications (user_id, title, message) values ((select deputy_id from ids), 'Teszt', 'Teszt értesítés');

-- Without an authenticator nothing changes ---------------------------------------------------
select pg_temp.act_as((select supervisor_id from ids), 'aal1');
select ok(private.mfa_satisfied(), 'a member without an authenticator passes with the password');
select lives_ok('select private.check_request()', 'the API lets them in');
select is((select count(*)::int from public.profiles where id = (select supervisor_id from ids)), 1, 'they read their profile');

-- With one, the password alone opens nothing --------------------------------------------------
select pg_temp.act_as((select deputy_id from ids), 'aal1');
select ok(not private.mfa_satisfied(), 'a member with an authenticator needs the second step');
select throws_ok('select private.check_request()', 'PGRST', null, 'the API refuses the request');
select is((select count(*)::int from public.profiles where id = (select deputy_id from ids)), 0,
  'live changes (RLS) hide even their own profile');
select is((select count(*)::int from public.notifications where user_id = (select deputy_id from ids)), 0, 'and their notifications');
select is((select count(*)::int from public.system_status), 0, 'and the alert level');
select throws_ok(format($$insert into storage.objects (bucket_id, name) values ('finance_proofs', '%s_proof.webp')$$, (select deputy_id from ids)),
  '42501', null, 'no file goes up');

-- After the second step everything works as before -------------------------------------------
select pg_temp.act_as((select deputy_id from ids), 'aal2');
select ok(private.mfa_satisfied(), 'the second step opens it');
select lives_ok('select private.check_request()', 'the API lets the session in');
select is((select count(*)::int from public.profiles where id = (select deputy_id from ids)), 1, 'the profile is readable again');
select is((select count(*)::int from public.notifications where user_id = (select deputy_id from ids) and title = 'Teszt'), 1, 'so are the notifications');
select lives_ok(format($$insert into storage.objects (bucket_id, name) values ('finance_proofs', '%s_proof.webp')$$, (select deputy_id from ids)),
  'and uploads');

-- Guests and direct database work ----------------------------------------------------------
select pg_temp.act_anon();
select lives_ok('select private.check_request()', 'guests (public exams, certificate check) pass');
select pg_temp.act_db();
select lives_ok('select private.check_request()', 'without request claims there is nothing to check');

select ok(exists(select 1 from pg_db_role_setting s join pg_roles r on r.oid = s.setrole
                 where r.rolname = 'authenticator' and 'pgrst.db_pre_request=private.check_request' = any(s.setconfig)),
  'PostgREST runs the check before every request');

select * from finish();
rollback;
