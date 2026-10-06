-- Local development seed (applied by `supabase start` / `supabase db reset` only,
-- never pushed to the hosted project). Every account's password is "password123".

insert into public.system_status (id, alert_level, recruitment_open)
values ('global', 'normal', true)
on conflict (id) do nothing;

with seed_users (id, email, full_name, badge_number, faction_rank, division, division_rank, qualifications, system_role, onboarding_completed, joined) as (
  values
    ('00000000-0000-4000-8000-000000000001'::uuid, 'admin@frakhub.local', 'Admin Teszt', '1001', 'Commander', 'TSB', null, array['TB'], 'admin', true, now() - interval '400 days'),
    ('00000000-0000-4000-8000-000000000002'::uuid, 'supervisor@frakhub.local', 'Supervisor Teszt', '1002', 'Sergeant I.', 'MCB', 'Investigator II.', array['SAHP'], 'supervisor', true, now() - interval '200 days'),
    ('00000000-0000-4000-8000-000000000003'::uuid, 'user@frakhub.local', 'Deputy Teszt', '1003', 'Deputy Sheriff II.', 'TSB', null, array[]::text[], 'user', true, now() - interval '90 days'),
    ('00000000-0000-4000-8000-000000000004'::uuid, 'pending@frakhub.local', 'Pending Teszt', '1004', 'Deputy Sheriff Trainee', 'TSB', null, array[]::text[], 'pending', false, now() - interval '1 day'),
    ('00000000-0000-4000-8000-000000000005'::uuid, 'captain@frakhub.local', 'Kapitány Kata', '1005', 'Captain II.', 'TSB', null, array['FAB'], 'admin', true, now() - interval '300 days'),
    ('00000000-0000-4000-8000-000000000006'::uuid, 'investigator@frakhub.local', 'Nyomozó Nándor', '1006', 'Corporal', 'MCB', 'Investigator III.', array['GW'], 'user', true, now() - interval '150 days'),
    ('00000000-0000-4000-8000-000000000007'::uuid, 'operator@frakhub.local', 'Operátor Olga', '1007', 'Senior Deputy Sheriff', 'SEB', 'Operator II.', array['MU', 'AB'], 'user', true, now() - interval '120 days'),
    ('00000000-0000-4000-8000-000000000008'::uuid, 'trainee@frakhub.local', 'Újonc Ubul', '1008', 'Deputy Sheriff Trainee', 'TSB', null, array[]::text[], 'user', false, now() - interval '5 days')
),
inserted_users as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  select
    '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
    extensions.crypt('password123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', full_name), joined, now(),
    '', '', '', ''
  from seed_users
  returning id, email
),
inserted_identities as (
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), id, id::text, 'email',
         jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), now(), now(), now()
  from inserted_users
  returning user_id
)
insert into public.profiles (id, email, full_name, badge_number, faction_rank, division, division_rank, qualifications,
                             system_role, onboarding_completed, created_at, last_promotion_date)
select s.id, s.email, s.full_name, s.badge_number, s.faction_rank, s.division, s.division_rank, s.qualifications,
       s.system_role, s.onboarding_completed, s.joined, s.joined + interval '10 days'
from seed_users s
join inserted_users u on u.id = s.id;

-- The admin account also holds the bureau-level flags, so every feature is reachable locally.
update public.profiles
set is_bureau_commander = true, is_bureau_manager = true
where id = '00000000-0000-4000-8000-000000000001';
update public.profiles set commanded_divisions = array['MU']
where id = '00000000-0000-4000-8000-000000000007';

insert into public.ribbons (id, name, description, color_hex) values
  ('10000000-0000-4000-8000-000000000001', 'Szolgálati Érdemérem', 'Kiemelkedő szolgálatért', '#FFD700'),
  ('10000000-0000-4000-8000-000000000002', 'Bátorsági Érem', 'Életmentésért, bátor helytállásért', '#C0C0C0'),
  ('10000000-0000-4000-8000-000000000003', 'Oktatói Szalag', 'Az akadémián végzett munkáért', '#3B82F6');

insert into public.user_ribbons (user_id, ribbon_id, awarded_by) values
  ('00000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001');

-- Exams: the public recruitment exam (with an unscored question) and an SEB exam.
insert into public.exams (id, title, description, type, division, time_limit_minutes, passing_percentage, is_public, is_active, allow_sharing, created_by)
values
  ('20000000-0000-4000-8000-000000000001', 'TGF Felvételi Vizsga', 'Alapismeretek a felvételhez.', 'trainee', null, 30, 70, true, true, true, '00000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', 'SEB Alapvizsga', 'Taktikai alapismeretek.', 'division_exam', 'SEB', 20, 80, false, true, false, '00000000-0000-4000-8000-000000000001');

insert into public.exam_questions (id, exam_id, question_text, question_type, points, order_index, is_required, page_number) values
  ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Mi a Discord neved?', 'text', 0, 0, true, 1),
  ('21000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'Mit jelent a Code 3?', 'single_choice', 2, 1, true, 1),
  ('21000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'Miért szeretnél csatlakozni?', 'text', 3, 2, true, 2),
  ('21000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', 'Melyik a helyes formáció?', 'single_choice', 1, 0, true, 1);

insert into public.exam_options (id, question_id, option_text, is_correct, order_index) values
  ('22000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000002', 'Megkülönböztető jelzés használatával', true, 0),
  ('22000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000002', 'Járőrözés', false, 1),
  ('22000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-000000000004', 'Ék', true, 0),
  ('22000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-000000000004', 'Kör', false, 1);

-- Page titles and a grading guide for the recruitment exam.
insert into public.exam_pages (exam_id, page_number, title, description) values
  ('20000000-0000-4000-8000-000000000001', 1, 'Alapok', 'Néhány adat rólad, és egy kérdés a rádiózásról.'),
  ('20000000-0000-4000-8000-000000000001', 2, 'Motiváció', null);
insert into public.exam_question_guides (question_id, guide) values
  ('21000000-0000-4000-8000-000000000003', 'Teljes pont: konkrét ok (közösség, szerepjáték), legalább két mondatban.');

-- An auto-graded quiz: every attempt draws two of the three questions, in shuffled order.
insert into public.exams (id, title, description, type, division, time_limit_minutes, passing_percentage, is_public, is_active,
                          shuffle_questions, shuffle_options, auto_grade, retry_cooldown_hours, created_by)
values ('20000000-0000-4000-8000-000000000003', 'Rádiókódok gyorsteszt', 'Két kérdés a háromból, azonnali eredménnyel.',
        'other', null, 10, 50, false, true, true, true, true, 1, '00000000-0000-4000-8000-000000000001');
insert into public.exam_questions (id, exam_id, question_text, question_type, points, order_index, is_required, page_number) values
  ('21000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000003', 'Mit jelent a 10-4?', 'single_choice', 1, 0, true, 1),
  ('21000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000003', 'Mit jelent a 10-20?', 'single_choice', 1, 1, true, 1),
  ('21000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000003', 'Melyik jelent biztonságos helyzetet?', 'multiple_choice', 2, 2, true, 1);
insert into public.exam_options (id, question_id, option_text, is_correct, order_index) values
  ('22000000-0000-4000-8000-000000000005', '21000000-0000-4000-8000-000000000005', 'Vétel, értettem', true, 0),
  ('22000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-000000000005', 'Segítséget kérek', false, 1),
  ('22000000-0000-4000-8000-000000000007', '21000000-0000-4000-8000-000000000006', 'Tartózkodási hely', true, 0),
  ('22000000-0000-4000-8000-000000000008', '21000000-0000-4000-8000-000000000006', 'Ebédszünet', false, 1),
  ('22000000-0000-4000-8000-000000000009', '21000000-0000-4000-8000-000000000007', 'Code 4', true, 0),
  ('22000000-0000-4000-8000-000000000010', '21000000-0000-4000-8000-000000000007', 'Nincs további teendő', true, 1),
  ('22000000-0000-4000-8000-000000000011', '21000000-0000-4000-8000-000000000007', 'Code 3', false, 2);
insert into public.exam_pages (exam_id, page_number, title, draw_count)
values ('20000000-0000-4000-8000-000000000003', 1, 'Kódok', 2);

-- A guest sheet waiting for grading.
insert into public.exam_submissions (id, exam_id, user_id, applicant_name, start_time, end_time, status, max_score, claim_token)
values ('23000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', null, 'Vendég Viktor',
        now() - interval '2 hours', now() - interval '100 minutes', 'pending', 5, 'TR-ABCD-EFGH');
insert into public.exam_answers (submission_id, question_id, answer_text, selected_option_ids) values
  ('23000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'viktor#1234', null),
  ('23000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000002', null, array['22000000-0000-4000-8000-000000000001'::uuid]),
  ('23000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000003', 'Szeretnék segíteni a városnak.', null);

-- MCB: one case with a collaborator, chat and a pending warrant.
insert into public.cases (id, title, description, priority, status, owner_id, body)
values ('30000000-0000-4000-8000-000000000001', 'Éjszakai Bagoly', 'Fegyvercsempészet a kikötőben.', 'high', 'open',
        '00000000-0000-4000-8000-000000000006', '[]');
insert into public.case_collaborators (case_id, user_id, role)
values ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'editor');
insert into public.suspects (id, full_name, alias, status, gang_affiliation, created_by)
values ('31000000-0000-4000-8000-000000000001', 'Tony Montana', 'Scarface', 'free', 'Kikötői Banda', '00000000-0000-4000-8000-000000000006');
insert into public.case_suspects (case_id, suspect_id, involvement_type)
values ('30000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 'suspect');
insert into public.case_notes (case_id, user_id, content)
values ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000006', 'Holnap éjjel megfigyelés a 3-as dokknál.');
insert into public.case_warrants (case_id, suspect_id, type, status, reason, requested_by)
values ('30000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 'arrest', 'pending',
        'Fegyvercsempészet gyanúja', '00000000-0000-4000-8000-000000000006');

-- Logistics, HR and the dashboard.
insert into public.vehicle_requests (user_id, vehicle_type, reason, status)
values ('00000000-0000-4000-8000-000000000003', 'Buffalo STX', 'Járőrszolgálathoz', 'pending');
insert into public.hr_records (user_id, kind, title, details, status, created_by)
values ('00000000-0000-4000-8000-000000000003', 'warning', 'Késés az eligazításról', 'Harmadik alkalom ebben a hónapban.', 'active',
        '00000000-0000-4000-8000-000000000002');
insert into public.hr_records (user_id, kind, title, starts_on, ends_on, status, created_by)
values ('00000000-0000-4000-8000-000000000007', 'leave', 'Nyaralás', current_date + 2, current_date + 9, 'pending',
        '00000000-0000-4000-8000-000000000007');
-- An approved leave: shown on the roster and in the events calendar.
insert into public.hr_records (user_id, kind, title, starts_on, ends_on, status, created_by, decided_by, decided_at)
values ('00000000-0000-4000-8000-000000000006', 'leave', 'Családi program', current_date + 1, current_date + 4, 'active',
        '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000002', now() - interval '2 days');
insert into public.announcements (title, content, type, is_pinned, show_author, created_by)
values ('Új egyenruha szabályzat', 'Hétfőtől kötelező az új egyenruha viselése szolgálatban.', 'info', true, true,
        '00000000-0000-4000-8000-000000000005');

-- HR registry (old sheet columns), duty time of the last months and former members.
insert into public.member_details (user_id, station, parking_spot, joined_on, join_type, recruited_by, activity_status) values
  ('00000000-0000-4000-8000-000000000001', 'Downtown', '1/1', current_date - 900, 'new', 'Tibi', 'active'),
  ('00000000-0000-4000-8000-000000000002', 'Angel Pine', '1/9', current_date - 400, 'referral', 'Lisa', 'active'),
  ('00000000-0000-4000-8000-000000000003', 'Downtown', '2/4', current_date - 95, 'new', 'Supervisor Teszt', 'less_active'),
  ('00000000-0000-4000-8000-000000000005', 'Fort Carson', '1/2', current_date - 600, 'returned', 'Erik/Gyula', 'active'),
  ('00000000-0000-4000-8000-000000000006', 'Angel Pine', '1/7', current_date - 160, 'new', 'Döner', 'active'),
  ('00000000-0000-4000-8000-000000000007', 'Fort Carson', null, current_date - 130, 'referral', 'Zsolti', 'inactive');
insert into public.member_bank_accounts (user_id, account_number) values
  ('00000000-0000-4000-8000-000000000001', '11712345-67891234-00025871'),
  ('00000000-0000-4000-8000-000000000003', '11712345-67891234-00045159');
insert into public.duty_time_entries (user_id, month, minutes)
select p.id, date_trunc('month', current_date - make_interval(months => m))::date,
       (abs(hashtext(p.id::text || m::text)) % 7000) + 300
from public.profiles p cross join generate_series(0, 5) m
where p.system_role <> 'pending' and p.id <> '00000000-0000-4000-8000-000000000008';
insert into public.former_members (full_name, badge_number, faction_rank, division, joined_on, left_on, leave_type, reason, rehire, rehire_note) values
  ('Régi Rudolf', '0999', 'Corporal', 'TSB', current_date - 700, current_date - 120, 'resigned', 'Elköltözött a megyéből.', 'eligible', null),
  ('Kirúgott Kálmán', '1288', 'Deputy Sheriff II.', 'SEB', current_date - 300, current_date - 40, 'dismissed',
   'Ismételt szolgálati vétség, harmadik figyelmeztetés után.', 'not_eligible', 'Vezetői döntés alapján nem vehető vissza.'),
  ('Pending Teszt', '1004', 'Deputy Sheriff I.', 'TSB', current_date - 500, current_date - 200, 'inactivity', 'Három hónapig nem jelentkezett.',
   'conditional', 'Újra felvételi vizsga szükséges.');

-- Fleet (the stock comes from the import migration): keys for the test accounts, one
-- registration about to expire, one expired, and vehicle warnings.
select set_config('app.fleet_auto', '1', false);
insert into public.fleet_assignments (vehicle_id, user_id, assigned_by)
select v.id, k.user_id, '00000000-0000-4000-8000-000000000002'
from (values
  ('SFSD-012', '00000000-0000-4000-8000-000000000003'::uuid),
  ('SFSD-012', '00000000-0000-4000-8000-000000000006'::uuid),
  ('OKI-226', '00000000-0000-4000-8000-000000000006'::uuid),
  ('SEB-004', '00000000-0000-4000-8000-000000000007'::uuid),
  ('SFSD-063', '00000000-0000-4000-8000-000000000002'::uuid),
  ('SFSD-100', '00000000-0000-4000-8000-000000000001'::uuid),
  ('SFSD-302', '00000000-0000-4000-8000-000000000001'::uuid),
  ('SFSD-302', '00000000-0000-4000-8000-000000000007'::uuid)
) as k(plate, user_id)
join public.fleet_vehicles v on v.plate = k.plate;
select set_config('app.fleet_auto', '', false);
update public.fleet_vehicles set registration_expires_on = current_date + 2 where plate = 'SFSD-012';
update public.fleet_vehicles set registration_expires_on = current_date - 3 where plate = 'OKI-226';
update public.fleet_vehicles set registration_expires_on = current_date + 40 where plate in ('SEB-004', 'SFSD-063', 'SFSD-100');
insert into public.vehicle_warnings (vehicle_id, user_id, reason, issued_by)
select v.id, '00000000-0000-4000-8000-000000000003', w.reason, '00000000-0000-4000-8000-000000000002'
from public.fleet_vehicles v
cross join (values ('Szabálytalan parkolás a kapitányság előtt'), ('Sérülten leadott jármű')) as w(reason)
where v.plate = 'SFSD-012';

-- Academy: an active cycle (day 2 today), basic material for three days, an open course with
-- progress, a closed one and a page with an embedded (pasted) image.
insert into public.academy_cycles (id, start_date, status, created_by) values
  ('30000000-0000-4000-8000-000000000001', (now() at time zone 'Europe/Budapest')::date - 1, 'active', '00000000-0000-4000-8000-000000000001');
insert into public.academy_students (cycle_id, user_id) values
  ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000008');
insert into public.academy_materials (title, day_number, page_order, category, theme, content) values
  ('Üdvözlünk az akadémián', 1, 1, 'basic', 'paper',
   '[{"type":"heading","props":{"level":2},"content":"Az első nap"},{"type":"paragraph","content":"Ma megismered a frakció felépítését, a rangokat és a rádióhasználat alapjait."},{"type":"bulletListItem","content":"Rendfokozatok"},{"type":"bulletListItem","content":"Rádiókódok"}]'),
  ('Rádiókódok', 1, 2, 'basic', 'paper',
   '[{"type":"paragraph","content":"10-4: vettem. 10-20: helyzet. 10-99: azonnali segítség."}]'),
  ('Közlekedési intézkedés', 2, 1, 'basic', 'paper',
   '[{"type":"heading","props":{"level":2},"content":"A második nap"},{"type":"paragraph","content":"Megállítás, igazoltatás, bírság kiszabása a kalkulátorral."}]'),
  ('Előállítás és jelentés', 3, 1, 'basic', 'default',
   '[{"type":"paragraph","content":"Az előállítás menete és a fórum-jelentés megírása."}]');
update public.academy_courses set is_open = true, required_rank = 'Deputy Sheriff II.' where id = 'qual_AB';
update public.academy_courses set is_open = true where id = 'qual_SAHP';
-- The AB intro page keeps an image embedded the old way (before the upload rule): the editors
-- upload it on the next save. New content with embedded images is refused by the trigger.
alter table public.academy_division_materials disable trigger reject_inline_images;
insert into public.academy_division_materials (id, course_id, title, page_order, theme, content) values
  ('31000000-0000-4000-8000-000000000001', 'qual_AB', 'AB bevezető', 1, 'paper',
   '[{"type":"heading","props":{"level":2},"content":"Aero Bureau"},{"type":"paragraph","content":"A légi egység feladatai és a helikopter alapjai."},{"type":"image","props":{"url":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mNk+M9QzwAEjDAGNzIwAAAZ8QH/0VwBYwAAAABJRU5ErkJggg==","caption":"Beillesztett kép"}}]'),
  ('31000000-0000-4000-8000-000000000002', 'qual_AB', 'Repüléselmélet', 2, 'default',
   '[{"type":"paragraph","content":"Felhajtóerő, a rotor működése, a leszállás szabályai."}]'),
  ('31000000-0000-4000-8000-000000000003', 'qual_AB', 'Rádiózás a levegőben', 3, 'blue',
   '[{"type":"paragraph","content":"Kommunikáció a földi egységekkel."}]'),
  ('31000000-0000-4000-8000-000000000004', 'mcb', 'MCB kézikönyv', 1, 'default',
   '[{"type":"paragraph","content":"Zárt tananyag: csak az oktatók látják."}]');
alter table public.academy_division_materials enable trigger reject_inline_images;
insert into public.academy_progress (user_id, material_id) values
  ('00000000-0000-4000-8000-000000000003', '31000000-0000-4000-8000-000000000001');

-- Events: a meeting to answer, a unit training, a staff briefing, a past action and a cancelled one.
-- (Inserted as the database owner, so the new-event notifications go out as from the system.)
insert into public.events (id, title, description, kind, starts_at, ends_at, location, audience, rsvp, cancelled_at, created_by) values
  ('40000000-0000-4000-8000-000000000001', 'Heti állománygyűlés',
   'Napirend: a hét értékelése, előléptetések, a havi duty idők rögzítése. Egyenruhában gyere.', 'meeting',
   date_trunc('day', now()) + interval '2 days 18 hours', date_trunc('day', now()) + interval '2 days 19 hours', 'Downtown Station, eligazító',
   'all', true, null, '00000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000002', 'MU elsősegély-gyakorlat', 'Sebellátás, újraélesztés, mentés járműből.', 'training',
   date_trunc('day', now()) + interval '5 days 17 hours', date_trunc('day', now()) + interval '5 days 19 hours', 'Angel Pine kórház',
   'MU', true, null, '00000000-0000-4000-8000-000000000007'),
  ('40000000-0000-4000-8000-000000000003', 'Supervisory Staff eligazítás', null, 'meeting',
   date_trunc('day', now()) + interval '3 days 19 hours', null, 'Downtown Station', 'staff', true, null, '00000000-0000-4000-8000-000000000005'),
  ('40000000-0000-4000-8000-000000000004', 'Közös akció a kikötőben', null, 'patrol',
   date_trunc('day', now()) - interval '3 days' + interval '20 hours', date_trunc('day', now()) - interval '3 days' + interval '22 hours',
   'San Fierro kikötő', 'all', true, null, '00000000-0000-4000-8000-000000000005'),
  ('40000000-0000-4000-8000-000000000005', 'Lőtéri edzés', null, 'training',
   date_trunc('day', now()) + interval '4 days 16 hours', null, 'Fort Carson lőtér', 'all', true, now(), '00000000-0000-4000-8000-000000000002');
insert into public.event_responses (event_id, user_id, status, note) values
  ('40000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'going', null),
  ('40000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', 'going', null),
  ('40000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000006', 'maybe', 'Csak 20:30-tól tudok jönni.'),
  ('40000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000007', 'absent', 'Szabadságon leszek.'),
  ('40000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', 'going', null),
  ('40000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000006', 'going', null);
-- The past action's attendance: one who said they come was there, one was not, and one came unannounced.
insert into public.event_attendance (event_id, user_id, recorded_by) values
  ('40000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000005'),
  ('40000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000005');
update public.events set attendance_taken_at = date_trunc('day', now()) - interval '2 days', attendance_taken_by = '00000000-0000-4000-8000-000000000005'
where id = '40000000-0000-4000-8000-000000000004';

-- The faction account's balance read in the game over the last months (the treasury forecast).
insert into public.payroll_runs (month, balance, balance_at, balance_by, created_by)
select (date_trunc('month', now() at time zone 'Europe/Budapest') - make_interval(months => b.ago))::date, b.balance,
       now() - make_interval(days => b.ago * 30), '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'
from (values (3, 520000000::bigint), (2, 545000000::bigint), (1, 538000000::bigint), (0, 561000000::bigint)) as b(ago, balance);

-- Reports of the last weeks (the promotion board, the workload chart and the leaderboard).
insert into public.report_logs (user_id, occurred_on, title, created_by)
select m.id, current_date - (g * 7 % 26),
       format('%s – %s', (array['Gyorshajtás', 'Rablás', 'Garázdaság', 'Testi sértés', 'Lopás'])[1 + g % 5],
              (array['John Doe', 'Jane Roe', 'Carl Johnson', 'Big Smoke'])[1 + g % 4]), m.id
from (values ('00000000-0000-4000-8000-000000000003'::uuid, 5), ('00000000-0000-4000-8000-000000000006'::uuid, 12),
             ('00000000-0000-4000-8000-000000000007'::uuid, 3), ('00000000-0000-4000-8000-000000000002'::uuid, 8)) as m(id, n)
cross join lateral generate_series(1, m.n) g;

-- Promotion: a pending nomination. Trainee: a mentor with a note (not signed off yet).
insert into public.promotion_nominations (user_id, from_rank, to_rank, reason, nominated_by, created_at)
values ('00000000-0000-4000-8000-000000000003', 'Deputy Sheriff II.', 'Deputy Sheriff III.',
        'Megbízható járőr: a hónap jelentéseit hiánytalanul leadta, és két Trainee-t is segített.',
        '00000000-0000-4000-8000-000000000002', now() - interval '1 day');
insert into public.trainee_mentors (trainee_id, mentor_id, assigned_by, assigned_at)
values ('00000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000002',
        now() - interval '3 days');
insert into public.trainee_notes (trainee_id, author_id, body, created_at)
values ('00000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000007',
        'Első közös járőr: a rádiózás még bizonytalan, a megállításnál figyelmes volt.', now() - interval '2 days');

-- MCB: tasks (one overdue, one done), a seized item with its custody trail and an informant.
insert into public.case_tasks (case_id, title, assignee_id, due_on, done_at, done_by, created_by, created_at) values
  ('30000000-0000-4000-8000-000000000001', 'Kamerafelvételek bekérése a kikötőből', '00000000-0000-4000-8000-000000000002',
   current_date - 1, null, null, '00000000-0000-4000-8000-000000000006', now() - interval '3 days'),
  ('30000000-0000-4000-8000-000000000001', 'Tanúkihallgatás: a 3-as dokk éjszakás munkása', '00000000-0000-4000-8000-000000000006',
   current_date + 3, null, null, '00000000-0000-4000-8000-000000000006', now() - interval '1 day'),
  ('30000000-0000-4000-8000-000000000001', 'A kikötőben parkoló járművek rendszámainak listája', '00000000-0000-4000-8000-000000000006',
   current_date - 4, now() - interval '2 days', '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000006',
   now() - interval '5 days');
insert into public.case_items (id, case_id, label, description, quantity, status, location, created_by, created_at)
values ('32000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Gépkarabély (AK-47)',
        'A 3-as dokknál talált lezárt láda tartalma.', '2 db', 'held', 'Downtown, bizonyítékraktár B-12',
        '00000000-0000-4000-8000-000000000006', now() - interval '2 days');
insert into public.case_item_events (item_id, case_id, action, location, note, actor_id, created_at) values
  ('32000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'seized', '3-as dokk', 'Lefoglalva a helyszínen.',
   '00000000-0000-4000-8000-000000000006', now() - interval '2 days'),
  ('32000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'moved', 'Downtown, bizonyítékraktár B-12', null,
   '00000000-0000-4000-8000-000000000006', now() - interval '47 hours');
insert into public.informants (id, codename, real_name, handler_id, reliability, status, contact, notes, created_by)
values ('33000000-0000-4000-8000-000000000001', 'Holló', 'Marco Vitale', '00000000-0000-4000-8000-000000000006', 4, 'active',
        'Telefon: 555-0142, csak este', 'A kikötői banda alsó szintjén mozog, pénzért beszél.', '00000000-0000-4000-8000-000000000006');
insert into public.informant_contacts (informant_id, met_on, summary, value, case_id, payment, created_by)
values ('33000000-0000-4000-8000-000000000001', current_date - 2, 'Szerinte a következő szállítmány csütörtökön érkezik a 3-as dokkra.',
        'high', '30000000-0000-4000-8000-000000000001', 50000, '00000000-0000-4000-8000-000000000006');

-- Policies: a published rule to acknowledge (three members already did) and a draft.
insert into public.policies (id, title, category, summary, body, version, requires_ack, status, sort_order, published_at, created_by, updated_by)
values ('34000000-0000-4000-8000-000000000001', 'Járműhasználati szabályzat', 'vehicles',
        'Ki, mikor és hogyan használhatja a frakció járműveit.',
        '[{"type":"heading","props":{"level":2},"content":"Általános szabályok"},{"type":"paragraph","content":"Szolgálati járművet csak szolgálatban, a kulcs birtokosa vezethet."},{"type":"bulletListItem","content":"A járművet tisztán és tankolva kell leadni."},{"type":"bulletListItem","content":"A sérülést a logisztikán jelezni kell."},{"type":"heading","props":{"level":2},"content":"Üldözés"},{"type":"paragraph","content":"Üldözésben legfeljebb három egység vehet részt közvetlenül."}]',
        1, true, 'published', 10, now() - interval '5 days', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001');
insert into public.policy_versions (policy_id, version, title, summary, body, change_note, requires_ack, published_by, published_at)
select id, 1, title, summary, body, 'Első kiadás', true, '00000000-0000-4000-8000-000000000001', published_at
from public.policies where id = '34000000-0000-4000-8000-000000000001';
insert into public.policy_acknowledgements (policy_id, user_id, version, acknowledged_at) values
  ('34000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 1, now() - interval '5 days'),
  ('34000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 1, now() - interval '4 days'),
  ('34000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', 1, now() - interval '3 days');
insert into public.policies (title, category, summary, body, status, sort_order, created_by, updated_by)
values ('Rádióforgalmazás', 'radio', 'A kódok használata és a rádiófegyelem.',
        '[{"type":"paragraph","content":"Rövid, egyértelmű üzenetek; a kódokat a Kódtár szerint használjuk."}]', 'draft', 20,
        '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001');

-- Community: a live poll, an anonymous one, two suggestions and an anonymous feedback.
insert into public.polls (id, title, description, audience, anonymous, max_choices, results, closes_at, created_by, created_at) values
  ('35000000-0000-4000-8000-000000000001', 'Melyik estén legyen a havi állománygyűlés?',
   'A legtöbb szavazatot kapott nap lesz a jövő havi gyűlés napja.', 'all', false, 1, 'live', now() + interval '3 days',
   '00000000-0000-4000-8000-000000000001', now() - interval '1 day'),
  ('35000000-0000-4000-8000-000000000002', 'Elégedett vagy a jelenlegi járőrbeosztással?', null, 'all', true, 1, 'after_close',
   now() + interval '6 days', '00000000-0000-4000-8000-000000000005', now() - interval '2 hours');
insert into public.poll_options (id, poll_id, label, sort_order) values
  ('35100000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000001', 'Kedd', 0),
  ('35100000-0000-4000-8000-000000000002', '35000000-0000-4000-8000-000000000001', 'Csütörtök', 1),
  ('35100000-0000-4000-8000-000000000003', '35000000-0000-4000-8000-000000000001', 'Vasárnap', 2),
  ('35100000-0000-4000-8000-000000000004', '35000000-0000-4000-8000-000000000002', 'Igen', 0),
  ('35100000-0000-4000-8000-000000000005', '35000000-0000-4000-8000-000000000002', 'Részben', 1),
  ('35100000-0000-4000-8000-000000000006', '35000000-0000-4000-8000-000000000002', 'Nem', 2);
insert into public.poll_voters (poll_id, user_id) values
  ('35000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'),
  ('35000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005'),
  ('35000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002');
insert into public.poll_votes (poll_id, option_id, user_id) values
  ('35000000-0000-4000-8000-000000000001', '35100000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002'),
  ('35000000-0000-4000-8000-000000000001', '35100000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000005'),
  ('35000000-0000-4000-8000-000000000002', '35100000-0000-4000-8000-000000000005', null);
insert into public.suggestions (id, title, body, category, author_id, status, response, responded_by, responded_at, created_at) values
  ('36000000-0000-4000-8000-000000000001', 'Közös lőtéri edzés minden hónapban',
   'Jó lenne havonta egy közös lőtéri edzés, ahol a Supervisory Staff is értékel.', 'training',
   '00000000-0000-4000-8000-000000000003', 'planned', 'Novembertől havonta egyszer lesz, az első időpont már a naptárban.',
   '00000000-0000-4000-8000-000000000001', now() - interval '1 day', now() - interval '6 days'),
  ('36000000-0000-4000-8000-000000000002', 'Jelentéssablon a közlekedési balesetekhez',
   'A jelentésgenerátorban legyen külön sablon a közlekedési balesetekhez, mert most mindig kézzel írjuk át.', 'website',
   '00000000-0000-4000-8000-000000000006', 'new', null, null, null, now() - interval '2 days');
insert into public.suggestion_votes (suggestion_id, user_id) values
  ('36000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'),
  ('36000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000006'),
  ('36000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000007'),
  ('36000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003');
insert into public.feedback_reports (id, reporter_hash, recipient, category, body, status, created_at, updated_at)
values ('37000000-0000-4000-8000-000000000001', private.reporter_hash('00000000-0000-4000-8000-000000000003'), 'command', 'idea',
        'A heti gyűlések túl későn kezdődnek, sokan ilyenkor már nem tudnak ott lenni. Lehetne fél órával korábban?', 'new',
        date_trunc('hour', now() - interval '5 hours'), date_trunc('hour', now() - interval '5 hours'));

-- Practice: the sample scenarios are published here, a four-day streak, leaderboard opt-ins and
-- the certificates of the seeded qualifications.
update public.practice_scenarios set published = true;
insert into public.practice_days (user_id, day, answered, correct)
select '00000000-0000-4000-8000-000000000003', current_date - g, 20 + g * 3, 15 + g * 2 from generate_series(0, 3) g;
insert into public.practice_days (user_id, day, answered, correct) values
  ('00000000-0000-4000-8000-000000000002', current_date - 1, 30, 27),
  ('00000000-0000-4000-8000-000000000006', current_date, 12, 9);
-- The deck totals match those days (save_practice_session() writes both).
insert into public.practice_progress (user_id, deck, answered, correct, sessions)
select user_id, 'radio', sum(answered), sum(correct), count(*) from public.practice_days group by user_id;
insert into public.member_settings (user_id, leaderboard_visible) values
  ('00000000-0000-4000-8000-000000000001', true), ('00000000-0000-4000-8000-000000000002', true),
  ('00000000-0000-4000-8000-000000000003', true), ('00000000-0000-4000-8000-000000000006', true),
  ('00000000-0000-4000-8000-000000000007', true);
select private.issue_certificate(p.id, 'qualification', q, q || ' képesítés', 'Képesítési okirat', p.created_at + interval '20 days')
from public.profiles p cross join lateral unnest(p.qualifications) q where p.system_role <> 'pending';
select private.issue_certificate('00000000-0000-4000-8000-000000000002', 'rank', 'Sergeant I.', 'Sergeant I.', 'Kinevezési okirat',
                                 now() - interval '30 days');
