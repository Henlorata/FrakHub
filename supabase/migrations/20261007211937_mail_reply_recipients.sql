-- =============================================================================
-- A reply's "to" line (mail_messages.to_display) listed only the thread's recipients minus the
-- sender. When the only recipient answered a letter written to them alone (or an office answered a
-- public report sent only to it), nobody was left, the list was null and the reply failed on the
-- not-null column. The line now also names the earlier writers of the thread (the person who
-- wrote first and anyone who answered since), as a "reply all" would, and is never null. The
-- public reporter is named only on the messages the reporter reads.
-- =============================================================================

create or replace function private.mail_to_display(_thread uuid, _sender text, _to_reporter boolean)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  -- The earlier writers first (in the order they wrote), then the other recipients.
  select coalesce(array_agg(address order by recipient_only, first_seen), '{}')
  from (
    select every_address.address, bool_and(every_address.recipient) as recipient_only, min(every_address.seen) as first_seen
    from (
      select m.sender_address as address, false as recipient, m.created_at as seen from public.mail_messages m
      where m.thread_id = _thread and (m.sender_kind <> 'public' or _to_reporter)
      union all
      select r.address, true, r.added_at from public.mail_recipients r where r.thread_id = _thread
    ) every_address
    where every_address.address <> _sender
    group by every_address.address
  ) addresses;
$$;
revoke execute on function private.mail_to_display(uuid, text, boolean) from public, anon, authenticated;

-- "or replace": an earlier migration of the same session (db reset) may have left it behind.
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

select pg_temp.patch_function('public.send_mail(text,text,jsonb,uuid,text,text,text,boolean)', 'private.mail_to_display(',
  $a$(select array_agg(r.address order by r.added_at) from public.mail_recipients r where r.thread_id = _thread_id and r.address <> _sender_address),$a$,
  $b$private.mail_to_display(_thread_id, _sender_address, _public),$b$);

drop function pg_temp.patch_function(regprocedure, text, text[]);
