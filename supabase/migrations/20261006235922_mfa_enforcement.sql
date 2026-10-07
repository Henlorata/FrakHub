-- =============================================================================
-- Two-factor sign-in (TOTP, optional per member): a member who enrolled an authenticator app
-- reaches the data only with a session that passed the second step (aal2). A stolen password
-- alone then opens nothing:
--   * the Data API (tables, views, every RPC) runs private.check_request() before each request
--     (pgrst.db_pre_request) and answers 401 "MFA_REQUIRED";
--   * Realtime and Storage do not go through PostgREST, so the tables Realtime publishes and
--     storage.objects carry a restrictive policy with the same rule;
--   * the Vercel functions check the same in requireCaller().
-- Guests (anon) and the service role are not affected; members without a factor work as before.
--
-- Rolling back the API check, if ever needed:
--   alter role authenticator reset pgrst.db_pre_request; notify pgrst, 'reload config';
--
-- Compatible with the deployed frontend: nobody has a factor until they enroll one.
-- =============================================================================

-- The rule: the session passed the second step, or the member has no working authenticator.
create or replace function private.mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    or auth.uid() is null
    or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified');
$$;
revoke execute on function private.mfa_satisfied() from public;
grant execute on function private.mfa_satisfied() to anon, authenticated, service_role;

create or replace function private.check_request()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'authenticated' or private.mfa_satisfied() then return; end if;
  raise sqlstate 'PGRST' using
    message = json_build_object('code', 'MFA_REQUIRED',
      'message', 'Kétlépcsős azonosítás szükséges: add meg a hitelesítő alkalmazás kódját.',
      'details', 'aal2 required', 'hint', 'Jelentkezz be újra, és add meg a kódot.')::text,
    detail = json_build_object('status', 401, 'headers', json_build_object())::text;
end;
$$;
revoke execute on function private.check_request() from public;
-- PostgREST runs it as the role of the request.
grant execute on function private.check_request() to anon, authenticated, service_role;

alter role authenticator set pgrst.db_pre_request = 'private.check_request';
notify pgrst, 'reload config';

-- Realtime: live row changes are filtered by RLS (evaluated once per statement).
do $$
declare
  _table text;
begin
  foreach _table in array array['case_notes', 'case_warrants', 'hr_records', 'notifications', 'profiles', 'system_status'] loop
    execute format('drop policy if exists mfa_session on public.%I', _table);
    execute format('create policy mfa_session on public.%I as restrictive for select to authenticated using ((select private.mfa_satisfied()))', _table);
  end loop;
end $$;

-- Storage: files (finance proofs, registration screenshots, old evidence) go through RLS too.
drop policy if exists mfa_session on storage.objects;
create policy mfa_session on storage.objects as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));
