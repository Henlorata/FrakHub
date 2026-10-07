-- =============================================================================
-- Placeholders in case templates: {{ügyszám}}, {{létrehozta}} and {{dátum}} in the starting
-- document of a new case are filled in when the case is created (the case number is only known
-- here). Accent-free spellings work too. The client fills the same placeholders of a snippet
-- when it is inserted (src/lib/case-templates.ts fillTemplateTokens).
--
-- Compatible with the deployed frontend: an insert trigger that only touches bodies holding a
-- placeholder (none of the existing templates does).
-- =============================================================================

-- A value for regexp_replace() inside a JSON string: JSON-escaped without the quotes, with the
-- backslashes doubled (a replacement treats "\" as an escape).
create or replace function private.json_replacement(_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(regexp_replace(to_json(coalesce(_value, ''))::text, '^"|"$', '', 'g'), '\', '\\')
$$;
revoke execute on function private.json_replacement(text) from public, anon, authenticated;

create or replace function private.fill_case_template_tokens()
returns trigger
language plpgsql
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _text text;
  _owner text;
begin
  if new.body is null then return new; end if;
  _text := new.body::text;
  if strpos(_text, '{{') = 0 then return new; end if;
  select coalesce(full_name, '') into _owner from public.profiles where id = new.owner_id;
  _text := regexp_replace(_text, '\{\{\s*(ügyszám|ugyszam)\s*\}\}', private.json_replacement(new.case_number), 'gi');
  _text := regexp_replace(_text, '\{\{\s*(létrehozta|letrehozta)\s*\}\}', private.json_replacement(_owner), 'gi');
  _text := regexp_replace(_text, '\{\{\s*(dátum|datum)\s*\}\}', to_char(current_date, 'YYYY.MM.DD'), 'gi');
  new.body := _text::jsonb;
  return new;
end;
$$;
revoke execute on function private.fill_case_template_tokens() from public, anon, authenticated;

-- BEFORE INSERT triggers run in name order: after trigger_generate_case_number.
drop trigger if exists trigger_template_tokens on public.cases;
create trigger trigger_template_tokens before insert on public.cases
  for each row execute function private.fill_case_template_tokens();
