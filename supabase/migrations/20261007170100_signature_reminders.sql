-- =============================================================================
-- Signature reminders. Every member who can use the app and has no signature gets one reminder
-- now; members joining later get it when their account becomes usable (an approved registration,
-- or a Deputy Sheriff Trainee finishing the onboarding). The app also asks once per visit
-- (SignaturePrompt), after the trainings.
--
-- Written 2026-10-07 as supabase/post-deploy/20261008000000_signature_reminders.sql: the
-- notification opens the profile's signature dialog, which only the frontend deployed on
-- 2026-10-07 has.
-- =============================================================================

-- Approved, and a Deputy Sheriff Trainee only after the onboarding (AppLayout keeps them on
-- /onboarding until then).
create or replace function private.member_ready(_role text, _rank text, _onboarded boolean)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(_role, 'pending') <> 'pending'
     and not (_rank is not distinct from 'Deputy Sheriff Trainee' and not coalesce(_onboarded, false));
$$;
revoke execute on function private.member_ready(text, text, boolean) from public, anon, authenticated;

-- _include_actor: a trainee who finishes the onboarding is the one making the change.
create or replace function private.signature_reminder(_users uuid[])
returns integer
language sql
security definer
set search_path = ''
as $$
  select private.notify(
    array(select u from unnest(_users) u where not exists (select 1 from public.member_signatures s where s.user_id = u)),
    'Állítsd be az aláírásodat',
    'A nyomtatható iratokra (szolgálati lap, akták, parancsok, oklevelek, belső vizsgálati iratok) a saját aláírásod kerül. Rajzold meg, töltsd fel egy képről, vagy válassz egy stílust.',
    'info', 'system', '/profile?tab=settings&signature=1', 'signature:setup', true);
$$;
revoke execute on function private.signature_reminder(uuid[]) from public, anon, authenticated;

create or replace function private.on_member_ready_signature()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.member_ready(new.system_role, new.faction_rank, new.onboarding_completed)
     and not private.member_ready(old.system_role, old.faction_rank, old.onboarding_completed) then
    perform private.signature_reminder(array[new.id]);
  end if;
  return null;
end;
$$;
revoke execute on function private.on_member_ready_signature() from public, anon, authenticated;
drop trigger if exists member_ready_signature on public.profiles;
create trigger member_ready_signature after update of system_role, faction_rank, onboarding_completed on public.profiles
  for each row execute function private.on_member_ready_signature();

select private.signature_reminder(array(
  select id from public.profiles where private.member_ready(system_role, faction_rank, onboarding_completed)));
