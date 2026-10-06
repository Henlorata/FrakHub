-- The faction account's balance for the payroll month: the leadership reads it in the game and
-- types it in, the payroll page shows what stays after paying the month (with tax).

alter table public.payroll_runs
  add column if not exists balance bigint check (balance between -1000000000000 and 1000000000000),
  add column if not exists balance_at timestamptz,
  add column if not exists balance_by uuid references public.profiles(id) on delete set null;

-- Sets (or clears with null) the balance of a month; works for closed months too.
create or replace function public.set_payroll_balance(_month date, _balance bigint)
returns json
language plpgsql
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _m date := (date_trunc('month', _month::timestamp))::date;
  _uid uuid := (select auth.uid());
begin
  if not private.is_executive_or_manager() then
    raise exception 'A havi fizetést a vezérkar kezeli.' using errcode = '42501';
  end if;
  if _m is null or _m > (date_trunc('month', current_date::timestamp))::date then raise exception 'Érvénytelen hónap.'; end if;
  if _balance is not null and abs(_balance) > 1000000000000 then raise exception 'Érvénytelen összeg.'; end if;
  insert into public.payroll_runs (month, created_by) values (_m, _uid) on conflict (month) do nothing;
  update public.payroll_runs set
    balance = _balance,
    balance_at = case when _balance is null then null else now() end,
    balance_by = case when _balance is null then null else _uid end
  where month = _m;
  return public.get_payroll(_m);
end;
$$;

-- get_payroll() with the balance (unchanged otherwise).
create or replace function public.get_payroll(_month date)
returns json
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _m date := (date_trunc('month', coalesce(_month, current_date)::timestamp))::date;
  _run public.payroll_runs%rowtype;
  _rows jsonb;
  _settings jsonb;
  _total bigint;
begin
  if not private.is_executive_or_manager() then
    raise exception 'A havi fizetést a vezérkar kezeli.' using errcode = '42501';
  end if;
  select * into _run from public.payroll_runs where month = _m;
  if _run.status = 'closed' then
    select coalesce(jsonb_agg(e.snapshot || jsonb_build_object('paid', e.paid, 'paid_at', e.paid_at)
                              order by (e.snapshot ->> 'rank_order')::int, e.snapshot ->> 'name'), '[]'::jsonb)
    into _rows from public.payroll_entries e where e.month = _m and e.snapshot is not null;
    _settings := _run.settings;
  else
    _rows := private.payroll_rows(_m);
    -- Paid flags of an open month (payment can be marked before closing too).
    select coalesce(jsonb_agg(r || jsonb_build_object('paid', coalesce(e.paid, false), 'paid_at', e.paid_at)
                              order by (r ->> 'rank_order')::int, r ->> 'name'), '[]'::jsonb)
    into _rows
    from jsonb_array_elements(_rows) r
    left join public.payroll_entries e on e.month = _m and e.user_id = (r ->> 'user_id')::uuid;
    select to_jsonb(s) - 'id' into _settings from public.payroll_settings s where s.id = 'global';
  end if;
  select coalesce(sum((r ->> 'total')::bigint), 0) into _total from jsonb_array_elements(_rows) r;

  return json_build_object(
    'month', _m,
    'status', coalesce(_run.status, 'open'),
    'saved', _run.month is not null,
    'withdrawn', _run.withdrawn,
    'balance', _run.balance,
    'balance_at', _run.balance_at,
    'balance_by_name', (select full_name from public.profiles where id = _run.balance_by),
    'note', _run.note,
    'closed_at', _run.closed_at,
    'closed_by_name', (select full_name from public.profiles where id = _run.closed_by),
    'settings', _settings,
    'rows', _rows,
    'total', _total,
    'tax', round(_total * coalesce((_settings ->> 'tax_percent')::numeric, 0) / 100),
    'paid_total', (select coalesce(sum((r ->> 'total')::bigint), 0) from jsonb_array_elements(_rows) r where (r ->> 'paid')::boolean),
    'can_edit_settings', private.is_commander_or_manager(),
    'months', (select coalesce(json_agg(json_build_object('month', r.month, 'status', r.status) order by r.month desc), '[]'::json)
               from public.payroll_runs r)
  );
end;
$$;

revoke execute on function public.set_payroll_balance(date, bigint) from public, anon, authenticated;
grant execute on function public.set_payroll_balance(date, bigint) to authenticated;
