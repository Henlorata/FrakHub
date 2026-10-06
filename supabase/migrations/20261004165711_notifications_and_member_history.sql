-- Notification system redesign, member history and HR records.
--
-- Notifications are now created by the database itself (triggers on the tables whose
-- changes people care about), so every client and the API get them for free and no
-- browser can send messages in someone else's name. Each notification has a category
-- (members can mute categories), the acting member, and an optional dedupe key that
-- coalesces bursts (e.g. a busy case chat) into one unread item instead of dozens.

-- ---------------------------------------------------------------------------
-- 1. Notifications table
-- ---------------------------------------------------------------------------

update public.notifications set is_read = false where is_read is null;
update public.notifications set created_at = now() where created_at is null;
alter table public.notifications
  alter column is_read set not null,
  alter column created_at set not null,
  add column if not exists category text not null default 'system',
  add column if not exists actor_id uuid references public.profiles(id) on delete set null,
  add column if not exists dedupe_key text;

alter table public.notifications drop constraint if exists notifications_category_check;
alter table public.notifications add constraint notifications_category_check
  check (category in ('system', 'hr', 'mcb', 'logistics', 'finance', 'exam', 'academy', 'announcement'));

-- Categorize what the old system already sent.
update public.notifications set category = case
  when link = '/finance' or title ilike 'Pénzügy%' then 'finance'
  when link = '/logistics' or title ilike 'Jármű%' then 'logistics'
  when title ilike 'Akt%' then 'mcb'
  when title in ('Fiók Jóváhagyva', 'Rendfokozat Változás', 'Új Kitüntetés!', 'HR Frissítés', 'Adatlap frissítve') then 'hr'
  else 'system'
end;

create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications (user_id) where not is_read;
create unique index if not exists notifications_user_dedupe_idx
  on public.notifications (user_id, dedupe_key) where not is_read and dedupe_key is not null;

-- Per-member settings: muted categories ('system' cannot be muted).
create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  muted_categories text[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint notification_preferences_categories_check
    check (muted_categories <@ array['hr', 'mcb', 'logistics', 'finance', 'exam', 'academy', 'announcement']::text[])
);
alter table public.notification_preferences enable row level security;
create policy notification_preferences_select_own on public.notification_preferences for select to authenticated
  using (user_id = (select auth.uid()));
create policy notification_preferences_insert_own on public.notification_preferences for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_member()));
create policy notification_preferences_update_own on public.notification_preferences for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.notification_preferences from anon;

-- ---------------------------------------------------------------------------
-- 2. Notification helpers
-- ---------------------------------------------------------------------------

-- The member behind the current change: the signed-in user, or the actor the API
-- passes in (service-role requests carry no user).
create or replace function private.actor_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.uid()), nullif(current_setting('app.actor_id', true), '')::uuid)
$$;

-- Sends one notification to each recipient. Skips the actor (unless _include_actor),
-- pending accounts and muted categories; with a dedupe key an existing unread
-- notification of the recipient is refreshed instead of adding a new one.
create or replace function private.notify(
  _recipients uuid[],
  _title text,
  _message text,
  _type text default 'info',
  _category text default 'system',
  _link text default null,
  _dedupe_key text default null,
  _include_actor boolean default false,
  _hide_actor boolean default false
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  _actor uuid := private.actor_id();
  _count integer;
begin
  if _recipients is null or cardinality(_recipients) = 0 then return 0; end if;

  insert into public.notifications (user_id, title, message, type, category, link, actor_id, dedupe_key)
  select p.id, left(_title, 160), left(_message, 600), _type, _category, _link,
         case when _hide_actor then null else _actor end, _dedupe_key
  from public.profiles p
  where p.id = any(_recipients)
    and p.system_role <> 'pending'
    and (_include_actor or _actor is null or p.id <> _actor)
    and (_category = 'system' or not exists (
      select 1 from public.notification_preferences np
      where np.user_id = p.id and _category = any(np.muted_categories)))
  on conflict (user_id, dedupe_key) where (not is_read and dedupe_key is not null)
  do update set title = excluded.title, message = excluded.message, type = excluded.type,
                link = excluded.link, actor_id = excluded.actor_id, created_at = now();

  get diagnostics _count = row_count;
  return _count;
end;
$$;

create or replace function private.member_name(_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select full_name from public.profiles where id = _id), 'Ismeretlen')
$$;

-- Members by permission level, used to address notifications.
create or replace function private.staff_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(id), '{}') from public.profiles
  where system_role in ('admin', 'supervisor') or coalesce(is_bureau_manager, false)
$$;

create or replace function private.admin_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(id), '{}') from public.profiles
  where system_role = 'admin' or (coalesce(is_bureau_manager, false) and system_role <> 'pending')
$$;

create or replace function private.member_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(id), '{}') from public.profiles where system_role <> 'pending'
$$;

create or replace function private.warrant_approver_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(id), '{}') from public.profiles
  where system_role <> 'pending'
    and (system_role in ('admin', 'supervisor') or private.rank_index(faction_rank) <= 8
         or coalesce(is_bureau_manager, false)
         or (division = 'MCB' and division_rank = 'Investigator III.'))
$$;

-- Owner and collaborators of a case.
create or replace function private.case_participant_ids(_case_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct x.id) filter (where x.id is not null), '{}') from (
    select owner_id as id from public.cases where id = _case_id
    union all
    select user_id from public.case_collaborators where case_id = _case_id
  ) x
$$;

-- Members who may grade submissions of an exam (src/lib/utils.ts canGradeExam).
create or replace function private.exam_grader_ids(_exam_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(p.id), '{}')
  from public.profiles p
  join public.exams e on e.id = _exam_id
  where p.system_role <> 'pending'
    and (coalesce(p.is_bureau_manager, false)
         or (e.type in ('trainee', 'deputy_i')
             and ('TB' = any(coalesce(p.qualifications, '{}')) or private.rank_index(p.faction_rank) <= 8))
         or (coalesce(e.type, '') not in ('trainee', 'deputy_i')
             and ((e.division is not null and e.division = any(coalesce(p.commanded_divisions, '{}')))
                  or (coalesce(p.is_bureau_commander, false) and p.division = e.division))))
$$;

-- Whether the caller outranks a member (HR records: warnings, notes, leave decisions).
create or replace function private.outranks(_target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles me, public.profiles t
    where me.id = (select auth.uid()) and t.id = _target and me.system_role <> 'pending'
      and (coalesce(me.is_bureau_manager, false)
           or (not coalesce(t.is_bureau_manager, false)
               and (private.rank_index(me.faction_rank) <= 1
                    or private.rank_index(me.faction_rank) < private.rank_index(t.faction_rank))))
  )
$$;

-- ---------------------------------------------------------------------------
-- 3. Member history and HR records
-- ---------------------------------------------------------------------------

create table if not exists public.member_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in (
    'joined', 'rank', 'division', 'division_rank', 'qualifications', 'bureau_role',
    'name', 'badge', 'award', 'award_revoked')),
  from_value text,
  to_value text,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists member_events_user_idx on public.member_events (user_id, created_at desc);
create index if not exists member_events_created_idx on public.member_events (created_at desc);
alter table public.member_events enable row level security;
create policy member_events_select on public.member_events for select to authenticated
  using ((select private.is_member()) or user_id = (select auth.uid()));
revoke insert, update, delete on public.member_events from anon, authenticated;

-- History so far: joining dates, name changes and awards.
insert into public.member_events (user_id, kind, to_value, created_at)
select id, 'joined', faction_rank, created_at from public.profiles where system_role <> 'pending';
insert into public.member_events (user_id, actor_id, kind, from_value, to_value, created_at)
select user_id, changed_by, 'name', old_name, new_name, coalesce(changed_at, now())
from public.name_change_logs where user_id is not null;
insert into public.member_events (user_id, actor_id, kind, to_value, created_at)
select ur.user_id, ur.awarded_by, 'award', r.name, coalesce(ur.awarded_at, now())
from public.user_ribbons ur join public.ribbons r on r.id = ur.ribbon_id where ur.user_id is not null;

create table if not exists public.hr_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('warning', 'commendation', 'note', 'leave')),
  title text not null check (char_length(title) between 2 and 120),
  details text check (char_length(details) <= 2000),
  starts_on date,
  ends_on date,
  status text not null default 'active' check (status in ('pending', 'active', 'rejected', 'revoked')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  constraint hr_records_dates_check check (ends_on is null or starts_on is null or ends_on >= starts_on),
  constraint hr_records_leave_dates_check check (kind <> 'leave' or (starts_on is not null and ends_on is not null))
);
create index if not exists hr_records_user_idx on public.hr_records (user_id, created_at desc);
create index if not exists hr_records_open_idx on public.hr_records (kind, status) where status in ('pending', 'active');
alter table public.hr_records enable row level security;

-- Staff see everything (internal notes included); members see their own warnings,
-- commendations and leave requests.
create policy hr_records_select on public.hr_records for select to authenticated
  using ((select private.is_staff()) or (user_id = (select auth.uid()) and kind <> 'note'));
-- Staff record entries for lower ranks; members may request leave for themselves.
create policy hr_records_insert on public.hr_records for insert to authenticated
  with check (created_by = (select auth.uid()) and (
    ((select private.is_staff()) and user_id <> (select auth.uid()) and private.outranks(user_id) and status = 'active')
    or (user_id = (select auth.uid()) and kind = 'leave' and status = 'pending' and (select private.is_member()))));
create policy hr_records_update_staff on public.hr_records for update to authenticated
  using ((select private.is_staff()) and user_id <> (select auth.uid()) and private.outranks(user_id))
  with check ((select private.is_staff()) and user_id <> (select auth.uid()) and private.outranks(user_id));
create policy hr_records_delete on public.hr_records for delete to authenticated
  using ((user_id = (select auth.uid()) and kind = 'leave' and status = 'pending')
         or ((select private.is_admin()) and user_id <> (select auth.uid())));
revoke all on public.hr_records from anon;

-- ---------------------------------------------------------------------------
-- 4. Triggers that log history and send notifications
-- ---------------------------------------------------------------------------

-- Profiles: approval, rank, division, qualifications, bureau roles, name and badge.
create or replace function private.on_profile_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _actor uuid := private.actor_id();
  _added text[];
  _removed text[];
  _promotion boolean;
  _undo_event uuid;
  _parts text[] := '{}';
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

  if new.division_rank is distinct from old.division_rank then
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
$$;

create trigger on_profile_change after update on public.profiles
  for each row execute function private.on_profile_change();

-- New registrations wait for HR approval.
create or replace function private.on_profile_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.system_role = 'pending' then
    perform private.notify(private.staff_ids(), 'Új regisztráció',
      format('%s (#%s, %s) jóváhagyásra vár.', new.full_name, new.badge_number, new.faction_rank),
      'info', 'hr', '/hr?tab=pending', 'pending-registrations');
  end if;
  return new;
end;
$$;

create trigger on_profile_insert after insert on public.profiles
  for each row execute function private.on_profile_insert();

-- Awards.
create or replace function private.on_award_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _ribbon text;
begin
  if tg_op = 'INSERT' then
    select name into _ribbon from public.ribbons where id = new.ribbon_id;
    insert into public.member_events (user_id, actor_id, kind, to_value)
    values (new.user_id, coalesce(new.awarded_by, private.actor_id()), 'award', _ribbon);
    perform private.notify(array[new.user_id], 'Új kitüntetés',
      format('Gratulálunk! Kitüntetést kaptál: %s.', coalesce(_ribbon, 'ismeretlen')), 'success', 'hr', '/profile');
    return new;
  end if;
  select name into _ribbon from public.ribbons where id = old.ribbon_id;
  -- Skip when the member or the ribbon itself is being deleted.
  if exists (select 1 from public.profiles where id = old.user_id) and _ribbon is not null then
    insert into public.member_events (user_id, actor_id, kind, from_value)
    values (old.user_id, private.actor_id(), 'award_revoked', _ribbon);
    perform private.notify(array[old.user_id], 'Kitüntetés visszavonva',
      format('A(z) %s kitüntetésedet visszavonták.', _ribbon), 'warning', 'hr', '/profile');
  end if;
  return old;
end;
$$;

create trigger on_award_change after insert or delete on public.user_ribbons
  for each row execute function private.on_award_change();

-- HR records.
create or replace function private.on_hr_record_decided()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.decided_by := private.actor_id();
    new.decided_at := now();
  end if;
  return new;
end;
$$;

create trigger on_hr_record_decided before update on public.hr_records
  for each row execute function private.on_hr_record_decided();

create or replace function private.on_hr_record_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _period text;
begin
  if new.kind = 'leave' then
    _period := format('%s – %s', to_char(new.starts_on, 'YYYY.MM.DD.'), to_char(new.ends_on, 'YYYY.MM.DD.'));
  end if;

  if tg_op = 'INSERT' then
    case
      when new.kind = 'warning' then
        perform private.notify(array[new.user_id], 'Figyelmeztetés', new.title, 'warning', 'hr', '/profile');
      when new.kind = 'commendation' then
        perform private.notify(array[new.user_id], 'Dicséret', new.title, 'success', 'hr', '/profile');
      when new.kind = 'leave' and new.status = 'pending' then
        perform private.notify(private.staff_ids(), 'Új szabadságkérelem',
          format('%s: %s', private.member_name(new.user_id), _period), 'info', 'hr', '/hr?tab=requests', 'leave-requests');
      when new.kind = 'leave' then
        perform private.notify(array[new.user_id], 'Szabadság rögzítve', _period, 'info', 'hr', '/profile');
      else
        null;
    end case;
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.kind = 'leave' and old.status = 'pending' then
      perform private.notify(array[new.user_id],
        case when new.status = 'active' then 'Szabadság jóváhagyva' else 'Szabadság elutasítva' end,
        _period, case when new.status = 'active' then 'success' else 'alert' end, 'hr', '/profile');
    elsif new.kind = 'warning' and new.status = 'revoked' then
      perform private.notify(array[new.user_id], 'Figyelmeztetés visszavonva', new.title, 'info', 'hr', '/profile');
    end if;
  end if;
  return new;
end;
$$;

create trigger on_hr_record_change after insert or update on public.hr_records
  for each row execute function private.on_hr_record_change();

-- Cases: new owner, status changes.
create or replace function private.on_case_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id and new.owner_id is not null then
    perform private.notify(array[new.owner_id], 'Akta hozzád rendelve',
      format('%s – %s', new.case_number, new.title), 'info', 'mcb', '/mcb/case/' || new.id);
  end if;
  if new.status is distinct from old.status then
    perform private.notify(private.case_participant_ids(new.id),
      case new.status when 'closed' then 'Akta lezárva' when 'archived' then 'Akta archiválva' else 'Akta újranyitva' end,
      format('%s – %s', new.case_number, new.title), 'info', 'mcb', '/mcb/case/' || new.id);
  end if;
  return new;
end;
$$;

create trigger on_case_change after update of owner_id, status on public.cases
  for each row execute function private.on_case_change();

create or replace function private.on_case_collaborator_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _case public.cases%rowtype;
begin
  if tg_op = 'INSERT' then
    select * into _case from public.cases where id = new.case_id;
    if _case.id is not null then
      perform private.notify(array[new.user_id], 'Hozzáadtak egy aktához',
        format('%s – %s (%s)', _case.case_number, _case.title,
               case new.role when 'editor' then 'szerkesztő' else 'megtekintő' end),
        'info', 'mcb', '/mcb/case/' || _case.id);
    end if;
    return new;
  end if;
  select * into _case from public.cases where id = old.case_id;
  -- Nothing to say when the whole case is being deleted.
  if _case.id is not null then
    perform private.notify(array[old.user_id], 'Eltávolítottak egy aktából',
      format('%s – %s', _case.case_number, _case.title), 'warning', 'mcb', '/mcb');
  end if;
  return old;
end;
$$;

create trigger on_case_collaborator_change after insert or delete on public.case_collaborators
  for each row execute function private.on_case_collaborator_change();

create or replace function private.on_case_note_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _case public.cases%rowtype;
begin
  select * into _case from public.cases where id = new.case_id;
  if _case.id is null then return new; end if;
  perform private.notify(private.case_participant_ids(new.case_id),
    format('Új üzenet: %s', _case.case_number),
    format('%s: %s', private.member_name(new.user_id), left(new.content, 140)),
    'info', 'mcb', '/mcb/case/' || new.case_id, 'case-chat:' || new.case_id);
  return new;
end;
$$;

create trigger on_case_note_insert after insert on public.case_notes
  for each row execute function private.on_case_note_insert();

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
begin
  _kind := case new.type when 'arrest' then 'Elfogatóparancs' else 'Házkutatási parancs' end;
  select * into _case from public.cases where id = new.case_id;
  _target := coalesce(
    (select full_name from public.suspects where id = new.suspect_id),
    (select address from public.suspect_properties where id = new.property_id),
    new.target_name, 'ismeretlen');

  if tg_op = 'INSERT' then
    perform private.notify(private.warrant_approver_ids(), 'Jóváhagyásra váró parancs',
      format('%s: %s (%s)', _kind, _target, coalesce(_case.case_number, '')),
      'warning', 'mcb', '/mcb', 'warrants-pending');
    return new;
  end if;

  if new.status is distinct from old.status and new.status in ('approved', 'rejected', 'executed') then
    perform private.notify(array_remove(array[new.requested_by, _case.owner_id], null),
      case new.status when 'approved' then _kind || ' jóváhagyva'
                      when 'rejected' then _kind || ' elutasítva'
                      else _kind || ' végrehajtva' end,
      format('%s – %s', _target, coalesce(_case.case_number, '')),
      case new.status when 'approved' then 'success' when 'rejected' then 'alert' else 'info' end,
      'mcb', '/mcb/case/' || new.case_id);
  end if;
  return new;
end;
$$;

create trigger on_warrant_change after insert or update of status on public.case_warrants
  for each row execute function private.on_warrant_change();

-- Logistics and finance requests.
create or replace function private.on_vehicle_request_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.notify(private.staff_ids(), 'Új járműigénylés',
      format('%s: %s', private.member_name(new.user_id), new.vehicle_type), 'info', 'logistics', '/logistics',
      'vehicle-requests');
    return new;
  end if;
  if new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    perform private.notify(array[new.user_id],
      case when new.status = 'approved' then 'Járműigénylés elfogadva' else 'Járműigénylés elutasítva' end,
      case when new.status = 'approved'
        then format('%s – rendszám: %s', new.vehicle_type, coalesce(new.vehicle_plate, '-'))
        else format('%s – indoklás: %s', new.vehicle_type, coalesce(new.admin_comment, '-')) end,
      case when new.status = 'approved' then 'success' else 'alert' end, 'logistics', '/logistics');
  end if;
  return new;
end;
$$;

create trigger on_vehicle_request_change after insert or update of status on public.vehicle_requests
  for each row execute function private.on_vehicle_request_change();

create or replace function private.on_budget_request_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.notify(private.admin_ids(), 'Új költségtérítési kérelem',
      format('%s: %s $', private.member_name(new.user_id), to_char(new.amount, 'FM999G999G999')),
      'info', 'finance', '/finance', 'budget-requests');
    return new;
  end if;
  if new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    perform private.notify(array[new.user_id],
      case when new.status = 'approved' then 'Költségtérítés jóváhagyva' else 'Költségtérítés elutasítva' end,
      case when new.status = 'approved'
        then format('%s $ – %s', to_char(new.amount, 'FM999G999G999'), left(new.reason, 80))
        else format('Indoklás: %s', coalesce(new.admin_comment, '-')) end,
      case when new.status = 'approved' then 'success' else 'alert' end, 'finance', '/finance');
  end if;
  return new;
end;
$$;

create trigger on_budget_request_change after insert or update of status on public.budget_requests
  for each row execute function private.on_budget_request_change();

-- Exams: new sheets to grade, results, access grants.
create or replace function private.on_exam_submission_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _exam public.exams%rowtype;
  _percent integer;
begin
  select * into _exam from public.exams where id = new.exam_id;
  if _exam.id is null then return new; end if;

  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      perform private.notify(private.exam_grader_ids(new.exam_id), 'Javítandó vizsgalap',
        format('%s – %s', _exam.title, coalesce(nullif(new.applicant_name, ''), private.member_name(new.user_id))),
        'info', 'exam', '/exams?tab=grading', 'exam-grading:' || new.exam_id);
    end if;
    return new;
  end if;

  if old.status = 'pending' and new.status in ('passed', 'failed') and new.user_id is not null then
    _percent := case when coalesce(new.max_score, 0) > 0
                     then round(100.0 * coalesce(new.total_score, 0) / new.max_score) end;
    perform private.notify(array[new.user_id],
      format('Vizsgaeredmény: %s', _exam.title),
      case when new.status = 'passed' then 'Sikeres vizsga' else 'Sikertelen vizsga' end
        || coalesce(format(' (%s%%)', _percent), ''),
      case when new.status = 'passed' then 'success' else 'alert' end, 'exam', '/exams/grading/' || new.id);
  end if;
  return new;
end;
$$;

create trigger on_exam_submission_change after insert or update of status on public.exam_submissions
  for each row execute function private.on_exam_submission_change();

create or replace function private.on_exam_override_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.access_type = 'allow' then
    perform private.notify(array[new.user_id], 'Vizsgahozzáférés',
      format('Kitöltheted a(z) „%s” vizsgát.', (select title from public.exams where id = new.exam_id)),
      'info', 'exam', '/exams');
  end if;
  return new;
end;
$$;

create trigger on_exam_override_insert after insert on public.exam_overrides
  for each row execute function private.on_exam_override_insert();

-- Announcements go to everyone (the author stays hidden when show_author is off).
create or replace function private.on_announcement_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify(private.member_ids(),
    case new.type when 'alert' then 'Riasztás: ' || new.title when 'training' then 'Képzés: ' || new.title
                  else 'Hirdetmény: ' || new.title end,
    left(new.content, 200),
    case new.type when 'alert' then 'alert' else 'info' end, 'announcement', '/dashboard',
    null, false, not coalesce(new.show_author, true));
  return new;
end;
$$;

create trigger on_announcement_insert after insert on public.announcements
  for each row execute function private.on_announcement_insert();

create or replace function private.on_academy_student_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify(array[new.user_id], 'Akadémiai beosztás',
    'Beosztottak a következő akadémiai ciklusba. Kövesd a napi anyagokat az Akadémia oldalon.',
    'info', 'academy', '/academy');
  return new;
end;
$$;

create trigger on_academy_student_insert after insert on public.academy_students
  for each row execute function private.on_academy_student_insert();

create or replace function private.on_alert_level_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.alert_level is distinct from old.alert_level then
    perform private.notify(private.member_ids(), 'Készültségi szint változás',
      'Új készültségi szint: ' || case new.alert_level
        when 'traffic' then 'FOKOZOTT ELLENŐRZÉS' when 'border' then 'HATÁRZÁR'
        when 'tactical' then 'TAKTIKAI RIADÓ' else 'NORMÁL' end,
      case new.alert_level when 'normal' then 'info' when 'traffic' then 'warning' else 'alert' end,
      'system', '/dashboard', 'alert-level');
  end if;
  return new;
end;
$$;

create trigger on_alert_level_change after update of alert_level on public.system_status
  for each row execute function private.on_alert_level_change();

-- Leaving the MCB: one trigger reassigns the cases (reassign_cases_on_leave), the case
-- trigger above notifies the new owner. The duplicate transfer trigger is retired.
drop trigger if exists on_mcb_leave_transfer on public.profiles;
drop function if exists public.transfer_cases_on_leave();

-- ---------------------------------------------------------------------------
-- 5. Transitional: the deployed API still inserts its own notifications for
--    approvals and rank changes; drop those duplicates of the trigger ones.
--    Removed again in supabase/post-deploy/.
-- ---------------------------------------------------------------------------

create or replace function private.skip_legacy_duplicate_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.category = 'system' and new.title in ('Fiók Jóváhagyva', 'Rendfokozat Változás')
     and exists (select 1 from public.notifications n
                 where n.user_id = new.user_id and n.category = 'hr'
                   and n.created_at > now() - interval '2 minutes') then
    return null;
  end if;
  return new;
end;
$$;

create trigger skip_legacy_duplicate_notification before insert on public.notifications
  for each row execute function private.skip_legacy_duplicate_notification();

-- Least privilege: triggers and SECURITY DEFINER callers do not need EXECUTE, only the
-- helpers that appear in RLS policies (evaluated as the querying role) do.
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.rank_index(text), private.system_role_for_rank(text), private.me(),
  private.is_member(), private.is_staff(), private.is_admin(), private.is_executive_or_manager(),
  private.can_view_cases(), private.can_approve_warrants(), private.is_academy_instructor(),
  private.can_edit_case(uuid), private.is_case_participant(uuid),
  private.can_manage_exam_content(text, text), private.can_manage_exam_access(text, text),
  private.can_delete_exam(text), private.has_grading_rights(uuid), private.can_grade_submission(uuid),
  private.outranks(uuid)
to anon, authenticated;
grant execute on all functions in schema private to service_role;

alter publication supabase_realtime add table only public.hr_records;
