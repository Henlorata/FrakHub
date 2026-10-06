-- =============================================================================
-- Fixes found while testing the site:
--   1. A nominated member who could decide nominations (the bureau manager) was told
--      about their own nomination; the nominee is never notified.
--   2. Undoing a promotion right away reopened the nomination but left the nominator's
--      "accepted" notification behind.
--   3. The activity reminder's text used "2026.09." and "24.7 óra"; it now matches the
--      preview of the HR page ("2026. szeptember", "24 ó 38 p").
--   4. The editor who publishes a must-read policy no longer has to acknowledge it.
--   5. The organisers of an anonymous poll saw the running counts even when the results
--      open after the close, which can give single votes away; they now see what the
--      members see (named polls keep the live view for the organisers).
--   6. get_dashboard_summary() returns the member's joining day of the HR registry, so the
--      dashboard counts the service time like the profile and the roster; the monthly recap
--      is not offered to members who joined this month (it would be all zeros).
--   7. The leaderboard's places are counted among the members who opted in only.
--   8. Related-case suggestions leave out the referenced cases before choosing the six shown.
--   9. Anonymous feedback notifications open the right part of the feedback tab.
--
-- Compatible with the deployed frontend: same signatures, get_dashboard_summary() only
-- gains a key.
-- =============================================================================

-- 1. ---------------------------------------------------------------------------
create or replace function public.nominate_for_promotion(_user_id uuid, _reason text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _me public.profiles%rowtype := private.me();
  _target public.profiles%rowtype;
  _text text := btrim(coalesce(_reason, ''));
  _row public.promotion_nominations%rowtype;
begin
  if _me.id is null or not private.is_staff() then
    raise exception 'Előléptetést a felügyelő állomány javasolhat.' using errcode = '42501';
  end if;
  select * into _target from public.profiles where id = _user_id;
  if _target.id is null or _target.system_role = 'pending' then raise exception 'A tag nem található.' using errcode = 'P0002'; end if;
  if _target.id = _me.id then raise exception 'Saját magadat nem javasolhatod.' using errcode = '22023'; end if;
  if private.rank_index(_target.faction_rank) = 0 then raise exception 'A tag a legmagasabb rendfokozatban van.' using errcode = '22023'; end if;
  if private.rank_index(_target.faction_rank) >= 16 then
    raise exception 'Az újoncok előléptetését az Újoncok lapon követheted.' using errcode = '22023';
  end if;
  if not (coalesce(_me.is_bureau_manager, false) or private.rank_index(_me.faction_rank) < private.rank_index(_target.faction_rank)) then
    raise exception 'Csak nálad alacsonyabb rangú tagot javasolhatsz.' using errcode = '42501';
  end if;
  if char_length(_text) < 10 then raise exception 'Írd le röviden, miért javaslod (legalább 10 karakter).' using errcode = '22023'; end if;

  begin
    insert into public.promotion_nominations (user_id, from_rank, to_rank, reason, nominated_by)
    values (_target.id, _target.faction_rank, private.rank_name(private.rank_index(_target.faction_rank) - 1), left(_text, 1000), _me.id)
    returning * into _row;
  exception when unique_violation then
    raise exception 'Ennek a tagnak már van függő javaslata.' using errcode = '23505';
  end;

  -- The nominee never learns about it (not even when they could decide nominations themselves).
  perform private.notify(array_remove(private.promotion_approver_ids(_row.to_rank), _target.id), 'Előléptetési javaslat',
    format('%s: %s → %s (javasolta: %s)', _target.full_name, _row.from_rank, _row.to_rank, _me.full_name),
    'info', 'hr', '/hr?tab=promotions', 'promotion-nominations');
  return private.nomination_json(_row);
end;
$$;

-- 2. ---------------------------------------------------------------------------
create or replace function private.on_rank_change_progression()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _actor uuid := private.actor_id();
  _n record;
begin
  if new.faction_rank is not distinct from old.faction_rank or new.system_role = 'pending' then return new; end if;

  -- "Undo" right after a promotion puts the nomination back on the list and takes back the
  -- nominator's "accepted" notification.
  for _n in
    update public.promotion_nominations set status = 'pending', decided_by = null, decided_at = null
    where user_id = new.id and status = 'approved' and to_rank = old.faction_rank and from_rank = new.faction_rank
      and decided_at > now() - interval '10 minutes'
    returning id
  loop
    delete from public.notifications where dedupe_key = 'nomination:' || _n.id;
  end loop;

  for _n in
    update public.promotion_nominations set status = 'approved', decided_by = _actor, decided_at = now()
    where user_id = new.id and status = 'pending' and to_rank = new.faction_rank
    returning id, nominated_by, to_rank
  loop
    if _n.nominated_by is not null and _n.nominated_by is distinct from _actor then
      perform private.notify(array[_n.nominated_by], 'Elfogadták a javaslatodat',
        format('%s előléptetve: %s.', new.full_name, _n.to_rank), 'success', 'hr', '/hr?tab=promotions', 'nomination:' || _n.id);
    end if;
  end loop;

  update public.promotion_nominations set status = 'withdrawn', decided_at = now(), decision_note = 'A rendfokozat közben megváltozott.'
  where user_id = new.id and status = 'pending' and from_rank <> new.faction_rank and to_rank <> new.faction_rank;

  if old.faction_rank = 'Deputy Sheriff Trainee' then
    update public.trainee_mentors set completed_at = now() where trainee_id = new.id and completed_at is null;
  elsif new.faction_rank = 'Deputy Sheriff Trainee' then
    update public.trainee_mentors set completed_at = null where trainee_id = new.id;
  end if;
  return new;
end;
$$;

-- 3. ---------------------------------------------------------------------------
-- Minutes as the site shows them ("24 ó 38 p").
create or replace function private.duty_text(_minutes integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select format('%s ó %s p', coalesce(_minutes, 0) / 60, lpad((coalesce(_minutes, 0) % 60)::text, 2, '0'))
$$;

-- "2026. szeptember" (the month names do not depend on the database locale).
create or replace function private.month_text(_month date)
returns text
language sql
immutable
set search_path = ''
as $$
  select format('%s. %s', extract(year from _month)::int,
    (array['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október',
           'november', 'december'])[extract(month from _month)::int])
$$;

create or replace function public.send_activity_reminder(_user_id uuid, _note text default null)
returns json
language plpgsql
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _m1 date := ((date_trunc('month', current_date::timestamp)) - interval '1 month')::date;
  _minutes integer;
  _min integer := coalesce((select min_duty_hours from public.payroll_settings where id = 'global'), 0);
begin
  if not (private.is_staff() and private.can_manage_member(_user_id)) then
    raise exception 'Emlékeztetőt a tag felettesei küldhetnek.' using errcode = '42501';
  end if;
  if exists (select 1 from public.activity_reviews where user_id = _user_id and month = _m1 and action = 'reminded') then
    raise exception 'Erre a hónapra már ment emlékeztető.' using errcode = '22023';
  end if;
  select minutes into _minutes from public.duty_time_entries where user_id = _user_id and month = _m1;
  insert into public.activity_reviews (user_id, month, action, note, created_by)
  values (_user_id, _m1, 'reminded', nullif(left(btrim(coalesce(_note, '')), 200), ''), (select auth.uid()))
  on conflict (user_id, month) do update set action = 'reminded', note = excluded.note, created_by = excluded.created_by, created_at = now();
  -- The same text as the preview on the HR page.
  perform private.notify(array[_user_id], 'Hiányzunk egymásnak',
    format('%s havi rögzített duty időd %s (a minimum %s). Ha most nem tudsz szolgálatot vállalni, jelezz szabadságot a profilodon; ha bármi gond van, szólj a feletteseidnek.',
           private.month_text(_m1), private.duty_text(coalesce(_minutes, 0)), private.duty_text(_min * 60)),
    'info', 'hr', '/profile?leave=1', 'activity-reminder');
  return json_build_object('review', 'reminded');
end;
$$;

-- 4. ---------------------------------------------------------------------------
create or replace function public.publish_policy(_id uuid, _change_note text default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _row public.policies%rowtype;
  _first boolean;
begin
  if not private.can_edit_policies() then raise exception 'A szabályzatokat a parancsnokság teszi közzé.' using errcode = '42501'; end if;
  select * into _row from public.policies where id = _id for update;
  if _row.id is null then raise exception 'A szabályzat nem található.' using errcode = 'P0002'; end if;
  if jsonb_array_length(_row.body) = 0 then raise exception 'Üres szabályzatot nem lehet közzétenni.' using errcode = '22023'; end if;
  _first := _row.version = 0;
  update public.policies set version = version + 1, status = 'published', published_at = now(), updated_at = now(),
    updated_by = (select auth.uid())
  where id = _id returning * into _row;
  insert into public.policy_versions (policy_id, version, title, summary, body, change_note, requires_ack, published_by)
  values (_id, _row.version, _row.title, _row.summary, _row.body, nullif(left(btrim(coalesce(_change_note, '')), 300), ''),
          _row.requires_ack, (select auth.uid()));
  -- Whoever publishes it has read it.
  if _row.requires_ack then
    insert into public.policy_acknowledgements (policy_id, user_id, version)
    values (_id, (select auth.uid()), _row.version)
    on conflict (policy_id, user_id) do update set version = excluded.version, acknowledged_at = now();
  end if;
  if _row.requires_ack or _first then
    perform private.notify(private.member_ids(),
      case when _first then 'Új szabályzat: ' || _row.title else 'Módosult: ' || _row.title end,
      case when _row.requires_ack then 'Olvasd el, és jelezd, hogy megismerted.' else coalesce(_row.summary, 'Megtalálod a Szabályzatok között.') end,
      case when _row.requires_ack then 'warning' else 'info' end, 'community', '/policies?id=' || _id, 'policy:' || _id);
  end if;
  return json_build_object('id', _row.id, 'version', _row.version, 'published_at', _row.published_at);
end;
$$;

-- 5. ---------------------------------------------------------------------------
create or replace function public.get_polls()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _me uuid := (select auth.uid());
begin
  if not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  return (
    select coalesce(json_agg(row_to_json(x) order by x.open desc, x.closes_at desc), '[]'::json)
    from (
      select p.id, p.title, p.description, p.audience, p.anonymous, p.max_choices, p.results, p.closes_at, p.closed_at, p.created_at,
             p.created_by, (select full_name from public.profiles where id = p.created_by) as created_by_name,
             (p.closed_at is null and p.closes_at > now()) as open,
             v.voted, m.manage as can_manage,
             (select count(*) from public.poll_voters pv where pv.poll_id = p.id) as voters,
             cardinality(private.event_audience_ids(p.audience)) as audience_size,
             s.show as results_visible,
             (select coalesce(json_agg(json_build_object(
                'id', o.id, 'label', o.label,
                'votes', case when s.show then (select count(*) from public.poll_votes pv where pv.option_id = o.id) end,
                'mine', case when not p.anonymous then exists (select 1 from public.poll_votes pv where pv.option_id = o.id and pv.user_id = _me) end,
                'voters', case when s.show and not p.anonymous then (
                  select coalesce(json_agg(json_build_object('full_name', pr.full_name, 'avatar_url', pr.avatar_url) order by pr.full_name), '[]'::json)
                  from public.poll_votes pv join public.profiles pr on pr.id = pv.user_id where pv.option_id = o.id) end
              ) order by o.sort_order), '[]'::json)
              from public.poll_options o where o.poll_id = p.id) as options
      from public.polls p
      cross join lateral (select exists (select 1 from public.poll_voters pv where pv.poll_id = p.id and pv.user_id = _me) as voted) v
      cross join lateral (select (p.created_by = _me or private.can_manage_event(p.audience)) as manage) m
      -- The organisers follow a named poll live; an anonymous one opens for them like for everyone
      -- (watching the counts move would give single votes away).
      cross join lateral (select (p.results = 'live' or (p.results = 'after_vote' and v.voted) or p.closed_at is not null
                                  or p.closes_at <= now() or (m.manage and not p.anonymous)) as show) s
      where private.can_see_event(p.audience) and (p.closed_at is null or p.closed_at > now() - interval '90 days')
        and p.closes_at > now() - interval '90 days'
    ) x);
end;
$$;

-- 6. ---------------------------------------------------------------------------
create or replace function public.get_dashboard_summary()
returns json
language plpgsql
stable
security definer
set search_path = public, pg_temp
set timezone = 'Europe/Budapest'
as $$
declare
  _me profiles%rowtype := private.me();
  _staff boolean;
  _admin boolean;
  _coach boolean;
  _month date := date_trunc('month', current_date)::date;
  _prev date := (date_trunc('month', current_date) - interval '1 month')::date;
  _duty integer;
begin
  if _me.id is null then
    raise exception 'Nincs jogosultságod.' using errcode = '42501';
  end if;
  _staff := private.is_staff();
  _admin := private.is_admin();
  _coach := private.can_coach_trainees();
  select minutes into _duty from duty_time_entries where user_id = _me.id and month = _month;

  return json_build_object(
    'unread_notifications', (select count(*) from notifications where user_id = _me.id and not is_read),
    'pending_exam_sheets', (select count(*) from exam_submissions s
                            where s.status = 'pending' and s.deleted_at is null
                              and s.user_id is distinct from _me.id and private.has_grading_rights(s.id)),
    'pending_registrations', case when _staff then (select count(*) from profiles where system_role = 'pending') end,
    'pending_leave_requests', case when _staff then
      (select count(*) from hr_records where kind = 'leave' and status = 'pending' and user_id <> _me.id) end,
    'pending_vehicle_requests', case when _staff then (select count(*) from vehicle_requests where status = 'pending') end,
    'pending_budget_requests', case when _admin then (select count(*) from budget_requests where status = 'pending') end,
    -- Requests and renewals waiting for an approver.
    'pending_warrants', case when private.can_approve_warrants() then
      (select count(*) from case_warrants where status = 'pending' or (status = 'approved' and renewal_requested_at is not null)) end,
    'my_open_cases', case when private.can_view_cases() or exists (select 1 from case_collaborators where user_id = _me.id) then
      (select count(*) from cases c where c.status = 'open'
         and (c.owner_id = _me.id or exists (select 1 from case_collaborators cc where cc.case_id = c.id and cc.user_id = _me.id))) end,
    'my_pending_requests', (select count(*) from vehicle_requests where user_id = _me.id and status = 'pending')
                           + (select count(*) from budget_requests where user_id = _me.id and status = 'pending'),
    'my_active_warnings', (select count(*) from hr_records where user_id = _me.id and kind = 'warning' and status = 'active'),
    'my_vehicle_warnings', (select count(*) from vehicle_warnings
                            where user_id = _me.id and revoked_at is null and converted_record_id is null),
    'my_vehicles_due', (select count(*) from fleet_vehicles v
                        where v.is_active and v.registration_required
                          and exists (select 1 from fleet_assignments a where a.vehicle_id = v.id and a.user_id = _me.id)
                          and (v.registration_expires_on is null or v.registration_expires_on <= current_date + 3)
                          and not exists (select 1 from fleet_registration_requests r
                                          where r.vehicle_id = v.id and r.status = 'pending')),
    'fleet_registration_due', case when _staff then
      (select count(*) from fleet_vehicles
       where is_active and registration_required and registration_expires_on is not null
         and registration_expires_on <= current_date + 3) end,
    'fleet_registration_reviews', case when _staff then
      (select count(*) from fleet_registration_requests where status = 'pending') end,
    'members_total', (select count(*) from profiles where system_role <> 'pending'),
    'members_on_leave', (select count(*) from hr_records where kind = 'leave' and status = 'active'
                           and current_date between starts_on and ends_on),
    -- The member's month against the requirements (duty time is recorded by staff at the meetings).
    'my_month', json_build_object(
      'month', _month,
      'reports', (select count(*) from report_logs where user_id = _me.id and month = _month),
      'duty_minutes', _duty,
      'duty_updated_at', (select updated_at from duty_time_entries where user_id = _me.id and month = _month),
      'min_reports', (select min_reports from payroll_settings where id = 'global'),
      'min_duty_hours', (select min_duty_hours from payroll_settings where id = 'global'),
      -- The next duty tier above the recorded time: its hours and the extra pay it brings.
      'next_tier', (select json_build_object('hours', (t ->> 'hours')::int,
                                             'gain', (t ->> 'pay')::bigint
                                                     - coalesce((select max((x ->> 'pay')::bigint) from jsonb_array_elements(s.duty_tiers) x
                                                                 where (x ->> 'hours')::int * 60 <= coalesce(_duty, 0)), 0))
                    from payroll_settings s cross join lateral jsonb_array_elements(s.duty_tiers) t
                    where s.id = 'global' and (t ->> 'hours')::int * 60 > coalesce(_duty, 0)
                    order by (t ->> 'hours')::int limit 1)),
    -- The next events the member sees (within two weeks; ongoing ones stay for three hours).
    'upcoming_events', (
      select coalesce(json_agg(row_to_json(x) order by x.starts_at), '[]'::json)
      from (
        select e.id, e.title, e.kind, e.starts_at, e.ends_at, e.location, e.rsvp, r.status as my_status
        from events e
        left join event_responses r on r.event_id = e.id and r.user_id = _me.id
        where e.cancelled_at is null
          and coalesce(e.ends_at, e.starts_at + interval '3 hours') > now()
          and e.starts_at < now() + interval '14 days'
          and private.can_see_event(e.audience)
        order by e.starts_at
        limit 3
      ) x),
    'my_case_tasks', (select json_build_object('open', count(*), 'overdue', count(*) filter (where t.due_on < current_date))
                      from case_tasks t join cases c on c.id = t.case_id
                      where t.assignee_id = _me.id and t.done_at is null and c.status = 'open'),
    'policies_to_acknowledge', (select count(*) from policies p
                                where p.status = 'published' and p.version > 0 and p.requires_ack
                                  and not exists (select 1 from policy_acknowledgements a
                                                  where a.policy_id = p.id and a.user_id = _me.id and a.version = p.version)),
    'open_polls', (select count(*) from polls p
                   where p.closed_at is null and p.closes_at > now() and private.can_see_event(p.audience)
                     and not exists (select 1 from poll_voters v where v.poll_id = p.id and v.user_id = _me.id)),
    'nominations_pending', case when private.rank_index(_me.faction_rank) <= 6 or coalesce(_me.is_bureau_manager, false) then
      (select count(*) from promotion_nominations n
       where n.status = 'pending' and n.user_id <> _me.id and private.can_decide_promotion(n.to_rank)) end,
    'trainees_ready', case when _coach then
      (select count(*) from trainee_mentors tm join profiles p on p.id = tm.trainee_id
       where tm.signed_off_at is not null and tm.completed_at is null
         and p.faction_rank = 'Deputy Sheriff Trainee' and p.system_role <> 'pending') end,
    'trainees_without_mentor', case when _coach then
      (select count(*) from profiles p
       where p.faction_rank = 'Deputy Sheriff Trainee' and p.system_role <> 'pending' and coalesce(p.onboarding_completed, false)
         and not exists (select 1 from trainee_mentors tm where tm.trainee_id = p.id and tm.mentor_id is not null)) end,
    'mentees', (select count(*) from trainee_mentors tm join profiles p on p.id = tm.trainee_id
                where tm.mentor_id = _me.id and tm.completed_at is null and p.faction_rank = 'Deputy Sheriff Trainee'),
    'feedback_new', case when private.can_read_feedback('command') or private.can_read_feedback('manager') then
      (select count(*) from feedback_reports f where f.status = 'new' and private.can_read_feedback(f.recipient)) end,
    -- The month of the end-of-month recap: last month, once its pay is closed or a few days in,
    -- for those who were members then (someone who joined this month has nothing to look back on).
    'recap_month', case when (exists (select 1 from payroll_runs where month = _prev and status = 'closed') or current_date >= _month + 4)
                             and coalesce((select joined_on from member_details where user_id = _me.id), _me.created_at::date) < _month
                        then _prev end,
    -- The joining day of the HR registry (the account of an old member is younger than the membership).
    'joined_on', (select joined_on from member_details where user_id = _me.id)
  );
end;
$$;

-- 7. ---------------------------------------------------------------------------
-- The leaderboard ranked the listed members together with the caller even when the caller had
-- not opted in: a hidden first place pushed everyone down ("2." on top) and the places differed
-- from viewer to viewer. The places now come from the listed members only; the caller gets the
-- place they would hold among them.
create or replace function public.get_leaderboard(_month date default null)
returns json
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _me uuid := (select auth.uid());
  _m date;
  _next date;
begin
  if not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  _m := (date_trunc('month', coalesce(_month, current_date)::timestamp))::date;
  _next := (_m + interval '1 month')::date;
  return (
    with members as (
      select p.id, p.full_name, p.badge_number, p.faction_rank, p.avatar_url, coalesce(s.leaderboard_visible, false) as visible
      from public.profiles p left join public.member_settings s on s.user_id = p.id
      where p.system_role <> 'pending'
    ), pool as (
      select * from members where visible or id = _me
    ), scores as (
      select 'duty' as category, m.id,
             coalesce((select e.minutes from public.duty_time_entries e where e.user_id = m.id and e.month = _m), 0)::bigint as value
      from pool m
      union all
      select 'reports', m.id, (select count(*) from public.report_logs r where r.user_id = m.id and r.month = _m) from pool m
      union all
      select 'events', m.id, (select count(*) from public.event_attendance a join public.events e on e.id = a.event_id
                              where a.user_id = m.id and e.starts_at >= _m and e.starts_at < _next and e.cancelled_at is null)
      from pool m
      union all
      select 'practice', m.id, (select count(*) from public.practice_days d
                                where d.user_id = m.id and d.day >= _m and d.day < _next and d.answered >= 10)
      from pool m
    ), ranked as (
      -- Only the members who chose to appear compete for the places.
      select s.category, s.id, s.value, rank() over (partition by s.category order by s.value desc) as place
      from scores s join members m on m.id = s.id
      where s.value > 0 and m.visible
    )
    select json_build_object(
      'month', _m,
      'visible', coalesce((select visible from members where id = _me), false),
      'participants', (select count(*) from members where visible),
      'categories', (
        select json_agg(json_build_object(
          'key', c.key,
          'entries', (select coalesce(json_agg(json_build_object('user_id', t.id, 'full_name', t.full_name, 'badge_number', t.badge_number,
                                                               'faction_rank', t.faction_rank, 'avatar_url', t.avatar_url,
                                                               'value', t.value, 'place', t.place, 'me', t.id = _me)
                                             order by t.place, t.full_name), '[]'::json)
                      from (select r.place, r.value, m.* from ranked r join members m on m.id = r.id
                            where r.category = c.key order by r.place, m.full_name limit 10) t),
          -- The caller's place among the listed members (counted in, also when they do not appear).
          'me', (select json_build_object('value', s.value,
                                          'place', 1 + (select count(*) from ranked x where x.category = c.key and x.value > s.value),
                                          'of', (select count(*) from ranked x where x.category = c.key)
                                                + case when exists (select 1 from ranked x where x.category = c.key and x.id = _me) then 0 else 1 end)
                 from scores s where s.category = c.key and s.id = _me and s.value > 0)
        ) order by c.ord)
        from (values ('duty', 1), ('reports', 2), ('events', 3), ('practice', 4)) as c(key, ord))
    )
  );
end;
$$;

-- 8. ---------------------------------------------------------------------------
-- Related-case suggestions took the six strongest hits first and dropped the ones the document
-- already references afterwards, so a case could show nothing although more related cases
-- existed. The referenced ones are left out before the six are chosen (newest first on a tie).
create or replace function private.case_suggestions(_case public.cases)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select suspect_id from public.case_suspects where case_id = _case.id and suspect_id is not null
  ), plates as (
    select upper(btrim(v.plate_number)) as plate from public.suspect_vehicles v where v.suspect_id in (select suspect_id from mine)
  ), addresses as (
    select lower(btrim(sp.address)) as address from public.suspect_properties sp where sp.suspect_id in (select suspect_id from mine)
    union
    select lower(btrim(sp.address)) from public.case_warrants w join public.suspect_properties sp on sp.id = w.property_id where w.case_id = _case.id
  ), hits as (
    select cs.case_id, 'person'::text as kind, s.full_name as label
    from public.case_suspects cs join public.suspects s on s.id = cs.suspect_id
    where cs.suspect_id in (select suspect_id from mine) and cs.case_id <> _case.id
    union
    select cs.case_id, 'vehicle', upper(btrim(v.plate_number))
    from public.suspect_vehicles v join public.case_suspects cs on cs.suspect_id = v.suspect_id
    where upper(btrim(v.plate_number)) in (select plate from plates) and cs.case_id <> _case.id
      and v.suspect_id not in (select suspect_id from mine)
    union
    select cs.case_id, 'address', btrim(sp.address)
    from public.suspect_properties sp join public.case_suspects cs on cs.suspect_id = sp.suspect_id
    where lower(btrim(sp.address)) in (select address from addresses) and cs.case_id <> _case.id
      and sp.suspect_id not in (select suspect_id from mine)
    union
    select w.case_id, 'address', btrim(sp.address)
    from public.case_warrants w join public.suspect_properties sp on sp.id = w.property_id
    where lower(btrim(sp.address)) in (select address from addresses) and w.case_id <> _case.id
  ), grouped as (
    select h.case_id, json_agg(json_build_object('kind', h.kind, 'label', h.label) order by h.kind, h.label) as reasons, count(*) as weight
    from hits h group by h.case_id
  ), chosen as (
    select g.case_id, g.reasons, g.weight, c.updated_at
    from grouped g join public.cases c on c.id = g.case_id
    where position(c.id::text in coalesce(_case.body::text, '')) = 0
    order by g.weight desc, c.updated_at desc
    limit 6
  )
  select coalesce(json_agg(json_build_object(
    'id', c.id, 'case_number', c.case_number, 'title', c.title, 'status', c.status, 'reasons', x.reasons,
    'can_open', private.can_view_case_details(c.id)) order by x.weight desc, x.updated_at desc), '[]'::json)
  from chosen x
  join public.cases c on c.id = x.case_id
$$;

-- 9. ---------------------------------------------------------------------------
-- The readers of anonymous feedback now land on the inbox of the feedback tab; the answer to a
-- reporter links to their own reports explicitly (a leader may have written one too).
create or replace function public.reply_feedback(_report_id uuid, _body text)
returns json
language plpgsql
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _me uuid := (select auth.uid());
  _row public.feedback_reports%rowtype;
  _reporter boolean;
  _person uuid;
begin
  select * into _row from public.feedback_reports where id = _report_id for update;
  if _row.id is null or not private.is_member() then raise exception 'A visszajelzés nem található.' using errcode = 'P0002'; end if;
  _reporter := _row.reporter_hash = private.reporter_hash(_me);
  if not _reporter and not private.can_read_feedback(_row.recipient) then raise exception 'A visszajelzés nem található.' using errcode = 'P0002'; end if;
  if _row.status = 'closed' then raise exception 'Ez a beszélgetés lezárult.' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(_body, ''))) < 1 then raise exception 'Írj üzenetet.' using errcode = '22023'; end if;
  insert into public.feedback_messages (report_id, from_reporter, author_id, body)
  values (_report_id, _reporter, case when _reporter then null else _me end, left(btrim(_body), 2000));
  update public.feedback_reports set status = case when _reporter then 'new' else 'answered' end, updated_at = date_trunc('hour', now())
  where id = _report_id returning * into _row;
  if _reporter then
    perform private.notify(private.feedback_recipient_ids(_row.recipient), 'Új üzenet egy névtelen visszajelzésben',
      'A beküldő válaszolt.', 'info', 'community', '/community?tab=feedback&box=inbox', 'feedback-new', false, true);
  else
    -- The reporter is found by the hash inside the database only (the leaders never see who it is).
    select p.id into _person from public.profiles p where private.reporter_hash(p.id) = _row.reporter_hash limit 1;
    if _person is not null then
      perform private.notify(array[_person], 'Válasz a névtelen visszajelzésedre', 'A vezetőség válaszolt.',
        'info', 'community', '/community?tab=feedback&box=mine', 'feedback-reply');
    end if;
  end if;
  return private.feedback_json(_row, _reporter);
end;
$$;

-- Privileges: the replaced functions keep theirs; the two new helpers are internal.
revoke all on function private.duty_text(integer), private.month_text(date) from public, anon, authenticated;
