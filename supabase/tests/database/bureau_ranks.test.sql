-- Bureau ranks and titles edited by the bureaus (division_ranks, division_titles).
-- Run with: bunx supabase test db
begin;
select plan(30);

create temporary table ids as select
  '00000000-0000-4000-8000-000000000001'::uuid as admin_id,        -- Commander, bureau manager
  '00000000-0000-4000-8000-000000000002'::uuid as supervisor_id,   -- Sergeant I., MCB Investigator II.
  '00000000-0000-4000-8000-000000000003'::uuid as deputy_id,       -- Deputy Sheriff II., TSB
  '00000000-0000-4000-8000-000000000004'::uuid as pending_id,      -- pending registration
  '00000000-0000-4000-8000-000000000006'::uuid as investigator_id, -- Corporal, MCB Investigator III.
  '00000000-0000-4000-8000-000000000007'::uuid as operator_id;     -- Senior Deputy Sheriff, SEB Operator II.
grant select on ids to anon, authenticated, service_role;

create function pg_temp.act_as(_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', _id, 'role', 'authenticated')::text, true);
end $$;
create function pg_temp.act_db() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- The fixed lists became data ------------------------------------------------------------
select is((select string_agg(name, ', ' order by sort_order) from public.division_ranks where division = 'SEB'),
  'Operator III., Operator II., Operator I.', 'the SEB ranks are seeded in order');
select is((select string_agg(name, ', ') from public.division_ranks where privileged), 'Investigator III.',
  'Investigator III. carries the MCB rights');
select is((select string_agg(name, ', ' order by sort_order) from public.division_titles where division = 'SEB'), 'Medic, Marksman',
  'the SEB titles are seeded');

select pg_temp.act_as((select deputy_id from ids));
select is(json_array_length(public.get_bureau_catalog() -> 'ranks'), 6, 'members read the catalogue in one call');
select pg_temp.act_as((select pending_id from ids));
select ok(public.get_bureau_catalog() is null, 'a pending registration does not');

-- Who edits which division ------------------------------------------------------------------
select pg_temp.act_as((select operator_id from ids));
select throws_ok($$select public.save_division_rank(null, 'SEB', 'Team Leader')$$, '42501', null,
  'a member who is not the bureau commander cannot add ranks');

select pg_temp.act_db();
update public.profiles set is_bureau_commander = true where id = (select operator_id from ids);

select pg_temp.act_as((select operator_id from ids));
select is(public.save_division_rank(null, 'SEB', '  Team   Leader ') ->> 'name', 'Team Leader', 'the bureau commander adds a rank (name tidied)');
select is((select sort_order from public.division_ranks where division = 'SEB' and name = 'Team Leader'), 40,
  'a new rank goes to the end of the list');
select throws_ok($$select public.save_division_rank(null, 'SEB', 'team leader')$$, 'P0001', 'Ilyen nevű rang már van az osztályon.',
  'names are unique within a division');
select throws_ok($$select public.save_division_rank(null, 'MCB', 'Analyst')$$, '42501', null, 'another division is not theirs');
select throws_ok($$select public.save_division_rank((select id from public.division_ranks where name = 'Team Leader'), 'SEB', 'Team Leader', true)$$,
  '42501', null, 'only the bureau manager sets the rights of a rank');

-- Renaming carries the name over to the members, without history entries
select lives_ok($$select public.save_division_rank((select id from public.division_ranks where division = 'SEB' and name = 'Operator II.'), 'SEB', 'Operator Specialist')$$,
  'the bureau commander renames a rank');
select is((select division_rank from public.profiles where id = (select operator_id from ids)), 'Operator Specialist',
  'the members of the renamed rank hold the new name');
select is((select count(*) from public.member_events where user_id = (select operator_id from ids) and kind = 'division_rank'), 0::bigint,
  'a rename is not a change of the member (no history entry)');

select lives_ok($$select public.reorder_division_ranks('SEB', array(
    select id from public.division_ranks where division = 'SEB' order by case when name = 'Team Leader' then 0 else 1 end, sort_order))$$,
  'the bureau commander reorders the ranks');
select is((select name from public.division_ranks where division = 'SEB' order by sort_order limit 1), 'Team Leader',
  'the new order is stored (highest first)');

-- Deleting moves the members (a real change: logged and notified)
select is(public.delete_division_rank((select id from public.division_ranks where division = 'SEB' and name = 'Operator Specialist'),
                                      (select id from public.division_ranks where division = 'SEB' and name = 'Operator I.')), 1,
  'deleting a rank moves its members to the chosen one');
select is((select division_rank from public.profiles where id = (select operator_id from ids)), 'Operator I.', 'the member holds the target rank');
select is((select count(*) from public.member_events where user_id = (select operator_id from ids) and kind = 'division_rank'), 1::bigint,
  'the move is in the member history');
select throws_ok($$select public.delete_division_rank((select id from public.division_ranks where division = 'SEB' and name = 'Operator I.'),
                                                     (select id from public.division_ranks where division = 'MCB' limit 1))$$,
  'P0001', null, 'members cannot be moved into another division''s rank');

-- The MCB rights follow the flag, not the name ------------------------------------------------
select pg_temp.act_as((select admin_id from ids));
select lives_ok($$select public.save_division_rank((select id from public.division_ranks where name = 'Investigator III.'), 'MCB', 'Lead Investigator')$$,
  'the bureau manager renames the privileged MCB rank');
select pg_temp.act_as((select investigator_id from ids));
select ok(private.sees_all_cases(), 'its holder still sees every case');
select ok(private.can_approve_warrants(), 'and still approves warrants');
select pg_temp.act_as((select supervisor_id from ids));
select is((select division_rank from public.profiles where id = (select investigator_id from ids)), 'Lead Investigator',
  'the holder''s rank carries the new name');

-- Titles -----------------------------------------------------------------------------------------
select pg_temp.act_as((select operator_id from ids));
select is(public.save_division_title(null, 'SEB', 'Breacher', 'bomb', 'orange', 'Ajtónyitás, behatolás.') ->> 'name', 'Breacher',
  'the bureau commander adds a title');

select pg_temp.act_db();
set local role service_role;
select public.hr_apply_member_update((select admin_id from ids), (select operator_id from ids),
  jsonb_build_object('division_titles', (select jsonb_agg(id) from public.division_titles where name in ('Medic', 'Breacher'))
                       || jsonb_build_array((select id from public.division_titles where name = 'Medic'))));
reset role;
select is((select array_length(division_titles, 1) from public.profiles where id = (select operator_id from ids)), 2,
  'titles are given through the HR update (duplicates dropped)');
select is((select to_value from public.member_events where user_id = (select operator_id from ids) and kind = 'division_title'),
  'Medic, Breacher', 'the titles are in the member history');

select pg_temp.act_as((select operator_id from ids));
select is(public.delete_division_title((select id from public.division_titles where name = 'Breacher')), 1,
  'deleting a title removes it from its holders');
select pg_temp.act_db();
select is((select count(*) from public.member_events where user_id = (select operator_id from ids) and kind = 'division_title'), 1::bigint,
  'removing a deleted title is not logged as a change of the member');

update public.profiles set division = 'TSB', division_rank = null where id = (select operator_id from ids);
select is((select division_titles from public.profiles where id = (select operator_id from ids)), '{}'::uuid[],
  'leaving the division drops its titles');

select * from finish();
rollback;
