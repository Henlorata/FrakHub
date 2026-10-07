-- =============================================================================
-- Internal Affairs Bureau (IAB) and the department's mail ("public mails").
--
-- Mail: letters between members in the old Discord "public-mails" format (from / to / subject),
-- addressed to members (firstname.lastname@sfsd.org) or to shared addresses that reach a group:
-- all@sfsd.org (everyone), internal.affairs.bureau@sfsd.org (the IAB's mailbox), command.staff@,
-- information.bureau@ (SIB), mcb@, seb@, tsb@. The addresses are for display; a letter is a thread
-- that every recipient (and every member of a recipient group) can read and answer. The leadership,
-- the IAB and the SIB may record a letter that came from outside (e.g. cmd.cooper@lspd.org), and a
-- member of the IAB, the SIB or the Command Staff may write in the name of that office.
--
-- IAB: a small MCB for internal investigations. The IAB's own titles (Sheriff, Assistant Sheriff,
-- Chief Deputy, Notary, Agent) live in profiles.iab_title. Investigations connect members (subject,
-- complainant, witness), collect memos, interviews and internal notes, link mail threads, and end
-- with the IAB's own closure (outcome + statement). Readers: IAB members and the Bureau Manager;
-- a subject never sees their own investigation. Printable (with signatures).
--
-- Compatible with the deployed frontend: new tables, functions and a profiles column; the
-- notification categories grow ("mail", "iab"; only the new frontend creates them); the dashboard
-- summary keeps every key and adds mail_unread / iab_open.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Notification categories
-- ---------------------------------------------------------------------------

alter table public.notifications drop constraint if exists notifications_category_check;
alter table public.notifications add constraint notifications_category_check
  check (category in ('system', 'hr', 'mcb', 'logistics', 'finance', 'exam', 'academy', 'announcement', 'event', 'community', 'patrol', 'mail', 'iab'));
alter table public.notification_preferences drop constraint if exists notification_preferences_categories_check;
alter table public.notification_preferences add constraint notification_preferences_categories_check
  check (muted_categories <@ array['hr', 'mcb', 'logistics', 'finance', 'exam', 'academy', 'announcement', 'event', 'community', 'patrol', 'mail', 'iab']);

-- ---------------------------------------------------------------------------
-- 2. IAB membership (the bureau's own titles)
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists iab_title text
  constraint profiles_iab_title_check check (iab_title in ('sheriff', 'assistant_sheriff', 'chief_deputy', 'notary', 'agent'));
grant select (iab_title) on public.profiles to authenticated;

create or replace function private.is_iab_member(_uid uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p
                 where p.id = coalesce(_uid, (select auth.uid())) and p.system_role <> 'pending' and p.iab_title is not null);
$$;
revoke execute on function private.is_iab_member(uuid) from public, anon;
grant execute on function private.is_iab_member(uuid) to authenticated;

-- Manages the bureau's staff: its Sheriff and Assistant Sheriff, the Bureau Manager, the Executive Staff.
create or replace function private.is_iab_lead()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p
                 where p.id = (select auth.uid()) and p.system_role <> 'pending'
                   and (p.iab_title in ('sheriff', 'assistant_sheriff') or coalesce(p.is_bureau_manager, false)
                        or private.rank_index(p.faction_rank) <= 1));
$$;
revoke execute on function private.is_iab_lead() from public, anon;
grant execute on function private.is_iab_lead() to authenticated;

-- Sees the investigations: the IAB and the Bureau Manager.
create or replace function private.can_see_iab()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p
                 where p.id = (select auth.uid()) and p.system_role <> 'pending'
                   and (p.iab_title is not null or coalesce(p.is_bureau_manager, false)));
$$;
revoke execute on function private.can_see_iab() from public, anon;
grant execute on function private.can_see_iab() to authenticated;

create or replace function public.set_iab_title(_user_id uuid, _title text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _name text;
begin
  if not private.is_iab_lead() then raise exception 'Az IAB állományát csak a vezetése kezeli.' using errcode = '42501'; end if;
  if _title is not null and _title not in ('sheriff', 'assistant_sheriff', 'chief_deputy', 'notary', 'agent') then
    raise exception 'Ismeretlen IAB cím.';
  end if;
  update public.profiles set iab_title = _title where id = _user_id and system_role <> 'pending' returning full_name into _name;
  if _name is null then raise exception 'A tag nem található.'; end if;
  if _title is not null then
    perform private.notify(array[_user_id], 'Internal Affairs Bureau',
      'Az Internal Affairs Bureau állományába kerültél. A vizsgálatokat és az IAB postafiókját a Belső vizsgálatok oldalon éred el.',
      'info', 'iab', '/iab', null);
  end if;
end;
$$;
revoke execute on function public.set_iab_title(uuid, text) from public, anon, authenticated;
grant execute on function public.set_iab_title(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Mail
-- ---------------------------------------------------------------------------

-- firstname.lastname@sfsd.org (accents folded, everything else a dot).
create or replace function private.mail_address(_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(nullif(btrim(regexp_replace(lower(translate(coalesce(_name, ''),
    'áàâäãåāăąçćčďđéèêëēėęěíìîïīłľĺñńňóòôöõøōőŕřśšşťţúùûüůūűųýÿžźżÁÀÂÄÃÅĀĂĄÇĆČĎĐÉÈÊËĒĖĘĚÍÌÎÏĪŁĽĹÑŃŇÓÒÔÖÕØŌŐŔŘŚŠŞŤŢÚÙÛÜŮŪŰŲÝŸŽŹŻ',
    'aaaaaaaaacccddeeeeeeeeiiiiilllnnnoooooooorrsssttuuuuuuuuyyzzzAAAAAAAAACCCDDEEEEEEEEIIIIILLLNNNOOOOOOOORRSSSTTUUUUUUUUYYZZZ')),
    '[^a-z0-9]+', '.', 'g'), '.'), ''), 'tag') || '@sfsd.org';
$$;
revoke execute on function private.mail_address(text) from public, anon, authenticated;

-- The shared addresses and who reads them.
create or replace function private.mail_group_address(_key text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case _key
    when 'all' then 'all@sfsd.org'
    when 'iab' then 'internal.affairs.bureau@sfsd.org'
    when 'command' then 'command.staff@sfsd.org'
    when 'sib' then 'information.bureau@sfsd.org'
    when 'mcb' then 'mcb@sfsd.org'
    when 'seb' then 'seb@sfsd.org'
    when 'tsb' then 'tsb@sfsd.org'
  end;
$$;
revoke execute on function private.mail_group_address(text) from public, anon, authenticated;

create or replace function private.mail_group_member(_key text, _uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = _uid and p.system_role <> 'pending'
      and case _key
        when 'all' then true
        when 'iab' then p.iab_title is not null
        when 'command' then private.rank_index(p.faction_rank) <= 6 or coalesce(p.is_bureau_manager, false)
        when 'sib' then 'SIB' = any(coalesce(p.qualifications, '{}')) or 'SIB' = any(coalesce(p.commanded_divisions, '{}'))
        when 'mcb' then p.division = 'MCB'
        when 'seb' then p.division = 'SEB'
        when 'tsb' then p.division = 'TSB'
        else false
      end);
$$;
revoke execute on function private.mail_group_member(text, uuid) from public, anon, authenticated;

-- May write to everyone, record an outside letter: the staff, the leadership, the IAB and the SIB.
create or replace function private.can_mail_broadcast()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_staff() or private.is_iab_member() or private.mail_group_member('sib', (select auth.uid()));
$$;
revoke execute on function private.can_mail_broadcast() from public, anon, authenticated;

create table public.mail_threads (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (length(btrim(subject)) between 1 and 200),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  message_count integer not null default 0,
  broadcast boolean not null default false
);
create index mail_threads_last_idx on public.mail_threads (last_message_at desc);

create table public.mail_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.mail_threads(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  sender_name text not null check (length(sender_name) between 1 and 120),
  sender_address text not null check (length(sender_address) between 3 and 160),
  -- "self": the member; a group key: written in the name of an office; "external": recorded letter.
  sender_kind text not null default 'self' check (sender_kind in ('self', 'external', 'iab', 'sib', 'command')),
  to_display text[] not null default '{}',
  body text not null check (length(btrim(body)) between 1 and 20000),
  created_at timestamptz not null default now()
);
create index mail_messages_thread_idx on public.mail_messages (thread_id, created_at);
create index mail_messages_author_idx on public.mail_messages (author_id);

create table public.mail_recipients (
  thread_id uuid not null references public.mail_threads(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  group_key text check (group_key in ('all', 'iab', 'command', 'sib', 'mcb', 'seb', 'tsb')),
  address text not null,
  added_at timestamptz not null default now(),
  constraint mail_recipients_one_check check ((user_id is null) <> (group_key is null))
);
create unique index mail_recipients_user_idx on public.mail_recipients (thread_id, user_id) where user_id is not null;
create unique index mail_recipients_group_idx on public.mail_recipients (thread_id, group_key) where group_key is not null;
create index mail_recipients_member_idx on public.mail_recipients (user_id) where user_id is not null;

create table public.mail_reads (
  thread_id uuid not null references public.mail_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

-- Everything goes through the functions below.
alter table public.mail_threads enable row level security;
alter table public.mail_messages enable row level security;
alter table public.mail_recipients enable row level security;
alter table public.mail_reads enable row level security;
revoke all on public.mail_threads, public.mail_messages, public.mail_recipients, public.mail_reads from anon, authenticated;

create or replace function private.can_read_mail(_thread uuid, _uid uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1 from public.mail_recipients r
      where r.thread_id = _thread
        and (r.user_id = coalesce(_uid, (select auth.uid()))
             or (r.group_key is not null and private.mail_group_member(r.group_key, coalesce(_uid, (select auth.uid()))))))
    or exists (select 1 from public.mail_messages m where m.thread_id = _thread and m.author_id = coalesce(_uid, (select auth.uid())));
$$;
revoke execute on function private.can_read_mail(uuid, uuid) from public, anon, authenticated;

-- A letter to everyone is answered by its sender and the staff only (no reply-all storms).
create or replace function private.can_reply_mail(_thread uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_read_mail(_thread) and (
    not (select t.broadcast from public.mail_threads t where t.id = _thread)
    or private.can_mail_broadcast()
    or exists (select 1 from public.mail_threads t where t.id = _thread and t.created_by = (select auth.uid())));
$$;
revoke execute on function private.can_reply_mail(uuid) from public, anon, authenticated;

-- Members who read a thread (for notifications).
create or replace function private.mail_readers(_thread uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(p.id), '{}') from public.profiles p
  where p.system_role <> 'pending' and private.can_read_mail(_thread, p.id);
$$;
revoke execute on function private.mail_readers(uuid) from public, anon, authenticated;

-- The address book for writing: members, the shared addresses, what the caller may use.
create or replace function public.get_mail_directory()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _me public.profiles := private.me();
begin
  if _me.id is null then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  return json_build_object(
    'me', json_build_object('address', private.mail_address(_me.full_name), 'name', _me.full_name),
    'can_broadcast', private.can_mail_broadcast(),
    'can_external', private.can_mail_broadcast(),
    'offices', (select coalesce(json_agg(json_build_object('key', k, 'address', private.mail_group_address(k), 'label', l)), '[]')
                from (values ('iab', 'Internal Affairs Bureau'), ('sib', 'Sheriff''s Information Bureau'), ('command', 'SFSD Command Staff')) o(k, l)
                where private.mail_group_member(k, _me.id)),
    'groups', (select json_agg(json_build_object('key', k, 'address', private.mail_group_address(k), 'label', l,
                                                 'allowed', k <> 'all' or private.can_mail_broadcast()) order by o)
               from (values ('all', 'Teljes állomány', 1), ('iab', 'Internal Affairs Bureau', 2), ('command', 'Command Staff (vezetőség)', 3),
                            ('sib', 'Sheriff''s Information Bureau', 4), ('mcb', 'Major Crimes Bureau', 5), ('seb', 'Special Enforcement Bureau', 6),
                            ('tsb', 'TSB állomány', 7)) g(k, l, o)),
    'members', (select coalesce(json_agg(json_build_object('id', p.id, 'name', p.full_name, 'rank', p.faction_rank,
                                                           'badge', p.badge_number, 'address', private.mail_address(p.full_name))
                                         order by p.full_name), '[]')
                from public.profiles p where p.system_role <> 'pending'));
end;
$$;
revoke execute on function public.get_mail_directory() from public, anon, authenticated;
grant execute on function public.get_mail_directory() to authenticated;

-- A thread's list entry for the caller.
create or replace function private.mail_thread_json(_t public.mail_threads, _me uuid)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'id', _t.id, 'subject', _t.subject, 'created_at', _t.created_at, 'last_message_at', _t.last_message_at,
    'message_count', _t.message_count, 'broadcast', _t.broadcast,
    'iab', exists (select 1 from public.mail_recipients r where r.thread_id = _t.id and r.group_key = 'iab'),
    'unread', _t.last_message_at > coalesce((select rd.read_at from public.mail_reads rd where rd.thread_id = _t.id and rd.user_id = _me), '-infinity')
              and exists (select 1 from public.mail_messages m where m.thread_id = _t.id and m.created_at = _t.last_message_at
                          and m.author_id is distinct from _me),
    'last', (select json_build_object('sender_name', m.sender_name, 'sender_address', m.sender_address, 'snippet', left(m.body, 160))
             from public.mail_messages m where m.thread_id = _t.id order by m.created_at desc limit 1),
    'to', (select coalesce(array_agg(r.address order by r.added_at), '{}') from public.mail_recipients r where r.thread_id = _t.id));
$$;
revoke execute on function private.mail_thread_json(public.mail_threads, uuid) from public, anon, authenticated;

-- Folders: inbox (letters from others to the caller or their groups), sent, everyone (all@), iab.
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
  if _box = 'iab' and not private.is_iab_member() then raise exception 'Az IAB postafiókját csak az IAB olvassa.' using errcode = '42501'; end if;
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
revoke execute on function public.get_mailbox(text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.get_mailbox(text, timestamptz, integer) to authenticated;

-- One thread with its letters (marks it read for the caller).
create or replace function public.get_mail_thread(_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _me uuid := (select auth.uid());
  _t public.mail_threads;
begin
  select * into _t from public.mail_threads where id = _id;
  if _t.id is null or not private.is_member() or not private.can_read_mail(_id) then
    raise exception 'A levél nem található, vagy nem olvashatod.' using errcode = '42501';
  end if;
  insert into public.mail_reads (thread_id, user_id, read_at) values (_id, _me, clock_timestamp())
  on conflict (thread_id, user_id) do update set read_at = excluded.read_at;
  return json_build_object(
    'thread', private.mail_thread_json(_t, _me),
    'can_reply', private.can_reply_mail(_id),
    'recipients', (select coalesce(json_agg(json_build_object('address', r.address, 'user_id', r.user_id, 'group', r.group_key) order by r.added_at), '[]')
                   from public.mail_recipients r where r.thread_id = _id),
    'messages', (select coalesce(json_agg(json_build_object(
                    'id', m.id, 'sender_name', m.sender_name, 'sender_address', m.sender_address, 'sender_kind', m.sender_kind,
                    'to', m.to_display, 'body', m.body, 'created_at', m.created_at,
                    'author', case when m.sender_kind = 'self' or private.can_mail_broadcast() or m.author_id = _me then
                      (select json_build_object('id', p.id, 'full_name', p.full_name, 'faction_rank', p.faction_rank, 'badge_number', p.badge_number,
                                                'iab_title', p.iab_title)
                       from public.profiles p where p.id = m.author_id) end)
                  order by m.created_at), '[]')
                 from public.mail_messages m where m.thread_id = _id),
    'iab_staff', case when exists (select 1 from public.mail_messages m where m.thread_id = _id and m.sender_kind = 'iab') then
      (select coalesce(json_agg(json_build_object('full_name', p.full_name, 'title', p.iab_title)
                                order by array_position(array['sheriff', 'assistant_sheriff', 'chief_deputy', 'notary', 'agent'], p.iab_title), p.full_name), '[]')
       from public.profiles p where p.iab_title is not null and p.system_role <> 'pending') end,
    'cases', case when private.can_see_iab() then
      (select coalesce(json_agg(json_build_object('id', c.id, 'case_number', c.case_number, 'title', c.title, 'status', c.status)), '[]')
       from public.iab_case_mail cm join public.iab_cases c on c.id = cm.case_id
       where cm.thread_id = _id and private.can_view_iab_case(c.id)) else '[]'::json end);
end;
$$;

-- The investigations come in section 4; get_mail_thread refers to them, so it is granted there.

create or replace function public.send_mail(
  _subject text, _body text, _to jsonb default '[]'::jsonb, _thread uuid default null,
  _as text default 'self', _external_name text default null, _external_address text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  _me public.profiles := private.me();
  _thread_id uuid := _thread;
  _new boolean := _thread is null;
  _item jsonb;
  _uid uuid;
  _key text;
  _sender_name text;
  _sender_address text;
  _kind text := coalesce(nullif(_as, ''), 'self');
  _now timestamptz := clock_timestamp();
  _subject_now text;
  _readers uuid[];
begin
  if _me.id is null then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  if length(btrim(coalesce(_body, ''))) = 0 then raise exception 'A levél üres.'; end if;
  if length(_body) > 20000 then raise exception 'A levél legfeljebb 20 000 karakter lehet.'; end if;

  -- The sender.
  if _kind = 'self' then
    _sender_name := _me.full_name;
    _sender_address := private.mail_address(_me.full_name);
  elsif _kind in ('iab', 'sib', 'command') then
    if not private.mail_group_member(_kind, _me.id) then raise exception 'Ennek az irodának a nevében nem írhatsz.' using errcode = '42501'; end if;
    _sender_name := case _kind when 'iab' then 'Internal Affairs Bureau' when 'sib' then 'Sheriff''s Information Bureau' else 'SFSD Command Staff' end;
    _sender_address := private.mail_group_address(_kind);
  elsif _kind = 'external' then
    if not private.can_mail_broadcast() then raise exception 'Külső levelet a vezetőség, az IAB és a SIB rögzíthet.' using errcode = '42501'; end if;
    _sender_name := btrim(coalesce(_external_name, ''));
    _sender_address := lower(btrim(coalesce(_external_address, '')));
    if length(_sender_name) < 2 then raise exception 'Add meg a külső feladó nevét.'; end if;
    if _sender_address !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' then raise exception 'A külső feladó címe nem érvényes e-mail cím.'; end if;
    if _sender_address like '%@sfsd.org' then raise exception 'Külső feladó nem lehet @sfsd.org címmel.'; end if;
  else
    raise exception 'Ismeretlen feladó.';
  end if;

  if _new then
    if length(btrim(coalesce(_subject, ''))) = 0 then raise exception 'Adj tárgyat a levélnek.'; end if;
    if jsonb_array_length(coalesce(_to, '[]'::jsonb)) = 0 then raise exception 'Adj meg legalább egy címzettet.'; end if;
    insert into public.mail_threads (subject, created_by, created_at, last_message_at)
    values (left(btrim(_subject), 200), _me.id, _now, _now) returning id into _thread_id;
  else
    if not private.can_reply_mail(_thread_id) then raise exception 'Erre a levélre nem válaszolhatsz.' using errcode = '42501'; end if;
  end if;

  -- Recipients (new ones are added to the thread).
  for _item in select * from jsonb_array_elements(coalesce(_to, '[]'::jsonb)) loop
    if _item ->> 'kind' = 'group' then
      _key := _item ->> 'key';
      if private.mail_group_address(_key) is null then raise exception 'Ismeretlen csoportcím.'; end if;
      if _key = 'all' and not private.can_mail_broadcast() then
        raise exception 'A teljes állománynak a staff, az IAB és a SIB írhat.' using errcode = '42501';
      end if;
      insert into public.mail_recipients (thread_id, group_key, address) values (_thread_id, _key, private.mail_group_address(_key))
      on conflict do nothing;
      if _key = 'all' then update public.mail_threads set broadcast = true where id = _thread_id; end if;
    elsif _item ->> 'kind' = 'user' then
      _uid := private.try_uuid(_item ->> 'id');
      insert into public.mail_recipients (thread_id, user_id, address)
      select _thread_id, p.id, private.mail_address(p.full_name) from public.profiles p where p.id = _uid and p.system_role <> 'pending'
      on conflict do nothing;
    end if;
  end loop;
  if not exists (select 1 from public.mail_recipients r where r.thread_id = _thread_id) then raise exception 'Adj meg legalább egy címzettet.'; end if;

  insert into public.mail_messages (thread_id, author_id, sender_name, sender_address, sender_kind, to_display, body, created_at)
  values (_thread_id, _me.id, _sender_name, _sender_address, _kind,
          (select array_agg(r.address order by r.added_at) from public.mail_recipients r where r.thread_id = _thread_id and r.address <> _sender_address),
          btrim(_body), _now);
  update public.mail_threads set last_message_at = _now, message_count = message_count + 1 where id = _thread_id
  returning subject into _subject_now;
  insert into public.mail_reads (thread_id, user_id, read_at) values (_thread_id, _me.id, _now)
  on conflict (thread_id, user_id) do update set read_at = excluded.read_at;

  _readers := array_remove(private.mail_readers(_thread_id), _me.id);
  perform private.notify(_readers, left(case when _new then 'Új levél: ' else 'Válasz: ' end || _subject_now, 160),
    left(_sender_name || ' <' || _sender_address || '>: ' || regexp_replace(btrim(_body), '\s+', ' ', 'g'), 300),
    'info', 'mail', '/mail?thread=' || _thread_id, 'mail:' || _thread_id);
  return _thread_id;
end;
$$;
revoke execute on function public.send_mail(text, text, jsonb, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.send_mail(text, text, jsonb, uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Investigations
-- ---------------------------------------------------------------------------

create table public.iab_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique,
  title text not null check (length(btrim(title)) between 3 and 160),
  summary text check (summary is null or length(summary) <= 4000),
  status text not null default 'open' check (status in ('open', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  lead_id uuid references public.profiles(id) on delete set null,
  opened_by uuid references public.profiles(id) on delete set null,
  opened_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references public.profiles(id) on delete set null,
  outcome text check (outcome in ('sustained', 'not_sustained', 'exonerated', 'unfounded', 'policy_failure', 'withdrawn')),
  closure text check (closure is null or length(closure) <= 8000),
  constraint iab_cases_closed_check check (status = 'open' or (outcome is not null and closed_at is not null))
);

create table public.iab_case_people (
  case_id uuid not null references public.iab_cases(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('subject', 'complainant', 'witness')),
  note text check (note is null or length(note) <= 500),
  added_by uuid references public.profiles(id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (case_id, user_id)
);
create index iab_case_people_user_idx on public.iab_case_people (user_id);

create table public.iab_case_entries (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.iab_cases(id) on delete cascade,
  kind text not null check (kind in ('memo', 'interview', 'note')),
  title text check (title is null or length(title) <= 200),
  body text not null check (length(btrim(body)) between 1 and 20000),
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index iab_case_entries_case_idx on public.iab_case_entries (case_id, created_at);

create table public.iab_case_mail (
  case_id uuid not null references public.iab_cases(id) on delete cascade,
  thread_id uuid not null references public.mail_threads(id) on delete cascade,
  linked_by uuid references public.profiles(id) on delete set null,
  linked_at timestamptz not null default now(),
  primary key (case_id, thread_id)
);
create index iab_case_mail_thread_idx on public.iab_case_mail (thread_id);

alter table public.iab_cases enable row level security;
alter table public.iab_case_people enable row level security;
alter table public.iab_case_entries enable row level security;
alter table public.iab_case_mail enable row level security;
revoke all on public.iab_cases, public.iab_case_people, public.iab_case_entries, public.iab_case_mail from anon, authenticated;

-- IAB members and the Bureau Manager, never the subject of the investigation.
create or replace function private.can_view_iab_case(_case uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_see_iab()
    and not exists (select 1 from public.iab_case_people x where x.case_id = _case and x.user_id = (select auth.uid()) and x.role = 'subject');
$$;
revoke execute on function private.can_view_iab_case(uuid) from public, anon;
grant execute on function private.can_view_iab_case(uuid) to authenticated;

create or replace function private.can_work_iab_case(_case uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_view_iab_case(_case) and exists (select 1 from public.iab_cases c where c.id = _case and c.status = 'open');
$$;
revoke execute on function private.can_work_iab_case(uuid) from public, anon, authenticated;

-- Closes and reopens: the lead of the investigation, the IAB's leadership, the Bureau Manager.
create or replace function private.can_close_iab_case(_case uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_view_iab_case(_case) and (
    private.is_iab_lead() or exists (select 1 from public.iab_cases c where c.id = _case and c.lead_id = (select auth.uid())));
$$;
revoke execute on function private.can_close_iab_case(uuid) from public, anon, authenticated;

create or replace function private.touch_iab_case(_case uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.iab_cases set updated_at = now() where id = _case;
$$;
revoke execute on function private.touch_iab_case(uuid) from public, anon, authenticated;

-- IAB members (not subjects of the case) to notify.
create or replace function private.iab_audience(_case uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(p.id), '{}') from public.profiles p
  where p.system_role <> 'pending' and (p.iab_title is not null or coalesce(p.is_bureau_manager, false))
    and not exists (select 1 from public.iab_case_people x where x.case_id = _case and x.user_id = p.id and x.role = 'subject');
$$;
revoke execute on function private.iab_audience(uuid) from public, anon, authenticated;

create or replace function private.person_json(_id uuid)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object('id', p.id, 'full_name', p.full_name, 'faction_rank', p.faction_rank, 'badge_number', p.badge_number,
                           'avatar_url', p.avatar_url, 'iab_title', p.iab_title)
  from public.profiles p where p.id = _id;
$$;
revoke execute on function private.person_json(uuid) from public, anon, authenticated;

create or replace function public.get_iab_overview()
returns json
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _me public.profiles := private.me();
begin
  if not private.can_see_iab() then raise exception 'A belső vizsgálatokat csak az IAB és a Bureau Manager látja.' using errcode = '42501'; end if;
  return json_build_object(
    'viewer', json_build_object('iab_title', _me.iab_title, 'is_lead', private.is_iab_lead(), 'is_member', _me.iab_title is not null),
    'members', (select coalesce(json_agg(private.person_json(p.id)
                                         order by array_position(array['sheriff', 'assistant_sheriff', 'chief_deputy', 'notary', 'agent'], p.iab_title), p.full_name), '[]')
                from public.profiles p where p.iab_title is not null and p.system_role <> 'pending'),
    'cases', (select coalesce(json_agg(json_build_object(
                'id', c.id, 'case_number', c.case_number, 'title', c.title, 'summary', left(c.summary, 240), 'status', c.status,
                'priority', c.priority, 'outcome', c.outcome, 'opened_at', c.opened_at, 'updated_at', c.updated_at, 'closed_at', c.closed_at,
                'lead', private.person_json(c.lead_id),
                'people', (select coalesce(json_agg(json_build_object('user_id', x.user_id, 'full_name', p.full_name, 'role', x.role)
                                                    order by x.role desc, p.full_name), '[]')
                           from public.iab_case_people x join public.profiles p on p.id = x.user_id where x.case_id = c.id),
                'entries', (select count(*) from public.iab_case_entries e where e.case_id = c.id),
                'mail', (select count(*) from public.iab_case_mail m where m.case_id = c.id))
              order by (c.status = 'open') desc, c.updated_at desc), '[]')
              from public.iab_cases c where private.can_view_iab_case(c.id)),
    'stats', json_build_object(
      'open', (select count(*) from public.iab_cases c where c.status = 'open' and private.can_view_iab_case(c.id)),
      'closed_90d', (select count(*) from public.iab_cases c where c.status = 'closed' and c.closed_at > now() - interval '90 days'
                       and private.can_view_iab_case(c.id)),
      'inbox_unread', (select count(*) from public.mail_threads t
                       where exists (select 1 from public.mail_recipients r where r.thread_id = t.id and r.group_key = 'iab')
                         and t.last_message_at > coalesce((select rd.read_at from public.mail_reads rd where rd.thread_id = t.id and rd.user_id = _me.id), '-infinity'))));
end;
$$;
revoke execute on function public.get_iab_overview() from public, anon, authenticated;
grant execute on function public.get_iab_overview() to authenticated;

create or replace function public.get_iab_case(_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _c public.iab_cases;
  _me uuid := (select auth.uid());
  _lead boolean := private.is_iab_lead();
begin
  select * into _c from public.iab_cases where id = _id;
  if _c.id is null or not private.can_view_iab_case(_id) then
    raise exception 'A vizsgálat nem található, vagy nem láthatod.' using errcode = '42501';
  end if;
  return json_build_object(
    'case', json_build_object('id', _c.id, 'case_number', _c.case_number, 'title', _c.title, 'summary', _c.summary, 'status', _c.status,
                              'priority', _c.priority, 'outcome', _c.outcome, 'closure', _c.closure, 'opened_at', _c.opened_at,
                              'updated_at', _c.updated_at, 'closed_at', _c.closed_at,
                              'lead', private.person_json(_c.lead_id), 'opened_by', private.person_json(_c.opened_by),
                              'closed_by', private.person_json(_c.closed_by)),
    'people', (select coalesce(json_agg(json_build_object('user_id', x.user_id, 'role', x.role, 'note', x.note, 'added_at', x.added_at,
                                                          'person', private.person_json(x.user_id))
                                        order by array_position(array['subject', 'complainant', 'witness'], x.role), x.added_at), '[]')
               from public.iab_case_people x where x.case_id = _id),
    'entries', (select coalesce(json_agg(json_build_object('id', e.id, 'kind', e.kind, 'title', e.title, 'body', e.body,
                                                           'created_at', e.created_at, 'updated_at', e.updated_at,
                                                           'author', private.person_json(e.author_id),
                                                           'can_edit', _c.status = 'open' and (e.author_id = _me or _lead))
                                         order by e.created_at), '[]')
                from public.iab_case_entries e where e.case_id = _id),
    'mail', (select coalesce(json_agg(json_build_object('thread_id', t.id, 'subject', t.subject, 'last_message_at', t.last_message_at,
                                                        'message_count', t.message_count) order by t.last_message_at desc), '[]')
             from public.iab_case_mail m join public.mail_threads t on t.id = m.thread_id where m.case_id = _id),
    'can_edit', private.can_work_iab_case(_id),
    'can_close', private.can_close_iab_case(_id));
end;
$$;
revoke execute on function public.get_iab_case(uuid) from public, anon, authenticated;
grant execute on function public.get_iab_case(uuid) to authenticated;

-- Opens (no id) or edits an investigation.
create or replace function public.save_iab_case(_id uuid, _title text, _summary text default null, _priority text default 'normal', _lead uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  _case_id uuid := _id;
  _number text;
  _old_lead uuid;
begin
  if _lead is not null and not exists (select 1 from public.profiles p where p.id = _lead and p.iab_title is not null and p.system_role <> 'pending') then
    raise exception 'A vizsgálatot az IAB egyik tagja vezetheti.';
  end if;
  if _id is null then
    if not private.can_see_iab() then raise exception 'Vizsgálatot az IAB és a Bureau Manager indíthat.' using errcode = '42501'; end if;
    perform pg_advisory_xact_lock(hashtext('iab_case_number'));
    select 'IAB-' || to_char(now(), 'YYYY') || '-' || lpad((count(*) + 1)::text, 3, '0') into _number
    from public.iab_cases where case_number like 'IAB-' || to_char(now(), 'YYYY') || '-%';
    insert into public.iab_cases (case_number, title, summary, priority, lead_id, opened_by)
    values (_number, btrim(_title), nullif(btrim(coalesce(_summary, '')), ''), coalesce(_priority, 'normal'), _lead, (select auth.uid()))
    returning id into _case_id;
    perform private.notify(array_remove(private.iab_audience(_case_id), (select auth.uid())), 'Új belső vizsgálat: ' || _number,
      btrim(_title), 'info', 'iab', '/iab/case/' || _case_id, 'iab:' || _case_id);
  else
    if not private.can_work_iab_case(_id) then raise exception 'A vizsgálat nem szerkeszthető.' using errcode = '42501'; end if;
    select lead_id into _old_lead from public.iab_cases where id = _id;
    update public.iab_cases set title = btrim(_title), summary = nullif(btrim(coalesce(_summary, '')), ''), priority = coalesce(_priority, 'normal'),
      lead_id = _lead, updated_at = now() where id = _id;
  end if;
  if _lead is not null and _lead is distinct from _old_lead and _lead <> (select auth.uid()) then
    perform private.notify(array[_lead], 'Te vezeted a belső vizsgálatot',
      (select case_number || ' · ' || title from public.iab_cases where id = _case_id), 'info', 'iab', '/iab/case/' || _case_id, 'iab-lead:' || _case_id);
  end if;
  return _case_id;
end;
$$;
revoke execute on function public.save_iab_case(uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.save_iab_case(uuid, text, text, text, uuid) to authenticated;

create or replace function public.set_iab_case_person(_case uuid, _user uuid, _role text, _note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_work_iab_case(_case) then raise exception 'A vizsgálat nem szerkeszthető.' using errcode = '42501'; end if;
  if _role is null then
    delete from public.iab_case_people where case_id = _case and user_id = _user;
  else
    if _user = (select auth.uid()) and _role = 'subject' then raise exception 'Saját magad nem lehetsz a vizsgálat alanya.'; end if;
    insert into public.iab_case_people (case_id, user_id, role, note, added_by)
    values (_case, _user, _role, nullif(btrim(coalesce(_note, '')), ''), (select auth.uid()))
    on conflict (case_id, user_id) do update set role = excluded.role, note = excluded.note;
  end if;
  perform private.touch_iab_case(_case);
end;
$$;
revoke execute on function public.set_iab_case_person(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.set_iab_case_person(uuid, uuid, text, text) to authenticated;

create or replace function public.save_iab_entry(_case uuid, _id uuid, _kind text, _title text, _body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  _entry uuid := _id;
begin
  if not private.can_work_iab_case(_case) then raise exception 'A vizsgálat nem szerkeszthető.' using errcode = '42501'; end if;
  if _id is null then
    insert into public.iab_case_entries (case_id, kind, title, body, author_id)
    values (_case, _kind, nullif(btrim(coalesce(_title, '')), ''), btrim(_body), (select auth.uid())) returning id into _entry;
  else
    update public.iab_case_entries set kind = _kind, title = nullif(btrim(coalesce(_title, '')), ''), body = btrim(_body), updated_at = now()
    where id = _id and case_id = _case and (author_id = (select auth.uid()) or private.is_iab_lead());
    if not found then raise exception 'Ezt a bejegyzést nem szerkesztheted.' using errcode = '42501'; end if;
  end if;
  perform private.touch_iab_case(_case);
  return _entry;
end;
$$;
revoke execute on function public.save_iab_entry(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.save_iab_entry(uuid, uuid, text, text, text) to authenticated;

create or replace function public.delete_iab_entry(_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _case uuid;
begin
  select case_id into _case from public.iab_case_entries where id = _id;
  if _case is null or not private.can_work_iab_case(_case) then raise exception 'A bejegyzés nem törölhető.' using errcode = '42501'; end if;
  delete from public.iab_case_entries
  where id = _id and ((author_id = (select auth.uid()) and created_at > now() - interval '30 minutes') or private.is_iab_lead());
  if not found then raise exception 'A saját bejegyzésedet fél órán belül törölheted, később az IAB vezetése.' using errcode = '42501'; end if;
  perform private.touch_iab_case(_case);
end;
$$;
revoke execute on function public.delete_iab_entry(uuid) from public, anon, authenticated;
grant execute on function public.delete_iab_entry(uuid) to authenticated;

create or replace function public.close_iab_case(_case uuid, _outcome text, _closure text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _number text;
begin
  if not private.can_close_iab_case(_case) or not exists (select 1 from public.iab_cases where id = _case and status = 'open') then
    raise exception 'A vizsgálatot a vezetője vagy az IAB vezetése zárhatja le.' using errcode = '42501';
  end if;
  if length(btrim(coalesce(_closure, ''))) < 10 then raise exception 'Írd le a lezárás indoklását (legalább 10 karakter).'; end if;
  update public.iab_cases set status = 'closed', outcome = _outcome, closure = btrim(_closure), closed_at = now(), closed_by = (select auth.uid()),
    updated_at = now() where id = _case returning case_number into _number;
  perform private.notify(array_remove(private.iab_audience(_case), (select auth.uid())), 'Lezárt belső vizsgálat: ' || _number,
    'A vizsgálatot lezárták.', 'info', 'iab', '/iab/case/' || _case, 'iab:' || _case);
end;
$$;
revoke execute on function public.close_iab_case(uuid, text, text) from public, anon, authenticated;
grant execute on function public.close_iab_case(uuid, text, text) to authenticated;

create or replace function public.reopen_iab_case(_case uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_close_iab_case(_case) then raise exception 'A vizsgálatot az IAB vezetése nyithatja újra.' using errcode = '42501'; end if;
  update public.iab_cases set status = 'open', outcome = null, closure = null, closed_at = null, closed_by = null, updated_at = now()
  where id = _case and status = 'closed';
end;
$$;
revoke execute on function public.reopen_iab_case(uuid) from public, anon, authenticated;
grant execute on function public.reopen_iab_case(uuid) to authenticated;

-- Links a mail thread the caller can read (e.g. a complaint to the IAB's mailbox) to an investigation.
create or replace function public.link_iab_mail(_case uuid, _thread uuid, _link boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_work_iab_case(_case) then raise exception 'A vizsgálat nem szerkeszthető.' using errcode = '42501'; end if;
  if _link then
    if not private.can_read_mail(_thread) then raise exception 'Ezt a levelet nem olvashatod.' using errcode = '42501'; end if;
    insert into public.iab_case_mail (case_id, thread_id, linked_by) values (_case, _thread, (select auth.uid())) on conflict do nothing;
  else
    delete from public.iab_case_mail where case_id = _case and thread_id = _thread;
  end if;
  perform private.touch_iab_case(_case);
end;
$$;
revoke execute on function public.link_iab_mail(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.link_iab_mail(uuid, uuid, boolean) to authenticated;

revoke execute on function public.get_mail_thread(uuid) from public, anon, authenticated;
grant execute on function public.get_mail_thread(uuid) to authenticated;

-- With the investigations in place: a letter linked to an investigation is also readable by those
-- who see that investigation (e.g. the Bureau Manager), for the caller only (not for notifications).
create or replace function private.can_read_mail(_thread uuid, _uid uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1 from public.mail_recipients r
      where r.thread_id = _thread
        and (r.user_id = coalesce(_uid, (select auth.uid()))
             or (r.group_key is not null and private.mail_group_member(r.group_key, coalesce(_uid, (select auth.uid()))))))
    or exists (select 1 from public.mail_messages m where m.thread_id = _thread and m.author_id = coalesce(_uid, (select auth.uid())))
    or (_uid is null and exists (select 1 from public.iab_case_mail cm where cm.thread_id = _thread and private.can_view_iab_case(cm.case_id)));
$$;

-- ---------------------------------------------------------------------------
-- 5. The dashboard: unread letters and open investigations (every earlier key kept)
-- ---------------------------------------------------------------------------

do $do$
declare
  _def text := pg_get_functiondef('public.get_dashboard_summary()'::regprocedure);
begin
  if position('''mail_unread''' in _def) = 0 then
    _def := replace(_def,
      $$'active_bolos', (select count(*) from bolo_alerts b where b.status = 'active' and b.expires_at > now())$$,
      $$'active_bolos', (select count(*) from bolo_alerts b where b.status = 'active' and b.expires_at > now()),
    -- Threads with a letter the member has not opened yet (inbox; letters to everyone only when addressed personally).
    'mail_unread', (select count(*) from mail_threads t
                    where t.last_message_at > now() - interval '60 days'
                      and t.last_message_at > coalesce((select rd.read_at from mail_reads rd where rd.thread_id = t.id and rd.user_id = _me.id), '-infinity')
                      and not t.broadcast
                      and exists (select 1 from mail_messages m where m.thread_id = t.id and m.created_at = t.last_message_at and m.author_id is distinct from _me.id)
                      and private.can_read_mail(t.id, _me.id)),
    -- Open internal investigations (IAB members and the Bureau Manager).
    'iab_open', case when _me.iab_title is not null or coalesce(_me.is_bureau_manager, false) then
      (select count(*) from iab_cases c where c.status = 'open' and private.can_view_iab_case(c.id)) end$$);
    if position('''mail_unread''' in _def) = 0 then raise exception 'get_dashboard_summary: the anchor for the new keys was not found'; end if;
    execute _def;
  end if;
end;
$do$;
