-- Operation plans for events: the objective and the plan, the rally point, the radio channel, an
-- optional MCB case, the roles (teams) with their members, fleet vehicles and call signs, and after
-- the event an after-action report. The event's organisers write it, its audience reads it.

create table if not exists public.event_operations (
  event_id uuid primary key references public.events(id) on delete cascade,
  objective text check (char_length(objective) <= 2000),
  situation text check (char_length(situation) <= 4000),
  execution text check (char_length(execution) <= 6000),
  radio_channel text check (char_length(radio_channel) <= 40),
  rally_point text check (char_length(rally_point) <= 160),
  rally_at timestamptz,
  case_id uuid references public.cases(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  -- After-action report (from the start of the event).
  report_outcome text check (report_outcome in ('success', 'partial', 'failed', 'cancelled')),
  report_summary text check (char_length(report_summary) <= 4000),
  report_went_well text check (char_length(report_went_well) <= 3000),
  report_improve text check (char_length(report_improve) <= 3000),
  report_by uuid references public.profiles(id) on delete set null,
  report_at timestamptz
);

create table if not exists public.event_operation_roles (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.event_operations(event_id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  task text check (char_length(task) <= 600),
  callsign text check (char_length(callsign) <= 30),
  sort_order integer not null default 0
);
create index if not exists event_operation_roles_event_idx on public.event_operation_roles (event_id, sort_order);

create table if not exists public.event_operation_assignments (
  event_id uuid not null references public.event_operations(event_id) on delete cascade,
  role_id uuid not null references public.event_operation_roles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid references public.fleet_vehicles(id) on delete set null,
  callsign text check (char_length(callsign) <= 30),
  note text check (char_length(note) <= 200),
  primary key (event_id, user_id)
);
create index if not exists event_operation_assignments_role_idx on public.event_operation_assignments (role_id);
create index if not exists event_operation_assignments_user_idx on public.event_operation_assignments (user_id);

-- Read and written through the functions below only.
alter table public.event_operations enable row level security;
alter table public.event_operation_roles enable row level security;
alter table public.event_operation_assignments enable row level security;
revoke all on public.event_operations, public.event_operation_roles, public.event_operation_assignments from anon, authenticated;

-- ---------------------------------------------------------------------------------------------

create or replace function private.operation_json(_event_id uuid)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'event_id', o.event_id, 'objective', o.objective, 'situation', o.situation, 'execution', o.execution,
    'radio_channel', o.radio_channel, 'rally_point', o.rally_point, 'rally_at', o.rally_at,
    'updated_at', o.updated_at, 'updated_by_name', (select full_name from public.profiles where id = o.updated_by),
    -- The case only for those who may see the case area; whether they may open it.
    'case', case when o.case_id is not null and private.can_view_cases() then
      (select json_build_object('id', c.id, 'case_number', c.case_number, 'title', c.title,
                                'can_open', private.can_view_case_details(c.id))
       from private.live_cases c where c.id = o.case_id) end,
    'roles', coalesce((select json_agg(json_build_object(
        'id', r.id, 'name', r.name, 'task', r.task, 'callsign', r.callsign, 'sort_order', r.sort_order,
        'members', coalesce((select json_agg(json_build_object(
            'user_id', a.user_id, 'full_name', p.full_name, 'faction_rank', p.faction_rank, 'badge_number', p.badge_number,
            'avatar_url', p.avatar_url, 'callsign', a.callsign, 'note', a.note,
            'vehicle', case when v.id is not null then json_build_object('id', v.id, 'plate', v.plate, 'model', v.model, 'callsign', v.callsign) end)
            order by p.full_name)
          from public.event_operation_assignments a
          join public.profiles p on p.id = a.user_id
          left join public.fleet_vehicles v on v.id = a.vehicle_id
          where a.role_id = r.id), '[]'::json))
        order by r.sort_order, r.name)
      from public.event_operation_roles r where r.event_id = o.event_id), '[]'::json),
    'report', case when o.report_at is not null then json_build_object(
        'outcome', o.report_outcome, 'summary', o.report_summary, 'went_well', o.report_went_well, 'improve', o.report_improve,
        'at', o.report_at, 'by_name', (select full_name from public.profiles where id = o.report_by)) end)
  from public.event_operations o where o.event_id = _event_id
$$;
revoke execute on function private.operation_json(uuid) from public, anon, authenticated;

-- The plan of an event (null when it has none): its audience reads it.
create or replace function public.get_event_operation(_event_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _e public.events%rowtype;
begin
  select * into _e from public.events where id = _event_id;
  if _e.id is null or not private.can_see_event(_e.audience) then
    raise exception 'Az esemény nem található.' using errcode = 'P0002';
  end if;
  return private.operation_json(_event_id);
end;
$$;
revoke execute on function public.get_event_operation(uuid) from public, anon, authenticated;
grant execute on function public.get_event_operation(uuid) to authenticated;

-- Saves the whole plan: its fields, the roles (kept by id, new ones added, missing ones removed)
-- and every assignment. Members who get a role, or a different one, are told once.
create or replace function public.save_event_operation(_event_id uuid, _plan jsonb)
returns json
language plpgsql
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _uid uuid := (select auth.uid());
  _e public.events%rowtype;
  _before jsonb;
  _role jsonb;
  _member jsonb;
  _role_id uuid;
  _keep uuid[] := '{}';
  _order integer := 0;
  _users uuid[] := '{}';
  _case uuid := nullif(_plan ->> 'case_id', '')::uuid;
  _vehicle uuid;
  _r record;
begin
  select * into _e from public.events where id = _event_id;
  if _e.id is null then raise exception 'Az esemény nem található.' using errcode = 'P0002'; end if;
  if not private.can_manage_event(_e.audience) then
    raise exception 'A műveleti tervet az esemény szervezői írják.' using errcode = '42501';
  end if;
  if _e.cancelled_at is not null then raise exception 'Elmaradt eseményhez nem készül terv.' using errcode = '22023'; end if;
  if jsonb_typeof(coalesce(_plan -> 'roles', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(_plan -> 'roles', '[]'::jsonb)) > 20 then
    raise exception 'Legfeljebb 20 szerep lehet.' using errcode = '22023';
  end if;
  if _case is not null and not (private.can_view_cases() and private.case_alive(_case)) then
    raise exception 'Az akta nem található.' using errcode = 'P0002';
  end if;

  -- Who had which role before (to tell only those whose role is new).
  select coalesce(jsonb_object_agg(a.user_id, r.name), '{}'::jsonb) into _before
  from public.event_operation_assignments a join public.event_operation_roles r on r.id = a.role_id
  where a.event_id = _event_id;

  insert into public.event_operations as o (event_id, objective, situation, execution, radio_channel, rally_point, rally_at, case_id, updated_by, updated_at)
  values (_event_id,
          nullif(btrim(_plan ->> 'objective'), ''), nullif(btrim(_plan ->> 'situation'), ''), nullif(btrim(_plan ->> 'execution'), ''),
          nullif(btrim(_plan ->> 'radio_channel'), ''), nullif(btrim(_plan ->> 'rally_point'), ''),
          nullif(_plan ->> 'rally_at', '')::timestamptz, _case, _uid, now())
  on conflict (event_id) do update set
    objective = excluded.objective, situation = excluded.situation, execution = excluded.execution,
    radio_channel = excluded.radio_channel, rally_point = excluded.rally_point, rally_at = excluded.rally_at,
    case_id = excluded.case_id, updated_by = _uid, updated_at = now();

  delete from public.event_operation_assignments where event_id = _event_id;

  for _role in select value from jsonb_array_elements(coalesce(_plan -> 'roles', '[]'::jsonb)) loop
    if char_length(btrim(coalesce(_role ->> 'name', ''))) = 0 then
      raise exception 'Minden szerepnek legyen neve.' using errcode = '22023';
    end if;
    _order := _order + 1;
    _role_id := nullif(_role ->> 'id', '')::uuid;
    if _role_id is not null and exists (select 1 from public.event_operation_roles where id = _role_id and event_id = _event_id) then
      update public.event_operation_roles
      set name = btrim(_role ->> 'name'), task = nullif(btrim(_role ->> 'task'), ''), callsign = nullif(btrim(_role ->> 'callsign'), ''),
          sort_order = _order
      where id = _role_id;
    else
      insert into public.event_operation_roles (event_id, name, task, callsign, sort_order)
      values (_event_id, btrim(_role ->> 'name'), nullif(btrim(_role ->> 'task'), ''), nullif(btrim(_role ->> 'callsign'), ''), _order)
      returning id into _role_id;
    end if;
    _keep := _keep || _role_id;

    if jsonb_array_length(coalesce(_role -> 'members', '[]'::jsonb)) > 40 then
      raise exception 'Egy szerepben legfeljebb 40 tag lehet.' using errcode = '22023';
    end if;
    for _member in select value from jsonb_array_elements(coalesce(_role -> 'members', '[]'::jsonb)) loop
      if not exists (select 1 from public.profiles p where p.id = (_member ->> 'user_id')::uuid and p.system_role <> 'pending') then
        raise exception 'Ismeretlen tag a tervben.' using errcode = '22023';
      end if;
      if (_member ->> 'user_id')::uuid = any(_users) then
        raise exception '% két szerepben szerepel: egy tag csak egy szerepet kaphat.',
          (select full_name from public.profiles where id = (_member ->> 'user_id')::uuid) using errcode = '22023';
      end if;
      _users := _users || (_member ->> 'user_id')::uuid;
      _vehicle := nullif(_member ->> 'vehicle_id', '')::uuid;
      if _vehicle is not null and not exists (select 1 from public.fleet_vehicles v where v.id = _vehicle) then
        _vehicle := null;
      end if;
      insert into public.event_operation_assignments (event_id, role_id, user_id, vehicle_id, callsign, note)
      values (_event_id, _role_id, (_member ->> 'user_id')::uuid, _vehicle,
              nullif(btrim(_member ->> 'callsign'), ''), nullif(btrim(_member ->> 'note'), ''));
    end loop;
  end loop;

  delete from public.event_operation_roles where event_id = _event_id and not (id = any(_keep));

  -- A new or changed role: one notification per member and event (an unread one is replaced).
  for _r in
    select a.user_id, r.name from public.event_operation_assignments a join public.event_operation_roles r on r.id = a.role_id
    where a.event_id = _event_id and (_before ->> a.user_id::text) is distinct from r.name
  loop
    perform private.notify(array[_r.user_id], 'Szerepet kaptál: ' || _e.title,
      format('%s · %s', _r.name, to_char(_e.starts_at, 'YYYY.MM.DD. HH24:MI')),
      'info', 'event', '/events?id=' || _event_id || '&plan=1', 'operation:' || _event_id);
  end loop;

  return private.operation_json(_event_id);
end;
$$;
revoke execute on function public.save_event_operation(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_event_operation(uuid, jsonb) to authenticated;

create or replace function public.delete_event_operation(_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _e public.events%rowtype;
begin
  select * into _e from public.events where id = _event_id;
  if _e.id is null then raise exception 'Az esemény nem található.' using errcode = 'P0002'; end if;
  if not private.can_manage_event(_e.audience) then
    raise exception 'A műveleti tervet az esemény szervezői törölhetik.' using errcode = '42501';
  end if;
  delete from public.event_operations where event_id = _event_id;
end;
$$;
revoke execute on function public.delete_event_operation(uuid) from public, anon, authenticated;
grant execute on function public.delete_event_operation(uuid) to authenticated;

-- The after-action report: from the start of the event; those with a role are told when it is first written.
create or replace function public.save_operation_report(_event_id uuid, _report jsonb)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := (select auth.uid());
  _e public.events%rowtype;
  _first boolean;
begin
  select * into _e from public.events where id = _event_id;
  if _e.id is null then raise exception 'Az esemény nem található.' using errcode = 'P0002'; end if;
  if not private.can_manage_event(_e.audience) then
    raise exception 'Az értékelést az esemény szervezői írják.' using errcode = '42501';
  end if;
  if _e.starts_at > now() then raise exception 'Az értékelés az esemény kezdete után írható.' using errcode = '22023'; end if;
  if coalesce(_report ->> 'outcome', '') not in ('success', 'partial', 'failed', 'cancelled') then
    raise exception 'Válaszd ki az akció kimenetelét.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.event_operations where event_id = _event_id) then
    insert into public.event_operations (event_id, updated_by) values (_event_id, _uid);
  end if;
  select report_at is null into _first from public.event_operations where event_id = _event_id;

  update public.event_operations set
    report_outcome = _report ->> 'outcome',
    report_summary = nullif(btrim(_report ->> 'summary'), ''),
    report_went_well = nullif(btrim(_report ->> 'went_well'), ''),
    report_improve = nullif(btrim(_report ->> 'improve'), ''),
    report_by = _uid, report_at = now()
  where event_id = _event_id;

  if _first then
    perform private.notify(array(select a.user_id from public.event_operation_assignments a where a.event_id = _event_id),
      'Elkészült az értékelés: ' || _e.title, 'Az akció értékelése olvasható az eseménynél.',
      'info', 'event', '/events?id=' || _event_id || '&plan=1', 'operation-report:' || _event_id);
  end if;
  return private.operation_json(_event_id);
end;
$$;
revoke execute on function public.save_operation_report(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_operation_report(uuid, jsonb) to authenticated;

-- The events list says which events have a plan, whether the reader has a role in it and whether
-- the report is written (every earlier key kept).
do $do$
declare
  _def text := replace(pg_get_functiondef('public.get_events(timestamptz, timestamptz)'::regprocedure), chr(13), '');
  _anchor text := $a$(select coalesce(json_agg(a.user_id), '[]'::json) from public.event_attendance a where a.event_id = e.id) end as attendee_ids$a$;
begin
  if position('as operation' in _def) = 0 then
    if position(_anchor in _def) = 0 then raise exception 'get_events: the anchor for operation was not found'; end if;
    _def := replace(_def, _anchor, _anchor || $b$,
             (select json_build_object(
                'roles', (select count(*) from public.event_operation_roles r where r.event_id = o.event_id),
                'assigned', (select count(*) from public.event_operation_assignments a where a.event_id = o.event_id),
                'my_role', (select r.name from public.event_operation_assignments a join public.event_operation_roles r on r.id = a.role_id
                            where a.event_id = o.event_id and a.user_id = _me),
                'report', o.report_at is not null)
              from public.event_operations o where o.event_id = e.id) as operation$b$);
    execute _def;
  end if;
end;
$do$;
