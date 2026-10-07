-- =============================================================================
-- The reimbursement notifications wrote the amount with the database's number format
-- ("25,000 $", the server runs with lc_numeric en_US). They now use the Hungarian grouping of the
-- app and the payroll notifications ("25 000 $", private.hu_amount).
-- =============================================================================

create or replace function private.on_budget_request_change()
returns trigger
language plpgsql
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
begin
  if tg_op = 'INSERT' then
    perform private.notify(private.admin_ids(), 'Új költségtérítési kérelem',
      format('%s: %s $', private.member_name(new.user_id), private.hu_amount(new.amount)),
      'info', 'finance', '/finance', 'budget-requests');
    return new;
  end if;
  if new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    perform private.notify(array[new.user_id],
      case when new.status = 'approved' then 'Költségtérítés jóváhagyva' else 'Költségtérítés elutasítva' end,
      case when new.status = 'approved'
        then format('%s $ – %s', private.hu_amount(new.amount), left(new.reason, 80))
        else format('Indoklás: %s', coalesce(new.admin_comment, '-')) end,
      case when new.status = 'approved' then 'success' else 'alert' end, 'finance', '/finance');
  end if;
  return new;
end;
$$;
revoke execute on function private.on_budget_request_change() from public, anon, authenticated;
