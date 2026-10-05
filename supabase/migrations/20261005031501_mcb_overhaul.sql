-- MCB (Major Crimes Bureau) rework.
--
-- * Who may open a case is enforced by the database (it was a browser-side rule): the owner,
--   the collaborators and the MCB leadership read the document, chat, evidence and warrants;
--   other members of the MCB area only see the case in the list.
-- * Writes follow the bureau's rules: documents are saved with a version check (two editors
--   can no longer overwrite each other unnoticed), the status is changed by the owner or the
--   MCB leadership (archiving by the leadership only), cases can be handed over, closed cases
--   are read-only, people and evidence are linked by the case's editors.
-- * Warrants go through decide_warrant(): decision time and note, execution by the case's
--   editors (only approvers could before, so "executed" failed for investigators), withdrawal
--   and revocation; nobody approves their own request.
-- * Case event log (case_events), written by triggers; existing cases get their history from
--   the stored timestamps.
-- * One-call reads for the bureau pages: case list with counts, case detail, suspect dossier,
--   leadership overview, and a search in the text of the case documents.
--
-- Compatible with the deployed frontend: its direct updates of cases and warrants keep working
-- until supabase/post-deploy/ removes them.

-- ---------------------------------------------------------------------------
-- 1. Permission helpers
-- ---------------------------------------------------------------------------

-- Members who may open every case (src/lib/mcb.ts seesAllCases): bureau manager, the MCB
-- bureau commander, Investigator III., high command and admins.
create or replace function private.sees_all_cases()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.system_role <> 'pending'
      and (coalesce(p.is_bureau_manager, false)
           or (p.division = 'MCB' and (coalesce(p.is_bureau_commander, false) or p.division_rank = 'Investigator III.'))
           or p.system_role = 'admin' or private.rank_index(p.faction_rank) <= 6)
  )
$$;

-- Document, chat, evidence, warrants and log of a case: participants and the members above.
create or replace function private.can_view_case_details(_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.sees_all_cases() or (private.is_member() and private.is_case_participant(_case_id))
$$;

-- MCB leadership: bureau manager or the MCB bureau commander.
create or replace function private.is_mcb_lead()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.system_role <> 'pending'
      and (coalesce(p.is_bureau_manager, false) or (p.division = 'MCB' and coalesce(p.is_bureau_commander, false)))
  )
$$;

-- Status, hand-over and people of a case: its owner or the MCB leadership.
create or replace function private.can_manage_case(_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_mcb_lead() or (private.is_member()
    and exists (select 1 from public.cases c where c.id = _case_id and c.owner_id = (select auth.uid())))
$$;

-- Content of an open case (people, evidence, warrant requests): owner and editors.
create or replace function private.can_write_case(_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_edit_case(_case_id)
     and exists (select 1 from public.cases c where c.id = _case_id and c.status = 'open')
$$;

-- Bureau overview page: MCB leadership, Investigator III. and the staff (as the old admin page).
create or replace function private.can_view_mcb_overview()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.system_role <> 'pending'
      and (p.system_role in ('admin', 'supervisor') or coalesce(p.is_bureau_manager, false)
           or (p.division = 'MCB' and (coalesce(p.is_bureau_commander, false) or p.division_rank = 'Investigator III.')))
  )
$$;

-- Plain text of a BlockNote document: text, mention labels and image/evidence captions.
create or replace function private.case_plain_text(_body jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(string_agg(x.t, ' '), '') from (
    select case n->>'type'
             when 'text' then n->>'text'
             when 'mention' then n->'props'->>'user'
             when 'evidence' then nullif(n->'props'->>'caption', '')
             when 'image' then nullif(n->'props'->>'caption', '')
           end as t
    from jsonb_path_query(coalesce(_body, '[]'::jsonb), 'lax $.**') n
    where jsonb_typeof(n) = 'object'
  ) x
  where x.t is not null
$$;

-- Members @mentioned in a case document.
create or replace function private.case_officer_mentions(_body jsonb)
returns uuid[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(distinct (n->'props'->>'id')::uuid), '{}')
  from jsonb_path_query(coalesce(_body, '[]'::jsonb), 'lax $.** ? (@.type == "mention" && @.props.role == "officer")') n
  where (n->'props'->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
$$;

-- ---------------------------------------------------------------------------
-- 2. Columns, indexes
-- ---------------------------------------------------------------------------

alter table public.cases
  add column if not exists category text,
  add column if not exists body_version integer not null default 0,
  add column if not exists body_updated_by uuid references public.profiles(id) on delete set null,
  add column if not exists closed_at timestamptz;
alter table public.cases add constraint cases_category_check check (category is null or category in (
  'homicide', 'assault', 'robbery', 'vehicle', 'drugs', 'weapons', 'organized', 'fraud', 'corruption', 'kidnapping', 'other'));
alter table public.cases add constraint cases_theme_check
  check (theme is null or theme in ('default', 'paper', 'classic', 'terminal', 'amber', 'blue')) not valid;

-- Closed before this migration: the last change is the best known closing time.
update public.cases set closed_at = coalesce(updated_at, created_at) where status <> 'open' and closed_at is null;

alter table public.case_warrants
  add column if not exists decided_at timestamptz,
  add column if not exists decision_note text check (decision_note is null or char_length(decision_note) <= 500),
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid references public.profiles(id) on delete set null,
  add column if not exists closing_note text check (closing_note is null or char_length(closing_note) <= 500);

-- An arrest warrant marks its person wanted once (when approved); executing it puts the
-- person in jail and a revoked or expired one sets them free again, unless another approved
-- arrest warrant is still out. Replaced before the backfill below (the old version fired on
-- every update and would have marked people wanted again).
create or replace function public.update_suspect_on_warrant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type <> 'arrest' or new.suspect_id is null or new.status is not distinct from old.status then
    return new;
  end if;
  if new.status = 'approved' then
    update public.suspects set status = 'wanted', updated_at = now()
    where id = new.suspect_id and status not in ('wanted', 'deceased');
  elsif old.status = 'approved' and new.status in ('executed', 'expired')
        and not exists (select 1 from public.case_warrants w
                        where w.suspect_id = new.suspect_id and w.type = 'arrest' and w.status = 'approved' and w.id <> new.id) then
    update public.suspects set status = case when new.status = 'executed' then 'jailed' else 'free' end, updated_at = now()
    where id = new.suspect_id and status = 'wanted';
  end if;
  return new;
end;
$$;

update public.case_warrants set decided_at = updated_at
where status in ('approved', 'rejected', 'expired') and decided_at is null;
update public.case_warrants set closed_at = updated_at where status = 'executed' and closed_at is null;

create index if not exists cases_owner_idx on public.cases (owner_id, status);
create index if not exists case_collaborators_user_idx on public.case_collaborators (user_id);
create index if not exists case_evidence_case_idx on public.case_evidence (case_id, created_at);
create index if not exists case_notes_case_idx on public.case_notes (case_id, created_at desc);
create index if not exists case_suspects_suspect_idx on public.case_suspects (suspect_id);
create index if not exists case_warrants_case_idx on public.case_warrants (case_id, created_at desc);
create index if not exists case_warrants_open_idx on public.case_warrants (status) where status in ('pending', 'approved');
create index if not exists case_warrants_suspect_idx on public.case_warrants (suspect_id) where suspect_id is not null;
create index if not exists suspect_vehicles_suspect_idx on public.suspect_vehicles (suspect_id);
create index if not exists suspect_properties_suspect_idx on public.suspect_properties (suspect_id);
create index if not exists suspect_associates_associate_idx on public.suspect_associates (associate_id);

-- ---------------------------------------------------------------------------
-- 3. Case event log
-- ---------------------------------------------------------------------------

create table public.case_events (
  id bigint generated always as identity primary key,
  case_id uuid not null references public.cases(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in (
    'created', 'status', 'priority', 'title', 'category', 'owner', 'document',
    'collaborator_added', 'collaborator_removed', 'collaborator_role',
    'evidence_added', 'evidence_renamed', 'evidence_removed',
    'person_linked', 'person_updated', 'person_unlinked',
    'warrant_requested', 'warrant_status')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index case_events_case_idx on public.case_events (case_id, created_at desc);
create index case_events_actor_idx on public.case_events (actor_id, created_at desc) where actor_id is not null;

alter table public.case_events enable row level security;
create policy case_events_select on public.case_events for select to authenticated
  using (private.can_view_case_details(case_id));
revoke all on public.case_events from anon;
revoke insert, update, delete, truncate, references, trigger on public.case_events from authenticated;
grant select on public.case_events to authenticated;

-- History of the existing cases from their stored timestamps (marked as reconstructed).
insert into public.case_events (case_id, actor_id, kind, details, created_at)
select c.id, p.id, 'created', jsonb_build_object('title', c.title, 'priority', c.priority, 'backfilled', true), coalesce(c.created_at, now())
from public.cases c left join public.profiles p on p.id = c.owner_id;

insert into public.case_events (case_id, actor_id, kind, details, created_at)
select cc.case_id, null, 'collaborator_added',
       jsonb_build_object('user_id', cc.user_id, 'name', p.full_name, 'role', cc.role, 'backfilled', true), coalesce(cc.created_at, now())
from public.case_collaborators cc left join public.profiles p on p.id = cc.user_id
where cc.case_id is not null;

insert into public.case_events (case_id, actor_id, kind, details, created_at)
select e.case_id, p.id, 'evidence_added',
       jsonb_build_object('evidence_id', e.id, 'name', e.file_name, 'type', e.file_type, 'backfilled', true), coalesce(e.created_at, now())
from public.case_evidence e left join public.profiles p on p.id = e.uploaded_by
where e.case_id is not null;

insert into public.case_events (case_id, actor_id, kind, details, created_at)
select cs.case_id, null, 'person_linked',
       jsonb_build_object('suspect_id', cs.suspect_id, 'name', s.full_name, 'role', cs.involvement_type, 'backfilled', true),
       coalesce(cs.added_at, now())
from public.case_suspects cs left join public.suspects s on s.id = cs.suspect_id
where cs.case_id is not null;

insert into public.case_events (case_id, actor_id, kind, details, created_at)
select w.case_id, p.id, 'warrant_requested',
       jsonb_build_object('warrant_id', w.id, 'type', w.type,
                          'target', coalesce(s.full_name, sp.address, w.target_name, 'ismeretlen'), 'backfilled', true),
       coalesce(w.created_at, now())
from public.case_warrants w
left join public.profiles p on p.id = w.requested_by
left join public.suspects s on s.id = w.suspect_id
left join public.suspect_properties sp on sp.id = w.property_id
where w.case_id is not null;

insert into public.case_events (case_id, actor_id, kind, details, created_at)
select w.case_id, case when w.status = 'executed' then null else p.id end, 'warrant_status',
       jsonb_build_object('warrant_id', w.id, 'type', w.type, 'status', w.status,
                          'target', coalesce(s.full_name, sp.address, w.target_name, 'ismeretlen'), 'backfilled', true),
       coalesce(w.updated_at, w.created_at, now())
from public.case_warrants w
left join public.profiles p on p.id = w.approved_by
left join public.suspects s on s.id = w.suspect_id
left join public.suspect_properties sp on sp.id = w.property_id
where w.case_id is not null and w.status <> 'pending';

insert into public.case_events (case_id, actor_id, kind, details, created_at)
select c.id, null, 'status', jsonb_build_object('from', 'open', 'to', c.status, 'backfilled', true), c.closed_at
from public.cases c where c.status <> 'open' and c.closed_at is not null;

-- The actor of an event, if it is a member (null for the server and the cron).
create or replace function private.case_actor()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$ select p.id from public.profiles p where p.id = private.actor_id() $$;

create or replace function private.log_case_event(_case_id uuid, _kind text, _details jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Rows removed together with their case leave no trace.
  if _case_id is null or not exists (select 1 from public.cases where id = _case_id) then return; end if;
  insert into public.case_events (case_id, actor_id, kind, details)
  values (_case_id, private.case_actor(), _kind, coalesce(_details, '{}'::jsonb));
end;
$$;

-- Document version, last editor, closing time and "last activity" of a case.
create or replace function private.on_case_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.body is distinct from old.body then
    new.body_version := coalesce(old.body_version, 0) + 1;
    new.body_updated_by := coalesce(private.case_actor(), old.body_updated_by);
  end if;
  if new.status is distinct from old.status then
    new.closed_at := case when new.status = 'open' then null else coalesce(old.closed_at, now()) end;
  end if;
  if (new.body, new.title, new.description, new.priority, new.category, new.status, new.owner_id)
     is distinct from (old.body, old.title, old.description, old.priority, old.category, old.status, old.owner_id) then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger before_case_update before update on public.cases
  for each row execute function private.on_case_write();

create or replace function private.on_case_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _last public.case_events%rowtype;
begin
  if tg_op = 'INSERT' then
    perform private.log_case_event(new.id, 'created', jsonb_build_object('title', new.title, 'priority', new.priority));
    return new;
  end if;
  if new.status is distinct from old.status then
    perform private.log_case_event(new.id, 'status', jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  if new.priority is distinct from old.priority then
    perform private.log_case_event(new.id, 'priority', jsonb_build_object('from', old.priority, 'to', new.priority));
  end if;
  if new.title is distinct from old.title then
    perform private.log_case_event(new.id, 'title', jsonb_build_object('from', old.title, 'to', new.title));
  end if;
  if new.category is distinct from old.category then
    perform private.log_case_event(new.id, 'category', jsonb_build_object('from', old.category, 'to', new.category));
  end if;
  if new.owner_id is distinct from old.owner_id then
    perform private.log_case_event(new.id, 'owner', jsonb_build_object(
      'from', old.owner_id, 'from_name', case when old.owner_id is null then null else private.member_name(old.owner_id) end,
      'to', new.owner_id, 'to_name', case when new.owner_id is null then null else private.member_name(new.owner_id) end));
  end if;
  if new.body is distinct from old.body then
    -- One entry per editor and half hour, however often they save.
    select * into _last from public.case_events e where e.case_id = new.id order by e.created_at desc, e.id desc limit 1;
    if _last.kind = 'document' and _last.actor_id is not distinct from private.case_actor()
       and _last.created_at > now() - interval '30 minutes' then
      update public.case_events
      set created_at = now(),
          details = jsonb_build_object('version', new.body_version, 'saves', coalesce((_last.details->>'saves')::int, 1) + 1)
      where id = _last.id;
    else
      perform private.log_case_event(new.id, 'document', jsonb_build_object('version', new.body_version, 'saves', 1));
    end if;
  end if;
  return new;
end;
$$;

create trigger on_case_event after insert or update on public.cases
  for each row execute function private.on_case_event();

create or replace function private.on_case_collaborator_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A hand-over is logged once, as the change of owner.
  if coalesce(current_setting('app.case_handover', true), '') = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'INSERT' then
    perform private.log_case_event(new.case_id, 'collaborator_added',
      jsonb_build_object('user_id', new.user_id, 'name', private.member_name(new.user_id), 'role', new.role));
    return new;
  elsif tg_op = 'UPDATE' then
    if new.role is distinct from old.role then
      perform private.log_case_event(new.case_id, 'collaborator_role',
        jsonb_build_object('user_id', new.user_id, 'name', private.member_name(new.user_id), 'role', new.role));
    end if;
    return new;
  end if;
  perform private.log_case_event(old.case_id, 'collaborator_removed',
    jsonb_build_object('user_id', old.user_id, 'name', private.member_name(old.user_id)));
  return old;
end;
$$;

create trigger on_case_collaborator_event after insert or update of role or delete on public.case_collaborators
  for each row execute function private.on_case_collaborator_event();

create or replace function private.on_case_evidence_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.log_case_event(new.case_id, 'evidence_added',
      jsonb_build_object('evidence_id', new.id, 'name', new.file_name, 'type', new.file_type));
    return new;
  elsif tg_op = 'UPDATE' then
    if new.file_name is distinct from old.file_name then
      perform private.log_case_event(new.case_id, 'evidence_renamed',
        jsonb_build_object('evidence_id', new.id, 'from', old.file_name, 'to', new.file_name));
    end if;
    return new;
  end if;
  perform private.log_case_event(old.case_id, 'evidence_removed', jsonb_build_object('evidence_id', old.id, 'name', old.file_name));
  return old;
end;
$$;

create trigger on_case_evidence_event after insert or update of file_name or delete on public.case_evidence
  for each row execute function private.on_case_evidence_event();

create or replace function private.on_case_person_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.log_case_event(new.case_id, 'person_linked', jsonb_build_object('suspect_id', new.suspect_id,
      'name', (select full_name from public.suspects where id = new.suspect_id), 'role', new.involvement_type));
    return new;
  elsif tg_op = 'UPDATE' then
    if new.involvement_type is distinct from old.involvement_type then
      perform private.log_case_event(new.case_id, 'person_updated', jsonb_build_object('suspect_id', new.suspect_id,
        'name', (select full_name from public.suspects where id = new.suspect_id), 'from', old.involvement_type, 'role', new.involvement_type));
    end if;
    return new;
  end if;
  perform private.log_case_event(old.case_id, 'person_unlinked', jsonb_build_object('suspect_id', old.suspect_id,
    'name', (select full_name from public.suspects where id = old.suspect_id)));
  return old;
end;
$$;

create trigger on_case_person_event after insert or update of involvement_type or delete on public.case_suspects
  for each row execute function private.on_case_person_event();

create or replace function private.warrant_target(_w public.case_warrants)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select full_name from public.suspects where id = _w.suspect_id),
                  (select address from public.suspect_properties where id = _w.property_id),
                  _w.target_name, 'ismeretlen')
$$;

create or replace function private.on_case_warrant_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.log_case_event(new.case_id, 'warrant_requested',
      jsonb_build_object('warrant_id', new.id, 'type', new.type, 'target', private.warrant_target(new)));
  elsif new.status is distinct from old.status then
    perform private.log_case_event(new.case_id, 'warrant_status', jsonb_build_object('warrant_id', new.id, 'type', new.type,
      'status', new.status, 'target', private.warrant_target(new), 'note', coalesce(new.closing_note, new.decision_note)));
  end if;
  return new;
end;
$$;

create trigger on_case_warrant_event after insert or update of status on public.case_warrants
  for each row execute function private.on_case_warrant_event();

-- Notifications: a revoked warrant is announced as well; the hand-over of a case removes the
-- new owner's collaborator row without the "removed from a case" message.
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
                      else _kind || ' visszavonva' end,
      format('%s – %s', _target, coalesce(_case.case_number, '')),
      case new.status when 'approved' then 'success' when 'rejected' then 'alert' when 'expired' then 'warning' else 'info' end,
      'mcb', '/mcb/case/' || new.case_id);
  end if;
  return new;
end;
$$;

create or replace function private.on_case_collaborator_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _case public.cases%rowtype;
begin
  if coalesce(current_setting('app.case_handover', true), '') = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
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

-- ---------------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------------

-- Chat: participants and leadership read it; anyone of them may write while the case is open.
drop policy if exists case_notes_select on public.case_notes;
create policy case_notes_select on public.case_notes for select to authenticated
  using (private.can_view_case_details(case_id));
drop policy if exists case_notes_insert on public.case_notes;
create policy case_notes_insert on public.case_notes for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_view_case_details(case_id)
              and exists (select 1 from public.cases c where c.id = case_id and c.status = 'open'));

-- Evidence: read with the case, added and renamed by its editors while it is open.
drop policy if exists case_evidence_select on public.case_evidence;
create policy case_evidence_select on public.case_evidence for select to authenticated
  using (private.can_view_case_details(case_id));
drop policy if exists case_evidence_insert on public.case_evidence;
create policy case_evidence_insert on public.case_evidence for insert to authenticated
  with check (private.can_write_case(case_id) and coalesce(uploaded_by, (select auth.uid())) = (select auth.uid()));
drop policy if exists case_evidence_update on public.case_evidence;
create policy case_evidence_update on public.case_evidence for update to authenticated
  using (private.can_write_case(case_id)) with check (private.can_write_case(case_id));
drop policy if exists case_evidence_delete on public.case_evidence;
create policy case_evidence_delete on public.case_evidence for delete to authenticated
  using (private.can_view_case_details(case_id)
         and (uploaded_by = (select auth.uid()) or private.can_edit_case(case_id) or (select private.is_staff())));
revoke update on public.case_evidence from anon, authenticated;
grant update (file_name) on public.case_evidence to authenticated;

-- People of a case: linked, re-classified and removed by its editors while it is open. The
-- links stay visible in the list area (the suspect database shows them).
drop policy if exists case_suspects_insert on public.case_suspects;
create policy case_suspects_insert on public.case_suspects for insert to authenticated
  with check (private.can_write_case(case_id));
drop policy if exists case_suspects_update on public.case_suspects;
create policy case_suspects_update on public.case_suspects for update to authenticated
  using (private.can_write_case(case_id)) with check (private.can_write_case(case_id));
drop policy if exists case_suspects_delete on public.case_suspects;
create policy case_suspects_delete on public.case_suspects for delete to authenticated
  using (private.can_write_case(case_id));
revoke update on public.case_suspects from anon, authenticated;
grant update (involvement_type, notes) on public.case_suspects to authenticated;

-- Warrants: read with the case and by the approvers (their queue); requested by the editors.
drop policy if exists case_warrants_select on public.case_warrants;
create policy case_warrants_select on public.case_warrants for select to authenticated
  using (private.can_view_case_details(case_id) or (select private.can_approve_warrants()));
drop policy if exists case_warrants_insert on public.case_warrants;
create policy case_warrants_insert on public.case_warrants for insert to authenticated
  with check (private.can_write_case(case_id) and requested_by = (select auth.uid())
              and coalesce(status, 'pending') = 'pending' and approved_by is null
              and decided_at is null and closed_at is null and closed_by is null);

-- Collaborators: the owner and the leadership manage them; anyone may leave a case.
drop policy if exists case_collaborators_insert on public.case_collaborators;
create policy case_collaborators_insert on public.case_collaborators for insert to authenticated
  with check (private.can_manage_case(case_id)
              and not exists (select 1 from public.cases c where c.id = case_id and c.owner_id = user_id));
drop policy if exists case_collaborators_update on public.case_collaborators;
create policy case_collaborators_update on public.case_collaborators for update to authenticated
  using (private.can_manage_case(case_id)) with check (private.can_manage_case(case_id));
drop policy if exists case_collaborators_delete on public.case_collaborators;
create policy case_collaborators_delete on public.case_collaborators for delete to authenticated
  using (private.can_manage_case(case_id) or (user_id = (select auth.uid()) and (select private.is_member())));
revoke update on public.case_collaborators from anon, authenticated;
grant update (role) on public.case_collaborators to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Reads
-- ---------------------------------------------------------------------------

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

-- The case list of the MCB area: list fields only (never the document) with counts.
create or replace function public.get_case_list(_include_archived boolean default false)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _uid uuid := (select auth.uid());
  _all boolean := private.can_view_cases();
  _sees_all boolean := private.sees_all_cases();
begin
  if not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  return (
    select coalesce(json_agg(json_build_object(
      'id', c.id, 'case_number', c.case_number, 'title', c.title, 'description', left(c.description, 300),
      'status', c.status, 'priority', c.priority, 'category', c.category,
      'created_at', c.created_at, 'updated_at', c.updated_at, 'closed_at', c.closed_at,
      'owner_id', c.owner_id, 'owner_name', o.full_name, 'owner_badge', o.badge_number, 'owner_avatar', o.avatar_url,
      'evidence', (select count(*) from public.case_evidence e where e.case_id = c.id),
      'people', (select count(*) from public.case_suspects s where s.case_id = c.id),
      'collaborators', (select count(*) from public.case_collaborators cc where cc.case_id = c.id),
      'warrants_pending', (select count(*) from public.case_warrants w where w.case_id = c.id and w.status = 'pending'),
      'warrants_active', (select count(*) from public.case_warrants w where w.case_id = c.id and w.status = 'approved'),
      'my_role', m.role,
      'can_open', _sees_all or m.role is not null
    ) order by c.updated_at desc nulls last), '[]'::json)
    from public.cases c
    left join public.profiles o on o.id = c.owner_id
    left join lateral (
      select case when c.owner_id = _uid then 'owner'
                  else (select cc.role from public.case_collaborators cc where cc.case_id = c.id and cc.user_id = _uid) end as role
    ) m on true
    where (_all or m.role is not null) and (_include_archived or c.status <> 'archived')
  );
end;
$$;

-- Everything the case page shows, in one call (the chat and the log load on their own).
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
    'viewer', json_build_object(
      'role', _role,
      'can_edit', private.can_edit_case(_case_id) and _case.status = 'open',
      'can_manage', private.can_manage_case(_case_id),
      'is_lead', private.is_mcb_lead(),
      'can_approve', private.can_approve_warrants())
  );
end;
$$;

-- Search in titles, numbers, summaries and (for the cases the caller may open) the documents.
create or replace function public.search_cases(_query text)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _uid uuid := (select auth.uid());
  _q text := btrim(coalesce(_query, ''));
  _pattern text;
  _all boolean := private.can_view_cases();
  _sees_all boolean := private.sees_all_cases();
begin
  if not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  if char_length(_q) < 3 then return '[]'::json; end if;
  _pattern := '%' || replace(replace(replace(left(_q, 80), '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return (
    select coalesce(json_agg(json_build_object(
      'id', x.id, 'case_number', x.case_number, 'title', x.title, 'status', x.status, 'priority', x.priority,
      'owner_name', x.owner_name, 'updated_at', x.updated_at, 'match', x.match, 'can_open', x.can_open,
      'snippet', case when x.match = 'body'
                      then substr(x.txt, greatest(1, strpos(lower(x.txt), lower(_q)) - 70), 190) end
    ) order by x.match = 'body', x.updated_at desc), '[]'::json)
    from (
      select v.*, case when v.title ilike _pattern or v.case_number ilike _pattern or coalesce(v.description, '') ilike _pattern
                       then 'title' else 'body' end as match
      from (
        select c.id, c.case_number, c.title, c.description, c.status, c.priority, c.updated_at, o.full_name as owner_name,
               (_sees_all or c.owner_id = _uid
                or exists (select 1 from public.case_collaborators cc where cc.case_id = c.id and cc.user_id = _uid)) as can_open,
               private.case_plain_text(c.body) as txt
        from public.cases c left join public.profiles o on o.id = c.owner_id
        where _all or c.owner_id = _uid
              or exists (select 1 from public.case_collaborators cc where cc.case_id = c.id and cc.user_id = _uid)
      ) v
      where v.title ilike _pattern or v.case_number ilike _pattern or coalesce(v.description, '') ilike _pattern
            or (v.can_open and v.txt ilike _pattern)
      order by v.updated_at desc
      limit 25
    ) x
  );
end;
$$;

-- A person's file: vehicles, properties, connections (both directions), cases and warrants.
create or replace function public.get_suspect_dossier(_suspect_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _uid uuid := (select auth.uid());
  _s public.suspects%rowtype;
  _all boolean := private.can_view_cases();
  _sees_all boolean := private.sees_all_cases();
  _approver boolean := private.can_approve_warrants();
begin
  if not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  select * into _s from public.suspects where id = _suspect_id;
  if _s.id is null then raise exception 'A személy nem található.' using errcode = 'P0002'; end if;

  return json_build_object(
    'suspect', to_json(_s),
    'creator_name', (select full_name from public.profiles where id = _s.created_by),
    'vehicles', (select coalesce(json_agg(to_json(v) order by v.created_at), '[]'::json)
                 from public.suspect_vehicles v where v.suspect_id = _suspect_id),
    'properties', (select coalesce(json_agg(to_json(p) order by p.created_at), '[]'::json)
                   from public.suspect_properties p where p.suspect_id = _suspect_id),
    'associates', (
      select coalesce(json_agg(json_build_object('id', a.id, 'other_id', a.associate_id, 'relationship', a.relationship,
                                                 'notes', a.notes, 'created_at', a.created_at, 'direction', 'out',
                                                 'person', json_build_object('id', s.id, 'full_name', s.full_name, 'alias', s.alias,
                                                                             'mugshot_url', s.mugshot_url, 'status', s.status))
                               order by a.created_at), '[]'::json)
      from public.suspect_associates a join public.suspects s on s.id = a.associate_id
      where a.suspect_id = _suspect_id),
    'linked_by', (
      select coalesce(json_agg(json_build_object('id', a.id, 'other_id', a.suspect_id, 'relationship', a.relationship,
                                                 'notes', a.notes, 'created_at', a.created_at, 'direction', 'in',
                                                 'person', json_build_object('id', s.id, 'full_name', s.full_name, 'alias', s.alias,
                                                                             'mugshot_url', s.mugshot_url, 'status', s.status))
                               order by a.created_at), '[]'::json)
      from public.suspect_associates a join public.suspects s on s.id = a.suspect_id
      where a.associate_id = _suspect_id),
    'cases', (
      select coalesce(json_agg(json_build_object('link_id', cs.id, 'case_id', c.id, 'case_number', c.case_number, 'title', c.title,
                                                 'status', c.status, 'priority', c.priority, 'involvement_type', cs.involvement_type,
                                                 'notes', cs.notes, 'added_at', cs.added_at,
                                                 'can_open', _sees_all or c.owner_id = _uid
                                                   or exists (select 1 from public.case_collaborators cc
                                                              where cc.case_id = c.id and cc.user_id = _uid))
                               order by cs.added_at desc), '[]'::json)
      from public.case_suspects cs join public.cases c on c.id = cs.case_id
      where cs.suspect_id = _suspect_id
        and (_all or c.owner_id = _uid or exists (select 1 from public.case_collaborators cc where cc.case_id = c.id and cc.user_id = _uid))),
    'warrants', (
      select coalesce(json_agg(private.warrant_json(w) order by w.created_at desc), '[]'::json)
      from public.case_warrants w
      where (w.suspect_id = _suspect_id
             or w.property_id in (select p.id from public.suspect_properties p where p.suspect_id = _suspect_id))
        and (_approver or private.can_view_case_details(w.case_id)))
  );
end;
$$;

-- Leadership page: roster with workload, bureau figures, unattended cases, latest events.
create or replace function public.get_mcb_overview()
returns json
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
begin
  if not private.can_view_mcb_overview() then
    raise exception 'Az iroda áttekintése az MCB vezetésének érhető el.' using errcode = '42501';
  end if;

  return json_build_object(
    'viewer', json_build_object('is_lead', private.is_mcb_lead()),
    'totals', (
      select json_build_object(
        'open', count(*) filter (where c.status = 'open'),
        'closed', count(*) filter (where c.status = 'closed'),
        'archived', count(*) filter (where c.status = 'archived'),
        'critical', count(*) filter (where c.status = 'open' and c.priority = 'critical'),
        'opened_30d', count(*) filter (where c.created_at > now() - interval '30 days'),
        'closed_30d', count(*) filter (where c.status <> 'open' and c.closed_at > now() - interval '30 days'),
        'avg_close_days', round((avg(extract(epoch from (c.closed_at - c.created_at)) / 86400)
                                 filter (where c.status <> 'open' and c.closed_at > now() - interval '180 days'))::numeric, 1),
        'warrants_pending', (select count(*) from public.case_warrants w where w.status = 'pending'),
        'warrants_active', (select count(*) from public.case_warrants w where w.status = 'approved'),
        'wanted', (select count(*) from public.suspects s where s.status = 'wanted'),
        'suspects', (select count(*) from public.suspects))
      from public.cases c),
    'monthly', (
      select coalesce(json_agg(json_build_object(
        'month', to_char(m.month, 'YYYY-MM'),
        'opened', (select count(*) from public.cases c
                   where c.created_at >= m.month and c.created_at < m.month + interval '1 month'),
        'closed', (select count(*) from public.cases c
                   where c.status <> 'open' and c.closed_at >= m.month and c.closed_at < m.month + interval '1 month'))
        order by m.month), '[]'::json)
      from generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') as m(month)),
    'categories', (
      select coalesce(json_agg(json_build_object('category', x.category, 'open', x.open, 'total', x.total) order by x.total desc), '[]'::json)
      from (select coalesce(c.category, 'none') as category, count(*) filter (where c.status = 'open') as open, count(*) as total
            from public.cases c group by coalesce(c.category, 'none')) x),
    'members', (
      select coalesce(json_agg(json_build_object(
        'id', p.id, 'full_name', p.full_name, 'badge_number', p.badge_number, 'faction_rank', p.faction_rank,
        'division', p.division, 'division_rank', p.division_rank, 'avatar_url', p.avatar_url, 'system_role', p.system_role,
        'is_bureau_commander', coalesce(p.is_bureau_commander, false), 'is_bureau_manager', coalesce(p.is_bureau_manager, false),
        'open_owned', (select count(*) from public.cases c where c.owner_id = p.id and c.status = 'open'),
        'critical_owned', (select count(*) from public.cases c where c.owner_id = p.id and c.status = 'open' and c.priority in ('high', 'critical')),
        'closed_owned', (select count(*) from public.cases c where c.owner_id = p.id and c.status <> 'open'),
        'closed_90d', (select count(*) from public.cases c where c.owner_id = p.id and c.status <> 'open' and c.closed_at > now() - interval '90 days'),
        'collaborations', (select count(*) from public.case_collaborators cc join public.cases c on c.id = cc.case_id
                           where cc.user_id = p.id and c.status = 'open'),
        'evidence_30d', (select count(*) from public.case_evidence e where e.uploaded_by = p.id and e.created_at > now() - interval '30 days'),
        'last_activity', (select max(e.created_at) from public.case_events e where e.actor_id = p.id))
        order by p.full_name), '[]'::json)
      from public.profiles p
      where p.system_role <> 'pending'
        and (p.division = 'MCB' or exists (select 1 from public.cases c where c.owner_id = p.id and c.status = 'open'))),
    'unattended', (
      select coalesce(json_agg(json_build_object(
        'id', c.id, 'case_number', c.case_number, 'title', c.title, 'priority', c.priority, 'updated_at', c.updated_at,
        'owner_id', c.owner_id, 'owner_name', p.full_name, 'owner_division', p.division,
        'reason', case when p.id is null then 'no_owner' when p.system_role = 'pending' then 'pending'
                       when p.division is distinct from 'MCB' and not coalesce(p.is_bureau_manager, false) then 'left' else 'stale' end)
        order by c.updated_at), '[]'::json)
      from public.cases c left join public.profiles p on p.id = c.owner_id
      where c.status = 'open'
        and (p.id is null or p.system_role = 'pending'
             or (p.division is distinct from 'MCB' and not coalesce(p.is_bureau_manager, false))
             or c.updated_at < now() - interval '30 days')),
    'recent', (
      select coalesce(json_agg(json_build_object('id', x.id, 'case_id', x.case_id, 'case_number', x.case_number, 'title', x.title,
                                                 'kind', x.kind, 'details', x.details, 'created_at', x.created_at,
                                                 'actor_name', x.actor_name) order by x.created_at desc), '[]'::json)
      from (select e.id, e.case_id, c.case_number, c.title, e.kind, e.details, e.created_at, p.full_name as actor_name
            from public.case_events e join public.cases c on c.id = e.case_id left join public.profiles p on p.id = e.actor_id
            where coalesce((e.details->>'backfilled')::boolean, false) = false
            order by e.created_at desc limit 25) x)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Writes
-- ---------------------------------------------------------------------------

-- Saves the document if nobody saved since `_base_version`; otherwise reports the conflict.
-- Newly @mentioned members are notified (once per mention, never the author).
create or replace function public.save_case_document(_case_id uuid, _body jsonb, _base_version integer)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _case public.cases%rowtype;
  _version integer;
  _updated timestamptz;
  _fresh uuid[];
begin
  if _body is null or jsonb_typeof(_body) <> 'array' then
    raise exception 'Érvénytelen dokumentum.' using errcode = '22023';
  end if;
  if octet_length(_body::text) > 2000000 then
    raise exception 'Az akta dokumentuma túl nagy (legfeljebb 2 MB). A képeket bizonyítékként csatold.' using errcode = '22023';
  end if;
  if position('"data:image/' in _body::text) > 0 then
    raise exception 'A beillesztett képeket mentés előtt fel kell tölteni.' using errcode = '22023';
  end if;

  select * into _case from public.cases where id = _case_id for update;
  if _case.id is null then raise exception 'Az akta nem található.' using errcode = 'P0002'; end if;
  if not private.can_edit_case(_case_id) then
    raise exception 'Ehhez az aktához nincs szerkesztési jogod.' using errcode = '42501';
  end if;
  if _case.status <> 'open' then raise exception 'Lezárt akta nem szerkeszthető.' using errcode = '22023'; end if;

  if _case.body_version <> coalesce(_base_version, -1) then
    return json_build_object('ok', false, 'conflict', true, 'version', _case.body_version, 'updated_at', _case.updated_at,
                             'updated_by_name', (select full_name from public.profiles where id = _case.body_updated_by));
  end if;

  update public.cases set body = _body where id = _case_id returning body_version, updated_at into _version, _updated;

  select coalesce(array_agg(m), '{}') into _fresh
  from unnest(private.case_officer_mentions(_body)) m
  where m <> all(private.case_officer_mentions(_case.body)) and m <> (select auth.uid());
  if cardinality(_fresh) > 0 then
    perform private.notify(
      (select coalesce(array_agg(p.id), '{}') from public.profiles p
       where p.id = any(_fresh[1:50]) and p.system_role <> 'pending'
         and (p.division = 'MCB' or p.system_role in ('admin', 'supervisor') or coalesce(p.is_bureau_manager, false)
              or p.id = _case.owner_id
              or exists (select 1 from public.case_collaborators cc where cc.case_id = _case_id and cc.user_id = p.id))),
      'Megemlítettek egy aktában',
      format('%s – %s (%s)', _case.case_number, _case.title, private.member_name((select auth.uid()))),
      'info', 'mcb', '/mcb/case/' || _case_id, 'case-mention:' || _case_id);
  end if;

  return json_build_object('ok', true, 'version', _version, 'updated_at', _updated);
end;
$$;

-- Title, summary, priority, category and look of an open case (owner and editors).
create or replace function public.update_case(_case_id uuid, _changes jsonb)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _case public.cases%rowtype;
  _title text;
  _description text;
  _priority text;
  _category text;
  _theme text;
begin
  select * into _case from public.cases where id = _case_id for update;
  if _case.id is null then raise exception 'Az akta nem található.' using errcode = 'P0002'; end if;
  if not private.can_edit_case(_case_id) then
    raise exception 'Az akta adatait a tulajdonos és a szerkesztők módosíthatják.' using errcode = '42501';
  end if;
  if _case.status <> 'open' then raise exception 'Lezárt akta nem módosítható.' using errcode = '22023'; end if;
  _changes := coalesce(_changes, '{}'::jsonb);

  _title := case when _changes ? 'title' then btrim(_changes->>'title') else _case.title end;
  if _title is null or char_length(_title) not between 1 and 160 then
    raise exception 'Az akta címe 1–160 karakter lehet.' using errcode = '22023';
  end if;
  _description := case when _changes ? 'description' then nullif(btrim(_changes->>'description'), '') else _case.description end;
  if char_length(_description) > 2000 then
    raise exception 'Az összefoglaló legfeljebb 2000 karakter lehet.' using errcode = '22023';
  end if;
  _priority := case when _changes ? 'priority' then _changes->>'priority' else _case.priority end;
  if _priority is null or _priority not in ('low', 'medium', 'high', 'critical') then
    raise exception 'Ismeretlen prioritás.' using errcode = '22023';
  end if;
  _category := case when _changes ? 'category' then nullif(_changes->>'category', '') else _case.category end;
  if _category is not null and _category not in ('homicide', 'assault', 'robbery', 'vehicle', 'drugs', 'weapons', 'organized',
                                                 'fraud', 'corruption', 'kidnapping', 'other') then
    raise exception 'Ismeretlen ügytípus.' using errcode = '22023';
  end if;
  _theme := case when _changes ? 'theme' then _changes->>'theme' else coalesce(_case.theme, 'default') end;
  if _theme is null or _theme not in ('default', 'paper', 'classic', 'terminal', 'amber', 'blue') then
    raise exception 'Ismeretlen megjelenés.' using errcode = '22023';
  end if;

  update public.cases
  set title = _title, description = _description, priority = _priority, category = _category, theme = _theme
  where id = _case_id;

  return (select json_build_object('title', c.title, 'description', c.description, 'priority', c.priority,
                                   'category', c.category, 'theme', c.theme, 'updated_at', c.updated_at)
          from public.cases c where c.id = _case_id);
end;
$$;

-- Open/close (owner or leadership), archive and restore (leadership). Closing a case ends its
-- warrant requests that nobody decided yet.
create or replace function public.set_case_status(_case_id uuid, _status text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _case public.cases%rowtype;
  _expired integer := 0;
begin
  if _status is null or _status not in ('open', 'closed', 'archived') then
    raise exception 'Ismeretlen státusz.' using errcode = '22023';
  end if;
  select * into _case from public.cases where id = _case_id for update;
  if _case.id is null then raise exception 'Az akta nem található.' using errcode = 'P0002'; end if;
  if _case.status = _status then
    return json_build_object('status', _case.status, 'closed_at', _case.closed_at, 'expired_warrants', 0);
  end if;

  if _status = 'archived' or _case.status = 'archived' then
    if not private.is_mcb_lead() then
      raise exception 'Archiválni és visszaállítani csak az MCB vezetése tud.' using errcode = '42501';
    end if;
    if _status = 'archived' and _case.status = 'open' then
      raise exception 'Archiválás előtt zárd le az aktát.' using errcode = '22023';
    end if;
  elsif not private.can_manage_case(_case_id) then
    raise exception 'Az akta státuszát a tulajdonos vagy az MCB vezetése módosíthatja.' using errcode = '42501';
  end if;

  if _status <> 'open' then
    with ended as (
      update public.case_warrants
      set status = 'expired', closed_at = now(), closed_by = private.case_actor(), updated_at = now(),
          closing_note = 'Az akta lezárásakor megszűnt.'
      where case_id = _case_id and status = 'pending'
      returning 1)
    select count(*) into _expired from ended;
  end if;

  update public.cases set status = _status where id = _case_id;
  return (select json_build_object('status', c.status, 'closed_at', c.closed_at, 'updated_at', c.updated_at,
                                   'expired_warrants', _expired)
          from public.cases c where c.id = _case_id);
end;
$$;

-- Hands a case to another member; the previous owner stays on it as an editor.
create or replace function public.transfer_case(_case_id uuid, _new_owner uuid, _keep_previous boolean default true)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _case public.cases%rowtype;
  _target public.profiles%rowtype;
begin
  select * into _case from public.cases where id = _case_id for update;
  if _case.id is null then raise exception 'Az akta nem található.' using errcode = 'P0002'; end if;
  if not private.can_manage_case(_case_id) then
    raise exception 'Aktát a tulajdonosa vagy az MCB vezetése adhat át.' using errcode = '42501';
  end if;
  select * into _target from public.profiles where id = _new_owner and system_role <> 'pending';
  if _target.id is null then raise exception 'A kiválasztott tag nem található.' using errcode = 'P0002'; end if;
  if not (_target.division = 'MCB' or coalesce(_target.is_bureau_manager, false)
          or _target.system_role in ('admin', 'supervisor') or private.rank_index(_target.faction_rank) <= 6) then
    raise exception 'Aktát csak MCB-tagnak vagy a vezetésnek lehet átadni.' using errcode = '22023';
  end if;
  if _target.id = _case.owner_id then
    return json_build_object('owner_id', _case.owner_id);
  end if;

  perform set_config('app.case_handover', 'on', true);
  delete from public.case_collaborators where case_id = _case_id and user_id = _target.id;
  perform set_config('app.case_handover', '', true);

  update public.cases set owner_id = _target.id where id = _case_id;
  if coalesce(_keep_previous, true) and _case.owner_id is not null then
    insert into public.case_collaborators (case_id, user_id, role) values (_case_id, _case.owner_id, 'editor')
    on conflict (case_id, user_id) do update set role = 'editor';
  end if;
  return json_build_object('owner_id', _target.id, 'owner_name', _target.full_name);
end;
$$;

-- Warrant decisions: approve/reject (approvers, never their own request), execute (the case's
-- editors or approvers), withdraw a request (requester or case manager) or revoke an approved
-- warrant (approvers or case manager).
create or replace function public.decide_warrant(_warrant_id uuid, _status text, _note text default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := (select auth.uid());
  _w public.case_warrants%rowtype;
  _note_text text := nullif(btrim(coalesce(_note, '')), '');
begin
  if char_length(_note_text) > 500 then
    raise exception 'A megjegyzés legfeljebb 500 karakter lehet.' using errcode = '22023';
  end if;
  select * into _w from public.case_warrants where id = _warrant_id for update;
  if _w.id is null then raise exception 'A parancs nem található.' using errcode = 'P0002'; end if;

  if _status in ('approved', 'rejected') then
    if not private.can_approve_warrants() then
      raise exception 'Parancsot a felügyelő állomány és az Investigator III. bírálhat el.' using errcode = '42501';
    end if;
    if _w.status <> 'pending' then raise exception 'Ezt a kérelmet már elbírálták.' using errcode = '22023'; end if;
    if _w.requested_by = _uid then
      raise exception 'Saját kérelmet nem bírálhatsz el.' using errcode = '42501';
    end if;
    update public.case_warrants
    set status = _status, approved_by = _uid, decided_at = now(), decision_note = _note_text, updated_at = now()
    where id = _warrant_id;
  elsif _status = 'executed' then
    if _w.status <> 'approved' then raise exception 'Csak jóváhagyott parancs hajtható végre.' using errcode = '22023'; end if;
    if not (private.can_edit_case(_w.case_id) or private.can_approve_warrants()) then
      raise exception 'A végrehajtást az akta szerkesztői rögzítik.' using errcode = '42501';
    end if;
    update public.case_warrants
    set status = 'executed', closed_at = now(), closed_by = _uid, closing_note = _note_text, updated_at = now()
    where id = _warrant_id;
  elsif _status = 'expired' then
    if _w.status = 'pending' then
      if not (_w.requested_by = _uid or private.can_manage_case(_w.case_id)) then
        raise exception 'A kérelmet a kérelmező vagy az akta tulajdonosa vonhatja vissza.' using errcode = '42501';
      end if;
    elsif _w.status = 'approved' then
      if not (private.can_approve_warrants() or private.can_manage_case(_w.case_id)) then
        raise exception 'Jóváhagyott parancsot a jóváhagyók vagy az akta tulajdonosa vonhat vissza.' using errcode = '42501';
      end if;
    else
      raise exception 'Ez a parancs már lezárult.' using errcode = '22023';
    end if;
    update public.case_warrants
    set status = 'expired', closed_at = now(), closed_by = _uid, closing_note = _note_text, updated_at = now()
    where id = _warrant_id;
  else
    raise exception 'Ismeretlen művelet.' using errcode = '22023';
  end if;

  return (select private.warrant_json(w) from public.case_warrants w where w.id = _warrant_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Privileges
-- ---------------------------------------------------------------------------

revoke execute on function
  public.get_case_list(boolean), public.get_case_detail(uuid), public.search_cases(text), public.get_suspect_dossier(uuid),
  public.get_mcb_overview(), public.save_case_document(uuid, jsonb, integer), public.update_case(uuid, jsonb),
  public.set_case_status(uuid, text), public.transfer_case(uuid, uuid, boolean), public.decide_warrant(uuid, text, text)
from public, anon, authenticated;
grant execute on function
  public.get_case_list(boolean), public.get_case_detail(uuid), public.search_cases(text), public.get_suspect_dossier(uuid),
  public.get_mcb_overview(), public.save_case_document(uuid, jsonb, integer), public.update_case(uuid, jsonb),
  public.set_case_status(uuid, text), public.transfer_case(uuid, uuid, boolean), public.decide_warrant(uuid, text, text)
to authenticated;

-- Writers of the event log are only called by the triggers above.
revoke execute on function private.log_case_event(uuid, text, jsonb), private.case_actor() from public, anon, authenticated;
