-- Fleet tests: key holders and their rules, bureau leaders, registration renewals (OCR
-- reading, review with a screenshot, manual changes), grouped vehicle warnings, approved
-- vehicle requests and reminders. Run with: bunx supabase test db
begin;
select plan(69);

create temporary table ids as select
  '00000000-0000-4000-8000-000000000001'::uuid as admin_id,
  '00000000-0000-4000-8000-000000000002'::uuid as sergeant_id,
  '00000000-0000-4000-8000-000000000003'::uuid as deputy_id,
  '00000000-0000-4000-8000-000000000005'::uuid as captain_id,
  '00000000-0000-4000-8000-000000000006'::uuid as investigator_id,
  '00000000-0000-4000-8000-000000000007'::uuid as operator_id,
  '00000000-0000-4000-8000-000000000008'::uuid as trainee_id,
  (select id from public.fleet_vehicles where plate = 'SFSD-015') as free_explorer,
  (select id from public.fleet_vehicles where plate = 'SFSD-012') as full_explorer,
  (select id from public.fleet_vehicles where plate = 'SFSD-064') as yukon,
  (select id from public.fleet_vehicles where plate = 'SEB-001') as seb_car,
  (select id from public.fleet_vehicles where plate = 'OKI-226') as mcb_car,
  (select id from public.fleet_vehicles where plate = 'OXP-579') as mcb_fab_car,
  (select id from public.fleet_vehicles where plate = 'MEDIC-02') as ambulance,
  (select id from public.fleet_vehicles where plate = 'MEDIC-04') as free_ambulance,
  (select id from public.fleet_vehicles where plate = 'MEDIC-06') as reminder_ambulance,
  (select id from public.fleet_vehicles where plate = 'SFSD-301') as tow_truck,
  (select id from public.fleet_vehicles where plate = 'RZB-060') as boat;
grant select on ids to anon, authenticated, service_role;

create temporary table paths as select
  (select deputy_id || '_' || tow_truck || '_first.webp' from ids) as first_path,
  (select deputy_id || '_' || tow_truck || '_second.webp' from ids) as second_path,
  (select deputy_id || '_' || full_explorer || '_third.webp' from ids) as third_path;
grant select on paths to anon, authenticated, service_role;
create temporary table requests (name text primary key, id uuid);
grant select, insert on requests to authenticated;
create temporary table batches as select gen_random_uuid() as big, gen_random_uuid() as later, gen_random_uuid() as grave;
grant select on batches to authenticated;

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
create function pg_temp.act_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.notified(_user uuid, _title text) returns bigint language sql as $$
  select count(*) from public.notifications where user_id = _user and title = _title
$$;

select pg_temp.act_postgres();
delete from public.notifications;
delete from public.fleet_registration_requests;

-- --- Anonymous visitors -----------------------------------------------------
select pg_temp.act_anon();
select throws_ok($$select count(*) from public.fleet_assignments$$, '42501', null, 'anon cannot read the key holders');
select throws_ok($$select count(*) from public.fleet_registration_requests$$, '42501', null, 'anon cannot read renewals');
select throws_ok($$select public.fleet_registration_apply(gen_random_uuid(), current_date + 30, 'x', 'y')$$, '42501', null,
  'anon cannot renew registrations');

-- --- Members see the stock ----------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
select is((select count(*) from public.fleet_categories), 15::bigint, 'members see the categories of the sheet');
select ok((select count(*) from public.fleet_vehicles) >= 129, 'members see the vehicle stock');

-- --- Key holders --------------------------------------------------------------
select throws_ok($$insert into public.fleet_assignments (vehicle_id, user_id)
                   select free_explorer, deputy_id from ids$$, '42501', null, 'members cannot hand out keys');

select pg_temp.act_as((select sergeant_id from ids));
select lives_ok($$insert into public.fleet_assignments (vehicle_id, user_id) select free_explorer, trainee_id from ids$$,
  'staff hand out keys');
select pg_temp.act_postgres();
select is(pg_temp.notified((select trainee_id from ids), 'Jármű hozzád rendelve'), 1::bigint, 'the new key holder is notified');

select pg_temp.act_as((select sergeant_id from ids));
select throws_ok($$insert into public.fleet_assignments (vehicle_id, user_id) select full_explorer, captain_id from ids$$,
  '23514', null, 'a vehicle never gets more key holders than keys');
select throws_ok($$insert into public.fleet_assignments (vehicle_id, user_id) select yukon, deputy_id from ids$$,
  '42501', null, 'supervisory vehicles need the rank');
select lives_ok($$insert into public.fleet_assignments (vehicle_id, user_id) select yukon, sergeant_id from ids$$,
  'supervisory staff may hold supervisory vehicles');
select throws_ok($$insert into public.fleet_assignments (vehicle_id, user_id) select seb_car, deputy_id from ids$$,
  '42501', null, 'bureau vehicles go to bureau members only');
select lives_ok($$insert into public.fleet_assignments (vehicle_id, user_id) select seb_car, operator_id from ids$$,
  'SEB members hold SEB vehicles');
select lives_ok($$insert into public.fleet_assignments (vehicle_id, user_id) select mcb_fab_car, captain_id from ids$$,
  'a vehicle can allow other units (FAB on an MCB vehicle)');
select throws_ok($$insert into public.fleet_assignments (vehicle_id, user_id) select mcb_fab_car, deputy_id from ids$$,
  '42501', null, 'but not everybody');
select throws_ok($$insert into public.fleet_assignments (vehicle_id, user_id) select ambulance, operator_id from ids$$,
  '23514', null, 'shared pool vehicles have no personal keys');
select lives_ok($$insert into public.fleet_assignments (vehicle_id, user_id)
                  select tow_truck, x from ids, unnest(array[deputy_id, trainee_id, captain_id]) x$$,
  'vehicles without a key limit take any number of holders');
select is((select count(*) from public.fleet_assignments where vehicle_id = (select tow_truck from ids)), 3::bigint,
  'all of them hold a key');

-- --- Bureau leaders manage the vehicles of their bureau ---------------------------
select pg_temp.act_postgres();
update public.profiles set is_bureau_commander = true where id = (select investigator_id from ids);
select pg_temp.act_as((select investigator_id from ids));
delete from public.fleet_assignments where vehicle_id = (select mcb_fab_car from ids) and user_id = (select captain_id from ids);
select pg_temp.act_postgres();
select is((select count(*) from public.fleet_assignments
           where vehicle_id = (select mcb_fab_car from ids) and user_id = (select captain_id from ids)), 0::bigint,
  'bureau leaders take back keys of their bureau''s vehicles');
select pg_temp.act_as((select investigator_id from ids));
select lives_ok($$insert into public.fleet_assignments (vehicle_id, user_id) select mcb_car, sergeant_id from ids$$,
  'bureau leaders hand out keys of their bureau''s vehicles');
select throws_ok($$insert into public.fleet_assignments (vehicle_id, user_id) select free_explorer, sergeant_id from ids$$,
  '42501', null, 'bureau leaders cannot hand out other vehicles');
delete from public.fleet_assignments where vehicle_id = (select free_explorer from ids);
select pg_temp.act_postgres();
select is((select count(*) from public.fleet_assignments where vehicle_id = (select free_explorer from ids)), 1::bigint,
  'bureau leaders cannot take back keys of other vehicles');
update public.fleet_vehicles set capacity = 1 where id = (select ambulance from ids);
select pg_temp.act_as((select operator_id from ids));
select lives_ok($$insert into public.fleet_assignments (vehicle_id, user_id) select ambulance, operator_id from ids$$,
  'unit leaders manage their unit''s vehicles even below supervisory rank');

select pg_temp.act_as((select sergeant_id from ids));
delete from public.fleet_assignments where vehicle_id = (select tow_truck from ids) and user_id = (select trainee_id from ids);
select pg_temp.act_postgres();
select is(pg_temp.notified((select trainee_id from ids), 'Jármű visszavéve'), 1::bigint, 'taking back a key is announced');

-- --- Registry and dashboard -----------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
select is(json_array_length(public.get_hr_registry(null, (select deputy_id from ids)) -> 'vehicles'), 2,
  'the registry lists the vehicles a member holds a key of');
select is((public.get_dashboard_summary() ->> 'my_vehicles_due')::int, 2,
  'vehicles expiring soon or without a date are due');

-- --- Registration: the holder applies a matching reading ---------------------------
select throws_ok($$select public.fleet_registration_apply((select full_explorer from ids), current_date + 30, 'Ford Explorer', 'SFSD-013')$$,
  '22023', null, 'a reading of another plate is refused');
select lives_ok($$select public.fleet_registration_apply((select full_explorer from ids), current_date + 30, 'Ford Explorer', '-SFSD-0I2-')$$,
  'a matching reading (look-alike characters included) is applied at once');
select is((select registration_expires_on from public.fleet_vehicles where id = (select full_explorer from ids)), current_date + 30,
  'the new expiry is stored');
select throws_ok($$select public.fleet_registration_apply((select full_explorer from ids), current_date + 20, 'Ford Explorer', 'SFSD-012')$$,
  '22023', null, 'an earlier date than the stored one needs a review');
select pg_temp.act_as((select operator_id from ids));
select throws_ok($$select public.fleet_registration_apply((select full_explorer from ids), current_date + 60, 'Ford Explorer', 'SFSD-012')$$,
  '42501', null, 'only key holders renew a vehicle');
select lives_ok($$select public.fleet_registration_apply((select free_ambulance from ids), current_date + 30, 'Mercedes Sprinter', 'MEDIC-04')$$,
  'members of a unit renew its shared vehicles');
select pg_temp.act_as((select deputy_id from ids));
select throws_ok($$select public.fleet_registration_apply((select free_ambulance from ids), current_date + 31, 'Mercedes Sprinter', 'MEDIC-04')$$,
  '42501', null, 'other members cannot renew shared vehicles');
select pg_temp.act_as((select sergeant_id from ids));
insert into public.fleet_assignments (vehicle_id, user_id) select boat, deputy_id from ids;
select pg_temp.act_as((select deputy_id from ids));
select throws_ok($$select public.fleet_registration_apply((select boat from ids), current_date + 30, 'Predator', 'RZB-060')$$,
  '22023', null, 'vehicles without registration cannot be renewed');

-- --- Registration: review with the screenshot ----------------------------------------
select throws_ok($$select public.fleet_registration_submit((select tow_truck from ids), (select first_path from paths), 'not_detected')$$,
  '22023', null, 'a review needs the uploaded screenshot');
select pg_temp.act_postgres();
insert into storage.objects (bucket_id, name, owner)
select 'fleet_registrations', p, (select deputy_id from ids) from paths, unnest(array[first_path, second_path, third_path]) p;
select pg_temp.act_as((select deputy_id from ids));
select lives_ok($$insert into requests
                  select 'first', (public.fleet_registration_submit((select tow_truck from ids), (select first_path from paths),
                                   'not_detected', null, null, null, current_date + 25, 'Kérem ellenőrizni')).id$$,
  'holders send unreadable licences for review');
select pg_temp.act_postgres();
select is(pg_temp.notified((select sergeant_id from ids), 'Forgalmi ellenőrzésre vár'), 1::bigint,
  'supervisory staff are told about the review');
select pg_temp.act_as((select deputy_id from ids));
select throws_ok($$select public.fleet_registration_submit((select tow_truck from ids), (select second_path from paths), 'disputed')$$,
  '23505', null, 'one open review per vehicle');
select is((public.get_dashboard_summary() ->> 'my_vehicles_due')::int, 0,
  'vehicles waiting for a review are no longer due');
select pg_temp.act_as((select sergeant_id from ids));
select is((public.get_dashboard_summary() ->> 'fleet_registration_reviews')::int, 1, 'staff see the open reviews');
select pg_temp.act_as((select deputy_id from ids));
select throws_ok($$select public.fleet_registration_decide((select id from requests where name = 'first'), true, current_date + 25)$$,
  '42501', null, 'members cannot decide');
select pg_temp.act_as((select sergeant_id from ids));
select throws_ok($$select public.fleet_registration_decide((select id from requests where name = 'first'), false, null, ' ')$$,
  '22023', null, 'a rejection needs a reason');
select lives_ok($$select public.fleet_registration_decide((select id from requests where name = 'first'), true, current_date + 25, null, true)$$,
  'staff approve with the date they read');
select is((select registration_expires_on from public.fleet_vehicles where id = (select tow_truck from ids)), current_date + 25,
  'the approved date is stored');
select is((select status || ':' || coalesce(image_path, '-') from public.fleet_registration_requests
           where id = (select id from requests where name = 'first')), 'approved:-', 'the decision releases the screenshot');
select pg_temp.act_postgres();
select is(pg_temp.notified((select deputy_id from ids), 'Forgalmi elfogadva'), 1::bigint, 'the holder is told about the decision');

select pg_temp.act_as((select deputy_id from ids));
insert into requests
select 'third', (public.fleet_registration_submit((select full_explorer from ids), (select third_path from paths), 'disputed',
                 'Ford Explorer', 'SFSD-012', current_date + 31, current_date + 35)).id;
select is(public.fleet_registration_cancel((select id from requests where name = 'third')), (select third_path from paths),
  'submitters withdraw their review and get the screenshot to delete');
select pg_temp.act_as((select operator_id from ids));
select is((select count(*) from public.fleet_registration_requests where vehicle_id = (select tow_truck from ids)), 0::bigint,
  'members do not see the renewals of other vehicles');
select pg_temp.act_as((select deputy_id from ids));
select ok((select count(*) from public.fleet_registration_requests where vehicle_id = (select tow_truck from ids)) >= 1,
  'holders see the renewals of their vehicle');

select pg_temp.act_postgres();
update storage.objects set created_at = now() - interval '2 days' where bucket_id = 'fleet_registrations';
select is((select count(*) from json_array_elements_text(public.fleet_registration_cleanup() -> 'remove') p
           where p in (select unnest(array[first_path, second_path, third_path]) from paths)), 3::bigint,
  'screenshots nobody needs any more are listed for deletion');

-- --- Registration: manual change by staff ------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
select throws_ok($$select public.fleet_renew_registration((select free_explorer from ids), current_date + 10)$$,
  '42501', null, 'members cannot set the expiry by hand');
select pg_temp.act_as((select sergeant_id from ids));
select lives_ok($$select public.fleet_renew_registration((select free_explorer from ids), current_date - 5)$$,
  'staff set any date by hand, without a screenshot');
select is((select count(*) from public.fleet_registration_requests
           where vehicle_id = (select free_explorer from ids) and source = 'manual'), 1::bigint, 'manual changes are logged');

-- --- Vehicle warnings: several people, several points ------------------------------
select pg_temp.act_as((select deputy_id from ids));
select throws_ok($$insert into public.vehicle_warnings (user_id, reason) select trainee_id, 'Önkényes' from ids$$,
  '42501', null, 'members cannot issue vehicle warnings');
select pg_temp.act_as((select sergeant_id from ids));
select throws_ok($$insert into public.vehicle_warnings (user_id, reason) select sergeant_id, 'Önfeljelentés' from ids$$,
  '42501', null, 'nobody warns themselves');
select lives_ok($$insert into public.vehicle_warnings (vehicle_id, user_id, reason, batch_id)
                  select ids.full_explorer, x, 'Engedély nélküli használat', batches.big
                  from ids, batches, unnest(array[ids.deputy_id, ids.deputy_id, ids.trainee_id, ids.trainee_id]) x$$,
  'one decision hits several people with several points');
select pg_temp.act_postgres();
select is((select count(*) from public.hr_records
           where user_id = (select deputy_id from ids) and title = 'Figyelmeztetés: 3 jármű-hibapont'), 1::bigint,
  'three active points become a personal warning');
select is((select count(*) from public.vehicle_warnings where user_id = (select deputy_id from ids)
           and revoked_at is null and converted_record_id is null), 1::bigint, 'the fourth point stays active');
select is(pg_temp.notified((select trainee_id from ids), 'Jármű-hibapont'), 1::bigint, 'one notification per person and decision');
select ok(exists (select 1 from public.notifications where user_id = (select trainee_id from ids)
                  and title = 'Jármű-hibapont' and message like '%(2 pont)%'), 'the notification tells the points');

select pg_temp.act_as((select sergeant_id from ids));
update public.vehicle_warnings set revoked_at = now()
where batch_id = (select big from batches) and user_id = (select trainee_id from ids) and converted_record_id is null;
select pg_temp.act_postgres();
select is(pg_temp.notified((select trainee_id from ids), 'Jármű-hibapont visszavonva'), 1::bigint,
  'revoking a decision is announced once');
select pg_temp.act_as((select sergeant_id from ids));
insert into public.vehicle_warnings (user_id, reason, batch_id) select trainee_id, 'Gyorshajtás', later from ids, batches;
update public.vehicle_warnings set revoked_at = null where batch_id = (select big from batches) and user_id = (select trainee_id from ids);
select pg_temp.act_postgres();
select is((select count(*) from public.hr_records
           where user_id = (select trainee_id from ids) and title = 'Figyelmeztetés: 3 jármű-hibapont'), 1::bigint,
  'restored points count again');
select pg_temp.act_as((select sergeant_id from ids));
insert into public.vehicle_warnings (user_id, reason, batch_id)
select investigator_id, 'Súlyos baleset okozása', grave from ids, batches, generate_series(1, 3);
select pg_temp.act_postgres();
select is((select count(*) from public.hr_records
           where user_id = (select investigator_id from ids) and title = 'Figyelmeztetés: 3 jármű-hibapont'), 1::bigint,
  'a grave three-point decision is a personal warning at once');

-- --- Approved vehicle requests --------------------------------------------------------
select pg_temp.act_as((select sergeant_id from ids));
update public.vehicle_requests set status = 'approved', vehicle_plate = 'sfsd-016', processed_by = (select sergeant_id from ids)
where user_id = (select deputy_id from ids) and status = 'pending';
select ok(exists (select 1 from public.fleet_assignments a join public.fleet_vehicles v on v.id = a.vehicle_id
                  where v.plate = 'SFSD-016' and a.user_id = (select deputy_id from ids)),
  'an approved request hands out a key of the stock vehicle');
select pg_temp.act_as((select deputy_id from ids));
insert into public.vehicle_requests (user_id, vehicle_type, reason) select deputy_id, 'Granger', 'Járőrözéshez' from ids;
select pg_temp.act_as((select sergeant_id from ids));
update public.vehicle_requests set status = 'approved', vehicle_plate = 'XYZ-123', processed_by = (select sergeant_id from ids)
where user_id = (select deputy_id from ids) and status = 'pending';
select is((select v.category_id from public.fleet_vehicles v join public.fleet_assignments a on a.vehicle_id = v.id
           where v.plate = 'XYZ-123' and a.user_id = (select deputy_id from ids)), 'other',
  'an unknown plate is added to the stock with the key');

-- --- Reminders ------------------------------------------------------------------------
select pg_temp.act_postgres();
update public.fleet_vehicles set reminder_stage = 2;
update public.fleet_vehicles set registration_expires_on = current_date + 2 where id = (select full_explorer from ids);
select is(public.fleet_send_reminders(), 1, 'a registration about to expire is reminded');
select is(pg_temp.notified((select investigator_id from ids), 'Hamarosan lejár a forgalmi'), 1::bigint,
  'every key holder gets the reminder');
update public.fleet_vehicles set registration_expires_on = current_date - 1 where id = (select reminder_ambulance from ids);
select is(public.fleet_send_reminders(), 1, 'an expired shared vehicle is reminded');
select is(pg_temp.notified((select operator_id from ids), 'Lejárt a forgalmi engedély'), 1::bigint,
  'shared vehicles remind the leaders of their unit');

select * from finish();
rollback;
