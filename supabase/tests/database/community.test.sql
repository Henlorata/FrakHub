-- Policies with acknowledgement, polls (anonymous ballots), the suggestion board and the
-- anonymous feedback channel. Run with: bunx supabase test db
begin;
select plan(42);

create temporary table ids as select
  '00000000-0000-4000-8000-000000000001'::uuid as admin_id,        -- Commander, bureau manager
  '00000000-0000-4000-8000-000000000002'::uuid as supervisor_id,   -- Sergeant I.
  '00000000-0000-4000-8000-000000000003'::uuid as deputy_id,       -- Deputy Sheriff II. (seeded feedback)
  '00000000-0000-4000-8000-000000000005'::uuid as captain_id,      -- Captain II. (high command, admin)
  '00000000-0000-4000-8000-000000000006'::uuid as investigator_id, -- Corporal
  '37000000-0000-4000-8000-000000000001'::uuid as feedback_id;
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

-- Policies -----------------------------------------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
select throws_ok($$select public.save_policy(null, '{"title": "Saját szabály"}')$$, '42501', null, 'members cannot write policies');
select pg_temp.act_as((select admin_id from ids));
select throws_ok($$select public.save_policy(null, '{"title": "Képes", "body": [{"type": "image", "props": {"url": "data:image/png;base64,AAAA"}}]}')$$,
  '22023', null, 'pasted pictures are refused');
insert into t select 'policy', public.save_policy(null, '{"title": "Eligazítási rend", "category": "conduct", "requires_ack": true,
  "body": [{"type": "paragraph", "content": "Az eligazításon pontosan, egyenruhában jelenünk meg."}]}')::text;
select is((pg_temp.j('policy') ->> 'version')::int, 0, 'a new policy is a draft');
select pg_temp.act_as((select deputy_id from ids));
select ok(not exists (select 1 from json_array_elements(public.get_policies() -> 'policies') p where p ->> 'id' = pg_temp.j('policy') ->> 'id'),
  'members do not see drafts');
select pg_temp.act_as((select admin_id from ids));
select is((public.publish_policy((pg_temp.j('policy') ->> 'id')::uuid, null) ->> 'version')::int, 1, 'publishing makes version 1');
select pg_temp.reset_role();
select is((select count(*)::int from public.notifications n, ids where n.user_id = ids.deputy_id and n.dedupe_key = 'policy:' || (pg_temp.j('policy') ->> 'id')),
  1, 'members are asked to read it');
select pg_temp.act_as((select deputy_id from ids));
select is((public.get_dashboard_summary() ->> 'policies_to_acknowledge')::int, 2, 'the dashboard counts the policies to read');
select is((public.acknowledge_policy((pg_temp.j('policy') ->> 'id')::uuid) ->> 'version')::int, 1, 'a member acknowledges the policy');
select pg_temp.reset_role();
select is((select count(*)::int from public.notifications n, ids where n.user_id = ids.deputy_id and n.dedupe_key = 'policy:' || (pg_temp.j('policy') ->> 'id')),
  0, 'the reminder goes away');
select pg_temp.act_as((select admin_id from ids));
select lives_ok(format($$select public.save_policy(%L, '{"title": "Eligazítási rend", "category": "conduct",
  "body": [{"type": "paragraph", "content": "Az eligazításon pontosan, egyenruhában, kikapcsolt telefonnal jelenünk meg."}]}')$$,
  pg_temp.j('policy') ->> 'id'), 'the working copy changes');
select is((public.publish_policy((pg_temp.j('policy') ->> 'id')::uuid, 'Telefonok') ->> 'version')::int, 2, 'a new version is published');
select ok(exists (select 1 from json_array_elements(public.get_policy((pg_temp.j('policy') ->> 'id')::uuid, null) -> 'missing') m
                  where (m ->> 'user_id')::uuid = (select deputy_id from ids)), 'the editors see who has not read the new version');
select throws_ok(format('select public.delete_policy(%L)', pg_temp.j('policy') ->> 'id'), '22023', null,
  'a published policy is archived, not deleted');
select pg_temp.act_as((select deputy_id from ids));
select ok(public.get_policy((pg_temp.j('policy') ->> 'id')::uuid, 1) -> 'body' -> 0 ->> 'content' not like '%telefon%',
  'older versions stay readable');

-- Polls --------------------------------------------------------------------------------------
select throws_ok(format($$select public.create_poll('{"title": "Kérdés", "options": ["A", "B"], "closes_at": "%s"}')$$, now() + interval '2 days'),
  '42501', null, 'members cannot start a poll for everyone');
select pg_temp.act_as((select admin_id from ids));
select throws_ok(format($$select public.create_poll('{"title": "Egy válasz", "options": ["Csak ez"], "closes_at": "%s"}')$$, now() + interval '2 days'),
  '22023', null, 'a poll needs at least two options');
insert into t select 'poll', public.create_poll(jsonb_build_object('title', 'Új egyenruha színe?', 'anonymous', true, 'results', 'after_vote',
  'options', jsonb_build_array('Sötétkék', 'Fekete', 'Zöld'), 'closes_at', now() + interval '2 days'))::text;
select pg_temp.act_as((select deputy_id from ids));
select ok((select (p ->> 'results_visible')::boolean = false from json_array_elements(public.get_polls()) p where p ->> 'id' = pg_temp.j('poll') ->> 'id'),
  'results stay hidden until voting');
select lives_ok(format('select public.cast_vote(%L, array[(select (o ->> %L)::uuid from json_array_elements(public.get_polls()) p, json_array_elements(p -> %L) o where p ->> %L = %L limit 1)])',
  pg_temp.j('poll') ->> 'id', 'id', 'options', 'id', pg_temp.j('poll') ->> 'id'), 'a member votes');
select throws_ok(format('select public.cast_vote(%L, array[(select (o ->> %L)::uuid from json_array_elements(public.get_polls()) p, json_array_elements(p -> %L) o where p ->> %L = %L limit 1)])',
  pg_temp.j('poll') ->> 'id', 'id', 'options', 'id', pg_temp.j('poll') ->> 'id'), '23505', null, 'one vote per member');
select is((select (o ->> 'votes')::int from json_array_elements(public.get_polls()) p, json_array_elements(p -> 'options') o
           where p ->> 'id' = pg_temp.j('poll') ->> 'id' order by (o ->> 'votes')::int desc limit 1), 1, 'after voting the results show');
select pg_temp.reset_role();
select is((select count(*)::int from public.poll_votes where poll_id = (pg_temp.j('poll') ->> 'id')::uuid and user_id is null), 1,
  'an anonymous ballot carries no voter');
select pg_temp.act_as((select deputy_id from ids));
select throws_ok(format('select public.close_poll(%L)', pg_temp.j('poll') ->> 'id'), '42501', null, 'members cannot close a poll');
select pg_temp.act_as((select admin_id from ids));
select lives_ok(format('select public.close_poll(%L)', pg_temp.j('poll') ->> 'id'), 'the organiser closes the poll');
select pg_temp.act_as((select investigator_id from ids));
select throws_ok(format('select public.cast_vote(%L, array[gen_random_uuid()])', pg_temp.j('poll') ->> 'id'), '22023', null,
  'a closed poll takes no votes');

-- Suggestions --------------------------------------------------------------------------------
select pg_temp.act_as((select captain_id from ids));
insert into t select 'idea', public.create_suggestion('Közös vacsora a hónap végén', 'Havonta egyszer üljünk le együtt szolgálaton kívül is.', 'events')::text;
select throws_ok(format('select public.toggle_suggestion_vote(%L)', pg_temp.j('idea') ->> 'id'), '22023', null,
  'nobody votes on their own idea');
select pg_temp.act_as((select investigator_id from ids));
select is((public.toggle_suggestion_vote((pg_temp.j('idea') ->> 'id')::uuid) ->> 'voted')::boolean, true, 'members upvote an idea');
select is((public.toggle_suggestion_vote((pg_temp.j('idea') ->> 'id')::uuid) ->> 'voted')::boolean, false, 'a second click takes it back');
select throws_ok(format('select public.respond_suggestion(%L, %L, %L)', pg_temp.j('idea') ->> 'id', 'planned', 'Jó ötlet.'), '42501', null,
  'members cannot answer ideas');
select pg_temp.act_as((select admin_id from ids));
select is(public.respond_suggestion((pg_temp.j('idea') ->> 'id')::uuid, 'planned', 'Novemberben lesz az első.') ->> 'status', 'planned',
  'the command answers an idea');
select pg_temp.reset_role();
select is((select count(*)::int from public.notifications n, ids where n.user_id = ids.captain_id and n.title = 'Válasz az ötletedre'), 1,
  'the author hears about the answer');
select pg_temp.act_as((select deputy_id from ids));
select throws_ok($$select public.delete_suggestion('36000000-0000-4000-8000-000000000001')$$, '42501', null,
  'an answered idea stays on the board');
select pg_temp.act_as((select captain_id from ids));
select lives_ok($q$do $d$ begin for i in 1..4 loop perform public.create_suggestion('Ötlet száma ' || i, 'Egy újabb ötlet a listára, sorszám: ' || i, 'other'); end loop; end $d$$q$,
  'five ideas a week are fine');
select throws_ok($$select public.create_suggestion('Hatodik ötlet', 'Ez már a hatodik ötlet ezen a héten.', 'other')$$, '22023', null,
  'the sixth idea in a week is refused');

-- Anonymous feedback ---------------------------------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
select is(json_array_length(public.get_my_feedback() -> 'reports'), 1, 'the reporter sees their own report');
select throws_ok($$select public.get_feedback_inbox()$$, '42501', null, 'members cannot read the inbox');
select pg_temp.act_as((select captain_id from ids));
insert into t select 'inbox', public.get_feedback_inbox()::text;
select is(json_array_length(pg_temp.j('inbox')), 1, 'the command reads the inbox');
select ok(position((select deputy_id::text from ids) in pg_temp.j('inbox')::text) = 0, 'the inbox never names the reporter');
select lives_ok(format('select public.reply_feedback(%L, %L)', (select feedback_id from ids), 'Köszönjük, a következő gyűlés fél órával korábban kezdődik.'),
  'a leader answers');
select pg_temp.reset_role();
select is((select count(*)::int from public.notifications n, ids where n.user_id = ids.deputy_id and n.title = 'Válasz a névtelen visszajelzésedre'), 1,
  'the reporter is told without anyone learning who they are');
select pg_temp.act_as((select supervisor_id from ids));
select throws_ok(format('select public.block_feedback_reporter(%L, 7, null)', (select feedback_id from ids)), 'P0002', null,
  'others cannot even see the report');
select pg_temp.act_as((select admin_id from ids));
select lives_ok(format('select public.block_feedback_reporter(%L, 7, %L)', (select feedback_id from ids), 'Ismételt sértegetés'),
  'the executive staff can block the reporter');
select pg_temp.act_as((select deputy_id from ids));
select throws_ok($$select public.submit_feedback('command', 'other', 'Ez egy újabb, legalább húsz karakteres üzenet.')$$, '42501', null,
  'a blocked reporter cannot send');

select * from finish();
rollback;
