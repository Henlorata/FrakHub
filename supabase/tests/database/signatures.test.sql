-- Signatures: every member keeps one (vector outline), readable by members for the documents;
-- certificates carry the department head's signature.
-- Run with: bunx supabase test db
begin;
select plan(10);

create temporary table ids as select
  '00000000-0000-4000-8000-000000000001'::uuid as admin_id,   -- Commander, Bureau Manager
  '00000000-0000-4000-8000-000000000003'::uuid as deputy_id;
grant select on ids to anon, authenticated, service_role;

create function pg_temp.act_as(_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', _id, 'role', 'authenticated')::text, true);
end $$;

select pg_temp.act_as((select admin_id from ids));
select lives_ok($$select public.save_signature('M10 10Q20 5 30 10Q40 20 50 10Z', 120, 100, 'auto', 'great-vibes')$$, 'a member saves a signature');
select lives_ok($$select public.save_signature('M10 10L40 30L60 10Z', 90, 100, 'draw')$$, 'and replaces it');
select is((select method from public.member_signatures where user_id = (select admin_id from ids)), 'draw', 'one signature per member');
select throws_ok($$select public.save_signature('<script>alert(1)</script>', 90, 100, 'draw')$$, '23514', null, 'only path data is accepted');
select throws_ok($$select public.save_signature('M10 10L40 30Z', 90, 100, 'scan')$$, '23514', null, 'and only the four methods');

select pg_temp.act_as((select deputy_id from ids));
select is((select count(*)::int from public.member_signatures where user_id = (select admin_id from ids)), 1, 'other members read it (documents)');
select throws_ok($$insert into public.member_signatures (user_id, path, width, height, method) values ('00000000-0000-4000-8000-000000000001', 'M1 1Z', 1, 1, 'draw')$$,
  '42501', null, 'nobody writes another member''s signature');

set local role postgres;
update public.profiles set full_name = 'Admin' where id = (select admin_id from ids);
select isnt(private.department_head(), (select admin_id from ids), 'a technical account named "Admin" never signs the certificates');
create temporary table cert as select code from public.certificates order by issued_at limit 1;
grant select on cert to anon;
set local role anon;
select throws_ok('select count(*) from public.member_signatures', '42501', null, 'visitors read no signatures directly');
select ok((public.verify_certificate((select code from cert)) -> 'signer' ->> 'full_name') is not null,
  'a certificate shows its signer (the department head)');

select * from finish();
rollback;
