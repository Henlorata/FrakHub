-- The MCB's trash, operation plans for events, performance reviews and the mail upgrades (search,
-- read receipts, templates).
-- Run with: bunx supabase test db
begin;
select plan(55);

create temporary table ids as select
  '00000000-0000-4000-8000-000000000001'::uuid as admin_id,        -- Commander, Bureau Manager
  '00000000-0000-4000-8000-000000000002'::uuid as supervisor_id,   -- Sergeant I., MCB
  '00000000-0000-4000-8000-000000000003'::uuid as deputy_id,       -- Deputy Sheriff II., TSB
  '00000000-0000-4000-8000-000000000005'::uuid as captain_id,      -- Captain II.
  '00000000-0000-4000-8000-000000000006'::uuid as investigator_id, -- Corporal, MCB (owns the seed case)
  '00000000-0000-4000-8000-000000000007'::uuid as operator_id,     -- Senior Deputy Sheriff, SEB
  '30000000-0000-4000-8000-000000000001'::uuid as case_id;
grant select on ids to anon, authenticated, service_role;
create temporary table state (key text primary key, value text);
grant all on state to anon, authenticated, service_role;
insert into state values ('quarter', private.quarter_key());

create function pg_temp.act_as(_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', _id, 'role', 'authenticated', 'aal', 'aal1')::text, true);
end $$;

-- ---------------------------------------------------------------------------------------------
-- The trash
-- ---------------------------------------------------------------------------------------------
insert into public.case_warrants (case_id, type, status, requested_by, target_name, reason)
values ((select case_id from ids), 'arrest', 'pending', (select investigator_id from ids), 'Lomtár Lajos', 'Teszt');
insert into state select 'warrant', w.id::text from public.case_warrants w where w.target_name = 'Lomtár Lajos';

select pg_temp.act_as((select supervisor_id from ids));
select throws_ok(format('select public.trash_case(%L)', (select case_id from ids)), '42501', null,
  'a member of the MCB who does not own the case cannot trash it');
select pg_temp.act_as((select investigator_id from ids));
select lives_ok(format('select public.trash_case(%L)', (select case_id from ids)), 'the owner puts the case into the trash');
select ok((public.get_dashboard_summary() ->> 'my_open_cases')::int = 0, 'it no longer counts as their open case');
select is(json_array_length(public.get_case_trash()), 1, 'and it is in their trash');

select pg_temp.act_as((select admin_id from ids));
select ok(not exists (select 1 from json_array_elements(public.get_case_list(true)) c where c ->> 'id' = (select case_id::text from ids)),
  'the trashed case leaves the case list, even for the leadership');
select throws_ok(format('select public.get_case_detail(%L)', (select case_id from ids)), 'P0002', null, 'and cannot be opened');
select is(json_array_length(public.search_cases('SD-006')), 0, 'nor found');
select is((select count(*)::int from public.case_warrants w where w.case_id = (select case_id from ids)), 0,
  'its warrants are hidden from the approvers');
select throws_ok(format('select public.decide_warrant(%L, %L)', (select value from state where key = 'warrant'), 'approved'), '22023', null,
  'and cannot be decided');
select is(json_array_length(public.get_case_trash()), 1, 'the Bureau Manager sees every trashed case');

select pg_temp.act_as((select deputy_id from ids));
select is(json_array_length(public.get_case_trash()), 0, 'others see nothing in the trash');
select throws_ok(format('select public.restore_case(%L)', (select case_id from ids)), '42501', null, 'and cannot restore');

select pg_temp.act_as((select admin_id from ids));
select lives_ok(format('select public.restore_case(%L)', (select case_id from ids)), 'the MCB leadership restores it');
select ok((public.get_case_detail((select case_id from ids)) -> 'case' ->> 'id') is not null, 'it opens again');
select ok(exists (select 1 from public.case_events e where e.case_id = (select case_id from ids) and e.kind = 'restored'), 'the log keeps it');

select lives_ok(format('select public.trash_case(%L)', (select case_id from ids)), 'trashed again by the leadership');
set local role postgres;
select ok(exists (select 1 from public.notifications n where n.user_id = (select investigator_id from ids)
                  and n.dedupe_key = 'case-trash:' || (select case_id from ids)), 'the owner is told');
update public.cases set deleted_at = now() - interval '31 days' where id = (select case_id from ids);
set local role service_role;
select ok((select case_id from ids) in (select public.expired_trashed_cases(25)), 'after 30 days the daily job deletes it for good');
set local role postgres;
update public.cases set deleted_at = null, deleted_by = null where id = (select case_id from ids);

-- ---------------------------------------------------------------------------------------------
-- Operation plans
-- ---------------------------------------------------------------------------------------------
insert into public.events (id, title, kind, starts_at, ends_at, audience, created_by) values
  ('41000000-0000-4000-8000-000000000001', 'Razzia a dokkoknál', 'patrol', now() - interval '2 hours', now() - interval '1 hour', 'all',
   (select admin_id from ids)),
  ('41000000-0000-4000-8000-000000000002', 'Holnapi akció', 'patrol', now() + interval '1 day', null, 'all', (select admin_id from ids)),
  ('41000000-0000-4000-8000-000000000003', 'Vezetői megbeszélés', 'meeting', now() + interval '1 day', null, 'staff', (select admin_id from ids));
insert into state values ('vehicle', (select id::text from public.fleet_vehicles order by plate limit 1));

select pg_temp.act_as((select deputy_id from ids));
select throws_ok($$select public.save_event_operation('41000000-0000-4000-8000-000000000001', '{}'::jsonb)$$, '42501', null,
  'only the organisers write the plan');

select pg_temp.act_as((select admin_id from ids));
select is(json_array_length(public.save_event_operation('41000000-0000-4000-8000-000000000001', jsonb_build_object(
  'objective', 'A raktár átvizsgálása', 'radio_channel', '3', 'rally_point', 'Kikötő, 3-as kapu', 'case_id', (select case_id from ids),
  'roles', jsonb_build_array(
    jsonb_build_object('name', 'Behatoló csapat', 'callsign', 'ADAM', 'members', jsonb_build_array(
      jsonb_build_object('user_id', (select deputy_id from ids), 'vehicle_id', (select value from state where key = 'vehicle'), 'callsign', '2-ADAM-1'))),
    jsonb_build_object('name', 'Külső biztosítás', 'members', jsonb_build_array(
      jsonb_build_object('user_id', (select operator_id from ids))))))) -> 'roles'), 2,
  'the organiser saves a plan with two teams');
set local role postgres;
select is((select count(*)::int from public.notifications where user_id = (select deputy_id from ids) and dedupe_key = 'operation:41000000-0000-4000-8000-000000000001'),
  1, 'the members get a notification about their role');
select pg_temp.act_as((select admin_id from ids));
select lives_ok($$select public.save_event_operation('41000000-0000-4000-8000-000000000001',
  public.get_event_operation('41000000-0000-4000-8000-000000000001')::jsonb || '{"objective": "Módosított cél"}'::jsonb)$$,
  'saved again with the same roles');
set local role postgres;
select is((select count(*)::int from public.notifications where user_id = (select deputy_id from ids) and dedupe_key = 'operation:41000000-0000-4000-8000-000000000001'),
  1, 'an unchanged role is not announced again');
select pg_temp.act_as((select admin_id from ids));
select throws_ok(format($$select public.save_event_operation('41000000-0000-4000-8000-000000000002', jsonb_build_object('roles', jsonb_build_array(
  jsonb_build_object('name', 'A', 'members', jsonb_build_array(jsonb_build_object('user_id', %L::uuid))),
  jsonb_build_object('name', 'B', 'members', jsonb_build_array(jsonb_build_object('user_id', %L::uuid))))))$$,
  (select deputy_id from ids), (select deputy_id from ids)), '22023', null, 'a member gets one role only');

select pg_temp.act_as((select deputy_id from ids));
select is(public.get_event_operation('41000000-0000-4000-8000-000000000001') ->> 'objective', 'Módosított cél', 'the audience reads the plan');
select is((select e -> 'operation' ->> 'my_role' from json_array_elements(public.get_events(now() - interval '1 day', now() + interval '3 days')) e
           where e ->> 'id' = '41000000-0000-4000-8000-000000000001'), 'Behatoló csapat', 'and the list shows their role');
select throws_ok($$select public.get_event_operation('41000000-0000-4000-8000-000000000003')$$, 'P0002', null,
  'an event for the staff only stays hidden');

select pg_temp.act_as((select admin_id from ids));
select throws_ok($$select public.save_operation_report('41000000-0000-4000-8000-000000000002', '{"outcome": "success"}')$$, '22023', null,
  'the report waits for the start of the event');
select ok((public.save_operation_report('41000000-0000-4000-8000-000000000001',
  '{"outcome": "partial", "summary": "Két gyanúsított elfogva.", "improve": "Több egység a hátsó kijárathoz."}') -> 'report' ->> 'outcome') = 'partial',
  'after it, the organiser writes the after-action report');
set local role postgres;
select ok(exists (select 1 from public.notifications where user_id = (select operator_id from ids)
                  and dedupe_key = 'operation-report:41000000-0000-4000-8000-000000000001'), 'those with a role are told');
select pg_temp.act_as((select deputy_id from ids));
select throws_ok($$select public.delete_event_operation('41000000-0000-4000-8000-000000000001')$$, '42501', null, 'members cannot delete the plan');

-- ---------------------------------------------------------------------------------------------
-- Performance reviews
-- ---------------------------------------------------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
select throws_ok(format($$select public.save_review(null, %L, (select value from state where key = 'quarter'), '{}')$$, (select supervisor_id from ids)), '42501', null,
  'members do not review anyone');
select pg_temp.act_as((select supervisor_id from ids));
select throws_ok(format($$select public.save_review(null, %L, (select value from state where key = 'quarter'), '{}')$$, (select captain_id from ids)), '42501', null,
  'nor does staff review those above them');
insert into state select 'review', public.save_review(null, (select deputy_id from ids), (select value from state where key = 'quarter'),
  '{"scores": {"activity": 4, "reports": 5, "teamwork": 9}, "strengths": "Pontos jelentések."}') ->> 'id';
set local role postgres;
select is((select scores from public.performance_reviews where id = (select value::uuid from state where key = 'review')),
  '{"activity": 4, "reports": 5}'::jsonb, 'a supervisor drafts a review (scores outside 1–5 are dropped)');
select pg_temp.act_as((select supervisor_id from ids));
select throws_ok(format('select public.share_review(%L)', (select value from state where key = 'review')), '22023', null,
  'an incomplete review cannot be shared');

select pg_temp.act_as((select deputy_id from ids));
select is(json_array_length(public.get_reviews() -> 'reviews'), 0, 'the member does not see the draft');

select pg_temp.act_as((select supervisor_id from ids));
select lives_ok(format($$select public.save_review(%L, null, null,
  '{"scores": {"activity": 4, "reports": 5, "teamwork": 4, "conduct": 5, "knowledge": 3, "initiative": 4}, "goals": "Vezetői képzés."}')$$,
  (select value from state where key = 'review')), 'the draft is completed');
select is(public.share_review((select value::uuid from state where key = 'review')) ->> 'status', 'shared', 'and shared');
set local role postgres;
select is((select overall from public.performance_reviews where id = (select value::uuid from state where key = 'review')), 4.17::numeric(3, 2),
  'the overall score is the average');
select pg_temp.act_as((select supervisor_id from ids));
select throws_ok(format($$select public.save_review(null, %L, (select value from state where key = 'quarter'), '{}')$$, (select deputy_id from ids)), '23505', null,
  'one review per member and quarter');

select pg_temp.act_as((select deputy_id from ids));
select ok((public.get_reviews() -> 'reviews' -> 0 ->> 'can_acknowledge')::boolean, 'the member reads it');
select is(public.acknowledge_review((select value::uuid from state where key = 'review'), 'Köszönöm.') ->> 'status', 'acknowledged',
  'and acknowledges it with an answer');
set local role postgres;
select ok(exists (select 1 from public.notifications where user_id = (select supervisor_id from ids)
                  and dedupe_key = 'review-ack:' || (select value from state where key = 'review')), 'the reviewer is told');
select pg_temp.act_as((select deputy_id from ids));
select throws_ok($$select public.get_review_overview()$$, '42501', null, 'the overview is for the staff');

select pg_temp.act_as((select admin_id from ids));
select ok((select (m -> 'review' ->> 'overall')::numeric from json_array_elements(public.get_review_overview() -> 'members') m
           where m ->> 'user_id' = (select deputy_id::text from ids)) = 4.17, 'the staff see it in the overview');
select ok((select (m ->> 'last_review') is not null from jsonb_array_elements(public.get_promotion_board()::jsonb -> 'members') m
           where m ->> 'user_id' = (select deputy_id::text from ids)), 'and on the promotion board');

-- ---------------------------------------------------------------------------------------------
-- Mail
-- ---------------------------------------------------------------------------------------------
select pg_temp.act_as((select admin_id from ids));
insert into state select 'thread', public.send_mail('Kikötői razzia', 'Holnap este razzia a kikötőben, mindenki legyen ott.',
  '[{"kind": "group", "key": "all"}]'::jsonb, null, 'self')::text;
select ok((public.get_mail_thread((select value::uuid from state where key = 'thread')) -> 'receipts' ->> 'read')::int = 0,
  'the writer sees that nobody has read it yet');

select pg_temp.act_as((select deputy_id from ids));
select ok(exists (select 1 from json_array_elements(public.search_mail('razzia')) t where t ->> 'id' = (select value from state where key = 'thread')),
  'members find the letter by its words');
select is(json_array_length(public.search_mail('r')), 0, 'a single letter searches nothing');
select ok((public.get_mail_thread((select value::uuid from state where key = 'thread')) ->> 'receipts') is null, 'readers see no receipts');
select throws_ok(format('select public.get_mail_receipts(%L)', (select value from state where key = 'thread')), '42501', null,
  'nor the list of readers');

select pg_temp.act_as((select admin_id from ids));
select ok((select (r ->> 'read_at') is not null from json_array_elements(public.get_mail_receipts((select value::uuid from state where key = 'thread')) -> 'readers') r
           where r ->> 'user_id' = (select deputy_id::text from ids)), 'the writer sees who opened it');

select pg_temp.act_as((select deputy_id from ids));
select ok(public.save_mail_template(null, 'Saját levél', 'Tárgy', 'Szia {{címzett}}!', false) is not null, 'members keep their own templates');
select throws_ok($$select public.save_mail_template(null, 'Közös', '', 'Szöveg', true)$$, '42501', null, 'shared ones are for the offices');
select is((select count(*)::int from json_array_elements(public.get_mail_templates()) t where (t ->> 'shared')::boolean), 4,
  'everyone uses the shared templates');

select * from finish();
rollback;
