-- =============================================================================
-- Fleet categories managed on the site (rename, add, delete with a choice for
-- their vehicles), and the HR rule for bureau commanders.
--
-- Compatible with the deployed frontend: it never deletes categories, and the
-- changed hr_update_user_profile_v2() only allows more (see 2.).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Deleting a category: its vehicles move to another category or are deleted
-- ---------------------------------------------------------------------------

-- Direct deletes would leave the vehicles without a category; the RPC asks what to do with them.
drop policy if exists fleet_categories_delete on public.fleet_categories;
revoke delete on public.fleet_categories from authenticated;

create or replace function public.fleet_delete_category(_category_id text, _move_to text default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _moved integer := 0;
  _deleted integer := 0;
begin
  if not private.is_staff() then
    raise exception 'Kategóriát a felügyelők és a felettük állók törölhetnek.' using errcode = '42501';
  end if;
  perform 1 from public.fleet_categories where id = _category_id for update;
  if not found then raise exception 'A kategória nem található.' using errcode = 'P0002'; end if;

  if _move_to is not null then
    if _move_to = _category_id then raise exception 'Másik kategóriát válassz.' using errcode = '22023'; end if;
    perform 1 from public.fleet_categories where id = _move_to;
    if not found then raise exception 'A cél kategória nem található.' using errcode = 'P0002'; end if;
    update public.fleet_vehicles set category_id = _move_to where category_id = _category_id;
    get diagnostics _moved = row_count;
  else
    -- Their keys and registration reviews go with them; warnings keep the plate.
    delete from public.fleet_vehicles where category_id = _category_id;
    get diagnostics _deleted = row_count;
  end if;

  delete from public.fleet_categories where id = _category_id;
  return json_build_object('moved', _moved, 'deleted', _deleted);
end;
$$;

revoke all on function public.fleet_delete_category(text, text) from public, anon, authenticated;
grant execute on function public.fleet_delete_category(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Bureau commanders: their rank follows the normal rank rules
-- ---------------------------------------------------------------------------

-- Only the bureau manager is protected as a whole. A bureau commander's division, the units they
-- lead and the leadership flags stay with the bureau manager (private.can_manage_user_division
-- and private.can_manage_user_qualification); their rank, name and badge follow the rank rules
-- (a Lieutenant may make a bureau commander Sergeant II.).
create or replace function public.hr_update_user_profile_v2(
  _target_user_id uuid, _full_name text, _badge_number text, _faction_rank text,
  _division text, _division_rank text, _qualifications text[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _editor profiles%rowtype;
  _target profiles%rowtype;
  _new_quals text[] := coalesce(_qualifications, '{}');
  _old_quals text[];
  _changed text;
begin
  _editor := private.me();
  select * into _target from profiles where id = _target_user_id;
  if _editor.id is null then raise exception 'Nincs jogosultságod módosításokat végezni.' using errcode = '42501'; end if;
  if _target.id is null then raise exception 'A felhasználó nem található.'; end if;
  if _editor.id = _target.id and not coalesce(_editor.is_bureau_manager, false) then
    raise exception 'A saját adataidat itt nem módosíthatod.' using errcode = '42501';
  end if;
  if coalesce(_target.is_bureau_manager, false) and not coalesce(_editor.is_bureau_manager, false) then
    raise exception 'A Bureau Managert csak Bureau Manager módosíthatja.' using errcode = '42501';
  end if;

  if (_full_name is distinct from _target.full_name or _badge_number is distinct from _target.badge_number)
     and not private.can_manage_user_rank(_editor, _target) then
    raise exception 'Nincs jogosultságod a név vagy a jelvényszám módosításához.' using errcode = '42501';
  end if;
  if _badge_number is distinct from _target.badge_number and _badge_number !~ '^\d{4}$' then
    raise exception 'A jelvényszám pontosan 4 számjegy.';
  end if;

  if _faction_rank is distinct from _target.faction_rank then
    if private.rank_index(_faction_rank) = 999 then raise exception 'Ismeretlen rendfokozat.'; end if;
    if not private.can_manage_user_rank(_editor, _target)
       or not (_faction_rank = any(private.allowed_promotion_ranks(_editor))) then
      raise exception 'Nincs jogosultságod kiosztani a(z) % rangot.', _faction_rank using errcode = '42501';
    end if;
  end if;

  -- The old page sends '' for "no bureau rank" while the row may hold NULL: the same value.
  if (_division is distinct from _target.division
      or nullif(_division_rank, '') is distinct from nullif(_target.division_rank, ''))
     and not private.can_manage_user_division(_editor, _target) then
    raise exception 'Nincs jogosultságod az osztály módosításához.' using errcode = '42501';
  end if;

  _old_quals := coalesce(_target.qualifications, '{}');
  for _changed in
    select q from unnest(_new_quals) q where not (q = any(_old_quals))
    union
    select q from unnest(_old_quals) q where not (q = any(_new_quals))
  loop
    if not private.can_manage_user_qualification(_editor, _target, _changed) then
      raise exception 'Nincs jogosultságod a(z) % képesítés módosításához.', _changed using errcode = '42501';
    end if;
  end loop;

  update profiles set
    full_name = coalesce(nullif(trim(_full_name), ''), full_name),
    badge_number = _badge_number,
    faction_rank = _faction_rank,
    system_role = case when system_role = 'pending' then system_role else private.system_role_for_rank(_faction_rank) end,
    last_promotion_date = case when _faction_rank is distinct from faction_rank then now() else last_promotion_date end,
    division = _division,
    division_rank = case when _division = 'TSB' then null else _division_rank end,
    qualifications = _new_quals
  where id = _target_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Members learn when their monthly duty time is recorded
-- ---------------------------------------------------------------------------

-- One notification per member and month: a later correction refreshes it while it is unread.
create or replace function private.on_duty_time_change()
returns trigger
language plpgsql
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
begin
  if tg_op = 'UPDATE' and new.minutes is not distinct from old.minutes then return new; end if;
  perform private.notify(array[new.user_id], 'Duty idő rögzítve',
    format('%s havi duty időd: %s óra %s perc.', to_char(new.month, 'YYYY.MM.'), new.minutes / 60, lpad((new.minutes % 60)::text, 2, '0')),
    'info', 'hr', '/profile', 'duty:' || to_char(new.month, 'YYYY-MM'));
  return new;
end;
$$;
create trigger on_duty_time_change after insert or update of minutes on public.duty_time_entries
  for each row execute function private.on_duty_time_change();
