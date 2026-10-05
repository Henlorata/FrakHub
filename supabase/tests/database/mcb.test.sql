-- MCB: case access, document versions, statuses, warrants, hand-over and the event log.
-- Run with: bunx supabase test db. Uses the accounts and the case from supabase/seed.sql.
begin;
select plan(49);

create temporary table ids as select
  '00000000-0000-4000-8000-000000000001'::uuid as admin_id,        -- Commander, bureau manager (MCB leadership)
  '00000000-0000-4000-8000-000000000002'::uuid as sergeant_id,     -- Sergeant I., MCB Investigator II., editor on the case
  '00000000-0000-4000-8000-000000000003'::uuid as deputy_id,       -- Deputy Sheriff II., TSB
  '00000000-0000-4000-8000-000000000005'::uuid as captain_id,      -- Captain II. (high command)
  '00000000-0000-4000-8000-000000000006'::uuid as owner_id,        -- Corporal, MCB Investigator III., owns the case
  '00000000-0000-4000-8000-000000000007'::uuid as rookie_id,       -- moved to MCB as Investigator I. below
  '30000000-0000-4000-8000-000000000001'::uuid as case_id,
  '31000000-0000-4000-8000-000000000001'::uuid as suspect_id;
grant select on ids to anon, authenticated, service_role;

create temporary table t (key text primary key, value text);
grant all on t to anon, authenticated, service_role;

create function pg_temp.act_as(_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', _id, 'role', 'authenticated')::text, true);
end $$;
create function pg_temp.act_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.j(_key text) returns json language sql as $$ select value::json from t where key = _key $$;
grant execute on function pg_temp.j(text) to authenticated, service_role;

-- An MCB member who is not on the case, and some text in its document.
select pg_temp.act_postgres();
update public.profiles set division = 'MCB', division_rank = 'Investigator I.' where id = (select rookie_id from ids);
update public.cases set body = '[{"id":"b0","type":"paragraph","props":{},"content":[{"type":"text","text":"Konténer a hármas dokkban","styles":{}}],"children":[]}]'
where id = (select case_id from ids);
insert into t values ('version', (select body_version::text from public.cases where id = (select case_id from ids)));

-- --- Other MCB members see the case in the list only ------------------------------
select pg_temp.act_as((select rookie_id from ids));
select is((select count(*) from public.cases), 1::bigint, 'MCB members see the case in the list');
insert into t values ('rookie_list', public.get_case_list()::text);
select is((pg_temp.j('rookie_list') -> 0 ->> 'can_open')::boolean, false, 'the list marks the case as not openable');
select is((pg_temp.j('rookie_list') -> 0 ->> 'people')::int, 1, 'the list carries the counts');
select throws_ok($$select public.get_case_detail((select case_id from ids))$$, '42501', null,
  'a member who is not on the case cannot open it');
select is((select count(*) from public.case_notes), 0::bigint, 'the chat is hidden from them');
select is((select count(*) from public.case_warrants), 0::bigint, 'the warrants are hidden from them');
select is((select count(*) from public.case_events), 0::bigint, 'the log is hidden from them');
select throws_ok($$insert into public.case_evidence (case_id, file_path, file_name, file_type, uploaded_by)
  values ((select case_id from ids), 'https://res.cloudinary.com/x/image/upload/a.jpg', 'a.jpg', 'image', (select rookie_id from ids))$$,
  '42501', null, 'they cannot attach evidence');
select throws_ok($$insert into public.case_suspects (case_id, suspect_id, involvement_type)
  values ((select case_id from ids), (select suspect_id from ids), 'witness')$$, '42501', null, 'they cannot link people');
select is(json_array_length(public.search_cases('Bagoly')), 1, 'the title is found');
select is(json_array_length(public.search_cases('hármas dokk')), 0, 'the document text of a closed-off case is not searched');

-- --- The owner edits the document -------------------------------------------------
select pg_temp.act_as((select owner_id from ids));
insert into t values ('detail', public.get_case_detail((select case_id from ids))::text);
select is((pg_temp.j('detail') -> 'viewer' ->> 'can_edit')::boolean, true, 'the owner may edit');
select is((pg_temp.j('detail') -> 'viewer' ->> 'can_manage')::boolean, true, 'the owner manages the case');
select is(json_array_length(public.search_cases('hármas dokk')), 1, 'participants find text in the document');
insert into t values ('save1', public.save_case_document((select case_id from ids),
  '[{"id":"b1","type":"paragraph","props":{},"content":[{"type":"text","text":"Megfigyelés: ","styles":{}},{"type":"mention","props":{"user":"1002 Supervisor Teszt","id":"00000000-0000-4000-8000-000000000002","role":"officer"}}],"children":[]}]',
  (select value::int from t where key = 'version'))::text);
select is((pg_temp.j('save1') ->> 'ok')::boolean, true, 'a save on the current version succeeds');
select is((pg_temp.j('save1') ->> 'version')::int, (select value::int + 1 from t where key = 'version'), 'the version goes up');
insert into t values ('save2', public.save_case_document((select case_id from ids), '[]', (select value::int from t where key = 'version'))::text);
select is((pg_temp.j('save2') ->> 'conflict')::boolean, true, 'a save on an old version reports a conflict');
select throws_ok($$select public.save_case_document((select case_id from ids),
  '[{"type":"image","props":{"url":"data:image/png;base64,AAAA"}}]', (pg_temp.j('save1') ->> 'version')::int)$$,
  '22023', null, 'embedded images are refused');
insert into t values ('updated', public.update_case((select case_id from ids), '{"priority": "critical", "category": "weapons"}')::text);
select is(pg_temp.j('updated') ->> 'category', 'weapons', 'the category is set');
select throws_ok($$select public.update_case((select case_id from ids), '{"category": "parking"}')$$, '22023', null,
  'unknown categories are refused');
select throws_ok($$select public.decide_warrant((select id from public.case_warrants limit 1), 'approved')$$, '42501', null,
  'nobody approves their own warrant request');

-- --- Warrants ------------------------------------------------------------------------
select pg_temp.act_as((select sergeant_id from ids));
select is((public.decide_warrant((select id from public.case_warrants limit 1), 'approved', 'Megalapozott.')) ->> 'status',
  'approved', 'an approver decides the request');
select pg_temp.act_postgres();
select is((select status from public.suspects where id = (select suspect_id from ids)), 'wanted', 'the person becomes wanted');
select pg_temp.act_as((select owner_id from ids));
select is((public.decide_warrant((select id from public.case_warrants limit 1), 'executed', 'Elfogva a dokknál.')) ->> 'status',
  'executed', 'the case editors record the execution');
select pg_temp.act_postgres();
select is((select status from public.suspects where id = (select suspect_id from ids)), 'jailed', 'the arrested person is jailed');
select ok(exists (select 1 from public.notifications where user_id = (select sergeant_id from ids) and title = 'Megemlítettek egy aktában'),
  'newly mentioned members are notified');

-- A request nobody decided ends with the case.
select pg_temp.act_as((select owner_id from ids));
insert into public.case_warrants (case_id, suspect_id, type, reason, requested_by)
values ((select case_id from ids), (select suspect_id from ids), 'search', 'Raktár átvizsgálása', (select owner_id from ids));

-- --- Status --------------------------------------------------------------------------
select pg_temp.act_as((select sergeant_id from ids));
select throws_ok($$select public.set_case_status((select case_id from ids), 'closed')$$, '42501', null,
  'editors do not close the case');
select pg_temp.act_as((select owner_id from ids));
select is((public.set_case_status((select case_id from ids), 'closed')) ->> 'expired_warrants', '1', 'closing ends the open request');
select pg_temp.act_postgres();
select ok((select closed_at is not null from public.cases where id = (select case_id from ids)), 'the closing time is stored');
select pg_temp.act_as((select owner_id from ids));
select throws_ok($$select public.save_case_document((select case_id from ids), '[]', 99)$$, '22023', null,
  'a closed case cannot be edited');
select throws_ok($$insert into public.case_notes (case_id, user_id, content) values ((select case_id from ids), (select owner_id from ids), 'x')$$,
  '42501', null, 'the chat of a closed case is read-only');
select throws_ok($$select public.set_case_status((select case_id from ids), 'archived')$$, '42501', null,
  'only the leadership archives');

select pg_temp.act_as((select admin_id from ids));
select is((public.set_case_status((select case_id from ids), 'archived')) ->> 'status', 'archived', 'the leadership archives');
select is(json_array_length(public.get_case_list()), 0, 'archived cases stay out of the default list');
select is(json_array_length(public.get_case_list(true)), 1, 'and appear on request');
select is((public.set_case_status((select case_id from ids), 'open')) ->> 'status', 'open', 'the leadership restores a case');

-- --- Hand-over ------------------------------------------------------------------------
select is((public.transfer_case((select case_id from ids), (select sergeant_id from ids))) ->> 'owner_id',
  (select sergeant_id::text from ids), 'the leadership hands the case over');
select pg_temp.act_postgres();
select is((select role from public.case_collaborators where case_id = (select case_id from ids) and user_id = (select owner_id from ids)),
  'editor', 'the previous owner stays on the case as an editor');
select ok(not exists (select 1 from public.case_collaborators where case_id = (select case_id from ids) and user_id = (select sergeant_id from ids)),
  'the new owner is no longer listed as a collaborator');
select ok(not exists (select 1 from public.notifications where user_id = (select sergeant_id from ids) and title = 'Eltávolítottak egy aktából'),
  'the new owner is not told they were removed');
select ok(exists (select 1 from public.notifications where user_id = (select sergeant_id from ids) and title = 'Akta hozzád rendelve'),
  'the new owner is notified');
select pg_temp.act_as((select owner_id from ids));
with left_case as (
  delete from public.case_collaborators where case_id = (select case_id from ids) and user_id = (select owner_id from ids) returning 1)
select is((select count(*) from left_case), 1::bigint, 'a collaborator may leave a case');

-- --- Other roles ----------------------------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
select is(json_array_length(public.get_case_list()), 0, 'field deputies get an empty case list');
select throws_ok($$select public.get_mcb_overview()$$, '42501', null, 'field deputies have no bureau overview');
select pg_temp.act_as((select captain_id from ids));
select is((public.get_case_detail((select case_id from ids))) -> 'case' ->> 'category', 'weapons', 'high command opens any case');
select ok((public.get_mcb_overview()) -> 'totals' ->> 'open' = '1', 'the overview counts the cases');

-- --- Person file -------------------------------------------------------------------
select pg_temp.act_as((select rookie_id from ids));
insert into t values ('dossier_rookie', public.get_suspect_dossier((select suspect_id from ids))::text);
select is(json_array_length(pg_temp.j('dossier_rookie') -> 'cases'), 1, 'the file lists the cases of the person');
select is(json_array_length(pg_temp.j('dossier_rookie') -> 'warrants'), 0, 'but not the warrants of cases closed to the reader');

-- --- Event log -----------------------------------------------------------------------
select pg_temp.act_postgres();
select is((select array_agg(distinct kind order by kind) from public.case_events where case_id = (select case_id from ids)),
  array['category', 'collaborator_added', 'collaborator_removed', 'created', 'document', 'owner', 'person_linked', 'priority',
        'status', 'warrant_requested', 'warrant_status'],
  'the log records the life of the case');

select * from finish();
rollback;
