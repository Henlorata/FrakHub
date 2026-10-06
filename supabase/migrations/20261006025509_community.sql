-- =============================================================================
-- Community: the policy library (versioned, with "must read" acknowledgements),
-- polls (optionally anonymous), the suggestion board with votes, and anonymous
-- feedback to the leadership (rate limited, answerable, without revealing who).
--
-- Compatible with the deployed frontend: new tables and functions; the
-- notification category list only grows.
-- =============================================================================

alter table public.notifications drop constraint notifications_category_check;
alter table public.notifications add constraint notifications_category_check
  check (category in ('system', 'hr', 'mcb', 'logistics', 'finance', 'exam', 'academy', 'announcement', 'event', 'community'));
alter table public.notification_preferences drop constraint notification_preferences_categories_check;
alter table public.notification_preferences add constraint notification_preferences_categories_check
  check (muted_categories <@ array['hr', 'mcb', 'logistics', 'finance', 'exam', 'academy', 'announcement', 'event', 'community']::text[]);

-- ---------------------------------------------------------------------------
-- 1. Policy library
-- ---------------------------------------------------------------------------

-- The row holds the editors' working copy; members read the published versions.
create table public.policies (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 120),
  category text not null default 'general'
    check (category in ('general', 'conduct', 'field', 'vehicles', 'radio', 'hr', 'mcb', 'academy', 'other')),
  summary text check (char_length(summary) <= 300),
  body jsonb not null default '[]'::jsonb
    check (jsonb_typeof(body) = 'array' and octet_length(body::text) <= 400000 and strpos(body::text, 'data:image') = 0),
  -- The latest published version (0: never published).
  version integer not null default 0,
  requires_ack boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  sort_order integer not null default 100,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

create table public.policy_versions (
  policy_id uuid not null references public.policies(id) on delete cascade,
  version integer not null,
  title text not null,
  summary text,
  body jsonb not null,
  change_note text check (char_length(change_note) <= 300),
  requires_ack boolean not null default false,
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz not null default now(),
  primary key (policy_id, version)
);

create table public.policy_acknowledgements (
  policy_id uuid not null references public.policies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  version integer not null,
  acknowledged_at timestamptz not null default now(),
  primary key (policy_id, user_id)
);

alter table public.policies enable row level security;
alter table public.policy_versions enable row level security;
alter table public.policy_acknowledgements enable row level security;
-- Everything goes through the RPCs below (the working copy must not reach members).
revoke all on public.policies, public.policy_versions, public.policy_acknowledgements from anon, authenticated;

-- High command and the bureau manager keep the library.
create or replace function private.can_edit_policies()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin()
$$;

create or replace function public.get_policies()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _me uuid := (select auth.uid());
  _editor boolean := private.can_edit_policies();
  _members integer := (select count(*) from public.profiles where system_role <> 'pending');
begin
  if not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  return json_build_object(
    'can_edit', _editor,
    'members', _members,
    'policies', (
      select coalesce(json_agg(json_build_object(
        'id', p.id, 'title', coalesce(v.title, p.title), 'category', p.category, 'summary', coalesce(v.summary, p.summary),
        'version', p.version, 'requires_ack', coalesce(v.requires_ack, p.requires_ack), 'status', p.status,
        'published_at', v.published_at, 'updated_at', p.updated_at,
        'my_ack_version', a.version,
        'acknowledged', case when _editor then (select count(*) from public.policy_acknowledgements x
                                                 where x.policy_id = p.id and x.version = p.version) end,
        'draft_changes', case when _editor then p.version = 0 or v.body is distinct from p.body or v.title is distinct from p.title end
      ) order by p.sort_order, coalesce(v.title, p.title)), '[]'::json)
      from public.policies p
      left join public.policy_versions v on v.policy_id = p.id and v.version = p.version
      left join public.policy_acknowledgements a on a.policy_id = p.id and a.user_id = _me
      where (p.status = 'published' and p.version > 0) or _editor)
  );
end;
$$;

-- One policy: the published version (or an older one), its history, and for the editors the
-- working copy and who has not acknowledged the current version yet.
create or replace function public.get_policy(_id uuid, _version integer default null)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _me uuid := (select auth.uid());
  _editor boolean := private.can_edit_policies();
  _p public.policies%rowtype;
  _v public.policy_versions%rowtype;
begin
  if not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  select * into _p from public.policies where id = _id;
  if _p.id is null or (not _editor and (_p.status <> 'published' or _p.version = 0)) then
    raise exception 'A szabályzat nem található.' using errcode = 'P0002';
  end if;
  select * into _v from public.policy_versions where policy_id = _id and version = coalesce(_version, _p.version);
  return json_build_object(
    'id', _p.id, 'category', _p.category, 'status', _p.status, 'version', _p.version, 'sort_order', _p.sort_order,
    'shown_version', _v.version, 'title', coalesce(_v.title, _p.title), 'summary', coalesce(_v.summary, _p.summary),
    'body', coalesce(_v.body, case when _editor then _p.body end, '[]'::jsonb), 'requires_ack', coalesce(_v.requires_ack, _p.requires_ack),
    'published_at', _v.published_at, 'change_note', _v.change_note,
    'published_by_name', (select full_name from public.profiles where id = _v.published_by),
    'my_ack_version', (select version from public.policy_acknowledgements where policy_id = _id and user_id = _me),
    'versions', (select coalesce(json_agg(json_build_object('version', x.version, 'published_at', x.published_at, 'change_note', x.change_note,
                                                          'published_by_name', (select full_name from public.profiles where id = x.published_by))
                                        order by x.version desc), '[]'::json)
                 from public.policy_versions x where x.policy_id = _id),
    'draft', case when _editor then json_build_object('title', _p.title, 'summary', _p.summary, 'body', _p.body, 'requires_ack', _p.requires_ack,
                                                       'category', _p.category, 'updated_at', _p.updated_at,
                                                       'updated_by_name', (select full_name from public.profiles where id = _p.updated_by)) end,
    'missing', case when _editor and _p.version > 0 then (
      select coalesce(json_agg(json_build_object('user_id', m.id, 'full_name', m.full_name, 'badge_number', m.badge_number,
                                                 'faction_rank', m.faction_rank, 'avatar_url', m.avatar_url)
                               order by private.rank_index(m.faction_rank), m.full_name), '[]'::json)
      from public.profiles m
      where m.system_role <> 'pending'
        and not exists (select 1 from public.policy_acknowledgements a where a.policy_id = _id and a.user_id = m.id and a.version = _p.version)) end
  );
end;
$$;

-- Saves the working copy (creates a draft when _id is null). Publishing is separate.
create or replace function public.save_policy(_id uuid, _policy jsonb)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _row public.policies%rowtype;
  _title text := btrim(coalesce(_policy ->> 'title', ''));
  _category text := coalesce(nullif(_policy ->> 'category', ''), 'general');
  _body jsonb := case when jsonb_typeof(_policy -> 'body') = 'array' then _policy -> 'body' else '[]'::jsonb end;
begin
  if not private.can_edit_policies() then raise exception 'A szabályzatokat a parancsnokság szerkeszti.' using errcode = '42501'; end if;
  if char_length(_title) < 3 or char_length(_title) > 120 then raise exception 'A cím 3–120 karakter lehet.' using errcode = '22023'; end if;
  if _category not in ('general', 'conduct', 'field', 'vehicles', 'radio', 'hr', 'mcb', 'academy', 'other') then
    raise exception 'Ismeretlen kategória.' using errcode = '22023';
  end if;
  if octet_length(_body::text) > 400000 then raise exception 'A szabályzat túl hosszú.' using errcode = '22023'; end if;
  if strpos(_body::text, 'data:image') > 0 then raise exception 'Kép nem lehet a szabályzatban.' using errcode = '22023'; end if;

  if _id is null then
    insert into public.policies (title, category, summary, body, requires_ack, sort_order, created_by, updated_by)
    values (_title, _category, nullif(left(btrim(coalesce(_policy ->> 'summary', '')), 300), ''), _body,
            coalesce((_policy ->> 'requires_ack')::boolean, false), coalesce(private.json_int(_policy -> 'sort_order', 0, 10000)::int, 100),
            (select auth.uid()), (select auth.uid()))
    returning * into _row;
  else
    update public.policies set title = _title, category = _category, summary = nullif(left(btrim(coalesce(_policy ->> 'summary', '')), 300), ''),
      body = _body, requires_ack = coalesce((_policy ->> 'requires_ack')::boolean, requires_ack),
      sort_order = coalesce(private.json_int(_policy -> 'sort_order', 0, 10000)::int, sort_order),
      updated_at = now(), updated_by = (select auth.uid())
    where id = _id returning * into _row;
    if _row.id is null then raise exception 'A szabályzat nem található.' using errcode = 'P0002'; end if;
  end if;
  return json_build_object('id', _row.id, 'version', _row.version, 'updated_at', _row.updated_at);
end;
$$;

-- Publishes the working copy as the next version; with "must read" everyone is asked to
-- acknowledge it, otherwise only a brand-new policy is announced.
create or replace function public.publish_policy(_id uuid, _change_note text default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _row public.policies%rowtype;
  _first boolean;
begin
  if not private.can_edit_policies() then raise exception 'A szabályzatokat a parancsnokság teszi közzé.' using errcode = '42501'; end if;
  select * into _row from public.policies where id = _id for update;
  if _row.id is null then raise exception 'A szabályzat nem található.' using errcode = 'P0002'; end if;
  if jsonb_array_length(_row.body) = 0 then raise exception 'Üres szabályzatot nem lehet közzétenni.' using errcode = '22023'; end if;
  _first := _row.version = 0;
  update public.policies set version = version + 1, status = 'published', published_at = now(), updated_at = now(),
    updated_by = (select auth.uid())
  where id = _id returning * into _row;
  insert into public.policy_versions (policy_id, version, title, summary, body, change_note, requires_ack, published_by)
  values (_id, _row.version, _row.title, _row.summary, _row.body, nullif(left(btrim(coalesce(_change_note, '')), 300), ''),
          _row.requires_ack, (select auth.uid()));
  if _row.requires_ack or _first then
    perform private.notify(private.member_ids(),
      case when _first then 'Új szabályzat: ' || _row.title else 'Módosult: ' || _row.title end,
      case when _row.requires_ack then 'Olvasd el, és jelezd, hogy megismerted.' else coalesce(_row.summary, 'Megtalálod a Szabályzatok között.') end,
      case when _row.requires_ack then 'warning' else 'info' end, 'community', '/policies?id=' || _id, 'policy:' || _id);
  end if;
  return json_build_object('id', _row.id, 'version', _row.version, 'published_at', _row.published_at);
end;
$$;

create or replace function public.archive_policy(_id uuid, _archived boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_edit_policies() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  update public.policies set status = case when coalesce(_archived, true) then 'archived' when version > 0 then 'published' else 'draft' end,
    updated_at = now(), updated_by = (select auth.uid())
  where id = _id;
end;
$$;

create or replace function public.delete_policy(_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_edit_policies() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  -- A published policy keeps its versions and acknowledgements: it can only be archived.
  if exists (select 1 from public.policies where id = _id and version > 0) then
    raise exception 'Közzétett szabályzatot archiválni lehet, törölni nem.' using errcode = '22023';
  end if;
  delete from public.policies where id = _id;
end;
$$;

create or replace function public.acknowledge_policy(_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _version integer;
begin
  if not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  select version into _version from public.policies where id = _id and status = 'published' and version > 0;
  if _version is null then raise exception 'A szabályzat nem található.' using errcode = 'P0002'; end if;
  insert into public.policy_acknowledgements (policy_id, user_id, version) values (_id, (select auth.uid()), _version)
  on conflict (policy_id, user_id) do update set version = excluded.version, acknowledged_at = now();
  delete from public.notifications where user_id = (select auth.uid()) and dedupe_key = 'policy:' || _id and not is_read;
  return json_build_object('version', _version, 'acknowledged_at', now());
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Polls (audiences like events; anonymous ballots cannot be tied to voters)
-- ---------------------------------------------------------------------------

create table public.polls (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 160),
  description text check (char_length(description) <= 1000),
  audience text not null default 'all' check (audience ~ '^[A-Za-z0-9_-]{2,20}$'),
  anonymous boolean not null default false,
  max_choices integer not null default 1 check (max_choices between 1 and 10),
  -- When the results show: right away, after voting, or after the poll closed.
  results text not null default 'after_vote' check (results in ('live', 'after_vote', 'after_close')),
  closes_at timestamptz not null,
  closed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index polls_closes_idx on public.polls (closes_at desc);

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 120),
  sort_order integer not null default 0
);
create index poll_options_poll_idx on public.poll_options (poll_id, sort_order);

-- Who voted (one vote per poll) ...
create table public.poll_voters (
  poll_id uuid not null references public.polls(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  voted_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);
-- ... and the ballots (without the voter in an anonymous poll, and without a time).
create table public.poll_votes (
  id bigint generated always as identity primary key,
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade
);
create index poll_votes_poll_idx on public.poll_votes (poll_id, option_id);

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_voters enable row level security;
alter table public.poll_votes enable row level security;
revoke all on public.polls, public.poll_options, public.poll_voters, public.poll_votes from anon, authenticated;

create or replace function public.create_poll(_poll jsonb)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _row public.polls%rowtype;
  _title text := btrim(coalesce(_poll ->> 'title', ''));
  _audience text := coalesce(nullif(_poll ->> 'audience', ''), 'all');
  _closes timestamptz := nullif(_poll ->> 'closes_at', '')::timestamptz;
  _options text[];
  _results text := coalesce(nullif(_poll ->> 'results', ''), 'after_vote');
begin
  if not private.is_member() or not private.can_manage_event(_audience) then
    raise exception 'Szavazást az eseményszervezők indíthatnak a saját közönségüknek.' using errcode = '42501';
  end if;
  if char_length(_title) < 3 or char_length(_title) > 160 then raise exception 'A kérdés 3–160 karakter lehet.' using errcode = '22023'; end if;
  if _closes is null or _closes <= now() + interval '10 minutes' or _closes > now() + interval '60 days' then
    raise exception 'A lezárás ideje legalább 10 perc, legfeljebb 60 nap múlva legyen.' using errcode = '22023';
  end if;
  if _results not in ('live', 'after_vote', 'after_close') then raise exception 'Ismeretlen eredménymegjelenítés.' using errcode = '22023'; end if;
  select array_agg(left(btrim(t.label), 120) order by t.idx) into _options
  from jsonb_array_elements_text(case when jsonb_typeof(_poll -> 'options') = 'array' then _poll -> 'options' else '[]'::jsonb end)
       with ordinality as t(label, idx)
  where btrim(t.label) <> '';
  if cardinality(coalesce(_options, '{}')) < 2 or cardinality(_options) > 12 then
    raise exception 'Adj meg 2–12 választási lehetőséget.' using errcode = '22023';
  end if;

  insert into public.polls (title, description, audience, anonymous, max_choices, results, closes_at, created_by)
  values (_title, nullif(left(btrim(coalesce(_poll ->> 'description', '')), 1000), ''), _audience,
          coalesce((_poll ->> 'anonymous')::boolean, false),
          least(greatest(coalesce(private.json_int(_poll -> 'max_choices', 1, 10)::int, 1), 1), cardinality(_options)),
          _results, _closes, (select auth.uid()))
  returning * into _row;
  insert into public.poll_options (poll_id, label, sort_order)
  select _row.id, o, i from unnest(_options) with ordinality as t(o, i);

  perform private.notify(private.event_audience_ids(_audience), 'Szavazás: ' || _title,
    format('%sZárul: %s.', case when _row.anonymous then 'Névtelen. ' else '' end, private.event_when(_closes)),
    'info', 'community', '/community?tab=polls&id=' || _row.id, 'poll:' || _row.id);
  return json_build_object('id', _row.id);
end;
$$;

create or replace function public.cast_vote(_poll_id uuid, _option_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _me uuid := (select auth.uid());
  _poll public.polls%rowtype;
  _choices uuid[];
begin
  select * into _poll from public.polls where id = _poll_id;
  if _poll.id is null or not private.is_member() or not private.can_see_event(_poll.audience) then
    raise exception 'A szavazás nem található.' using errcode = 'P0002';
  end if;
  if _poll.closed_at is not null or _poll.closes_at <= now() then raise exception 'A szavazás lezárult.' using errcode = '22023'; end if;
  select array_agg(distinct o.id) into _choices from public.poll_options o where o.poll_id = _poll_id and o.id = any(coalesce(_option_ids, '{}'));
  if cardinality(coalesce(_choices, '{}')) = 0 then raise exception 'Válassz legalább egy lehetőséget.' using errcode = '22023'; end if;
  if cardinality(_choices) > _poll.max_choices then
    raise exception 'Legfeljebb % lehetőséget választhatsz.', _poll.max_choices using errcode = '22023';
  end if;
  begin
    insert into public.poll_voters (poll_id, user_id) values (_poll_id, _me);
  exception when unique_violation then
    raise exception 'Már szavaztál.' using errcode = '23505';
  end;
  insert into public.poll_votes (poll_id, option_id, user_id)
  select _poll_id, c, case when _poll.anonymous then null else _me end from unnest(_choices) c;
  delete from public.notifications where user_id = _me and dedupe_key = 'poll:' || _poll_id and not is_read;
end;
$$;

create or replace function public.close_poll(_poll_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _poll public.polls%rowtype;
begin
  select * into _poll from public.polls where id = _poll_id for update;
  if _poll.id is null then raise exception 'A szavazás nem található.' using errcode = 'P0002'; end if;
  if not (_poll.created_by = (select auth.uid()) or private.can_manage_event(_poll.audience)) then
    raise exception 'A szavazást az indítója vagy a szervezők zárhatják le.' using errcode = '42501';
  end if;
  update public.polls set closed_at = coalesce(closed_at, now()) where id = _poll_id;
end;
$$;

create or replace function public.delete_poll(_poll_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _poll public.polls%rowtype;
begin
  select * into _poll from public.polls where id = _poll_id;
  if _poll.id is null then raise exception 'A szavazás nem található.' using errcode = 'P0002'; end if;
  if not (_poll.created_by = (select auth.uid()) or private.can_manage_event(_poll.audience)) then
    raise exception 'A szavazást az indítója vagy a szervezők törölhetik.' using errcode = '42501';
  end if;
  delete from public.polls where id = _poll_id;
end;
$$;

-- The polls the caller sees, with the results when they may see them.
create or replace function public.get_polls()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _me uuid := (select auth.uid());
begin
  if not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  return (
    select coalesce(json_agg(row_to_json(x) order by x.open desc, x.closes_at desc), '[]'::json)
    from (
      select p.id, p.title, p.description, p.audience, p.anonymous, p.max_choices, p.results, p.closes_at, p.closed_at, p.created_at,
             p.created_by, (select full_name from public.profiles where id = p.created_by) as created_by_name,
             (p.closed_at is null and p.closes_at > now()) as open,
             v.voted, m.manage as can_manage,
             (select count(*) from public.poll_voters pv where pv.poll_id = p.id) as voters,
             cardinality(private.event_audience_ids(p.audience)) as audience_size,
             s.show as results_visible,
             (select coalesce(json_agg(json_build_object(
                'id', o.id, 'label', o.label,
                'votes', case when s.show then (select count(*) from public.poll_votes pv where pv.option_id = o.id) end,
                'mine', case when not p.anonymous then exists (select 1 from public.poll_votes pv where pv.option_id = o.id and pv.user_id = _me) end,
                'voters', case when s.show and not p.anonymous then (
                  select coalesce(json_agg(json_build_object('full_name', pr.full_name, 'avatar_url', pr.avatar_url) order by pr.full_name), '[]'::json)
                  from public.poll_votes pv join public.profiles pr on pr.id = pv.user_id where pv.option_id = o.id) end
              ) order by o.sort_order), '[]'::json)
              from public.poll_options o where o.poll_id = p.id) as options
      from public.polls p
      cross join lateral (select exists (select 1 from public.poll_voters pv where pv.poll_id = p.id and pv.user_id = _me) as voted) v
      cross join lateral (select (p.created_by = _me or private.can_manage_event(p.audience)) as manage) m
      cross join lateral (select (p.results = 'live' or (p.results = 'after_vote' and v.voted) or p.closed_at is not null
                                  or p.closes_at <= now() or m.manage) as show) s
      where private.can_see_event(p.audience) and (p.closed_at is null or p.closed_at > now() - interval '90 days')
        and p.closes_at > now() - interval '90 days'
    ) x);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Suggestion board
-- ---------------------------------------------------------------------------

create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 5 and 120),
  body text not null check (char_length(btrim(body)) between 10 and 2000),
  category text not null default 'general' check (category in ('general', 'website', 'training', 'events', 'equipment', 'other')),
  author_id uuid references public.profiles(id) on delete set null,
  status text not null default 'new' check (status in ('new', 'reviewing', 'planned', 'done', 'declined')),
  response text check (char_length(response) <= 1000),
  responded_by uuid references public.profiles(id) on delete set null,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index suggestions_created_idx on public.suggestions (created_at desc);
create index suggestions_author_idx on public.suggestions (author_id, created_at desc);

create table public.suggestion_votes (
  suggestion_id uuid not null references public.suggestions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (suggestion_id, user_id)
);

alter table public.suggestions enable row level security;
alter table public.suggestion_votes enable row level security;
revoke all on public.suggestions, public.suggestion_votes from anon, authenticated;

create or replace function public.get_suggestions()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'can_respond', private.is_admin(),
    'suggestions', (
      select coalesce(json_agg(json_build_object(
        'id', s.id, 'title', s.title, 'body', s.body, 'category', s.category, 'status', s.status, 'response', s.response,
        'responded_at', s.responded_at, 'created_at', s.created_at, 'author_id', s.author_id,
        'author', (select json_build_object('full_name', p.full_name, 'faction_rank', p.faction_rank, 'avatar_url', p.avatar_url)
                   from public.profiles p where p.id = s.author_id),
        'responded_by_name', (select full_name from public.profiles where id = s.responded_by),
        'votes', (select count(*) from public.suggestion_votes v where v.suggestion_id = s.id),
        'voted', exists (select 1 from public.suggestion_votes v where v.suggestion_id = s.id and v.user_id = (select auth.uid()))
      ) order by s.created_at desc), '[]'::json)
      from public.suggestions s
      where private.is_member() and (s.status not in ('done', 'declined') or s.responded_at > now() - interval '120 days'))
  )
$$;

create or replace function public.create_suggestion(_title text, _body text, _category text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _me uuid := (select auth.uid());
  _row public.suggestions%rowtype;
begin
  if not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  if (select count(*) from public.suggestions where author_id = _me and created_at > now() - interval '7 days') >= 5 then
    raise exception 'Egy héten legfeljebb öt ötletet küldhetsz be.' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(_title, ''))) < 5 then raise exception 'A cím legalább 5 karakter legyen.' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(_body, ''))) < 10 then raise exception 'Írd le az ötletet (legalább 10 karakter).' using errcode = '22023'; end if;
  insert into public.suggestions (title, body, category, author_id)
  values (left(btrim(_title), 120), left(btrim(_body), 2000),
          case when _category in ('general', 'website', 'training', 'events', 'equipment', 'other') then _category else 'general' end, _me)
  returning * into _row;
  perform private.notify(private.admin_ids(), 'Új ötlet az ötletládában', _row.title, 'info', 'community', '/community?tab=ideas',
                         'suggestions-new');
  return json_build_object('id', _row.id);
end;
$$;

create or replace function public.toggle_suggestion_vote(_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _me uuid := (select auth.uid());
  _author uuid;
begin
  if not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  select author_id into _author from public.suggestions where id = _id;
  if not found then raise exception 'Az ötlet nem található.' using errcode = 'P0002'; end if;
  if _author = _me then raise exception 'A saját ötletedre nem szavazhatsz.' using errcode = '22023'; end if;
  if exists (select 1 from public.suggestion_votes where suggestion_id = _id and user_id = _me) then
    delete from public.suggestion_votes where suggestion_id = _id and user_id = _me;
  else
    insert into public.suggestion_votes (suggestion_id, user_id) values (_id, _me);
  end if;
  return json_build_object('votes', (select count(*) from public.suggestion_votes where suggestion_id = _id),
                           'voted', exists (select 1 from public.suggestion_votes where suggestion_id = _id and user_id = _me));
end;
$$;

create or replace function public.respond_suggestion(_id uuid, _status text, _response text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _row public.suggestions%rowtype;
begin
  if not private.is_admin() then raise exception 'Az ötletekre a parancsnokság válaszol.' using errcode = '42501'; end if;
  if _status not in ('new', 'reviewing', 'planned', 'done', 'declined') then raise exception 'Ismeretlen státusz.' using errcode = '22023'; end if;
  update public.suggestions set status = _status, response = nullif(left(btrim(coalesce(_response, '')), 1000), ''),
    responded_by = (select auth.uid()), responded_at = now(), updated_at = now()
  where id = _id returning * into _row;
  if _row.id is null then raise exception 'Az ötlet nem található.' using errcode = 'P0002'; end if;
  if _row.author_id is not null then
    perform private.notify(array[_row.author_id], 'Válasz az ötletedre', format('„%s”: %s', _row.title,
      case _status when 'reviewing' then 'átnézés alatt' when 'planned' then 'tervben van' when 'done' then 'megvalósult'
                   when 'declined' then 'nem valósul meg' else 'új' end),
      case when _status in ('planned', 'done') then 'success' else 'info' end, 'community', '/community?tab=ideas');
  end if;
  return json_build_object('status', _row.status, 'response', _row.response, 'responded_at', _row.responded_at);
end;
$$;

create or replace function public.delete_suggestion(_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _row public.suggestions%rowtype;
begin
  select * into _row from public.suggestions where id = _id;
  if _row.id is null then raise exception 'Az ötlet nem található.' using errcode = 'P0002'; end if;
  if not (private.is_admin() or (_row.author_id = (select auth.uid()) and _row.status = 'new' and _row.responded_at is null)) then
    raise exception 'Az ötletet a beküldője törölheti, amíg nem válaszoltak rá.' using errcode = '42501';
  end if;
  delete from public.suggestions where id = _id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Anonymous feedback to the leadership
-- ---------------------------------------------------------------------------

-- The reporter is stored as a salted hash only (the salt never leaves the database): the same
-- member always has the same hash, so limits and blocks work, but nobody reading the reports
-- learns who wrote them. Times are kept to the hour.
create table private.feedback_secret (
  id integer primary key default 1 check (id = 1),
  salt text not null
);
insert into private.feedback_secret (id, salt) values (1, gen_random_uuid()::text || gen_random_uuid()::text) on conflict do nothing;
revoke all on private.feedback_secret from public, anon, authenticated;

create table private.feedback_blocks (
  reporter_hash text primary key,
  blocked_until timestamptz not null,
  reason text,
  blocked_by uuid,
  created_at timestamptz not null default now()
);
revoke all on private.feedback_blocks from public, anon, authenticated;

create or replace function private.reporter_hash(_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(sha256(convert_to((select salt from private.feedback_secret where id = 1) || _user_id::text, 'UTF8')), 'hex')
$$;
revoke execute on function private.reporter_hash(uuid) from public, anon, authenticated;

create table public.feedback_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_hash text not null,
  -- 'command': the high command and the bureau manager; 'manager': the bureau manager only.
  recipient text not null check (recipient in ('command', 'manager')),
  category text not null check (category in ('conduct', 'leadership', 'harassment', 'idea', 'other')),
  body text not null check (char_length(btrim(body)) between 20 and 3000),
  status text not null default 'new' check (status in ('new', 'read', 'answered', 'closed')),
  created_at timestamptz not null default date_trunc('hour', now()),
  updated_at timestamptz not null default date_trunc('hour', now())
);
create index feedback_reports_hash_idx on public.feedback_reports (reporter_hash, created_at desc);

create table public.feedback_messages (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.feedback_reports(id) on delete cascade,
  from_reporter boolean not null,
  -- Only answers carry their author (a leader); the reporter stays anonymous.
  author_id uuid references public.profiles(id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default date_trunc('hour', now()),
  -- The order within an hour (the time itself is kept to the hour).
  seq bigint generated always as identity
);
create index feedback_messages_report_idx on public.feedback_messages (report_id, seq);

alter table public.feedback_reports enable row level security;
alter table public.feedback_messages enable row level security;
revoke all on public.feedback_reports, public.feedback_messages from anon, authenticated;

create or replace function private.feedback_recipient_ids(_recipient text)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(p.id), '{}') from public.profiles p
  where p.system_role <> 'pending'
    and (coalesce(p.is_bureau_manager, false) or (_recipient = 'command' and private.rank_index(p.faction_rank) <= 6))
$$;

create or replace function private.can_read_feedback(_recipient text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) = any(private.feedback_recipient_ids(_recipient))
$$;

create or replace function private.feedback_json(_r public.feedback_reports, _for_reporter boolean)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'id', _r.id, 'recipient', _r.recipient, 'category', _r.category, 'body', _r.body, 'status', _r.status,
    'created_at', _r.created_at, 'updated_at', _r.updated_at,
    'messages', (select coalesce(json_agg(json_build_object(
                   'id', m.id, 'from_reporter', m.from_reporter, 'body', m.body, 'created_at', m.created_at,
                   'author_name', case when not m.from_reporter then (select full_name from public.profiles where id = m.author_id) end)
                 order by m.seq), '[]'::json)
                 from public.feedback_messages m where m.report_id = _r.id),
    'reporter_reports', case when not _for_reporter then
      (select count(*) from public.feedback_reports x where x.reporter_hash = _r.reporter_hash) end,
    'blocked_until', case when not _for_reporter then
      (select blocked_until from private.feedback_blocks b where b.reporter_hash = _r.reporter_hash and b.blocked_until > now()) end)
$$;

create or replace function public.submit_feedback(_recipient text, _category text, _body text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _hash text;
  _row public.feedback_reports%rowtype;
begin
  if not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  _hash := private.reporter_hash((select auth.uid()));
  if exists (select 1 from private.feedback_blocks where reporter_hash = _hash and blocked_until > now()) then
    raise exception 'Egy ideig nem küldhetsz névtelen visszajelzést.' using errcode = '42501';
  end if;
  if (select count(*) from public.feedback_reports where reporter_hash = _hash and created_at > now() - interval '7 days') >= 3 then
    raise exception 'Egy héten legfeljebb három névtelen visszajelzést küldhetsz.' using errcode = '22023';
  end if;
  if _recipient not in ('command', 'manager') then raise exception 'Válaszd ki, kinek szól.' using errcode = '22023'; end if;
  if _category not in ('conduct', 'leadership', 'harassment', 'idea', 'other') then raise exception 'Ismeretlen téma.' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(_body, ''))) < 20 then raise exception 'Írd le részletesebben (legalább 20 karakter).' using errcode = '22023'; end if;
  insert into public.feedback_reports (reporter_hash, recipient, category, body)
  values (_hash, _recipient, _category, left(btrim(_body), 3000)) returning * into _row;
  perform private.notify(private.feedback_recipient_ids(_recipient), 'Névtelen visszajelzés érkezett',
    case _category when 'conduct' then 'Téma: magatartás' when 'leadership' then 'Téma: vezetés' when 'harassment' then 'Téma: zaklatás'
                   when 'idea' then 'Téma: javaslat' else 'Téma: egyéb' end,
    case when _category = 'harassment' then 'alert' else 'info' end, 'community', '/community?tab=feedback', 'feedback-new', false, true);
  return private.feedback_json(_row, true);
end;
$$;

-- The caller's own anonymous reports (matched by the hash) with the answers.
create or replace function public.get_my_feedback()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _hash text;
begin
  if not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  _hash := private.reporter_hash((select auth.uid()));
  return json_build_object(
    'blocked_until', (select blocked_until from private.feedback_blocks where reporter_hash = _hash and blocked_until > now()),
    'sent_this_week', (select count(*) from public.feedback_reports where reporter_hash = _hash and created_at > now() - interval '7 days'),
    'reports', (select coalesce(json_agg(private.feedback_json(r, true) order by r.created_at desc), '[]'::json)
                from public.feedback_reports r where r.reporter_hash = _hash));
end;
$$;

create or replace function public.get_feedback_inbox()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (private.can_read_feedback('command') or private.can_read_feedback('manager')) then
    raise exception 'A névtelen visszajelzéseket a parancsnokság olvassa.' using errcode = '42501';
  end if;
  return (select coalesce(json_agg(private.feedback_json(r, false) order by r.status = 'closed', r.updated_at desc), '[]'::json)
          from public.feedback_reports r where private.can_read_feedback(r.recipient));
end;
$$;

-- A message in a report's thread: the reporter (still anonymous) or a recipient leader.
create or replace function public.reply_feedback(_report_id uuid, _body text)
returns json
language plpgsql
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _me uuid := (select auth.uid());
  _row public.feedback_reports%rowtype;
  _reporter boolean;
  _person uuid;
begin
  select * into _row from public.feedback_reports where id = _report_id for update;
  if _row.id is null or not private.is_member() then raise exception 'A visszajelzés nem található.' using errcode = 'P0002'; end if;
  _reporter := _row.reporter_hash = private.reporter_hash(_me);
  if not _reporter and not private.can_read_feedback(_row.recipient) then raise exception 'A visszajelzés nem található.' using errcode = 'P0002'; end if;
  if _row.status = 'closed' then raise exception 'Ez a beszélgetés lezárult.' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(_body, ''))) < 1 then raise exception 'Írj üzenetet.' using errcode = '22023'; end if;
  insert into public.feedback_messages (report_id, from_reporter, author_id, body)
  values (_report_id, _reporter, case when _reporter then null else _me end, left(btrim(_body), 2000));
  update public.feedback_reports set status = case when _reporter then 'new' else 'answered' end, updated_at = date_trunc('hour', now())
  where id = _report_id returning * into _row;
  if _reporter then
    perform private.notify(private.feedback_recipient_ids(_row.recipient), 'Új üzenet egy névtelen visszajelzésben',
      'A beküldő válaszolt.', 'info', 'community', '/community?tab=feedback', 'feedback-new', false, true);
  else
    -- The reporter is found by the hash inside the database only (the leaders never see who it is).
    select p.id into _person from public.profiles p where private.reporter_hash(p.id) = _row.reporter_hash limit 1;
    if _person is not null then
      perform private.notify(array[_person], 'Válasz a névtelen visszajelzésedre', 'A vezetőség válaszolt.',
        'info', 'community', '/community?tab=feedback', 'feedback-reply');
    end if;
  end if;
  return private.feedback_json(_row, _reporter);
end;
$$;

create or replace function public.set_feedback_status(_report_id uuid, _status text)
returns void
language plpgsql
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _row public.feedback_reports%rowtype;
begin
  select * into _row from public.feedback_reports where id = _report_id;
  if _row.id is null or not private.can_read_feedback(_row.recipient) then raise exception 'A visszajelzés nem található.' using errcode = 'P0002'; end if;
  if _status not in ('new', 'read', 'answered', 'closed') then raise exception 'Ismeretlen státusz.' using errcode = '22023'; end if;
  update public.feedback_reports set status = _status, updated_at = date_trunc('hour', now()) where id = _report_id;
end;
$$;

-- Stops abuse without learning who it is: the reporter of this report cannot send for a while.
create or replace function public.block_feedback_reporter(_report_id uuid, _days integer, _reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _row public.feedback_reports%rowtype;
begin
  select * into _row from public.feedback_reports where id = _report_id;
  if _row.id is null or not private.can_read_feedback(_row.recipient) then raise exception 'A visszajelzés nem található.' using errcode = 'P0002'; end if;
  if not (private.is_executive_or_manager()) then raise exception 'Tiltást a vezérkar rendelhet el.' using errcode = '42501'; end if;
  insert into private.feedback_blocks (reporter_hash, blocked_until, reason, blocked_by)
  values (_row.reporter_hash, now() + make_interval(days => least(greatest(coalesce(_days, 7), 1), 90)),
          nullif(left(btrim(coalesce(_reason, '')), 200), ''), (select auth.uid()))
  on conflict (reporter_hash) do update set blocked_until = excluded.blocked_until, reason = excluded.reason, blocked_by = excluded.blocked_by;
  update public.feedback_reports set status = 'closed' where id = _report_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Privileges
-- ---------------------------------------------------------------------------

revoke execute on function
  public.get_policies(), public.get_policy(uuid, integer), public.save_policy(uuid, jsonb), public.publish_policy(uuid, text),
  public.archive_policy(uuid, boolean), public.delete_policy(uuid), public.acknowledge_policy(uuid),
  public.create_poll(jsonb), public.cast_vote(uuid, uuid[]), public.close_poll(uuid), public.delete_poll(uuid), public.get_polls(),
  public.get_suggestions(), public.create_suggestion(text, text, text), public.toggle_suggestion_vote(uuid),
  public.respond_suggestion(uuid, text, text), public.delete_suggestion(uuid),
  public.submit_feedback(text, text, text), public.get_my_feedback(), public.get_feedback_inbox(), public.reply_feedback(uuid, text),
  public.set_feedback_status(uuid, text), public.block_feedback_reporter(uuid, integer, text)
from public, anon, authenticated;
grant execute on function
  public.get_policies(), public.get_policy(uuid, integer), public.save_policy(uuid, jsonb), public.publish_policy(uuid, text),
  public.archive_policy(uuid, boolean), public.delete_policy(uuid), public.acknowledge_policy(uuid),
  public.create_poll(jsonb), public.cast_vote(uuid, uuid[]), public.close_poll(uuid), public.delete_poll(uuid), public.get_polls(),
  public.get_suggestions(), public.create_suggestion(text, text, text), public.toggle_suggestion_vote(uuid),
  public.respond_suggestion(uuid, text, text), public.delete_suggestion(uuid),
  public.submit_feedback(text, text, text), public.get_my_feedback(), public.get_feedback_inbox(), public.reply_feedback(uuid, text),
  public.set_feedback_status(uuid, text), public.block_feedback_reporter(uuid, integer, text)
to authenticated;
