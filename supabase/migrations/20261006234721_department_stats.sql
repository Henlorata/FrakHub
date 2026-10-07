-- =============================================================================
-- Department statistics in one call (the "Statisztika" page): what the department did in a
-- period and how it compares with the period before. Built from the calculator's action log
-- (tickets, arrests: amounts and the penal code abbreviations it copied), the report log, the
-- cases, the BOLO alerts and the warrants. Only counts and sums leave the database (no names),
-- so every member may see them.
--
-- Compatible with the deployed frontend: a new function only.
-- =============================================================================

-- One action log entry, read: "Bírság: $1 000 000 - Indok: GV, KV(x2)" / "75 perc - Indokok: RA, IFB".
-- The calculator formats the amounts with no-break spaces (U+00A0) between the thousands.
create or replace function private.action_log_parts(_details text, out fine bigint, out jail integer, out reasons text[])
returns record
language sql
immutable
set search_path = ''
as $$
  select
    nullif(regexp_replace(coalesce(substring(_details from 'Bírság: \$([0-9 .\u00a0\u202f]+)'), ''), '[^0-9]', '', 'g'), '')::bigint,
    nullif(substring(_details from '^\s*([0-9]+)[\s\u00a0\u202f]*perc'), '')::integer,
    coalesce((select array_agg(btrim(item, ' ' || chr(160) || chr(8239)))
              from regexp_split_to_table(substring(_details from 'Indok(?:ok)?:\s*(.*)$'), ',') as item
              where btrim(item, ' ' || chr(160) || chr(8239)) <> ''), '{}')
$$;
revoke execute on function private.action_log_parts(text) from public, anon, authenticated;

create or replace function public.get_department_stats(_days integer default 30)
returns json
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _span integer := least(greatest(coalesce(_days, 30), 7), 366);
  _to timestamptz := now();
  _from timestamptz := now() - make_interval(days => _span);
  _prev timestamptz := now() - make_interval(days => _span * 2);
  -- Up to three months by week, longer periods by month.
  _unit text := case when _span <= 92 then 'week' else 'month' end;
begin
  if not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  return (
    with logs as (
      select l.created_at, l.action_type, p.fine, p.jail, p.reasons
      from public.action_logs l
      cross join lateral private.action_log_parts(l.details) p
      where l.created_at >= _prev
    ),
    period_totals as (
      select (created_at >= _from) as current,
             count(*) filter (where action_type = 'ticket') as tickets,
             count(*) filter (where action_type = 'arrest') as arrests,
             coalesce(sum(fine) filter (where action_type = 'ticket'), 0) as fines,
             coalesce(sum(jail) filter (where action_type = 'arrest'), 0) as jail_minutes
      from logs group by 1
    ),
    reasons as (
      select substring(item from '^(.*?)\s*\(x[0-9]+\)$') as with_count, item,
             coalesce(nullif(substring(item from '\(x([0-9]+)\)$'), '')::integer, 1) as times
      from logs, unnest(reasons) as item
      where created_at >= _from
    ),
    offenses as (
      select coalesce(with_count, item) as code, sum(times)::integer as count
      from reasons group by 1 order by 2 desc, 1 limit 15
    ),
    buckets as (
      select date_trunc(_unit, g)::date as bucket
      from generate_series(date_trunc(_unit, _from), date_trunc(_unit, _to), make_interval(weeks => case when _unit = 'week' then 1 else 0 end,
                                                                                            months => case when _unit = 'month' then 1 else 0 end)) g
    ),
    heat as (
      select extract(isodow from created_at)::integer as dow, extract(hour from created_at)::integer as hour, count(*)::integer as count
      from logs where created_at >= _from group by 1, 2
    )
    select json_build_object(
      'days', _span, 'from', _from, 'to', _to, 'unit', _unit,
      'current', json_build_object(
        'tickets', coalesce((select tickets from period_totals where current), 0),
        'arrests', coalesce((select arrests from period_totals where current), 0),
        'fines', coalesce((select fines from period_totals where current), 0),
        'jail_minutes', coalesce((select jail_minutes from period_totals where current), 0),
        'reports', (select count(*) from public.report_logs r where r.created_at >= _from),
        'bolos', (select count(*) from public.bolo_alerts b where b.created_at >= _from),
        'bolos_resolved', (select count(*) from public.bolo_alerts b where b.status = 'resolved' and b.resolved_at >= _from),
        'cases_opened', (select count(*) from public.cases c where c.created_at >= _from),
        'cases_closed', (select count(*) from public.cases c where c.closed_at >= _from),
        'warrants', (select count(*) from public.case_warrants w where w.decided_at >= _from and w.status in ('approved', 'executed', 'expired'))),
      'previous', json_build_object(
        'tickets', coalesce((select tickets from period_totals where not current), 0),
        'arrests', coalesce((select arrests from period_totals where not current), 0),
        'fines', coalesce((select fines from period_totals where not current), 0),
        'jail_minutes', coalesce((select jail_minutes from period_totals where not current), 0),
        'reports', (select count(*) from public.report_logs r where r.created_at >= _prev and r.created_at < _from),
        'bolos', (select count(*) from public.bolo_alerts b where b.created_at >= _prev and b.created_at < _from),
        'bolos_resolved', (select count(*) from public.bolo_alerts b where b.status = 'resolved' and b.resolved_at >= _prev and b.resolved_at < _from),
        'cases_opened', (select count(*) from public.cases c where c.created_at >= _prev and c.created_at < _from),
        'cases_closed', (select count(*) from public.cases c where c.closed_at >= _prev and c.closed_at < _from),
        'warrants', (select count(*) from public.case_warrants w where w.decided_at >= _prev and w.decided_at < _from
                     and w.status in ('approved', 'executed', 'expired'))),
      'series', coalesce((select json_agg(json_build_object(
          'start', b.bucket,
          'tickets', (select count(*) from logs l where l.action_type = 'ticket' and date_trunc(_unit, l.created_at)::date = b.bucket),
          'arrests', (select count(*) from logs l where l.action_type = 'arrest' and date_trunc(_unit, l.created_at)::date = b.bucket),
          'fines', (select coalesce(sum(l.fine), 0) from logs l where l.action_type = 'ticket' and date_trunc(_unit, l.created_at)::date = b.bucket),
          'reports', (select count(*) from public.report_logs r where date_trunc(_unit, r.created_at)::date = b.bucket))
        order by b.bucket) from buckets b), '[]'::json),
      'offenses', coalesce((select json_agg(json_build_object('code', o.code, 'count', o.count) order by o.count desc, o.code) from offenses o), '[]'::json),
      'heatmap', coalesce((select json_agg(json_build_object('dow', h.dow, 'hour', h.hour, 'count', h.count)) from heat h), '[]'::json)
    )
  );
end;
$$;
revoke execute on function public.get_department_stats(integer) from public, anon, authenticated;
grant execute on function public.get_department_stats(integer) to authenticated;
