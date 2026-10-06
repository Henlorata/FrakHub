-- Case tasks, the custody trail of seized items, warrant validity and renewal, the informant
-- register, cross-case suggestions and the daily MCB job. Run with: bunx supabase test db
begin;
select plan(36);

create temporary table ids as select
  '00000000-0000-4000-8000-000000000001'::uuid as admin_id,        -- Commander, bureau manager (MCB lead)
  '00000000-0000-4000-8000-000000000002'::uuid as supervisor_id,   -- Sergeant I., MCB, editor of the seeded case
  '00000000-0000-4000-8000-000000000003'::uuid as deputy_id,       -- Deputy Sheriff II., TSB (outside the case)
  '00000000-0000-4000-8000-000000000006'::uuid as investigator_id, -- Corporal, MCB, owner of the case, handler of "Holló"
  '30000000-0000-4000-8000-000000000001'::uuid as case_id,
  '32000000-0000-4000-8000-000000000001'::uuid as item_id,
  '31000000-0000-4000-8000-000000000001'::uuid as suspect_id;
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

-- Tasks --------------------------------------------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
select throws_ok(format('select public.save_case_task(%L, null, %L, null, null)', (select case_id from ids), 'Idegen teendő'),
  '42501', null, 'members outside the case cannot add tasks');
select pg_temp.act_as((select investigator_id from ids));
select throws_ok(format('select public.save_case_task(%L, null, %L, %L, null)', (select case_id from ids), 'Kihallgatás', (select deputy_id from ids)),
  '22023', null, 'a task goes only to someone who can open the case');
insert into t select 'task', public.save_case_task((select case_id from ids), null, 'Kihallgatás a dokknál', (select supervisor_id from ids),
                                                   current_date + 1)::text;
select is(pg_temp.j('task') ->> 'title', 'Kihallgatás a dokknál', 'the case editors add a task');
select pg_temp.reset_role();
select is((select count(*)::int from public.notifications n, ids where n.user_id = ids.supervisor_id and n.title = 'Új teendőd egy aktában'), 1,
  'the assignee is notified');
select is((select count(*)::int from public.case_events e, ids where e.case_id = ids.case_id and e.kind = 'task_added'), 1,
  'the case log records the task');
select pg_temp.act_as((select deputy_id from ids));
select throws_ok(format('select public.set_case_task_done(%L, true)', pg_temp.j('task') ->> 'id'), 'P0002', null,
  'outsiders do not even see the task');
select pg_temp.act_as((select supervisor_id from ids));
select ok(public.set_case_task_done((pg_temp.j('task') ->> 'id')::uuid, true) ->> 'done_at' is not null, 'the assignee marks it done');
select is((select count(*)::int from json_array_elements(public.get_my_case_tasks()) x where (x ->> 'overdue')::boolean), 1,
  'my tasks list the overdue one (seeded)');
select is((public.get_dashboard_summary() -> 'my_case_tasks' ->> 'overdue')::int, 1, 'the dashboard counts the overdue task');

-- Items and custody ----------------------------------------------------------------------------
select pg_temp.act_as((select investigator_id from ids));
insert into t select 'item', public.save_case_item((select case_id from ids), null,
                                                   '{"label": "Mobiltelefon", "quantity": "1 db", "location": "Downtown, B-14"}')::text;
select is(pg_temp.j('item') ->> 'status', 'held', 'a new item is held');
select is(pg_temp.j('item') -> 'events' -> 0 ->> 'action', 'seized', 'the trail starts with the seizure');
select throws_ok(format('select public.record_case_item(%L, %L, null, null, null, null)', (select item_id from ids), 'moved'),
  '22023', null, 'moving needs the new place');
select throws_ok(format('select public.record_case_item(%L, %L, null, null, null, null)', (select item_id from ids), 'checked_in'),
  '22023', null, 'only an item handed out can be checked in');
select is(public.record_case_item((select item_id from ids), 'checked_out', null, null, 'Labor – Dr. Kovács', 'Ujjlenyomat-vizsgálat') ->> 'status',
  'checked_out', 'an item is handed out to someone');
select throws_ok(format('select public.record_case_item(%L, %L, null, null, %L, null)', (select item_id from ids), 'checked_out', 'Más'),
  '22023', null, 'a handed out item cannot be handed out again');
select is(public.record_case_item((select item_id from ids), 'checked_in', 'Downtown, B-12', null, null, null) ->> 'status', 'held',
  'it comes back into custody');
select is(public.record_case_item((select item_id from ids), 'destroyed', null, null, null, 'Bírósági végzés alapján') ->> 'status', 'destroyed',
  'it is destroyed');
select throws_ok(format('select public.record_case_item(%L, %L, %L, null, null, null)', (select item_id from ids), 'moved', 'Raktár'),
  '22023', null, 'a destroyed item has no custody');
select is((select json_array_length(x -> 'events') from json_array_elements(public.get_case_detail((select case_id from ids)) -> 'items') x
           where (x ->> 'id')::uuid = (select item_id from ids)), 5, 'the trail keeps every step');
select pg_temp.act_as((select supervisor_id from ids));
select throws_ok(format('select public.delete_case_item(%L)', pg_temp.j('item') ->> 'id'), '42501', null,
  'only the recorder or the case owner deletes an item');

-- Warrant validity and renewal ------------------------------------------------------------------
select throws_ok($$select public.save_mcb_settings(10, 5, 1)$$, '42501', null, 'investigators cannot change the validity');
select pg_temp.act_as((select admin_id from ids));
select is((public.save_mcb_settings(10, 5, 1) ->> 'arrest_days')::int, 10, 'the MCB leadership sets the validity');
select pg_temp.act_as((select supervisor_id from ids));
insert into t select 'warrant', public.decide_warrant((select id from public.case_warrants limit 1), 'approved', 'Megalapozott.')::text;
select ok((pg_temp.j('warrant') ->> 'expires_at')::timestamptz between now() + interval '9 days 23 hours' and now() + interval '10 days 1 hour',
  'an approval starts the validity');
select pg_temp.act_as((select investigator_id from ids));
select ok(public.request_warrant_renewal((pg_temp.j('warrant') ->> 'id')::uuid, 'A gyanúsított még szökésben.') ->> 'renewal_requested_at' is not null,
  'the case editors ask for a renewal');
select throws_ok(format('select public.request_warrant_renewal(%L, null)', pg_temp.j('warrant') ->> 'id'), '22023', null,
  'one open renewal request at a time');
select throws_ok(format('select public.renew_warrant(%L, null)', pg_temp.j('warrant') ->> 'id'), '42501', null,
  'nobody approves their own renewal request');
select pg_temp.act_as((select supervisor_id from ids));
insert into t select 'renewed', public.renew_warrant((pg_temp.j('warrant') ->> 'id')::uuid, null)::text;
select is((pg_temp.j('renewed') ->> 'renewals')::int, 1, 'another approver renews it');
select ok((pg_temp.j('renewed') ->> 'expires_at')::timestamptz > (pg_temp.j('warrant') ->> 'expires_at')::timestamptz,
  'the renewal extends the validity');

-- The daily job lapses expired warrants and sends the overdue digest once.
select pg_temp.reset_role();
update public.case_warrants set expires_at = now() - interval '1 minute' where id = (pg_temp.j('warrant') ->> 'id')::uuid;
insert into t select 'daily', public.mcb_daily()::text;
select is((pg_temp.j('daily') ->> 'lapsed')::int, 1, 'the daily job lapses the warrant');
select is((select status from public.case_warrants where id = (pg_temp.j('warrant') ->> 'id')::uuid), 'expired', 'the warrant is expired');
select is((public.mcb_daily() ->> 'task_digests')::int, 0, 'the overdue digest is not repeated the next run');

-- Informants -----------------------------------------------------------------------------------
select pg_temp.act_as((select supervisor_id from ids));
select is(json_array_length(public.get_informants() -> 'informants'), 0, 'investigators see no informants of others');
select pg_temp.act_as((select investigator_id from ids));
select is(public.get_informants() -> 'informants' -> 0 ->> 'codename', 'Holló', 'the handler sees their informant');
select throws_ok($$select public.save_informant(null, '{"codename": "Bagoly", "reliability": 3}')$$, '42501', null,
  'handlers cannot register new informants');
select pg_temp.act_as((select admin_id from ids));
select throws_ok($$select public.save_informant(null, '{"codename": "Holló", "reliability": 3}')$$, '23505', null,
  'codenames are unique');

-- Cross-case suggestions -----------------------------------------------------------------------
select pg_temp.reset_role();
insert into public.cases (id, title, priority, status, owner_id, body)
values ('30000000-0000-4000-8000-000000000099', 'Kikötői rablás', 'medium', 'open', '00000000-0000-4000-8000-000000000002', '[]');
insert into public.case_suspects (case_id, suspect_id, involvement_type)
values ('30000000-0000-4000-8000-000000000099', (select suspect_id from ids), 'suspect');
select pg_temp.act_as((select investigator_id from ids));
select is((public.get_case_detail((select case_id from ids)) -> 'suggestions' -> 0 ->> 'id')::uuid,
  '30000000-0000-4000-8000-000000000099'::uuid, 'a case with the same person is suggested');

select * from finish();
rollback;
