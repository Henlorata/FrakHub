-- =============================================================================
-- MCB: tasks inside cases (assignee, due date, overdue digest), an optional
-- register of seized items with their chain of custody, warrants that lapse after
-- a set number of days (with renewal), an informant register for the MCB
-- leadership and the handlers, and related-case suggestions on the case page.
--
-- Compatible with the deployed frontend: new tables, columns and functions; the
-- warrant expiry is set by a trigger on approval (the old pages approve directly)
-- and only the new daily job lets warrants lapse.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Case log kinds and a per-member case access check
-- ---------------------------------------------------------------------------

alter table public.case_events drop constraint case_events_kind_check;
alter table public.case_events add constraint case_events_kind_check check (kind in (
  'created', 'status', 'priority', 'title', 'category', 'owner', 'document',
  'collaborator_added', 'collaborator_removed', 'collaborator_role',
  'evidence_added', 'evidence_renamed', 'evidence_removed',
  'person_linked', 'person_updated', 'person_unlinked',
  'warrant_requested', 'warrant_status', 'warrant_renewal_requested', 'warrant_renewed',
  'task_added', 'task_done', 'task_reopened', 'task_removed',
  'item_added', 'item_custody', 'item_removed'));

-- Whether a given member may open a case (private.can_view_case_details for someone else).
create or replace function private.user_can_open_case(_case_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = _user_id and p.system_role <> 'pending'
      and (coalesce(p.is_bureau_manager, false)
           or (p.division = 'MCB' and (coalesce(p.is_bureau_commander, false) or p.division_rank = 'Investigator III.'))
           or p.system_role = 'admin' or private.rank_index(p.faction_rank) <= 6
           or exists (select 1 from public.cases c where c.id = _case_id and c.owner_id = _user_id)
           or exists (select 1 from public.case_collaborators cc where cc.case_id = _case_id and cc.user_id = _user_id))
  )
$$;

-- ---------------------------------------------------------------------------
-- 1. Case tasks
-- ---------------------------------------------------------------------------

create table public.case_tasks (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 200),
  assignee_id uuid references public.profiles(id) on delete set null,
  due_on date,
  done_at timestamptz,
  done_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Last overdue reminder (the daily job repeats it weekly while the task is open).
  digest_sent_on date
);
create index case_tasks_case_idx on public.case_tasks (case_id, created_at);
create index case_tasks_assignee_open_idx on public.case_tasks (assignee_id) where done_at is null;
alter table public.case_tasks enable row level security;
create policy case_tasks_select on public.case_tasks for select to authenticated
  using (private.can_view_case_details(case_id));
revoke all on public.case_tasks from anon, authenticated;
grant select on public.case_tasks to authenticated;

create or replace function private.case_task_json(_t public.case_tasks)
returns json
language sql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
  select json_build_object(
    'id', _t.id, 'case_id', _t.case_id, 'title', _t.title, 'assignee_id', _t.assignee_id, 'due_on', _t.due_on,
    'done_at', _t.done_at, 'created_at', _t.created_at, 'created_by', _t.created_by,
    'overdue', _t.done_at is null and _t.due_on is not null and _t.due_on < current_date,
    'assignee', (select json_build_object('full_name', p.full_name, 'badge_number', p.badge_number, 'avatar_url', p.avatar_url)
                 from public.profiles p where p.id = _t.assignee_id),
    'done_by_name', (select full_name from public.profiles where id = _t.done_by),
    'created_by_name', (select full_name from public.profiles where id = _t.created_by))
$$;

-- Adds or edits a task (the case's editors while it is open); a new assignee is notified.
create or replace function public.save_case_task(_case_id uuid, _task_id uuid, _title text, _assignee_id uuid, _due_on date)
returns json
language plpgsql
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _me uuid := (select auth.uid());
  _case public.cases%rowtype;
  _old public.case_tasks%rowtype;
  _row public.case_tasks%rowtype;
  _text text := btrim(coalesce(_title, ''));
begin
  select * into _case from public.cases where id = _case_id;
  if _case.id is null then raise exception 'Az akta nem található.' using errcode = 'P0002'; end if;
  if not private.can_write_case(_case_id) then
    raise exception 'Teendőt az akta szerkesztői vehetnek fel, amíg nyitott.' using errcode = '42501';
  end if;
  if char_length(_text) < 2 or char_length(_text) > 200 then raise exception 'A teendő 2–200 karakter lehet.' using errcode = '22023'; end if;
  if _assignee_id is not null and not private.user_can_open_case(_case_id, _assignee_id) then
    raise exception 'A felelős nem látja ezt az aktát: előbb add hozzá a csapathoz.' using errcode = '22023';
  end if;

  if _task_id is null then
    insert into public.case_tasks (case_id, title, assignee_id, due_on, created_by)
    values (_case_id, _text, _assignee_id, _due_on, _me) returning * into _row;
    perform private.log_case_event(_case_id, 'task_added', jsonb_build_object('task_id', _row.id, 'title', _text,
      'assignee', (select full_name from public.profiles where id = _assignee_id)));
  else
    select * into _old from public.case_tasks where id = _task_id and case_id = _case_id for update;
    if _old.id is null then raise exception 'A teendő nem található.' using errcode = 'P0002'; end if;
    update public.case_tasks set title = _text, assignee_id = _assignee_id, due_on = _due_on, updated_at = now(),
      digest_sent_on = case when _due_on is distinct from _old.due_on then null else digest_sent_on end
    where id = _task_id returning * into _row;
  end if;

  if _row.assignee_id is not null and _row.assignee_id <> _me and _row.assignee_id is distinct from _old.assignee_id then
    perform private.notify(array[_row.assignee_id], 'Új teendőd egy aktában',
      format('%s – %s%s', _case.case_number, _text, case when _due_on is not null then ' (határidő: ' || to_char(_due_on, 'YYYY.MM.DD.') || ')' else '' end),
      'info', 'mcb', '/mcb/case/' || _case_id);
  end if;
  return private.case_task_json(_row);
end;
$$;

-- Done / not done: the case's editors, and the assignee while the case is open.
create or replace function public.set_case_task_done(_task_id uuid, _done boolean)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _me uuid := (select auth.uid());
  _row public.case_tasks%rowtype;
begin
  select * into _row from public.case_tasks where id = _task_id for update;
  if _row.id is null or not private.can_view_case_details(_row.case_id) then
    raise exception 'A teendő nem található.' using errcode = 'P0002';
  end if;
  if not (private.can_write_case(_row.case_id)
          or (_row.assignee_id = _me and exists (select 1 from public.cases where id = _row.case_id and status = 'open'))) then
    raise exception 'A teendőt az akta szerkesztői és a felelőse jelölheti késznek.' using errcode = '42501';
  end if;
  update public.case_tasks set done_at = case when coalesce(_done, true) then now() end,
    done_by = case when coalesce(_done, true) then _me end, updated_at = now()
  where id = _task_id returning * into _row;
  perform private.log_case_event(_row.case_id, case when coalesce(_done, true) then 'task_done' else 'task_reopened' end,
    jsonb_build_object('task_id', _row.id, 'title', _row.title));
  return private.case_task_json(_row);
end;
$$;

create or replace function public.delete_case_task(_task_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _row public.case_tasks%rowtype;
begin
  select * into _row from public.case_tasks where id = _task_id;
  if _row.id is null then raise exception 'A teendő nem található.' using errcode = 'P0002'; end if;
  if not private.can_write_case(_row.case_id) then raise exception 'Teendőt az akta szerkesztői törölhetnek.' using errcode = '42501'; end if;
  delete from public.case_tasks where id = _task_id;
  perform private.log_case_event(_row.case_id, 'task_removed', jsonb_build_object('title', _row.title));
end;
$$;

-- The caller's open tasks in the cases they can open (MCB start page, dashboard).
create or replace function public.get_my_case_tasks()
returns json
language sql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
  select coalesce(json_agg(json_build_object(
    'id', t.id, 'title', t.title, 'due_on', t.due_on, 'created_at', t.created_at,
    'overdue', t.due_on is not null and t.due_on < current_date,
    'case', json_build_object('id', c.id, 'case_number', c.case_number, 'title', c.title, 'status', c.status))
    order by t.due_on nulls last, t.created_at), '[]'::json)
  from public.case_tasks t join public.cases c on c.id = t.case_id
  where t.assignee_id = (select auth.uid()) and t.done_at is null and c.status = 'open'
    and private.can_view_case_details(c.id)
$$;

-- ---------------------------------------------------------------------------
-- 2. Seized items and their chain of custody (optional per case)
-- ---------------------------------------------------------------------------

create table public.case_items (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 2 and 120),
  description text check (char_length(description) <= 500),
  quantity text check (char_length(quantity) <= 40),
  -- A photo of the item among the case's evidence.
  evidence_id uuid references public.case_evidence(id) on delete set null,
  status text not null default 'held' check (status in ('held', 'checked_out', 'returned', 'destroyed')),
  location text check (char_length(location) <= 120),
  holder_id uuid references public.profiles(id) on delete set null,
  holder_name text check (char_length(holder_name) <= 80),
  retain_until date,
  retention_reminded_on date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index case_items_case_idx on public.case_items (case_id, created_at);

create table public.case_item_events (
  id bigint generated always as identity primary key,
  item_id uuid not null references public.case_items(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  action text not null check (action in ('seized', 'moved', 'checked_out', 'checked_in', 'returned', 'destroyed', 'note')),
  location text check (char_length(location) <= 120),
  holder_id uuid references public.profiles(id) on delete set null,
  holder_name text check (char_length(holder_name) <= 80),
  note text check (char_length(note) <= 300),
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index case_item_events_item_idx on public.case_item_events (item_id, created_at);

alter table public.case_items enable row level security;
alter table public.case_item_events enable row level security;
create policy case_items_select on public.case_items for select to authenticated using (private.can_view_case_details(case_id));
create policy case_item_events_select on public.case_item_events for select to authenticated using (private.can_view_case_details(case_id));
revoke all on public.case_items, public.case_item_events from anon, authenticated;
grant select on public.case_items, public.case_item_events to authenticated;

create or replace function private.case_item_json(_i public.case_items)
returns json
language sql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
  select json_build_object(
    'id', _i.id, 'case_id', _i.case_id, 'label', _i.label, 'description', _i.description, 'quantity', _i.quantity,
    'evidence_id', _i.evidence_id, 'status', _i.status, 'location', _i.location, 'holder_id', _i.holder_id,
    'holder_name', coalesce((select full_name from public.profiles where id = _i.holder_id), _i.holder_name),
    'retain_until', _i.retain_until, 'retention_over', _i.retain_until is not null and _i.retain_until < current_date
                                                        and _i.status in ('held', 'checked_out'),
    'created_at', _i.created_at, 'created_by', _i.created_by,
    'events', (select coalesce(json_agg(json_build_object(
                 'id', e.id, 'action', e.action, 'location', e.location, 'note', e.note, 'created_at', e.created_at,
                 'holder_name', coalesce((select full_name from public.profiles where id = e.holder_id), e.holder_name),
                 'actor_name', (select full_name from public.profiles where id = e.actor_id))
               order by e.created_at, e.id), '[]'::json)
               from (select * from public.case_item_events where item_id = _i.id order by created_at desc, id desc limit 40) e))
$$;

-- Records a seized item or edits its description (status changes go through record_case_item).
create or replace function public.save_case_item(_case_id uuid, _item_id uuid, _item jsonb)
returns json
language plpgsql
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _me uuid := (select auth.uid());
  _row public.case_items%rowtype;
  _label text := btrim(coalesce(_item ->> 'label', ''));
  _evidence uuid := nullif(_item ->> 'evidence_id', '')::uuid;
  _retain date := nullif(_item ->> 'retain_until', '')::date;
begin
  if not private.can_write_case(_case_id) then
    raise exception 'Tárgyat az akta szerkesztői rögzíthetnek, amíg nyitott.' using errcode = '42501';
  end if;
  if char_length(_label) < 2 or char_length(_label) > 120 then raise exception 'Add meg a tárgy megnevezését (2–120 karakter).' using errcode = '22023'; end if;
  if _evidence is not null and not exists (select 1 from public.case_evidence where id = _evidence and case_id = _case_id) then
    raise exception 'A kép nem ehhez az aktához tartozik.' using errcode = '22023';
  end if;

  if _item_id is null then
    insert into public.case_items (case_id, label, description, quantity, evidence_id, location, holder_id, retain_until, created_by)
    values (_case_id, left(_label, 120), nullif(left(btrim(coalesce(_item ->> 'description', '')), 500), ''),
            nullif(left(btrim(coalesce(_item ->> 'quantity', '')), 40), ''), _evidence,
            nullif(left(btrim(coalesce(_item ->> 'location', '')), 120), ''), _me, _retain, _me)
    returning * into _row;
    insert into public.case_item_events (item_id, case_id, action, location, holder_id, note, actor_id)
    values (_row.id, _case_id, 'seized', _row.location, _me, nullif(left(btrim(coalesce(_item ->> 'note', '')), 300), ''), _me);
    perform private.log_case_event(_case_id, 'item_added', jsonb_build_object('item_id', _row.id, 'label', _row.label));
  else
    update public.case_items set label = left(_label, 120),
      description = nullif(left(btrim(coalesce(_item ->> 'description', '')), 500), ''),
      quantity = nullif(left(btrim(coalesce(_item ->> 'quantity', '')), 40), ''),
      evidence_id = _evidence, retain_until = _retain,
      retention_reminded_on = case when _retain is distinct from retain_until then null else retention_reminded_on end,
      updated_at = now()
    where id = _item_id and case_id = _case_id returning * into _row;
    if _row.id is null then raise exception 'A tárgy nem található.' using errcode = 'P0002'; end if;
  end if;
  return private.case_item_json(_row);
end;
$$;

-- One step of the chain of custody: moved, handed out (to a member or e.g. the court), taken back,
-- returned to its owner, destroyed, or a note.
create or replace function public.record_case_item(_item_id uuid, _action text, _location text, _holder_id uuid, _holder_name text,
                                                   _note text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _me uuid := (select auth.uid());
  _row public.case_items%rowtype;
  _place text := nullif(left(btrim(coalesce(_location, '')), 120), '');
  _who text := nullif(left(btrim(coalesce(_holder_name, '')), 80), '');
  _text text := nullif(left(btrim(coalesce(_note, '')), 300), '');
  _next text;
begin
  select * into _row from public.case_items where id = _item_id for update;
  if _row.id is null then raise exception 'A tárgy nem található.' using errcode = 'P0002'; end if;
  if not private.can_write_case(_row.case_id) then
    raise exception 'Az őrzési láncot az akta szerkesztői vezetik, amíg nyitott.' using errcode = '42501';
  end if;
  if _row.status in ('returned', 'destroyed') and _action <> 'note' then
    raise exception 'A tárgy már nincs őrizetben.' using errcode = '22023';
  end if;
  if _holder_id is not null and not exists (select 1 from public.profiles where id = _holder_id and system_role <> 'pending') then
    raise exception 'A kiválasztott tag nem található.' using errcode = 'P0002';
  end if;

  _next := case _action
    when 'moved' then 'held' when 'checked_out' then 'checked_out' when 'checked_in' then 'held'
    when 'returned' then 'returned' when 'destroyed' then 'destroyed' when 'note' then _row.status end;
  if _next is null then raise exception 'Ismeretlen művelet.' using errcode = '22023'; end if;
  if _action = 'moved' and (_row.status <> 'held' or _place is null) then
    raise exception 'Áthelyezni őrizetben lévő tárgyat lehet, új hellyel.' using errcode = '22023';
  end if;
  if _action = 'checked_out' and (_row.status <> 'held' or (_holder_id is null and _who is null)) then
    raise exception 'Kiadni őrizetben lévő tárgyat lehet, átvevővel.' using errcode = '22023';
  end if;
  if _action = 'checked_in' and _row.status <> 'checked_out' then
    raise exception 'Csak kiadott tárgy vehető vissza.' using errcode = '22023';
  end if;
  if _action = 'note' and _text is null then raise exception 'Írd be a megjegyzést.' using errcode = '22023'; end if;

  insert into public.case_item_events (item_id, case_id, action, location, holder_id, holder_name, note, actor_id)
  values (_row.id, _row.case_id, _action, _place,
          _holder_id, _who, _text, _me);
  update public.case_items set
    status = _next,
    location = case when _action in ('moved', 'checked_in') then coalesce(_place, location)
                    when _action in ('returned', 'destroyed') then null else location end,
    holder_id = case when _action = 'checked_out' then _holder_id when _action in ('checked_in', 'moved') then _me
                     when _action in ('returned', 'destroyed') then null else holder_id end,
    holder_name = case when _action = 'checked_out' then _who when _action in ('checked_in', 'moved', 'returned', 'destroyed') then null
                       else holder_name end,
    updated_at = now()
  where id = _item_id returning * into _row;
  if _action <> 'note' then
    perform private.log_case_event(_row.case_id, 'item_custody', jsonb_build_object('item_id', _row.id, 'label', _row.label, 'action', _action));
  end if;
  return private.case_item_json(_row);
end;
$$;

create or replace function public.delete_case_item(_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _row public.case_items%rowtype;
begin
  select * into _row from public.case_items where id = _item_id;
  if _row.id is null then raise exception 'A tárgy nem található.' using errcode = 'P0002'; end if;
  if not (private.can_write_case(_row.case_id)
          and (_row.created_by = (select auth.uid()) or private.can_manage_case(_row.case_id))) then
    raise exception 'Tárgyat a rögzítője vagy az akta tulajdonosa törölhet.' using errcode = '42501';
  end if;
  delete from public.case_items where id = _item_id;
  perform private.log_case_event(_row.case_id, 'item_removed', jsonb_build_object('label', _row.label));
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Warrants: validity, reminder, renewal
-- ---------------------------------------------------------------------------

create table public.mcb_settings (
  id text primary key default 'global' check (id = 'global'),
  -- Days an approved warrant is valid (0: no expiry).
  arrest_days integer not null default 14 check (arrest_days between 0 and 90),
  search_days integer not null default 7 check (search_days between 0 and 90),
  -- The requester and the case owner are reminded this many days before.
  reminder_days integer not null default 2 check (reminder_days between 0 and 14),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
insert into public.mcb_settings (id) values ('global') on conflict do nothing;
alter table public.mcb_settings enable row level security;
create policy mcb_settings_select on public.mcb_settings for select to authenticated using ((select private.can_view_cases()));
revoke all on public.mcb_settings from anon, authenticated;
grant select on public.mcb_settings to authenticated;

alter table public.case_warrants
  add column if not exists expires_at timestamptz,
  add column if not exists renewal_requested_at timestamptz,
  add column if not exists renewal_requested_by uuid references public.profiles(id) on delete set null,
  add column if not exists renewal_note text check (char_length(renewal_note) <= 500),
  add column if not exists renewals integer not null default 0,
  add column if not exists expiry_reminded_at timestamptz;
create index if not exists case_warrants_expiry_idx on public.case_warrants (expires_at) where status = 'approved' and expires_at is not null;

-- An approval starts the validity (approved before this migration: no expiry until renewed).
create or replace function private.set_warrant_expiry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _days integer;
begin
  if new.status = 'approved' and old.status is distinct from 'approved' and new.expires_at is null then
    select case when new.type = 'arrest' then arrest_days else search_days end into _days from public.mcb_settings where id = 'global';
    if coalesce(_days, 0) > 0 then new.expires_at := now() + make_interval(days => _days); end if;
  end if;
  if new.status <> 'approved' then
    new.renewal_requested_at := null;
    new.renewal_requested_by := null;
  end if;
  return new;
end;
$$;
create trigger set_warrant_expiry before update of status on public.case_warrants
  for each row execute function private.set_warrant_expiry();

create or replace function public.save_mcb_settings(_arrest_days integer, _search_days integer, _reminder_days integer)
returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_mcb_lead() then raise exception 'A parancsok érvényességét az MCB vezetése állítja be.' using errcode = '42501'; end if;
  update public.mcb_settings set
    arrest_days = least(greatest(coalesce(_arrest_days, arrest_days), 0), 90),
    search_days = least(greatest(coalesce(_search_days, search_days), 0), 90),
    reminder_days = least(greatest(coalesce(_reminder_days, reminder_days), 0), 14),
    updated_at = now(), updated_by = (select auth.uid())
  where id = 'global';
  return (select row_to_json(s) from public.mcb_settings s where s.id = 'global');
end;
$$;

-- warrant_json() with the validity and the renewal request (unchanged otherwise).
create or replace function private.warrant_json(_w public.case_warrants)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'id', _w.id, 'case_id', _w.case_id, 'type', _w.type, 'status', _w.status, 'reason', _w.reason,
    'description', _w.description, 'suspect_id', _w.suspect_id, 'property_id', _w.property_id, 'target_name', _w.target_name,
    'requested_by', _w.requested_by, 'approved_by', _w.approved_by, 'closed_by', _w.closed_by,
    'created_at', _w.created_at, 'updated_at', _w.updated_at, 'decided_at', _w.decided_at, 'decision_note', _w.decision_note,
    'closed_at', _w.closed_at, 'closing_note', _w.closing_note,
    'expires_at', _w.expires_at, 'renewals', _w.renewals, 'renewal_requested_at', _w.renewal_requested_at,
    'renewal_requested_by', _w.renewal_requested_by, 'renewal_note', _w.renewal_note,
    'renewal_requester_name', (select full_name from public.profiles where id = _w.renewal_requested_by),
    'requester', (select json_build_object('full_name', p.full_name, 'badge_number', p.badge_number, 'faction_rank', p.faction_rank)
                  from public.profiles p where p.id = _w.requested_by),
    'approver', (select json_build_object('full_name', p.full_name, 'badge_number', p.badge_number, 'faction_rank', p.faction_rank)
                 from public.profiles p where p.id = _w.approved_by),
    'closer', (select json_build_object('full_name', p.full_name, 'badge_number', p.badge_number)
               from public.profiles p where p.id = _w.closed_by),
    'suspect', (select json_build_object('id', s.id, 'full_name', s.full_name, 'alias', s.alias, 'mugshot_url', s.mugshot_url,
                                         'status', s.status, 'gang_affiliation', s.gang_affiliation)
                from public.suspects s where s.id = _w.suspect_id),
    'property', (select json_build_object('address', sp.address, 'property_type', sp.property_type)
                 from public.suspect_properties sp where sp.id = _w.property_id),
    'case', (select json_build_object('id', c.id, 'case_number', c.case_number, 'title', c.title, 'status', c.status)
             from public.cases c where c.id = _w.case_id)
  )
$$;

-- The case's editors ask the approvers to extend an approved warrant.
create or replace function public.request_warrant_renewal(_warrant_id uuid, _note text default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _w public.case_warrants%rowtype;
  _text text := nullif(left(btrim(coalesce(_note, '')), 500), '');
begin
  select * into _w from public.case_warrants where id = _warrant_id for update;
  if _w.id is null then raise exception 'A parancs nem található.' using errcode = 'P0002'; end if;
  if not private.can_write_case(_w.case_id) then raise exception 'Megújítást az akta szerkesztői kérhetnek.' using errcode = '42501'; end if;
  if _w.status <> 'approved' then raise exception 'Csak érvényes parancs újítható meg.' using errcode = '22023'; end if;
  if _w.renewal_requested_at is not null then raise exception 'A megújítást már kérték.' using errcode = '22023'; end if;
  update public.case_warrants set renewal_requested_at = now(), renewal_requested_by = (select auth.uid()), renewal_note = _text,
    updated_at = now()
  where id = _warrant_id returning * into _w;
  perform private.log_case_event(_w.case_id, 'warrant_renewal_requested',
    jsonb_build_object('warrant_id', _w.id, 'type', _w.type, 'target', private.warrant_target(_w)));
  perform private.notify(private.warrant_approver_ids(), 'Parancs megújítását kérik',
    format('%s: %s (%s)', case _w.type when 'arrest' then 'Elfogatóparancs' else 'Házkutatási parancs' end, private.warrant_target(_w),
           (select case_number from public.cases where id = _w.case_id)),
    'warning', 'mcb', '/mcb/warrants', 'warrant-renewals');
  return private.warrant_json(_w);
end;
$$;

-- An approver extends an approved warrant by the set days (never their own renewal request).
create or replace function public.renew_warrant(_warrant_id uuid, _note text default null)
returns json
language plpgsql
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _uid uuid := (select auth.uid());
  _w public.case_warrants%rowtype;
  _days integer;
begin
  select * into _w from public.case_warrants where id = _warrant_id for update;
  if _w.id is null then raise exception 'A parancs nem található.' using errcode = 'P0002'; end if;
  if not private.can_approve_warrants() then
    raise exception 'Parancsot a felügyelő állomány és az Investigator III. újíthat meg.' using errcode = '42501';
  end if;
  if _w.status <> 'approved' then raise exception 'Csak érvényes parancs újítható meg.' using errcode = '22023'; end if;
  if _w.renewal_requested_by = _uid then raise exception 'Saját megújítási kérelmet nem bírálhatsz el.' using errcode = '42501'; end if;
  select case when _w.type = 'arrest' then arrest_days else search_days end into _days from public.mcb_settings where id = 'global';
  update public.case_warrants set
    expires_at = case when coalesce(_days, 0) > 0 then greatest(now(), coalesce(expires_at, now())) + make_interval(days => _days) end,
    renewals = renewals + 1, renewal_requested_at = null, renewal_requested_by = null, renewal_note = null, expiry_reminded_at = null,
    decision_note = coalesce(nullif(left(btrim(coalesce(_note, '')), 500), ''), decision_note), updated_at = now()
  where id = _warrant_id returning * into _w;
  perform private.log_case_event(_w.case_id, 'warrant_renewed',
    jsonb_build_object('warrant_id', _w.id, 'type', _w.type, 'target', private.warrant_target(_w), 'expires_at', _w.expires_at));
  perform private.notify(array_remove(array[_w.requested_by, (select owner_id from public.cases where id = _w.case_id)], null),
    case _w.type when 'arrest' then 'Elfogatóparancs megújítva' else 'Házkutatási parancs megújítva' end,
    format('%s – érvényes: %s', private.warrant_target(_w),
           coalesce(to_char(_w.expires_at at time zone 'Europe/Budapest', 'YYYY.MM.DD. HH24:MI'), 'visszavonásig')),
    'success', 'mcb', '/mcb/case/' || _w.case_id);
  return private.warrant_json(_w);
end;
$$;

-- Warrant notifications: a lapsed warrant is reported as such (the rest unchanged).
create or replace function private.on_warrant_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _case public.cases%rowtype;
  _kind text;
  _target text;
  _lapsed boolean := new.status = 'expired' and new.closed_by is null and new.expires_at is not null and new.expires_at <= now();
begin
  _kind := case new.type when 'arrest' then 'Elfogatóparancs' else 'Házkutatási parancs' end;
  select * into _case from public.cases where id = new.case_id;
  _target := private.warrant_target(new);

  if tg_op = 'INSERT' then
    perform private.notify(private.warrant_approver_ids(), 'Jóváhagyásra váró parancs',
      format('%s: %s (%s)', _kind, _target, coalesce(_case.case_number, '')),
      'warning', 'mcb', '/mcb', 'warrants-pending');
    return new;
  end if;

  if new.status is distinct from old.status
     and (new.status in ('approved', 'rejected', 'executed') or (new.status = 'expired' and old.status = 'approved')) then
    perform private.notify(array_remove(array[new.requested_by, _case.owner_id], null),
      case new.status when 'approved' then _kind || ' jóváhagyva'
                      when 'rejected' then _kind || ' elutasítva'
                      when 'executed' then _kind || ' végrehajtva'
                      else _kind || case when _lapsed then ' lejárt' else ' visszavonva' end end,
      format('%s – %s', _target, coalesce(_case.case_number, '')),
      case new.status when 'approved' then 'success' when 'rejected' then 'alert' when 'expired' then 'warning' else 'info' end,
      'mcb', '/mcb/case/' || new.case_id);
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Informants (MCB leadership; handlers see their own)
-- ---------------------------------------------------------------------------

create table public.informants (
  id uuid primary key default gen_random_uuid(),
  codename text not null unique check (char_length(btrim(codename)) between 2 and 40),
  real_name text check (char_length(real_name) <= 80),
  suspect_id uuid references public.suspects(id) on delete set null,
  handler_id uuid references public.profiles(id) on delete set null,
  -- 1 (unreliable) ... 5 (always right); null: not rated yet.
  reliability smallint check (reliability between 1 and 5),
  status text not null default 'active' check (status in ('active', 'dormant', 'burned', 'closed')),
  contact text check (char_length(contact) <= 200),
  notes text check (char_length(notes) <= 2000),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
create index informants_handler_idx on public.informants (handler_id);

create table public.informant_contacts (
  id uuid primary key default gen_random_uuid(),
  informant_id uuid not null references public.informants(id) on delete cascade,
  met_on date not null,
  summary text not null check (char_length(btrim(summary)) between 5 and 1000),
  value text not null default 'medium' check (value in ('none', 'low', 'medium', 'high')),
  case_id uuid references public.cases(id) on delete set null,
  payment bigint check (payment between 0 and 1000000000),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index informant_contacts_informant_idx on public.informant_contacts (informant_id, met_on desc);

create or replace function private.can_see_informant(_handler_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_mcb_lead() or (private.is_member() and _handler_id = (select auth.uid()))
$$;

alter table public.informants enable row level security;
alter table public.informant_contacts enable row level security;
create policy informants_select on public.informants for select to authenticated using (private.can_see_informant(handler_id));
create policy informant_contacts_select on public.informant_contacts for select to authenticated
  using (exists (select 1 from public.informants i where i.id = informant_id and private.can_see_informant(i.handler_id)));
revoke all on public.informants, public.informant_contacts from anon, authenticated;
grant select on public.informants, public.informant_contacts to authenticated;

create or replace function private.informant_json(_i public.informants)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'id', _i.id, 'codename', _i.codename, 'real_name', _i.real_name, 'suspect_id', _i.suspect_id, 'handler_id', _i.handler_id,
    'reliability', _i.reliability, 'status', _i.status, 'contact', _i.contact, 'notes', _i.notes,
    'created_at', _i.created_at, 'updated_at', _i.updated_at,
    'handler', (select json_build_object('full_name', p.full_name, 'badge_number', p.badge_number, 'avatar_url', p.avatar_url)
                from public.profiles p where p.id = _i.handler_id),
    'suspect', (select json_build_object('full_name', s.full_name, 'alias', s.alias, 'mugshot_url', s.mugshot_url)
                from public.suspects s where s.id = _i.suspect_id),
    'contacts', (select coalesce(json_agg(json_build_object(
                   'id', c.id, 'met_on', c.met_on, 'summary', c.summary, 'value', c.value, 'payment', c.payment, 'created_at', c.created_at,
                   'author_name', (select full_name from public.profiles where id = c.created_by),
                   'case', (select json_build_object('id', cs.id, 'case_number', cs.case_number, 'title', cs.title)
                            from public.cases cs where cs.id = c.case_id))
                 order by c.met_on desc, c.created_at desc), '[]'::json)
                 from public.informant_contacts c where c.informant_id = _i.id),
    'can_manage', private.is_mcb_lead())
$$;

create or replace function public.get_informants()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'is_lead', private.is_mcb_lead(),
    'informants', (select coalesce(json_agg(private.informant_json(i) order by i.status = 'active' desc, i.codename), '[]'::json)
                   from public.informants i where private.can_see_informant(i.handler_id)))
$$;

-- Leads create and edit everything; a handler edits the reliability, status, contact and notes.
create or replace function public.save_informant(_id uuid, _informant jsonb)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _lead boolean := private.is_mcb_lead();
  _row public.informants%rowtype;
  _codename text := btrim(coalesce(_informant ->> 'codename', ''));
  _handler uuid := nullif(_informant ->> 'handler_id', '')::uuid;
  _suspect uuid := nullif(_informant ->> 'suspect_id', '')::uuid;
  _reliability smallint := private.json_int(_informant -> 'reliability', 1, 5);
  _status text := coalesce(nullif(_informant ->> 'status', ''), 'active');
begin
  if _status not in ('active', 'dormant', 'burned', 'closed') then raise exception 'Ismeretlen státusz.' using errcode = '22023'; end if;
  if _id is null then
    if not _lead then raise exception 'Informátort az MCB vezetése vesz fel.' using errcode = '42501'; end if;
    if char_length(_codename) < 2 then raise exception 'Adj fedőnevet (legalább 2 karakter).' using errcode = '22023'; end if;
    if _handler is not null and not exists (select 1 from public.profiles where id = _handler and system_role <> 'pending') then
      raise exception 'A kezelő nem található.' using errcode = 'P0002';
    end if;
    begin
      insert into public.informants (codename, real_name, suspect_id, handler_id, reliability, status, contact, notes, created_by, updated_by)
      values (left(_codename, 40), nullif(left(btrim(coalesce(_informant ->> 'real_name', '')), 80), ''), _suspect, _handler, _reliability, _status,
              nullif(left(btrim(coalesce(_informant ->> 'contact', '')), 200), ''), nullif(left(btrim(coalesce(_informant ->> 'notes', '')), 2000), ''),
              (select auth.uid()), (select auth.uid()))
      returning * into _row;
    exception when unique_violation then
      raise exception 'Ez a fedőnév már foglalt.' using errcode = '23505';
    end;
    if _handler is not null and _handler <> (select auth.uid()) then
      perform private.notify(array[_handler], 'Informátort kaptál', format('Kezelőként rád bízták: „%s”.', _row.codename),
        'info', 'mcb', '/mcb/informants');
    end if;
    return private.informant_json(_row);
  end if;

  select * into _row from public.informants where id = _id for update;
  if _row.id is null or not private.can_see_informant(_row.handler_id) then raise exception 'Az informátor nem található.' using errcode = 'P0002'; end if;
  if _lead then
    if char_length(_codename) < 2 then raise exception 'Adj fedőnevet (legalább 2 karakter).' using errcode = '22023'; end if;
    begin
      update public.informants set codename = left(_codename, 40), real_name = nullif(left(btrim(coalesce(_informant ->> 'real_name', '')), 80), ''),
        suspect_id = _suspect, handler_id = _handler, reliability = _reliability, status = _status,
        contact = nullif(left(btrim(coalesce(_informant ->> 'contact', '')), 200), ''), notes = nullif(left(btrim(coalesce(_informant ->> 'notes', '')), 2000), ''),
        updated_at = now(), updated_by = (select auth.uid())
      where id = _id returning * into _row;
    exception when unique_violation then
      raise exception 'Ez a fedőnév már foglalt.' using errcode = '23505';
    end;
  else
    update public.informants set reliability = _reliability, status = _status,
      contact = nullif(left(btrim(coalesce(_informant ->> 'contact', '')), 200), ''), notes = nullif(left(btrim(coalesce(_informant ->> 'notes', '')), 2000), ''),
      updated_at = now(), updated_by = (select auth.uid())
    where id = _id returning * into _row;
  end if;
  return private.informant_json(_row);
end;
$$;

create or replace function public.add_informant_contact(_informant_id uuid, _contact jsonb)
returns json
language plpgsql
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _row public.informants%rowtype;
  _summary text := btrim(coalesce(_contact ->> 'summary', ''));
  _value text := coalesce(nullif(_contact ->> 'value', ''), 'medium');
  _case uuid := nullif(_contact ->> 'case_id', '')::uuid;
begin
  select * into _row from public.informants where id = _informant_id;
  if _row.id is null or not private.can_see_informant(_row.handler_id) then raise exception 'Az informátor nem található.' using errcode = 'P0002'; end if;
  if char_length(_summary) < 5 then raise exception 'Írd le röviden a találkozót (legalább 5 karakter).' using errcode = '22023'; end if;
  if _value not in ('none', 'low', 'medium', 'high') then raise exception 'Ismeretlen érték.' using errcode = '22023'; end if;
  if _case is not null and not private.can_view_case_details(_case) then raise exception 'Az akta nem található.' using errcode = 'P0002'; end if;
  insert into public.informant_contacts (informant_id, met_on, summary, value, case_id, payment, created_by)
  values (_informant_id, coalesce(nullif(_contact ->> 'met_on', '')::date, current_date), left(_summary, 1000), _value, _case,
          private.json_int(_contact -> 'payment', 0, 1000000000), (select auth.uid()));
  update public.informants set updated_at = now() where id = _informant_id returning * into _row;
  return private.informant_json(_row);
end;
$$;

create or replace function public.delete_informant(_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_mcb_lead() then raise exception 'Informátort az MCB vezetése törölhet.' using errcode = '42501'; end if;
  delete from public.informants where id = _id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Case page: tasks, items and related-case suggestions in the one detail call
-- ---------------------------------------------------------------------------

-- Other cases with the same person, a vehicle (plate) or an address of this case's people and
-- warrants, not referenced in the document yet (list rows; can_open says whether it opens).
create or replace function private.case_suggestions(_case public.cases)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select suspect_id from public.case_suspects where case_id = _case.id and suspect_id is not null
  ), plates as (
    select upper(btrim(v.plate_number)) as plate from public.suspect_vehicles v where v.suspect_id in (select suspect_id from mine)
  ), addresses as (
    select lower(btrim(sp.address)) as address from public.suspect_properties sp where sp.suspect_id in (select suspect_id from mine)
    union
    select lower(btrim(sp.address)) from public.case_warrants w join public.suspect_properties sp on sp.id = w.property_id where w.case_id = _case.id
  ), hits as (
    select cs.case_id, 'person'::text as kind, s.full_name as label
    from public.case_suspects cs join public.suspects s on s.id = cs.suspect_id
    where cs.suspect_id in (select suspect_id from mine) and cs.case_id <> _case.id
    union
    select cs.case_id, 'vehicle', upper(btrim(v.plate_number))
    from public.suspect_vehicles v join public.case_suspects cs on cs.suspect_id = v.suspect_id
    where upper(btrim(v.plate_number)) in (select plate from plates) and cs.case_id <> _case.id
      and v.suspect_id not in (select suspect_id from mine)
    union
    select cs.case_id, 'address', btrim(sp.address)
    from public.suspect_properties sp join public.case_suspects cs on cs.suspect_id = sp.suspect_id
    where lower(btrim(sp.address)) in (select address from addresses) and cs.case_id <> _case.id
      and sp.suspect_id not in (select suspect_id from mine)
    union
    select w.case_id, 'address', btrim(sp.address)
    from public.case_warrants w join public.suspect_properties sp on sp.id = w.property_id
    where lower(btrim(sp.address)) in (select address from addresses) and w.case_id <> _case.id
  ), grouped as (
    select h.case_id, json_agg(json_build_object('kind', h.kind, 'label', h.label) order by h.kind, h.label) as reasons, count(*) as weight
    from hits h group by h.case_id
  )
  select coalesce(json_agg(json_build_object(
    'id', c.id, 'case_number', c.case_number, 'title', c.title, 'status', c.status, 'reasons', g.reasons,
    'can_open', private.can_view_case_details(c.id)) order by g.weight desc, c.updated_at desc), '[]'::json)
  from (select * from grouped order by weight desc limit 6) g
  join public.cases c on c.id = g.case_id
  where position(c.id::text in coalesce(_case.body::text, '')) = 0
$$;

create or replace function public.get_case_detail(_case_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _uid uuid := (select auth.uid());
  _case public.cases%rowtype;
  _role text;
begin
  select * into _case from public.cases where id = _case_id;
  if _case.id is null or not (private.can_view_cases() or (private.is_member() and private.is_case_participant(_case_id))) then
    raise exception 'Az akta nem található.' using errcode = 'P0002';
  end if;
  if not private.can_view_case_details(_case_id) then
    raise exception 'Ezt az aktát csak a tulajdonosa, a közreműködői és az MCB vezetése nyithatja meg.' using errcode = '42501';
  end if;
  _role := case when _case.owner_id = _uid then 'owner'
                else (select role from public.case_collaborators where case_id = _case_id and user_id = _uid) end;

  return json_build_object(
    'case', json_build_object(
      'id', _case.id, 'case_number', _case.case_number, 'title', _case.title, 'description', _case.description,
      'status', _case.status, 'priority', _case.priority, 'category', _case.category, 'theme', coalesce(_case.theme, 'default'),
      'owner_id', _case.owner_id, 'created_at', _case.created_at, 'updated_at', _case.updated_at, 'closed_at', _case.closed_at,
      'body', _case.body, 'body_version', _case.body_version,
      'body_updated_by', _case.body_updated_by,
      'body_updated_by_name', (select full_name from public.profiles where id = _case.body_updated_by)),
    'owner', (select json_build_object('id', p.id, 'full_name', p.full_name, 'badge_number', p.badge_number,
                                       'faction_rank', p.faction_rank, 'division', p.division, 'division_rank', p.division_rank,
                                       'avatar_url', p.avatar_url)
              from public.profiles p where p.id = _case.owner_id),
    'collaborators', (
      select coalesce(json_agg(json_build_object('id', cc.id, 'case_id', cc.case_id, 'user_id', cc.user_id, 'role', cc.role,
                                                 'created_at', cc.created_at, 'profile', json_build_object(
                                                   'full_name', p.full_name, 'badge_number', p.badge_number,
                                                   'faction_rank', p.faction_rank, 'avatar_url', p.avatar_url))
                               order by cc.created_at), '[]'::json)
      from public.case_collaborators cc left join public.profiles p on p.id = cc.user_id
      where cc.case_id = _case_id and cc.user_id is distinct from _case.owner_id),
    'evidence', (
      select coalesce(json_agg(json_build_object('id', e.id, 'case_id', e.case_id, 'file_path', e.file_path,
                                                 'file_name', e.file_name, 'file_type', e.file_type, 'uploaded_by', e.uploaded_by,
                                                 'uploader_name', p.full_name, 'created_at', e.created_at)
                               order by e.created_at, e.id), '[]'::json)
      from public.case_evidence e left join public.profiles p on p.id = e.uploaded_by
      where e.case_id = _case_id),
    'people', (
      select coalesce(json_agg(json_build_object('id', cs.id, 'case_id', cs.case_id, 'suspect_id', cs.suspect_id,
                                                 'involvement_type', cs.involvement_type, 'notes', cs.notes, 'added_at', cs.added_at,
                                                 'suspect', to_json(s))
                               order by cs.added_at, cs.id), '[]'::json)
      from public.case_suspects cs join public.suspects s on s.id = cs.suspect_id
      where cs.case_id = _case_id),
    'warrants', (
      select coalesce(json_agg(private.warrant_json(w) order by w.created_at desc), '[]'::json)
      from public.case_warrants w where w.case_id = _case_id),
    'tasks', (
      select coalesce(json_agg(private.case_task_json(t) order by t.done_at is not null, t.due_on nulls last, t.created_at), '[]'::json)
      from public.case_tasks t where t.case_id = _case_id),
    'items', (
      select coalesce(json_agg(private.case_item_json(i) order by i.created_at), '[]'::json)
      from public.case_items i where i.case_id = _case_id),
    'suggestions', private.case_suggestions(_case),
    'viewer', json_build_object(
      'role', _role,
      'can_edit', private.can_edit_case(_case_id) and _case.status = 'open',
      'can_manage', private.can_manage_case(_case_id),
      'is_lead', private.is_mcb_lead(),
      'can_approve', private.can_approve_warrants())
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. The daily MCB job (cron): lapsed warrants, expiry reminders, overdue tasks, retention
-- ---------------------------------------------------------------------------

create or replace function public.mcb_daily()
returns json
language plpgsql
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _lapsed integer := 0;
  _reminded integer := 0;
  _digests integer := 0;
  _retention integer := 0;
  _w public.case_warrants%rowtype;
  _r record;
  _reminder_days integer := coalesce((select reminder_days from public.mcb_settings where id = 'global'), 2);
begin
  -- 1. Warrants past their validity lapse (the suspect's status follows in the existing trigger).
  with lapsed as (
    update public.case_warrants
    set status = 'expired', closed_at = now(), closed_by = null, closing_note = 'Lejárt: letelt az érvényességi idő.', updated_at = now()
    where status = 'approved' and expires_at is not null and expires_at <= now()
    returning 1)
  select count(*) into _lapsed from lapsed;

  -- 2. Reminders before a warrant lapses (once per validity period).
  if _reminder_days > 0 then
    for _w in
      select w.* from public.case_warrants w
      where w.status = 'approved' and w.expires_at is not null and w.expiry_reminded_at is null
        and w.expires_at <= now() + make_interval(days => _reminder_days)
    loop
      perform private.notify(array_remove(array[_w.requested_by, (select owner_id from public.cases where id = _w.case_id)], null),
        case _w.type when 'arrest' then 'Hamarosan lejár: elfogatóparancs' else 'Hamarosan lejár: házkutatási parancs' end,
        format('%s – %s. Ha még szükség van rá, kérj megújítást az aktában.',
               private.warrant_target(_w), to_char(_w.expires_at, 'YYYY.MM.DD. HH24:MI')),
        'warning', 'mcb', '/mcb/case/' || _w.case_id, 'warrant-expiry:' || _w.id);
      update public.case_warrants set expiry_reminded_at = now() where id = _w.id;
      _reminded := _reminded + 1;
    end loop;
  end if;

  -- 3. Overdue tasks: the assignee and the case owner, on the first overdue day and then weekly.
  for _r in
    select x.person, count(*) as tasks
    from (
      select t.id, t.assignee_id as person from public.case_tasks t join public.cases c on c.id = t.case_id
      where t.done_at is null and c.status = 'open' and t.due_on < current_date and t.assignee_id is not null
        and (t.digest_sent_on is null or t.digest_sent_on <= current_date - 7)
      union
      select t.id, c.owner_id from public.case_tasks t join public.cases c on c.id = t.case_id
      where t.done_at is null and c.status = 'open' and t.due_on < current_date and c.owner_id is not null
        and (t.digest_sent_on is null or t.digest_sent_on <= current_date - 7)
    ) x
    group by x.person
  loop
    _digests := _digests + private.notify(array[_r.person], 'Lejárt teendők',
      format('%s lejárt teendő vár rád vagy az aktáidban.', _r.tasks), 'warning', 'mcb', '/mcb', 'case-tasks-overdue');
  end loop;
  update public.case_tasks t set digest_sent_on = current_date
  from public.cases c
  where c.id = t.case_id and t.done_at is null and c.status = 'open' and t.due_on < current_date
    and (t.digest_sent_on is null or t.digest_sent_on <= current_date - 7);

  -- 4. Items kept past their retention date: the case owner, once.
  for _r in
    select c.owner_id as person, count(*) as items from public.case_items i join public.cases c on c.id = i.case_id
    where i.status in ('held', 'checked_out') and i.retain_until < current_date and i.retention_reminded_on is null and c.owner_id is not null
    group by c.owner_id
  loop
    _retention := _retention + private.notify(array[_r.person], 'Lejárt megőrzési idő',
      format('%s lefoglalt tárgy megőrzési ideje lejárt: döntsd el, visszaadod vagy megsemmisíted.', _r.items),
      'info', 'mcb', '/mcb', 'case-items-retention');
  end loop;
  update public.case_items set retention_reminded_on = current_date
  where status in ('held', 'checked_out') and retain_until < current_date and retention_reminded_on is null;

  return json_build_object('lapsed', _lapsed, 'reminded', _reminded, 'task_digests', _digests, 'retention', _retention);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Privileges
-- ---------------------------------------------------------------------------

revoke execute on function
  public.save_case_task(uuid, uuid, text, uuid, date), public.set_case_task_done(uuid, boolean), public.delete_case_task(uuid),
  public.get_my_case_tasks(), public.save_case_item(uuid, uuid, jsonb), public.record_case_item(uuid, text, text, uuid, text, text),
  public.delete_case_item(uuid), public.save_mcb_settings(integer, integer, integer), public.request_warrant_renewal(uuid, text),
  public.renew_warrant(uuid, text), public.get_informants(), public.save_informant(uuid, jsonb),
  public.add_informant_contact(uuid, jsonb), public.delete_informant(uuid), public.mcb_daily()
from public, anon, authenticated;
grant execute on function
  public.save_case_task(uuid, uuid, text, uuid, date), public.set_case_task_done(uuid, boolean), public.delete_case_task(uuid),
  public.get_my_case_tasks(), public.save_case_item(uuid, uuid, jsonb), public.record_case_item(uuid, text, text, uuid, text, text),
  public.delete_case_item(uuid), public.save_mcb_settings(integer, integer, integer), public.request_warrant_renewal(uuid, text),
  public.renew_warrant(uuid, text), public.get_informants(), public.save_informant(uuid, jsonb),
  public.add_informant_contact(uuid, jsonb), public.delete_informant(uuid)
to authenticated;
grant execute on function public.mcb_daily() to service_role;
