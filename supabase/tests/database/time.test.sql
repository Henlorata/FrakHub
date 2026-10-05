-- Calendar dates follow Hungarian time. Run with: bunx supabase test db
begin;
select plan(2);

-- Every function that works with calendar dates must run in Europe/Budapest
-- (a `create or replace` without `set timezone` silently falls back to UTC).
select is(
  (select string_agg(n.nspname || '.' || p.proname, ', ' order by p.proname)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private')
     and p.prosrc ~* 'current_date|date_trunc|to_char\(|::date'
     and not ('TimeZone=Europe/Budapest' = any(coalesce(p.proconfig, '{}')))),
  null,
  'functions that work with calendar dates run in Hungarian time');

select is(
  (select column_default from information_schema.columns
   where table_schema = 'public' and table_name = 'former_members' and column_name = 'left_on'),
  '((now() AT TIME ZONE ''Europe/Budapest''::text))::date',
  'the day a member left defaults to today in Hungary');

select * from finish();
rollback;
