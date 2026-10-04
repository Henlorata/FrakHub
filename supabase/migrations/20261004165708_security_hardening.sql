-- Security hardening of the hand-built production schema.
--
-- Fixes, in short:
--   * every authenticated user could update their own profile row, including
--     system_role / faction_rank / bureau flags (self-promotion to admin);
--   * anonymous visitors could read all profiles (with e-mail addresses), action logs,
--     case-suspect links, and could rewrite or delete the whole academy;
--   * pending (not yet approved) registrations counted as members everywhere;
--   * exam submissions could be inserted already "passed", answers with points,
--     and several SECURITY DEFINER RPCs had no permission checks at all
--     (delete_full_exam, admin_assign_exam, send_hr_notification, ...);
--   * hr_update_user_profile_v2 let any supervisor assign any rank to anyone;
--   * functions had a mutable search_path; storage policies used auth.role().
--
-- The policies stay compatible with the client that is currently deployed, so this
-- migration can be applied before the new frontend goes live. Tightening that needs
-- the new frontend lives in supabase/post-deploy/.

-- ---------------------------------------------------------------------------
-- 1. Private helper schema (not exposed through the Data API)
-- ---------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- Rank order, mirror of FACTION_RANKS in shared/ranks.ts (0 = Commander).
create or replace function private.rank_index(_rank text)
returns integer
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(array_position(array[
    'Commander', 'Deputy Commander',
    'Captain III.', 'Captain II.', 'Captain I.', 'Lieutenant II.', 'Lieutenant I.',
    'Sergeant II.', 'Sergeant I.',
    'Corporal', 'Staff Deputy Sheriff', 'Senior Deputy Sheriff',
    'Deputy Sheriff III+.', 'Deputy Sheriff III.', 'Deputy Sheriff II.', 'Deputy Sheriff I.',
    'Deputy Sheriff Trainee'
  ]::text[], _rank) - 1, 999)
$$;

-- Website permission level that belongs to a rank (shared/ranks.ts calculateSystemRole).
create or replace function private.system_role_for_rank(_rank text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when private.rank_index(_rank) <= 6 then 'admin'
    when private.rank_index(_rank) <= 8 then 'supervisor'
    else 'user'
  end
$$;

-- The caller's profile when the caller is an approved member, otherwise NULL.
-- SECURITY DEFINER: runs as the table owner, so it does not recurse into profiles RLS.
create or replace function private.me()
returns public.profiles
language sql
stable
security definer
set search_path = ''
as $$
  select p from public.profiles p
  where p.id = (select auth.uid()) and p.system_role <> 'pending'
$$;

create or replace function private.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.system_role <> 'pending'
  )
$$;

-- Supervisory staff and above (system_role admin/supervisor) or a bureau manager.
create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.system_role <> 'pending'
      and (p.system_role in ('admin', 'supervisor') or coalesce(p.is_bureau_manager, false))
  )
$$;

-- High command (system_role admin) or a bureau manager.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.system_role <> 'pending'
      and (p.system_role = 'admin' or coalesce(p.is_bureau_manager, false))
  )
$$;

-- Executive staff or a bureau manager (awards, password resets, permanent deletions).
create or replace function private.is_executive_or_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.system_role <> 'pending'
      and (private.rank_index(p.faction_rank) <= 1 or coalesce(p.is_bureau_manager, false))
  )
$$;

-- MCB area: MCB members, staff and high command (src/lib/utils.ts canViewCaseList).
create or replace function private.can_view_cases()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.system_role <> 'pending'
      and (p.division = 'MCB' or p.system_role in ('admin', 'supervisor')
           or private.rank_index(p.faction_rank) <= 6 or coalesce(p.is_bureau_manager, false))
  )
$$;

-- src/lib/utils.ts canApproveWarrant (the old policy forgot Investigator III.).
create or replace function private.can_approve_warrants()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.system_role <> 'pending'
      and (p.system_role in ('admin', 'supervisor') or private.rank_index(p.faction_rank) <= 8
           or coalesce(p.is_bureau_manager, false)
           or (p.division = 'MCB' and p.division_rank = 'Investigator III.'))
  )
$$;

-- shared/ranks.ts isAcademyInstructor.
create or replace function private.is_academy_instructor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.system_role <> 'pending'
      and p.faction_rank <> 'Deputy Sheriff Trainee'
      and ('TB' = any(coalesce(p.qualifications, '{}')) or coalesce(p.is_bureau_manager, false)
           or private.rank_index(p.faction_rank) <= 8)
  )
$$;

-- Case visibility helpers (owner or collaborator), bypassing RLS on purpose.
create or replace function private.can_edit_case(_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cases c
    where c.id = _case_id
      and (c.owner_id = (select auth.uid())
           or exists (select 1 from public.case_collaborators cc
                      where cc.case_id = c.id and cc.user_id = (select auth.uid()) and cc.role = 'editor'))
  ) and private.is_member()
$$;

create or replace function private.is_case_participant(_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.cases c where c.id = _case_id and c.owner_id = (select auth.uid()))
      or exists (select 1 from public.case_collaborators cc
                 where cc.case_id = _case_id and cc.user_id = (select auth.uid()))
$$;

-- --- Exams (src/lib/utils.ts canManageExamContent / canManageExamAccess / canDeleteExam) ---

create or replace function private.can_manage_exam_content(_type text, _division text)
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
           or (coalesce(_type, '') not in ('trainee', 'deputy_i')
               and ((_division is not null and _division = any(coalesce(p.commanded_divisions, '{}')))
                    or (coalesce(p.is_bureau_commander, false) and p.division = _division))))
  )
$$;

create or replace function private.can_manage_exam_access(_type text, _division text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when coalesce(_type, '') in ('trainee', 'deputy_i') then exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.system_role <> 'pending'
        and ('TB' = any(coalesce(p.qualifications, '{}')) or private.rank_index(p.faction_rank) <= 8
             or coalesce(p.is_bureau_manager, false)))
    else private.can_manage_exam_content(_type, _division)
  end
$$;

create or replace function private.can_delete_exam(_division text)
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
           or (_division is not null
               and (coalesce(p.is_bureau_commander, false) or _division = any(coalesce(p.commanded_divisions, '{}')))))
  )
$$;

-- Who may see a submission: the candidate, or a grader of that exam (moved from public,
-- where it was callable through the API; same rules as before, members only).
create or replace function private.has_grading_rights(_submission_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _viewer public.profiles%rowtype;
  _submission public.exam_submissions%rowtype;
  _exam public.exams%rowtype;
  _applicant public.profiles%rowtype;
  _viewer_rank integer;
begin
  select * into _submission from public.exam_submissions where id = _submission_id;
  if _submission.id is null then return false; end if;
  if _submission.user_id is not null and _submission.user_id = (select auth.uid()) then return true; end if;

  select * into _viewer from public.profiles where id = (select auth.uid()) and system_role <> 'pending';
  if _viewer.id is null then return false; end if;
  if coalesce(_viewer.is_bureau_manager, false) then return true; end if;

  select * into _exam from public.exams where id = _submission.exam_id;
  if _exam.id is null then return false; end if;
  _viewer_rank := private.rank_index(_viewer.faction_rank);

  -- Division exams: bureau commanders and the leaders of that division.
  if coalesce(_exam.division, '') <> '' then
    if coalesce(_viewer.is_bureau_commander, false) then return true; end if;
    if _exam.division = any(coalesce(_viewer.commanded_divisions, '{}')) then return true; end if;
  end if;

  -- Basic exams (trainee, deputy I. or no division).
  if coalesce(_exam.division, '') = '' or _exam.type in ('trainee', 'deputy_i') then
    if _viewer_rank <= 6 then return true; end if;
    if _viewer_rank <= 8 then
      select * into _applicant from public.profiles where id = _submission.user_id;
      if _applicant.id is null or private.rank_index(_applicant.faction_rank) >= private.rank_index('Corporal') then
        return true;
      end if;
    end if;
    if 'TB' = any(coalesce(_viewer.qualifications, '{}')) then return true; end if;
  end if;

  return false;
end;
$$;

-- Graders, never the candidate themselves.
create or replace function private.can_grade_submission(_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_grading_rights(_submission_id)
     and not exists (select 1 from public.exam_submissions s
                     where s.id = _submission_id and s.user_id = (select auth.uid()))
$$;

-- --- HR rules (mirror of shared/ranks.ts, used by hr_update_user_profile_v2) ---

create or replace function private.allowed_promotion_ranks(_editor public.profiles)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(_editor.is_bureau_manager, false) or private.rank_index(_editor.faction_rank) <= 1 then array[
      'Commander', 'Deputy Commander', 'Captain III.', 'Captain II.', 'Captain I.', 'Lieutenant II.',
      'Lieutenant I.', 'Sergeant II.', 'Sergeant I.', 'Corporal', 'Staff Deputy Sheriff',
      'Senior Deputy Sheriff', 'Deputy Sheriff III+.', 'Deputy Sheriff III.', 'Deputy Sheriff II.',
      'Deputy Sheriff I.', 'Deputy Sheriff Trainee']
    when private.rank_index(_editor.faction_rank) <= 6 then array[
      'Sergeant II.', 'Sergeant I.', 'Corporal', 'Staff Deputy Sheriff', 'Senior Deputy Sheriff',
      'Deputy Sheriff III+.', 'Deputy Sheriff III.', 'Deputy Sheriff II.', 'Deputy Sheriff I.',
      'Deputy Sheriff Trainee']
    when private.rank_index(_editor.faction_rank) <= 8 then array[
      'Corporal', 'Staff Deputy Sheriff', 'Senior Deputy Sheriff', 'Deputy Sheriff III+.',
      'Deputy Sheriff III.', 'Deputy Sheriff II.', 'Deputy Sheriff I.', 'Deputy Sheriff Trainee']
    when 'TB' = any(coalesce(_editor.qualifications, '{}')) then array['Deputy Sheriff I.', 'Deputy Sheriff Trainee']
    else '{}'::text[]
  end
$$;

create or replace function private.can_manage_user_rank(_editor public.profiles, _target public.profiles)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(_editor.is_bureau_manager, false) then true
    when coalesce(_target.is_bureau_manager, false) then false
    when private.rank_index(_editor.faction_rank) > 8
         and cardinality(coalesce(_editor.commanded_divisions, '{}')) > 0 then false
    else _target.faction_rank = any(private.allowed_promotion_ranks(_editor))
  end
$$;

create or replace function private.can_manage_user_division(_editor public.profiles, _target public.profiles)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(_editor.is_bureau_manager, false) then true
    when coalesce(_target.is_bureau_manager, false) or coalesce(_target.is_bureau_commander, false) then false
    when coalesce(_editor.is_bureau_commander, false) then _target.division in ('TSB', _editor.division)
    else private.rank_index(_editor.faction_rank) <= 8
  end
$$;

create or replace function private.can_manage_user_qualification(
  _editor public.profiles, _target public.profiles, _qualification text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(_editor.is_bureau_manager, false) then true
    when coalesce(_target.is_bureau_manager, false) then false
    when _qualification = any(coalesce(_target.commanded_divisions, '{}')) then false
    when coalesce(_target.is_bureau_commander, false) and _target.division = _qualification then false
    when cardinality(coalesce(_editor.commanded_divisions, '{}')) > 0
      then _qualification = any(_editor.commanded_divisions)
    else private.rank_index(_editor.faction_rank) <= 8
  end
$$;

-- Policies call these as the querying role.
grant execute on all functions in schema private to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Function privileges: nothing in public is callable unless granted below
-- ---------------------------------------------------------------------------

-- New functions still get EXECUTE for PUBLIC (a global default that cannot be revoked per
-- schema), so every later migration revokes and grants explicitly per function.
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;

-- Broken or unused legacy functions (they referenced a profiles.role column that no
-- longer exists, or are superseded by the API functions).
drop function if exists public.get_all_mcb_cases();
drop function if exists public.get_case_details(uuid);
drop function if exists public.get_my_cases();
drop function if exists public.get_my_role();
drop function if exists public.hr_update_user_profile(uuid, text, text, text);
drop function if exists public.reassign_cases_before_delete();
drop function if exists public.delete_case_securely(uuid);

-- Fixed search_path for the remaining trigger functions.
alter function public.clean_academy_data_on_promotion() set search_path = public, pg_temp;
alter function public.consume_invite_on_submission() set search_path = public, pg_temp;
alter function public.generate_case_number() set search_path = public, pg_temp;
alter function public.reassign_cases_on_leave() set search_path = public, pg_temp;
alter function public.transfer_cases_on_leave() set search_path = public, pg_temp;
alter function public.update_suspect_on_warrant() set search_path = public, pg_temp;

-- --- RPCs used by the client, now with permission checks ---

create or replace function public.admin_assign_exam(_submission_id uuid, _target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _applicant_name text;
begin
  if not private.can_grade_submission(_submission_id) then
    raise exception 'Nincs jogosultságod a vizsga hozzárendeléséhez.' using errcode = '42501';
  end if;
  if not exists (select 1 from profiles where id = _target_user_id and system_role <> 'pending') then
    raise exception 'A kiválasztott tag nem található.';
  end if;

  select applicant_name into _applicant_name from exam_submissions where id = _submission_id;

  update exam_submissions
  set user_id = _target_user_id
  where id = _submission_id
     or (user_id is null
         and _applicant_name is not null and _applicant_name <> ''
         and applicant_name = _applicant_name
         and start_time >= now() - interval '1 month');
end;
$$;

create or replace function public.claim_exam_submission(_token text)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _submission exam_submissions%rowtype;
  _user_id uuid := auth.uid();
begin
  if _user_id is null or not private.is_member() then
    return json_build_object('success', false, 'message', 'Csak jóváhagyott tagok csatolhatnak vizsgát.');
  end if;
  if coalesce(length(trim(_token)), 0) < 6 then
    return json_build_object('success', false, 'message', 'Érvénytelen kód.');
  end if;

  select * into _submission from exam_submissions where claim_token = trim(_token) limit 1;
  if _submission.id is null then
    return json_build_object('success', false, 'message', 'Érvénytelen kód.');
  end if;
  if _submission.user_id is not null then
    return json_build_object('success', false, 'message', 'Ezt a vizsgát már hozzárendelték valakihez.');
  end if;

  update exam_submissions
  set user_id = _user_id
  where id = _submission.id
     or (user_id is null
         and _submission.applicant_name is not null and _submission.applicant_name <> ''
         and applicant_name = _submission.applicant_name
         and start_time >= now() - interval '1 month');

  return json_build_object('success', true, 'message', 'Vizsga és a korábbi próbálkozások sikeresen csatolva a profilhoz!');
end;
$$;

create or replace function public.complete_onboarding()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Bejelentkezés szükséges.' using errcode = '42501'; end if;
  update profiles set onboarding_completed = true where id = auth.uid() and system_role <> 'pending';
end;
$$;

create or replace function public.change_user_name(_new_name text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _user_id uuid := auth.uid();
  _old_name text;
  _clean text := regexp_replace(trim(coalesce(_new_name, '')), '\s+', ' ', 'g');
begin
  if not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  if length(_clean) < 3 or length(_clean) > 64 then
    raise exception 'A név 3 és 64 karakter közötti lehet.';
  end if;

  select full_name into _old_name from profiles where id = _user_id;
  if _old_name = _clean then return; end if;

  update profiles set full_name = _clean where id = _user_id;
  insert into name_change_logs (user_id, old_name, new_name, changed_by) values (_user_id, _old_name, _clean, _user_id);
end;
$$;

create or replace function public.delete_full_exam(_exam_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _division text;
begin
  select division into _division from exams where id = _exam_id;
  if not found then raise exception 'A vizsga nem található.'; end if;
  if not private.can_delete_exam(_division) then
    raise exception 'Nincs jogosultságod törölni ezt a vizsgát.' using errcode = '42501';
  end if;

  -- Answers, options, questions, overrides and submissions cascade.
  delete from exams where id = _exam_id;
end;
$$;

create or replace function public.delete_suspect_safely(_suspect_id uuid)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _me profiles%rowtype;
  _suspect suspects%rowtype;
  _active_warrants int;
  _linked_cases int;
begin
  _me := private.me();
  if _me.id is null then
    return json_build_object('success', false, 'message', 'Nincs jogosultságod.');
  end if;
  select * into _suspect from suspects where id = _suspect_id;
  if _suspect.id is null then
    return json_build_object('success', false, 'message', 'A gyanúsított nem található.');
  end if;

  if not (coalesce(_me.is_bureau_manager, false)
          or (_me.division = 'MCB' and (coalesce(_me.is_bureau_commander, false) or _me.division_rank = 'Investigator III.'))) then
    if _suspect.created_by is distinct from _me.id then
      return json_build_object('success', false, 'message', 'Csak a saját magad által létrehozott gyanúsítottat törölheted.');
    end if;
  end if;

  select count(*) into _active_warrants from case_warrants
  where suspect_id = _suspect_id and status in ('pending', 'approved');
  if _active_warrants > 0 then
    return json_build_object('success', false, 'message', 'Nem törölhető: A személyhez aktív elfogatóparancs tartozik!');
  end if;

  select count(*) into _linked_cases from case_suspects where suspect_id = _suspect_id;
  if _linked_cases > 0 then
    return json_build_object('success', false, 'message',
      'Nem törölhető: A személy ' || _linked_cases || ' aktához van csatolva. Előbb távolítsd el az aktákból.');
  end if;

  delete from suspects where id = _suspect_id;
  return json_build_object('success', true, 'message', 'Gyanúsított törölve.');
end;
$$;

create or replace function public.hr_give_award(_target_user_id uuid, _ribbon_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not private.is_executive_or_manager() then
    raise exception 'Csak az Executive Staff adhat kitüntetést!' using errcode = '42501';
  end if;
  if _target_user_id = auth.uid() then raise exception 'Saját magadnak nem adhatsz kitüntetést.'; end if;
  if not exists (select 1 from profiles where id = _target_user_id and system_role <> 'pending') then
    raise exception 'A tag nem található.';
  end if;
  if not exists (select 1 from ribbons where id = _ribbon_id) then raise exception 'A kitüntetés nem található.'; end if;

  -- The notification is sent by the user_ribbons trigger.
  insert into user_ribbons (user_id, ribbon_id, awarded_by) values (_target_user_id, _ribbon_id, auth.uid());
end;
$$;

-- Kept for the currently deployed client; the new client uses /api/admin/update-role.
create or replace function public.hr_update_user_profile_v2(
  _target_user_id uuid, _full_name text, _badge_number text, _faction_rank text,
  _division text, _division_rank text, _qualifications text[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _editor profiles%rowtype;
  _target profiles%rowtype;
  _new_quals text[] := coalesce(_qualifications, '{}');
  _old_quals text[];
  _changed text;
begin
  _editor := private.me();
  select * into _target from profiles where id = _target_user_id;
  if _editor.id is null then raise exception 'Nincs jogosultságod módosításokat végezni.' using errcode = '42501'; end if;
  if _target.id is null then raise exception 'A felhasználó nem található.'; end if;
  if _editor.id = _target.id and not coalesce(_editor.is_bureau_manager, false) then
    raise exception 'A saját adataidat itt nem módosíthatod.' using errcode = '42501';
  end if;
  if (coalesce(_target.is_bureau_manager, false) or coalesce(_target.is_bureau_commander, false))
     and not coalesce(_editor.is_bureau_manager, false) then
    raise exception 'A Bureau vezetőségét csak a Manager módosíthatja.' using errcode = '42501';
  end if;

  if (_full_name is distinct from _target.full_name or _badge_number is distinct from _target.badge_number)
     and not private.can_manage_user_rank(_editor, _target) then
    raise exception 'Nincs jogosultságod a név vagy a jelvényszám módosításához.' using errcode = '42501';
  end if;
  if _badge_number is distinct from _target.badge_number and _badge_number !~ '^\d{4}$' then
    raise exception 'A jelvényszám pontosan 4 számjegy.';
  end if;

  if _faction_rank is distinct from _target.faction_rank then
    if private.rank_index(_faction_rank) = 999 then raise exception 'Ismeretlen rendfokozat.'; end if;
    if not private.can_manage_user_rank(_editor, _target)
       or not (_faction_rank = any(private.allowed_promotion_ranks(_editor))) then
      raise exception 'Nincs jogosultságod kiosztani a(z) % rangot.', _faction_rank using errcode = '42501';
    end if;
  end if;

  if (_division is distinct from _target.division or _division_rank is distinct from _target.division_rank)
     and not private.can_manage_user_division(_editor, _target) then
    raise exception 'Nincs jogosultságod az osztály módosításához.' using errcode = '42501';
  end if;

  _old_quals := coalesce(_target.qualifications, '{}');
  for _changed in
    select q from unnest(_new_quals) q where not (q = any(_old_quals))
    union
    select q from unnest(_old_quals) q where not (q = any(_new_quals))
  loop
    if not private.can_manage_user_qualification(_editor, _target, _changed) then
      raise exception 'Nincs jogosultságod a(z) % képesítés módosításához.', _changed using errcode = '42501';
    end if;
  end loop;

  update profiles set
    full_name = coalesce(nullif(trim(_full_name), ''), full_name),
    badge_number = _badge_number,
    faction_rank = _faction_rank,
    system_role = case when system_role = 'pending' then system_role else private.system_role_for_rank(_faction_rank) end,
    last_promotion_date = case when _faction_rank is distinct from faction_rank then now() else last_promotion_date end,
    division = _division,
    division_rank = case when _division = 'TSB' then null else _division_rank end,
    qualifications = _new_quals
  where id = _target_user_id;
end;
$$;

-- send_hr_notification was callable by anyone (even anonymously) to message any member.
drop function if exists public.send_hr_notification(uuid, text, text);
drop function if exists public.has_grading_rights(uuid) cascade;

grant execute on function
  public.admin_assign_exam(uuid, uuid),
  public.claim_exam_submission(text),
  public.complete_onboarding(),
  public.change_user_name(text),
  public.delete_full_exam(uuid),
  public.delete_suspect_safely(uuid),
  public.hr_give_award(uuid, uuid),
  public.hr_update_user_profile_v2(uuid, text, text, text, text, text, text[])
to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Table privileges
-- ---------------------------------------------------------------------------

-- Profiles are written by the API (service role) and SECURITY DEFINER functions only;
-- members may change their own avatar.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (avatar_url) on public.profiles to authenticated;

-- Notifications are created by triggers and the API; members may only mark them read.
revoke all on public.notifications from anon;
revoke insert, update on public.notifications from authenticated;
grant update (is_read) on public.notifications to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Row Level Security: replace every public policy with a coherent set
-- ---------------------------------------------------------------------------

do $$
declare
  _policy record;
begin
  for _policy in select tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', _policy.policyname, _policy.tablename);
  end loop;
end;
$$;

-- profiles: members see the roster; pending registrations only see themselves.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_member()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- system_status: public (login page shows recruitment state), staff manage.
create policy system_status_select on public.system_status for select to anon, authenticated using (true);
create policy system_status_insert on public.system_status for insert to authenticated
  with check ((select private.is_staff()));
create policy system_status_update on public.system_status for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy system_status_delete on public.system_status for delete to authenticated
  using ((select private.is_staff()));

-- notifications: own rows only.
create policy notifications_select_own on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update_own on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete_own on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

-- action_logs (dashboard activity feed).
create policy action_logs_select on public.action_logs for select to authenticated
  using ((select private.is_member()));
create policy action_logs_insert_own on public.action_logs for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_member()));

-- announcements.
create policy announcements_select on public.announcements for select to authenticated
  using ((select private.is_member()));
create policy announcements_insert on public.announcements for insert to authenticated
  with check ((select private.is_staff()) and created_by = (select auth.uid()));
create policy announcements_update on public.announcements for update to authenticated
  using (created_by = (select auth.uid()) or (select private.is_admin()))
  with check (created_by = (select auth.uid()) or (select private.is_admin()));
create policy announcements_delete on public.announcements for delete to authenticated
  using (created_by = (select auth.uid()) or (select private.is_admin()));

-- ribbons and awards.
create policy ribbons_select on public.ribbons for select to authenticated using ((select private.is_member()));
create policy ribbons_insert on public.ribbons for insert to authenticated
  with check ((select private.is_executive_or_manager()));
create policy ribbons_update on public.ribbons for update to authenticated
  using ((select private.is_executive_or_manager())) with check ((select private.is_executive_or_manager()));
create policy ribbons_delete on public.ribbons for delete to authenticated
  using ((select private.is_executive_or_manager()));
create policy user_ribbons_select on public.user_ribbons for select to authenticated
  using ((select private.is_member()));
create policy user_ribbons_delete on public.user_ribbons for delete to authenticated
  using ((select private.is_executive_or_manager()));

create policy name_change_logs_select on public.name_change_logs for select to authenticated
  using ((select private.is_member()));

-- logistics and finance requests.
create policy vehicle_requests_select on public.vehicle_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));
create policy vehicle_requests_insert_own on public.vehicle_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_member())
              and coalesce(status, 'pending') = 'pending' and processed_by is null);
create policy vehicle_requests_update_staff on public.vehicle_requests for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

create policy budget_requests_select on public.budget_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy budget_requests_insert_own on public.budget_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_member())
              and coalesce(status, 'pending') = 'pending' and processed_by is null);
create policy budget_requests_update_admin on public.budget_requests for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- academy.
create policy academy_courses_select on public.academy_courses for select to authenticated
  using ((select private.is_member()));
create policy academy_courses_insert on public.academy_courses for insert to authenticated
  with check ((select private.is_academy_instructor()));
create policy academy_courses_update on public.academy_courses for update to authenticated
  using ((select private.is_academy_instructor())) with check ((select private.is_academy_instructor()));
create policy academy_courses_delete on public.academy_courses for delete to authenticated
  using ((select private.is_academy_instructor()));

create policy academy_materials_select on public.academy_materials for select to authenticated
  using ((select private.is_member()));
create policy academy_materials_insert on public.academy_materials for insert to authenticated
  with check ((select private.is_academy_instructor()));
create policy academy_materials_update on public.academy_materials for update to authenticated
  using ((select private.is_academy_instructor())) with check ((select private.is_academy_instructor()));
create policy academy_materials_delete on public.academy_materials for delete to authenticated
  using ((select private.is_academy_instructor()));

create policy academy_division_materials_select on public.academy_division_materials for select to authenticated
  using ((select private.is_member()));
create policy academy_division_materials_insert on public.academy_division_materials for insert to authenticated
  with check ((select private.is_academy_instructor()));
create policy academy_division_materials_update on public.academy_division_materials for update to authenticated
  using ((select private.is_academy_instructor())) with check ((select private.is_academy_instructor()));
create policy academy_division_materials_delete on public.academy_division_materials for delete to authenticated
  using ((select private.is_academy_instructor()));

create policy academy_cycles_select on public.academy_cycles for select to authenticated
  using ((select private.is_member()));
create policy academy_cycles_insert on public.academy_cycles for insert to authenticated
  with check ((select private.is_academy_instructor()));
create policy academy_cycles_update on public.academy_cycles for update to authenticated
  using ((select private.is_academy_instructor())) with check ((select private.is_academy_instructor()));
create policy academy_cycles_delete on public.academy_cycles for delete to authenticated
  using ((select private.is_academy_instructor()));

create policy academy_students_select on public.academy_students for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_academy_instructor()));
create policy academy_students_insert on public.academy_students for insert to authenticated
  with check ((select private.is_academy_instructor()));
create policy academy_students_update on public.academy_students for update to authenticated
  using ((select private.is_academy_instructor())) with check ((select private.is_academy_instructor()));
create policy academy_students_delete on public.academy_students for delete to authenticated
  using ((select private.is_academy_instructor()));

create policy academy_logs_select on public.academy_logs for select to authenticated
  using (student_id = (select auth.uid()) or (select private.is_academy_instructor()));
create policy academy_logs_insert on public.academy_logs for insert to authenticated
  with check ((select private.is_academy_instructor()));
create policy academy_logs_update on public.academy_logs for update to authenticated
  using ((select private.is_academy_instructor())) with check ((select private.is_academy_instructor()));
create policy academy_logs_delete on public.academy_logs for delete to authenticated
  using ((select private.is_academy_instructor()));

create policy academy_progress_select on public.academy_progress for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_academy_instructor()));
create policy academy_progress_insert_own on public.academy_progress for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_member()));

-- MCB: cases and everything attached to them.
create policy cases_select on public.cases for select to authenticated
  using ((select private.can_view_cases()) or private.is_case_participant(id));
create policy cases_insert on public.cases for insert to authenticated
  with check ((select private.can_view_cases()) and owner_id = (select auth.uid()));
create policy cases_update on public.cases for update to authenticated
  using (private.can_edit_case(id)) with check (private.can_edit_case(id));

create policy case_collaborators_select on public.case_collaborators for select to authenticated
  using ((select private.is_member()));
create policy case_collaborators_insert on public.case_collaborators for insert to authenticated
  with check ((select private.is_member())
              and (exists (select 1 from public.cases c where c.id = case_id and c.owner_id = (select auth.uid()))
                   or (select private.is_staff())));
create policy case_collaborators_delete on public.case_collaborators for delete to authenticated
  using ((select private.is_member())
         and (exists (select 1 from public.cases c where c.id = case_id and c.owner_id = (select auth.uid()))
              or (select private.is_staff())));

create policy case_evidence_select on public.case_evidence for select to authenticated
  using (exists (select 1 from public.cases c where c.id = case_id));
create policy case_evidence_insert on public.case_evidence for insert to authenticated
  with check (exists (select 1 from public.cases c where c.id = case_id)
              and (uploaded_by is null or uploaded_by = (select auth.uid())));
create policy case_evidence_delete on public.case_evidence for delete to authenticated
  using (exists (select 1 from public.cases c where c.id = case_id)
         and (uploaded_by = (select auth.uid()) or private.can_edit_case(case_id) or (select private.is_staff())));

create policy case_notes_select on public.case_notes for select to authenticated
  using (exists (select 1 from public.cases c where c.id = case_id));
create policy case_notes_insert on public.case_notes for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.cases c where c.id = case_id));
create policy case_notes_delete on public.case_notes for delete to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));

create policy case_suspects_select on public.case_suspects for select to authenticated
  using (exists (select 1 from public.cases c where c.id = case_id));
create policy case_suspects_insert on public.case_suspects for insert to authenticated
  with check (exists (select 1 from public.cases c where c.id = case_id));
create policy case_suspects_update on public.case_suspects for update to authenticated
  using (exists (select 1 from public.cases c where c.id = case_id)) with check (exists (select 1 from public.cases c where c.id = case_id));
create policy case_suspects_delete on public.case_suspects for delete to authenticated
  using (exists (select 1 from public.cases c where c.id = case_id));

create policy case_warrants_select on public.case_warrants for select to authenticated
  using (exists (select 1 from public.cases c where c.id = case_id));
create policy case_warrants_insert on public.case_warrants for insert to authenticated
  with check (exists (select 1 from public.cases c where c.id = case_id)
              and requested_by = (select auth.uid())
              and coalesce(status, 'pending') = 'pending' and approved_by is null);
create policy case_warrants_update on public.case_warrants for update to authenticated
  using ((select private.can_approve_warrants())) with check ((select private.can_approve_warrants()));

-- Suspect database: readable by members, maintained by MCB and staff.
create policy suspects_select on public.suspects for select to authenticated using ((select private.is_member()));
create policy suspects_insert on public.suspects for insert to authenticated
  with check ((select private.can_view_cases()));
create policy suspects_update on public.suspects for update to authenticated
  using ((select private.can_view_cases())) with check ((select private.can_view_cases()));
create policy suspects_delete on public.suspects for delete to authenticated
  using ((select private.can_view_cases()));
create policy suspect_vehicles_select on public.suspect_vehicles for select to authenticated using ((select private.is_member()));
create policy suspect_vehicles_insert on public.suspect_vehicles for insert to authenticated
  with check ((select private.can_view_cases()));
create policy suspect_vehicles_update on public.suspect_vehicles for update to authenticated
  using ((select private.can_view_cases())) with check ((select private.can_view_cases()));
create policy suspect_vehicles_delete on public.suspect_vehicles for delete to authenticated
  using ((select private.can_view_cases()));
create policy suspect_properties_select on public.suspect_properties for select to authenticated using ((select private.is_member()));
create policy suspect_properties_insert on public.suspect_properties for insert to authenticated
  with check ((select private.can_view_cases()));
create policy suspect_properties_update on public.suspect_properties for update to authenticated
  using ((select private.can_view_cases())) with check ((select private.can_view_cases()));
create policy suspect_properties_delete on public.suspect_properties for delete to authenticated
  using ((select private.can_view_cases()));
create policy suspect_associates_select on public.suspect_associates for select to authenticated using ((select private.is_member()));
create policy suspect_associates_insert on public.suspect_associates for insert to authenticated
  with check ((select private.can_view_cases()));
create policy suspect_associates_update on public.suspect_associates for update to authenticated
  using ((select private.can_view_cases())) with check ((select private.can_view_cases()));
create policy suspect_associates_delete on public.suspect_associates for delete to authenticated
  using ((select private.can_view_cases()));

-- Exams.
create policy exams_select on public.exams for select to anon, authenticated
  using (is_public or (select private.is_member()));
create policy exams_insert on public.exams for insert to authenticated
  with check (private.can_manage_exam_content(type, division));
create policy exams_update on public.exams for update to authenticated
  using (private.can_manage_exam_content(type, division))
  with check (private.can_manage_exam_content(type, division));
create policy exams_delete on public.exams for delete to authenticated
  using (private.can_delete_exam(division));

create policy exam_questions_select on public.exam_questions for select to anon, authenticated
  using (exists (select 1 from public.exams e where e.id = exam_id));
create policy exam_questions_insert on public.exam_questions for insert to authenticated
  with check (exists (select 1 from public.exams e where e.id = exam_id and private.can_manage_exam_content(e.type, e.division)));
create policy exam_questions_update on public.exam_questions for update to authenticated
  using (exists (select 1 from public.exams e where e.id = exam_id and private.can_manage_exam_content(e.type, e.division))) with check (exists (select 1 from public.exams e where e.id = exam_id and private.can_manage_exam_content(e.type, e.division)));
create policy exam_questions_delete on public.exam_questions for delete to authenticated
  using (exists (select 1 from public.exams e where e.id = exam_id and private.can_manage_exam_content(e.type, e.division)));

create policy exam_options_select on public.exam_options for select to anon, authenticated
  using (exists (select 1 from public.exam_questions q where q.id = question_id));
create policy exam_options_insert on public.exam_options for insert to authenticated
  with check (exists (select 1 from public.exam_questions q join public.exams e on e.id = q.exam_id
                      where q.id = question_id and private.can_manage_exam_content(e.type, e.division)));
create policy exam_options_update on public.exam_options for update to authenticated
  using (exists (select 1 from public.exam_questions q join public.exams e on e.id = q.exam_id
                 where q.id = question_id and private.can_manage_exam_content(e.type, e.division))) with check (exists (select 1 from public.exam_questions q join public.exams e on e.id = q.exam_id
                      where q.id = question_id and private.can_manage_exam_content(e.type, e.division)));
create policy exam_options_delete on public.exam_options for delete to authenticated
  using (exists (select 1 from public.exam_questions q join public.exams e on e.id = q.exam_id
                 where q.id = question_id and private.can_manage_exam_content(e.type, e.division)));

create policy exam_overrides_select on public.exam_overrides for select to authenticated
  using (user_id = (select auth.uid())
         or exists (select 1 from public.exams e where e.id = exam_id and private.can_manage_exam_access(e.type, e.division)));
create policy exam_overrides_insert on public.exam_overrides for insert to authenticated
  with check (granted_by = (select auth.uid())
              and exists (select 1 from public.exams e where e.id = exam_id and private.can_manage_exam_access(e.type, e.division)));
create policy exam_overrides_delete on public.exam_overrides for delete to authenticated
  using (exists (select 1 from public.exams e where e.id = exam_id and private.can_manage_exam_access(e.type, e.division)));

-- Submissions: candidates see their own, graders the ones they may grade. The direct
-- user_id check matters: has_grading_rights() looks the row up by id, which does not see
-- a row inserted by the same statement, so INSERT ... RETURNING (deployed client) needs it.
create policy exam_submissions_select on public.exam_submissions for select to authenticated
  using (user_id = (select auth.uid()) or private.has_grading_rights(id));
-- The deployed client reads back a guest submission right after inserting it.
-- Replaced by the submit_exam RPC; removed in supabase/post-deploy/.
create policy exam_submissions_select_recent_guest on public.exam_submissions for select to anon
  using (user_id is null and start_time > now() - interval '6 hours');
create policy exam_submissions_insert on public.exam_submissions for insert to anon, authenticated
  with check (
    coalesce(status, 'pending') = 'pending' and coalesce(total_score, 0) = 0
    and graded_by is null and graded_at is null and grading_notes is null
    and retry_allowed_at is null and not coalesce(feedback_visible, false)
    and (
      (user_id is null and exists (select 1 from public.exams e where e.id = exam_id and e.is_public and e.is_active))
      or (user_id = (select auth.uid())
          and exists (select 1 from public.exams e where e.id = exam_id and e.is_active
                      and (e.is_public or (select private.is_member()))))
    ));
create policy exam_submissions_update on public.exam_submissions for update to authenticated
  using (private.can_grade_submission(id)) with check (private.can_grade_submission(id));

create policy exam_answers_select on public.exam_answers for select to authenticated
  using (private.has_grading_rights(submission_id));
create policy exam_answers_insert on public.exam_answers for insert to anon, authenticated
  with check (
    (coalesce(points_awarded, 0) = 0 and exists (
      select 1 from public.exam_submissions s
      where s.id = submission_id and s.status = 'pending' and s.graded_at is null
        and ((s.user_id is not null and s.user_id = (select auth.uid()))
             or (s.user_id is null and s.start_time > now() - interval '6 hours'))))
    -- Graders save points with an upsert, which checks the INSERT policy as well.
    or private.can_grade_submission(submission_id));
create policy exam_answers_update on public.exam_answers for update to authenticated
  using (private.can_grade_submission(submission_id)) with check (private.can_grade_submission(submission_id));

-- ---------------------------------------------------------------------------
-- 5. Storage: private buckets, signed URLs only (the client already uses them)
-- ---------------------------------------------------------------------------

update storage.buckets set public = false where id in ('finance_proofs', 'case_evidence');

drop policy if exists "Admins can delete proof" on storage.objects;
drop policy if exists "Anyone can upload proof" on storage.objects;
drop policy if exists "Anyone can view proof" on storage.objects;
drop policy if exists "Evidence Delete" on storage.objects;
drop policy if exists "Evidence Upload" on storage.objects;
drop policy if exists "Evidence View" on storage.objects;

-- Proof files are named "<uploader id>_<timestamp>_<random>.<ext>".
create policy finance_proofs_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'finance_proofs' and (select private.is_member())
              and starts_with(name, (select auth.uid())::text || '_'));
create policy finance_proofs_select on storage.objects for select to authenticated
  using (bucket_id = 'finance_proofs'
         and (starts_with(name, (select auth.uid())::text || '_') or (select private.is_admin())));
create policy finance_proofs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'finance_proofs'
         and (starts_with(name, (select auth.uid())::text || '_') or (select private.is_admin())));

-- Legacy case evidence (new evidence lives on Cloudinary).
create policy case_evidence_files_select on storage.objects for select to authenticated
  using (bucket_id = 'case_evidence' and (select private.is_member()));
create policy case_evidence_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'case_evidence' and (select private.can_view_cases()));
create policy case_evidence_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'case_evidence' and (select private.can_view_cases()));

-- ---------------------------------------------------------------------------
-- 6. Realtime: the client listens to these tables, but only notifications were published
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table only public.profiles;
alter publication supabase_realtime add table only public.system_status;
alter publication supabase_realtime add table only public.case_notes;
alter publication supabase_realtime add table only public.case_warrants;
