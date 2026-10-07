-- =============================================================================
-- Versions of the big, rarely changing lists the client keeps between visits (egress).
--
-- The member directory, the fleet, the HR registry, the suspect list, the bureau catalogue and
-- the case templates are stored in the browser with the version of the tables they come from.
-- A visit asks only for the versions (get_cache_versions(), one small call shared by every list)
-- and downloads a list again only when one of its tables changed. Statement-level triggers bump a
-- version on every insert, update or delete of its tables; the client: src/lib/versioned-cache.ts.
--
-- Compatible with the deployed frontend: new table, triggers and function only.
-- =============================================================================

create table private.cache_versions (
  key text primary key,
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);
insert into private.cache_versions (key) values
  ('profiles'), ('fleet'), ('registry'), ('suspects'), ('bureaus'), ('templates'), ('hr_records'), ('ribbons')
on conflict (key) do nothing;

create or replace function private.bump_cache_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _key text;
begin
  foreach _key in array tg_argv loop
    insert into private.cache_versions as v (key, version, updated_at) values (_key, 1, now())
    on conflict (key) do update set version = v.version + 1, updated_at = now();
  end loop;
  return null;
end;
$$;
revoke execute on function private.bump_cache_version() from public, anon, authenticated;

-- One trigger per table and key (statement level: a batch write bumps once).
create trigger cache_version after insert or update or delete on public.profiles
  for each statement execute function private.bump_cache_version('profiles');
create trigger cache_version after insert or update or delete on public.fleet_vehicles
  for each statement execute function private.bump_cache_version('fleet');
create trigger cache_version after insert or update or delete on public.fleet_assignments
  for each statement execute function private.bump_cache_version('fleet');
create trigger cache_version after insert or update or delete on public.fleet_categories
  for each statement execute function private.bump_cache_version('fleet');
-- The registry shows whether a vehicle's registration waits for review.
create trigger cache_version after insert or update or delete on public.fleet_registration_requests
  for each statement execute function private.bump_cache_version('fleet');
create trigger cache_version after insert or update or delete on public.member_details
  for each statement execute function private.bump_cache_version('registry');
create trigger cache_version after insert or update or delete on public.member_bank_accounts
  for each statement execute function private.bump_cache_version('registry');
create trigger cache_version after insert or update or delete on public.duty_time_entries
  for each statement execute function private.bump_cache_version('registry');
create trigger cache_version after insert or update or delete on public.vehicle_warnings
  for each statement execute function private.bump_cache_version('registry');
create trigger cache_version after insert or update or delete on public.suspects
  for each statement execute function private.bump_cache_version('suspects');
create trigger cache_version after insert or update or delete on public.case_suspects
  for each statement execute function private.bump_cache_version('suspects');
-- The suspect list shows the cases' numbers and titles (not their documents).
create trigger cache_version after insert or delete or update of title, case_number on public.cases
  for each statement execute function private.bump_cache_version('suspects');
create trigger cache_version after insert or update or delete on public.division_ranks
  for each statement execute function private.bump_cache_version('bureaus');
create trigger cache_version after insert or update or delete on public.division_titles
  for each statement execute function private.bump_cache_version('bureaus');
create trigger cache_version after insert or update or delete on public.case_templates
  for each statement execute function private.bump_cache_version('templates');
create trigger cache_version after insert or update or delete on public.hr_records
  for each statement execute function private.bump_cache_version('hr_records');
create trigger cache_version after insert or update or delete on public.user_ribbons
  for each statement execute function private.bump_cache_version('ribbons');
create trigger cache_version after insert or update or delete on public.ribbons
  for each statement execute function private.bump_cache_version('ribbons');

-- Every version in one call (members only).
create or replace function public.get_cache_versions()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.is_member()
    then (select coalesce(json_object_agg(v.key, v.version), '{}'::json) from private.cache_versions v) end
$$;
revoke execute on function public.get_cache_versions() from public, anon, authenticated;
grant execute on function public.get_cache_versions() to authenticated;
