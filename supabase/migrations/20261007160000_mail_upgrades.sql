-- Mail: search in the letters one may read, read receipts for writers (and for the offices on
-- letters to all@), and letter templates with tokens ({{címzett}}, {{feladó}}, ...): personal ones,
-- and shared ones kept by those who may write to everyone (staff, IAB, SIB).

-- ---------------------------------------------------------------------------------------------
-- Search
-- ---------------------------------------------------------------------------------------------

create or replace function public.search_mail(_query text, _limit integer default 30)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _me uuid := (select auth.uid());
  _q text := btrim(coalesce(_query, ''));
  _pattern text;
begin
  if not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  if char_length(_q) < 2 then return '[]'::json; end if;
  _pattern := '%' || replace(replace(replace(left(_q, 80), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return (
    select coalesce(json_agg(x.item order by x.last_message_at desc), '[]'::json)
    from (
      select t.last_message_at,
             private.mail_thread_json(t, _me)::jsonb || jsonb_build_object('match', (
               select substr(m.body, greatest(1, strpos(lower(m.body), lower(_q)) - 60), 180)
               from public.mail_messages m
               where m.thread_id = t.id and m.body ilike _pattern
               order by m.created_at desc limit 1)) as item
      from public.mail_threads t
      where (t.subject ilike _pattern
             or exists (select 1 from public.mail_messages m
                        where m.thread_id = t.id
                          and (m.body ilike _pattern or m.sender_name ilike _pattern or m.sender_address ilike _pattern))
             or exists (select 1 from public.mail_recipients r where r.thread_id = t.id and r.address ilike _pattern))
        and private.can_read_mail(t.id)
      order by t.last_message_at desc
      limit least(greatest(coalesce(_limit, 30), 1), 60)
    ) x);
end;
$$;
revoke execute on function public.search_mail(text, integer) from public, anon, authenticated;
grant execute on function public.search_mail(text, integer) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Read receipts
-- ---------------------------------------------------------------------------------------------

-- Who sees who has read a thread: those who wrote in it, and on letters to all@ the offices that
-- may write to everyone.
create or replace function private.can_see_mail_receipts(_thread uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.mail_messages m where m.thread_id = _thread and m.author_id = (select auth.uid()))
      or (private.can_mail_broadcast() and exists (select 1 from public.mail_threads t where t.id = _thread and t.broadcast))
$$;
revoke execute on function private.can_see_mail_receipts(uuid) from public, anon, authenticated;

-- The readers (everyone who may read it, except the writers) and who of them has opened it.
create or replace function public.get_mail_receipts(_thread uuid)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_member() or not private.can_see_mail_receipts(_thread) then
    raise exception 'Az olvasottságot a levél írói látják.' using errcode = '42501';
  end if;
  return (
    with readers as (
      select p.id, p.full_name, p.faction_rank, p.badge_number, p.avatar_url
      from public.profiles p
      where p.id = any(private.mail_readers(_thread))
        and not exists (select 1 from public.mail_messages m where m.thread_id = _thread and m.author_id = p.id)
    ), marked as (
      select r.*, rd.read_at from readers r
      left join public.mail_reads rd on rd.thread_id = _thread and rd.user_id = r.id
    )
    select json_build_object(
      'total', (select count(*) from marked),
      'read', (select count(*) from marked where read_at is not null),
      'last_message_at', (select t.last_message_at from public.mail_threads t where t.id = _thread),
      'readers', coalesce((select json_agg(json_build_object('user_id', m.id, 'full_name', m.full_name, 'faction_rank', m.faction_rank,
                                                             'badge_number', m.badge_number, 'avatar_url', m.avatar_url, 'read_at', m.read_at)
                                           order by m.read_at desc nulls last, m.full_name)
                           from marked m), '[]'::json))
  );
end;
$$;
revoke execute on function public.get_mail_receipts(uuid) from public, anon, authenticated;
grant execute on function public.get_mail_receipts(uuid) to authenticated;

-- The thread view carries the counts for those who may see them (the list loads on demand).
do $do$
declare
  _def text := replace(pg_get_functiondef('public.get_mail_thread(uuid)'::regprocedure), chr(13), '');
  _anchor text := $a$'can_reply', private.can_reply_mail(_id),$a$;
begin
  if position('''receipts''' in _def) = 0 then
    if position(_anchor in _def) = 0 then raise exception 'get_mail_thread: the anchor for receipts was not found'; end if;
    _def := replace(_def, _anchor, _anchor || $b$
    -- How many of the readers have opened it (writers, and the offices on letters to all@).
    'receipts', case when private.can_see_mail_receipts(_id) then (
      select json_build_object('total', count(*), 'read', count(*) filter (where rd.read_at is not null))
      from unnest(private.mail_readers(_id)) as reader(id)
      left join public.mail_reads rd on rd.thread_id = _id and rd.user_id = reader.id
      where not exists (select 1 from public.mail_messages m where m.thread_id = _id and m.author_id = reader.id)) end,$b$);
    execute _def;
  end if;
end;
$do$;

-- ---------------------------------------------------------------------------------------------
-- Templates
-- ---------------------------------------------------------------------------------------------

create table if not exists public.mail_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 80),
  subject text not null default '' check (char_length(subject) <= 200),
  body text not null check (char_length(body) between 1 and 8000),
  shared boolean not null default false,
  owner_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (shared or owner_id is not null)
);
create index if not exists mail_templates_owner_idx on public.mail_templates (owner_id);
alter table public.mail_templates enable row level security;
revoke all on public.mail_templates from anon, authenticated;

create or replace function public.get_mail_templates()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select case when not private.is_member() then '[]'::json else coalesce((
    select json_agg(json_build_object(
      'id', t.id, 'title', t.title, 'subject', t.subject, 'body', t.body, 'shared', t.shared, 'mine', t.owner_id = (select auth.uid()),
      'can_edit', case when t.shared then private.can_mail_broadcast() else t.owner_id = (select auth.uid()) end,
      'updated_at', t.updated_at)
      order by t.shared desc, t.title)
    from public.mail_templates t
    where t.shared or t.owner_id = (select auth.uid())), '[]'::json) end
$$;
revoke execute on function public.get_mail_templates() from public, anon, authenticated;
grant execute on function public.get_mail_templates() to authenticated;

create or replace function public.save_mail_template(_id uuid, _title text, _subject text, _body text, _shared boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := (select auth.uid());
  _t public.mail_templates%rowtype;
begin
  if not private.is_member() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  if coalesce(_shared, false) and not private.can_mail_broadcast() then
    raise exception 'Közös sablont a staff, az IAB és a SIB készíthet.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(_title, ''))) < 2 then raise exception 'Adj nevet a sablonnak.' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(_body, ''))) = 0 then raise exception 'A sablon szövege üres.' using errcode = '22023'; end if;

  if _id is null then
    if (select count(*) from public.mail_templates where owner_id = _uid and not shared) >= 30 then
      raise exception 'Legfeljebb 30 saját sablonod lehet.' using errcode = '22023';
    end if;
    insert into public.mail_templates (title, subject, body, shared, owner_id)
    values (btrim(_title), btrim(coalesce(_subject, '')), _body, coalesce(_shared, false), _uid)
    returning id into _id;
    return _id;
  end if;

  select * into _t from public.mail_templates where id = _id for update;
  if _t.id is null then raise exception 'A sablon nem található.' using errcode = 'P0002'; end if;
  if not (case when _t.shared then private.can_mail_broadcast() else _t.owner_id = _uid end) then
    raise exception 'Ezt a sablont nem módosíthatod.' using errcode = '42501';
  end if;
  update public.mail_templates
  set title = btrim(_title), subject = btrim(coalesce(_subject, '')), body = _body, shared = coalesce(_shared, false) and private.can_mail_broadcast(),
      owner_id = coalesce(owner_id, _uid), updated_at = now()
  where id = _id;
  return _id;
end;
$$;
revoke execute on function public.save_mail_template(uuid, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.save_mail_template(uuid, text, text, text, boolean) to authenticated;

create or replace function public.delete_mail_template(_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _t public.mail_templates%rowtype;
begin
  select * into _t from public.mail_templates where id = _id;
  if _t.id is null then raise exception 'A sablon nem található.' using errcode = 'P0002'; end if;
  if not (case when _t.shared then private.can_mail_broadcast() else _t.owner_id = (select auth.uid()) end) then
    raise exception 'Ezt a sablont nem törölheted.' using errcode = '42501';
  end if;
  delete from public.mail_templates where id = _id;
end;
$$;
revoke execute on function public.delete_mail_template(uuid) from public, anon, authenticated;
grant execute on function public.delete_mail_template(uuid) to authenticated;

-- A few shared letters to start with (the leadership edits or deletes them).
insert into public.mail_templates (title, subject, body, shared)
select x.title, x.subject, x.body, true
from (values
  ('Előléptetés', 'Előléptetés',
   E'Tisztelt {{címzett_rang}} {{címzett}}!\n\nÖrömmel értesítjük, hogy a San Fierro Sheriff''s Department vezetése a mai nappal előléptette. Köszönjük az eddigi elkötelezett munkáját, és sok sikert kívánunk az új beosztásához.\n\nSan Fierro, {{dátum}}\n\nTisztelettel:\n{{feladó}}\n{{feladó_rang}}'),
  ('Írásbeli figyelmeztetés', 'Írásbeli figyelmeztetés',
   E'Tisztelt {{címzett_rang}} {{címzett}}!\n\nÉrtesítjük, hogy az alábbi ügyben írásbeli figyelmeztetésben részesül:\n\n[Az eset rövid leírása, időpontja és a megsértett szabály]\n\nA figyelmeztetés a személyi lapján szerepel. Ha észrevétele van, válaszlevélben jelezheti.\n\nSan Fierro, {{dátum}}\n\nTisztelettel:\n{{feladó}}\n{{feladó_rang}}'),
  ('IAB meghallgatás', 'Idézés meghallgatásra',
   E'Tisztelt {{címzett_rang}} {{címzett}}!\n\nAz Internal Affairs Bureau egy folyamatban lévő vizsgálat ügyében meghallgatásra idézi.\n\nIdőpont: [nap, óra]\nHelyszín: [helyszín]\n\nKérjük, a megadott időpontban jelenjen meg. Ha akadályoztatva van, válaszlevélben jelezze.\n\nSan Fierro, {{dátum}}\n\nTisztelettel:\n{{feladó}}\n{{feladó_rang}}'),
  ('Tájékoztatás az állománynak', 'Tájékoztatás',
   E'Tisztelt Kollégák!\n\n[A tájékoztatás szövege]\n\nKérdés esetén válaszlevélben vagy a vezetőségnél érdeklődhettek.\n\nSan Fierro, {{dátum}}\n\nTisztelettel:\n{{feladó}}\n{{feladó_rang}}')
) as x(title, subject, body)
where not exists (select 1 from public.mail_templates t where t.shared and t.title = x.title);
