-- =============================================================================
-- The AI helper of the report form (api/report/assist.ts, Google Gemini on its free tier): a daily
-- allowance per member and for everyone, so the free quota is never used up by one member and the
-- service is never asked more than it gives for free. Only who asked and when is stored, never the
-- text. The function is called by the API with the service role; the counters go after two days.
-- Additive; compatible with the deployed frontend.
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

create table private.ai_assist_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index ai_assist_usage_user_idx on private.ai_assist_usage (user_id, created_at);
create index ai_assist_usage_time_idx on private.ai_assist_usage (created_at);
revoke all on private.ai_assist_usage from public, anon, authenticated;

-- Takes one request from today's allowance (Hungarian day). {ok, remaining, reason: member|everyone}.
create or replace function public.take_ai_assist(_user uuid, _member_limit integer, _overall_limit integer)
returns json
language plpgsql
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _since timestamptz := date_trunc('day', now());
  _mine integer;
  _everyone integer;
begin
  -- One at a time, so two requests at once cannot both take the last one.
  perform pg_advisory_xact_lock(hashtext('ai_assist_usage'));
  select count(*) into _mine from private.ai_assist_usage where user_id = _user and created_at >= _since;
  if _mine >= _member_limit then
    return json_build_object('ok', false, 'reason', 'member', 'remaining', 0);
  end if;
  select count(*) into _everyone from private.ai_assist_usage where created_at >= _since;
  if _everyone >= _overall_limit then
    return json_build_object('ok', false, 'reason', 'everyone', 'remaining', _member_limit - _mine);
  end if;
  insert into private.ai_assist_usage (user_id) values (_user);
  return json_build_object('ok', true, 'remaining', _member_limit - _mine - 1);
end;
$$;
revoke execute on function public.take_ai_assist(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.take_ai_assist(uuid, integer, integer) to service_role;

select pg_temp.patch_function('public.run_housekeeping()', 'ai_assist_usage',
  $a$  delete from private.client_error_limits where created_at < now() - interval '2 days';$a$,
  $b$  delete from private.client_error_limits where created_at < now() - interval '2 days';
  -- The AI report helper's daily allowance.
  delete from private.ai_assist_usage where created_at < now() - interval '2 days';$b$);

drop function pg_temp.patch_function(regprocedure, text, text[]);
