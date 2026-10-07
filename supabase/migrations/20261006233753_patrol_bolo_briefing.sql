-- =============================================================================
-- Patrol tools: BOLO alerts ("Be On the Lookout"), the shift briefing and the plate lookup.
--
--   * bolo_alerts: vehicles and persons the patrol should look out for (stolen, wanted,
--     missing, dangerous, suspicious), with a picture (Cloudinary), the last sighting and an
--     expiry (72 hours unless extended). Every member reads and adds them; any member may mark
--     one found (resolved, with a note); the author and the staff withdraw, reopen or extend it.
--     A new high-danger alert notifies everyone (category "patrol", mutable).
--   * get_briefing(): one call for the briefing page (active alerts, approved arrest warrants
--     as "wanted" without their reasons, today's events, the latest announcements, the last
--     24 hours in numbers).
--   * lookup_plate(): a plate in the quick search: alerts, the department's own vehicles and,
--     for the case area, the vehicles of registered persons.
--
-- Compatible with the deployed frontend: new table and functions; the notification category
-- lists and get_dashboard_summary() only gain values/keys.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. The "patrol" notification category
-- ---------------------------------------------------------------------------

alter table public.notifications drop constraint if exists notifications_category_check;
alter table public.notifications add constraint notifications_category_check
  check (category in ('system', 'hr', 'mcb', 'logistics', 'finance', 'exam', 'academy', 'announcement', 'event', 'community', 'patrol'));
alter table public.notification_preferences drop constraint if exists notification_preferences_categories_check;
alter table public.notification_preferences add constraint notification_preferences_categories_check
  check (muted_categories <@ array['hr', 'mcb', 'logistics', 'finance', 'exam', 'academy', 'announcement', 'event', 'community', 'patrol']);

-- ---------------------------------------------------------------------------
-- 2. BOLO alerts
-- ---------------------------------------------------------------------------

-- The plate key is a generated column: whoever writes an alert evaluates the (pure) function.
grant execute on function private.plate_key(text) to authenticated;

create table public.bolo_alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('vehicle', 'person')),
  reason text not null default 'other' check (reason in ('stolen', 'wanted', 'missing', 'dangerous', 'suspicious', 'other')),
  danger text not null default 'medium' check (danger in ('low', 'medium', 'high')),
  title text not null check (char_length(btrim(title)) between 3 and 120),
  plate text check (char_length(plate) <= 16),
  plate_key text generated always as (nullif(private.plate_key(plate), '')) stored,
  vehicle_model text check (char_length(vehicle_model) <= 60),
  vehicle_color text check (char_length(vehicle_color) <= 40),
  person_name text check (char_length(person_name) <= 80),
  description text check (char_length(description) <= 1500),
  last_seen_location text check (char_length(last_seen_location) <= 120),
  last_seen_at timestamptz,
  image_url text check (image_url is null or image_url ~ '^https://res\.cloudinary\.com/'),
  suspect_id uuid references public.suspects(id) on delete set null,
  case_id uuid references public.cases(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'resolved', 'cancelled')),
  expires_at timestamptz not null default now() + interval '72 hours',
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolution text check (char_length(resolution) <= 500),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  check (expires_at > created_at and expires_at <= created_at + interval '30 days'),
  check (kind <> 'vehicle' or plate is not null or vehicle_model is not null)
);
create index bolo_alerts_active_idx on public.bolo_alerts (status, expires_at desc);
create index bolo_alerts_plate_idx on public.bolo_alerts (plate_key) where plate_key is not null;
alter table public.bolo_alerts enable row level security;
create trigger stamp_bolo_alerts before update on public.bolo_alerts for each row execute function private.stamp_update();

-- The author and the staff (Supervisory Staff and above, the bureau manager) manage an alert.
create or replace function private.can_manage_bolo(_created_by uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_member() and ((select auth.uid()) = _created_by or private.is_staff())
$$;
revoke execute on function private.can_manage_bolo(uuid) from public, anon;
grant execute on function private.can_manage_bolo(uuid) to authenticated;

create policy bolo_alerts_select on public.bolo_alerts for select to authenticated
  using ((select private.is_member()));
create policy bolo_alerts_insert on public.bolo_alerts for insert to authenticated
  with check ((select private.is_member()) and created_by = (select auth.uid()) and status = 'active');
create policy bolo_alerts_update on public.bolo_alerts for update to authenticated
  using (private.can_manage_bolo(created_by))
  with check (private.can_manage_bolo(created_by));
-- A mistaken alert is deleted by its author within half an hour, or by the staff.
create policy bolo_alerts_delete on public.bolo_alerts for delete to authenticated
  using (((select auth.uid()) = created_by and created_at > now() - interval '30 minutes') or (select private.is_staff()));
revoke all on public.bolo_alerts from anon, authenticated;
grant select, delete on public.bolo_alerts to authenticated;
grant insert (kind, reason, danger, title, plate, vehicle_model, vehicle_color, person_name, description, last_seen_location,
  last_seen_at, image_url, suspect_id, case_id, expires_at) on public.bolo_alerts to authenticated;
-- The description of a sighting (status changes go through set_bolo_status()).
grant update (reason, danger, title, plate, vehicle_model, vehicle_color, person_name, description, last_seen_location,
  last_seen_at, image_url) on public.bolo_alerts to authenticated;

-- A new high-danger alert reaches everyone (mutable "patrol" category).
create or replace function private.on_bolo_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.danger = 'high' then
    perform private.notify(private.member_ids(), 'Új BOLO: ' || new.title,
      concat_ws(' · ', case new.kind when 'vehicle' then nullif(concat_ws(' ', new.plate, new.vehicle_model), '') else new.person_name end,
                nullif(new.last_seen_location, ''), 'Veszélyes, óvatosan!'),
      'alert', 'patrol', '/briefing?bolo=' || new.id, 'bolo:' || new.id);
  end if;
  return null;
end;
$$;
revoke execute on function private.on_bolo_insert() from public, anon, authenticated;
create trigger on_bolo_insert after insert on public.bolo_alerts for each row execute function private.on_bolo_insert();

-- ---------------------------------------------------------------------------
-- 3. Status changes
-- ---------------------------------------------------------------------------

create or replace function private.bolo_json(_b public.bolo_alerts)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'id', _b.id, 'kind', _b.kind, 'reason', _b.reason, 'danger', _b.danger, 'title', _b.title, 'plate', _b.plate,
    'vehicle_model', _b.vehicle_model, 'vehicle_color', _b.vehicle_color, 'person_name', _b.person_name, 'description', _b.description,
    'last_seen_location', _b.last_seen_location, 'last_seen_at', _b.last_seen_at, 'image_url', _b.image_url,
    'status', _b.status, 'expires_at', _b.expires_at, 'resolved_at', _b.resolved_at, 'resolution', _b.resolution,
    'resolved_by_name', (select full_name from public.profiles where id = _b.resolved_by),
    'created_by', _b.created_by, 'created_by_name', (select full_name from public.profiles where id = _b.created_by),
    'created_at', _b.created_at, 'updated_at', _b.updated_at,
    'can_manage', private.can_manage_bolo(_b.created_by),
    -- The case and the person only for those who may see the case area.
    'case', case when _b.case_id is not null and private.can_view_cases() then
      (select json_build_object('id', c.id, 'case_number', c.case_number, 'title', c.title) from public.cases c where c.id = _b.case_id) end,
    'suspect', case when _b.suspect_id is not null and private.can_view_cases() then
      (select json_build_object('id', s.id, 'full_name', s.full_name, 'mugshot_url', s.mugshot_url) from public.suspects s where s.id = _b.suspect_id) end)
$$;
revoke execute on function private.bolo_json(public.bolo_alerts) from public, anon;
grant execute on function private.bolo_json(public.bolo_alerts) to authenticated;

-- 'resolved' (found: any member, with a note), 'cancelled' (withdrawn) or 'active' again
-- (reopened, for _hours more): the latter two by the author or the staff.
create or replace function public.set_bolo_status(_id uuid, _status text, _note text default null, _hours integer default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _b public.bolo_alerts%rowtype;
  _me uuid := (select auth.uid());
  _clean text := nullif(btrim(coalesce(_note, '')), '');
begin
  if not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  select * into _b from public.bolo_alerts where id = _id for update;
  if _b.id is null then raise exception 'A BOLO nem található.' using errcode = 'P0002'; end if;
  if _status not in ('resolved', 'cancelled', 'active') then raise exception 'Ismeretlen állapot.'; end if;
  if _status <> 'resolved' and not private.can_manage_bolo(_b.created_by) then
    raise exception 'A BOLO-t a kiadója és a Supervisory Staff kezeli.' using errcode = '42501';
  end if;
  if char_length(coalesce(_clean, '')) > 500 then raise exception 'A megjegyzés legfeljebb 500 karakter lehet.'; end if;
  if _status = 'resolved' and _clean is null then raise exception 'Írd le röviden, hol és hogyan került elő.'; end if;

  if _status = 'active' then
    update public.bolo_alerts set status = 'active', resolved_at = null, resolved_by = null, resolution = null,
      expires_at = least(now() + make_interval(hours => least(greatest(coalesce(_hours, 72), 1), 24 * 14)), created_at + interval '30 days')
    where id = _id returning * into _b;
  else
    update public.bolo_alerts set status = _status, resolved_at = now(), resolved_by = _me, resolution = _clean
    where id = _id returning * into _b;
    if _status = 'resolved' and _b.created_by is not null and _b.created_by <> _me then
      perform private.notify(array[_b.created_by], 'BOLO megoldva: ' || _b.title,
        coalesce(_clean, 'A körözött jármű vagy személy előkerült.'), 'success', 'patrol', '/briefing?bolo=' || _b.id);
    end if;
  end if;
  return private.bolo_json(_b);
end;
$$;
revoke execute on function public.set_bolo_status(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.set_bolo_status(uuid, text, text, integer) to authenticated;

-- More time for an active alert (from now, at most 14 days; 30 days after it was issued).
create or replace function public.extend_bolo(_id uuid, _hours integer)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _b public.bolo_alerts%rowtype;
begin
  select * into _b from public.bolo_alerts where id = _id for update;
  if _b.id is null then raise exception 'A BOLO nem található.' using errcode = 'P0002'; end if;
  if not private.can_manage_bolo(_b.created_by) then
    raise exception 'A BOLO-t a kiadója és a Supervisory Staff kezeli.' using errcode = '42501';
  end if;
  if _b.status <> 'active' then raise exception 'Csak aktív BOLO hosszabbítható.'; end if;
  update public.bolo_alerts
  set expires_at = least(greatest(expires_at, now()) + make_interval(hours => least(greatest(coalesce(_hours, 24), 1), 24 * 14)),
                         created_at + interval '30 days')
  where id = _id returning * into _b;
  return private.bolo_json(_b);
end;
$$;
revoke execute on function public.extend_bolo(uuid, integer) from public, anon, authenticated;
grant execute on function public.extend_bolo(uuid, integer) to authenticated;

-- The board: active alerts first (most dangerous first), then the ones closed in the last week.
create or replace function public.get_bolos(_include_closed boolean default true)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select case when not private.is_member() then null else json_build_object(
    'active', coalesce((select json_agg(private.bolo_json(b) order by
                          case b.danger when 'high' then 0 when 'medium' then 1 else 2 end, b.created_at desc)
                        from public.bolo_alerts b where b.status = 'active' and b.expires_at > now()), '[]'::json),
    'closed', case when coalesce(_include_closed, true) then coalesce((select json_agg(private.bolo_json(b) order by coalesce(b.resolved_at, b.expires_at) desc)
               from (select * from public.bolo_alerts x
                     where (x.status <> 'active' or x.expires_at <= now())
                       and coalesce(x.resolved_at, x.expires_at) > now() - interval '7 days'
                     order by coalesce(x.resolved_at, x.expires_at) desc limit 30) b), '[]'::json) else '[]'::json end) end
$$;
revoke execute on function public.get_bolos(boolean) from public, anon, authenticated;
grant execute on function public.get_bolos(boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. The shift briefing in one call
-- ---------------------------------------------------------------------------

create or replace function public.get_briefing()
returns json
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _cases boolean := private.can_view_cases();
begin
  if not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  return json_build_object(
    'generated_at', now(),
    'bolos', coalesce((select json_agg(private.bolo_json(b) order by
                         case b.danger when 'high' then 0 when 'medium' then 1 else 2 end, b.created_at desc)
                       from public.bolo_alerts b where b.status = 'active' and b.expires_at > now()), '[]'::json),
    'resolved', coalesce((select json_agg(private.bolo_json(b) order by b.resolved_at desc)
                          from (select * from public.bolo_alerts x where x.status = 'resolved' and x.resolved_at > now() - interval '48 hours'
                                order by x.resolved_at desc limit 5) b), '[]'::json),
    -- Approved, valid arrest warrants: who to bring in. Their reasons stay in the case.
    'wanted', coalesce((select json_agg(json_build_object(
                          'id', w.id, 'name', coalesce(s.full_name, w.target_name, 'Ismeretlen'), 'alias', s.alias,
                          'mugshot_url', s.mugshot_url, 'suspect_status', s.status, 'decided_at', w.decided_at, 'expires_at', w.expires_at,
                          'case', case when _cases then json_build_object('id', c.id, 'case_number', c.case_number) end)
                        order by w.decided_at desc nulls last)
                       from public.case_warrants w
                       left join public.suspects s on s.id = w.suspect_id
                       left join public.cases c on c.id = w.case_id
                       where w.type = 'arrest' and w.status = 'approved' and (w.expires_at is null or w.expires_at > now())), '[]'::json),
    'events', coalesce((select json_agg(json_build_object('id', e.id, 'title', e.title, 'kind', e.kind, 'starts_at', e.starts_at,
                                                          'ends_at', e.ends_at, 'location', e.location) order by e.starts_at)
                        from public.events e
                        where e.cancelled_at is null and e.starts_at::date = current_date and private.can_see_event(e.audience)), '[]'::json),
    'announcements', coalesce((select json_agg(json_build_object('id', a.id, 'title', a.title, 'content', left(a.content, 400), 'type', a.type,
                                                                 'is_pinned', a.is_pinned, 'created_at', a.created_at,
                                                                 'author', case when a.show_author then (select full_name from public.profiles where id = a.created_by) end)
                                               order by a.is_pinned desc, a.created_at desc)
                               from (select * from public.announcements order by is_pinned desc, created_at desc limit 3) a), '[]'::json),
    'last24h', (select json_build_object(
                  'tickets', count(*) filter (where l.action_type = 'ticket'),
                  'arrests', count(*) filter (where l.action_type = 'arrest'),
                  'reports', (select count(*) from public.report_logs r where r.created_at > now() - interval '24 hours'))
                from public.action_logs l where l.created_at > now() - interval '24 hours'));
end;
$$;
revoke execute on function public.get_briefing() from public, anon, authenticated;
grant execute on function public.get_briefing() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. A plate in the quick search
-- ---------------------------------------------------------------------------

create or replace function public.lookup_plate(_query text)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _key text := private.plate_key(_query);
begin
  if not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  if char_length(_key) < 2 then return json_build_object('bolos', '[]'::json, 'fleet', '[]'::json, 'persons', '[]'::json); end if;
  return json_build_object(
    'bolos', coalesce((select json_agg(json_build_object('id', b.id, 'title', b.title, 'plate', b.plate, 'status', b.status,
                                                         'danger', b.danger, 'active', b.status = 'active' and b.expires_at > now())
                                       order by (b.status = 'active' and b.expires_at > now()) desc, b.created_at desc)
                       from (select * from public.bolo_alerts x where x.plate_key like _key || '%' order by x.created_at desc limit 5) b), '[]'::json),
    'fleet', coalesce((select json_agg(json_build_object('id', v.id, 'plate', v.plate, 'model', v.model) order by v.plate)
                       from (select * from public.fleet_vehicles x where x.is_active and private.plate_key(x.plate) like _key || '%'
                             order by x.plate limit 5) v), '[]'::json),
    -- Registered persons' vehicles: only for the case area (MCB and the staff).
    'persons', case when private.can_view_cases() then coalesce((select json_agg(json_build_object(
                     'suspect_id', s.id, 'full_name', s.full_name, 'status', s.status, 'plate', sv.plate_number, 'vehicle', sv.vehicle_type))
                   from (select * from public.suspect_vehicles x where private.plate_key(x.plate_number) like _key || '%' limit 5) sv
                   join public.suspects s on s.id = sv.suspect_id), '[]'::json) else '[]'::json end);
end;
$$;
revoke execute on function public.lookup_plate(text) from public, anon, authenticated;
grant execute on function public.lookup_plate(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. The dashboard counts the active alerts (latest definition, every key kept)
-- ---------------------------------------------------------------------------

create or replace function public.get_dashboard_summary()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
 SET "TimeZone" TO 'Europe/Budapest'
AS $function$
declare
  _me profiles%rowtype := private.me();
  _staff boolean;
  _admin boolean;
  _coach boolean;
  _month date := date_trunc('month', current_date)::date;
  _prev date := (date_trunc('month', current_date) - interval '1 month')::date;
  _duty integer;
begin
  if _me.id is null then
    raise exception 'Nincs jogosultságod.' using errcode = '42501';
  end if;
  _staff := private.is_staff();
  _admin := private.is_admin();
  _coach := private.can_coach_trainees();
  select minutes into _duty from duty_time_entries where user_id = _me.id and month = _month;

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
    -- Requests and renewals waiting for an approver.
    'pending_warrants', case when private.can_approve_warrants() then
      (select count(*) from case_warrants where status = 'pending' or (status = 'approved' and renewal_requested_at is not null)) end,
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
      'duty_minutes', _duty,
      'duty_updated_at', (select updated_at from duty_time_entries where user_id = _me.id and month = _month),
      'min_reports', (select min_reports from payroll_settings where id = 'global'),
      'min_duty_hours', (select min_duty_hours from payroll_settings where id = 'global'),
      -- The next duty tier above the recorded time: its hours and the extra pay it brings.
      'next_tier', (select json_build_object('hours', (t ->> 'hours')::int,
                                             'gain', (t ->> 'pay')::bigint
                                                     - coalesce((select max((x ->> 'pay')::bigint) from jsonb_array_elements(s.duty_tiers) x
                                                                 where (x ->> 'hours')::int * 60 <= coalesce(_duty, 0)), 0))
                    from payroll_settings s cross join lateral jsonb_array_elements(s.duty_tiers) t
                    where s.id = 'global' and (t ->> 'hours')::int * 60 > coalesce(_duty, 0)
                    order by (t ->> 'hours')::int limit 1)),
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
      ) x),
    'my_case_tasks', (select json_build_object('open', count(*), 'overdue', count(*) filter (where t.due_on < current_date))
                      from case_tasks t join cases c on c.id = t.case_id
                      where t.assignee_id = _me.id and t.done_at is null and c.status = 'open'),
    'policies_to_acknowledge', (select count(*) from policies p
                                where p.status = 'published' and p.version > 0 and p.requires_ack
                                  and not exists (select 1 from policy_acknowledgements a
                                                  where a.policy_id = p.id and a.user_id = _me.id and a.version = p.version)),
    'open_polls', (select count(*) from polls p
                   where p.closed_at is null and p.closes_at > now() and private.can_see_event(p.audience)
                     and not exists (select 1 from poll_voters v where v.poll_id = p.id and v.user_id = _me.id)),
    'nominations_pending', case when private.rank_index(_me.faction_rank) <= 6 or coalesce(_me.is_bureau_manager, false) then
      (select count(*) from promotion_nominations n
       where n.status = 'pending' and n.user_id <> _me.id and private.can_decide_promotion(n.to_rank)) end,
    'trainees_ready', case when _coach then
      (select count(*) from trainee_mentors tm join profiles p on p.id = tm.trainee_id
       where tm.signed_off_at is not null and tm.completed_at is null
         and p.faction_rank = 'Deputy Sheriff Trainee' and p.system_role <> 'pending') end,
    'trainees_without_mentor', case when _coach then
      (select count(*) from profiles p
       where p.faction_rank = 'Deputy Sheriff Trainee' and p.system_role <> 'pending' and coalesce(p.onboarding_completed, false)
         and not exists (select 1 from trainee_mentors tm where tm.trainee_id = p.id and tm.mentor_id is not null)) end,
    'mentees', (select count(*) from trainee_mentors tm join profiles p on p.id = tm.trainee_id
                where tm.mentor_id = _me.id and tm.completed_at is null and p.faction_rank = 'Deputy Sheriff Trainee'),
    'feedback_new', case when private.can_read_feedback('command') or private.can_read_feedback('manager') then
      (select count(*) from feedback_reports f where f.status = 'new' and private.can_read_feedback(f.recipient)) end,
    -- The month of the end-of-month recap: last month, once its pay is closed or a few days in,
    -- for those who were members then (someone who joined this month has nothing to look back on).
    'recap_month', case when (exists (select 1 from payroll_runs where month = _prev and status = 'closed') or current_date >= _month + 4)
                             and coalesce((select joined_on from member_details where user_id = _me.id), _me.created_at::date) < _month
                        then _prev end,
    -- The joining day of the HR registry (the account of an old member is younger than the membership).
    'joined_on', (select joined_on from member_details where user_id = _me.id),
    -- Active BOLO alerts (the patrol briefing).
    'active_bolos', (select count(*) from bolo_alerts b where b.status = 'active' and b.expires_at > now())
  );
end;
$function$;
