-- =============================================================================
-- The staff tiers and titles stay in English, as the faction uses them (Executive Staff,
-- Command Staff, Supervisory Staff, Field Staff, Bureau Manager, Bureau Commander, Trainee):
-- the error messages and notifications of these functions used Hungarian translations
-- ("felügyelő állomány", "parancsnokság", "vezérkar", "újonc").
--
-- Text only: every function is the latest definition with the same signature, settings and
-- logic; create or replace keeps the privileges. Compatible with the deployed frontend.
-- =============================================================================

-- public.get_payroll(_month date) (from 20261005024215_payroll_balance.sql)
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
    raise exception 'A havi fizetést az Executive Staff és a Bureau Manager kezeli.' using errcode = '42501';
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

-- public.save_payroll_entries(_month date, _entries jsonb) (from 20261005005759_finance_payroll_reports.sql)
create or replace function public.save_payroll_entries(_month date, _entries jsonb)
returns json
language plpgsql
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _m date := (date_trunc('month', _month::timestamp))::date;
  _uid uuid := (select auth.uid());
  _e jsonb;
  _user uuid;
  _account text;
  _uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if not private.is_executive_or_manager() then
    raise exception 'A havi fizetést az Executive Staff és a Bureau Manager kezeli.' using errcode = '42501';
  end if;
  if _m is null or _m > (date_trunc('month', current_date::timestamp))::date then raise exception 'Érvénytelen hónap.'; end if;
  if exists (select 1 from public.payroll_runs where month = _m and status = 'closed') then
    raise exception 'A hónap le van zárva. Módosításhoz előbb nyisd újra.';
  end if;
  if _entries is null or jsonb_typeof(_entries) <> 'array' then raise exception 'Érvénytelen adatok.'; end if;
  insert into public.payroll_runs (month, created_by) values (_m, _uid) on conflict (month) do nothing;

  for _e in select value from jsonb_array_elements(_entries) loop
    continue when jsonb_typeof(_e) <> 'object' or coalesce(_e ->> 'user_id', '') !~* _uuid;
    _user := (_e ->> 'user_id')::uuid;
    continue when not exists (select 1 from public.profiles where id = _user and system_role <> 'pending');

    insert into public.payroll_entries (month, user_id, updated_by) values (_m, _user, _uid)
    on conflict (month, user_id) do nothing;
    update public.payroll_entries set
      eligible = case when _e ? 'eligible' then (case when jsonb_typeof(_e -> 'eligible') = 'boolean' then (_e ->> 'eligible')::boolean end) else eligible end,
      reports = case when _e ? 'reports' then private.json_int(_e -> 'reports', 0, 1000) else reports end,
      pictures = case when _e ? 'pictures' then coalesce(private.json_int(_e -> 'pictures', 0, 1000), 0) else pictures end,
      trained = case when _e ? 'trained' then coalesce(private.json_int(_e -> 'trained', 0, 1000), 0) else trained end,
      top_duty = case when _e ? 'top_duty' then private.json_int(_e -> 'top_duty', 0, 3) else top_duty end,
      top_report = case when _e ? 'top_report' then private.json_int(_e -> 'top_report', 0, 3) else top_report end,
      bonus = case when _e ? 'bonus' then coalesce(private.json_int(_e -> 'bonus', -10000000000, 10000000000), 0) else bonus end,
      bonus_note = case when _e ? 'bonus_note' then nullif(left(trim(coalesce(_e ->> 'bonus_note', '')), 300), '') else bonus_note end,
      unit_key = case when _e ? 'unit_key' then left(nullif(trim(coalesce(_e ->> 'unit_key', '')), ''), 20) else unit_key end,
      qual_key = case when _e ? 'qual_key' then (case when jsonb_typeof(_e -> 'qual_key') = 'string' then left(trim(_e ->> 'qual_key'), 20) end) else qual_key end,
      updated_at = now(),
      updated_by = _uid
    where month = _m and user_id = _user;

    if _e ? 'duty_minutes' then
      if jsonb_typeof(_e -> 'duty_minutes') = 'number' then
        insert into public.duty_time_entries (user_id, month, minutes, updated_by)
        values (_user, _m, private.json_int(_e -> 'duty_minutes', 0, 44640), _uid)
        on conflict (user_id, month) do update set minutes = excluded.minutes, updated_by = excluded.updated_by, updated_at = now();
      else
        delete from public.duty_time_entries where user_id = _user and month = _m;
      end if;
    end if;

    if _e ? 'account_number' then
      _account := trim(coalesce(_e ->> 'account_number', ''));
      if _account = '' then
        delete from public.member_bank_accounts where user_id = _user;
      elsif char_length(_account) between 3 and 40 then
        insert into public.member_bank_accounts (user_id, account_number, updated_by) values (_user, _account, _uid)
        on conflict (user_id) do update set account_number = excluded.account_number, updated_by = excluded.updated_by;
      else
        raise exception 'Érvénytelen számlaszám.';
      end if;
    end if;
  end loop;

  return public.get_payroll(_m);
end;
$$;

-- public.close_payroll(_month date, _withdrawn bigint default null, _note text default null) (from 20261005005759_finance_payroll_reports.sql)
create or replace function public.close_payroll(_month date, _withdrawn bigint default null, _note text default null)
returns json
language plpgsql
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _m date := (date_trunc('month', _month::timestamp))::date;
  _uid uuid := (select auth.uid());
  _rows jsonb;
  _row jsonb;
begin
  if not private.is_executive_or_manager() then
    raise exception 'A havi fizetést az Executive Staff és a Bureau Manager kezeli.' using errcode = '42501';
  end if;
  if exists (select 1 from public.payroll_runs where month = _m and status = 'closed') then
    raise exception 'A hónap már le van zárva.';
  end if;
  if _withdrawn is not null and (_withdrawn < 0 or _withdrawn > 100000000000) then raise exception 'Érvénytelen összeg.'; end if;

  insert into public.payroll_runs (month, created_by) values (_m, _uid) on conflict (month) do nothing;
  _rows := private.payroll_rows(_m);
  insert into public.payroll_entries (month, user_id, snapshot, updated_by)
  select _m, (r ->> 'user_id')::uuid, r, _uid from jsonb_array_elements(_rows) r
  on conflict (month, user_id) do update set snapshot = excluded.snapshot, updated_at = now(), updated_by = excluded.updated_by;
  update public.payroll_runs set
    status = 'closed', withdrawn = _withdrawn, note = nullif(left(trim(coalesce(_note, '')), 2000), ''),
    settings = (select to_jsonb(s) - 'id' from public.payroll_settings s where s.id = 'global'),
    closed_at = now(), closed_by = _uid
  where month = _m;

  for _row in select value from jsonb_array_elements(_rows) where (value ->> 'total')::bigint > 0 loop
    perform private.notify(array[(_row ->> 'user_id')::uuid], format('Havi fizetés: %s', private.hu_month(_m)),
      format('%s $ (a részletek a Pénzügy oldalon)', private.hu_amount((_row ->> 'total')::bigint)),
      'success', 'finance', '/finance?tab=payroll', 'payroll:' || _m, true);
  end loop;
  return public.get_payroll(_m);
end;
$$;

-- public.set_payroll_paid(_month date, _user_ids uuid[], _paid boolean) (from 20261005005759_finance_payroll_reports.sql)
create or replace function public.set_payroll_paid(_month date, _user_ids uuid[], _paid boolean)
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
    raise exception 'A havi fizetést az Executive Staff és a Bureau Manager kezeli.' using errcode = '42501';
  end if;
  if _user_ids is null or cardinality(_user_ids) = 0 then return public.get_payroll(_m); end if;
  insert into public.payroll_runs (month, created_by) values (_m, _uid) on conflict (month) do nothing;
  insert into public.payroll_entries (month, user_id, updated_by)
  select _m, p.id, _uid from public.profiles p where p.id = any(_user_ids) and p.system_role <> 'pending'
  on conflict (month, user_id) do nothing;
  update public.payroll_entries set
    paid = coalesce(_paid, false),
    paid_at = case when coalesce(_paid, false) then now() end,
    paid_by = case when coalesce(_paid, false) then _uid end
  where month = _m and user_id = any(_user_ids);
  return public.get_payroll(_m);
end;
$$;

-- public.decide_budget_request(_request_id uuid, _approve boolean, _comment text default null) (from 20261005005759_finance_payroll_reports.sql)
create or replace function public.decide_budget_request(_request_id uuid, _approve boolean, _comment text default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _request public.budget_requests%rowtype;
  _note text := nullif(left(trim(coalesce(_comment, '')), 1000), '');
begin
  if not private.is_admin() then
    raise exception 'A költségtérítést a Command Staff és felette bírálja el.' using errcode = '42501';
  end if;
  select * into _request from public.budget_requests where id = _request_id for update;
  if _request.id is null then raise exception 'A kérelem nem található.'; end if;
  if _request.status <> 'pending' then raise exception 'Ezt a kérelmet már elbírálták.'; end if;
  if _request.user_id = (select auth.uid()) and not private.is_executive_or_manager() then
    raise exception 'A saját kérelmedet más bírálja el.' using errcode = '42501';
  end if;
  if not coalesce(_approve, false) and _note is null then raise exception 'Az elutasításhoz indoklás kell.'; end if;

  update public.budget_requests set
    status = case when coalesce(_approve, false) then 'approved' else 'rejected' end::public.request_status,
    admin_comment = _note,
    processed_by = (select auth.uid()),
    updated_at = now()
  where id = _request_id
  returning * into _request;
  return json_build_object('id', _request.id, 'status', _request.status);
end;
$$;

-- public.set_payroll_balance(_month date, _balance bigint) (from 20261005024215_payroll_balance.sql)
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
    raise exception 'A havi fizetést az Executive Staff és a Bureau Manager kezeli.' using errcode = '42501';
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

-- public.decide_warrant(_warrant_id uuid, _status text, _note text default null) (from 20261005031501_mcb_overhaul.sql)
create or replace function public.decide_warrant(_warrant_id uuid, _status text, _note text default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := (select auth.uid());
  _w public.case_warrants%rowtype;
  _note_text text := nullif(btrim(coalesce(_note, '')), '');
begin
  if char_length(_note_text) > 500 then
    raise exception 'A megjegyzés legfeljebb 500 karakter lehet.' using errcode = '22023';
  end if;
  select * into _w from public.case_warrants where id = _warrant_id for update;
  if _w.id is null then raise exception 'A parancs nem található.' using errcode = 'P0002'; end if;

  if _status in ('approved', 'rejected') then
    if not private.can_approve_warrants() then
      raise exception 'Parancsot a Supervisory Staff és felette, valamint az Investigator III. bírálhat el.' using errcode = '42501';
    end if;
    if _w.status <> 'pending' then raise exception 'Ezt a kérelmet már elbírálták.' using errcode = '22023'; end if;
    if _w.requested_by = _uid then
      raise exception 'Saját kérelmet nem bírálhatsz el.' using errcode = '42501';
    end if;
    update public.case_warrants
    set status = _status, approved_by = _uid, decided_at = now(), decision_note = _note_text, updated_at = now()
    where id = _warrant_id;
  elsif _status = 'executed' then
    if _w.status <> 'approved' then raise exception 'Csak jóváhagyott parancs hajtható végre.' using errcode = '22023'; end if;
    if not (private.can_edit_case(_w.case_id) or private.can_approve_warrants()) then
      raise exception 'A végrehajtást az akta szerkesztői rögzítik.' using errcode = '42501';
    end if;
    update public.case_warrants
    set status = 'executed', closed_at = now(), closed_by = _uid, closing_note = _note_text, updated_at = now()
    where id = _warrant_id;
  elsif _status = 'expired' then
    if _w.status = 'pending' then
      if not (_w.requested_by = _uid or private.can_manage_case(_w.case_id)) then
        raise exception 'A kérelmet a kérelmező vagy az akta tulajdonosa vonhatja vissza.' using errcode = '42501';
      end if;
    elsif _w.status = 'approved' then
      if not (private.can_approve_warrants() or private.can_manage_case(_w.case_id)) then
        raise exception 'Jóváhagyott parancsot a jóváhagyók vagy az akta tulajdonosa vonhat vissza.' using errcode = '42501';
      end if;
    else
      raise exception 'Ez a parancs már lezárult.' using errcode = '22023';
    end if;
    update public.case_warrants
    set status = 'expired', closed_at = now(), closed_by = _uid, closing_note = _note_text, updated_at = now()
    where id = _warrant_id;
  else
    raise exception 'Ismeretlen művelet.' using errcode = '22023';
  end if;

  return (select private.warrant_json(w) from public.case_warrants w where w.id = _warrant_id);
end;
$$;

-- public.fleet_delete_category(_category_id text, _move_to text default null) (from 20261006003144_fleet_categories_and_bureau_rules.sql)
create or replace function public.fleet_delete_category(_category_id text, _move_to text default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _moved integer := 0;
  _deleted integer := 0;
begin
  if not private.is_staff() then
    raise exception 'Kategóriát a Supervisory Staff és felette törölhet.' using errcode = '42501';
  end if;
  perform 1 from public.fleet_categories where id = _category_id for update;
  if not found then raise exception 'A kategória nem található.' using errcode = 'P0002'; end if;

  if _move_to is not null then
    if _move_to = _category_id then raise exception 'Másik kategóriát válassz.' using errcode = '22023'; end if;
    perform 1 from public.fleet_categories where id = _move_to;
    if not found then raise exception 'A cél kategória nem található.' using errcode = 'P0002'; end if;
    update public.fleet_vehicles set category_id = _move_to where category_id = _category_id;
    get diagnostics _moved = row_count;
  else
    -- Their keys and registration reviews go with them; warnings keep the plate.
    delete from public.fleet_vehicles where category_id = _category_id;
    get diagnostics _deleted = row_count;
  end if;

  delete from public.fleet_categories where id = _category_id;
  return json_build_object('moved', _moved, 'deleted', _deleted);
end;
$$;

-- public.save_promotion_criteria(_rank text, _criteria jsonb) (from 20261006024716_hr_progression.sql)
create or replace function public.save_promotion_criteria(_rank text, _criteria jsonb)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _exams uuid[];
  _row public.promotion_criteria%rowtype;
  _window integer := coalesce(private.json_int(_criteria -> 'window_months', 1, 3), 1);
begin
  if not private.is_executive_or_manager() then
    raise exception 'Az előléptetési feltételeket az Executive Staff állítja be.' using errcode = '42501';
  end if;
  if _rank is null or private.rank_index(_rank) not between 0 and 14 then
    raise exception 'Ismeretlen rendfokozat.' using errcode = '22023';
  end if;
  if _criteria is null or jsonb_typeof(_criteria) <> 'object' then raise exception 'Érvénytelen feltételek.' using errcode = '22023'; end if;

  select coalesce(array_agg(distinct e.id), '{}') into _exams
  from jsonb_array_elements_text(case when jsonb_typeof(_criteria -> 'exam_ids') = 'array' then _criteria -> 'exam_ids' else '[]'::jsonb end) x(id)
  join public.exams e on e.id::text = x.id;
  if cardinality(_exams) > 5 then raise exception 'Legfeljebb öt vizsga köthető ki.' using errcode = '22023'; end if;

  insert into public.promotion_criteria (rank, min_days_in_rank, min_duty_hours, window_months, min_reports, max_warnings, exam_ids, note,
                                         updated_at, updated_by)
  values (_rank, private.json_int(_criteria -> 'min_days_in_rank', 0, 365), private.json_int(_criteria -> 'min_duty_hours', 0, 744), _window,
          private.json_int(_criteria -> 'min_reports', 0, 300), private.json_int(_criteria -> 'max_warnings', 0, 3), _exams,
          nullif(left(btrim(coalesce(_criteria ->> 'note', '')), 300), ''), now(), (select auth.uid()))
  on conflict (rank) do update set
    min_days_in_rank = excluded.min_days_in_rank, min_duty_hours = excluded.min_duty_hours, window_months = excluded.window_months,
    min_reports = excluded.min_reports, max_warnings = excluded.max_warnings, exam_ids = excluded.exam_ids, note = excluded.note,
    updated_at = now(), updated_by = (select auth.uid())
  returning * into _row;
  return row_to_json(_row);
end;
$$;

-- public.nominate_for_promotion(_user_id uuid, _reason text) (from 20261006092419_qa_fixes.sql)
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
    raise exception 'Előléptetést a Supervisory Staff és felette javasolhat.' using errcode = '42501';
  end if;
  select * into _target from public.profiles where id = _user_id;
  if _target.id is null or _target.system_role = 'pending' then raise exception 'A tag nem található.' using errcode = 'P0002'; end if;
  if _target.id = _me.id then raise exception 'Saját magadat nem javasolhatod.' using errcode = '22023'; end if;
  if private.rank_index(_target.faction_rank) = 0 then raise exception 'A tag a legmagasabb rendfokozatban van.' using errcode = '22023'; end if;
  if private.rank_index(_target.faction_rank) >= 16 then
    raise exception 'A Trainee-k előléptetését a Trainee-k lapon követheted.' using errcode = '22023';
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

-- public.decide_promotion_nomination(_id uuid, _decision text, _note text default null) (from 20261006024716_hr_progression.sql)
create or replace function public.decide_promotion_nomination(_id uuid, _decision text, _note text default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _me uuid := (select auth.uid());
  _row public.promotion_nominations%rowtype;
  _text text := nullif(btrim(coalesce(_note, '')), '');
begin
  select * into _row from public.promotion_nominations where id = _id for update;
  if _row.id is null or not private.is_staff() then raise exception 'A javaslat nem található.' using errcode = 'P0002'; end if;
  if _row.status <> 'pending' then raise exception 'Ezt a javaslatot már lezárták.' using errcode = '22023'; end if;
  if char_length(_text) > 500 then raise exception 'A megjegyzés legfeljebb 500 karakter lehet.' using errcode = '22023'; end if;

  if _decision = 'rejected' then
    if not private.can_decide_promotion(_row.to_rank) or _row.user_id = _me then
      raise exception 'Erről a javaslatról nálad magasabb rangú vezető dönt.' using errcode = '42501';
    end if;
    if _text is null then raise exception 'Az elutasításhoz írj indoklást.' using errcode = '22023'; end if;
  elsif _decision = 'withdrawn' then
    if not (_row.nominated_by = _me or private.can_decide_promotion(_row.to_rank)) then
      raise exception 'A javaslatot a javasló vagy az vonhatja vissza, aki dönthet róla.' using errcode = '42501';
    end if;
  elsif _decision = 'approved' then
    raise exception 'A jóváhagyáshoz léptesd elő a tagot: a javaslat ekkor magától lezárul.' using errcode = '22023';
  else
    raise exception 'Ismeretlen döntés.' using errcode = '22023';
  end if;

  update public.promotion_nominations set status = _decision, decided_by = _me, decided_at = now(), decision_note = _text
  where id = _id returning * into _row;
  if _decision = 'rejected' and _row.nominated_by is not null and _row.nominated_by <> _me then
    perform private.notify(array[_row.nominated_by], 'Előléptetési javaslat elutasítva',
      format('%s → %s: %s', private.member_name(_row.user_id), _row.to_rank, _text), 'warning', 'hr', '/hr?tab=promotions');
  end if;
  return private.nomination_json(_row);
end;
$$;

-- public.get_promotion_board() (from 20261006024716_hr_progression.sql)
create or replace function public.get_promotion_board()
returns json
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _current date := (date_trunc('month', current_date::timestamp))::date;
begin
  if not private.is_staff() then
    raise exception 'Az előléptetési táblát a Supervisory Staff és felette látja.' using errcode = '42501';
  end if;
  return json_build_object(
    'criteria', (select coalesce(json_agg(row_to_json(c) order by private.rank_index(c.rank) desc), '[]'::json)
                 from public.promotion_criteria c),
    'exams', (select coalesce(json_agg(json_build_object('id', e.id, 'title', e.title, 'type', e.type) order by e.title), '[]'::json)
              from public.exams e where coalesce(e.is_active, true)),
    'can_edit_criteria', private.is_executive_or_manager(),
    'members', (
      select coalesce(jsonb_agg(m.item order by (m.item ->> 'eligible')::boolean desc, (m.item ->> 'missing')::int,
                                                (m.item ->> 'rank_order')::int, m.item ->> 'full_name'), '[]'::jsonb)
      from (
        select private.promotion_status(p, c, _current) as item
        from public.profiles p
        left join public.promotion_criteria c on c.rank = private.rank_name(private.rank_index(p.faction_rank) - 1)
        where p.system_role <> 'pending' and private.rank_index(p.faction_rank) between 1 and 15
      ) m),
    'nominations', (
      select coalesce(json_agg(private.nomination_json(n) order by n.status = 'pending' desc, n.created_at desc), '[]'::json)
      from (select * from public.promotion_nominations
            where status = 'pending' or decided_at > now() - interval '60 days'
            order by created_at desc limit 60) n)
  );
end;
$$;

-- public.assign_trainee_mentor(_trainee_id uuid, _mentor_id uuid) (from 20261006024716_hr_progression.sql)
create or replace function public.assign_trainee_mentor(_trainee_id uuid, _mentor_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _me uuid := (select auth.uid());
  _trainee public.profiles%rowtype;
  _mentor public.profiles%rowtype;
begin
  if not private.can_coach_trainees() then raise exception 'Mentort az oktatók, valamint a Supervisory Staff és felette jelöl ki.' using errcode = '42501'; end if;
  select * into _trainee from public.profiles where id = _trainee_id;
  if _trainee.id is null or _trainee.faction_rank <> 'Deputy Sheriff Trainee' or _trainee.system_role = 'pending' then
    raise exception 'A Trainee nem található.' using errcode = 'P0002';
  end if;
  if _mentor_id is null then
    update public.trainee_mentors set mentor_id = null, signed_off_at = null, signed_off_by = null, sign_off_note = null
    where trainee_id = _trainee_id;
    return json_build_object('mentor', null);
  end if;
  select * into _mentor from public.profiles where id = _mentor_id;
  if _mentor.id is null or _mentor.system_role = 'pending' or _mentor.faction_rank = 'Deputy Sheriff Trainee' or _mentor.id = _trainee.id then
    raise exception 'Mentor csak felavatott tag lehet.' using errcode = '22023';
  end if;
  insert into public.trainee_mentors (trainee_id, mentor_id, assigned_by, assigned_at)
  values (_trainee_id, _mentor_id, _me, now())
  on conflict (trainee_id) do update set mentor_id = excluded.mentor_id, assigned_by = excluded.assigned_by, assigned_at = now(),
    signed_off_at = case when public.trainee_mentors.mentor_id is distinct from excluded.mentor_id then null else public.trainee_mentors.signed_off_at end,
    signed_off_by = case when public.trainee_mentors.mentor_id is distinct from excluded.mentor_id then null else public.trainee_mentors.signed_off_by end;

  perform private.notify(array[_mentor_id], 'Mentorálandó Trainee',
    format('%s mentora lettél a Trainee hetére. A hét végén jelezd, hogy kész-e a Deputy Sheriff I. rangra.', _trainee.full_name),
    'info', 'hr', '/hr?tab=trainees', 'trainee-mentor:' || _trainee_id);
  perform private.notify(array[_trainee_id], 'Mentort kaptál',
    format('%s segít az első hetedben: fordulj hozzá bátran.', _mentor.full_name), 'success', 'hr', '/dashboard',
    'trainee-mentor:' || _trainee_id);
  return json_build_object('mentor', json_build_object('id', _mentor.id, 'full_name', _mentor.full_name, 'faction_rank', _mentor.faction_rank,
                                                       'avatar_url', _mentor.avatar_url));
end;
$$;

-- public.add_trainee_note(_trainee_id uuid, _body text) (from 20261006024716_hr_progression.sql)
create or replace function public.add_trainee_note(_trainee_id uuid, _body text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _row public.trainee_notes%rowtype;
begin
  if not (private.can_coach_trainees()
          or exists (select 1 from public.trainee_mentors where trainee_id = _trainee_id and mentor_id = (select auth.uid()))) then
    raise exception 'Jegyzetet a mentor és az oktatók írhatnak.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = _trainee_id and faction_rank = 'Deputy Sheriff Trainee') then
    raise exception 'A Trainee nem található.' using errcode = 'P0002';
  end if;
  insert into public.trainee_notes (trainee_id, author_id, body) values (_trainee_id, (select auth.uid()), left(btrim(coalesce(_body, '')), 400))
  returning * into _row;
  return json_build_object('id', _row.id, 'body', _row.body, 'created_at', _row.created_at,
                           'author_name', (select full_name from public.profiles where id = _row.author_id));
end;
$$;

-- public.sign_off_trainee(_trainee_id uuid, _ready boolean, _note text default null) (from 20261006024716_hr_progression.sql)
create or replace function public.sign_off_trainee(_trainee_id uuid, _ready boolean, _note text default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _me uuid := (select auth.uid());
  _row public.trainee_mentors%rowtype;
  _name text;
begin
  select * into _row from public.trainee_mentors where trainee_id = _trainee_id for update;
  if not (private.can_coach_trainees() or _row.mentor_id = _me) then
    raise exception 'A Trainee-t a mentora vagy egy oktató hagyhatja jóvá.' using errcode = '42501';
  end if;
  select full_name into _name from public.profiles where id = _trainee_id and faction_rank = 'Deputy Sheriff Trainee';
  if _name is null then raise exception 'A Trainee nem található.' using errcode = 'P0002'; end if;
  if _row.trainee_id is null then
    insert into public.trainee_mentors (trainee_id, assigned_by) values (_trainee_id, _me) returning * into _row;
  end if;
  update public.trainee_mentors set
    signed_off_at = case when coalesce(_ready, true) then now() end,
    signed_off_by = case when coalesce(_ready, true) then _me end,
    sign_off_note = case when coalesce(_ready, true) then nullif(left(btrim(coalesce(_note, '')), 400), '') end
  where trainee_id = _trainee_id returning * into _row;

  if coalesce(_ready, true) then
    perform private.notify(
      array_remove(array_cat(array[_row.assigned_by],
        (select coalesce(array_agg(p.id), '{}') from public.profiles p
         where p.system_role <> 'pending' and 'TB' = any(coalesce(p.commanded_divisions, '{}')))), null),
      'Trainee jóváhagyva', format('%s mentora szerint kész a Deputy Sheriff I. rangra.', _name),
      'success', 'hr', '/hr?tab=trainees', 'trainee-ready:' || _trainee_id);
  end if;
  return json_build_object('signed_off_at', _row.signed_off_at, 'sign_off_note', _row.sign_off_note);
end;
$$;

-- public.renew_warrant(_warrant_id uuid, _note text default null) (from 20261006025055_mcb_tasks_items_informants.sql)
create or replace function public.renew_warrant(_warrant_id uuid, _note text default null)
returns json
language plpgsql
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _uid uuid := (select auth.uid());
  _w public.case_warrants%rowtype;
  _days integer;
begin
  select * into _w from public.case_warrants where id = _warrant_id for update;
  if _w.id is null then raise exception 'A parancs nem található.' using errcode = 'P0002'; end if;
  if not private.can_approve_warrants() then
    raise exception 'Parancsot a Supervisory Staff és felette, valamint az Investigator III. újíthat meg.' using errcode = '42501';
  end if;
  if _w.status <> 'approved' then raise exception 'Csak érvényes parancs újítható meg.' using errcode = '22023'; end if;
  if _w.renewal_requested_by = _uid then raise exception 'Saját megújítási kérelmet nem bírálhatsz el.' using errcode = '42501'; end if;
  select case when _w.type = 'arrest' then arrest_days else search_days end into _days from public.mcb_settings where id = 'global';
  update public.case_warrants set
    expires_at = case when coalesce(_days, 0) > 0 then greatest(now(), coalesce(expires_at, now())) + make_interval(days => _days) end,
    renewals = renewals + 1, renewal_requested_at = null, renewal_requested_by = null, renewal_note = null, expiry_reminded_at = null,
    decision_note = coalesce(nullif(left(btrim(coalesce(_note, '')), 500), ''), decision_note), updated_at = now()
  where id = _warrant_id returning * into _w;
  perform private.log_case_event(_w.case_id, 'warrant_renewed',
    jsonb_build_object('warrant_id', _w.id, 'type', _w.type, 'target', private.warrant_target(_w), 'expires_at', _w.expires_at));
  perform private.notify(array_remove(array[_w.requested_by, (select owner_id from public.cases where id = _w.case_id)], null),
    case _w.type when 'arrest' then 'Elfogatóparancs megújítva' else 'Házkutatási parancs megújítva' end,
    format('%s – érvényes: %s', private.warrant_target(_w),
           coalesce(to_char(_w.expires_at at time zone 'Europe/Budapest', 'YYYY.MM.DD. HH24:MI'), 'visszavonásig')),
    'success', 'mcb', '/mcb/case/' || _w.case_id);
  return private.warrant_json(_w);
end;
$$;

-- public.save_policy(_id uuid, _policy jsonb) (from 20261006025509_community.sql)
create or replace function public.save_policy(_id uuid, _policy jsonb)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _row public.policies%rowtype;
  _title text := btrim(coalesce(_policy ->> 'title', ''));
  _category text := coalesce(nullif(_policy ->> 'category', ''), 'general');
  _body jsonb := case when jsonb_typeof(_policy -> 'body') = 'array' then _policy -> 'body' else '[]'::jsonb end;
begin
  if not private.can_edit_policies() then raise exception 'A szabályzatokat a Command Staff és felette szerkeszti.' using errcode = '42501'; end if;
  if char_length(_title) < 3 or char_length(_title) > 120 then raise exception 'A cím 3–120 karakter lehet.' using errcode = '22023'; end if;
  if _category not in ('general', 'conduct', 'field', 'vehicles', 'radio', 'hr', 'mcb', 'academy', 'other') then
    raise exception 'Ismeretlen kategória.' using errcode = '22023';
  end if;
  if octet_length(_body::text) > 400000 then raise exception 'A szabályzat túl hosszú.' using errcode = '22023'; end if;
  if strpos(_body::text, 'data:image') > 0 then raise exception 'Kép nem lehet a szabályzatban.' using errcode = '22023'; end if;

  if _id is null then
    insert into public.policies (title, category, summary, body, requires_ack, sort_order, created_by, updated_by)
    values (_title, _category, nullif(left(btrim(coalesce(_policy ->> 'summary', '')), 300), ''), _body,
            coalesce((_policy ->> 'requires_ack')::boolean, false), coalesce(private.json_int(_policy -> 'sort_order', 0, 10000)::int, 100),
            (select auth.uid()), (select auth.uid()))
    returning * into _row;
  else
    update public.policies set title = _title, category = _category, summary = nullif(left(btrim(coalesce(_policy ->> 'summary', '')), 300), ''),
      body = _body, requires_ack = coalesce((_policy ->> 'requires_ack')::boolean, requires_ack),
      sort_order = coalesce(private.json_int(_policy -> 'sort_order', 0, 10000)::int, sort_order),
      updated_at = now(), updated_by = (select auth.uid())
    where id = _id returning * into _row;
    if _row.id is null then raise exception 'A szabályzat nem található.' using errcode = 'P0002'; end if;
  end if;
  return json_build_object('id', _row.id, 'version', _row.version, 'updated_at', _row.updated_at);
end;
$$;

-- public.publish_policy(_id uuid, _change_note text default null) (from 20261006092419_qa_fixes.sql)
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
  if not private.can_edit_policies() then raise exception 'A szabályzatokat a Command Staff és felette teszi közzé.' using errcode = '42501'; end if;
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

-- public.respond_suggestion(_id uuid, _status text, _response text) (from 20261006025509_community.sql)
create or replace function public.respond_suggestion(_id uuid, _status text, _response text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _row public.suggestions%rowtype;
begin
  if not private.is_admin() then raise exception 'Az ötletekre a Command Staff és felette válaszol.' using errcode = '42501'; end if;
  if _status not in ('new', 'reviewing', 'planned', 'done', 'declined') then raise exception 'Ismeretlen státusz.' using errcode = '22023'; end if;
  update public.suggestions set status = _status, response = nullif(left(btrim(coalesce(_response, '')), 1000), ''),
    responded_by = (select auth.uid()), responded_at = now(), updated_at = now()
  where id = _id returning * into _row;
  if _row.id is null then raise exception 'Az ötlet nem található.' using errcode = 'P0002'; end if;
  if _row.author_id is not null then
    perform private.notify(array[_row.author_id], 'Válasz az ötletedre', format('„%s”: %s', _row.title,
      case _status when 'reviewing' then 'átnézés alatt' when 'planned' then 'tervben van' when 'done' then 'megvalósult'
                   when 'declined' then 'nem valósul meg' else 'új' end),
      case when _status in ('planned', 'done') then 'success' else 'info' end, 'community', '/community?tab=ideas');
  end if;
  return json_build_object('status', _row.status, 'response', _row.response, 'responded_at', _row.responded_at);
end;
$$;

-- public.get_feedback_inbox() (from 20261006025509_community.sql)
create or replace function public.get_feedback_inbox()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (private.can_read_feedback('command') or private.can_read_feedback('manager')) then
    raise exception 'A névtelen visszajelzéseket a Command Staff és felette olvassa.' using errcode = '42501';
  end if;
  return (select coalesce(json_agg(private.feedback_json(r, false) order by r.status = 'closed', r.updated_at desc), '[]'::json)
          from public.feedback_reports r where private.can_read_feedback(r.recipient));
end;
$$;

-- public.block_feedback_reporter(_report_id uuid, _days integer, _reason text) (from 20261006025509_community.sql)
create or replace function public.block_feedback_reporter(_report_id uuid, _days integer, _reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _row public.feedback_reports%rowtype;
begin
  select * into _row from public.feedback_reports where id = _report_id;
  if _row.id is null or not private.can_read_feedback(_row.recipient) then raise exception 'A visszajelzés nem található.' using errcode = 'P0002'; end if;
  if not (private.is_executive_or_manager()) then raise exception 'Tiltást az Executive Staff vagy a Bureau Manager rendelhet el.' using errcode = '42501'; end if;
  insert into private.feedback_blocks (reporter_hash, blocked_until, reason, blocked_by)
  values (_row.reporter_hash, now() + make_interval(days => least(greatest(coalesce(_days, 7), 1), 90)),
          nullif(left(btrim(coalesce(_reason, '')), 200), ''), (select auth.uid()))
  on conflict (reporter_hash) do update set blocked_until = excluded.blocked_until, reason = excluded.reason, blocked_by = excluded.blocked_by;
  update public.feedback_reports set status = 'closed' where id = _report_id;
end;
$$;
