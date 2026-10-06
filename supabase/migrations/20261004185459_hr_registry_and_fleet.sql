-- HR registry and fleet: the remaining features of the old Google Sheet
-- ("Person Database" and "Car Database" sheets).
--
--   * member_details: station, parking spot, joining date and type, recruiter and
--     activity status of every member (visible to members, edited by staff);
--   * member_bank_accounts: in-game bank account numbers (the member and staff only);
--   * duty_time_entries: monthly duty time, recorded by staff from the game's counter;
--   * former_members: who left, when, why, and whether they may come back;
--   * fleet_vehicles: assigned vehicles with registration expiry (approved vehicle
--     requests are registered automatically);
--   * vehicle_warnings: warnings for vehicles and their owners; three active ones turn
--     into one personal warning (hr_records) automatically.
--
-- Everything is additive, so the deployed frontend keeps working.

-- ---------------------------------------------------------------------------
-- 0. Shared helpers
-- ---------------------------------------------------------------------------

-- Who changed a row and when (the actor also covers the API, see private.actor_id()).
create or replace function private.stamp_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(private.actor_id(), new.updated_by);
  return new;
end;
$$;

-- Staff above the member may edit the member's HR data; executives and the bureau
-- manager also their own.
create or replace function private.can_manage_member(_target uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select private.is_staff()
    and (private.outranks(_target) or (_target = (select auth.uid()) and private.is_executive_or_manager()))
$$;

-- ---------------------------------------------------------------------------
-- 1. Member details (visible to every member)
-- ---------------------------------------------------------------------------

create table if not exists public.member_details (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  station text check (char_length(station) <= 40),
  parking_spot text check (char_length(parking_spot) <= 20),
  joined_on date,
  join_type text not null default 'new' check (join_type in ('new', 'returned', 'referral')),
  recruited_by text check (char_length(recruited_by) <= 80),
  activity_status text not null default 'active' check (activity_status in ('active', 'less_active', 'inactive')),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
alter table public.member_details enable row level security;
create trigger stamp_member_details before insert or update on public.member_details
  for each row execute function private.stamp_update();

create policy member_details_select on public.member_details for select to authenticated
  using ((select private.is_member()));
create policy member_details_insert on public.member_details for insert to authenticated
  with check (private.can_manage_member(user_id));
create policy member_details_update on public.member_details for update to authenticated
  using (private.can_manage_member(user_id)) with check (private.can_manage_member(user_id));
create policy member_details_delete on public.member_details for delete to authenticated
  using ((select private.is_admin()));
revoke all on public.member_details from anon;

-- ---------------------------------------------------------------------------
-- 2. Bank accounts (salary transfers): the member and staff only
-- ---------------------------------------------------------------------------

create table if not exists public.member_bank_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  account_number text not null check (char_length(btrim(account_number)) between 3 and 40),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
alter table public.member_bank_accounts enable row level security;
create trigger stamp_member_bank_accounts before insert or update on public.member_bank_accounts
  for each row execute function private.stamp_update();

create policy member_bank_accounts_select on public.member_bank_accounts for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));
create policy member_bank_accounts_insert on public.member_bank_accounts for insert to authenticated
  with check ((user_id = (select auth.uid()) and (select private.is_member())) or private.can_manage_member(user_id));
create policy member_bank_accounts_update on public.member_bank_accounts for update to authenticated
  using ((user_id = (select auth.uid()) and (select private.is_member())) or private.can_manage_member(user_id))
  with check ((user_id = (select auth.uid()) and (select private.is_member())) or private.can_manage_member(user_id));
create policy member_bank_accounts_delete on public.member_bank_accounts for delete to authenticated
  using (user_id = (select auth.uid()) or private.can_manage_member(user_id));
revoke all on public.member_bank_accounts from anon;

-- ---------------------------------------------------------------------------
-- 3. Monthly duty time (staff copy it from the game's counter at the meetings)
-- ---------------------------------------------------------------------------

create table if not exists public.duty_time_entries (
  user_id uuid not null references public.profiles(id) on delete cascade,
  month date not null check (month = date_trunc('month', month)::date),
  minutes integer not null check (minutes between 0 and 44640),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  primary key (user_id, month)
);
create index if not exists duty_time_entries_month_idx on public.duty_time_entries (month);
alter table public.duty_time_entries enable row level security;
create trigger stamp_duty_time_entries before insert or update on public.duty_time_entries
  for each row execute function private.stamp_update();

create policy duty_time_select on public.duty_time_entries for select to authenticated
  using ((select private.is_member()));
create policy duty_time_insert on public.duty_time_entries for insert to authenticated
  with check ((select private.is_staff()));
create policy duty_time_update on public.duty_time_entries for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy duty_time_delete on public.duty_time_entries for delete to authenticated
  using ((select private.is_staff()));
revoke all on public.duty_time_entries from anon;

-- ---------------------------------------------------------------------------
-- 4. Former members
-- ---------------------------------------------------------------------------

create table if not exists public.former_members (
  id uuid primary key default gen_random_uuid(),
  -- Id of the removed profile (no foreign key: the profile no longer exists).
  profile_id uuid,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 64),
  badge_number text check (char_length(badge_number) <= 10),
  faction_rank text check (char_length(faction_rank) <= 60),
  division text check (char_length(division) <= 20),
  joined_on date,
  left_on date not null default current_date,
  leave_type text not null default 'resigned'
    check (leave_type in ('resigned', 'dismissed', 'inactivity', 'transferred', 'other')),
  reason text check (char_length(reason) <= 1000),
  rehire text not null default 'eligible' check (rehire in ('eligible', 'conditional', 'not_eligible')),
  rehire_note text check (char_length(rehire_note) <= 500),
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint former_members_dates_check check (joined_on is null or joined_on <= left_on)
);
create index if not exists former_members_left_idx on public.former_members (left_on desc);
create index if not exists former_members_badge_idx on public.former_members (badge_number);
alter table public.former_members enable row level security;
create trigger stamp_former_members before insert or update on public.former_members
  for each row execute function private.stamp_update();

create policy former_members_select on public.former_members for select to authenticated
  using ((select private.is_staff()));
create policy former_members_insert on public.former_members for insert to authenticated
  with check ((select private.is_staff()) and recorded_by = (select auth.uid()));
create policy former_members_update on public.former_members for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy former_members_delete on public.former_members for delete to authenticated
  using ((select private.is_admin()));
revoke all on public.former_members from anon;

-- Recent departures are announced to the staff (older entries typed in from the old
-- sheet stay silent).
create or replace function private.on_former_member_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.left_on < current_date - 7 then
    return new;
  end if;
  -- The API records dismissals with the service key: attribute them to the caller.
  if private.actor_id() is null and new.recorded_by is not null then
    perform set_config('app.actor_id', new.recorded_by::text, true);
  end if;
  perform private.notify(private.staff_ids(), 'Távozás az állományból',
    format('%s (%s) – %s', new.full_name, coalesce(new.faction_rank, 'ismeretlen rang'),
      case new.leave_type
        when 'resigned' then 'kilépett' when 'dismissed' then 'elbocsátva'
        when 'inactivity' then 'inaktivitás miatt' when 'transferred' then 'áthelyezés'
        else 'egyéb ok' end),
    'info', 'hr', '/hr?tab=former');
  return new;
end;
$$;
create trigger on_former_member_insert after insert on public.former_members
  for each row execute function private.on_former_member_insert();

-- ---------------------------------------------------------------------------
-- 5. Fleet
-- ---------------------------------------------------------------------------

create table if not exists public.fleet_vehicles (
  id uuid primary key default gen_random_uuid(),
  plate text not null check (char_length(plate) between 2 and 16),
  model text not null check (char_length(model) between 1 and 60),
  owner_id uuid references public.profiles(id) on delete set null,
  registration_expires_on date,
  -- 0: nothing sent, 1: "expires soon" sent, 2: "expired" sent (reset on renewal).
  reminder_stage smallint not null default 0 check (reminder_stage between 0 and 2),
  notes text check (char_length(notes) <= 500),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
create unique index if not exists fleet_vehicles_plate_key on public.fleet_vehicles (upper(btrim(plate)));
create index if not exists fleet_vehicles_owner_idx on public.fleet_vehicles (owner_id);
alter table public.fleet_vehicles enable row level security;

create or replace function private.prepare_fleet_vehicle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.plate := upper(btrim(new.plate));
  new.model := btrim(new.model);
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, private.actor_id());
    new.created_at := now();
  elsif new.registration_expires_on is distinct from old.registration_expires_on then
    new.reminder_stage := 0;
  end if;
  return new;
end;
$$;
create trigger prepare_fleet_vehicle before insert or update on public.fleet_vehicles
  for each row execute function private.prepare_fleet_vehicle();
create trigger stamp_fleet_vehicles before insert or update on public.fleet_vehicles
  for each row execute function private.stamp_update();

create policy fleet_vehicles_select on public.fleet_vehicles for select to authenticated
  using ((select private.is_member()));
create policy fleet_vehicles_insert on public.fleet_vehicles for insert to authenticated
  with check ((select private.is_staff()));
create policy fleet_vehicles_update on public.fleet_vehicles for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy fleet_vehicles_delete on public.fleet_vehicles for delete to authenticated
  using ((select private.is_staff()));
revoke all on public.fleet_vehicles from anon;

create or replace function private.on_fleet_vehicle_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Vehicles registered from an approved request: the requester was notified already.
  if current_setting('app.fleet_auto', true) = '1' then
    return new;
  end if;
  if new.owner_id is not null and (tg_op = 'INSERT' or new.owner_id is distinct from old.owner_id) then
    perform private.notify(array[new.owner_id], 'Jármű hozzád rendelve',
      format('%s – %s', new.plate, new.model), 'info', 'logistics', '/logistics?tab=fleet');
  end if;
  return new;
end;
$$;
create trigger on_fleet_vehicle_change after insert or update of owner_id on public.fleet_vehicles
  for each row execute function private.on_fleet_vehicle_change();

-- Approved vehicle requests become fleet vehicles of the requester. Never blocks the
-- approval itself (an unusual plate is simply not registered).
create or replace function private.on_vehicle_request_approved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved'
     and char_length(btrim(coalesce(new.vehicle_plate, ''))) between 2 and 16 then
    begin
      perform set_config('app.fleet_auto', '1', true);
      insert into public.fleet_vehicles (plate, model, owner_id, notes)
      values (new.vehicle_plate, left(coalesce(nullif(btrim(new.vehicle_type), ''), 'Jármű'), 60), new.user_id,
              'Járműigénylésből')
      on conflict ((upper(btrim(plate)))) do update
        set owner_id = excluded.owner_id, model = excluded.model, is_active = true;
      perform set_config('app.fleet_auto', '', true);
    exception when others then
      perform set_config('app.fleet_auto', '', true);
    end;
  end if;
  return new;
end;
$$;
create trigger on_vehicle_request_approved after update of status on public.vehicle_requests
  for each row execute function private.on_vehicle_request_approved();

-- Vehicles already handed out through approved requests start the fleet (without
-- notifying the owners; the registration date is filled in by them or the staff).
select set_config('app.fleet_auto', '1', true);
insert into public.fleet_vehicles (plate, model, owner_id, notes)
select distinct on (upper(btrim(r.vehicle_plate)))
       r.vehicle_plate, left(coalesce(nullif(btrim(r.vehicle_type), ''), 'Jármű'), 60), r.user_id, 'Járműigénylésből'
from public.vehicle_requests r
where r.status = 'approved' and char_length(btrim(coalesce(r.vehicle_plate, ''))) between 2 and 16
order by upper(btrim(r.vehicle_plate)), r.updated_at desc nulls last
on conflict do nothing;
select set_config('app.fleet_auto', '', true);

-- The owner (or staff) records the renewed registration.
create or replace function public.fleet_renew_registration(_vehicle_id uuid, _expires_on date)
returns public.fleet_vehicles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _vehicle fleet_vehicles%rowtype;
begin
  select * into _vehicle from fleet_vehicles where id = _vehicle_id;
  if _vehicle.id is null then
    raise exception 'A jármű nem található.' using errcode = 'P0002';
  end if;
  if not (private.is_staff() or (_vehicle.owner_id = auth.uid() and private.is_member())) then
    raise exception 'Csak a jármű tulajdonosa vagy a vezetőség frissítheti a forgalmit.' using errcode = '42501';
  end if;
  if _expires_on is null or _expires_on < current_date or _expires_on > current_date + 400 then
    raise exception 'Érvénytelen lejárati dátum.' using errcode = '22023';
  end if;
  update fleet_vehicles set registration_expires_on = _expires_on where id = _vehicle_id
  returning * into _vehicle;
  return _vehicle;
end;
$$;

-- Daily cron: one "expires soon" and one "expired" reminder per registration.
create or replace function public.fleet_send_reminders()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _vehicle fleet_vehicles%rowtype;
  _sent integer := 0;
begin
  for _vehicle in
    select * from fleet_vehicles
    where is_active and owner_id is not null and registration_expires_on is not null
      and ((registration_expires_on <= current_date and reminder_stage < 2)
        or (registration_expires_on <= current_date + 3 and reminder_stage < 1))
  loop
    if _vehicle.registration_expires_on <= current_date then
      perform private.notify(array[_vehicle.owner_id], 'Lejárt a forgalmi engedély',
        format('%s – %s: lejárt (%s). Újítsd meg, majd rögzítsd az új dátumot.', _vehicle.plate, _vehicle.model,
               to_char(_vehicle.registration_expires_on, 'YYYY.MM.DD.')),
        'alert', 'logistics', '/logistics?tab=fleet', 'fleet-reg:' || _vehicle.id);
      update fleet_vehicles set reminder_stage = 2 where id = _vehicle.id;
    else
      perform private.notify(array[_vehicle.owner_id], 'Hamarosan lejár a forgalmi',
        format('%s – %s: %s-én lejár.', _vehicle.plate, _vehicle.model,
               to_char(_vehicle.registration_expires_on, 'YYYY.MM.DD.')),
        'warning', 'logistics', '/logistics?tab=fleet', 'fleet-reg:' || _vehicle.id);
      update fleet_vehicles set reminder_stage = 1 where id = _vehicle.id;
    end if;
    _sent := _sent + 1;
  end loop;
  return _sent;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Vehicle warnings (three active ones = one personal warning)
-- ---------------------------------------------------------------------------

create table if not exists public.vehicle_warnings (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references public.fleet_vehicles(id) on delete set null,
  -- Snapshot, the vehicle may be removed later.
  plate text not null check (char_length(plate) between 2 and 16),
  -- Owner at the time of the warning.
  user_id uuid references public.profiles(id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 3 and 300),
  issued_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  converted_record_id uuid references public.hr_records(id) on delete set null
);
create index if not exists vehicle_warnings_user_idx on public.vehicle_warnings (user_id, created_at desc);
create index if not exists vehicle_warnings_vehicle_idx on public.vehicle_warnings (vehicle_id);
alter table public.vehicle_warnings enable row level security;

create or replace function private.prepare_vehicle_warning()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _vehicle public.fleet_vehicles%rowtype;
begin
  if tg_op = 'INSERT' then
    if new.vehicle_id is not null then
      select * into _vehicle from public.fleet_vehicles where id = new.vehicle_id;
      if _vehicle.id is not null then
        new.plate := _vehicle.plate;
        new.user_id := coalesce(new.user_id, _vehicle.owner_id);
      end if;
    end if;
    new.plate := upper(btrim(new.plate));
    new.reason := btrim(new.reason);
    new.issued_by := coalesce(private.actor_id(), new.issued_by);
    new.created_at := now();
    new.revoked_at := null;
    new.revoked_by := null;
    new.converted_record_id := null;
    return new;
  end if;

  -- The conversion into a personal warning (on_vehicle_warning_change) may link the row.
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
create trigger prepare_vehicle_warning before insert or update on public.vehicle_warnings
  for each row execute function private.prepare_vehicle_warning();

create or replace function private.on_vehicle_warning_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _active uuid[];
  _record_id uuid;
  _details text;
begin
  if new.user_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.revoked_at is not null and old.revoked_at is null then
      perform private.notify(array[new.user_id], 'Jármű-hibapont visszavonva',
        format('%s: %s', new.plate, new.reason), 'info', 'logistics', '/profile');
    end if;
    return new;
  end if;

  select coalesce(array_agg(id order by created_at, id), '{}') into _active
  from public.vehicle_warnings
  where user_id = new.user_id and revoked_at is null and converted_record_id is null;

  perform private.notify(array[new.user_id], 'Jármű-hibapont',
    format('%s: %s (%s/3)', new.plate, new.reason, least(cardinality(_active), 3)),
    'warning', 'logistics', '/profile');

  if cardinality(_active) >= 3 then
    select string_agg(format('%s – %s (%s)', plate, reason, to_char(created_at, 'YYYY.MM.DD.')), E'\n'
                      order by created_at, id)
      into _details
    from public.vehicle_warnings where id = any(_active[1:3]);

    insert into public.hr_records (user_id, kind, title, details, status, created_by)
    values (new.user_id, 'warning', 'Figyelmeztetés: 3 jármű-hibapont', left(_details, 2000), 'active', new.issued_by)
    returning id into _record_id;

    perform set_config('app.vehicle_warning_convert', '1', true);
    update public.vehicle_warnings set converted_record_id = _record_id where id = any(_active[1:3]);
    perform set_config('app.vehicle_warning_convert', '', true);
  end if;
  return new;
end;
$$;
create trigger on_vehicle_warning_change after insert or update of revoked_at on public.vehicle_warnings
  for each row execute function private.on_vehicle_warning_change();

create policy vehicle_warnings_select on public.vehicle_warnings for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));
create policy vehicle_warnings_insert on public.vehicle_warnings for insert to authenticated
  with check ((select private.is_staff()) and (user_id is null or private.outranks(user_id)));
create policy vehicle_warnings_update on public.vehicle_warnings for update to authenticated
  using ((select private.is_staff()) and (user_id is null or private.outranks(user_id)))
  with check ((select private.is_staff()) and (user_id is null or private.outranks(user_id)));
create policy vehicle_warnings_delete on public.vehicle_warnings for delete to authenticated
  using ((select private.is_admin()));
revoke all on public.vehicle_warnings from anon;
revoke update on public.vehicle_warnings from authenticated;
grant update (revoked_at) on public.vehicle_warnings to authenticated;

-- ---------------------------------------------------------------------------
-- 7. One request for the HR page and the profile
-- ---------------------------------------------------------------------------

-- Details, duty time since a month, the fleet, vehicle warnings and bank accounts, for
-- every member or for one (_user_id). SECURITY INVOKER: the caller's RLS decides what is
-- included (others' bank accounts and vehicle warnings only for staff).
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
    'vehicles', coalesce((select json_agg(json_build_object('id', v.id, 'plate', v.plate, 'model', v.model, 'owner_id', v.owner_id,
                                                            'registration_expires_on', v.registration_expires_on, 'notes', v.notes,
                                                            'is_active', v.is_active, 'created_at', v.created_at,
                                                            'updated_at', v.updated_at) order by v.plate)
                          from fleet_vehicles v
                          where v.is_active and (_user_id is null or v.owner_id = _user_id)), '[]'::json),
    -- For the roster only the active ones count; a profile shows the history too.
    'vehicle_warnings', coalesce((select json_agg(w order by w.created_at desc) from vehicle_warnings w
                                  where (_user_id is null and w.revoked_at is null and w.converted_record_id is null)
                                     or w.user_id = _user_id), '[]'::json),
    'bank_accounts', coalesce((select json_agg(json_build_object('user_id', b.user_id, 'account_number', b.account_number))
                               from member_bank_accounts b
                               where _user_id is null or b.user_id = _user_id), '[]'::json)
  )
$$;

-- ---------------------------------------------------------------------------
-- 7. Dashboard summary: fleet reminders
-- ---------------------------------------------------------------------------

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
    'my_vehicles_due', (select count(*) from fleet_vehicles
                        where owner_id = _me.id and is_active
                          and (registration_expires_on is null or registration_expires_on <= current_date + 3)),
    'fleet_registration_due', case when _staff then
      (select count(*) from fleet_vehicles
       where is_active and registration_expires_on is not null and registration_expires_on <= current_date + 3) end,
    'members_total', (select count(*) from profiles where system_role <> 'pending'),
    'members_on_leave', (select count(*) from hr_records where kind = 'leave' and status = 'active'
                           and current_date between starts_on and ends_on)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Privileges
-- ---------------------------------------------------------------------------

revoke execute on function
  private.stamp_update(), private.can_manage_member(uuid), private.on_former_member_insert(),
  private.prepare_fleet_vehicle(), private.on_fleet_vehicle_change(), private.on_vehicle_request_approved(),
  private.prepare_vehicle_warning(), private.on_vehicle_warning_change()
from public, anon, authenticated;
-- Appears in RLS policies (evaluated as the querying role).
grant execute on function private.can_manage_member(uuid) to authenticated;
grant execute on all functions in schema private to service_role;

revoke execute on function public.fleet_renew_registration(uuid, date), public.fleet_send_reminders(),
  public.get_hr_registry(date, uuid)
from public, anon, authenticated;
grant execute on function public.fleet_renew_registration(uuid, date), public.get_hr_registry(date, uuid) to authenticated;
grant execute on function public.fleet_send_reminders() to service_role;
