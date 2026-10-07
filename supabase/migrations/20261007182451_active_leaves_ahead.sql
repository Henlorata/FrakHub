-- =============================================================================
-- get_active_leaves() returns every approved leave that has not ended yet, not only the ones that
-- start within 30 days. The HR page keeps the list in the browser until hr_records change, so a
-- window counted from the day of the read left out a leave approved more than 30 days ahead even
-- after it had begun (the member did not show as on leave). The page now picks the current leave
-- and the next one within 30 days itself (useHrData).
-- =============================================================================

create or replace function public.get_active_leaves()
returns table(user_id uuid, starts_on date, ends_on date)
language sql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
  select r.user_id, r.starts_on, r.ends_on
  from public.hr_records r
  where private.is_member() and r.kind = 'leave' and r.status = 'active' and r.ends_on >= current_date
$$;
