-- Department statistics: reading the calculator's action log lines (the live data writes the
-- thousands with no-break spaces) and the one-call summary.
-- Run with: bunx supabase test db
begin;
select plan(11);

create function pg_temp.act_as(_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', _id, 'role', 'authenticated')::text, true);
end $$;

-- The line format -------------------------------------------------------------------------
select is((private.action_log_parts('Bírság: $1' || chr(160) || '000' || chr(160) || '000 - Indok: GV, KV')).fine, 1000000::bigint,
  'a fine with no-break spaces between the thousands');
select is((private.action_log_parts('Bírság: $4 350 000 - Indok: GV')).fine, 4350000::bigint, 'a fine with plain spaces');
select is((private.action_log_parts('Bírság: $900' || chr(8239) || '000 - Indok: GV')).fine, 900000::bigint, 'a fine with narrow no-break spaces');
select is((private.action_log_parts('75 perc - Indokok: RA, RUM, IFB')).jail, 75, 'jail minutes');
select is((private.action_log_parts('120' || chr(160) || 'perc - Indokok: RA')).jail, 120, 'jail minutes with a no-break space');
select is((private.action_log_parts('Bírság: $500' || chr(160) || '000 - Indok: GV,' || chr(160) || 'KV(x2), ENV/I.')).reasons,
  array['GV', 'KV(x2)', 'ENV/I.'], 'the reasons, trimmed');
select is((private.action_log_parts('Valami más')).fine, null::bigint, 'an unknown line counts nothing');

-- The summary -------------------------------------------------------------------------------
insert into public.action_logs (user_id, action_type, details, created_at) values
  ('00000000-0000-4000-8000-000000000003', 'ticket', 'Bírság: $2' || chr(160) || '000' || chr(160) || '000 - Indok: ZZTESZT(x40), ZZMASIK', now() - interval '1 day'),
  ('00000000-0000-4000-8000-000000000003', 'arrest', '90 perc - Indokok: ZZTESZT', now() - interval '2 days');

select pg_temp.act_as('00000000-0000-4000-8000-000000000003');
select ok((public.get_department_stats(30)::json -> 'current' ->> 'fines')::bigint >= 2000000, 'the fines are summed in full');
select is((select (item ->> 'count')::int from json_array_elements(public.get_department_stats(30)::json -> 'offenses') item
           where item ->> 'code' = 'ZZTESZT'), 41, 'an offence given "(x40)" counts forty times, plus the arrest');
select ok(json_array_length(public.get_department_stats(30)::json -> 'heatmap') > 0, 'the heat map has cells');

select pg_temp.act_as('00000000-0000-4000-8000-000000000004');
select throws_ok('select public.get_department_stats(30)', '42501', null, 'a pending registration sees nothing');

select * from finish();
rollback;
