-- Patrol tools: BOLO alerts, the shift briefing and the plate lookup.
-- Run with: bunx supabase test db
begin;
select plan(24);

create temporary table ids as select
  '00000000-0000-4000-8000-000000000001'::uuid as admin_id,        -- Commander, bureau manager
  '00000000-0000-4000-8000-000000000002'::uuid as supervisor_id,   -- Sergeant I. (staff)
  '00000000-0000-4000-8000-000000000003'::uuid as deputy_id,       -- Deputy Sheriff II., TSB
  '00000000-0000-4000-8000-000000000004'::uuid as pending_id,      -- pending registration
  '00000000-0000-4000-8000-000000000006'::uuid as investigator_id, -- Corporal, MCB
  '00000000-0000-4000-8000-000000000007'::uuid as operator_id,     -- Senior Deputy Sheriff, SEB
  '31000000-0000-4000-8000-000000000001'::uuid as suspect_id;      -- Tony Montana
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

-- A suspect vehicle for the lookup, and an approved arrest warrant for the "wanted" list.
insert into public.suspect_vehicles (suspect_id, plate_number, vehicle_type, color)
values ((select suspect_id from ids), 'XYZ-777', 'Sultan', 'fekete');
update public.case_warrants set status = 'approved', decided_at = now(), approved_by = (select admin_id from ids)
where suspect_id = (select suspect_id from ids) and type = 'arrest';

-- Adding --------------------------------------------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
select lives_ok($$insert into public.bolo_alerts (kind, reason, danger, title, plate, vehicle_model, last_seen_location)
                  values ('vehicle', 'stolen', 'high', 'Lopott fekete Sultan', 'ABC 123', 'Sultan', 'Doherty')$$,
  'a member adds an alert');
select is((select created_by from public.bolo_alerts where title = 'Lopott fekete Sultan'), (select deputy_id from ids), 'the author is the member');
select is((select plate_key from public.bolo_alerts where title = 'Lopott fekete Sultan'), 'A8C123', 'the plate is indexed without spaces, look-alikes folded');
select throws_ok($$insert into public.bolo_alerts (kind, title, plate, created_by)
                   values ('vehicle', 'Más nevében', 'AAA111', '00000000-0000-4000-8000-000000000002')$$,
  '42501', null, 'nobody adds an alert in someone else''s name');
select throws_ok($$insert into public.bolo_alerts (kind, title, plate, status) values ('vehicle', 'Rögtön lezárt', 'AAA111', 'resolved')$$,
  '42501', null, 'the status is not set on insert');

select pg_temp.act_db();
select is((select count(*) from public.notifications n join public.bolo_alerts b on n.dedupe_key = 'bolo:' || b.id
           where b.title = 'Lopott fekete Sultan' and n.category = 'patrol'),
          (select count(*) from public.profiles where system_role <> 'pending' and id <> (select deputy_id from ids)),
  'a high-danger alert notifies every other member');

select pg_temp.act_as((select pending_id from ids));
select is((select count(*) from public.bolo_alerts), 0::bigint, 'a pending registration sees no alerts');

-- Reading -------------------------------------------------------------------------------------
select pg_temp.act_as((select operator_id from ids));
select ok(exists (select 1 from json_array_elements(public.get_bolos() -> 'active') b where b ->> 'title' = 'Lopott fekete Sultan'),
  'members see the active alerts');
select ok(exists (select 1 from json_array_elements(public.get_briefing() -> 'bolos') b where b ->> 'title' = 'Lopott fekete Sultan'),
  'the briefing lists them');
select ok(json_array_length(public.get_briefing() -> 'wanted') >= 1, 'the briefing lists the approved arrest warrants');
select ok((public.get_briefing() -> 'wanted' -> 0 -> 'case') :: text = 'null', 'without the case for members outside the case area');
select ok(not (public.get_briefing() -> 'wanted' -> 0)::jsonb ? 'reason', 'and never the warrant''s reasoning');
select is(json_array_length(public.lookup_plate('abc-123') -> 'bolos'), 1, 'the plate lookup finds the alert (any spelling)');
select is(json_array_length(public.lookup_plate('XYZ777') -> 'persons'), 0, 'registered persons'' vehicles stay in the case area');
select pg_temp.act_as((select investigator_id from ids));
select is(json_array_length(public.lookup_plate('XYZ777') -> 'persons'), 1, 'the case area finds them');

-- Status changes ------------------------------------------------------------------------------
select pg_temp.act_as((select operator_id from ids));
select throws_ok($$select public.set_bolo_status((select id from public.bolo_alerts where title = 'Lopott fekete Sultan'), 'cancelled')$$,
  '42501', null, 'another member cannot withdraw it');
select throws_ok($$select public.extend_bolo((select id from public.bolo_alerts where title = 'Lopott fekete Sultan'), 24)$$,
  '42501', null, 'nor extend it');
select throws_ok($$select public.set_bolo_status((select id from public.bolo_alerts where title = 'Lopott fekete Sultan'), 'resolved')$$,
  'P0001', 'Írd le röviden, hol és hogyan került elő.', 'a find needs a note');
select is(public.set_bolo_status((select id from public.bolo_alerts where title = 'Lopott fekete Sultan'), 'resolved', 'A Doherty garázsban állt.') ->> 'status',
  'resolved', 'any member marks it found');
select pg_temp.act_db();
select is((select count(*) from public.notifications where user_id = (select deputy_id from ids) and title like 'BOLO megoldva:%'), 1::bigint,
  'the author is told who found it');

select pg_temp.act_as((select deputy_id from ids));
select is(public.set_bolo_status((select id from public.bolo_alerts where title = 'Lopott fekete Sultan'), 'active', null, 48) ->> 'status',
  'active', 'the author reopens it');
select lives_ok($$select public.extend_bolo((select id from public.bolo_alerts where title = 'Lopott fekete Sultan'), 24)$$,
  'and extends it');

-- Deleting ------------------------------------------------------------------------------------
select pg_temp.act_as((select operator_id from ids));
delete from public.bolo_alerts where title = 'Lopott fekete Sultan';
select pg_temp.act_db();
select is((select count(*) from public.bolo_alerts where title = 'Lopott fekete Sultan'), 1::bigint, 'another member cannot delete it');
select pg_temp.act_as((select deputy_id from ids));
delete from public.bolo_alerts where title = 'Lopott fekete Sultan';
select pg_temp.act_db();
select is((select count(*) from public.bolo_alerts where title = 'Lopott fekete Sultan'), 0::bigint, 'the author deletes a fresh mistake');

select * from finish();
rollback;
