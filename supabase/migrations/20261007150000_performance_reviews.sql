-- Performance reviews: a quarterly evaluation of a member by a staff member above them (the rule of
-- warnings and commendations). Six criteria scored 1–5, strengths, things to improve and goals. A
-- draft is the reviewer's; shared, the member reads it and acknowledges it (optionally answering).
-- The promotion board shows each member's latest shared review.

create table if not exists public.performance_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reviewer_id uuid references public.profiles(id) on delete set null,
  period text not null check (period ~ '^\d{4}-Q[1-4]$'),
  scores jsonb not null default '{}'::jsonb,
  overall numeric(3, 2),
  strengths text check (char_length(strengths) <= 3000),
  improvements text check (char_length(improvements) <= 3000),
  goals text check (char_length(goals) <= 3000),
  status text not null default 'draft' check (status in ('draft', 'shared', 'acknowledged')),
  shared_at timestamptz,
  acknowledged_at timestamptz,
  member_comment text check (char_length(member_comment) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period)
);
create index if not exists performance_reviews_reviewer_idx on public.performance_reviews (reviewer_id);

alter table public.performance_reviews enable row level security;
revoke all on public.performance_reviews from anon, authenticated;

-- The criteria (src/lib/reviews.ts keeps the labels in the same order).
create or replace function private.review_criteria()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['activity', 'reports', 'teamwork', 'conduct', 'knowledge', 'initiative']
$$;
revoke execute on function private.review_criteria() from public, anon, authenticated;

-- "2026-Q4": the quarter of a moment in Hungarian time.
create or replace function private.quarter_key(_at timestamptz default now())
returns text
language sql
stable
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
  select to_char(_at, 'YYYY') || '-Q' || to_char(_at, 'Q')
$$;
revoke execute on function private.quarter_key(timestamptz) from public, anon, authenticated;

-- Who writes a member's review: staff above them, never themselves (the warning rule).
create or replace function private.can_write_review(_target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_staff() and _target is distinct from (select auth.uid()) and private.outranks(_target)
$$;
revoke execute on function private.can_write_review(uuid) from public, anon, authenticated;

-- Who reads a review: the member once it is shared, its reviewer, the staff (drafts: the Executive
-- Staff and the Bureau Manager too).
create or replace function private.can_read_review(_r public.performance_reviews)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (_r.user_id = (select auth.uid()) and _r.status <> 'draft')
      or _r.reviewer_id = (select auth.uid())
      or (private.is_staff() and (_r.status <> 'draft' or private.is_executive_or_manager()))
$$;
revoke execute on function private.can_read_review(public.performance_reviews) from public, anon, authenticated;

create or replace function private.review_json(_r public.performance_reviews)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'id', _r.id, 'user_id', _r.user_id, 'period', _r.period, 'scores', _r.scores, 'overall', _r.overall,
    'strengths', _r.strengths, 'improvements', _r.improvements, 'goals', _r.goals,
    'status', _r.status, 'shared_at', _r.shared_at, 'acknowledged_at', _r.acknowledged_at, 'member_comment', _r.member_comment,
    'created_at', _r.created_at, 'updated_at', _r.updated_at,
    'member', (select json_build_object('id', p.id, 'full_name', p.full_name, 'faction_rank', p.faction_rank,
                                        'badge_number', p.badge_number, 'avatar_url', p.avatar_url)
               from public.profiles p where p.id = _r.user_id),
    'reviewer', (select json_build_object('id', p.id, 'full_name', p.full_name, 'faction_rank', p.faction_rank,
                                          'badge_number', p.badge_number, 'avatar_url', p.avatar_url)
                 from public.profiles p where p.id = _r.reviewer_id),
    'can_edit', _r.status = 'draft' and private.can_write_review(_r.user_id)
                and (_r.reviewer_id = (select auth.uid()) or _r.reviewer_id is null),
    'can_delete', (_r.status = 'draft' and _r.reviewer_id = (select auth.uid())) or private.is_executive_or_manager(),
    'can_acknowledge', _r.status = 'shared' and _r.user_id = (select auth.uid()))
$$;
revoke execute on function private.review_json(public.performance_reviews) from public, anon, authenticated;

-- A member's reviews (own when _user_id is null), newest first.
create or replace function public.get_reviews(_user_id uuid default null)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _target uuid := coalesce(_user_id, (select auth.uid()));
begin
  if not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  if _target is distinct from (select auth.uid()) and not private.is_staff() then
    raise exception 'Más értékelését a Supervisory Staff és felette látja.' using errcode = '42501';
  end if;
  return json_build_object(
    'can_write', private.can_write_review(_target),
    'current_period', private.quarter_key(),
    'reviews', coalesce((select json_agg(private.review_json(r) order by r.period desc)
                         from public.performance_reviews r where r.user_id = _target and private.can_read_review(r)), '[]'::json));
end;
$$;
revoke execute on function public.get_reviews(uuid) from public, anon, authenticated;
grant execute on function public.get_reviews(uuid) to authenticated;

-- The HR tab: every member with their latest review and this quarter's (staff).
create or replace function public.get_review_overview(_period text default null)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _quarter text := coalesce(nullif(_period, ''), private.quarter_key());
begin
  if not private.is_staff() then
    raise exception 'Az értékeléseket a Supervisory Staff és felette látja.' using errcode = '42501';
  end if;
  if _quarter !~ '^\d{4}-Q[1-4]$' then raise exception 'Érvénytelen negyedév.' using errcode = '22023'; end if;
  return json_build_object(
    'period', _quarter,
    'current_period', private.quarter_key(),
    'members', coalesce((
      select json_agg(json_build_object(
        'user_id', p.id, 'full_name', p.full_name, 'faction_rank', p.faction_rank, 'badge_number', p.badge_number,
        'avatar_url', p.avatar_url, 'division', p.division,
        'can_write', private.can_write_review(p.id),
        'review', (select private.review_json(r) from public.performance_reviews r
                   where r.user_id = p.id and r.period = _quarter and private.can_read_review(r)),
        'last', (select json_build_object('period', r.period, 'overall', r.overall, 'status', r.status)
                 from public.performance_reviews r
                 where r.user_id = p.id and r.status <> 'draft' and r.period < _quarter
                 order by r.period desc limit 1))
        order by private.rank_index(p.faction_rank), p.full_name)
      from public.profiles p
      where p.system_role <> 'pending' and p.faction_rank is distinct from 'Deputy Sheriff Trainee'), '[]'::json));
end;
$$;
revoke execute on function public.get_review_overview(text) from public, anon, authenticated;
grant execute on function public.get_review_overview(text) to authenticated;

-- Creates or updates a draft (one review per member and quarter).
create or replace function public.save_review(_id uuid, _user_id uuid, _period text, _review jsonb)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := (select auth.uid());
  _r public.performance_reviews%rowtype;
  _scores jsonb := '{}'::jsonb;
  _key text;
  _value integer;
begin
  if _id is not null then
    select * into _r from public.performance_reviews where id = _id for update;
    if _r.id is null then raise exception 'Az értékelés nem található.' using errcode = 'P0002'; end if;
    if _r.status <> 'draft' then raise exception 'A megosztott értékelés már nem módosítható.' using errcode = '22023'; end if;
    if _r.reviewer_id is not null and _r.reviewer_id <> _uid then
      raise exception 'Ezt a piszkozatot más írja.' using errcode = '42501';
    end if;
    _user_id := _r.user_id;
    _period := _r.period;
  end if;
  if not private.can_write_review(_user_id) then
    raise exception 'Értékelést a Supervisory Staff és felette ír, a nála alacsonyabb rangúakról.' using errcode = '42501';
  end if;
  if coalesce(_period, '') !~ '^\d{4}-Q[1-4]$' then raise exception 'Érvénytelen negyedév.' using errcode = '22023'; end if;
  if _period > private.quarter_key() then raise exception 'Jövőbeli negyedévről nem írható értékelés.' using errcode = '22023'; end if;

  -- Only the known criteria, whole numbers from 1 to 5.
  for _key in select unnest(private.review_criteria()) loop
    if (_review -> 'scores') ? _key and jsonb_typeof(_review -> 'scores' -> _key) = 'number' then
      _value := (_review -> 'scores' ->> _key)::numeric::integer;
      if _value between 1 and 5 then _scores := _scores || jsonb_build_object(_key, _value); end if;
    end if;
  end loop;

  if _id is null then
    if exists (select 1 from public.performance_reviews where user_id = _user_id and period = _period) then
      raise exception 'Erre a negyedévre már készült értékelés a tagról.' using errcode = '23505';
    end if;
    insert into public.performance_reviews (user_id, reviewer_id, period, scores, overall, strengths, improvements, goals)
    values (_user_id, _uid, _period, _scores,
            (select round(avg(value::numeric), 2) from jsonb_each_text(_scores)),
            nullif(btrim(_review ->> 'strengths'), ''), nullif(btrim(_review ->> 'improvements'), ''), nullif(btrim(_review ->> 'goals'), ''))
    returning * into _r;
  else
    update public.performance_reviews set
      reviewer_id = _uid, scores = _scores,
      overall = (select round(avg(value::numeric), 2) from jsonb_each_text(_scores)),
      strengths = nullif(btrim(_review ->> 'strengths'), ''), improvements = nullif(btrim(_review ->> 'improvements'), ''),
      goals = nullif(btrim(_review ->> 'goals'), ''), updated_at = now()
    where id = _id returning * into _r;
  end if;
  return private.review_json(_r);
end;
$$;
revoke execute on function public.save_review(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.save_review(uuid, uuid, text, jsonb) to authenticated;

-- Shares a complete draft with the member (every criterion scored).
create or replace function public.share_review(_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _r public.performance_reviews%rowtype;
begin
  select * into _r from public.performance_reviews where id = _id for update;
  if _r.id is null then raise exception 'Az értékelés nem található.' using errcode = 'P0002'; end if;
  if _r.status <> 'draft' then raise exception 'Az értékelést már megosztották.' using errcode = '22023'; end if;
  if _r.reviewer_id is distinct from (select auth.uid()) or not private.can_write_review(_r.user_id) then
    raise exception 'Az értékelést az írója oszthatja meg.' using errcode = '42501';
  end if;
  if (select count(*) from jsonb_object_keys(_r.scores)) < cardinality(private.review_criteria()) then
    raise exception 'Megosztás előtt pontozd mind a hat szempontot.' using errcode = '22023';
  end if;
  update public.performance_reviews set status = 'shared', shared_at = now(), updated_at = now() where id = _id returning * into _r;
  perform private.notify(array[_r.user_id], 'Új teljesítményértékelés',
    format('%s · átlag: %s. Olvasd el, és jelezd vissza, hogy megismerted.', replace(_r.period, '-', ' '), replace(_r.overall::text, '.', ',')),
    'info', 'hr', '/profile?tab=reviews', 'review:' || _r.id);
  return private.review_json(_r);
end;
$$;
revoke execute on function public.share_review(uuid) from public, anon, authenticated;
grant execute on function public.share_review(uuid) to authenticated;

-- The member acknowledges a shared review, optionally answering it.
create or replace function public.acknowledge_review(_id uuid, _comment text default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _r public.performance_reviews%rowtype;
begin
  select * into _r from public.performance_reviews where id = _id for update;
  if _r.id is null or _r.user_id is distinct from (select auth.uid()) or _r.status = 'draft' then
    raise exception 'Az értékelés nem található.' using errcode = 'P0002';
  end if;
  if _r.status = 'acknowledged' then raise exception 'Ezt az értékelést már visszajelezted.' using errcode = '22023'; end if;
  update public.performance_reviews
  set status = 'acknowledged', acknowledged_at = now(), member_comment = nullif(left(btrim(coalesce(_comment, '')), 2000), ''), updated_at = now()
  where id = _id returning * into _r;
  if _r.reviewer_id is not null then
    perform private.notify(array[_r.reviewer_id], 'Értékelés visszaigazolva',
      format('%s megismerte a(z) %s értékelését%s', private.member_name(_r.user_id), _r.period,
             case when _r.member_comment is not null then ', és válaszolt rá.' else '.' end),
      'info', 'hr', '/hr?tab=reviews', 'review-ack:' || _r.id);
  end if;
  return private.review_json(_r);
end;
$$;
revoke execute on function public.acknowledge_review(uuid, text) from public, anon, authenticated;
grant execute on function public.acknowledge_review(uuid, text) to authenticated;

-- A draft by its reviewer; any review by the Executive Staff and the Bureau Manager.
create or replace function public.delete_review(_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _r public.performance_reviews%rowtype;
begin
  select * into _r from public.performance_reviews where id = _id;
  if _r.id is null then raise exception 'Az értékelés nem található.' using errcode = 'P0002'; end if;
  if not ((_r.status = 'draft' and _r.reviewer_id = (select auth.uid())) or private.is_executive_or_manager()) then
    raise exception 'Megosztott értékelést az Executive Staff és a Bureau Manager törölhet.' using errcode = '42501';
  end if;
  delete from public.performance_reviews where id = _id;
end;
$$;
revoke execute on function public.delete_review(uuid) from public, anon, authenticated;
grant execute on function public.delete_review(uuid) to authenticated;

-- The promotion board shows each member's latest shared review (every earlier key kept).
do $do$
declare
  _def text := replace(pg_get_functiondef('public.get_promotion_board()'::regprocedure), chr(13), '');
  _anchor text := $a$select private.promotion_status(p, c, _current) as item$a$;
begin
  if position('last_review' in _def) = 0 then
    if position(_anchor in _def) = 0 then raise exception 'get_promotion_board: the anchor for last_review was not found'; end if;
    _def := replace(_def, _anchor, $b$select private.promotion_status(p, c, _current)
                 || jsonb_build_object('last_review', (
                      select jsonb_build_object('period', r.period, 'overall', r.overall)
                      from public.performance_reviews r
                      where r.user_id = p.id and r.status <> 'draft'
                      order by r.period desc limit 1)) as item$b$);
    execute _def;
  end if;
end;
$do$;
