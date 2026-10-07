-- =============================================================================
-- Linking a guest exam with its code (onboarding) also linked every unclaimed sheet of the last month
-- that carried the same applicant name. A name is typed freely, so anyone who knew another applicant's
-- name could sit an exam under it and, with their own code, take over the other person's sheets, a
-- passed admission exam included. A passed or not yet graded sheet now comes only with its own code;
-- earlier failed attempts under the same name still come along (the history of retakes).
-- =============================================================================

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
     -- Earlier failed attempts under the same name come along; a name proves nothing, so a passed or
     -- ungraded sheet only with its own code.
     or (user_id is null and status = 'failed'
         and _submission.applicant_name is not null and _submission.applicant_name <> ''
         and applicant_name = _submission.applicant_name
         and start_time >= now() - interval '1 month');

  return json_build_object('success', true, 'message', 'Vizsga és a korábbi próbálkozások sikeresen csatolva a profilhoz!');
end;
$$;
