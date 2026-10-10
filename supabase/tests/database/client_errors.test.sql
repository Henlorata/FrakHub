-- The error log: reports from the browsers (members and visitors), the leadership's list, marking
-- rows handled, the throttles and the housekeeping.
-- Run with: bunx supabase test db
begin;
select plan(40);
-- Errors a local browser reported while developing would change the counts (rolled back at the end).
delete from private.client_errors;

create temporary table ids as select
  '00000000-0000-4000-8000-000000000001'::uuid as admin_id,        -- Commander, Bureau Manager
  '00000000-0000-4000-8000-000000000002'::uuid as supervisor_id,   -- Sergeant I. (Supervisory Staff)
  '00000000-0000-4000-8000-000000000003'::uuid as deputy_id;       -- Deputy Sheriff II.
grant select on ids to anon, authenticated, service_role;
create temporary table state (key text primary key, value text);
grant all on state to anon, authenticated, service_role;

create function pg_temp.act_as(_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', _id, 'role', 'authenticated')::text, true);
end $$;
create function pg_temp.act_anon(_ip text) returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('request.headers', json_build_object('x-forwarded-for', _ip)::text, true);
end $$;
-- The log lives in the private schema: checks run as the database.
create function pg_temp.row_of(_message text) returns private.client_errors language sql as $$
  select e from private.client_errors e where e.message = _message
$$;

-- Privileges ----------------------------------------------------------------------------------
select ok(has_function_privilege('anon', 'public.report_client_error(text,text,text,text,text,text)', 'execute'),
  'visitors may report (public pages, guest exams)');
select ok(has_function_privilege('authenticated', 'public.report_client_error(text,text,text,text,text,text)', 'execute'), 'members too');
select ok(not has_function_privilege('anon', 'public.get_client_errors()', 'execute'), 'visitors cannot read the log');
select ok(not has_function_privilege('anon', 'public.resolve_client_errors(uuid[],boolean)', 'execute'), 'or mark rows');
select ok(not has_function_privilege('authenticated', 'private.push_recent(anyarray,anyelement,integer)', 'execute'), 'the helper is not exposed');

-- Reports -------------------------------------------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
select lives_ok($$select public.report_client_error('crash',
  'TypeError: Cannot read properties of undefined (reading ''title'') at 3f2a1b4c-1111-4222-8333-444455556666',
  'at CaseDetailPage (CaseDetailPage-abc.js:1:2345)', '/mcb/case/3f2a1b4c-1111-4222-8333-444455556666?q=titok#chat',
  'build1', 'Chrome 141 · Windows')$$, 'a member reports a crash');
select throws_ok('select count(*) from private.client_errors', '42501', null, 'members cannot read the table itself');
select pg_temp.act_as((select supervisor_id from ids));
select lives_ok($$select public.report_client_error('crash',
  'TypeError: Cannot read properties of undefined (reading ''title'') at 99999999-2222-4333-8444-555566667777',
  null, '/mcb/case/99999999-2222-4333-8444-555566667777', 'build1', 'Firefox 140 · Linux')$$, 'another member meets it on another case');
set local role postgres;
select is((select count(*)::int from private.client_errors where kind = 'crash'), 1, 'one row: the ids in the message do not split it');
select is((pg_temp.row_of('TypeError: Cannot read properties of undefined (reading ''title'') at 99999999-2222-4333-8444-555566667777')).occurrences, 2,
  'counted twice, with the latest message');
select is((select routes from private.client_errors where kind = 'crash'), array['/mcb/case/:id'], 'the page is kept without its query and with the id folded');
select is((select user_ids from private.client_errors where kind = 'crash'),
  array[(select supervisor_id from ids), (select deputy_id from ids)], 'who met it, the latest first');
select is((select browsers from private.client_errors where kind = 'crash'), array['Firefox 140 · Linux', 'Chrome 141 · Windows'], 'and in which browsers');
select is((select detail from private.client_errors where kind = 'crash'), 'at CaseDetailPage (CaseDetailPage-abc.js:1:2345)',
  'a report without a stack keeps the earlier one');

select pg_temp.act_as((select deputy_id from ids));
select public.report_client_error('nonsense', E'Váratlan\n\thiba', repeat('x', 3000), 'not-a-path', 'build-1!', null);
select public.report_client_error('error', repeat('y', 400));
set local role postgres;
select is((pg_temp.row_of('Váratlan hiba')).kind, 'error', 'an unknown kind is stored as a plain error, the whitespace folded');
select is((pg_temp.row_of('Váratlan hiba')).routes, '{}'::text[], 'something that is not a path is left off');
select is((pg_temp.row_of('Váratlan hiba')).builds, array['build1'], 'the build keeps letters and digits only');
select is(char_length((pg_temp.row_of('Váratlan hiba')).detail), 2000, 'the stack is cut at 2000 characters');
select is((select count(*)::int from private.client_errors where message = repeat('y', 300)), 1, 'the message at 300');

select pg_temp.act_anon('203.0.113.7');
select lives_ok($$select public.report_client_error('upload', 'avatar (frakhub_avatars): Upload preset not found', null, '/profile', 'build1', 'Safari 18 · iOS')$$,
  'a visitor reports');
set local role postgres;
select is((pg_temp.row_of('avatar (frakhub_avatars): Upload preset not found')).guests, 1, 'visitors are only counted');
select is((pg_temp.row_of('avatar (frakhub_avatars): Upload preset not found')).user_ids, '{}'::uuid[], 'nobody is named');

-- The list -----------------------------------------------------------------------------------
insert into state select kind, id::text from private.client_errors where kind in ('crash', 'upload');
select pg_temp.act_as((select supervisor_id from ids));
select throws_ok('select public.get_client_errors()', '42501', null, 'the Supervisory Staff cannot read the log');
select throws_ok(format('select public.resolve_client_errors(array[%L]::uuid[])', (select value from state where key = 'crash')), '42501', null,
  'or mark rows');
select ok((public.get_dashboard_summary() ->> 'client_errors') is null, 'their dashboard has no counter');
select pg_temp.act_as((select admin_id from ids));
select is((public.get_client_errors() ->> 'open')::int, 4, 'the Bureau Manager reads the open rows');
select is((select (x ->> 'members')::int from json_array_elements(public.get_client_errors() -> 'items') x where x ->> 'kind' = 'crash'), 2,
  'with how many members met them');
select is((select x -> 'users' -> 0 ->> 'id' from json_array_elements(public.get_client_errors() -> 'items') x where x ->> 'kind' = 'crash'),
  (select supervisor_id from ids)::text, 'and who, the latest first');
select is((public.get_dashboard_summary() ->> 'client_errors')::int, 4, 'the dashboard counts them');
select is(public.resolve_client_errors(array[(select value::uuid from state where key = 'upload')]), 1, 'a row is marked handled');
select is((public.get_dashboard_summary() ->> 'client_errors')::int, 3, 'and leaves the count');
select is(public.resolve_client_errors(array[(select value::uuid from state where key = 'upload')]), 0, 'marking it again changes nothing');

-- An old tab of a build that had the error does not open it again; a newer build does.
select pg_temp.act_anon('203.0.113.8');
select public.report_client_error('upload', 'avatar (frakhub_avatars): Upload preset not found', null, '/profile', 'build1', null);
set local role postgres;
select ok((pg_temp.row_of('avatar (frakhub_avatars): Upload preset not found')).resolved_at is not null, 'a report from the old build leaves it handled');
select pg_temp.act_anon('203.0.113.8');
select public.report_client_error('upload', 'avatar (frakhub_avatars): Upload preset not found', null, '/profile', 'build2', null);
set local role postgres;
select ok((pg_temp.row_of('avatar (frakhub_avatars): Upload preset not found')).resolved_at is null, 'the new build opens it again');
select is((pg_temp.row_of('avatar (frakhub_avatars): Upload preset not found')).occurrences, 3, 'every report counted');

-- Throttles ----------------------------------------------------------------------------------
insert into private.client_error_limits (caller) select (select deputy_id from ids)::text from generate_series(1, 40);
select pg_temp.act_as((select deputy_id from ids));
select public.report_client_error('error', 'Ma már túl sok jelentés');
set local role postgres;
select is((select count(*)::int from private.client_errors where message = 'Ma már túl sok jelentés'), 0, '40 reports a day per member, then dropped');
insert into private.client_errors (fingerprint, kind, message) select 'filler-' || n, 'error', 'kitöltő ' || n from generate_series(1, 100) n;
select pg_temp.act_anon('203.0.113.9');
select public.report_client_error('error', 'Látogató új hibája');
select pg_temp.act_as((select supervisor_id from ids));
select public.report_client_error('error', 'Tag új hibája');
set local role postgres;
select is((select count(*)::int from private.client_errors where message = 'Látogató új hibája'), 0, 'visitors open no new rows beyond 100 open ones');
select is((select count(*)::int from private.client_errors where message = 'Tag új hibája'), 1, 'members still do (up to 300)');

-- Housekeeping -------------------------------------------------------------------------------
update private.client_errors set resolved_at = now() - interval '31 days', resolved_builds = builds where kind = 'crash';
update private.client_errors set last_seen = now() - interval '61 days' where message = 'Váratlan hiba';
delete from private.client_errors where fingerprint like 'filler-%';
insert into private.client_error_limits (caller, created_at) values ('old', now() - interval '3 days');
set local role service_role;
select is((public.run_housekeeping() ->> 'client_errors')::int, 2, 'the housekeeping drops rows handled a month ago and rows nobody met for 60 days');
set local role postgres;
select ok(not exists (select 1 from private.client_error_limits where caller = 'old'), 'and the old rate-limit rows');

select * from finish();
rollback;
