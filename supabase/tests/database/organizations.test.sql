-- Crime organisations of the MCB (crime_organizations, organization_members, organization_notes).
-- Run with: bunx supabase test db
begin;
select plan(16);

create temporary table ids as select
  '00000000-0000-4000-8000-000000000001'::uuid as admin_id,        -- Commander, bureau manager (MCB lead)
  '00000000-0000-4000-8000-000000000002'::uuid as supervisor_id,   -- Sergeant I., MCB
  '00000000-0000-4000-8000-000000000003'::uuid as deputy_id,       -- Deputy Sheriff II., TSB (outside the case area)
  '00000000-0000-4000-8000-000000000006'::uuid as investigator_id, -- Corporal, MCB
  '31000000-0000-4000-8000-000000000001'::uuid as suspect_id;      -- Tony Montana (in a seeded case)
grant select on ids to anon, authenticated, service_role;

create function pg_temp.act_as(_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', _id, 'role', 'authenticated')::text, true);
end $$;

select pg_temp.act_as((select investigator_id from ids));
select lives_ok($$insert into public.crime_organizations (name, kind, threat, color, territory) values ('Kikötői Banda', 'gang', 'high', '#22c55e', 'Kikötő, Easter Basin')$$,
  'the case area adds an organisation');
select throws_ok($$insert into public.crime_organizations (name) values ('  kikötői banda ')$$, '23505', null, 'names are unique (case and spaces ignored)');
select lives_ok($$insert into public.organization_members (organization_id, suspect_id, role)
                  values ((select id from public.crime_organizations where name = 'Kikötői Banda'), (select suspect_id from ids), 'leader')$$,
  'a registered person is added with a role');
select lives_ok($$insert into public.organization_notes (organization_id, body, source)
                  values ((select id from public.crime_organizations where name = 'Kikötői Banda'), 'Új fegyverszállítmány érkezik pénteken.', 'Informátor (Holló)')$$,
  'an intelligence note is logged');

select is(json_array_length(public.get_organizations()), 1, 'the list has it');
select is((public.get_organizations() -> 0 ->> 'members')::int, 1, 'with its member count');
select is(public.get_organizations() -> 0 -> 'leaders' ->> 0, 'Tony Montana', 'and its leaders');
select is(json_array_length(public.get_organization((select id from public.crime_organizations where name = 'Kikötői Banda')) -> 'cases'), 1,
  'the members'' cases are derived');
select is(json_array_length(public.get_person_organizations((select suspect_id from ids))), 1, 'the person''s file lists the organisation');

-- Outside the case area ---------------------------------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
select is((select count(*) from public.crime_organizations), 0::bigint, 'members outside the case area see nothing');
select ok(public.get_organizations() is null, 'nor through the list');
select throws_ok($$select public.get_organization((select id from public.crime_organizations limit 1))$$, '42501', null, 'nor one organisation');
select throws_ok($$insert into public.crime_organizations (name) values ('Saját banda')$$, '42501', null, 'and cannot add one');

-- Deleting ------------------------------------------------------------------------------------
select pg_temp.act_as((select supervisor_id from ids));
delete from public.organization_notes where body like 'Új fegyverszállítmány%';
select pg_temp.act_as((select investigator_id from ids));
select is((select count(*) from public.organization_notes), 1::bigint, 'only the author or the MCB leadership removes a note');
delete from public.crime_organizations where name = 'Kikötői Banda';
select is((select count(*) from public.crime_organizations), 1::bigint, 'an organisation is deleted by the MCB leadership only');
select pg_temp.act_as((select admin_id from ids));
delete from public.crime_organizations where name = 'Kikötői Banda';
select is((select count(*) from public.organization_members), 0::bigint, 'the leadership deletes it, its member list goes with it');

select * from finish();
rollback;
