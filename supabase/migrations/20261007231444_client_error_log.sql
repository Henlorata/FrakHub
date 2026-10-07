-- =============================================================================
-- Error log: what broke in the browsers, before anyone sends a screenshot.
--
-- The browser reports a page that crashed, an unhandled error, a failed picture upload, a server
-- error of our functions and the database answers that only a frontend and schema out of step give
-- (a missing function or column, a refused privilege, a broken constraint). Reports with the same
-- kind and message (ids and numbers folded) are counted on one row with the pages (query left off,
-- ids folded), the builds and browsers they came from and who met them. The Executive Staff and
-- the Bureau Manager read it on the statistics page and mark rows handled; the dashboard counts the
-- open ones. A handled row opens again when the error comes back from a build that did not have it.
--
-- Free tier: the browser sends an error once per page load (at most 15); the database takes at most
-- 40 reports a day from a member or a visitor's address and 2000 a day in all, and keeps at most
-- 300 open rows (visitors may open 100). Visitors (public pages, guest exams) are only counted.
-- The housekeeping drops handled rows after 30 days, rows nobody met for 60 days and the
-- rate-limit rows after two days.
--
-- Compatible with the deployed frontend: new tables and functions, the dashboard summary and the
-- housekeeping get one more key each.
-- =============================================================================

create table private.client_errors (
  id uuid primary key default gen_random_uuid(),
  -- md5 of the kind and the message with ids and numbers folded.
  fingerprint text not null unique,
  kind text not null check (kind in ('crash', 'error', 'upload', 'api', 'database')),
  message text not null,
  -- The latest stack (and component stack) the browser sent.
  detail text,
  -- Newest first, a few of each.
  routes text[] not null default '{}',
  builds text[] not null default '{}',
  browsers text[] not null default '{}',
  user_ids uuid[] not null default '{}',
  guests integer not null default 0,
  occurrences integer not null default 1,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  -- The builds that had the error when it was marked handled: their old tabs do not open it again.
  resolved_builds text[] not null default '{}'
);
revoke all on private.client_errors from public, anon, authenticated;

-- One row per report (member id or the salted hash of a visitor's address), kept two days.
create table private.client_error_limits (
  caller text not null,
  created_at timestamptz not null default now()
);
create index client_error_limits_idx on private.client_error_limits (caller, created_at);
revoke all on private.client_error_limits from public, anon, authenticated;

-- The value first, without its earlier copy, at most _cap items.
create or replace function private.push_recent(_list anyarray, _value anyelement, _cap integer)
returns anyarray
language sql
immutable
set search_path = ''
as $$
  select case when _value is null then _list else (array_prepend(_value, array_remove(_list, _value)))[1:_cap] end
$$;
revoke execute on function private.push_recent(anyarray, anyelement, integer) from public, anon, authenticated;

-- A report from the browser. Members and visitors; never raises (a refused report is dropped).
create or replace function public.report_client_error(
  _kind text, _message text, _detail text default null, _route text default null,
  _build text default null, _browser text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := (select auth.uid());
  _caller text := coalesce(_uid::text, private.visitor_hash());
  _clean_kind text := case when _kind in ('crash', 'error', 'upload', 'api', 'database') then _kind else 'error' end;
  _text text := left(btrim(regexp_replace(coalesce(_message, ''), '[[:cntrl:][:space:]]+', ' ', 'g')), 300);
  _clean_detail text := nullif(left(regexp_replace(coalesce(_detail, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g'), 2000), '');
  _clean_build text := nullif(left(regexp_replace(coalesce(_build, ''), '[^a-zA-Z0-9]', '', 'g'), 20), '');
  _clean_browser text := nullif(left(btrim(regexp_replace(coalesce(_browser, ''), '[[:cntrl:]]', '', 'g')), 40), '');
  _path text;
  _key text;
begin
  if _text = '' then return; end if;
  if (select count(*) from private.client_error_limits l where l.caller = _caller and l.created_at > now() - interval '1 day') >= 40
     or (select count(*) from private.client_error_limits l where l.created_at > now() - interval '1 day') >= 2000 then
    return;
  end if;
  insert into private.client_error_limits (caller) values (_caller);

  -- The page without its query or hash (search words, codes) and with ids folded: /mcb/case/:id.
  _path := left(regexp_replace(split_part(split_part(coalesce(_route, ''), '?', 1), '#', 1), '/[^/]*[0-9][^/]*', '/:id', 'g'), 120);
  if left(_path, 1) <> '/' then _path := null; end if;
  _key := md5(_clean_kind || ':' || regexp_replace(regexp_replace(lower(_text),
    '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', ':id', 'g'), '[0-9]+', 'N', 'g'));

  insert into private.client_errors as e (fingerprint, kind, message, detail, routes, builds, browsers, user_ids, guests)
  select _key, _clean_kind, _text, _clean_detail,
         private.push_recent('{}'::text[], _path, 8), private.push_recent('{}'::text[], _clean_build, 5),
         private.push_recent('{}'::text[], _clean_browser, 5), private.push_recent('{}'::uuid[], _uid, 20),
         case when _uid is null then 1 else 0 end
  where exists (select 1 from private.client_errors o where o.fingerprint = _key)
     or (select count(*) from private.client_errors o where o.resolved_at is null) < (case when _uid is null then 100 else 300 end)
  on conflict (fingerprint) do update set
    occurrences = e.occurrences + 1,
    last_seen = now(),
    message = excluded.message,
    detail = coalesce(excluded.detail, e.detail),
    routes = private.push_recent(e.routes, _path, 8),
    builds = private.push_recent(e.builds, _clean_build, 5),
    browsers = private.push_recent(e.browsers, _clean_browser, 5),
    user_ids = private.push_recent(e.user_ids, _uid, 20),
    guests = e.guests + excluded.guests,
    resolved_at = case when _clean_build = any(e.resolved_builds) then e.resolved_at end,
    resolved_by = case when _clean_build = any(e.resolved_builds) then e.resolved_by end;
end;
$$;
revoke execute on function public.report_client_error(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.report_client_error(text, text, text, text, text, text) to anon, authenticated;

-- The log for the statistics page: the open rows (latest 100) and the recently handled ones (30).
create or replace function public.get_client_errors()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_executive_or_manager() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  return json_build_object(
    'open', (select count(*) from private.client_errors e where e.resolved_at is null),
    'items', (select coalesce(json_agg(json_build_object(
        'id', e.id, 'kind', e.kind, 'message', e.message, 'detail', e.detail,
        'routes', e.routes, 'builds', e.builds, 'browsers', e.browsers,
        'occurrences', e.occurrences, 'guests', e.guests, 'members', cardinality(e.user_ids),
        'users', (select coalesce(json_agg(json_build_object('id', p.id, 'full_name', p.full_name, 'badge_number', p.badge_number) order by u.ord), '[]')
                  from unnest(e.user_ids[1:5]) with ordinality as u(id, ord) join public.profiles p on p.id = u.id),
        'first_seen', e.first_seen, 'last_seen', e.last_seen, 'resolved_at', e.resolved_at,
        'resolved_by', (select p.full_name from public.profiles p where p.id = e.resolved_by))
      order by e.resolved_at is not null, coalesce(e.resolved_at, e.last_seen) desc), '[]')
      from ((select * from private.client_errors o where o.resolved_at is null order by o.last_seen desc limit 100)
            union all
            (select * from private.client_errors o where o.resolved_at is not null order by o.resolved_at desc limit 30)) e));
end;
$$;
revoke execute on function public.get_client_errors() from public, anon, authenticated;
grant execute on function public.get_client_errors() to authenticated;

-- Marks rows handled (or open again). Returns how many changed.
create or replace function public.resolve_client_errors(_ids uuid[], _resolved boolean default true)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  _changed integer;
begin
  if not private.is_executive_or_manager() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  update private.client_errors e set
    resolved_at = case when _resolved then now() end,
    resolved_by = case when _resolved then (select auth.uid()) end,
    resolved_builds = case when _resolved then e.builds else '{}' end
  where e.id = any(_ids) and (e.resolved_at is null) = _resolved;
  get diagnostics _changed = row_count;
  return _changed;
end;
$$;
revoke execute on function public.resolve_client_errors(uuid[], boolean) from public, anon, authenticated;
grant execute on function public.resolve_client_errors(uuid[], boolean) to authenticated;

-- "or replace": an earlier migration of the same session (db reset) may have left it behind.
create or replace function pg_temp.patch_function(_fn regprocedure, _done text, variadic _pairs text[])
returns void
language plpgsql
as $f$
declare
  _def text := replace(pg_get_functiondef(_fn), chr(13), '');
  _i integer;
begin
  if _done is not null and position(_done in _def) > 0 then return; end if;
  for _i in 1 .. coalesce(array_length(_pairs, 1), 0) / 2 loop
    if position(_pairs[_i * 2 - 1] in _def) = 0 then
      raise exception '%: anchor not found: %', _fn, left(_pairs[_i * 2 - 1], 160);
    end if;
    _def := replace(_def, _pairs[_i * 2 - 1], _pairs[_i * 2]);
  end loop;
  execute _def;
end;
$f$;

-- The dashboard counts the open rows for the Executive Staff and the Bureau Manager (every key kept).
select pg_temp.patch_function('public.get_dashboard_summary()', '''client_errors''',
  $a$(select a.value::json from private.app_state a where a.key = 'db_health') end$a$,
  $b$(select a.value::json from private.app_state a where a.key = 'db_health') end,
    -- Open rows of the error log, for the same leadership.
    'client_errors', case when private.is_executive_or_manager() then
      (select count(*) from private.client_errors e where e.resolved_at is null) end$b$);

-- The housekeeping keeps the log short.
select pg_temp.patch_function('public.run_housekeeping()', 'private.client_errors',
  $a$  _limits integer;$a$,
  $b$  _limits integer;
  _errors integer;$b$,
  $a$  delete from private.public_report_limits where created_at < now() - interval '2 days';
  get diagnostics _limits = row_count;$a$,
  $b$  delete from private.public_report_limits where created_at < now() - interval '2 days';
  get diagnostics _limits = row_count;
  -- The error log: handled rows after a month, rows nobody met for two months, its rate limit after two days.
  delete from private.client_errors where resolved_at < now() - interval '30 days' or last_seen < now() - interval '60 days';
  get diagnostics _errors = row_count;
  delete from private.client_error_limits where created_at < now() - interval '2 days';$b$,
  $a$'rate_limits', _limits,$a$,
  $b$'rate_limits', _limits, 'client_errors', _errors,$b$);

drop function pg_temp.patch_function(regprocedure, text, text[]);
