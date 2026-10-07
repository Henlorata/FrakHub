-- =============================================================================
-- The IAB mailbox for everyone who receives the IAB's mail: its members, and the Bureau Managers
-- while nobody holds an IAB title (private.mail_group_member). Until now only members with an
-- iab_title could open it, so the Bureau Managers who get the complaints in the meantime (on prod
-- nobody has a title yet) got an error from the IAB page's "IAB postafiók" button.
-- Only the check changes; the rest is the function as it was.
-- =============================================================================

create or replace function public.get_mailbox(_box text default 'inbox', _before timestamptz default null, _limit integer default 40)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _me uuid := (select auth.uid());
  _take integer := least(greatest(coalesce(_limit, 40), 1), 100);
begin
  if not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  if _box = 'iab' and not private.mail_group_member('iab', _me) then
    raise exception 'Az IAB postafiókját csak az IAB olvassa.' using errcode = '42501';
  end if;
  return (
    select coalesce(json_agg(private.mail_thread_json(t, _me) order by t.last_message_at desc), '[]')
    from (
      select t.* from public.mail_threads t
      where (_before is null or t.last_message_at < _before)
        and case _box
          when 'sent' then exists (select 1 from public.mail_messages m where m.thread_id = t.id and m.author_id = _me)
          when 'all' then t.broadcast
          when 'iab' then exists (select 1 from public.mail_recipients r where r.thread_id = t.id and r.group_key = 'iab')
          else private.can_read_mail(t.id)
               and exists (select 1 from public.mail_messages m where m.thread_id = t.id and m.author_id is distinct from _me)
               and not (t.broadcast and not exists (select 1 from public.mail_recipients r where r.thread_id = t.id and r.user_id = _me))
        end
      order by t.last_message_at desc
      limit _take
    ) t);
end;
$$;
