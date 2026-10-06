-- Fleet stock, key holders, registration proofs and grouped vehicle warnings.
--
-- The old "Car Database" sheets become the source of truth for vehicle availability:
--   * fleet_categories: the sections of the sheet (vehicle types and the fleets of the
--     sub-factions). A category of a bureau or unit can only be given to its members,
--     unless the vehicle itself allows other units (allowed_units) or sets a rank floor;
--   * fleet_vehicles: in-game id, station, call sign, number of keys (capacity, null =
--     unlimited), shared pools ("MEDICAL UNIT's"), unmarked vehicles, registration-free
--     vehicles (boats);
--   * fleet_assignments: the key holders (replaces fleet_vehicles.owner_id). Supervisory
--     staff and above manage every vehicle, a bureau's leaders the vehicles of their bureau;
--   * fleet_registration_requests: renewals. The holder's browser reads the new expiry
--     from a screenshot of the in-game licence; a matching reading is applied at once and
--     the screenshot is never uploaded. Everything else waits for supervisory staff with
--     the screenshot, which is deleted as soon as it is decided;
--   * vehicle_warnings: one decision may hit several people and be worth several points
--     (batch_id groups its rows; every point is one row, so three active rows still make
--     one personal warning);
--   * fleet_tuning_presets: the official tuning of the department's vehicle models.
--
-- The fleet only exists in the development frontend (main never shipped it), so the old
-- owner_id column can go. The vehicle request approval of the deployed frontend keeps
-- working through the database trigger.

-- ---------------------------------------------------------------------------
-- 0. Helpers
-- ---------------------------------------------------------------------------

create or replace function private.try_uuid(_value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return _value::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

-- Comparison key of a plate: letters and digits only, look-alike characters folded
-- (O/Q/D -> 0, I/L/J -> 1, Z -> 2, S -> 5, G -> 6, B -> 8), so a text recognised from a
-- screenshot can be compared with the stock. Same rule as plateKey() in src/lib/fleet.ts.
create or replace function private.plate_key(_plate text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select translate(upper(regexp_replace(coalesce(_plate, ''), '[^A-Za-z0-9]', '', 'g')), 'OQDILJZSGB', '0001112568')
$$;

-- Members of a bureau (TSB/SEB/MCB: the division) or of a unit (a qualification or a
-- unit the member leads).
create or replace function private.is_unit_member(_profile public.profiles, _unit text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when _unit in ('TSB', 'SEB', 'MCB') then _profile.division = _unit
    else _unit = any(coalesce(_profile.qualifications, '{}')) or _unit = any(coalesce(_profile.commanded_divisions, '{}'))
  end
$$;

-- Leaders of a bureau or unit: the bureau commanders of SEB/MCB, the leaders of a unit
-- (commanded_divisions) and the bureau managers.
create or replace function private.leads_unit(_profile public.profiles, _unit text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select _unit is not null and _profile.system_role <> 'pending' and (
    coalesce(_profile.is_bureau_manager, false)
    or (_unit in ('SEB', 'MCB') and coalesce(_profile.is_bureau_commander, false) and _profile.division = _unit)
    or _unit = any(coalesce(_profile.commanded_divisions, '{}')))
$$;

-- ---------------------------------------------------------------------------
-- 1. Categories (the sections of the sheet)
-- ---------------------------------------------------------------------------

create table if not exists public.fleet_categories (
  id text primary key check (id ~ '^[a-z0-9-]{2,32}$'),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  description text check (char_length(description) <= 400),
  -- Only members of this bureau/unit may hold its vehicles.
  unit text check (unit in ('TSB', 'SEB', 'MCB', 'SAHP', 'AB', 'MU', 'GW', 'FAB', 'SIB', 'TB')),
  -- Only this rank and above (e.g. 'Sergeant I.' for supervisory vehicles).
  min_rank text check (min_rank is null or private.rank_index(min_rank) < 999),
  tone text not null default 'orange'
    check (tone in ('orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue',
                    'indigo', 'violet', 'rose', 'red', 'slate')),
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
alter table public.fleet_categories enable row level security;
create trigger stamp_fleet_categories before insert or update on public.fleet_categories
  for each row execute function private.stamp_update();

create policy fleet_categories_select on public.fleet_categories for select to authenticated
  using ((select private.is_member()));
create policy fleet_categories_insert on public.fleet_categories for insert to authenticated
  with check ((select private.is_staff()));
create policy fleet_categories_update on public.fleet_categories for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy fleet_categories_delete on public.fleet_categories for delete to authenticated
  using ((select private.is_admin()));
revoke all on public.fleet_categories from anon;

insert into public.fleet_categories (id, name, description, unit, min_rank, tone, sort_order) values
  ('durango', 'Marked Dodge Durango ''14', null, null, null, 'orange', 10),
  ('explorer', 'Marked Ford Explorer', null, null, null, 'orange', 20),
  ('charger', 'Marked Dodge Charger SRT', null, null, null, 'orange', 30),
  ('crown-victoria', 'Marked Ford Crown Victoria', null, null, null, 'orange', 40),
  ('game-warden', 'Game Warden Raptors', 'A Game Warden egység járművei.', 'GW', null, 'lime', 50),
  ('tahoe', 'Marked Chevrolet Tahoe', null, null, null, 'orange', 60),
  ('yukon', 'Marked GMC Yukon (Supervisory)', 'Supervisory Staff és magasabb rangúak járművei.', null, 'Sergeant I.', 'amber', 70),
  ('slicktop', 'Slicktop járművek (Command & Executive)', 'Command és Executive Staff járművei.', null, 'Lieutenant I.', 'red', 80),
  ('seb', 'Special Enforcement Bureau [SEB]', 'Az SEB járművei. Az SEB vezetősége minden SEB járművet használhat.', 'SEB', null, 'slate', 90),
  ('ab', 'Aero Bureau [AB]', 'Az Aero Bureau légi járművei.', 'AB', null, 'yellow', 100),
  ('mu', 'Medical Unit [MU]', 'A Medical Unit közös mentőjárművei.', 'MU', null, 'rose', 110),
  ('sahp', 'San Andreas Highway Patrol Unit [SAHP]', 'A SAHP egység járművei.', 'SAHP', null, 'amber', 120),
  ('mcb', 'Major Crimes Bureau [MCB]', 'Az MCB civil járművei.', 'MCB', null, 'emerald', 130),
  ('diplomat', 'Diplomat', 'Diplomata járművek.', null, null, 'teal', 140),
  ('other', 'Egyéb', 'Buszok, vontatók, teherautók, hajók és minden más.', null, null, 'green', 150)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Vehicles: stock data of the sheet
-- ---------------------------------------------------------------------------

alter table public.fleet_vehicles
  add column if not exists category_id text references public.fleet_categories(id) on update cascade on delete set null,
  add column if not exists game_id integer check (game_id between 1 and 99999999),
  add column if not exists station text check (char_length(station) <= 40),
  -- Radio call sign when it differs from the plate (helicopters: AIR-001 is SZR-812).
  add column if not exists callsign text check (char_length(callsign) between 2 and 16),
  -- The vehicle's name on the in-game licence when it differs from the model name.
  add column if not exists license_name text check (char_length(license_name) between 1 and 80),
  -- Number of keys for personal holders; null: unlimited (tow trucks, trucks, boats).
  add column if not exists capacity smallint default 2 check (capacity between 0 and 50),
  -- Shared pool ("MEDICAL UNIT's", "SEB STAFF's"): everyone allowed may use it.
  add column if not exists shared_label text check (char_length(shared_label) between 2 and 60),
  -- Overrides the category's unit ('{}' = anybody, null = the category decides).
  add column if not exists allowed_units text[]
    check (allowed_units <@ array['TSB', 'SEB', 'MCB', 'SAHP', 'AB', 'MU', 'GW', 'FAB', 'SIB', 'TB']::text[]),
  -- Overrides the category's rank floor.
  add column if not exists min_rank text check (min_rank is null or private.rank_index(min_rank) < 999),
  add column if not exists is_unmarked boolean not null default false,
  add column if not exists registration_required boolean not null default true;
create index if not exists fleet_vehicles_category_idx on public.fleet_vehicles (category_id, plate);
create index if not exists fleet_vehicles_game_id_idx on public.fleet_vehicles (game_id);

-- Vehicles registered from approved requests so far.
update public.fleet_vehicles set category_id = 'other' where category_id is null;

-- Whether a member may hold a key: one of the allowed units (the vehicle's own list,
-- otherwise its category's unit) and at least the rank floor. Same rule as canHoldVehicle()
-- in src/lib/fleet.ts.
create or replace function private.fleet_can_hold(_vehicle_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.fleet_vehicles v
    left join public.fleet_categories c on c.id = v.category_id
    join public.profiles p on p.id = _user_id and p.system_role <> 'pending'
    cross join lateral (select coalesce(v.allowed_units, array_remove(array[c.unit], null)) as units,
                               coalesce(v.min_rank, c.min_rank) as min_rank) r
    where v.id = _vehicle_id and v.is_active
      and (cardinality(r.units) = 0 or exists (select 1 from unnest(r.units) u where private.is_unit_member(p, u)))
      and (r.min_rank is null or private.rank_index(p.faction_rank) <= private.rank_index(r.min_rank)))
$$;

-- Who may hand out and take back keys: supervisory staff and above for every vehicle, the
-- leaders of a bureau or unit for the vehicles of its category.
create or replace function private.can_assign_fleet_vehicle(_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_staff() or exists (
    select 1
    from public.fleet_vehicles v
    join public.fleet_categories c on c.id = v.category_id
    join public.profiles me on me.id = (select auth.uid())
    where v.id = _vehicle_id and private.leads_unit(me, c.unit))
$$;

-- ---------------------------------------------------------------------------
-- 3. Key holders
-- ---------------------------------------------------------------------------

create table if not exists public.fleet_assignments (
  vehicle_id uuid not null references public.fleet_vehicles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  is_temporary boolean not null default false,
  note text check (char_length(note) <= 200),
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (vehicle_id, user_id)
);
create index if not exists fleet_assignments_user_idx on public.fleet_assignments (user_id);
alter table public.fleet_assignments enable row level security;

-- The current owners keep their keys.
insert into public.fleet_assignments (vehicle_id, user_id, assigned_by, assigned_at)
select id, owner_id, created_by, coalesce(updated_at, created_at)
from public.fleet_vehicles
where owner_id is not null
on conflict do nothing;

drop trigger if exists on_fleet_vehicle_change on public.fleet_vehicles;
drop function if exists private.on_fleet_vehicle_change();
alter table public.fleet_vehicles drop column if exists owner_id;

create or replace function private.holds_fleet_vehicle(_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.fleet_assignments a
                 where a.vehicle_id = _vehicle_id and a.user_id = (select auth.uid()))
     and private.is_member()
$$;

-- Who may report a renewed registration: the key holders, and for shared vehicles every
-- member allowed to use them.
create or replace function private.can_submit_fleet_registration(_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.holds_fleet_vehicle(_vehicle_id)
      or exists (select 1 from public.fleet_vehicles v
                 where v.id = _vehicle_id and v.is_active and v.shared_label is not null
                   and private.fleet_can_hold(v.id, (select auth.uid())))
$$;

-- Keys are counted per vehicle (locked, so two staff members cannot hand out the last key
-- twice); the row's identity never changes.
create or replace function private.prepare_fleet_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _vehicle public.fleet_vehicles%rowtype;
  _held integer;
begin
  if tg_op = 'UPDATE' then
    new.vehicle_id := old.vehicle_id;
    new.user_id := old.user_id;
    new.assigned_by := old.assigned_by;
    new.assigned_at := old.assigned_at;
    return new;
  end if;

  select * into _vehicle from public.fleet_vehicles where id = new.vehicle_id for update;
  if _vehicle.id is null or not _vehicle.is_active then
    raise exception 'A jármű nem található, vagy ki van vezetve.' using errcode = 'P0002';
  end if;
  if _vehicle.capacity is not null then
    select count(*) into _held from public.fleet_assignments where vehicle_id = new.vehicle_id;
    if _held >= _vehicle.capacity then
      raise exception 'A járműnek nincs szabad kulcsa (% / % kiadva).', _held, _vehicle.capacity
        using errcode = '23514';
    end if;
  end if;
  new.note := nullif(btrim(coalesce(new.note, '')), '');
  new.assigned_by := coalesce(private.actor_id(), new.assigned_by);
  new.assigned_at := now();
  return new;
end;
$$;
create trigger prepare_fleet_assignment before insert or update on public.fleet_assignments
  for each row execute function private.prepare_fleet_assignment();

create or replace function private.on_fleet_assignment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _vehicle public.fleet_vehicles%rowtype;
begin
  -- Imports and approved vehicle requests (the requester was notified already).
  if current_setting('app.fleet_auto', true) = '1' then
    return null;
  end if;
  if tg_op = 'INSERT' then
    select * into _vehicle from public.fleet_vehicles where id = new.vehicle_id;
    perform private.notify(array[new.user_id], 'Jármű hozzád rendelve',
      format('%s – %s%s', _vehicle.plate, _vehicle.model, case when new.is_temporary then ' (ideiglenesen)' else '' end),
      'info', 'logistics', '/logistics/fleet/' || new.vehicle_id);
    return null;
  end if;
  -- Nothing to say when the vehicle itself is being removed.
  select * into _vehicle from public.fleet_vehicles where id = old.vehicle_id;
  if _vehicle.id is not null then
    perform private.notify(array[old.user_id], 'Jármű visszavéve', format('%s – %s', _vehicle.plate, _vehicle.model),
      'warning', 'logistics', '/logistics?tab=fleet');
  end if;
  return null;
end;
$$;
create trigger on_fleet_assignment_change after insert or delete on public.fleet_assignments
  for each row execute function private.on_fleet_assignment_change();

create policy fleet_assignments_select on public.fleet_assignments for select to authenticated
  using ((select private.is_member()));
create policy fleet_assignments_insert on public.fleet_assignments for insert to authenticated
  with check (private.can_assign_fleet_vehicle(vehicle_id) and private.fleet_can_hold(vehicle_id, user_id));
create policy fleet_assignments_update on public.fleet_assignments for update to authenticated
  using (private.can_assign_fleet_vehicle(vehicle_id)) with check (private.can_assign_fleet_vehicle(vehicle_id));
create policy fleet_assignments_delete on public.fleet_assignments for delete to authenticated
  using (private.can_assign_fleet_vehicle(vehicle_id));
revoke all on public.fleet_assignments from anon;
revoke update on public.fleet_assignments from authenticated;
grant update (is_temporary, note) on public.fleet_assignments to authenticated;

-- Approved vehicle requests give the requester a key of the vehicle with that plate; an
-- unknown plate is added to the stock ("Egyéb"). Never blocks the approval itself (a full
-- or unusual vehicle is simply skipped).
create or replace function private.on_vehicle_request_approved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _vehicle_id uuid;
begin
  if new.status = 'approved' and old.status is distinct from 'approved'
     and char_length(btrim(coalesce(new.vehicle_plate, ''))) between 2 and 16 then
    begin
      select id into _vehicle_id from public.fleet_vehicles where upper(btrim(plate)) = upper(btrim(new.vehicle_plate));
      if _vehicle_id is null then
        insert into public.fleet_vehicles (plate, model, category_id, notes)
        values (new.vehicle_plate, left(coalesce(nullif(btrim(new.vehicle_type), ''), 'Jármű'), 60),
                (select id from public.fleet_categories where id = 'other'), 'Járműigénylésből')
        returning id into _vehicle_id;
      else
        update public.fleet_vehicles set is_active = true where id = _vehicle_id and not is_active;
      end if;
      perform set_config('app.fleet_auto', '1', true);
      insert into public.fleet_assignments (vehicle_id, user_id, assigned_by)
      values (_vehicle_id, new.user_id, new.processed_by)
      on conflict do nothing;
      perform set_config('app.fleet_auto', '', true);
    exception when others then
      perform set_config('app.fleet_auto', '', true);
    end;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Vehicle warnings: several people and several points at once
-- ---------------------------------------------------------------------------

drop trigger if exists on_vehicle_warning_change on public.vehicle_warnings;
drop function if exists private.on_vehicle_warning_change();

-- Every warning belongs to a person now (the vehicle is optional).
delete from public.vehicle_warnings where user_id is null;
alter table public.vehicle_warnings
  add column if not exists batch_id uuid not null default gen_random_uuid(),
  alter column plate drop not null,
  alter column user_id set not null;
create index if not exists vehicle_warnings_batch_idx on public.vehicle_warnings (batch_id);

create or replace function private.prepare_vehicle_warning()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _plate text;
begin
  if tg_op = 'INSERT' then
    if new.vehicle_id is not null then
      select plate into _plate from public.fleet_vehicles where id = new.vehicle_id;
      new.plate := coalesce(_plate, new.plate);
    end if;
    new.plate := nullif(upper(btrim(coalesce(new.plate, ''))), '');
    new.reason := btrim(new.reason);
    new.issued_by := coalesce(private.actor_id(), new.issued_by);
    new.created_at := now();
    new.revoked_at := null;
    new.revoked_by := null;
    new.converted_record_id := null;
    return new;
  end if;

  -- The conversion into a personal warning links the rows.
  if current_setting('app.vehicle_warning_convert', true) = '1' then
    return new;
  end if;
  -- Otherwise updates only revoke or restore; the rest of the row is fixed.
  if old.converted_record_id is not null then
    raise exception 'A jármű-hibapontból már figyelmeztetés lett; azt a személyügyön lehet visszavonni.'
      using errcode = '42501';
  end if;
  new.vehicle_id := old.vehicle_id;
  new.plate := old.plate;
  new.user_id := old.user_id;
  new.reason := old.reason;
  new.issued_by := old.issued_by;
  new.created_at := old.created_at;
  new.batch_id := old.batch_id;
  new.converted_record_id := old.converted_record_id;
  if new.revoked_at is not null and old.revoked_at is null then
    new.revoked_at := now();
    new.revoked_by := private.actor_id();
  elsif new.revoked_at is null then
    new.revoked_by := null;
  else
    new.revoked_at := old.revoked_at;
    new.revoked_by := old.revoked_by;
  end if;
  return new;
end;
$$;

-- Every three active points of a member become one personal warning (repeatedly, when a
-- grave decision is worth several points).
create or replace function private.convert_vehicle_warnings(_user_id uuid, _issuer uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  _active uuid[];
  _record_id uuid;
  _details text;
  _created integer := 0;
begin
  loop
    select coalesce(array_agg(x.id order by x.created_at, x.id), '{}') into _active
    from (select id, created_at from public.vehicle_warnings
          where user_id = _user_id and revoked_at is null and converted_record_id is null
          order by created_at, id limit 3) x;
    exit when cardinality(_active) < 3;

    select string_agg(format('%s – %s (%s)', coalesce(plate, 'jármű nélkül'), reason, to_char(created_at, 'YYYY.MM.DD.')),
                      E'\n' order by created_at, id)
      into _details
    from public.vehicle_warnings where id = any(_active);

    insert into public.hr_records (user_id, kind, title, details, status, created_by)
    values (_user_id, 'warning', 'Figyelmeztetés: 3 jármű-hibapont', left(_details, 2000), 'active', _issuer)
    returning id into _record_id;

    perform set_config('app.vehicle_warning_convert', '1', true);
    update public.vehicle_warnings set converted_record_id = _record_id where id = any(_active);
    perform set_config('app.vehicle_warning_convert', '', true);
    _created := _created + 1;
  end loop;
  return _created;
end;
$$;

-- One notification per person and decision (worth all its points), then the conversion.
create or replace function private.on_vehicle_warnings_issued()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _row record;
  _active integer;
begin
  for _row in
    select n.user_id, n.batch_id, count(*)::integer as points, min(n.reason) as reason,
           string_agg(distinct n.plate, ', ') as plates, (array_agg(n.issued_by))[1] as issued_by
    from new_rows n
    group by n.user_id, n.batch_id
  loop
    select count(*) into _active from public.vehicle_warnings
    where user_id = _row.user_id and revoked_at is null and converted_record_id is null;
    perform private.notify(array[_row.user_id], 'Jármű-hibapont',
      format('%s%s%s · aktív: %s/3', coalesce(_row.plates || ': ', ''), _row.reason,
             case when _row.points > 1 then format(' (%s pont)', _row.points) else '' end, least(_active, 3)),
      'warning', 'logistics', '/profile');
  end loop;

  for _row in select n.user_id, (array_agg(n.issued_by))[1] as issued_by from new_rows n group by n.user_id loop
    perform private.convert_vehicle_warnings(_row.user_id, _row.issued_by);
  end loop;
  return null;
end;
$$;
create trigger on_vehicle_warnings_issued after insert on public.vehicle_warnings
  referencing new table as new_rows
  for each statement execute function private.on_vehicle_warnings_issued();

create or replace function private.on_vehicle_warnings_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _row record;
begin
  for _row in
    select n.user_id, count(*)::integer as points, min(n.reason) as reason, string_agg(distinct n.plate, ', ') as plates
    from new_rows n join old_rows o on o.id = n.id
    where n.revoked_at is not null and o.revoked_at is null
    group by n.user_id, n.batch_id
  loop
    perform private.notify(array[_row.user_id], 'Jármű-hibapont visszavonva',
      format('%s%s%s', coalesce(_row.plates || ': ', ''), _row.reason,
             case when _row.points > 1 then format(' (%s pont)', _row.points) else '' end),
      'info', 'logistics', '/profile');
  end loop;
  -- Restored points count again.
  for _row in
    select distinct n.user_id, n.revoked_by as restored_by
    from new_rows n join old_rows o on o.id = n.id
    where n.revoked_at is null and o.revoked_at is not null
  loop
    perform private.convert_vehicle_warnings(_row.user_id, coalesce(private.actor_id(), _row.restored_by));
  end loop;
  return null;
end;
$$;
create trigger on_vehicle_warnings_changed after update on public.vehicle_warnings
  referencing old table as old_rows new table as new_rows
  for each statement execute function private.on_vehicle_warnings_changed();

-- Staff above the member; never yourself.
drop policy if exists vehicle_warnings_insert on public.vehicle_warnings;
drop policy if exists vehicle_warnings_update on public.vehicle_warnings;
create policy vehicle_warnings_insert on public.vehicle_warnings for insert to authenticated
  with check ((select private.is_staff()) and user_id <> (select auth.uid()) and private.outranks(user_id));
create policy vehicle_warnings_update on public.vehicle_warnings for update to authenticated
  using ((select private.is_staff()) and user_id <> (select auth.uid()) and private.outranks(user_id))
  with check ((select private.is_staff()) and user_id <> (select auth.uid()) and private.outranks(user_id));

-- ---------------------------------------------------------------------------
-- 5. Registration renewals
-- ---------------------------------------------------------------------------

create table if not exists public.fleet_registration_requests (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.fleet_vehicles(id) on delete cascade,
  submitted_by uuid references public.profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  -- auto: the reading matched and the holder accepted it; manual: staff set the date;
  -- not_detected / mismatch / disputed: waits for supervisory staff with the screenshot.
  source text not null check (source in ('auto', 'manual', 'not_detected', 'mismatch', 'disputed')),
  -- Storage path in "fleet_registrations"; cleared once decided (the file is deleted).
  image_path text check (char_length(image_path) <= 200),
  detected_model text check (char_length(detected_model) <= 120),
  detected_plate text check (char_length(detected_plate) <= 40),
  detected_expires_on date,
  -- What the holder thinks is right, when the reading was wrong.
  proposed_expires_on date,
  note text check (char_length(note) <= 300),
  previous_expires_on date,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  decided_expires_on date,
  decision_note text check (char_length(decision_note) <= 300),
  created_at timestamptz not null default now(),
  constraint fleet_registration_requests_image_check check (status = 'pending' or image_path is null)
);
-- One open review per vehicle.
create unique index if not exists fleet_registration_requests_pending_key
  on public.fleet_registration_requests (vehicle_id) where status = 'pending';
create index if not exists fleet_registration_requests_vehicle_idx
  on public.fleet_registration_requests (vehicle_id, created_at desc);
create index if not exists fleet_registration_requests_open_idx
  on public.fleet_registration_requests (created_at) where status = 'pending';
alter table public.fleet_registration_requests enable row level security;

create policy fleet_registration_requests_select on public.fleet_registration_requests for select to authenticated
  using (submitted_by = (select auth.uid()) or (select private.is_staff()) or private.holds_fleet_vehicle(vehicle_id));
revoke all on public.fleet_registration_requests from anon;
-- Written through the functions below only.
revoke insert, update, delete on public.fleet_registration_requests from authenticated;

-- Screenshots waiting for a decision. Files are named "<uploader id>_<vehicle id>_<random>.<ext>".
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fleet_registrations', 'fleet_registrations', false, 3145728, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy fleet_registrations_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'fleet_registrations' and starts_with(name, (select auth.uid())::text || '_')
              and private.can_submit_fleet_registration(private.try_uuid(split_part(name, '_', 2))));
create policy fleet_registrations_select on storage.objects for select to authenticated
  using (bucket_id = 'fleet_registrations'
         and (starts_with(name, (select auth.uid())::text || '_') or (select private.is_staff())));
create policy fleet_registrations_delete on storage.objects for delete to authenticated
  using (bucket_id = 'fleet_registrations'
         and (starts_with(name, (select auth.uid())::text || '_') or (select private.is_staff())));

-- The holder accepts what the browser read from the licence (plate and model matched the
-- stock): the date applies at once and no screenshot is stored.
create or replace function public.fleet_registration_apply(
  _vehicle_id uuid, _expires_on date, _detected_model text, _detected_plate text)
returns public.fleet_vehicles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _vehicle fleet_vehicles%rowtype;
begin
  select * into _vehicle from fleet_vehicles where id = _vehicle_id for update;
  if _vehicle.id is null or not _vehicle.is_active then
    raise exception 'A jármű nem található.' using errcode = 'P0002';
  end if;
  if not (private.can_submit_fleet_registration(_vehicle_id) or private.is_staff()) then
    raise exception 'Csak a jármű kulcsosa vagy a vezetőség frissítheti a forgalmit.' using errcode = '42501';
  end if;
  if not _vehicle.registration_required then
    raise exception 'Ehhez a járműhöz nem kell forgalmi engedély.' using errcode = '22023';
  end if;
  if _expires_on is null or _expires_on < current_date or _expires_on > current_date + 400 then
    raise exception 'Érvénytelen lejárati dátum.' using errcode = '22023';
  end if;
  if _vehicle.registration_expires_on is not null and _expires_on <= _vehicle.registration_expires_on then
    raise exception 'A képen lévő lejárat nem későbbi a nyilvántartottnál; küldd ellenőrzésre.' using errcode = '22023';
  end if;
  if private.plate_key(_vehicle.plate) = '' or position(private.plate_key(_vehicle.plate) in private.plate_key(_detected_plate)) = 0 then
    raise exception 'A képen olvasott rendszám nem egyezik a járműével.' using errcode = '22023';
  end if;
  if exists (select 1 from fleet_registration_requests where vehicle_id = _vehicle_id and status = 'pending') then
    raise exception 'Ehhez a járműhöz már van ellenőrzésre váró forgalmi. Várd meg a döntést, vagy vond vissza.'
      using errcode = '23505';
  end if;

  insert into fleet_registration_requests (vehicle_id, submitted_by, status, source, detected_model, detected_plate,
                                           detected_expires_on, previous_expires_on, decided_at, decided_expires_on)
  values (_vehicle_id, auth.uid(), 'approved', 'auto', left(_detected_model, 120), left(_detected_plate, 40), _expires_on,
          _vehicle.registration_expires_on, now(), _expires_on);
  update fleet_vehicles set registration_expires_on = _expires_on where id = _vehicle_id returning * into _vehicle;
  return _vehicle;
end;
$$;

-- Anything the browser could not confirm goes to supervisory staff with the screenshot.
create or replace function public.fleet_registration_submit(
  _vehicle_id uuid, _image_path text, _source text, _detected_model text default null, _detected_plate text default null,
  _detected_expires_on date default null, _proposed_expires_on date default null, _note text default null)
returns public.fleet_registration_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _vehicle fleet_vehicles%rowtype;
  _request fleet_registration_requests%rowtype;
begin
  select * into _vehicle from fleet_vehicles where id = _vehicle_id;
  if _vehicle.id is null or not _vehicle.is_active then
    raise exception 'A jármű nem található.' using errcode = 'P0002';
  end if;
  if not private.can_submit_fleet_registration(_vehicle_id) then
    raise exception 'Csak a jármű kulcsosa küldhet be forgalmit.' using errcode = '42501';
  end if;
  if _source is null or _source not in ('not_detected', 'mismatch', 'disputed') then
    raise exception 'Érvénytelen beküldés.' using errcode = '22023';
  end if;
  if _image_path is null or not starts_with(_image_path, auth.uid()::text || '_' || _vehicle_id::text || '_')
     or not exists (select 1 from storage.objects where bucket_id = 'fleet_registrations' and name = _image_path) then
    raise exception 'A forgalmi képe nem található; töltsd fel újra.' using errcode = '22023';
  end if;
  if _proposed_expires_on is not null
     and (_proposed_expires_on < current_date - 400 or _proposed_expires_on > current_date + 400) then
    raise exception 'Érvénytelen javasolt dátum.' using errcode = '22023';
  end if;

  begin
    insert into fleet_registration_requests (vehicle_id, submitted_by, source, image_path, detected_model, detected_plate,
                                             detected_expires_on, proposed_expires_on, note, previous_expires_on)
    values (_vehicle_id, auth.uid(), _source, _image_path, left(nullif(btrim(_detected_model), ''), 120),
            left(nullif(btrim(_detected_plate), ''), 40), _detected_expires_on, _proposed_expires_on,
            left(nullif(btrim(_note), ''), 300), _vehicle.registration_expires_on)
    returning * into _request;
  exception when unique_violation then
    raise exception 'Ehhez a járműhöz már van ellenőrzésre váró forgalmi.' using errcode = '23505';
  end;

  perform private.notify(private.staff_ids(), 'Forgalmi ellenőrzésre vár',
    format('%s – %s (%s)', _vehicle.plate, _vehicle.model, private.member_name(auth.uid())),
    'info', 'logistics', '/logistics?tab=fleet&view=reviews', 'fleet-registration-reviews');
  return _request;
end;
$$;

-- The submitter withdraws an open review; returns the screenshot to delete.
create or replace function public.fleet_registration_cancel(_request_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _request fleet_registration_requests%rowtype;
begin
  select * into _request from fleet_registration_requests where id = _request_id for update;
  if _request.id is null or _request.submitted_by is distinct from auth.uid() then
    raise exception 'A kérelem nem található.' using errcode = 'P0002';
  end if;
  if _request.status <> 'pending' then
    raise exception 'A kérelmet már elbírálták.' using errcode = '22023';
  end if;
  update fleet_registration_requests set status = 'cancelled', image_path = null, decided_at = now()
  where id = _request_id;
  return _request.image_path;
end;
$$;

-- Supervisory staff decide; the screenshot is no longer needed afterwards (returned so the
-- client deletes it; the daily cron removes anything left over).
create or replace function public.fleet_registration_decide(
  _request_id uuid, _approve boolean, _expires_on date default null, _note text default null,
  _remember_name boolean default false)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _request fleet_registration_requests%rowtype;
  _vehicle fleet_vehicles%rowtype;
  _previous date;
  _note_text text := nullif(btrim(coalesce(_note, '')), '');
begin
  if not private.is_staff() then
    raise exception 'Csak a supervisory staff vagy magasabb rangú vezető bírálhatja el.' using errcode = '42501';
  end if;
  select * into _request from fleet_registration_requests where id = _request_id for update;
  if _request.id is null then
    raise exception 'A kérelem nem található.' using errcode = 'P0002';
  end if;
  if _request.status <> 'pending' then
    raise exception 'A kérelmet már elbírálták.' using errcode = '22023';
  end if;
  select * into _vehicle from fleet_vehicles where id = _request.vehicle_id for update;
  _previous := _vehicle.registration_expires_on;

  if _approve then
    if _expires_on is null or _expires_on < current_date - 400 or _expires_on > current_date + 400 then
      raise exception 'Adj meg érvényes lejárati dátumot.' using errcode = '22023';
    end if;
    update fleet_vehicles
    set registration_expires_on = _expires_on,
        license_name = case when _remember_name and _request.detected_model is not null
                            then left(_request.detected_model, 80) else license_name end
    where id = _vehicle.id
    returning * into _vehicle;
  elsif _note_text is null or char_length(_note_text) < 3 then
    raise exception 'Írd meg az elutasítás okát.' using errcode = '22023';
  end if;

  update fleet_registration_requests
  set status = case when _approve then 'approved' else 'rejected' end,
      decided_by = auth.uid(), decided_at = now(), decided_expires_on = case when _approve then _expires_on end,
      decision_note = left(_note_text, 300), previous_expires_on = _previous, image_path = null
  where id = _request_id;

  if _request.submitted_by is not null then
    perform private.notify(array[_request.submitted_by],
      case when _approve then 'Forgalmi elfogadva' else 'Forgalmi elutasítva' end,
      case when _approve then format('%s – %s: érvényes %s-ig', _vehicle.plate, _vehicle.model, to_char(_expires_on, 'YYYY.MM.DD'))
           else format('%s – %s: %s', _vehicle.plate, _vehicle.model, _note_text) end,
      case when _approve then 'success' else 'alert' end, 'logistics', '/logistics/fleet/' || _vehicle.id);
  end if;

  return json_build_object('image_path', _request.image_path, 'vehicle', row_to_json(_vehicle));
end;
$$;

-- Supervisory staff set (or correct) the expiry by hand, without a screenshot.
create or replace function public.fleet_renew_registration(_vehicle_id uuid, _expires_on date)
returns public.fleet_vehicles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _vehicle fleet_vehicles%rowtype;
begin
  if not private.is_staff() then
    raise exception 'A lejáratot kézzel csak a supervisory staff vagy magasabb rangú vezető módosíthatja.'
      using errcode = '42501';
  end if;
  select * into _vehicle from fleet_vehicles where id = _vehicle_id for update;
  if _vehicle.id is null then
    raise exception 'A jármű nem található.' using errcode = 'P0002';
  end if;
  if _expires_on is not null and (_expires_on < current_date - 400 or _expires_on > current_date + 400) then
    raise exception 'Érvénytelen lejárati dátum.' using errcode = '22023';
  end if;
  insert into fleet_registration_requests (vehicle_id, submitted_by, status, source, previous_expires_on, decided_by,
                                           decided_at, decided_expires_on)
  values (_vehicle_id, auth.uid(), 'approved', 'manual', _vehicle.registration_expires_on, auth.uid(), now(), _expires_on);
  update fleet_vehicles set registration_expires_on = _expires_on where id = _vehicle_id returning * into _vehicle;
  return _vehicle;
end;
$$;

-- Daily cron: closes reviews nobody decided within 30 days, lists screenshots that are no
-- longer needed (the cron deletes them through the Storage API) and drops old history.
create or replace function public.fleet_registration_cleanup()
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _request record;
  _expired integer := 0;
  _deleted integer;
  _paths text[];
begin
  for _request in
    with expired as (
      update fleet_registration_requests
      set status = 'rejected', decided_at = now(), image_path = null,
          decision_note = 'Lejárt: 30 napig senki nem bírálta el. Küldd be újra.'
      where status = 'pending' and created_at < now() - interval '30 days'
      returning submitted_by, vehicle_id)
    select * from expired
  loop
    _expired := _expired + 1;
    if _request.submitted_by is not null then
      perform private.notify(array[_request.submitted_by], 'Forgalmi ellenőrzés lejárt',
        coalesce((select plate || ' – ' || model from fleet_vehicles where id = _request.vehicle_id), 'Jármű')
          || ': küldd be újra a forgalmit.', 'warning', 'logistics', '/logistics/fleet/' || _request.vehicle_id);
    end if;
  end loop;

  select coalesce(array_agg(o.name), '{}') into _paths
  from (select name from storage.objects o
        where o.bucket_id = 'fleet_registrations' and o.created_at < now() - interval '1 day'
          and not exists (select 1 from fleet_registration_requests r where r.status = 'pending' and r.image_path = o.name)
        limit 500) o;

  delete from fleet_registration_requests where status <> 'pending' and created_at < now() - interval '120 days';
  get diagnostics _deleted = row_count;
  return json_build_object('remove', _paths, 'expired', _expired, 'deleted', _deleted);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Reminders, registry and dashboard
-- ---------------------------------------------------------------------------

-- Daily cron: one "expires soon" and one "expired" reminder per registration, to the key
-- holders (shared vehicles without holders: the leaders of their bureau or unit).
create or replace function public.fleet_send_reminders()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _vehicle fleet_vehicles%rowtype;
  _recipients uuid[];
  _expired boolean;
  _sent integer := 0;
begin
  for _vehicle in
    select * from fleet_vehicles
    where is_active and registration_required and registration_expires_on is not null
      and ((registration_expires_on <= current_date and reminder_stage < 2)
        or (registration_expires_on <= current_date + 3 and reminder_stage < 1))
  loop
    _expired := _vehicle.registration_expires_on <= current_date;
    select coalesce(array_agg(user_id), '{}') into _recipients from fleet_assignments where vehicle_id = _vehicle.id;
    if cardinality(_recipients) = 0 and _vehicle.shared_label is not null then
      select coalesce(array_agg(p.id), '{}') into _recipients
      from profiles p join fleet_categories c on c.id = _vehicle.category_id
      where private.leads_unit(p, c.unit);
    end if;
    if cardinality(_recipients) > 0 then
      if _expired then
        perform private.notify(_recipients, 'Lejárt a forgalmi engedély',
          format('%s – %s: lejárt (%s). Újítsd meg, majd töltsd fel az új forgalmit.', _vehicle.plate, _vehicle.model,
                 to_char(_vehicle.registration_expires_on, 'YYYY.MM.DD.')),
          'alert', 'logistics', '/logistics/fleet/' || _vehicle.id, 'fleet-reg:' || _vehicle.id);
      else
        perform private.notify(_recipients, 'Hamarosan lejár a forgalmi',
          format('%s – %s: a forgalmi hamarosan lejár (%s).', _vehicle.plate, _vehicle.model,
                 to_char(_vehicle.registration_expires_on, 'YYYY.MM.DD.')),
          'warning', 'logistics', '/logistics/fleet/' || _vehicle.id, 'fleet-reg:' || _vehicle.id);
      end if;
      _sent := _sent + 1;
    end if;
    update fleet_vehicles set reminder_stage = case when _expired then 2 else 1 end where id = _vehicle.id;
  end loop;
  return _sent;
end;
$$;

-- Details, duty time since a month, vehicles with their holders, vehicle warnings and bank
-- accounts, for every member or for one (_user_id). SECURITY INVOKER: RLS decides.
create or replace function public.get_hr_registry(_since date default null, _user_id uuid default null)
returns json
language sql
stable
set search_path = public, pg_temp
as $$
  select json_build_object(
    'details', coalesce((select json_agg(d) from member_details d
                         where _user_id is null or d.user_id = _user_id), '[]'::json),
    'duty', coalesce((select json_agg(json_build_object('user_id', e.user_id, 'month', e.month, 'minutes', e.minutes))
                      from duty_time_entries e
                      where (_user_id is null or e.user_id = _user_id)
                        and e.month >= coalesce(_since, date_trunc('month', current_date - interval '5 months')::date)), '[]'::json),
    'vehicles', coalesce((select json_agg(json_build_object('id', v.id, 'plate', v.plate, 'model', v.model,
                                                            'category_id', v.category_id, 'callsign', v.callsign,
                                                            'registration_expires_on', v.registration_expires_on,
                                                            'registration_required', v.registration_required,
                                                            'is_unmarked', v.is_unmarked, 'shared_label', v.shared_label,
                                                            'holder_ids', h.holder_ids,
                                                            'pending_review', exists (select 1 from fleet_registration_requests r
                                                                                      where r.vehicle_id = v.id and r.status = 'pending'))
                                          order by v.plate)
                          from fleet_vehicles v
                          cross join lateral (select array_agg(a.user_id order by a.assigned_at) as holder_ids
                                              from fleet_assignments a where a.vehicle_id = v.id) h
                          where v.is_active and h.holder_ids is not null
                            and (_user_id is null or _user_id = any(h.holder_ids))), '[]'::json),
    -- For the roster only the active ones count; a profile shows the history too.
    'vehicle_warnings', coalesce((select json_agg(w order by w.created_at desc) from vehicle_warnings w
                                  where (_user_id is null and w.revoked_at is null and w.converted_record_id is null)
                                     or w.user_id = _user_id), '[]'::json),
    'bank_accounts', coalesce((select json_agg(json_build_object('user_id', b.user_id, 'account_number', b.account_number))
                               from member_bank_accounts b
                               where _user_id is null or b.user_id = _user_id), '[]'::json)
  )
$$;

create or replace function public.get_dashboard_summary()
returns json
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  _me profiles%rowtype := private.me();
  _staff boolean;
  _admin boolean;
begin
  if _me.id is null then
    raise exception 'Nincs jogosultságod.' using errcode = '42501';
  end if;
  _staff := private.is_staff();
  _admin := private.is_admin();

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
    'pending_warrants', case when private.can_approve_warrants() then
      (select count(*) from case_warrants where status = 'pending') end,
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
                           and current_date between starts_on and ends_on)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Tuning presets (the "Car Database #3 [Tuning]" sheet)
-- ---------------------------------------------------------------------------

create table if not exists public.fleet_tuning_presets (
  id uuid primary key default gen_random_uuid(),
  -- Applies to every vehicle whose model contains this name (e.g. "Ford Explorer").
  model text not null check (char_length(btrim(model)) between 2 and 60),
  -- {"top_speed": "10", "drag": "50%", ...}; the keys are listed in src/lib/fleet.ts.
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  note text check (char_length(note) <= 300),
  sort_order integer not null default 100,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
create unique index if not exists fleet_tuning_presets_model_key on public.fleet_tuning_presets (lower(btrim(model)));
alter table public.fleet_tuning_presets enable row level security;
create trigger stamp_fleet_tuning_presets before insert or update on public.fleet_tuning_presets
  for each row execute function private.stamp_update();

create policy fleet_tuning_presets_select on public.fleet_tuning_presets for select to authenticated
  using ((select private.is_member()));
create policy fleet_tuning_presets_insert on public.fleet_tuning_presets for insert to authenticated
  with check ((select private.is_staff()));
create policy fleet_tuning_presets_update on public.fleet_tuning_presets for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy fleet_tuning_presets_delete on public.fleet_tuning_presets for delete to authenticated
  using ((select private.is_staff()));
revoke all on public.fleet_tuning_presets from anon;

-- ---------------------------------------------------------------------------
-- 8. Privileges
-- ---------------------------------------------------------------------------

revoke execute on function
  private.try_uuid(text), private.plate_key(text), private.is_unit_member(public.profiles, text),
  private.leads_unit(public.profiles, text), private.fleet_can_hold(uuid, uuid), private.can_assign_fleet_vehicle(uuid),
  private.holds_fleet_vehicle(uuid), private.can_submit_fleet_registration(uuid), private.prepare_fleet_assignment(),
  private.on_fleet_assignment_change(), private.convert_vehicle_warnings(uuid, uuid), private.on_vehicle_warnings_issued(),
  private.on_vehicle_warnings_changed()
from public, anon, authenticated;
-- Appear in RLS policies (evaluated as the querying role).
grant execute on function
  private.try_uuid(text), private.fleet_can_hold(uuid, uuid), private.can_assign_fleet_vehicle(uuid),
  private.holds_fleet_vehicle(uuid), private.can_submit_fleet_registration(uuid)
to authenticated;
grant execute on all functions in schema private to service_role;

revoke execute on function
  public.fleet_registration_apply(uuid, date, text, text),
  public.fleet_registration_submit(uuid, text, text, text, text, date, date, text),
  public.fleet_registration_cancel(uuid), public.fleet_registration_decide(uuid, boolean, date, text, boolean),
  public.fleet_registration_cleanup(), public.fleet_renew_registration(uuid, date), public.fleet_send_reminders(),
  public.get_hr_registry(date, uuid), public.get_dashboard_summary()
from public, anon, authenticated;
grant execute on function
  public.fleet_registration_apply(uuid, date, text, text),
  public.fleet_registration_submit(uuid, text, text, text, text, date, date, text),
  public.fleet_registration_cancel(uuid), public.fleet_registration_decide(uuid, boolean, date, text, boolean),
  public.fleet_renew_registration(uuid, date), public.get_hr_registry(date, uuid), public.get_dashboard_summary()
to authenticated;
grant execute on function public.fleet_registration_cleanup(), public.fleet_send_reminders() to service_role;
