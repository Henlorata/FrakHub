-- Case templates (MCB leadership), the finance overview's forecast data, attendance of events
-- and the absences of the events calendar. Run with: bunx supabase test db
begin;
select plan(34);

create temporary table ids as select
  '00000000-0000-4000-8000-000000000001'::uuid as admin_id,        -- Commander, bureau manager
  '00000000-0000-4000-8000-000000000002'::uuid as supervisor_id,   -- Sergeant I., MCB (Investigator II.)
  '00000000-0000-4000-8000-000000000003'::uuid as deputy_id,       -- Deputy Sheriff II., TSB
  '00000000-0000-4000-8000-000000000004'::uuid as pending_id,      -- registration waiting for approval
  '00000000-0000-4000-8000-000000000005'::uuid as captain_id,      -- Captain II.
  '00000000-0000-4000-8000-000000000006'::uuid as investigator_id; -- Corporal, MCB (Investigator III.)
grant select on ids to anon, authenticated, service_role;
create temporary table made (name text primary key, id uuid);
grant all on made to anon, authenticated, service_role;

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
create function pg_temp.reset_role() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Case templates ---------------------------------------------------------------------------
select pg_temp.act_anon();
select throws_ok($$select count(*) from public.case_templates$$, '42501', null, 'guests cannot read the templates');

select pg_temp.act_as((select deputy_id from ids));
select is((select count(*) from public.case_templates), 0::bigint, 'members outside the case area see no templates');

select pg_temp.act_as((select supervisor_id from ids));
select is((select count(*) from public.case_templates), 7::bigint, 'investigators read the starter documents and snippets');
select throws_ok($$insert into public.case_templates (kind, label) values ('document', 'Saját sablon')$$,
  '42501', null, 'investigators cannot add templates');
with changed as (update public.case_templates set label = 'Átírva' returning 1)
select is((select count(*) from changed), 0::bigint, 'investigators cannot change templates');
select throws_ok($$select public.reorder_case_templates(array(select id from public.case_templates))$$,
  '42501', null, 'investigators cannot reorder templates');

select pg_temp.act_as((select admin_id from ids));
select lives_ok($$with t as (insert into public.case_templates (kind, label, description, icon, blocks)
                            values ('document', 'Körözési akta', 'Körözött személy adatai', 'siren',
                                    '[{"type":"heading","content":[{"type":"text","text":"Körözés","styles":{}}]}]')
                            returning id)
                  insert into made select 'document', id from t$$,
  'the MCB leadership adds a template');
select is((select created_by from public.case_templates where id = (select id from made where name = 'document')), (select admin_id from ids),
  'the author is recorded');
select throws_ok($$insert into public.case_templates (kind, label, created_by) values ('document', 'Más nevében', (select deputy_id from ids))$$,
  '42501', null, 'the author cannot be set by hand');
select throws_ok($$insert into public.case_templates (kind, label, blocks)
                   values ('snippet', 'Kép', '[{"type":"paragraph","props":{"url":"data:image/png;base64,AAAA"}}]')$$,
  '23514', null, 'pasted pictures are not stored in templates');
select lives_ok($$update public.case_templates set label = 'Körözési adatlap' where id = (select id from made where name = 'document')$$,
  'the leadership edits a template');
select is((select updated_by from public.case_templates where id = (select id from made where name = 'document')), (select admin_id from ids),
  'the editor is recorded');
select lives_ok($$select public.reorder_case_templates(array(
                    select id from public.case_templates where kind = 'document' order by (id = (select id from made where name = 'document')) desc, sort_order))$$,
  'the leadership reorders the templates');
select is((select sort_order from public.case_templates where id = (select id from made where name = 'document')), 10,
  'the moved template comes first');
select lives_ok($$delete from public.case_templates where id = (select id from made where name = 'document')$$, 'the leadership deletes a template');
select is((select count(*) from public.case_templates where kind = 'document'), 3::bigint, 'the deleted template is gone');

-- Finance overview -------------------------------------------------------------------------
select pg_temp.reset_role();
insert into public.payroll_runs (month, balance, balance_at)
values ((date_trunc('month', now() at time zone 'Europe/Budapest'))::date, 123456789, now())
on conflict (month) do update set balance = excluded.balance, balance_at = excluded.balance_at;

select pg_temp.act_as((select deputy_id from ids));
select throws_ok($$select public.get_finance_overview(6)$$, '42501', null, 'members cannot read the finance overview');
select pg_temp.act_as((select captain_id from ids));
select ok((public.get_finance_overview(6) -> 'current' ->> 'estimate') is not null, 'the overview has the running payroll of the month');
select is((public.get_finance_overview(6) -> 'months' -> 0 ->> 'balance')::bigint, 123456789::bigint, 'the overview has the recorded balances');

-- Attendance --------------------------------------------------------------------------------
select pg_temp.reset_role();
delete from public.events;
insert into made (name, id) values
  ('past', gen_random_uuid()), ('future', gen_random_uuid()), ('cancelled', gen_random_uuid());
insert into public.events (id, title, starts_at, audience, created_by, cancelled_at) values
  ((select id from made where name = 'past'), 'Heti gyűlés', now() - interval '2 hours', 'all', (select supervisor_id from ids), null),
  ((select id from made where name = 'future'), 'Jövő heti gyűlés', now() + interval '7 days', 'all', (select supervisor_id from ids), null),
  ((select id from made where name = 'cancelled'), 'Elmaradt gyűlés', now() - interval '1 day', 'all', (select supervisor_id from ids), now());

select pg_temp.act_as((select deputy_id from ids));
select throws_ok($$select public.set_event_attendance((select id from made where name = 'past'), array[(select deputy_id from ids)])$$,
  '42501', null, 'members cannot record attendance');

select pg_temp.act_as((select supervisor_id from ids));
select is((public.set_event_attendance((select id from made where name = 'past'),
  array[(select deputy_id from ids), (select investigator_id from ids), (select pending_id from ids)]) ->> 'attended')::int, 2,
  'the organiser records who was there (registrations waiting for approval are left out)');
select is((public.set_event_attendance((select id from made where name = 'past'), array[(select deputy_id from ids)]) ->> 'attended')::int, 1,
  'recording again replaces the list');
select is((select count(*) from public.event_attendance where event_id = (select id from made where name = 'past')), 1::bigint,
  'the removed member is no longer listed');
select ok((select attendance_taken_at from public.events where id = (select id from made where name = 'past')) is not null,
  'the event remembers that attendance was taken');
select throws_ok($$select public.set_event_attendance((select id from made where name = 'future'), '{}')$$,
  '22023', null, 'attendance waits for the start');
select throws_ok($$select public.set_event_attendance((select id from made where name = 'cancelled'), '{}')$$,
  '22023', null, 'cancelled events have no attendance');
select is((select json_array_length(e -> 'attendee_ids') from json_array_elements(public.get_events(now() - interval '1 day', now() + interval '1 day')) e
           where e ->> 'id' = (select id::text from made where name = 'past')), 1, 'organisers see who was there');

select pg_temp.act_as((select deputy_id from ids));
select is((select (e ->> 'i_attended')::boolean from json_array_elements(public.get_events(now() - interval '1 day', now() + interval '1 day')) e
           where e ->> 'id' = (select id::text from made where name = 'past')), true, 'members see whether they were there');
select ok((select e -> 'attendee_ids' from json_array_elements(public.get_events(now() - interval '1 day', now() + interval '1 day')) e
           where e ->> 'id' = (select id::text from made where name = 'past'))::text = 'null', 'members do not get the list');
select is((public.get_member_attendance() ->> 'attended')::int, 1, 'a member reads their own attendance');
select throws_ok($$select public.get_member_attendance((select investigator_id from ids))$$, '42501', null,
  'members cannot read the attendance of others');

select pg_temp.act_as((select supervisor_id from ids));
select is(public.get_member_attendance((select investigator_id from ids)) ->> 'total', '1',
  'staff see the events a member missed');

-- Absences ---------------------------------------------------------------------------------
select pg_temp.act_anon();
select throws_ok($$select public.get_absences(current_date, current_date + 10)$$, '42501', null, 'guests cannot read absences');

select pg_temp.act_as((select deputy_id from ids));
select is((select array_agg(a ->> 'user_id' order by a ->> 'user_id') from json_array_elements(public.get_absences(current_date, current_date + 10)) a),
  array[(select investigator_id::text from ids)], 'members see approved leave only (requests waiting for a decision are left out)');
