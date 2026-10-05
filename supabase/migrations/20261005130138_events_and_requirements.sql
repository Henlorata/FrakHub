-- =============================================================================
-- Events (meetings, trainings, exams ... with attendance), the monthly requirements
-- on the dashboard (reports and duty time of the member), and a notification
-- category for events.
--
-- Compatible with the deployed frontend: new tables and functions only; the
-- changed get_dashboard_summary() and save_payroll_settings() keep every
-- existing key and parameter.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Notification category "event" (members may mute it)
-- ---------------------------------------------------------------------------

alter table public.notifications drop constraint notifications_category_check;
alter table public.notifications add constraint notifications_category_check
  check (category in ('system', 'hr', 'mcb', 'logistics', 'finance', 'exam', 'academy', 'announcement', 'event'));

alter table public.notification_preferences drop constraint notification_preferences_categories_check;
alter table public.notification_preferences add constraint notification_preferences_categories_check
  check (muted_categories <@ array['hr', 'mcb', 'logistics', 'finance', 'exam', 'academy', 'announcement', 'event']::text[]);

-- ---------------------------------------------------------------------------
-- 2. Monthly requirement of reports (next to the minimum duty time)
-- ---------------------------------------------------------------------------

alter table public.payroll_settings
  add column min_reports integer not null default 8 check (min_reports between 0 and 100);

create or replace function public.save_payroll_settings(_settings jsonb)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _rank jsonb;
  _unit jsonb;
  _tiers jsonb;
  _top_duty jsonb;
  _top_report jsonb;
  _limit constant bigint := 10000000000;
begin
  if not private.is_commander_or_manager() then
    raise exception 'A fizetési táblát a Commander állítja be.' using errcode = '42501';
  end if;
  if _settings is null or jsonb_typeof(_settings) <> 'object' then raise exception 'Érvénytelen beállítások.'; end if;

  select coalesce(jsonb_object_agg(key, private.json_int(value, 0, _limit)), '{}'::jsonb) into _rank
  from jsonb_each(case when jsonb_typeof(_settings -> 'rank_pay') = 'object' then _settings -> 'rank_pay' else '{}'::jsonb end)
  where private.json_int(value, 0, _limit) is not null and char_length(key) <= 40;
  select coalesce(jsonb_object_agg(upper(trim(key)), private.json_int(value, 0, _limit)), '{}'::jsonb) into _unit
  from jsonb_each(case when jsonb_typeof(_settings -> 'unit_pay') = 'object' then _settings -> 'unit_pay' else '{}'::jsonb end)
  where private.json_int(value, 0, _limit) is not null and char_length(trim(key)) between 1 and 20;
  select coalesce(jsonb_agg(jsonb_build_object('hours', private.json_int(t -> 'hours', 0, 744), 'pay', private.json_int(t -> 'pay', 0, _limit))
                            order by private.json_int(t -> 'hours', 0, 744)), '[]'::jsonb) into _tiers
  from jsonb_array_elements(case when jsonb_typeof(_settings -> 'duty_tiers') = 'array' then _settings -> 'duty_tiers' else '[]'::jsonb end) t
  where private.json_int(t -> 'hours', 0, 744) is not null and private.json_int(t -> 'pay', 0, _limit) is not null;
  select jsonb_build_array(coalesce(private.json_int(_settings -> 'top_duty_pay' -> 0, 0, _limit), 0),
                           coalesce(private.json_int(_settings -> 'top_duty_pay' -> 1, 0, _limit), 0),
                           coalesce(private.json_int(_settings -> 'top_duty_pay' -> 2, 0, _limit), 0)) into _top_duty;
  select jsonb_build_array(coalesce(private.json_int(_settings -> 'top_report_pay' -> 0, 0, _limit), 0),
                           coalesce(private.json_int(_settings -> 'top_report_pay' -> 1, 0, _limit), 0),
                           coalesce(private.json_int(_settings -> 'top_report_pay' -> 2, 0, _limit), 0)) into _top_report;

  -- Only the given parts change.
  update public.payroll_settings set
    rank_pay = case when _settings ? 'rank_pay' then _rank else rank_pay end,
    unit_pay = case when _settings ? 'unit_pay' then _unit else unit_pay end,
    duty_tiers = case when _settings ? 'duty_tiers' then _tiers else duty_tiers end,
    top_duty_pay = case when _settings ? 'top_duty_pay' then _top_duty else top_duty_pay end,
    top_report_pay = case when _settings ? 'top_report_pay' then _top_report else top_report_pay end,
    min_duty_hours = coalesce(private.json_int(_settings -> 'min_duty_hours', 0, 744), min_duty_hours),
    min_reports = coalesce(private.json_int(_settings -> 'min_reports', 0, 100), min_reports),
    report_pay = coalesce(private.json_int(_settings -> 'report_pay', 0, _limit), report_pay),
    picture_pay = coalesce(private.json_int(_settings -> 'picture_pay', 0, _limit), picture_pay),
    training_pay = coalesce(private.json_int(_settings -> 'training_pay', 0, _limit), training_pay),
    tax_percent = case when jsonb_typeof(_settings -> 'tax_percent') = 'number'
                       then least(greatest((_settings ->> 'tax_percent')::numeric, 0), 100) else tax_percent end,
    executive_unit = case when _settings ? 'executive_unit'
                          then left(nullif(upper(trim(coalesce(_settings ->> 'executive_unit', ''))), ''), 20) else executive_unit end,
    updated_at = now(),
    updated_by = (select auth.uid())
  where id = 'global';
  return (select to_json(s) from public.payroll_settings s where s.id = 'global');
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Events
-- ---------------------------------------------------------------------------

-- audience: 'all', 'staff' (supervisory staff and above), 'command' (high command),
-- or a unit: a division (TSB, SEB, MCB) or a qualification unit (SAHP, TB, ...).
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 120),
  description text check (char_length(description) <= 2000),
  kind text not null default 'meeting' check (kind in ('meeting', 'training', 'exam', 'patrol', 'ceremony', 'other')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text check (char_length(location) <= 120),
  audience text not null default 'all' check (audience ~ '^[A-Za-z0-9_-]{2,20}$'),
  -- Members are asked whether they come.
  rsvp boolean not null default true,
  cancelled_at timestamptz,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint events_time_check check (ends_at is null or (ends_at > starts_at and ends_at <= starts_at + interval '7 days'))
);
create index events_starts_idx on public.events (starts_at);
create index events_created_by_idx on public.events (created_by);
alter table public.events enable row level security;
create trigger stamp_events before update on public.events
  for each row execute function private.stamp_update();

-- Who organises (creates, edits, cancels) an event of this audience: high command and the bureau
-- manager any; supervisory staff all but the command staff's own; a unit's leaders their unit's.
create or replace function private.can_manage_event(_audience text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.system_role <> 'pending'
      and (private.rank_index(p.faction_rank) <= 6
        or coalesce(p.is_bureau_manager, false)
        or (p.system_role in ('admin', 'supervisor') and _audience <> 'command')
        or (_audience not in ('all', 'staff', 'command') and private.leads_unit(p, _audience))))
$$;

-- Who sees an event: its audience and its organisers.
create or replace function private.can_see_event(_audience text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.system_role <> 'pending'
      and (_audience = 'all'
        or (_audience = 'staff' and (p.system_role in ('admin', 'supervisor') or coalesce(p.is_bureau_manager, false)))
        or (_audience not in ('staff', 'command') and private.is_unit_member(p, _audience))))
    or private.can_manage_event(_audience)
$$;

-- The members an event is for (notified when it is announced).
create or replace function private.event_audience_ids(_audience text)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(p.id), '{}')
  from public.profiles p
  where p.system_role <> 'pending'
    and case _audience
      when 'all' then true
      when 'staff' then p.system_role in ('admin', 'supervisor') or coalesce(p.is_bureau_manager, false)
      when 'command' then private.rank_index(p.faction_rank) <= 6 or coalesce(p.is_bureau_manager, false)
      else private.is_unit_member(p, _audience) or private.leads_unit(p, _audience)
    end
$$;

create policy events_select on public.events for select to authenticated
  using (private.can_see_event(audience));
create policy events_insert on public.events for insert to authenticated
  with check (created_by = (select auth.uid()) and private.can_manage_event(audience));
create policy events_update on public.events for update to authenticated
  using (private.can_manage_event(audience))
  with check (private.can_manage_event(audience));
create policy events_delete on public.events for delete to authenticated
  using (private.can_manage_event(audience));
-- The organiser is always the inserting member (column default); the stamps are set by triggers.
revoke all on public.events from anon, authenticated;
grant select, delete on public.events to authenticated;
grant insert (title, description, kind, starts_at, ends_at, location, audience, rsvp) on public.events to authenticated;
grant update (title, description, kind, starts_at, ends_at, location, audience, rsvp, cancelled_at) on public.events to authenticated;

-- Attendance answers: written through respond_to_event() only.
create table public.event_responses (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('going', 'maybe', 'absent')),
  note text check (char_length(note) <= 200),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index event_responses_user_idx on public.event_responses (user_id);
alter table public.event_responses enable row level security;
create policy event_responses_select on public.event_responses for select to authenticated
  using (user_id = (select auth.uid()) or exists (
    select 1 from public.events e where e.id = event_id and private.can_manage_event(e.audience)));
revoke all on public.event_responses from anon, authenticated;
grant select on public.event_responses to authenticated;

-- 2026.10.09. 20:00 (Hungarian time) for the notifications.
create or replace function private.event_when(_starts_at timestamptz)
returns text
language sql
stable
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
  select to_char(_starts_at, 'YYYY.MM.DD. HH24:MI')
$$;

-- A new event is announced to its audience.
create or replace function private.on_event_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.cancelled_at is null and new.starts_at > now() then
    perform private.notify(private.event_audience_ids(new.audience),
      'Új esemény: ' || new.title,
      private.event_when(new.starts_at) || coalesce(' · ' || nullif(btrim(new.location), ''), '')
        || case when new.rsvp then ' · Jelezd, ott leszel-e.' else '' end,
      'info', 'event', '/events?id=' || new.id, 'event:' || new.id);
  end if;
  return new;
end;
$$;
create trigger on_event_insert after insert on public.events
  for each row execute function private.on_event_insert();

-- A cancelled or moved event is reported to those who said they come (or might).
create or replace function private.on_event_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _recipients uuid[];
begin
  if new.starts_at <= now() and old.starts_at <= now() then return new; end if;
  select coalesce(array_agg(r.user_id), '{}') into _recipients
  from public.event_responses r where r.event_id = new.id and r.status in ('going', 'maybe');
  if old.cancelled_at is null and new.cancelled_at is not null then
    perform private.notify(_recipients, 'Elmarad: ' || new.title,
      'Az esemény (' || private.event_when(new.starts_at) || ') elmarad.', 'warning', 'event', '/events?id=' || new.id,
      'event:' || new.id);
  elsif new.cancelled_at is null and (new.starts_at is distinct from old.starts_at or new.location is distinct from old.location) then
    perform private.notify(_recipients, 'Változás: ' || new.title,
      'Új időpont: ' || private.event_when(new.starts_at) || coalesce(' · ' || nullif(btrim(new.location), ''), ''),
      'warning', 'event', '/events?id=' || new.id, 'event:' || new.id);
  end if;
  return new;
end;
$$;
create trigger on_event_update after update of starts_at, location, cancelled_at on public.events
  for each row execute function private.on_event_update();

-- Events of a period (one call per page): the reader's answer, the counts, who comes (names for
-- everyone who sees the event; notes for the organisers and the member themselves).
create or replace function public.get_events(_from timestamptz, _to timestamptz)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _me uuid := (select auth.uid());
begin
  if not private.is_member() then
    raise exception 'Nincs jogosultságod.' using errcode = '42501';
  end if;
  if _from is null or _to is null or _to <= _from or _to - _from > interval '400 days' then
    raise exception 'Érvénytelen időszak.' using errcode = '22023';
  end if;
  return (
    select coalesce(json_agg(row_to_json(x) order by x.starts_at, x.title), '[]'::json)
    from (
      select e.id, e.title, e.description, e.kind, e.starts_at, e.ends_at, e.location, e.audience, e.rsvp, e.cancelled_at,
             e.created_at, e.created_by, c.full_name as created_by_name,
             private.can_manage_event(e.audience) as can_manage,
             mine.status as my_status, mine.note as my_note,
             (select json_build_object(
                'going', count(*) filter (where r.status = 'going'),
                'maybe', count(*) filter (where r.status = 'maybe'),
                'absent', count(*) filter (where r.status = 'absent'))
              from public.event_responses r where r.event_id = e.id) as counts,
             (select coalesce(json_agg(json_build_object(
                'user_id', r.user_id, 'status', r.status, 'full_name', p.full_name, 'badge_number', p.badge_number,
                'faction_rank', p.faction_rank, 'avatar_url', p.avatar_url,
                'note', case when r.user_id = _me or private.can_manage_event(e.audience) then r.note end)
                order by r.status, p.full_name), '[]'::json)
              from public.event_responses r join public.profiles p on p.id = r.user_id
              where r.event_id = e.id) as responses
      from public.events e
      left join public.profiles c on c.id = e.created_by
      left join public.event_responses mine on mine.event_id = e.id and mine.user_id = _me
      where e.starts_at < _to and coalesce(e.ends_at, e.starts_at) >= _from
        and private.can_see_event(e.audience)
    ) x);
end;
$$;

-- The member's answer (null removes it). Open until the event ends.
create or replace function public.respond_to_event(_event_id uuid, _status text, _note text default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _me uuid := (select auth.uid());
  _event public.events%rowtype;
begin
  if not private.is_member() then
    raise exception 'Nincs jogosultságod.' using errcode = '42501';
  end if;
  select * into _event from public.events where id = _event_id;
  if not found or not private.can_see_event(_event.audience) then
    raise exception 'Az esemény nem található.' using errcode = 'P0002';
  end if;
  if not _event.rsvp then raise exception 'Ehhez az eseményhez nem kell jelezni a részvételt.' using errcode = '22023'; end if;
  if _event.cancelled_at is not null then raise exception 'Az esemény elmarad.' using errcode = '22023'; end if;
  if coalesce(_event.ends_at, _event.starts_at + interval '3 hours') < now() then
    raise exception 'Az esemény már véget ért.' using errcode = '22023';
  end if;

  if _status is null then
    delete from public.event_responses where event_id = _event_id and user_id = _me;
  elsif _status in ('going', 'maybe', 'absent') then
    insert into public.event_responses (event_id, user_id, status, note)
    values (_event_id, _me, _status, nullif(left(btrim(coalesce(_note, '')), 200), ''))
    on conflict (event_id, user_id) do update set status = excluded.status, note = excluded.note, updated_at = now();
  else
    raise exception 'Érvénytelen válasz.' using errcode = '22023';
  end if;

  return (select json_build_object(
    'going', count(*) filter (where r.status = 'going'),
    'maybe', count(*) filter (where r.status = 'maybe'),
    'absent', count(*) filter (where r.status = 'absent'))
    from public.event_responses r where r.event_id = _event_id);
end;
$$;

-- Daily cron (early morning): today's events to those who said they come (or might).
create or replace function public.events_send_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _event record;
  _sent integer := 0;
begin
  for _event in
    select e.id, e.title, e.starts_at, e.location from public.events e
    where e.cancelled_at is null and e.starts_at::date = current_date and e.starts_at > now()
  loop
    _sent := _sent + private.notify(
      (select coalesce(array_agg(r.user_id), '{}') from public.event_responses r
       where r.event_id = _event.id and r.status in ('going', 'maybe')),
      'Ma: ' || _event.title,
      to_char(_event.starts_at, 'HH24:MI') || coalesce(' · ' || nullif(btrim(_event.location), ''), ''),
      'info', 'event', '/events?id=' || _event.id, 'event-reminder:' || _event.id);
  end loop;
  return _sent;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Dashboard: the member's month and the next events
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
  _month date := date_trunc('month', current_date)::date;
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
                           and current_date between starts_on and ends_on),
    -- The member's month against the requirements (duty time is recorded by staff at the meetings).
    'my_month', json_build_object(
      'month', _month,
      'reports', (select count(*) from report_logs where user_id = _me.id and month = _month),
      'duty_minutes', (select minutes from duty_time_entries where user_id = _me.id and month = _month),
      'duty_updated_at', (select updated_at from duty_time_entries where user_id = _me.id and month = _month),
      'min_reports', (select min_reports from payroll_settings where id = 'global'),
      'min_duty_hours', (select min_duty_hours from payroll_settings where id = 'global')),
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
      ) x)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Grants (functions in public are not callable by default)
-- ---------------------------------------------------------------------------

revoke all on function public.get_events(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.get_events(timestamptz, timestamptz) to authenticated;
revoke all on function public.respond_to_event(uuid, text, text) from public, anon, authenticated;
grant execute on function public.respond_to_event(uuid, text, text) to authenticated;
revoke all on function public.events_send_reminders() from public, anon, authenticated;
grant execute on function public.events_send_reminders() to service_role;
grant execute on all functions in schema private to service_role;
