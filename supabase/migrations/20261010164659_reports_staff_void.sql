-- =============================================================================
-- Reports: the Supervisory Staff and above (Command Staff too) void and restore reports, not only
-- those who pay (the owners' decision of 2026-10-10); they may also add a forum link and change a
-- paid month's report that way. private.is_staff() = Supervisory Staff and above or a Bureau Manager.
-- Compatible with the deployed frontend.
-- =============================================================================

create or replace function pg_temp.patch_function(_fn regprocedure, _done text, variadic _pairs text[])
returns void
language plpgsql
as $f$
declare
  _def text := replace(pg_get_functiondef(_fn), chr(13), '');
  _i integer;
begin
  if _done is not null and position(_done in _def) > 0 then return; end if;
  for _i in 1 .. coalesce(array_length(_pairs, 1), 0) / 2 loop
    if position(_pairs[_i * 2 - 1] in _def) = 0 then
      raise exception '%: anchor not found: %', _fn, left(_pairs[_i * 2 - 1], 160);
    end if;
    _def := replace(_def, _pairs[_i * 2 - 1], _pairs[_i * 2]);
  end loop;
  execute _def;
end;
$f$;

select pg_temp.patch_function('private.report_logs_guard()', 'private.is_staff()',
  $a$and not private.is_executive_or_manager()$a$, $b$and not private.is_staff()$b$);
select pg_temp.patch_function('public.get_report(uuid)', 'private.is_staff()',
  $a$_lead boolean := private.is_executive_or_manager();$a$, $b$_lead boolean := private.is_staff();$b$);
select pg_temp.patch_function('public.set_report_link(uuid, text)', 'private.is_staff()',
  $a$and not private.is_executive_or_manager() then$a$, $b$and not private.is_staff() then$b$);
select pg_temp.patch_function('public.void_report(uuid, text)', 'private.is_staff()',
  $a$if not private.is_executive_or_manager() then$a$, $b$if not private.is_staff() then$b$,
  $a$Jelentést az Executive Staff és a Bureau Manager érvényteleníthet.$a$, $b$Jelentést a Supervisory Staff és felette érvényteleníthet.$b$);
select pg_temp.patch_function('public.restore_report(uuid)', 'private.is_staff()',
  $a$if not private.is_executive_or_manager() then$a$, $b$if not private.is_staff() then$b$,
  $a$Jelentést az Executive Staff és a Bureau Manager érvényteleníthet.$a$, $b$Jelentést a Supervisory Staff és felette érvényteleníthet.$b$);

drop function pg_temp.patch_function(regprocedure, text, text[]);
