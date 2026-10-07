-- MCB cases go to a trash first: for 30 days they can be restored, then the daily job deletes them
-- for good (with their files). A trashed case behaves as if it were deleted: it leaves every list,
-- search, count, the graph and the warrant lists, and nobody can open or change it.

alter table public.cases
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;
create index if not exists cases_deleted_at_idx on public.cases (deleted_at) where deleted_at is not null;

-- The case log records the trash too.
alter table public.case_events drop constraint if exists case_events_kind_check;
alter table public.case_events add constraint case_events_kind_check check (kind in (
  'created', 'status', 'priority', 'title', 'category', 'owner', 'document',
  'collaborator_added', 'collaborator_removed', 'collaborator_role',
  'evidence_added', 'evidence_renamed', 'evidence_removed',
  'person_linked', 'person_updated', 'person_unlinked',
  'warrant_requested', 'warrant_status', 'warrant_renewal_requested', 'warrant_renewed',
  'task_added', 'task_done', 'task_reopened', 'task_removed',
  'item_added', 'item_custody', 'item_removed',
  'trashed', 'restored'));

-- The live cases, for the functions that list or count them. Recreate it (create or replace view)
-- when a column is added to public.cases and a function reads that column through the view.
create or replace view private.live_cases as
  select * from public.cases where deleted_at is null;
revoke all on private.live_cases from public, anon, authenticated;

create or replace function private.case_alive(_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.cases c where c.id = _case_id and c.deleted_at is null)
$$;
revoke execute on function private.case_alive(uuid) from public, anon;
grant execute on function private.case_alive(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- The permission helpers treat a trashed case as gone.
-- ---------------------------------------------------------------------------------------------

create or replace function private.user_can_open_case(_case_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.case_alive(_case_id) and exists (
    select 1 from public.profiles p
    where p.id = _user_id and p.system_role <> 'pending'
      and (coalesce(p.is_bureau_manager, false)
           or (p.division = 'MCB' and (coalesce(p.is_bureau_commander, false) or private.has_privileged_division_rank(p.division, p.division_rank)))
           or p.system_role = 'admin' or private.rank_index(p.faction_rank) <= 6
           or exists (select 1 from public.cases c where c.id = _case_id and c.owner_id = _user_id)
           or exists (select 1 from public.case_collaborators cc where cc.case_id = _case_id and cc.user_id = _user_id))
  )
$$;

create or replace function private.is_case_participant(_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.case_alive(_case_id)
     and (exists (select 1 from public.cases c where c.id = _case_id and c.owner_id = (select auth.uid()))
          or exists (select 1 from public.case_collaborators cc
                     where cc.case_id = _case_id and cc.user_id = (select auth.uid())))
$$;

create or replace function private.can_edit_case(_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cases c
    where c.id = _case_id and c.deleted_at is null
      and (c.owner_id = (select auth.uid())
           or exists (select 1 from public.case_collaborators cc
                      where cc.case_id = c.id and cc.user_id = (select auth.uid()) and cc.role = 'editor'))
  ) and private.is_member()
$$;

create or replace function private.can_manage_case(_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.case_alive(_case_id) and (private.is_mcb_lead() or (private.is_member()
    and exists (select 1 from public.cases c where c.id = _case_id and c.owner_id = (select auth.uid()))))
$$;

create or replace function private.can_view_case_details(_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.case_alive(_case_id)
     and (private.sees_all_cases() or (private.is_member() and private.is_case_participant(_case_id)))
$$;

-- Who puts a case into the trash, restores it or deletes it for good: its owner and the MCB's
-- leadership (the Bureau Manager and the MCB's Bureau Commander), as before for the deletion.
create or replace function private.can_trash_case(_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_member() and (private.is_mcb_lead()
    or exists (select 1 from public.cases c where c.id = _case_id and c.owner_id = (select auth.uid())))
$$;
revoke execute on function private.can_trash_case(uuid) from public, anon, authenticated;

-- Direct reads of the tables (the deployed pages and the warrant list) skip trashed cases too.
alter policy cases_select on public.cases
  using (deleted_at is null and ((select private.can_view_cases()) or private.is_case_participant(id)));
alter policy case_warrants_select on public.case_warrants
  using (private.can_view_case_details(case_id) or ((select private.can_approve_warrants()) and private.case_alive(case_id)));

-- The cached suspect list shows case numbers: a case going in or out of the trash refreshes it.
drop trigger if exists cache_version on public.cases;
create trigger cache_version
  after insert or delete or update of title, case_number, deleted_at on public.cases
  for each statement execute function private.bump_cache_version('suspects');

-- ---------------------------------------------------------------------------------------------
-- Lists, counts, searches and the graph leave trashed cases out. The functions are patched in
-- place (their latest definitions, whatever line endings they were created with).
-- ---------------------------------------------------------------------------------------------

create function pg_temp.patch_function(_fn regprocedure, _done text, variadic _pairs text[])
returns void
language plpgsql
as $f$
declare
  _def text := replace(pg_get_functiondef(_fn), chr(13), '');
  _i integer;
begin
  if _done is not null and position(_done in _def) > 0 then return; end if;
  for _i in 1 .. coalesce(array_length(_pairs, 1), 0) / 2 loop
    if position(_pairs[_i * 2 - 1] in _def) = 0 then
      raise exception '%: anchor not found: %', _fn, left(_pairs[_i * 2 - 1], 160);
    end if;
    _def := replace(_def, _pairs[_i * 2 - 1], _pairs[_i * 2]);
  end loop;
  execute _def;
end;
$f$;

select pg_temp.patch_function('public.get_case_list(boolean)', 'private.live_cases',
  $a$    from public.cases c
    left join public.profiles o on o.id = c.owner_id$a$,
  $b$    from private.live_cases c
    left join public.profiles o on o.id = c.owner_id$b$);

select pg_temp.patch_function('public.get_case_detail(uuid)', '_case.deleted_at',
  $a$if _case.id is null or not ($a$,
  $b$if _case.id is null or _case.deleted_at is not null or not ($b$);

select pg_temp.patch_function('public.search_cases(text)', 'private.live_cases',
  $a$from public.cases c left join public.profiles o on o.id = c.owner_id$a$,
  $b$from private.live_cases c left join public.profiles o on o.id = c.owner_id$b$);

select pg_temp.patch_function('private.case_suggestions(public.cases)', 'private.live_cases',
  $a$from grouped g join public.cases c on c.id = g.case_id$a$,
  $b$from grouped g join private.live_cases c on c.id = g.case_id$b$);

select pg_temp.patch_function('public.get_mcb_overview()', 'private.live_cases',
  $a$from public.cases c$a$, $b$from private.live_cases c$b$,
  $a$join public.cases c on c.id = cc.case_id$a$, $b$join private.live_cases c on c.id = cc.case_id$b$,
  $a$join public.cases c on c.id = e.case_id$a$, $b$join private.live_cases c on c.id = e.case_id$b$,
  $a$(select count(*) from public.case_warrants w where w.status = 'pending')$a$,
  $b$(select count(*) from public.case_warrants w where w.status = 'pending' and private.case_alive(w.case_id))$b$,
  $a$(select count(*) from public.case_warrants w where w.status = 'approved')$a$,
  $b$(select count(*) from public.case_warrants w where w.status = 'approved' and private.case_alive(w.case_id))$b$);

select pg_temp.patch_function('public.get_dashboard_summary()', 'private.live_cases',
  $a$(select count(*) from case_warrants where status = 'pending' or (status = 'approved' and renewal_requested_at is not null))$a$,
  $b$(select count(*) from case_warrants where (status = 'pending' or (status = 'approved' and renewal_requested_at is not null))
                                           and private.case_alive(case_id))$b$,
  $a$(select count(*) from cases c where c.status = 'open'$a$,
  $b$(select count(*) from private.live_cases c where c.status = 'open'$b$,
  $a$from case_tasks t join cases c on c.id = t.case_id$a$,
  $b$from case_tasks t join private.live_cases c on c.id = t.case_id$b$);

select pg_temp.patch_function('public.get_organization(uuid)', 'private.live_cases',
  $a$        join public.cases c on c.id = cs.case_id
        where m.organization_id = _o.id$a$,
  $b$        join private.live_cases c on c.id = cs.case_id
        where m.organization_id = _o.id$b$,
  $a$where m.organization_id = _o.id and w.status in ('pending', 'approved')), '[]'::json));$a$,
  $b$where m.organization_id = _o.id and w.status in ('pending', 'approved') and private.case_alive(w.case_id)), '[]'::json));$b$);

select pg_temp.patch_function('public.get_organizations()', 'private.live_cases',
  $a$join public.cases c on c.id = cs.case_id$a$, $b$join private.live_cases c on c.id = cs.case_id$b$,
  $a$and w.type = 'arrest' and w.status = 'approved' and (w.expires_at is null or w.expires_at > now())),$a$,
  $b$and w.type = 'arrest' and w.status = 'approved' and (w.expires_at is null or w.expires_at > now())
                       and private.case_alive(w.case_id)),$b$);

select pg_temp.patch_function('public.get_suspect_dossier(uuid)', 'private.live_cases',
  $a$from public.case_suspects cs join public.cases c on c.id = cs.case_id$a$,
  $b$from public.case_suspects cs join private.live_cases c on c.id = cs.case_id$b$,
  $a$and (_approver or private.can_view_case_details(w.case_id)))$a$,
  $b$and private.case_alive(w.case_id) and (_approver or private.can_view_case_details(w.case_id)))$b$);

select pg_temp.patch_function('public.get_briefing()', 'private.case_alive',
  $a$where w.type = 'arrest' and w.status = 'approved' and (w.expires_at is null or w.expires_at > now())), '[]'::json),$a$,
  $b$where w.type = 'arrest' and w.status = 'approved' and (w.expires_at is null or w.expires_at > now())
                         and private.case_alive(w.case_id)), '[]'::json),$b$);

select pg_temp.patch_function('public.mcb_daily()', 'private.live_cases',
  $a$      where w.status = 'approved' and w.expires_at is not null and w.expiry_reminded_at is null$a$,
  $b$      where w.status = 'approved' and w.expires_at is not null and w.expiry_reminded_at is null and private.case_alive(w.case_id)$b$,
  $a$join public.cases c on c.id = t.case_id$a$, $b$join private.live_cases c on c.id = t.case_id$b$,
  $a$  from public.cases c
  where c.id = t.case_id$a$,
  $b$  from private.live_cases c
  where c.id = t.case_id$b$,
  $a$from public.case_items i join public.cases c on c.id = i.case_id$a$,
  $b$from public.case_items i join private.live_cases c on c.id = i.case_id$b$);

select pg_temp.patch_function('public.get_department_stats(integer)', 'private.live_cases',
  $a$from public.cases c where$a$, $b$from private.live_cases c where$b$,
  $a$from public.case_warrants w where w.decided_at >= _from and$a$,
  $b$from public.case_warrants w where private.case_alive(w.case_id) and w.decided_at >= _from and$b$,
  $a$from public.case_warrants w where w.decided_at >= _prev and$a$,
  $b$from public.case_warrants w where private.case_alive(w.case_id) and w.decided_at >= _prev and$b$);

select pg_temp.patch_function('public.get_public_site()', 'private.live_cases',
  $a$(select count(*) from public.cases where status in ('closed', 'archived')$a$,
  $b$(select count(*) from private.live_cases where status in ('closed', 'archived')$b$);

select pg_temp.patch_function('private.graph_neighbors(text)', 'private.case_alive',
  $a$  where cs.case_id is not null
$a$,
  $b$  where cs.case_id is not null and private.case_alive(cs.case_id)
$b$,
  $a$  where cs.suspect_id is not null
$a$,
  $b$  where cs.suspect_id is not null and private.case_alive(cs.case_id)
$b$);

select pg_temp.patch_function('private.graph_node(text)', 'private.live_cases',
  $a$from public.cases c where c.id = private.try_uuid(_ref))$a$,
  $b$from private.live_cases c where c.id = private.try_uuid(_ref))$b$);

select pg_temp.patch_function('public.search_graph_nodes(text)', 'private.live_cases',
  $a$from public.cases c where c.case_number ilike _like or c.title ilike _like$a$,
  $b$from private.live_cases c where c.case_number ilike _like or c.title ilike _like$b$);

select pg_temp.patch_function('private.bolo_json(public.bolo_alerts)', 'private.live_cases',
  $a$from public.cases c where c.id = _b.case_id) end,$a$,
  $b$from private.live_cases c where c.id = _b.case_id) end,$b$);

select pg_temp.patch_function('private.informant_json(public.informants)', 'private.live_cases',
  $a$from public.cases cs where cs.id = c.case_id))$a$,
  $b$from private.live_cases cs where cs.id = c.case_id))$b$);

select pg_temp.patch_function('public.decide_warrant(uuid, text, text)', 'private.case_alive',
  $a$if _w.id is null then raise exception 'A parancs nem található.' using errcode = 'P0002'; end if;$a$,
  $b$if _w.id is null then raise exception 'A parancs nem található.' using errcode = 'P0002'; end if;
  if not private.case_alive(_w.case_id) then raise exception 'Az akta a lomtárban van.' using errcode = '22023'; end if;$b$);

select pg_temp.patch_function('public.renew_warrant(uuid, text)', 'private.case_alive',
  $a$if _w.id is null then raise exception 'A parancs nem található.' using errcode = 'P0002'; end if;$a$,
  $b$if _w.id is null then raise exception 'A parancs nem található.' using errcode = 'P0002'; end if;
  if not private.case_alive(_w.case_id) then raise exception 'Az akta a lomtárban van.' using errcode = '22023'; end if;$b$);

drop function pg_temp.patch_function(regprocedure, text, text[]);

-- ---------------------------------------------------------------------------------------------
-- Trash, restore and the trash list
-- ---------------------------------------------------------------------------------------------

create or replace function public.trash_case(_case_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _c public.cases%rowtype;
  _uid uuid := (select auth.uid());
begin
  select * into _c from public.cases where id = _case_id for update;
  if _c.id is null then raise exception 'Az akta nem található.' using errcode = 'P0002'; end if;
  if not private.can_trash_case(_case_id) then
    raise exception 'Aktát a tulajdonosa és az MCB vezetése helyezhet a lomtárba.' using errcode = '42501';
  end if;
  if _c.deleted_at is not null then raise exception 'Az akta már a lomtárban van.' using errcode = '22023'; end if;

  perform private.log_case_event(_case_id, 'trashed', '{}'::jsonb);
  update public.cases set deleted_at = now(), deleted_by = _uid where id = _case_id;
  perform private.notify(private.case_participant_ids(_case_id), 'Akta a lomtárban',
    format('%s – %s (%s). 30 napig visszaállítható, utána végleg törlődik.', _c.case_number, _c.title, private.member_name(_uid)),
    'warning', 'mcb', '/mcb/trash', 'case-trash:' || _case_id);
  return json_build_object('purge_at', now() + interval '30 days');
end;
$$;
revoke execute on function public.trash_case(uuid) from public, anon, authenticated;
grant execute on function public.trash_case(uuid) to authenticated;

create or replace function public.restore_case(_case_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _c public.cases%rowtype;
  _uid uuid := (select auth.uid());
begin
  select * into _c from public.cases where id = _case_id for update;
  if _c.id is null then raise exception 'Az akta nem található.' using errcode = 'P0002'; end if;
  if not private.can_trash_case(_case_id) then
    raise exception 'Aktát a tulajdonosa és az MCB vezetése állíthat vissza.' using errcode = '42501';
  end if;
  if _c.deleted_at is null then raise exception 'Az akta nincs a lomtárban.' using errcode = '22023'; end if;

  update public.cases set deleted_at = null, deleted_by = null where id = _case_id;
  perform private.log_case_event(_case_id, 'restored', '{}'::jsonb);
  perform private.notify(private.case_participant_ids(_case_id), 'Akta visszaállítva',
    format('%s – %s (%s).', _c.case_number, _c.title, private.member_name(_uid)),
    'info', 'mcb', '/mcb/case/' || _case_id, 'case-trash:' || _case_id);
end;
$$;
revoke execute on function public.restore_case(uuid) from public, anon, authenticated;
grant execute on function public.restore_case(uuid) to authenticated;

-- The trash: the caller's own trashed cases, every trashed case for the MCB's leadership.
create or replace function public.get_case_trash()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(json_agg(json_build_object(
    'id', c.id, 'case_number', c.case_number, 'title', c.title, 'status', c.status, 'priority', c.priority,
    'owner_id', c.owner_id, 'owner_name', o.full_name, 'deleted_at', c.deleted_at, 'deleted_by_name', d.full_name,
    'purge_at', c.deleted_at + interval '30 days',
    'evidence', (select count(*) from public.case_evidence e where e.case_id = c.id),
    'people', (select count(*) from public.case_suspects s where s.case_id = c.id),
    'warrants', (select count(*) from public.case_warrants w where w.case_id = c.id))
    order by c.deleted_at desc), '[]'::json)
  from public.cases c
  left join public.profiles o on o.id = c.owner_id
  left join public.profiles d on d.id = c.deleted_by
  where c.deleted_at is not null and private.can_trash_case(c.id)
$$;
revoke execute on function public.get_case_trash() from public, anon, authenticated;
grant execute on function public.get_case_trash() to authenticated;

-- For the daily job: cases in the trash for more than 30 days (deleted with their files by the API).
create or replace function public.expired_trashed_cases(_limit integer default 25)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id from public.cases c
  where c.deleted_at is not null and c.deleted_at < now() - interval '30 days'
  order by c.deleted_at
  limit greatest(1, least(coalesce(_limit, 25), 100))
$$;
revoke execute on function public.expired_trashed_cases(integer) from public, anon, authenticated;
grant execute on function public.expired_trashed_cases(integer) to service_role;
