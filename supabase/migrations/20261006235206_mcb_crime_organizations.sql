-- =============================================================================
-- Crime organisations ("Bűnszervezetek") for the MCB: gangs, crews, cartels with their logo and
-- colour, territory, threat level and status; the registered persons who belong to them (with
-- their role); an intelligence log (dated notes with a source). Cases, warrants, vehicles and
-- properties are derived from the members, so nothing is entered twice.
--
-- The case area reads them (private.can_view_cases(): MCB, Supervisory Staff and above, the
-- bureau manager) and keeps them up to date; deleting an organisation is for the MCB leadership.
--
-- Compatible with the deployed frontend: new tables and functions only.
-- =============================================================================

create table public.crime_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  kind text not null default 'gang' check (kind in ('gang', 'crew', 'cartel', 'mafia', 'biker', 'other')),
  status text not null default 'active' check (status in ('active', 'dormant', 'dismantled')),
  threat text not null default 'medium' check (threat in ('low', 'medium', 'high', 'critical')),
  color text check (color ~ '^#[0-9a-fA-F]{6}$'),
  logo_url text check (logo_url is null or logo_url ~ '^https://res\.cloudinary\.com/'),
  territory text check (char_length(territory) <= 300),
  description text check (char_length(description) <= 3000),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
create unique index crime_organizations_name_idx on public.crime_organizations (lower(btrim(name)));
alter table public.crime_organizations enable row level security;
create trigger stamp_crime_organizations before update on public.crime_organizations for each row execute function private.stamp_update();

create table public.organization_members (
  organization_id uuid not null references public.crime_organizations(id) on delete cascade,
  suspect_id uuid not null references public.suspects(id) on delete cascade,
  role text not null default 'member' check (role in ('leader', 'lieutenant', 'member', 'associate')),
  note text check (char_length(note) <= 300),
  added_by uuid default auth.uid() references public.profiles(id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (organization_id, suspect_id)
);
create index organization_members_suspect_idx on public.organization_members (suspect_id);
alter table public.organization_members enable row level security;

create table public.organization_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crime_organizations(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 2 and 2000),
  source text check (char_length(source) <= 120),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index organization_notes_org_idx on public.organization_notes (organization_id, created_at desc);
alter table public.organization_notes enable row level security;

-- The case area reads and writes; the MCB leadership deletes an organisation.
create policy crime_organizations_select on public.crime_organizations for select to authenticated using ((select private.can_view_cases()));
create policy crime_organizations_insert on public.crime_organizations for insert to authenticated
  with check ((select private.can_view_cases()) and created_by = (select auth.uid()));
create policy crime_organizations_update on public.crime_organizations for update to authenticated
  using ((select private.can_view_cases())) with check ((select private.can_view_cases()));
create policy crime_organizations_delete on public.crime_organizations for delete to authenticated using ((select private.is_mcb_lead()));
revoke all on public.crime_organizations from anon, authenticated;
grant select, delete on public.crime_organizations to authenticated;
grant insert (name, kind, status, threat, color, logo_url, territory, description) on public.crime_organizations to authenticated;
grant update (name, kind, status, threat, color, logo_url, territory, description) on public.crime_organizations to authenticated;

create policy organization_members_select on public.organization_members for select to authenticated using ((select private.can_view_cases()));
create policy organization_members_insert on public.organization_members for insert to authenticated
  with check ((select private.can_view_cases()) and added_by = (select auth.uid()));
create policy organization_members_update on public.organization_members for update to authenticated
  using ((select private.can_view_cases())) with check ((select private.can_view_cases()));
create policy organization_members_delete on public.organization_members for delete to authenticated using ((select private.can_view_cases()));
revoke all on public.organization_members from anon, authenticated;
grant select, delete on public.organization_members to authenticated;
grant insert (organization_id, suspect_id, role, note) on public.organization_members to authenticated;
grant update (role, note) on public.organization_members to authenticated;

-- Notes are kept: their author or the MCB leadership removes one.
create policy organization_notes_select on public.organization_notes for select to authenticated using ((select private.can_view_cases()));
create policy organization_notes_insert on public.organization_notes for insert to authenticated
  with check ((select private.can_view_cases()) and created_by = (select auth.uid()));
create policy organization_notes_delete on public.organization_notes for delete to authenticated
  using ((select private.can_view_cases()) and (created_by = (select auth.uid()) or (select private.is_mcb_lead())));
revoke all on public.organization_notes from anon, authenticated;
grant select, delete on public.organization_notes to authenticated;
grant insert (organization_id, body, source) on public.organization_notes to authenticated;

-- ---------------------------------------------------------------------------
-- Reads: the list with its numbers, an organisation with everything derived from its members
-- ---------------------------------------------------------------------------

create or replace function public.get_organizations()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select case when not private.can_view_cases() then null else coalesce((
    select json_agg(json_build_object(
      'id', o.id, 'name', o.name, 'kind', o.kind, 'status', o.status, 'threat', o.threat, 'color', o.color, 'logo_url', o.logo_url,
      'territory', o.territory, 'updated_at', o.updated_at,
      'members', (select count(*) from public.organization_members m where m.organization_id = o.id),
      'leaders', (select coalesce(json_agg(s.full_name order by s.full_name), '[]'::json)
                  from public.organization_members m join public.suspects s on s.id = m.suspect_id
                  where m.organization_id = o.id and m.role = 'leader'),
      'wanted', (select count(distinct w.suspect_id) from public.organization_members m
                 join public.case_warrants w on w.suspect_id = m.suspect_id
                 where m.organization_id = o.id and w.type = 'arrest' and w.status = 'approved' and (w.expires_at is null or w.expires_at > now())),
      'open_cases', (select count(distinct c.id) from public.organization_members m
                     join public.case_suspects cs on cs.suspect_id = m.suspect_id
                     join public.cases c on c.id = cs.case_id
                     where m.organization_id = o.id and c.status = 'open'),
      'last_note_at', (select max(n.created_at) from public.organization_notes n where n.organization_id = o.id))
    order by case o.status when 'active' then 0 when 'dormant' then 1 else 2 end,
             case o.threat when 'critical' then 0 when 'high' then 1 when 'medium' then 2 else 3 end, o.name)
    from public.crime_organizations o), '[]'::json) end
$$;
revoke execute on function public.get_organizations() from public, anon, authenticated;
grant execute on function public.get_organizations() to authenticated;

create or replace function public.get_organization(_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _o public.crime_organizations%rowtype;
begin
  if not private.can_view_cases() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  select * into _o from public.crime_organizations where id = _id;
  if _o.id is null then raise exception 'A szervezet nem található.' using errcode = 'P0002'; end if;
  return json_build_object(
    'organization', json_build_object('id', _o.id, 'name', _o.name, 'kind', _o.kind, 'status', _o.status, 'threat', _o.threat, 'color', _o.color,
      'logo_url', _o.logo_url, 'territory', _o.territory, 'description', _o.description, 'created_at', _o.created_at, 'updated_at', _o.updated_at,
      'created_by_name', (select full_name from public.profiles where id = _o.created_by),
      'updated_by_name', (select full_name from public.profiles where id = _o.updated_by),
      'can_delete', private.is_mcb_lead()),
    'members', coalesce((select json_agg(json_build_object(
        'suspect_id', s.id, 'full_name', s.full_name, 'alias', s.alias, 'status', s.status, 'mugshot_url', s.mugshot_url,
        'role', m.role, 'note', m.note, 'added_at', m.added_at,
        'wanted', exists (select 1 from public.case_warrants w where w.suspect_id = s.id and w.type = 'arrest' and w.status = 'approved'
                          and (w.expires_at is null or w.expires_at > now())))
      order by case m.role when 'leader' then 0 when 'lieutenant' then 1 when 'member' then 2 else 3 end, s.full_name)
      from public.organization_members m join public.suspects s on s.id = m.suspect_id where m.organization_id = _o.id), '[]'::json),
    'notes', coalesce((select json_agg(json_build_object('id', n.id, 'body', n.body, 'source', n.source, 'created_at', n.created_at,
        'created_by', n.created_by, 'created_by_name', (select full_name from public.profiles where id = n.created_by),
        'can_delete', n.created_by = (select auth.uid()) or private.is_mcb_lead()) order by n.created_at desc)
      from public.organization_notes n where n.organization_id = _o.id), '[]'::json),
    -- The members' cases (list fields only; the documents stay behind the case's own rights).
    'cases', coalesce((select json_agg(x order by x.updated_at desc) from (
        select distinct on (c.id) c.id, c.case_number, c.title, c.status, c.priority, c.updated_at,
               private.user_can_open_case(c.id, (select auth.uid())) as can_open,
               (select count(*) from public.case_suspects cs2 join public.organization_members m2 on m2.suspect_id = cs2.suspect_id
                where cs2.case_id = c.id and m2.organization_id = _o.id) as members_in_case
        from public.organization_members m
        join public.case_suspects cs on cs.suspect_id = m.suspect_id
        join public.cases c on c.id = cs.case_id
        where m.organization_id = _o.id
        order by c.id) x), '[]'::json),
    'vehicles', coalesce((select json_agg(json_build_object('plate', v.plate_number, 'vehicle', v.vehicle_type, 'color', v.color,
        'owner', s.full_name, 'suspect_id', s.id) order by v.plate_number)
      from public.organization_members m join public.suspect_vehicles v on v.suspect_id = m.suspect_id
      join public.suspects s on s.id = m.suspect_id where m.organization_id = _o.id), '[]'::json),
    'properties', coalesce((select json_agg(json_build_object('address', p.address, 'type', p.property_type, 'owner', s.full_name,
        'suspect_id', s.id) order by p.address)
      from public.organization_members m join public.suspect_properties p on p.suspect_id = m.suspect_id
      join public.suspects s on s.id = m.suspect_id where m.organization_id = _o.id), '[]'::json),
    'warrants', coalesce((select json_agg(json_build_object('id', w.id, 'type', w.type, 'status', w.status, 'target', coalesce(s.full_name, w.target_name),
        'expires_at', w.expires_at, 'case_id', w.case_id, 'decided_at', w.decided_at) order by w.created_at desc)
      from public.organization_members m join public.case_warrants w on w.suspect_id = m.suspect_id
      join public.suspects s on s.id = m.suspect_id
      where m.organization_id = _o.id and w.status in ('pending', 'approved')), '[]'::json));
end;
$$;
revoke execute on function public.get_organization(uuid) from public, anon, authenticated;
grant execute on function public.get_organization(uuid) to authenticated;

-- The organisations a registered person belongs to (their file shows them).
create or replace function public.get_person_organizations(_suspect_id uuid)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select case when not private.can_view_cases() then null else coalesce((
    select json_agg(json_build_object('id', o.id, 'name', o.name, 'color', o.color, 'logo_url', o.logo_url, 'threat', o.threat, 'role', m.role)
                    order by o.name)
    from public.organization_members m join public.crime_organizations o on o.id = m.organization_id
    where m.suspect_id = _suspect_id), '[]'::json) end
$$;
revoke execute on function public.get_person_organizations(uuid) from public, anon, authenticated;
grant execute on function public.get_person_organizations(uuid) to authenticated;
