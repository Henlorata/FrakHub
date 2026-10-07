-- The public front page and the news: what visitors read, who edits (the SIB, the Command and
-- Executive Staff, the Bureau Manager), addresses, publishing and notifications.
-- Run with: bunx supabase test db
begin;
select plan(24);

create temporary table ids as select
  '00000000-0000-4000-8000-000000000003'::uuid as deputy_id,   -- Deputy Sheriff II., no SIB
  '00000000-0000-4000-8000-000000000005'::uuid as captain_id,  -- Captain II. (Command Staff)
  '00000000-0000-4000-8000-000000000007'::uuid as operator_id; -- gets the SIB qualification here
grant select on ids to anon, authenticated, service_role;
create temporary table state (key text primary key, value text);
grant all on state to anon, authenticated;

create function pg_temp.act_as(_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', _id, 'role', 'authenticated')::text, true);
end $$;
create function pg_temp.act_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
end $$;

update public.profiles set qualifications = array_append(coalesce(qualifications, '{}'), 'SIB') where id = (select operator_id from ids);

-- Visitors ----------------------------------------------------------------------------------
select pg_temp.act_anon();
select ok((public.get_public_site() -> 'content' -> 'hero' ->> 'title') is not null, 'a visitor reads the front page');
select ok((public.get_public_site() -> 'stats' ->> 'members')::int > 0, 'with the aggregate numbers');
select ok(json_typeof(public.get_public_site() -> 'leadership') = 'array', 'and the leadership');
select throws_ok('select public.get_site_editor()', '42501', null, 'but not the editor');

-- Editors -----------------------------------------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
select throws_ok($$select public.save_news_post(null, 'Próba hír', null, '[]'::jsonb, null, 'news', false)$$, '42501', null,
  'a member outside the SIB and the leadership cannot write news');
select throws_ok($$select public.save_site_content('hero', '{"title": "x"}'::jsonb)$$, '42501', null, 'nor change the front page');

select pg_temp.act_anon();
insert into state values ('listed', json_array_length(public.get_public_news(null, null, 48))::text);
select pg_temp.act_as((select operator_id from ids));
insert into state select 'a', saved ->> 'slug' from (select public.save_news_post(null, 'Új egyenruha – hétfőtől!', 'Rövid', '[]'::jsonb, null, 'press', false) as saved) x;
insert into state select 'a_id', id::text from (select (public.get_news_post((select value from state where key = 'a')) -> 'post' ->> 'id')::uuid as id) x;
select is((select value from state where key = 'a'), 'uj-egyenruha-hetfotol', 'a SIB member writes news; the address comes from the title');
insert into state values ('b', public.save_news_post(null, 'Új egyenruha – hétfőtől!', null, '[]'::jsonb, null, 'press', false) ->> 'slug');
select is((select value from state where key = 'b'), 'uj-egyenruha-hetfotol-2', 'the same title gets a numbered address');
select throws_ok($$select public.save_news_post(null, 'Képes hír', null, '[{"type":"image","props":{"url":"data:image/png;base64,AAAA"}}]'::jsonb, null, 'news', false)$$,
  'P0001', null, 'embedded pictures are refused (they are uploaded instead)');
select throws_ok($$select public.save_news_post(null, 'Rossz borító', null, '[]'::jsonb, 'https://example.com/x.png', 'news', false)$$,
  '23514', null, 'a cover must be a Cloudinary picture');

-- A draft stays hidden until it is published
select pg_temp.act_anon();
select ok(public.get_news_post((select value from state where key = 'a')) is null, 'a visitor does not see a draft');
select is(json_array_length(public.get_public_news(null, null, 48)), (select value::int from state where key = 'listed'), 'nor in the list');
select pg_temp.act_as((select captain_id from ids));
select ok(public.get_news_post((select value from state where key = 'a')) is not null, 'an editor previews the draft');
select lives_ok(format('select public.publish_news_post(%L, true, true)', (select value from state where key = 'a_id')),
  'the Command Staff publishes it, with a notification to the members');
select pg_temp.act_anon();
select is(public.get_news_post((select value from state where key = 'a')) -> 'post' ->> 'title', 'Új egyenruha – hétfőtől!', 'now visitors read it');
select is(json_array_length(public.get_public_news(null, null, 48)), (select value::int + 1 from state where key = 'listed'), 'and it is listed');
select ok(exists (select 1 from json_array_elements(public.get_public_site() -> 'news') item where item ->> 'slug' = (select value from state where key = 'a')),
  'and on the front page');
set local role postgres;
select ok((select count(*) from public.notifications where dedupe_key like 'news:%') >= 5, 'the members were notified');

-- The page's sections
select pg_temp.act_as((select operator_id from ids));
select lives_ok($$select public.save_site_content('sections', '{"stats": false}'::jsonb)$$, 'the SIB hides a section');
select pg_temp.act_anon();
select ok(json_typeof(public.get_public_site() -> 'stats') = 'null' or (public.get_public_site() -> 'stats') is null, 'the numbers are no longer sent');
select ok((public.get_public_site() -> 'content' -> 'leadership') is null, 'visitors never receive the list of hidden leaders');

-- Leaders the SIB leaves off the front page
select pg_temp.act_as((select operator_id from ids));
insert into state select 'leader', l ->> 'id' from json_array_elements(public.get_site_editor() -> 'leaders') l where l ->> 'full_name' = (
  select full_name from public.profiles where id = (select captain_id from ids));
select throws_ok($$select public.save_site_content('leadership', '{"hidden": ["nem-azonosito"]}'::jsonb)$$, '22023', null, 'the list takes member ids only');
select lives_ok(format('select public.save_site_content(%L, %L::jsonb)', 'leadership', json_build_object('hidden', json_build_array((select value from state where key = 'leader')))),
  'the SIB hides a leader');
select pg_temp.act_anon();
select ok(not exists (select 1 from json_array_elements(public.get_public_site() -> 'leadership') l
                      where l ->> 'full_name' = (select full_name from public.profiles where id = (select captain_id from ids))),
  'who is hidden is not listed for visitors');

select * from finish();
rollback;
