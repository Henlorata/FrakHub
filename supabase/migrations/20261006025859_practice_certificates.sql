-- =============================================================================
-- Practice and recognition: spaced-repetition decks and branching scenarios
-- (scored on the server), certificates with a public verification code, the
-- opt-in leaderboard, the monthly recap, the printable service record, the penal
-- code change announcement, the new dashboard counters and the payslips' tiers.
--
-- Compatible with the deployed frontend: new tables and functions; the changed
-- get_dashboard_summary() and get_my_payslips() only add keys; the new triggers
-- only write the certificates table.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Practice decks (radio codes, penal code ...): the member's card boxes
-- ---------------------------------------------------------------------------

-- cards: {"<card id>": {"b": box 1-5, "d": "YYYY-MM-DD" next due day, "l": lapses}}, written once per session.
create table public.practice_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  deck text not null check (deck ~ '^[a-z0-9_:-]{2,40}$'),
  cards jsonb not null default '{}'::jsonb check (jsonb_typeof(cards) = 'object' and octet_length(cards::text) <= 60000),
  answered integer not null default 0,
  correct integer not null default 0,
  sessions integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, deck)
);

-- Practice per Hungarian day (streaks, the leaderboard). The daily totals are capped.
create table public.practice_days (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  answered integer not null default 0,
  correct integer not null default 0,
  primary key (user_id, day)
);

alter table public.practice_progress enable row level security;
alter table public.practice_days enable row level security;
revoke all on public.practice_progress, public.practice_days from anon, authenticated;

-- Consecutive practice days ending today or yesterday (Hungarian days).
create or replace function private.practice_streak(_user_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _day date := current_date;
  _streak integer := 0;
begin
  if not exists (select 1 from public.practice_days where user_id = _user_id and day = _day) then _day := _day - 1; end if;
  while exists (select 1 from public.practice_days where user_id = _user_id and day = _day) loop
    _streak := _streak + 1;
    _day := _day - 1;
  end loop;
  return _streak;
end;
$$;

-- The longest run of consecutive practice days.
create or replace function private.practice_best_streak(_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(max(n), 0)::int from (
    select count(*) as n from (
      select day - (row_number() over (order by day))::int as island from public.practice_days where user_id = _user_id
    ) d group by island
  ) x
$$;

create or replace function public.save_practice_session(_deck text, _cards jsonb, _answered integer, _correct integer)
returns json
language plpgsql
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _me uuid := (select auth.uid());
  _a integer := least(greatest(coalesce(_answered, 0), 0), 500);
  _c integer;
begin
  if not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  if _deck is null or _deck !~ '^[a-z0-9_:-]{2,40}$' then raise exception 'Ismeretlen pakli.' using errcode = '22023'; end if;
  if _cards is null or jsonb_typeof(_cards) <> 'object' or octet_length(_cards::text) > 60000 then
    raise exception 'Érvénytelen gyakorlási állapot.' using errcode = '22023';
  end if;
  _c := least(greatest(coalesce(_correct, 0), 0), _a);
  insert into public.practice_progress (user_id, deck, cards, answered, correct, sessions, updated_at)
  values (_me, _deck, _cards, _a, _c, 1, now())
  on conflict (user_id, deck) do update set cards = excluded.cards, answered = public.practice_progress.answered + _a,
    correct = public.practice_progress.correct + _c, sessions = public.practice_progress.sessions + 1, updated_at = now();
  if _a > 0 then
    insert into public.practice_days (user_id, day, answered, correct) values (_me, current_date, _a, _c)
    on conflict (user_id, day) do update set answered = least(public.practice_days.answered + _a, 1000),
      correct = least(public.practice_days.correct + _c, 1000);
  end if;
  return json_build_object('streak', private.practice_streak(_me), 'best_streak', private.practice_best_streak(_me),
                           'today', (select json_build_object('answered', answered, 'correct', correct)
                                     from public.practice_days where user_id = _me and day = current_date));
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Branching scenarios (written by the instructors, scored on the server)
-- ---------------------------------------------------------------------------

-- nodes: {"<node id>": {"text": "...", "choices": [{"id", "text", "next": "<node id>" | null, "points": 0-10,
--         "verdict": "good" | "ok" | "bad", "feedback": "..."}]}, ...}. A node without choices ends the
--         scenario ({"end": {"title", "text"}}). The graph has no cycles (checked when saved).
create table public.practice_scenarios (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 120),
  summary text check (char_length(summary) <= 300),
  category text not null default 'patrol' check (category in ('traffic', 'patrol', 'arrest', 'radio', 'mcb', 'other')),
  difficulty smallint not null default 1 check (difficulty between 1 and 3),
  start_node text not null check (char_length(start_node) between 1 and 40),
  nodes jsonb not null check (jsonb_typeof(nodes) = 'object' and octet_length(nodes::text) <= 200000),
  max_score integer not null default 0,
  pass_percent integer not null default 70 check (pass_percent between 1 and 100),
  published boolean not null default false,
  sort_order integer not null default 100,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

create table public.scenario_results (
  scenario_id uuid not null references public.practice_scenarios(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  best_score integer not null default 0,
  max_score integer not null default 0,
  best_percent integer not null default 0,
  passed boolean not null default false,
  attempts integer not null default 0,
  last_run_at timestamptz not null default now(),
  primary key (scenario_id, user_id)
);

alter table public.practice_scenarios enable row level security;
alter table public.scenario_results enable row level security;
revoke all on public.practice_scenarios, public.scenario_results from anon, authenticated;

-- Longest path (in choices) and the best total of points from the start, by relaxation: a graph
-- without cycles settles within (number of nodes + 1) rounds, a cycle never settles.
create or replace function private.scenario_analyse(_nodes jsonb, _start text, out max_score integer, out depth integer,
                                                    out has_cycle boolean)
language plpgsql
immutable
set search_path = ''
as $$
declare
  _n integer := (select count(*) from jsonb_object_keys(_nodes));
  _best jsonb := '{}'::jsonb;
  _depth jsonb := '{}'::jsonb;
  _new_best jsonb;
  _new_depth jsonb;
  _round integer := 0;
  _changed boolean := true;
begin
  while _changed and _round <= _n + 1 loop
    _round := _round + 1;
    select coalesce(jsonb_object_agg(x.k, x.b), '{}'::jsonb), coalesce(jsonb_object_agg(x.k, x.d), '{}'::jsonb)
    into _new_best, _new_depth
    from (
      select n.k,
             coalesce(max(e.points + coalesce((_best ->> e.next)::int, 0)), 0) as b,
             coalesce(max(1 + coalesce((_depth ->> e.next)::int, 0)), 0) as d
      from jsonb_object_keys(_nodes) as n(k)
      left join lateral (
        select coalesce((c ->> 'points')::int, 0) as points, nullif(c ->> 'next', '') as next
        from jsonb_array_elements(coalesce(_nodes -> n.k -> 'choices', '[]'::jsonb)) c
      ) e on true
      group by n.k
    ) x;
    _changed := _new_best is distinct from _best or _new_depth is distinct from _depth;
    _best := _new_best;
    _depth := _new_depth;
  end loop;
  has_cycle := _changed;
  max_score := coalesce((_best ->> _start)::int, 0);
  depth := coalesce((_depth ->> _start)::int, 0);
end;
$$;

-- Checks a scenario graph. Returns null when it is fine, otherwise the problem (Hungarian).
create or replace function private.scenario_problem(_nodes jsonb, _start text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  _key text;
  _choices jsonb;
  _choice jsonb;
  _ends integer := 0;
  _shape record;
begin
  if _nodes is null or jsonb_typeof(_nodes) <> 'object' or _start is null or not (_nodes ? _start) then
    return 'A kezdő lépés hiányzik.';
  end if;
  if (select count(*) from jsonb_object_keys(_nodes)) > 60 then return 'Legfeljebb 60 lépés lehet egy gyakorlatban.'; end if;
  for _key in select * from jsonb_object_keys(_nodes) loop
    if char_length(_key) not between 1 and 40 then return 'Érvénytelen lépésazonosító.'; end if;
    if jsonb_typeof(_nodes -> _key) <> 'object' then return 'Érvénytelen lépés.'; end if;
    _choices := coalesce(_nodes -> _key -> 'choices', '[]'::jsonb);
    if jsonb_typeof(_choices) <> 'array' then return 'Érvénytelen válaszlista.'; end if;
    if jsonb_array_length(_choices) = 0 then
      _ends := _ends + 1;
      continue;
    end if;
    if jsonb_array_length(_choices) > 6 then return 'Egy lépésnél legfeljebb hat válasz lehet.'; end if;
    if char_length(btrim(coalesce(_nodes -> _key ->> 'text', ''))) = 0 then return 'Minden lépéshez kell helyzetleírás.'; end if;
    if char_length(_nodes -> _key ->> 'text') > 1500 then return 'Egy helyzetleírás legfeljebb 1500 karakter.'; end if;
    select count(*) as total, count(distinct c ->> 'id') filter (where nullif(c ->> 'id', '') is not null) as ids
    into _shape from jsonb_array_elements(_choices) c;
    if _shape.ids <> _shape.total then return 'A válaszok azonosítója hiányzik vagy ismétlődik.'; end if;
    for _choice in select * from jsonb_array_elements(_choices) loop
      if char_length(btrim(coalesce(_choice ->> 'text', ''))) = 0 then return 'Minden válasznak kell szöveg.'; end if;
      if char_length(_choice ->> 'text') > 300 or char_length(coalesce(_choice ->> 'feedback', '')) > 600 then
        return 'Egy válasz legfeljebb 300, a visszajelzés 600 karakter.';
      end if;
      if nullif(_choice ->> 'next', '') is null then
        -- A choice without a next step ends the scenario as well.
        _ends := _ends + 1;
      elsif not (_nodes ? (_choice ->> 'next')) then
        return 'Egy válasz nem létező lépésre mutat.';
      end if;
      if coalesce(_choice ->> 'points', '0') !~ '^\d{1,2}$' or (_choice ->> 'points')::int > 10 then
        return 'A pont 0 és 10 között lehet.';
      end if;
      if coalesce(_choice ->> 'verdict', 'ok') not in ('good', 'ok', 'bad') then return 'Ismeretlen értékelés.'; end if;
    end loop;
  end loop;
  if _ends = 0 then return 'Legalább egy befejező lépés kell.'; end if;
  if (private.scenario_analyse(_nodes, _start)).has_cycle then return 'A gyakorlatban körbe vezető út van.'; end if;
  if (private.scenario_analyse(_nodes, _start)).depth > 40 then return 'Egy út legfeljebb 40 döntésből állhat.'; end if;
  return null;
end;
$$;

create or replace function public.save_scenario(_id uuid, _scenario jsonb)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _row public.practice_scenarios%rowtype;
  _nodes jsonb := _scenario -> 'nodes';
  _start text := btrim(coalesce(_scenario ->> 'start_node', ''));
  _title text := btrim(coalesce(_scenario ->> 'title', ''));
  _summary text := nullif(left(btrim(coalesce(_scenario ->> 'summary', '')), 300), '');
  _category text := coalesce(nullif(_scenario ->> 'category', ''), 'patrol');
  _problem text;
  _max integer;
begin
  if not private.is_academy_instructor() then raise exception 'Gyakorlatot az oktatók szerkesztenek.' using errcode = '42501'; end if;
  if char_length(_title) < 3 or char_length(_title) > 120 then raise exception 'A cím 3–120 karakter lehet.' using errcode = '22023'; end if;
  if _category not in ('traffic', 'patrol', 'arrest', 'radio', 'mcb', 'other') then raise exception 'Ismeretlen kategória.' using errcode = '22023'; end if;
  if _nodes is null or octet_length(_nodes::text) > 200000 then raise exception 'A gyakorlat túl hosszú.' using errcode = '22023'; end if;
  _problem := private.scenario_problem(_nodes, _start);
  if _problem is not null then raise exception '%', _problem using errcode = '22023'; end if;
  _max := (private.scenario_analyse(_nodes, _start)).max_score;

  if _id is null then
    insert into public.practice_scenarios (title, summary, category, difficulty, start_node, nodes, max_score, pass_percent, published,
                                           sort_order, created_by, updated_by)
    values (_title, _summary, _category, coalesce(private.json_int(_scenario -> 'difficulty', 1, 3), 1), _start, _nodes, _max,
            coalesce(private.json_int(_scenario -> 'pass_percent', 1, 100), 70), coalesce((_scenario ->> 'published')::boolean, false),
            coalesce(private.json_int(_scenario -> 'sort_order', 0, 10000), 100), (select auth.uid()), (select auth.uid()))
    returning * into _row;
  else
    update public.practice_scenarios set title = _title, summary = _summary, category = _category,
      difficulty = coalesce(private.json_int(_scenario -> 'difficulty', 1, 3), difficulty),
      start_node = _start, nodes = _nodes, max_score = _max,
      pass_percent = coalesce(private.json_int(_scenario -> 'pass_percent', 1, 100), pass_percent),
      published = coalesce((_scenario ->> 'published')::boolean, published),
      sort_order = coalesce(private.json_int(_scenario -> 'sort_order', 0, 10000), sort_order),
      updated_at = now(), updated_by = (select auth.uid())
    where id = _id returning * into _row;
    if _row.id is null then raise exception 'A gyakorlat nem található.' using errcode = 'P0002'; end if;
  end if;
  return json_build_object('id', _row.id, 'max_score', _row.max_score, 'updated_at', _row.updated_at);
end;
$$;

create or replace function public.delete_scenario(_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_academy_instructor() then raise exception 'Gyakorlatot az oktatók törölhetnek.' using errcode = '42501'; end if;
  delete from public.practice_scenarios where id = _id;
end;
$$;

-- One scenario with its graph (the player walks it in the browser; the score is computed again when handed in).
create or replace function public.get_scenario(_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _row public.practice_scenarios%rowtype;
begin
  select * into _row from public.practice_scenarios where id = _id;
  if _row.id is null or not private.is_member() or not (_row.published or private.is_academy_instructor()) then
    raise exception 'A gyakorlat nem található.' using errcode = 'P0002';
  end if;
  return json_build_object('id', _row.id, 'title', _row.title, 'summary', _row.summary, 'category', _row.category,
    'difficulty', _row.difficulty, 'start_node', _row.start_node, 'nodes', _row.nodes, 'max_score', _row.max_score,
    'pass_percent', _row.pass_percent, 'published', _row.published, 'sort_order', _row.sort_order, 'updated_at', _row.updated_at,
    'my_result', (select row_to_json(r) from public.scenario_results r where r.scenario_id = _id and r.user_id = (select auth.uid())));
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Certificates (issued by the database, verifiable by code)
-- ---------------------------------------------------------------------------

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('exam', 'qualification', 'rank', 'scenario')),
  -- The exam / scenario id, the unit key or the rank.
  ref text not null,
  title text not null,
  subtitle text,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, kind, ref)
);
create index certificates_user_idx on public.certificates (user_id, issued_at desc);
alter table public.certificates enable row level security;
revoke all on public.certificates from anon, authenticated;

-- SFSD-XXXX-XXXX from the strong random generator behind gen_random_uuid().
create or replace function private.certificate_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'SFSD-' || substr(h, 1, 4) || '-' || substr(h, 5, 4) from (select upper(replace(gen_random_uuid()::text, '-', '')) as h) x
$$;

-- Issues (or restores) a certificate; a clash of the random code is retried.
create or replace function private.issue_certificate(_user_id uuid, _kind text, _ref text, _title text, _subtitle text,
                                                     _issued_at timestamptz default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  for _try in 1..5 loop
    begin
      insert into public.certificates (code, user_id, kind, ref, title, subtitle, issued_at)
      values (private.certificate_code(), _user_id, _kind, _ref, _title, _subtitle, coalesce(_issued_at, now()))
      on conflict (user_id, kind, ref) do update set revoked_at = null, title = excluded.title, subtitle = excluded.subtitle,
        issued_at = case when public.certificates.revoked_at is not null then excluded.issued_at else public.certificates.issued_at end;
      return;
    exception when unique_violation then
      null;
    end;
  end loop;
end;
$$;

-- Passed exams (also when a guest's sheet is claimed later); a regrade or the trash revokes it.
create or replace function private.on_exam_certificate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _title text;
begin
  if new.user_id is not null and new.status = 'passed' and new.deleted_at is null
     and (old.status is distinct from 'passed' or old.user_id is distinct from new.user_id or old.deleted_at is not null) then
    select title into _title from public.exams where id = new.exam_id;
    perform private.issue_certificate(new.user_id, 'exam', new.exam_id::text, coalesce(_title, 'Vizsga'), 'Sikeres vizsga',
                                      coalesce(new.graded_at, new.end_time, now()));
  elsif old.user_id is not null and old.status = 'passed' and old.deleted_at is null
        and (new.status <> 'passed' or new.deleted_at is not null or new.user_id is distinct from old.user_id) then
    update public.certificates set revoked_at = now()
    where user_id = old.user_id and kind = 'exam' and ref = old.exam_id::text and revoked_at is null
      and not exists (select 1 from public.exam_submissions s
                      where s.exam_id = old.exam_id and s.user_id = old.user_id and s.status = 'passed' and s.deleted_at is null
                        and s.id <> old.id);
  end if;
  return new;
end;
$$;
create trigger on_exam_certificate after update of status, user_id, deleted_at on public.exam_submissions
  for each row execute function private.on_exam_certificate();

-- Qualifications granted (revoked when taken away) and rank appointments (a promotion undone
-- right away takes its certificate with it).
create or replace function private.on_profile_certificate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _unit text;
begin
  if new.system_role = 'pending' then return new; end if;
  if new.qualifications is distinct from old.qualifications then
    for _unit in select q from unnest(coalesce(new.qualifications, '{}')) q where not (q = any(coalesce(old.qualifications, '{}'))) loop
      perform private.issue_certificate(new.id, 'qualification', _unit, _unit || ' képesítés', 'Képesítési okirat');
    end loop;
    update public.certificates set revoked_at = now()
    where user_id = new.id and kind = 'qualification' and revoked_at is null and not (ref = any(coalesce(new.qualifications, '{}')));
  end if;
  if new.faction_rank is distinct from old.faction_rank and old.faction_rank is not null then
    delete from public.certificates
    where user_id = new.id and kind = 'rank' and ref = old.faction_rank and issued_at > now() - interval '10 minutes';
    if private.rank_index(new.faction_rank) < private.rank_index(old.faction_rank) then
      perform private.issue_certificate(new.id, 'rank', new.faction_rank, new.faction_rank, 'Kinevezési okirat');
    end if;
  end if;
  return new;
end;
$$;
create trigger on_profile_certificate after update of qualifications, faction_rank on public.profiles
  for each row execute function private.on_profile_certificate();

-- Certificates for what members already achieved: passed exams, current qualifications and the
-- current rank (when the promotion is in the history).
insert into public.certificates (code, user_id, kind, ref, title, subtitle, issued_at)
select private.certificate_code(), x.user_id, 'exam', x.exam_id::text, x.title, 'Sikeres vizsga', x.at
from (
  select distinct on (s.user_id, s.exam_id) s.user_id, s.exam_id, e.title, coalesce(s.graded_at, s.end_time, s.start_time, now()) as at
  from public.exam_submissions s join public.exams e on e.id = s.exam_id
  where s.status = 'passed' and s.deleted_at is null and s.user_id is not null
  order by s.user_id, s.exam_id, coalesce(s.graded_at, s.end_time, s.start_time)
) x
on conflict (user_id, kind, ref) do nothing;

insert into public.certificates (code, user_id, kind, ref, title, subtitle, issued_at)
select private.certificate_code(), p.id, 'qualification', q, q || ' képesítés', 'Képesítési okirat',
       coalesce((select max(me.created_at) from public.member_events me
                 where me.user_id = p.id and me.kind = 'qualifications' and q = any(string_to_array(coalesce(me.to_value, ''), ', '))),
                p.created_at)
from public.profiles p cross join lateral unnest(coalesce(p.qualifications, '{}')) q
where p.system_role <> 'pending' and q <> ''
on conflict (user_id, kind, ref) do nothing;

insert into public.certificates (code, user_id, kind, ref, title, subtitle, issued_at)
select private.certificate_code(), p.id, 'rank', p.faction_rank, p.faction_rank, 'Kinevezési okirat', me.at
from public.profiles p
cross join lateral (select max(created_at) as at from public.member_events
                    where user_id = p.id and kind = 'rank' and detail = 'promotion' and to_value = p.faction_rank) me
where p.system_role <> 'pending' and me.at is not null
on conflict (user_id, kind, ref) do nothing;

-- The scenario result is computed here from the chosen path (the browser only sends the choices).
create or replace function public.submit_scenario_run(_scenario_id uuid, _choices text[])
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _me uuid := (select auth.uid());
  _s public.practice_scenarios%rowtype;
  _node text;
  _choice jsonb;
  _score integer := 0;
  _steps integer := 0;
  _percent integer;
  _passed boolean;
  _code text;
begin
  select * into _s from public.practice_scenarios where id = _scenario_id;
  if _s.id is null or not private.is_member() or not (_s.published or private.is_academy_instructor()) then
    raise exception 'A gyakorlat nem található.' using errcode = 'P0002';
  end if;
  if cardinality(coalesce(_choices, '{}')) > 40 then raise exception 'Érvénytelen út.' using errcode = '22023'; end if;
  _node := _s.start_node;
  while _node is not null and jsonb_array_length(coalesce(_s.nodes -> _node -> 'choices', '[]'::jsonb)) > 0 loop
    _steps := _steps + 1;
    if _steps > cardinality(coalesce(_choices, '{}')) then raise exception 'A gyakorlat nem ért véget.' using errcode = '22023'; end if;
    select c into _choice from jsonb_array_elements(_s.nodes -> _node -> 'choices') c where c ->> 'id' = _choices[_steps];
    if _choice is null then raise exception 'Érvénytelen út.' using errcode = '22023'; end if;
    _score := _score + coalesce((_choice ->> 'points')::int, 0);
    _node := nullif(_choice ->> 'next', '');
  end loop;
  if _steps <> cardinality(coalesce(_choices, '{}')) then raise exception 'Érvénytelen út.' using errcode = '22023'; end if;
  _percent := case when _s.max_score > 0 then round(_score * 100.0 / _s.max_score) else 100 end;
  _passed := _percent >= _s.pass_percent;

  insert into public.scenario_results (scenario_id, user_id, best_score, max_score, best_percent, passed, attempts, last_run_at)
  values (_scenario_id, _me, _score, _s.max_score, _percent, _passed, 1, now())
  on conflict (scenario_id, user_id) do update set best_score = greatest(public.scenario_results.best_score, excluded.best_score),
    max_score = excluded.max_score, best_percent = greatest(public.scenario_results.best_percent, excluded.best_percent),
    passed = public.scenario_results.passed or excluded.passed, attempts = public.scenario_results.attempts + 1, last_run_at = now();

  if _passed and _s.published then
    perform private.issue_certificate(_me, 'scenario', _scenario_id::text, _s.title, 'Szituációs gyakorlat teljesítve');
    select code into _code from public.certificates where user_id = _me and kind = 'scenario' and ref = _scenario_id::text;
  end if;
  return json_build_object('score', _score, 'max_score', _s.max_score, 'percent', _percent, 'passed', _passed, 'certificate', _code,
    'best', (select row_to_json(r) from public.scenario_results r where r.scenario_id = _scenario_id and r.user_id = _me));
end;
$$;

-- Public check of a certificate code (also for visitors, e.g. from a forum post).
create or replace function public.verify_certificate(_code text)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select case when c.id is null then null else json_build_object(
    'code', c.code, 'kind', c.kind, 'ref', case when c.kind in ('qualification', 'rank') then c.ref end,
    'title', c.title, 'subtitle', c.subtitle, 'issued_at', c.issued_at, 'valid', c.revoked_at is null, 'revoked_at', c.revoked_at,
    'holder', json_build_object('full_name', p.full_name, 'badge_number', p.badge_number, 'faction_rank', p.faction_rank))
  end
  from (select 1) x
  left join public.certificates c on c.code = upper(btrim(coalesce(_code, '')))
  left join public.profiles p on p.id = c.user_id
$$;

create or replace function public.get_my_certificates()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(json_agg(json_build_object('code', c.code, 'kind', c.kind, 'ref', c.ref, 'title', c.title, 'subtitle', c.subtitle,
                                             'issued_at', c.issued_at, 'revoked_at', c.revoked_at)
                           order by c.revoked_at is not null, c.issued_at desc), '[]'::json)
  from public.certificates c where c.user_id = (select auth.uid())
$$;

-- The practice page in one call: the member's decks, streaks, recent days, scenarios with results.
create or replace function public.get_practice_overview()
returns json
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _me uuid := (select auth.uid());
  _instructor boolean := private.is_academy_instructor();
begin
  if not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  return json_build_object(
    'decks', (select coalesce(json_object_agg(p.deck, json_build_object('cards', p.cards, 'answered', p.answered, 'correct', p.correct,
                                                                        'sessions', p.sessions, 'updated_at', p.updated_at)), '{}'::json)
              from public.practice_progress p where p.user_id = _me),
    'streak', private.practice_streak(_me),
    'best_streak', private.practice_best_streak(_me),
    'today', current_date,
    'days', (select coalesce(json_agg(json_build_object('day', d.day, 'answered', d.answered, 'correct', d.correct) order by d.day), '[]'::json)
             from public.practice_days d where d.user_id = _me and d.day > current_date - 42),
    'can_edit', _instructor,
    'scenarios', (select coalesce(json_agg(json_build_object(
                    'id', s.id, 'title', s.title, 'summary', s.summary, 'category', s.category, 'difficulty', s.difficulty,
                    'max_score', s.max_score, 'pass_percent', s.pass_percent, 'published', s.published, 'updated_at', s.updated_at,
                    'steps', (select count(*) from jsonb_object_keys(s.nodes)),
                    'result', (select row_to_json(r) from public.scenario_results r where r.scenario_id = s.id and r.user_id = _me),
                    'stats', case when _instructor then (select json_build_object('players', count(*), 'passed', count(*) filter (where passed))
                                                         from public.scenario_results r where r.scenario_id = s.id) end)
                  order by s.sort_order, s.title), '[]'::json)
                  from public.practice_scenarios s where s.published or _instructor),
    'certificates', (select count(*) from public.certificates where user_id = _me and revoked_at is null)
  );
end;
$$;

-- Sample scenarios for the instructors to review and publish (general procedure with the code
-- book's radio codes); members do not see them until they are published.
insert into public.practice_scenarios (title, summary, category, difficulty, start_node, nodes, pass_percent, published, sort_order)
values
('Minta: Közúti ellenőrzés', 'Egy szabálysértő megállításától az intézkedésig: rádió, megközelítés, arányosság.', 'traffic', 1, 'start',
 $json${
  "start": {"text": "Járőrözés közben egy szürke Sultan áthajt előtted a piroson. Mit teszel először?", "choices": [
    {"id": "a", "text": "Bekapcsolom a fényhidat, megállítom a járművet, és bemondom a rádióba a rendszámot és a helyet.", "next": "radio", "points": 2, "verdict": "good", "feedback": "Helyes: a kollégák tudják, hol vagy, és kit állítottál meg."},
    {"id": "b", "text": "Szirénával azonnal a kocsi elé vágok.", "next": "radio", "points": 0, "verdict": "bad", "feedback": "Veszélyes manőver: balesetet okozhatsz, és a sofőr is pánikba eshet."},
    {"id": "c", "text": "Hagyom, úgysem történt baj.", "next": "missed", "points": 0, "verdict": "bad", "feedback": "A szabálysértést kezelni kell, különben ismétlődik."}]},
  "radio": {"text": "A jármű lehúzódik. Mielőtt kiszállsz, mit mondasz be?", "choices": [
    {"id": "a", "text": "10-28: lekérem a jármű adatait, majd Code 6-tal jelzem, hogy kiszállok.", "next": "approach", "points": 2, "verdict": "good", "feedback": "Pontos: előbb a jármű ellenőrzése, aztán a kiszállás jelzése."},
    {"id": "b", "text": "Code 3.", "next": "approach", "points": 0, "verdict": "bad", "feedback": "A Code 3 sürgős vonulást jelent, nem intézkedést."},
    {"id": "c", "text": "Semmit, gyorsan elintézem.", "next": "approach", "points": 0, "verdict": "bad", "feedback": "Rádió nélkül senki sem tudja, hol vagy, ha baj történik."}]},
  "approach": {"text": "A sofőr idegesen keresgél a kesztyűtartóban. Hogyan közelítesz?", "choices": [
    {"id": "a", "text": "A jármű hátsó sarka felől, takarásban, és megkérem, hogy tegye a kezét a kormányra.", "next": "check", "points": 2, "verdict": "good", "feedback": "Biztonságos: látod a kezét, és nem állsz a forgalomban."},
    {"id": "b", "text": "Egyenesen az ablakhoz sétálok, háttal a forgalomnak.", "next": "check", "points": 0, "verdict": "bad", "feedback": "A forgalom és a jármű utasai is veszélyt jelenthetnek."},
    {"id": "c", "text": "Fegyvert rántok, és kiabálok.", "next": "check", "points": 0, "verdict": "bad", "feedback": "Aránytalan: nincs közvetlen fenyegetés."}]},
  "check": {"text": "Igazoltatod. A 10-29 alapján a sofőr nem körözött, de nincs nála jogosítvány. Mi a helyes?", "choices": [
    {"id": "a", "text": "Megnézem a tételt a kalkulátorban, kiszabom a bírságot, és elmagyarázom a döntést.", "next": "good_end", "points": 3, "verdict": "good", "feedback": "Arányos és átlátható intézkedés."},
    {"id": "b", "text": "Szóban figyelmeztetem, és elengedem.", "next": "ok_end", "points": 1, "verdict": "ok", "feedback": "Mérlegelhető, de rögzítsd jelentésben."},
    {"id": "c", "text": "Azonnal letartóztatom.", "next": "ok_end", "points": 0, "verdict": "bad", "feedback": "Aránytalan egy szabálysértésért."}]},
  "good_end": {"end": {"title": "Szép munka!", "text": "Biztonságos, szabályos ellenőrzés: rádió, óvatos megközelítés, arányos intézkedés."}},
  "ok_end": {"end": {"title": "Lezárva", "text": "Az ellenőrzés véget ért, de nézd át a visszajelzéseket."}},
  "missed": {"end": {"title": "Elszalasztott intézkedés", "text": "A szabálysértést nem hagyhatjuk figyelmen kívül."}}
 }$json$::jsonb, 70, false, 10),
('Minta: Üldözés a rádióban', 'Üldözés bejelentése, az egységek összehangolása és a helyes kódok.', 'radio', 2, 'start',
 $json${
  "start": {"text": "Egy jármű nem áll meg a jelzésedre, és nagy sebességgel elhajt. Mit mondasz be elsőként?", "choices": [
    {"id": "a", "text": "Bejelentem az üldözést: a helyet (10-20), a jármű típusát és az irányt.", "next": "backup", "points": 2, "verdict": "good", "feedback": "Ezekkel a kollégák be tudnak kapcsolódni."},
    {"id": "b", "text": "Code 99.", "next": "backup", "points": 0, "verdict": "bad", "feedback": "A Code 99 vészhelyzet: minden egységet hív, egy üldözéshez túlzás."},
    {"id": "c", "text": "Csak követem, majd utána beszámolok.", "next": "backup", "points": 0, "verdict": "bad", "feedback": "Rádió nélkül nem kapsz segítséget, és a kollégák sem tudják, merre jársz."}]},
  "backup": {"text": "Egy kolléga csatlakozik, már ő is a jármű mögött van. Mit kérsz?", "choices": [
    {"id": "a", "text": "Vegye át a második pozíciót; a többi egység ne zsúfolódjon össze, hanem zárja le az utakat.", "next": "stop", "points": 2, "verdict": "good", "feedback": "Rendezett üldözés: kevesebb baleset, több esély az elfogásra."},
    {"id": "b", "text": "Jöjjön ide mindenki, aki hall.", "next": "stop", "points": 0, "verdict": "bad", "feedback": "A zsúfolt üldözés balesetveszélyes."}]},
  "stop": {"text": "A gyanúsított egy zsákutcában lefullad, az egységek körbevették. Melyik kód illik ide?", "choices": [
    {"id": "a", "text": "Code 100: abban a helyzetben vagyunk, hogy elfogjuk.", "next": "custody", "points": 2, "verdict": "good", "feedback": "Pontosan."},
    {"id": "b", "text": "Code 4.", "next": "custody", "points": 0, "verdict": "bad", "feedback": "A Code 4 azt jelenti, nem kell több erősítés: még nem tartunk ott."},
    {"id": "c", "text": "10-22.", "next": "custody", "points": 0, "verdict": "bad", "feedback": "A 10-22 az előző üzenet figyelmen kívül hagyása."}]},
  "custody": {"text": "Megbilincselted, beültetted a járművedbe. Mit mondasz be?", "choices": [
    {"id": "a", "text": "10-15: a gyanúsított őrizetben, úton a fegyházhoz; a többi egység Code 4.", "next": "good_end", "points": 3, "verdict": "good", "feedback": "Mindenki tudja, hogy vége, és visszatérhet a járőrözéshez."},
    {"id": "b", "text": "10-8.", "next": "ok_end", "points": 0, "verdict": "bad", "feedback": "A 10-8 szolgálatba állás."}]},
  "good_end": {"end": {"title": "Elfogva!", "text": "Tiszta rádióforgalmazás az első perctől az őrizetbe vételig."}},
  "ok_end": {"end": {"title": "Elfogva", "text": "A gyanúsított őrizetben van, de a kódokat érdemes átismételni a Kódtárban."}}
 }$json$::jsonb, 70, false, 20);

update public.practice_scenarios set max_score = (private.scenario_analyse(nodes, start_node)).max_score;

-- ---------------------------------------------------------------------------
-- 4. Leaderboard (opt-in), monthly recap, service record
-- ---------------------------------------------------------------------------

create table public.member_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  leaderboard_visible boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.member_settings enable row level security;
revoke all on public.member_settings from anon, authenticated;

create or replace function public.set_leaderboard_visibility(_visible boolean)
returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  insert into public.member_settings (user_id, leaderboard_visible) values ((select auth.uid()), coalesce(_visible, false))
  on conflict (user_id) do update set leaderboard_visible = excluded.leaderboard_visible, updated_at = now();
  return json_build_object('visible', coalesce(_visible, false));
end;
$$;

-- One month (default: the current one). Only members who chose to appear are listed (top ten per
-- category); the caller also gets their own value and the place they would hold among them.
-- Practice counts the days with at least ten answers (the answers themselves are checked in the browser).
create or replace function public.get_leaderboard(_month date default null)
returns json
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _me uuid := (select auth.uid());
  _m date;
  _next date;
begin
  if not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  _m := (date_trunc('month', coalesce(_month, current_date)::timestamp))::date;
  _next := (_m + interval '1 month')::date;
  return (
    with members as (
      select p.id, p.full_name, p.badge_number, p.faction_rank, p.avatar_url, coalesce(s.leaderboard_visible, false) as visible
      from public.profiles p left join public.member_settings s on s.user_id = p.id
      where p.system_role <> 'pending'
    ), pool as (
      select * from members where visible or id = _me
    ), scores as (
      select 'duty' as category, m.id,
             coalesce((select e.minutes from public.duty_time_entries e where e.user_id = m.id and e.month = _m), 0)::bigint as value
      from pool m
      union all
      select 'reports', m.id, (select count(*) from public.report_logs r where r.user_id = m.id and r.month = _m) from pool m
      union all
      select 'events', m.id, (select count(*) from public.event_attendance a join public.events e on e.id = a.event_id
                              where a.user_id = m.id and e.starts_at >= _m and e.starts_at < _next and e.cancelled_at is null)
      from pool m
      union all
      select 'practice', m.id, (select count(*) from public.practice_days d
                                where d.user_id = m.id and d.day >= _m and d.day < _next and d.answered >= 10)
      from pool m
    ), ranked as (
      select s.category, s.id, s.value, rank() over (partition by s.category order by s.value desc) as place
      from scores s where s.value > 0
    )
    select json_build_object(
      'month', _m,
      'visible', coalesce((select visible from members where id = _me), false),
      'participants', (select count(*) from members where visible),
      'categories', (
        select json_agg(json_build_object(
          'key', c.key,
          'entries', (select coalesce(json_agg(json_build_object('user_id', t.id, 'full_name', t.full_name, 'badge_number', t.badge_number,
                                                               'faction_rank', t.faction_rank, 'avatar_url', t.avatar_url,
                                                               'value', t.value, 'place', t.place, 'me', t.id = _me)
                                             order by t.place, t.full_name), '[]'::json)
                      from (select r.place, r.value, m.* from ranked r join members m on m.id = r.id
                            where r.category = c.key and m.visible order by r.place, m.full_name limit 10) t),
          'me', (select json_build_object('value', r.value, 'place', r.place,
                                          'of', (select count(*) from ranked x where x.category = c.key))
                 from ranked r where r.category = c.key and r.id = _me)
        ) order by c.ord)
        from (values ('duty', 1), ('reports', 2), ('events', 3), ('practice', 4)) as c(key, ord))
    )
  );
end;
$$;

-- The member's own month in numbers (the end-of-month recap; default: last month).
create or replace function public.get_monthly_recap(_month date default null)
returns json
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _me uuid := (select auth.uid());
  _m date;
  _next date;
  _duty integer;
  _reports integer;
  _snapshot jsonb;
begin
  if not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  _m := (date_trunc('month', coalesce(_month, (current_date - interval '1 month')::date)::timestamp))::date;
  _next := (_m + interval '1 month')::date;
  select minutes into _duty from public.duty_time_entries where user_id = _me and month = _m;
  select count(*) into _reports from public.report_logs where user_id = _me and month = _m;
  select e.snapshot into _snapshot from public.payroll_entries e join public.payroll_runs r on r.month = e.month and r.status = 'closed'
  where e.user_id = _me and e.month = _m;
  return json_build_object(
    'month', _m,
    'duty_minutes', _duty,
    'duty_avg', (select round(avg(minutes)) from public.duty_time_entries where month = _m and minutes > 0),
    'duty_better_than', case when _duty is not null then
      (select round(100.0 * count(*) filter (where minutes < _duty) / nullif(count(*), 0)) from public.duty_time_entries where month = _m) end,
    'reports', _reports,
    'reports_avg', (select round(avg(n), 1) from (select count(*) as n from public.report_logs where month = _m group by user_id) x),
    'reports_better_than', (select round(100.0 * count(*) filter (where coalesce(x.n, 0) < _reports) / nullif(count(*), 0))
                            from public.profiles p
                            left join (select user_id, count(*) as n from public.report_logs where month = _m group by user_id) x on x.user_id = p.id
                            where p.system_role <> 'pending'),
    'events_attended', (select count(*) from public.event_attendance a join public.events e on e.id = a.event_id
                        where a.user_id = _me and e.starts_at >= _m and e.starts_at < _next and e.cancelled_at is null),
    'events_total', (select count(*) from public.events e
                     where e.starts_at >= _m and e.starts_at < _next and e.cancelled_at is null and e.attendance_taken_at is not null
                       and _me = any(private.event_audience_ids(e.audience))),
    'practice_correct', (select coalesce(sum(correct), 0) from public.practice_days where user_id = _me and day >= _m and day < _next),
    'practice_days', (select count(*) from public.practice_days where user_id = _me and day >= _m and day < _next),
    'pay', case when _snapshot is not null then (_snapshot ->> 'total')::bigint end,
    'top_duty', nullif((_snapshot ->> 'top_duty')::int, 0),
    'top_report', nullif((_snapshot ->> 'top_report')::int, 0),
    'promotions', (select coalesce(json_agg(json_build_object('to', to_value, 'at', created_at) order by created_at), '[]'::json)
                   from public.member_events where user_id = _me and kind = 'rank' and detail = 'promotion'
                     and created_at >= _m and created_at < _next),
    'awards', (select coalesce(json_agg(json_build_object('name', r.name, 'color_hex', r.color_hex) order by ur.awarded_at), '[]'::json)
               from public.user_ribbons ur join public.ribbons r on r.id = ur.ribbon_id
               where ur.user_id = _me and ur.awarded_at >= _m and ur.awarded_at < _next),
    'certificates', (select count(*) from public.certificates
                     where user_id = _me and issued_at >= _m and issued_at < _next and revoked_at is null),
    'leaderboard_visible', coalesce((select leaderboard_visible from public.member_settings where user_id = _me), false)
  );
end;
$$;

-- A member's printable service record (the member and the staff). Internal notes stay out.
create or replace function public.get_service_record(_user_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _me uuid := (select auth.uid());
  _p public.profiles%rowtype;
  _from date := ((date_trunc('month', current_date::timestamp)) - interval '11 months')::date;
begin
  if not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  select * into _p from public.profiles where id = _user_id and system_role <> 'pending';
  if _p.id is null then raise exception 'A tag nem található.' using errcode = 'P0002'; end if;
  if _p.id <> _me and not private.is_staff() then
    raise exception 'Más szolgálati lapját a vezetőség nyomtathatja.' using errcode = '42501';
  end if;
  return json_build_object(
    'generated_at', now(),
    'generated_by', (select full_name from public.profiles where id = _me),
    'member', json_build_object('id', _p.id, 'full_name', _p.full_name, 'badge_number', _p.badge_number, 'faction_rank', _p.faction_rank,
      'division', _p.division, 'division_rank', _p.division_rank, 'qualifications', _p.qualifications, 'avatar_url', _p.avatar_url,
      'is_bureau_manager', _p.is_bureau_manager, 'is_bureau_commander', _p.is_bureau_commander,
      'commanded_divisions', _p.commanded_divisions, 'created_at', _p.created_at, 'last_promotion_date', _p.last_promotion_date),
    'details', (select json_build_object('station', d.station, 'joined_on', d.joined_on, 'join_type', d.join_type,
                                         'activity_status', d.activity_status)
                from public.member_details d where d.user_id = _p.id),
    'history', (select coalesce(json_agg(json_build_object('kind', e.kind, 'from_value', e.from_value, 'to_value', e.to_value,
                                                         'detail', e.detail, 'created_at', e.created_at,
                                                         'actor_name', (select full_name from public.profiles where id = e.actor_id))
                                       order by e.created_at), '[]'::json)
                from public.member_events e
                where e.user_id = _p.id and e.kind in ('joined', 'rank', 'division', 'division_rank', 'qualifications', 'bureau_role')),
    'awards', (select coalesce(json_agg(json_build_object('name', r.name, 'color_hex', r.color_hex, 'awarded_at', ur.awarded_at)
                                      order by ur.awarded_at), '[]'::json)
               from public.user_ribbons ur join public.ribbons r on r.id = ur.ribbon_id where ur.user_id = _p.id),
    'records', (select coalesce(json_agg(json_build_object('kind', h.kind, 'title', h.title, 'created_at', h.created_at)
                                       order by h.created_at), '[]'::json)
                from public.hr_records h where h.user_id = _p.id and h.kind in ('warning', 'commendation') and h.status = 'active'),
    'duty', (select coalesce(json_agg(json_build_object('month', e.month, 'minutes', e.minutes) order by e.month), '[]'::json)
             from public.duty_time_entries e where e.user_id = _p.id and e.month >= _from),
    'reports', (select coalesce(json_agg(json_build_object('month', x.month, 'count', x.n) order by x.month), '[]'::json)
                from (select month, count(*) as n from public.report_logs where user_id = _p.id and month >= _from group by month) x),
    'attendance', (select json_build_object(
                     'attended', count(*) filter (where exists (select 1 from public.event_attendance a where a.event_id = e.id and a.user_id = _p.id)),
                     'total', count(*))
                   from public.events e
                   where e.attendance_taken_at is not null and e.cancelled_at is null and e.starts_at > now() - interval '180 days'
                     and _p.id = any(private.event_audience_ids(e.audience))),
    'exams', (select coalesce(json_agg(json_build_object('title', x.title, 'graded_at', x.graded_at, 'percentage', x.percentage)
                                     order by x.graded_at), '[]'::json)
              from (select distinct on (s.exam_id) e.title, coalesce(s.graded_at, s.end_time) as graded_at,
                           case when s.max_score > 0 then round(s.total_score * 100.0 / s.max_score) end as percentage
                    from public.exam_submissions s join public.exams e on e.id = s.exam_id
                    where s.user_id = _p.id and s.status = 'passed' and s.deleted_at is null
                    order by s.exam_id, coalesce(s.graded_at, s.end_time) desc) x),
    'certificates', (select coalesce(json_agg(json_build_object('code', c.code, 'kind', c.kind, 'ref', c.ref, 'title', c.title,
                                                              'issued_at', c.issued_at) order by c.issued_at), '[]'::json)
                     from public.certificates c where c.user_id = _p.id and c.revoked_at is null)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Penal code changes: announced once per new version by the daily job
-- ---------------------------------------------------------------------------

create table private.app_state (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);
revoke all on private.app_state from public, anon, authenticated;

-- The first call only records the version (there is nothing to compare with yet); a later call
-- with a new version notifies every member once.
create or replace function public.announce_penal_code(_version text, _title text, _summary text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  _known text;
begin
  if _version is null or char_length(_version) not between 4 and 80 then raise exception 'Érvénytelen verzió.' using errcode = '22023'; end if;
  select value into _known from private.app_state where key = 'penal_code_version';
  if _known is not distinct from _version then return false; end if;
  insert into private.app_state (key, value, updated_at) values ('penal_code_version', _version, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
  if _known is null then return false; end if;
  perform private.notify(private.member_ids(), left(coalesce(nullif(btrim(_title), ''), 'Változott a Btk.'), 160),
    left(coalesce(nullif(btrim(_summary), ''), 'Nézd meg a kalkulátorban, mi változott.'), 600),
    'info', 'announcement', '/calculator?changes=1', 'penal-code');
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Dashboard counters and the payslips' duty tiers (every earlier key unchanged)
-- ---------------------------------------------------------------------------

create or replace function public.get_dashboard_summary()
returns json
language plpgsql
stable
security definer
set search_path = public, pg_temp
set timezone = 'Europe/Budapest'
as $$
declare
  _me profiles%rowtype := private.me();
  _staff boolean;
  _admin boolean;
  _coach boolean;
  _month date := date_trunc('month', current_date)::date;
  _prev date := (date_trunc('month', current_date) - interval '1 month')::date;
  _duty integer;
begin
  if _me.id is null then
    raise exception 'Nincs jogosultságod.' using errcode = '42501';
  end if;
  _staff := private.is_staff();
  _admin := private.is_admin();
  _coach := private.can_coach_trainees();
  select minutes into _duty from duty_time_entries where user_id = _me.id and month = _month;

  return json_build_object(
    'unread_notifications', (select count(*) from notifications where user_id = _me.id and not is_read),
    'pending_exam_sheets', (select count(*) from exam_submissions s
                            where s.status = 'pending' and s.deleted_at is null
                              and s.user_id is distinct from _me.id and private.has_grading_rights(s.id)),
    'pending_registrations', case when _staff then (select count(*) from profiles where system_role = 'pending') end,
    'pending_leave_requests', case when _staff then
      (select count(*) from hr_records where kind = 'leave' and status = 'pending' and user_id <> _me.id) end,
    'pending_vehicle_requests', case when _staff then (select count(*) from vehicle_requests where status = 'pending') end,
    'pending_budget_requests', case when _admin then (select count(*) from budget_requests where status = 'pending') end,
    -- Requests and renewals waiting for an approver.
    'pending_warrants', case when private.can_approve_warrants() then
      (select count(*) from case_warrants where status = 'pending' or (status = 'approved' and renewal_requested_at is not null)) end,
    'my_open_cases', case when private.can_view_cases() or exists (select 1 from case_collaborators where user_id = _me.id) then
      (select count(*) from cases c where c.status = 'open'
         and (c.owner_id = _me.id or exists (select 1 from case_collaborators cc where cc.case_id = c.id and cc.user_id = _me.id))) end,
    'my_pending_requests', (select count(*) from vehicle_requests where user_id = _me.id and status = 'pending')
                           + (select count(*) from budget_requests where user_id = _me.id and status = 'pending'),
    'my_active_warnings', (select count(*) from hr_records where user_id = _me.id and kind = 'warning' and status = 'active'),
    'my_vehicle_warnings', (select count(*) from vehicle_warnings
                            where user_id = _me.id and revoked_at is null and converted_record_id is null),
    'my_vehicles_due', (select count(*) from fleet_vehicles v
                        where v.is_active and v.registration_required
                          and exists (select 1 from fleet_assignments a where a.vehicle_id = v.id and a.user_id = _me.id)
                          and (v.registration_expires_on is null or v.registration_expires_on <= current_date + 3)
                          and not exists (select 1 from fleet_registration_requests r
                                          where r.vehicle_id = v.id and r.status = 'pending')),
    'fleet_registration_due', case when _staff then
      (select count(*) from fleet_vehicles
       where is_active and registration_required and registration_expires_on is not null
         and registration_expires_on <= current_date + 3) end,
    'fleet_registration_reviews', case when _staff then
      (select count(*) from fleet_registration_requests where status = 'pending') end,
    'members_total', (select count(*) from profiles where system_role <> 'pending'),
    'members_on_leave', (select count(*) from hr_records where kind = 'leave' and status = 'active'
                           and current_date between starts_on and ends_on),
    -- The member's month against the requirements (duty time is recorded by staff at the meetings).
    'my_month', json_build_object(
      'month', _month,
      'reports', (select count(*) from report_logs where user_id = _me.id and month = _month),
      'duty_minutes', _duty,
      'duty_updated_at', (select updated_at from duty_time_entries where user_id = _me.id and month = _month),
      'min_reports', (select min_reports from payroll_settings where id = 'global'),
      'min_duty_hours', (select min_duty_hours from payroll_settings where id = 'global'),
      -- The next duty tier above the recorded time: its hours and the extra pay it brings.
      'next_tier', (select json_build_object('hours', (t ->> 'hours')::int,
                                             'gain', (t ->> 'pay')::bigint
                                                     - coalesce((select max((x ->> 'pay')::bigint) from jsonb_array_elements(s.duty_tiers) x
                                                                 where (x ->> 'hours')::int * 60 <= coalesce(_duty, 0)), 0))
                    from payroll_settings s cross join lateral jsonb_array_elements(s.duty_tiers) t
                    where s.id = 'global' and (t ->> 'hours')::int * 60 > coalesce(_duty, 0)
                    order by (t ->> 'hours')::int limit 1)),
    -- The next events the member sees (within two weeks; ongoing ones stay for three hours).
    'upcoming_events', (
      select coalesce(json_agg(row_to_json(x) order by x.starts_at), '[]'::json)
      from (
        select e.id, e.title, e.kind, e.starts_at, e.ends_at, e.location, e.rsvp, r.status as my_status
        from events e
        left join event_responses r on r.event_id = e.id and r.user_id = _me.id
        where e.cancelled_at is null
          and coalesce(e.ends_at, e.starts_at + interval '3 hours') > now()
          and e.starts_at < now() + interval '14 days'
          and private.can_see_event(e.audience)
        order by e.starts_at
        limit 3
      ) x),
    'my_case_tasks', (select json_build_object('open', count(*), 'overdue', count(*) filter (where t.due_on < current_date))
                      from case_tasks t join cases c on c.id = t.case_id
                      where t.assignee_id = _me.id and t.done_at is null and c.status = 'open'),
    'policies_to_acknowledge', (select count(*) from policies p
                                where p.status = 'published' and p.version > 0 and p.requires_ack
                                  and not exists (select 1 from policy_acknowledgements a
                                                  where a.policy_id = p.id and a.user_id = _me.id and a.version = p.version)),
    'open_polls', (select count(*) from polls p
                   where p.closed_at is null and p.closes_at > now() and private.can_see_event(p.audience)
                     and not exists (select 1 from poll_voters v where v.poll_id = p.id and v.user_id = _me.id)),
    'nominations_pending', case when private.rank_index(_me.faction_rank) <= 6 or coalesce(_me.is_bureau_manager, false) then
      (select count(*) from promotion_nominations n
       where n.status = 'pending' and n.user_id <> _me.id and private.can_decide_promotion(n.to_rank)) end,
    'trainees_ready', case when _coach then
      (select count(*) from trainee_mentors tm join profiles p on p.id = tm.trainee_id
       where tm.signed_off_at is not null and tm.completed_at is null
         and p.faction_rank = 'Deputy Sheriff Trainee' and p.system_role <> 'pending') end,
    'trainees_without_mentor', case when _coach then
      (select count(*) from profiles p
       where p.faction_rank = 'Deputy Sheriff Trainee' and p.system_role <> 'pending' and coalesce(p.onboarding_completed, false)
         and not exists (select 1 from trainee_mentors tm where tm.trainee_id = p.id and tm.mentor_id is not null)) end,
    'mentees', (select count(*) from trainee_mentors tm join profiles p on p.id = tm.trainee_id
                where tm.mentor_id = _me.id and tm.completed_at is null and p.faction_rank = 'Deputy Sheriff Trainee'),
    'feedback_new', case when private.can_read_feedback('command') or private.can_read_feedback('manager') then
      (select count(*) from feedback_reports f where f.status = 'new' and private.can_read_feedback(f.recipient)) end,
    -- The month of the end-of-month recap: last month, once its pay is closed or a few days in.
    'recap_month', case when exists (select 1 from payroll_runs where month = _prev and status = 'closed')
                             or current_date >= _month + 4 then _prev end
  );
end;
$$;

-- A member's own pay of the closed months, with the duty tiers the month was computed with.
create or replace function public.get_my_payslips()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(json_agg(json_build_object('month', e.month, 'row', e.snapshot, 'paid', e.paid, 'paid_at', e.paid_at,
                                             'duty_tiers', r.settings -> 'duty_tiers', 'min_duty_hours', r.settings -> 'min_duty_hours')
                           order by e.month desc), '[]'::json)
  from public.payroll_entries e
  join public.payroll_runs r on r.month = e.month and r.status = 'closed'
  where e.user_id = (select auth.uid()) and e.snapshot is not null
$$;

-- ---------------------------------------------------------------------------
-- 7. Privileges
-- ---------------------------------------------------------------------------

revoke execute on function
  public.save_practice_session(text, jsonb, integer, integer), public.save_scenario(uuid, jsonb), public.delete_scenario(uuid),
  public.get_scenario(uuid), public.submit_scenario_run(uuid, text[]), public.verify_certificate(text), public.get_my_certificates(),
  public.get_practice_overview(), public.set_leaderboard_visibility(boolean), public.get_leaderboard(date),
  public.get_monthly_recap(date), public.get_service_record(uuid), public.announce_penal_code(text, text, text)
from public, anon, authenticated;
grant execute on function
  public.save_practice_session(text, jsonb, integer, integer), public.save_scenario(uuid, jsonb), public.delete_scenario(uuid),
  public.get_scenario(uuid), public.submit_scenario_run(uuid, text[]), public.get_my_certificates(),
  public.get_practice_overview(), public.set_leaderboard_visibility(boolean), public.get_leaderboard(date),
  public.get_monthly_recap(date), public.get_service_record(uuid)
to authenticated;
-- The certificate check is public: anyone with a code may verify it.
grant execute on function public.verify_certificate(text) to anon, authenticated;
grant execute on function public.announce_penal_code(text, text, text) to service_role;
