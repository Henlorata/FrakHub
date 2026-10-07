-- =============================================================================
-- The public front page and the news, edited by the Sheriff's Information Bureau (SIB).
--
-- site_content: the page's editable sections (hero, about, values, divisions, units, recruitment,
-- FAQ, gallery, contact, which sections show), one JSON value per key, seeded with defaults.
-- news_posts: articles (BlockNote text with pictures on Cloudinary, cover picture, category),
-- drafts until published; a published article may notify the members.
--
-- Editors (private.can_edit_site): the SIB (qualification or unit leader), the Command and Executive
-- Staff, the Bureau Manager. Visitors read through get_public_site(), get_public_news() and
-- get_news_post() (anon, published content and a few aggregate numbers only).
--
-- Compatible with the deployed frontend: new tables and functions only.
-- =============================================================================

create or replace function private.can_edit_site()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.system_role <> 'pending'
      and ('SIB' = any(coalesce(p.qualifications, '{}')) or 'SIB' = any(coalesce(p.commanded_divisions, '{}'))
           or private.rank_index(p.faction_rank) <= 6 or coalesce(p.is_bureau_manager, false)));
$$;
revoke execute on function private.can_edit_site() from public, anon;
grant execute on function private.can_edit_site() to authenticated;

-- url-friendly text: lower case, accents folded, everything else a hyphen.
create or replace function private.slugify(_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(btrim(regexp_replace(lower(translate(coalesce(_text, ''),
    'áàâäãåāăąçćčďđéèêëēėęěíìîïīłľĺñńňóòôöõøōőŕřśšşťţúùûüůūűųýÿžźżÁÀÂÄÃÅĀĂĄÇĆČĎĐÉÈÊËĒĖĘĚÍÌÎÏĪŁĽĹÑŃŇÓÒÔÖÕØŌŐŔŘŚŠŞŤŢÚÙÛÜŮŪŰŲÝŸŽŹŻ',
    'aaaaaaaaacccddeeeeeeeeiiiiilllnnnoooooooorrsssttuuuuuuuuyyzzzAAAAAAAAACCCDDEEEEEEEEIIIIILLLNNNOOOOOOOORRSSSTTUUUUUUUUYYZZZ')),
    '[^a-z0-9]+', '-', 'g'), '-'), 80);
$$;
revoke execute on function private.slugify(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Content
-- ---------------------------------------------------------------------------

create table public.site_content (
  key text primary key check (key in ('hero', 'about', 'values', 'divisions', 'units', 'recruitment', 'faq', 'gallery', 'contact', 'sections',
                                       'leadership')),
  value jsonb not null check (octet_length(value::text) <= 65536),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
alter table public.site_content enable row level security;
revoke all on public.site_content from anon, authenticated;

insert into public.site_content (key, value) values
('hero', jsonb_build_object(
  'eyebrow', 'San Fierro Sheriff''s Department',
  'title', 'A megye szolgálatában.',
  'highlight', 'Egy jelvény. Egy csapat.',
  'subtitle', 'Járőrszolgálat, nyomozás és különleges egységek San Fierro megyében. Fegyelem, szakértelem és összetartás: csatlakozz a megye legszervezettebb rendvédelmi szervéhez.',
  'primary', 'Csatlakozz hozzánk',
  'secondary', 'Legfrissebb hírek')),
('about', jsonb_build_object(
  'title', 'Rólunk',
  'lead', 'A San Fierro Sheriff''s Department a megye rendjének őre: az utcákon, az autópályákon, a levegőben és a nyomozószobákban.',
  'text', 'Osztályaink és egységeink együtt dolgoznak: a járőrszolgálat az első vonal, a Special Enforcement Bureau a legnehezebb helyzetek egysége, a Major Crimes Bureau pedig a súlyos bűnügyek nyomozója. Mindenki Trainee-ként kezdi, akadémián és mentor mellett tanul, és a saját teljesítménye viszi előre.')),
('values', jsonb_build_array(
  jsonb_build_object('title', 'Integrity', 'text', 'Becsület a szolgálatban és azon kívül. A jelvény bizalom, amit minden nap ki kell érdemelni.'),
  jsonb_build_object('title', 'Service', 'text', 'A megye lakóiért dolgozunk: segítünk, ahol kell, és ott vagyunk, ahol szükség van ránk.'),
  jsonb_build_object('title', 'Protection', 'text', 'Védjük a polgárokat, egymást és a jogrendet, fegyelemmel és szakértelemmel.'))),
('divisions', jsonb_build_object(
  'TSB', jsonb_build_object('name', 'TSB', 'subtitle', 'Általános állomány', 'text', 'Járőrszolgálat, az állomány gerince: forgalomellenőrzés, riasztások, helyszínbiztosítás. Innen indul mindenki.'),
  'SEB', jsonb_build_object('name', 'Special Enforcement Bureau', 'subtitle', 'Különleges egység', 'text', 'Taktikai beavatkozás, behatolás, túszhelyzetek: a legnehezebb bevetések egysége.'),
  'MCB', jsonb_build_object('name', 'Major Crimes Bureau', 'subtitle', 'Nyomozó részleg', 'text', 'Súlyos bűncselekmények, szervezett bűnözés, körözések: aktákkal, bizonyítékokkal és parancsokkal.'))),
('units', jsonb_build_object(
  'SAHP', jsonb_build_object('name', 'Highway Patrol', 'text', 'Forgalomirányítás, üldözések és az autópályák biztonsága.'),
  'AB', jsonb_build_object('name', 'Aero Bureau', 'text', 'Helikopteres járőrözés és légi támogatás a földi egységeknek.'),
  'MU', jsonb_build_object('name', 'Medical Unit', 'text', 'Elsősegély és mentés a helyszínen, a kollégáknak és a polgároknak.'),
  'GW', jsonb_build_object('name', 'Game Warden', 'text', 'Vadvédelem, vízi és terepi szolgálat a megye vadonában.'),
  'FAB', jsonb_build_object('name', 'Financial Administration Bureau', 'text', 'Pénzügyi adminisztráció: fizetések, költségtérítések, kassza.'),
  'SIB', jsonb_build_object('name', 'Sheriff''s Information Bureau', 'text', 'Kommunikáció és sajtó: hírek, közlemények, a department hangja.'),
  'TB', jsonb_build_object('name', 'Training Bureau', 'text', 'Oktatás és vizsgáztatás: az akadémiától a képesítésekig.'))),
('recruitment', jsonb_build_object(
  'title', 'Csatlakozz hozzánk',
  'text', 'Keressük azokat, akik komolyan veszik a szolgálatot, és szeretnének egy összetartó, jól szervezett csapat részei lenni.',
  'requirements', jsonb_build_array(
    'Tiszta előélet: büntetett előélet és aktív körözés nélkül',
    'Megbízható jelenlét és aktív szolgálat',
    'Működő mikrofon, Discord, a szabályzatok ismerete',
    'Sikeres felvételi vizsga'),
  'steps', jsonb_build_array(
    jsonb_build_object('title', 'Jelentkezés', 'text', 'Regisztrálj az oldalon, a Személyügy elbírálja a kérelmedet.'),
    jsonb_build_object('title', 'Felvételi vizsga', 'text', 'Rövid vizsga az alapokról: szabályok, kódok, helyzetek.'),
    jsonb_build_object('title', 'Akadémia', 'text', 'Napokra bontott tananyag és gyakorlás oktatókkal.'),
    jsonb_build_object('title', 'Trainee hét', 'text', 'Az első heted mentor mellett, éles szolgálatban.'),
    jsonb_build_object('title', 'Deputy Sheriff', 'text', 'Kinevezés és jelvény: innen a teljesítményed visz előre.')),
  'exam_id', null)),
('faq', jsonb_build_array(
  jsonb_build_object('q', 'Hogyan jelentkezhetek?', 'a', 'A „Csatlakozz hozzánk” gombbal regisztrálhatsz. A Személyügy elbírálja a kérelmedet, és értesít a következő lépésekről.'),
  jsonb_build_object('q', 'Mennyi ideig tart a felvétel?', 'a', 'A vizsga és az akadémia után következik a Trainee hét. Aki aktív, néhány hét alatt végigér az úton.'),
  jsonb_build_object('q', 'Mi az a Trainee hét?', 'a', 'Az első heted egy tapasztalt mentor mellett: éles szolgálatban tanulsz, és ő segít a kinevezésig.'),
  jsonb_build_object('q', 'Bekerülhetek rögtön egy különleges egységbe?', 'a', 'Mindenki a járőrszolgálatban kezd. A SEB, az MCB és az egységek később, képesítéssel és tapasztalattal érhetők el.'))),
('gallery', '[]'::jsonb),
('contact', jsonb_build_object('text', 'Kérdésed van? Írj nekünk a játékon belül, vagy keress minket a közösségi csatornáinkon.', 'links', '[]'::jsonb)),
('sections', jsonb_build_object('stats', true, 'leadership', true, 'gallery', true, 'faq', true, 'values', true)),
-- Leaders left off the front page (the SIB decides; a technical account named "Admin" from the start).
('leadership', jsonb_build_object('hidden', coalesce((select jsonb_agg(p.id order by p.created_at) from public.profiles p
                                                       where lower(btrim(coalesce(p.full_name, ''))) in ('admin', 'administrator')), '[]'::jsonb)));

-- The leaders the front page can show: the Bureau Managers, the Executive and Command Staff and the
-- Bureau Commanders (tier 0-3), with whether the SIB hid them.
create or replace function private.site_leaders()
returns table (id uuid, full_name text, faction_rank text, avatar_url text, division text, bureau_manager boolean, bureau_commander boolean,
               tier integer, hidden boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.faction_rank, p.avatar_url, p.division, coalesce(p.is_bureau_manager, false), coalesce(p.is_bureau_commander, false),
         case when coalesce(p.is_bureau_manager, false) then 0 when private.rank_index(p.faction_rank) <= 1 then 1
              when private.rank_index(p.faction_rank) <= 6 then 2 else 3 end,
         coalesce((select c.value -> 'hidden' from public.site_content c where c.key = 'leadership'), '[]'::jsonb) ? p.id::text
  from public.profiles p
  where p.system_role <> 'pending'
    and (coalesce(p.is_bureau_manager, false) or coalesce(p.is_bureau_commander, false) or private.rank_index(p.faction_rank) <= 6);
$$;
revoke execute on function private.site_leaders() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. News
-- ---------------------------------------------------------------------------

create table public.news_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 90),
  title text not null check (length(btrim(title)) between 3 and 160),
  excerpt text check (excerpt is null or length(excerpt) <= 400),
  body jsonb not null default '[]'::jsonb check (jsonb_typeof(body) = 'array' and octet_length(body::text) <= 300000),
  cover_url text check (cover_url is null or cover_url ~ '^https://res\.cloudinary\.com/'),
  category text not null default 'news' check (category in ('news', 'press', 'recruitment', 'operation', 'event', 'community', 'wanted')),
  status text not null default 'draft' check (status in ('draft', 'published')),
  featured boolean not null default false,
  published_at timestamptz,
  author_id uuid references public.profiles(id) on delete set null,
  author_display text check (author_display is null or length(author_display) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
create index news_posts_public_idx on public.news_posts (published_at desc) where status = 'published';
alter table public.news_posts enable row level security;
revoke all on public.news_posts from anon, authenticated;

create or replace function private.news_item(_p public.news_posts)
returns json
language sql
stable
set search_path = ''
as $$
  select json_build_object('id', _p.id, 'slug', _p.slug, 'title', _p.title, 'excerpt', _p.excerpt, 'cover_url', _p.cover_url,
                           'category', _p.category, 'featured', _p.featured, 'published_at', _p.published_at,
                           'author_display', coalesce(_p.author_display, 'Sheriff''s Information Bureau'));
$$;
revoke execute on function private.news_item(public.news_posts) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. What visitors read
-- ---------------------------------------------------------------------------

create or replace function public.get_public_site()
returns json
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'Europe/Budapest'
as $$
declare
  -- The list of hidden leaders stays on the server (it holds member ids).
  _content jsonb := (select coalesce(jsonb_object_agg(c.key, c.value), '{}'::jsonb) from public.site_content c where c.key <> 'leadership');
  _sections jsonb := coalesce(_content -> 'sections', '{}'::jsonb);
begin
  return json_build_object(
    'content', _content,
    'news', (select coalesce(json_agg(private.news_item(n) order by n.featured desc, n.published_at desc), '[]')
             from (select * from public.news_posts where status = 'published' and published_at <= now()
                   order by featured desc, published_at desc limit 8) n),
    'stats', case when coalesce((_sections ->> 'stats')::boolean, true) then json_build_object(
      'members', (select count(*) from public.profiles where system_role <> 'pending'),
      'divisions', (select coalesce(json_object_agg(d, n), '{}') from (select division d, count(*) n from public.profiles
                     where system_role <> 'pending' and division is not null group by division) x),
      'cases_closed_year', (select count(*) from public.cases where status in ('closed', 'archived') and closed_at >= date_trunc('year', now())),
      'actions_30d', (select count(*) from public.action_logs where created_at > now() - interval '30 days'),
      'duty_hours_month', (select coalesce(round(sum(minutes) / 60.0), 0) from public.duty_time_entries
                           where month = (date_trunc('month', current_date) - interval '1 month')::date),
      'since', (select extract(year from min(coalesce(d.joined_on, p.created_at::date)))::int
                from public.profiles p left join public.member_details d on d.user_id = p.id where p.system_role <> 'pending')) end,
    'leadership', case when coalesce((_sections ->> 'leadership')::boolean, true) then
      (select coalesce(json_agg(json_build_object('full_name', l.full_name, 'faction_rank', l.faction_rank, 'avatar_url', l.avatar_url,
                                                  'division', l.division, 'bureau_manager', l.bureau_manager, 'bureau_commander', l.bureau_commander,
                                                  'tier', l.tier)
                                order by l.bureau_manager desc, private.rank_index(l.faction_rank), l.full_name), '[]')
       from private.site_leaders() l where not l.hidden) end,
    'recruitment', json_build_object('open', coalesce((select s.recruitment_open from public.system_status s where s.id = 'global'), false)),
    'alert_level', (select s.alert_level from public.system_status s where s.id = 'global'));
end;
$$;
revoke execute on function public.get_public_site() from public;
grant execute on function public.get_public_site() to anon, authenticated;

create or replace function public.get_public_news(_category text default null, _before timestamptz default null, _limit integer default 12)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(json_agg(private.news_item(n) order by n.published_at desc), '[]')
  from (select * from public.news_posts
        where status = 'published' and published_at <= now()
          and (_category is null or category = _category) and (_before is null or published_at < _before)
        order by published_at desc limit least(greatest(coalesce(_limit, 12), 1), 48)) n;
$$;
revoke execute on function public.get_public_news(text, timestamptz, integer) from public;
grant execute on function public.get_public_news(text, timestamptz, integer) to anon, authenticated;

-- One article (editors also see drafts, for the preview).
create or replace function public.get_news_post(_slug text)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _p public.news_posts;
  _editor boolean := (select auth.uid()) is not null and private.can_edit_site();
begin
  select * into _p from public.news_posts where slug = lower(btrim(coalesce(_slug, '')));
  if _p.id is null or (not _editor and (_p.status <> 'published' or _p.published_at > now())) then return null; end if;
  return json_build_object(
    'post', (private.news_item(_p)::jsonb || jsonb_build_object('body', _p.body, 'status', _p.status, 'updated_at', _p.updated_at))::json,
    'newer', (select private.news_item(n) from public.news_posts n where n.status = 'published' and n.published_at > coalesce(_p.published_at, now())
              and n.published_at <= now() order by n.published_at limit 1),
    'older', (select private.news_item(n) from public.news_posts n where n.status = 'published' and n.published_at < coalesce(_p.published_at, now())
              order by n.published_at desc limit 1),
    'related', (select coalesce(json_agg(private.news_item(n) order by n.published_at desc), '[]')
                from (select * from public.news_posts n where n.status = 'published' and n.published_at <= now() and n.id <> _p.id
                      order by (n.category = _p.category) desc, n.published_at desc limit 3) n));
end;
$$;
revoke execute on function public.get_news_post(text) from public;
grant execute on function public.get_news_post(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. The SIB's desk
-- ---------------------------------------------------------------------------

create or replace function public.get_site_editor()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_edit_site() then raise exception 'A nyilvános oldalt a SIB és a vezetőség szerkeszti.' using errcode = '42501'; end if;
  return json_build_object(
    'content', (select coalesce(jsonb_object_agg(c.key, c.value), '{}'::jsonb) from public.site_content c),
    'updated', (select coalesce(json_object_agg(c.key, json_build_object('at', c.updated_at, 'by', p.full_name)), '{}')
                from public.site_content c left join public.profiles p on p.id = c.updated_by),
    'leaders', (select coalesce(json_agg(json_build_object('id', l.id, 'full_name', l.full_name, 'faction_rank', l.faction_rank,
                                                         'avatar_url', l.avatar_url, 'tier', l.tier, 'hidden', l.hidden)
                                order by l.bureau_manager desc, private.rank_index(l.faction_rank), l.full_name), '[]')
                from private.site_leaders() l),
    'posts', (select coalesce(json_agg((private.news_item(n)::jsonb || jsonb_build_object(
                'status', n.status, 'updated_at', n.updated_at, 'created_at', n.created_at,
                'author', (select p.full_name from public.profiles p where p.id = n.author_id)))::json
                order by (n.status = 'draft') desc, coalesce(n.published_at, n.updated_at) desc), '[]')
              from public.news_posts n));
end;
$$;
revoke execute on function public.get_site_editor() from public, anon, authenticated;
grant execute on function public.get_site_editor() to authenticated;

-- The full article for the editor (drafts included).
create or replace function public.get_news_post_editor(_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _p public.news_posts;
begin
  if not private.can_edit_site() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  select * into _p from public.news_posts where id = _id;
  if _p.id is null then return null; end if;
  return (private.news_item(_p)::jsonb || jsonb_build_object('body', _p.body, 'status', _p.status, 'updated_at', _p.updated_at,
          'author_display_raw', _p.author_display))::json;
end;
$$;
revoke execute on function public.get_news_post_editor(uuid) from public, anon, authenticated;
grant execute on function public.get_news_post_editor(uuid) to authenticated;

create or replace function public.save_site_content(_key text, _value jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_edit_site() then raise exception 'A nyilvános oldalt a SIB és a vezetőség szerkeszti.' using errcode = '42501'; end if;
  if _value is null then raise exception 'Üres tartalom.'; end if;
  if _value::text ~ 'data:image' then raise exception 'A képeket töltsd fel, ne illeszd be a szövegbe.'; end if;
  if _key = 'leadership' and (jsonb_typeof(_value -> 'hidden') is distinct from 'array'
      or exists (select 1 from jsonb_array_elements(_value -> 'hidden') h
                 where jsonb_typeof(h) <> 'string' or h #>> '{}' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) then
    raise exception 'Hibás vezetőlista.' using errcode = '22023';
  end if;
  insert into public.site_content (key, value, updated_at, updated_by) values (_key, _value, now(), (select auth.uid()))
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by;
end;
$$;
revoke execute on function public.save_site_content(text, jsonb) from public, anon, authenticated;
grant execute on function public.save_site_content(text, jsonb) to authenticated;

-- Creates (no id) or updates an article; the address (slug) follows the title until published.
create or replace function public.save_news_post(
  _id uuid, _title text, _excerpt text, _body jsonb, _cover_url text, _category text, _featured boolean, _author_display text default null,
  _slug text default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  _row public.news_posts;
  _base text;
  _candidate text;
  _n integer := 1;
begin
  if not private.can_edit_site() then raise exception 'Híreket a SIB és a vezetőség írhat.' using errcode = '42501'; end if;
  if coalesce(_body, '[]'::jsonb)::text ~ 'data:image' then raise exception 'A képeket töltsd fel, ne illeszd be a szövegbe.'; end if;
  if _id is not null then select * into _row from public.news_posts where id = _id; end if;
  _base := private.slugify(coalesce(nullif(btrim(coalesce(_slug, '')), ''), _title));
  if _base = '' then _base := 'hir'; end if;
  -- A published article keeps its address unless a new one is given.
  if _row.id is not null and _row.status = 'published' and nullif(btrim(coalesce(_slug, '')), '') is null then _base := _row.slug; end if;
  _candidate := _base;
  while exists (select 1 from public.news_posts where slug = _candidate and id is distinct from _id) loop
    _n := _n + 1;
    _candidate := left(_base, 80) || '-' || _n;
  end loop;
  if _row.id is null then
    insert into public.news_posts (slug, title, excerpt, body, cover_url, category, featured, author_id, author_display, updated_by)
    values (_candidate, btrim(_title), nullif(btrim(coalesce(_excerpt, '')), ''), coalesce(_body, '[]'::jsonb), nullif(_cover_url, ''),
            coalesce(_category, 'news'), coalesce(_featured, false), (select auth.uid()), nullif(btrim(coalesce(_author_display, '')), ''), (select auth.uid()))
    returning * into _row;
  else
    update public.news_posts set slug = _candidate, title = btrim(_title), excerpt = nullif(btrim(coalesce(_excerpt, '')), ''),
      body = coalesce(_body, '[]'::jsonb), cover_url = nullif(_cover_url, ''), category = coalesce(_category, 'news'),
      featured = coalesce(_featured, false), author_display = nullif(btrim(coalesce(_author_display, '')), ''),
      updated_at = now(), updated_by = (select auth.uid())
    where id = _row.id returning * into _row;
  end if;
  return json_build_object('id', _row.id, 'slug', _row.slug);
end;
$$;
revoke execute on function public.save_news_post(uuid, text, text, jsonb, text, text, boolean, text, text) from public, anon, authenticated;
grant execute on function public.save_news_post(uuid, text, text, jsonb, text, text, boolean, text, text) to authenticated;

create or replace function public.publish_news_post(_id uuid, _publish boolean, _notify boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _row public.news_posts;
begin
  if not private.can_edit_site() then raise exception 'Híreket a SIB és a vezetőség tehet közzé.' using errcode = '42501'; end if;
  update public.news_posts set status = case when _publish then 'published' else 'draft' end,
    published_at = case when _publish then coalesce(published_at, now()) else published_at end,
    updated_at = now(), updated_by = (select auth.uid())
  where id = _id returning * into _row;
  if _row.id is null then raise exception 'A hír nem található.'; end if;
  if _publish and _notify then
    perform private.notify(array(select id from public.profiles where system_role <> 'pending'), 'Új hír: ' || _row.title,
      coalesce(_row.excerpt, 'Megjelent a nyilvános oldalon.'), 'info', 'announcement', '/news/' || _row.slug, 'news:' || _row.id);
  end if;
end;
$$;
revoke execute on function public.publish_news_post(uuid, boolean, boolean) from public, anon, authenticated;
grant execute on function public.publish_news_post(uuid, boolean, boolean) to authenticated;

create or replace function public.delete_news_post(_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_edit_site() then raise exception 'Nincs jogosultságod.' using errcode = '42501'; end if;
  delete from public.news_posts where id = _id;
end;
$$;
revoke execute on function public.delete_news_post(uuid) from public, anon, authenticated;
grant execute on function public.delete_news_post(uuid) to authenticated;
