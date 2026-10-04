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

insert into public.exam_options (id, question_id, option_text, is_correct) values
  ('22000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000002', 'Megkülönböztető jelzés használatával', true),
  ('22000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000002', 'Járőrözés', false),
  ('22000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-000000000004', 'Ék', true),
  ('22000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-000000000004', 'Kör', false);

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

-- Fleet: one vehicle about to expire, one expired, with vehicle warnings.
insert into public.fleet_vehicles (id, plate, model, owner_id, registration_expires_on, notes) values
  ('40000000-0000-4000-8000-000000000001', 'SFSD-12', 'Buffalo STX', '00000000-0000-4000-8000-000000000003', current_date + 2, null),
  ('40000000-0000-4000-8000-000000000002', 'SFSD-07', 'Granger', '00000000-0000-4000-8000-000000000006', current_date - 3, 'MCB terepjáró'),
  ('40000000-0000-4000-8000-000000000003', 'SFSD-01', 'Police Cruiser', '00000000-0000-4000-8000-000000000001', current_date + 60, null);
insert into public.vehicle_warnings (vehicle_id, plate, reason, issued_by) values
  ('40000000-0000-4000-8000-000000000001', 'SFSD-12', 'Szabálytalan parkolás a kapitányság előtt', '00000000-0000-4000-8000-000000000002'),
  ('40000000-0000-4000-8000-000000000001', 'SFSD-12', 'Sérülten leadott jármű', '00000000-0000-4000-8000-000000000002');
