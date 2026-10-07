-- =============================================================================
-- Bureau ranks and titles, managed by the bureaus themselves.
--
--   * division_ranks: the ranks inside a division (MCB investigators, SEB operators, ...),
--     until now fixed in the code. The Bureau Commander of a division edits its list (rename,
--     add, delete, reorder); the Bureau Manager every division's. profiles.division_rank stays
--     the rank's name (renames are carried over to the members).
--   * privileged: the rank whose holders see every MCB case, approve warrants and see the
--     bureau's overview (formerly hard-coded as "Investigator III."). Only the Bureau Manager
--     sets it, so renaming the rank no longer breaks those rights.
--   * division_titles: titles held next to the bureau rank (SEB: Medic, Marksman), with their
--     own icon; profiles.division_titles holds a member's title ids. Given through the HR API
--     (/api/admin/update-role, same right as the bureau rank); a member leaving the division
--     loses its titles.
--
-- Compatible with the deployed frontend: new tables, a new column, the same rank names, and
-- permission helpers that read the privileged flag instead of the fixed name (same result).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Ranks
-- ---------------------------------------------------------------------------

create table public.division_ranks (
  id uuid primary key default gen_random_uuid(),
  division text not null check (division in ('TSB', 'SEB', 'MCB')),
  name text not null check (char_length(name) between 2 and 40 and name = btrim(name)),
  sort_order integer not null default 100,
  privileged boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  unique (division, name)
);
create index division_ranks_order_idx on public.division_ranks (division, sort_order);
alter table public.division_ranks enable row level security;
create policy division_ranks_select on public.division_ranks for select to authenticated
  using ((select private.is_member()));
revoke all on public.division_ranks from anon, authenticated;
grant select on public.division_ranks to authenticated;

insert into public.division_ranks (division, name, sort_order, privileged) values
  ('MCB', 'Investigator III.', 10, true),
  ('MCB', 'Investigator II.', 20, false),
  ('MCB', 'Investigator I.', 30, false),
  ('SEB', 'Operator III.', 10, false),
  ('SEB', 'Operator II.', 20, false),
  ('SEB', 'Operator I.', 30, false);
-- Any other name already in use stays valid (at the end of its list).
insert into public.division_ranks (division, name, sort_order)
select distinct p.division, btrim(p.division_rank), 90
from public.profiles p
where p.division in ('TSB', 'SEB', 'MCB') and char_length(btrim(coalesce(p.division_rank, ''))) between 2 and 40
on conflict (division, name) do nothing;

-- Whether a division rank carries the bureau's leadership rights (MCB: every case, warrants).
create or replace function private.has_privileged_division_rank(_division text, _rank text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select _rank is not null and exists (
    select 1 from public.division_ranks r where r.division = _division and r.name = _rank and r.privileged)
$$;
revoke execute on function private.has_privileged_division_rank(text, text) from public, anon;
grant execute on function private.has_privileged_division_rank(text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Titles
-- ---------------------------------------------------------------------------

create table public.division_titles (
  id uuid primary key default gen_random_uuid(),
  division text not null check (division in ('TSB', 'SEB', 'MCB')),
  name text not null check (char_length(name) between 2 and 30 and name = btrim(name)),
  icon text not null default 'award' check (icon ~ '^[a-z0-9-]{2,30}$'),
  tone text not null default 'amber' check (tone in ('amber', 'rose', 'emerald', 'sky', 'violet', 'orange', 'cyan', 'slate', 'red')),
  description text check (char_length(description) <= 160),
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  unique (division, name)
);
create index division_titles_order_idx on public.division_titles (division, sort_order);
alter table public.division_titles enable row level security;
create policy division_titles_select on public.division_titles for select to authenticated
  using ((select private.is_member()));
revoke all on public.division_titles from anon, authenticated;
grant select on public.division_titles to authenticated;

insert into public.division_titles (division, name, icon, tone, description, sort_order) values
  ('SEB', 'Medic', 'heart-pulse', 'rose', 'Az egység egészségügyi ellátója a bevetéseken.', 10),
  ('SEB', 'Marksman', 'crosshair', 'amber', 'Kijelölt lövész: távolsági fedezet és megfigyelés.', 20);

alter table public.profiles add column division_titles uuid[] not null default '{}';
grant select (division_titles) on public.profiles to authenticated;

-- Titles belong to a division: a member keeps only the existing titles of their own division.
create or replace function private.keep_division_titles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.division_titles := coalesce(array(
    select t.id from public.division_titles t
    where t.id = any(coalesce(new.division_titles, '{}')) and t.division = new.division
    order by t.sort_order, t.name), '{}');
  return new;
end;
$$;
revoke execute on function private.keep_division_titles() from public, anon, authenticated;
create trigger before_profile_titles before update of division, division_titles on public.profiles
  for each row execute function private.keep_division_titles();

-- ---------------------------------------------------------------------------
-- 3. Member history: title changes, and no history entry when a bureau renames a rank
-- ---------------------------------------------------------------------------

alter table public.member_events drop constraint member_events_kind_check;
alter table public.member_events add constraint member_events_kind_check check (kind = any (array[
  'joined', 'rank', 'division', 'division_rank', 'division_title', 'qualifications', 'bureau_role', 'name', 'badge', 'award',
  'award_revoked']));

-- The member history trigger: same as before (latest definition), plus title changes.
create or replace function private.on_profile_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  _actor uuid := private.actor_id();
  _added text[];
  _removed text[];
  _promotion boolean;
  _undo_event uuid;
  _parts text[] := '{}';
  -- A bureau renaming or removing one of its ranks/titles (save_division_rank, ...): not a
  -- change of the member, so no history entry and no notification.
  _restructure boolean := coalesce(current_setting('app.bureau_restructure', true), '') = 'on';
begin
  if old.system_role = 'pending' and new.system_role <> 'pending' then
    insert into public.member_events (user_id, actor_id, kind, to_value) values (new.id, _actor, 'joined', new.faction_rank);
    perform private.notify(array[new.id], 'Fiók jóváhagyva',
      format('Üdvözlünk az állományban! Rendfokozatod: %s.', new.faction_rank),
      'success', 'hr', '/dashboard', null, true);
    return new;
  end if;
  if new.system_role = 'pending' then return new; end if;

  if new.faction_rank is distinct from old.faction_rank then
    -- "Undo" on the HR page: reverting a rank change the same member made minutes ago
    -- erases that change from the history and the unread notification instead of
    -- logging both.
    select id into _undo_event from public.member_events
    where user_id = new.id and kind = 'rank' and actor_id is not distinct from _actor
      and from_value = new.faction_rank and to_value = old.faction_rank
      and created_at > now() - interval '10 minutes'
    order by created_at desc
    limit 1;

    if _undo_event is not null then
      delete from public.member_events where id = _undo_event;
      delete from public.notifications where user_id = new.id and dedupe_key = 'hr-rank' and not is_read;
    else
      _promotion := private.rank_index(new.faction_rank) < private.rank_index(old.faction_rank);
      insert into public.member_events (user_id, actor_id, kind, from_value, to_value, detail)
      values (new.id, _actor, 'rank', old.faction_rank, new.faction_rank,
              case when _promotion then 'promotion' else 'demotion' end);
      perform private.notify(array[new.id],
        case when _promotion then 'Előléptetés' else 'Rendfokozat változás' end,
        format('Új rendfokozatod: %s (korábban: %s).', new.faction_rank, old.faction_rank),
        case when _promotion then 'success' else 'warning' end, 'hr', '/profile', 'hr-rank');
    end if;
  end if;

  if new.division is distinct from old.division then
    insert into public.member_events (user_id, actor_id, kind, from_value, to_value)
    values (new.id, _actor, 'division', old.division, new.division);
    _parts := _parts || format('osztály: %s → %s', old.division, new.division);
  end if;

  if new.division_rank is distinct from old.division_rank and not _restructure then
    insert into public.member_events (user_id, actor_id, kind, from_value, to_value)
    values (new.id, _actor, 'division_rank', old.division_rank, new.division_rank);
    _parts := _parts || format('alosztály rang: %s', coalesce(new.division_rank, 'nincs'));
  end if;

  select coalesce(array_agg(q), '{}') into _added
  from unnest(coalesce(new.qualifications, '{}')) q where not (q = any(coalesce(old.qualifications, '{}')));
  select coalesce(array_agg(q), '{}') into _removed
  from unnest(coalesce(old.qualifications, '{}')) q where not (q = any(coalesce(new.qualifications, '{}')));
  if cardinality(_added) > 0 or cardinality(_removed) > 0 then
    insert into public.member_events (user_id, actor_id, kind, from_value, to_value)
    values (new.id, _actor, 'qualifications', nullif(array_to_string(_removed, ', '), ''), nullif(array_to_string(_added, ', '), ''));
    if cardinality(_added) > 0 then _parts := _parts || format('új képesítés: %s', array_to_string(_added, ', ')); end if;
    if cardinality(_removed) > 0 then _parts := _parts || format('visszavont képesítés: %s', array_to_string(_removed, ', ')); end if;
  end if;

  if new.division_titles is distinct from old.division_titles and not _restructure then
    select coalesce(array_agg(t.name order by t.sort_order, t.name), '{}') into _added
    from public.division_titles t
    where t.id = any(coalesce(new.division_titles, '{}')) and not (t.id = any(coalesce(old.division_titles, '{}')));
    select coalesce(array_agg(t.name order by t.sort_order, t.name), '{}') into _removed
    from public.division_titles t
    where t.id = any(coalesce(old.division_titles, '{}')) and not (t.id = any(coalesce(new.division_titles, '{}')));
    if cardinality(_added) > 0 or cardinality(_removed) > 0 then
      insert into public.member_events (user_id, actor_id, kind, from_value, to_value)
      values (new.id, _actor, 'division_title', nullif(array_to_string(_removed, ', '), ''), nullif(array_to_string(_added, ', '), ''));
      if cardinality(_added) > 0 then _parts := _parts || format('új cím: %s', array_to_string(_added, ', ')); end if;
      if cardinality(_removed) > 0 then _parts := _parts || format('visszavont cím: %s', array_to_string(_removed, ', ')); end if;
    end if;
  end if;

  if new.is_bureau_manager is distinct from old.is_bureau_manager
     or new.is_bureau_commander is distinct from old.is_bureau_commander
     or new.commanded_divisions is distinct from old.commanded_divisions then
    insert into public.member_events (user_id, actor_id, kind, from_value, to_value)
    values (new.id, _actor, 'bureau_role',
      concat_ws(', ', case when old.is_bureau_manager then 'Bureau Manager' end,
                      case when old.is_bureau_commander then 'Bureau Commander' end,
                      nullif(array_to_string(coalesce(old.commanded_divisions, '{}'), ', '), '')),
      concat_ws(', ', case when new.is_bureau_manager then 'Bureau Manager' end,
                      case when new.is_bureau_commander then 'Bureau Commander' end,
                      nullif(array_to_string(coalesce(new.commanded_divisions, '{}'), ', '), '')));
    _parts := _parts || 'vezetői kinevezések'::text;
  end if;

  if new.full_name is distinct from old.full_name then
    insert into public.member_events (user_id, actor_id, kind, from_value, to_value)
    values (new.id, _actor, 'name', old.full_name, new.full_name);
    _parts := _parts || format('név: %s', new.full_name);
  end if;

  if new.badge_number is distinct from old.badge_number then
    insert into public.member_events (user_id, actor_id, kind, from_value, to_value)
    values (new.id, _actor, 'badge', old.badge_number, new.badge_number);
    _parts := _parts || format('jelvényszám: #%s', new.badge_number);
  end if;

  if cardinality(_parts) > 0 then
    perform private.notify(array[new.id], 'Adatlap módosítva',
      format('A vezetőség módosította az adataidat (%s).', array_to_string(_parts, '; ')),
      'info', 'hr', '/profile');
  end if;
  return new;
end;
$function$;

-- The HR API's write path (service_role): the same as before, plus the titles.
create or replace function public.hr_apply_member_update(_actor uuid, _target uuid, _changes jsonb)
returns void
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  _old_name text;
begin
  perform set_config('app.actor_id', coalesce(_actor::text, ''), true);
  select full_name into _old_name from profiles where id = _target;
  if not found then raise exception 'A felhasználó nem található.'; end if;

  update profiles set
    full_name = coalesce(_changes ->> 'full_name', full_name),
    badge_number = coalesce(_changes ->> 'badge_number', badge_number),
    faction_rank = coalesce(_changes ->> 'faction_rank', faction_rank),
    system_role = coalesce(_changes ->> 'system_role', system_role),
    division = coalesce(_changes ->> 'division', division),
    division_rank = case when _changes ? 'division_rank' then nullif(_changes ->> 'division_rank', '') else division_rank end,
    division_titles = case when _changes ? 'division_titles'
      then array(select (jsonb_array_elements_text(_changes -> 'division_titles'))::uuid) else division_titles end,
    qualifications = case when _changes ? 'qualifications'
      then array(select jsonb_array_elements_text(_changes -> 'qualifications')) else qualifications end,
    is_bureau_manager = coalesce((_changes ->> 'is_bureau_manager')::boolean, is_bureau_manager),
    is_bureau_commander = coalesce((_changes ->> 'is_bureau_commander')::boolean, is_bureau_commander),
    commanded_divisions = case when _changes ? 'commanded_divisions'
      then array(select jsonb_array_elements_text(_changes -> 'commanded_divisions')) else commanded_divisions end,
    last_promotion_date = case when _changes ? 'last_promotion_date'
      then (_changes ->> 'last_promotion_date')::timestamptz else last_promotion_date end
  where id = _target;

  if _changes ? 'full_name' and (_changes ->> 'full_name') is distinct from _old_name then
    insert into name_change_logs (user_id, old_name, new_name, changed_by)
    values (_target, _old_name, _changes ->> 'full_name', _actor);
  end if;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 4. The bureau's own catalogue: reading and editing
-- ---------------------------------------------------------------------------

-- The Bureau Manager every division; a Bureau Commander their own.
create or replace function private.can_manage_bureau(_division text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.system_role <> 'pending'
      and (coalesce(p.is_bureau_manager, false) or (coalesce(p.is_bureau_commander, false) and p.division = _division)))
$$;
revoke execute on function private.can_manage_bureau(text) from public, anon;
grant execute on function private.can_manage_bureau(text) to authenticated;

-- Every division's ranks and titles in one call (small; cached by the client).
create or replace function public.get_bureau_catalog()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select case when not private.is_member() then null else json_build_object(
    'ranks', coalesce((select json_agg(json_build_object('id', r.id, 'division', r.division, 'name', r.name,
                                                          'sort_order', r.sort_order, 'privileged', r.privileged)
                                       order by r.division, r.sort_order, r.name)
                       from public.division_ranks r), '[]'::json),
    'titles', coalesce((select json_agg(json_build_object('id', t.id, 'division', t.division, 'name', t.name, 'icon', t.icon,
                                                           'tone', t.tone, 'description', t.description, 'sort_order', t.sort_order)
                                        order by t.division, t.sort_order, t.name)
                        from public.division_titles t), '[]'::json)) end
$$;
revoke execute on function public.get_bureau_catalog() from public, anon, authenticated;
grant execute on function public.get_bureau_catalog() to authenticated;

-- A rank: new (_id null) or renamed; a rename is carried over to its members. Only the Bureau
-- Manager changes the privileged flag (null = unchanged).
create or replace function public.save_division_rank(_id uuid, _division text, _name text, _privileged boolean default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _name_clean text := regexp_replace(btrim(coalesce(_name, '')), '\s+', ' ', 'g');
  _row public.division_ranks%rowtype;
  _manager boolean := coalesce((select p.is_bureau_manager from public.profiles p where p.id = (select auth.uid())), false);
begin
  if _id is not null then
    select * into _row from public.division_ranks where id = _id for update;
    if _row.id is null then raise exception 'A rang nem található.'; end if;
    _division := _row.division;
  end if;
  if _division is null or _division not in ('TSB', 'SEB', 'MCB') then raise exception 'Ismeretlen osztály.'; end if;
  if not private.can_manage_bureau(_division) then
    raise exception 'Az osztály rangjait a Bureau Commander és a Bureau Manager kezeli.' using errcode = '42501';
  end if;
  if char_length(_name_clean) not between 2 and 40 then raise exception 'A rang neve 2–40 karakter lehet.'; end if;
  if exists (select 1 from public.division_ranks r where r.division = _division and lower(r.name) = lower(_name_clean)
             and r.id is distinct from _id) then
    raise exception 'Ilyen nevű rang már van az osztályon.';
  end if;
  if _privileged is not null and _privileged is distinct from coalesce(_row.privileged, false) and not _manager then
    raise exception 'A rang jogköreit csak a Bureau Manager állíthatja.' using errcode = '42501';
  end if;

  perform set_config('app.actor_id', coalesce((select auth.uid())::text, ''), true);
  if _id is null then
    insert into public.division_ranks (division, name, sort_order, privileged, updated_by)
    values (_division, _name_clean,
            coalesce((select max(sort_order) from public.division_ranks where division = _division), 0) + 10,
            coalesce(_privileged, false), (select auth.uid()))
    returning * into _row;
  else
    if _name_clean <> _row.name then
      perform set_config('app.bureau_restructure', 'on', true);
      update public.profiles set division_rank = _name_clean where division = _division and division_rank = _row.name;
      perform set_config('app.bureau_restructure', 'off', true);
    end if;
    update public.division_ranks set name = _name_clean, privileged = coalesce(_privileged, privileged),
      updated_at = now(), updated_by = (select auth.uid())
    where id = _id
    returning * into _row;
  end if;
  return json_build_object('id', _row.id, 'division', _row.division, 'name', _row.name, 'sort_order', _row.sort_order,
                           'privileged', _row.privileged);
end;
$$;
revoke execute on function public.save_division_rank(uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.save_division_rank(uuid, text, text, boolean) to authenticated;

-- Removes a rank; its members move to another rank of the division (_move_to) or lose it.
-- Returns how many members were moved.
create or replace function public.delete_division_rank(_id uuid, _move_to uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  _row public.division_ranks%rowtype;
  _target public.division_ranks%rowtype;
  _moved integer;
begin
  select * into _row from public.division_ranks where id = _id for update;
  if _row.id is null then raise exception 'A rang nem található.'; end if;
  if not private.can_manage_bureau(_row.division) then
    raise exception 'Az osztály rangjait a Bureau Commander és a Bureau Manager kezeli.' using errcode = '42501';
  end if;
  if _move_to is not null then
    select * into _target from public.division_ranks where id = _move_to;
    if _target.id is null or _target.division <> _row.division or _target.id = _row.id then
      raise exception 'A tagokat az osztály egy másik rangjába lehet áthelyezni.';
    end if;
  end if;
  -- A real change for the members: it is logged and they are notified (actor: the caller).
  perform set_config('app.actor_id', coalesce((select auth.uid())::text, ''), true);
  update public.profiles set division_rank = _target.name where division = _row.division and division_rank = _row.name;
  get diagnostics _moved = row_count;
  delete from public.division_ranks where id = _id;
  return _moved;
end;
$$;
revoke execute on function public.delete_division_rank(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_division_rank(uuid, uuid) to authenticated;

-- The order of a division's ranks (highest first) in one call.
create or replace function public.reorder_division_ranks(_division text, _ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_bureau(_division) then
    raise exception 'Az osztály rangjait a Bureau Commander és a Bureau Manager kezeli.' using errcode = '42501';
  end if;
  update public.division_ranks r set sort_order = x.position * 10, updated_at = now(), updated_by = (select auth.uid())
  from unnest(coalesce(_ids, '{}')) with ordinality as x(id, position)
  where r.id = x.id and r.division = _division and r.sort_order is distinct from x.position * 10;
end;
$$;
revoke execute on function public.reorder_division_ranks(text, uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_division_ranks(text, uuid[]) to authenticated;

-- A title: new (_id null) or changed.
create or replace function public.save_division_title(_id uuid, _division text, _name text, _icon text, _tone text,
  _description text default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _name_clean text := regexp_replace(btrim(coalesce(_name, '')), '\s+', ' ', 'g');
  _row public.division_titles%rowtype;
begin
  if _id is not null then
    select * into _row from public.division_titles where id = _id for update;
    if _row.id is null then raise exception 'A cím nem található.'; end if;
    _division := _row.division;
  end if;
  if _division is null or _division not in ('TSB', 'SEB', 'MCB') then raise exception 'Ismeretlen osztály.'; end if;
  if not private.can_manage_bureau(_division) then
    raise exception 'Az osztály címeit a Bureau Commander és a Bureau Manager kezeli.' using errcode = '42501';
  end if;
  if char_length(_name_clean) not between 2 and 30 then raise exception 'A cím neve 2–30 karakter lehet.'; end if;
  if exists (select 1 from public.division_titles t where t.division = _division and lower(t.name) = lower(_name_clean)
             and t.id is distinct from _id) then
    raise exception 'Ilyen nevű cím már van az osztályon.';
  end if;
  if coalesce(_icon, '') !~ '^[a-z0-9-]{2,30}$' then raise exception 'Érvénytelen ikon.'; end if;
  if coalesce(_tone, '') not in ('amber', 'rose', 'emerald', 'sky', 'violet', 'orange', 'cyan', 'slate', 'red') then
    raise exception 'Érvénytelen szín.';
  end if;
  if char_length(coalesce(_description, '')) > 160 then raise exception 'A leírás legfeljebb 160 karakter lehet.'; end if;

  if _id is null then
    insert into public.division_titles (division, name, icon, tone, description, sort_order, updated_by)
    values (_division, _name_clean, _icon, _tone, nullif(btrim(coalesce(_description, '')), ''),
            coalesce((select max(sort_order) from public.division_titles where division = _division), 0) + 10, (select auth.uid()))
    returning * into _row;
  else
    update public.division_titles set name = _name_clean, icon = _icon, tone = _tone,
      description = nullif(btrim(coalesce(_description, '')), ''), updated_at = now(), updated_by = (select auth.uid())
    where id = _id
    returning * into _row;
  end if;
  return json_build_object('id', _row.id, 'division', _row.division, 'name', _row.name, 'icon', _row.icon, 'tone', _row.tone,
                           'description', _row.description, 'sort_order', _row.sort_order);
end;
$$;
revoke execute on function public.save_division_title(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.save_division_title(uuid, text, text, text, text, text) to authenticated;

-- Removes a title from the division and from everyone who held it (no history entries).
create or replace function public.delete_division_title(_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  _row public.division_titles%rowtype;
  _holders integer;
begin
  select * into _row from public.division_titles where id = _id for update;
  if _row.id is null then raise exception 'A cím nem található.'; end if;
  if not private.can_manage_bureau(_row.division) then
    raise exception 'Az osztály címeit a Bureau Commander és a Bureau Manager kezeli.' using errcode = '42501';
  end if;
  perform set_config('app.bureau_restructure', 'on', true);
  update public.profiles set division_titles = array_remove(division_titles, _id) where _id = any(division_titles);
  get diagnostics _holders = row_count;
  perform set_config('app.bureau_restructure', 'off', true);
  delete from public.division_titles where id = _id;
  return _holders;
end;
$$;
revoke execute on function public.delete_division_title(uuid) from public, anon, authenticated;
grant execute on function public.delete_division_title(uuid) to authenticated;

create or replace function public.reorder_division_titles(_division text, _ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_bureau(_division) then
    raise exception 'Az osztály címeit a Bureau Commander és a Bureau Manager kezeli.' using errcode = '42501';
  end if;
  update public.division_titles t set sort_order = x.position * 10, updated_at = now(), updated_by = (select auth.uid())
  from unnest(coalesce(_ids, '{}')) with ordinality as x(id, position)
  where t.id = x.id and t.division = _division and t.sort_order is distinct from x.position * 10;
end;
$$;
revoke execute on function public.reorder_division_titles(text, uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_division_titles(text, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. The MCB rights of the privileged rank (latest definitions; only the fixed
--    "Investigator III." check is replaced by private.has_privileged_division_rank)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.can_approve_warrants()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.system_role <> 'pending'
      and (p.system_role in ('admin', 'supervisor') or private.rank_index(p.faction_rank) <= 8
           or coalesce(p.is_bureau_manager, false)
           or (p.division = 'MCB' and private.has_privileged_division_rank(p.division, p.division_rank)))
  )
$function$;

CREATE OR REPLACE FUNCTION private.can_view_mcb_overview()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.system_role <> 'pending'
      and (p.system_role in ('admin', 'supervisor') or coalesce(p.is_bureau_manager, false)
           or (p.division = 'MCB' and (coalesce(p.is_bureau_commander, false) or private.has_privileged_division_rank(p.division, p.division_rank))))
  )
$function$;

CREATE OR REPLACE FUNCTION private.sees_all_cases()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.system_role <> 'pending'
      and (coalesce(p.is_bureau_manager, false)
           or (p.division = 'MCB' and (coalesce(p.is_bureau_commander, false) or private.has_privileged_division_rank(p.division, p.division_rank)))
           or p.system_role = 'admin' or private.rank_index(p.faction_rank) <= 6)
  )
$function$;

CREATE OR REPLACE FUNCTION private.user_can_open_case(_case_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.profiles p
    where p.id = _user_id and p.system_role <> 'pending'
      and (coalesce(p.is_bureau_manager, false)
           or (p.division = 'MCB' and (coalesce(p.is_bureau_commander, false) or private.has_privileged_division_rank(p.division, p.division_rank)))
           or p.system_role = 'admin' or private.rank_index(p.faction_rank) <= 6
           or exists (select 1 from public.cases c where c.id = _case_id and c.owner_id = _user_id)
           or exists (select 1 from public.case_collaborators cc where cc.case_id = _case_id and cc.user_id = _user_id))
  )
$function$;

CREATE OR REPLACE FUNCTION private.warrant_approver_ids()
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(array_agg(id), '{}') from public.profiles
  where system_role <> 'pending'
    and (system_role in ('admin', 'supervisor') or private.rank_index(faction_rank) <= 8
         or coalesce(is_bureau_manager, false)
         or (division = 'MCB' and private.has_privileged_division_rank(division, division_rank)))
$function$;

CREATE OR REPLACE FUNCTION public.delete_suspect_safely(_suspect_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  _me profiles%rowtype;
  _suspect suspects%rowtype;
  _active_warrants int;
  _linked_cases int;
begin
  _me := private.me();
  if _me.id is null then
    return json_build_object('success', false, 'message', 'Nincs jogosultságod.');
  end if;
  select * into _suspect from suspects where id = _suspect_id;
  if _suspect.id is null then
    return json_build_object('success', false, 'message', 'A gyanúsított nem található.');
  end if;

  if not (coalesce(_me.is_bureau_manager, false)
          or (_me.division = 'MCB' and (coalesce(_me.is_bureau_commander, false) or private.has_privileged_division_rank(_me.division, _me.division_rank)))) then
    if _suspect.created_by is distinct from _me.id then
      return json_build_object('success', false, 'message', 'Csak a saját magad által létrehozott gyanúsítottat törölheted.');
    end if;
  end if;

  select count(*) into _active_warrants from case_warrants
  where suspect_id = _suspect_id and status in ('pending', 'approved');
  if _active_warrants > 0 then
    return json_build_object('success', false, 'message', 'Nem törölhető: A személyhez aktív elfogatóparancs tartozik!');
  end if;

  select count(*) into _linked_cases from case_suspects where suspect_id = _suspect_id;
  if _linked_cases > 0 then
    return json_build_object('success', false, 'message',
      'Nem törölhető: A személy ' || _linked_cases || ' aktához van csatolva. Előbb távolítsd el az aktákból.');
  end if;

  delete from suspects where id = _suspect_id;
  return json_build_object('success', true, 'message', 'Gyanúsított törölve.');
end;
$function$;

CREATE OR REPLACE FUNCTION public.reassign_cases_on_leave()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    target_investigator_id UUID;
    is_leaving_mcb BOOLEAN;
BEGIN
    -- Ellenőrizzük, hogy elhagyja-e az MCB-t (vagy törlik)
    is_leaving_mcb := FALSE;
    
    IF (TG_OP = 'DELETE') THEN
        IF OLD.division = 'MCB' THEN is_leaving_mcb := TRUE; END IF;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Ha eddig MCB volt, de most már NEM az
        IF OLD.division = 'MCB' AND NEW.division <> 'MCB' THEN 
            is_leaving_mcb := TRUE; 
        END IF;
    END IF;

    -- Ha nem releváns, kilépünk
    IF NOT is_leaving_mcb THEN
        RETURN NULL; -- Triggerben NULL jó, ha AFTER trigger, de itt BEFORE/AFTER logikától függ
    END IF;

    -- Új tulajdonos keresése
    -- 1. Prioritás: MCB Bureau Commander
    SELECT id INTO target_investigator_id
    FROM public.profiles
    WHERE division = 'MCB' AND is_bureau_commander = true
    LIMIT 1;

    -- 2. Prioritás: Ha nincs Commander, akkor Manager (Admin)
    IF target_investigator_id IS NULL THEN
        SELECT id INTO target_investigator_id
        FROM public.profiles
        WHERE is_bureau_manager = true
        LIMIT 1;
    END IF;

    -- 3. Végső eset: az MCB jogosult (privileged) rangja (korábban: Investigator III.)
    IF target_investigator_id IS NULL THEN
        SELECT id INTO target_investigator_id
        FROM public.profiles
        WHERE division = 'MCB' AND private.has_privileged_division_rank(division, division_rank)
        LIMIT 1;
    END IF;

    -- Átírás
    IF target_investigator_id IS NOT NULL THEN
        UPDATE public.cases
        SET owner_id = target_investigator_id
        WHERE owner_id = OLD.id;
    END IF;

    RETURN NULL;
END;
$function$;


-- The printable service record: the titles too (latest definition, the member's current titles and
-- their history entries added).
create or replace function public.get_service_record(_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET "TimeZone" TO 'Europe/Budapest'
AS $function$
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
      'commanded_divisions', _p.commanded_divisions, 'created_at', _p.created_at, 'last_promotion_date', _p.last_promotion_date,
      'division_titles', (select coalesce(json_agg(t.name order by t.sort_order, t.name), '[]'::json)
                          from public.division_titles t where t.id = any(_p.division_titles))),
    'details', (select json_build_object('station', d.station, 'joined_on', d.joined_on, 'join_type', d.join_type,
                                         'activity_status', d.activity_status)
                from public.member_details d where d.user_id = _p.id),
    'history', (select coalesce(json_agg(json_build_object('kind', e.kind, 'from_value', e.from_value, 'to_value', e.to_value,
                                                         'detail', e.detail, 'created_at', e.created_at,
                                                         'actor_name', (select full_name from public.profiles where id = e.actor_id))
                                       order by e.created_at), '[]'::json)
                from public.member_events e
                where e.user_id = _p.id and e.kind in ('joined', 'rank', 'division', 'division_rank', 'division_title', 'qualifications', 'bureau_role')),
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
$function$;
