-- =============================================================================
-- 1. Publishing a scenario issues the certificate to everyone who has already passed it, and tells
--    them. A run of a hidden scenario (only instructors can play one) gives no certificate, so the
--    instructors who tried the two sample scenarios before publishing got none (reported 2026-10-07).
-- 2. The notification of a new anonymous feedback opens the readers' inbox (box=inbox): the feedback
--    tab now opens the member's own reports by default, for the readers too.
-- =============================================================================

create or replace function private.on_scenario_published()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _members uuid[];
begin
  select coalesce(array_agg(r.user_id), '{}') into _members
  from public.scenario_results r
  where r.scenario_id = new.id and r.passed
    and not exists (select 1 from public.certificates c
                    where c.user_id = r.user_id and c.kind = 'scenario' and c.ref = new.id::text and c.revoked_at is null);
  if cardinality(_members) = 0 then return null; end if;

  perform private.issue_certificate(u, 'scenario', new.id::text, new.title, 'Szituációs gyakorlat teljesítve') from unnest(_members) u;
  -- _include_actor: the instructor who publishes it may have passed it too.
  perform private.notify(_members, 'Oklevelet kaptál',
    format('A(z) „%s” gyakorlatot már teljesítetted; most, hogy közzétették, megkaptad az oklevelét.', new.title),
    'success', 'academy', '/profile?tab=certificates', 'certificate:scenario:' || new.id, true);
  return null;
end;
$$;
revoke execute on function private.on_scenario_published() from public, anon, authenticated;

drop trigger if exists scenario_published on public.practice_scenarios;
create trigger scenario_published after update of published on public.practice_scenarios
  for each row when (new.published and not old.published) execute function private.on_scenario_published();

-- 2. --------------------------------------------------------------------------------------------
create function pg_temp.patch_function(_fn regprocedure, _done text, variadic _pairs text[])
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

select pg_temp.patch_function('public.submit_feedback(text,text,text)', '/community?tab=feedback&box=inbox',
  $a$'community', '/community?tab=feedback', 'feedback-new'$a$,
  $b$'community', '/community?tab=feedback&box=inbox', 'feedback-new'$b$);

-- The readers' notifications sent so far point at the inbox too.
update public.notifications set link = '/community?tab=feedback&box=inbox'
where link = '/community?tab=feedback' and dedupe_key = 'feedback-new';
