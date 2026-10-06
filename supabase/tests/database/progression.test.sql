-- Promotion criteria, the eligibility board, nominations, the trainee week (mentors, notes,
-- sign-off), the activity watch, the workload and the recruitment funnel.
-- Run with: bunx supabase test db
begin;
select plan(41);

create temporary table ids as select
  '00000000-0000-4000-8000-000000000001'::uuid as admin_id,        -- Commander
  '00000000-0000-4000-8000-000000000002'::uuid as supervisor_id,   -- Sergeant I. (staff)
  '00000000-0000-4000-8000-000000000003'::uuid as deputy_id,       -- Deputy Sheriff II. (seeded nomination)
  '00000000-0000-4000-8000-000000000005'::uuid as captain_id,      -- Captain II. (high command)
  '00000000-0000-4000-8000-000000000006'::uuid as investigator_id, -- Corporal (not staff)
  '00000000-0000-4000-8000-000000000007'::uuid as operator_id,     -- Senior Deputy Sheriff, the trainee's mentor
  '00000000-0000-4000-8000-000000000008'::uuid as trainee_id,
  (date_trunc('month', now() at time zone 'Europe/Budapest') - interval '1 month')::date as m1;
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

-- Criteria -----------------------------------------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
select ok((select count(*) from public.promotion_criteria) > 0, 'members read the promotion criteria');
select throws_ok($$select public.save_promotion_criteria('Deputy Sheriff III.', '{"min_reports": 3}')$$, '42501', null,
  'members cannot change the criteria');
select pg_temp.act_as((select supervisor_id from ids));
select throws_ok($$select public.save_promotion_criteria('Deputy Sheriff III.', '{"min_reports": 3}')$$, '42501', null,
  'supervisors cannot change the criteria');
select pg_temp.act_as((select admin_id from ids));
select is((public.save_promotion_criteria('Deputy Sheriff III.', '{"min_reports": 3, "max_warnings": 1}') ->> 'min_reports')::int, 3,
  'the executive staff sets the criteria');

-- Board --------------------------------------------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
select throws_ok($$select public.get_promotion_board()$$, '42501', null, 'members cannot open the eligibility board');
select pg_temp.act_as((select supervisor_id from ids));
insert into t select 'board', public.get_promotion_board()::text;
select is((select m ->> 'next_rank' from json_array_elements(pg_temp.j('board') -> 'members') m
           where (m ->> 'user_id')::uuid = (select deputy_id from ids)), 'Deputy Sheriff III.', 'the board shows the next rank');
select is((select c ->> 'ok' from json_array_elements(pg_temp.j('board') -> 'members') m, json_array_elements(m -> 'checks') c
           where (m ->> 'user_id')::uuid = (select deputy_id from ids) and c ->> 'key' = 'warnings'), 'true',
  'the changed warning limit is applied at once');
select ok((select m -> 'nomination' is not null from json_array_elements(pg_temp.j('board') -> 'members') m
           where (m ->> 'user_id')::uuid = (select deputy_id from ids)), 'a pending nomination is shown on the member');
select ok(not exists (select 1 from json_array_elements(pg_temp.j('board') -> 'members') m
                      where m ->> 'faction_rank' = 'Deputy Sheriff Trainee'), 'trainees are tracked on their own tab');

-- Nominations --------------------------------------------------------------------------------
select throws_ok(format('select public.nominate_for_promotion(%L, %L)', (select supervisor_id from ids), 'Kiváló munka, megérdemli.'),
  '22023', null, 'nobody nominates themselves');
select throws_ok(format('select public.nominate_for_promotion(%L, %L)', (select captain_id from ids), 'Kiváló munka, megérdemli.'),
  '42501', null, 'only members of a lower rank can be nominated');
select throws_ok(format('select public.nominate_for_promotion(%L, %L)', (select deputy_id from ids), 'Még egy javaslat neki.'),
  '23505', null, 'one pending nomination per member');
select throws_ok(format('select public.nominate_for_promotion(%L, %L)', (select operator_id from ids), 'rövid'),
  '22023', null, 'a nomination needs a reason');
insert into t select 'nominated', public.nominate_for_promotion((select operator_id from ids), 'Rendszeresen segíti a Trainee-ket.')::text;
select is(pg_temp.j('nominated') ->> 'to_rank', 'Staff Deputy Sheriff', 'the nomination targets the next rank');
select throws_ok(format('select public.decide_promotion_nomination(%L, %L, null)', pg_temp.j('nominated') ->> 'id', 'approved'),
  '22023', null, 'approval happens through the promotion itself');
select throws_ok(format('select public.decide_promotion_nomination(%L, %L, %L)', pg_temp.j('nominated') ->> 'id', 'rejected', 'Korai.'),
  '42501', null, 'the nominator cannot reject when the decision belongs to the command');
select is(public.decide_promotion_nomination((pg_temp.j('nominated') ->> 'id')::uuid, 'withdrawn', null) ->> 'status', 'withdrawn',
  'the nominator withdraws the nomination');

insert into t select 'second', public.nominate_for_promotion((select operator_id from ids), 'Másodszor is javaslom, sokat fejlődött.')::text;
select pg_temp.act_as((select captain_id from ids));
select throws_ok(format('select public.decide_promotion_nomination(%L, %L, null)', pg_temp.j('second') ->> 'id', 'rejected'),
  '22023', null, 'a rejection needs a reason');
select is(public.decide_promotion_nomination((pg_temp.j('second') ->> 'id')::uuid, 'rejected', 'Még várjunk egy hónapot.') ->> 'status',
  'rejected', 'the command rejects a nomination');
select pg_temp.reset_role();
select is((select count(*)::int from public.notifications n, ids
           where n.user_id = ids.supervisor_id and n.title = 'Előléptetési javaslat elutasítva'), 1, 'the nominator hears about the rejection');

-- The promotion closes the nomination; an undo right after reopens it.
select set_config('app.actor_id', (select captain_id::text from ids), true);
update public.profiles set faction_rank = 'Deputy Sheriff III.' where id = (select deputy_id from ids);
select is((select status || '/' || (decided_by = (select captain_id from ids))::text from public.promotion_nominations n, ids
           where n.user_id = ids.deputy_id order by created_at desc limit 1), 'approved/true', 'the promotion approves the nomination');
select is((select count(*)::int from public.notifications n, ids
           where n.user_id = ids.supervisor_id and n.title = 'Elfogadták a javaslatodat'), 1, 'the nominator hears about the promotion');
update public.profiles set faction_rank = 'Deputy Sheriff II.' where id = (select deputy_id from ids);
select is((select status from public.promotion_nominations n, ids where n.user_id = ids.deputy_id order by created_at desc limit 1),
  'pending', 'undoing the promotion puts the nomination back');
select set_config('app.actor_id', '', true);

-- Trainees -----------------------------------------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
select is(json_array_length(public.get_trainees()), 0, 'members who coach nobody see no trainees');
select throws_ok(format('select public.assign_trainee_mentor(%L, %L)', (select trainee_id from ids), (select deputy_id from ids)),
  '42501', null, 'members cannot assign mentors');
select pg_temp.act_as((select operator_id from ids));
select is((public.get_trainees() -> 0 ->> 'is_mentor')::boolean, true, 'the mentor sees their trainee');
select pg_temp.act_as((select trainee_id from ids));
select ok(coalesce(public.get_trainees() -> 0 ->> 'notes', '[]') = '[]', 'the trainee sees their checklist but not the notes');

select pg_temp.act_as((select supervisor_id from ids));
select throws_ok(format('select public.assign_trainee_mentor(%L, %L)', (select trainee_id from ids), (select trainee_id from ids)),
  '22023', null, 'a trainee cannot be a mentor');
select lives_ok(format('select public.assign_trainee_mentor(%L, %L)', (select trainee_id from ids), (select deputy_id from ids)),
  'the staff assigns a mentor');
select pg_temp.act_as((select investigator_id from ids));
select throws_ok(format('select public.add_trainee_note(%L, %L)', (select trainee_id from ids), 'Idegen megjegyzés.'),
  '42501', null, 'only the mentor and the coaches write notes');
select pg_temp.act_as((select deputy_id from ids));
select lives_ok(format('select public.add_trainee_note(%L, %L)', (select trainee_id from ids), 'Jól ment a második járőr.'),
  'the new mentor writes a note');
select ok(public.sign_off_trainee((select trainee_id from ids), true, 'Kész az előléptetésre.') ->> 'signed_off_at' is not null,
  'the mentor signs the trainee off');
select pg_temp.act_as((select supervisor_id from ids));
select is((public.get_dashboard_summary() ->> 'trainees_ready')::int, 1, 'the dashboard counts the trainees ready for promotion');
select pg_temp.reset_role();
update public.profiles set faction_rank = 'Deputy Sheriff I.' where id = (select trainee_id from ids);
select ok((select completed_at is not null from public.trainee_mentors where trainee_id = (select trainee_id from ids)),
  'the promotion closes the trainee week');

-- Activity watch -----------------------------------------------------------------------------
update public.duty_time_entries set minutes = 100 where user_id = (select deputy_id from ids) and month = (select m1 from ids);
select pg_temp.act_as((select deputy_id from ids));
select throws_ok($$select public.get_activity_watch()$$, '42501', null, 'members cannot open the activity watch');
select pg_temp.act_as((select supervisor_id from ids));
select ok(exists (select 1 from json_array_elements(public.get_activity_watch() -> 'members') m
                  where (m ->> 'user_id')::uuid = (select deputy_id from ids)), 'low recorded duty time is flagged');
select pg_temp.reset_role();
insert into public.hr_records (user_id, kind, title, starts_on, ends_on, status, created_by)
select deputy_id, 'leave', 'Vizsgaidőszak', m1 + 5, m1 + 12, 'active', deputy_id from ids;
select pg_temp.act_as((select supervisor_id from ids));
select ok(not exists (select 1 from json_array_elements(public.get_activity_watch() -> 'members') m
                      where (m ->> 'user_id')::uuid = (select deputy_id from ids)), 'approved leave in the month excuses it');
select pg_temp.reset_role();
delete from public.hr_records where title = 'Vizsgaidőszak';
select pg_temp.act_as((select supervisor_id from ids));
select lives_ok(format('select public.send_activity_reminder(%L, null)', (select deputy_id from ids)), 'a superior sends a reminder');
select throws_ok(format('select public.send_activity_reminder(%L, null)', (select deputy_id from ids)), '22023', null,
  'one reminder per month');

-- Workload and funnel ------------------------------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
select throws_ok($$select public.get_workload()$$, '42501', null, 'members cannot open the workload');
select pg_temp.act_as((select supervisor_id from ids));
select is(json_array_length(public.get_recruitment_funnel(6)), 6, 'the funnel has one row per month');

select * from finish();
rollback;
