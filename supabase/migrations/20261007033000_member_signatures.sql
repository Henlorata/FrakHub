-- =============================================================================
-- Signatures: every member keeps one signature (drawn, traced from an uploaded picture, a
-- handwriting style of their name, or generated) as vector outlines (SVG path data, a few KB),
-- shown on the printable documents (service record, case and warrant prints, certificates,
-- Internal Affairs documents). Only the outline is stored, never the uploaded picture.
-- Certificates carry the department head's signature: the Bureau Manager (or a Commander) at the
-- time of issue.
--
-- Compatible with the deployed frontend: a new table, two RPCs, a new certificate column and an
-- extra key in verify_certificate(). The reminder notifications go out after the deploy
-- (supabase/post-deploy/20261008000000_signature_reminders.sql).
-- =============================================================================

create table public.member_signatures (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  path text not null,
  width real not null,
  height real not null,
  method text not null,
  style text,
  updated_at timestamptz not null default now(),
  constraint member_signatures_path_check
    check (length(path) between 8 and 150000 and path ~ '^[MLHVCSQTAZmlhvcsqtaz0-9eE ,.\-]+$'),
  constraint member_signatures_size_check check (width > 0 and width <= 4000 and height > 0 and height <= 2000),
  constraint member_signatures_method_check check (method in ('draw', 'upload', 'style', 'auto')),
  constraint member_signatures_style_check check (style is null or style ~ '^[a-z0-9-]{1,40}$')
);
alter table public.member_signatures enable row level security;
-- Documents show other members' signatures (who issued, approved, signed).
create policy member_signatures_select on public.member_signatures for select to authenticated
  using ((select private.is_member()));
revoke all on public.member_signatures from anon, authenticated;
grant select on public.member_signatures to authenticated;

-- Saves (or replaces) the caller's own signature.
create or replace function public.save_signature(_path text, _width real, _height real, _method text, _style text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  insert into public.member_signatures (user_id, path, width, height, method, style, updated_at)
  values ((select auth.uid()), _path, _width, _height, _method, nullif(btrim(coalesce(_style, '')), ''), now())
  on conflict (user_id) do update set path = excluded.path, width = excluded.width, height = excluded.height,
    method = excluded.method, style = excluded.style, updated_at = now();
end;
$$;
revoke execute on function public.save_signature(text, real, real, text, text) from public, anon, authenticated;
grant execute on function public.save_signature(text, real, real, text, text) to authenticated;

create or replace function public.delete_signature()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.member_signatures where user_id = (select auth.uid());
$$;
revoke execute on function public.delete_signature() from public, anon, authenticated;
grant execute on function public.delete_signature() to authenticated;

-- ---------------------------------------------------------------------------
-- Certificates: signed by the department head at the time of issue
-- ---------------------------------------------------------------------------

-- The head of the department: the highest-ranking Bureau Manager or Commander (a Bureau Manager first
-- within a rank, then the longest-serving). A technical account named "Admin" never signs.
create or replace function private.department_head()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.profiles p
  where p.system_role <> 'pending' and (coalesce(p.is_bureau_manager, false) or p.faction_rank = 'Commander')
    and lower(btrim(coalesce(p.full_name, ''))) not in ('admin', 'administrator')
  order by private.rank_index(p.faction_rank), coalesce(p.is_bureau_manager, false) desc, p.created_at
  limit 1;
$$;
revoke execute on function private.department_head() from public, anon, authenticated;

alter table public.certificates add column if not exists signer_id uuid references public.profiles(id) on delete set null;

create or replace function private.certificate_signer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.signer_id is null then new.signer_id := private.department_head(); end if;
  return new;
end;
$$;
revoke execute on function private.certificate_signer() from public, anon, authenticated;
drop trigger if exists certificate_signer on public.certificates;
create trigger certificate_signer before insert on public.certificates
  for each row execute function private.certificate_signer();

update public.certificates set signer_id = private.department_head() where signer_id is null;

create or replace function public.verify_certificate(_code text)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select case when c.id is null then null else json_build_object(
    'code', c.code, 'kind', c.kind, 'ref', case when c.kind in ('qualification', 'rank') then c.ref end,
    'title', c.title, 'subtitle', c.subtitle, 'issued_at', c.issued_at, 'valid', c.revoked_at is null, 'revoked_at', c.revoked_at,
    'holder', json_build_object('full_name', p.full_name, 'badge_number', p.badge_number, 'faction_rank', p.faction_rank),
    'signer', case when s.id is null then null else json_build_object(
      'full_name', s.full_name, 'faction_rank', s.faction_rank,
      'title', case when s.is_bureau_manager then 'Bureau Manager' else s.faction_rank end,
      'signature', (select json_build_object('path', ms.path, 'width', ms.width, 'height', ms.height)
                    from public.member_signatures ms where ms.user_id = s.id)) end)
  end
  from (select 1) x
  left join public.certificates c on c.code = upper(btrim(coalesce(_code, '')))
  left join public.profiles p on p.id = c.user_id
  left join public.profiles s on s.id = c.signer_id
$$;
