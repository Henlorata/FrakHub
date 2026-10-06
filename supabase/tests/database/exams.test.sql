-- Exam attempts, scoring, grading and editing. Run with: bunx supabase test db
-- Uses the accounts and exams from supabase/seed.sql.
begin;
select plan(58);

create temporary table ids as select
  '00000000-0000-4000-8000-000000000001'::uuid as admin_id,
  '00000000-0000-4000-8000-000000000002'::uuid as sergeant_id,
  '00000000-0000-4000-8000-000000000003'::uuid as deputy_id,
  '00000000-0000-4000-8000-000000000007'::uuid as operator_id,
  '20000000-0000-4000-8000-000000000001'::uuid as public_exam,
  '20000000-0000-4000-8000-000000000002'::uuid as seb_exam;
grant select on ids to anon, authenticated, service_role;

-- Results of earlier steps (JSON replies), shared by every role.
create temporary table t (key text primary key, value text);
grant all on t to anon, authenticated, service_role;

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
create function pg_temp.j(_key text) returns json language sql as $$ select value::json from t where key = _key $$;
create function pg_temp.attempt(_key text) returns uuid language sql as $$ select (value::json -> 'attempt' ->> 'id')::uuid from t where key = _key $$;
create function pg_temp.secret(_key text) returns text language sql as $$ select value::json ->> 'secret' from t where key = _key $$;
grant execute on function pg_temp.j(text), pg_temp.attempt(text), pg_temp.secret(text) to anon, authenticated;

-- --- A guest takes the public recruitment exam --------------------------------
select pg_temp.act_anon();
select is(public.get_exam_intro((select seb_exam from ids)) ->> 'login_required', 'true',
  'guests learn that a members-only exam needs a login');
select is(public.get_exam_intro((select public_exam from ids)) -> 'exam' ->> 'question_count', '3',
  'the start page tells the number of questions');
select ok(public.get_exam_intro((select public_exam from ids)) -> 'questions' is null, 'the start page has no questions');
select throws_ok($$select public.start_exam('20000000-0000-4000-8000-000000000002', 'Valaki')$$, '42501', null,
  'guests cannot start a members-only exam');
select throws_ok($$select public.start_exam('20000000-0000-4000-8000-000000000001', 'X')$$, 'P0001', null,
  'a guest needs a real name');

insert into t select 'guest', public.start_exam((select public_exam from ids), 'Vendég Vera')::text;
select is(pg_temp.j('guest') -> 'attempt' ->> 'status', 'in_progress', 'a guest starts an attempt');
select ok(char_length(pg_temp.j('guest') ->> 'secret') = 48, 'the guest receives a secret for the attempt');
select ok((select value from t where key = 'guest') not like '%is_correct%', 'the questions arrive without the answer key');
select ok((select value from t where key = 'guest') not like '%Teljes pont%', 'the questions arrive without the guides');
select is(json_array_length(pg_temp.j('guest') -> 'questions'), 3, 'the attempt holds every question');
select ok((pg_temp.j('guest') -> 'attempt' ->> 'deadline')::timestamptz between now() + interval '29 minutes' and now() + interval '31 minutes',
  'the deadline is set by the server from the time limit');

select throws_ok(format($$select public.save_exam_progress(%L, '{}', '[]', %L)$$, pg_temp.attempt('guest'), repeat('0', 48)),
  '42501', null, 'another browser cannot write into the attempt');
select is(public.save_exam_progress(pg_temp.attempt('guest'),
  '{"21000000-0000-4000-8000-000000000001": {"text": "vera#1", "pasted": 6},
    "21000000-0000-4000-8000-000000000002": {"options": ["22000000-0000-4000-8000-000000000001", "22000000-0000-4000-8000-000000000002"]},
    "99999999-0000-4000-8000-000000000000": {"text": "nem létező kérdés"}}',
  '[{"k": "away", "at": 5000, "d": 12000, "p": 1}, {"k": "paste", "at": 9000, "n": 6, "q": "21000000-0000-4000-8000-000000000001"},
    {"k": "hack", "at": 1}, "nem objektum"]',
  pg_temp.secret('guest')) ->> 'finished', 'false', 'the guest saves answers and integrity events');
select is((public.finish_exam(pg_temp.attempt('guest'), '{}', '[]', pg_temp.secret('guest')) ->> 'missing')::integer, 1,
  'the required question of page 2 is still missing');
insert into t select 'guest_done', public.finish_exam(pg_temp.attempt('guest'),
  '{"21000000-0000-4000-8000-000000000003": {"text": "Szeretnék segíteni a városnak."}}', '[]', pg_temp.secret('guest'))::text;
select is(pg_temp.j('guest_done') -> 'attempt' ->> 'status', 'pending', 'the sheet goes to the graders');
select ok(pg_temp.j('guest_done') -> 'attempt' ->> 'claim_token' like 'TR-%', 'the guest receives a claim code');
select is(public.start_exam((select public_exam from ids), null, pg_temp.attempt('guest'), pg_temp.secret('guest')) -> 'attempt' ->> 'claim_token',
  pg_temp.j('guest_done') -> 'attempt' ->> 'claim_token', 'reopening the handed-in attempt shows the claim code again');

select pg_temp.act_postgres();
select is((select selected_option_ids from public.exam_answers
           where submission_id = pg_temp.attempt('guest') and question_id = '21000000-0000-4000-8000-000000000002'),
  array['22000000-0000-4000-8000-000000000001'::uuid], 'a single-choice answer keeps one option');
select is((select points_awarded from public.exam_answers
           where submission_id = pg_temp.attempt('guest') and question_id = '21000000-0000-4000-8000-000000000002'), 2,
  'the correct choice answer is scored on hand-in');
select is((select count(*) from public.exam_answers where submission_id = pg_temp.attempt('guest')), 3::bigint,
  'answers to questions outside the attempt are ignored');
select is((select integrity ->> 'away_ms' from public.exam_submissions where id = pg_temp.attempt('guest')), '12000',
  'the time spent away from the page is summed');
select is((select jsonb_array_length(integrity_log) from public.exam_submissions where id = pg_temp.attempt('guest')), 2,
  'unknown and malformed events are dropped');
select is((select tab_switch_count from public.exam_submissions where id = pg_temp.attempt('guest')), 1,
  'the old counter shows how often the page was left');
select is((select pasted_chars from public.exam_answers
           where submission_id = pg_temp.attempt('guest') and question_id = '21000000-0000-4000-8000-000000000001'), 6,
  'pasted characters are kept per answer');
select is((select finish_reason from public.exam_submissions where id = pg_temp.attempt('guest')), 'submitted',
  'the reason of the hand-in is recorded');

-- --- A deputy takes the SEB exam ------------------------------------------------
select pg_temp.act_as((select deputy_id from ids));
insert into t select 'deputy', public.start_exam((select seb_exam from ids))::text;
select is(pg_temp.j('deputy') -> 'attempt' ->> 'status', 'in_progress', 'a member starts an exam');
select is(public.start_exam((select seb_exam from ids)) -> 'attempt' ->> 'id', pg_temp.attempt('deputy')::text,
  'starting again continues the same attempt');
select is((select count(*) from public.exam_question_guides), 0::bigint, 'members cannot read the guides');
select is((select count(*) from public.exam_pages), 0::bigint, 'members cannot read the page settings');
select throws_ok($$select public.get_exam_editor('20000000-0000-4000-8000-000000000002')$$, '42501', null,
  'members cannot open the editor');
select throws_ok($$select public.save_exam(null, '{"title": "Hamis", "type": "other", "time_limit_minutes": 5, "passing_percentage": 50}', '[]',
  '[{"question_text": "?", "question_type": "text", "points": 1}]')$$, '42501', null, 'members cannot create exams');

select pg_temp.act_postgres();
select is((select jsonb_array_length(integrity_log) from public.exam_submissions where id = pg_temp.attempt('deputy')), 1,
  'reopening an attempt is logged for the grader');
update public.exam_submissions set start_time = now() - interval '30 minutes', deadline = now() - interval '10 minutes'
where id = pg_temp.attempt('deputy');

select pg_temp.act_as((select deputy_id from ids));
select is(public.save_exam_progress(pg_temp.attempt('deputy'),
  '{"21000000-0000-4000-8000-000000000004": {"options": ["22000000-0000-4000-8000-000000000003"]}}') -> 'attempt' ->> 'status',
  'pending', 'after the deadline a save hands the sheet in as it was');
select is((select x -> 'block' ->> 'code' from json_array_elements(public.get_exam_hub() -> 'exams') x
           where x ->> 'id' = '20000000-0000-4000-8000-000000000002'), 'pending', 'a sheet waiting for grading blocks a new attempt');
select is(json_array_length(public.get_exam_hub() -> 'queue'), 0, 'deputies have no grading queue');
select throws_ok(format($$select public.grade_exam_submission(%L, '{}', 'passed')$$, pg_temp.attempt('deputy')),
  '42501', null, 'nobody grades their own sheet');

select pg_temp.act_postgres();
select is((select finish_reason from public.exam_submissions where id = pg_temp.attempt('deputy')), 'expired',
  'an abandoned attempt is closed as expired');
select is((select points_awarded from public.exam_answers
           where submission_id = pg_temp.attempt('deputy') and question_id = '21000000-0000-4000-8000-000000000004'), 0,
  'the late answer was not stored');

-- --- Grading -------------------------------------------------------------------
select pg_temp.act_as((select sergeant_id from ids));
select is(json_array_length(public.get_exam_hub() -> 'queue'), 2, 'the sergeant sees the recruitment sheets to grade');
insert into t select 'sheet', public.get_exam_sheet(pg_temp.attempt('guest'))::text;
select ok((select value from t where key = 'sheet') like '%"is_correct"%', 'graders get the answer key');
select ok(exists (select 1 from json_array_elements(pg_temp.j('sheet') -> 'questions') q where q ->> 'guide' is not null),
  'graders get the guides');
select is(public.grade_exam_submission(pg_temp.attempt('guest'),
  '{"21000000-0000-4000-8000-000000000003": {"points": 99, "comment": "Szép válasz."}}', 'passed', 'Gratulálunk!', true) ->> 'total_score',
  '5', 'points are capped at the maximum and the total is computed');

select pg_temp.act_as((select admin_id from ids));
select lives_ok(format($$select public.grade_exam_submission(%L, '{}', 'failed', 'Gyakorolj még.', false, 24)$$, pg_temp.attempt('deputy')),
  'the bureau manager grades the SEB sheet');

select pg_temp.act_as((select deputy_id from ids));
select is(json_array_length(public.get_exam_sheet(pg_temp.attempt('deputy')) -> 'questions'), 0,
  'without released feedback the candidate sees only the result');
select is(public.get_exam_sheet(pg_temp.attempt('deputy')) -> 'sheet' ->> 'integrity', null, 'the integrity log is for graders');
select is((select x -> 'block' ->> 'code' from json_array_elements(public.get_exam_hub() -> 'exams') x
           where x ->> 'id' = '20000000-0000-4000-8000-000000000002'), 'cooldown', 'a failed exam waits for the cooldown');

-- --- Editing: pools, guides, auto-graded quizzes -----------------------------------
select pg_temp.act_as((select admin_id from ids));
insert into t select 'quiz_id', to_json(public.save_exam(null,
  '{"title": "Rádiózás", "type": "other", "time_limit_minutes": 10, "passing_percentage": 50, "auto_grade": true, "shuffle_options": true}',
  '[{"page_number": 1, "title": "Kódok", "draw_count": 1}]',
  '[{"id": "temp-1", "question_text": "Mit jelent a 10-4?", "question_type": "single_choice", "points": 1, "page_number": 1, "guide": "Vétel.",
     "options": [{"id": "a", "option_text": "Vétel", "is_correct": true}, {"id": "b", "option_text": "Segítség"}]},
    {"id": "temp-2", "question_text": "Mit jelent a 10-20?", "question_type": "single_choice", "points": 1, "page_number": 1,
     "options": [{"id": "c", "option_text": "Helyzet", "is_correct": true}, {"id": "d", "option_text": "Ebéd"}]}]'))::text;
select is((select count(*) from public.exam_questions where exam_id = (pg_temp.j('quiz_id') #>> '{}')::uuid), 2::bigint,
  'save_exam creates the questions');
select is((select draw_count from public.exam_pages where exam_id = (pg_temp.j('quiz_id') #>> '{}')::uuid), 1, 'the pool size is stored');
select is((select count(*) from public.exam_question_guides g join public.exam_questions q on q.id = g.question_id
           where q.exam_id = (pg_temp.j('quiz_id') #>> '{}')::uuid), 1::bigint, 'the guide is stored');
select throws_ok($$select public.save_exam(null, '{"title": "Hibás", "type": "other", "time_limit_minutes": 5, "passing_percentage": 50}', '[]',
  '[{"question_text": "Melyik?", "question_type": "single_choice", "points": 1, "options": [{"option_text": "A"}, {"option_text": "B"}]}]')$$,
  'P0001', null, 'a scored choice question needs a correct option');

select pg_temp.act_as((select deputy_id from ids));
insert into t select 'quiz', public.start_exam((pg_temp.j('quiz_id') #>> '{}')::uuid)::text;
select is(json_array_length(pg_temp.j('quiz') -> 'questions'), 1, 'the pool draws one question of the page');
select is(public.finish_exam(pg_temp.attempt('quiz'), (
    select jsonb_build_object(q ->> 'id', jsonb_build_object('options', jsonb_build_array(o ->> 'id')))
    from json_array_elements(pg_temp.j('quiz') -> 'questions') q, json_array_elements(q -> 'options') o
    where o ->> 'option_text' in ('Vétel', 'Helyzet'))) -> 'attempt' ->> 'status',
  'passed', 'an auto-graded quiz is decided at once');
select is(public.get_exam_intro((pg_temp.j('quiz_id') #>> '{}')::uuid) -> 'block' ->> 'code', 'passed',
  'a passed exam is not repeated without a new invitation');

-- Rewriting the SEB exam: the question the deputy answered is archived, the old sheet keeps it.
select pg_temp.act_as((select admin_id from ids));
select lives_ok($$select public.save_exam('20000000-0000-4000-8000-000000000002',
  '{"title": "SEB Alapvizsga", "type": "division_exam", "division": "SEB", "time_limit_minutes": 20, "passing_percentage": 80}', '[]',
  '[{"id": "temp-1", "question_text": "Írd le a behatolás lépéseit.", "question_type": "text", "points": 2}]')$$,
  'the SEB exam is rewritten');
select is((select count(*) from public.exam_questions where id = '21000000-0000-4000-8000-000000000004' and archived_at is not null),
  1::bigint, 'a question with answers is archived instead of deleted');
select is(json_array_length(public.get_exam_sheet(pg_temp.attempt('deputy')) -> 'questions'), 1,
  'the graded sheet still shows the question it was given');

-- --- Old direct writes (refused since the post-deploy lockdown) ------------
select pg_temp.act_as((select operator_id from ids));
select throws_ok($$insert into public.exam_submissions (exam_id, user_id, applicant_name, status, max_score)
  values ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000007', 'Operátor Olga', 'pending', 1)$$,
  '42501', null, 'sheets are handed in through the attempt RPCs only');
select pg_temp.act_as((select admin_id from ids));
select throws_ok($$insert into public.exam_options (question_id, option_text, order_index) values ('21000000-0000-4000-8000-000000000004', 'Oszlop', 2)$$,
  '42501', null, 'questions and options are written by save_exam() only');

select * from finish();
rollback;
