-- Mail (threads to members and shared addresses) and the Internal Affairs Bureau's investigations.
-- Run with: bunx supabase test db
begin;
select plan(45);

create temporary table ids as select
  '00000000-0000-4000-8000-000000000001'::uuid as admin_id,        -- Commander, Bureau Manager
  '00000000-0000-4000-8000-000000000002'::uuid as supervisor_id,   -- Sergeant I., MCB (staff)
  '00000000-0000-4000-8000-000000000003'::uuid as deputy_id,       -- Deputy Sheriff II., TSB
  '00000000-0000-4000-8000-000000000005'::uuid as captain_id,      -- Captain II. (Command Staff)
  '00000000-0000-4000-8000-000000000006'::uuid as investigator_id, -- Corporal, MCB: becomes an IAB Agent here
  '00000000-0000-4000-8000-000000000007'::uuid as operator_id;     -- Senior Deputy Sheriff, SEB
grant select on ids to anon, authenticated, service_role;
create temporary table state (key text primary key, value uuid);
grant all on state to authenticated;

create function pg_temp.act_as(_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', _id, 'role', 'authenticated')::text, true);
end $$;
-- The mail and IAB tables are read through functions only; direct checks run as the database.
create function pg_temp.as_db(_back uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
end $$;

-- Addresses -------------------------------------------------------------------------------
select is(private.mail_address('Árvíztűrő Tükörfúrógép'), 'arvizturo.tukorfurogep@sfsd.org', 'addresses fold the accents');
select is(private.mail_address('Millie D Lowe'), 'millie.d.lowe@sfsd.org', 'initials stay as parts of the address');

-- IAB staff --------------------------------------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
select throws_ok(format('select public.set_iab_title(%L, ''agent'')', (select investigator_id from ids)), '42501', null,
  'a member cannot staff the IAB');
select pg_temp.act_as((select admin_id from ids));
select lives_ok($$select public.get_mailbox('iab')$$, 'while nobody holds an IAB title, the Bureau Manager opens the IAB mailbox');
select lives_ok(format('select public.set_iab_title(%L, ''agent'')', (select investigator_id from ids)), 'the Bureau Manager staffs the IAB');
select is((select iab_title from public.profiles where id = (select investigator_id from ids)), 'agent', 'the title is stored on the profile');
select throws_ok($$select public.get_mailbox('iab')$$, '42501', null, 'from then on the mailbox is the IAB''s');

-- A letter to the IAB and a colleague --------------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
insert into state values ('thread', public.send_mail('Felülvizsgálati kérelem', 'Tisztelt Internal Affairs Bureau! Kérem a vizsgálatot.',
  jsonb_build_array(jsonb_build_object('kind', 'group', 'key', 'iab'), jsonb_build_object('kind', 'user', 'id', (select operator_id from ids)))));
select ok((select value from state where key = 'thread') is not null, 'a member writes to the IAB and a colleague');
select pg_temp.as_db(null);
select is((select sender_address from public.mail_messages where thread_id = (select value from state where key = 'thread')),
  'deputy.teszt@sfsd.org', 'the sender is the member''s own address');
select pg_temp.act_as((select deputy_id from ids));
select ok(exists (select 1 from json_array_elements(public.get_mailbox('sent')) t where (t ->> 'id')::uuid = (select value from state where key = 'thread')),
  'it is in the sender''s sent folder');
select throws_ok(format('select public.send_mail(''x'', ''y'', %L::jsonb)', jsonb_build_array(jsonb_build_object('kind', 'group', 'key', 'all'))),
  '42501', null, 'a member cannot write to everyone');
select throws_ok($$select public.send_mail('x', 'y', '[{"kind":"user","id":"00000000-0000-4000-8000-000000000002"}]'::jsonb, null, 'external', 'LSPD', 'cmd@lspd.org')$$,
  '42501', null, 'nor record an outside letter');
select throws_ok($$select public.send_mail('x', 'y', '[{"kind":"user","id":"00000000-0000-4000-8000-000000000002"}]'::jsonb, null, 'iab')$$,
  '42501', null, 'nor write in the IAB''s name');

select pg_temp.act_as((select operator_id from ids));
select ok(exists (select 1 from json_array_elements(public.get_mailbox('inbox')) t where (t ->> 'id')::uuid = (select value from state where key = 'thread')),
  'the colleague finds it in the inbox');
select is((public.get_mailbox('inbox') -> 0 ->> 'unread')::boolean, true, 'unread at first');
select is(json_array_length(public.get_mail_thread((select value from state where key = 'thread')) -> 'messages'), 1, 'and reads it');
select is((public.get_mailbox('inbox') -> 0 ->> 'unread')::boolean, false, 'then it is read');
select lives_ok(format('select public.send_mail(null, ''Köszönöm, továbbítottam.'', ''[]''::jsonb, %L)', (select value from state where key = 'thread')),
  'a recipient answers in the thread');
select throws_ok(format('select public.get_mailbox(''iab'')'), '42501', null, 'the IAB''s mailbox is only for the IAB');

select pg_temp.act_as((select supervisor_id from ids));
select throws_ok(format('select public.get_mail_thread(%L)', (select value from state where key = 'thread')), '42501', null,
  'a member who is not a recipient cannot read it');

select pg_temp.act_as((select investigator_id from ids));
select ok(exists (select 1 from json_array_elements(public.get_mailbox('iab')) t where (t ->> 'id')::uuid = (select value from state where key = 'thread')),
  'the IAB reads its mailbox');
select lives_ok(format('select public.send_mail(null, ''Az IAB tudomásul vette.'', ''[]''::jsonb, %L, ''iab'')', (select value from state where key = 'thread')),
  'an IAB member answers in the bureau''s name');
select pg_temp.as_db(null);
select is((select sender_address from public.mail_messages where thread_id = (select value from state where key = 'thread') order by created_at desc limit 1),
  'internal.affairs.bureau@sfsd.org', 'from the bureau''s address');
select pg_temp.act_as((select investigator_id from ids));
select ok(json_array_length(public.get_mail_thread((select value from state where key = 'thread')) -> 'iab_staff') >= 1,
  'the letter lists the IAB''s staff');

-- Letters from outside and to everyone (the staff) -------------------------------------------
select pg_temp.act_as((select captain_id from ids));
insert into state values ('broadcast', public.send_mail('Segítségkérés pénzszállításban', 'Tisztelt Állomány! Ma 19:45-kor kezdünk.',
  '[{"kind":"group","key":"all"}]'::jsonb, null, 'external', 'Commander Harvey Cooper', 'cmd.cooper@lspd.org'));
select pg_temp.as_db(null);
select is((select sender_address from public.mail_messages where thread_id = (select value from state where key = 'broadcast')), 'cmd.cooper@lspd.org',
  'the Command Staff records an outside letter to everyone');
select pg_temp.act_as((select captain_id from ids));
select throws_ok($$select public.send_mail('x', 'y', '[{"kind":"group","key":"all"}]'::jsonb, null, 'external', 'Fake', 'x@sfsd.org')$$, 'P0001', null,
  'an outside sender cannot use an @sfsd.org address');
select pg_temp.act_as((select deputy_id from ids));
select ok(exists (select 1 from json_array_elements(public.get_mailbox('all')) t where (t ->> 'id')::uuid = (select value from state where key = 'broadcast')),
  'everyone reads a letter to all@');
select is((public.get_mail_thread((select value from state where key = 'broadcast')) ->> 'can_reply')::boolean, false, 'but only its sender and the staff answer it');
select pg_temp.as_db(null);
select ok((select count(*) from public.notifications where category = 'mail' and dedupe_key = 'mail:' || (select value from state where key = 'broadcast')) >= 5,
  'everyone is notified');

-- An investigation -------------------------------------------------------------------------
select pg_temp.act_as((select investigator_id from ids));
insert into state values ('case', public.save_iab_case(null, 'Laura Graves ügye', 'Bűnrészesség gyanúja', 'high', (select investigator_id from ids)));
select pg_temp.as_db(null);
select ok((select case_number from public.iab_cases where id = (select value from state where key = 'case')) ~ '^IAB-\d{4}-\d{3}$', 'it gets an IAB number');
select pg_temp.act_as((select investigator_id from ids));
select lives_ok(format('select public.set_iab_case_person(%L, %L, ''subject'')', (select value from state where key = 'case'), (select deputy_id from ids)),
  'a member is connected as the subject');
select lives_ok(format('select public.save_iab_entry(%L, null, ''memo'', ''Tájékoztatás'', ''Az IAB a vizsgálatot megkezdi.'')', (select value from state where key = 'case')),
  'a memo is written');
select lives_ok(format('select public.link_iab_mail(%L, %L)', (select value from state where key = 'case'), (select value from state where key = 'thread')),
  'the letter is linked to the investigation');
select is(json_array_length(public.get_iab_case((select value from state where key = 'case')) -> 'mail'), 1, 'the investigation shows the letter');

select pg_temp.act_as((select deputy_id from ids));
select throws_ok(format('select public.get_iab_case(%L)', (select value from state where key = 'case')), '42501', null, 'the subject never sees the investigation');
select is(json_array_length(public.get_mail_thread((select value from state where key = 'thread')) -> 'cases'), 0, 'nor the link on the letter');
select throws_ok('select public.get_iab_overview()', '42501', null, 'members outside the IAB see no investigations');

select pg_temp.act_as((select admin_id from ids));
select ok(json_array_length(public.get_iab_overview() -> 'cases') >= 1, 'the Bureau Manager sees the investigations');

select pg_temp.act_as((select investigator_id from ids));
select throws_ok(format('select public.close_iab_case(%L, ''not_sustained'', ''rövid'')', (select value from state where key = 'case')), 'P0001', null,
  'a closure needs a statement');
select lives_ok(format('select public.close_iab_case(%L, ''not_sustained'', ''A bizonyítékok nem igazolják a bűnrészességet.'')', (select value from state where key = 'case')),
  'the lead closes the investigation with the IAB''s own closure');
select throws_ok(format('select public.save_iab_entry(%L, null, ''note'', null, ''késői megjegyzés'')', (select value from state where key = 'case')), '42501', null,
  'a closed investigation takes no new entries');

-- A letter to one member: the answer goes back to its writer ----------------------------------
select pg_temp.act_as((select deputy_id from ids));
insert into state values ('direct', public.send_mail('Szolgálati beosztás', 'Szia! Csütörtökön be tudsz jönni?',
  jsonb_build_array(jsonb_build_object('kind', 'user', 'id', (select operator_id from ids)))));
select pg_temp.act_as((select operator_id from ids));
select lives_ok(format('select public.send_mail(null, ''Igen, ott leszek.'', ''[]''::jsonb, %L)', (select value from state where key = 'direct')),
  'the only recipient answers a letter written to them alone');
select pg_temp.as_db(null);
select is((select to_display from public.mail_messages where thread_id = (select value from state where key = 'direct') order by created_at desc limit 1),
  array['deputy.teszt@sfsd.org'], 'the answer is addressed to the writer');
select ok(exists (select 1 from public.notifications where user_id = (select deputy_id from ids) and dedupe_key = 'mail:' || (select value from state where key = 'direct')),
  'and the writer is told');
select pg_temp.act_as((select deputy_id from ids));
select lives_ok(format('select public.send_mail(null, ''Köszönöm!'', ''[]''::jsonb, %L)', (select value from state where key = 'direct')),
  'the writer answers again');

select * from finish();
rollback;
