-- =============================================================================
-- POST-DEPLOY (move into supabase/migrations/ and push only after the frontend with the signature
-- editor is live: the notification opens the profile's signature dialog).
--
-- Every member without a signature gets one reminder now; members joining later get it when their
-- account becomes active (approved registration or finished onboarding). The app also shows a
-- popup after the trainings.
-- =============================================================================

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
    'info', 'system', '/profile?tab=settings&signature=1', 'signature:setup');
$$;
revoke execute on function private.signature_reminder(uuid[]) from public, anon, authenticated;

create or replace function private.on_member_ready_signature()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (old.system_role = 'pending' and new.system_role <> 'pending')
     or (coalesce(old.onboarding_completed, false) = false and new.onboarding_completed = true) then
    perform private.signature_reminder(array[new.id]);
  end if;
  return null;
end;
$$;
revoke execute on function private.on_member_ready_signature() from public, anon, authenticated;
drop trigger if exists member_ready_signature on public.profiles;
create trigger member_ready_signature after update of system_role, onboarding_completed on public.profiles
  for each row execute function private.on_member_ready_signature();

select private.signature_reminder(array(select id from public.profiles where system_role <> 'pending'));
