-- Events and attendance: who sees, organises and answers; the monthly requirement on the
-- dashboard. Run with: bunx supabase test db
begin;
select plan(29);

create temporary table ids as select
  '00000000-0000-4000-8000-000000000001'::uuid as admin_id,        -- Commander, bureau manager
  '00000000-0000-4000-8000-000000000002'::uuid as supervisor_id,   -- Sergeant I., MCB
  '00000000-0000-4000-8000-000000000003'::uuid as deputy_id,       -- Deputy Sheriff II., TSB
  '00000000-0000-4000-8000-000000000006'::uuid as investigator_id, -- Corporal, MCB
  '00000000-0000-4000-8000-000000000007'::uuid as operator_id;     -- Senior Deputy, SEB, leads the MU unit
grant select on ids to anon, authenticated, service_role;
create temporary table made (name text primary key, id uuid);
grant all on made to anon, authenticated, service_role;
-- Independent of the seed's sample events (rolled back at the end).
delete from public.events;
delete from public.notifications where category = 'event';

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
create function pg_temp.visible() returns integer language sql as $$
  select json_array_length(public.get_events(now() - interval '1 day', now() + interval '30 days'))
$$;

-- Guests ---------------------------------------------------------------------------------
select pg_temp.act_anon();
select throws_ok($$select count(*) from public.events$$, '42501', null, 'anon cannot read events');
select throws_ok($$select public.get_events(now(), now() + interval '1 day')$$, '42501', null, 'anon cannot list events');

-- Organising ------------------------------------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
select throws_ok($$insert into public.events (title, starts_at) values ('Saját buli', now() + interval '1 day')$$,
  '42501', null, 'members cannot organise events');

select pg_temp.act_as((select supervisor_id from ids));
select lives_ok($$with e as (insert into public.events (title, kind, starts_at, ends_at, location, audience)
                            values ('Heti gyűlés', 'meeting', now() + interval '2 days', now() + interval '2 days 1 hour', 'Downtown', 'all')
                            returning id)
                  insert into made select 'meeting', id from e$$,
  'supervisory staff organise events for everyone');
select is((select created_by from public.events where id = (select id from made where name = 'meeting')), (select supervisor_id from ids),
  'the organiser is the inserting member');
select throws_ok($$insert into public.events (title, starts_at, audience) values ('Command Staff értekezlet', now() + interval '1 day', 'command')$$,
  '42501', null, 'supervisory staff cannot organise command staff events');
select lives_ok($$with e as (insert into public.events (title, starts_at, audience) values ('Supervisory Staff eligazítás', now() + interval '3 days', 'staff')
                            returning id)
                  insert into made select 'staff', id from e$$,
  'supervisory staff organise staff events');
select throws_ok($$insert into public.events (title, starts_at, ends_at) values ('Fordított idő', now() + interval '2 days', now() + interval '1 day')$$,
  '23514', null, 'an event cannot end before it starts');
select throws_ok($$insert into public.events (title, starts_at, created_by)
                   values ('Más nevében', now() + interval '1 day', (select deputy_id from ids))$$,
  '42501', null, 'the organiser cannot be set by hand');

select pg_temp.act_as((select operator_id from ids));
select lives_ok($$with e as (insert into public.events (title, starts_at, audience) values ('MU gyakorlat', now() + interval '4 days', 'MU')
                            returning id)
                  insert into made select 'unit', id from e$$,
  'a unit leader organises events of the unit');
select throws_ok($$insert into public.events (title, starts_at) values ('Mindenkinek', now() + interval '1 day')$$,
  '42501', null, 'a unit leader cannot organise events for everyone');

select pg_temp.act_as((select investigator_id from ids));
select throws_ok($$insert into public.events (title, starts_at, audience) values ('MCB kör', now() + interval '1 day', 'MCB')$$,
  '42501', null, 'unit members who do not lead it cannot organise its events');

-- Who sees what ---------------------------------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
select is(pg_temp.visible(), 1, 'a member sees the events meant for everyone only');
select is((select count(*) from public.notifications where category = 'event'), 1::bigint, 'the audience is notified of a new event');
select pg_temp.act_as((select operator_id from ids));
select is(pg_temp.visible(), 2, 'unit members also see their unit''s events');
select pg_temp.act_as((select supervisor_id from ids));
select is(pg_temp.visible(), 3, 'supervisory staff see the staff and unit events too');
select is((select count(*) from public.notifications where category = 'event'), 0::bigint,
  'organisers are not notified of their own events');

-- Answering -------------------------------------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
select is(public.respond_to_event((select id from made where name = 'meeting'), 'going') ->> 'going', '1', 'members answer');
select is(public.respond_to_event((select id from made where name = 'meeting'), 'maybe', 'Késve érek oda') ->> 'maybe', '1',
  'a second answer replaces the first');
select throws_ok($$insert into public.event_responses (event_id, user_id, status)
                   values ((select id from made where name = 'meeting'), (select deputy_id from ids), 'going')$$,
  '42501', null, 'answers are written through respond_to_event() only');
select throws_ok($$select public.respond_to_event((select id from made where name = 'meeting'), 'yes')$$,
  '22023', null, 'only going, maybe and absent are answers');
select throws_ok($$select public.respond_to_event((select id from made where name = 'staff'), 'going')$$,
  'P0002', null, 'members cannot answer events they do not see');
update public.events set title = 'Feltört cím' where id = (select id from made where name = 'meeting');
delete from public.events where id = (select id from made where name = 'meeting');

select pg_temp.act_as((select supervisor_id from ids));
select is((select title from public.events where id = (select id from made where name = 'meeting')), 'Heti gyűlés',
  'members cannot change or delete events');
update public.events set cancelled_at = now() where id = (select id from made where name = 'meeting');

select pg_temp.act_as((select deputy_id from ids));
select ok((select title from public.notifications where category = 'event' order by created_at desc limit 1) like 'Elmarad:%',
  'those who come are told when an event is cancelled');
select throws_ok($$select public.respond_to_event((select id from made where name = 'meeting'), 'going')$$,
  '22023', null, 'a cancelled event takes no answers');
select throws_ok($$select public.events_send_reminders()$$, '42501', null, 'only the cron sends reminders');

-- Dashboard and requirement -----------------------------------------------------------
select is(json_array_length(public.get_dashboard_summary() -> 'upcoming_events'), 0, 'cancelled events leave the dashboard');
select is((public.get_dashboard_summary() -> 'my_month' ->> 'min_reports')::int, 8, 'the dashboard shows the monthly report requirement');

select pg_temp.act_as((select admin_id from ids));
select is(((public.save_payroll_settings('{"min_reports": 10}'::jsonb)) ->> 'min_reports')::int, 10,
  'the Commander sets the report requirement');

select * from finish();
rollback;
