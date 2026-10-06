-- Fixes of 20261006092419_qa_fixes: the nominee is never notified, an undone promotion takes back
-- the nominator's notification, the activity reminder's wording, the publisher's acknowledgement,
-- the results of anonymous polls for their organisers, the dashboard's joining day and the
-- leaderboard's places.
-- Run with: bunx supabase test db
begin;
select plan(15);

create temporary table ids as select
  '00000000-0000-4000-8000-000000000001'::uuid as admin_id,        -- Commander
  '00000000-0000-4000-8000-000000000002'::uuid as supervisor_id,   -- Sergeant I., nominated the deputy (seed)
  '00000000-0000-4000-8000-000000000003'::uuid as deputy_id,       -- Deputy Sheriff II.
  '00000000-0000-4000-8000-000000000005'::uuid as captain_id,      -- Captain II., created the anonymous poll
  '34000000-0000-4000-8000-000000000001'::uuid as policy_id,       -- published, must read
  '35000000-0000-4000-8000-000000000002'::uuid as anonymous_poll,  -- anonymous, results after the close
  '35000000-0000-4000-8000-000000000001'::uuid as named_poll;      -- named, live results
grant select on ids to anon, authenticated, service_role;
create temporary table t (key text primary key, value text);
grant all on t to anon, authenticated, service_role;

create function pg_temp.act_as(_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', _id, 'role', 'authenticated')::text, true);
end $$;
create function pg_temp.reset_role() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.j(_key text) returns json language sql as $$ select value::json from t where key = _key $$;
grant execute on function pg_temp.j(text) to authenticated;

-- 1. A Deputy Commander is one of the approvers of a nomination to Commander, but never hears about their own.
update public.profiles set faction_rank = 'Deputy Commander' where id = (select captain_id from ids);
select pg_temp.act_as((select admin_id from ids));
select lives_ok($$select public.nominate_for_promotion((select captain_id from ids), 'Kiváló vezető, régóta a csapat motorja.')$$,
  'the Commander nominates the Deputy Commander');
select pg_temp.reset_role();
select is((select count(*)::int from public.notifications where user_id = (select captain_id from ids) and title = 'Előléptetési javaslat'), 0,
  'the nominee is not notified even though they could decide nominations');

-- 2. Promotion and undo: the nominator's "accepted" notification comes and goes with it.
select set_config('app.actor_id', (select admin_id::text from ids), true);
update public.profiles set faction_rank = 'Deputy Sheriff III.' where id = (select deputy_id from ids);
select is((select count(*)::int from public.notifications n join public.promotion_nominations p on n.dedupe_key = 'nomination:' || p.id
           where n.user_id = (select supervisor_id from ids) and p.user_id = (select deputy_id from ids)), 1,
  'the nominator hears that the nomination was accepted');
update public.profiles set faction_rank = 'Deputy Sheriff II.' where id = (select deputy_id from ids);
select is((select status from public.promotion_nominations where user_id = (select deputy_id from ids) order by created_at desc limit 1), 'pending',
  'an undo right away reopens the nomination');
select is((select count(*)::int from public.notifications n join public.promotion_nominations p on n.dedupe_key = 'nomination:' || p.id
           where n.user_id = (select supervisor_id from ids) and p.user_id = (select deputy_id from ids)), 0,
  'and takes back the "accepted" notification');

-- 3. The reminder reads like the preview on the HR page.
select pg_temp.act_as((select admin_id from ids));
select lives_ok($$select public.send_activity_reminder((select deputy_id from ids), 'teszt')$$, 'a superior sends the reminder');
select pg_temp.reset_role();
select matches((select message from public.notifications where user_id = (select deputy_id from ids) and dedupe_key = 'activity-reminder'),
  '^\d{4}\. [a-záéíóöőúüű]+ havi rögzített duty időd \d+ ó \d{2} p \(a minimum \d+ ó \d{2} p\)\.',
  'the reminder names the month and the times like the site');

-- 4. Whoever publishes a must-read version has read it.
select pg_temp.act_as((select admin_id from ids));
select lives_ok($$select public.publish_policy((select policy_id from ids), 'Teszt')$$, 'the commander publishes a new version');
select is((public.get_dashboard_summary() ->> 'policies_to_acknowledge')::int, 0, 'the publisher is not asked to acknowledge it');

-- 5. The organiser of an anonymous poll sees the results when everyone does.
select pg_temp.act_as((select captain_id from ids));
insert into t select 'polls', public.get_polls()::text;
select is((select p ->> 'results_visible' from json_array_elements(pg_temp.j('polls')) p where (p ->> 'id')::uuid = (select anonymous_poll from ids)),
  'false', 'no running counts of an anonymous poll for its organiser');
select is((select o ->> 'votes' from json_array_elements(pg_temp.j('polls')) p, json_array_elements(p -> 'options') o
           where (p ->> 'id')::uuid = (select anonymous_poll from ids) and o ->> 'label' = 'Részben'), null,
  'the counts stay hidden until the close');

-- 6. The dashboard has the joining day of the registry.
select pg_temp.act_as((select admin_id from ids));
select is((public.get_dashboard_summary() ->> 'joined_on')::date, (select joined_on from public.member_details where user_id = (select admin_id from ids)),
  'the dashboard returns the registry''s joining day');

-- Someone who joined this month gets no recap of last month.
select pg_temp.reset_role();
insert into public.member_details (user_id, joined_on) values ('00000000-0000-4000-8000-000000000008', (now() at time zone 'Europe/Budapest')::date)
on conflict (user_id) do update set joined_on = excluded.joined_on;
select pg_temp.act_as('00000000-0000-4000-8000-000000000008');
select is(public.get_dashboard_summary() ->> 'recap_month', null, 'no recap for a member who joined this month');

-- 7. A member who did not opt in but leads the month does not push the listed members down.
select pg_temp.reset_role();
insert into public.duty_time_entries (user_id, month, minutes)
values ((select captain_id from ids), (date_trunc('month', now() at time zone 'Europe/Budapest'))::date, 40000)
on conflict (user_id, month) do update set minutes = excluded.minutes;
select pg_temp.act_as((select captain_id from ids));
insert into t select 'board', public.get_leaderboard(null)::text;
select is((select (c -> 'entries' -> 0 ->> 'place')::int from json_array_elements(pg_temp.j('board') -> 'categories') c where c ->> 'key' = 'duty'), 1,
  'the listed members start at the first place even when a hidden member is ahead');
select is((select (c -> 'me' ->> 'place')::int from json_array_elements(pg_temp.j('board') -> 'categories') c where c ->> 'key' = 'duty'), 1,
  'the hidden member sees the place they would hold among them');

select * from finish();
rollback;
